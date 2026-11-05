// resolution-tiers.js: One scene, three resolutions. A study demo, using sprites-shared.js.
(() => {
  const { Pix, rng, outline, blit, text, textW, dollParams, renderMats, dollRamps, dollFront } = StudyShared.sprites;
  // =====================================================================================
  // 4. plants: L-system and space-colonization trees, bushes and flowers, grown by age
  // =====================================================================================
  const LEAVES = [[14, 15, 16, 17, 18], [14, 15, 16, 17, 18], [15, 16, 17, 18, 19], [9, 10, 11, 12, 13], [1, 30, 31, 6, 7], [20, 21, 22, 23, 24]];
  const BARK = [26, 27, 28];
  // a plant buffer: wood mask (radius per pixel) and leaf shade per pixel, rendered with shading and an outline
  class Plant {
    constructor(w, h) { this.w = w; this.h = h; this.wood = new Uint8Array(w * h); this.leaf = new Int8Array(w * h).fill(-1); this.extra = new Int16Array(w * h).fill(-1); }
    stamp(x, y, r) {
      if (r < 0.8) { const X = Math.floor(x), Y = Math.floor(y); if (X >= 0 && Y >= 0 && X < this.w && Y < this.h) this.wood[Y * this.w + X] = 1; return; }
      for (let j = Math.floor(y - r); j <= y + r; j++) for (let i = Math.floor(x - r); i <= x + r; i++)
        if (i >= 0 && j >= 0 && i < this.w && j < this.h && (i + 0.5 - x) ** 2 + (j + 0.5 - y) ** 2 <= r * r) this.wood[j * this.w + i] = 1;
    }
    seg(x0, y0, x1, y1, r0, r1 = r0) {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let k = 0; k <= n; k++) { const t = k / n; this.stamp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t); }
    }
    // a foliage clump: dark disc, a mid disc up-left of it, a small light disc further up-left
    blob(x, y, r) {
      const put = (cx, cy, rr, s) => {
        for (let j = Math.floor(cy - rr); j <= cy + rr; j++) for (let i = Math.floor(cx - rr); i <= cx + rr; i++)
          if (i >= 0 && j >= 0 && i < this.w && j < this.h && (i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2 <= rr * rr) this.leaf[j * this.w + i] = s;
      };
      put(x, y, r, 1);
      if (r >= 1.5) put(x - r * 0.25, y - r * 0.3, r * 0.72, 2);
      if (r >= 2.2) put(x - r * 0.45, y - r * 0.55, r * 0.38, 3);
    }
    render(leafRamp, outlineCol = 0) {
      const p = new Pix(this.w, this.h), W = this.w;
      for (let y = 0; y < this.h; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (this.wood[i]) {
          const L = x > 0 && this.wood[i - 1], R = x < W - 1 && this.wood[i + 1];
          p.d[i] = BARK[L && !R ? 0 : !L && R ? 2 : 1];
        }
        if (this.leaf[i] >= 0) p.d[i] = leafRamp[this.leaf[i]];
        if (this.extra[i] >= 0) p.d[i] = this.extra[i];
      }
      // leaves touching clear sky below them get the dark step: a soft shadow along each clump's underside
      for (let y = this.h - 2; y >= 0; y--) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (this.leaf[i] >= 1 && this.leaf[i + W] < 0 && !this.wood[i + W] && this.extra[i] < 0) p.d[i] = leafRamp[0];
      }
      return outline(p, outlineCol);
    }
  }
  // stochastic L-system: each X picks one of a few rules; F doubles. Turtle with jittered angles.
  const LSYS = [
    ['F[+X][-X]FX', 'F[+X]F[-X]X', 'F[-X][+X]F[+X]X'],
    ['F[-X][X]F[-X]+FX', 'F[+X][X]F[+X]-FX'],
    ['FF[+X][-X]X', 'F[+X][-X][X]'],
  ];
  function lsysTree(seed, age, W, H) {
    const r = rng(seed);
    const rules = LSYS[r.int(0, LSYS.length - 1)], ang = r.range(18, 30) * Math.PI / 180;
    let str = 'X';
    const it = Math.min(age, 5);
    for (let k = 0; k < it; k++) {
      let o = '';
      for (const ch of str) o += ch === 'X' ? r.pick(rules) : ch === 'F' ? 'FF' : ch;
      str = o;
    }
    // walk the turtle, keeping segments and tips
    const segs = [], tips = [], st = [];
    let x = 0, y = 0, a = -Math.PI / 2 + r.range(-0.08, 0.08), d = 0;
    for (const ch of str) {
      if (ch === 'F') { const nx = x + Math.cos(a), ny = y + Math.sin(a); segs.push([x, y, nx, ny, d]); x = nx; y = ny; }
      else if (ch === '+') a += ang * r.range(0.7, 1.3);
      else if (ch === '-') a -= ang * r.range(0.7, 1.3);
      else if (ch === '[') { st.push([x, y, a, d]); d++; }
      else if (ch === ']') { tips.push([x, y, d]); [x, y, a, d] = st.pop(); }
    }
    tips.push([x, y, d]);
    let minX = 0, maxX = 0, minY = 0;
    for (const s of segs) { minX = Math.min(minX, s[2]); maxX = Math.max(maxX, s[2]); minY = Math.min(minY, s[3]); }
    const targetH = Math.min(H - 8, 12 + age * 9.5);
    const k = Math.min(targetH / Math.max(1, -minY), (W - 12) / Math.max(1, maxX - minX));
    const P = new Plant(W, H), ox = W / 2 - (minX + maxX) / 2 * k, oy = H - 1;
    const trunk = 0.6 + age * 0.32;
    for (const [x0, y0, x1, y1, dd] of segs) P.seg(ox + x0 * k, oy + y0 * k, ox + x1 * k, oy + y1 * k, Math.max(0.5, trunk * Math.pow(0.62, dd) * (1 - (-y0 * k) / (targetH * 2.2))));
    if (age === 1) P.blob(ox + x * k, oy + y * k, 2.2);
    if (age >= 2) {
      // merge tips closer than a clump's radius, so foliage reads as a few big clumps instead of speckle
      const R = 2 + Math.min(age, 5) * 0.6, kept = [];
      for (const t of tips) {
        const x = ox + t[0] * k, y = oy + t[1] * k;
        if (y > oy - 6) continue;
        if (!kept.some(q => Math.hypot(q[0] - x, q[1] - y) < R * 0.9)) kept.push([x, y]);
      }
      kept.sort((p, q) => p[1] - q[1]).forEach(([tx, ty]) => P.blob(tx, ty, R * r.range(0.85, 1.15)));
    }
    return P;
  }
  // space colonization (Runions et al.): attraction points fill a crown; branch nodes grow toward the
  // points that pick them, points within kill distance are used up. Pipe-model thickness from the tips down.
  function spaceTree(seed, age, W, H) {
    const r = rng(seed);
    const Ht = Math.min(H - 4, 14 + age * 9.5), crownH = Ht * r.range(0.6, 0.75);
    const crownW = Math.min(W / 2 - 4, crownH * r.range(0.55, 0.8)), cy = H - 1 - Ht + crownH * 0.6;
    const pts = [];
    while (pts.length < 140) {
      const x = r.range(-1, 1), y = r.range(-1, 1);
      if (x * x + y * y < 1 && !(y > 0.55 && Math.abs(x) < 0.3)) pts.push([W / 2 + x * crownW, cy + y * crownH * 0.6]);
    }
    const nodes = [{ x: W / 2, y: H - 1, p: -1, kids: 0 }];
    const D = 2.2, DI = 16, DK = 3.2, iters = 6 + age * 5;
    // the trunk climbs until it reaches the crown's influence
    while (nodes[nodes.length - 1].y > cy + crownH * 0.35) {
      const n = nodes[nodes.length - 1];
      nodes.push({ x: n.x + r.range(-0.4, 0.4), y: n.y - D, p: nodes.length - 1, kids: 0 }); n.kids++;
    }
    for (let k = 0; k < iters; k++) {
      const pull = new Map();
      for (const [px, py] of pts) {
        let best = -1, bd = DI;
        nodes.forEach((n, i) => { const d = Math.hypot(n.x - px, n.y - py); if (d < bd) { bd = d; best = i; } });
        if (best >= 0) { const v = pull.get(best) || [0, 0, 0]; const d = bd || 1; v[0] += (px - nodes[best].x) / d; v[1] += (py - nodes[best].y) / d; v[2]++; pull.set(best, v); }
      }
      if (!pull.size) break;
      for (const [i, v] of pull) {
        const l = Math.hypot(v[0], v[1] - 0.3) || 1, n = nodes[i];
        nodes.push({ x: n.x + v[0] / l * D, y: n.y + (v[1] - 0.3) / l * D, p: i, kids: 0 }); n.kids++;
      }
      for (let j = pts.length - 1; j >= 0; j--) if (nodes.some(n => Math.hypot(n.x - pts[j][0], n.y - pts[j][1]) < DK)) pts.splice(j, 1);
    }
    // pipe model: radius^2 of a node is the sum over its children
    const rad = nodes.map(() => 0.12);
    for (let i = nodes.length - 1; i > 0; i--) rad[nodes[i].p] += rad[i];
    const P = new Plant(W, H), s = 0.38 + age * 0.04;
    for (let i = 1; i < nodes.length; i++) {
      const n = nodes[i], q = nodes[n.p];
      P.seg(q.x, q.y, n.x, n.y, Math.sqrt(rad[n.p]) * s, Math.sqrt(rad[i]) * s);
    }
    if (age >= 3) nodes.filter(n => !n.kids).sort((a, b) => a.y - b.y).forEach(n => { if (r() < 0.2 + age * 0.1) P.blob(n.x, n.y, 0.8 + age * 0.3 + r()); });
    return P;
  }
  function bush(P, x, base, age, r, ramp, berry) {
    const n = 3 + age * 2, w = 4 + age * 1.6, h = 3 + age * 1.3;
    const bl = [];
    for (let k = 0; k < n; k++) { const t = r.range(-1, 1); bl.push([x + t * w, base - 2 - r() * h * (1 - Math.abs(t) * 0.6), 1.8 + age * 0.35 * r.range(0.7, 1.2)]); }
    bl.sort((a, b) => a[1] - b[1]).forEach(([bx, by, br]) => P.blob(bx, by, br));
    if (age >= 4) for (let k = 0; k < age * 2; k++) {
      const bx = Math.round(x + r.range(-w, w)), by = Math.round(base - 2 - r() * h);
      if (P.leaf[by * P.w + bx] >= 1) P.extra[by * P.w + bx] = berry;
    }
  }
  const PETALS = [[9, 10, 11], [30, 31, 12], [11, 12, 13], [5, 6, 7], [21, 23, 24], [10, 11, 12]];
  function flower(P, x, base, age, r) {
    const pet = r.pick(PETALS), kind = r.pick(['cross', 'round', 'daisy', 'tulip']);
    const hgt = Math.round(2 + age * r.range(1.6, 2.6));
    const sway = r.pick([-1, 0, 1]);
    let tx = x, ty = base;
    for (let k = 0; k < hgt; k++) { ty = base - 1 - k; tx = x + Math.round(sway * k * k / (hgt * hgt) * 1.5); P.leaf[ty * P.w + tx] = 1; }
    // leaves in pairs up the stem
    for (let k = 2; k < hgt - 2; k += 3) { const yy = base - 1 - k, side = (k / 3 & 1) ? 1 : -1; P.leaf[yy * P.w + x + side] = 2; if (age > 2) P.leaf[(yy - 1) * P.w + x + side * 2] = 3; }
    const set = (dx, dy, c) => { const X = tx + dx, Y = ty + dy; if (X >= 0 && Y >= 0 && X < P.w && Y < P.h) P.extra[Y * P.w + X] = c; };
    if (age <= 2) return;
    if (age === 3) { set(0, -1, pet[1]); set(0, 0, 16); return; } // a bud
    if (kind === 'tulip') { set(-1, -1, pet[1]); set(0, -1, pet[2]); set(1, -1, pet[0]); set(-1, -2, pet[2]); set(1, -2, pet[1]); set(0, -2, pet[1]); if (age >= 5) { set(-2, -2, pet[1]); set(2, -2, pet[0]); } return; }
    const ctr = pet === PETALS[2] ? 27 : 13;
    set(0, -1, ctr);
    const ring = kind === 'cross' ? [[0, -2], [-1, -1], [1, -1], [0, 0]] : kind === 'round' ? [[0, -2], [-1, -1], [1, -1], [0, 0], [-1, -2], [1, -2], [-1, 0], [1, 0]]
      : [[0, -3], [-2, -1], [2, -1], [0, 1], [-1, -2], [1, -2], [-1, 0], [1, 0]];
    ring.forEach(([dx, dy], k) => set(dx, dy - (kind === 'daisy' ? 0 : 0), pet[dx < 0 || dy < -1 ? 2 : dx > 0 ? 0 : 1]));
    if (age >= 5 && kind !== 'daisy') { set(-2, -1, pet[1]); set(2, -1, pet[0]); set(0, -3, pet[2]); }
  }


  // =====================================================================================
  // 5. resolution-tiers: one generated scene painted at 80x45, 160x90 and 320x180
  // =====================================================================================
  // The scene is a description in 320x180 units (where the house is, how big the tree is, who stands there).
  // Each tier repaints it with the detail its pixels can carry, rather than shrinking one picture:
  // 80x45 drops outlines and keeps two shades; 160x90 adds outlines and a third shade; 320x180 adds texture.
  const VILLAGER = {
    2: ['..hhhh..', '.hhhhhh.', '.hssssh.', '.sesses.', '.ssssss.', '..ssss..', '.tttttT.', 'ttttttTT', 'stttttTs', '.tttttT.', '.bbbbbB.', '.bb..bB.', '.bb..bB.', 'ff...fF.'],
    1: ['.hh.', 'hssh', '.ss.', 'tttT', 'sttT', '.tT.', 'b..B', 'f..f'],
  };
  function scene(seed) {
    const r = rng(seed * 101 + 9);
    return {
      r, doll: dollParams(seed * 3 + 1),
      houseX: r.int(180, 188), houseW: r.int(76, 90), wallTop: r.int(96, 106), roof: r.pick([[8, 9, 10, 11], [20, 21, 22, 23], [26, 27, 28, 29], [1, 30, 31, 12]]),
      wall: r.pick([[4, 5, 6, 7], [27, 28, 29, 13], [3, 4, 5, 6]]), chimney: r.chance(0.7),
      treeX: r.int(106, 116), treeR: r.int(26, 32), leaf: r.pick([LEAVES[0], LEAVES[2], LEAVES[3]]),
      clumps: Array.from({ length: 11 }, () => [r.range(-1, 1), r.range(-1, 0.6), r.range(0.4, 0.55)]),
      hills: [r.range(0, 6), r.range(0, 6)], clouds: Array.from({ length: 3 }, () => [r.int(10, 300), r.int(14, 50), r.int(10, 18)]),
    };
  }
  function paintTier(S, f) {
    const w = 320 * f, h = 180 * f, X = v => Math.round(v * f), tier = f === 1 ? 3 : f === 0.5 ? 2 : 1;
    const p = new Pix(w, h), GY = X(146);
    // sky in flat bands, more of them at higher tiers; a checker seam between bands only at the top tier
    const sky = tier === 1 ? [23, 24] : tier === 2 ? [22, 23, 24] : [22, 23, 24, 25];
    for (let y = 0; y < GY; y++) {
      const b = y / X(120) * sky.length, i = Math.min(sky.length - 1, Math.floor(b));
      for (let x = 0; x < w; x++) p.set(x, y, tier === 3 && b - i > 0.85 && i < sky.length - 1 && (x + y) & 1 ? sky[i + 1] : sky[i]);
    }
    if (tier > 1) for (const [cx, cy, cr] of S.clouds) {
      const P = new Plant(w, h);
      for (let k = -1; k <= 1; k++) P.blob(X(cx + k * cr * 0.9), X(cy + (k ? 3 : 0)), X(cr * (k ? 0.75 : 1)) + 0.5);
      for (let i = 0; i < P.leaf.length; i++) if (P.leaf[i] >= 0) p.d[i] = P.leaf[i] >= 2 ? 7 : tier === 3 && P.leaf[i] === 1 ? 6 : 7;
    }
    // hills
    for (let x = 0; x < w; x++) {
      const u = x / f;
      const h1 = X(112 + 8 * Math.sin(u * 0.02 + S.hills[0]) + 4 * Math.sin(u * 0.05));
      const h2 = X(126 + 6 * Math.sin(u * 0.03 + S.hills[1]));
      for (let y = h1; y < GY; y++) p.set(x, y, 21);
      if (tier > 1) for (let y = h2; y < GY; y++) p.set(x, y, 16);
      else for (let y = h2; y < GY; y++) p.set(x, y, 16);
    }
    // ground and a path to the door
    const doorX = S.houseX + S.houseW / 2;
    for (let y = GY; y < h; y++) for (let x = 0; x < w; x++) {
      const t = (y - GY) / (h - GY), half = X(9 + t * 26), px = X(doorX - t * 30);
      const onPath = Math.abs(x - px) < half;
      p.set(x, y, onPath ? (tier === 1 ? 29 : (x === px - half + 1 || x === px + half - 1) ? 28 : 29) : y === GY && tier > 1 ? 18 : 17);
    }
    if (tier === 3) for (let k = 0; k < 70; k++) { // tufts and pebbles, placed by hash so they never shimmer
      const x = Math.floor(Kit.hash2(k, 1, 77) * w), y = GY + 3 + Math.floor(Kit.hash2(k, 2, 77) * (h - GY - 5));
      if (p.get(x, y) === 17) { p.set(x, y, 16); p.set(x - 1, y - 1, 16); p.set(x + 1, y - 1, 18); }
      else if (p.get(x, y) === 29) p.set(x, y, 28);
    }
    // house
    const hx0 = X(S.houseX), hx1 = X(S.houseX + S.houseW), wt = X(S.wallTop), rt = X(S.wallTop - 34), ov = X(6);
    const H = new Pix(w, h), wall = S.wall, roof = S.roof;
    for (let y = wt; y < GY; y++) for (let x = hx0; x < hx1; x++) {
      let c = wall[tier === 1 ? 2 : 2];
      if (y < wt + Math.max(1, X(4))) c = wall[tier === 1 ? 1 : 0]; // the eave's shadow
      else if (tier === 3 && (y - wt) % 6 === 5) c = wall[1]; // plank seams
      else if (x >= hx1 - Math.max(1, X(4))) c = wall[1];
      H.set(x, y, c);
    }
    if (S.chimney) for (let y = rt + X(6); y < wt; y++) for (let x = hx1 - X(22); x < hx1 - X(12); x++) H.set(x, y, tier === 1 ? 10 : x === hx1 - X(22) ? 11 : 10);
    for (let y = rt; y < wt; y++) { // roof: a triangle with tile rows at the higher tiers
      const t = (y - rt) / (wt - rt), half = (hx1 - hx0) / 2 * t + ov * t, cx = (hx0 + hx1) / 2;
      for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) {
        let c = roof[2];
        if (tier >= 2 && (wt - y) % (tier === 3 ? 5 : 3) === 0) c = roof[1];
        if (tier === 3 && (wt - y) % 5 !== 0 && (x + ((wt - y) / 5 | 0) * 3) % 7 === 0) c = roof[1];
        if (x < cx - half + Math.max(1, X(3))) c = roof[3];
        if (y === wt - 1) c = roof[0];
        H.set(x, y, c);
      }
    }
    // door and windows
    const dw = Math.max(2, X(14)), dh = Math.max(3, X(24)), dx0 = Math.round(X(doorX) - dw / 2);
    for (let y = GY - dh; y < GY; y++) for (let x = dx0; x < dx0 + dw; x++) {
      let c = 27;
      if (tier >= 2 && x === dx0 + dw - 1) c = 26;
      if (tier === 3 && (x - dx0) % 4 === 3) c = 26;
      if (tier === 3 && y === GY - dh && (x === dx0 || x === dx0 + dw - 1)) c = -1;
      if (c >= 0) H.set(x, y, c);
    }
    if (tier >= 2) H.set(dx0 + dw - 3, GY - (dh >> 1), 13);
    for (const side of [-1, 1]) {
      const wx = X(doorX + side * S.houseW * 0.3), wy = X(S.wallTop + 14), ws = Math.max(1, X(13));
      for (let y = wy; y < wy + ws; y++) for (let x = Math.round(wx - ws / 2); x < Math.round(wx - ws / 2) + ws; x++) {
        let c = 13;
        if (tier >= 2 && (y === wy || x === Math.round(wx - ws / 2))) c = 12;
        if (tier === 3 && (y === wy + (ws >> 1) || x === Math.round(wx - ws / 2) + (ws >> 1))) c = 28;
        H.set(x, y, c);
      }
      if (tier === 3) for (let x = Math.round(wx - ws / 2) - 1; x <= Math.round(wx - ws / 2) + ws; x++) H.set(x, wy + ws, wall[0]);
    }
    blit(p, tier > 1 ? outline(H, 0) : H, 0, 0);
    // the tree: the same clump plan at every tier, scaled; the clump shading thins out by itself at low res
    const T = new Plant(w, h), tx = X(S.treeX), R = S.treeR;
    T.seg(tx, GY, tx, X(146 - R * 1.1), Math.max(0.5, X(5)), Math.max(0.5, X(3.5)));
    if (tier > 1) { T.seg(tx, X(146 - R * 0.9), X(S.treeX - R * 0.4), X(146 - R * 1.5), X(2.5), X(1.5)); T.seg(tx, X(146 - R * 1.1), X(S.treeX + R * 0.45), X(146 - R * 1.6), X(2.5), X(1.5)); }
    const cy = 146 - R * 1.75;
    S.clumps.slice(0, tier === 1 ? 5 : tier === 2 ? 8 : 11).map(([u, v, rr]) => [S.treeX + u * R * 0.85, cy + v * R * 0.6, rr * R])
      .sort((a, b) => a[1] - b[1]).forEach(([bx, by, br]) => T.blob(X(bx), X(by), X(br)));
    const tp = T.render(tier === 1 ? [S.leaf[1], S.leaf[1], S.leaf[2], S.leaf[2]] : tier === 2 ? [S.leaf[0], S.leaf[1], S.leaf[2], S.leaf[2]] : S.leaf, tier > 1 ? 0 : -1);
    blit(p, tp, 0, 0);
    // the villager: hand-made templates at the low tiers, the paper doll at the top tier, one palette for all
    const P = S.doll, vx = X(152);
    if (tier === 3) blit(p, renderMats(dollFront(P), dollRamps(P)), vx - 10, GY + 4 - 30);
    else {
      const tpl = VILLAGER[tier], map = { h: P.hair[1], H: P.hair[0], s: P.skin[1], e: 0, t: P.top[1], T: P.top[0], b: P.bot[1], B: P.bot[0], f: P.shoe[0], F: P.shoe[0] };
      const v = new Pix(tpl[0].length, tpl.length);
      tpl.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') v.set(x, y, map[ch]); }));
      blit(p, tier === 2 ? outline(v, 0) : v, vx - (v.w >> 1) - (tier === 2 ? 1 : 0), GY + (tier === 2 ? 2 : 1) - v.h);
    }
    return p;
  }

  Kit.register('resolution-tiers', { title: 'One scene, three resolutions', fit: 'prebake' }, host => {
    const c = Kit.canvas(host, 320, 180);
    const st = { tab: 'Compare', seed: 8 };
    const up = (src, k) => { const o = new Pix(src.w * k, src.h * k); for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) o.d[y * o.w + x] = src.d[(y / k | 0) * src.w + (x / k | 0)]; return o; };
    const label = (p, s, x, y) => { p.rect(x - 2, y - 2, textW(s) + 4, 9, 0); text(p, s, x, y, 7); };
    const draw = () => {
      const S = scene(st.seed);
      const tiers = [up(paintTier(S, 0.25), 4), up(paintTier(S, 0.5), 2), paintTier(S, 1)];
      const names = ['80X45', '160X90', '320X180'];
      let p;
      if (st.tab === 'Compare') {
        // the same 106-pixel-wide crop (tree, villager, house corner) at each tier, side by side
        p = new Pix(320, 180);
        for (let k = 0; k < 3; k++) for (let y = 0; y < 180; y++) for (let x = 0; x < 106; x++) p.d[y * 320 + k * 107 + x] = tiers[k].d[y * 320 + 100 + x];
        for (const x of [106, 213]) p.rect(x, 0, 1, 180, 0);
        names.forEach((n, k) => label(p, n, k * 107 + 4, 4));
      } else if (st.tab === 'Split') {
        // three vertical strips of the same scene, resolution rising left to right
        p = new Pix(320, 180);
        const cut = [0, 108, 212, 320];
        for (let k = 0; k < 3; k++) for (let y = 0; y < 180; y++) for (let x = cut[k]; x < cut[k + 1]; x++) p.d[y * 320 + x] = tiers[k].d[y * 320 + x];
        for (const x of [108, 212]) p.rect(x, 0, 1, 180, 0);
        names.forEach((n, k) => label(p, n, cut[k] + 4, 4));
      } else {
        const k = ['80×45', '160×90', '320×180'].indexOf(st.tab);
        p = tiers[k]; label(p, names[k], 4, 4);
      }
      c.put(p);
    };
    const b = Kit.bar(host);
    b.tabs(['Compare', 'Split', '80×45', '160×90', '320×180'], v => { st.tab = v; draw(); });
    b.seed(st.seed, s => { st.seed = s; draw(); });
    draw();
  });
})();
