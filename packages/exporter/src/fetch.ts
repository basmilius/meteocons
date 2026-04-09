import { FigmaClient } from './figma/client';
import { cacheExists, type CacheFrame, ensureCacheDirs, writeManifest, writeSvg } from './cache';
import type { FigmaNode } from './figma/types';

const PAGE_PREFIXES: Record<string, string> = {
    'Fill': 'fill',
    'Flat': 'flat',
    'Line': 'line',
    'Monochrome': 'monochrome'
};

function pageSubfolder(pageName: string): string | null {
    for (const [prefix, subfolder] of Object.entries(PAGE_PREFIXES)) {
        if (pageName.startsWith(prefix)) {
            return subfolder;
        }
    }
    return null;
}

const args = parseArgs(process.argv.slice(2));
const listOnly = 'list' in args;
const pageFilter = args['page'];
const force = 'force' in args;

const token = process.env.FIGMA_TOKEN;
const fileKey = process.env.FIGMA_FILE_KEY;

if (!token || !fileKey) {
    console.error('Error: FIGMA_TOKEN and FIGMA_FILE_KEY must be set in .env');
    process.exit(1);
}

if (!listOnly && cacheExists() && !force) {
    console.log('Cache bestaat al. Gebruik --force om opnieuw te downloaden.');
    process.exit(0);
}

const client = new FigmaClient(token);

console.log(`Fetching "${fileKey}"…`);
const file = await client.getFile(fileKey);
console.log(`File: ${file.name}\n`);

const allPages = (file.document.children ?? []).filter(
    (n: FigmaNode) => n.type === 'CANVAS'
);

if (listOnly) {
    console.log(`Pagina's (${allPages.length}):`);
    for (const page of allPages) {
        const subfolder = pageSubfolder(page.name);
        const frames = (page.children ?? []).filter((n: FigmaNode) => n.type === 'FRAME');
        const marker = subfolder ? '✓' : ' ';
        const dest = subfolder ? `  →  ${subfolder}/` : '';
        console.log(`  ${marker}  ${page.name.padEnd(24)}${dest.padEnd(18)}(${frames.length} frames)`);
    }
    process.exit(0);
}
let pagesToFetch = allPages.filter((n: FigmaNode) => pageSubfolder(n.name) !== null);

if (pageFilter) {
    pagesToFetch = pagesToFetch.filter((n: FigmaNode) => n.name === pageFilter);
    if (pagesToFetch.length === 0) {
        console.error(`Error: Page "${pageFilter}" is not whitelisted or does not exist.`);
        process.exit(1);
    }
}

ensureCacheDirs();

const allFrames: CacheFrame[] = [];
let totalDownloaded = 0;

for (const page of pagesToFetch) {
    const subfolder = pageSubfolder(page.name)!;
    const frames = (page.children ?? []).filter((n: FigmaNode) => n.type === 'FRAME');

    if (frames.length === 0) {
        continue;
    }

    console.log(`[${page.name}]  →  ${subfolder}/  (${frames.length} frames)`);

    const svgs = await client.exportSvgs(fileKey, frames.map((f: FigmaNode) => f.id));

    let downloaded = 0;
    for (const frame of frames) {
        const svgContent = svgs[frame.id];
        if (!svgContent) {
            console.warn(`  ⚠  ${frame.name} — geen SVG ontvangen`);
            continue;
        }

        writeSvg(frame.id, svgContent);
        allFrames.push({
            nodeId: frame.id,
            frameName: frame.name,
            pageName: page.name,
            subfolder
        });
        downloaded++;
    }

    console.log(`  ${downloaded}/${frames.length} gedownload\n`);
    totalDownloaded += downloaded;
}

writeManifest({
    fetchedAt: new Date().toISOString(),
    fileKey,
    frames: allFrames
});

console.log(`Klaar — ${totalDownloaded} SVGs opgeslagen in .cache/`);

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
