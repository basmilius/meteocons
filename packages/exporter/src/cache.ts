import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface CacheFrame {
    /** Figma node ID (colons replaced with underscores in the filename). */
    nodeId: string;
    frameName: string;
    pageName: string;
    /** Output subfolder, e.g. "fill", "flat". */
    subfolder: string;
    /** SHA-256 hex hash of the SVG content. */
    sha256: string;
}

export interface CacheManifest {
    fetchedAt: string;
    fileKey: string;
    /** Figma file version string from the API. */
    figmaVersion: string;
    /** ISO 8601 lastModified timestamp from the Figma API. */
    figmaLastModified: string;
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

/** SHA-256 hex hash of an SVG string. */
export function hashSvg(content: string): string {
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(content);
    return hasher.digest('hex');
}

/** Remove a cached SVG file. */
export function removeSvg(nodeId: string): void {
    const path = svgPath(nodeId);
    if (existsSync(path)) {
        unlinkSync(path);
    }
}

/** Build a Map<nodeId, CacheFrame> for quick lookups. */
export function buildFrameMap(manifest: CacheManifest): Map<string, CacheFrame> {
    const map = new Map<string, CacheFrame>();
    for (const frame of manifest.frames) {
        map.set(frame.nodeId, frame);
    }
    return map;
}
