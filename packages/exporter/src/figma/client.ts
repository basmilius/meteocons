import type { FigmaFileResponse, FigmaImagesResponse } from './types';

const BASE = 'https://api.figma.com/v1';

/** Milliseconds to wait between batch export requests. */
const BATCH_DELAY_MS = 500;

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

    // ----- Public -----

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

            // Download all SVGs in parallel.
            await Promise.all(
                Object.entries(res.images).map(async ([nodeId, url]) => {
                    if (!url) {
                        console.warn(`  ⚠  No URL returned for node ${nodeId}`);
                        return;
                    }

                    const svgRes = await fetch(url);
                    if (!svgRes.ok) {
                        console.warn(`  ⚠  Failed to download SVG for ${nodeId}: ${svgRes.status}`);
                        return;
                    }

                    result[nodeId] = await svgRes.text();
                })
            );
        }

        return result;
    }
}
