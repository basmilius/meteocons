/** Minimal Figma REST API response types — only what we use. */

export interface FigmaNode {
    id: string;
    name: string;
    type: string;
    children?: FigmaNode[];
}

export interface FigmaFileResponse {
    name: string;
    lastModified: string;
    version: string;
    document: FigmaNode;
}

export interface FigmaImagesResponse {
    err: string | null;
    /** Maps node ID → signed S3 URL (expires after ~30 minutes). */
    images: Record<string, string | null>;
}
