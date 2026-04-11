<script
    setup
    lang="ts">
    import { nextTick, ref, watch } from 'vue';
    import type { AnimationItem } from 'lottie-web';
    import lottie from 'lottie-web';
    import { useIconBrowser } from './composables/useIconBrowser';

    const {
        selectedIcon,
        detailStyle,
        copiedAction,
        previewMode,
        STYLES,
        formatName,
        svgUrl,
        lottieUrl,
        cdnSvgUrl,
        cdnLottieUrl,
        copySvgCode,
        copyText,
        copyDeepLink,
        downloadFile,
        closeDetail,
    } = useIconBrowser();

    const lottieContainer = ref<HTMLElement | null>(null);
    let lottieAnimation: AnimationItem | null = null;

    function destroyLottie(): void {
        if (lottieAnimation) {
            lottieAnimation.destroy();
            lottieAnimation = null;
        }
    }

    async function loadLottie(): Promise<void> {
        destroyLottie();
        await nextTick();

        if (!selectedIcon.value || previewMode.value !== 'lottie' || !lottieContainer.value) {
            return;
        }

        const url = lottieUrl(selectedIcon.value.slug, detailStyle.value);

        try {
            lottieAnimation = lottie.loadAnimation({
                container: lottieContainer.value,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                path: url
            });
        } catch {
            // Lottie file might not exist for static icons
        }
    }

    watch([previewMode, detailStyle], () => {
        if (previewMode.value === 'lottie') {
            loadLottie();
        } else {
            destroyLottie();
        }
    });

    watch(selectedIcon, (icon) => {
        if (!icon) {
            destroyLottie();
            previewMode.value = 'svg';
        }
    });
</script>

<template>
    <Transition name="overlay">
        <div
            v-if="selectedIcon"
            class="overlay"
            @click.self="closeDetail">
            <Transition
                name="panel"
                appear>
                <div
                    class="detail"
                    v-if="selectedIcon">
                    <div class="detail-top-actions">
                        <button
                            class="detail-action-icon"
                            :class="{ copied: copiedAction === 'link' }"
                            @click="copyDeepLink"
                            :aria-label="copiedAction === 'link' ? 'Copied' : 'Copy link'">
                            <svg v-if="copiedAction !== 'link'" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                                <path d="M32 320C32 214 118 128 224 128L264 128C277.3 128 288 138.7 288 152C288 165.3 277.3 176 264 176L224 176C144.5 176 80 240.5 80 320C80 399.5 144.5 464 224 464L264 464C277.3 464 288 474.7 288 488C288 501.3 277.3 512 264 512L224 512C118 512 32 426 32 320zM192 320C192 306.7 202.7 296 216 296L424 296C437.3 296 448 306.7 448 320C448 333.3 437.3 344 424 344L216 344C202.7 344 192 333.3 192 320zM416 128C522 128 608 214 608 320C608 426 522 512 416 512L376 512C362.7 512 352 501.3 352 488C352 474.7 362.7 464 376 464L416 464C495.5 464 560 399.5 560 320C560 240.5 495.5 176 416 176L376 176C362.7 176 352 165.3 352 152C352 138.7 362.7 128 376 128L416 128z"/>
                            </svg>
                            <svg v-else viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                                <path d="M534 132.5C544.8 140.2 547.2 155.2 539.5 166L275.5 534C271.4 539.7 265 543.4 258 543.9C251 544.4 244 542 239 537L103 401C93.6 391.6 93.6 376.4 103 367.1C112.4 357.8 127.6 357.7 136.9 367.1L253 483L500.5 138C508.2 127.2 523.2 124.8 534 132.5z"/>
                            </svg>
                        </button>
                        <button
                            class="detail-action-icon"
                            @click="closeDetail"
                            aria-label="Close">
                            <svg viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                                <path d="M135.5 169C126.1 159.6 126.1 144.4 135.5 135.1C144.9 125.8 160.1 125.7 169.4 135.1L320.4 286.1L471.4 135.1C480.8 125.7 496 125.7 505.3 135.1C514.6 144.5 514.7 159.7 505.3 169L354.3 320L505.3 471C514.7 480.4 514.7 495.6 505.3 504.9C495.9 514.2 480.7 514.3 471.4 504.9L320.4 353.9L169.4 504.9C160 514.3 144.8 514.3 135.5 504.9C126.2 495.5 126.1 480.3 135.5 471L286.5 320L135.5 169z"/>
                            </svg>
                        </button>
                    </div>

                    <div class="detail-preview">
                        <div class="preview-toggle">
                            <button
                                :class="['toggle-btn', { active: previewMode === 'svg' }]"
                                @click="previewMode = 'svg'">
                                SVG
                            </button>
                            <button
                                :class="['toggle-btn', { active: previewMode === 'lottie' }]"
                                @click="previewMode = 'lottie'">
                                Lottie
                            </button>
                        </div>

                        <img
                            v-if="previewMode === 'svg'"
                            :src="svgUrl(selectedIcon.slug, detailStyle)"
                            :alt="selectedIcon.name"
                            width="256"
                            height="256"
                            :key="`${selectedIcon.slug}-${detailStyle}`"/>
                        <div
                            v-else
                            ref="lottieContainer"
                            class="lottie-player"
                            :key="`lottie-${selectedIcon.slug}-${detailStyle}`"/>
                    </div>

                    <div class="detail-info">
                        <h3 class="detail-name">{{ formatName(selectedIcon.slug) }}</h3>

                        <div class="detail-styles">
                            <button
                                v-for="style in STYLES"
                                :key="style"
                                :class="['detail-style-btn', {active: detailStyle === style}]"
                                @click="detailStyle = style">
                                <img
                                    :src="svgUrl(selectedIcon.slug, style)"
                                    alt=""
                                    width="48"
                                    height="48"/>
                                <span>{{ style }}</span>
                            </button>
                        </div>

                        <div class="detail-actions">
                            <button
                                class="action-btn"
                                @click="copySvgCode">
                                <svg v-if="copiedAction !== 'svg'" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                                    <path d="M369.1 80.9C373 68.2 386.5 61.2 399.1 65.1C411.7 69 418.8 82.5 414.9 95.1L270.9 559.1C267 571.8 253.5 578.8 240.9 574.9C228.3 571 221.2 557.5 225.1 544.9L369.1 80.9zM177 199C186.4 208.4 186.4 223.6 177 232.9L90 319.9L177 406.9C186.4 416.3 186.4 431.5 177 440.8C167.6 450.1 152.4 450.2 143.1 440.8L39 337C29.6 327.6 29.6 312.4 39 303.1L143 199C152.4 189.6 167.6 189.6 176.9 199zM463 199C472.4 189.6 487.6 189.6 496.9 199L601 303C610.4 312.4 610.4 327.6 601 336.9L497 441C487.6 450.4 472.4 450.4 463.1 441C453.8 431.6 453.7 416.4 463.1 407.1L550.1 320.1L463.1 233.1C453.7 223.7 453.7 208.5 463.1 199.2z"/>
                                </svg>
                                <svg v-else viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                                    <path d="M534 132.5C544.8 140.2 547.2 155.2 539.5 166L275.5 534C271.4 539.7 265 543.4 258 543.9C251 544.4 244 542 239 537L103 401C93.6 391.6 93.6 376.4 103 367.1C112.4 357.8 127.6 357.7 136.9 367.1L253 483L500.5 138C508.2 127.2 523.2 124.8 534 132.5z"/>
                                </svg>
                                {{ copiedAction === 'svg' ? 'Copied!' : 'Copy SVG' }}
                            </button>
                            <button
                                class="action-btn"
                                @click="copyText(selectedIcon.slug, 'name')">
                                <svg v-if="copiedAction !== 'name'" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                                    <path d="M352 528L128 528C119.2 528 112 520.8 112 512L112 288C112 279.2 119.2 272 128 272L176 272L176 224L128 224C92.7 224 64 252.7 64 288L64 512C64 547.3 92.7 576 128 576L352 576C387.3 576 416 547.3 416 512L416 464L368 464L368 512C368 520.8 360.8 528 352 528zM288 368C279.2 368 272 360.8 272 352L272 128C272 119.2 279.2 112 288 112L512 112C520.8 112 528 119.2 528 128L528 352C528 360.8 520.8 368 512 368L288 368zM224 352C224 387.3 252.7 416 288 416L512 416C547.3 416 576 387.3 576 352L576 128C576 92.7 547.3 64 512 64L288 64C252.7 64 224 92.7 224 128L224 352z"/>
                                </svg>
                                <svg v-else viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                                    <path d="M534 132.5C544.8 140.2 547.2 155.2 539.5 166L275.5 534C271.4 539.7 265 543.4 258 543.9C251 544.4 244 542 239 537L103 401C93.6 391.6 93.6 376.4 103 367.1C112.4 357.8 127.6 357.7 136.9 367.1L253 483L500.5 138C508.2 127.2 523.2 124.8 534 132.5z"/>
                                </svg>
                                {{ copiedAction === 'name' ? 'Copied!' : 'Copy name' }}
                            </button>
                        </div>
                        <div class="detail-actions">
                            <button
                                class="action-btn"
                                @click="downloadFile(svgUrl(selectedIcon.slug, detailStyle), `${selectedIcon.slug}.svg`)">
                                <svg viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                                    <path d="M488 576C501.3 576 512 565.3 512 552C512 538.7 501.3 528 488 528L152 528C138.7 528 128 538.7 128 552C128 565.3 138.7 576 152 576L488 576zM303 441C312.4 450.4 327.6 450.4 336.9 441L473 305C482.4 295.6 482.4 280.4 473 271.1C463.6 261.8 448.4 261.7 439.1 271.1L344.1 366.1L344.1 88C344.1 74.7 333.4 64 320.1 64C306.8 64 296.1 74.7 296.1 88L296.1 366.1L201.1 271.1C191.7 261.7 176.5 261.7 167.2 271.1C157.9 280.5 157.8 295.7 167.2 305L303 441z"/>
                                </svg>
                                Download SVG
                            </button>
                            <button
                                class="action-btn"
                                @click="downloadFile(lottieUrl(selectedIcon.slug, detailStyle), `${selectedIcon.slug}.json`)">
                                <svg viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                                    <path d="M488 576C501.3 576 512 565.3 512 552C512 538.7 501.3 528 488 528L152 528C138.7 528 128 538.7 128 552C128 565.3 138.7 576 152 576L488 576zM303 441C312.4 450.4 327.6 450.4 336.9 441L473 305C482.4 295.6 482.4 280.4 473 271.1C463.6 261.8 448.4 261.7 439.1 271.1L344.1 366.1L344.1 88C344.1 74.7 333.4 64 320.1 64C306.8 64 296.1 74.7 296.1 88L296.1 366.1L201.1 271.1C191.7 261.7 176.5 261.7 167.2 271.1C157.9 280.5 157.8 295.7 167.2 305L303 441z"/>
                                </svg>
                                Download Lottie
                            </button>
                        </div>

                        <div class="detail-cdn">
                            <div class="cdn-label">CDN</div>
                            <div class="cdn-url-row">
                                <code class="cdn-url">{{ cdnSvgUrl(selectedIcon.slug, detailStyle) }}</code>
                                <button
                                    class="cdn-copy-btn"
                                    @click="copyText(cdnSvgUrl(selectedIcon.slug, detailStyle), 'cdn-svg')"
                                    :aria-label="copiedAction === 'cdn-svg' ? 'Copied' : 'Copy SVG URL'">
                                    <svg v-if="copiedAction !== 'cdn-svg'" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                                        <path d="M352 528L128 528C119.2 528 112 520.8 112 512L112 288C112 279.2 119.2 272 128 272L176 272L176 224L128 224C92.7 224 64 252.7 64 288L64 512C64 547.3 92.7 576 128 576L352 576C387.3 576 416 547.3 416 512L416 464L368 464L368 512C368 520.8 360.8 528 352 528zM288 368C279.2 368 272 360.8 272 352L272 128C272 119.2 279.2 112 288 112L512 112C520.8 112 528 119.2 528 128L528 352C528 360.8 520.8 368 512 368L288 368zM224 352C224 387.3 252.7 416 288 416L512 416C547.3 416 576 387.3 576 352L576 128C576 92.7 547.3 64 512 64L288 64C252.7 64 224 92.7 224 128L224 352z"/>
                                    </svg>
                                    <svg v-else viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                                        <path d="M534 132.5C544.8 140.2 547.2 155.2 539.5 166L275.5 534C271.4 539.7 265 543.4 258 543.9C251 544.4 244 542 239 537L103 401C93.6 391.6 93.6 376.4 103 367.1C112.4 357.8 127.6 357.7 136.9 367.1L253 483L500.5 138C508.2 127.2 523.2 124.8 534 132.5z"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="cdn-url-row">
                                <code class="cdn-url">{{ cdnLottieUrl(selectedIcon.slug, detailStyle) }}</code>
                                <button
                                    class="cdn-copy-btn"
                                    @click="copyText(cdnLottieUrl(selectedIcon.slug, detailStyle), 'cdn-lottie')"
                                    :aria-label="copiedAction === 'cdn-lottie' ? 'Copied' : 'Copy Lottie URL'">
                                    <svg v-if="copiedAction !== 'cdn-lottie'" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                                        <path d="M352 528L128 528C119.2 528 112 520.8 112 512L112 288C112 279.2 119.2 272 128 272L176 272L176 224L128 224C92.7 224 64 252.7 64 288L64 512C64 547.3 92.7 576 128 576L352 576C387.3 576 416 547.3 416 512L416 464L368 464L368 512C368 520.8 360.8 528 352 528zM288 368C279.2 368 272 360.8 272 352L272 128C272 119.2 279.2 112 288 112L512 112C520.8 112 528 119.2 528 128L528 352C528 360.8 520.8 368 512 368L288 368zM224 352C224 387.3 252.7 416 288 416L512 416C547.3 416 576 387.3 576 352L576 128C576 92.7 547.3 64 512 64L288 64C252.7 64 224 92.7 224 128L224 352z"/>
                                    </svg>
                                    <svg v-else viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                                        <path d="M534 132.5C544.8 140.2 547.2 155.2 539.5 166L275.5 534C271.4 539.7 265 543.4 258 543.9C251 544.4 244 542 239 537L103 401C93.6 391.6 93.6 376.4 103 367.1C112.4 357.8 127.6 357.7 136.9 367.1L253 483L500.5 138C508.2 127.2 523.2 124.8 534 132.5z"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </div>
    </Transition>
</template>

<style scoped>
    /* Overlay */
    .overlay {
        position: fixed;
        inset: 0;
        z-index: 500;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
    }

    .overlay-enter-active {
        transition: all 0.2s ease-out;
    }

    .overlay-leave-active {
        transition: all 0.15s ease-in;
    }

    .overlay-enter-from,
    .overlay-leave-to {
        opacity: 0;
    }

    /* Detail panel */
    .detail {
        position: relative;
        background: var(--bg-soft, #f9fafb);
        background-clip: padding-box;
        border: 2px solid rgb(from var(--navy, #e5e7eb) r g b / .09);
        border-radius: var(--radius-xl, 28px);
        box-shadow: 0 33px 99px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.04);
        max-width: 480px;
        width: 100%;
        overflow: hidden;
    }

    .panel-enter-active {
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .panel-leave-active {
        transition: all 0.15s ease-in;
    }

    .panel-enter-from {
        opacity: 0;
        transform: scale(0.95) translateY(9px);
    }

    .panel-leave-to {
        opacity: 0;
        transform: scale(0.98);
    }

    .detail-top-actions {
        position: absolute;
        top: 15px;
        right: 15px;
        display: flex;
        gap: 6px;
        z-index: 10;
    }

    .detail-action-icon {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.06);
        color: var(--text-muted, #9ca3af);
        cursor: pointer;
        transition: all 0.15s;
    }

    .detail-action-icon:hover {
        background: rgba(0, 0, 0, 0.1);
        color: var(--text, #111827);
    }

    .detail-action-icon.copied {
        background: rgba(245, 158, 11, 0.12);
        color: var(--amber, #f59e0b);
    }

    .detail-preview {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        padding: 51px 33px 36px;
        background: var(--bg, #ffffff);
        border-bottom: 2px solid var(--border, #f3f4f6);
    }

    .preview-toggle {
        position: absolute;
        top: 15px;
        left: 15px;
        display: flex;
        gap: 3px;
        background: var(--bg-surface, #f3f4f6);
        border-radius: 10px;
        padding: 3px;
    }

    .toggle-btn {
        padding: 6px 12px;
        border: none;
        border-radius: 8px;
        background: transparent;
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-muted, #9ca3af);
        cursor: pointer;
        transition: all 0.15s;
    }

    .toggle-btn:hover {
        color: var(--text-secondary, #4b5563);
    }

    .toggle-btn.active {
        background: var(--bg, #ffffff);
        color: var(--text, #111827);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .lottie-player {
        width: 256px;
        height: 256px;
    }

    .detail-info {
        padding: 24px 27px 27px;
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .detail-name {
        font-family: var(--font-display, system-ui);
        font-size: 21px;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--text, #111827);
    }

    .detail-styles {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 9px;
    }

    .detail-style-btn {
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

    .detail-style-btn:hover {
        border-color: var(--bg-raised, #e5e7eb);
        color: var(--text-secondary, #4b5563);
    }

    .detail-style-btn.active {
        border-color: var(--amber, #f59e0b);
        background: rgba(245, 158, 11, 0.1);
        color: var(--amber, #f59e0b);
    }

    .detail-actions {
        display: flex;
        gap: 9px;
    }

    .action-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 12px 15px;
        border: 2px solid var(--border, #f3f4f6);
        border-radius: 12px;
        background: white;
        font-family: inherit;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-secondary, #4b5563);
        cursor: pointer;
        transition: all 0.15s;
    }

    .action-btn:hover {
        border-color: var(--bg-raised, #e5e7eb);
    }

    /* CDN URLs */
    .detail-cdn {
        display: flex;
        flex-direction: column;
        gap: 9px;
        padding-top: 15px;
        border-top: 2px solid var(--border, #f3f4f6);
    }

    .cdn-label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--text-muted, #9ca3af);
    }

    .cdn-url-row {
        display: flex;
        align-items: center;
        gap: 9px;
    }

    .cdn-url {
        flex: 1;
        font-size: 12px;
        padding: 9px 12px;
        background: white;
        border: 2px solid var(--border, #f3f4f6);
        border-radius: 12px;
        color: var(--text-secondary, #4b5563);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .cdn-copy-btn {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        border: 2px solid var(--border, #f3f4f6);
        border-radius: 12px;
        background: white;
        color: var(--text-muted, #9ca3af);
        cursor: pointer;
        transition: all 0.15s;
    }

    .cdn-copy-btn:hover {
        border-color: var(--amber, #f59e0b);
        color: var(--amber, #f59e0b);
        background: rgba(245, 158, 11, 0.06);
    }

    @media (max-width: 768px) {
        .detail {
            max-width: 100%;
            border-radius: 21px;
        }
    }
</style>
