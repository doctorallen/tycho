/** A layer's tiles, row by row. */
export type Cells = Uint8Array | Uint16Array;
export interface LayerDef {
    name: string;
    /** Bits a tile: 8 (the default) or 16. */
    bits?: 8 | 16;
    /** What a tile starts as (0). */
    fill?: number;
    /** What `get` answers outside the grid (the fill). */
    edge?: number;
    /** A flat grid's tiles, w × h row by row: used as they are, never copied. */
    data?: Cells;
}
export interface GridDef {
    w: number;
    h: number;
    layers: LayerDef[];
    /** The chunks' side in tiles, a power of two (32). */
    chunk?: number;
    /** Each layer as one w × h array (always so when a layer brings its data). */
    flat?: boolean;
    /** A chunked grid's chunk made the first time it's touched: fill its cells from the seed. */
    make?: (chunk: Chunk, grid: Grid) => void;
}
/** A chunk of a chunked grid: its place, and a layer's cells each (side × side, row by row). */
export interface Chunk {
    cx: number;
    cy: number;
    /** Its first tile. */
    x0: number;
    y0: number;
    cells: Cells[];
}
/** Tiles from x0, y0 up to (not including) x1, y1. */
export interface Rect {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}
/** The changes from what the seed made, by layer name: x, y, value, x, y, value... in rows. */
export type Changes = Record<string, number[]>;
export declare class Grid {
    readonly w: number;
    readonly h: number;
    /** The chunks' side in tiles. */
    readonly chunk: number;
    /** Chunks across and down. */
    readonly cw: number;
    readonly ch: number;
    readonly flat: boolean;
    readonly names: string[];
    readonly edges: number[];
    private readonly defs;
    private readonly shift;
    private readonly mask;
    private readonly make?;
    private readonly data;
    private readonly chunks;
    private readonly dirtyBox;
    private sealed;
    private readonly orig;
    constructor(def: GridDef);
    /** A layer's index by name. */
    layer(name: string): number;
    /** The tile at x, y (whole tiles) in layer l; the layer's edge value outside. */
    get(l: number, x: number, y: number): number;
    /** Sets a tile (false outside the grid): its chunk's rectangle is marked changed and, once sealed, the change kept. */
    set(l: number, x: number, y: number, v: number): boolean;
    /** Fills the tiles from x0, y0 up to x1, y1 (clipped to the grid). */
    fill(l: number, x0: number, y0: number, x1: number, y1: number, v: number): void;
    /** A flat grid's layer: its w × h tiles (the array it was given, if it was). */
    array(l: number): Cells;
    /** Has the chunk at cx, cy been made? (A flat grid's always have.) */
    has(cx: number, cy: number): boolean;
    /** A chunked grid's chunk at cx, cy, made if it hasn't been. */
    chunkAt(cx: number, cy: number): Chunk;
    /** The rectangles of tiles changed since the last take, one a chunk, in rows of chunks. */
    takeDirty(): Rect[];
    /** What's in the grid now is what the seed made: from here on every change from it is kept. */
    seal(): void;
    /** Every tile that isn't what the seed made, by layer, in rows: for a save. */
    changes(): Changes;
    /** Puts a save's changes back (over a world made again from its seed and sealed). */
    apply(changes: Changes): void;
}
