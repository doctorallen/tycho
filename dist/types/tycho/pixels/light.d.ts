import { Gpu, Program } from './gpu';
export interface SmoothFrame {
    /** The light map's cells, RGBA (alpha unused), `w` × `h`. */
    cells: Uint8Array | Uint8ClampedArray;
    w: number;
    h: number;
    /** View px a cell. */
    cell: number;
    /** Where the grid's first cell's corner is, in view px (it's scaled up
     * from there, as a 2D canvas draws it scaled with smoothing). */
    org: [number, number];
    /** How much of the light is added over the multiplied scene (0.1: the
     * White Dragon's "lighter" pass at a tenth). */
    add?: number;
}
/** The White Dragon's light: the scene × the light map + a little of the map. */
export declare class Smooth {
    gpu: Gpu;
    prog: Program;
    constructor(gpu: Gpu);
    /** Lights the scene drawn so far into the lit picture. */
    draw(f: SmoothFrame): void;
}
