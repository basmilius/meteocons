<script
    setup
    lang="ts">
    import { useIconBrowser } from './composables/useIconBrowser';

    const {
        mobileFilterOpen,
        STYLES,
        currentStyle,
        svgUrl,
        sortedCategories,
        activeCategoryFilter,
        totalIconCount,
        selectCategoryMobile,
    } = useIconBrowser();
</script>

<template>
    <Transition name="drawer">
        <div
            v-if="mobileFilterOpen"
            class="mobile-drawer-backdrop"
            @click.self="mobileFilterOpen = false">
            <div class="mobile-drawer">
                <div class="mobile-drawer-header">
                    <h3>Filters</h3>
                    <button
                        class="mobile-drawer-close"
                        @click="mobileFilterOpen = false"
                        aria-label="Close">
                        <svg
                            viewBox="0 0 640 640"
                            width="20"
                            height="20"
                            fill="currentColor"
                            aria-hidden="true">
                            <path d="M135.5 169C126.1 159.6 126.1 144.4 135.5 135.1C144.9 125.8 160.1 125.7 169.4 135.1L320.4 286.1L471.4 135.1C480.8 125.7 496 125.7 505.3 135.1C514.6 144.5 514.7 159.7 505.3 169L354.3 320L505.3 471C514.7 480.4 514.7 495.6 505.3 504.9C495.9 514.2 480.7 514.3 471.4 504.9L320.4 353.9L169.4 504.9C160 514.3 144.8 514.3 135.5 504.9C126.2 495.5 126.1 480.3 135.5 471L286.5 320L135.5 169z"/>
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
                                @click="currentStyle = style">
                                <img
                                    :src="svgUrl('clear-day', style)"
                                    alt=""
                                    width="28"
                                    height="28"/>
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
                                @click="selectCategoryMobile(null)">
                                <span>All</span>
                                <span class="mobile-drawer-count">{{ totalIconCount }}</span>
                            </button>
                            <button
                                v-for="cat in sortedCategories"
                                :key="cat.slug"
                                :class="['mobile-drawer-item', { active: activeCategoryFilter === cat.slug }]"
                                @click="selectCategoryMobile(cat.slug)">
                                <span>{{ cat.name }}</span>
                                <span class="mobile-drawer-count">{{ cat.icons.filter(Boolean).length }}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
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
        padding: 15px 21px 12px;
        flex-shrink: 0;
    }

    .mobile-drawer-header h3 {
        font-family: var(--font-display, system-ui);
        font-size: 18px;
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
        background: var(--bg-surface, #f3f4f6);
        color: var(--text-muted, #9ca3af);
        cursor: pointer;
        transition: all 0.15s;
    }

    .mobile-drawer-close:hover,
    .mobile-drawer-close:focus-visible {
        background: var(--bg-raised, #e5e7eb);
        color: var(--text, #111827);
        outline: none;
    }

    .mobile-drawer-body {
        overflow-y: auto;
        padding: 0 21px 24px;
        -webkit-overflow-scrolling: touch;
    }

    .mobile-drawer-section {
        padding-top: 3px;
    }

    .mobile-drawer-label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--text-muted, #9ca3af);
        padding: 0 3px;
        margin-bottom: 9px;
    }

    .mobile-drawer-styles {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 9px;
    }

    .mobile-style-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 12px 3px 9px;
        border: 2px solid var(--border, #e5e7eb);
        border-radius: var(--radius-md, 14px);
        background: var(--bg-soft, #f9fafb);
        font-family: inherit;
        font-size: 11px;
        font-weight: 600;
        color: var(--text-muted, #9ca3af);
        cursor: pointer;
        text-transform: capitalize;
        transition: all 0.15s;
    }

    .mobile-style-btn:active {
        transform: scale(0.95);
    }

    .mobile-style-btn:focus-visible {
        border-color: var(--amber, #f59e0b);
        outline: none;
    }

    .mobile-style-btn.active {
        border-color: var(--amber, #f59e0b);
        background: rgba(245, 158, 11, 0.08);
        color: var(--amber, #f59e0b);
    }

    .mobile-drawer-divider {
        height: 1px;
        background: var(--border, #e5e7eb);
        margin: 15px 0;
    }

    .mobile-drawer-list {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .mobile-drawer-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 15px;
        border: none;
        border-radius: var(--radius-sm, 10px);
        background: transparent;
        font-family: inherit;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-secondary, #4b5563);
        cursor: pointer;
        transition: all 0.15s;
        width: 100%;
        text-align: left;
    }

    .mobile-drawer-item:active,
    .mobile-drawer-item:focus-visible {
        background: var(--bg-surface, #f3f4f6);
        outline: none;
    }

    .mobile-drawer-item.active {
        color: var(--amber, #f59e0b);
        font-weight: 600;
        background: rgba(245, 158, 11, 0.06);
    }

    .mobile-drawer-count {
        font-size: 12px;
        color: var(--text-muted, #9ca3af);
        font-variant-numeric: tabular-nums;
    }
</style>
