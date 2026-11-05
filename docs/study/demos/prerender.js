// prerender.js: a tiny offline 3D-to-pixel pipeline, run in the page and cached.
// Models are signed distance fields written in code (smooth unions of spheres, capsules, cones and boxes).
// A small software ray marcher renders each at 3x with a key light, a fill, soft shadows and ambient occlusion,
// downsamples it, then finishes it two ways: a gothic pre-render (isometric, a dark invented 256-color palette,
// soft edges, a light radius, colormaps) and a cozy 3/4 (oblique camera, OKLCH ramps, cel bands, selective outline).
'use strict';
(() => {
  const D2R = Math.PI / 180;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const norm3 = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };

  // ---- a 3x5 pixel font (rows as 3-bit masks), so labels live inside the pixel canvas ----
  const FONT = {
    A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553', H: '55755', I: '72227',
    J: '11152', K: '55655', L: '44447', M: '57755', N: '65555', O: '25552', P: '65644', Q: '25563', R: '65655',
    S: '34216', T: '72222', U: '55557', V: '55552', W: '55775', X: '55255', Y: '55222', Z: '71247',
    0: '75557', 1: '26227', 2: '61247', 3: '61216', 4: '55711', 5: '74616', 6: '34757', 7: '71222', 8: '75757',
    9: '75716', '-': '00700', '.': '00002', '/': '11244', '+': '02720', ':': '02020', '%': '51245',
  };

  // ---- color: sRGB, linear and OKLab (Björn Ottosson) ----
  const toLin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const toByte = x => { x = x < 0 ? 0 : x > 1 ? 1 : x; return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)); };
  const LIN = new Float32Array(256).map((_, i) => toLin(i));
  function labLin(r, g, b) {
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
  const labRGB = (L, a, b) => labToLin(L, a, b).map(toByte);
  const inGamut = v => v.every(c => c >= -1e-4 && c <= 1.0001);
  // OKLCH to sRGB bytes, lowering chroma until it fits
  function lch(L, C, h) {
    const cs = Math.cos(h * D2R), sn = Math.sin(h * D2R);
    let lin = labToLin(L, C * cs, C * sn);
    if (!inGamut(lin)) {
      let lo = 0, hi = C;
      for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (inGamut(labToLin(L, mid * cs, mid * sn))) lo = mid; else hi = mid; }
      lin = labToLin(L, lo * cs, lo * sn);
    }
    return lin.map(toByte);
  }
  const toward = (h, target, amt) => { const d = ((target - h) % 360 + 540) % 360 - 180; return h + Math.sign(d) * Math.min(Math.abs(d), amt); };
  const hexLin = h => [1, 3, 5].map(i => LIN[parseInt(h.slice(i, i + 2), 16)]);

  // =====================================================================
  // SDF shapes. Each is {f(x,y,z), bb:[x0,y0,z0,x1,y1,z1]}; the box bounds the shape, so it gives a cheap skip.
  // =====================================================================
  const sph = (cx, cy, cz, r) => ({
    f: (x, y, z) => { const a = x - cx, b = y - cy, c = z - cz; return Math.sqrt(a * a + b * b + c * c) - r; },
    bb: [cx - r, cy - r, cz - r, cx + r, cy + r, cz + r],
  });
  // a capsule whose radius runs from ra to rb (a round cone, close enough to a true distance for marching)
  function cone(a, b, ra, rb = ra) {
    const [ax, ay, az] = a, bx = b[0] - ax, by = b[1] - ay, bz = b[2] - az, inv = 1 / (bx * bx + by * by + bz * bz), dr = rb - ra, R = Math.max(ra, rb);
    return {
      f: (x, y, z) => {
        const px = x - ax, py = y - ay, pz = z - az;
        let t = (px * bx + py * by + pz * bz) * inv; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = px - bx * t, qy = py - by * t, qz = pz - bz * t;
        return Math.sqrt(qx * qx + qy * qy + qz * qz) - (ra + dr * t);
      },
      bb: [Math.min(ax, b[0]) - R, Math.min(ay, b[1]) - R, Math.min(az, b[2]) - R, Math.max(ax, b[0]) + R, Math.max(ay, b[1]) + R, Math.max(az, b[2]) + R],
    };
  }
  // a rounded box with half sizes h, optionally turned about the x axis (for roofs)
  function box(cx, cy, cz, hx, hy, hz, r = 0, rotX = 0) {
    const c = Math.cos(rotX * D2R), s = Math.sin(rotX * D2R);
    const ey = Math.abs(c) * hy + Math.abs(s) * hz, ez = Math.abs(s) * hy + Math.abs(c) * hz;
    return {
      f: (x, y, z) => {
        const px = x - cx, py = y - cy, pz = z - cz;
        const ly = c * py + s * pz, lz = -s * py + c * pz;
        const qx = Math.abs(px) - hx + r, qy = Math.abs(ly) - hy + r, qz = Math.abs(lz) - hz + r;
        const ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0, oz = qz > 0 ? qz : 0;
        const inside = Math.min(Math.max(qx, qy, qz), 0);
        return Math.sqrt(ox * ox + oy * oy + oz * oz) + inside - r;
      },
      bb: [cx - hx, cy - ey, cz - ez, cx + hx, cy + ey, cz + ez],
    };
  }
  // a capped cylinder between two points (Inigo Quilez's formula)
  function cyl(a, b, r) {
    const [ax, ay, az] = a, bx = b[0] - ax, by = b[1] - ay, bz = b[2] - az, baba = bx * bx + by * by + bz * bz;
    return {
      f: (x, y, z) => {
        const px = x - ax, py = y - ay, pz = z - az, paba = px * bx + py * by + pz * bz;
        const vx = px * baba - bx * paba, vy = py * baba - by * paba, vz = pz * baba - bz * paba;
        const X = Math.sqrt(vx * vx + vy * vy + vz * vz) - r * baba, Y = Math.abs(paba - baba * 0.5) - baba * 0.5;
        const x2 = X * X, y2 = Y * Y * baba;
        const d = Math.max(X, Y) < 0 ? -Math.min(x2, y2) : (X > 0 ? x2 : 0) + (Y > 0 ? y2 : 0);
        return Math.sign(d) * Math.sqrt(Math.abs(d)) / baba;
      },
      bb: [Math.min(ax, b[0]) - r, Math.min(ay, b[1]) - r, Math.min(az, b[2]) - r, Math.max(ax, b[0]) + r, Math.max(ay, b[1]) + r, Math.max(az, b[2]) + r],
    };
  }
  // keep only the part of a shape above y = h
  const above = (sh, h) => ({ f: (x, y, z) => Math.max(sh.f(x, y, z), h - y), bb: [sh.bb[0], Math.max(h, sh.bb[1]), sh.bb[2], sh.bb[3], sh.bb[4], sh.bb[5]] });
  // one material's worth of shapes, unioned smoothly, with each part skipped when its bound is far
  function group(list, k) {
    const bs = list.map(s => sphereOf(s.bb));
    const bb = list.reduce((b, s) => [0, 1, 2].map(i => Math.min(b[i], s.bb[i])).concat([3, 4, 5].map(i => Math.max(b[i], s.bb[i]))), [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]);
    return {
      f: (x, y, z) => {
        let d = 1e9;
        for (let i = 0; i < list.length; i++) {
          const b = bs[i], ex = x - b[0], ey = y - b[1], ez = z - b[2];
          if (Math.sqrt(ex * ex + ey * ey + ez * ez) - b[3] > d + k) continue;
          d = smin(d, list[i].f(x, y, z), k);
        }
        return d;
      },
      bb,
    };
  }
  const sphereOf = bb => [(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2, Math.hypot(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]) / 2];
  // polynomial smooth min (Quilez); k is the blend width
  const smin = (a, b, k) => { if (k <= 0) return a < b ? a : b; const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  const P = (shape, mat, k = 0.03, sub = false) => ({ shape, mat, k, sub });

  // the field of a whole model: parts in order, smooth-unioned (or carved), with the material of the nearest part
  function makeSDF(parts) {
    const n = parts.length, F = parts.map(p => p.shape.f), K = parts.map(p => p.k), S = parts.map(p => p.sub), Mt = parts.map(p => p.mat);
    const B = parts.map(p => sphereOf(p.shape.bb));
    let mat = 0;
    const f = (x, y, z) => {
      let d = 1e9, m = 0;
      for (let i = 0; i < n; i++) {
        const k = K[i], b = B[i], ex = x - b[0], ey = y - b[1], ez = z - b[2];
        const bd = Math.sqrt(ex * ex + ey * ey + ez * ez) - b[3];
        if (S[i]) {
          if (bd > k - d) continue;
          const di = -F[i](x, y, z);
          if (di > d) m = Mt[i];
          d = smax(d, di, k);
        } else {
          if (bd > d + k) continue;
          const di = F[i](x, y, z);
          if (di < d) m = Mt[i];
          d = smin(d, di, k);
        }
      }
      mat = m;
      return d;
    };
    f.mat = () => mat;
    return f;
  }

  // =====================================================================
  // The models. Units are about a foot; y is up, the model faces +z. Each material carries
  // an albedo for the render and an OKLCH ramp seed [hue, chroma, darkest L, lightest L] for the cozy finish.
  // pat() may swap a material (an emblem, timber framing) or set MK, a groove that darkens (planks, shingles).
  // =====================================================================
  let MK = 0;
  const frac = v => v - Math.floor(v);
  const MODELS = {
    Knight() {
      // the color plan of a gothic player sprite: one saturated costume hue (the tabard) on dark cloth,
      // warm leather and skin, gold trim that catches the light, a cool steel-blue blade, the rest near black
      const mats = [
        { alb: '#5c626b', cz: [250, 0.025, 0.42, 0.88], metal: 1, rough: 0.8 },  // 0 dark steel
        { alb: '#7a1a1a', cz: [22, 0.13, 0.4, 0.74], dye: 1, rough: 1 },          // 1 tabard (the dye)
        { alb: '#5a3820', cz: [48, 0.08, 0.32, 0.6], rough: 1 },                  // 2 leather
        { alb: '#c08a30', cz: [80, 0.12, 0.56, 0.9], metal: 1, rough: 0.5 },      // 3 gold trim
        { alb: '#0d0c0d', cz: [285, 0.03, 0.2, 0.32], rough: 0 },                 // 4 the dark inside the helm
        { alb: '#342a2c', cz: [300, 0.03, 0.26, 0.46], rough: 1 },                // 5 dark cloth
        { alb: '#9a6648', cz: [50, 0.08, 0.5, 0.78], rough: 0.6 },                // 6 skin
        { alb: '#7d93b8', cz: [245, 0.05, 0.56, 0.92], metal: 1, rough: 0.3 },    // 7 blade
      ];
      const parts = [];
      for (const s of [-1, 1]) {
        parts.push(P(cone([s * 0.11, 0.12, 0], [s * 0.1, 0.8, 0], 0.075, 0.09), 5, 0.05));
        parts.push(P(cone([s * 0.11, 0.16, 0.025], [s * 0.11, 0.5, 0.02], 0.082, 0.078), 0, 0.02));
        parts.push(P(box(s * 0.11, 0.065, 0.04, 0.07, 0.065, 0.12, 0.04), 2, 0.03));
        parts.push(P(sph(s * 0.24, 1.37, 0, 0.12), 0, 0.04));
        parts.push(P(cone([s * 0.25, 1.32, 0], [s * 0.28, 1.06, 0.03], 0.06, 0.055), 5, 0.03));
        parts.push(P(cone([s * 0.28, 1.06, 0.03], [s * 0.26, 0.88, 0.12], 0.058, 0.052), 0, 0.03));
        parts.push(P(sph(s * 0.26, 0.86, 0.14, 0.058), 2, 0.02));
      }
      parts.push(
        P(box(0, 1.08, 0, 0.17, 0.3, 0.11, 0.08), 5, 0.05),
        P(box(0, 1.19, 0.015, 0.185, 0.19, 0.12, 0.08), 0, 0.04),
        P(box(0, 0.98, -0.15, 0.2, 0.42, 0.025, 0.02), 5, 0.04),
        P(box(0, 0.88, 0, 0.165, 0.4, 0.14, 0.03), 1, 0.02),
        P(box(0, 0.84, 0, 0.195, 0.035, 0.155, 0.01), 2, 0.01),
        P(box(0, 0.84, 0.16, 0.04, 0.03, 0.015), 3, 0),
        // the sword, held up before him in the right hand (-x)
        P(cone([-0.26, 0.95, 0.2], [-0.25, 1.74, 0.28], 0.032, 0.014), 7, 0.004),
        P(cone([-0.37, 0.93, 0.19], [-0.15, 0.93, 0.19], 0.024), 3, 0.01),
        P(sph(-0.26, 0.78, 0.13, 0.035), 3, 0.01),
        // neck, an open helm with a nasal, the face, a crest
        P(cone([0, 1.36, 0], [0, 1.5, 0], 0.07), 2, 0.03),
        P(sph(0, 1.64, 0, 0.14), 0, 0.03),
        P(box(0, 1.55, 0.13, 0.085, 0.085, 0.11), 4, 0.01, true),
        P(sph(0, 1.57, 0.02, 0.1), 6, 0.01),
        P(box(0, 1.58, 0.12, 0.013, 0.05, 0.02, 0.006), 0, 0.005),
        P(cone([0, 1.8, 0.07], [0, 1.77, -0.15], 0.038, 0.026), 1, 0.03),
      );
      const pat = (m, x, y, z, nx, ny, nz) => {
        // a gold cross on the tabard, front and back
        if (m === 1 && Math.abs(nz) > 0.5 && Math.abs(z) > 0.12 && y < 1.3 &&
          ((Math.abs(x) < 0.03 && y > 0.6 && y < 1.2) || (Math.abs(y - 1.02) < 0.03 && Math.abs(x) < 0.11))) return 3;
        // gold rims: the lower edge of the pauldrons and the helm's brow band
        if (m === 0 && Math.abs(x) > 0.16 && y > 1.27 && y < 1.32) return 3;
        if (m === 0 && y > 1.6 && y < 1.64 && Math.hypot(x, z) > 0.12) return 3;
        return m;
      };
      return { mats, parts, pat };
    },

    Chest() {
      const mats = [
        { alb: '#6e4a2c', cz: [52, 0.08, 0.38, 0.72], dye: 1, rough: 1 },  // 0 wood (the dye)
        { alb: '#4b4d54', cz: [262, 0.022, 0.26, 0.6], metal: 1, rough: 0.5 }, // 1 iron
        { alb: '#c39a43', cz: [86, 0.12, 0.58, 0.92], metal: 1, rough: 0.2 },  // 2 brass
        { alb: '#0c0b0b', cz: [285, 0.03, 0.2, 0.3], rough: 0 },               // 3 keyhole
      ];
      const parts = [
        P(box(0, 0.3, 0, 0.55, 0.3, 0.35, 0.02), 0, 0),
        P(above(cyl([-0.55, 0.6, 0], [0.55, 0.6, 0], 0.35), 0.6), 0, 0.01),
        P(box(0, 0.035, 0, 0.565, 0.035, 0.365, 0.01), 1, 0.005),
      ];
      for (const s of [-1, 1]) {
        parts.push(P(box(s * 0.36, 0.3, 0, 0.04, 0.305, 0.365, 0.005), 1, 0.005));
        parts.push(P(above(cyl([s * 0.4, 0.6, 0], [s * 0.32, 0.6, 0], 0.365), 0.6), 1, 0.005));
        parts.push(P(box(s * 0.555, 0.3, 0.355, 0.025, 0.3, 0.025, 0.01), 1, 0.005));
        parts.push(P(box(s * 0.555, 0.3, -0.355, 0.025, 0.3, 0.025, 0.01), 1, 0.005));
      }
      parts.push(
        P(box(0, 0.57, 0.36, 0.065, 0.085, 0.03, 0.012), 2, 0.01),
        P(box(0, 0.555, 0.39, 0.012, 0.03, 0.02), 3, 0.003, true),
      );
      const pat = (m, x, y, z, nx, ny, nz) => {
        if (m !== 0) return m;
        if (y < 0.6) MK = frac(y / 0.15) < 0.13 ? 1 : 0;
        else if (Math.abs(nx) < 0.7) MK = frac(Math.atan2(y - 0.6, z) / (Math.PI / 5)) < 0.1 ? 1 : 0;
        return m;
      };
      return { mats, parts, pat };
    },

    'Dead tree'() {
      const mats = [
        { alb: '#5f5546', cz: [62, 0.035, 0.32, 0.64], dye: 1, rough: 1 },  // 0 bark (the dye)
        { alb: '#6d6c6a', cz: [255, 0.016, 0.4, 0.72], rough: 0.8 },       // 1 stone
        { alb: '#4d5a32', cz: [128, 0.08, 0.42, 0.68], rough: 0.9 },       // 2 moss
      ];
      const r = Kit.rng('dead-tree-7');
      const trunk = [cone([0, 0, 0], [0.05, 0.85, 0.02], 0.21, 0.13), cone([0.05, 0.85, 0.02], [-0.05, 1.38, 0.06], 0.13, 0.09)];
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + 0.5 + r.range(-0.35, 0.35), L = r.range(0.4, 0.52);
        trunk.push(cone([0, 0.22, 0], [Math.cos(a) * L, 0.0, Math.sin(a) * L], 0.11, 0.035));
      }
      const parts = [P(group(trunk, 0.1), 0, 0)];
      // branches: each a bent pair of tapering cones; children turn outward and up
      const grow = (p, d, len, rad, depth, out) => {
        const j = () => r.range(-1, 1) * len * 0.2;
        const mid = [p[0] + d[0] * len * 0.5 + j(), p[1] + d[1] * len * 0.5 + j() * 0.5, p[2] + d[2] * len * 0.5 + j()];
        const end = [mid[0] + d[0] * len * 0.5 + j(), mid[1] + d[1] * len * 0.5, mid[2] + d[2] * len * 0.5 + j()];
        if (depth < 2) { out.push(cone(p, mid, rad, rad * 0.8)); out.push(cone(mid, end, rad * 0.8, rad * 0.62)); }
        else { out.push(cone(p, end, rad, rad * 0.5)); return; }
        for (let c = 0; c < 2; c++) {
          const nd = norm3(d[0] + r.range(-0.9, 0.9), d[1] + r.range(-0.2, 0.5), d[2] + r.range(-0.9, 0.9));
          grow(end, nd, len * 0.62, rad * 0.62, depth + 1, out);
        }
      };
      const top = [-0.05, 1.36, 0.06];
      for (let i = 0; i < 3; i++) {
        const az = i * 2.1 + 0.3 + r.range(-0.3, 0.3), el = r.range(0.55, 0.95);
        const out = [];
        grow(top, [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)], 0.68, 0.085, 0, out);
        parts.push(P(group(out, 0.035), 0, 0.06));
      }
      const low = [];
      grow([0.04, 0.95, 0.03], norm3(0.8, 0.45, -0.4), 0.5, 0.07, 1, low);
      parts.push(P(group(low, 0.03), 0, 0.06));
      parts.push(P(box(0.42, 0.06, 0.3, 0.14, 0.09, 0.11, 0.07), 1, 0.02));
      parts.push(P(box(-0.36, 0.04, 0.34, 0.08, 0.05, 0.07, 0.04), 1, 0.02));
      const pat = (m, x, y, z, nx, ny, nz) => {
        if (m !== 0) return m;
        if (ny > 0.55 && y < 0.55) return 2;
        MK = Kit.noise2(Math.atan2(z, x) * 2.4, y * 5, 7) > 0.32 ? 1 : 0;
        return m;
      };
      return { mats, parts, pat };
    },

    Cottage() {
      const mats = [
        { alb: '#c8b897', cz: [82, 0.04, 0.64, 0.93], rough: 0.5 },          // 0 plaster
        { alb: '#46301f', cz: [45, 0.06, 0.26, 0.46], rough: 0.8 },          // 1 timber
        { alb: '#7c3a2a', cz: [32, 0.11, 0.4, 0.68], dye: 1, rough: 0.9 },   // 2 roof (the dye)
        { alb: '#77746e', cz: [255, 0.016, 0.42, 0.74], rough: 1 },          // 3 stone
        { alb: '#ffc56a', cz: [78, 0.14, 0.78, 0.96], emit: 1, rough: 0 },   // 4 lit window
        { alb: '#5d3d25', cz: [50, 0.08, 0.32, 0.56], rough: 0.9 },          // 5 door
      ];
      const parts = [
        P(box(0, 0.07, 0, 0.78, 0.07, 0.58, 0.02), 3, 0),
        P(box(0, 0.6, 0, 0.72, 0.5, 0.52, 0.01), 0, 0.01),
        P(above(box(0, 1.1, 0, 0.84, 0.6, 0.6, 0.02, 45), 1.1), 2, 0.01),
        P(above(box(0, 1.0, 0, 0.95, 0.6, 0.6, 0, 45), 1.0), 1, 0.005, true),
        P(above(box(0, 1.08, 0, 0.72, 0.56, 0.56, 0, 45), 1.08), 0, 0.005),
        P(box(0.42, 1.7, -0.22, 0.1, 0.36, 0.1, 0.01), 3, 0.01),
        P(box(0.22, 0.36, 0.53, 0.15, 0.3, 0.03, 0.01), 5, 0.005),
        P(box(-0.36, 0.68, 0.53, 0.13, 0.12, 0.02), 4, 0),
        P(box(0.2, 0.68, -0.53, 0.13, 0.12, 0.02), 4, 0),
        P(box(0.73, 0.68, 0, 0.02, 0.12, 0.14), 4, 0),
        P(box(-0.73, 0.68, 0.1, 0.02, 0.12, 0.14), 4, 0),
      ];
      const pat = (m, x, y, z, nx, ny, nz) => {
        if (m === 4) {
          const front = Math.abs(nz) > 0.5, u = front ? x : z, cs = front ? (z > 0 ? -0.36 : 0.2) : (x > 0 ? 0 : 0.1);
          return Math.abs(u - cs) < 0.018 || Math.abs(y - 0.68) < 0.018 ? 1 : 4;
        }
        if (m === 0 && y < 1.1) {
          // timber framing: corner posts, sill, top plate, a middle post and braces on the long walls
          const front = Math.abs(nz) > 0.5, u = front ? x : z, half = front ? 0.72 : 0.52;
          if (Math.abs(u) > half - 0.06 || y < 0.19 || y > 1.03 || (front && Math.abs(u + 0.02) < 0.035)) return 1;
          if (front && Math.abs(Math.abs(u) - 0.02 - (1.03 - y) * 0.62) < 0.035 && u < 0) return 1;
        }
        if (m === 2) MK = frac(y * 9) < 0.16 || frac((x * 5) + Math.floor(y * 9) * 0.5) < 0.08 ? 1 : 0;
        if (m === 3) MK = frac(y * 11) < 0.14 || frac((x + z) * 6 + Math.floor(y * 11) * 0.5) < 0.1 ? 1 : 0;
        if (m === 5) MK = frac(x * 18) < 0.16 ? 1 : 0;
        return m;
      };
      return { mats, parts, pat };
    },
  };

  // =====================================================================
  // Cameras and lights. Lights are fixed to the camera, so every direction is lit from the same screen side.
  // Gothic: orthographic, pitched 30 degrees (the isometric look). Cozy: oblique 3/4, verticals keep full height
  // and depth recedes up the screen at tan(40 degrees).
  // =====================================================================
  const PIPES = {
    // gothic light comes from above and the front; fill and ambient are faint, so half the figure sits in deep shadow.
    // Two samples a side are enough: its edges are hard and its surfaces are meant to be mottled.
    goth: { pitch: 30 * D2R, oblique: false, key: norm3(-0.35, 0.85, 0.42), fill: norm3(0.35, 0.65, -0.68), soft: 9, gsoft: 10, ss: 2 },
    // the cozy ground takes its shadow from a light nearly overhead: a compact contact shadow, as cozy games draw
    cozy: { pitch: 40 * D2R, oblique: true, key: norm3(-0.55, 0.78, 0.32), fill: null, soft: 20, ground: norm3(-0.12, 1, 0.32), gsoft: 12, inflate: 0.45, ss: 3 },
  };
  const CW = 40, CH = 80, NPX = CW * CH;
  // directions in sixteenths of a turn; gothic players get all 16, everything else 8 (the even ones)
  const DIRS = ['S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE'];
  const ndirs = (name, pipe) => pipe === 'goth' && name === 'Knight' ? 16 : 8;

  const built = {};
  function model(name) {
    if (built[name]) return built[name];
    const M = MODELS[name]();
    M.sdf = makeSDF(M.parts);
    M.mats.forEach(m => { m.lin = hexLin(m.alb); });
    const bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (const p of M.parts) if (!p.sub) for (let i = 0; i < 3; i++) { bb[i] = Math.min(bb[i], p.shape.bb[i]); bb[i + 3] = Math.max(bb[i + 3], p.shape.bb[i + 3]); }
    bb[1] = Math.max(0, bb[1]);
    M.bb = bb.map((v, i) => v + (i < 3 ? -0.02 : 0.02));
    // one scale per pipeline that fits all sixteen turns in the cell, with the lowest point near the cell's foot
    M.fit = {};
    for (const pipe in PIPES) {
      const Pp = PIPES[pipe], s = Math.sin(Pp.pitch), c = Math.cos(Pp.pitch), tn = Math.tan(Pp.pitch);
      let mx = 0, lo = 1e9, hi = -1e9;
      for (let k = 0; k < 16; k++) {
        const ca = Math.cos(-k * 22.5 * D2R), sa = Math.sin(-k * 22.5 * D2R);
        for (const p of M.parts) if (!p.sub) for (let q = 0; q < 8; q++) {
          const pb = p.shape.bb, x = q & 1 ? pb[3] : pb[0], y = Math.max(0, q & 2 ? pb[4] : pb[1]), z = q & 4 ? pb[5] : pb[2];
          const wx = x * ca + z * sa, wz = -x * sa + z * ca;
          const sy = Pp.oblique ? y - wz * tn : y * c - wz * s;
          mx = Math.max(mx, Math.abs(wx)); lo = Math.min(lo, sy); hi = Math.max(hi, sy);
        }
      }
      const ppu = Math.min((CW / 2 - 1) / mx, (CH - 5) / (hi - lo));
      M.fit[pipe] = { ppu, ox: CW / 2, oy: CH - 4 + lo * ppu, top: CH - 4 - (hi - lo) * ppu };
    }
    return (built[name] = M);
  }

  // ---- the marcher's helpers ----
  let T0 = 0, T1 = 0;
  // ray against an axis box (slabs); sets T0, T1
  function slab(ox, oy, oz, dx, dy, dz, b) {
    let t0 = 0, t1 = 1e9, inv, a, c, s;
    inv = 1 / (Math.abs(dx) < 1e-9 ? 1e-9 : dx); a = (b[0] - ox) * inv; c = (b[3] - ox) * inv; if (a > c) { s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c;
    inv = 1 / (Math.abs(dy) < 1e-9 ? 1e-9 : dy); a = (b[1] - oy) * inv; c = (b[4] - oy) * inv; if (a > c) { s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c;
    inv = 1 / (Math.abs(dz) < 1e-9 ? 1e-9 : dz); a = (b[2] - oz) * inv; c = (b[5] - oz) * inv; if (a > c) { s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c;
    T0 = t0; T1 = t1;
    return t0 < t1;
  }
  // soft shadow toward the light (Quilez): the nearest miss along the ray, scaled by distance, darkens
  function shadow(f, bb, px, py, pz, lx, ly, lz, k) {
    if (!slab(px, py, pz, lx, ly, lz, bb)) return 1;
    let t = Math.max(0.02, T0), res = 1;
    const tmax = T1;
    for (let i = 0; i < 40 && t < tmax; i++) {
      const h = f(px + lx * t, py + ly * t, pz + lz * t);
      if (h < 0.0015) return 0;
      const v = k * h / t; if (v < res) res = v;
      t += h < 0.02 ? 0.02 : h > 0.3 ? 0.3 : h;
    }
    return res * res * (3 - 2 * res);
  }
  // ambient occlusion: how much nearer the surface (and the ground) is than empty space would be, along the normal
  function occlusion(f, px, py, pz, nx, ny, nz) {
    let occ = 0, w = 1;
    for (let i = 0; i < 5; i++) {
      const h = 0.02 + 0.07 * i, qy = py + ny * h;
      let d = f(px + nx * h, qy, pz + nz * h); if (qy < d) d = qy;
      occ += (h - d) * w; w *= 0.7;
    }
    return clamp01(1 - 2.4 * occ);
  }

  // 3D value noise in [-1,1] on a hashed lattice, for render texture
  function noise3(x, y, z, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
    const fx = x - x0, fy = y - y0, fz = z - z0, h = Kit.hash2;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
    const c = (i, j, k) => h(x0 + i, y0 + j, (z0 + k) * 131 + seed);
    const a = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * sx, b = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * sx;
    const d = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * sx, e = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * sx;
    const u = a + (b - a) * sy, v = d + (e - d) * sy;
    return (u + (v - u) * sz) * 2 - 1;
  }

  // a job renders one (model, pipeline, direction in sixteenths) into a 40x80 cell, a row at a time
  function makeJob(name, pipe, dir) {
    const M = model(name), Pp = PIPES[pipe], F = M.fit[pipe];
    const a = dir * 22.5 * D2R, ca = Math.cos(a), sa = Math.sin(a), ss = Pp.ss;
    const rot = v => [v[0] * ca + v[2] * sa, v[1], -v[0] * sa + v[2] * ca];
    const s = Math.sin(Pp.pitch), c = Math.cos(Pp.pitch);
    const D = [0, -s, -c];
    const o0 = Pp.oblique ? [0, 8 * Math.tan(Pp.pitch), 8] : [0, 8 * s, 8 * c];
    const U = Pp.oblique ? [0, 1, 0] : [0, c, -s];
    const H = norm3(Pp.key[0] - D[0], Pp.key[1] - D[1], Pp.key[2] - D[2]);
    const z = () => new Float32Array(NPX);
    return {
      M, pipe, dir, ppu: F.ppu, ox: F.ox, oy: F.oy, ss, hw: CW * ss, hh: CH * ss, fine: F.ppu * 1.1,
      o0: rot(o0), R: rot([1, 0, 0]), U: rot(U), D: rot(D), K: rot(Pp.key), L2: Pp.fill ? rot(Pp.fill) : null, H: rot(H), G: rot(Pp.ground || Pp.key),
      hy: 0, rows: 0, done: false, ms: 0,
      acc: { R: z(), G: z(), B: z(), V: z(), D: z(), N: new Uint16Array(NPX), GS: z(), GN: new Uint16Array(NPX), vote: new Uint16Array(NPX * 8) },
      cov: z(), r: z(), g: z(), b: z(), v: z(), dep: z(), gs: new Float32Array(NPX).fill(1), mat: new Int8Array(NPX).fill(-1),
    };
  }

  function renderRow(J) {
    const M = J.M, f = M.sdf, bb = M.bb, goth = J.pipe === 'goth', ppu = J.ppu, A = J.acc, soft = PIPES[J.pipe].soft;
    const [o0x, o0y, o0z] = J.o0, [rx, ry, rz] = J.R, [ux, uy, uz] = J.U, [dx, dy, dz] = J.D, [kx, ky, kz] = J.K, [hx_, hy_, hz_] = J.H;
    // cozy fattens every shape by part of a pixel, as pixel artists thicken twigs and blades so they survive
    const SS = J.ss, hy = J.hy, sy = (J.oy - (hy + 0.5) / SS) / ppu, ly = (hy / SS) | 0, eps = 0.2 / (ppu * SS) + (PIPES[J.pipe].inflate || 0) / ppu;
    for (let hx = 0; hx < J.hw; hx++) {
      const sx = ((hx + 0.5) / SS - J.ox) / ppu;
      const ox = o0x + sx * rx + sy * ux, oy = o0y + sx * ry + sy * uy, oz = o0z + sx * rz + sy * uz;
      const li = ly * CW + ((hx / SS) | 0);
      let t = -1;
      if (slab(ox, oy, oz, dx, dy, dz, bb)) {
        let tt = T0;
        const t1 = T1;
        for (let i = 0; i < 120; i++) {
          const d = f(ox + dx * tt, oy + dy * tt, oz + dz * tt);
          if (d < eps) { t = tt; break; }
          tt += d * 0.85;
          if (tt > t1) break;
        }
      }
      if (t >= 0) {
        const px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t, e = 0.0015;
        // normal from four taps (the tetrahedron trick)
        const a1 = f(px + e, py - e, pz - e), a2 = f(px - e, py - e, pz + e), a3 = f(px - e, py + e, pz - e), a4 = f(px + e, py + e, pz + e);
        let nx = a1 - a2 - a3 + a4, ny = -a1 - a2 + a3 + a4, nz = -a1 + a2 - a3 + a4;
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        f(px, py, pz);
        MK = 0;
        const m = M.pat(f.mat(), px, py, pz, nx, ny, nz), mt = M.mats[m], al = mt.lin;
        const dk = Math.max(0, nx * kx + ny * ky + nz * kz);
        const sh = dk > 0 ? shadow(f, bb, px + nx * 0.004, py + ny * 0.004, pz + nz * 0.004, kx, ky, kz, soft) : 0;
        const oc = occlusion(f, px, py, pz, nx, ny, nz);
        const spec = mt.metal ? Math.pow(Math.max(0, nx * hx_ + ny * hy_ + nz * hz_), goth ? 40 : 16) * sh : 0;
        let r, g, b, v = 0;
        if (goth) {
          // render texture: a coarse mottle and a pixel-sized grain, fixed to the model so it turns with it
          const grain = Kit.hash2(Math.floor(px * J.fine), Math.floor(py * J.fine), Math.floor(pz * J.fine) * 131 + 5) * 2 - 1, mott = noise3(px * 15, py * 15, pz * 15, 6);
          const tex = Math.max(0, 1 + mt.rough * (0.75 * mott + 0.5 * grain)) * (1 - 0.5 * MK);
          const [fx, fy, fz] = J.L2, df = Math.max(0, nx * fx + ny * fy + nz * fz) * 0.4;
          const am = oc * (0.035 + 0.035 * ny), kk = dk * dk * sh * 1.3;
          const gl = mt.metal ? 1.9 : 0;
          r = al[0] * tex * (kk * 1.0 + df * 0.5 + am * 0.6) + spec * gl * (0.6 + 0.4 * al[0]);
          g = al[1] * tex * (kk * 0.94 + df * 0.62 + am * 0.62) + spec * gl * (0.55 + 0.4 * al[1]);
          b = al[2] * tex * (kk * 0.84 + df * 0.85 + am * 0.72) + spec * gl * (0.45 + 0.4 * al[2]);
        } else {
          const tex = 1 - 0.32 * MK, kk = dk * sh, am = oc * (0.55 + 0.45 * ny);
          v = (0.64 * kk + 0.36 * am) * tex + (spec > 0.5 ? 1 : 0);
          r = al[0] * tex * (kk * 1.0 + am * 0.42) + spec * 0.5;
          g = al[1] * tex * (kk * 0.96 + am * 0.4) + spec * 0.48;
          b = al[2] * tex * (kk * 0.88 + am * 0.46) + spec * 0.44;
        }
        if (mt.emit) { r = al[0] * 1.3; g = al[1] * 1.3; b = al[2] * 1.3; v = 1; }
        A.R[li] += r; A.G[li] += g; A.B[li] += b; A.V[li] += v; A.D[li] += t; A.N[li]++; A.vote[li * 8 + m]++;
      } else if (dy < 0) {
        // the ground plane: cast shadow and a little contact darkening
        const tg = -oy / dy, gx = ox + dx * tg, gz = oz + dz * tg;
        let gs = shadow(f, bb, gx, 0.002, gz, J.G[0], J.G[1], J.G[2], PIPES[J.pipe].gsoft || soft);
        if (gx > bb[0] - 0.3 && gx < bb[3] + 0.3 && gz > bb[2] - 0.3 && gz < bb[5] + 0.3) {
          const d1 = f(gx, 0.06, gz), d2 = f(gx, 0.18, gz);
          gs *= clamp01(1 - Math.max(0, 0.06 - d1) * 5 - Math.max(0, 0.18 - d2) * 1.6);
        }
        A.GS[li] += gs; A.GN[li]++;
      }
    }
    J.hy++;
    if (J.hy % SS === 0) {
      // downsample the finished block of rows: coverage, mean color and light, the majority material
      for (let lx = 0; lx < CW; lx++) {
        const i = ly * CW + lx, n = A.N[i];
        J.cov[i] = n / (SS * SS);
        if (n) {
          J.r[i] = A.R[i] / n; J.g[i] = A.G[i] / n; J.b[i] = A.B[i] / n; J.v[i] = A.V[i] / n; J.dep[i] = A.D[i] / n;
          let best = 0; for (let m = 1; m < 8; m++) if (A.vote[i * 8 + m] > A.vote[i * 8 + best]) best = m;
          J.mat[i] = best;
        }
        J.gs[i] = A.GN[i] ? A.GS[i] / A.GN[i] : 1;
      }
      J.rows = ly + 1;
    }
    if (J.hy === J.hh) { J.fin = goth ? finishGoth(J) : finishCozy(J); J.done = true; J.acc = null; }
  }

  // =====================================================================
  // Gothic finish: an invented 256-color palette, 16 hue ramps of 16 steps, each running down to near black.
  // Family 12 is reserved for the dye: only dyed parts use it, so a colormap (a 256-entry index table)
  // can turn those parts another color without touching anything else.
  // =====================================================================
  const GFAM = [[0, 0], [60, 0.02], [250, 0.025], [50, 0.07], [76, 0.13], [105, 0.07], [150, 0.12], [185, 0.1],
    [250, 0.09], [282, 0.08], [322, 0.08], [2, 0.1], [25, 0.15], [44, 0.14], [56, 0.09], [68, 0.16]];
  const DYE = 12;
  const G256 = [], GLAB = [];
  GFAM.forEach(([h0, cmax]) => {
    for (let i = 0; i < 16; i++) {
      const t = i / 15, L = 0.06 + 0.86 * Math.pow(t, 1.25);
      const C = cmax * Math.min(1, 0.15 + 1.6 * t) * (1 - 0.45 * t * t);
      const h = t < 0.5 ? toward(h0, 275, 14 * (1 - 2 * t)) : toward(h0, 85, 10 * (2 * t - 1));
      G256.push(i < 3 ? lch(L, 0.01, 40) : lch(L, C, h));
    }
  });
  G256[0] = [0, 0, 0];
  G256.forEach(c => GLAB.push(labLin(LIN[c[0]], LIN[c[1]], LIN[c[2]])));
  const gmemo = new Map();
  function gNearest(L, a, b) {
    const key = ((L * 200) | 0) * 65536 + (((a + 0.4) * 200) | 0) * 256 + (((b + 0.4) * 200) | 0);
    let v = gmemo.get(key);
    if (v !== undefined) return v;
    let bd = Infinity; v = 0;
    for (let i = 0; i < 256; i++) {
      if ((i >> 4) === DYE) continue;
      const q = GLAB[i], dL = L - q[0], da = a - q[1], db = b - q[2], d = dL * dL + 1.6 * (da * da + db * db);
      if (d < bd) { bd = d; v = i; }
    }
    gmemo.set(key, v);
    return v;
  }
  // the family a model's dye range shows as by default: the one nearest the dyed material's graded hue
  function dyeBase(M) {
    const mt = M.mats.find(m => m.dye), g = grade(labLin(...mt.lin));
    const h = Math.atan2(g[2], g[1]) / D2R, C = Math.hypot(g[1], g[2]);
    let best = 1, bd = Infinity;
    GFAM.forEach(([h0, cmax], f) => {
      if (!cmax) return;
      const dh = Math.abs(((h - h0) % 360 + 540) % 360 - 180) / 60, dc = (C - cmax * 0.7) / 0.03, d = dh * dh + dc * dc;
      if (d < bd) { bd = d; best = f; }
    });
    return best;
  }
  // the grade every gothic pixel goes through before the palette: a little darker and duller, a dusty warm cast
  const grade = (lab, glow) => glow ? [lab[0], lab[1] * 0.9, lab[2] * 0.9] : [lab[0] * 0.95, lab[1] * 0.85, lab[2] * 0.85 + 0.004];
  function finishGoth(J) {
    const idx = new Int16Array(NPX).fill(-1), M = J.M;
    for (let i = 0; i < NPX; i++) {
      // hard edges: a pixel is in when half its samples hit, and keeps its own color; no outline is drawn
      if (J.cov[i] < 0.5 || J.mat[i] < 0) continue;
      const mt = M.mats[J.mat[i]];
      const lab = grade(labLin(Math.min(1, J.r[i]), Math.min(1, J.g[i]), Math.min(1, J.b[i])), mt.emit);
      if (mt.dye) {
        let best = 0; for (let s = 1; s < 16; s++) if (Math.abs(GLAB[DYE * 16 + s][0] - lab[0]) < Math.abs(GLAB[DYE * 16 + best][0] - lab[0])) best = s;
        idx[i] = DYE * 16 + best;
      } else idx[i] = gNearest(lab[0], lab[1], lab[2]);
    }
    return { idx };
  }

  // =====================================================================
  // Cozy finish: per-material OKLCH ramps (an outline ink and four cel bands, shadows turned toward violet,
  // lights toward warm yellow), hard silhouette, orphan cleanup, depth lines and a selective outline.
  // =====================================================================
  const GROUND = [lch(0.76, 0.1, 124), lch(0.66, 0.1, 138), lch(0.62, 0.075, 160), lch(0.88, 0.07, 10), lch(0.93, 0.11, 95), lch(0.82, 0.1, 116)];
  const NG = GROUND.length;
  function ramp5([h0, c, lo, hi]) {
    const out = [lch(Math.max(0.15, lo - 0.17), c * 0.7 + 0.02, toward(h0, 300, 45))];
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const h = t < 0.5 ? toward(h0, 300, 30 * (1 - 2 * t)) : toward(h0, 85, 22 * (2 * t - 1));
      out.push(lch(lo + (hi - lo) * t, c * (0.78 + 0.32 * Math.sin(Math.PI * t)), h));
    }
    return out;
  }
  const VARIANTS = { Base: null, Frost: [8, 238, 0.1], Venom: [6, 140, 0.11], Ash: [1, 260, 0.014] };
  function cozyPalette(M, variant) {
    const vr = VARIANTS[variant], pal = GROUND.slice();
    for (const mt of M.mats) {
      const cz = mt.dye && vr ? [vr[1], vr[2], mt.cz[2], mt.cz[3]] : mt.cz;
      pal.push(...ramp5(cz));
    }
    return pal;
  }
  const BANDS = [0.26, 0.46, 0.68];
  function finishCozy(J) {
    const M = J.M, ins = new Uint8Array(NPX), mat = Int8Array.from(J.mat), v = Float32Array.from(J.v);
    const at = (x, y) => x >= 0 && y >= 0 && x < CW && y < CH ? y * CW + x : -1;
    const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let i = 0; i < NPX; i++) ins[i] = J.cov[i] >= 0.45 && mat[i] >= 0 ? 1 : 0;
    // silhouette cleanup: drop lone pixels, fill one-pixel notches
    for (let pass = 0; pass < 2; pass++) for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const i = y * CW + x;
      let cnt = 0, from = -1, any = 0;
      for (const [ddx, ddy] of NB) { const j = at(x + ddx, y + ddy); if (j >= 0 && ins[j]) { cnt++; from = j; } }
      for (const [ddx, ddy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const j = at(x + ddx, y + ddy); if (j >= 0 && ins[j]) any++; }
      if (ins[i] && cnt + any === 0) ins[i] = 0;
      else if (!ins[i] && cnt >= 3) { ins[i] = 1; mat[i] = mat[from]; v[i] = v[from]; }
    }
    const idx = new Int16Array(NPX).fill(-1), base = m => NG + m * 5;
    for (let i = 0; i < NPX; i++) if (ins[i]) {
      const m = mat[i], vv = v[i];
      const b = M.mats[m].emit || vv > 1 ? 3 : vv < BANDS[0] ? 0 : vv < BANDS[1] ? 1 : vv < BANDS[2] ? 2 : 3;
      idx[i] = base(m) + 1 + b;
    }
    // orphans: a pixel unlike all four neighbors, when three of them agree, takes their color
    const src = idx.slice();
    for (let y = 1; y < CH - 1; y++) for (let x = 1; x < CW - 1; x++) {
      const i = y * CW + x;
      if (src[i] < 0) continue;
      const n = NB.map(([ddx, ddy]) => src[at(x + ddx, y + ddy)]);
      if (n.includes(src[i]) || n.some(q => q < 0)) continue;
      for (const q of n) if (n.filter(w => w === q).length >= 3) { idx[i] = q; break; }
    }
    // depth lines: where a part passes in front of another, the farther pixel takes its outline ink
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const i = y * CW + x;
      if (!ins[i]) continue;
      for (const [ddx, ddy] of NB) {
        const j = at(x + ddx, y + ddy);
        if (j >= 0 && ins[j] && J.dep[i] - J.dep[j] > 0.2) { idx[i] = base(mat[i]); break; }
      }
    }
    // selective outline: on the lit side (top, left) a dark band of the neighbor's own ramp, elsewhere its outline ink
    const shade = new Uint8Array(NPX);
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const i = y * CW + x;
      if (ins[i]) continue;
      const l = at(x - 1, y), u = at(x, y - 1), r = at(x + 1, y), d = at(x, y + 1);
      if ((l >= 0 && ins[l]) || (u >= 0 && ins[u])) idx[i] = base(mat[l >= 0 && ins[l] ? l : u]);
      else if ((r >= 0 && ins[r]) || (d >= 0 && ins[d])) idx[i] = base(mat[r >= 0 && ins[r] ? r : d]) + 1;
      else if (J.gs[i] < 0.55) shade[i] = 1;
    }
    return { idx, shade };
  }

  // the cozy ground: flat warm grass, lighter patches, tufts and the odd flower
  function grassAt(x, y) {
    const h = (a, b, s) => Kit.hash2(a, b, s);
    if (h(x, y, 23) < 0.0016) return 4;
    if (h(x - 1, y, 23) < 0.0016 || h(x + 1, y, 23) < 0.0016 || h(x, y - 1, 23) < 0.0016 || h(x, y + 1, 23) < 0.0016) return 3;
    if (h(x, y, 11) < 0.006 || h(x - 1, y + 1, 11) < 0.006 || h(x + 1, y + 1, 11) < 0.006) return 1;
    return Kit.noise2(x / 13, y / 8, 5) > 0.3 ? 5 : 0;
  }
  // the gothic ground: dark flagstones on the 2:1 grid
  function stoneAt(x, y) {
    const u = (x >> 1) + y, w = (x >> 1) - y + 1024;
    if ((u & 7) === 0 || (w & 7) === 0) return [0.17, 0.002, 0.008];
    const t = Kit.hash2(u >> 3, w >> 3, 9), sp = Kit.hash2(x, y, 4) < 0.05 ? -0.03 : 0;
    return [0.31 + 0.08 * t + sp, 0.003 - 0.006 * (t > 0.8), 0.016 + 0.01 * (t > 0.8)];
  }

  function text(img, s, x, y, rgb) {
    const d = img.data, W = img.width;
    for (const ch of String(s).toUpperCase()) {
      const g = FONT[ch];
      if (g) for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if (+g[r] & (4 >> b)) {
        const X = x + b, Y = y + r;
        if (X >= 0 && Y >= 0 && X < W && Y < img.height) { const k = (Y * W + X) * 4; d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = 255; }
      }
      x += 4;
    }
  }

  // A pixel canvas like Kit.canvas, but it can change height (the sixteen-direction sheet is taller) and it
  // caps its height so a tall sheet stays on screen. Whole-number scales only.
  function pixCanvas(host, w, h, maxH) {
    const cv = document.createElement('canvas');
    cv.className = 'px';
    const g = cv.getContext('2d');
    host.appendChild(cv);
    const out = { cv, g, w, h };
    const fit = () => {
      const cs = getComputedStyle(host);
      const inner = (host.clientWidth || w) - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
      const dpr = window.devicePixelRatio || 1;
      const s = Math.max(1, Math.min(Math.floor(Math.max(1, inner - 2) * dpr / out.w), Math.floor(maxH * dpr / out.h)));
      cv.style.width = (out.w * s / dpr) + 'px';
      cv.style.height = (out.h * s / dpr) + 'px';
    };
    out.resize = (W, H) => { out.w = cv.width = W; out.h = cv.height = H; g.imageSmoothingEnabled = false; fit(); };
    out.resize(w, h);
    if (window.ResizeObserver) new ResizeObserver(fit).observe(host);
    out.at = e => {
      const r = cv.getBoundingClientRect();
      return [Math.floor((e.clientX - r.left) / r.width * out.w), Math.floor((e.clientY - r.top) / r.height * out.h)];
    };
    return out;
  }

  // =====================================================================
  // The demo
  // =====================================================================
  Kit.register('prerender', { title: 'Pre-rendered 3D, two finishing pipelines', fit: 'prebake' }, host => {
    const W = 160, TOP = 10;
    const c = pixCanvas(host, W, 100, 720);
    c.cv.style.touchAction = 'pan-y';
    c.cv.style.cursor = 'grab';
    let H = 0, img = null, D = null;
    const st = { model: 'Knight', layout: 'Both', dir: 0, play: !Kit.reduced, raw: false, variant: 'Base' };
    const jobs = new Map(), timing = {};
    const key = (m, p, d) => m + '|' + p + '|' + d;
    let cpal = null, cmap = null;
    const palettes = () => {
      cpal = cozyPalette(model(st.model), st.variant);
      cmap = new Int16Array(256).map((_, i) => i);
      const vr = VARIANTS[st.variant], fam = vr ? vr[0] : dyeBase(model(st.model));
      for (let s = 0; s < 16; s++) cmap[DYE * 16 + s] = fam * 16 + s;
    };
    const shown = () => st.layout === 'Both' ? ['goth', 'cozy'] : st.layout === 'Gothic' ? ['goth'] : ['cozy'];
    const nd = p => ndirs(st.model, p);
    // the direction a pipeline shows: with 8 directions, the current sixteenth rounded down to an eighth
    const dirOf = p => nd(p) === 16 ? st.dir : st.dir & ~1;
    const step = () => shown().some(p => nd(p) === 16) ? 1 : 2;

    // what to render, most wanted first: the shown pipelines from the current direction round, then the other
    const wanted = () => {
      const sh = shown(), out = [];
      for (const group of [sh, ['goth', 'cozy'].filter(p => !sh.includes(p))]) for (let k = 0; k < 16; k++) for (const p of group) {
        const s = 16 / nd(p);
        if (k % s === 0) out.push([p, (dirOf(p) + k) % 16]);
      }
      return out;
    };
    const getJob = (p, d) => jobs.get(key(st.model, p, d));
    // render rows for about 10 ms a frame (the clock only paces the work; the pictures never depend on it)
    const work = () => {
      const t0 = performance.now();
      let did = false;
      for (const [p, d] of wanted()) {
        const k = key(st.model, p, d);
        let J = jobs.get(k);
        if (J && J.done) continue;
        if (!J) { J = makeJob(st.model, p, d); jobs.set(k, J); }
        while (!J.done && performance.now() - t0 < 10) { renderRow(J); did = true; }
        if (performance.now() - t0 >= 10) break;
      }
      if (did) timing[st.model] = (timing[st.model] || 0) + performance.now() - t0;
      return did;
    };
    const progress = () => { const w = wanted(); let n = 0; for (const [p, d] of w) { const J = getJob(p, d); if (J && J.done) n++; } return [n, w.length]; };

    // ---- layout: Both is two panels with one figure each; a single pipeline is a sheet of every direction ----
    let L = null;
    const layout = () => {
      if (st.layout === 'Both') {
        const body = CH + 14;
        L = { body, panels: ['goth', 'cozy'].map((pipe, k) => ({ pipe, x0: k * 80, w: 80, R: 36, cells: [{ dir: dirOf(pipe), cx: k * 80 + 20, cy: TOP + 2 }] })) };
      } else {
        const pipe = st.layout === 'Gothic' ? 'goth' : 'cozy', n = nd(pipe), s = 16 / n;
        const cells = Array.from({ length: n }, (_, k) => ({ dir: k * s, cx: (k % 4) * CW, cy: TOP + (k / 4 | 0) * CH }));
        L = { body: (n / 4) * CH, panels: [{ pipe, x0: 0, w: W, R: 21, cells }] };
      }
      const h = TOP + L.body + 2;
      if (h !== H) { H = h; c.resize(W, H); img = new ImageData(W, H); D = img.data; }
    };

    // ---- drawing ----
    const setPx = (x, y, rgb) => { const k = (y * W + x) * 4; D[k] = rgb[0]; D[k + 1] = rgb[1]; D[k + 2] = rgb[2]; D[k + 3] = 255; };
    const over = (x, y, r, g, b, a) => {
      const k = (y * W + x) * 4;
      D[k] = toByte(r * a + LIN[D[k]] * (1 - a)); D[k + 1] = toByte(g * a + LIN[D[k + 1]] * (1 - a)); D[k + 2] = toByte(b * a + LIN[D[k + 2]] * (1 - a)); D[k + 3] = 255;
    };
    function panel({ pipe, x0, w, R, cells }) {
      const M = model(st.model), F = M.fit[pipe], goth = pipe === 'goth', grid = cells.length > 1, y0 = TOP, h = L.body;
      // ground, with each cell's cast shadow and (gothic) a light pool around each foot
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        const C = grid ? cells[((x - x0) / CW | 0) + 4 * ((y - y0) / CH | 0)] : cells[0];
        const J = getJob(pipe, C.dir), lx = x - C.cx, ly = y - C.cy, inC = lx >= 0 && ly >= 0 && lx < CW && ly < CH;
        const gs = J && inC && ly < J.rows ? J.gs[ly * CW + lx] : 1;
        if (goth) {
          const ddx = (x - C.cx - F.ox) / R, ddy = (y - C.cy - F.oy) * 2 / R;
          let fl = clamp01(1 - ddx * ddx - ddy * ddy); fl = fl * fl * (3 - 2 * fl);
          const s = stoneAt(x, y), k = (0.05 + 0.95 * fl) * (0.3 + 0.7 * gs);
          setPx(x, y, st.raw ? labRGB(s[0] * k, s[1] * k, s[2] * k) : G256[gNearest(s[0] * k, s[1] * k, s[2] * k)]);
        } else {
          const g = GROUND[grassAt(x, y)];
          if (st.raw || !(J && J.done)) { const k = 0.55 + 0.45 * gs; setPx(x, y, [toByte(LIN[g[0]] * k), toByte(LIN[g[1]] * k), toByte(LIN[g[2]] * k)]); }
          else setPx(x, y, inC && J.fin.shade[ly * CW + lx] ? cpal[2] : g);
        }
      }
      // sprites: finished indexes, or the raw render (always, while a cell is still rendering)
      for (const C of cells) {
        const J = getJob(pipe, C.dir);
        if (!J) continue;
        const fin = J.done && !st.raw;
        for (let ly = 0; ly < J.rows; ly++) for (let lx = 0; lx < CW; lx++) {
          const i = ly * CW + lx, X = C.cx + lx, Y = C.cy + ly;
          if (X < x0 || Y < y0 || X >= x0 + w || Y >= y0 + h) continue;
          if (fin) {
            const q = J.fin.idx[i];
            if (q >= 0) setPx(X, Y, goth ? G256[cmap[q]] : cpal[q]);
          } else if (J.cov[i] > 0) over(X, Y, Math.min(1, J.r[i]), Math.min(1, J.g[i]), Math.min(1, J.b[i]), J.cov[i]);
        }
        if (!J.done && J.rows < CH) for (let lx = 0; lx < CW; lx++) setPx(C.cx + lx, C.cy + J.rows, goth ? [214, 160, 92] : [255, 250, 225]);
      }
    }
    function draw() {
      layout();
      for (let i = 0; i < D.length; i += 4) { D[i] = 14; D[i + 1] = 11; D[i + 2] = 22; D[i + 3] = 255; }
      const bone = [196, 184, 158], cream = [255, 236, 200], dim = [110, 104, 128], raw = st.raw ? ' RAW' : '';
      L.panels.forEach(panel);
      if (st.layout === 'Both') {
        text(img, st.raw ? 'GOTHIC RAW' : 'GOTHIC PRE-RENDER', 2, 3, bone);
        text(img, st.raw ? 'COZY RAW' : 'COZY 3/4', 82, 3, cream);
        // a compass of the turns under each figure: sixteen for the gothic player, eight otherwise
        for (const [x0, pipe, on, off] of [[0, 'goth', [214, 160, 92], [70, 62, 56]], [80, 'cozy', [255, 250, 225], [78, 120, 70]]]) {
          const n = nd(pipe);
          for (let k = 0; k < n; k++) {
            const a = k * 360 / n * D2R, px = x0 + 40 - Math.round(Math.sin(a) * 13), py = TOP + CH + 7 + Math.round(Math.cos(a) * 4);
            const cur = k * 16 / n === dirOf(pipe);
            setPx(px, py, cur ? on : off);
            if (cur) setPx(px + 1, py, on);
          }
        }
      } else {
        const P0 = L.panels[0], pipe = P0.pipe, goth = pipe === 'goth';
        text(img, (goth ? 'GOTHIC PRE-RENDER' : 'COZY 3/4') + raw + ' ' + nd(pipe) + ' DIRECTIONS', 2, 3, goth ? bone : cream);
        const tick = goth ? [214, 160, 92] : [255, 250, 225];
        P0.cells.forEach(C => {
          const cur = C.dir === dirOf(pipe);
          text(img, DIRS[C.dir], C.cx + 2, C.cy + 2, cur ? tick : goth ? dim : [70, 110, 62]);
          if (cur) for (let k = 0; k < 4; k++) {
            setPx(C.cx + k, C.cy + CH - 1, tick); setPx(C.cx + CW - 1 - k, C.cy + CH - 1, tick);
            setPx(C.cx, C.cy + CH - 1 - k, tick); setPx(C.cx + CW - 1, C.cy + CH - 1 - k, tick);
          }
        });
      }
      // progress along the bottom while anything wanted is still rendering
      const [n, tot] = progress();
      if (n < tot) {
        for (let x = 0; x < W; x++) { setPx(x, H - 2, [40, 36, 58]); setPx(x, H - 1, [40, 36, 58]); }
        for (let x = 0; x < Math.round(W * n / tot); x++) { setPx(x, H - 2, [240, 141, 79]); setPx(x, H - 1, [240, 141, 79]); }
      }
      c.g.putImageData(img, 0, 0);
      const msg = n < tot ? 'Rendering ' + n + ' of ' + tot + ' sprites…' : tot + ' sprites rendered in ' + (timing[st.model] / 1000).toFixed(1) + ' s and cached.';
      if (status.textContent !== msg) status.textContent = msg;
      const mm = measure();
      if (meas.textContent !== mm) meas.textContent = mm;
    }

    // ---- loop: rendering and the turntable, paused off screen ----
    let visible = false, raf = 0, lastTurn = 0;
    const kick = () => { if (!raf && visible) raf = requestAnimationFrame(tick); };
    const tick = now => {
      raf = 0;
      if (!visible) return;
      let dirty = work();
      const lead = st.layout === 'Cozy' ? 'cozy' : 'goth', next = (st.dir + step()) % 16;
      const ready = getJob(lead, nd(lead) === 16 ? next : next & ~1);
      if (st.play && now - lastTurn > (step() === 1 ? 110 : 170) && ready && ready.done) { st.dir = next; lastTurn = now; dirty = true; }
      if (dirty) draw();
      if (st.play || progress()[0] < progress()[1]) kick();
    };
    if (window.IntersectionObserver) new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; kick(); }).observe(host);
    else { visible = true; kick(); }
    const turn = k => { st.dir = ((dirOf(st.layout === 'Cozy' ? 'cozy' : 'goth') + k * step()) % 16 + 16) % 16; draw(); kick(); };

    // drag sideways to turn; tap a cell in a direction sheet to pick it, or tap to play and pause
    let drag = null;
    c.cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, moved: false }; c.cv.setPointerCapture(e.pointerId); });
    c.cv.addEventListener('pointermove', e => {
      if (!drag) return;
      const px = 10 * (c.cv.getBoundingClientRect().width / W) / 2;
      while (Math.abs(e.clientX - drag.x) > px) {
        const s = Math.sign(e.clientX - drag.x);
        drag.x += s * px; drag.moved = true;
        if (st.play) { st.play = false; playBox.checked = false; }
        turn(-s);
      }
    });
    c.cv.addEventListener('pointerup', e => {
      if (drag && !drag.moved) {
        const [x, y] = c.at(e);
        if (st.layout !== 'Both' && y >= TOP && y < TOP + L.body) {
          const cells = L.panels[0].cells, C = cells[Math.min(3, x / CW | 0) + 4 * ((y - TOP) / CH | 0)];
          if (C) { st.dir = C.dir; st.play = false; playBox.checked = false; draw(); kick(); }
        } else { st.play = !st.play; playBox.checked = st.play; kick(); }
      }
      drag = null;
    });
    c.cv.addEventListener('pointercancel', () => { drag = null; });

    // ---- controls ----
    const b1 = Kit.bar(host);
    b1.tabs(Object.keys(MODELS), v => { st.model = v; if (step() === 2) st.dir &= ~1; palettes(); draw(); kick(); }, st.model);
    b1.tabs(['Both', 'Gothic', 'Cozy'], v => { st.layout = v; if (step() === 2) st.dir &= ~1; draw(); kick(); }, 'Both');
    const b2 = Kit.bar(host);
    b2.button('◀', () => turn(1));
    b2.button('▶', () => turn(-1));
    const playBox = b2.check('Turntable', st.play, v => { st.play = v; kick(); });
    b2.check('Show raw render', false, v => { st.raw = v; draw(); });
    const b3 = Kit.bar(host);
    b3.note('Colormap');
    b3.tabs(Object.keys(VARIANTS), v => { st.variant = v; palettes(); draw(); }, 'Base');
    const status = b3.note('');
    const meas = Kit.bar(host).note('');
    // Measure: the current gothic sprite against numbers taken from a Diablo II player sheet (a style study).
    // It only shows the gap; nothing here tunes itself to the targets.
    function measure() {
      const J = getJob('goth', dirOf('goth'));
      if (!J || !J.done) return 'Measure: waiting for the gothic sprite…';
      const q = J.fin.idx, cols = new Set(), lum = [];
      let dark = 0, edge = 0, edgeDark = 0, top = CH, bot = 0;
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
        const i = y * CW + x;
        if (q[i] < 0) continue;
        const k = cmap[q[i]], c = G256[k], l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
        cols.add(c.join()); lum.push(l); if (l < 40) dark++;
        top = Math.min(top, y); bot = Math.max(bot, y);
        const out = (a, b) => a < 0 || b < 0 || a >= CW || b >= CH || q[b * CW + a] < 0;
        if (out(x - 1, y) || out(x + 1, y) || out(x, y - 1) || out(x, y + 1)) { edge++; if (l < 40) edgeDark++; }
      }
      lum.sort((a, b) => a - b);
      const pc = p => Math.round(lum[Math.min(lum.length - 1, Math.floor(p * lum.length))]);
      const pct = v => Math.round(100 * v) + '%';
      return 'Measure, gothic ' + DIRS[dirOf('goth')] + ', against a Diablo II player sheet [in brackets]: height ' + (bot - top + 1) + ' px [61–80] · colors ' + cols.size + ' [47–65] · luma 10/50/90/99 ' +
        [0.1, 0.5, 0.9, 0.99].map(pc).join('/') + ' [5/32/86/184] · near black ' + pct(dark / lum.length) + ' [55%] · edge near black ' + pct(edgeDark / Math.max(1, edge)) + ' [56%]';
    }
    Kit.bar(host).note('Each model is a signed distance field written in code. A small ray marcher renders it with a key light, a fill, soft shadows and ambient occlusion, a few rows a frame, then averages down and caches it. Gothic: an isometric camera, light from above and the front with little fill, render texture, an invented 256-color palette of hue ramps that run to near black, hard edges and no outline, sixteen directions for the player, a light radius, and colormaps that remap a reserved 16-color range. Cozy: an oblique 3/4 camera, four cel bands per material from OKLCH ramps with violet shadows, depth lines, a selective outline and orphan pixels removed. Drag to turn.');
    palettes();
    draw();
  });
})();
