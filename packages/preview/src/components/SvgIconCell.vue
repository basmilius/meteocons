<script
    setup
    lang="ts">
    import type { IconEntry } from '../types';
    import { useStyleSwitcher } from '../composables/useStyleSwitcher';
    import { useSizeMode } from '../composables/useSizeMode';

    const props = defineProps<{
        icon: IconEntry
    }>();

    const {svgUrl} = useStyleSwitcher();
    const {iconSize} = useSizeMode();
</script>

<template>
    <figure :class="['icon-cell', { static: !icon.animated }]">
        <div
            class="icon-wrap"
            :style="{ width: iconSize, height: iconSize }">
            <img
                :src="svgUrl(icon.slug)"
                :alt="icon.name"
                loading="lazy"
                :style="{ width: iconSize, height: iconSize }"
            >
        </div>
        <figcaption>{{ icon.name }}</figcaption>
    </figure>
</template>

<style scoped>
    .icon-cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 14px 8px 10px;
        border: 1px solid var(--border-light);
        border-radius: var(--radius-md);
        background: var(--surface);
        cursor: default;
        transition: all 0.15s;
    }

    .icon-cell:hover {
        border-color: var(--border);
        box-shadow: var(--shadow-sm);
        transform: translateY(-1px);
    }

    .icon-cell.static {
        border-style: dashed;
        border-color: var(--danger);
    }

    .icon-cell.static figcaption {
        color: var(--danger);
    }

    .icon-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .icon-wrap img {
        object-fit: contain;
    }

    figcaption {
        font-size: 10px;
        color: var(--text-muted);
        text-align: center;
        word-break: break-all;
        line-height: 1.3;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
