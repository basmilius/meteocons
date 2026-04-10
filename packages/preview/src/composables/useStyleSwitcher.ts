import { ref } from 'vue';
import type { Style } from '../types';
import { getUrlParam, setUrlParam } from './useUrlSync';

const STORAGE_KEY = 'meteocons-style';
const VALID_STYLES = ['fill', 'flat', 'line', 'monochrome'];
const DEFAULT_STYLE: Style = 'fill';

function loadStyle(): Style {
    const urlStyle = getUrlParam('style');
    if (urlStyle && VALID_STYLES.includes(urlStyle)) {
        return urlStyle as Style;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && VALID_STYLES.includes(stored)) {
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
        setUrlParam('style', style);
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
