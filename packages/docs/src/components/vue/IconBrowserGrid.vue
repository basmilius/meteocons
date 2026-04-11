<script
    setup
    lang="ts">
    import { useIconBrowser } from './composables/useIconBrowser';

    const {
        loading,
        filteredCategories,
        query,
        splitGroups,
        formatName,
        svgUrl,
        openDetail,
    } = useIconBrowser();
</script>

<template>
    <main class="main">
        <div
            v-if="loading"
            class="state">
            <div class="spinner"/>
        </div>
        <div
            v-else-if="filteredCategories.length === 0"
            class="state">
            No icons match "{{ query }}"
        </div>

        <template v-else>
            <section
                v-for="category in filteredCategories"
                :key="category.slug"
                :id="`cat-${category.slug}`"
                class="category">
                <h2 class="category-title">{{ category.name }}</h2>
                <div
                    v-for="(group, gi) in splitGroups(category.icons)"
                    :key="gi"
                    class="icon-grid"
                    :class="{ 'icon-grid--spaced': gi > 0 }">
                    <button
                        v-for="icon in group"
                        :key="icon.slug"
                        class="icon-cell"
                        @click="openDetail(icon)">
                        <img
                            :src="svgUrl(icon.slug)"
                            :alt="icon.name"
                            width="96"
                            height="96"
                            loading="lazy"/>
                        <span class="icon-label">{{ formatName(icon.slug) }}</span>
                    </button>
                </div>
            </section>
        </template>
    </main>
</template>

<style scoped>
    .main {
        padding: 0 27px 33px 33px;
    }

    .state {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        color: var(--text-muted, #9ca3af);
    }

    .spinner {
        width: 27px;
        height: 27px;
        border: 2px solid var(--border, #e5e7eb);
        border-top-color: var(--amber, #f59e0b);
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .category {
        margin-bottom: 48px;
    }

    .category:last-child {
        margin-bottom: 0;
    }

    .category-title {
        font-family: var(--font-display, system-ui);
        font-size: 19px;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--text, #111827);
        margin: 0 -27px 0 -33px;
        padding: 0 27px 0 33px;
        position: sticky;
        top: var(--nav-height, 64px);
        background: var(--bg, #ffffff);
        height: var(--nav-height, 64px);
        display: flex;
        align-items: center;
        border-bottom: 2px solid var(--border, #e5e7eb);
        z-index: 10;
    }

    .icon-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 3px;
        padding-top: 9px;
    }

    .icon-grid--spaced {
        margin-top: 24px;
    }

    .icon-cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 9px;
        padding: 18px 6px 12px;
        border: 2px solid transparent;
        border-radius: 16px;
        background: transparent;
        font-family: inherit;
        cursor: pointer;
        transition: all 0.2s ease;
        color: inherit;
    }

    .icon-cell:hover,
    .icon-cell:focus-visible {
        background: var(--bg-soft, #f9fafb);
        border-color: var(--border, #e5e7eb);
        outline: none;
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

    @media (max-width: 768px) {
        .main {
            padding: 15px 21px;
        }

        .category-title {
            top: calc(var(--nav-height, 64px) + 60px);
            margin: 0 -21px;
            padding: 0 21px;
        }

        .icon-grid {
            grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
            gap: 3px;
        }

        .icon-cell {
            padding: 12px 3px 9px;
        }

        .icon-cell img {
            width: 64px;
            height: 64px;
        }

        .icon-label {
            font-size: 9px;
        }
    }
</style>
