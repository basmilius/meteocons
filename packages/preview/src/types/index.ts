export type Style = 'fill' | 'flat' | 'line' | 'monochrome'
export type SizeMode = 'sm' | 'md' | 'lg'
export type DisplayMode = 'svg' | 'lottie'

export interface IconEntry {
    slug: string;
    name: string;
    animated: boolean;
    hasLottie: boolean;
}

export interface Category {
    name: string;
    slug: string;
    icons: IconEntry[];
}

export interface PreviewManifest {
    styles: string[];
    categories: Category[];
}

export const STYLES: Style[] = ['fill', 'flat', 'line', 'monochrome'];

export const SIZE_CONFIG = {
    sm: {cell: 96, icon: 64},
    md: {cell: 128, icon: 96},
    lg: {cell: 192, icon: 160}
} as const;
