import { computed, ref } from 'vue';
import type { SizeMode } from '../types';
import { SIZE_CONFIG } from '../types';

const STORAGE_KEY = 'meteocons-size';
const DEFAULT_SIZE: SizeMode = 'md';

function loadSize(): SizeMode {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && stored in SIZE_CONFIG) {
            return stored as SizeMode;
        }
    } catch {
        // localStorage niet beschikbaar
    }
    return DEFAULT_SIZE;
}

const sizeMode = ref<SizeMode>(loadSize());

export function useSizeMode() {
    function setSize(mode: SizeMode) {
        sizeMode.value = mode;
        try {
            localStorage.setItem(STORAGE_KEY, mode);
        } catch {
            // localStorage niet beschikbaar
        }
    }

    const cellSize = computed(() => `${SIZE_CONFIG[sizeMode.value].cell}px`);
    const iconSize = computed(() => `${SIZE_CONFIG[sizeMode.value].icon}px`);

    return {
        sizeMode,
        setSize,
        cellSize,
        iconSize
    };
}
