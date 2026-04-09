import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

export function useScrollSpy(containerRef: Ref<HTMLElement | null>) {
    const activeSlug = ref('');
    let observer: IntersectionObserver | null = null;

    function setup() {
        if (!containerRef.value) {
            return;
        }

        observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        const slug = (entry.target as HTMLElement).dataset.categorySlug;
                        if (slug) {
                            activeSlug.value = slug;
                        }
                    }
                }
            },
            {
                rootMargin: '-20% 0px -70% 0px'
            }
        );

        const sections = containerRef.value.querySelectorAll('[data-category-slug]');
        sections.forEach((section) => observer!.observe(section));
    }

    function teardown() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    function refresh() {
        teardown();
        setup();
    }

    onMounted(setup);
    onBeforeUnmount(teardown);

    return {
        activeSlug,
        refresh
    };
}
