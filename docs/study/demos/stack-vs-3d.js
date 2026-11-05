// stack-vs-3d.js: the sprite stack from the perspectives demo set against the same slices rendered as real 3D.
// stack-vs-3d: left, the height slices drawn bottom up with one rotated, squashed drawImage each (Canvas 2D);
// right, every slice pixel turned into a voxel, greedy-meshed once and drawn with WebGL 2 through an orthographic
// camera into a 192x128 buffer with a depth test, a sun shadow map, light in palette steps and optional edge lines.
'use strict';
(() => {
  const { RGB, Pix, PAL } = Kit;

  // ---- the world, copied from views-shared.js: 12x12 tiles, heights in steps, a house, a tree and a hero ----
  const MAP = [
    'hhhGGGGGGGGG',
    'hHhGGGGGGGGG',
    'hhGGGG###GGG',
    'GGGGGG###GGG',
    'GGGGGGGPGGGG',
    'GGGGGGGPGGGG',
    'GGGtGGGPGGGG',
    'GGGGGPPPGGWG',
    'GGGGGPGGWWWW',
    'GGGGGPGWWWWW',
    'GGGGPPGWWWWW',
    'GGGGPGGGWWWW',
  ];
  const N = 12, MT = 8, S = N * MT;
  const kind = (x, y) => (x < 0 || y < 0 || x >= N || y >= N) ? 'X' : MAP[y][x];
  const Z = (x, y) => ({ h: 2, H: 3, W: 0, X: 0 }[kind(x, y)] ?? 1);
  const HOUSE = { x: 6, y: 2, w: 3, d: 2 };
  const TREE = { x: 3.5, y: 6.5 }, HERO = { x: 6.5, y: 6.5 };
  function topColor(k, x, y, u, v) {
    const r = Kit.hash2(x * 16 + u, y * 16 + v, 3);
    if (k === 'W') return (v % 4 === 1 && r < 0.18) ? 24 : 22;
    if (k === 'P') return r < 0.05 ? 28 : 29;
    if (k === 'h' || k === 'H') return r < 0.03 ? 19 : 18;
    return r < 0.022 ? 18 : r < 0.045 ? 16 : 17;
  }
  // the ground seen from above, with dark lips where the land steps down (views-shared.js topDown without objects)
  function ground(t) {
    const p = new Pix(N * t, N * t);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const k = kind(x, y), z = Z(x, y);
      for (let v = 0; v < t; v++) for (let u = 0; u < t; u++) p.set(x * t + u, y * t + v, topColor(k, x, y, u, v));
      if (Z(x, y + 1) < z && y < N - 1) for (let u = 0; u < t; u++) { p.set(x * t + u, y * t + t - 1, 27); p.set(x * t + u, y * t + t - 2, k === 'W' ? 22 : 16); }
      if (Z(x + 1, y) < z && x < N - 1) for (let v = 0; v < t; v++) p.set(x * t + t - 1, y * t + v, 16);
    }
    return p;
  }
  function toCanvas(pix) {
    const cv = document.createElement('canvas'); cv.width = pix.w; cv.height = pix.h;
    cv.getContext('2d').putImageData(pix.toImage(), 0, 0); return cv;
  }

  // ---- the slices: views-shared.js stackAssets, kept as Pix so the same data feeds both views ----
  function stackLayers() {
    const t = MT, layers = [];
    const L = k => (layers[k] = layers[k] || new Pix(S, S));
    const g0 = ground(t);
    for (let i = 0; i < g0.d.length; i++) L(0).d[i] = g0.d[i];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const steps = (Z(x, y) - 1) * 4;
      for (let k = 1; k <= steps; k++) for (let v = 0; v < t; v++) for (let u = 0; u < t; u++) L(k).set(x * t + u, y * t + v, k === steps ? topColor(kind(x, y), x, y, u, v) : (u === 0 || v === t - 1 || u === t - 1 || v === 0) ? (k % 3 ? 27 : 26) : 27);
    }
    const hx = HOUSE.x * t, hy = HOUSE.y * t, hw = HOUSE.w * t, hd = HOUSE.d * t;
    for (let k = 1; k <= 8; k++) for (let y = 0; y < hd; y++) for (let x = 0; x < hw; x++) {
      const ring = x === 0 || y === 0 || x === hw - 1 || y === hd - 1;
      if (!ring) { L(k).set(hx + x, hy + y, k === 1 ? 4 : 6); continue; }
      const door = y === hd - 1 && x >= 10 && x < 14 && k <= 5, win = k >= 4 && k <= 6 && ((x % 8 === 3 || x % 8 === 4) && (y === 0 || y === hd - 1) && !(x >= 10 && x < 14) || ((y % 8 === 3 || y % 8 === 4) && (x === 0 || x === hw - 1)));
      L(k).set(hx + x, hy + y, door ? 27 : win ? 24 : k === 1 ? 4 : 6);
    }
    for (let k = 0; k < 9; k++) for (let y = k; y < hd - k; y++) for (let x = -1; x <= hw; x++) {
      const north = y < hd / 2, rim = y === k || y === hd - k - 1;
      L(9 + k).set(hx + x, hy + y, k === 8 ? 12 : (x === -1 || x === hw) && !rim ? 5 : y === k ? 9 : rim ? 10 : north ? 10 : 11);
    }
    for (let k = 10; k <= 15; k++) for (let y = 3; y < 6; y++) for (let x = hw - 7; x < hw - 4; x++) L(k).set(hx + x, hy + y, k === 15 ? 3 : 4);
    const cx = TREE.x * t, cy = TREE.y * t;
    for (let k = 1; k <= 7; k++) for (let y = -1; y < 1; y++) for (let x = -1; x < 1; x++) L(k).set(cx + x, cy + y, 27);
    for (let k = 5; k <= 19; k++) {
      const r = Math.sqrt(Math.max(0, 7.5 * 7.5 - (k - 12) * (k - 12)));
      for (let y = -8; y < 8; y++) for (let x = -8; x < 8; x++) {
        const d = Math.hypot(x + 0.5, y + 0.5);
        if (d > r) continue;
        L(k).set(cx + x, cy + y, d > r - 1 ? (k > 12 ? 16 : 15) : k > 15 ? 18 : k > 10 ? 17 : 16);
      }
    }
    const ex = Math.round(HERO.x * t), ey = Math.round(HERO.y * t);
    [[1, 26, 1], [2, 3, 1], [3, 3, 1], [4, 23, 2], [5, 23, 2], [6, 23, 2], [7, 13, 1], [8, 13, 1], [9, 27, 1]].forEach(([k, c, r]) => {
      for (let y = -r; y < r; y++) for (let x = -r; x < r; x++) L(k).set(ex + x, ey + y, c);
    });
    for (let k = 0; k < layers.length; k++) layers[k] = layers[k] || new Pix(S, S);
    return layers;
  }

  // ---- the shared camera ----
  // Both views use one orthographic camera: turn by `ang` about the vertical, tilt by `pitch` above the horizon, scale s.
  // A map point (x, y, z) lands at sx = W/2 + s·rx, sy = y0 + s·(sin p·ry − cos p·z·HZ), where (rx, ry) = R(ang)(x, y).
  // The stack gets the same numbers: squash = sin p, and each slice lifted s·cos p·HZ pixels. HZ is set so that at the
  // The perspectives demo's pitch (squash 0.6) and 1x a slice lifts exactly one pixel, as it does there.
  const W = 192, H = 128, SC = 1.15, P0 = 37 * Math.PI / 180, HZ = 1 / (SC * Math.cos(P0));
  function camera(ang, pitch, zoom) {
    const p = pitch * Math.PI / 180, sp = Math.sin(p), cp = Math.cos(p), s = SC * zoom;
    return { ca: Math.cos(ang), sa: Math.sin(ang), sp, cp, s, lift: s * cp * HZ, y0: H / 2 + Math.round(14 * zoom * cp / Math.cos(P0)) };
  }

  // ---- view 1: the sprite stack, one transformed drawImage per slice (as views-shared.js drawStack) ----
  // With `fill`, a slice lifted more than a pixel above the one below is drawn again on every row between.
  function drawStack(g, cvs, c, fill) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = PAL[21]; g.fillRect(0, 0, W, H);
    const a = c.s * c.ca, b = c.s * c.sp * c.sa, cc = -c.s * c.sa, d = c.s * c.sp * c.ca;
    let calls = 0;
    cvs.forEach((cv, k) => {
      const top = Math.round(c.y0 - k * c.lift);
      const bot = fill && k > 0 ? Math.max(top, Math.round(c.y0 - (k - 1) * c.lift) - 1) : top;
      for (let y = bot; y >= top; y--) { g.setTransform(a, b, cc, d, W / 2, y); g.drawImage(cv, -S / 2, -S / 2); calls++; }
    });
    g.setTransform(1, 0, 0, 1, 0, 0);
    return calls;
  }

  // ---- view 2: voxels ----
  // Voxel (x, y, k) is pixel (x, y) of slice k and spans z in [k−1, k], so its top sits where the stack draws slice k.
  // Greedy meshing (after Mikola Lysenko's 0fps.net write-up): for each axis and each plane across it, mark the faces
  // whose neighbor is empty, then merge runs of one color into rectangles. One quad per rectangle; flat color and normal.
  function mesh(layers) {
    const dim = [S, S, layers.length];
    const at = (x, y, k) => (x < 0 || y < 0 || k < 0 || x >= S || y >= S || k >= dim[2]) ? -1 : layers[k].d[y * S + x];
    const verts = [], idx = [];
    const p = [0, 0, 0], q = [0, 0, 0];
    for (let ax = 0; ax < 3; ax++) {
      const u = (ax + 1) % 3, v = (ax + 2) % 3, du = dim[u], dv = dim[v];
      const mask = new Int16Array(du * dv);
      for (const dir of [1, -1]) for (let i = 0; i < dim[ax]; i++) {
        if (ax === 2 && dir < 0 && i === 0) continue;   // the underside of the ground is never seen
        for (let j = 0; j < dv; j++) for (let m = 0; m < du; m++) {
          p[ax] = i; p[u] = m; p[v] = j; q[ax] = i + dir; q[u] = m; q[v] = j;
          const c = at(p[0], p[1], p[2]);
          mask[m + j * du] = c >= 0 && at(q[0], q[1], q[2]) < 0 ? c : -1;
        }
        const plane = i + (dir > 0 ? 1 : 0);
        for (let j = 0; j < dv; j++) for (let m = 0; m < du;) {
          const c = mask[m + j * du];
          if (c < 0) { m++; continue; }
          let w = 1; while (m + w < du && mask[m + w + j * du] === c) w++;
          let h = 1;
          grow: while (j + h < dv) { for (let o = 0; o < w; o++) if (mask[m + o + (j + h) * du] !== c) break grow; h++; }
          for (let jj = 0; jj < h; jj++) for (let o = 0; o < w; o++) mask[m + o + (j + jj) * du] = -1;
          const base = verts.length / 7, n = [0, 0, 0]; n[ax] = dir;
          // each quad grows by a hair so the T-junctions greedy merging makes can't open pinhole cracks
          for (const [a, b] of [[0, 0], [w, 0], [w, h], [0, h]]) {
            const r = [0, 0, 0]; r[ax] = plane; r[u] = m + a + (a ? 0.05 : -0.05); r[v] = j + b + (b ? 0.05 : -0.05);
            verts.push(r[0], r[1], r[2] - 1, n[0], n[1], n[2], c);
          }
          idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          m += w;
        }
      }
    }
    return { verts: new Float32Array(verts), idx: new Uint32Array(idx), quads: idx.length / 6 };
  }

  // light in palette steps: 0 edge line, 1 deep shade, 2 shade, 3 the slice's own color, 4 highlight.
  // Each step walks the color's ramp in Kit.RAMPS (3, 2 and 1 inks down, 1 up), so the 3D view prints only palette inks.
  function stepInk(c, s) {
    const ramp = Object.values(Kit.RAMPS).find(r => r.includes(c));
    if (!ramp) return c;
    const i = ramp.indexOf(c);
    return ramp[Math.max(s ? 1 : 0, Math.min(ramp.length - 1, i + s - 3))];   // ink 0 is kept for lines
  }
  // toward the sun, from the southwest and 44 degrees up; fixed in the world, so shadows turn with the land
  const SUN = (() => { const v = [-0.55, 0.45, 0.70], l = Math.hypot(...v); return v.map(x => x / l); })();
  const LR = 90, DR = 130;   // half sizes of the sun's box and of the camera's depth range, in map units

  const GLSL_CAM = `
uniform vec2 uRot; uniform vec2 uPit; uniform vec4 uCam; uniform vec3 uLR; uniform vec3 uLU; uniform vec3 uLF;
vec3 world(vec3 a) { return vec3(a.xy - ${S / 2}.0, a.z * uCam.z); }
vec3 sunSpace(vec3 p) { return vec3(dot(p, uLR), dot(p, uLU), -dot(p, uLF)) / ${LR}.0; }
`;
  const VS_SUN = `#version 300 es
layout(location=0) in vec3 aPos;
${GLSL_CAM}
void main() { gl_Position = vec4(sunSpace(world(aPos)), 1.0); }`;
  const FS_SUN = `#version 300 es
precision highp float;
void main() {}`;
  const VS_MAIN = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in float aCol;
${GLSL_CAM}
out vec3 vN; out vec3 vS; flat out float vC;
void main() {
  vec3 p = world(aPos);
  float rx = uRot.x * p.x - uRot.y * p.y, ry = uRot.y * p.x + uRot.x * p.y;
  float sx = ${W / 2}.0 + uCam.x * rx;
  float sy = uCam.y + uCam.x * (uPit.x * ry - uPit.y * p.z);
  float d = uPit.y * ry + uPit.x * p.z;                 // distance toward the viewer
  gl_Position = vec4(sx / ${W}.0 * 2.0 - 1.0, 1.0 - sy / ${H}.0 * 2.0, -d / ${DR}.0, 1.0);
  vN = aNrm; vC = aCol;
  vS = sunSpace(p + aNrm * 0.5) * 0.5 + 0.5;            // normal offset keeps faces from shadowing themselves
}`;
  const FS_MAIN = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vS; flat in float vC;
uniform highp sampler2D uShadow; uniform vec3 uSun; uniform int uShadows; uniform vec2 uRot; uniform vec2 uPit;
layout(location=0) out vec4 oCol; layout(location=1) out vec4 oNrm;
void main() {
  float d = dot(vN, uSun), v = d / uSun.z;
  float st = v >= 0.72 ? 3.0 : v >= 0.3 ? 2.0 : 1.0;
  if (uShadows == 1 && d > 0.0 && texture(uShadow, vS.xy).r < vS.z - 0.002) st = vN.z > 0.5 ? 2.0 : 1.0;
  oCol = vec4(vC / 255.0, st / 255.0, 0.0, 1.0);
  // the normal in camera space (x right, y down the screen, z toward the viewer), for the edge pass
  float nr = uRot.y * vN.x + uRot.x * vN.y;
  vec3 n = vec3(uRot.x * vN.x - uRot.y * vN.y, uPit.x * nr - uPit.y * vN.z, uPit.y * nr + uPit.x * vN.z);
  oNrm = vec4(n * 0.5 + 0.5, 1.0);
}`;
  // the finish: look up each pixel's ink, and with edges on, darken the near side of a depth break and lighten
  // the near side of a convex crease (after t3ssel8r). Positions come back from depth, so the test holds at any pitch.
  const VS_POST = `#version 300 es
void main() { vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0); gl_Position = vec4(p, 0.0, 1.0); }`;
  const FS_POST = `#version 300 es
precision highp float;
uniform highp sampler2D uCol; uniform highp sampler2D uNrm; uniform highp sampler2D uDep; uniform highp sampler2D uLut;
uniform int uEdge; uniform vec4 uCam;
out vec4 o;
vec3 pos(ivec2 q, float z) { return vec3((float(q.x) + 0.5 - ${W / 2}.0) / uCam.x, (${H}.0 - float(q.y) - 0.5 - uCam.y) / uCam.x, (0.5 - z) * ${2 * DR}.0); }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float z = texelFetch(uDep, p, 0).r;
  if (z >= 1.0) { o = texelFetch(uLut, ivec2(21, 3), 0); return; }
  vec4 c = texelFetch(uCol, p, 0);
  int ci = int(c.r * 255.0 + 0.5), st = int(c.g * 255.0 + 0.5);
  if (uEdge == 1) {
    vec3 n = texelFetch(uNrm, p, 0).xyz * 2.0 - 1.0, P = pos(p, z);
    bool line = false, crease = false;
    for (int i = 0; i < 4; i++) {
      ivec2 q = p + ivec2(i == 0 ? 1 : i == 1 ? -1 : 0, i == 2 ? 1 : i == 3 ? -1 : 0);
      if (q.x < 0 || q.y < 0 || q.x >= ${W} || q.y >= ${H}) continue;
      float zq = texelFetch(uDep, q, 0).r;
      if (zq >= 1.0) { line = true; continue; }
      float behind = -dot(pos(q, zq) - P, n);            // how far the neighbor sits behind this pixel's face
      if (behind > 2.5) line = true;
      vec3 m = texelFetch(uNrm, q, 0).xyz * 2.0 - 1.0;
      if (zq >= z && behind > 0.05 && dot(n, m) < 0.5) crease = true;
    }
    if (line) st = 0; else if (crease) st = min(st + 1, 4);
  }
  o = texelFetch(uLut, ivec2(ci, st), 0);
}`;

  // makeGL(cv, layers): the WebGL 2 renderer, or null when there is no WebGL 2. Throws if a shader fails.
  function makeGL(cv, layers) {
    const gl = cv.getContext('webgl2', { antialias: false, depth: false, alpha: false, premultipliedAlpha: false });
    if (!gl) return null;
    const shader = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const program = (vs, fs) => {
      const p = gl.createProgram();
      gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {};
      for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
      return { p, u: new Proxy(u, { get: (o, k) => o[k] || null }) };
    };
    const sunP = program(VS_SUN, FS_SUN), mainP = program(VS_MAIN, FS_MAIN), postP = program(VS_POST, FS_POST);

    // the mesh
    const m = mesh(layers);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, m.verts, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
    [[0, 3, 0], [1, 3, 12], [2, 1, 24]].forEach(([loc, n, off]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 28, off); });
    gl.bindVertexArray(null);

    const tex = (w, h, ifmt, fmt, type, data = null) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      return t;
    };
    // the palette lookup: 32 inks by 5 light steps
    const lut = new Uint8Array(32 * 5 * 4);
    for (let s = 0; s < 5; s++) for (let i = 0; i < 32; i++) lut.set([...RGB[stepInk(i, s)], 255], (s * 32 + i) * 4);
    const lutT = tex(32, 5, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, lut);
    // the low-res frame: ink and step, camera normal, depth
    const colT = tex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE), nrmT = tex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    const depT = tex(W, H, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colT, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, nrmT, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depT, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    // the sun's depth map: drawn once, since neither the land nor the sun moves
    const SM = 1024, shT = tex(SM, SM, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT);
    const sfb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, sfb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shT, 0);
    const f = SUN, rl = Math.hypot(f[0], f[1]), r = [-f[1] / rl, f[0] / rl, 0];
    const up = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
    const sunUniforms = u => { gl.uniform3fv(u.uLR, r); gl.uniform3fv(u.uLU, up); gl.uniform3fv(u.uLF, f); };
    gl.viewport(0, 0, SM, SM); gl.enable(gl.DEPTH_TEST); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(sunP.p); sunUniforms(sunP.u); gl.uniform4f(sunP.u.uCam, 1, 0, HZ, DR);
    gl.bindVertexArray(vao); gl.drawElements(gl.TRIANGLES, m.idx.length, gl.UNSIGNED_INT, 0);

    const draw = (c, opt) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, W, H);
      gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const u = mainP.u;
      gl.useProgram(mainP.p); sunUniforms(u);
      gl.uniform2f(u.uRot, c.ca, c.sa); gl.uniform2f(u.uPit, c.sp, c.cp); gl.uniform4f(u.uCam, c.s, c.y0, HZ, DR);
      gl.uniform3fv(u.uSun, SUN); gl.uniform1i(u.uShadows, opt.shadows ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, shT); gl.uniform1i(u.uShadow, 0);
      gl.bindVertexArray(vao); gl.drawElements(gl.TRIANGLES, m.idx.length, gl.UNSIGNED_INT, 0); gl.bindVertexArray(null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.disable(gl.DEPTH_TEST);
      const v = postP.u;
      gl.useProgram(postP.p);
      [[colT, v.uCol], [nrmT, v.uNrm], [depT, v.uDep], [lutT, v.uLut]].forEach(([t, loc], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, i); });
      gl.uniform1i(v.uEdge, opt.edges ? 1 : 0); gl.uniform4f(v.uCam, c.s, c.y0, HZ, DR);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    return { draw, quads: m.quads, gl };
  }

  // a canvas at W x H shown at the largest whole device-pixel scale that fits its host (Kit.canvas's rule)
  function fitCanvas(host, cv) {
    cv.width = W; cv.height = H; cv.className = 'px';
    host.appendChild(cv);
    const fit = () => {
      const avail = Math.max(1, (host.clientWidth || W) - 2), dpr = window.devicePixelRatio || 1;
      const s = Math.max(1, Math.floor(avail * dpr / W));
      cv.style.width = (W * s / dpr) + 'px'; cv.style.height = (H * s / dpr) + 'px';
    };
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(host);
  }

  Kit.register('stack-vs-3d', { title: 'Sprite stack against real 3D', fit: 'shader' }, host => {
    const layers = stackLayers(), cvs = layers.map(toCanvas);
    const row = Kit.el('div', { style: 'display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start' });
    host.appendChild(row);
    const cell = () => {
      const c = Kit.el('div', { style: 'flex:1 1 260px;min-width:0' });
      const cap = Kit.el('div', { style: 'font-size:12.5px;color:#a29eb6;margin:0 0 6px;text-align:center' });
      c.append(cap); row.append(c); return { c, cap };
    };
    const A = cell(), B = cell(), cv3 = document.createElement('canvas');
    const view2d = Kit.canvas(A.c, W, H);
    view2d.cv.style.margin = cv3.style.margin = '0 auto';
    fitCanvas(B.c, cv3);
    let r3 = null, fail = '';
    try { r3 = makeGL(cv3, layers); if (!r3) fail = 'WebGL 2 is not available in this browser, so the real 3D view cannot run.'; }
    catch (e) { fail = 'The 3D view could not start: ' + e.message; console.error(e); }
    if (fail) { cv3.replaceWith(Kit.el('div', { style: 'min-height:128px;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px;border:1px dashed #45405c;border-radius:6px;font-size:13px' }, fail + ' The sprite stack still runs.')); r3 = null; }
    else cv3.addEventListener('webglcontextlost', e => { e.preventDefault(); r3 = null; B.cap.textContent = 'Real 3D: the GPU context was lost. Reload to bring it back.'; });
    B.cap.textContent = r3 ? `Real 3D, WebGL: ${r3.quads.toLocaleString('en-US')} quads in 1 draw call` : 'Real 3D, WebGL';

    let ang = 0.5, pitch = 37, zoom = 1, auto = true, fill = false, shadows = true, edges = false, drag = null, lastCalls = -1;
    const draw = () => {
      const c = camera(ang, pitch, zoom);
      const calls = drawStack(view2d.g, cvs, c, fill);
      if (calls !== lastCalls) { lastCalls = calls; A.cap.textContent = `Sprite stack, Canvas 2D: ${cvs.length} slices, ${calls} drawImage calls`; }
      if (r3) r3.draw(c, { shadows, edges });
    };

    // drag sideways on either view to turn both
    for (const el of [view2d.cv, cv3]) {
      el.style.touchAction = 'pan-y'; el.style.cursor = 'grab';
      el.addEventListener('pointerdown', e => { drag = { x: e.clientX, a: ang }; el.setPointerCapture(e.pointerId); });
      el.addEventListener('pointermove', e => { if (!drag) return; ang = drag.a - (e.clientX - drag.x) * 0.012; draw(); });
      const end = () => { drag = null; };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    }

    const b = Kit.bar(host);
    b.check('Auto-turn', auto, v => { auto = v; });
    b.slider('Pitch°', 5, 90, 1, pitch, v => { pitch = v; draw(); });
    b.tabs(['1x', '2x'], v => { zoom = v === '2x' ? 2 : 1; draw(); }, '1x');
    b.check('Fill stack gaps', fill, v => { fill = v; draw(); });
    b.check('Shadows', shadows, v => { shadows = v; draw(); });
    b.check('Edge lines', edges, v => { edges = v; draw(); });
    b.note('Sprite stack: one drawImage per slice per frame, so it fits Tycho\'s 2D stand-in. Pitch is faked by squashing each slice and lifting it; below 37° (or at 2x) the lift passes a pixel and the walls open into gaps, shredding under about 15°, which "Fill stack gaps" patches by drawing slices again. Near top-down both views agree. Its light is whatever was painted into the slices.');
    b.note('Real 3D: the same slices as voxels, greedy-meshed once, one draw into a 192×128 buffer with a depth test, then a palette lookup per pixel. It holds at any pitch and lights and shadows each face from the sun, but it needs a GPU (WebGL) and shaders. Voxels are the bridge: one set of slices is the source for both.');
    Kit.loop(host, () => { if (auto && !drag) ang += 0.012; }, draw, 30);
  });
})();
