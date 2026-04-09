/**
 * Parses SVG color values to a Lottie RGBA tuple (values in 0-1 range).
 * Gradient references are resolved to their first stop color.
 */
export function parseSvgColor(
    value: string | null | undefined,
    gradientStops: Record<string, string>,
    opacity: number = 1
): [number, number, number, number] {
    if (!value || value === 'none') {
        return [0, 0, 0, 0];
    }

    if (value.startsWith('url(#')) {
        const id = value.slice(5, -1);
        const stop = gradientStops[id];
        const color = stop ? parseSvgColor(stop, {}) : [0.5, 0.5, 0.5, 1] as [number, number, number, number];
        color[3] *= opacity;
        return color;
    }

    if (value.startsWith('#')) {
        const color = hexToLottieColor(value);
        color[3] *= opacity;
        return color;
    }

    // rgb() / rgba()
    const rgbMatch = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/);
    if (rgbMatch) {
        return [
            parseFloat(rgbMatch[1]) / 255,
            parseFloat(rgbMatch[2]) / 255,
            parseFloat(rgbMatch[3]) / 255,
            (rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1) * opacity
        ];
    }

    // CSS named colors
    const named: Record<string, string> = {
        white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000',
        blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500', purple: '#800080',
        gray: '#808080', grey: '#808080', silver: '#c0c0c0', maroon: '#800000',
        navy: '#000080', teal: '#008080', aqua: '#00ffff', lime: '#00ff00',
        fuchsia: '#ff00ff', olive: '#808000', transparent: '#00000000'
    };
    const hex = named[value.toLowerCase()];
    if (hex) {
        const color = hexToLottieColor(hex);
        color[3] *= opacity;
        return color;
    }

    return [0, 0, 0, opacity];
}

export function hexToLottieColor(hex: string): [number, number, number, number] {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 || clean.length === 4
        ? clean.split('').map(c => c + c).join('')
        : clean;

    return [
        parseInt(full.slice(0, 2), 16) / 255,
        parseInt(full.slice(2, 4), 16) / 255,
        parseInt(full.slice(4, 6), 16) / 255,
        full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1
    ];
}
