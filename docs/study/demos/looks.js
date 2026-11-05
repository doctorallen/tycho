// looks.js: palette, dithering and style demos for the research page.
// ramps (OKLCH ramp generator), dither (four ways to reach N inks), styles (one scene through five rule sets).
'use strict';
(() => {
  const { RGB, Pix } = Kit;

  // ---- a 3x5 pixel font, so labels live inside the pixel canvas ----
  const FONT = {
    A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553', H: '55755', I: '72227',
    J: '11152', K: '55655', L: '44447', M: '57755', N: '65555', O: '25552', P: '65644', Q: '25563', R: '65655',
    S: '34216', T: '72222', U: '55557', V: '55552', W: '55775', X: '55255', Y: '55222', Z: '71247',
    0: '75557', 1: '26227', 2: '61247', 3: '61216', 4: '55711', 5: '74616', 6: '34757', 7: '71222', 8: '75757',
    9: '75716', '-': '00700', '.': '00002', '/': '11244', '+': '02720', ':': '02020', '(': '24442', ')': '42224',
  };
  function text(p, s, x, y, c) {
    for (const ch of String(s).toUpperCase()) {
      const g = FONT[ch];
      if (g) for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if (+g[r] & (4 >> b)) p.set(x + b, y + r, c);
      x += 4;
    }
    return x;
  }

  // ---- OKLab (Björn Ottosson), for ramps and for judging nearness ----
  const toLin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const toByte = x => { x = Math.max(0, Math.min(1, x)); return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)); };
  function lab(rgb) {
    const r = toLin(rgb[0]), g = toLin(rgb[1]), b = toLin(rgb[2]);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function labToLin(L, a, b) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  const inGamut = v => v.every(c => c >= -1e-4 && c <= 1.0001);
  // OKLCH to sRGB bytes, keeping hue and lightness and lowering chroma until it fits (never clamping channels).
  function lch(L, C, h) {
    const cs = Math.cos(h * Math.PI / 180), sn = Math.sin(h * Math.PI / 180);
    let lin = labToLin(L, C * cs, C * sn);
    if (!inGamut(lin)) {
      let lo = 0, hi = C;
      for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (inGamut(labToLin(L, mid * cs, mid * sn))) lo = mid; else hi = mid; }
      lin = labToLin(L, lo * cs, lo * sn);
    }
    return lin.map(toByte);
  }
  const KLAB = RGB.map(lab);
  function nearestLab(L, set) {
    let best = set[0], bd = Infinity;
    for (const i of set) { const k = KLAB[i], d = (L[0] - k[0]) ** 2 + (L[1] - k[1]) ** 2 + (L[2] - k[2]) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  }

  // ---- small painting helpers ----
  const LIGHT = (() => { const v = [-0.5, -0.62, 0.6], n = Math.hypot(...v); return v.map(x => x / n); })();
  const lambert = (nx, ny, nz) => Math.max(0, Math.min(0.999, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2] + 0.3) / 1.3));
  // copy a layer onto dst with a 1px outline around it in color oc
  function stamp(dst, layer, oc) {
    const { w, h } = layer;
    if (oc != null) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (layer.get(x, y) >= 0) continue;
      if (layer.get(x - 1, y) >= 0 || layer.get(x + 1, y) >= 0 || layer.get(x, y - 1) >= 0 || layer.get(x, y + 1) >= 0) dst.set(x, y, oc);
    }
    for (let i = 0; i < layer.d.length; i++) if (layer.d[i] >= 0) dst.d[i] = layer.d[i];
  }
  function ellipse(p, cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) p.set(x, y, c);
  }

  // =====================================================================
  // 1. ramps: an OKLCH ramp generator against a naive mix-with-black-and-white ramp
  // =====================================================================
  const toward = (h, target, amt) => { const d = ((target - h) % 360 + 540) % 360 - 180; return h + Math.sign(d) * Math.min(Math.abs(d), amt); };
  function hueRamp(h0, n, shift, cmax) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const L = 0.2 + 0.74 * t;                                   // even lightness steps
      const C = cmax * (0.45 + 0.55 * Math.sin(Math.PI * t));     // chroma arcs, peaking mid-ramp
      // shadows rotate toward blue-violet (h about 265), highlights toward yellow (about 95)
      const h = t < 0.5 ? toward(h0, 265, shift * (1 - 2 * t)) : toward(h0, 95, shift * (2 * t - 1));
      out.push(lch(L, C, h));
    }
    return out;
  }
  function naiveRamp(h0, n, cmax) {
    const base = lch(0.6, cmax, h0), out = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      // what a paint program's brightness slider does: mix toward black or white, same hue
      out.push(t < 0.5 ? base.map(c => Math.round(c * (1 - (0.5 - t) * 2 * 0.85)))
        : base.map(c => Math.round(c + (255 - c) * (t - 0.5) * 2 * 0.85)));
    }
    return out;
  }
  function sphere(p, cx, cy, r, base, n) {
    for (let y = -r; y < r; y++) for (let x = -r; x < r; x++) {
      const dx = (x + 0.5) / r, dy = (y + 0.5) / r, d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      p.set(cx + x, cy + y, base + Math.floor(lambert(dx, dy, Math.sqrt(1 - d2)) * n));
    }
  }
  // a small tree in one ramp: clumps shaded like spheres, trunk as a cylinder
  function rampTree(p, cx, cy, base, n) {
    const layer = new Pix(p.w, p.h);
    for (let y = cy; y < cy + 26; y++) for (let x = -3; x < 3; x++) {
      const nx = (x + 0.5) / 3;
      layer.set(cx + x, y, base + Math.min(n - 1, Math.floor(lambert(nx, 0, Math.sqrt(1 - nx * nx)) * n * 0.7)));
    }
    const clumps = [[0, -10, 10], [-8, -2, 8], [8, -2, 8], [0, 2, 8]];
    for (let y = -22; y < 12; y++) for (let x = -18; x < 18; x++) {
      let hit = null;
      for (const c of clumps) if ((x + 0.5 - c[0]) ** 2 + (y + 0.5 - c[1]) ** 2 <= c[2] * c[2]) hit = c;
      if (!hit) continue;
      const dx = (x + 0.5 - hit[0]) / hit[2], dy = (y + 0.5 - hit[1]) / hit[2];
      layer.set(cx + x, cy + y, base + Math.floor(lambert(dx, dy, Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy))) * n));
    }
    stamp(p, layer, base);
  }

  Kit.register('ramps', { title: 'OKLCH ramp generator', fit: 'prebake' }, host => {
    const W = 192, H = 96;
    const c = Kit.canvas(host, W, H);
    const st = { hue: 145, n: 6, shift: 40, chroma: 0.14 };
    const draw = () => {
      const { hue, n, shift, chroma } = st;
      const pal = [...hueRamp(hue, n, shift, chroma), ...naiveRamp(hue, n, chroma), RGB[1], RGB[5], RGB[2]];
      const BG = 2 * n, TX = 2 * n + 1, LN = 2 * n + 2;
      const p = new Pix(W, H).fill(BG);
      for (let y = 0; y < H; y++) p.set(96, y, LN);
      [['OKLCH + HUE SHIFT', 0], ['MIX BLACK / WHITE', n]].forEach(([label, base], k) => {
        const x0 = k * 96;
        text(p, label, x0 + 48 - label.length * 2, 3, TX);
        const sw = Math.floor(84 / n), sx = x0 + 48 - (sw * n) / 2;
        for (let i = 0; i < n; i++) p.rect(sx + i * sw, 11, sw, 10, base + i);
        ellipse(p, x0 + 32, 79, 15, 3, base);
        ellipse(p, x0 + 72, 80, 11, 2.5, base);
        sphere(p, x0 + 28, 55, 18, base, n);
        rampTree(p, x0 + 72, 55, base, n);
      });
      c.put(p, pal);
    };
    const b = Kit.bar(host);
    b.slider('Hue', 0, 359, 1, st.hue, v => { st.hue = v; draw(); });
    b.slider('Steps', 3, 9, 1, st.n, v => { st.n = v; draw(); });
    b.slider('Hue shift', 0, 60, 1, st.shift, v => { st.shift = v; draw(); });
    b.slider('Chroma', 0.04, 0.24, 0.01, st.chroma, v => { st.chroma = v; draw(); });
    b.note('Left: lightness in even OKLab steps, chroma peaking mid-ramp, shadows turned toward blue-violet and highlights toward yellow, kept in sRGB by lowering chroma. Right: the middle color mixed with black and white, as a brightness slider does.');
    draw();
  });

  // =====================================================================
  // 2. dither: the same gradient and sphere brought down to N inks four ways
  // =====================================================================
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  // Void-and-cluster (Ulichney 1993) on a 32x32 torus: a true blue-noise threshold map, about 20 ms to build.
  function voidCluster(N, seed) {
    const sz = N * N, sig2 = 2 * 1.5 * 1.5;
    const K = new Float32Array(sz);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = Math.min(x, N - x), dy = Math.min(y, N - y);
      K[y * N + x] = Math.exp(-(dx * dx + dy * dy) / sig2);
    }
    const E = new Float32Array(sz), B = new Uint8Array(sz);
    const add = (p, s) => {
      const px = p % N, py = (p / N) | 0;
      for (let y = 0; y < N; y++) { const ky = ((y - py + N) % N) * N; for (let x = 0; x < N; x++) E[y * N + x] += s * K[ky + (x - px + N) % N]; }
    };
    const pick = (want, sign) => { let best = -1, bv = Infinity; for (let i = 0; i < sz; i++) if (B[i] === want && sign * E[i] < bv) { bv = sign * E[i]; best = i; } return best; };
    const tightest = () => pick(1, -1), voidest = () => pick(0, 1);
    const r = Kit.rng(seed), ones = Math.floor(sz * 0.1);
    for (let k = 0; k < ones;) { const p = r.int(0, sz - 1); if (!B[p]) { B[p] = 1; add(p, 1); k++; } }
    for (let it = 0; it < sz * 2; it++) {
      const t = tightest(); B[t] = 0; add(t, -1);
      const v = voidest(); if (v === t) { B[t] = 1; add(t, 1); break; }
      B[v] = 1; add(v, 1);
    }
    const proto = B.slice(), protoE = E.slice(), rank = new Int32Array(sz);
    for (let n = ones; n > 0;) { const t = tightest(); B[t] = 0; add(t, -1); rank[t] = --n; }
    B.set(proto); E.set(protoE);
    for (let n = ones; n < sz; n++) { const v = voidest(); B[v] = 1; add(v, 1); rank[v] = n; }
    return Float32Array.from(rank, v => (v + 0.5) / sz);
  }
  let BLUE = null;

  Kit.register('dither', { title: 'Dithering to N inks', fit: 'prebake' }, host => {
    const W = 192, H = 94, CW = 48;
    const c = Kit.canvas(host, W, H);
    if (!BLUE) BLUE = voidCluster(32, 7);
    const PALS = { 2: [0, 7], 4: [0, 21, 23, 25], 8: [0, 20, 21, 22, 23, 24, 25, 7] };
    // the source, in column coordinates: a horizontal gradient strip and a lit sphere on a soft floor
    const field = (x, y) => {
      if (y >= 10 && y < 26 && x >= 2 && x < CW - 2) return (x - 2) / (CW - 5);
      if (y >= 30 && y < 84 && x >= 2 && x < CW - 2) {
        const dx = (x + 0.5 - 24) / 17, dy = (y + 0.5 - 54) / 17, d2 = dx * dx + dy * dy;
        if (d2 <= 1) return 0.08 + 0.92 * lambert(dx, dy, Math.sqrt(1 - d2));
        const sh = ((x + 0.5 - 27) / 17) ** 2 + ((y + 0.5 - 74) / 4) ** 2;
        return (0.18 + 0.32 * (y - 30) / 54) * (sh < 1 ? 0.45 : 1);
      }
      return null;
    };
    const draw = n => {
      const set = PALS[n], Ls = set.map(i => KLAB[i][0]);
      const L0 = Ls[0], L1 = Ls[Ls.length - 1];
      const p = new Pix(W, H).fill(1);
      // quantize a target lightness with threshold t in [0,1): pick the upper neighbor when the fraction passes t
      const q = (L, t) => {
        if (L <= Ls[0]) return set[0];
        for (let k = 0; k < Ls.length - 1; k++) if (L < Ls[k + 1]) return (L - Ls[k]) / (Ls[k + 1] - Ls[k]) > t ? set[k + 1] : set[k];
        return set[set.length - 1];
      };
      const nearest = L => { let b = 0; for (let k = 1; k < Ls.length; k++) if (Math.abs(Ls[k] - L) < Math.abs(Ls[b] - L)) b = k; return b; };
      const names = ['NEAREST', 'BAYER 4X4', 'BLUE NOISE', 'FLOYD-STEIN'];
      for (let m = 0; m < 4; m++) {
        const x0 = m * CW;
        text(p, names[m], x0 + 24 - names[m].length * 2, 2, 5);
        const err = new Float32Array((CW + 2) * 2);
        for (let y = 0; y < H; y++) {
          // Floyd–Steinberg: serpentine rows, error carried in a two-row buffer
          const rev = m === 3 && (y & 1);
          if (m === 3) { err.copyWithin(0, CW + 2); err.fill(0, CW + 2); }
          for (let k = 0; k < CW; k++) {
            const x = rev ? CW - 1 - k : k;
            const v = field(x, y); if (v == null) continue;
            const L = L0 + v * (L1 - L0);
            let out;
            if (m === 0) out = set[nearest(L)];
            else if (m === 1) out = q(L, BAYER4[(y & 3) * 4 + (x & 3)]);
            else if (m === 2) out = q(L, BLUE[(y & 31) * 32 + ((x + m * 11) & 31)]);
            else {
              const want = L + err[x + 1], j = nearest(want), e = want - Ls[j], d = rev ? -1 : 1;
              out = set[j];
              err[x + 1 + d] += e * 7 / 16;
              err[CW + 2 + x + 1 - d] += e * 3 / 16; err[CW + 2 + x + 1] += e * 5 / 16; err[CW + 2 + x + 1 + d] += e * 1 / 16;
            }
            p.set(x0 + x, y, out);
          }
        }
      }
      // the inks in use, along the bottom
      const sw = Math.floor((W - 8) / n);
      for (let i = 0; i < n; i++) p.rect(4 + i * sw, H - 7, sw - 1, 5, set[i]);
      c.put(p);
    };
    const b = Kit.bar(host);
    b.tabs(['2 inks', '4 inks', '8 inks'], v => draw(parseInt(v, 10)), '4 inks');
    b.note('Each method picks between the two inks either side of the wanted lightness (in OKLab). Blue noise is a 32×32 void-and-cluster map built at load. Floyd–Steinberg runs serpentine. Ordered patterns stay put when things move; error diffusion shimmers.');
    draw(4);
  });

  // =====================================================================
  // 3. styles: one scene described once in full color, printed through five rule sets
  // =====================================================================
  const SW = 96, SH = 96;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const ramp = (idx, t) => { t = Math.max(0, Math.min(1, t)) * (idx.length - 1); const i = Math.min(idx.length - 2, Math.floor(t)); return mix(RGB[idx[i]], RGB[idx[i + 1]], t - i); };
  const dark = (c, k) => c.map(v => v * k);
  // obj: 0 sky, 1 land, 2 tree, 3 house, 4 hero. Objects 2-4 are the ones a style outlines.
  function paintScene() {
    const col = new Array(SW * SH), obj = new Int8Array(SW * SH);
    const put = (x, y, c, o) => { if (x >= 0 && y >= 0 && x < SW && y < SH) { col[y * SW + x] = c; obj[y * SW + x] = o; } };
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      if (y < 58) put(x, y, ramp([22, 23, 24, 25], y / 60), 0);
      else put(x, y, ramp([18, 17, 16], (y - 58) / 40), 1);
    }
    for (let y = 4; y < 20; y++) for (let x = 50; x < 90; x++) {
      const inC = [[62, 14, 6], [70, 11, 7], [78, 14, 5], [56, 16, 3.5]].some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
      if (inC && y <= 17) put(x, y, y > 14 ? RGB[6] : RGB[7], 0);
    }
    for (let x = 0; x < SW; x++) {
      const top = Math.round(50 + 3 * Math.sin(x * 0.07 + 1) + 2 * Math.sin(x * 0.19));
      for (let y = top; y < 58; y++) put(x, y, mix(RGB[16], RGB[23], 0.45 + (y - top) * 0.02), 0);
    }
    // shadows and path on the land
    for (let y = 58; y < SH; y++) for (let x = 0; x < SW; x++) {
      const i = y * SW + x;
      if (((x - 21) / 13) ** 2 + ((y - 72) / 3) ** 2 <= 1 || ((x - 44.5) / 6) ** 2 + ((y - 79) / 1.6) ** 2 <= 1) col[i] = dark(col[i], 0.72);
      const cx = 67 - (y - 68) * 0.55, hw = 3 + (y - 68) * 0.22;
      if (y >= 68 && Math.abs(x + 0.5 - cx) <= hw) col[i] = Math.abs(x + 0.5 - cx) > hw - 1 ? RGB[28] : RGB[29];
    }
    const tr = Kit.rng(5);
    for (let k = 0; k < 16; k++) {
      const x = tr.int(2, 92), y = tr.int(61, 93);
      if (y >= 66 && Math.abs(x - (67 - (y - 68) * 0.55)) < 9) continue;
      const g = dark(col[y * SW + x], 0.7); put(x, y, g, 1); put(x + 2, y, g, 1); put(x + 1, y + 1, g, 1);
    }
    // house
    for (let y = 30; y < 46; y++) {
      const l = Math.round(56 - (y - 30) * 0.25), r = Math.round(88 + (y - 30) * 0.25);
      for (let x = l; x <= r; x++) put(x, y, y === 30 ? RGB[11] : (y - 30) % 4 === 3 ? RGB[9] : x < l + 7 ? mix(RGB[10], RGB[11], 0.5) : RGB[10], 3);
    }
    for (let y = 22; y < 30; y++) for (let x = 77; x < 83; x++) put(x, y, y === 22 ? RGB[5] : x > 80 ? RGB[3] : RGB[4], 3);
    for (let y = 46; y < 69; y++) for (let x = 56; x <= 88; x++) put(x, y, y < 48 ? RGB[5] : y === 68 ? RGB[4] : x > 82 ? mix(RGB[6], RGB[5], 0.6) : RGB[6], 3);
    for (let y = 54; y < 68; y++) for (let x = 62; x < 71; x++) put(x, y, x === 62 ? RGB[28] : x === 66 ? RGB[26] : RGB[27], 3);
    put(69, 61, RGB[13], 3);
    for (let y = 51; y < 60; y++) for (let x = 75; x < 84; x++) {
      const frame = y === 51 || y === 59 || x === 75 || x === 83 || x === 79 || y === 55;
      put(x, y, frame ? RGB[27] : (x === 76 && y === 52) ? RGB[25] : RGB[24], 3);
    }
    // tree
    for (let y = 46; y < 73; y++) for (let x = 17; x < 24; x++) put(x, y, x < 20 ? RGB[28] : x < 22 ? RGB[27] : RGB[26], 2);
    const clumps = [[20, 30, 12], [10, 39, 9], [30, 39, 9], [20, 44, 9]];
    for (let y = 14; y < 56; y++) for (let x = 0; x < 42; x++) {
      let hit = null;
      for (const cl of clumps) if ((x + 0.5 - cl[0]) ** 2 + (y + 0.5 - cl[1]) ** 2 <= cl[2] * cl[2]) hit = cl;
      if (!hit) continue;
      const dx = (x + 0.5 - hit[0]) / hit[2], dy = (y + 0.5 - hit[1]) / hit[2];
      put(x, y, ramp([15, 16, 17, 18, 19], lambert(dx, dy, Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy))) * 1.05), 2);
    }
    // hero, from a tiny map; the right side of each part is shaded
    const HERO = ['...HHH...', '..HHHHH..', '..HFFFH..', '..FEFEF..', '..FFFFF..', '...FFF...', '..SSSSS..', '.SSSSSSS.',
      '.FSSSSSF.', '.FSSSSSF.', '..SSSSS..', '..PPPPP..', '..PP.PP..', '..PP.PP..', '..PP.PP..', '..BB.BB..'];
    const skin = mix(RGB[13], RGB[12], 0.35);
    const parts = { H: RGB[27], F: skin, E: RGB[0], S: RGB[23], P: RGB[3], B: RGB[26] };
    HERO.forEach((row, j) => [...row].forEach((ch, i) => { if (parts[ch]) put(40 + i, 63 + j, i >= 6 && ch !== 'E' ? dark(parts[ch], 0.72) : parts[ch], 4); }));
    return { col, obj, lab: col.map(lab) };
  }

  const PICO = [0, 21, 30, 15, 28, 3, 5, 7, 10, 12, 19, 17, 23, 4, 31, 29];
  const NESG = [0, 1, 3, 5, 7, 9, 10, 12, 13, 15, 17, 18, 21, 23, 24, 26, 27, 28, 29, 30];
  const ALL = RGB.map((_, i) => i);
  const STYLES = {
    '1-bit': { lines: ['1-BIT', 'INKS 2', 'OUTLINE INK', '4 TONES AS PATTERNS', 'MAP BY LIGHTNESS'], lum: [0, 7], patterns: true, outline: 'ink' },
    'Game Boy': { lines: ['GAME BOY-LIKE', 'INKS 4, ONE HUE', 'OUTLINE DARKEST', 'DITHER AT BANDS', 'MAP BY LIGHTNESS'], lum: [14, 16, 18, 19], dither: 0.55, outline: 'ink' },
    'NES': { lines: ['NES-LIKE', '3 INKS PER OBJECT', 'FROM 20 FIXED', 'OUTLINE BLACK', 'NO DITHER'], perObject: NESG, outline: 'ink' },
    'PICO-8': { lines: ['PICO-8-LIKE', 'INKS 16 FIXED', 'OUTLINE BLACK', 'NO DITHER', '128X128 SCREEN'], set: PICO, outline: 'ink' },
    'Hi-bit': { lines: ['HI-BIT', 'INKS 32', 'COLORED OUTLINES', 'LIT EDGES LIGHTER', 'SOFT RAMPS'], set: ALL, outline: 'color' },
  };
  // best k inks from a set for a list of OKLab colors, by trying every combination (20 choose 3 is 1140)
  function pickInks(labs, cands, k, forced) {
    const free = cands.filter(c => !forced.includes(c)), need = k - forced.length;
    const D = free.map(c => labs.map(L => { const q = KLAB[c]; return (L[0] - q[0]) ** 2 + 3 * ((L[1] - q[1]) ** 2 + (L[2] - q[2]) ** 2); }));
    const F = labs.map(L => forced.reduce((b, c) => { const q = KLAB[c]; return Math.min(b, (L[0] - q[0]) ** 2 + (L[1] - q[1]) ** 2 + (L[2] - q[2]) ** 2); }, Infinity));
    let best = null, be = Infinity;
    const walk = (start, picked) => {
      if (picked.length === need) {
        let e = 0;
        for (let j = 0; j < labs.length && e < be; j++) { let m = F[j]; for (const a of picked) m = Math.min(m, D[a][j]); e += m; }
        if (e < be) { be = e; best = picked.slice(); }
        return;
      }
      for (let a = start; a < free.length; a++) { picked.push(a); walk(a + 1, picked); picked.pop(); }
    };
    walk(0, []);
    return [...forced, ...best.map(a => free[a])];
  }
  function printStyle(scene, st) {
    const p = new Pix(SW, SH), sub = {};
    const { col, obj, lab: labs } = scene;
    if (st.perObject) for (let o = 0; o < 5; o++) {
      const mine = []; for (let i = 0; i < labs.length; i += 1) if (obj[i] === o) mine.push(labs[i]);
      sub[o] = pickInks(mine.filter((_, i) => i % 3 === 0), st.perObject, 3, o >= 2 ? [0] : []);
    }
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const i = y * SW + x;
      let out;
      if (st.lum) {
        const n = st.lum.length, v = Math.max(0, Math.min(1, (labs[i][0] - 0.38) / 0.55));
        const t = BAYER4[(y & 3) * 4 + (x & 3)] - 0.5;
        // pattern rule: ink, 50% checker, 25% dots, paper; flat tone areas instead of a gradient of dither
        if (st.patterns) { const k = Math.min(3, Math.floor(v * 4)); out = st.lum[[0, (x + y) & 1, (x & 1) | (y & 1), 1][k]]; }
        else out = st.lum[Math.max(0, Math.min(n - 1, Math.round(v * (n - 1) + t * st.dither)))];
      } else out = nearestLab(labs[i], st.perObject ? sub[obj[i]] : st.set);
      p.d[i] = out;
    }
    // outline policy: silhouette pixels of tree, house and hero
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const i = y * SW + x, o = obj[i];
      if (o < 2) continue;
      const nb = [[x, y - 1, 1], [x - 1, y, 1], [x + 1, y, 0], [x, y + 1, 0]].find(([a, b]) => a >= 0 && b >= 0 && a < SW && b < SH && obj[b * SW + a] !== o);
      if (!nb) continue;
      if (st.outline === 'ink') p.d[i] = st.lum ? st.lum[0] : 0;
      else p.d[i] = nearestLab(lab(dark(col[i], nb[2] ? 0.62 : 0.38)), st.set); // lit side (top/left) gets a lighter line
    }
    return { p, sub };
  }

  Kit.register('styles', { title: 'One scene, five style rule sets', fit: 'prebake' }, host => {
    const W = 192, H = 104;
    const c = Kit.canvas(host, W, H);
    const scene = paintScene();
    const draw = name => {
      const st = STYLES[name];
      const { p: art, sub } = printStyle(scene, st);
      const p = new Pix(W, H).fill(1);
      p.rect(3, 3, SW + 2, SH + 2, 2);
      for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) p.set(4 + x, 4 + y, art.d[y * SW + x]);
      let y = 6;
      st.lines.forEach((l, k) => { text(p, l, 108, y, k ? 5 : 7); y += k ? 7 : 9; });
      const used = [...new Set(art.d)].sort((a, b) => KLAB[a][0] - KLAB[b][0]);
      y += 3;
      if (st.perObject) {
        ['SKY', 'LAND', 'TREE', 'HOUSE', 'HERO'].forEach((nm, o) => {
          text(p, nm, 108, y + 1, 4);
          sub[o].forEach((ci, k) => p.rect(136 + k * 9, y, 8, 7, ci));
          y += 9;
        });
      } else {
        text(p, 'USED ' + used.length, 108, y, 4); y += 8;
        used.forEach((ci, k) => p.rect(108 + (k % 8) * 10, y + Math.floor(k / 8) * 8, 9, 7, ci));
      }
      c.put(p);
    };
    const b = Kit.bar(host);
    b.tabs(Object.keys(STYLES), draw, 'Hi-bit');
    b.note('The scene is painted once in free color (left-lit shapes and object ids). Each style is just rules: a locked palette, how colors map onto it (by lightness, nearest in OKLab, or best 3 inks per object), an outline policy and a dither policy.');
    draw('Hi-bit');
  });
})();
