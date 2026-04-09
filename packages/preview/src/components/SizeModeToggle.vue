<script
    setup
    lang="ts">
    import type { SizeMode } from '../types';
    import { useSizeMode } from '../composables/useSizeMode';

    const {sizeMode, setSize} = useSizeMode();

    const modes: { value: SizeMode; label: string; title: string }[] = [
        {value: 'sm', label: 'S', title: 'Small (64px)'},
        {value: 'md', label: 'M', title: 'Medium (96px)'},
        {value: 'lg', label: 'L', title: 'Large (160px)'}
    ];
</script>

<template>
    <div class="size-toggle">
        <button
            v-for="mode in modes"
            :key="mode.value"
            :class="{ active: sizeMode === mode.value }"
            :title="mode.title"
            @click="setSize(mode.value)"
        >
            {{ mode.label }}
        </button>
    </div>
</template>

<style scoped>
    .size-toggle {
        display: flex;
        background: var(--bg);
        border-radius: var(--radius-sm);
        padding: 2px;
    }

    button {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 11px;
        font-weight: 700;
        font-family: inherit;
        transition: all 0.15s;
    }

    button:hover {
        color: var(--text);
    }

    button.active {
        background: var(--surface);
        color: var(--brand-primary);
        box-shadow: var(--shadow-sm);
    }
</style>
