<script
    setup
    lang="ts">
    import { useIconBrowser } from './composables/useIconBrowser';

    const {
        query,
        toggleMobileFilter,
        activeFilterCount,
        totalCount,
    } = useIconBrowser();
</script>

<template>
    <div class="mobile-filter-bar">
        <div class="mobile-search-wrap">
            <svg
                class="mobile-search-icon"
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
                placeholder="Search..."
                class="mobile-search-input"/>
        </div>
        <button
            class="mobile-filter-btn"
            @click="toggleMobileFilter">
            <svg
                viewBox="0 0 640 640"
                width="20"
                height="20"
                fill="currentColor"
                aria-hidden="true">
                <path d="M88 136C74.7 136 64 146.7 64 160C64 173.3 74.7 184 88 184L179.7 184C189.9 216.5 220.2 240 256 240C291.8 240 322.1 216.5 332.3 184L552 184C565.3 184 576 173.3 576 160C576 146.7 565.3 136 552 136L332.3 136C322.1 103.5 291.8 80 256 80C220.2 80 189.9 103.5 179.7 136L88 136zM88 296C74.7 296 64 306.7 64 320C64 333.3 74.7 344 88 344L339.7 344C349.9 376.5 380.2 400 416 400C451.8 400 482.1 376.5 492.3 344L552 344C565.3 344 576 333.3 576 320C576 306.7 565.3 296 552 296L492.3 296C482.1 263.5 451.8 240 416 240C380.2 240 349.9 263.5 339.7 296L88 296zM88 456C74.7 456 64 466.7 64 480C64 493.3 74.7 504 88 504L147.7 504C157.9 536.5 188.2 560 224 560C259.8 560 290.1 536.5 300.3 504L552 504C565.3 504 576 493.3 576 480C576 466.7 565.3 456 552 456L300.3 456C290.1 423.5 259.8 400 224 400C188.2 400 157.9 423.5 147.7 456L88 456zM224 512C206.3 512 192 497.7 192 480C192 462.3 206.3 448 224 448C241.7 448 256 462.3 256 480C256 497.7 241.7 512 224 512zM416 352C398.3 352 384 337.7 384 320C384 302.3 398.3 288 416 288C433.7 288 448 302.3 448 320C448 337.7 433.7 352 416 352zM224 160C224 142.3 238.3 128 256 128C273.7 128 288 142.3 288 160C288 177.7 273.7 192 256 192C238.3 192 224 177.7 224 160z"/>
            </svg>
            <span
                v-if="activeFilterCount"
                class="mobile-filter-badge">{{ activeFilterCount }}</span>
        </button>
    </div>
</template>

<style scoped>
    .mobile-filter-bar {
        display: none;
    }

    @media (max-width: 768px) {
        .mobile-filter-bar {
            display: flex;
            align-items: center;
            gap: 9px;
            padding: 9px 21px;
            background: var(--bg, #ffffff);
            border-bottom: 2px solid var(--border, #e5e7eb);
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
            left: 9px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted, #9ca3af);
            pointer-events: none;
        }

        .mobile-search-input {
            width: 100%;
            height: 42px;
            padding: 0 12px 0 33px;
            border: 2px solid var(--border, #e5e7eb);
            border-radius: var(--radius-sm, 10px);
            font-family: inherit;
            font-size: 16px;
            font-weight: 500;
            outline: none;
            background: var(--bg-soft, #f9fafb);
            color: var(--text, #111827);
            transition: all 0.2s;
        }

        .mobile-search-input::placeholder {
            color: var(--text-faint, #d1d5db);
        }

        .mobile-search-input:focus-visible {
            border-color: var(--amber, #f59e0b);
            box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
            background: var(--bg, #ffffff);
            outline: none;
        }

        .mobile-filter-btn {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            width: 42px;
            height: 42px;
            border: 2px solid var(--border, #e5e7eb);
            border-radius: var(--radius-sm, 10px);
            background: var(--bg-soft, #f9fafb);
            color: var(--text-secondary, #4b5563);
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .mobile-filter-btn:active {
            transform: scale(0.93);
        }

        .mobile-filter-btn:focus-visible {
            border-color: var(--amber, #f59e0b);
            outline: none;
        }

        .mobile-filter-badge {
            position: absolute;
            top: -6px;
            right: -6px;
            min-width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 6px;
            border-radius: 100px;
            background: var(--amber, #f59e0b);
            color: white;
            font-size: 10px;
            font-weight: 700;
            line-height: 1;
        }
    }
</style>
