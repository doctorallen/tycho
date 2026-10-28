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
export declare function canvas(w: number, h: number, o?: CanvasOpts): [HTMLCanvasElement, CanvasRenderingContext2D];
/** A sprite from a list of strings, a letter a pixel, colored by a palette
 * (letter to CSS color); '.', ' ' and letters the palette lacks are clear.
 * As wide as the longest row, or `o.w`. */
export declare function spriteFrom(rows: readonly string[], pal: Record<string, string>, o?: CanvasOpts & {
    w?: number;
}): HTMLCanvasElement;
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
export declare function outline(src: HTMLCanvasElement, o?: OutlineOpts): HTMLCanvasElement;
/** A copy with every solid pixel one color (a hit flash, a silhouette). */
export declare function tinted(src: HTMLCanvasElement, col: string, o?: CanvasOpts): HTMLCanvasElement;
/** A copy flipped left to right. */
export declare function flipped(src: HTMLCanvasElement, o?: CanvasOpts): HTMLCanvasElement;
/** A sprite record (`{ c, e, w, ax, ... }`) flipped: a copy with each of its
 * pictures flipped (a missing one stays null) and its anchor mirrored. */
export declare function flipSprite<S extends {
    w: number;
    ax: number;
}>(s: S, layers?: readonly string[], o?: CanvasOpts): S;
/** A copy enlarged k times, each pixel a block. */
export declare function enlarged(src: HTMLCanvasElement, k: number, o?: CanvasOpts): HTMLCanvasElement;
/** The part of a 2D context the discs draw with. */
export interface Filler {
    fillStyle: unknown;
    fillRect(x: number, y: number, w: number, h: number): void;
}
/** A pixel-exact filled circle, a row at a time. */
export declare function disc(ctx: Filler, cx: number, cy: number, r: number, col: string): void;
/** A pixel-exact filled ellipse, a row at a time. */
export declare function ellipse(ctx: Filler, cx: number, cy: number, rx: number, ry: number, col: string): void;
/** Scale2x (EPX): twice the size, corners rounded. */
export declare function scale2xRows(rows: readonly string[]): string[];
/** Scale3x: three times the size. Letters in `fixed` (eyes, runes, a lamp's
 * core) are enlarged as exact blocks, neither rounded off by their neighbors
 * nor spilling into them, so a small light keeps its shape. */
export declare function scale3xRows(rows: readonly string[], fixed?: ReadonlySet<string> | null): string[];
/** 1.5x: Scale3x, then every other row and column. Each even pixel keeps its
 * two corners and each odd one its middle. */
export declare function scale15Rows(rows: readonly string[], fixed?: ReadonlySet<string> | null): string[];
/** A letter grid enlarged k times: by the rules above for 1, 1.5, 2, 3 and
 * their products, by nearest neighbor for any other k. */
export declare function scaleRows(rows: readonly string[], k: number, fixed?: ReadonlySet<string> | null): string[];
