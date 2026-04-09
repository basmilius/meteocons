import { ref } from 'vue';
import type { Style } from '../types';

const STORAGE_KEY = 'meteocons-style';
const DEFAULT_STYLE: Style = 'fill';

function loadStyle(): Style {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && ['fill', 'flat', 'line', 'monochrome'].includes(stored)) {
            return stored as Style;
        }
    } catch {
        // localStorage niet beschikbaar
    }
    return DEFAULT_STYLE;
}

const currentStyle = ref<Style>(loadStyle());

export function useStyleSwitcher() {
    function setStyle(style: Style) {
        currentStyle.value = style;
        try {
            localStorage.setItem(STORAGE_KEY, style);
        } catch {
            // localStorage niet beschikbaar
        }
    }

    function svgUrl(slug: string): string {
        return `./icons/${currentStyle.value}/svg/${slug}.svg`;
    }

    function lottieUrl(slug: string): string {
        return `./icons/${currentStyle.value}/lottie/${slug}.json`;
    }

    return {
        currentStyle,
        setStyle,
        svgUrl,
        lottieUrl
    };
}
