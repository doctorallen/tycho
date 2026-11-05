// Micro-benchmarks for world-generation kernels on N x N grids, plain JS, single thread.
'use strict';
const N = +process.argv[2] || 256;
const NN = N * N;

// deterministic PRNG (mulberry32)
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(1);

function time(label, f) { const t = process.hrtime.bigint(); const r = f(); const ms = Number(process.hrtime.bigint() - t) / 1e6; console.log(`${N}x${N}  ${label.padEnd(48)} ${ms.toFixed(1)} ms`); return r; }

// value-noise fBm (lattice hash + smoothstep), 6 octaves
const perm = new Uint8Array(512); { const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = (R() * (i + 1)) | 0;[p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
const val = new Float32Array(256); for (let i = 0; i < 256; i++) val[i] = R();
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y); const xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = val[perm[(xi & 255) + perm[yi & 255]]], b = val[perm[((xi + 1) & 255) + perm[yi & 255]]], c = val[perm[(xi & 255) + perm[(yi + 1) & 255]]], d = val[perm[((xi + 1) & 255) + perm[(yi + 1) & 255]]]; return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const h = time('fBm value noise, 6 octaves', () => { const h = new Float32Array(NN); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0, amp = 1, f = 4 / N, tot = 0; for (let o = 0; o < 6; o++) { s += amp * vnoise(x * f, y * f); tot += amp; amp *= 0.5; f *= 2; } h[y * N + x] = s / tot; } return h; });

// diamond-square (midpoint displacement) on 2^k+1, reported for the (N+1) grid
time('diamond-square midpoint displacement (N+1)^2', () => { const M = N + 1, g = new Float32Array(M * M); let step = N, rough = 1; g[0] = R(); g[N] = R(); g[N * M] = R(); g[N * M + N] = R(); while (step > 1) { const hs = step >> 1; for (let y = hs; y < M; y += step) for (let x = hs; x < M; x += step) g[y * M + x] = (g[(y - hs) * M + x - hs] + g[(y - hs) * M + x + hs] + g[(y + hs) * M + x - hs] + g[(y + hs) * M + x + hs]) / 4 + (R() - 0.5) * rough; for (let y = 0; y < M; y += hs) for (let x = (y + hs) % step; x < M; x += step) { let s = 0, c = 0; if (y >= hs) { s += g[(y - hs) * M + x]; c++; } if (y + hs < M) { s += g[(y + hs) * M + x]; c++; } if (x >= hs) { s += g[y * M + x - hs]; c++; } if (x + hs < M) { s += g[y * M + x + hs]; c++; } g[y * M + x] = s / c + (R() - 0.5) * rough; } step = hs; rough *= 0.55; } return g; });

// binary min-heap on (key float, idx int)
class Heap { constructor(n) { this.k = new Float64Array(n); this.v = new Int32Array(n); this.n = 0; } push(k, v) { let i = this.n++; const K = this.k, V = this.v; while (i > 0) { const p = (i - 1) >> 1; if (K[p] <= k) break; K[i] = K[p]; V[i] = V[p]; i = p; } K[i] = k; V[i] = v; } pop() { const K = this.k, V = this.v; const top = V[0]; const k = K[--this.n], v = V[this.n]; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= this.n) break; if (c + 1 < this.n && K[c + 1] < K[c]) c++; if (K[c] >= k) break; K[i] = K[c]; V[i] = V[c]; i = c; } K[i] = k; V[i] = v; return top; } }
const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];

// Priority-Flood with epsilon (Barnes 2014, Alg. 3-style): fills depressions with a tiny gradient so every cell drains; also records the flood order and a receiver (the cell it was flooded from) = flow direction.
function priorityFlood(z, out, rec, order) {
  const closed = new Uint8Array(NN), hp = new Heap(NN); let oi = 0;
  for (let i = 0; i < NN; i++) { const x = i % N, y = (i / N) | 0; out[i] = z[i]; if (x === 0 || y === 0 || x === N - 1 || y === N - 1) { closed[i] = 1; rec[i] = i; hp.push(z[i], i); } }
  while (hp.n) { const c = hp.pop(); order[oi++] = c; const cx = c % N, cy = (c / N) | 0; for (let d = 0; d < 8; d++) { const x = cx + DX[d], y = cy + DY[d]; if (x < 0 || y < 0 || x >= N || y >= N) continue; const n = y * N + x; if (closed[n]) continue; closed[n] = 1; rec[n] = c; if (out[n] <= out[c]) out[n] = out[c] + 1e-5; hp.push(out[n], n); } }
}
const filled = new Float32Array(NN), rec = new Int32Array(NN), order = new Int32Array(NN);
time('priority-flood (heap, eps fill + receivers)', () => priorityFlood(h, filled, rec, order));
const acc = new Float32Array(NN);
time('flow accumulation (reverse flood order)', () => { acc.fill(1); for (let k = NN - 1; k > 0; k--) { const i = order[k]; if (rec[i] !== i) acc[rec[i]] += acc[i]; } });

// D8 steepest-descent receivers on the filled surface (classic), then topological accumulation via sort
time('D8 steepest receivers + sort-by-height accumulation', () => { const r = new Int32Array(NN); for (let i = 0; i < NN; i++) { const cx = i % N, cy = (i / N) | 0; let best = i, bs = 0; for (let d = 0; d < 8; d++) { const x = cx + DX[d], y = cy + DY[d]; if (x < 0 || y < 0 || x >= N || y >= N) continue; const n = y * N + x; const s = (filled[i] - filled[n]) / (d < 4 ? 1 : 1.4142); if (s > bs) { bs = s; best = n; } } r[i] = best; } const idx = new Uint32Array(NN); for (let i = 0; i < NN; i++) idx[i] = i; idx.sort((a, b) => filled[b] - filled[a]); const a = new Float32Array(NN).fill(1); for (let k = 0; k < NN; k++) { const i = idx[k]; if (r[i] !== i) a[r[i]] += a[i]; } });

// Stream power law, implicit Braun-Willett (n=1): z_i = (z_i + dt*U + F*z_r) / (1+F), F = K*dt*A^m/L, visited downstream->upstream (flood order). Plus uplift.
function streamPower(iters, K, m, dt, U) {
  const z = Float32Array.from(h, v => v * 0.1), out = new Float32Array(NN), r = new Int32Array(NN), o = new Int32Array(NN), A = new Float32Array(NN);
  for (let it = 0; it < iters; it++) {
    priorityFlood(z, out, r, o); z.set(out);
    A.fill(1); for (let k = NN - 1; k > 0; k--) { const i = o[k]; if (r[i] !== i) A[r[i]] += A[i]; }
    for (let k = 0; k < NN; k++) { const i = o[k], j = r[i]; if (j === i) continue; const L = (Math.abs(i - j) === 1 || Math.abs(i - j) === N) ? 1 : 1.4142; const F = K * dt * Math.pow(A[i], m) / L; z[i] = (z[i] + dt * U[i] + F * z[j]) / (1 + F); }
  }
  return z;
}
const U = new Float32Array(NN); for (let i = 0; i < NN; i++) U[i] = 5e-4 * h[i];
time('stream power: 1 iteration (flood+accum+solve)', () => streamPower(1, 2e-3, 0.5, 1, U));
time('stream power: 20 iterations', () => streamPower(20, 2e-3, 0.5, 1, U));

// Droplet erosion (Beyer/Lague defaults), radius-3 brush
function droplets(count) {
  const z = Float32Array.from(h, v => v * 20); const rad = 3; const bw = [], bo = []; let ws = 0; for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) { const d = Math.hypot(x, y); if (d < rad) { bw.push(1 - d / rad); bo.push([x, y]); ws += 1 - d / rad; } } for (let i = 0; i < bw.length; i++) bw[i] /= ws;
  const inertia = 0.05, capF = 4, minCap = 0.01, erode = 0.3, deposit = 0.3, evap = 0.01, grav = 4, life = 30;
  const hg = (px, py) => { const x = px | 0, y = py | 0, u = px - x, v = py - y, i = y * N + x; const a = z[i], b = z[i + 1], c = z[i + N], d = z[i + N + 1]; return [(b - a) * (1 - v) + (d - c) * v, (c - a) * (1 - u) + (d - b) * u, a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v]; };
  for (let k = 0; k < count; k++) {
    let px = R() * (N - 2), py = R() * (N - 2), dx = 0, dy = 0, sp = 1, w = 1, sed = 0;
    for (let s = 0; s < life; s++) {
      const nx = px | 0, ny = py | 0, ci = ny * N + nx, u = px - nx, v = py - ny; const [gx, gy, hh] = hg(px, py);
      dx = dx * inertia - gx * (1 - inertia); dy = dy * inertia - gy * (1 - inertia); const l = Math.hypot(dx, dy); if (l === 0) break; dx /= l; dy /= l; px += dx; py += dy;
      if (px < 0 || py < 0 || px >= N - 2 || py >= N - 2) break;
      const dh = hg(px, py)[2] - hh; const cap = Math.max(-dh * sp * w * capF, minCap);
      if (sed > cap || dh > 0) { const amt = dh > 0 ? Math.min(dh, sed) : (sed - cap) * deposit; sed -= amt; z[ci] += amt * (1 - u) * (1 - v); z[ci + 1] += amt * u * (1 - v); z[ci + N] += amt * (1 - u) * v; z[ci + N + 1] += amt * u * v; }
      else { const amt = Math.min((cap - sed) * erode, -dh); for (let b = 0; b < bw.length; b++) { const x = nx + bo[b][0], y = ny + bo[b][1]; if (x < 0 || y < 0 || x >= N || y >= N) continue; const j = y * N + x; const e = Math.min(amt * bw[b], z[j]); z[j] -= e; sed += e; } }
      sp = Math.sqrt(Math.max(0, sp * sp + dh * grav)); w *= 1 - evap;
    }
  }
}
time(`droplet erosion ${Math.round(NN * 0.5 / 1000)}k droplets (0.5 per cell)`, () => droplets(Math.round(NN * 0.5)));

// Thermal erosion: move fraction c of excess over talus T to lower 4-neighbors, 50 iterations
time('thermal erosion, 50 iterations (4-neigh, talus)', () => { const z = Float32Array.from(h, v => v * 20), dz = new Float32Array(NN); const T = 0.6, c = 0.5; for (let it = 0; it < 50; it++) { dz.fill(0); for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) { const i = y * N + x; let dmax = 0, dtot = 0; for (let d = 0; d < 4; d++) { const dd = z[i] - z[i + DX[d] + DY[d] * N]; if (dd > T) { dtot += dd; if (dd > dmax) dmax = dd; } } if (!dtot) continue; const move = c * (dmax - T); for (let d = 0; d < 4; d++) { const j = i + DX[d] + DY[d] * N; const dd = z[i] - z[j]; if (dd > T) { const m = move * dd / dtot; dz[i] -= m; dz[j] += m; } } } for (let i = 0; i < NN; i++) z[i] += dz[i]; } });

// Wind moisture sweep (west->east), orographic: moisture capped by (1-elev), excess rains
time('wind moisture sweep w/ rain shadow (1 pass)', () => { const rain = new Float32Array(NN); for (let y = 0; y < N; y++) { let m = 1; for (let x = 0; x < N; x++) { const i = y * N + x, e = h[i]; if (e < 0.45) { m = Math.min(1, m + 0.05); continue; } const cap = 1 - e; let r = m * 0.02; if (m > cap) { r += m - cap; m = cap; } rain[i] = r; m -= m * 0.02; } } });

// CA caves 45% fill, 5 iterations of 4-5 rule
time('cellular-automata caves, 5 iterations', () => { let a = new Uint8Array(NN), b = new Uint8Array(NN); for (let i = 0; i < NN; i++) a[i] = R() < 0.45 ? 1 : 0; for (let it = 0; it < 5; it++) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let w = 0; for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const xx = x + k, yy = y + j; w += (xx < 0 || yy < 0 || xx >= N || yy >= N) ? 1 : a[yy * N + xx]; } b[y * N + x] = w >= 5 ? 1 : 0; } [a, b] = [b, a]; } });

// Schott et al. 2023 style stream power (the GLSL kernel in H-Schott/StreamPowerErosion, ported): no heap, no sort.
// Each iteration every cell reads only its 8 neighbors from the previous buffers (ping-pong), so drainage area
// propagates one cell per iteration and the whole step is a fragment-shader-shaped pass. Parameters from the repo's shader:
// k=0.0005, m(p_sa)=0.8, n(p_sl)=2, dt=50, uplift=0.03, hillslope k_h=200 (Laplacian), multiple-flow exponent p_flow=1.
function speLocal(iters) {
  let z = Float32Array.from(h, v => v * 100), A = new Float32Array(NN).fill(1), z2 = new Float32Array(NN), A2 = new Float32Array(NN);
  const k = 0.0005, m = 0.8, n = 2, dt = 50, up = 0.03, kh = 200, cell = 1; const Uf = Float32Array.from(h);
  const DL = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];
  for (let it = 0; it < iters; it++) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (x === 0 || y === 0 || x === N - 1 || y === N - 1) { z2[i] = 0; A2[i] = cell; continue; }
      // inflow: each neighbor q sends A[q] * share, share = slope(q->i)/sum of q's downhill slopes (needs q's own neighbors)
      let water = 0;
      for (let d = 0; d < 8; d++) { const qx = x + DX[d], qy = y + DY[d], q = qy * N + qx; const s = (z[q] - z[i]) / DL[d]; if (s <= 0) continue; let ssum = 0; if (qx > 0 && qy > 0 && qx < N - 1 && qy < N - 1) { for (let e = 0; e < 8; e++) { const r = (qy + DY[e]) * N + qx + DX[e]; const se = (z[q] - z[r]) / DL[e]; if (se > 0) ssum += se; } } if (ssum > 0) water += A[q] * s / ssum; }
      const a = cell + water;
      let best = i, bs = 0; for (let d = 0; d < 8; d++) { const j = i + DX[d] + DY[d] * N; const s = (z[i] - z[j]) / DL[d]; if (s > bs) { bs = s; best = j; } }
      const lap = z[i + 1] + z[i - 1] + z[i + N] + z[i - N] - 4 * z[i];
      let nz = z[i] - dt * (k * Math.pow(a, m) * Math.pow(bs, n) - kh * 1e-4 * lap);
      if (nz < z[best]) nz = z[best];
      z2[i] = nz + dt * up * Uf[i]; A2[i] = a;
    }
    [z, z2] = [z2, z]; [A, A2] = [A2, A];
  }
  return z;
}
time('Schott-style local stream power: 1 iteration', () => speLocal(1));
time('Schott-style local stream power: 100 iterations', () => speLocal(100));
