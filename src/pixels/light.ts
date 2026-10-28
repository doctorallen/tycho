// Light models: how the lit picture is made from the scene, as one pass over
// it on the GPU (gpu.ts lightPass). A game computes its light where it wants
// (cells of a grid, in JavaScript, as it does for its 2D path) and a model
// applies it. The game's 2D path keeps lighting its canvases itself; a test
// holds the two to a tone.
//
//   Smooth: a light map fixed to the world, a grid of cells scaled up smooth
//           and multiplied over the scene, plus a little of the light added
//           (the White Dragon's). Its map is also what quads drawn with
//           `ctx.lightMap` are multiplied by, after the light (the fronts of
//           counters over the people behind them).
//
// Lodestar's stepped light (dithered bands, tinting toward violet in the
// dark) runs its own shader through the same pass; Merryfolk's pools come
// with it.
import { Gpu, Program, TRI_VS } from './gpu';

const SMOOTH_FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform sampler2D uScene, uMap;
uniform ivec2 uSize, uMapSize;
uniform vec2 uOrg; uniform float uCell, uAdd;
out vec4 o;
vec3 cell(vec2 t) { return texelFetch(uMap, clamp(ivec2(t), ivec2(0), uMapSize - 1), 0).rgb; }
void main() {
  vec3 p = texelFetch(uScene, ivec2(gl_FragCoord.xy), 0).rgb;
  vec2 v = vec2(gl_FragCoord.x, float(uSize.y) - gl_FragCoord.y);
  vec2 t = (v - uOrg) / uCell - 0.5, f = fract(t), t0 = floor(t);
  vec3 m = mix(mix(cell(t0), cell(t0 + vec2(1.0, 0.0)), f.x), mix(cell(t0 + vec2(0.0, 1.0)), cell(t0 + 1.0), f.x), f.y);
  o = vec4(clamp(p * m + m * uAdd, 0.0, 1.0), 1.0);
}`;

export interface SmoothFrame {
  /** The light map's cells, RGBA (alpha unused), `w` × `h`. */
  cells: Uint8Array | Uint8ClampedArray;
  w: number; h: number;
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
export class Smooth {
  gpu: Gpu; prog: Program;
  constructor(gpu: Gpu) {
    this.gpu = gpu;
    this.prog = gpu.program(TRI_VS, SMOOTH_FS, ['uScene', 'uMap', 'uSize', 'uMapSize', 'uOrg', 'uCell', 'uAdd']);
  }
  /** Lights the scene drawn so far into the lit picture. */
  draw(f: SmoothFrame): void {
    const G = this.gpu;
    G.setMap(f.cells, f.w, f.h, f.cell, f.org);
    G.lightPass(this.prog, (gl, u) => {
      gl.uniform1i(u.uMap, 11);
      gl.uniform2i(u.uSize, G.w, G.h); gl.uniform2i(u.uMapSize, f.w, f.h);
      gl.uniform2f(u.uOrg, f.org[0], f.org[1]); gl.uniform1f(u.uCell, f.cell); gl.uniform1f(u.uAdd, f.add ?? 0.1);
    });
  }
}
