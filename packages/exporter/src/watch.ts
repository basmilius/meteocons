/**
 * File watcher for live icon updates during development.
 *
 * Watches animations/configs/, animations/partials/ and optionally .cache/svgs/.
 * On change: export → publish → prepare-icons (docs/preview) → browser reload.
 *
 * Usage:
 *   bun watch              — watch + export + publish
 *   bun watch --docs       — also run prepare-icons for docs
 *   bun watch --frame X    — only export frame X (faster)
 */

import { watch, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { clearConfigCache } from './config-loader';
import { exportIcons } from './export';
import { publishIcons } from './publish-icons';

const ROOT_DIR = join(import.meta.dir, '..', '..', '..');
const ANIMATIONS_DIR = join(ROOT_DIR, 'animations');
const CONFIGS_DIR = join(ANIMATIONS_DIR, 'configs');
const PARTIALS_DIR = join(ANIMATIONS_DIR, 'partials');
const CACHE_DIR = join(import.meta.dir, '..', '.cache', 'svgs');
const DOCS_DIR = join(ROOT_DIR, 'packages', 'docs');
const PREVIEW_DIR = join(ROOT_DIR, 'packages', 'preview');

const DEBOUNCE_MS = 300;

const args = new Set(process.argv.slice(2));
const withDocs = args.has('--docs');
const frameFilter = getArgValue('--frame');

function getArgValue(flag: string): string | undefined {
    const argv = process.argv.slice(2);
    const index = argv.indexOf(flag);
    if (index === -1 || index + 1 >= argv.length) {
        return undefined;
    }
    return argv[index + 1];
}

function timestamp(): string {
    return new Date().toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
}

async function runPipeline(changedFiles: string[]): Promise<void> {
    const start = performance.now();

    console.log(`\n[${timestamp()}] Change detected:`);
    for (const file of changedFiles.slice(0, 5)) {
        console.log(`  → ${file}`);
    }
    if (changedFiles.length > 5) {
        console.log(`  ... and ${changedFiles.length - 5} more`);
    }

    try {
        // 1. Clear config cache so new configs are loaded
        clearConfigCache();

        // 2. Export
        const exportResult = exportIcons({
            frameFilter,
            silent: true,
        });
        console.log(`  Export: ${exportResult.exported} animated, ${exportResult.skipped} skipped`);

        // 3. Publish to packages
        const publishResult = publishIcons();
        console.log(`  Publish: ${publishResult.svgCount} SVGs, ${publishResult.lottieCount} Lotties`);

        // 4. Prepare icons for docs (if requested)
        if (withDocs) {
            const docsScript = join(DOCS_DIR, 'scripts', 'prepare-icons.ts');
            if (existsSync(docsScript)) {
                const proc = Bun.spawn(['bun', docsScript], {
                    cwd: DOCS_DIR,
                    stdout: 'pipe',
                    stderr: 'pipe',
                });
                await proc.exited;
                console.log(`  Docs: icons prepared`);
            }
        }

        // 5. Touch preview manifest to trigger Vite reload
        const previewManifest = join(PREVIEW_DIR, 'public', 'icons', 'manifest.json');
        if (existsSync(previewManifest)) {
            const content = await Bun.file(previewManifest).text();
            writeFileSync(previewManifest, content, 'utf-8');
        }

        const elapsed = Math.round(performance.now() - start);
        console.log(`[${timestamp()}] Done in ${elapsed}ms`);
    } catch (error) {
        console.error(`[${timestamp()}] Pipeline error: ${(error as Error).message}`);
    }
}

// --- Debounced watcher ---

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingFiles: string[] = [];

function onFileChange(filename: string): void {
    if (!filename || !filename.endsWith('.json')) {
        return;
    }

    if (!pendingFiles.includes(filename)) {
        pendingFiles.push(filename);
    }

    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
        const files = [...pendingFiles];
        pendingFiles = [];
        debounceTimer = null;
        runPipeline(files);
    }, DEBOUNCE_MS);
}

// --- Start watchers ---

console.log(`Meteocons watcher started`);
console.log(`  Watching: animations/configs/, animations/partials/`);
if (frameFilter) {
    console.log(`  Frame filter: ${frameFilter}`);
}
if (withDocs) {
    console.log(`  Docs prepare-icons: enabled`);
}
console.log(`  Press Ctrl+C to stop\n`);

if (existsSync(CONFIGS_DIR)) {
    watch(CONFIGS_DIR, {recursive: true}, (_event, filename) => {
        if (filename) {
            onFileChange(`configs/${filename}`);
        }
    });
}

if (existsSync(PARTIALS_DIR)) {
    watch(PARTIALS_DIR, {recursive: true}, (_event, filename) => {
        if (filename) {
            onFileChange(`partials/${filename}`);
        }
    });
}

if (existsSync(CACHE_DIR)) {
    watch(CACHE_DIR, {recursive: true}, (_event, filename) => {
        if (filename) {
            onFileChange(`cache/${filename}`);
        }
    });
}
