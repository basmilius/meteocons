/**
 * Loads animation configs from animations/ and resolves them for a given
 * icon frame.
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ANIM_DIR = join(import.meta.dir, '..', '..', '..', 'animations');
const PARTIALS_DIR = join(ANIM_DIR, 'partials');
const CONFIGS_DIR = join(ANIM_DIR, 'configs');

export interface AnimationDef {
    transform?: string;
    property?: string;
    from?: number;
    to?: number;
    values?: number[];
    keyTimes?: number[];
    origin?: string;
    duration?: string;
    easing?: string;
    delay?: number;
    dashArray?: number;
    /** Override for the static SVG snapshot value. Only used for transform animations. */
    staticValue?: number;
}

export interface LayerConfig {
    // Shorthand: single animation directly on the layer
    transform?: string;
    property?: string;
    from?: number;
    to?: number;
    values?: number[];
    keyTimes?: number[];
    origin?: string;
    duration?: string;
    easing?: string;
    delay?: number;
    dashArray?: number;
    /** Override for the static SVG snapshot value. Only used for transform animations. */
    staticValue?: number;
    // Compound: multiple animations
    animations?: AnimationDef[];
    // Special flags
    expandMask?: boolean;
    syncMask?: boolean;
}

export interface ConfigFile {
    targets?: string[];
    includes?: string[];
    static?: boolean;
    layers?: Record<string, LayerConfig>;
    overrides?: Record<string, { static?: boolean; layers?: Record<string, LayerConfig> }>;
    /** Per-target duration override — replaces duration on ALL layers for that target. */
    durationByTarget?: Record<string, string>;
    /**
     * Variant suffixes → additional includes.
     * Each key is a single-word suffix (e.g. "rain", "day").
     * Compound suffixes like "day-rain" are resolved by splitting on '-'
     * and merging each variant's includes with the base includes.
     */
    variants?: Record<string, string[]>;
}

export interface ResolvedConfig {
    static: boolean;
    layers: Record<string, LayerConfig>;
}

let partialCache: Map<string, ConfigFile> | null = null;
let configLookup: Map<string, ConfigFile> | null = null;
let variantConfigs: ConfigFile[] = [];

function loadPartials(): Map<string, ConfigFile> {
    if (partialCache) {
        return partialCache;
    }
    partialCache = new Map();
    try {
        for (const file of readdirSync(PARTIALS_DIR)) {
            if (!file.endsWith('.json')) {
                continue;
            }
            const name = file.replace('.json', '');
            const content = JSON.parse(readFileSync(join(PARTIALS_DIR, file), 'utf-8'));
            partialCache.set(name, content);
        }
    } catch {
        // No partials directory
    }
    return partialCache;
}

function loadConfigs(): Map<string, ConfigFile> {
    if (configLookup) {
        return configLookup;
    }
    configLookup = new Map();
    variantConfigs = [];
    try {
        for (const file of readdirSync(CONFIGS_DIR)) {
            if (!file.endsWith('.json')) {
                continue;
            }
            const config: ConfigFile = JSON.parse(readFileSync(join(CONFIGS_DIR, file), 'utf-8'));
            // Index by each target
            for (const target of config.targets ?? []) {
                configLookup.set(target, config);
            }
            if (config.variants) {
                variantConfigs.push(config);
            }
        }
    } catch {
        // No configs directory
    }
    return configLookup;
}

/** Finds the config for a given frameName, supporting variants and wildcards. */
export function findConfig(frameName: string): ConfigFile | null {
    const configs = loadConfigs();

    // Exact match first
    if (configs.has(frameName)) {
        return configs.get(frameName)!;
    }

    // Variant match: split suffix into known variant keys and merge their includes
    for (const config of variantConfigs) {
        for (const baseTarget of config.targets ?? []) {
            if (!frameName.startsWith(baseTarget + '-')) {
                continue;
            }
            const suffix = frameName.slice(baseTarget.length + 1);
            const parts = suffix.split('-');
            const extraIncludes: string[] = [];
            let allMatch = true;
            for (const part of parts) {
                const variantIncludes = config.variants![part];
                if (variantIncludes) {
                    extraIncludes.push(...variantIncludes);
                } else {
                    allMatch = false;
                    break;
                }
            }
            if (allMatch) {
                return {
                    ...config,
                    includes: [...(config.includes ?? []), ...extraIncludes],
                    variants: undefined,
                };
            }
        }
    }

    // Wildcard match: check all targets with *
    for (const [target, config] of configs) {
        if (target.includes('*')) {
            const pattern = new RegExp(`^${target.replace(/\*/g, '.*')}$`);
            if (pattern.test(frameName)) {
                return config;
            }
        }
    }

    return null;
}

/** Resolves a config with includes and style overrides into a flat layer map. */
export function resolveConfig(config: ConfigFile, style?: string, frameName?: string): ResolvedConfig {
    if (config.static) {
        return {static: true, layers: {}};
    }

    const layers: Record<string, LayerConfig> = {};
    const partials = loadPartials();

    // 1. Merge includes (in order)
    for (const includeName of config.includes ?? []) {
        const partial = partials.get(includeName);
        if (partial?.layers) {
            Object.assign(layers, structuredClone(partial.layers));
        }
    }

    // 2. Merge own layers (override partials)
    if (config.layers) {
        Object.assign(layers, structuredClone(config.layers));
    }

    // 3. Apply style-specific overrides
    if (style && config.overrides?.[style]) {
        const styleOverride = config.overrides[style];
        if (styleOverride.static) {
            return {static: true, layers: {}};
        }
        if (styleOverride.layers) {
            Object.assign(layers, structuredClone(styleOverride.layers));
        }
    }

    // 4. Apply per-target duration override
    if (frameName && config.durationByTarget?.[frameName]) {
        const dur = config.durationByTarget[frameName];
        for (const layerConfig of Object.values(layers)) {
            if (layerConfig.duration) {
                layerConfig.duration = dur;
            }
            if (layerConfig.animations) {
                for (const anim of layerConfig.animations) {
                    if (anim.duration) {
                        anim.duration = dur;
                    }
                }
            }
        }
    }

    return {static: Object.keys(layers).length === 0, layers};
}

/** Clears the cache (useful for tests or re-loading after config changes). */
export function clearConfigCache(): void {
    partialCache = null;
    configLookup = null;
    variantConfigs = [];
}
