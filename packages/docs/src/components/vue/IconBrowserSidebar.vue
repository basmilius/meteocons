<script
    setup
    lang="ts">
    import { useIconBrowser } from './composables/useIconBrowser';

    const {
        totalCount,
        query,
        STYLES,
        currentStyle,
        svgUrl,
        sortedCategories,
        activeCategoryFilter,
        totalIconCount,
        selectCategory,
    } = useIconBrowser();
</script>

<template>
    <aside class="sidebar">
        <div class="sidebar-header">
            <h1>Icons</h1>
        </div>

        <div class="search-wrap">
            <svg
                class="search-icon"
                viewBox="0 0 640 640"
                width="20"
                height="20"
                fill="currentColor"
                aria-hidden="true">
                <path d="M432 272C432 183.6 360.4 112 272 112C183.6 112 112 183.6 112 272C112 360.4 183.6 432 272 432C360.4 432 432 360.4 432 272zM401.1 435.1C365.7 463.2 320.8 480 272 480C157.1 480 64 386.9 64 272C64 157.1 157.1 64 272 64C386.9 64 480 157.1 480 272C480 320.8 463.2 365.7 435.1 401.1L569 535C578.4 544.4 578.4 559.6 569 568.9C559.6 578.2 544.4 578.3 535.1 568.9L401.1 435.1z"/>
            </svg>
            <input
                v-model="query"
                type="text"
                placeholder="Search icons..."
                class="search-input"/>
        </div>

        <div>
            <div class="nav-label">Style</div>
            <div class="style-selector">
                <button
                    v-for="style in STYLES"
                    :key="style"
                    :class="['style-btn', {active: currentStyle === style}]"
                    @click="currentStyle = style">
                    <img
                        :src="svgUrl('clear-day', style)"
                        alt=""
                        width="36"
                        height="36"/>
                    <span>{{ style }}</span>
                </button>
            </div>
        </div>

        <nav class="category-nav">
            <div class="nav-label">Categories</div>
            <button
                :class="['nav-item', {active: activeCategoryFilter === null}]"
                @click="selectCategory(null)">
                <span>All</span>
                <span class="nav-count">{{ totalIconCount }}</span>
            </button>
            <button
                v-for="cat in sortedCategories"
                :key="cat.slug"
                :class="['nav-item', {active: activeCategoryFilter === cat.slug}]"
                @click="selectCategory(cat.slug)">
                <span>{{ cat.name }}</span>
                <span class="nav-count">{{ cat.icons.filter(Boolean).length }}</span>
            </button>
        </nav>
    </aside>
</template>

<style scoped>
    .sidebar {
        position: sticky;
        top: var(--nav-height, 64px);
        height: calc(100vh - var(--nav-height, 64px));
        overflow-y: auto;
        padding: 0 24px 33px 27px;
        border-right: 2px solid var(--border, #e5e7eb);
        display: flex;
        flex-direction: column;
        gap: 24px;
        scrollbar-width: thin;
        scrollbar-color: var(--bg-raised, #e5e7eb) transparent;
    }

    .sidebar-header {
        display: flex;
        align-items: center;
        gap: 9px;
        height: var(--nav-height, 64px);
        flex-shrink: 0;
        margin: 0 -24px -24px -27px;
        padding: 0 24px 0 27px;
    }

    .sidebar-header h1 {
        font-family: var(--font-display, system-ui);
        font-size: 24px;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--text, #111827);
    }

    .search-wrap {
        position: relative;
    }

    .search-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted, #9ca3af);
        pointer-events: none;
    }

    .search-input {
        width: 100%;
        padding: 12px 15px 12px 39px;
        border: 2px solid var(--border, #e5e7eb);
        border-radius: var(--radius-md, 14px);
        font-family: inherit;
        font-size: 16px;
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
        gap: 9px;
    }

    .style-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 6px 6px 9px;
        border: 2px solid var(--border, #f3f4f6);
        border-radius: var(--radius-md, 14px);
        background: white;
        font-family: inherit;
        font-size: 12px;
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
        border-color: var(--border-light, #d1d5db);
        color: var(--text-secondary, #4b5563);
        background: var(--bg-soft, #f3f4f6);
    }

    .style-btn.active {
        border-color: var(--amber, #e5850a);
        background: rgba(229, 133, 10, 0.08);
        color: var(--amber, #e5850a);
    }

    .category-nav {
        display: flex;
        flex-direction: column;
        gap: 3px;
        flex: 1;
    }

    .nav-label {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--text-muted, #9ca3af);
        padding: 0 12px;
        margin-bottom: 9px;
    }

    .nav-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 9px 12px;
        border: none;
        border-radius: var(--radius-sm, 9px);
        background: transparent;
        font-family: inherit;
        font-size: 15px;
        font-weight: 500;
        line-height: 1;
        color: var(--text-secondary, #4b5563);
        cursor: pointer;
        transition: all 0.15s;
        width: 100%;
        text-align: left;
    }

    .nav-item:hover {
        background: var(--bg-surface, #f3f4f6);
        color: var(--text, #111827);
    }

    .nav-item.active {
        color: var(--amber, #e5850a);
        font-weight: 600;
        background: rgba(229, 133, 10, 0.06);
    }

    .nav-count {
        font-size: 12px;
        font-weight: 500;
        color: var(--text-muted, #9ca3af);
        font-variant-numeric: tabular-nums;
    }

    .nav-item.active .nav-count {
        background: rgba(229, 133, 10, 0.1);
        color: var(--amber, #e5850a);
    }

    @media (max-width: 768px) {
        .sidebar {
            display: none;
        }
    }
</style>
