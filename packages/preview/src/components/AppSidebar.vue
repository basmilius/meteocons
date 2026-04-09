<script
    setup
    lang="ts">
    import type { Category } from '../types';

    defineProps<{
        categories: Category[]
        activeSlug: string
    }>();

    const emit = defineEmits<{
        navigate: [slug: string]
    }>();
</script>

<template>
    <nav>
        <div class="nav-label">Categories</div>
        <a
            v-for="category in categories"
            :key="category.slug"
            :class="{ active: activeSlug === category.slug }"
            href="#"
            @click.prevent="emit('navigate', category.slug)"
        >
            <span class="nav-text">{{ category.name }}</span>
            <span class="nav-count">{{ category.icons.length }}</span>
        </a>
    </nav>
</template>

<style scoped>
    nav {
        width: var(--sidebar-w);
        flex-shrink: 0;
        position: fixed;
        top: var(--header-h);
        left: 0;
        height: calc(100vh - var(--header-h));
        overflow-y: auto;
        padding: 16px 10px;
        background: var(--sidebar-bg);
        z-index: 50;
    }

    .nav-label {
        padding: 4px 12px 10px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--sidebar-text);
        opacity: 0.6;
    }

    a {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 7px 12px;
        border-radius: var(--radius-sm);
        color: var(--sidebar-text);
        text-decoration: none;
        font-size: 13px;
        font-weight: 450;
        white-space: nowrap;
        overflow: hidden;
        transition: all 0.15s;
    }

    a:hover {
        background: var(--sidebar-hover-bg);
        color: var(--sidebar-active);
    }

    a.active {
        background: var(--sidebar-active-bg);
        color: var(--sidebar-active);
        font-weight: 550;
    }

    .nav-text {
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .nav-count {
        font-size: 11px;
        opacity: 0.5;
        flex-shrink: 0;
        margin-left: 8px;
    }
</style>
