// Finishing a frame on the GPU, after the light: bloom from the glow layer,
// reflections on wet ground and water, the fade, scaled up to the screen.
//
//   Blur (the White Dragon's): the glow halved by averaging (so a glow's light
//   is the same wherever it lands on the grid, and the bloom holds steady as
//   the camera moves) and blurred both ways, then quartered and blurred
//   wider: two bloom layers. Then picture + glow + bloom, each wet strip
//   reflecting what's above it with a ripple, and the fade, scaled up by
//   whole pixels onto the canvas (which may be bigger than the view).
//
// The grid bloom and the plain finish (Lodestar's) are the Gpu's own
// (gpu.ts bloom, frameEnd).
import { Gpu, Program, TRI_VS } from './gpu';

/** A wet strip, in view px: it reflects what's above y0 down to y0 + depth. */
export interface Wet { x0: number; y0: number; x1: number; depth: number; k: number }

export interface BlurFrame {
  /** The view's scale onto the canvas (canvas px a view px). */
  out: number;
  wets?: Wet[];
  /** 0..1: black over everything. */
  fade?: number;
  /** Seconds, for the ripples. */
  time?: number;
  /** The bloom layers' strengths (0.8 and 0.55). */
  near?: number; far?: number;
}

export class Blur {
  gpu: Gpu; down: Program; blur: Program; comp: Program;
  fb: { t: WebGLTexture; f: WebGLFramebuffer; w: number; h: number }[] = [];
  w = 0; h = 0; sampler: WebGLSampler;
  constructor(gpu: Gpu) {
    this.gpu = gpu;
    const gl = gpu.gl, fs = (s: string) => '#version 300 es\nprecision highp float;\n' + s;
    // halve: one filtered sample in the middle of each 2 x 2 block averages it
    this.down = gpu.program(TRI_VS, fs('uniform sampler2D src; uniform vec2 size; out vec4 o; void main(){ o = vec4(texture(src, gl_FragCoord.xy / size).rgb, 1.0); }'), ['src', 'size']);
    // a 9-tap gaussian in five filtered samples, along one direction
    this.blur = gpu.program(TRI_VS, fs(`uniform sampler2D src; uniform vec2 size; uniform vec2 dir; out vec4 o;
      void main(){ vec2 uv = gl_FragCoord.xy / size, d = dir / size;
        vec3 c = texture(src, uv).rgb * 0.227027;
        c += (texture(src, uv + d * 1.384615).rgb + texture(src, uv - d * 1.384615).rgb) * 0.316216;
        c += (texture(src, uv + d * 3.230769).rgb + texture(src, uv - d * 3.230769).rgb) * 0.070270;
        o = vec4(c, 1.0); }`), ['src', 'size', 'dir']);
    // the picture, its glow and bloom, the reflections, the fade (the
    // framebuffers' rows run up, the view's down: q is the view point's place in them)
    this.comp = gpu.program(TRI_VS, fs(`uniform sampler2D scene, glow, b1, b2; uniform vec2 low, b1s, b2s; uniform float scale, screenH, fade, time, near, far;
      uniform vec4 wet[4]; uniform vec2 wetk[4]; uniform int nwet; out vec4 o;
      vec3 at(vec2 p) {
        vec2 q = vec2(p.x, low.y - p.y);
        vec2 uv = (floor(q) + 0.5) / low;
        vec3 c = texture(scene, uv).rgb + texture(glow, uv).rgb;
        c += texture(b1, q / (b1s * 2.0)).rgb * near + texture(b2, q / (b2s * 4.0)).rgb * far;
        return c;
      }
      void main() {
        vec2 p = vec2(gl_FragCoord.x, screenH - gl_FragCoord.y) / scale;
        vec3 c = at(p);
        for (int i = 0; i < 4; i++) {
          if (i >= nwet) break;
          vec4 w = wet[i]; float k = floor(p.y) - w.y;
          if (p.x >= w.x && p.x < w.z && k >= 0.0 && k < w.w && w.y - 1.0 - k >= 0.0) {
            float off = k > 2.0 ? floor(sin(k * 0.9 + time * 2.0 + k * k * 0.05) + 0.5) : 0.0;
            float a = wetk[i].x * (1.0 - k / wetk[i].y) * (mod(k, 2.0) > 0.5 ? 0.8 : 1.0);
            c += at(vec2(floor(p.x) + off + 0.5, w.y - 1.0 - k + 0.5)) * a;
          }
        }
        o = vec4(mix(min(c, vec3(1.0)), vec3(0.0), fade), 1.0);
      }`), ['scene', 'glow', 'b1', 'b2', 'low', 'b1s', 'b2s', 'scale', 'screenH', 'fade', 'time', 'near', 'far', 'wet', 'wetk', 'nwet']);
    for (let i = 0; i < 4; i++) { const t = gpu.tex(5, gl.TEXTURE_2D, gl.LINEAR), f = gl.createFramebuffer()!; this.fb.push({ t, f, w: 0, h: 0 }); }
    // (the glow is read smoothly here, though the batcher keeps it nearest)
    this.sampler = gl.createSampler()!;
    gl.samplerParameteri(this.sampler, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.samplerParameteri(this.sampler, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.samplerParameteri(this.sampler, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.samplerParameteri(this.sampler, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  private size(w: number, h: number) {
    const gl = this.gpu.gl; this.w = w; this.h = h;
    const half = [Math.ceil(w / 2), Math.ceil(h / 2)], quarter = [Math.ceil(w / 4), Math.ceil(h / 4)];
    [half, half, quarter, quarter].forEach(([fw, fh], i) => {
      const F = this.fb[i]; F.w = fw; F.h = fh;
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, F.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      this.gpu.bind(F.f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, F.t, 0);
    });
    this.gpu.bind(null);
  }
  private pass(P: Program, target: { f: WebGLFramebuffer; w: number; h: number }, src: WebGLTexture, smooth: boolean, uniforms?: (u: Program['u']) => void) {
    const gl = this.gpu.gl;
    gl.useProgram(P.p); this.gpu.bind(target.f);
    gl.viewport(0, 0, target.w, target.h);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, src); gl.bindSampler(5, smooth ? this.sampler : null); gl.uniform1i(P.u.src, 5);
    gl.uniform2f(P.u.size, target.w, target.h);
    if (uniforms) uniforms(P.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindSampler(5, null);
  }
  /** The frame onto the canvas, from the Gpu's lit picture and glow. */
  finish(o: BlurFrame): void {
    const G = this.gpu, gl = G.gl;
    if (!G.on || !G.w) return;
    G.litReady();
    if (this.w !== G.w || this.h !== G.h) this.size(G.w, G.h);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(G.triVao);
    const [A, B, C, D] = this.fb;
    this.pass(this.down, A, G.sceneEm, true);
    this.pass(this.blur, B, A.t, false, (u) => gl.uniform2f(u.dir, 1, 0));
    this.pass(this.blur, A, B.t, false, (u) => gl.uniform2f(u.dir, 0, 1));
    this.pass(this.down, C, A.t, false);
    this.pass(this.blur, D, C.t, false, (u) => gl.uniform2f(u.dir, 1.6, 0));
    this.pass(this.blur, C, D.t, false, (u) => gl.uniform2f(u.dir, 0, 1.6));
    const P = this.comp, u = P.u;
    gl.useProgram(P.p); G.bind(null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    ([[G.litTex, 'scene', false], [G.sceneEm, 'glow', true], [A.t, 'b1', false], [C.t, 'b2', false]] as [WebGLTexture, string, boolean][]).forEach(([t, name, smooth], i) => {
      gl.activeTexture(gl.TEXTURE5 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.bindSampler(5 + i, smooth ? this.sampler : null); gl.uniform1i(u[name], 5 + i);
    });
    gl.uniform2f(u.low, G.w, G.h); gl.uniform2f(u.b1s, A.w, A.h); gl.uniform2f(u.b2s, C.w, C.h);
    gl.uniform1f(u.scale, o.out); gl.uniform1f(u.screenH, gl.drawingBufferHeight); gl.uniform1f(u.fade, Math.min(1, Math.max(0, o.fade || 0))); gl.uniform1f(u.time, o.time || 0);
    gl.uniform1f(u.near, o.near ?? 0.8); gl.uniform1f(u.far, o.far ?? 0.55);
    const wets = o.wets || [], wv = new Float32Array(16), wk = new Float32Array(8);
    wets.slice(0, 4).forEach((w, i) => { wv.set([w.x0, w.y0, w.x1, w.depth], i * 4); wk.set([w.k, w.depth], i * 2); });
    gl.uniform4fv(u.wet, wv); gl.uniform2fv(u.wetk, wk); gl.uniform1i(u.nwet, Math.min(4, wets.length));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    for (let i = 0; i < 4; i++) gl.bindSampler(5 + i, null);
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
    G.overlay();
  }
}
