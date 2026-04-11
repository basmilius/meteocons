import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { readManifest, readSvg } from './cache';
import { findConfig, resolveConfig } from './config-loader';
import { processSvg, applyMonochromeColors } from './svg/processor';
import { generateLottie } from './lottie/generator';

export interface ExportOptions {
    outputDir?: string;
    pageFilter?: string;
    frameFilter?: string;
    silent?: boolean;
}

export interface ExportResult {
    exported: number;
    skipped: number;
    noConfig: string[];
}

export function exportIcons(options: ExportOptions = {}): ExportResult {
    const outputDir = options.outputDir ?? join(import.meta.dir, '..', 'output');
    const log = options.silent ? (() => {}) : console.log.bind(console);
    const warn = options.silent ? (() => {}) : console.warn.bind(console);

    const manifest = readManifest();

    const age = Math.round((Date.now() - new Date(manifest.fetchedAt).getTime()) / 60000);
    log(`Cache from ${manifest.fetchedAt.slice(0, 16).replace('T', ' ')} (${age} minutes ago)`);
    log(`${manifest.frames.length} frames in cache\n`);

    let frames = manifest.frames;

    if (options.pageFilter) {
        frames = frames.filter(f => f.pageName === options.pageFilter);
        if (frames.length === 0) {
            throw new Error(`No frames found for page "${options.pageFilter}".`);
        }
    }

    if (options.frameFilter) {
        frames = frames.filter(f => f.frameName === options.frameFilter);
        if (frames.length === 0) {
            throw new Error(`Frame "${options.frameFilter}" not found in cache.`);
        }
    }

    const bySubfolder = Map.groupBy(frames, f => f.subfolder);

    let totalExported = 0;
    let totalSkipped = 0;
    const noConfig: string[] = [];

    for (const [subfolder, subFrames] of bySubfolder) {
        const pages = [...new Set(subFrames.map(f => f.pageName))];
        log(`[${pages.join(', ')}]  →  ${subfolder}/  (${subFrames.length} frames)`);

        const svgDir = join(outputDir, subfolder, 'svg');
        const lottieDir = join(outputDir, subfolder, 'lottie');
        mkdirSync(svgDir, {recursive: true});
        mkdirSync(lottieDir, {recursive: true});

        let exported = 0;
        let skipped = 0;

        for (const frame of subFrames) {
            const svgContent = readSvg(frame.nodeId);

            if (!svgContent) {
                warn(`  ⚠  ${frame.frameName} — not in cache (re-run fetch)`);
                skipped++;
                continue;
            }

            // Load animation config from JSON
            const config = findConfig(frame.frameName);

            if (!config) {
                // No config found — track and export static
                if (!noConfig.includes(frame.frameName)) {
                    noConfig.push(frame.frameName);
                }
                const slug = toSlug(frame.frameName);
                const staticConfig = {static: true, layers: {}};
                let staticSvg = toViewBox(svgContent);
                if (subfolder === 'monochrome') {
                    staticSvg = applyMonochromeColors(staticSvg);
                }
                writeFileSync(join(svgDir, `${slug}.static.svg`), staticSvg, 'utf-8');
                writeFileSync(join(lottieDir, `${slug}.lottie.json`), JSON.stringify(generateLottie(svgContent, staticConfig)), 'utf-8');
                skipped++;
                continue;
            }

            const resolved = resolveConfig(config, subfolder, frame.frameName);

            if (resolved.static || Object.keys(resolved.layers).length === 0) {
                const slug = toSlug(frame.frameName);
                const staticConfig = {static: true, layers: {}};
                let staticSvg = toViewBox(svgContent);
                if (subfolder === 'monochrome') {
                    staticSvg = applyMonochromeColors(staticSvg);
                }
                writeFileSync(join(svgDir, `${slug}.static.svg`), staticSvg, 'utf-8');
                writeFileSync(join(lottieDir, `${slug}.lottie.json`), JSON.stringify(generateLottie(svgContent, staticConfig)), 'utf-8');
                warn(`  ⚠  ${frame.frameName} — static`);
                skipped++;
                continue;
            }

            const slug = toSlug(frame.frameName);

            let animatedSvg = processSvg(svgContent, resolved);
            if (subfolder === 'monochrome') {
                animatedSvg = applyMonochromeColors(animatedSvg);
            }
            writeFileSync(join(svgDir, `${slug}.animated.svg`), animatedSvg, 'utf-8');
            writeFileSync(join(lottieDir, `${slug}.lottie.json`), JSON.stringify(generateLottie(svgContent, resolved)), 'utf-8');

            const summary = Object.keys(resolved.layers).join(', ');
            log(`  ✓  ${frame.frameName}  [${summary}]`);
            exported++;
        }

        log(`  ${exported} exported, ${skipped} skipped\n`);
        totalExported += exported;
        totalSkipped += skipped;
    }

    log(`Done — ${totalExported} exported, ${totalSkipped} skipped → ${outputDir}/`);

    if (noConfig.length > 0) {
        log(`\n── No config found (${noConfig.length} icons) ─────────────────────────`);
        log(`   Add to animations/configs/\n`);
        log(`  ${noConfig.sort().join('\n  ')}\n`);
    }

    return {exported: totalExported, skipped: totalSkipped, noConfig};
}

// --- CLI entry point ---
if (import.meta.main) {
    const args = parseArgs(process.argv.slice(2));

    try {
        exportIcons({
            outputDir: args['out'],
            pageFilter: args['page'],
            frameFilter: args['frame'],
        });
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
    }
}

function toSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function toViewBox(svg: string): string {
    const widthMatch = svg.match(/\bwidth="(\d+(?:\.\d+)?)"/);
    const heightMatch = svg.match(/\bheight="(\d+(?:\.\d+)?)"/);
    if (!widthMatch || !heightMatch) {
        return svg;
    }

    let result = svg;
    if (!result.includes('viewBox')) {
        result = result.replace(/<svg\b/, `<svg viewBox="0 0 ${widthMatch[1]} ${heightMatch[1]}"`);
    }
    result = result.replace(/\s*width="\d+(?:\.\d+)?"/, '');
    result = result.replace(/\s*height="\d+(?:\.\d+)?"/, '');
    return result;
}

function parseArgs(argv: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = argv[i + 1];
            result[key] = next && !next.startsWith('--') ? (i++, next) : 'true';
        }
    }
    return result;
}
