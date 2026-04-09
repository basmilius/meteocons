<script
    setup
    lang="ts">
    import { ref } from 'vue';
    import type { DisplayMode } from './types';
    import { useSearch } from './composables/useSearch';
    import { useIcons } from './composables/useIcons';
    import AppLayout from './components/AppLayout.vue';

    const displayMode = ref<DisplayMode>('svg');
    const {rawQuery, searchQuery} = useSearch();
    const {filteredCategories, totalCount, loading, error} = useIcons(searchQuery, displayMode);
</script>

<template>
    <div
        v-if="loading"
        class="loading-state">
        <p>Iconen laden...</p>
    </div>
    <div
        v-else-if="error"
        class="error-state">
        <p>{{ error }}</p>
    </div>
    <AppLayout
        v-else
        v-model:search="rawQuery"
        v-model:display-mode="displayMode"
        :categories="filteredCategories"
        :total-count="totalCount"
    />
</template>

<style scoped>
    .loading-state,
    .error-state {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        color: var(--text-muted);
        font-size: 14px;
    }

    .error-state {
        color: var(--danger);
    }
</style>
