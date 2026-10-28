/** A layer's tiles (any typed array or list of numbers). */
export type CellsLike = ArrayLike<number>;
export declare function distances(cells: CellsLike, w: number, h: number, x: number, y: number, solid: ArrayLike<unknown>, avoid?: ArrayLike<number> | null, out?: Int16Array | Int32Array): Int16Array | Int32Array;
export interface AStarFind {
    /** Can a body stand on tile x, y? (Asked only inside the grid.) */
    walkable: (x: number, y: number) => boolean;
    /** What stepping onto x, y from fx, fy costs before the diagonal's share (1). */
    cost?: (x: number, y: number, fx: number, fy: number) => number;
    /** A start or goal that isn't walkable moves to the nearest walkable tile within this many (7; 0 for none). */
    snap?: number;
}
/**
 * A* over a w × h grid, eight ways round, never cutting a corner past a
 * tile that isn't walkable; a diagonal step costs `diag` (1.414) times a
 * straight one; the estimate is the octile distance at the same rate; at
 * most `cap` tiles are taken from the open list a search. Its buffers are
 * kept between searches (g and f as 32-bit floats, as Merryfolk keeps them).
 */
export declare class AStar {
    readonly w: number;
    readonly h: number;
    cap: number;
    readonly diag: number;
    private readonly g;
    private readonly f;
    private readonly from;
    private readonly stamp;
    private readonly closed;
    private gen;
    private readonly heap;
    constructor(w: number, h: number, o?: {
        cap?: number;
        diag?: number;
    });
    /** The nearest walkable tile to x, y within r rings of it (rings outward, rows top to bottom), or null. */
    near(x: number, y: number, walkable: (x: number, y: number) => boolean, r?: number): [number, number] | null;
    /** The way from sx, sy to tx, ty: its tiles after the start, the goal last ([[tx, ty]] if they're one); null if there's none within the cap. */
    find(sx: number, sy: number, tx: number, ty: number, o: AStarFind): [number, number][] | null;
}
/** A route: what it costs in all, the places it passes (the first and last included), and the links' legs in order. */
export interface Route<L> {
    cost: number;
    places: string[];
    legs: L[];
}
/**
 * Places joined by links, each with a cost (minutes, px at walking pace,
 * whatever the game counts in) and a leg the game describes it by. The
 * cheapest route is found by Dijkstra's search; between routes that cost
 * the same, the one whose links were added first.
 */
export declare class Routes<L = unknown> {
    private readonly out;
    private seq;
    /** A link from a to b (and back, with the same leg, unless oneWay). */
    link(a: string, b: string, cost: number, leg?: L, oneWay?: boolean): this;
    private add;
    /** The places linked so far. */
    places(): string[];
    /** The cheapest route from a to b, or null if none joins them. */
    route(a: string, b: string): Route<L> | null;
}
