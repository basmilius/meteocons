import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { readManifest, readSvg } from './cache';
import { findConfig, resolveConfig } from './config-loader';
import { processSvg } from './svg/processor';
import { generateLottie } from './lottie/generator';

const args = parseArgs(process.argv.slice(2));
const outputDir = args['out'] ?? join(import.meta.dir, '..', 'output');
const pageFilter = args['page'];
const frameFilter = args['frame'];

const manifest = readManifest();

const age = Math.round((Date.now() - new Date(manifest.fetchedAt).getTime()) / 60000);
console.log(`Cache van ${manifest.fetchedAt.slice(0, 16).replace('T', ' ')} (${age} minuten geleden)`);
console.log(`${manifest.frames.length} frames in cache\n`);

let frames = manifest.frames;

if (pageFilter) {
    frames = frames.filter(f => f.pageName === pageFilter);
    if (frames.length === 0) {
        console.error(`Error: geen frames gevonden voor page "${pageFilter}".`);
        process.exit(1);
    }
}

if (frameFilter) {
    frames = frames.filter(f => f.frameName === frameFilter);
    if (frames.length === 0) {
        console.error(`Error: frame "${frameFilter}" niet gevonden in cache.`);
        process.exit(1);
    }
}

const bySubfolder = Map.groupBy(frames, f => f.subfolder);

let totalExported = 0;
let totalSkipped = 0;
const noConfig: string[] = [];

for (const [subfolder, subFrames] of bySubfolder) {
    const pages = [...new Set(subFrames.map(f => f.pageName))];
    console.log(`[${pages.join(', ')}]  →  ${subfolder}/  (${subFrames.length} frames)`);

    const svgDir = join(outputDir, subfolder, 'svg');
    const lottieDir = join(outputDir, subfolder, 'lottie');
    mkdirSync(svgDir, {recursive: true});
    mkdirSync(lottieDir, {recursive: true});

    let exported = 0;
    let skipped = 0;

    for (const frame of subFrames) {
        const svgContent = readSvg(frame.nodeId);

        if (!svgContent) {
            console.warn(`  ⚠  ${frame.frameName} — niet in cache (voer fetch opnieuw uit)`);
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
            writeFileSync(join(svgDir, `${slug}.static.svg`), toViewBox(svgContent), 'utf-8');
            writeFileSync(join(lottieDir, `${slug}.lottie.json`), JSON.stringify(generateLottie(svgContent, staticConfig)), 'utf-8');
            skipped++;
            continue;
        }

        const resolved = resolveConfig(config, subfolder, frame.frameName);

        if (resolved.static || Object.keys(resolved.layers).length === 0) {
            const slug = toSlug(frame.frameName);
            const staticConfig = {static: true, layers: {}};
            writeFileSync(join(svgDir, `${slug}.static.svg`), toViewBox(svgContent), 'utf-8');
            writeFileSync(join(lottieDir, `${slug}.lottie.json`), JSON.stringify(generateLottie(svgContent, staticConfig)), 'utf-8');
            console.warn(`  ⚠  ${frame.frameName} — static`);
            skipped++;
            continue;
        }

        const slug = toSlug(frame.frameName);

        writeFileSync(join(svgDir, `${slug}.animated.svg`), processSvg(svgContent, resolved), 'utf-8');
        writeFileSync(join(lottieDir, `${slug}.lottie.json`), JSON.stringify(generateLottie(svgContent, resolved)), 'utf-8');

        const summary = Object.keys(resolved.layers).join(', ');
        console.log(`  ✓  ${frame.frameName}  [${summary}]`);
        exported++;
    }

    console.log(`  ${exported} exported, ${skipped} skipped\n`);
    totalExported += exported;
    totalSkipped += skipped;
}

console.log(`Klaar — ${totalExported} exported, ${totalSkipped} skipped → ${outputDir}/`);

if (noConfig.length > 0) {
    console.log(`\n── Geen config gevonden (${noConfig.length} icons) ─────────────────────────`);
    console.log(`   Voeg toe aan animations/configs/\n`);
    console.log(`  ${noConfig.sort().join('\n  ')}\n`);
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
