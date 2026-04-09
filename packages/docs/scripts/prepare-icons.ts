/**
 * Kopieert een selectie iconen vanuit @meteocons/svg naar public/icons/
 * voor gebruik in de documentatie website.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';

const require = createRequire(import.meta.url);

let svgManifestPath: string;
let lottieManifestPath: string;

try {
    svgManifestPath = require.resolve('@meteocons/svg/manifest.json');
    lottieManifestPath = require.resolve('@meteocons/lottie/manifest.json');
} catch {
    console.log('⚠ Geen icon manifests gevonden, prepare-icons overgeslagen');
    process.exit(0);
}

const SVG_ROOT = join(svgManifestPath, '..');
const LOTTIE_ROOT = join(lottieManifestPath, '..');
const PUBLIC_ICONS = join(import.meta.dirname, '..', 'public', 'icons');

const STYLES = ['fill', 'flat', 'line', 'monochrome'] as const;

if (existsSync(PUBLIC_ICONS)) {
    rmSync(PUBLIC_ICONS, {recursive: true});
}

for (const style of STYLES) {
    const svgSource = join(SVG_ROOT, style);
    const lottieSource = join(LOTTIE_ROOT, style);
    const target = join(PUBLIC_ICONS, style);

    if (existsSync(svgSource)) {
        cpSync(svgSource, target, {recursive: true});
    }

    if (existsSync(lottieSource)) {
        cpSync(lottieSource, target, {recursive: true});
    }
}

const manifest = JSON.parse(readFileSync(join(SVG_ROOT, 'manifest.json'), 'utf-8'));
mkdirSync(PUBLIC_ICONS, {recursive: true});

import { writeFileSync } from 'fs';
writeFileSync(join(PUBLIC_ICONS, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

const count = STYLES.reduce((sum, style) => {
    const dir = join(PUBLIC_ICONS, style);
    if (!existsSync(dir)) {
        return sum;
    }
    const { readdirSync } = require('fs');
    return sum + readdirSync(dir).length;
}, 0);

console.log(`✓ ${count} icons gekopieerd naar public/icons/`);
