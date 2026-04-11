import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { CDN_BASE, cdnVersion, iconLottieUrl, iconSvgUrl } from '../../../lib/icons';

export type Style = 'fill' | 'flat' | 'line' | 'monochrome';

export interface IconEntry {
    slug: string;
    name: string;
    animated: boolean;
}

export interface Category {
    name: string;
    slug: string;
    icons: (IconEntry | null)[];
}

interface Manifest {
    styles: string[];
    categories: Category[];
}

export const STYLES: Style[] = ['fill', 'flat', 'line', 'monochrome'];

// --- Singleton module-level state ---

const manifest = ref<Manifest | null>(null);
const loading = ref(true);
const query = ref('');
const currentStyle = ref<Style>('fill');
const activeCategory = ref('');
const activeCategoryFilter = ref<string | null>(null);
const mobileFilterOpen = ref(false);

const selectedIcon = ref<IconEntry | null>(null);
const detailStyle = ref<Style>('fill');
const copiedAction = ref('');
const previewMode = ref<'svg' | 'lottie'>('svg');

// --- Computed ---

const allCategories = computed(() => manifest.value?.categories ?? []);

const sortedCategories = computed(() =>
    allCategories.value.toSorted((a, b) => a.name.localeCompare(b.name))
);

const totalIconCount = computed(() =>
    allCategories.value.reduce((sum, cat) => sum + cat.icons.filter(Boolean).length, 0)
);

const activeFilterCount = computed(() => {
    let count = 0;
    if (currentStyle.value !== 'fill') {
        count++;
    }
    if (activeCategoryFilter.value !== null) {
        count++;
    }
    return count;
});

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

const filteredCategories = computed(() => {
    if (!manifest.value) {
        return [];
    }

    const q = query.value.toLowerCase().trim();

    return allCategories.value
        .filter(cat => !activeCategoryFilter.value || cat.slug === activeCategoryFilter.value)
        .map(cat => ({
            ...cat,
            icons: cleanSeparators(
                cat.icons.filter(icon =>
                    icon === null || !q || icon.slug.includes(q) || icon.name.toLowerCase().includes(q)
                )
            )
        }))
        .filter(cat => cat.icons.some(Boolean));
});

const totalCount = computed(() =>
    filteredCategories.value.reduce((sum, cat) => sum + cat.icons.filter(Boolean).length, 0)
);

// --- Utility functions ---

/**
 * Splits an icon array into groups on null separators.
 */
function splitGroups(icons: (IconEntry | null)[]): IconEntry[][] {
    const groups: IconEntry[][] = [];
    let current: IconEntry[] = [];

    for (const icon of icons) {
        if (icon === null) {
            if (current.length > 0) {
                groups.push(current);
                current = [];
            }
        } else {
            current.push(icon);
        }
    }

    if (current.length > 0) {
        groups.push(current);
    }

    return groups;
}

const UPPERCASE_WORDS = new Set(['ne', 'se', 'nw', 'sw']);

function formatName(slug: string): string {
    return slug.replace(/-/g, ' ').replace(/\b\w+/g, (word) =>
        UPPERCASE_WORDS.has(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)
    );
}

function svgUrl(slug: string, style?: Style): string {
    return iconSvgUrl(style ?? currentStyle.value, slug);
}

function lottieUrl(slug: string, style?: Style): string {
    return iconLottieUrl(style ?? currentStyle.value, slug);
}

function cdnSvgUrl(slug: string, style: Style): string {
    return `${CDN_BASE}/${cdnVersion()}/svg/${style}/${slug}.svg`;
}

function cdnLottieUrl(slug: string, style: Style): string {
    return `${CDN_BASE}/${cdnVersion()}/lottie/${style}/${slug}.json`;
}

// --- URL state ---

function buildUrl(): string {
    const params = new URLSearchParams(window.location.search);
    params.set('style', currentStyle.value);

    if (activeCategoryFilter.value) {
        params.set('category', activeCategoryFilter.value);
    } else {
        params.delete('category');
    }

    if (selectedIcon.value) {
        params.set('icon', selectedIcon.value.slug);
    } else {
        params.delete('icon');
    }

    return `${window.location.pathname}?${params.toString()}`;
}

function updateUrl(): void {
    history.pushState(null, '', buildUrl());
}

function onPopState(): void {
    const params = new URLSearchParams(window.location.search);
    const iconParam = params.get('icon');
    const styleParam = params.get('style');
    const categoryParam = params.get('category');

    if (styleParam && STYLES.includes(styleParam as Style)) {
        currentStyle.value = styleParam as Style;
    }

    activeCategoryFilter.value = categoryParam ?? null;

    if (iconParam && manifest.value) {
        const icon = manifest.value.categories
            .flatMap(c => c.icons)
            .filter((i): i is IconEntry => i !== null)
            .find(i => i.slug === iconParam);

        if (icon) {
            selectedIcon.value = icon;
            detailStyle.value = currentStyle.value;
            return;
        }
    }

    selectedIcon.value = null;
}

// --- Actions ---

async function copyText(text: string, action: string): Promise<void> {
    await navigator.clipboard.writeText(text);
    copiedAction.value = action;
    setTimeout(() => {
        copiedAction.value = '';
    }, 1500);
}

async function copySvgCode(): Promise<void> {
    if (!selectedIcon.value) {
        return;
    }
    const res = await fetch(svgUrl(selectedIcon.value.slug, detailStyle.value));
    const text = await res.text();
    await copyText(text, 'svg');
}

function copyDeepLink(): void {
    const url = window.location.origin + buildUrl();
    copyText(url, 'link');
}

function downloadFile(url: string, filename: string): void {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
}

function openDetail(icon: IconEntry): void {
    selectedIcon.value = icon;
    detailStyle.value = currentStyle.value;
    copiedAction.value = '';
    updateUrl();
}

function closeDetail(): void {
    selectedIcon.value = null;
    updateUrl();
}

function selectCategory(slug: string | null): void {
    activeCategoryFilter.value = slug;
    window.scrollTo({ top: 0 });
}

function selectCategoryMobile(slug: string | null): void {
    activeCategoryFilter.value = slug;
    mobileFilterOpen.value = false;
    updateUrl();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobileFilter(): void {
    mobileFilterOpen.value = !mobileFilterOpen.value;
}

// --- Composable ---

export function useIconBrowser() {
    return {
        // State
        manifest,
        loading,
        query,
        currentStyle,
        activeCategory,
        activeCategoryFilter,
        mobileFilterOpen,
        selectedIcon,
        detailStyle,
        copiedAction,
        previewMode,

        // Computed
        allCategories,
        sortedCategories,
        totalIconCount,
        activeFilterCount,
        filteredCategories,
        totalCount,

        // Constants
        STYLES,

        // Utilities
        splitGroups,
        formatName,
        svgUrl,
        lottieUrl,
        cdnSvgUrl,
        cdnLottieUrl,
        buildUrl,

        // Actions
        copyText,
        copySvgCode,
        copyDeepLink,
        downloadFile,
        openDetail,
        closeDetail,
        selectCategory,
        selectCategoryMobile,
        toggleMobileFilter,
        updateUrl,
    };
}

/**
 * Initializes the icon browser: fetches manifest, reads URL params, sets up popstate listener.
 * Call this once from the root IconBrowser component.
 */
export function useIconBrowserInit(): void {
    let initialized = false;

    watch(mobileFilterOpen, (open) => {
        document.body.style.overflow = open ? 'hidden' : '';
    });

    watch([currentStyle, activeCategoryFilter], () => {
        if (initialized) {
            history.replaceState(null, '', buildUrl());
        }
    });

    onMounted(async () => {
        const params = new URLSearchParams(window.location.search);
        const styleParam = params.get('style');
        const iconParam = params.get('icon');
        const categoryParam = params.get('category');

        if (styleParam && STYLES.includes(styleParam as Style)) {
            currentStyle.value = styleParam as Style;
        }

        if (categoryParam) {
            activeCategoryFilter.value = categoryParam;
        }

        try {
            const res = await fetch('/icons/manifest.json');
            manifest.value = await res.json();

            if (iconParam && manifest.value) {
                const icon = manifest.value.categories
                    .flatMap(c => c.icons)
                    .filter((i): i is IconEntry => i !== null)
                    .find(i => i.slug === iconParam);

                if (icon) {
                    selectedIcon.value = icon;
                    detailStyle.value = currentStyle.value;
                }
            }
        } catch (err) {
            console.error('Failed to load manifest:', err);
        } finally {
            loading.value = false;
            initialized = true;
        }

        window.addEventListener('popstate', onPopState);
    });

    onUnmounted(() => {
        window.removeEventListener('popstate', onPopState);
    });
}
