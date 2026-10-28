import type { Grid } from './grid';
/** A box: from x0, y0 to x1, y1 (world px; x1 > x0, y1 > y0). */
export interface Box {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}
/** A one-way surface from (x0, y0) to (x1, y1), x0 <= x1: flat (a walkway) or sloped (stairs). */
export interface Way {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}
/** A ladder at x from y0 (its top) down to y1. */
export interface Ladder {
    x: number;
    y0: number;
    y1: number;
}
/** A round solid: its middle and its radii. */
export interface Ellipse {
    x: number;
    y: number;
    rx: number;
    ry: number;
}
/** A list kept by reference, or a function that gives the list as it is now. */
export type List<T> = readonly T[] | (() => readonly T[]);
/** What a ray hit first: how far along (0..1), where, and what (a box, a tile or an ellipse). */
export interface Hit {
    t: number;
    x: number;
    y: number;
    box?: Box;
    tile?: {
        x: number;
        y: number;
        v: number;
    };
    ellipse?: Ellipse;
}
export interface TilesDef {
    /** World px a tile. */
    size: number;
    /** By tile value: is it solid? (truthy for solid) */
    solid: ArrayLike<unknown>;
    /**
     * Felt along a smooth line instead of as squares (Lodestar's wall line):
     * at a point, the four nearest tiles' solidity blended, with a little of
     * `noise(x, y)` (-1..1) times `amp` added, solid past a half. Where two
     * open tiles meet only at a corner the blend is cut by `pinch` (0.55),
     * so the diagonal stays open wide enough to walk.
     */
    smooth?: {
        noise?: (x: number, y: number) => number;
        amp?: number;
        pinch?: number;
    };
}
/** A grid's layer felt as solid: square tiles, or a smooth line through them. */
export declare class Tiles {
    readonly grid: Grid;
    readonly layer: number;
    readonly size: number;
    readonly solid: ArrayLike<unknown>;
    readonly smooth: boolean;
    private readonly noise;
    private readonly amp;
    private readonly pinch;
    private readonly cells;
    private readonly w;
    private readonly h;
    constructor(grid: Grid, layer: number, def: TilesDef);
    /** The tile under world px x, y. */
    tileAt(x: number, y: number): number;
    /** Is world px x, y solid? (by `solid`, or another table, such as which tiles rise as rock) */
    at(x: number, y: number, solid?: ArrayLike<unknown>): boolean;
    /** Square tiles: the first solid tile (row by row) under the box, as a box. */
    box(x0: number, y0: number, x1: number, y1: number): Box | null;
}
export declare class Space {
    private readonly boxSets;
    private readonly tileSets;
    private readonly ellipseSets;
    private readonly waySets;
    private readonly ladderSets;
    private side;
    /** The points round a body's edge, as [cos, sin] (eight, evenly round). */
    readonly ring: readonly [number, number][];
    /** Solid boxes: the list's items, or what `pick` makes of each (nothing for one that isn't solid now). */
    boxes<T>(list: List<T>, pick?: (item: T) => Box | null | undefined | false): this;
    /** Solid walls either side of the world: everything left of x0 and right of x1. */
    bounds(x0: number, x1: number): this;
    /** A grid's tiles. */
    tiles(t: Tiles): this;
    /** Round solids. */
    ellipses(list: List<Ellipse>): this;
    /** One-way surfaces: walkways and stairs. */
    ways(list: List<Way>): this;
    /** Ladders, taken within `reach` px of their line (6). */
    ladders(list: List<Ladder>, reach?: number): this;
    /**
     * The first solid that the box x0..x1, y0..y1 overlaps (edges touching
     * don't count): the boxes in the order given, square tiles, then the
     * sides (a wall 100 px thick and 2e4 tall); null when it's clear.
     */
    hits(x0: number, y0: number, x1: number, y1: number): Box | null;
    /** Is the point solid in any grid's tiles? */
    inTiles(x: number, y: number): boolean;
    /** Is the point solid: in the tiles, a box (its left and top edges in, right and bottom out), an ellipse, or past the sides? */
    solidAt(x: number, y: number): boolean;
    /**
     * Does a round body of radius r at x, y touch anything solid? Felt in the
     * tiles at its middle and the eight points round its edge (so a smooth
     * wall line is met where it matters), and by overlap with ellipses
     * (grown by r), boxes and the sides.
     */
    circleHits(x: number, y: number, r: number): boolean;
    /** How far into the tiles a round body is: its edge's points in them, its middle counting double. */
    circleDepth(x: number, y: number, r: number): number;
    /** The height of the highest one-way surface at x between y0 and y1 (inclusive), or null. */
    way(x: number, y0: number, y1: number): number | null;
    /** The first ladder within reach of x whose span overlaps y0..y1, or null. */
    ladderAt(x: number, y0: number, y1: number): Ladder | null;
    /**
     * What the ray from x0, y0 to x1, y1 hits first, or null if it gets there:
     * boxes and the sides by their edges, square tiles cell by cell as the
     * line crosses them, smooth tiles felt every `step` px along it (1), and
     * ellipses exactly. A ray that starts inside something hits it at t = 0.
     */
    ray(x0: number, y0: number, x1: number, y1: number, step?: number): Hit | null;
}
