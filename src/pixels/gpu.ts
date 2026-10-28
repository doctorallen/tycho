// The frame on the GPU (Lodestar's design, docs/renderer.md). Where there's
// WebGL2 the view is one WebGL canvas, and everything a frame draws goes
// through a batcher that stands in for the 2D contexts (Ctx: fillRect,
// drawImage, globalAlpha, the blend modes, save/restore, translate, scale,
// rotate, a rect clip, a linear gradient), so a game's drawing code is the
// same either way. Each call becomes a quad: a sprite's pixels live in an
// atlas (texture-array pages, uploaded once from the canvas the game painted),
// pictures rewritten each frame go up as textures of their own, and a big
// painted ground can go up as textures by the box as it's painted. Nothing is
// drawn twice and nothing is read back.
//
// A frame: the scene into a framebuffer with a color and a glow attachment;
// a light pass (a light model, light.ts) from that into the lit picture; what
// the game draws after the light (figures lit by a tint, rain) over that; then
// a finish (post.ts, or the grid bloom and last pass here) onto the canvas,
// with an unlit overlay's quads over it. Without WebGL2 the same calls run on
// 2D canvases and the game lights them in JavaScript.

/** What a quad is drawn into, and how. */
export const F = { EM: 1, COL: 2, SOLID: 4, SMOOTH: 8, GROUND: 16, GROUNDEM: 32, DYN: 64, MAP: 128 } as const;
/** The canvas blend modes the batcher has. */
export const BLEND: Record<string, number> = { 'source-over': 0, lighter: 1, 'destination-out': 2, multiply: 3, copy: 0, 'source-in': 0 };

// floats a quad: rect x y w h, uv u0 v0 u1 v1, page, tint r g b a, feet, flags, transform a b c d
const Q = 19;
const ZERO = new Float32Array([0, 0, 0, 0]), BLACK = new Float32Array([0, 0, 0, 1]);

const QUAD_VS = `#version 300 es
in vec4 aRect; in vec4 aUV; in float aPage; in vec4 aTint; in float aFeet; in float aFlags; in vec4 aXf;
uniform vec2 uViewF;
out vec2 vUV; flat out vec4 vBox; flat out float vPage; out vec4 vTint; flat out float vFeet; flat out int vFlags;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vec2 p = aRect.xy + mat2(aXf.x, aXf.y, aXf.z, aXf.w) * (c * aRect.zw);
  gl_Position = vec4(p.x / uViewF.x * 2.0 - 1.0, 1.0 - p.y / uViewF.y * 2.0, 0.0, 1.0);
  vUV = aUV.xy + c * (aUV.zw - aUV.xy);
  vBox = aUV; vPage = aPage; vTint = aTint; vFeet = aFeet; vFlags = int(aFlags);
}`;

function quadFS(occlude: boolean): string {
  return `#version 300 es
precision highp float; precision highp int; precision highp sampler2DArray; precision highp sampler2D;
in vec2 vUV; flat in vec4 vBox; flat in float vPage; in vec4 vTint; flat in float vFeet; flat in int vFlags;
uniform sampler2DArray uAtlas;
uniform sampler2D uGroundCol, uGroundEm, uLift, uDyn, uMap;
uniform ivec2 uView, uCam, uGroundSize;
uniform int uBlend;
uniform vec2 uMapOrg; uniform float uMapCell; uniform ivec2 uMapSize;
layout(location = 0) out vec4 oCol;
layout(location = 1) out vec4 oEm;
vec4 page(vec2 t) { return texelFetch(uAtlas, ivec3(ivec2(floor(t)), int(vPage)), 0); }
vec4 dyn(vec2 t) { return texelFetch(uDyn, ivec2(floor(t)), 0); }
vec4 mapAt(vec2 t) { return texelFetch(uMap, clamp(ivec2(t), ivec2(0), uMapSize - 1), 0); }
void main() {
  vec4 c;
  bool smooth_ = (vFlags & ${F.SMOOTH}) != 0;
  if ((vFlags & ${F.SOLID}) != 0) c = vec4(1.0);
  else if ((vFlags & ${F.GROUND}) != 0) c = texelFetch(uGroundCol, ivec2(floor(vUV)), 0);
  else if ((vFlags & ${F.GROUNDEM}) != 0) c = texelFetch(uGroundEm, ivec2(floor(vUV)), 0);
  else if (smooth_) {
    // bilinear, within the picture's own box
    vec2 t = clamp(vUV - 0.5, vBox.xy, vBox.zw - 1.0), f = fract(t), t0 = floor(t);
    vec2 t1 = min(t0 + 1.0, vBox.zw - 1.0);
    if ((vFlags & ${F.DYN}) != 0) c = mix(mix(dyn(t0), dyn(vec2(t1.x, t0.y)), f.x), mix(dyn(vec2(t0.x, t1.y)), dyn(t1), f.x), f.y);
    else c = mix(mix(page(t0), page(vec2(t1.x, t0.y)), f.x), mix(page(vec2(t0.x, t1.y)), page(t1), f.x), f.y);
  }
  else if ((vFlags & ${F.DYN}) != 0) c = dyn(vUV);
  else c = page(vUV);
  c *= vTint;
  if ((vFlags & ${F.MAP}) != 0) {
    // multiplied by the light map, scaled up smooth from its cells
    vec2 p = vec2(gl_FragCoord.x, float(uView.y) - gl_FragCoord.y);
    vec2 t = (p - uMapOrg) / uMapCell - 0.5, f = fract(t), t0 = floor(t);
    vec3 m = mix(mix(mapAt(t0), mapAt(t0 + vec2(1.0, 0.0)), f.x), mix(mapAt(t0 + vec2(0.0, 1.0)), mapAt(t0 + 1.0), f.x), f.y).rgb;
    c.rgb *= m;
  }
${occlude ? `  // what stands in front of the quad's feet: its pixel instead (Lodestar's rock)
  if (vFeet > -1.5 && c.a > 0.0) {
    int px = int(gl_FragCoord.x), py = uView.y - 1 - int(gl_FragCoord.y);
    ivec2 fp = ivec2(px - uCam.x, py - uCam.y);
    if (fp.x >= 0 && fp.y >= 0 && fp.x < uGroundSize.x && fp.y < uGroundSize.y) {
      float lift = texelFetch(uLift, fp, 0).r * 255.0;
      if (lift > 0.5 && (vFeet < -0.5 || float(py) + lift - 1.0 > vFeet + 0.5)) {
        if (uBlend != 0) discard;
        oCol = (vFlags & ${F.COL}) != 0 ? texelFetch(uGroundCol, fp, 0) * c.a : vec4(0.0);
        oEm = (vFlags & ${F.EM}) != 0 ? texelFetch(uGroundEm, fp, 0) * c.a : vec4(0.0);
        return;
      }
    }
  }
` : ''}  oCol = (vFlags & ${F.COL}) != 0 ? c : vec4(0.0);
  oEm = (vFlags & ${F.EM}) != 0 ? c : vec4(0.0);
}`;
}

/** A vertex shader for full-view passes: one triangle over everything. */
export const TRI_VS = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID & 1) * 4) - 1.0, float((gl_VertexID & 2) * 2) - 1.0); gl_Position = vec4(p, 0.0, 1.0); }`;

// A bloom pass on the world's grid: each pixel the mean of the glow layer
// over its s × s pixels (Lodestar's).
const BLOOM_FS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uEm; uniform ivec2 uView; uniform ivec2 uOut; uniform float uS; uniform vec2 uOrg;
out vec4 o;
void main() {
  int i = int(gl_FragCoord.x), j = uOut.y - 1 - int(gl_FragCoord.y);
  float x0 = uOrg.x + float(i) * uS, y0 = uOrg.y + float(j) * uS;
  int xa = int(floor(x0)), xb = int(floor(x0 + uS)), ya = int(floor(y0)), yb = int(floor(y0 + uS));
  vec4 sum = vec4(0.0); float n = 0.0;
  for (int y = ya; y < yb; y++) for (int x = xa; x < xb; x++) {
    n += 1.0;
    if (x < 0 || y < 0 || x >= uView.x || y >= uView.y) continue;
    sum += texelFetch(uEm, ivec2(x, uView.y - 1 - y), 0);
  }
  o = n > 0.0 ? sum / n : vec4(0.0);
}`;

// The last pass: the lit picture plus the grid bloom's passes (sampled
// smoothly on the world's grid), onto the canvas.
const OUT_FS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uLit, uP0, uP1, uP2, uP3;
uniform ivec2 uView; uniform int uN;
uniform vec4 uPass[4];
uniform vec2 uPassSize[4];
out vec4 o;
vec4 pass(int k, vec2 p) {
  vec2 q = (p - uPass[k].zw) / uPass[k].x - 0.5;
  vec2 uv = vec2(q.x + 0.5, uPassSize[k].y - 0.5 - q.y) / uPassSize[k];
  if (k == 0) return texture(uP0, uv); if (k == 1) return texture(uP1, uv); if (k == 2) return texture(uP2, uv); return texture(uP3, uv);
}
void main() {
  int x = int(gl_FragCoord.x), y = uView.y - 1 - int(gl_FragCoord.y);
  vec3 c = texelFetch(uLit, ivec2(x, int(gl_FragCoord.y)), 0).rgb;
  vec2 p = vec2(float(x) + 0.5, float(y) + 0.5);
  for (int k = 0; k < uN; k++) c += pass(k, p).rgb * uPass[k].y;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

// No light: the scene as drawn is the lit picture.
const PLAIN_FS = `#version 300 es
precision highp float; uniform sampler2D uScene; out vec4 o;
void main() { o = vec4(texelFetch(uScene, ivec2(gl_FragCoord.xy), 0).rgb, 1.0); }`;

export interface Program { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }
export interface Pic { x: number; y: number; w: number; h: number; page: number; ref: WeakRef<CanvasImageSource & { width: number; height: number }>; used: number; dead: boolean }
interface Run { start: number; n: number; blend: number; clip: number[] | null; dyn: { tex: WebGLTexture } | null; clear?: false }
interface Clear { clear: true; em: boolean; x: number; y: number; w: number; h: number }
interface Pass { s: number; a: number; pw: number; ph: number; tex: WebGLTexture; fb: WebGLFramebuffer; ox: number; oy: number }
type Source = CanvasImageSource & { width: number; height: number; gpuOwn?: boolean; gpuLive?: boolean; getContext?: (k: '2d') => CanvasRenderingContext2D | null };

export interface GpuOptions {
  /** The atlas's page size (px square), its first and most pages, how many
   * frames an unused picture is kept when the pages are rebuilt. */
  atlas?: number; pages?: number; maxPages?: number; keep?: number;
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
export class Gpu {
  gl!: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  o: Required<Omit<GpuOptions, 'onError' | 'attributes'>> & GpuOptions;
  on = false;
  w = 0; h = 0;
  /** The frame's camera: view px of the ground's origin. */
  ox = 0; oy = 0;
  /** The occlusion mode for the quads pushed next: -2 none, -1 flat on the
   * ground (anything lifted covers it), else the feet's view row. */
  feet = -2;
  frame = 0;
  stats = { quads: 0, draws: 0, uploads: 0 };
  // the batch
  q = new Float32Array(4096 * Q); n = 0; cap = 4096;
  runs: (Run | Clear)[] = []; cur: Run | null = null;
  target: 'scene' | 'lit' | 'canvas' = 'scene';
  blend = 0; clip: number[] | null = null; dyn: { tex: WebGLTexture } | null = null;
  litDone = false; drawn = false;
  oq = new Float32Array(1024 * Q); on_ = 0; ocap = 1024; odyn: { tex: WebGLTexture } | null = null;
  // programs and buffers
  quad!: Program; bloomP!: Program; outP!: Program;
  vao!: WebGLVertexArrayObject; triVao!: WebGLVertexArrayObject;
  bufs: WebGLBuffer[] = []; bi = 0;
  attribs: [number, number, number][] = [];
  boundFb: WebGLFramebuffer | null | undefined = undefined;
  // the atlas
  atlasTex: WebGLTexture | null = null; pages = 0;
  shelves: { y: number; rows: { y: number; h: number; x: number }[] }[] = [];
  pics = new WeakMap<object, Pic>(); entries: Pic[] = [];
  dynTexs = new WeakMap<object, { texs: WebGLTexture[]; i: number; tex: WebGLTexture | null; w: number; h: number }>();
  // the ground's textures, and the canvases that stand for them in drawImage
  groundCol!: WebGLTexture; groundEm!: WebGLTexture; lift!: WebGLTexture; dynTex!: WebGLTexture; mapTex!: WebGLTexture;
  groundW = 0; groundH = 0; groundOn = false; groundX = 0; groundY = 0;
  groundSrc: [object | null, object | null] = [null, null];
  groundDirtyBoxes: number[][] = [];
  /** Called before a frame draws from the ground, while boxes wait to go up
   * (the game calls groundSync with its pixels). */
  onGroundDraw: (() => void) | null = null;
  private spare: Record<string, WebGLTexture | null> = {};
  private shiftFb: WebGLFramebuffer | null = null;
  private box: Uint8Array | null = null;
  // the light map for MAP quads (light.ts's smooth model sets it)
  map = { org: [0, 0], cell: 4, w: 1, h: 1 };
  // framebuffers
  scene!: { fb: WebGLFramebuffer }; lit!: { fb: WebGLFramebuffer };
  sceneCol!: WebGLTexture; sceneEm!: WebGLTexture; litTex!: WebGLTexture;
  passes: Pass[] = [];
  bloomSpec: [number, number][] = [];

  static create(canvas: HTMLCanvasElement, o: GpuOptions = {}): Gpu | null {
    if (typeof location !== 'undefined' && /[?&]nogpu\b/.test(location.search)) return null;
    const g = new Gpu(canvas, o);
    return g.init() ? g : null;
  }
  constructor(canvas: HTMLCanvasElement, o: GpuOptions = {}) {
    this.canvas = canvas;
    this.o = Object.assign({ atlas: 2048, pages: 2, maxPages: 6, keep: 600, ring: 24, occlude: false }, o);
  }
  private err(e: unknown) { if (this.o.onError) this.o.onError(e); }

  /** Compiles a program from a vertex and a fragment shader, with the
   * locations of the uniforms named. */
  program(vs: string, fs: string, uniforms: string[]): Program {
    const gl = this.gl, shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const u: Program['u'] = {};
    for (const n of uniforms) u[n] = gl.getUniformLocation(p, n);
    return { p, u };
  }
  /** A texture on a unit, nearest or linear, clamped. */
  tex(unit: number, kind?: number, filter?: number): WebGLTexture {
    const gl = this.gl, k = kind ?? gl.TEXTURE_2D, f = filter ?? gl.NEAREST, t = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(k, t);
    gl.texParameteri(k, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(k, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(k, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(k, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  init(): boolean {
    try {
      const gl = this.canvas.getContext('webgl2', Object.assign({ alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false }, this.o.attributes || {}));
      if (!gl) return false;
      this.gl = gl;
      this.quad = this.program(QUAD_VS, quadFS(!!this.o.occlude), ['uViewF', 'uView', 'uCam', 'uGroundSize', 'uBlend', 'uAtlas', 'uGroundCol', 'uGroundEm', 'uLift', 'uDyn', 'uMap', 'uMapOrg', 'uMapCell', 'uMapSize']);
      this.bloomP = this.program(TRI_VS, BLOOM_FS, ['uEm', 'uView', 'uOut', 'uS', 'uOrg']);
      this.outP = this.program(TRI_VS, OUT_FS, ['uLit', 'uP0', 'uP1', 'uP2', 'uP3', 'uView', 'uN', 'uPass', 'uPassSize']);
      // the quad's attributes, one set an instance (a ring of buffers, each
      // filled afresh for one draw: a buffer the GPU may still be drawing
      // from is never written, which stalls a phone)
      this.vao = gl.createVertexArray()!; gl.bindVertexArray(this.vao);
      for (let i = 0; i < this.o.ring; i++) this.bufs.push(gl.createBuffer()!);
      this.attribs = ([['aRect', 4, 0], ['aUV', 4, 4], ['aPage', 1, 8], ['aTint', 4, 9], ['aFeet', 1, 13], ['aFlags', 1, 14], ['aXf', 4, 15]] as [string, number, number][]).map(([n, size, off]) => [gl.getAttribLocation(this.quad.p, n), size, off]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[0]);
      for (const [a, size, off] of this.attribs) { if (a < 0) continue; gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, size, gl.FLOAT, false, Q * 4, off * 4); gl.vertexAttribDivisor(a, 1); }
      gl.bindVertexArray(null);
      this.triVao = gl.createVertexArray()!;
      // texture units: 0 the atlas, 1-3 the ground, 4 a picture of its own,
      // 11 the light map; the light pass and the finish take theirs from 5
      gl.useProgram(this.quad.p);
      const u = this.quad.u;
      gl.uniform1i(u.uAtlas, 0); gl.uniform1i(u.uGroundCol, 1); gl.uniform1i(u.uGroundEm, 2); gl.uniform1i(u.uLift, 3); gl.uniform1i(u.uDyn, 4); gl.uniform1i(u.uMap, 11);
      gl.useProgram(this.bloomP.p); gl.uniform1i(this.bloomP.u.uEm, 5);
      gl.useProgram(this.outP.p); gl.uniform1i(this.outP.u.uLit, 5); gl.uniform1i(this.outP.u.uP0, 6); gl.uniform1i(this.outP.u.uP1, 7); gl.uniform1i(this.outP.u.uP2, 8); gl.uniform1i(this.outP.u.uP3, 9);
      this.atlasInit(this.o.pages);
      // a texel of each ground texture and the others, so every unit is complete
      for (const [unit, name, red] of [[1, 'groundCol', false], [2, 'groundEm', false], [3, 'lift', true], [4, 'dynTex', false], [11, 'mapTex', false]] as [number, 'groundCol', boolean][]) {
        this[name] = this.tex(unit);
        gl.texImage2D(gl.TEXTURE_2D, 0, red ? gl.R8 : gl.RGBA8, 1, 1, 0, red ? gl.RED : gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(red ? [0] : [255, 255, 255, 255]));
      }
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND);
      this.on = true;
      this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.on = false; }, false);
      this.canvas.addEventListener('webglcontextrestored', () => { location.reload(); }, false);
    } catch (e) {
      this.err(e);
      this.on = false;
    }
    return this.on;
  }

  /** The framebuffers at the view's size; `bloom` the grid bloom's passes,
   * [size of a cell in view px, strength] each (at most four). */
  resize(w: number, h: number, bloom: [number, number][] = this.bloomSpec): void {
    const gl = this.gl;
    if (!this.on || (this.w === w && this.h === h && (bloom === this.bloomSpec || JSON.stringify(bloom) === JSON.stringify(this.bloomSpec)))) return;
    this.w = w; this.h = h; this.bloomSpec = bloom;
    const target = (texs: WebGLTexture[]) => {
      const fb = gl.createFramebuffer()!;
      this.bind(fb);
      texs.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
      gl.drawBuffers(texs.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
      return { fb };
    };
    const tex2 = () => { const t = this.tex(5); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h); return t; };
    if (this.scene) for (const t of [this.sceneCol, this.sceneEm, this.litTex]) gl.deleteTexture(t);
    this.sceneCol = tex2(); this.sceneEm = tex2(); this.litTex = tex2();
    this.scene = target([this.sceneCol, this.sceneEm]);
    this.lit = target([this.litTex, this.sceneEm]);
    for (const p of this.passes) { gl.deleteTexture(p.tex); gl.deleteFramebuffer(p.fb); }
    this.passes = bloom.slice(0, 4).map(([s, a]) => {
      const pw = Math.ceil(w / s) + 2, ph = Math.ceil(h / s) + 2;
      const tex = this.tex(5, gl.TEXTURE_2D, gl.LINEAR);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, pw, ph);
      const fb = gl.createFramebuffer()!;
      this.bind(fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { s, a, pw, ph, tex, fb, ox: 0, oy: 0 };
    });
    this.bind(null);
    this.blank();
  }

  // ---- the atlas -----------------------------------------------------------
  // Pages of `atlas` px square, a texture array; a canvas is placed on a
  // shelf the first time it's drawn (and the pages rebuilt from the canvases
  // still about when they fill) and found by the canvas after.
  atlasInit(pages: number): void {
    const gl = this.gl, A = this.o.atlas;
    if (this.atlasTex) gl.deleteTexture(this.atlasTex);
    this.atlasTex = this.tex(0, gl.TEXTURE_2D_ARRAY);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, A, A, pages);
    this.pages = pages;
    this.shelves = []; for (let p = 0; p < pages; p++) this.shelves.push({ y: 0, rows: [] });
  }
  private place(w: number, h: number): { x: number; y: number; page: number } | null {
    const A = this.o.atlas, hh = Math.min(A, (h + 7) & ~7);
    for (let p = 0; p < this.pages; p++) {
      const S = this.shelves[p];
      for (const r of S.rows) if (r.h >= hh && r.h <= hh * 2 && r.x + w <= A) { const e = { x: r.x, y: r.y, page: p }; r.x += w; return e; }
      if (S.y + hh <= A && w <= A) { const r = { y: S.y, h: hh, x: w }; S.rows.push(r); S.y += hh; return { x: 0, y: r.y, page: p }; }
    }
    return null;
  }
  // (from the canvas itself, which a browser can copy on the GPU, rather
  // than its pixels read back)
  private upload(e: Pic, src: CanvasImageSource) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlasTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, e.x, e.y, e.page, e.w, e.h, 1, gl.RGBA, gl.UNSIGNED_BYTE, src as TexImageSource);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.stats.uploads++;
  }
  // The pages built again from the pictures drawn lately (the rest let go),
  // with a page more if they still don't fit.
  rebuild(need: number): void {
    const A = this.o.atlas;
    const keep = this.entries.filter((e) => this.frame - e.used < this.o.keep && !e.dead);
    for (const e of this.entries) if (!keep.includes(e)) e.dead = true;
    const area = keep.reduce((s, e) => s + e.w * ((e.h + 7) & ~7), 0) + need;
    let pages = this.pages;
    while (pages < this.o.maxPages && area > pages * A * A * 0.7) pages++;
    this.atlasInit(pages);
    this.entries = [];
    keep.sort((a, b) => b.h - a.h);
    for (const e of keep) {
      const src = e.ref.deref();
      if (!src) { e.dead = true; continue; }
      const at = this.place(e.w, e.h);
      if (!at) { e.dead = true; continue; }
      e.x = at.x; e.y = at.y; e.page = at.page; this.entries.push(e); this.upload(e, src);
    }
  }
  /** Where a canvas (or image) is on the pages, placing it the first time. */
  pic(src: Source): Pic | null {
    let e = this.pics.get(src);
    if (e && !e.dead) { e.used = this.frame; return e; }
    const w = src.width, h = src.height;
    if (!(w > 0 && h > 0)) return null;
    let at = this.place(w, h);
    // (the pages full: what's queued is drawn from them as they are first,
    // then they're built again)
    if (!at) { this.flush(); this.rebuild(w * h); at = this.place(w, h); }
    if (!at) return null;
    e = { x: at.x, y: at.y, w, h, page: at.page, ref: new WeakRef(src), used: this.frame, dead: false };
    this.pics.set(src, e); this.entries.push(e);
    this.upload(e, src);
    return e;
  }
  /** Pictures onto the pages ahead of their first frame (while loading). */
  warm(...srcs: (Source | null | undefined)[]): void { if (this.on) for (const s of srcs) if (s) this.pic(s); }
  /** A canvas drawn before has been painted again: read anew next time. */
  dirty(src: object): void {
    const e = this.pics.get(src); if (e) { e.dead = true; this.pics.delete(src); }
    const t = this.dynTexs.get(src); if (t) { for (const x of t.texs) this.gl.deleteTexture(x); this.dynTexs.delete(src); }
  }
  /** A picture of its own (bigger than a page, or pixels rewritten each
   * frame): a 2D texture (a ring of three), the rows y0..y1 of `img`
   * uploaded. Returns what a run draws from. */
  ownTex(src: object & { width: number; height: number }, img: ImageData | TexImageSource | null, y0 = 0, y1 = src.height): { tex: WebGLTexture; w: number; h: number } {
    const gl = this.gl, w = src.width, h = src.height;
    let t = this.dynTexs.get(src);
    gl.activeTexture(gl.TEXTURE4);
    if (!t || t.w !== w || t.h !== h) {
      if (t) for (const x of t.texs) gl.deleteTexture(x);
      t = { texs: [], i: 0, tex: null, w, h };
      for (let i = 0; i < 3; i++) { t.texs.push(this.tex(4)); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h); }
      this.dynTexs.set(src, t);
      y0 = 0; y1 = h;
    }
    if (img) {
      t.i = (t.i + 1) % t.texs.length; t.tex = t.texs[t.i];
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      if (img instanceof ImageData) {
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, w); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y0);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y0, w, y1 - y0, gl.RGBA, gl.UNSIGNED_BYTE, img.data);
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
      } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, img); // (from the canvas itself)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      this.stats.uploads++;
    } else if (!t.tex) { t.tex = t.texs[0]; gl.bindTexture(gl.TEXTURE_2D, t.tex); }
    return { tex: t.tex!, w, h };
  }

  // ---- the ground's textures -----------------------------------------------
  // A big painted ground (Lodestar's floor window) as textures: color, glow
  // and the lift of what stands up from it (for `occlude`). `col` and `em`
  // are the canvases that stand for them: drawImage of either draws from the
  // texture. Whole when a ground starts, else the boxes painted since.
  groundStart(W: number, H: number, col: object | null = null, em: object | null = null): void {
    const gl = this.gl;
    if (!this.on) return;
    if (this.groundW !== W || this.groundH !== H) {
      for (const [unit, name, fmt] of [[1, 'groundCol', gl.RGBA8], [2, 'groundEm', gl.RGBA8], [3, 'lift', gl.R8]] as [number, 'groundCol' | 'groundEm' | 'lift', number][]) {
        gl.deleteTexture(this[name]); this[name] = this.tex(unit); gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, W, H);
        if (this.spare[name]) { gl.deleteTexture(this.spare[name]); this.spare[name] = null; }
      }
      this.groundW = W; this.groundH = H;
    }
    this.groundOn = true;
    if (col || em) this.groundSrc = [col, em];
    this.groundDirtyBoxes = [[0, 0, W, H]];
  }
  /** The ground's window moved by (dx, dy): its textures shifted on the GPU,
   * so only the strips exposed go up as they're painted. False if it can't. */
  groundShift(dx: number, dy: number): boolean {
    const gl = this.gl, W = this.groundW, H = this.groundH;
    if (!this.on || !W || !this.groundOn) return false;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (adx >= W || ady >= H) return false;
    for (const b of this.groundDirtyBoxes) { b[0] -= dx; b[1] -= dy; b[2] -= dx; b[3] -= dy; }
    if (!this.shiftFb) this.shiftFb = gl.createFramebuffer();
    this.bind(this.shiftFb);
    for (const [unit, name, fmt] of [[1, 'groundCol', gl.RGBA8], [2, 'groundEm', gl.RGBA8], [3, 'lift', gl.R8]] as [number, 'groundCol' | 'groundEm' | 'lift', number][]) {
      if (!this.spare[name]) { this.spare[name] = this.tex(unit); gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, W, H); }
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this[name], 0);
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, this.spare[name]);
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, Math.max(0, -dx), Math.max(0, -dy), Math.max(0, dx), Math.max(0, dy), W - adx, H - ady);
      const t = this[name]; this[name] = this.spare[name]!; this.spare[name] = t;
    }
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    this.bind(null);
    this.stats.uploads++;
    return true;
  }
  /** A box of the ground painted since: it goes up before the ground is next drawn. */
  groundDirty(x0: number, y0: number, x1: number, y1: number): void {
    if (!this.on || x1 <= x0 || y1 <= y0) return;
    const d = this.groundDirtyBoxes;
    if (d.length > 12) this.groundDirtyBoxes = [[Math.min(...d.map((b) => b[0])), Math.min(...d.map((b) => b[1])), Math.max(...d.map((b) => b[2])), Math.max(...d.map((b) => b[3]))]];
    this.groundDirtyBoxes.push([x0, y0, x1, y1]);
  }
  get groundPending(): boolean { return this.groundDirtyBoxes.length > 0; }
  /** The boxes waiting go up from the ground's pixels (whole-ground arrays:
   * color and glow RGBA, lift one byte a pixel). */
  groundSync(col: Uint8Array | Uint8ClampedArray | null, em: Uint8Array | Uint8ClampedArray | null, lift: Uint8Array | null): void {
    const gl = this.gl, W = this.groundW, H = this.groundH;
    const srcs: [number, WebGLTexture, number, Uint8Array | Uint8ClampedArray | null, number][] = [[1, this.groundCol, gl.RGBA, col, 4], [2, this.groundEm, gl.RGBA, em, 4], [3, this.lift, gl.RED, lift, 1]];
    for (const [x0, y0, x1, y1] of this.groundDirtyBoxes) {
      const bx0 = Math.max(0, x0), by0 = Math.max(0, y0), bw = Math.min(W, x1) - bx0, bh = Math.min(H, y1) - by0;
      if (bw <= 0 || bh <= 0) continue;
      for (const [unit, tex, fmt, data, bpp] of srcs) {
        if (!data) continue;
        // (the box copied out tight: a whole ground's row stride costs some
        // browsers a copy of the lot)
        let box: Uint8Array | Uint8ClampedArray = data;
        if (bw < W) {
          const n = bw * bh * bpp;
          if (!this.box || this.box.length < n) this.box = new Uint8Array(Math.max(n, 1 << 16));
          box = this.box.subarray(0, n);
          for (let y = 0; y < bh; y++) box.set(data.subarray(((by0 + y) * W + bx0) * bpp, ((by0 + y) * W + bx0 + bw) * bpp), y * bw * bpp);
        } else box = data.subarray(by0 * W * bpp, (by0 + bh) * W * bpp);
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, bx0, by0, bw, bh, fmt, gl.UNSIGNED_BYTE, box);
      }
      this.stats.uploads++;
    }
    this.groundDirtyBoxes.length = 0;
  }

  /** The light map that MAP quads multiply by: cells (RGBA, w × h), each
   * `cell` view px, the grid's origin at view px org. */
  setMap(cells: Uint8Array | Uint8ClampedArray, w: number, h: number, cell: number, org: [number, number]): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE11); gl.bindTexture(gl.TEXTURE_2D, this.mapTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, cells);
    this.map = { org, cell, w, h };
    this.stats.uploads++;
  }

  // ---- the batch -----------------------------------------------------------
  // The quads of a phase (the scene, or what's drawn over the lit picture)
  // gather in one array, in order, as runs sharing a blend mode, a clip and
  // a picture of its own; a whole-layer clear is a run of its own. The phase
  // is drawn at once (flush): the array goes up in one upload to the next of
  // a ring of buffers, and each run is an instanced draw from its offset.
  // The overlay's quads queue apart, drawn last onto the canvas.
  bind(fb: WebGLFramebuffer | null): void {
    if (this.boundFb === fb) return;
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fb);
    this.boundFb = fb;
  }
  private run(): Run {
    const c = this.cur;
    if (c && c.blend === this.blend && c.clip === this.clip && c.dyn === this.dyn) return c;
    this.cur = { start: this.n, n: 0, blend: this.blend, clip: this.clip, dyn: this.dyn };
    this.runs.push(this.cur);
    return this.cur;
  }
  /** A quad. over: onto the overlay's queue. xf: the 2 × 2 linear part of
   * the transform (default none). */
  push(over: boolean, x: number, y: number, w: number, h: number, u0: number, v0: number, u1: number, v1: number, page: number, r: number, g: number, b: number, a: number, flags: number, xf?: number[] | null): void {
    let q: Float32Array, k: number;
    if (over) {
      if (this.on_ >= this.ocap) { this.ocap *= 2; const nq = new Float32Array(this.ocap * Q); nq.set(this.oq); this.oq = nq; }
      q = this.oq; k = this.on_++ * Q;
    } else {
      if (this.n >= this.cap) { this.cap *= 2; const nq = new Float32Array(this.cap * Q); nq.set(this.q); this.q = nq; }
      this.drawn = true;
      this.run().n++;
      q = this.q; k = this.n++ * Q;
    }
    q[k] = x; q[k + 1] = y; q[k + 2] = w; q[k + 3] = h; q[k + 4] = u0; q[k + 5] = v0; q[k + 6] = u1; q[k + 7] = v1; q[k + 8] = page;
    q[k + 9] = r; q[k + 10] = g; q[k + 11] = b; q[k + 12] = a; q[k + 13] = over ? -2 : this.feet; q[k + 14] = flags;
    if (xf) { q[k + 15] = xf[0]; q[k + 16] = xf[1]; q[k + 17] = xf[2]; q[k + 18] = xf[3]; } else { q[k + 15] = 1; q[k + 16] = 0; q[k + 17] = 0; q[k + 18] = 1; }
  }
  /** The state the quads pushed next are drawn with. */
  state(blend: number, clip: number[] | null, dyn: { tex: WebGLTexture } | null): void { this.blend = blend; this.clip = clip; this.dyn = dyn; }
  /** A whole-layer clear, in its place in the order. */
  clearLayer(em: boolean, x: number, y: number, w: number, h: number): void { this.runs.push({ clear: true, em, x, y, w, h }); this.cur = null; }
  private blendSet(blend: number) {
    const gl = this.gl;
    if (blend === 1) gl.blendFunc(gl.ONE, gl.ONE);
    else if (blend === 2) gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
    else if (blend === 3) gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  private scissor(clip: number[] | null) {
    const gl = this.gl;
    if (!clip) { gl.disable(gl.SCISSOR_TEST); return; }
    const x0 = Math.max(0, clip[0]), y0 = Math.max(0, clip[1]), x1 = Math.min(this.w, clip[2]), y1 = Math.min(this.h, clip[3]);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, Math.max(0, this.h - y1), Math.max(0, x1 - x0), Math.max(0, y1 - y0));
  }
  private fbOf(target: string) { return target === 'scene' ? this.scene.fb : target === 'lit' ? this.lit.fb : null; }
  // the quad program and its textures, for the target, and the array q (n
  // quads) uploaded to the ring's next buffer
  private ready(q: Float32Array, n: number, target: string) {
    const gl = this.gl, u = this.quad.u;
    this.bind(this.fbOf(target));
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(this.quad.p);
    gl.uniform2f(u.uViewF, this.w, this.h); gl.uniform2i(u.uView, this.w, this.h); gl.uniform2i(u.uCam, this.ox + this.groundX, this.oy + this.groundY); gl.uniform2i(u.uGroundSize, this.groundW, this.groundH);
    gl.uniform2f(u.uMapOrg, this.map.org[0], this.map.org[1]); gl.uniform1f(u.uMapCell, this.map.cell); gl.uniform2i(u.uMapSize, this.map.w, this.map.h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlasTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.groundCol);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.groundEm);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.lift);
    gl.activeTexture(gl.TEXTURE11); gl.bindTexture(gl.TEXTURE_2D, this.mapTex);
    gl.bindVertexArray(this.vao);
    this.bi = (this.bi + 1) % this.bufs.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[this.bi]);
    gl.bufferData(gl.ARRAY_BUFFER, q.subarray(0, n * Q), gl.STREAM_DRAW);
    this.stats.uploads++;
  }
  private drawRun(start: number, n: number, blend: number, clip: number[] | null, dyn: { tex: WebGLTexture } | null) {
    const gl = this.gl;
    gl.uniform1i(this.quad.u.uBlend, blend);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, dyn ? dyn.tex : this.dynTex);
    this.blendSet(blend);
    this.scissor(clip);
    for (const [a, size, off] of this.attribs) if (a >= 0) gl.vertexAttribPointer(a, size, gl.FLOAT, false, Q * 4, (start * Q + off) * 4);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    this.stats.draws++; this.stats.quads += n;
  }
  /** The phase drawn: its runs in order, into the target. */
  flush(): void {
    const gl = this.gl;
    if (!this.runs.length) return;
    if (this.n) this.ready(this.q, this.n, this.target); else this.bind(this.fbOf(this.target));
    for (const r of this.runs) {
      if (r.clear) { this.scissor([r.x, r.y, r.x + r.w, r.y + r.h]); gl.clearBufferfv(gl.COLOR, r.em ? 1 : 0, ZERO); continue; }
      if (r.n) this.drawRun(r.start, r.n, r.blend, r.clip, r.dyn);
    }
    gl.disable(gl.SCISSOR_TEST);
    gl.bindVertexArray(null);
    this.n = 0; this.runs = []; this.cur = null;
  }
  drop(): void { this.n = 0; this.runs = []; this.cur = null; }

  // ---- a frame -------------------------------------------------------------
  /** A frame begins: the scene's layers cleared (color to black, glow to
   * nothing), the contexts reset. */
  frameBegin(ctxs: (Ctx | null | undefined)[] = []): void {
    if (!this.on) return;
    this.frame++; this.drop(); this.on_ = 0; this.target = 'scene'; this.litDone = false; this.feet = -2; this.ox = 0; this.oy = 0; this.drawn = false;
    this.stats.quads = 0; this.stats.draws = 0; this.stats.uploads = 0;
    const gl = this.gl;
    this.bind(this.scene.fb);
    gl.clearBufferfv(gl.COLOR, 0, BLACK); gl.clearBufferfv(gl.COLOR, 1, ZERO);
    for (const c of ctxs) if (c) c.reset();
  }
  /** Nothing to show: the lit picture and the glow black. */
  blank(): void {
    const gl = this.gl;
    this.drop();
    this.bind(this.lit.fb);
    gl.clearBufferfv(gl.COLOR, 0, BLACK); gl.clearBufferfv(gl.COLOR, 1, ZERO);
    for (const p of this.passes) { this.bind(p.fb); gl.clearBufferfv(gl.COLOR, 0, ZERO); }
    this.litDone = true;
  }
  /** The scene is drawn: a light pass runs from it into the lit picture
   * (bind its program after this), and what's drawn after goes over that. */
  lightBegin(): void {
    const gl = this.gl;
    this.flush();
    this.bind(this.lit.fb);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
    gl.viewport(0, 0, this.w, this.h);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.triVao);
  }
  lightEnd(): void {
    const gl = this.gl;
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    this.target = 'lit'; this.litDone = true;
  }
  /** A whole light pass: `prog`'s fragment shader over the scene (its color
   * on unit 5 as `uScene`), the uniforms set by `set`, into the lit picture. */
  lightPass(prog: Program, set: (gl: WebGL2RenderingContext, u: Program['u']) => void): void {
    const gl = this.gl;
    this.lightBegin();
    gl.useProgram(prog.p);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, this.sceneCol);
    if (prog.u.uScene !== undefined) gl.uniform1i(prog.u.uScene, 5);
    set(gl, prog.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.lightEnd();
  }
  private plainP: Program | null = null;
  /** No light this frame (a picture lit already): the scene as drawn
   * becomes the lit picture, and what's drawn after goes over it. */
  plain(): void {
    if (!this.plainP) this.plainP = this.program(TRI_VS, PLAIN_FS, ['uScene']);
    this.lightPass(this.plainP, () => { /* nothing to set */ });
  }
  /** For tests: a layer's pixels read back (rows from the top, RGBA,
   * premultiplied): 'scene', 'lit' or 'glow'. Slow; never in a frame. */
  read(which: 'scene' | 'lit' | 'glow'): { w: number; h: number; data: Uint8Array } {
    const gl = this.gl, w = this.w, h = this.h, tex = which === 'scene' ? this.sceneCol : which === 'lit' ? this.litTex : this.sceneEm;
    this.flush();
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const raw = new Uint8Array(w * h * 4), data = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); this.boundFb = undefined;
    for (let y = 0; y < h; y++) data.set(raw.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    return { w, h, data };
  }
  /** The grid bloom's passes from the glow layer, on the world's grid; cx,
   * cy the camera in the world (view px). */
  bloom(cx: number, cy: number): void {
    const gl = this.gl;
    gl.disable(gl.BLEND);
    gl.useProgram(this.bloomP.p);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, this.sceneEm);
    gl.uniform2i(this.bloomP.u.uView, this.w, this.h);
    gl.bindVertexArray(this.triVao);
    for (const p of this.passes) {
      const gx = Math.floor(cx / p.s) * p.s, gy = Math.floor(cy / p.s) * p.s;
      p.ox = gx - cx; p.oy = gy - cy;
      this.bind(p.fb);
      gl.viewport(0, 0, p.pw, p.ph);
      gl.uniform2i(this.bloomP.u.uOut, p.pw, p.ph); gl.uniform1f(this.bloomP.u.uS, p.s); gl.uniform2f(this.bloomP.u.uOrg, p.ox, p.oy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
  }
  /** What's queued over the lit picture drawn (before a finish of the game's
   * own, post.ts); false if the frame never got as far as the light. */
  litReady(): boolean {
    if (this.litDone) { this.flush(); return true; }
    this.drop();
    return false;
  }
  /** The frame onto the canvas: the lit picture with the grid bloom added,
   * then the overlay's quads. */
  frameEnd(): void {
    const gl = this.gl;
    if (!this.on || !this.w) return;
    // (a frame that didn't get as far as the light keeps the last lit
    // picture, as a 2D canvas keeps it: what it queued isn't drawn)
    if (this.litReady()) this.bloom(-this.ox, -this.oy);
    this.bind(null);
    gl.viewport(0, 0, this.w, this.h);
    gl.disable(gl.BLEND);
    gl.useProgram(this.outP.p);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, this.litTex);
    const pass = new Float32Array(16), size = new Float32Array(8);
    this.passes.forEach((p, k) => { gl.activeTexture(gl.TEXTURE6 + k); gl.bindTexture(gl.TEXTURE_2D, p.tex); pass[k * 4] = p.s; pass[k * 4 + 1] = p.a; pass[k * 4 + 2] = p.ox; pass[k * 4 + 3] = p.oy; size[k * 2] = p.pw; size[k * 2 + 1] = p.ph; });
    gl.uniform2i(this.outP.u.uView, this.w, this.h); gl.uniform1i(this.outP.u.uN, this.passes.length); gl.uniform4fv(this.outP.u.uPass, pass); gl.uniform2fv(this.outP.u.uPassSize, size);
    gl.bindVertexArray(this.triVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
    this.overlay();
  }
  /** The overlay's quads, unlit, onto the canvas. */
  overlay(): void {
    const gl = this.gl;
    if (!this.on_) return;
    this.ready(this.oq, this.on_, 'canvas'); this.drawRun(0, this.on_, 0, null, this.odyn);
    gl.disable(gl.SCISSOR_TEST); gl.bindVertexArray(null); this.on_ = 0; this.odyn = null;
  }

  /** A stand-in for a 2D context drawing into `layers` (F.COL, F.EM or both);
   * `over`: onto the overlay's queue, unlit over the finished frame. */
  ctx(layers: number, over = false): Ctx { return new Ctx(this, layers, over); }
}

// A CSS color as [r, g, b, a] in 0..1 (kept; an odd form through a canvas).
const colors = new Map<string, number[]>();
export function parseColor(s: string): number[] {
  let c = colors.get(s);
  if (c) return c;
  let m: RegExpExecArray | null;
  if ((m = /^#([0-9a-f]{3,4})$/i.exec(s))) { const h = m[1]; c = [parseInt(h[0] + h[0], 16) / 255, parseInt(h[1] + h[1], 16) / 255, parseInt(h[2] + h[2], 16) / 255, h.length > 3 ? parseInt(h[3] + h[3], 16) / 255 : 1]; }
  else if ((m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s))) { c = [parseInt(m[1].slice(0, 2), 16) / 255, parseInt(m[1].slice(2, 4), 16) / 255, parseInt(m[1].slice(4, 6), 16) / 255, m[2] ? parseInt(m[2], 16) / 255 : 1]; }
  else if ((m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s))) c = [+m[1] / 255, +m[2] / 255, +m[3] / 255, m[4] === undefined ? 1 : +m[4]];
  else {
    const x = document.createElement('canvas').getContext('2d')!;
    x.fillStyle = s; x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    c = d[3] ? [d[0] / d[3], d[1] / d[3], d[2] / d[3], d[3] / 255] : [0, 0, 0, 0];
  }
  if (colors.size > 4096) colors.clear();
  colors.set(s, c);
  return c;
}

/** A linear gradient a Ctx can fill with (two or more stops). */
export class Gradient {
  x0: number; y0: number; x1: number; y1: number; stops: [number, number[]][] = [];
  constructor(x0: number, y0: number, x1: number, y1: number) { this.x0 = x0; this.y0 = y0; this.x1 = x1; this.y1 = y1; }
  addColorStop(t: number, color: string): void { this.stops.push([t, parseColor(color)]); this.stops.sort((a, b) => a[0] - b[0]); }
  /** The color at t (0..1 along it), unpremultiplied [r, g, b, a]. */
  at(t: number): number[] {
    const S = this.stops;
    if (!S.length) return [0, 0, 0, 0];
    if (t <= S[0][0]) return S[0][1];
    for (let i = 1; i < S.length; i++) if (t <= S[i][0]) { const [ta, a] = S[i - 1], [tb, b] = S[i], k = tb > ta ? (t - ta) / (tb - ta) : 0; return a.map((v, j) => v + (b[j] - v) * k); }
    return S[S.length - 1][1];
  }
}

/** A radial gradient a Ctx can fill with: drawn as a picture a 2D canvas
 * rasterized (kept, by its shape and the box's place in it). */
export class RadialGradient {
  x0: number; y0: number; r0: number; x1: number; y1: number; r1: number; css: [number, string][] = [];
  constructor(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) { this.x0 = x0; this.y0 = y0; this.r0 = r0; this.x1 = x1; this.y1 = y1; this.r1 = r1; }
  addColorStop(t: number, color: string): void { this.css.push([t, color]); }
  key(): string { return [this.x0 - this.x1, this.y0 - this.y1, this.r0, this.r1].join(',') + ':' + this.css.map(([t, c]) => t + c).join(';'); }
}
const radials = new Map<string, HTMLCanvasElement>();

/** A stand-in for a 2D context on a Gpu (gpu.ctx(layers)): fillRect,
 * clearRect, drawImage, globalAlpha, globalCompositeOperation (source-over,
 * lighter, destination-out, multiply), save/restore, translate, scale,
 * rotate, setTransform, a rect clip, fillStyle as a color or a linear
 * gradient; plus `tint` (a color the next pictures are multiplied by),
 * `lightMap` (pictures multiplied by the light map, light.ts) and
 * drawPixels (an ImageData rewritten each frame). */
export class Ctx {
  gpu: Gpu; layers: number; over: boolean; canvas: HTMLCanvasElement;
  readonly isGpu = true;
  /** For code that checks: this is the GPU's stand-in. */
  get gpuCtx(): true { return true; }
  globalAlpha = 1; imageSmoothingEnabled = false;
  /** Pictures drawn are multiplied by this color ([r, g, b] 0..1), or not. */
  tint: number[] | null = null;
  /** Pictures drawn are multiplied by the light map (light.ts's smooth model). */
  lightMap = false;
  private _fs: string | Gradient | RadialGradient = '#000000'; private _rgba: number[] = [0, 0, 0, 1]; private _op = 'source-over'; private _blend = 0;
  // the transform: [a, b, c, d, e, f] as a 2D context's
  m = [1, 0, 0, 1, 0, 0];
  clipBox: number[] | null = null; path: number[] | null = null;
  private stack: unknown[][] = [];
  constructor(gpu: Gpu, layers: number, over = false) { this.gpu = gpu; this.layers = layers; this.over = over; this.canvas = gpu.canvas; this.reset(); }
  reset(): void { this.fillStyle = '#000000'; this.globalAlpha = 1; this.globalCompositeOperation = 'source-over'; this.imageSmoothingEnabled = false; this.m = [1, 0, 0, 1, 0, 0]; this.clipBox = null; this.stack = []; this.path = null; this.tint = null; this.lightMap = false; }
  get fillStyle(): string | Gradient | RadialGradient { return this._fs; }
  set fillStyle(v: string | Gradient | RadialGradient) { if (v !== this._fs) { this._fs = v; if (typeof v === 'string') this._rgba = parseColor(v); } }
  get globalCompositeOperation(): string { return this._op; }
  set globalCompositeOperation(v: string) { this._op = v; this._blend = BLEND[v] || 0; }
  // (Lodestar's names for the translate, kept)
  get tx(): number { return this.m[4]; } set tx(v: number) { this.m[4] = v; }
  get ty(): number { return this.m[5]; } set ty(v: number) { this.m[5] = v; }
  save(): void { this.stack.push([this.m.slice(), this.clipBox, this.globalAlpha, this._fs, this._op, this.imageSmoothingEnabled, this.tint, this.lightMap]); }
  restore(): void {
    const s = this.stack.pop();
    if (!s) return;
    this.m = s[0] as number[]; this.clipBox = s[1] as number[] | null; this.globalAlpha = s[2] as number; this.fillStyle = s[3] as string; this.globalCompositeOperation = s[4] as string; this.imageSmoothingEnabled = s[5] as boolean; this.tint = s[6] as number[] | null; this.lightMap = s[7] as boolean;
  }
  translate(x: number, y: number): void { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  scale(sx: number, sy: number): void { const m = this.m; m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy; }
  rotate(a: number): void { const m = this.m, c = Math.cos(a), s = Math.sin(a), [a0, b0, c0, d0] = m; m[0] = a0 * c + c0 * s; m[1] = b0 * c + d0 * s; m[2] = c0 * c - a0 * s; m[3] = d0 * c - b0 * s; }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void { this.m = [a, b, c, d, e, f]; }
  resetTransform(): void { this.m = [1, 0, 0, 1, 0, 0]; }
  private plain(): boolean { const m = this.m; return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1; }
  beginPath(): void { this.path = null; }
  rect(x: number, y: number, w: number, h: number): void { this.path = this.box(x, y, w, h); }
  // a box in the context's space as view px [x0, y0, x1, y1] (scaled and
  // moved; a rotated transform's box is its bounds)
  private box(x: number, y: number, w: number, h: number): number[] {
    const m = this.m, xs = [x, x + w], ys = [y, y + h], px: number[] = [], py: number[] = [];
    for (const a of xs) for (const b of ys) { px.push(m[0] * a + m[2] * b + m[4]); py.push(m[1] * a + m[3] * b + m[5]); }
    return [Math.min(...px), Math.min(...py), Math.max(...px), Math.max(...py)];
  }
  private covers(x: number, y: number, w: number, h: number): boolean {
    const m = this.m;
    if (m[1] !== 0 || m[2] !== 0) return false;
    const b = this.box(x, y, w, h);
    return b[0] <= 0 && b[1] <= 0 && b[2] >= this.gpu.w && b[3] >= this.gpu.h;
  }
  closePath(): void { /* rects only */ }
  clip(): void { if (this.path) { const p = this.path, c = this.clipBox; this.clipBox = c ? [Math.max(c[0], p[0]), Math.max(c[1], p[1]), Math.min(c[2], p[2]), Math.min(c[3], p[3])] : p; } }
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Gradient { return new Gradient(x0, y0, x1, y1); }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): RadialGradient { return new RadialGradient(x0, y0, r0, x1, y1, r1); }
  private setState(dyn: { tex: WebGLTexture } | null) { if (!this.over) this.gpu.state(this._blend, this.clipBox, dyn); }
  // a quad at (x, y, w, h) in the context's own space, through its transform
  private quad(x: number, y: number, w: number, h: number, u0: number, v0: number, u1: number, v1: number, page: number, r: number, g: number, b: number, a: number, flags: number) {
    const m = this.m;
    if (this.plain()) this.gpu.push(this.over, x + m[4], y + m[5], w, h, u0, v0, u1, v1, page, r, g, b, a, flags);
    else this.gpu.push(this.over, m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5], w, h, u0, v0, u1, v1, page, r, g, b, a, flags, [m[0], m[1], m[2], m[3]]);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    const al = this.globalAlpha, G = this.gpu;
    if (al <= 0 || !(w > 0 && h > 0)) return;
    if (this._fs instanceof Gradient) { this.fillGradient(this._fs, x, y, w, h); return; }
    if (this._fs instanceof RadialGradient) { this.fillRadial(this._fs, x, y, w, h); return; }
    const c = this._rgba, ca = c[3] * al;
    // (the frame's first fill of the whole view: the layer's clear color instead)
    if (!this.over && !G.drawn && G.target === 'scene' && ca >= 1 && !this.clipBox && this._blend === 0 && this.covers(x, y, w, h)) {
      if (c[0] || c[1] || c[2]) { const gl = G.gl; G.bind(G.scene.fb); if (this.layers & F.COL) gl.clearBufferfv(gl.COLOR, 0, new Float32Array([c[0], c[1], c[2], 1])); if (this.layers & F.EM) gl.clearBufferfv(gl.COLOR, 1, new Float32Array([c[0], c[1], c[2], 1])); }
      return;
    }
    this.setState(null);
    this.quad(x, y, w, h, 0, 0, 1, 1, 0, c[0] * ca, c[1] * ca, c[2] * ca, ca, this.layers | F.SOLID);
  }
  // A linear gradient as strips across it, one view px each, each the
  // gradient's color at its middle (as the 2D canvas reads it at each pixel's).
  private fillGradient(gr: Gradient, x: number, y: number, w: number, h: number) {
    const dx = gr.x1 - gr.x0, dy = gr.y1 - gr.y0, len2 = dx * dx + dy * dy || 1, vertical = Math.abs(dy) >= Math.abs(dx), al = this.globalAlpha;
    this.setState(null);
    const n = Math.max(1, Math.ceil(vertical ? h : w));
    for (let i = 0; i < n; i++) {
      const px = vertical ? x + w / 2 : x + i + 0.5, py = vertical ? y + i + 0.5 : y + h / 2;
      const t = Math.min(1, Math.max(0, ((px - gr.x0) * dx + (py - gr.y0) * dy) / len2)), c = gr.at(t), ca = c[3] * al;
      if (ca <= 0) continue;
      if (vertical) this.quad(x, y + i, w, Math.min(1, h - i), 0, 0, 1, 1, 0, c[0] * ca, c[1] * ca, c[2] * ca, ca, this.layers | F.SOLID);
      else this.quad(x + i, y, Math.min(1, w - i), h, 0, 0, 1, 1, 0, c[0] * ca, c[1] * ca, c[2] * ca, ca, this.layers | F.SOLID);
    }
  }
  // A radial gradient, rasterized by a 2D canvas once (at the view's scale)
  // for its shape and the box's place in it, and drawn as a picture.
  private fillRadial(gr: RadialGradient, x: number, y: number, w: number, h: number) {
    const m = this.m, sx = Math.hypot(m[0], m[1]) || 1, sy = Math.hypot(m[2], m[3]) || 1;
    const key = [gr.key(), x - gr.x1, y - gr.y1, w, h, sx, sy].map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)).join('|');
    let c = radials.get(key);
    if (!c) {
      const cw = Math.max(1, Math.ceil(w * sx)), ch = Math.max(1, Math.ceil(h * sy));
      c = document.createElement('canvas'); c.width = cw; c.height = ch;
      const g = c.getContext('2d')!;
      g.scale(cw / w, ch / h); g.translate(-x, -y);
      const rg = g.createRadialGradient(gr.x0, gr.y0, gr.r0, gr.x1, gr.y1, gr.r1);
      for (const [t, col] of gr.css) rg.addColorStop(t, col);
      g.fillStyle = rg; g.fillRect(x, y, w, h);
      if (radials.size > 64) radials.clear();
      radials.set(key, c);
    }
    const smooth = this.imageSmoothingEnabled;
    this.imageSmoothingEnabled = true;
    this.drawImage(c, x, y, w, h);
    this.imageSmoothingEnabled = smooth;
  }
  clearRect(x: number, y: number, w: number, h: number): void {
    if (this.over) return;
    const G = this.gpu;
    if (this.covers(x, y, w, h) && !this.clipBox) {
      if (!G.drawn && G.target === 'scene') return;
      if (this.layers & F.EM) G.clearLayer(true, 0, 0, G.w, G.h); if (this.layers & F.COL) G.clearLayer(false, 0, 0, G.w, G.h);
      return;
    }
    G.state(2, this.clipBox, null);
    this.quad(x, y, w, h, 0, 0, 1, 1, 0, 0, 0, 0, 1, this.layers | F.SOLID);
  }
  // drawImage(img, dx, dy), (img, dx, dy, dw, dh), (img, sx, sy, sw, sh, dx, dy, dw, dh)
  drawImage(img: Source, a1: number, a2: number, a3?: number, a4?: number, a5?: number, a6?: number, a7?: number, a8?: number): void {
    const al = this.globalAlpha, G = this.gpu;
    if (al <= 0 || !img) return;
    let sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number;
    if (a5 === undefined) { sx = 0; sy = 0; sw = img.width; sh = img.height; dx = a1; dy = a2; dw = a3 === undefined ? sw : a3; dh = a4 === undefined ? sh : a4!; }
    else { sx = a1; sy = a2; sw = a3!; sh = a4!; dx = a5; dy = a6!; dw = a7!; dh = a8!; }
    if (!(sw > 0 && sh > 0 && dw !== 0 && dh !== 0)) return;
    // (a source box past the picture's edge is cut, keeping the scale, as the browser does)
    if (sx < 0) { const k = -sx / sw; dx += dw * k; dw -= dw * k; sw += sx; sx = 0; }
    if (sy < 0) { const k = -sy / sh; dy += dh * k; dh -= dh * k; sh += sy; sy = 0; }
    if (sx + sw > img.width) { const k = (sx + sw - img.width) / sw; dw -= dw * k; sw = img.width - sx; }
    if (sy + sh > img.height) { const k = (sy + sh - img.height) / sh; dh -= dh * k; sh = img.height - sy; }
    if (!(sw > 0 && sh > 0)) return;
    let flags = this.layers | (this.imageSmoothingEnabled ? F.SMOOTH : 0) | (this.lightMap ? F.MAP : 0), u0: number, v0: number, page = 0, dyn: { tex: WebGLTexture } | null = null;
    if (G.groundOn && (img === G.groundSrc[0] || img === G.groundSrc[1])) {
      if (G.groundPending && G.onGroundDraw) G.onGroundDraw();
      flags = (flags & ~F.SMOOTH) | (img === G.groundSrc[0] ? F.GROUND : F.GROUNDEM); u0 = sx; v0 = sy;
    } else if (img.gpuLive || img.gpuOwn || img.width > G.o.atlas || img.height > G.o.atlas) {
      // (a picture too big for a page, or one that asks: a texture of its
      // own; one marked gpuLive, painted afresh every frame, goes up each
      // time it's drawn)
      const t = G.dynTexs.get(img);
      dyn = t && t.tex && !img.gpuLive ? { tex: t.tex } : G.ownTex(img, img as TexImageSource, 0, img.height);
      flags |= F.DYN; u0 = sx; v0 = sy;
      if (flags & F.SMOOTH && dw === sw && dh === sh) flags &= ~F.SMOOTH;
    } else {
      const e = G.pic(img); if (!e) return;
      u0 = e.x + sx; v0 = e.y + sy; page = e.page;
      if (flags & F.SMOOTH && dw === sw && dh === sh) flags &= ~F.SMOOTH;
    }
    if (dyn && this.over) G.odyn = dyn; else this.setState(dyn);
    const t = this.tint;
    this.quad(dx, dy, dw, dh, u0, v0, u0 + sw, v0 + sh, page, t ? t[0] * al : al, t ? t[1] * al : al, t ? t[2] * al : al, al, flags);
  }
  /** Pixels rewritten each frame (an ImageData): the box sx, sy, sw, sh of
   * them at dx, dy (scaled to dw × dh if given, smoothly with
   * imageSmoothingEnabled), uploaded (the rows that changed) and drawn. */
  drawPixels(img: ImageData, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw = sw, dh = sh): void {
    const al = this.globalAlpha, G = this.gpu;
    if (al <= 0 || !(sw > 0 && sh > 0)) return;
    const scaled = dw !== sw || dh !== sh;
    const t = G.ownTex(img as unknown as { width: number; height: number }, img, scaled ? 0 : sy, scaled ? img.height : sy + sh);
    if (this.over) G.odyn = t; else this.setState(t);
    const flags = this.layers | F.DYN | (scaled && this.imageSmoothingEnabled ? F.SMOOTH : 0) | (this.lightMap ? F.MAP : 0);
    this.quad(dx, dy, dw, dh, sx, sy, sx + sw, sy + sh, 0, al, al, al, al, flags);
  }
}
