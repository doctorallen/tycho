// Sprites: the canvases pictures are made on, letter-row sprites from a
// palette, outlines, tinted, flipped and enlarged copies, pixel-exact discs,
// letter grids enlarged by rule (Scale2x, Scale3x, 1.5x), and a painter of
// sprites from shapes (shapes.ts, re-exported here).
//
// Each is a game's own, bit for bit, with what differed between the games
// kept as options: the canvases are the White Dragon's canvasOf, Lodestar's
// makeCanvas (`{ read: true, min: 1 }`) and Merryfolk's (`{ read: !draw }`);
// spriteFrom is Lodestar's (Merryfolk's is the same with `{ w: rows[0].length }`);
// the outline is Lodestar's one ink, or Merryfolk's darkened own colors
// (`{ own: 0.42, grow: 'edge' }`); tinted, flipped, the row scalers and
// enlarged are Lodestar's, disc and ellipse Merryfolk's, flipSprite the
// White Dragon's. test/pixels.test.mjs and test/browser.js hold them to the
// originals.
import { hexToRgb } from '../core/color';

export { Shapes } from './shapes';
export type { Sprite, ShapeOpts, ShapesLook, Color, Ramp } from './shapes';

/** How a canvas is made. */
export interface CanvasOpts {
  /** Kept in memory for reading back (`willReadFrequently`): for pictures
   * that are built once by reading their pixels, then copied to the GPU. */
  read?: boolean;
  /** The least width and height (Lodestar's 1, so a picture of nothing is
   * still a canvas that can be drawn). */
  min?: number;
}

/** A canvas and its 2D context, with smoothing off. */
export function canvas(w: number, h: number, o: CanvasOpts = {}): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  if (o.min === undefined) { c.width = w; c.height = h; } else { c.width = Math.max(o.min, w); c.height = Math.max(o.min, h); }
  const g = c.getContext('2d', o.read ? { willReadFrequently: true } : undefined) as CanvasRenderingContext2D;
  g.imageSmoothingEnabled = false;
  return [c, g];
}

/** A sprite from a list of strings, a letter a pixel, colored by a palette
 * (letter to CSS color); '.', ' ' and letters the palette lacks are clear.
 * As wide as the longest row, or `o.w`. */
export function spriteFrom(rows: readonly string[], pal: Record<string, string>, o: CanvasOpts & { w?: number } = {}): HTMLCanvasElement {
  const h = rows.length, w = o.w === undefined ? Math.max(...rows.map((r) => r.length)) : o.w;
  const [c, x] = canvas(w, h, o);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch === '.' || ch === ' ' || !pal[ch]) continue;
      x.fillStyle = pal[ch];
      x.fillRect(i, j, 1, 1);
    }
  return c;
}

/** How an outline is drawn. */
export interface OutlineOpts {
  /** One ink for all of it, '#rrggbb' (Lodestar's; '#000000'). */
  ink?: string;
  /** Or each pixel of it the average of the solid pixels it borders, times
   * this (Merryfolk's 0.42: a sheep ringed in gray, a pine in deep green). */
  own?: number;
  /** The outline's alpha (255). */
  alpha?: number;
  /** Grow the canvas by a pixel all round first, so the outline is never
   * clipped: always (true, the default), never (false), or only when
   * something touches the edge ('edge'). Without growing, the canvas is
   * outlined in place. */
  grow?: boolean | 'edge';
}

/** A 1 px outline round every solid pixel (alpha over 100), on four sides.
 * Returns the outlined canvas: a new one if it grew, otherwise `src`. */
export function outline(src: HTMLCanvasElement, o: OutlineOpts = {}): HTMLCanvasElement {
  let c = src;
  const grow = o.grow === undefined ? true : o.grow;
  let big = grow === true;
  if (grow === 'edge') {
    const w = c.width, h = c.height, d = (c.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, w, h).data;
    for (let x = 0; x < w && !big; x++) big = d[x * 4 + 3] > 100 || d[((h - 1) * w + x) * 4 + 3] > 100;
    for (let y = 0; y < h && !big; y++) big = d[y * w * 4 + 3] > 100 || d[(y * w + w - 1) * 4 + 3] > 100;
  }
  if (big) { const [p, px] = canvas(src.width + 2, src.height + 2, { read: true }); px.drawImage(src, 1, 1); c = p; }
  const x = c.getContext('2d') as CanvasRenderingContext2D, w = c.width, h = c.height;
  const img = x.getImageData(0, 0, w, h), d = img.data, alpha = o.alpha === undefined ? 255 : o.alpha;
  const solid = (i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 100;
  if (o.own === undefined) {
    const mark: number[] = [];
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++)
        if (!solid(i, j) && (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1))) mark.push(j * w + i);
    const [r, g, b] = hexToRgb(o.ink || '#000000');
    for (const k of mark) { d[k * 4] = r; d[k * 4 + 1] = g; d[k * 4 + 2] = b; d[k * 4 + 3] = alpha; }
  } else {
    const dark = o.own, mark: number[] = [];
    for (let y = 0; y < h; y++)
      for (let xx = 0; xx < w; xx++) {
        if (d[(y * w + xx) * 4 + 3] > 100) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (const [i, j] of [[xx - 1, y], [xx + 1, y], [xx, y - 1], [xx, y + 1]]) if (solid(i, j)) { const k = (j * w + i) * 4; r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; }
        if (n) mark.push(y * w + xx, r / n, g / n, b / n);
      }
    for (let m = 0; m < mark.length; m += 4) { const i = mark[m] * 4; d[i] = mark[m + 1] * dark; d[i + 1] = mark[m + 2] * dark; d[i + 2] = mark[m + 3] * dark; d[i + 3] = alpha; }
  }
  x.putImageData(img, 0, 0);
  return c;
}

/** A copy with every solid pixel one color (a hit flash, a silhouette). */
export function tinted(src: HTMLCanvasElement, col: string, o: CanvasOpts = {}): HTMLCanvasElement {
  const [c, x] = canvas(src.width, src.height, o);
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = col;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

/** A copy flipped left to right. */
export function flipped(src: HTMLCanvasElement, o: CanvasOpts = {}): HTMLCanvasElement {
  const [c, x] = canvas(src.width, src.height, o);
  x.translate(src.width, 0); x.scale(-1, 1);
  x.drawImage(src, 0, 0);
  return c;
}

/** A sprite record (`{ c, e, w, ax, ... }`) flipped: a copy with each of its
 * pictures flipped (a missing one stays null) and its anchor mirrored. */
export function flipSprite<S extends { w: number; ax: number }>(s: S, layers: readonly string[] = ['c', 'e'], o: CanvasOpts = {}): S {
  const out = Object.assign({}, s) as S & Record<string, unknown>, src = s as unknown as Record<string, HTMLCanvasElement | null | undefined>;
  for (const k of layers) { const p = src[k]; (out as Record<string, unknown>)[k] = p ? flipped(p, o) : null; }
  out.ax = s.w - s.ax;
  return out;
}

/** A copy enlarged k times, each pixel a block. */
export function enlarged(src: HTMLCanvasElement, k: number, o: CanvasOpts = {}): HTMLCanvasElement {
  const [c, x] = canvas(src.width * k, src.height * k, o);
  x.imageSmoothingEnabled = false;
  x.drawImage(src, 0, 0, src.width * k, src.height * k);
  return c;
}

/** The part of a 2D context the discs draw with. */
export interface Filler { fillStyle: unknown; fillRect(x: number, y: number, w: number, h: number): void }

/** A pixel-exact filled circle, a row at a time. */
export function disc(ctx: Filler, cx: number, cy: number, r: number, col: string): void {
  ctx.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r + r * 0.6 - y * y));
    if (w >= 0) ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

/** A pixel-exact filled ellipse, a row at a time. */
export function ellipse(ctx: Filler, cx: number, cy: number, rx: number, ry: number, col: string): void {
  ctx.fillStyle = col;
  for (let y = -ry; y <= ry; y++) {
    const t = 1 - (y * y) / (ry * ry + 0.5);
    if (t < 0) continue;
    const w = Math.round(rx * Math.sqrt(t));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

// ---- letter grids enlarged by rule -------------------------------------------
// A sprite drawn as letter rows can be enlarged as letters, before it's
// colored, so the result is still clean pixel art: diagonals stay steps,
// curves stay round, nothing is blurred and no color is invented.

/** Scale2x (EPX): twice the size, corners rounded. */
export function scale2xRows(rows: readonly string[]): string[] {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const at = (x: number, y: number) => (y < 0 || y >= h || x < 0 || x >= w ? '.' : rows[y][x] || '.');
  const out = Array.from({ length: h * 2 }, () => new Array<string>(w * 2).fill('.'));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      out[2 * y][2 * x] = C === A && C !== D && A !== B ? A : P;
      out[2 * y][2 * x + 1] = A === B && A !== C && B !== D ? B : P;
      out[2 * y + 1][2 * x] = D === C && D !== B && C !== A ? C : P;
      out[2 * y + 1][2 * x + 1] = B === D && B !== A && D !== C ? D : P;
    }
  return out.map((r) => r.join(''));
}

/** Scale3x: three times the size. Letters in `fixed` (eyes, runes, a lamp's
 * core) are enlarged as exact blocks, neither rounded off by their neighbors
 * nor spilling into them, so a small light keeps its shape. */
export function scale3xRows(rows: readonly string[], fixed?: ReadonlySet<string> | null): string[] {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const at = (x: number, y: number) => (y < 0 || y >= h || x < 0 || x >= w ? '.' : rows[y][x] || '.');
  const out = Array.from({ length: h * 3 }, () => new Array<string>(w * 3).fill('.'));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const A = at(x - 1, y - 1), B = at(x, y - 1), C = at(x + 1, y - 1), D = at(x - 1, y), E = at(x, y), F = at(x + 1, y), G = at(x - 1, y + 1), H = at(x, y + 1), I = at(x + 1, y + 1);
      const o: (i: number, j: number, v?: string) => void = fixed && fixed.has(E) ? (i, j) => { out[3 * y + j][3 * x + i] = E; } : fixed ? (i, j, v) => { out[3 * y + j][3 * x + i] = fixed.has(v as string) ? E : (v as string); } : (i, j, v) => { out[3 * y + j][3 * x + i] = v as string; };
      if (B !== H && D !== F) {
        o(0, 0, D === B ? D : E);
        o(1, 0, (D === B && E !== C) || (B === F && E !== A) ? B : E);
        o(2, 0, B === F ? F : E);
        o(0, 1, (D === B && E !== G) || (D === H && E !== A) ? D : E);
        o(1, 1, E);
        o(2, 1, (B === F && E !== I) || (H === F && E !== C) ? F : E);
        o(0, 2, D === H ? D : E);
        o(1, 2, (D === H && E !== I) || (H === F && E !== G) ? H : E);
        o(2, 2, H === F ? F : E);
      } else for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) o(i, j, E);
    }
  return out.map((r) => r.join(''));
}

/** 1.5x: Scale3x, then every other row and column. Each even pixel keeps its
 * two corners and each odd one its middle. */
export function scale15Rows(rows: readonly string[], fixed?: ReadonlySet<string> | null): string[] {
  return scale3xRows(rows, fixed).filter((_, y) => y % 2 === 0).map((r) => [...r].filter((_, x) => x % 2 === 0).join(''));
}

/** A letter grid enlarged k times: by the rules above for 1, 1.5, 2, 3 and
 * their products, by nearest neighbor for any other k. */
export function scaleRows(rows: readonly string[], k: number, fixed?: ReadonlySet<string> | null): string[] {
  const whole = (v: number) => Math.abs(v - Math.round(v)) < 1e-6;
  if (Math.abs(k - 1) < 1e-6) return rows as string[];
  if (whole(k / 3)) return scaleRows(scale3xRows(rows, fixed), k / 3, fixed);
  if (whole(k / 2)) return scaleRows(scale2xRows(rows), k / 2, fixed);
  if (Math.abs(k - 1.5) < 1e-6) return scale15Rows(rows, fixed);
  // (4.5: three times, then half as much again)
  if (whole(k / 1.5)) return scale15Rows(scaleRows(rows, k / 1.5, fixed), fixed);
  const h = rows.length, w = Math.max(...rows.map((r) => r.length)), W = Math.round(w * k), H = Math.round(h * k);
  return Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => rows[Math.floor(y / k)][Math.floor(x / k)] || '.').join(''));
}
