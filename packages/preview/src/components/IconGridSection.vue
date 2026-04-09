<script
    setup
    lang="ts">
    import type { Category, DisplayMode } from '../types';
    import { useSizeMode } from '../composables/useSizeMode';
    import SvgIconCell from './SvgIconCell.vue';
    import LottieIconCell from './LottieIconCell.vue';

    defineProps<{
        category: Category
        displayMode: DisplayMode
    }>();

    const {cellSize} = useSizeMode();
</script>

<template>
    <section :data-category-slug="category.slug">
        <h2>
            {{ category.name }}
            <span class="count">{{ category.icons.length }}</span>
        </h2>
        <div
            class="grid"
            :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${cellSize}, 1fr))` }"
        >
            <template v-if="displayMode === 'svg'">
                <SvgIconCell
                    v-for="icon in category.icons"
                    :key="icon.slug"
                    :icon="icon"
                />
            </template>
            <template v-else>
                <LottieIconCell
                    v-for="icon in category.icons"
                    :key="icon.slug"
                    :icon="icon"
                />
            </template>
        </div>
    </section>
</template>

<style scoped>
    h2 {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 14px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: baseline;
        gap: 8px;
        color: var(--text);
    }

    .count {
        font-size: 11px;
        color: var(--text-muted);
        font-weight: 400;
    }

    .grid {
        display: grid;
        gap: 8px;
    }
</style>
