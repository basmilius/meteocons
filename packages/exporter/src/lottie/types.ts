/** Compact Lottie JSON types — only what we generate. */

export interface LottieColor {
    a: number;
    k: [number, number, number, number];
}

export interface LottieValue {
    a: number;
    k: number | number[];
}

export interface LottieKeyframe {
    t: number;
    s: number[];
    e?: number[];
    /** In-tangent easing (arriving). */
    i: { x: number[]; y: number[] };
    /** Out-tangent easing (leaving). */
    o: { x: number[]; y: number[] };
}

export interface LottieAnimatedValue {
    a: 1;
    k: LottieKeyframe[];
}

export interface LottieBezier {
    v: [number, number][];
    i: [number, number][];
    o: [number, number][];
    c: boolean;
}

export interface LottieEllipseShape {
    ty: 'el';
    nm: string;
    p: { a: 0; k: [number, number] };
    s: { a: 0; k: [number, number] };
}

export interface LottiePathShape {
    ty: 'sh';
    nm: string;
    ks: { a: 0; k: LottieBezier };
}

export interface LottieFill {
    ty: 'fl';
    nm: string;
    o: { a: 0; k: number };
    c: { a: 0; k: [number, number, number, number] };
    r: 1 | 2;
}

export interface LottieStrokeDash {
    /** "d" = dash, "g" = gap, "o" = offset */
    n: 'd' | 'g' | 'o';
    nm: string;
    v: LottieValue | LottieAnimatedValue;
}

export interface LottieStroke {
    ty: 'st';
    nm: string;
    o: { a: 0; k: number };
    c: { a: 0; k: [number, number, number, number] };
    w: { a: 0; k: number };
    lc: 1 | 2 | 3;
    lj: 1 | 2 | 3;
    /** Stroke dashes: dash size, gap size, animated offset */
    d?: LottieStrokeDash[];
}

export interface LottieTrimPath {
    ty: 'tm';
    nm: string;
    /** Start percentage (0-100). */
    s: { a: 0; k: number } | { a: 1; k: LottieKeyframe[] };
    /** End percentage (0-100). */
    e: { a: 0; k: number } | { a: 1; k: LottieKeyframe[] };
    /** Offset in degrees. */
    o: { a: 0; k: number } | { a: 1; k: LottieKeyframe[] };
    /** Trim multiple shapes: 1 = simultaneously, 2 = individually. */
    m: 1 | 2;
}

export interface LottieRectShape {
    ty: 'rc';
    nm: string;
    /** Position (center of the rectangle). */
    p: { a: 0; k: [number, number] };
    /** Size [width, height]. */
    s: { a: 0; k: [number, number] };
    /** Corner radius. */
    r: { a: 0; k: number };
}

export interface LottieGradientFill {
    ty: 'gf';
    nm: string;
    /** Opacity 0-100 */
    o: { a: 0; k: number };
    /** Fill rule: 1=nonzero, 2=evenodd */
    r: 1 | 2;
    /** Gradient type: 1=linear, 2=radial */
    t: 1 | 2;
    /** Start point */
    s: { a: 0; k: [number, number] };
    /** End point */
    e: { a: 0; k: [number, number] };
    /** Gradient colors: p=stop count, k.k=flat array [offset,R,G,B, offset,R,G,B, ...] */
    g: { p: number; k: { a: 0; k: number[] } };
}

export interface LottieGroup {
    ty: 'gr';
    nm: string;
    it: (LottieEllipseShape | LottiePathShape | LottieRectShape | LottieFill | LottieGradientFill | LottieStroke | LottieTrimPath | LottieGroup)[];
}

export interface LottieTransform {
    /** Opacity 0-100 */
    o: LottieValue | LottieAnimatedValue;
    /** Rotation */
    r: LottieValue | LottieAnimatedValue;
    /** Position [x, y] */
    p: LottieValue | LottieAnimatedValue;
    /** Anchor [x, y] */
    a: LottieValue;
    /** Scale [x%, y%] */
    s: LottieValue | LottieAnimatedValue;
}

export interface LottieMaskKeyframe {
    t: number;
    s: [LottieBezier];
    i: { x: number[]; y: number[] };
    o: { x: number[]; y: number[] };
}

export interface LottieMask {
    /** false = not inverted */
    inv: boolean;
    /** "a" = add, "s" = subtract, "i" = intersect */
    mode: 'a' | 's' | 'i';
    /** Mask path (static or animated bezier shape) */
    pt: { a: 0; k: LottieBezier } | { a: 1; k: LottieMaskKeyframe[] };
    /** Opacity 0-100 */
    o: { a: 0; k: number };
    /** Expansion */
    x: { a: 0; k: number };
}

export interface LottieLayer {
    ddd: 0;
    ind: number;
    /** 4 = shape layer */
    ty: 4;
    nm: string;
    sr: 1;
    /** Start time (frame offset for stagger) */
    st: number;
    ip: number;
    op: number;
    ao: 0;
    bm: 0;
    ks: LottieTransform;
    shapes: LottieGroup[];
    /** Optional mask shapes applied to this layer */
    masksProperties?: LottieMask[];
    /** Parent layer index — inherits parent's transform */
    parent?: number;
}

export interface LottieJSON {
    v: string;
    fr: number;
    ip: number;
    op: number;
    w: number;
    h: number;
    nm: string;
    ddd: 0;
    assets: [];
    layers: LottieLayer[];
}
