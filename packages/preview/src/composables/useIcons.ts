import { computed, ref, type Ref } from 'vue';
import type { Category, DisplayMode, PreviewManifest } from '../types';

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
            error.value = `Kan manifest niet laden: ${err.message}`;
            loading.value = false;
        });

    return fetchPromise;
}

export function useIcons(searchQuery: Ref<string>, displayMode: Ref<DisplayMode>) {
    fetchManifest();

    const categories = computed(() => manifest.value?.categories ?? []);

    const filteredCategories = computed<Category[]>(() => {
        const query = searchQuery.value.toLowerCase().trim();
        const isLottie = displayMode.value === 'lottie';

        return categories.value
            .map((category) => {
                const filteredIcons = category.icons.filter((icon) => {
                    if (isLottie && !icon.hasLottie) {
                        return false;
                    }
                    if (query && !icon.slug.includes(query) && !icon.name.toLowerCase().includes(query)) {
                        return false;
                    }
                    return true;
                });

                return {...category, icons: filteredIcons};
            })
            .filter((category) => category.icons.length > 0);
    });

    const totalCount = computed(() =>
        filteredCategories.value.reduce((sum, cat) => sum + cat.icons.length, 0)
    );

    return {
        categories,
        filteredCategories,
        totalCount,
        loading,
        error
    };
}
