<script
    setup
    lang="ts">
    import { type ComponentPublicInstance, computed, onMounted, onUnmounted, ref, watch } from 'vue';
    import type { AnimationItem } from 'lottie-web';
    import lottie from 'lottie-web';
    import { iconLottieUrl, iconSvgUrl, iconStaticSvgUrl } from '../../lib/icons';

    type Style = 'fill' | 'flat' | 'line' | 'monochrome';
    type PreviewMode = 'svg' | 'static' | 'lottie';

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
    const currentStyle = ref<Style>('fill');
    const previewMode = ref<PreviewMode>('svg');
    const iconSize = ref(128);

    const categories = computed(() => manifest.value?.categories ?? []);

    const totalCount = computed(() =>
        categories.value.reduce((sum, cat) => sum + cat.icons.filter(Boolean).length, 0)
    );

    function scrollToCategory(slug: string): void {
        document.getElementById(`cat-${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function svgUrl(slug: string): string {
        return iconSvgUrl(currentStyle.value, slug);
    }

    function staticUrl(slug: string): string {
        return iconStaticSvgUrl(currentStyle.value, slug);
    }

    function lottieUrl(slug: string): string {
        return iconLottieUrl(currentStyle.value, slug);
    }

    // --- Lottie management ---

    const lottieAnimations = ref<Map<string, AnimationItem>>(new Map());

    function destroyAllLottie(): void {
        for (const anim of lottieAnimations.value.values()) {
            anim.destroy();
        }
        lottieAnimations.value.clear();
    }

    function loadLottie(slug: string, container: HTMLElement): void {
        if (lottieAnimations.value.has(slug)) {
            return;
        }

        try {
            const anim = lottie.loadAnimation({
                container,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                path: lottieUrl(slug),
            });
            lottieAnimations.value.set(slug, anim);
        } catch {
            // Lottie file might not exist for static icons
        }
    }

    function onLottieRef(el: Element | ComponentPublicInstance | null, slug: string): void {
        if (el && previewMode.value === 'lottie') {
            loadLottie(slug, el as HTMLElement);
        }
    }

    watch([previewMode, currentStyle], () => {
        destroyAllLottie();
    });

    onMounted(async () => {
        try {
            const res = await fetch('/icons/manifest.json');
            manifest.value = await res.json();
        } catch (err) {
            console.error('Failed to load manifest:', err);
        } finally {
            loading.value = false;
        }
    });

    onUnmounted(() => {
        destroyAllLottie();
    });
</script>

<template>
    <div class="qa">
        <div class="qa-toolbar">
            <div class="qa-toolbar-group">
                <div class="qa-toggle">
                    <button
                        v-for="mode in (['svg', 'static', 'lottie'] as PreviewMode[])"
                        :key="mode"
                        :class="['qa-toggle-btn', { active: previewMode === mode }]"
                        @click="previewMode = mode">
                        {{ mode === 'svg' ? 'SVG' : mode === 'static' ? 'Static' : 'Lottie' }}
                    </button>
                </div>

                <div class="qa-toggle">
                    <button
                        v-for="style in STYLES"
                        :key="style"
                        :class="['qa-toggle-btn', { active: currentStyle === style }]"
                        @click="currentStyle = style">
                        {{ style }}
                    </button>
                </div>
            </div>

            <div class="qa-toolbar-group">
                <select
                    v-if="!loading"
                    class="qa-jump"
                    @change="(e) => { scrollToCategory((e.target as HTMLSelectElement).value); (e.target as HTMLSelectElement).selectedIndex = 0; }">
                    <option value="" disabled selected>Jump to...</option>
                    <option
                        v-for="cat in categories"
                        :key="cat.slug"
                        :value="cat.slug">
                        {{ cat.name }}
                    </option>
                </select>
                <label class="qa-size-label">
                    {{ iconSize }}px
                    <input
                        type="range"
                        v-model.number="iconSize"
                        min="32"
                        max="256"
                        step="16"/>
                </label>
                <span class="qa-count" v-if="!loading">{{ totalCount }} icons</span>
            </div>
        </div>

        <div v-if="loading" class="qa-loading">Loading manifest...</div>

        <div v-else class="qa-categories">
            <section
                v-for="category in categories"
                :key="category.slug"
                :id="`cat-${category.slug}`"
                class="qa-category">
                <h2 class="qa-category-name">{{ category.name }}</h2>

                <div class="qa-grid" :style="{ '--icon-size': `${iconSize}px` }">
                    <template v-for="(icon, index) in category.icons" :key="icon?.slug ?? `sep-${index}`">
                        <div v-if="icon === null" class="qa-break"/>
                        <div v-else class="qa-icon">
                            <img
                                v-if="previewMode === 'svg'"
                                :src="svgUrl(icon.slug)"
                                :alt="icon.slug"
                                :width="iconSize"
                                :height="iconSize"
                                loading="lazy"/>
                            <img
                                v-if="previewMode === 'static'"
                                :src="staticUrl(icon.slug)"
                                :alt="icon.slug"
                                :width="iconSize"
                                :height="iconSize"
                                loading="lazy"/>
                            <div
                                v-if="previewMode === 'lottie'"
                                class="qa-lottie"
                                :style="{ width: `${iconSize}px`, height: `${iconSize}px` }"
                                :ref="(el) => onLottieRef(el, icon.slug)"
                                :key="`lottie-${icon.slug}-${currentStyle}`"/>
                            <span class="qa-icon-name">{{ icon.slug }}</span>
                            <span v-if="icon.animated" class="qa-badge">animated</span>
                        </div>
                    </template>
                </div>
            </section>
        </div>
    </div>
</template>

<style scoped>
    .qa {
        padding: 24px;
    }

    /* Toolbar */
    .qa-toolbar {
        position: sticky;
        top: var(--nav-height, 80px);
        z-index: 100;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 18px;
        margin-bottom: 24px;
        background: var(--bg-soft, #f9fafb);
        border: 2px solid var(--border, #f3f4f6);
        border-radius: var(--radius-lg, 21px);
    }

    .qa-toolbar-group {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .qa-toggle {
        display: flex;
        gap: 3px;
        background: var(--bg-surface, #f3f4f6);
        border-radius: 10px;
        padding: 3px;
    }

    .qa-toggle-btn {
        padding: 6px 12px;
        border: none;
        border-radius: 8px;
        background: transparent;
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-muted, #9ca3af);
        cursor: pointer;
        text-transform: capitalize;
        transition: all 0.15s;
    }

    .qa-toggle-btn:hover {
        color: var(--text-secondary, #4b5563);
    }

    .qa-toggle-btn.active {
        background: var(--bg, #ffffff);
        color: var(--text, #111827);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .qa-jump {
        padding: 6px 12px;
        border: 2px solid var(--border, #f3f4f6);
        border-radius: 8px;
        background: var(--bg, #ffffff);
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary, #4b5563);
        cursor: pointer;
    }

    .qa-jump:focus-visible {
        border-color: var(--amber, #f59e0b);
        outline: none;
    }

    .qa-size-label {
        display: flex;
        align-items: center;
        gap: 9px;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-muted, #9ca3af);
    }

    .qa-size-label input[type="range"] {
        width: 100px;
        accent-color: var(--amber, #f59e0b);
    }

    .qa-count {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-muted, #9ca3af);
    }

    .qa-loading {
        text-align: center;
        padding: 48px;
        color: var(--text-muted, #9ca3af);
    }

    /* Categories */
    .qa-categories {
        display: flex;
        flex-direction: column;
        gap: 36px;
    }

    .qa-category {
        scroll-margin-top: calc(var(--nav-height, 80px) + 72px);
    }

    .qa-category-name {
        font-family: var(--font-display, system-ui);
        font-size: 18px;
        font-weight: 700;
        color: var(--text, #111827);
        margin-bottom: 12px;
        padding-bottom: 9px;
        border-bottom: 2px solid var(--border, #f3f4f6);
    }

    /* Icon grid */
    .qa-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: flex-start;
    }

    .qa-break {
        flex-basis: 100%;
        height: 0;
    }

    .qa-icon {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        padding: 6px;
        width: calc(var(--icon-size, 128px) + 12px);
        border-radius: var(--radius-sm, 9px);
        transition: background 0.15s;
    }

    .qa-icon:hover {
        background: var(--bg-surface, #f3f4f6);
    }

    .qa-lottie {
        overflow: hidden;
    }

    .qa-icon-name {
        font-size: 10px;
        color: var(--text-muted, #9ca3af);
        max-width: 100%;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .qa-badge {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--amber, #f59e0b);
        background: rgba(245, 158, 11, 0.1);
        padding: 1px 5px;
        border-radius: 4px;
    }

    @media (max-width: 768px) {
        .qa-toolbar {
            flex-direction: column;
            align-items: stretch;
            position: static;
        }

        .qa-toolbar-group {
            flex-wrap: wrap;
        }
    }
</style>
