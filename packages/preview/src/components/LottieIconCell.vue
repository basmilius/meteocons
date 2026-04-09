<script
    setup
    lang="ts">
    import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
    import type { AnimationItem } from 'lottie-web';
    import lottie from 'lottie-web';
    import type { IconEntry } from '../types';
    import { useStyleSwitcher } from '../composables/useStyleSwitcher';
    import { useSizeMode } from '../composables/useSizeMode';

    const props = defineProps<{
        icon: IconEntry
    }>();

    const {lottieUrl, currentStyle} = useStyleSwitcher();
    const {iconSize} = useSizeMode();

    const containerRef = ref<HTMLElement | null>(null);
    let animation: AnimationItem | null = null;
    let observer: IntersectionObserver | null = null;
    let isVisible = false;

    function loadAnimation() {
        if (!containerRef.value || animation) {
            return;
        }

        const url = lottieUrl(props.icon.slug);

        fetch(url)
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                return res.json();
            })
            .then((data) => {
                if (!isVisible || !containerRef.value) {
                    return;
                }

                animation = lottie.loadAnimation({
                    container: containerRef.value,
                    renderer: 'canvas',
                    loop: true,
                    autoplay: true,
                    animationData: data
                });
            })
            .catch((err) => {
                console.warn(`Lottie load failed for ${props.icon.slug}:`, err);
            });
    }

    function destroyAnimation() {
        if (animation) {
            animation.destroy();
            animation = null;
        }
    }

    function setupObserver() {
        if (!containerRef.value) {
            return;
        }

        observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        isVisible = true;
                        loadAnimation();
                    } else {
                        isVisible = false;
                        destroyAnimation();
                    }
                }
            },
            {rootMargin: '200px'}
        );

        observer.observe(containerRef.value);
    }

    // Herlaad bij stijlwissel
    watch(currentStyle, () => {
        if (isVisible) {
            destroyAnimation();
            loadAnimation();
        }
    });

    onMounted(setupObserver);

    onBeforeUnmount(() => {
        destroyAnimation();
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    });
</script>

<template>
    <figure class="icon-cell">
        <div
            ref="containerRef"
            class="icon-wrap"
            :style="{ width: iconSize, height: iconSize }"
        />
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

    .icon-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
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
