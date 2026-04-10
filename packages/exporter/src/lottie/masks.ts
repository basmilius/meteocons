import { svgPathToLottieBeziers } from './path-converter';
import { findById } from '../utils/bbox';
import { COMP_FRAMES, computePhase, FPS, getEasing, lerpPositions, lerpValues, parseDuration } from './animation-helpers';
import { findFirstPathElement } from './shapes';
import type { LottieBezier, LottieMask, LottieMaskKeyframe } from './types';
import type { AnimationDef, LayerConfig, ResolvedConfig } from '../config-loader';

/**
 * Searches descendants for a mask="url(#...)" attribute (e.g. Figma "Mask group" pattern)
 * and converts the referenced <mask> to Lottie mask shapes.
 */
function findNestedMasks(doc: any, element: any): LottieMask[] | undefined {
    function findMaskId(node: any): string | null {
        if (node.nodeType !== 1) {
            return null;
        }
        const attr: string = node.getAttribute?.('mask') ?? '';
        const match = attr.match(/url\(#([^)]+)\)/);
        if (match) {
            return match[1];
        }
        for (const child of Array.from(node.childNodes as any[])) {
            const found = findMaskId(child);
            if (found) {
                return found;
            }
        }
        return null;
    }

    const maskId = findMaskId(element);
    if (!maskId) {
        return undefined;
    }

    function findMaskElement(node: any): any | null {
        if (node.nodeType !== 1) {
            return null;
        }
        if (node.tagName?.toLowerCase() === 'mask' && node.getAttribute('id') === maskId) {
            return node;
        }
        for (const child of Array.from(node.childNodes as any[])) {
            const found = findMaskElement(child);
            if (found) {
                return found;
            }
        }
        return null;
    }

    const maskElement = findMaskElement(doc.documentElement);
    if (!maskElement) {
        return undefined;
    }

    const masks = convertMaskChildren(maskElement);
    return masks.length > 0 ? masks : undefined;
}

/**
 * Converts a simple SVG element (rect, circle, path) to a Lottie bezier shape
 * for use as a mask path.
 */
function elementToBezier(element: any): LottieBezier | null {
    const tag = element.tagName?.toLowerCase();

    if (tag === 'rect') {
        let x = parseFloat(element.getAttribute('x') ?? '0');
        let y = parseFloat(element.getAttribute('y') ?? '0');
        const w = parseFloat(element.getAttribute('width') ?? '0');
        const h = parseFloat(element.getAttribute('height') ?? '0');

        const transform = element.getAttribute('transform') ?? '';
        const translateMatch = transform.match(/translate\(([^,)\s]+)[,\s]+([^)]+)\)/);
        if (translateMatch) {
            x += parseFloat(translateMatch[1]);
            y += parseFloat(translateMatch[2]);
        }

        return {
            v: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
            i: [[0, 0], [0, 0], [0, 0], [0, 0]],
            o: [[0, 0], [0, 0], [0, 0], [0, 0]],
            c: true
        };
    }

    if (tag === 'circle') {
        const cx = parseFloat(element.getAttribute('cx') ?? '0');
        const cy = parseFloat(element.getAttribute('cy') ?? '0');
        const r = parseFloat(element.getAttribute('r') ?? '0');
        const k = r * 0.5522847498;
        return {
            v: [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]],
            i: [[-k, 0], [0, -k], [k, 0], [0, k]],
            o: [[k, 0], [0, k], [-k, 0], [0, -k]],
            c: true
        };
    }

    if (tag === 'path') {
        const fillRule = element.getAttribute('fill-rule') ?? element.getAttribute('clip-rule') ?? '';
        if (fillRule === 'evenodd') {
            return null;
        }

        const beziers = svgPathToLottieBeziers(element.getAttribute('d') ?? '');
        return beziers[0] ?? null;
    }

    if (tag === 'g') {
        for (const child of Array.from(element.childNodes as any[])) {
            if (child.nodeType !== 1) {
                continue;
            }
            const result = elementToBezier(child);
            if (result) {
                return result;
            }
        }
    }

    return null;
}

/**
 * Like elementToBezier but supports evenodd paths (compound masks).
 * Returns multiple beziers for evenodd paths (outer rect + inner cutout).
 */
function elementToMaskBeziers(element: any): { beziers: LottieBezier[]; isEvenOdd: boolean } | null {
    const tag = element.tagName?.toLowerCase();

    if (tag === 'path') {
        const fillRule = element.getAttribute('fill-rule') ?? element.getAttribute('clip-rule') ?? '';
        const d = element.getAttribute('d') ?? '';
        const beziers = svgPathToLottieBeziers(d);
        if (fillRule === 'evenodd' && beziers.length >= 2) {
            return {beziers, isEvenOdd: true};
        }
        if (beziers.length > 0) {
            return {beziers: [beziers[0]], isEvenOdd: false};
        }
        return null;
    }

    if (tag === 'g') {
        for (const child of Array.from(element.childNodes as any[])) {
            if (child.nodeType !== 1) {
                continue;
            }
            const result = elementToMaskBeziers(child);
            if (result) {
                return result;
            }
        }
        return null;
    }

    const single = elementToBezier(element);
    return single ? {beziers: [single], isEvenOdd: false} : null;
}

/**
 * Converts mask element children to LottieMask entries.
 * Handles evenodd paths by splitting into add (outer rect) + subtract (cutout) masks.
 */
/**
 * Computes the signed area of a bezier polygon (using vertices only).
 * Positive = CW in screen coordinates, negative = CCW.
 */
function signedArea(bezier: LottieBezier): number {
    let area = 0;
    const verts = bezier.v;
    for (let i = 0; i < verts.length; i++) {
        const j = (i + 1) % verts.length;
        area += verts[i][0] * verts[j][1];
        area -= verts[j][0] * verts[i][1];
    }
    return area / 2;
}

/**
 * Reverses the winding direction of a closed bezier by reversing vertex
 * order and swapping in/out tangents.
 */
function reverseBezier(bezier: LottieBezier): LottieBezier {
    const v = [...bezier.v].reverse() as [number, number][];
    const i = [...bezier.o].reverse() as [number, number][];
    const o = [...bezier.i].reverse() as [number, number][];
    return {v, i, o, c: bezier.c};
}

/**
 * Ensures the bezier has CCW winding (negative signed area in screen coords).
 * Lottie renderers expect CCW for inverted add masks to correctly define
 * the "inside" of the masked area.
 */
function ensureCCW(bezier: LottieBezier): LottieBezier {
    return signedArea(bezier) > 0 ? reverseBezier(bezier) : bezier;
}

function convertMaskChildren(maskElement: any): LottieMask[] {
    const masks: LottieMask[] = [];

    for (const child of Array.from(maskElement.childNodes as any[])) {
        if (child.nodeType !== 1) {
            continue;
        }
        const result = elementToMaskBeziers(child);
        if (!result) {
            continue;
        }

        if (result.isEvenOdd && result.beziers.length >= 2) {
            // Use subtract mask (mode 's') with the inner cutout shape.
            // This matches the approach in synthesizeMaskFromCloud and avoids
            // lottie-web rendering issues with inverted add masks (inv: true, mode: 'a').
            masks.push({
                inv: false,
                mode: 's',
                nm: 'Mask',
                pt: {a: 0, k: result.beziers[1]},
                o: {a: 0, k: 100},
                x: {a: 0, k: 0}
            } as any);
        } else if (!result.isEvenOdd) {
            masks.push({
                inv: false,
                mode: 'a',
                nm: 'Mask',
                pt: {a: 0, k: result.beziers[0]},
                o: {a: 0, k: 100},
                x: {a: 0, k: 0}
            } as any);
        }
    }

    return masks;
}

/**
 * If an element's parent is <g mask="url(#maskId)">, finds the <mask> definition
 * and converts its children to Lottie mask shapes.
 */
export function buildMasksForElement(doc: any, element: any, anchorX: number = 0, anchorY: number = 0): LottieMask[] | undefined {
    let current = element;
    let maskId: string | null = null;
    let isClipPath = false;

    while (current && current.nodeType === 1) {
        const maskAttr: string = current.getAttribute?.('mask') ?? '';
        if (maskAttr) {
            const match = maskAttr.match(/url\(#([^)]+)\)/);
            if (match) {
                maskId = match[1];
                break;
            }
        }
        const clipAttr: string = current.getAttribute?.('clip-path') ?? '';
        if (clipAttr) {
            const match = clipAttr.match(/url\(#([^)]+)\)/);
            if (match) {
                maskId = match[1];
                isClipPath = true;
                break;
            }
        }
        current = current.parentNode;
    }

    if (!maskId) {
        return findNestedMasks(doc, element);
    }

    const targetTag = isClipPath ? 'clippath' : 'mask';

    function findMask(node: any): any | null {
        if (node.nodeType !== 1) {
            return null;
        }
        if (node.tagName?.toLowerCase() === targetTag && node.getAttribute('id') === maskId) {
            return node;
        }
        for (const child of Array.from(node.childNodes as any[])) {
            const found = findMask(child);
            if (found) {
                return found;
            }
        }
        return null;
    }

    const maskElement = findMask(doc.documentElement);
    if (!maskElement) {
        return undefined;
    }

    if (isClipPath) {
        const children = Array.from(maskElement.childNodes as any[]).filter((n: any) => n.nodeType === 1);
        if (children.length === 1) {
            const child = children[0] as any;
            if (child.tagName?.toLowerCase() === 'rect') {
                const w = parseFloat(child.getAttribute('width') ?? '0');
                const h = parseFloat(child.getAttribute('height') ?? '0');
                const x = parseFloat(child.getAttribute('x') ?? '0');
                const y = parseFloat(child.getAttribute('y') ?? '0');
                const transform = child.getAttribute('transform') ?? '';

                if (w >= 128 && h >= 128 && x === 0 && y === 0) {
                    return findNestedMasks(doc, element);
                }

                if (transform.includes('rotate')) {
                    return findNestedMasks(doc, element);
                }
            }
        }
    }

    const masks = convertMaskChildren(maskElement);
    return masks.length > 0 ? masks : undefined;
}

/**
 * Synthesizes a mask from a Cloud path when no explicit SVG <mask> is present.
 * Fill-style SVGs from Figma omit the Cloud Mask component because the cloud
 * is opaque and visually covers the sun via z-order. In Lottie, we still need
 * an explicit mask so rotating sun rays are cleanly clipped.
 */
export function synthesizeMaskFromCloud(doc: any, element: any, config: ResolvedConfig): LottieMask[] | undefined {
    if (!config.layers['Clouds']) {
        return undefined;
    }

    let current = element;
    let sunGroup: any = null;
    while (current && current.nodeType === 1) {
        if (current.getAttribute?.('id') === 'Sun') {
            sunGroup = current;
            break;
        }
        current = current.parentNode;
    }
    if (!sunGroup) {
        return undefined;
    }

    const parent = sunGroup.parentNode;
    if (!parent) {
        return undefined;
    }

    let cloudPath: any = null;
    for (const sibling of Array.from(parent.childNodes as any[])) {
        if (sibling.nodeType !== 1) {
            continue;
        }
        const id = sibling.getAttribute?.('id') ?? '';
        if (id === 'Clouds' || id === 'Cloud') {
            cloudPath = findFirstPathElement(sibling);
            if (cloudPath) {
                break;
            }
        }
    }
    if (!cloudPath) {
        return undefined;
    }

    const d = cloudPath.getAttribute('d') ?? '';
    const beziers = svgPathToLottieBeziers(d);
    if (beziers.length === 0) {
        return undefined;
    }

    return [
        {inv: false, mode: 's', nm: 'Mask', pt: {a: 0, k: beziers[0]}, o: {a: 0, k: 100}, x: {a: 0, k: 0}} as any
    ];
}

/**
 * Creates an offset copy of a bezier by (dx, dy). Tangents are relative
 * to their vertex, so they stay the same.
 */
export function offsetBezier(bezier: LottieBezier, dx: number, dy: number): LottieBezier {
    return {
        v: bezier.v.map(([vx, vy]) => [vx + dx, vy + dy] as [number, number]),
        i: bezier.i.map(([ix, iy]) => [ix, iy] as [number, number]),
        o: bezier.o.map(([ox, oy]) => [ox, oy] as [number, number]),
        c: bezier.c
    };
}

/**
 * Animates a mask bezier path along a translation animation.
 * Returns animated `pt` property with keyframes, or null if no translation found.
 */
export function animateMaskBezier(
    baseBezier: LottieBezier,
    translationConfig: LayerConfig
): { a: 1; k: LottieMaskKeyframe[] } | null {
    const anims: AnimationDef[] = translationConfig.animations
        ? translationConfig.animations
        : (translationConfig.transform) ? [translationConfig as AnimationDef] : [];

    const translateAnim = anims.find(a =>
        a.transform === 'translateX' || a.transform === 'translateY' || a.transform === 'translate'
    );
    if (!translateAnim) {
        return null;
    }

    const cycle = parseDuration(translateAnim.duration);
    const easing = getEasing(translateAnim.easing);
    const delay = Math.round((translateAnim.delay ?? 0) * FPS);

    const positions: [number, number][] = [];
    if (translateAnim.transform === 'translateY') {
        const vals = translateAnim.values ?? [0, translateAnim.to ?? 0, 0];
        for (const v of vals) {
            positions.push([0, v]);
        }
    } else if (translateAnim.transform === 'translateX') {
        const vals = translateAnim.values ?? [0, translateAnim.to ?? 0, 0];
        for (const v of vals) {
            positions.push([v, 0]);
        }
    } else if (translateAnim.transform === 'translate') {
        const vals = translateAnim.values ?? [];
        for (let i = 0; i < vals.length; i += 2) {
            positions.push([vals[i], vals[i + 1] ?? 0]);
        }
    }

    if (positions.length < 2) {
        return null;
    }

    const isCyclic = positions[0][0] === positions[positions.length - 1][0]
        && positions[0][1] === positions[positions.length - 1][1];

    const numSegs = positions.length - 1;
    const phase = computePhase(delay, cycle);
    const kfs: LottieMaskKeyframe[] = [];

    if (isCyclic) {
        if (phase === 0) {
            let t = 0;
            while (t < COMP_FRAMES) {
                for (let i = 0; i < numSegs; i++) {
                    const segT = Math.round(t + (i / numSegs) * cycle);
                    if (segT >= COMP_FRAMES) {
                        break;
                    }
                    const [dx, dy] = positions[i];
                    kfs.push({t: segT, s: [offsetBezier(baseBezier, dx, dy)], ...easing});
                }
                t += cycle;
            }
        } else {
            const phaseRatio = phase / cycle;
            const pos2d = positions.map(([dx, dy]) => [dx, dy]);
            const startOffset = lerpPositions(pos2d, phaseRatio);
            kfs.push({t: 0, s: [offsetBezier(baseBezier, startOffset[0], startOffset[1])], ...easing});

            const startSeg = Math.floor(phaseRatio * numSegs) + 1;
            for (let i = startSeg; i < numSegs; i++) {
                const segT = Math.round((i / numSegs) * cycle - phase);
                if (segT > 0 && segT < COMP_FRAMES) {
                    const [dx, dy] = positions[i];
                    kfs.push({t: segT, s: [offsetBezier(baseBezier, dx, dy)], ...easing});
                }
            }

            let t = Math.round(cycle - phase);
            while (t < COMP_FRAMES) {
                for (let i = 0; i < numSegs; i++) {
                    const segT = Math.round(t + (i / numSegs) * cycle);
                    if (segT >= COMP_FRAMES) {
                        break;
                    }
                    const [dx, dy] = positions[i];
                    kfs.push({t: segT, s: [offsetBezier(baseBezier, dx, dy)], ...easing});
                }
                t += cycle;
            }

            kfs.push({
                t: COMP_FRAMES,
                s: [offsetBezier(baseBezier, startOffset[0], startOffset[1])],
                ...easing
            });
            return {a: 1, k: kfs};
        }
    } else {
        if (phase === 0) {
            kfs.push({t: 0, s: [offsetBezier(baseBezier, positions[0][0], positions[0][1])], ...easing});
            let t = 0;
            while (t < COMP_FRAMES) {
                const endT = t + cycle;
                if (endT >= COMP_FRAMES) {
                    break;
                }
                const last = positions[numSegs];
                kfs.push({t: endT, s: [offsetBezier(baseBezier, last[0], last[1])], ...easing});
                kfs.push({t: endT, s: [offsetBezier(baseBezier, positions[0][0], positions[0][1])], ...easing});
                t = endT;
            }
        } else {
            const phaseRatio = phase / cycle;
            const pos2d = positions.map(([dx, dy]) => [dx, dy]);
            const startOffset = lerpPositions(pos2d, phaseRatio);
            kfs.push({t: 0, s: [offsetBezier(baseBezier, startOffset[0], startOffset[1])], ...easing});

            const firstEndT = Math.round(cycle - phase);
            if (firstEndT < COMP_FRAMES) {
                const last = positions[numSegs];
                kfs.push({t: firstEndT, s: [offsetBezier(baseBezier, last[0], last[1])], ...easing});
                kfs.push({t: firstEndT, s: [offsetBezier(baseBezier, positions[0][0], positions[0][1])], ...easing});
            }

            let t = firstEndT;
            while (t < COMP_FRAMES) {
                const endT = t + cycle;
                if (endT >= COMP_FRAMES) {
                    break;
                }
                const last = positions[numSegs];
                kfs.push({t: endT, s: [offsetBezier(baseBezier, last[0], last[1])], ...easing});
                kfs.push({t: endT, s: [offsetBezier(baseBezier, positions[0][0], positions[0][1])], ...easing});
                t = endT;
            }

            kfs.push({
                t: COMP_FRAMES,
                s: [offsetBezier(baseBezier, startOffset[0], startOffset[1])],
                ...easing
            });
            return {a: 1, k: kfs};
        }
    }

    kfs.push({
        t: COMP_FRAMES,
        s: [offsetBezier(baseBezier, positions[0][0], positions[0][1])],
        ...easing
    });

    return {a: 1, k: kfs};
}

/**
 * Finds the animation config that drives a mask applied to this element.
 * E.g. for a Sun element masked by "Cloud Mask", returns the "Clouds" config.
 */
export function findMaskSourceConfig(doc: any, element: any, resolvedConfig: ResolvedConfig): LayerConfig | null {
    let current = element;
    let maskId: string | null = null;

    while (current && current.nodeType === 1) {
        const maskAttr: string = current.getAttribute?.('mask') ?? '';
        if (maskAttr) {
            const match = maskAttr.match(/url\(#([^)]+)\)/);
            if (match) {
                maskId = match[1];
                break;
            }
        }
        current = current.parentNode;
    }

    if (!maskId) {
        function findMaskIdNested(node: any): string | null {
            if (node.nodeType !== 1) {
                return null;
            }
            const attr: string = node.getAttribute?.('mask') ?? '';
            const match = attr.match(/url\(#([^)]+)\)/);
            if (match) {
                return match[1];
            }
            for (const child of Array.from(node.childNodes as any[])) {
                const found = findMaskIdNested(child);
                if (found) {
                    return found;
                }
            }
            return null;
        }

        maskId = findMaskIdNested(element);
    }

    if (!maskId) {
        return null;
    }

    const maskElement = findById(doc, maskId) ?? (() => {
        function search(node: any): any | null {
            if (node.nodeType !== 1) {
                return null;
            }
            if (node.tagName?.toLowerCase() === 'mask' && node.getAttribute('id') === maskId) {
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
    })();
    if (!maskElement) {
        return null;
    }

    for (const child of Array.from(maskElement.childNodes as any[])) {
        if (child.nodeType !== 1) {
            continue;
        }
        const childId: string = child.getAttribute?.('id') ?? '';
        if (!childId) {
            continue;
        }

        const baseName = childId.replace(/_\d+$/, '').replace(/\s+[Mm]ask$/i, '').trim();
        if (!baseName) {
            continue;
        }

        const candidates = [baseName, baseName + 's', baseName.replace(/s$/i, '')];
        for (const candidate of candidates) {
            const layerConfig = resolvedConfig.layers[candidate];
            if (!layerConfig) {
                continue;
            }

            const transforms = new Set(['translateX', 'translateY', 'translate']);
            const hasTranslation = (layerConfig.transform && transforms.has(layerConfig.transform))
                || layerConfig.animations?.some(a => a.transform && transforms.has(a.transform));

            if (hasTranslation) {
                return layerConfig;
            }
        }
    }

    return null;
}

/**
 * Finds a rect element inside a mask that has property animations (y, height, x, width)
 * in the resolved config. Returns the rect dimensions and corresponding layer config.
 */
export function findRectMaskPropertyConfig(
    doc: any, element: any, config: ResolvedConfig
): { rect: { x: number; y: number; width: number; height: number }; layerConfig: LayerConfig } | null {
    let current = element;
    let maskId: string | null = null;

    while (current && current.nodeType === 1) {
        const maskAttr: string = current.getAttribute?.('mask') ?? '';
        const match = maskAttr.match(/url\(#([^)]+)\)/);
        if (match) {
            maskId = match[1];
            break;
        }
        current = current.parentNode;
    }

    if (!maskId) {
        return null;
    }

    function findMask(node: any): any | null {
        if (node.nodeType !== 1) {
            return null;
        }
        if (node.tagName?.toLowerCase() === 'mask' && node.getAttribute('id') === maskId) {
            return node;
        }
        for (const child of Array.from(node.childNodes as any[])) {
            const found = findMask(child);
            if (found) {
                return found;
            }
        }
        return null;
    }

    const maskElement = findMask(doc.documentElement);
    if (!maskElement) {
        return null;
    }

    const rectProperties = new Set(['y', 'height', 'x', 'width']);
    for (const child of Array.from(maskElement.childNodes as any[])) {
        if (child.nodeType !== 1 || child.tagName?.toLowerCase() !== 'rect') {
            continue;
        }
        const childId: string = child.getAttribute?.('id') ?? '';
        if (!childId) {
            continue;
        }

        const layerConfig = config.layers[childId];
        if (!layerConfig) {
            continue;
        }

        const anims: AnimationDef[] = layerConfig.animations
            ? layerConfig.animations
            : layerConfig.property ? [layerConfig as AnimationDef] : [];

        const hasPropertyAnim = anims.some(a => a.property && rectProperties.has(a.property));
        if (hasPropertyAnim) {
            return {
                rect: {
                    x: parseFloat(child.getAttribute('x') ?? '0'),
                    y: parseFloat(child.getAttribute('y') ?? '0'),
                    width: parseFloat(child.getAttribute('width') ?? '0'),
                    height: parseFloat(child.getAttribute('height') ?? '0')
                },
                layerConfig
            };
        }
    }

    return null;
}

/**
 * Animates a rect mask based on property animations (y, height).
 * Generates bezier keyframes that represent the changing rect dimensions over time.
 */
export function animateRectMaskProperties(
    baseRect: { x: number; y: number; width: number; height: number },
    layerConfig: LayerConfig,
    offsetX: number = 0,
    offsetY: number = 0
): { a: 1; k: LottieMaskKeyframe[] } | null {
    const anims: AnimationDef[] = layerConfig.animations
        ? layerConfig.animations
        : layerConfig.property ? [layerConfig as AnimationDef] : [];

    const yAnim = anims.find(a => a.property === 'y');
    const hAnim = anims.find(a => a.property === 'height');
    if (!yAnim && !hAnim) {
        return null;
    }

    const refAnim = yAnim ?? hAnim!;
    const cycle = parseDuration(refAnim.duration);
    const easing = getEasing(refAnim.easing);
    const delay = Math.round((refAnim.delay ?? 0) * FPS);

    const yValues = yAnim?.values ? [...yAnim.values] : [baseRect.y];
    const hValues = hAnim?.values ? [...hAnim.values] : [baseRect.height];

    // Pad shorter array to match longer
    while (yValues.length < hValues.length) {
        yValues.push(yValues[yValues.length - 1]);
    }
    while (hValues.length < yValues.length) {
        hValues.push(hValues[hValues.length - 1]);
    }

    const numSegs = yValues.length - 1;

    function rectBezier(yVal: number, hVal: number): LottieBezier {
        const { x, width } = baseRect;
        return {
            v: [
                [x + offsetX, yVal + offsetY],
                [x + width + offsetX, yVal + offsetY],
                [x + width + offsetX, yVal + hVal + offsetY],
                [x + offsetX, yVal + hVal + offsetY]
            ] as [number, number][],
            i: [[0, 0], [0, 0], [0, 0], [0, 0]] as [number, number][],
            o: [[0, 0], [0, 0], [0, 0], [0, 0]] as [number, number][],
            c: true
        };
    }

    function lerpRect(fraction: number): LottieBezier {
        const yVal = lerpValues(yValues, fraction);
        const hVal = lerpValues(hValues, fraction);
        return rectBezier(yVal, hVal);
    }

    const phase = computePhase(delay, cycle);
    const kfs: LottieMaskKeyframe[] = [];

    if (phase === 0) {
        let t = 0;
        while (t < COMP_FRAMES) {
            for (let i = 0; i < numSegs; i++) {
                const segT = Math.round(t + (i / numSegs) * cycle);
                if (segT >= COMP_FRAMES) {
                    break;
                }
                kfs.push({ t: segT, s: [rectBezier(yValues[i], hValues[i])], ...easing });
            }
            t += cycle;
        }
        kfs.push({ t: COMP_FRAMES, s: [rectBezier(yValues[0], hValues[0])], ...easing });
    } else {
        const phaseRatio = phase / cycle;
        const startBezier = lerpRect(phaseRatio);
        kfs.push({ t: 0, s: [startBezier], ...easing });

        const startSeg = Math.floor(phaseRatio * numSegs) + 1;
        for (let i = startSeg; i < numSegs; i++) {
            const segT = Math.round((i / numSegs) * cycle - phase);
            if (segT > 0 && segT < COMP_FRAMES) {
                kfs.push({ t: segT, s: [rectBezier(yValues[i], hValues[i])], ...easing });
            }
        }

        let t = Math.round(cycle - phase);
        while (t < COMP_FRAMES) {
            for (let i = 0; i < numSegs; i++) {
                const segT = Math.round(t + (i / numSegs) * cycle);
                if (segT >= COMP_FRAMES) {
                    break;
                }
                kfs.push({ t: segT, s: [rectBezier(yValues[i], hValues[i])], ...easing });
            }
            t += cycle;
        }
        kfs.push({ t: COMP_FRAMES, s: [startBezier], ...easing });
    }

    return kfs.length >= 2 ? { a: 1, k: kfs } : null;
}
