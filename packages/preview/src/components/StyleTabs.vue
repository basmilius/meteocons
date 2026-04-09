<script
    setup
    lang="ts">
    import { type Style, STYLES } from '../types';
    import { useStyleSwitcher } from '../composables/useStyleSwitcher';

    const {currentStyle, setStyle} = useStyleSwitcher();

    function capitalize(value: string): string {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }
</script>

<template>
    <div class="style-tabs">
        <button
            v-for="style in STYLES"
            :key="style"
            :class="{ active: currentStyle === style }"
            @click="setStyle(style as Style)"
        >
            {{ capitalize(style) }}
        </button>
    </div>
</template>

<style scoped>
    .style-tabs {
        display: flex;
        gap: 3px;
    }

    button {
        padding: 5px 12px;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        background: var(--surface);
        color: var(--text-muted);
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        font-family: inherit;
        transition: all 0.15s;
    }

    button:hover {
        border-color: var(--accent);
        color: var(--accent);
    }

    button.active {
        background: var(--accent-bg);
        border-color: var(--accent);
        color: var(--accent);
        font-weight: 600;
    }
</style>
