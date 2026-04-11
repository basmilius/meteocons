import { version } from '../../package.json';

const CDN_BASE = 'https://cdn.meteocons.com';

function cdnVersion(): string {
    return version === '0.0.0' ? 'latest' : version;
}

export function iconSvgUrl(style: string, slug: string): string {
    if (import.meta.env.PROD) {
        return `${CDN_BASE}/${cdnVersion()}/svg/${style}/${slug}.svg`;
    }
    return `/icons/${style}/${slug}.svg`;
}

export function iconLottieUrl(style: string, slug: string): string {
    if (import.meta.env.PROD) {
        return `${CDN_BASE}/${cdnVersion()}/lottie/${style}/${slug}.json`;
    }
    return `/icons/${style}/${slug}.json`;
}

export { CDN_BASE, cdnVersion };
