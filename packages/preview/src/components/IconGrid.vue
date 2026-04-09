<script
    setup
    lang="ts">
    import type { Category, DisplayMode } from '../types';
    import IconGridSection from './IconGridSection.vue';

    defineProps<{
        categories: Category[]
        displayMode: DisplayMode
    }>();
</script>

<template>
    <div class="icon-grid-container">
        <IconGridSection
            v-for="category in categories"
            :key="category.slug"
            :category="category"
            :display-mode="displayMode"
        />

        <div
            v-if="categories.length === 0"
            class="empty-state">
            No icons found.
        </div>
    </div>
</template>

<style scoped>
    .icon-grid-container {
        display: flex;
        flex-direction: column;
        gap: 32px;
    }

    .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: var(--text-muted);
        font-size: 14px;
    }
</style>
