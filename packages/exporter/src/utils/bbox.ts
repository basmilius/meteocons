import { svgPathToLottieBeziers } from '../lottie/path-converter';

export interface BBox {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

/**
 * Computes the axis-aligned bounding box of an SVG element.
 * Handles <circle>, <ellipse>, <rect>, <line>, <path>, and <g> (recursively).
 * Returns null if the element has no computable geometry.
 */
export function computeBBox(element: any): BBox | null {
    const tag = element.tagName?.toLowerCase();

    if (tag === 'circle') {
        const cx = parseFloat(element.getAttribute('cx') ?? '0');
        const cy = parseFloat(element.getAttribute('cy') ?? '0');
        const r = parseFloat(element.getAttribute('r') ?? '0');
        return {minX: cx - r, maxX: cx + r, minY: cy - r, maxY: cy + r};
    }

    if (tag === 'ellipse') {
        const cx = parseFloat(element.getAttribute('cx') ?? '0');
        const cy = parseFloat(element.getAttribute('cy') ?? '0');
        const rx = parseFloat(element.getAttribute('rx') ?? '0');
        const ry = parseFloat(element.getAttribute('ry') ?? '0');
        return {minX: cx - rx, maxX: cx + rx, minY: cy - ry, maxY: cy + ry};
    }

    if (tag === 'rect') {
        const x = parseFloat(element.getAttribute('x') ?? '0');
        const y = parseFloat(element.getAttribute('y') ?? '0');
        const width = parseFloat(element.getAttribute('width') ?? '0');
        const height = parseFloat(element.getAttribute('height') ?? '0');
        return {minX: x, maxX: x + width, minY: y, maxY: y + height};
    }

    if (tag === 'line') {
        const x1 = parseFloat(element.getAttribute('x1') ?? '0');
        const y1 = parseFloat(element.getAttribute('y1') ?? '0');
        const x2 = parseFloat(element.getAttribute('x2') ?? '0');
        const y2 = parseFloat(element.getAttribute('y2') ?? '0');
        return {
            minX: Math.min(x1, x2),
            maxX: Math.max(x1, x2),
            minY: Math.min(y1, y2),
            maxY: Math.max(y1, y2)
        };
    }

    if (tag === 'path') {
        const beziers = svgPathToLottieBeziers(element.getAttribute('d') ?? '');
        if (beziers.length === 0) {
            return null;
        }
        const xs = beziers.flatMap(b => b.v.map(v => v[0]));
        const ys = beziers.flatMap(b => b.v.map(v => v[1]));
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys)
        };
    }

    if (tag === 'g') {
        const childBoxes = Array.from(element.childNodes as any[])
            .filter((n: any) => n.nodeType === 1)
            .map((n: any) => computeBBox(n))
            .filter(Boolean) as BBox[];

        if (childBoxes.length === 0) {
            return null;
        }

        return {
            minX: Math.min(...childBoxes.map(b => b.minX)),
            maxX: Math.max(...childBoxes.map(b => b.maxX)),
            minY: Math.min(...childBoxes.map(b => b.minY)),
            maxY: Math.max(...childBoxes.map(b => b.maxY))
        };
    }

    return null;
}

/** Returns the center point of an element's bounding box, or null. */
export function computeCenter(element: any): { cx: number; cy: number } | null {
    const bbox = computeBBox(element);
    if (!bbox) {
        return null;
    }
    return {
        cx: (bbox.minX + bbox.maxX) / 2,
        cy: (bbox.minY + bbox.maxY) / 2
    };
}

/** Returns a named origin point (center/bottom/top) of an element's bounding box. */
export function computeOriginPoint(element: any, origin: string): { cx: number; cy: number } | null {
    const bbox = computeBBox(element);
    if (!bbox) {
        return null;
    }
    const cx = (bbox.minX + bbox.maxX) / 2;
    switch (origin) {
        case 'bottom':
            return {cx, cy: bbox.maxY};
        case 'top':
            return {cx, cy: bbox.minY};
        default:
            return {cx, cy: (bbox.minY + bbox.maxY) / 2};
    }
}

/** Finds the first element with the given id in the document tree. */
export function findById(doc: any, id: string): any | null {
    function search(node: any): any | null {
        if (node.nodeType === 1 && node.getAttribute?.('id') === id) {
            return node;
        }
        for (const child of Array.from(node.childNodes as any[])) {
            const found = search(child);
            if (found) {
                return found;
            }
        }
        return null;
    }

    return search(doc.documentElement);
}
