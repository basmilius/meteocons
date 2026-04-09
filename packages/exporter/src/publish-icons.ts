/**
 * Kopieert geëxporteerde iconen naar de @meteocons/svg en @meteocons/lottie packages.
 *
 * Per icoon wordt de animated SVG gekozen als die bestaat, anders de statische.
 * Bestandsnamen worden vereenvoudigd: geen .animated/.static/.lottie suffix.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { readManifest } from './cache';

const PACKAGES_DIR = join(import.meta.dir, '..', '..');
const OUTPUT_DIR = join(import.meta.dir, '..', 'output');
const SVG_PKG = join(PACKAGES_DIR, 'svg');
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
    icons: ManifestIcon[];
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
    icons: string[];
}

const CATEGORIES_FILE = join(import.meta.dir, '..', 'categories.json');

function loadCategoryMapping(): Map<string, string> {
    const mapping = new Map<string, string>();

    if (!existsSync(CATEGORIES_FILE)) {
        return mapping;
    }

    const categories: CategoryDefinition[] = JSON.parse(readFileSync(CATEGORIES_FILE, 'utf-8'));

    for (const category of categories) {
        for (const icon of category.icons) {
            mapping.set(icon, category.name);
        }
    }

    return mapping;
}

const categoryMapping = loadCategoryMapping();

function loadIconOrder(): Map<string, number> {
    const order = new Map<string, number>();

    if (!existsSync(CATEGORIES_FILE)) {
        return order;
    }

    const categories: CategoryDefinition[] = JSON.parse(readFileSync(CATEGORIES_FILE, 'utf-8'));
    let index = 0;

    for (const category of categories) {
        for (const icon of category.icons) {
            order.set(icon, index++);
        }
    }

    return order;
}

const iconOrder = loadIconOrder();

// --- 1. Opruimen vorige output ---

for (const style of STYLES) {
    const svgStyleDir = join(SVG_PKG, style);
    const lottieStyleDir = join(LOTTIE_PKG, style);

    if (existsSync(svgStyleDir)) {
        rmSync(svgStyleDir, {recursive: true});
    }
    if (existsSync(lottieStyleDir)) {
        rmSync(lottieStyleDir, {recursive: true});
    }
}

// --- 2. Kopieer iconen ---

const manifest = readManifest();
const categoryMap = new Map<string, Map<string, ManifestIcon>>();

let svgCount = 0;
let lottieCount = 0;

for (const style of STYLES) {
    const svgSourceDir = join(OUTPUT_DIR, style, 'svg');
    const lottieSourceDir = join(OUTPUT_DIR, style, 'lottie');
    const svgTargetDir = join(SVG_PKG, style);
    const lottieTargetDir = join(LOTTIE_PKG, style);

    if (!existsSync(svgSourceDir)) {
        continue;
    }

    mkdirSync(svgTargetDir, {recursive: true});
    mkdirSync(lottieTargetDir, {recursive: true});

    const svgFiles = readdirSync(svgSourceDir).filter(f => f.endsWith('.svg'));

    // Groepeer op slug: verzamel animated en static versies
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

    // Kopieer beste versie per slug
    for (const [slug, versions] of slugMap) {
        const bestSvg = versions.animated ?? versions.static;
        if (bestSvg) {
            cpSync(join(svgSourceDir, bestSvg), join(svgTargetDir, `${slug}.svg`));
            svgCount++;
        }

        // Lottie: altijd {slug}.lottie.json in de source
        const lottieSource = join(lottieSourceDir, `${slug}.lottie.json`);
        if (existsSync(lottieSource)) {
            cpSync(lottieSource, join(lottieTargetDir, `${slug}.json`));
            lottieCount++;
        }
    }
}

// --- 3. Genereer manifesten ---

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

// Volgorde: eerst categorieën uit categories.json (in bestandsvolgorde),
// daarna eventuele categorieën die alleen vanuit Figma komen.
const categoryOrder: string[] = [];

if (existsSync(CATEGORIES_FILE)) {
    const definitions: CategoryDefinition[] = JSON.parse(readFileSync(CATEGORIES_FILE, 'utf-8'));
    for (const def of definitions) {
        if (!categoryOrder.includes(def.name)) {
            categoryOrder.push(def.name);
        }
    }
}

for (const name of categoryMap.keys()) {
    if (!categoryOrder.includes(name)) {
        categoryOrder.push(name);
    }
}

const packageManifest: PackageManifest = {
    styles: STYLES,
    categories: categoryOrder
        .filter(name => categoryMap.has(name) && categoryMap.get(name)!.size > 0)
        .map(name => ({
            name,
            slug: toSlug(name),
            icons: [...categoryMap.get(name)!.values()].sort((a, b) => {
                const orderA = iconOrder.get(a.slug) ?? Infinity;
                const orderB = iconOrder.get(b.slug) ?? Infinity;
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                return a.slug.localeCompare(b.slug);
            })
        }))
};

const manifestJson = JSON.stringify(packageManifest, null, 2);
writeFileSync(join(SVG_PKG, 'manifest.json'), manifestJson, 'utf-8');
writeFileSync(join(LOTTIE_PKG, 'manifest.json'), manifestJson, 'utf-8');

console.log(`✓ ${svgCount} SVGs → packages/svg/`);
console.log(`✓ ${lottieCount} Lotties → packages/lottie/`);
console.log(`✓ Manifest gegenereerd in beide packages`);
