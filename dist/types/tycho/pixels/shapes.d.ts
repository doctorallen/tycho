/** A color: '#rrggbb' or [r, g, b]. */
export type Color = string | readonly number[];
/** A material: tones from dark to light. */
export type Ramp = readonly Color[];
/** What a shape takes besides its place and ramp. */
export interface ShapeOpts {
    /** The darkest and lightest tones of the ramp it uses (0 and the last). */
    lo?: number;
    hi?: number;
    /** Lighter (> 0) or darker overall. */
    bias?: number;
    /** It lights itself (it goes on the glow picture too). */
    glow?: boolean;
    /** Only where this says (x, y) is in. */
    mask?: (x: number, y: number) => boolean;
    /** A polygon's shading down it (0.18; flat, 0 unless given). */
    down?: number;
    /** A soft polygon's folds of cloth. */
    folds?: boolean;
}
/** A finished sprite: its picture, what glows of it (or null), its size and
 * its anchor (the feet: the bottom middle unless moved). */
export interface Sprite {
    c: HTMLCanvasElement;
    e: HTMLCanvasElement | null;
    w: number;
    h: number;
    ax: number;
    ay: number;
}
/** The finish's look. */
export interface ShapesLook {
    /** What outlines and shadow lines are mixed toward ([8, 6, 12], soot). */
    ink: readonly number[];
    /** How far a shadow line goes toward the ink (0.45). */
    shadow: number;
    /** How far the outline goes toward it from the darkest pixel it borders (0.72). */
    edge: number;
}
export declare class Shapes {
    /** The White Dragon's finish. */
    static LOOK: ShapesLook;
    w: number;
    h: number;
    seed: number;
    n: number;
    /** Each pixel's color (null: clear), whether it glows, and its part. */
    c: (readonly number[] | null)[];
    g: Uint8Array;
    p: Uint8Array;
    /** The anchor. */
    ax: number;
    ay: number;
    /** Flat tones (or soft runs), and an outline with shadow lines. */
    flat: boolean;
    line: boolean;
    /** The part being drawn, and the parts that cast no shadow line. */
    pid: number;
    soft: Set<number>;
    look: ShapesLook;
    constructor(w: number, h: number, seed?: number, look?: Partial<ShapesLook>);
    /** A flat figure, outlined (the default). */
    static figure(w: number, h: number, seed?: number, look?: Partial<ShapesLook>): Shapes;
    /** Soft runs of close tones, no outline. */
    static soft(w: number, h: number, seed?: number, look?: Partial<ShapesLook>): Shapes;
    /** The next shapes are a new part, drawn over what came before; a part
     * that doesn't cast (hair on a face) leaves no shadow line on what's under it. */
    part(cast?: boolean): void;
    /** The sprite's own seeded stream (soft runs). */
    rnd(): number;
    /** A tone from a shading value, flat: shadow, base or light. */
    band(s: number, lo: number, hi: number): number;
    /** One pixel (rounded; off the sprite, or no color, it's nothing). */
    px(x: number, y: number, col: Color | null | undefined, glow?: boolean): void;
    get(x: number, y: number): readonly number[] | null;
    /** A rounded volume: its tone from how it faces the upper left. */
    ell(cx: number, cy: number, rx: number, ry: number, ramp: Ramp, o?: ShapeOpts): void;
    /** A box: flat, a panel lit along its top and left; soft, a rounded volume filled out to its corners. */
    box(x0: number, y0: number, x1: number, y1: number, ramp: Ramp, o?: ShapeOpts): void;
    /** A limb from a to b, w wide: lit along its upper-left side. */
    limb(ax: number, ay: number, bx: number, by: number, w: number, ramp: Ramp, o?: ShapeOpts): void;
    /** A capsule from a (radius ra) to b (radius rb): a limb with volume, its
     * tone from how its surface faces the upper left. */
    cap(ax: number, ay: number, bx: number, by: number, ra: number, rb: number, ramp: Ramp, o?: ShapeOpts): void;
    /** A shape from a polygon, shaded across each row (lit on its left, shaded
     * on its right) and down it, like cloth over a body. */
    shape(pts: readonly (readonly number[])[], ramp: Ramp, o?: ShapeOpts): void;
    /** A polygon in one color (or a color a pixel, from col(x, y)). */
    poly(pts: readonly (readonly number[])[], col: Color | ((x: number, y: number) => Color | null)): void;
    /** A figure's finish: a shadow line on a part where a later part lies on
     * it, then a dark outline round the whole (not round glow alone). */
    finish(): void;
    /** The sprite: outlined (if `line`), as a picture and, if anything glows,
     * a glow picture. */
    done(): Sprite;
}
