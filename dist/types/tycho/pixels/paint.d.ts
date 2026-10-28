/** One row of strokes. A row is cut into 8 px cells (each row set off by its
 * own phase), each cell into one to three strokes at hashed places; for each
 * of the n pixels from x0, `mid` gets its stroke's middle (as an offset from
 * x0: where its tone is read) and `jit` the stroke's jitter. It depends only
 * on the place and the seed. */
export declare function strokeRow(mid: Int16Array | number[], jit: Float32Array | number[], x0: number, n: number, y: number, seed: number): void;
/** How a buffer paints. */
export interface PixOpts {
    /** Flat (each surface one tone, crisp edges) rather than strokes. */
    flat?: boolean;
}
/** An area's options. */
export interface AreaOpts {
    /** The strokes' seed (from the operation's otherwise). */
    seed?: number;
    /** Only where this says (x, y) is in. */
    inside?: ((x: number, y: number) => boolean) | null;
    /** How far a stroke's tone jitters (0.45; none when flat). */
    jit?: number;
    /** It lights itself, this much (0..1). */
    glow?: number;
    /** Mixed toward a fog color ([20, 16, 30]) this much. */
    fog?: number;
    fogc?: readonly number[];
}
/** A block's options: its shading (see blockV), and an area's. */
export interface BlockOpts extends AreaOpts {
    /** Its value (0.5). */
    base?: number;
    /** The lit lip on top (1; 0 for none). */
    lip?: number;
    /** Fine grain (0.06, strokes only). */
    grain?: number;
    /** Darker toward its middle, at most this (strokes only). */
    inward?: number;
    /** The share of columns with grime running down from the top, and how far. */
    drips?: number;
    dripLen?: number;
    /** A dark line every this many rows. */
    bands?: number;
    /** Panel lines every [x, y] px. */
    panels?: readonly [number, number] | readonly number[];
}
/** A pixel buffer over a piece of the world: (ox, oy) is its top left, in
 * world px. A color picture and a glow picture, RGBA. */
export declare class Pix {
    w: number;
    h: number;
    ox: number;
    oy: number;
    /** The seed the next area takes when it's given none (an operation sets it). */
    n: number;
    /** Whether anything glows. */
    glowed: boolean;
    flat: boolean;
    c: Uint8ClampedArray;
    g: Uint8ClampedArray;
    mid: Int16Array;
    jit: Float32Array;
    constructor(w: number, h: number, ox?: number, oy?: number, o?: PixOpts);
    /** One pixel, in world px; glow 0..1 puts it on the glow picture that bright. */
    put(x: number, y: number, col: readonly number[] | null | undefined, glow?: number): void;
    /** What's there mixed toward a color, k of the way (haze, steam). */
    tint(x: number, y: number, col: readonly number[], k: number): void;
    /** A painted area: v(x, y) its value (0..1), read from the ramp. Flat, each
     * pixel its own tone; otherwise read at each stroke's middle with a little
     * jitter, so the area reads as brushwork. */
    area(ax0: number, ay0: number, ax1: number, ay1: number, ramp: readonly (readonly number[])[], v: (x: number, y: number) => number, o?: AreaOpts): void;
    /** A block, lit side-on (blockV). */
    block(x0: number, y0: number, x1: number, y1: number, ramp: readonly (readonly number[])[], o?: BlockOpts): void;
    /** Does a world box touch this buffer? */
    sees(x0: number, y0: number, x1: number, y1: number): boolean;
    /** The buffer as canvases: the picture, and the glow (null if nothing glows). */
    canvases(): {
        c: HTMLCanvasElement;
        e: HTMLCanvasElement | null;
    };
}
/** A block's value at each pixel, lit side-on. Flat: its base, a crisp lit
 * top edge, a shaded bottom, the left edge lit and the right shaded, with
 * drips, bands and panel lines. Strokes: slow noise and grain over the base,
 * a beveled lip, soot under, the west face lit and the east shaded. */
export declare function blockV(x0: number, y0: number, x1: number, y1: number, o?: BlockOpts, flat?: boolean): (x: number, y: number) => number;
/** A painting operation: a box in world px (what it may touch), its seed and
 * what it paints. */
export interface Op {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    seed: number;
    fn: (P: Pix) => void;
}
/** Runs the operations whose box touches a buffer, in order, each from its own seed. */
export declare function paintOps(P: Pix, ops: readonly Op[]): Pix;
/** A painted chunk: its picture and glow (null if nothing glows), and where it is. */
export interface Chunk {
    c: HTMLCanvasElement;
    e: HTMLCanvasElement | null;
    x: number;
    y: number;
}
/** The chunk (cx, cy), `size` px square, painted from the operations. */
export declare function chunk(ops: readonly Op[], cx: number, cy: number, size: number, o?: PixOpts): Chunk;
/** How painting ahead looks for work. */
export interface AheadOpts {
    /** How many chunks either side of the one at (x, y) to look, across (3) and down (2). */
    rx?: number;
    ry?: number;
    /** Milliseconds to keep painting the nearest chunks not yet made (0: one chunk). */
    budget?: number;
}
/** A cache of chunks, `size` px square, over a world `w` × `h` px: each made
 * by `make(cx, cy)` when first asked for, kept until `reset` (or, with `max`,
 * until it's the longest unused of too many). */
export declare class Chunks<C> {
    size: number;
    w: number;
    h: number;
    max: number;
    make: (cx: number, cy: number) => C;
    map: Map<string, {
        v: C;
        used: number;
    }>;
    stamp: number;
    constructor(o: {
        size: number;
        make: (cx: number, cy: number) => C;
        w?: number;
        h?: number;
        max?: number;
    });
    /** Lets every chunk go, and takes the world's size anew (if given). */
    reset(world?: {
        w: number;
        h: number;
    }): void;
    key(cx: number, cy: number): string;
    has(cx: number, cy: number): boolean;
    /** Whether a chunk lies in the world. */
    inside(cx: number, cy: number): boolean;
    /** The chunk, made if it's new. */
    get(cx: number, cy: number): C;
    /** The chunk if it's made, without making it. */
    peek(cx: number, cy: number): C | undefined;
    /** The chunks (made if new) a box of the world touches, row by row. */
    over(x0: number, y0: number, x1: number, y1: number): C[];
    /** The nearest chunk in the world not yet made, near the one at (x, y)
     * (fewest steps across and down; the first found in rows on a tie). */
    nearest(x: number, y: number, rx?: number, ry?: number): [number, number] | null;
    /** A frame's spare work: makes the nearest chunk not yet made near (x, y),
     * and more while the budget lasts, so walking into new ground doesn't
     * stall. Returns how many it made. */
    ahead(x: number, y: number, o?: AheadOpts): number;
    /** Lets go of the chunks used longest ago until there are at most `max`. */
    trim(max?: number): void;
    get count(): number;
}
/** A level: its size in world px and its painting operations. */
export interface Level {
    w: number;
    h: number;
    ops: readonly Op[];
}
/** The chunked lazy painter for a level: `reset(level)`, then `get(cx, cy)`
 * for a painted chunk and `ahead(x, y)` in a frame's spare time. */
export declare class Painter extends Chunks<Chunk> {
    level: Level | null;
    pix: PixOpts;
    constructor(o: {
        size: number;
        max?: number;
    } & PixOpts);
    /** A new level: every chunk goes. */
    reset(level?: Level): void;
}
