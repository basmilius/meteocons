export interface IconEntry {
    slug: string;
    name: string;
    animated: boolean;
}

export interface IconCategory {
    name: string;
    slug: string;
    icons: IconEntry[];
}

export interface IconManifest {
    styles: string[];
    categories: IconCategory[];
}

export declare const svgManifest: IconManifest;
export declare const lottieManifest: IconManifest;
