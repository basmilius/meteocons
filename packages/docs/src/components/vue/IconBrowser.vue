<script setup lang="ts">
    import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
    import lottie from 'lottie-web';
    import type { AnimationItem } from 'lottie-web';
    import { iconSvgUrl, iconLottieUrl, CDN_BASE, cdnVersion } from '../../lib/icons';

    type Style = 'fill' | 'flat' | 'line' | 'monochrome';

    interface IconEntry {
        slug: string;
        name: string;
        animated: boolean;
    }

    interface Category {
        name: string;
        slug: string;
        icons: (IconEntry | null)[];
    }

    interface Manifest {
        styles: string[];
        categories: Category[];
    }

    const STYLES: Style[] = ['fill', 'flat', 'line', 'monochrome'];

    const manifest = ref<Manifest | null>(null);
    const loading = ref(true);
    const query = ref('');
    const currentStyle = ref<Style>('fill');
    const activeCategory = ref('');
    const activeCategoryFilter = ref<string | null>(null);

    // Mobile filter drawer
    const mobileFilterOpen = ref(false);
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

    function toggleMobileFilter(): void {
        mobileFilterOpen.value = !mobileFilterOpen.value;
    }

    function selectCategoryMobile(slug: string | null): void {
        activeCategoryFilter.value = slug;
        mobileFilterOpen.value = false;
        updateUrl();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    watch(mobileFilterOpen, (open) => {
        document.body.style.overflow = open ? 'hidden' : '';
    });

    // Detail popup
    const selectedIcon = ref<IconEntry | null>(null);
    const detailStyle = ref<Style>('fill');
    const copiedAction = ref('');
    const previewMode = ref<'svg' | 'lottie'>('svg');
    const lottieContainer = ref<HTMLElement | null>(null);
    let lottieAnimation: AnimationItem | null = null;

    const allCategories = computed(() => manifest.value?.categories ?? []);

    const sortedCategories = computed(() =>
        allCategories.value.toSorted((a, b) => a.name.localeCompare(b.name))
    );

    const totalIconCount = computed(() =>
        allCategories.value.reduce((sum, cat) => sum + cat.icons.filter(Boolean).length, 0)
    );

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

    /**
     * Splits an icons array into groups on null separators.
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
                .find(i => i.slug === iconParam);

            if (icon) {
                selectedIcon.value = icon;
                detailStyle.value = currentStyle.value;
                return;
            }
        }

        selectedIcon.value = null;
    }

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

    function destroyLottie(): void {
        if (lottieAnimation) {
            lottieAnimation.destroy();
            lottieAnimation = null;
        }
    }

    async function loadLottie(): Promise<void> {
        destroyLottie();
        await nextTick();

        if (!selectedIcon.value || previewMode.value !== 'lottie' || !lottieContainer.value) {
            return;
        }

        const url = lottieUrl(selectedIcon.value.slug, detailStyle.value);

        try {
            lottieAnimation = lottie.loadAnimation({
                container: lottieContainer.value,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                path: url,
            });
        } catch {
            // Lottie file might not exist for static icons
        }
    }

    watch([previewMode, detailStyle], () => {
        if (previewMode.value === 'lottie') {
            loadLottie();
        } else {
            destroyLottie();
        }
    });

    watch(selectedIcon, (icon) => {
        if (!icon) {
            destroyLottie();
            previewMode.value = 'svg';
        }
    });

    function downloadFile(url: string, filename: string): void {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function selectCategory(slug: string | null): void {
        activeCategoryFilter.value = slug;
        window.scrollTo({top: 0});
    }

    watch([currentStyle, activeCategoryFilter], () => {
        history.replaceState(null, '', buildUrl());
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
        }

        window.addEventListener('popstate', onPopState);
    });

    onUnmounted(() => {
        window.removeEventListener('popstate', onPopState);
    });
</script>

<template>
    <div class="browser">
        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="sidebar-header">
                <h1>Icons</h1>
                <span class="total">{{ totalCount }}</span>
            </div>

            <div class="search-wrap">
                <svg class="search-icon" viewBox="0 0 20 20" width="15" height="15" fill="none"
                     stroke="currentColor" stroke-width="2">
                    <circle cx="8.5" cy="8.5" r="5.5"/>
                    <path d="M12.5 12.5L17 17"/>
                </svg>
                <input
                    v-model="query"
                    type="text"
                    placeholder="Search icons..."
                    class="search-input"
                />
            </div>

            <div>
                <div class="nav-label">Style</div>
                <div class="style-selector">
                    <button
                        v-for="style in STYLES"
                        :key="style"
                        :class="['style-btn', {active: currentStyle === style}]"
                        @click="currentStyle = style"
                    >
                        <img :src="svgUrl('clear-day', style)" alt="" width="28" height="28"/>
                        <span>{{ style }}</span>
                    </button>
                </div>
            </div>

            <nav class="category-nav">
                <div class="nav-label">Categories</div>
                <button
                    :class="['nav-item', {active: activeCategoryFilter === null}]"
                    @click="selectCategory(null)"
                >
                    <span>All</span>
                    <span class="nav-count">{{ totalIconCount }}</span>
                </button>
                <button
                    v-for="cat in sortedCategories"
                    :key="cat.slug"
                    :class="['nav-item', {active: activeCategoryFilter === cat.slug}]"
                    @click="selectCategory(cat.slug)"
                >
                    <span>{{ cat.name }}</span>
                    <span class="nav-count">{{ cat.icons.filter(Boolean).length }}</span>
                </button>
            </nav>
        </aside>

        <!-- Mobile filter bar -->
        <div class="mobile-filter-bar">
            <div class="mobile-search-wrap">
                <svg class="mobile-search-icon" viewBox="0 0 20 20" width="14" height="14" fill="none"
                     stroke="currentColor" stroke-width="2">
                    <circle cx="8.5" cy="8.5" r="5.5"/>
                    <path d="M12.5 12.5L17 17"/>
                </svg>
                <input
                    v-model="query"
                    type="text"
                    placeholder="Search..."
                    class="mobile-search-input"
                />
            </div>
            <button class="mobile-filter-btn" @click="toggleMobileFilter">
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 4h16M5 10h10M8 16h4"/>
                </svg>
                <span v-if="activeFilterCount" class="mobile-filter-badge">{{ activeFilterCount }}</span>
            </button>
            <span class="mobile-filter-count">{{ totalCount }}</span>
        </div>

        <!-- Mobile filter drawer -->
        <Transition name="drawer">
            <div v-if="mobileFilterOpen" class="mobile-drawer-backdrop" @click.self="mobileFilterOpen = false">
                <div class="mobile-drawer">
                    <div class="mobile-drawer-header">
                        <h3>Filters</h3>
                        <button class="mobile-drawer-close" @click="mobileFilterOpen = false" aria-label="Close">
                            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor"
                                 stroke-width="2" stroke-linecap="round">
                                <path d="M5 5l10 10M15 5L5 15"/>
                            </svg>
                        </button>
                    </div>
                    <div class="mobile-drawer-body">
                        <div class="mobile-drawer-section">
                            <div class="mobile-drawer-label">Style</div>
                            <div class="mobile-drawer-styles">
                                <button
                                    v-for="style in STYLES"
                                    :key="style"
                                    :class="['mobile-style-btn', { active: currentStyle === style }]"
                                    @click="currentStyle = style"
                                >
                                    <img :src="svgUrl('clear-day', style)" alt="" width="28" height="28"/>
                                    <span>{{ style }}</span>
                                </button>
                            </div>
                        </div>
                        <div class="mobile-drawer-divider"/>
                        <div class="mobile-drawer-section">
                            <div class="mobile-drawer-label">Category</div>
                            <div class="mobile-drawer-list">
                                <button
                                    :class="['mobile-drawer-item', { active: activeCategoryFilter === null }]"
                                    @click="selectCategoryMobile(null)"
                                >
                                    <span>All</span>
                                    <span class="mobile-drawer-count">{{ totalIconCount }}</span>
                                </button>
                                <button
                                    v-for="cat in sortedCategories"
                                    :key="cat.slug"
                                    :class="['mobile-drawer-item', { active: activeCategoryFilter === cat.slug }]"
                                    @click="selectCategoryMobile(cat.slug)"
                                >
                                    <span>{{ cat.name }}</span>
                                    <span class="mobile-drawer-count">{{ cat.icons.filter(Boolean).length }}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- Main grid -->
        <main class="main">
            <div v-if="loading" class="state">
                <div class="spinner"/>
            </div>
            <div v-else-if="filteredCategories.length === 0" class="state">
                No icons match "{{ query }}"
            </div>

            <template v-else>
                <section
                    v-for="category in filteredCategories"
                    :key="category.slug"
                    :id="`cat-${category.slug}`"
                    class="category"
                >
                    <h2 class="category-title">{{ category.name }}</h2>
                    <div
                        v-for="(group, gi) in splitGroups(category.icons)"
                        :key="gi"
                        class="icon-grid"
                        :class="{ 'icon-grid--spaced': gi > 0 }"
                    >
                        <button
                            v-for="icon in group"
                            :key="icon.slug"
                            class="icon-cell"
                            @click="openDetail(icon)"
                        >
                            <img
                                :src="svgUrl(icon.slug)"
                                :alt="icon.name"
                                width="96"
                                height="96"
                                loading="lazy"
                            />
                            <span class="icon-label">{{ formatName(icon.slug) }}</span>
                        </button>
                    </div>
                </section>
            </template>
        </main>

        <!-- Detail popup -->
        <Transition name="overlay">
            <div v-if="selectedIcon" class="overlay" @click.self="closeDetail">
                <Transition name="panel" appear>
                    <div class="detail" v-if="selectedIcon">
                        <button class="detail-close" @click="closeDetail" aria-label="Close">
                            <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor"
                                 stroke-width="2" stroke-linecap="round">
                                <path d="M5 5l10 10M15 5L5 15"/>
                            </svg>
                        </button>

                        <div class="detail-preview">
                            <div class="preview-toggle">
                                <button
                                    :class="['toggle-btn', { active: previewMode === 'svg' }]"
                                    @click="previewMode = 'svg'"
                                >
                                    SVG
                                </button>
                                <button
                                    :class="['toggle-btn', { active: previewMode === 'lottie' }]"
                                    @click="previewMode = 'lottie'"
                                >
                                    Lottie
                                </button>
                            </div>

                            <img
                                v-if="previewMode === 'svg'"
                                :src="svgUrl(selectedIcon.slug, detailStyle)"
                                :alt="selectedIcon.name"
                                width="160"
                                height="160"
                                :key="`${selectedIcon.slug}-${detailStyle}`"
                            />
                            <div
                                v-else
                                ref="lottieContainer"
                                class="lottie-player"
                                :key="`lottie-${selectedIcon.slug}-${detailStyle}`"
                            />
                        </div>

                        <div class="detail-info">
                            <h3 class="detail-name">{{ formatName(selectedIcon.slug) }}</h3>

                            <div class="detail-styles">
                                <button
                                    v-for="style in STYLES"
                                    :key="style"
                                    :class="['detail-style-btn', {active: detailStyle === style}]"
                                    @click="detailStyle = style"
                                >
                                    <img :src="svgUrl(selectedIcon.slug, style)" alt="" width="36" height="36"/>
                                    <span>{{ style }}</span>
                                </button>
                            </div>

                            <div class="detail-actions">
                                <button class="action-btn" @click="copySvgCode">
                                    <svg v-if="copiedAction !== 'svg'" viewBox="0 0 20 20" width="16" height="16" fill="none"
                                         stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                         stroke-linejoin="round">
                                        <path d="M7 8l-4 4 4 4M13 8l4 4-4 4"/>
                                    </svg>
                                    <svg v-else viewBox="0 0 20 20" width="16" height="16" fill="none"
                                         stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                                         stroke-linejoin="round">
                                        <path d="M4 10l4 4 8-8"/>
                                    </svg>
                                    {{ copiedAction === 'svg' ? 'Copied!' : 'Copy SVG' }}
                                </button>
                                <button class="action-btn" @click="copyText(selectedIcon.slug, 'name')">
                                    <svg v-if="copiedAction !== 'name'" viewBox="0 0 20 20" width="16" height="16" fill="none"
                                         stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                         stroke-linejoin="round">
                                        <rect x="6" y="6" width="11" height="11" rx="2"/>
                                        <path d="M3 14V4a1 1 0 011-1h10"/>
                                    </svg>
                                    <svg v-else viewBox="0 0 20 20" width="16" height="16" fill="none"
                                         stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                                         stroke-linejoin="round">
                                        <path d="M4 10l4 4 8-8"/>
                                    </svg>
                                    {{ copiedAction === 'name' ? 'Copied!' : 'Copy name' }}
                                </button>
                            </div>
                            <div class="detail-actions">
                                <button class="action-btn" @click="downloadFile(svgUrl(selectedIcon.slug, detailStyle), `${selectedIcon.slug}.svg`)">
                                    <svg viewBox="0 0 20 20" width="16" height="16" fill="none"
                                         stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                         stroke-linejoin="round">
                                        <path d="M10 3v10M6 9l4 4 4-4M3 17h14"/>
                                    </svg>
                                    Download SVG
                                </button>
                                <button class="action-btn" @click="downloadFile(lottieUrl(selectedIcon.slug, detailStyle), `${selectedIcon.slug}.json`)">
                                    <svg viewBox="0 0 20 20" width="16" height="16" fill="none"
                                         stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                         stroke-linejoin="round">
                                        <path d="M10 3v10M6 9l4 4 4-4M3 17h14"/>
                                    </svg>
                                    Download Lottie
                                </button>
                            </div>

                            <div class="detail-cdn">
                                <div class="cdn-label">CDN</div>
                                <div class="cdn-url-row">
                                    <code class="cdn-url">{{ cdnSvgUrl(selectedIcon.slug, detailStyle) }}</code>
                                    <button
                                        class="cdn-copy-btn"
                                        @click="copyText(cdnSvgUrl(selectedIcon.slug, detailStyle), 'cdn-svg')"
                                        :aria-label="copiedAction === 'cdn-svg' ? 'Copied' : 'Copy SVG URL'"
                                    >
                                        <svg v-if="copiedAction !== 'cdn-svg'" viewBox="0 0 20 20" width="14" height="14" fill="none"
                                             stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                             stroke-linejoin="round">
                                            <rect x="6" y="6" width="11" height="11" rx="2"/>
                                            <path d="M3 14V4a1 1 0 011-1h10"/>
                                        </svg>
                                        <svg v-else viewBox="0 0 20 20" width="14" height="14" fill="none"
                                             stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                                             stroke-linejoin="round">
                                            <path d="M4 10l4 4 8-8"/>
                                        </svg>
                                    </button>
                                </div>
                                <div class="cdn-url-row">
                                    <code class="cdn-url">{{ cdnLottieUrl(selectedIcon.slug, detailStyle) }}</code>
                                    <button
                                        class="cdn-copy-btn"
                                        @click="copyText(cdnLottieUrl(selectedIcon.slug, detailStyle), 'cdn-lottie')"
                                        :aria-label="copiedAction === 'cdn-lottie' ? 'Copied' : 'Copy Lottie URL'"
                                    >
                                        <svg v-if="copiedAction !== 'cdn-lottie'" viewBox="0 0 20 20" width="14" height="14" fill="none"
                                             stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                             stroke-linejoin="round">
                                            <rect x="6" y="6" width="11" height="11" rx="2"/>
                                            <path d="M3 14V4a1 1 0 011-1h10"/>
                                        </svg>
                                        <svg v-else viewBox="0 0 20 20" width="14" height="14" fill="none"
                                             stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                                             stroke-linejoin="round">
                                            <path d="M4 10l4 4 8-8"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
    .browser {
        display: grid;
        grid-template-columns: 300px 1fr;
        min-height: 500px;
    }

    /* Sidebar */
    .sidebar {
        position: sticky;
        top: var(--nav-height, 64px);
        height: calc(100vh - var(--nav-height, 64px));
        overflow-y: auto;
        padding: 32px 24px 32px 28px;
        border-right: 1px solid var(--border, rgba(0, 0, 0, 0.06));
        display: flex;
        flex-direction: column;
        gap: 24px;
        scrollbar-width: thin;
        scrollbar-color: var(--bg-raised, #e8ebf0) transparent;
    }

    .sidebar-header {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .sidebar-header h1 {
        font-family: var(--font-display, system-ui);
        font-size: 1.6rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--text, #111827);
    }

    .total {
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--amber, #e5850a);
        background: rgba(229, 133, 10, 0.1);
        padding: 3px 11px;
        border-radius: 100px;
    }

    .search-wrap {
        position: relative;
    }

    .search-icon {
        position: absolute;
        left: 13px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted, #9ca3af);
        pointer-events: none;
    }

    .search-input {
        width: 100%;
        padding: 11px 14px 11px 38px;
        border: 2px solid var(--border, rgba(0, 0, 0, 0.06));
        border-radius: var(--radius-md, 14px);
        font-family: inherit;
        font-size: 0.875rem;
        font-weight: 500;
        outline: none;
        background: var(--bg, #ffffff);
        color: var(--text, #111827);
        transition: all 0.2s;
    }

    .search-input::placeholder {
        color: var(--text-faint, #d1d5db);
    }

    .search-input:focus {
        border-color: var(--amber, #e5850a);
        box-shadow: 0 0 0 3px rgba(229, 133, 10, 0.1);
    }

    .style-selector {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
    }

    .style-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 12px 4px 10px;
        border: 1.5px solid var(--border, rgba(0, 0, 0, 0.06));
        border-radius: var(--radius-md, 14px);
        background: var(--bg-soft, #f8f9fb);
        font-family: inherit;
        font-size: 0.7rem;
        font-weight: 600;
        color: var(--text-muted, #9ca3af);
        cursor: pointer;
        text-transform: capitalize;
        transition: all 0.15s;
    }

    .style-btn img {
        pointer-events: none;
        transition: all 0.15s;
    }

    .style-btn:hover {
        border-color: var(--border-light, rgba(0, 0, 0, 0.1));
        color: var(--text-secondary, #4b5563);
        background: var(--bg-surface, #f1f3f6);
    }

    .style-btn.active {
        border-color: var(--amber, #e5850a);
        background: rgba(229, 133, 10, 0.08);
        color: var(--amber, #e5850a);
    }

    .category-nav {
        display: flex;
        flex-direction: column;
        gap: 1px;
        flex: 1;
    }

    .nav-label {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--text-muted, #9ca3af);
        padding: 0 10px;
        margin-bottom: 6px;
    }

    .nav-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 7px 10px;
        border: none;
        border-radius: 10px;
        background: transparent;
        font-family: inherit;
        font-size: 0.85rem;
        color: var(--text-secondary, #4b5563);
        cursor: pointer;
        transition: all 0.15s;
        width: 100%;
        text-align: left;
    }

    .nav-item:hover {
        background: var(--bg-surface, #f1f3f6);
        color: var(--text, #111827);
    }

    .nav-item.active {
        color: var(--amber, #e5850a);
        font-weight: 600;
        background: rgba(229, 133, 10, 0.06);
    }

    .nav-count {
        font-size: 0.75rem;
        color: var(--text-muted, #9ca3af);
        font-variant-numeric: tabular-nums;
    }

    /* Main */
    .main {
        padding: 32px 28px 32px 32px;
    }

    .state {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        color: var(--text-muted, #9ca3af);
    }

    .spinner {
        width: 28px;
        height: 28px;
        border: 2px solid var(--border, rgba(0, 0, 0, 0.06));
        border-top-color: var(--amber, #e5850a);
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .category {
        margin-bottom: 48px;
    }

    .category:last-child {
        margin-bottom: 0;
    }

    .category-title {
        font-family: var(--font-display, system-ui);
        font-size: 1.2rem;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--text, #111827);
        margin: 0 -28px 0 -32px;
        padding: 0 28px 0 32px;
        position: sticky;
        top: var(--nav-height, 64px);
        background: var(--bg, #ffffff);
        height: var(--nav-height, 64px);
        display: flex;
        align-items: center;
        border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.06));
        z-index: 10;
    }

    .icon-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 4px;
        padding-top: 8px;
    }

    .icon-grid--spaced {
        margin-top: 24px;
    }

    .icon-cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 18px 6px 12px;
        border: 1px solid transparent;
        border-radius: 16px;
        background: transparent;
        font-family: inherit;
        cursor: pointer;
        transition: all 0.2s ease;
        color: inherit;
    }

    .icon-cell:hover img {
        transform: scale(1.12);
    }

    .icon-cell:active img {
        transform: scale(1.0);
    }

    .icon-cell img {
        pointer-events: none;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .icon-label {
        font-size: 10px;
        color: var(--text-muted, #9ca3af);
        text-align: center;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1;
        transition: color 0.15s;
    }

    .icon-cell:hover .icon-label {
        color: var(--text-secondary, #4b5563);
    }

    /* Overlay */
    .overlay {
        position: fixed;
        inset: 0;
        z-index: 500;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
    }

    .overlay-enter-active {
        transition: all 0.2s ease-out;
    }

    .overlay-leave-active {
        transition: all 0.15s ease-in;
    }

    .overlay-enter-from,
    .overlay-leave-to {
        opacity: 0;
    }

    /* Detail panel */
    .detail {
        position: relative;
        background: var(--bg-soft, #f8f9fb);
        border: 1px solid var(--border-light, rgba(0, 0, 0, 0.1));
        border-radius: var(--radius-xl, 28px);
        box-shadow: 0 32px 100px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.04);
        max-width: 480px;
        width: 100%;
        overflow: hidden;
    }

    .panel-enter-active {
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .panel-leave-active {
        transition: all 0.15s ease-in;
    }

    .panel-enter-from {
        opacity: 0;
        transform: scale(0.95) translateY(10px);
    }

    .panel-leave-to {
        opacity: 0;
        transform: scale(0.98);
    }

    .detail-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.06);
        color: var(--text-muted, #9ca3af);
        cursor: pointer;
        transition: all 0.15s;
        z-index: 10;
    }

    .detail-close:hover {
        background: rgba(0, 0, 0, 0.1);
        color: var(--text, #111827);
    }

    .detail-preview {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        padding: 52px 32px 36px;
        background: var(--bg, #ffffff);
        border-bottom: 2px solid var(--border, rgba(0, 0, 0, 0.06));
    }

    .preview-toggle {
        position: absolute;
        top: 16px;
        left: 16px;
        display: flex;
        gap: 2px;
        background: var(--bg-surface, #f1f3f6);
        border-radius: 10px;
        padding: 3px;
    }

    .toggle-btn {
        padding: 5px 12px;
        border: none;
        border-radius: 8px;
        background: transparent;
        font-family: inherit;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-muted, #9ca3af);
        cursor: pointer;
        transition: all 0.15s;
    }

    .toggle-btn:hover {
        color: var(--text-secondary, #4b5563);
    }

    .toggle-btn.active {
        background: var(--bg, #ffffff);
        color: var(--text, #111827);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .lottie-player {
        width: 160px;
        height: 160px;
    }

    .detail-info {
        padding: 24px 28px 28px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .detail-name {
        font-family: var(--font-display, system-ui);
        font-size: 1.3rem;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--text, #111827);
    }

    .detail-styles {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
    }

    .detail-style-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 12px 8px 10px;
        border: 1px solid var(--border, rgba(0, 0, 0, 0.06));
        border-radius: 14px;
        background: var(--bg-surface, #f1f3f6);
        font-family: inherit;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-muted, #9ca3af);
        cursor: pointer;
        text-transform: capitalize;
        transition: all 0.15s;
    }

    .detail-style-btn:hover {
        border-color: var(--border-light, rgba(0, 0, 0, 0.1));
        color: var(--text-secondary, #4b5563);
        background: var(--bg-raised, #e8ebf0);
    }

    .detail-style-btn.active {
        border-color: var(--amber, #e5850a);
        background: rgba(229, 133, 10, 0.1);
        color: var(--amber, #e5850a);
    }

    .detail-actions {
        display: flex;
        gap: 8px;
    }

    .action-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 11px 14px;
        border: 1px solid var(--border, rgba(0, 0, 0, 0.06));
        border-radius: 12px;
        background: var(--bg-surface, #f1f3f6);
        font-family: inherit;
        font-size: 0.825rem;
        font-weight: 600;
        color: var(--text-secondary, #4b5563);
        cursor: pointer;
        transition: all 0.15s;
    }

    .action-btn:hover {
        border-color: var(--amber, #e5850a);
        background: rgba(229, 133, 10, 0.06);
        color: var(--amber, #e5850a);
    }

    /* CDN URLs */
    .detail-cdn {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-top: 16px;
        border-top: 1px solid var(--border, rgba(0, 0, 0, 0.06));
    }

    .cdn-label {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--text-muted, #9ca3af);
    }

    .cdn-url-row {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .cdn-url {
        flex: 1;
        font-size: 0.75rem;
        padding: 8px 12px;
        background: var(--bg-surface, #f1f3f6);
        border: 1px solid var(--border, rgba(0, 0, 0, 0.06));
        border-radius: 8px;
        color: var(--text-secondary, #4b5563);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .cdn-copy-btn {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: 1px solid var(--border, rgba(0, 0, 0, 0.06));
        border-radius: 8px;
        background: var(--bg-surface, #f1f3f6);
        color: var(--text-muted, #9ca3af);
        cursor: pointer;
        transition: all 0.15s;
    }

    .cdn-copy-btn:hover {
        border-color: var(--amber, #e5850a);
        color: var(--amber, #e5850a);
        background: rgba(229, 133, 10, 0.06);
    }

    /* Mobile filter bar - hidden on desktop */
    .mobile-filter-bar {
        display: none;
    }

    /* Drawer transitions */
    .drawer-enter-active {
        transition: opacity 0.2s ease-out;
    }

    .drawer-enter-active .mobile-drawer {
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .drawer-leave-active {
        transition: opacity 0.15s ease-in;
    }

    .drawer-leave-active .mobile-drawer {
        transition: transform 0.2s ease-in;
    }

    .drawer-enter-from,
    .drawer-leave-to {
        opacity: 0;
    }

    .drawer-enter-from .mobile-drawer,
    .drawer-leave-to .mobile-drawer {
        transform: translateY(100%);
    }

    /* Responsive */
    @media (max-width: 768px) {
        .browser {
            grid-template-columns: 1fr;
        }

        .sidebar {
            display: none;
        }

        .main {
            padding: 16px 20px;
        }

        .category-title {
            top: calc(var(--nav-height, 64px) + 60px);
            margin: 0 -20px;
            padding: 0 20px;
        }

        .icon-grid {
            grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
            gap: 2px;
        }

        .icon-cell {
            padding: 12px 4px 10px;
        }

        .icon-cell img {
            width: 64px;
            height: 64px;
        }

        .icon-label {
            font-size: 9px;
        }

        .detail {
            max-width: 100%;
            border-radius: 20px;
        }

        /* Mobile filter bar */
        .mobile-filter-bar {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 20px;
            background: var(--bg, #ffffff);
            border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.06));
            position: sticky;
            top: var(--nav-height, 64px);
            z-index: 20;
        }

        .mobile-search-wrap {
            position: relative;
            flex: 1;
            min-width: 0;
        }

        .mobile-search-icon {
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted, #9ca3af);
            pointer-events: none;
        }

        .mobile-search-input {
            width: 100%;
            height: 40px;
            padding: 0 12px 0 32px;
            border: 1.5px solid var(--border, rgba(0, 0, 0, 0.06));
            border-radius: var(--radius-sm, 10px);
            font-family: inherit;
            font-size: 0.85rem;
            font-weight: 500;
            outline: none;
            background: var(--bg-soft, #f8f9fb);
            color: var(--text, #111827);
            transition: all 0.2s;
        }

        .mobile-search-input::placeholder {
            color: var(--text-faint, #d1d5db);
        }

        .mobile-search-input:focus {
            border-color: var(--amber, #e5850a);
            box-shadow: 0 0 0 3px rgba(229, 133, 10, 0.1);
            background: var(--bg, #ffffff);
        }

        .mobile-filter-btn {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            width: 40px;
            height: 40px;
            border: 1.5px solid var(--border, rgba(0, 0, 0, 0.06));
            border-radius: var(--radius-sm, 10px);
            background: var(--bg-soft, #f8f9fb);
            color: var(--text-secondary, #4b5563);
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .mobile-filter-btn:active {
            transform: scale(0.93);
        }

        .mobile-filter-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            min-width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 5px;
            border-radius: 100px;
            background: var(--amber, #e5850a);
            color: white;
            font-size: 0.65rem;
            font-weight: 700;
            line-height: 1;
        }

        .mobile-filter-count {
            flex-shrink: 0;
            font-size: 0.78rem;
            font-weight: 600;
            color: var(--amber, #e5850a);
            background: rgba(229, 133, 10, 0.1);
            padding: 3px 11px;
            border-radius: 100px;
        }

        /* Mobile drawer */
        .mobile-drawer-backdrop {
            position: fixed;
            inset: 0;
            z-index: 400;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: flex-end;
        }

        .mobile-drawer {
            width: 100%;
            max-height: 70vh;
            background: var(--bg, #ffffff);
            border-radius: var(--radius-xl, 28px) var(--radius-xl, 28px) 0 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        .mobile-drawer-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px 12px;
            flex-shrink: 0;
        }

        .mobile-drawer-header h3 {
            font-family: var(--font-display, system-ui);
            font-size: 1.1rem;
            font-weight: 700;
            color: var(--text, #111827);
        }

        .mobile-drawer-close {
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: 50%;
            background: var(--bg-surface, #f1f3f6);
            color: var(--text-muted, #9ca3af);
            cursor: pointer;
            transition: all 0.15s;
        }

        .mobile-drawer-close:hover {
            background: var(--bg-raised, #e8ebf0);
            color: var(--text, #111827);
        }

        .mobile-drawer-body {
            overflow-y: auto;
            padding: 0 20px 24px;
            -webkit-overflow-scrolling: touch;
        }

        .mobile-drawer-section {
            padding-top: 4px;
        }

        .mobile-drawer-label {
            font-size: 0.7rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: var(--text-muted, #9ca3af);
            padding: 0 4px;
            margin-bottom: 10px;
        }

        .mobile-drawer-styles {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
        }

        .mobile-style-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            padding: 12px 4px 10px;
            border: 1.5px solid var(--border, rgba(0, 0, 0, 0.06));
            border-radius: var(--radius-md, 14px);
            background: var(--bg-soft, #f8f9fb);
            font-family: inherit;
            font-size: 0.7rem;
            font-weight: 600;
            color: var(--text-muted, #9ca3af);
            cursor: pointer;
            text-transform: capitalize;
            transition: all 0.15s;
        }

        .mobile-style-btn:active {
            transform: scale(0.95);
        }

        .mobile-style-btn.active {
            border-color: var(--amber, #e5850a);
            background: rgba(229, 133, 10, 0.08);
            color: var(--amber, #e5850a);
        }

        .mobile-drawer-divider {
            height: 1px;
            background: var(--border, rgba(0, 0, 0, 0.06));
            margin: 16px 0;
        }

        .mobile-drawer-list {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .mobile-drawer-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 14px;
            border: none;
            border-radius: var(--radius-sm, 10px);
            background: transparent;
            font-family: inherit;
            font-size: 0.9rem;
            font-weight: 500;
            color: var(--text-secondary, #4b5563);
            cursor: pointer;
            transition: all 0.15s;
            width: 100%;
            text-align: left;
        }

        .mobile-drawer-item:active {
            background: var(--bg-surface, #f1f3f6);
        }

        .mobile-drawer-item.active {
            color: var(--amber, #e5850a);
            font-weight: 600;
            background: rgba(229, 133, 10, 0.06);
        }

        .mobile-drawer-count {
            font-size: 0.78rem;
            color: var(--text-muted, #9ca3af);
            font-variant-numeric: tabular-nums;
        }
    }
</style>
