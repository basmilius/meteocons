import { DOMParser } from '@xmldom/xmldom';
import { computeCenter, computeOriginPoint } from '../utils/bbox';
import type { Easing } from './animation-helpers';
import { animatedValue, arraysEqual, COMP_FRAMES, computePhase, FPS, getEasing, kf, kfEnd, lerpPositions, lerpValues, parseDuration, staticTransform, staticValue } from './animation-helpers';
import { extractGradients } from './gradients';
import { addStrokeDashes, buildShapeGroup, collectIds, collectTopLevelElements, offsetShapeGroup } from './shapes';
import { animateMaskBezier, animateRectMaskProperties, buildMasksForElement, findMaskSourceConfig, findRectMaskPropertyConfig, synthesizeMaskFromCloud } from './masks';
import type { LottieAnimatedValue, LottieBezier, LottieJSON, LottieKeyframe, LottieLayer, LottieTransform } from './types';
import type { AnimationDef, LayerConfig, ResolvedConfig } from '../config-loader';

function resolveOrigin(origin: string | undefined, element: any): { ax: number; ay: number } {
    if (!origin || origin === 'center') {
        const center = computeCenter(element);
        return center ? {ax: center.cx, ay: center.cy} : {ax: 64, ay: 64};
    }
    if (origin === 'bottom' || origin === 'top') {
        const point = computeOriginPoint(element, origin);
        return point ? {ax: point.cx, ay: point.cy} : {ax: 64, ay: 64};
    }
    const parts = origin.replace(/px/g, '').trim().split(/\s+/);
    return {ax: parseFloat(parts[0]) || 0, ay: parseFloat(parts[1]) || 0};
}

function buildTransformFromConfig(layerConfig: LayerConfig, element: any): LottieTransform {
    const base: LottieTransform = {
        o: staticValue(100),
        r: staticValue(0),
        p: staticValue([0, 0, 0]),
        a: staticValue([0, 0, 0]),
        s: staticValue([100, 100, 100])
    };

    const anims: AnimationDef[] = layerConfig.animations
        ? layerConfig.animations
        : (layerConfig.transform || layerConfig.property) ? [layerConfig as AnimationDef] : [];

    let scaleAnchor: { ax: number; ay: number } | null = null;
    for (const anim of anims) {
        if (anim.transform) {
            if (anim.transform === 'scale' || anim.transform === 'scaleY') {
                scaleAnchor = resolveOrigin(anim.origin, element);
            }
            applyTransformAnim(base, anim, element);
        } else if (anim.property) {
            applyPropertyAnim(base, anim);
        }
    }

    // When scale sets an anchor point, position must match so scale
    // operates from the element's center (same pattern as rotate).
    if (scaleAnchor) {
        const {ax, ay} = scaleAnchor;
        if (base.p.a === 1) {
            for (const keyframe of (base.p as LottieAnimatedValue).k) {
                if (keyframe.s) {
                    keyframe.s = [keyframe.s[0] + ax, keyframe.s[1] + ay, keyframe.s[2] ?? 0];
                }
                if (keyframe.e) {
                    keyframe.e = [keyframe.e[0] + ax, keyframe.e[1] + ay, keyframe.e[2] ?? 0];
                }
            }
        } else {
            const current = base.p.k as number[];
            base.p = staticValue([current[0] + ax, current[1] + ay, current[2] ?? 0]);
        }
    }

    return base;
}

function applyTransformAnim(base: LottieTransform, anim: AnimationDef, element: any): void {
    const cycle = parseDuration(anim.duration);
    const easing = getEasing(anim.easing);
    const delay = Math.round((anim.delay ?? 0) * FPS);

    switch (anim.transform) {
        case 'rotate': {
            const {ax, ay} = resolveOrigin(anim.origin, element);
            base.a = staticValue([ax, ay, 0]);
            base.p = staticValue([ax, ay, 0]);

            if (anim.from !== undefined && anim.to !== undefined) {
                const range = anim.to - anim.from;
                const phase = computePhase(delay, cycle);
                const phaseOffset = (phase / cycle) * range;
                const startValue = anim.from + phaseOffset;
                const kfs: LottieKeyframe[] = [];
                let t = 0;
                let rep = 0;
                while (t < COMP_FRAMES) {
                    kfs.push(kf(t, [startValue + rep * range], easing));
                    t += cycle;
                    rep++;
                }
                kfs.push(kfEnd(COMP_FRAMES, [startValue + rep * range], easing));
                base.r = animatedValue(kfs);
            } else if (anim.values) {
                const phase = computePhase(delay, cycle);
                const numSegs = anim.values.length - 1;
                const kfs: LottieKeyframe[] = [];

                if (phase === 0) {
                    let t = 0;
                    while (t < COMP_FRAMES) {
                        for (let i = 0; i < numSegs; i++) {
                            const segT = anim.keyTimes
                                ? Math.round(t + anim.keyTimes[i] * cycle)
                                : Math.round(t + (i / numSegs) * cycle);
                            if (segT >= COMP_FRAMES) {
                                break;
                            }
                            kfs.push(kf(segT, [anim.values[i]], easing));
                        }
                        t += cycle;
                    }
                    kfs.push(kfEnd(COMP_FRAMES, [anim.values[0]], easing));
                } else {
                    const phaseRatio = phase / cycle;
                    const startVal = lerpValues(anim.values, phaseRatio, anim.keyTimes);
                    kfs.push(kf(0, [startVal], easing));

                    const segTimes = anim.keyTimes ?? anim.values.map((_: number, i: number) => i / numSegs);
                    for (let i = 0; i < numSegs; i++) {
                        if (segTimes[i] <= phaseRatio) {
                            continue;
                        }
                        const segT = Math.round(segTimes[i] * cycle - phase);
                        if (segT > 0 && segT < COMP_FRAMES) {
                            kfs.push(kf(segT, [anim.values[i]], easing));
                        }
                    }

                    let t = Math.round(cycle - phase);
                    while (t < COMP_FRAMES) {
                        for (let i = 0; i < numSegs; i++) {
                            const segT = anim.keyTimes
                                ? Math.round(t + anim.keyTimes[i] * cycle)
                                : Math.round(t + (i / numSegs) * cycle);
                            if (segT >= COMP_FRAMES) {
                                break;
                            }
                            kfs.push(kf(segT, [anim.values[i]], easing));
                        }
                        t += cycle;
                    }
                    kfs.push(kfEnd(COMP_FRAMES, [startVal], easing));
                }
                base.r = animatedValue(kfs);
            }
            break;
        }

        case 'translateX': {
            const vals = anim.values ?? [0, anim.to ?? 0, 0];
            const kfs = buildPositionKeyframes(vals.map(v => [v, 0, 0]), cycle, easing, delay);
            base.p = animatedValue(kfs);
            break;
        }

        case 'translateY': {
            const vals = anim.values ?? [0, anim.to ?? 0, 0];
            const kfs = buildPositionKeyframes(vals.map(v => [0, v, 0]), cycle, easing, delay);
            base.p = animatedValue(kfs);
            break;
        }

        case 'translate': {
            if (anim.values && anim.values.length >= 2) {
                const positions: number[][] = [];
                for (let i = 0; i < anim.values.length; i += 2) {
                    positions.push([anim.values[i], anim.values[i + 1] ?? 0, 0]);
                }
                const kfs = buildPositionKeyframes(positions, cycle, easing, delay);
                base.p = animatedValue(kfs);
            }
            break;
        }

        case 'scale':
        case 'scaleY': {
            if (anim.values) {
                const {ax, ay} = resolveOrigin(anim.origin, element);
                base.a = staticValue([ax, ay, 0]);

                const scaleValues: number[][] = anim.transform === 'scaleY'
                    ? anim.values.map(v => [100, v * 100, 100])
                    : (() => {
                        const pairs: number[][] = [];
                        for (let i = 0; i < anim.values.length; i += 2) {
                            const sx = (anim.values[i] ?? 1) * 100;
                            const sy = (anim.values[i + 1] ?? anim.values[i] ?? 1) * 100;
                            pairs.push([sx, sy, 100]);
                        }
                        return pairs;
                    })();

                const phase = computePhase(delay, cycle);
                const numScaleSegs = scaleValues.length - 1;
                const kfs: LottieKeyframe[] = [];

                if (phase === 0) {
                    let t = 0;
                    while (t < COMP_FRAMES) {
                        for (let i = 0; i < numScaleSegs; i++) {
                            const segT = Math.round(t + (i / numScaleSegs) * cycle);
                            if (segT >= COMP_FRAMES) {
                                break;
                            }
                            kfs.push(kf(segT, scaleValues[i], easing));
                        }
                        t += cycle;
                    }
                    kfs.push(kfEnd(COMP_FRAMES, scaleValues[0], easing));
                } else {
                    const phaseRatio = phase / cycle;
                    const startScale = lerpPositions(scaleValues, phaseRatio);
                    kfs.push(kf(0, startScale, easing));

                    const startSeg = Math.floor(phaseRatio * numScaleSegs) + 1;
                    for (let i = startSeg; i < numScaleSegs; i++) {
                        const segT = Math.round((i / numScaleSegs) * cycle - phase);
                        if (segT > 0 && segT < COMP_FRAMES) {
                            kfs.push(kf(segT, scaleValues[i], easing));
                        }
                    }

                    let t = Math.round(cycle - phase);
                    while (t < COMP_FRAMES) {
                        for (let i = 0; i < numScaleSegs; i++) {
                            const segT = Math.round(t + (i / numScaleSegs) * cycle);
                            if (segT >= COMP_FRAMES) {
                                break;
                            }
                            kfs.push(kf(segT, scaleValues[i], easing));
                        }
                        t += cycle;
                    }
                    kfs.push(kfEnd(COMP_FRAMES, startScale, easing));
                }
                base.s = animatedValue(kfs);
            }
            break;
        }
    }
}

function applyPropertyAnim(base: LottieTransform, anim: AnimationDef): void {
    const cycle = parseDuration(anim.duration);
    const easing = getEasing(anim.easing);
    const delay = Math.round((anim.delay ?? 0) * FPS);

    if (anim.property === 'opacity') {
        const vals = anim.values ?? [anim.from ?? 0, anim.to ?? 100];
        const opacityVals = vals.map(v => v * 100);
        const numSegs = opacityVals.length - 1;
        const phase = computePhase(delay, cycle);
        const hasKeyTimes = !!(anim.keyTimes && anim.keyTimes.length === opacityVals.length);
        const segTimes = hasKeyTimes
            ? anim.keyTimes!
            : opacityVals.map((_: number, i: number) => i / numSegs);

        const kfs: LottieKeyframe[] = [];

        if (phase === 0) {
            let t = 0;
            while (t < COMP_FRAMES) {
                for (let i = 0; i < numSegs; i++) {
                    const segT = Math.round(t + segTimes[i] * cycle);
                    if (segT >= COMP_FRAMES) {
                        break;
                    }
                    kfs.push(kf(segT, [opacityVals[i]], easing));
                }
                t += cycle;
            }
            kfs.push(kfEnd(COMP_FRAMES, [opacityVals[0]], easing));
        } else {
            const phaseRatio = phase / cycle;
            const startOpacity = lerpValues(opacityVals, phaseRatio, segTimes);
            kfs.push(kf(0, [startOpacity], easing));

            for (let i = 0; i < numSegs; i++) {
                if (segTimes[i] <= phaseRatio) {
                    continue;
                }
                const segT = Math.round(segTimes[i] * cycle - phase);
                if (segT > 0 && segT < COMP_FRAMES) {
                    kfs.push(kf(segT, [opacityVals[i]], easing));
                }
            }

            let t = Math.round(cycle - phase);
            while (t < COMP_FRAMES) {
                for (let i = 0; i < numSegs; i++) {
                    const segT = Math.round(t + segTimes[i] * cycle);
                    if (segT >= COMP_FRAMES) {
                        break;
                    }
                    kfs.push(kf(segT, [opacityVals[i]], easing));
                }
                t += cycle;
            }
            kfs.push(kfEnd(COMP_FRAMES, [startOpacity], easing));
        }
        base.o = animatedValue(kfs);
    }
}

function buildPositionKeyframes(
    positions: number[][],
    cycle: number,
    easing: Easing,
    delay: number
): LottieKeyframe[] {
    const kfs: LottieKeyframe[] = [];
    const isCyclic = arraysEqual(positions[0], positions[positions.length - 1]);
    const phase = computePhase(Math.round(delay), cycle);
    const numSegs = positions.length - 1;

    if (isCyclic) {
        if (phase === 0) {
            let t = 0;
            while (t < COMP_FRAMES) {
                for (let i = 0; i < numSegs; i++) {
                    const segT = Math.round(t + (i / numSegs) * cycle);
                    if (segT >= COMP_FRAMES) {
                        break;
                    }
                    kfs.push(kf(segT, positions[i], easing));
                }
                t += cycle;
            }
            kfs.push(kfEnd(COMP_FRAMES, positions[0], easing));
        } else {
            const phaseRatio = phase / cycle;
            const startPos = lerpPositions(positions, phaseRatio);
            kfs.push(kf(0, startPos, easing));

            const startSeg = Math.floor(phaseRatio * numSegs) + 1;
            for (let i = startSeg; i < numSegs; i++) {
                const segT = Math.round((i / numSegs) * cycle - phase);
                if (segT > 0 && segT < COMP_FRAMES) {
                    kfs.push(kf(segT, positions[i], easing));
                }
            }

            let t = Math.round(cycle - phase);
            while (t < COMP_FRAMES) {
                for (let i = 0; i < numSegs; i++) {
                    const segT = Math.round(t + (i / numSegs) * cycle);
                    if (segT >= COMP_FRAMES) {
                        break;
                    }
                    kfs.push(kf(segT, positions[i], easing));
                }
                t += cycle;
            }
            kfs.push(kfEnd(COMP_FRAMES, startPos, easing));
        }
    } else {
        if (phase === 0) {
            kfs.push(kf(0, positions[0], easing));
            let t = 0;
            while (t < COMP_FRAMES) {
                const endT = t + cycle;
                if (endT >= COMP_FRAMES) {
                    break;
                }
                kfs.push(kf(endT, positions[numSegs], easing));
                kfs.push(kf(endT, positions[0], easing));
                t = endT;
            }
            kfs.push(kfEnd(COMP_FRAMES, positions[0], easing));
        } else {
            const phaseRatio = phase / cycle;
            const startPos = lerpPositions(positions, phaseRatio);
            kfs.push(kf(0, startPos, easing));

            const firstEndT = Math.round(cycle - phase);
            if (firstEndT < COMP_FRAMES) {
                kfs.push(kf(firstEndT, positions[numSegs], easing));
                kfs.push(kf(firstEndT, positions[0], easing));
            }

            let t = firstEndT;
            while (t < COMP_FRAMES) {
                const endT = t + cycle;
                if (endT >= COMP_FRAMES) {
                    break;
                }
                kfs.push(kf(endT, positions[numSegs], easing));
                kfs.push(kf(endT, positions[0], easing));
                t = endT;
            }
            kfs.push(kfEnd(COMP_FRAMES, startPos, easing));
        }
    }

    return kfs;
}

/**
 * Merges two translation configs by adding their values element-wise.
 * Both configs must be simple translateY/translateX with matching value
 * counts and same duration. Falls back to the child config if merging
 * isn't possible.
 *
 * This handles the SVG → Lottie flattening: in SVG, parent and child
 * transforms stack (e.g. Clouds [0,-3,0] + Secondary Cloud [-3,0,-3] = static).
 * In Lottie layers are flat, so we need to pre-merge the values.
 */
function mergeTranslateConfigs(parent: LayerConfig, child: LayerConfig): LayerConfig {
    if (parent.transform && parent.transform === child.transform
        && parent.values && child.values
        && parent.values.length === child.values.length
        && parent.duration === child.duration) {
        return {
            ...child,
            values: child.values.map((v, i) => v + (parent.values![i] ?? 0))
        };
    }
    return child;
}

/**
 * Computes mask animation values relative to the layer's position offset.
 * When a layer has a merged constant offset (e.g. [-3,-3,-3]), the mask
 * animation must compensate: absolute [0,-3,0] - offset [-3,-3,-3] = [3,0,3].
 * This ensures the mask tracks the primary cloud correctly in local coords.
 */
function computeRelativeMaskConfig(absoluteCfg: LayerConfig, layerCfg: LayerConfig): LayerConfig | undefined {
    if (!absoluteCfg.transform || absoluteCfg.transform !== layerCfg.transform
        || !absoluteCfg.values || !layerCfg.values
        || absoluteCfg.values.length !== layerCfg.values.length) {
        return undefined;
    }
    const transforms = new Set(['translateX', 'translateY', 'translate']);
    if (!transforms.has(absoluteCfg.transform)) {
        return undefined;
    }
    return {
        ...absoluteCfg,
        values: absoluteCfg.values.map((v, i) => v - (layerCfg.values![i] ?? 0))
    };
}

/**
 * Generates a Lottie JSON from a static SVG and animation config.
 *
 * Traverses ALL visible elements in the SVG (not just animated ones).
 * Each top-level child of the frame wrapper becomes a Lottie shape layer.
 * Animated elements get keyframes from the config; others are static.
 */
export function generateLottie(svgContent: string, config: ResolvedConfig): LottieJSON {
    const doc = new DOMParser().parseFromString(svgContent, 'image/svg+xml');
    const svg = doc.documentElement!;

    const vb = svg.getAttribute('viewBox')?.split(/\s+/) ?? [];
    const width = parseFloat(svg.getAttribute('width') ?? vb[2] ?? '128');
    const height = parseFloat(svg.getAttribute('height') ?? vb[3] ?? '128');
    const gradients = extractGradients(doc);

    const layers: LottieLayer[] = [];
    let idx = 0;

    const topElements = collectTopLevelElements(svg);
    const animatedIds = new Set(Object.keys(config.layers));

    function addLayer(element: any, transform: LottieTransform, transformConfig?: LayerConfig, maskOverrideConfig?: LayerConfig): void {
        const shapeGroup = buildShapeGroup(element, gradients);
        if (!shapeGroup) {
            return;
        }

        const elementId = element.getAttribute?.('id') ?? '';
        const layerConfig = elementId ? config.layers[elementId] : undefined;

        if (layerConfig) {
            const anims: AnimationDef[] = layerConfig.animations
                ? layerConfig.animations
                : (layerConfig.transform || layerConfig.property) ? [layerConfig as AnimationDef] : [];
            for (const anim of anims) {
                if (anim.property === 'stroke-dashoffset') {
                    addStrokeDashes(shapeGroup, anim);
                }
            }
        }

        const opacity = parseFloat(element.getAttribute?.('opacity') ?? '1') * 100;
        if (opacity < 100 && transform.o.a !== 1) {
            transform.o = staticValue(opacity);
        }

        const rawMasks = buildMasksForElement(doc, element, 0, 0)
            ?? synthesizeMaskFromCloud(doc, element, config);
        const hasRotation = transform.r.a === 1;
        const hasMask = rawMasks && rawMasks.length > 0;

        const layer: LottieLayer = {
            ddd: 0,
            ind: ++idx,
            ty: 4,
            nm: elementId || `layer-${idx}`,
            sr: 1,
            st: 0,
            ip: 0,
            op: COMP_FRAMES,
            ao: 0,
            bm: 0,
            ks: transform,
            shapes: [shapeGroup]
        };

        if (hasMask && hasRotation) {
            const existingA = transform.a.k as number[];
            const cx = (existingA[0] !== 0 || existingA[1] !== 0)
                ? existingA[0]
                : (computeCenter(element)?.cx ?? 64);
            const cy = (existingA[0] !== 0 || existingA[1] !== 0)
                ? existingA[1]
                : (computeCenter(element)?.cy ?? 64);

            offsetShapeGroup(shapeGroup, -cx, -cy);

            const trItem = shapeGroup.it.find((i: any) => i.ty === 'tr') as any;
            if (trItem && transform.r.a === 1) {
                trItem.r = transform.r;
            }

            transform.r = staticValue(0);
            transform.p = staticValue([cx, cy, 0]);
            transform.a = staticValue([0, 0, 0]);

            for (const mask of rawMasks!) {
                const bezier = (mask.pt as any).k;
                if (bezier?.v) {
                    bezier.v = bezier.v.map(([vx, vy]: [number, number]) => [vx - cx, vy - cy]);
                }
            }

            const maskSourceConfig = maskOverrideConfig ?? findMaskSourceConfig(doc, element, config) ?? config.layers['Clouds'] ?? null;
            if (maskSourceConfig && maskSourceConfig !== transformConfig) {
                for (const mask of rawMasks!) {
                    if (mask.pt.a !== 0) {
                        continue;
                    }
                    const animated = animateMaskBezier(mask.pt.k as LottieBezier, maskSourceConfig);
                    if (animated) {
                        mask.pt = animated;
                    }
                }
            }

            // Rect mask property animations (y, height) for still-static masks
            const rectConfig = findRectMaskPropertyConfig(doc, element, config);
            if (rectConfig) {
                for (const mask of rawMasks!) {
                    if (mask.pt.a !== 0) {
                        continue;
                    }
                    const animated = animateRectMaskProperties(rectConfig.rect, rectConfig.layerConfig, -cx, -cy);
                    if (animated) {
                        mask.pt = animated;
                    }
                }
            }

            (layer as any).hasMask = true;
            layer.masksProperties = rawMasks!;

        } else if (hasMask) {
            const center = computeCenter(element) || {cx: 64, cy: 64};
            const cx = center.cx;
            const cy = center.cy;

            offsetShapeGroup(shapeGroup, -cx, -cy);
            for (const mask of rawMasks!) {
                const bezier = (mask.pt as any).k;
                if (bezier?.v) {
                    bezier.v = bezier.v.map(([vx, vy]: [number, number]) => [vx - cx, vy - cy]);
                }
            }

            const maskSourceConfig = maskOverrideConfig ?? findMaskSourceConfig(doc, element, config) ?? config.layers['Clouds'] ?? null;
            if (maskSourceConfig && maskSourceConfig !== transformConfig) {
                for (const mask of rawMasks!) {
                    if (mask.pt.a !== 0) {
                        continue;
                    }
                    const animated = animateMaskBezier(mask.pt.k as LottieBezier, maskSourceConfig);
                    if (animated) {
                        mask.pt = animated;
                    }
                }
            }

            // Rect mask property animations (y, height) for still-static masks
            const rectConfig2 = findRectMaskPropertyConfig(doc, element, config);
            if (rectConfig2) {
                for (const mask of rawMasks!) {
                    if (mask.pt.a !== 0) {
                        continue;
                    }
                    const animated = animateRectMaskProperties(rectConfig2.rect, rectConfig2.layerConfig, -cx, -cy);
                    if (animated) {
                        mask.pt = animated;
                    }
                }
            }

            if (transform.p.a === 1) {
                const kfs = (transform.p as LottieAnimatedValue).k;
                for (const keyframe of kfs) {
                    if (keyframe.s) {
                        keyframe.s = [keyframe.s[0] + cx, keyframe.s[1] + cy, keyframe.s[2] ?? 0];
                    }
                    if (keyframe.e) {
                        keyframe.e = [keyframe.e[0] + cx, keyframe.e[1] + cy, keyframe.e[2] ?? 0];
                    }
                }
            } else {
                const existingP = transform.p.k as number[];
                transform.p = staticValue([existingP[0] + cx, existingP[1] + cy, existingP[2] ?? 0]);
            }

            transform.a = staticValue([0, 0, 0]);

            (layer as any).hasMask = true;
            layer.masksProperties = rawMasks!;
        }

        layers.push(layer);
    }

    /**
     * Recursively distributes a parent's animation config through intermediate
     * non-animated groups to reach animated descendants. Animated descendants
     * get a merged transform (parent + own config added element-wise) so the
     * flat Lottie layer correctly represents the stacked SVG transforms.
     *
     * Example: "Clouds" [0,-3,0] distributes through "Mask group_2" to
     * "Secondary Cloud" [-3,0,-3]. Merged: [-3,-3,-3] = static at Y=-3.
     */
    function distributeToChildren(group: any, parentCfg: LayerConfig): void {
        for (const child of Array.from(group.childNodes as any[])) {
            if (child.nodeType !== 1) {
                continue;
            }
            const childTag = child.tagName?.toLowerCase();
            if (!childTag || childTag === 'defs' || childTag === 'clippath' || childTag === 'mask') {
                continue;
            }

            const childId = child.getAttribute?.('id') ?? '';

            if (childId && animatedIds.has(childId)) {
                const merged = mergeTranslateConfigs(parentCfg, config.layers[childId]);
                const relativeMask = computeRelativeMaskConfig(parentCfg, merged);
                addLayer(child, buildTransformFromConfig(merged, child), parentCfg, relativeMask);
            } else if (childTag === 'g' && collectIds(child).some(id => animatedIds.has(id))) {
                distributeToChildren(child, parentCfg);
            } else {
                addLayer(child, buildTransformFromConfig(parentCfg, child), parentCfg);
            }
        }
    }

    function processElement(element: any): void {
        if (element.nodeType !== 1) {
            return;
        }
        const tag = element.tagName?.toLowerCase();
        if (!tag || tag === 'defs' || tag === 'clippath' || tag === 'mask') {
            return;
        }

        const elementId = element.getAttribute?.('id') ?? '';

        if (elementId && animatedIds.has(elementId)) {
            if (tag === 'g') {
                const childIds = collectIds(element);
                const hasAnimatedChild = childIds.some(id => id !== elementId && animatedIds.has(id));

                if (hasAnimatedChild) {
                    const groupTransform = buildTransformFromConfig(config.layers[elementId], element);
                    const parentCfg = config.layers[elementId];
                    for (const child of Array.from(element.childNodes as any[])) {
                        if (child.nodeType !== 1) {
                            continue;
                        }
                        const childId = child.getAttribute?.('id') ?? '';
                        if (childId && animatedIds.has(childId)) {
                            processElement(child);
                        } else if (child.tagName?.toLowerCase() === 'g'
                            && collectIds(child).some(id => animatedIds.has(id))) {
                            distributeToChildren(child, parentCfg);
                        } else {
                            addLayer(child, structuredClone(groupTransform), parentCfg);
                        }
                    }
                    return;
                }
            }
            addLayer(element, buildTransformFromConfig(config.layers[elementId], element), config.layers[elementId]);
            return;
        }

        if (tag === 'g') {
            const childIds = collectIds(element);
            const hasAnimatedChild = childIds.some(id => animatedIds.has(id));

            if (hasAnimatedChild) {
                for (const child of Array.from(element.childNodes as any[])) {
                    processElement(child);
                }
                return;
            }
        }

        addLayer(element, staticTransform());
    }

    for (const element of topElements) {
        processElement(element);
    }

    layers.reverse();

    return {
        v: '5.9.0',
        fr: FPS,
        ip: 0,
        op: COMP_FRAMES,
        w: width,
        h: height,
        nm: 'icon',
        ddd: 0,
        assets: [],
        layers
    };
}
