/**
 * Kopieert iconen vanuit @meteocons/svg en @meteocons/lottie naar public/icons/
 * en genereert een gecombineerd manifest.
 *
 * In dev-modus (--dev) worden symlinks gebruikt i.p.v. kopieën.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';

const require = createRequire(import.meta.url);
const SVG_ROOT = join(require.resolve('@meteocons/svg/manifest.json'), '..');
const LOTTIE_ROOT = join(require.resolve('@meteocons/lottie/manifest.json'), '..');
const PUBLIC_ICONS = join(import.meta.dirname, '..', 'public', 'icons');

const STYLES = ['fill', 'flat', 'line', 'monochrome'] as const;
const isDev = process.argv.includes('--dev');

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
    styles: string[];
    categories: ManifestCategory[];
}

interface PreviewIcon {
    slug: string;
    name: string;
    animated: boolean;
    hasLottie: boolean;
}

interface PreviewManifest {
    styles: readonly string[];
    categories: {
        name: string;
        slug: string;
        icons: PreviewIcon[];
    }[];
}

// --- 1. Kopieer/symlink icon-bestanden ---

if (existsSync(PUBLIC_ICONS)) {
    rmSync(PUBLIC_ICONS, {recursive: true});
}
mkdirSync(PUBLIC_ICONS, {recursive: true});

for (const style of STYLES) {
    // SVG
    const svgSource = join(SVG_ROOT, style);
    const svgTarget = join(PUBLIC_ICONS, style, 'svg');
    if (existsSync(svgSource)) {
        if (isDev) {
            mkdirSync(join(PUBLIC_ICONS, style), {recursive: true});
            symlinkSync(svgSource, svgTarget);
        } else {
            cpSync(svgSource, svgTarget, {recursive: true});
        }
    }

    // Lottie
    const lottieSource = join(LOTTIE_ROOT, style);
    const lottieTarget = join(PUBLIC_ICONS, style, 'lottie');
    if (existsSync(lottieSource)) {
        if (isDev) {
            mkdirSync(join(PUBLIC_ICONS, style), {recursive: true});
            symlinkSync(lottieSource, lottieTarget);
        } else {
            cpSync(lottieSource, lottieTarget, {recursive: true});
        }
    }
}

// --- 2. Genereer gecombineerd manifest ---

const svgManifest: PackageManifest = JSON.parse(
    readFileSync(join(SVG_ROOT, 'manifest.json'), 'utf-8')
);

const previewManifest: PreviewManifest = {
    styles: STYLES,
    categories: svgManifest.categories.map(cat => ({
        name: cat.name,
        slug: cat.slug,
        icons: cat.icons.map(icon => ({
            slug: icon.slug,
            name: icon.name,
            animated: icon.animated,
            hasLottie: true
        }))
    }))
};

writeFileSync(
    join(PUBLIC_ICONS, 'manifest.json'),
    JSON.stringify(previewManifest, null, 2),
    'utf-8'
);

const totalIcons = previewManifest.categories.reduce((sum, cat) => sum + cat.icons.length, 0);
const animatedCount = previewManifest.categories.reduce(
    (sum, cat) => sum + cat.icons.filter(i => i.animated).length,
    0
);

console.log(`✓ Icons ${isDev ? 'gelinkt' : 'gekopieerd'} naar public/icons/`);
console.log(`✓ Manifest gegenereerd: ${totalIcons} iconen (${animatedCount} geanimeerd)`);
