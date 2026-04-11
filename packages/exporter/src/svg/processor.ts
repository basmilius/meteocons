import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { computeCenter, computeOriginPoint, findById } from '../utils/bbox';
import type { AnimationDef, LayerConfig, ResolvedConfig } from '../config-loader';

const EASING_SPLINES: Record<string, string> = {
    'ease-in-out': '.42 0 .58 1',
    'ease-in': '.42 0 1 1',
    'ease-out': '0 0 .58 1'
};

function splines(easing: string | undefined, segments: number): string {
    const spline = EASING_SPLINES[easing ?? ''] ?? '';
    if (!spline) {
        return '';
    }
    return Array(segments).fill(spline).join('; ');
}

function createAnimate(doc: any, attrs: Record<string, string>): any {
    const el = doc.createElementNS('http://www.w3.org/2000/svg', 'animate');
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }
    return el;
}

function createAnimateTransform(doc: any, attrs: Record<string, string>): any {
    const el = doc.createElementNS('http://www.w3.org/2000/svg', 'animateTransform');
    el.setAttribute('attributeName', 'transform');
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }
    return el;
}

function applyAnimation(doc: any, element: any, anim: AnimationDef): void {
    const dur = anim.duration ?? '1s';
    const durSeconds = parseFloat(dur);
    const delaySeconds = anim.delay ?? 0;
    const remainder = delaySeconds > 0 ? delaySeconds % durSeconds : 0;
    const begin = remainder > 0 ? `-${durSeconds - remainder}s` : '0s';

    if (anim.transform) {
        const type = mapTransformType(anim.transform);
        const values = buildTransformValues(anim, element);
        const attrs: Record<string, string> = {
            type,
            values,
            dur,
            begin,
            repeatCount: 'indefinite'
        };

        // Easing
        const segments = values.split(';').length - 1;
        if (anim.easing && anim.easing !== 'linear' && segments > 0) {
            attrs.calcMode = 'spline';
            attrs.keySplines = splines(anim.easing, segments);
        }

        // keyTimes
        if (anim.keyTimes) {
            attrs.keyTimes = anim.keyTimes.join(';');
        }

        // Scale uses additive="sum" so the wrapper's base translate(cx,cy) is preserved.
        if (type === 'scale') {
            attrs.additive = 'sum';
        }

        element.appendChild(createAnimateTransform(doc, attrs));
    } else if (anim.property) {
        const values = buildPropertyValues(anim);
        const attrs: Record<string, string> = {
            attributeName: anim.property,
            values,
            dur,
            begin,
            repeatCount: 'indefinite'
        };

        // Easing
        const segments = values.split(';').length - 1;
        if (anim.easing && anim.easing !== 'linear' && segments > 0) {
            attrs.calcMode = 'spline';
            attrs.keySplines = splines(anim.easing, segments);
        }

        // keyTimes
        if (anim.keyTimes) {
            attrs.keyTimes = anim.keyTimes.join(';');
        }

        // dashArray: set stroke-dasharray on the element
        if (anim.dashArray) {
            element.setAttribute('stroke-dasharray', String(anim.dashArray));
        }

        element.appendChild(createAnimate(doc, attrs));
    }
}

function mapTransformType(transform: string): string {
    switch (transform) {
        case 'translateX':
        case 'translateY':
        case 'translate':
            return 'translate';
        case 'scaleY':
        case 'scale':
            return 'scale';
        case 'rotate':
            return 'rotate';
        default:
            return transform;
    }
}

function buildTransformValues(anim: AnimationDef, element: any): string {
    const type = anim.transform!;

    if (type === 'rotate') {
        // Rotate values include cx cy: "angle cx cy"
        const origin = resolveOrigin(anim.origin, element);
        if (anim.from !== undefined && anim.to !== undefined) {
            return `${anim.from} ${origin};${anim.to} ${origin}`;
        }
        if (anim.values) {
            return anim.values.map(v => `${v} ${origin}`).join(';');
        }
        return `0 ${origin};360 ${origin}`;
    }

    if (type === 'translateX') {
        if (anim.values) {
            return anim.values.map(v => `${v} 0`).join(';');
        }
        return `0 0;${anim.to ?? 0} 0;0 0`;
    }

    if (type === 'translateY') {
        if (anim.values) {
            return anim.values.map(v => `0 ${v}`).join(';');
        }
        return `0 0;0 ${anim.to ?? 0};0 0`;
    }

    if (type === 'translate') {
        // values is pairs: [x1, y1, x2, y2, ...]
        if (anim.values && anim.values.length >= 2) {
            const pairs: string[] = [];
            for (let i = 0; i < anim.values.length; i += 2) {
                pairs.push(`${anim.values[i]} ${anim.values[i + 1] ?? 0}`);
            }
            return pairs.join(';');
        }
        return '0 0';
    }

    if (type === 'scale' || type === 'scaleY') {
        if (anim.values) {
            // For scaleY, values are single numbers mapped to "1 value"
            if (type === 'scaleY') {
                return anim.values.map(v => `1 ${v}`).join(';');
            }
            // For scale, values are pairs
            const pairs: string[] = [];
            for (let i = 0; i < anim.values.length; i += 2) {
                pairs.push(`${anim.values[i]} ${anim.values[i + 1] ?? anim.values[i]}`);
            }
            return pairs.join(';');
        }
        return '1 1';
    }

    return '0;0';
}

function buildPropertyValues(anim: AnimationDef): string {
    if (anim.values) {
        return anim.values.join(';');
    }
    if (anim.from !== undefined && anim.to !== undefined) {
        return `${anim.from};${anim.to}`;
    }
    return '0;0';
}

function resolveOrigin(origin: string | undefined, element: any): string {
    if (!origin || origin === 'center') {
        const center = computeCenter(element);
        return center ? `${center.cx.toFixed(1)} ${center.cy.toFixed(1)}` : '64 64';
    }
    // "64px 64px" → "64 64"
    return origin.replace(/px/g, '').trim();
}

function applyLayerConfig(doc: any, element: any, config: LayerConfig): void {
    // Handle expandMask: remove viewport restrictions from parent <mask>
    if (config.expandMask) {
        const parent = element.parentNode;
        if (parent && parent.tagName?.toLowerCase() === 'mask') {
            parent.removeAttribute('x');
            parent.removeAttribute('y');
            parent.removeAttribute('width');
            parent.removeAttribute('height');
        }
    }

    const allAnims = config.animations
        ? config.animations
        : (config.transform || config.property) ? [config as AnimationDef] : [];

    const scaleTypes = new Set(['scale', 'scaleY']);
    const translateTypes = new Set(['translate', 'translateX', 'translateY']);

    const scaleAnims = allAnims.filter(a => a.transform && scaleTypes.has(a.transform));
    const translateAnims = allAnims.filter(a => a.transform && translateTypes.has(a.transform));
    const otherAnims = allAnims.filter(a => !scaleAnims.includes(a) && !translateAnims.includes(a));

    if (scaleAnims.length > 0) {
        // Determine pivot point from the scale animation's origin field
        const scaleOrigin = scaleAnims[0].origin;
        const pivot = (scaleOrigin === 'bottom' || scaleOrigin === 'top')
            ? computeOriginPoint(element, scaleOrigin)
            : computeCenter(element);

        if (pivot) {
            // Build: T(translate) * T(px,py) * S(scale) * T(-px,-py) * element
            //
            // 1. Scale wrapper: translate to pivot + scale animateTransform (additive="sum")
            //    The scale sits BETWEEN the two translates so it operates from the pivot.
            const scaleWrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
            scaleWrapper.setAttribute('transform', `translate(${pivot.cx.toFixed(1)},${pivot.cy.toFixed(1)})`);

            // 2. Element: translate back from pivot
            const existing = element.getAttribute('transform') || '';
            const newTransform = `translate(${(-pivot.cx).toFixed(1)},${(-pivot.cy).toFixed(1)})${existing ? ' ' + existing : ''}`;
            element.setAttribute('transform', newTransform);

            // 3. Insert wrapper into DOM
            element.parentNode.insertBefore(scaleWrapper, element);
            scaleWrapper.appendChild(element);

            // 4. Apply scale animation(s) to the scale wrapper
            for (const anim of scaleAnims) {
                applyAnimation(doc, scaleWrapper, anim);
            }

            // 5. Translate wrapper: OUTSIDE scale so translation isn't affected by scaling
            if (translateAnims.length > 0) {
                const translateWrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
                scaleWrapper.parentNode.insertBefore(translateWrapper, scaleWrapper);
                translateWrapper.appendChild(scaleWrapper);

                for (const anim of translateAnims) {
                    applyAnimation(doc, translateWrapper, anim);
                }
            }

            // 6. Other animations (opacity, rotate, etc.) stay on the element
            for (const anim of otherAnims) {
                applyAnimation(doc, element, anim);
            }

            return;
        }
    }

    // No scale animation: apply everything directly to the element
    for (const anim of allAnims) {
        applyAnimation(doc, element, anim);
    }
}

function hasScaleAnimation(config: LayerConfig): boolean {
    const types = new Set(['scale', 'scaleY']);
    if (config.transform && types.has(config.transform)) {
        return true;
    }
    if (config.animations) {
        return config.animations.some(a => a.transform && types.has(a.transform));
    }
    return false;
}

/** Check if a LayerConfig is a translation/position animation that needs mask sync. */
function isTranslationConfig(config: LayerConfig): boolean {
    const transforms = new Set(['translateX', 'translateY', 'translate']);
    if (config.transform && transforms.has(config.transform)) {
        return true;
    }
    if (config.animations) {
        return config.animations.some(a => a.transform && transforms.has(a.transform));
    }
    return false;
}

/** Check if a LayerConfig is a position/scale animation (direct mask parent sync). */
function isPositionConfig(config: LayerConfig): boolean {
    if (isTranslationConfig(config)) {
        return true;
    }
    const types = new Set(['scale', 'scaleY']);
    if (config.transform && types.has(config.transform)) {
        return true;
    }
    if (config.animations) {
        return config.animations.some(a => a.transform && types.has(a.transform));
    }
    return false;
}

/**
 * Find mask content IDs that mirror a given element (by name pattern).
 * E.g. "Clouds" → finds "Cloud Mask" inside <mask> defs.
 */
function findNamedMirrorMasks(doc: any, elementId: string): string[] {
    const normalized = elementId.replace(/^\u25B6 /, '').replace(/^\u00E2\u0096\u00B6 /, '');
    const bases = new Set([normalized, normalized.replace(/s$/i, '')]);
    const found: string[] = [];

    function search(node: any): void {
        if (node.nodeType !== 1) {
            return;
        }
        if (node.tagName?.toLowerCase() === 'mask') {
            for (const child of Array.from(node.childNodes as any[])) {
                if (child.nodeType !== 1) {
                    continue;
                }
                const childId: string = child.getAttribute?.('id') ?? '';
                const normalizedChildId = childId.replace(/_\d+$/, '').toLowerCase();
                for (const base of bases) {
                    if (normalizedChildId === `${base.toLowerCase()} mask` || normalizedChildId === base.toLowerCase()) {
                        found.push(childId);
                    }
                }
            }
        }
        for (const c of Array.from(node.childNodes as any[])) {
            search(c);
        }
    }

    search(doc.documentElement);
    return found;
}

/**
 * If element's direct parent is <g mask="url(#...)">, find all IDs inside the mask def.
 */
function findDirectParentMaskContent(doc: any, element: any): string[] {
    const parent = element.parentNode;
    if (!parent || parent.nodeType !== 1) {
        return [];
    }
    const maskAttr: string = parent.getAttribute?.('mask') || '';
    const match = maskAttr.match(/url\(#([^)]+)\)/);
    if (!match) {
        return [];
    }

    const maskId = match[1];
    const ids: string[] = [];

    function searchMask(node: any): void {
        if (node.nodeType !== 1) {
            return;
        }
        if (node.tagName?.toLowerCase() === 'mask' && node.getAttribute('id') === maskId) {
            collectIds(node, ids);
            return;
        }
        for (const c of Array.from(node.childNodes as any[])) {
            searchMask(c);
        }
    }

    searchMask(doc.documentElement);
    return ids;
}

function collectIds(node: any, ids: string[]): void {
    for (const child of Array.from(node.childNodes as any[])) {
        if (child.nodeType !== 1) {
            continue;
        }
        const id = child.getAttribute?.('id');
        if (id) {
            ids.push(id);
        }
        collectIds(child, ids);
    }
}

/**
 * Checks if an ancestor has the SAME animation config as this element.
 * Prevents double-animation when parent and child share identical configs
 * (e.g. Alert + Exclamation), but allows different configs on nested elements
 * (e.g. Clouds + Secondary Cloud with counter-phase).
 */
function hasDuplicateAncestorConfig(
    element: any,
    layerConfig: LayerConfig,
    resolvedLayers: Record<string, LayerConfig>
): boolean {
    let parent = element.parentNode;
    while (parent && parent.nodeType === 1) {
        const parentId = parent.getAttribute?.('id');
        if (parentId && resolvedLayers[parentId]) {
            if (JSON.stringify(resolvedLayers[parentId]) === JSON.stringify(layerConfig)) {
                return true;
            }
        }
        parent = parent.parentNode;
    }
    return false;
}

/**
 * Syncs mask content with the animation of a layer.
 * 1. Direct parent mask: co-animate mask children for position/scale configs.
 * 2. Named mirror masks: co-animate "Cloud Mask" for "Clouds" (translation only).
 *
 * Uses syncedMaskIds to prevent double-animation when both mechanisms target the
 * same element (e.g. "Cloud Mask_2" found by both findNamedMirrorMasks and
 * findDirectParentMaskContent).
 */
function syncMasksForLayer(
    doc: any, element: any, layerId: string,
    layerConfig: LayerConfig, animatedIds: Set<string>,
    syncedMaskIds: Set<string>
): void {
    if (layerConfig.syncMask === false) {
        return;
    }

    if (isPositionConfig(layerConfig)) {
        for (const maskChildId of findDirectParentMaskContent(doc, element)) {
            if (animatedIds.has(maskChildId) || syncedMaskIds.has(maskChildId)) {
                continue;
            }
            const maskChild = findById(doc, maskChildId);
            if (maskChild) {
                applyLayerConfig(doc, maskChild, layerConfig);
                syncedMaskIds.add(maskChildId);
            }
        }
    }

    if (isTranslationConfig(layerConfig)) {
        for (const mirrorId of findNamedMirrorMasks(doc, layerId)) {
            if (syncedMaskIds.has(mirrorId)) {
                continue;
            }
            const mirrorEl = findById(doc, mirrorId);
            if (mirrorEl) {
                applyLayerConfig(doc, mirrorEl, layerConfig);
                syncedMaskIds.add(mirrorId);
            }
        }
    }
}

/**
 * Injects native SVG <animate>/<animateTransform> elements based on the
 * resolved animation config.
 */
export function processSvg(svgContent: string, resolvedConfig: ResolvedConfig): string {
    const doc = new DOMParser().parseFromString(svgContent, 'image/svg+xml');
    const svg = doc.documentElement!;

    const animatedIds = new Set(Object.keys(resolvedConfig.layers));
    const syncedMaskIds = new Set<string>();

    for (const [layerId, layerConfig] of Object.entries(resolvedConfig.layers)) {
        const element = findById(doc, layerId);
        if (!element) {
            continue;
        }

        // Skip if an ancestor has the IDENTICAL animation config (prevents
        // double-animation for parent+child with same config like Alert+Exclamation).
        if (hasDuplicateAncestorConfig(element, layerConfig, resolvedConfig.layers)) {
            continue;
        }

        // If this group contains children with DIFFERENT animation configs,
        // apply the group's animation to non-animated children only (not the
        // group itself), so the child's animation isn't stacked on top of the parent's.
        if (element.tagName?.toLowerCase() === 'g') {
            const childIdsInGroup: string[] = [];
            collectIds(element, childIdsInGroup);
            const hasChildWithDifferentConfig = childIdsInGroup.some(id => {
                const childConfig = resolvedConfig.layers[id];
                return childConfig && JSON.stringify(childConfig) !== JSON.stringify(layerConfig);
            });

            if (hasChildWithDifferentConfig) {
                for (const child of Array.from(element.childNodes as any[])) {
                    if (child.nodeType !== 1) {
                        continue;
                    }
                    const childId = child.getAttribute?.('id') ?? '';
                    const childHasOwnConfig = childId && resolvedConfig.layers[childId]
                        && JSON.stringify(resolvedConfig.layers[childId]) !== JSON.stringify(layerConfig);
                    if (!childHasOwnConfig) {
                        applyLayerConfig(doc, child, layerConfig);
                        // Track descendants to prevent double-animation by mask sync.
                        // Without this, named mirror masks (e.g. "Cloud Mask_2") inside
                        // child-distributed groups get re-animated by syncMasksForLayer.
                        const descendantIds: string[] = [];
                        collectIds(child, descendantIds);
                        for (const id of descendantIds) {
                            syncedMaskIds.add(id);
                        }
                    }
                }
                syncMasksForLayer(doc, element, layerId, layerConfig, animatedIds, syncedMaskIds);
                continue;
            }
        }

        applyLayerConfig(doc, element, layerConfig);
        syncMasksForLayer(doc, element, layerId, layerConfig, animatedIds, syncedMaskIds);
    }

    // Use viewBox instead of fixed width/height.
    const width = svg.getAttribute('width');
    const height = svg.getAttribute('height');
    if (width && height && !svg.getAttribute('viewBox')) {
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
    svg.removeAttribute('width');
    svg.removeAttribute('height');

    return new XMLSerializer().serializeToString(doc);
}

/**
 * Replaces hardcoded `black` fills/strokes with `currentColor` for monochrome icons.
 * Skips elements inside `<defs>`, `<mask>`, and `<clipPath>` to preserve SVG mask semantics.
 */
export function applyMonochromeColors(svgString: string): string {
    const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
    const skip = new Set(['defs', 'mask', 'clipPath']);

    function isInsideSkipped(el: any): boolean {
        let node = el.parentNode;
        while (node) {
            if (skip.has(node.tagName)) {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    }

    const all = doc.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (isInsideSkipped(el)) {
            continue;
        }
        if (el.getAttribute('fill') === 'black') {
            el.setAttribute('fill', 'currentColor');
        }
        if (el.getAttribute('stroke') === 'black') {
            el.setAttribute('stroke', 'currentColor');
        }
    }

    return new XMLSerializer().serializeToString(doc);
}
