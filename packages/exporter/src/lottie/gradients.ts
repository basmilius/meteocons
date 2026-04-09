import { parseSvgColor } from './colors';

export interface GradientDef {
    type: 'linear' | 'radial';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    stops: { offset: number; color: [number, number, number, number] }[];
}

export function extractGradients(doc: any): Record<string, GradientDef> {
    const gradients: Record<string, GradientDef> = {};

    for (const el of Array.from(doc.getElementsByTagName('linearGradient') as any[])) {
        const id = (el as any).getAttribute('id');
        if (!id) {
            continue;
        }
        const stops = parseStops(el as any);
        if (stops.length === 0) {
            continue;
        }
        gradients[id] = {
            type: 'linear',
            x1: parseFloat((el as any).getAttribute('x1') ?? '0'),
            y1: parseFloat((el as any).getAttribute('y1') ?? '0'),
            x2: parseFloat((el as any).getAttribute('x2') ?? '0'),
            y2: parseFloat((el as any).getAttribute('y2') ?? '0'),
            stops
        };
    }

    for (const el of Array.from(doc.getElementsByTagName('radialGradient') as any[])) {
        const id = (el as any).getAttribute('id');
        if (!id) {
            continue;
        }
        const stops = parseStops(el as any);
        if (stops.length === 0) {
            continue;
        }
        const cx = parseFloat((el as any).getAttribute('cx') ?? '0');
        const cy = parseFloat((el as any).getAttribute('cy') ?? '0');
        const r = parseFloat((el as any).getAttribute('r') ?? '0');
        gradients[id] = {
            type: 'radial',
            x1: cx, y1: cy,
            x2: cx + r, y2: cy,
            stops
        };
    }

    return gradients;
}

function parseStops(gradientEl: any): GradientDef['stops'] {
    const stops: GradientDef['stops'] = [];
    for (const stop of Array.from(gradientEl.getElementsByTagName('stop') as any[])) {
        const offset = parseFloat((stop as any).getAttribute('offset') ?? '0');
        const color = (stop as any).getAttribute('stop-color') ?? '#000000';
        const stopOpacity = parseFloat((stop as any).getAttribute('stop-opacity') ?? '1');
        stops.push({offset, color: parseSvgColor(color, {}, stopOpacity)});
    }
    return stops;
}

/** Build a Lottie gradient fill from a GradientDef. */
export function buildGradientFill(grad: GradientDef, fillRule: 1 | 2 = 1, opacity: number = 1): any {
    const colorData: number[] = [];
    for (const stop of grad.stops) {
        colorData.push(stop.offset, stop.color[0], stop.color[1], stop.color[2]);
    }
    for (const stop of grad.stops) {
        colorData.push(stop.offset, stop.color[3]);
    }

    return {
        ty: 'gf',
        nm: 'gradient',
        o: {a: 0, k: opacity * 100},
        r: fillRule,
        t: grad.type === 'linear' ? 1 : 2,
        s: {a: 0, k: [grad.x1, grad.y1]},
        e: {a: 0, k: [grad.x2, grad.y2]},
        g: {p: grad.stops.length, k: {a: 0, k: colorData}}
    };
}

/** Get fallback solid color from gradient (first stop). */
export function gradientFallbackColor(grad: GradientDef): [number, number, number, number] {
    return grad.stops[0]?.color ?? [0, 0, 0, 1];
}
