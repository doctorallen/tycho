// looks-shared.js: the helpers the looks demos share (ramps, dither, styles), loaded before any of them.
// Each helper is exported on StudyShared, and a demo takes the ones it uses. Every random choice comes from
// Kit.rng, Kit.hash2 or Kit.noise2, so a seed always rebuilds the same picture.
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

  // =====================================================================
  // 2. dither: the same gradient and sphere brought down to N inks four ways
  // =====================================================================
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

  window.StudyShared = window.StudyShared || {};
  StudyShared.looks = { RGB, Pix, FONT, text, toLin, toByte, lab, labToLin, inGamut, lch, KLAB, nearestLab, LIGHT, lambert, stamp, ellipse, toward, hueRamp, naiveRamp, sphere, rampTree, BAYER4 };
})();
