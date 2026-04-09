import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface CacheFrame {
    /** Figma node ID (colons replaced with underscores in the filename). */
    nodeId: string;
    frameName: string;
    pageName: string;
    /** Output subfolder, e.g. "fill", "flat". */
    subfolder: string;
}

export interface CacheManifest {
    fetchedAt: string;
    fileKey: string;
    frames: CacheFrame[];
}

const CACHE_DIR = join(import.meta.dir, '..', '.cache');
const SVG_DIR = join(CACHE_DIR, 'svgs');
const MANIFEST_PATH = join(CACHE_DIR, 'manifest.json');

/** Converts a Figma node ID to a safe filename (replaces colons). */
export function nodeIdToFilename(nodeId: string): string {
    return nodeId.replace(/:/g, '_') + '.svg';
}

export function svgPath(nodeId: string): string {
    return join(SVG_DIR, nodeIdToFilename(nodeId));
}

export function ensureCacheDirs(): void {
    mkdirSync(SVG_DIR, {recursive: true});
}

export function writeManifest(manifest: CacheManifest): void {
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
}

export function writeSvg(nodeId: string, content: string): void {
    writeFileSync(svgPath(nodeId), content, 'utf-8');
}

export function readManifest(): CacheManifest {
    if (!existsSync(MANIFEST_PATH)) {
        throw new Error(
            'Cache is leeg. Voer eerst "bun run fetch" uit om de SVGs te downloaden.'
        );
    }
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as CacheManifest;
}

export function readSvg(nodeId: string): string | null {
    const path = svgPath(nodeId);
    if (!existsSync(path)) {
        return null;
    }
    return readFileSync(path, 'utf-8');
}

export function cacheExists(): boolean {
    return existsSync(MANIFEST_PATH);
}
