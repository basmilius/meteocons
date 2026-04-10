import type { LottieAnimatedValue, LottieKeyframe, LottieTransform, LottieValue } from './types';

export const FPS = 60;
export const COMP_FRAMES = 360;

export const LINEAR = {i: {x: [1], y: [1]}, o: {x: [0], y: [0]}};
const EASE_IN = {i: {x: [1], y: [1]}, o: {x: [0.42], y: [0]}};
const EASE_IN_OUT = {i: {x: [0.58], y: [1]}, o: {x: [0.42], y: [0]}};

export type Easing = typeof LINEAR;

export function getEasing(name?: string): Easing {
    if (name === 'ease-in') {
        return EASE_IN;
    }
    if (name === 'ease-in-out') {
        return EASE_IN_OUT;
    }
    return LINEAR;
}

export function staticValue(k: number | number[]): LottieValue {
    return {a: 0, k};
}

export function animatedValue(keyframes: LottieKeyframe[]): LottieAnimatedValue {
    return {a: 1, k: keyframes};
}

export function kf(t: number, s: number[], easing: Easing): LottieKeyframe {
    return {t, s, ...easing};
}

export function kfEnd(t: number, s: number[], easing: Easing = LINEAR): LottieKeyframe {
    return {t, s, ...easing};
}

/** Lineaire interpolatie van multi-dimensionale waarden op een fractie (0-1) in de cyclus. */
export function lerpPositions(positions: number[][], fraction: number): number[] {
    const numSegs = positions.length - 1;
    const segFloat = fraction * numSegs;
    const segIdx = Math.min(Math.floor(segFloat), numSegs - 1);
    const segLocal = segFloat - segIdx;
    return positions[segIdx].map((v, j) => v + (positions[segIdx + 1][j] - v) * segLocal);
}

/** Lineaire interpolatie van 1D waarden op een fractie, met optionele keyTimes. */
export function lerpValues(values: number[], fraction: number, keyTimes?: number[]): number {
    const times = keyTimes ?? values.map((_, i) => i / (values.length - 1));
    for (let i = 0; i < times.length - 1; i++) {
        if (fraction >= times[i] && fraction <= times[i + 1]) {
            const local = times[i + 1] === times[i] ? 0 : (fraction - times[i]) / (times[i + 1] - times[i]);
            return values[i] + (values[i + 1] - values[i]) * local;
        }
    }
    return values[0];
}

export function parseDuration(dur?: string): number {
    if (!dur) {
        return 60;
    }
    return Math.round(parseFloat(dur) * FPS);
}

/** Compute the phase offset so that a delayed animation appears to have started
 *  `delay` frames ago — matching the steady-state position it would have if it
 *  had been running from the beginning with a real delay. */
export function computePhase(delay: number, cycle: number): number {
    if (delay <= 0) {
        return 0;
    }
    const remainder = delay % cycle;
    return remainder > 0 ? cycle - remainder : 0;
}

export function arraysEqual(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function staticTransform(): LottieTransform {
    return {
        o: staticValue(100),
        r: staticValue(0),
        p: staticValue([0, 0, 0]),
        a: staticValue([0, 0, 0]),
        s: staticValue([100, 100, 100])
    };
}
