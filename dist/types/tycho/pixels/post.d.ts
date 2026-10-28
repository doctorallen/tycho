import { Gpu, Program } from './gpu';
/** A wet strip, in view px: it reflects what's above y0 down to y0 + depth. */
export interface Wet {
    x0: number;
    y0: number;
    x1: number;
    depth: number;
    k: number;
}
export interface BlurFrame {
    /** The view's scale onto the canvas (canvas px a view px). */
    out: number;
    wets?: Wet[];
    /** 0..1: black over everything. */
    fade?: number;
    /** Seconds, for the ripples. */
    time?: number;
    /** The bloom layers' strengths (0.8 and 0.55). */
    near?: number;
    far?: number;
}
export declare class Blur {
    gpu: Gpu;
    down: Program;
    blur: Program;
    comp: Program;
    fb: {
        t: WebGLTexture;
        f: WebGLFramebuffer;
        w: number;
        h: number;
    }[];
    w: number;
    h: number;
    sampler: WebGLSampler;
    constructor(gpu: Gpu);
    private size;
    private pass;
    /** The frame onto the canvas, from the Gpu's lit picture and glow. */
    finish(o: BlurFrame): void;
}
