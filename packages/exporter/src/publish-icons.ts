/**
 * Copies exported icons to the @meteocons/svg and @meteocons/lottie packages.
 *
 * Per icon the animated SVG is chosen if it exists, otherwise the static one.
 * File names are simplified: no .animated/.static/.lottie suffix.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { readManifest } from './cache';

const PACKAGES_DIR = join(import.meta.dir, '..', '..');
const OUTPUT_DIR = join(import.meta.dir, '..', 'output');
const SVG_PKG = join(PACKAGES_DIR, 'svg');
const SVG_STATIC_PKG = join(PACKAGES_DIR, 'svg-static');
const LOTTIE_PKG = join(PACKAGES_DIR, 'lottie');

const STYLES = ['fill', 'flat', 'line', 'monochrome'] as const;

interface ManifestIcon {
    slug: string;
    name: string;
    animated: boolean;
}

interface ManifestCategory {
    name: string;
    slug: string;
    icons: (ManifestIcon | null)[];
}

interface PackageManifest {
    styles: readonly string[];
    categories: ManifestCategory[];
}

function toSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

interface CategoryDefinition {
    name: string;
    icons: (string | null)[];
}

const CATEGORIES_FILE = join(import.meta.dir, '..', 'categories.json');

export interface PublishResult {
    svgCount: number;
    svgStaticCount: number;
    lottieCount: number;
}

export function publishIcons(): PublishResult {
    const categoryMapping = loadCategoryMapping();

    // --- 1. Clean previous output ---

    for (const style of STYLES) {
        const svgStyleDir = join(SVG_PKG, style);
        const svgStaticStyleDir = join(SVG_STATIC_PKG, style);
        const lottieStyleDir = join(LOTTIE_PKG, style);

        if (existsSync(svgStyleDir)) {
            rmSync(svgStyleDir, {recursive: true});
        }
        if (existsSync(svgStaticStyleDir)) {
            rmSync(svgStaticStyleDir, {recursive: true});
        }
        if (existsSync(lottieStyleDir)) {
            rmSync(lottieStyleDir, {recursive: true});
        }
    }

    // --- 2. Copy icons ---

    const manifest = readManifest();
    const categoryMap = new Map<string, Map<string, ManifestIcon>>();

    let svgCount = 0;
    let svgStaticCount = 0;
    let lottieCount = 0;

    for (const style of STYLES) {
        const svgSourceDir = join(OUTPUT_DIR, style, 'svg');
        const lottieSourceDir = join(OUTPUT_DIR, style, 'lottie');
        const svgTargetDir = join(SVG_PKG, style);
        const lottieTargetDir = join(LOTTIE_PKG, style);

        if (!existsSync(svgSourceDir)) {
            continue;
        }

        const svgStaticTargetDir = join(SVG_STATIC_PKG, style);

        mkdirSync(svgTargetDir, {recursive: true});
        mkdirSync(svgStaticTargetDir, {recursive: true});
        mkdirSync(lottieTargetDir, {recursive: true});

        const svgFiles = readdirSync(svgSourceDir).filter(f => f.endsWith('.svg'));

        // Group by slug: collect animated and static versions
        const slugMap = new Map<string, { animated?: string; static?: string }>();
        for (const file of svgFiles) {
            const slug = file.replace('.animated.svg', '').replace('.static.svg', '');
            if (!slugMap.has(slug)) {
                slugMap.set(slug, {});
            }
            const entry = slugMap.get(slug)!;
            if (file.includes('.animated.')) {
                entry.animated = file;
            } else {
                entry.static = file;
            }
        }

        // Copy best version per slug
        for (const [slug, versions] of slugMap) {
            const bestSvg = versions.animated ?? versions.static;
            if (bestSvg) {
                cpSync(join(svgSourceDir, bestSvg), join(svgTargetDir, `${slug}.svg`));
                svgCount++;
            }

            // Static SVG: always prefer .static.svg
            const staticSvg = versions.static ?? versions.animated;
            if (staticSvg) {
                cpSync(join(svgSourceDir, staticSvg), join(svgStaticTargetDir, `${slug}.svg`));
                svgStaticCount++;
            }

            // Lottie: always {slug}.lottie.json in the source
            const lottieSource = join(lottieSourceDir, `${slug}.lottie.json`);
            if (existsSync(lottieSource)) {
                cpSync(lottieSource, join(lottieTargetDir, `${slug}.json`));
                lottieCount++;
            }
        }
    }

    // --- 3. Generate manifests ---

    for (const frame of manifest.frames) {
        const figmaCategory = frame.pageName.includes(' / ')
            ? frame.pageName.split(' / ').slice(1).join(' / ')
            : frame.pageName;

        const slug = toSlug(frame.frameName);
        const category = categoryMapping.get(slug) ?? figmaCategory;
        const style = frame.subfolder;
        const animatedSvg = join(OUTPUT_DIR, style, 'svg', `${slug}.animated.svg`);

        if (!categoryMap.has(category)) {
            categoryMap.set(category, new Map());
        }

        const icons = categoryMap.get(category)!;
        if (!icons.has(slug)) {
            icons.set(slug, {
                slug,
                name: frame.frameName,
                animated: false
            });
        }

        if (existsSync(animatedSvg)) {
            icons.get(slug)!.animated = true;
        }
    }

    // Order: categories from categories.json first (in file order),
    // then any categories that only come from Figma.
    const categoryOrder: string[] = [];
    const categoryDefinitions = new Map<string, (string | null)[]>();

    if (existsSync(CATEGORIES_FILE)) {
        const definitions: CategoryDefinition[] = JSON.parse(readFileSync(CATEGORIES_FILE, 'utf-8'));
        for (const def of definitions) {
            if (!categoryOrder.includes(def.name)) {
                categoryOrder.push(def.name);
                categoryDefinitions.set(def.name, def.icons);
            }
        }
    }

    for (const name of categoryMap.keys()) {
        if (!categoryOrder.includes(name)) {
            categoryOrder.push(name);
        }
    }

    /**
     * Builds the icons array for a category, including null separators from categories.json.
     * Icons present in categoryMap but not in categories.json are appended at the end.
     */
    function buildCategoryIcons(categoryName: string): (ManifestIcon | null)[] {
        const available = categoryMap.get(categoryName)!;
        const definition = categoryDefinitions.get(categoryName);

        if (!definition) {
            // Category not in categories.json — sort alphabetically
            return [...available.values()].sort((a, b) => a.slug.localeCompare(b.slug));
        }

        const result: (ManifestIcon | null)[] = [];
        const placed = new Set<string>();

        for (const entry of definition) {
            if (entry === null) {
                result.push(null);
            } else if (available.has(entry)) {
                result.push(available.get(entry)!);
                placed.add(entry);
            }
        }

        // Append any icons not listed in categories.json
        for (const [slug, icon] of available) {
            if (!placed.has(slug)) {
                result.push(icon);
            }
        }

        return result;
    }

    const packageManifest: PackageManifest = {
        styles: STYLES,
        categories: categoryOrder
            .filter(name => categoryMap.has(name) && categoryMap.get(name)!.size > 0)
            .map(name => ({
                name,
                slug: toSlug(name),
                icons: buildCategoryIcons(name)
            }))
    };

    const manifestJson = JSON.stringify(packageManifest, null, 2);
    writeFileSync(join(SVG_PKG, 'manifest.json'), manifestJson, 'utf-8');
    writeFileSync(join(LOTTIE_PKG, 'manifest.json'), manifestJson, 'utf-8');

    // Static manifest: identical structure but all icons marked as non-animated
    const staticManifest: PackageManifest = {
        styles: STYLES,
        categories: packageManifest.categories.map(cat => ({
            ...cat,
            icons: cat.icons.map(icon => icon === null ? null : {...icon, animated: false})
        }))
    };
    writeFileSync(join(SVG_STATIC_PKG, 'manifest.json'), JSON.stringify(staticManifest, null, 2), 'utf-8');

    return {svgCount, svgStaticCount, lottieCount};
}

function loadCategoryMapping(): Map<string, string> {
    const mapping = new Map<string, string>();

    if (!existsSync(CATEGORIES_FILE)) {
        return mapping;
    }

    const categories: CategoryDefinition[] = JSON.parse(readFileSync(CATEGORIES_FILE, 'utf-8'));

    for (const category of categories) {
        for (const icon of category.icons) {
            if (icon === null) {
                continue;
            }
            mapping.set(icon, category.name);
        }
    }

    return mapping;
}

// --- CLI entry point ---
if (import.meta.main) {
    const result = publishIcons();

    console.log(`✓ ${result.svgCount} SVGs → packages/svg/`);
    console.log(`✓ ${result.svgStaticCount} static SVGs → packages/svg-static/`);
    console.log(`✓ ${result.lottieCount} Lotties → packages/lottie/`);
    console.log(`✓ Manifests generated in all packages`);
}
