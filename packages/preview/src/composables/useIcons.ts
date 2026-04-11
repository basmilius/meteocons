import { computed, ref, type Ref } from 'vue';
import type { Category, DisplayMode, IconEntry, PreviewManifest } from '../types';

const manifest = ref<PreviewManifest | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

let fetchPromise: Promise<void> | null = null;

function fetchManifest(): Promise<void> {
    if (fetchPromise) {
        return fetchPromise;
    }

    fetchPromise = fetch('./icons/manifest.json')
        .then((res) => {
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            return res.json();
        })
        .then((data: PreviewManifest) => {
            manifest.value = data;
            loading.value = false;
        })
        .catch((err) => {
            error.value = `Failed to load manifest: ${err.message}`;
            loading.value = false;
        });

    return fetchPromise;
}

export function useIcons(searchQuery: Ref<string>, displayMode: Ref<DisplayMode>) {
    fetchManifest();

    const categories = computed(() => manifest.value?.categories ?? []);

    /**
     * Removes redundant null separators: no leading, trailing, or consecutive nulls.
     */
    function cleanSeparators(icons: (IconEntry | null)[]): (IconEntry | null)[] {
        const result: (IconEntry | null)[] = [];

        for (const item of icons) {
            if (item === null) {
                if (result.length > 0 && result[result.length - 1] !== null) {
                    result.push(null);
                }
            } else {
                result.push(item);
            }
        }

        if (result.length > 0 && result[result.length - 1] === null) {
            result.pop();
        }

        return result;
    }

    const filteredCategories = computed<Category[]>(() => {
        const query = searchQuery.value.toLowerCase().trim();
        const isLottie = displayMode.value === 'lottie';

        return categories.value
            .map((category) => {
                const filtered = category.icons.filter((icon) => {
                    if (icon === null) {
                        return true;
                    }
                    if (isLottie && !icon.hasLottie) {
                        return false;
                    }
                    if (query && !icon.slug.includes(query) && !icon.name.toLowerCase().includes(query)) {
                        return false;
                    }
                    return true;
                });

                return {...category, icons: cleanSeparators(filtered)};
            })
            .filter((category) => category.icons.some(Boolean));
    });

    const totalCount = computed(() =>
        filteredCategories.value.reduce((sum, cat) => sum + cat.icons.filter(Boolean).length, 0)
    );

    return {
        categories,
        filteredCategories,
        totalCount,
        loading,
        error
    };
}
