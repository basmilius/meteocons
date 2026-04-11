import { FigmaClient } from './figma/client';
import {
    buildFrameMap,
    cacheExists,
    type CacheFrame,
    type CacheManifest,
    ensureCacheDirs,
    hashSvg,
    readManifest,
    removeSvg,
    writeManifest,
    writeSvg
} from './cache';
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

function shortTimestamp(iso: string): string {
    return iso.slice(0, 16).replace('T', ' ');
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

const client = new FigmaClient(token);

// ── Pad B: cache exists, check if file changed ────────────────────────
let oldManifest: CacheManifest | null = null;
let incremental = false;

if (!listOnly && cacheExists() && !force) {
    oldManifest = readManifest();
    const hasVersionInfo = 'figmaLastModified' in oldManifest && oldManifest.figmaLastModified;

    if (hasVersionInfo) {
        console.log(`Checking Figma file metadata…`);
        const metadata = await client.getFileMetadata(fileKey);

        if (metadata.lastModified === oldManifest.figmaLastModified) {
            console.log(`Figma file not modified since ${shortTimestamp(oldManifest.figmaLastModified)}. Skipping.`);
            process.exit(0);
        }

        console.log(`Figma file changed: ${shortTimestamp(oldManifest.figmaLastModified)} → ${shortTimestamp(metadata.lastModified)}\n`);
        incremental = true;
    } else {
        console.log('Cache has no version info. Full re-fetch…\n');
    }
}

// ── Full file fetch (Pad A + C + list) ─────────────────────────────────
console.log(`Fetching "${fileKey}"…`);
const file = await client.getFile(fileKey);
console.log(`File: ${file.name}\n`);

const allPages = (file.document.children ?? []).filter(
    (n: FigmaNode) => n.type === 'CANVAS'
);

if (listOnly) {
    console.log(`Pages (${allPages.length}):`);
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

const oldFrameMap = oldManifest ? buildFrameMap(oldManifest) : new Map<string, CacheFrame>();
const allFrames: CacheFrame[] = [];
const seenNodeIds = new Set<string>();

let totalUnchanged = 0;
let totalChanged = 0;
let totalNew = 0;

for (const page of pagesToFetch) {
    const subfolder = pageSubfolder(page.name)!;
    const frames = (page.children ?? []).filter((n: FigmaNode) => n.type === 'FRAME');

    if (frames.length === 0) {
        continue;
    }

    console.log(`[${page.name}]  →  ${subfolder}/  (${frames.length} frames)`);

    const svgs = await client.exportSvgs(fileKey, frames.map((f: FigmaNode) => f.id));

    let pageUnchanged = 0;
    let pageChanged = 0;
    let pageNew = 0;

    for (const frame of frames) {
        const svgContent = svgs[frame.id];
        if (!svgContent) {
            console.warn(`  ⚠  ${frame.name} — no SVG received`);
            continue;
        }

        seenNodeIds.add(frame.id);
        const hash = hashSvg(svgContent);
        const oldFrame = oldFrameMap.get(frame.id);

        if (incremental && oldFrame?.sha256 === hash) {
            // Unchanged — keep existing cache entry, detect renames
            if (oldFrame.frameName !== frame.name) {
                console.log(`  ≈  ${oldFrame.frameName} → ${frame.name}  (renamed, SVG unchanged)`);
            }
            allFrames.push({ nodeId: frame.id, frameName: frame.name, pageName: page.name, subfolder, sha256: hash });
            pageUnchanged++;
        } else if (incremental && oldFrame) {
            // Changed
            writeSvg(frame.id, svgContent);
            allFrames.push({ nodeId: frame.id, frameName: frame.name, pageName: page.name, subfolder, sha256: hash });
            console.log(`  ~  ${frame.name}  (changed)`);
            pageChanged++;
        } else {
            // New (or full fetch)
            writeSvg(frame.id, svgContent);
            allFrames.push({ nodeId: frame.id, frameName: frame.name, pageName: page.name, subfolder, sha256: hash });
            if (incremental) {
                console.log(`  +  ${frame.name}  (new)`);
            }
            pageNew++;
        }
    }

    if (incremental) {
        const parts: string[] = [];
        if (pageUnchanged > 0) { parts.push(`${pageUnchanged} unchanged`); }
        if (pageChanged > 0) { parts.push(`${pageChanged} changed`); }
        if (pageNew > 0) { parts.push(`${pageNew} new`); }
        console.log(`  ${parts.join(', ')}\n`);
    } else {
        console.log(`  ${pageNew}/${frames.length} downloaded\n`);
    }

    totalUnchanged += pageUnchanged;
    totalChanged += pageChanged;
    totalNew += pageNew;
}

// ── Detect removed frames ──────────────────────────────────────────────
let totalRemoved = 0;

if (incremental) {
    const removedFrames = [...oldFrameMap.entries()].filter(([nodeId]) => !seenNodeIds.has(nodeId));

    if (removedFrames.length > 0) {
        console.log('Removed:');
        for (const [nodeId, frame] of removedFrames) {
            removeSvg(nodeId);
            console.log(`  -  ${frame.frameName}  (${frame.subfolder})`);
        }
        console.log('');
        totalRemoved = removedFrames.length;
    }
}

// ── Write manifest ─────────────────────────────────────────────────────
writeManifest({
    fetchedAt: new Date().toISOString(),
    fileKey,
    figmaVersion: file.version,
    figmaLastModified: file.lastModified,
    frames: allFrames
});

// ── Summary ────────────────────────────────────────────────────────────
if (incremental) {
    const written = totalChanged + totalNew;
    console.log(`Summary: ${totalUnchanged} unchanged, ${totalChanged} changed, ${totalNew} new, ${totalRemoved} removed`);
    console.log(`SVGs written: ${written}`);
} else {
    console.log(`Done — ${totalNew} SVGs saved to .cache/`);
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
