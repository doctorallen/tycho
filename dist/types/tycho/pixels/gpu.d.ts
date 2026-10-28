/** What a quad is drawn into, and how. */
export declare const F: {
    readonly EM: 1;
    readonly COL: 2;
    readonly SOLID: 4;
    readonly SMOOTH: 8;
    readonly GROUND: 16;
    readonly GROUNDEM: 32;
    readonly DYN: 64;
    readonly MAP: 128;
};
/** The canvas blend modes the batcher has. */
export declare const BLEND: Record<string, number>;
/** A vertex shader for full-view passes: one triangle over everything. */
export declare const TRI_VS = "#version 300 es\nvoid main() { vec2 p = vec2(float((gl_VertexID & 1) * 4) - 1.0, float((gl_VertexID & 2) * 2) - 1.0); gl_Position = vec4(p, 0.0, 1.0); }";
export interface Program {
    p: WebGLProgram;
    u: Record<string, WebGLUniformLocation | null>;
}
export interface Pic {
    x: number;
    y: number;
    w: number;
    h: number;
    page: number;
    ref: WeakRef<CanvasImageSource & {
        width: number;
        height: number;
    }>;
    used: number;
    dead: boolean;
}
interface Run {
    start: number;
    n: number;
    blend: number;
    clip: number[] | null;
    dyn: {
        tex: WebGLTexture;
    } | null;
    clear?: false;
}
interface Clear {
    clear: true;
    em: boolean;
    x: number;
    y: number;
    w: number;
    h: number;
}
interface Pass {
    s: number;
    a: number;
    pw: number;
    ph: number;
    tex: WebGLTexture;
    fb: WebGLFramebuffer;
    ox: number;
    oy: number;
}
type Source = CanvasImageSource & {
    width: number;
    height: number;
    gpuOwn?: boolean;
    getContext?: (k: '2d') => CanvasRenderingContext2D | null;
};
export interface GpuOptions {
    /** The atlas's page size (px square), its first and most pages, how many
     * frames an unused picture is kept when the pages are rebuilt. */
    atlas?: number;
    pages?: number;
    maxPages?: number;
    keep?: number;
    /** How many vertex buffers in the ring (none the GPU may read is written). */
    ring?: number;
    /** Compile the rule that puts what stands in front of a quad's feet back
     * over it, from the ground's lift texture (Lodestar's rock). */
    occlude?: boolean;
    /** Called with errors (a shader that won't compile, a lost context). */
    onError?: (e: unknown) => void;
    /** Context attributes beyond the defaults. */
    attributes?: WebGLContextAttributes;
}
/** The GPU's frame for one canvas. `Gpu.create(canvas)` is null where there's
 * no WebGL2 (or with ?nogpu in the address): draw on 2D canvases then. */
export declare class Gpu {
    gl: WebGL2RenderingContext;
    canvas: HTMLCanvasElement;
    o: Required<Omit<GpuOptions, 'onError' | 'attributes'>> & GpuOptions;
    on: boolean;
    w: number;
    h: number;
    /** The frame's camera: view px of the ground's origin. */
    ox: number;
    oy: number;
    /** The occlusion mode for the quads pushed next: -2 none, -1 flat on the
     * ground (anything lifted covers it), else the feet's view row. */
    feet: number;
    frame: number;
    stats: {
        quads: number;
        draws: number;
        uploads: number;
    };
    q: Float32Array<ArrayBuffer>;
    n: number;
    cap: number;
    runs: (Run | Clear)[];
    cur: Run | null;
    target: 'scene' | 'lit' | 'canvas';
    blend: number;
    clip: number[] | null;
    dyn: {
        tex: WebGLTexture;
    } | null;
    litDone: boolean;
    drawn: boolean;
    oq: Float32Array<ArrayBuffer>;
    on_: number;
    ocap: number;
    odyn: {
        tex: WebGLTexture;
    } | null;
    quad: Program;
    bloomP: Program;
    outP: Program;
    vao: WebGLVertexArrayObject;
    triVao: WebGLVertexArrayObject;
    bufs: WebGLBuffer[];
    bi: number;
    attribs: [number, number, number][];
    boundFb: WebGLFramebuffer | null | undefined;
    atlasTex: WebGLTexture | null;
    pages: number;
    shelves: {
        y: number;
        rows: {
            y: number;
            h: number;
            x: number;
        }[];
    }[];
    pics: WeakMap<object, Pic>;
    entries: Pic[];
    dynTexs: WeakMap<object, {
        texs: WebGLTexture[];
        i: number;
        tex: WebGLTexture | null;
        w: number;
        h: number;
    }>;
    groundCol: WebGLTexture;
    groundEm: WebGLTexture;
    lift: WebGLTexture;
    dynTex: WebGLTexture;
    mapTex: WebGLTexture;
    groundW: number;
    groundH: number;
    groundOn: boolean;
    groundX: number;
    groundY: number;
    groundSrc: [object | null, object | null];
    groundDirtyBoxes: number[][];
    /** Called before a frame draws from the ground, while boxes wait to go up
     * (the game calls groundSync with its pixels). */
    onGroundDraw: (() => void) | null;
    private spare;
    private shiftFb;
    private box;
    map: {
        org: number[];
        cell: number;
        w: number;
        h: number;
    };
    scene: {
        fb: WebGLFramebuffer;
    };
    lit: {
        fb: WebGLFramebuffer;
    };
    sceneCol: WebGLTexture;
    sceneEm: WebGLTexture;
    litTex: WebGLTexture;
    passes: Pass[];
    bloomSpec: [number, number][];
    static create(canvas: HTMLCanvasElement, o?: GpuOptions): Gpu | null;
    constructor(canvas: HTMLCanvasElement, o?: GpuOptions);
    private err;
    /** Compiles a program from a vertex and a fragment shader, with the
     * locations of the uniforms named. */
    program(vs: string, fs: string, uniforms: string[]): Program;
    /** A texture on a unit, nearest or linear, clamped. */
    tex(unit: number, kind?: number, filter?: number): WebGLTexture;
    init(): boolean;
    /** The framebuffers at the view's size; `bloom` the grid bloom's passes,
     * [size of a cell in view px, strength] each (at most four). */
    resize(w: number, h: number, bloom?: [number, number][]): void;
    atlasInit(pages: number): void;
    private place;
    private upload;
    private rebuild;
    /** Where a canvas (or image) is on the pages, placing it the first time. */
    pic(src: Source): Pic | null;
    /** Pictures onto the pages ahead of their first frame (while loading). */
    warm(...srcs: (Source | null | undefined)[]): void;
    /** A canvas drawn before has been painted again: read anew next time. */
    dirty(src: object): void;
    /** A picture of its own (bigger than a page, or pixels rewritten each
     * frame): a 2D texture (a ring of three), the rows y0..y1 of `img`
     * uploaded. Returns what a run draws from. */
    ownTex(src: object & {
        width: number;
        height: number;
    }, img: ImageData | null, y0?: number, y1?: number): {
        tex: WebGLTexture;
        w: number;
        h: number;
    };
    groundStart(W: number, H: number, col?: object | null, em?: object | null): void;
    /** The ground's window moved by (dx, dy): its textures shifted on the GPU,
     * so only the strips exposed go up as they're painted. False if it can't. */
    groundShift(dx: number, dy: number): boolean;
    /** A box of the ground painted since: it goes up before the ground is next drawn. */
    groundDirty(x0: number, y0: number, x1: number, y1: number): void;
    get groundPending(): boolean;
    /** The boxes waiting go up from the ground's pixels (whole-ground arrays:
     * color and glow RGBA, lift one byte a pixel). */
    groundSync(col: Uint8Array | Uint8ClampedArray | null, em: Uint8Array | Uint8ClampedArray | null, lift: Uint8Array | null): void;
    /** The light map that MAP quads multiply by: cells (RGBA, w × h), each
     * `cell` view px, the grid's origin at view px org. */
    setMap(cells: Uint8Array | Uint8ClampedArray, w: number, h: number, cell: number, org: [number, number]): void;
    bind(fb: WebGLFramebuffer | null): void;
    private run;
    /** A quad. over: onto the overlay's queue. xf: the 2 × 2 linear part of
     * the transform (default none). */
    push(over: boolean, x: number, y: number, w: number, h: number, u0: number, v0: number, u1: number, v1: number, page: number, r: number, g: number, b: number, a: number, flags: number, xf?: number[] | null): void;
    /** The state the quads pushed next are drawn with. */
    state(blend: number, clip: number[] | null, dyn: {
        tex: WebGLTexture;
    } | null): void;
    /** A whole-layer clear, in its place in the order. */
    clearLayer(em: boolean, x: number, y: number, w: number, h: number): void;
    private blendSet;
    private scissor;
    private fbOf;
    private ready;
    private drawRun;
    /** The phase drawn: its runs in order, into the target. */
    flush(): void;
    drop(): void;
    /** A frame begins: the scene's layers cleared (color to black, glow to
     * nothing), the contexts reset. */
    frameBegin(ctxs?: (Ctx | null | undefined)[]): void;
    /** Nothing to show: the lit picture and the glow black. */
    blank(): void;
    /** The scene is drawn: a light pass runs from it into the lit picture
     * (bind its program after this), and what's drawn after goes over that. */
    lightBegin(): void;
    lightEnd(): void;
    /** A whole light pass: `prog`'s fragment shader over the scene (its color
     * on unit 5 as `uScene`), the uniforms set by `set`, into the lit picture. */
    lightPass(prog: Program, set: (gl: WebGL2RenderingContext, u: Program['u']) => void): void;
    private plainP;
    /** No light this frame (a picture lit already): the scene as drawn
     * becomes the lit picture, and what's drawn after goes over it. */
    plain(): void;
    /** For tests: a layer's pixels read back (rows from the top, RGBA,
     * premultiplied): 'scene', 'lit' or 'glow'. Slow; never in a frame. */
    read(which: 'scene' | 'lit' | 'glow'): {
        w: number;
        h: number;
        data: Uint8Array;
    };
    /** The grid bloom's passes from the glow layer, on the world's grid; cx,
     * cy the camera in the world (view px). */
    bloom(cx: number, cy: number): void;
    /** What's queued over the lit picture drawn (before a finish of the game's
     * own, post.ts); false if the frame never got as far as the light. */
    litReady(): boolean;
    /** The frame onto the canvas: the lit picture with the grid bloom added,
     * then the overlay's quads. */
    frameEnd(): void;
    /** The overlay's quads, unlit, onto the canvas. */
    overlay(): void;
    /** A stand-in for a 2D context drawing into `layers` (F.COL, F.EM or both);
     * `over`: onto the overlay's queue, unlit over the finished frame. */
    ctx(layers: number, over?: boolean): Ctx;
}
export declare function parseColor(s: string): number[];
/** A linear gradient a Ctx can fill with (two or more stops). */
export declare class Gradient {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    stops: [number, number[]][];
    constructor(x0: number, y0: number, x1: number, y1: number);
    addColorStop(t: number, color: string): void;
    /** The color at t (0..1 along it), unpremultiplied [r, g, b, a]. */
    at(t: number): number[];
}
/** A stand-in for a 2D context on a Gpu (gpu.ctx(layers)): fillRect,
 * clearRect, drawImage, globalAlpha, globalCompositeOperation (source-over,
 * lighter, destination-out, multiply), save/restore, translate, scale,
 * rotate, setTransform, a rect clip, fillStyle as a color or a linear
 * gradient; plus `tint` (a color the next pictures are multiplied by),
 * `lightMap` (pictures multiplied by the light map, light.ts) and
 * drawPixels (an ImageData rewritten each frame). */
export declare class Ctx {
    gpu: Gpu;
    layers: number;
    over: boolean;
    canvas: HTMLCanvasElement;
    readonly isGpu = true;
    /** For code that checks: this is the GPU's stand-in. */
    get gpuCtx(): true;
    globalAlpha: number;
    imageSmoothingEnabled: boolean;
    /** Pictures drawn are multiplied by this color ([r, g, b] 0..1), or not. */
    tint: number[] | null;
    /** Pictures drawn are multiplied by the light map (light.ts's smooth model). */
    lightMap: boolean;
    private _fs;
    private _rgba;
    private _op;
    private _blend;
    m: number[];
    clipBox: number[] | null;
    path: number[] | null;
    private stack;
    constructor(gpu: Gpu, layers: number, over?: boolean);
    reset(): void;
    get fillStyle(): string | Gradient;
    set fillStyle(v: string | Gradient);
    get globalCompositeOperation(): string;
    set globalCompositeOperation(v: string);
    get tx(): number;
    set tx(v: number);
    get ty(): number;
    set ty(v: number);
    save(): void;
    restore(): void;
    translate(x: number, y: number): void;
    scale(sx: number, sy: number): void;
    rotate(a: number): void;
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
    resetTransform(): void;
    private plain;
    beginPath(): void;
    rect(x: number, y: number, w: number, h: number): void;
    closePath(): void;
    clip(): void;
    createLinearGradient(x0: number, y0: number, x1: number, y1: number): Gradient;
    private setState;
    private quad;
    fillRect(x: number, y: number, w: number, h: number): void;
    private fillGradient;
    clearRect(x: number, y: number, w: number, h: number): void;
    drawImage(img: Source, a1: number, a2: number, a3?: number, a4?: number, a5?: number, a6?: number, a7?: number, a8?: number): void;
    /** Pixels rewritten each frame (an ImageData): the box sx, sy, sw, sh of
     * them at dx, dy (scaled to dw × dh if given, smoothly with
     * imageSmoothingEnabled), uploaded (the rows that changed) and drawn. */
    drawPixels(img: ImageData, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw?: number, dh?: number): void;
}
export {};
