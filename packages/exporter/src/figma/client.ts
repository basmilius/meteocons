import type { FigmaFileResponse, FigmaImagesResponse } from './types';

const BASE = 'https://api.figma.com/v1';

/** Milliseconds to wait between batch export requests. */
const BATCH_DELAY_MS = 500;

/** Maximum number of concurrent S3 downloads per batch. */
const CONCURRENCY = 10;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Minimal Figma REST API client. */
export class FigmaClient {
    constructor(private readonly token: string) {
    }

    // ----- Private -----

    /**
     * Makes an authenticated request with exponential backoff on 429 rate-limit responses.
     * Retries up to 4 times with delays of 2s, 4s, 8s, 16s.
     */
    private async request<T>(path: string): Promise<T> {
        const MAX_RETRIES = 4;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            const res = await fetch(`${BASE}${path}`, {
                headers: {'X-Figma-Token': this.token}
            });

            if (res.status === 429) {
                if (attempt === MAX_RETRIES) {
                    throw new Error('Figma API rate limit exceeded after multiple retries.');
                }
                const delay = 2000 * 2 ** attempt;
                console.warn(`  ⏳ Rate limited — retrying in ${delay / 1000}s…`);
                await sleep(delay);
                continue;
            }

            if (!res.ok) {
                throw new Error(`Figma API ${res.status}: ${await res.text()}`);
            }

            return res.json() as T;
        }

        throw new Error('Unreachable');
    }

    /**
     * Downloads a single SVG from a signed S3 URL with exponential backoff
     * on transient network errors (ECONNRESET, timeouts, 5xx).
     */
    private async downloadWithRetry(url: string, nodeId: string): Promise<string> {
        const MAX_RETRIES = 3;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const res = await fetch(url);

                if (res.status >= 500 && attempt < MAX_RETRIES) {
                    const delay = 1000 * 2 ** attempt;
                    console.warn(`  ⏳ S3 ${res.status} for ${nodeId} — retrying in ${delay / 1000}s…`);
                    await sleep(delay);
                    continue;
                }

                if (!res.ok) {
                    console.warn(`  ⚠  Failed to download SVG for ${nodeId}: ${res.status}`);
                    return '';
                }

                return await res.text();
            } catch (error: unknown) {
                if (attempt === MAX_RETRIES) {
                    const message = error instanceof Error ? error.message : String(error);
                    console.warn(`  ⚠  Download failed for ${nodeId} after ${MAX_RETRIES} retries: ${message}`);
                    return '';
                }

                const delay = 1000 * 2 ** attempt;
                console.warn(`  ⏳ Network error for ${nodeId} — retrying in ${delay / 1000}s…`);
                await sleep(delay);
            }
        }

        return '';
    }

    // ----- Public -----

    /**
     * Returns file metadata with a minimal document tree (depth=1).
     * Cheap call to check lastModified / version without fetching all frames.
     */
    async getFileMetadata(fileKey: string): Promise<Pick<FigmaFileResponse, 'name' | 'lastModified' | 'version'>> {
        return this.request<Pick<FigmaFileResponse, 'name' | 'lastModified' | 'version'>>(
            `/files/${fileKey}?depth=1`
        );
    }

    /**
     * Returns the document tree up to 3 levels deep — enough to list
     * pages and the frames on each page.
     */
    async getFile(fileKey: string): Promise<FigmaFileResponse> {
        return this.request<FigmaFileResponse>(`/files/${fileKey}?depth=3`);
    }

    /**
     * Requests SVG exports for the given node IDs and downloads the results.
     * Figma returns signed S3 URLs; this method fetches them immediately before
     * they expire and returns a map of nodeId → SVG string.
     *
     * Batches requests in groups of 100 with a short delay between batches
     * to stay within Figma's rate limits.
     */
    async exportSvgs(
        fileKey: string,
        nodeIds: string[]
    ): Promise<Record<string, string>> {
        const BATCH = 100;
        const result: Record<string, string> = {};

        for (let i = 0; i < nodeIds.length; i += BATCH) {
            if (i > 0) {
                await sleep(BATCH_DELAY_MS);
            }

            const batch = nodeIds.slice(i, i + BATCH);
            const ids = encodeURIComponent(batch.join(','));

            const res = await this.request<FigmaImagesResponse>(
                `/images/${fileKey}?ids=${ids}&format=svg&svg_include_id=true&svg_simplify_stroke=true`
            );

            if (res.err) {
                throw new Error(`Figma export error: ${res.err}`);
            }

            // Download SVGs with bounded concurrency and retry.
            const entries = Object.entries(res.images);
            for (let j = 0; j < entries.length; j += CONCURRENCY) {
                await Promise.all(
                    entries.slice(j, j + CONCURRENCY).map(async ([nodeId, url]) => {
                        if (!url) {
                            console.warn(`  ⚠  No URL returned for node ${nodeId}`);
                            return;
                        }

                        result[nodeId] = await this.downloadWithRetry(url, nodeId);
                    })
                );
            }
        }

        return result;
    }
}
