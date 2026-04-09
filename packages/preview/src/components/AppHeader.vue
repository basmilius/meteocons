<script
    setup
    lang="ts">
    import type { DisplayMode } from '../types';
    import StyleTabs from './StyleTabs.vue';
    import SizeModeToggle from './SizeModeToggle.vue';
    import SearchInput from './SearchInput.vue';

    defineProps<{
        totalCount: number
    }>();

    const search = defineModel<string>('search', {required: true});
    const displayMode = defineModel<DisplayMode>('displayMode', {required: true});
</script>

<template>
    <header>
        <div class="header-left">
            <h1 class="brand">
        <span class="brand-icon">
          <svg
              width="22"
              height="22"
              viewBox="0 0 128 128"
              fill="none">
            <circle
                cx="64"
                cy="64"
                r="28"
                fill="currentColor"
                opacity="0.9"/>
            <g
                stroke="currentColor"
                stroke-width="6"
                stroke-linecap="round">
              <line
                  x1="64"
                  y1="8"
                  x2="64"
                  y2="24"/>
              <line
                  x1="64"
                  y1="104"
                  x2="64"
                  y2="120"/>
              <line
                  x1="8"
                  y1="64"
                  x2="24"
                  y2="64"/>
              <line
                  x1="104"
                  y1="64"
                  x2="120"
                  y2="64"/>
              <line
                  x1="24.4"
                  y1="24.4"
                  x2="35.7"
                  y2="35.7"/>
              <line
                  x1="92.3"
                  y1="92.3"
                  x2="103.6"
                  y2="103.6"/>
              <line
                  x1="24.4"
                  y1="103.6"
                  x2="35.7"
                  y2="92.3"/>
              <line
                  x1="92.3"
                  y1="35.7"
                  x2="103.6"
                  y2="24.4"/>
            </g>
          </svg>
        </span>
                <span>Meteocons</span>
            </h1>

            <div class="format-tabs">
                <button
                    :class="{ active: displayMode === 'svg' }"
                    @click="displayMode = 'svg'"
                >
                    SVG
                </button>
                <button
                    :class="{ active: displayMode === 'lottie' }"
                    @click="displayMode = 'lottie'"
                >
                    Lottie
                </button>
            </div>

            <div class="divider"/>

            <StyleTabs/>
        </div>

        <div class="header-right">
            <span class="count">{{ totalCount }} icons</span>
            <SizeModeToggle/>
            <SearchInput v-model="search"/>
        </div>
    </header>
</template>

<style scoped>
    header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: var(--header-h);
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        z-index: 100;
        box-shadow: var(--shadow-sm);
    }

    .header-left,
    .header-right {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .brand {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: -0.4px;
        color: var(--text);
        margin-right: 8px;
    }

    .brand-icon {
        display: flex;
        color: var(--brand-primary);
    }

    .format-tabs {
        display: flex;
        background: var(--bg);
        border-radius: var(--radius-sm);
        padding: 2px;
    }

    .format-tabs button {
        padding: 5px 14px;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        font-family: inherit;
        transition: all 0.15s;
    }

    .format-tabs button:hover {
        color: var(--text);
    }

    .format-tabs button.active {
        background: var(--surface);
        color: var(--brand-primary);
        box-shadow: var(--shadow-sm);
    }

    .divider {
        width: 1px;
        height: 24px;
        background: var(--border);
    }

    .count {
        font-size: 12px;
        color: var(--text-muted);
        font-weight: 500;
    }
</style>
