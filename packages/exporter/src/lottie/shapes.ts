import { parseSvgColor } from './colors';
import { svgPathToLottieBeziers } from './path-converter';
import type { GradientDef } from './gradients';
import { buildGradientFill, gradientFallbackColor } from './gradients';
import { COMP_FRAMES, FPS, kf, kfEnd, LINEAR, parseDuration } from './animation-helpers';
import type { LottieGroup } from './types';
import type { AnimationDef } from '../config-loader';

export function buildShapeGroup(element: any, gradients: Record<string, GradientDef>): LottieGroup | null {
    const tag = element.tagName?.toLowerCase();
    const fill = element.getAttribute('fill');
    const stroke = element.getAttribute('stroke');
    const strokeWidth = parseFloat(element.getAttribute('stroke-width') ?? '1');
    const strokeLinecap = element.getAttribute('stroke-linecap');

    const items: LottieGroup['it'] = [];

    if (tag === 'circle') {
        items.push({
            ty: 'el', nm: 'ellipse',
            p: {a: 0, k: [parseFloat(element.getAttribute('cx') ?? '0'), parseFloat(element.getAttribute('cy') ?? '0')]},
            s: {a: 0, k: [parseFloat(element.getAttribute('r') ?? '0') * 2, parseFloat(element.getAttribute('r') ?? '0') * 2]}
        });
    } else if (tag === 'ellipse') {
        items.push({
            ty: 'el', nm: 'ellipse',
            p: {a: 0, k: [parseFloat(element.getAttribute('cx') ?? '0'), parseFloat(element.getAttribute('cy') ?? '0')]},
            s: {a: 0, k: [parseFloat(element.getAttribute('rx') ?? '0') * 2, parseFloat(element.getAttribute('ry') ?? '0') * 2]}
        });
    } else if (tag === 'rect') {
        const x = parseFloat(element.getAttribute('x') ?? '0');
        const y = parseFloat(element.getAttribute('y') ?? '0');
        const w = parseFloat(element.getAttribute('width') ?? '0');
        const h = parseFloat(element.getAttribute('height') ?? '0');
        items.push({ty: 'rc', nm: 'rect', p: {a: 0, k: [x + w / 2, y + h / 2]}, s: {a: 0, k: [w, h]}, r: {a: 0, k: parseFloat(element.getAttribute('rx') ?? '0')}});
    } else if (tag === 'line') {
        const x1 = parseFloat(element.getAttribute('x1') ?? '0');
        const y1 = parseFloat(element.getAttribute('y1') ?? '0');
        const x2 = parseFloat(element.getAttribute('x2') ?? '0');
        const y2 = parseFloat(element.getAttribute('y2') ?? '0');
        items.push({ty: 'sh', nm: 'line', ks: {a: 0, k: {v: [[x1, y1], [x2, y2]], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], c: false}}});
    } else if (tag === 'path') {
        const beziers = svgPathToLottieBeziers(element.getAttribute('d') ?? '');
        beziers.forEach((b, idx) => items.push({ty: 'sh', nm: `path-${idx}`, ks: {a: 0, k: b}}));
    } else if (tag === 'g') {
        // Reverse children: Lottie renders shape group items from last to first,
        // but SVG paints from first to last (first child = background).
        const children = Array.from(element.childNodes as any[]).filter((n: any) => n.nodeType === 1).reverse();
        for (const child of children as any[]) {
            const childGroup = buildShapeGroup(child, gradients);
            if (childGroup) {
                items.push(childGroup);
            }
        }
    } else {
        return null;
    }

    if (fill && fill !== 'none') {
        const fillRule = element.getAttribute('fill-rule') ?? element.getAttribute('clip-rule') ?? 'nonzero';
        const r: 1 | 2 = fillRule === 'evenodd' ? 2 : 1;
        const fillOpacity = parseFloat(element.getAttribute('fill-opacity') ?? '1');

        if (fill.startsWith('url(#')) {
            const gradId = fill.slice(5, -1);
            const grad = gradients[gradId];
            if (grad) {
                items.push(buildGradientFill(grad, r, fillOpacity));
            } else {
                items.push({ty: 'fl', nm: 'fill', o: {a: 0, k: fillOpacity * 100}, c: {a: 0, k: [0.5, 0.5, 0.5, 1] as [number, number, number, number]}, r});
            }
        } else {
            items.push({ty: 'fl', nm: 'fill', o: {a: 0, k: fillOpacity * 100}, c: {a: 0, k: parseSvgColor(fill, {})}, r});
        }
    }
    if (stroke && stroke !== 'none') {
        const strokeOpacity = parseFloat(element.getAttribute('stroke-opacity') ?? '1');
        let strokeColor: [number, number, number, number];
        if (stroke.startsWith('url(#')) {
            const gradId = stroke.slice(5, -1);
            const grad = gradients[gradId];
            strokeColor = grad ? gradientFallbackColor(grad) : [0, 0, 0, 1];
        } else {
            strokeColor = parseSvgColor(stroke, {});
        }
        items.push({ty: 'st', nm: 'stroke', o: {a: 0, k: strokeOpacity * 100}, c: {a: 0, k: strokeColor}, w: {a: 0, k: strokeWidth}, lc: strokeLinecap === 'round' ? 2 : 1, lj: 2});
    }

    if (items.length === 0) {
        return null;
    }

    items.push({
        ty: 'tr',
        p: {a: 0, k: [0, 0]},
        a: {a: 0, k: [0, 0]},
        s: {a: 0, k: [100, 100]},
        r: {a: 0, k: 0},
        o: {a: 0, k: 100}
    } as any);

    const svgTransform = element.getAttribute?.('transform') ?? '';
    const rotateMatch = svgTransform.match(/rotate\(([^,)\s]+)[,\s]+([^,)\s]+)[,\s]+([^)]+)\)/);
    if (rotateMatch) {
        const angle = parseFloat(rotateMatch[1]);
        const rcx = parseFloat(rotateMatch[2]);
        const rcy = parseFloat(rotateMatch[3]);

        const outerItems: any[] = [{ty: 'gr', nm: tag, it: items}];
        outerItems.push({
            ty: 'tr',
            p: {a: 0, k: [rcx, rcy]},
            a: {a: 0, k: [rcx, rcy]},
            s: {a: 0, k: [100, 100]},
            r: {a: 0, k: angle},
            o: {a: 0, k: 100}
        });
        return {ty: 'gr', nm: `${tag}-rotated`, it: outerItems};
    }

    return {ty: 'gr', nm: tag, it: items};
}

/**
 * Offsets all coordinates in a shape group by (dx, dy).
 * Used to convert absolute SVG coordinates to layer-local coordinates
 * centered on (0,0) — required for Lottie masks to work correctly.
 */
export function offsetShapeGroup(group: LottieGroup, dx: number, dy: number): void {
    for (const item of group.it) {
        const ty = (item as any).ty;

        if (ty === 'el') {
            const el = item as any;
            if (el.p?.k) {
                el.p.k = [el.p.k[0] + dx, el.p.k[1] + dy];
            }
        } else if (ty === 'rc') {
            const rc = item as any;
            if (rc.p?.k) {
                rc.p.k = [rc.p.k[0] + dx, rc.p.k[1] + dy];
            }
        } else if (ty === 'sh') {
            const sh = item as any;
            if (sh.ks?.k?.v) {
                sh.ks.k.v = sh.ks.k.v.map(([vx, vy]: [number, number]) => [vx + dx, vy + dy]);
            }
        } else if (ty === 'gr') {
            offsetShapeGroup(item as LottieGroup, dx, dy);
        }
        if (ty === 'gf') {
            const gf = item as any;
            if (gf.s?.k) {
                gf.s.k = [gf.s.k[0] + dx, gf.s.k[1] + dy];
            }
            if (gf.e?.k) {
                gf.e.k = [gf.e.k[0] + dx, gf.e.k[1] + dy];
            }
        }
        if (ty === 'tr') {
            const tr = item as any;
            const hasPos = tr.p?.k && (tr.p.k[0] !== 0 || tr.p.k[1] !== 0);
            const hasAnchor = tr.a?.k && (tr.a.k[0] !== 0 || tr.a.k[1] !== 0);
            if (hasPos && tr.p.a !== 1) {
                tr.p.k = [tr.p.k[0] + dx, tr.p.k[1] + dy];
            }
            if (hasAnchor && tr.a.a !== 1) {
                tr.a.k = [tr.a.k[0] + dx, tr.a.k[1] + dy];
            }
        }
    }
}

/**
 * Adds animated stroke dashes to the stroke shape item in the group.
 * Matches SVG stroke-dasharray + animated stroke-dashoffset.
 */
export function addStrokeDashes(shapeGroup: LottieGroup, anim: AnimationDef): void {
    if (anim.property !== 'stroke-dashoffset') {
        return;
    }

    const dashSize = anim.dashArray ?? 50;
    const from = anim.from ?? 0;
    const to = anim.to ?? 0;
    const delta = to - from;

    const cycle = parseDuration(anim.duration);
    const delay = Math.round((anim.delay ?? 0) * FPS);
    const phase = delay > 0 ? delay % cycle : 0;
    const phaseOffset = cycle > 0 ? (phase / cycle) * delta : 0;
    const startValue = from + phaseOffset;

    const oKfs: any[] = [];
    let t = 0;
    let rep = 0;
    while (t < COMP_FRAMES) {
        oKfs.push(kf(t, [startValue + delta * rep], LINEAR));
        t += cycle;
        rep++;
    }
    oKfs.push(kfEnd(COMP_FRAMES, [startValue + delta * rep]));

    const strokeItem = shapeGroup.it.find((i: any) => i.ty === 'st') as any;
    if (strokeItem) {
        strokeItem.d = [
            {n: 'd', nm: 'dash', v: {a: 0, k: dashSize}},
            {n: 'g', nm: 'gap', v: {a: 0, k: dashSize}},
            {n: 'o', nm: 'offset', v: {a: 1, k: oKfs}}
        ];
    }
}

/**
 * Collects all direct children of the frame wrapper that should become
 * Lottie layers. Skips <defs>, <clipPath>, <mask>, and non-element nodes.
 */
export function collectTopLevelElements(svgRoot: any): any[] {
    const elements: any[] = [];
    const skipTags = new Set(['defs', 'clippath', 'mask', 'lineargradient', 'radialgradient', 'style']);

    const svgChildren = Array.from(svgRoot.childNodes as any[]).filter(
        (n: any) => n.nodeType === 1 && n.tagName?.toLowerCase() === 'g'
    );

    const frameWrapper = svgChildren[0];
    if (!frameWrapper) {
        return elements;
    }

    for (const child of Array.from(frameWrapper.childNodes as any[])) {
        if (child.nodeType !== 1) {
            continue;
        }
        const tag = child.tagName?.toLowerCase();
        if (skipTags.has(tag)) {
            continue;
        }
        elements.push(child);
    }

    return elements;
}

/**
 * Recursively finds all element IDs in a subtree, used to check if any
 * child of an element has an animation config.
 */
export function collectIds(element: any): string[] {
    const ids: string[] = [];
    const id = element.getAttribute?.('id');
    if (id) {
        ids.push(id);
    }
    for (const child of Array.from(element.childNodes as any[])) {
        if (child.nodeType === 1) {
            ids.push(...collectIds(child));
        }
    }
    return ids;
}

/** Recursively finds the first <path> element inside a subtree. */
export function findFirstPathElement(element: any): any | null {
    if (element.tagName?.toLowerCase() === 'path') {
        return element;
    }
    for (const child of Array.from(element.childNodes as any[])) {
        if (child.nodeType !== 1) {
            continue;
        }
        const found = findFirstPathElement(child);
        if (found) {
            return found;
        }
    }
    return null;
}
