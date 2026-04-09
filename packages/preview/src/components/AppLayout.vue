<script
    setup
    lang="ts">
    import { nextTick, ref, watch } from 'vue';
    import type { Category, DisplayMode } from '../types';
    import { useScrollSpy } from '../composables/useScrollSpy';
    import AppHeader from './AppHeader.vue';
    import AppSidebar from './AppSidebar.vue';
    import IconGrid from './IconGrid.vue';

    const props = defineProps<{
        categories: Category[]
        totalCount: number
    }>();

    const search = defineModel<string>('search', {required: true});
    const displayMode = defineModel<DisplayMode>('displayMode', {required: true});

    const mainRef = ref<HTMLElement | null>(null);
    const {activeSlug, refresh} = useScrollSpy(mainRef);

    watch(
        () => props.categories,
        async () => {
            await nextTick();
            refresh();
        }
    );

    function scrollToCategory(slug: string) {
        const section = mainRef.value?.querySelector(`[data-category-slug="${slug}"]`);
        if (section) {
            section.scrollIntoView({behavior: 'smooth', block: 'start'});
        }
    }
</script>

<template>
    <div class="app-layout">
        <AppHeader
            v-model:search="search"
            v-model:display-mode="displayMode"
            :total-count="totalCount"
        />
        <div class="body">
            <AppSidebar
                :categories="categories"
                :active-slug="activeSlug"
                @navigate="scrollToCategory"
            />
            <main ref="mainRef">
                <IconGrid
                    :categories="categories"
                    :display-mode="displayMode"
                />
            </main>
        </div>
    </div>
</template>

<style scoped>
    .app-layout {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
    }

    .body {
        display: flex;
        flex: 1;
        padding-top: var(--header-h);
        padding-left: var(--sidebar-w);
    }

    main {
        flex: 1;
        padding: 28px 32px;
        min-width: 0;
        overflow-y: auto;
        height: calc(100vh - var(--header-h));
    }
</style>
