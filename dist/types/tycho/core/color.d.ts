export type RGB = [number, number, number];
/** '#rrggbb' to [r, g, b]. */
export declare const rgb: (h: string) => RGB;
/** 'rrggbb' or '#rrggbb' to [r, g, b]. */
export declare function hexToRgb(h: string): RGB;
/** [r, g, b] (rounded and clamped) to '#rrggbb'. */
export declare function rgbToHex(r: number, g: number, b: number): string;
/** A hex color darkened (amt < 0, toward black) or lightened (toward white). */
export declare function shade(hex: string, amt: number): string;
/** Two hex colors mixed, t of the way from the first. */
export declare function mix(h1: string, h2: string, t: number): string;
export declare const mixRgb: (a: readonly number[], b: readonly number[], t: number) => RGB;
/** Lightness, 0..255. */
export declare const lum: (c: readonly number[]) => number;
/** [r, g, b] to 'rgb(r,g,b)', truncated. */
export declare const css: (c: readonly number[]) => string;
export declare const SOOT: RGB;
export declare const WARM: RGB;
/** A painter's ramp: n tones from soot through the anchors (dark to light) to
 * a warm light, evenly spaced in lightness, so neighboring tones always differ
 * by a visible step. `deep` is how far toward soot the darkest goes, `high`
 * how far toward the warm light the lightest. */
export declare function rampOf(anchors: readonly (string | readonly number[])[], n?: number, deep?: number, high?: number): RGB[];
/** The tone of a ramp at value v (0..1), moved by a stroke's jitter. */
export declare const tone: <T>(ramp: readonly T[], v: number, jit?: number) => T;
