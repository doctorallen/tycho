// Colors: hex strings and [r, g, b] triples, mixing, shading, lightness, and
// a painter's ramp of evenly stepped tones. The games' own helpers, bit for
// bit (rgb/mixRgb/lum/css/rampOf/tone the White Dragon's, hexToRgb/rgbToHex/
// shade/mix Lodestar's and Merryfolk's, which were the same).
import { clamp, lerp } from './math';

export type RGB = [number, number, number];

/** '#rrggbb' to [r, g, b]. */
export const rgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** 'rrggbb' or '#rrggbb' to [r, g, b]. */
export function hexToRgb(h: string): RGB {
  h = h.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
/** [r, g, b] (rounded and clamped) to '#rrggbb'. */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
/** A hex color darkened (amt < 0, toward black) or lightened (toward white). */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (amt < 0) return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}
/** Two hex colors mixed, t of the way from the first. */
export function mix(h1: string, h2: string, t: number): string {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  return rgbToHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
}
export const mixRgb = (a: readonly number[], b: readonly number[], t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Lightness, 0..255. */
export const lum = (c: readonly number[]): number => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
/** [r, g, b] to 'rgb(r,g,b)', truncated. */
export const css = (c: readonly number[]): string => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

export const SOOT: RGB = [8, 6, 12];
export const WARM: RGB = [255, 238, 200];

/** A painter's ramp: n tones from soot through the anchors (dark to light) to
 * a warm light, evenly spaced in lightness, so neighboring tones always differ
 * by a visible step. `deep` is how far toward soot the darkest goes, `high`
 * how far toward the warm light the lightest. */
export function rampOf(anchors: readonly (string | readonly number[])[], n = 9, deep = 0.55, high = 0.3): RGB[] {
  const A = anchors.map((a) => (typeof a === 'string' ? rgb(a) : (a as readonly number[])));
  const path = [mixRgb(A[0], SOOT, deep)].concat(A as RGB[], [mixRgb(A[A.length - 1], WARM, high)]), pts: RGB[] = [];
  for (let i = 0; i + 1 < path.length; i++) for (let k = 0; k < 16; k++) pts.push(mixRgb(path[i], path[i + 1], k / 16));
  pts.push(path[path.length - 1]);
  const L: number[] = []; let m = -1; for (const c of pts) { m = Math.max(m, lum(c)); L.push(m); }
  const out: RGB[] = [];
  for (let k = 0, j = 0; k < n; k++) {
    const want = L[0] + (L[L.length - 1] - L[0]) * (k / (n - 1));
    while (j < L.length - 2 && L[j + 1] < want) j++;
    const u = L[j + 1] > L[j] ? clamp((want - L[j]) / (L[j + 1] - L[j]), 0, 1) : 0;
    out.push(mixRgb(pts[j], pts[j + 1], u));
  }
  return out;
}
/** The tone of a ramp at value v (0..1), moved by a stroke's jitter. */
export const tone = <T>(ramp: readonly T[], v: number, jit = 0): T => ramp[clamp(Math.round(v * (ramp.length - 1) + jit), 0, ramp.length - 1)];
