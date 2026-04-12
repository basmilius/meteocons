import { optimize, type Config } from 'svgo';

/**
 * Builds the SVGO configuration for a given icon slug.
 *
 * Uses `preset-default` with conservative overrides to protect SMIL animations,
 * masks, clipPaths, wrapper `<g>` elements, and `currentColor` values.
 * All IDs are prefixed with `{slug}__` via the `prefixIds` plugin to prevent
 * conflicts when multiple icons are inlined on the same page.
 */
const createConfig = (slug: string): Config => ({
    plugins: [
        {
            name: 'preset-default',
            params: {
                overrides: {
                    // Protect scale-pivot wrapper <g> elements created by processor
                    collapseGroups: false,
                    // Preserve <circle>/<rect>/<ellipse> for computeBBox()
                    convertShapeToPath: false,
                    // Mask content may appear hidden but becomes visible via animation
                    removeHiddenElems: false,
                    // Wrapper <g> elements with only <animateTransform> children look empty
                    removeEmptyContainers: false,
                    // Don't move attributes away from animation targets
                    moveElemsAttrsToGroup: false,
                    moveGroupAttrsToElems: false,
                    // Preserve style="mask-type:alpha" (no SVG attribute equivalent)
                    inlineStyles: false,
                    // Protect fill="currentColor" and stroke="currentColor"
                    removeUselessStrokeAndFill: false,
                    // Protect essential defaults on SVG elements
                    removeUnknownsAndDefaults: false,
                    // We do custom ID prefixing via prefixIds instead
                    cleanupIds: false,
                },
            },
        },
        {
            name: 'prefixIds',
            params: {
                prefix: slug,
                delim: '__',
                prefixIds: true,
                prefixClassNames: false,
            },
        },
    ],
});

/**
 * Optimizes an SVG string with SVGO and prefixes all IDs with `{slug}__`.
 *
 * Safe for both animated (SMIL) and static SVGs. All `<animate>`,
 * `<animateTransform>`, masks, clipPaths, gradients, and `url(#...)` references
 * are preserved and consistently updated.
 *
 * @param svg - Raw SVG string
 * @param slug - Icon slug used as ID prefix (e.g. "partly-cloudy-day-rain")
 * @returns Optimized SVG string
 */
export const optimizeSvg = (svg: string, slug: string): string => {
    const result = optimize(svg, createConfig(slug));
    return result.data;
};
