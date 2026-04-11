import { readManifest, readSvg } from './cache';
import { DOMParser } from '@xmldom/xmldom';
import type { LayerConfig } from './config-loader';
import { findConfig, resolveConfig } from './config-loader';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');

const manifest = readManifest();
console.log(`Validating ${manifest.frames.length} frames from cache...\n`);

interface LayerInfo {
    id: string;
    normalizedId: string;
    isComponentInstance: boolean;
    parentComponent: string | null;
    foundIn: string[];
}

interface FrameValidation {
    frameName: string;
    subfolder: string;
    hasConfig: boolean;
    isStatic: boolean;
    resolvedLayers: Record<string, LayerConfig>;
    svgLayers: CollectedLayer[];
}

const layerMap = new Map<string, LayerInfo>();
const frameValidations: FrameValidation[] = [];
let totalFrames = 0;
let framesWithIssues = 0;

for (const frame of manifest.frames) {
    const svgContent = readSvg(frame.nodeId);
    if (!svgContent) {
        continue;
    }

    totalFrames++;
    const doc = new DOMParser().parseFromString(svgContent, 'image/svg+xml');
    const layers = collectLayers(doc.documentElement);

    const config = findConfig(frame.frameName);
    const resolved = config ? resolveConfig(config, frame.subfolder, frame.frameName) : null;

    frameValidations.push({
        frameName: frame.frameName,
        subfolder: frame.subfolder,
        hasConfig: config !== null,
        isStatic: resolved?.static ?? false,
        resolvedLayers: resolved?.layers ?? {},
        svgLayers: layers
    });

    for (const layer of layers) {
        const key = `${layer.normalizedId}::${layer.parentComponent ?? ''}`;
        const existing = layerMap.get(key);
        if (existing) {
            existing.foundIn.push(frame.frameName);
        } else {
            layerMap.set(key, {
                ...layer,
                foundIn: [frame.frameName]
            });
        }
    }
}

// Pre-compute all configured layer names across all configs for stagger matching
const allConfiguredLayerNames = new Set<string>();
for (const fv of frameValidations) {
    for (const layerName of Object.keys(fv.resolvedLayers)) {
        allConfiguredLayerNames.add(layerName);
    }
}

const issues: { severity: 'warn' | 'error'; message: string; layers: string[]; count: number }[] = [];

for (const [, layer] of layerMap) {
    const {normalizedId, parentComponent, foundIn} = layer;

    if (/^\d+$/.test(normalizedId)) {
        issues.push({
            severity: 'error',
            message: `Numeric ID "${normalizedId}" — rename in Figma to e.g. "Segment ${normalizedId}"`,
            layers: [normalizedId],
            count: foundIn.length
        });
    }

    if (/^Vector(_\d+)?$/.test(normalizedId)) {
        issues.push({
            severity: 'warn',
            message: `Generic name "${normalizedId}" in ${parentComponent ?? 'root'} — give it a semantic name`,
            layers: [normalizedId],
            count: foundIn.length
        });
    }

    if (/_\d+$/.test(normalizedId) && !/^Vector/.test(normalizedId)) {
        issues.push({
            severity: 'warn',
            message: `Figma duplicate suffix "${normalizedId}" — rename to "${normalizedId.replace(/_(\d+)$/, ' $1')}"`,
            layers: [normalizedId],
            count: foundIn.length
        });
    }
}

interface ComponentCoverage {
    componentName: string;
    totalChildren: Set<string>;
    matchedChildren: Set<string>;
    unmatchedChildren: Set<string>;
    iconCount: number;
}

const componentCoverage = new Map<string, ComponentCoverage>();

// Per-frame coverage: check each layer against the resolved config for its frame
for (const fv of frameValidations) {
    if (!fv.hasConfig || fv.isStatic) {
        continue;
    }

    for (const layer of fv.svgLayers) {
        if (!layer.parentComponent) {
            continue;
        }

        if (!componentCoverage.has(layer.parentComponent)) {
            componentCoverage.set(layer.parentComponent, {
                componentName: layer.parentComponent,
                totalChildren: new Set(),
                matchedChildren: new Set(),
                unmatchedChildren: new Set(),
                iconCount: 0
            });
        }

        const coverage = componentCoverage.get(layer.parentComponent)!;
        coverage.totalChildren.add(layer.normalizedId);

        if (isMatched(layer.normalizedId, fv.resolvedLayers)) {
            coverage.matchedChildren.add(layer.normalizedId);
        } else {
            coverage.unmatchedChildren.add(layer.normalizedId);
        }
    }
}

// Track component instances without any config
for (const [, layer] of layerMap) {
    if (!layer.isComponentInstance) {
        continue;
    }
    if (!componentCoverage.has(layer.normalizedId)) {
        componentCoverage.set(layer.normalizedId, {
            componentName: layer.normalizedId,
            totalChildren: new Set(),
            matchedChildren: new Set(),
            unmatchedChildren: new Set(),
            iconCount: layer.foundIn.length
        });
    }
}

const potentialStaggers: { baseName: string; maxN: number; parentComponent: string | null }[] = [];
const staggerCandidates = new Map<string, { maxN: number; parentComponent: string | null }>();

for (const [, layer] of layerMap) {
    const match = layer.normalizedId.match(/^(.+?)\s(\d+)$/);
    if (!match) {
        continue;
    }

    const [, baseName, num] = match;
    const key = `${baseName}::${layer.parentComponent ?? ''}`;
    const existing = staggerCandidates.get(key);
    const n = parseInt(num, 10);

    if (existing) {
        existing.maxN = Math.max(existing.maxN, n);
    } else {
        staggerCandidates.set(key, {maxN: n, parentComponent: layer.parentComponent});
    }
}

for (const [key, info] of staggerCandidates) {
    const baseName = key.split('::')[0];
    if (info.maxN >= 2 && !isStaggerMatched(baseName)) {
        potentialStaggers.push({baseName, ...info});
    }
}

if (issues.length > 0) {
    const dedupedIssues = deduplicateIssues(issues);
    console.log(`── Layer name issues (${dedupedIssues.length}) ─────────────────────────\n`);
    for (const issue of dedupedIssues) {
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        console.log(`  ${icon}  ${issue.message} (${issue.count} icon${issue.count > 1 ? 's' : ''})`);
    }
    console.log('');
    framesWithIssues = dedupedIssues.length;
}

console.log(`── Component coverage ─────────────────────────────────\n`);
const sortedComponents = [...componentCoverage.entries()].sort(([a], [b]) => a.localeCompare(b));

for (const [, coverage] of sortedComponents) {
    const total = coverage.totalChildren.size;
    const matched = coverage.matchedChildren.size;
    const hasSelf = allConfiguredLayerNames.has(coverage.componentName);
    const pct = total > 0 ? Math.round((matched / total) * 100) : (hasSelf ? 100 : 0);
    const icon = pct === 100 ? '✅' : pct > 0 ? '🟡' : '🔴';

    console.log(`  ${icon}  ${coverage.componentName}: ${matched}/${total} children matched (${pct}%)${hasSelf ? ' + self' : ''}`);

    if (verbose && coverage.unmatchedChildren.size > 0) {
        console.log(`       Unmatched: ${[...coverage.unmatchedChildren].join(', ')}`);
    }
}
console.log('');

if (potentialStaggers.length > 0) {
    console.log(`── Suggested stagger patterns ─────────────────────────\n`);
    for (const suggestion of potentialStaggers) {
        const parent = suggestion.parentComponent ? ` (in ${suggestion.parentComponent})` : '';
        console.log(`  💡  "${suggestion.baseName} 1..${suggestion.maxN}" — add stagger entries to config${parent}`);
    }
    console.log('');
}

// Frames without config
const noConfigFrames = frameValidations.filter(fv => !fv.hasConfig);
if (noConfigFrames.length > 0) {
    console.log(`── No config (${noConfigFrames.length}) ──────────────────────────────\n`);
    console.log(`  ${noConfigFrames.map(fv => fv.frameName).sort().join('\n  ')}\n`);
}

console.log(`── Summary ───────────────────────────────────────\n`);
console.log(`  Frames validated:    ${totalFrames}`);
console.log(`  Unique layer names:  ${layerMap.size}`);
console.log(`  Naming issues:       ${framesWithIssues}`);
console.log(`  Component types:     ${componentCoverage.size}`);
const fullyCovered = [...componentCoverage.values()].filter(c => {
    const hasSelf = allConfiguredLayerNames.has(c.componentName);
    return c.unmatchedChildren.size === 0 && (hasSelf || c.matchedChildren.size > 0);
}).length;
console.log(`  Fully covered:       ${fullyCovered}/${componentCoverage.size}`);
console.log(`  Frames with config:  ${frameValidations.filter(fv => fv.hasConfig).length}/${totalFrames}`);
console.log('');

function normalizeId(id: string): string {
    if (id.startsWith('\u25B6 ')) {
        return id.slice(2);
    }
    if (id.startsWith('\u00E2\u0096\u00B6 ')) {
        return id.slice(4);
    }
    return id;
}

function isInstancePrefix(id: string): boolean {
    return id.startsWith('\u25B6 ') || id.startsWith('\u00E2\u0096\u00B6 ');
}

interface CollectedLayer {
    id: string;
    normalizedId: string;
    isComponentInstance: boolean;
    parentComponent: string | null;
}

function collectLayers(svgRoot: any): CollectedLayer[] {
    const layers: CollectedLayer[] = [];
    const ignoredPattern = /^(clip|paint|mask)\d/;

    function traverse(node: any, parentComponent: string | null): void {
        if (node.nodeType !== 1) {
            return;
        }
        const id: string | null = node.getAttribute?.('id') ?? null;
        let currentParent = parentComponent;

        if (id && !ignoredPattern.test(id)) {
            const normalizedId = normalizeId(id);
            const isComponent = isInstancePrefix(id);

            layers.push({id, normalizedId, isComponentInstance: isComponent, parentComponent});

            if (isComponent) {
                currentParent = normalizedId;
            }
        }

        for (const child of Array.from(node.childNodes as any[])) {
            traverse(child, currentParent);
        }
    }

    const svgChildren = Array.from(svgRoot.childNodes as any[]).filter(
        (n: any) => n.nodeType === 1 && n.tagName?.toLowerCase() !== 'defs'
    );

    for (const topGroup of svgChildren) {
        for (const child of Array.from(topGroup.childNodes as any[])) {
            traverse(child, null);
        }
    }

    return layers;
}

function isMatched(normalizedId: string, resolvedLayers: Record<string, LayerConfig>): boolean {
    return normalizedId in resolvedLayers;
}

function isStaggerMatched(baseName: string): boolean {
    return allConfiguredLayerNames.has(`${baseName} 1`);
}

function deduplicateIssues(items: typeof issues): typeof issues {
    const seen = new Set<string>();
    return items.filter(issue => {
        if (seen.has(issue.message)) {
            return false;
        }
        seen.add(issue.message);
        return true;
    });
}
