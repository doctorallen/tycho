// sprites.js: demos of procedural sprites for the research page: mask sprites, paper-doll people,
// part-built items, grown plants, and one scene painted at three resolutions.
// Everything is drawn into palette-index buffers (Kit.Pix) from a seed, so the same seed gives the same art.
'use strict';
(() => {
  const { Pix, rng } = Kit;

  // ---- small shared helpers ----
  const copy = p => { const o = new Pix(p.w, p.h); o.d.set(p.d); return o; };
  // outline: any clear cell 4-adjacent to a filled one becomes `col` (8-adjacent with diag).
  function outline(p, col = 0, diag = false) {
    const o = copy(p);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      if (p.get(x, y) >= 0) continue;
      let hit = p.get(x - 1, y) >= 0 || p.get(x + 1, y) >= 0 || p.get(x, y - 1) >= 0 || p.get(x, y + 1) >= 0;
      if (!hit && diag) hit = p.get(x - 1, y - 1) >= 0 || p.get(x + 1, y - 1) >= 0 || p.get(x - 1, y + 1) >= 0 || p.get(x + 1, y + 1) >= 0;
      if (hit) o.set(x, y, col);
    }
    return o;
  }
  function blit(dst, src, dx, dy) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.d[y * src.w + x]; if (c >= 0) dst.set(dx + x, dy + y, c); }
  }
  // a tiny 3x5 font for labels drawn inside the art
  const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
    9: '111101111001110', x: '000101010101000', '-': '000000111000000', '.': '000000000000010', ' ': '000000000000000',
  };
  function text(p, s, x, y, c) {
    for (const ch of s) { const g = FONT[ch] || FONT[' ']; for (let i = 0; i < 15; i++) if (g[i] === '1') p.set(x + i % 3, y + (i / 3 | 0), c); x += 4; }
  }
  const textW = s => s.length * 4 - 1;
  // run-length checks like "is this cell part of the body"
  const inb = (p, x, y) => x >= 0 && y >= 0 && x < p.w && y < p.h;

  // =====================================================================================
  // 1. sprite-masks: Bollinger / zfedoran mask sprites, plus Sprator's cellular automaton
  // =====================================================================================
  // Mask cells: 0 always empty, 1 body or empty, 2 body or border, 3 always body, -1 always border,
  // 4 always cockpit (glass), 5 always eye, 6 body (70%) or empty. Each mask is the left half; the right column sits on the mirror line.
  const MASKS = {
    Creatures: { w: 7, h: 13, rows: [
      '0000000', '0100000', '0110000', '0011113', '0012233', '0012533', '0112233',
      '1112233', '1012233', '0012233', '0011223', '0011011', '0110000'] },
    Ships: { w: 7, h: 14, rows: [
      '0000000', '0000013', '0000013', '0000163', '0000124', '0001624', '0016623',
      '0166623', '1666263', '1666623', '1606623', '1006623', '0006611', '0000000'] },
    Robots: { w: 6, h: 13, rows: [
      '000001', '000001', '001113', '001253', '001223', '000133', '011223',
      '111223', '101223', '101223', '001123', '001100', '011100'] },
  };
  const MASK_RAMPS = ['red', 'green', 'blue', 'brown', 'violet', 'grey'].map(n => {
    const r = Kit.RAMPS[n]; return r.length === 8 ? r.slice(2, 6) : r.slice(1, 5);
  });
  // cell kinds in the generated grid
  const EMPTY = 0, BODY = 1, BORDER = -1, GLASS = 4, EYE = 5;

  function maskGrid(kind, seed, mirror) {
    const m = MASKS[kind], W = m.w * 2, H = m.h;
    for (let tries = 0; tries < 30; tries++) {
      const r = rng(Kit.hashStr(kind) ^ Math.imul(seed + tries * 7919, 2654435761));
      const g = new Int8Array(W * H);
      const roll = v => v === 0 ? EMPTY : v === 3 ? BODY : v === 4 ? GLASS : v === 5 ? EYE : v === 9 ? BORDER
        : v === 1 ? (r() < 0.5 ? BODY : EMPTY) : v === 6 ? (r() < 0.7 ? BODY : EMPTY) : (r() < 0.5 ? BODY : BORDER);
      for (let y = 0; y < H; y++) for (let x = 0; x < m.w; x++) {
        const v = m.rows[y][x] === '9' ? -1 : +m.rows[y][x];
        g[y * W + x] = roll(v);
        // mirrored: copy; unmirrored: roll the mirrored mask cell again, so the body plan holds but details differ
        g[y * W + (W - 1 - x)] = mirror ? g[y * W + x] : roll(v);
      }
      // keep only the largest 4-connected body; reject if it is small (Bollinger's curation, automated)
      const n = keepLargest(g, W, H);
      if (n >= W * H * 0.22 || tries === 29) return { g, W, H };
    }
  }
  function keepLargest(g, W, H) {
    const lab = new Int16Array(W * H).fill(-1); let best = -1, bestN = 0, id = 0;
    const solid = v => v === BODY || v === GLASS || v === EYE;
    for (let i = 0; i < W * H; i++) {
      if (!solid(g[i]) || lab[i] >= 0) continue;
      const st = [i]; lab[i] = id; let n = 0;
      while (st.length) {
        const j = st.pop(); n++; const x = j % W, y = j / W | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy, k = Y * W + X;
          if (X >= 0 && Y >= 0 && X < W && Y < H && solid(g[k]) && lab[k] < 0) { lab[k] = id; st.push(k); }
        }
      }
      if (n > bestN) { bestN = n; best = id; } id++;
    }
    for (let i = 0; i < W * H; i++) if (solid(g[i]) && lab[i] !== best) g[i] = EMPTY;
    return bestN;
  }
  // Sprator: white noise on a half grid, a few Life-like steps (survive on 2-3, born on 0-1), then mirror.
  function spratorGrid(seed, mirror, steps = 2) {
    const w = 5, h = 10, W = w * 2;
    for (let tries = 0; tries < 30; tries++) {
      const r = rng(0x5ba7 ^ Math.imul(seed + tries * 7919, 2654435761));
      const half = (sd) => {
        let a = new Uint8Array(w * h).map(() => r() < 0.5 ? 1 : 0);
        for (let s = 0; s < steps; s++) {
          const b = new Uint8Array(w * h);
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            let n = 0;
            for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
              if (!i && !j) continue;
              let X = x + i; const Y = y + j;
              if (X === w) X = w - 1 - sd; // the mirror side reflects (sd=0) so the seam stays coherent
              if (X >= 0 && Y >= 0 && X < w && Y < h) n += a[Y * w + X];
            }
            const live = a[y * w + x];
            b[y * w + x] = live ? (n === 2 || n === 3 ? 1 : 0) : (n <= 1 ? 1 : 0);
          }
          a = b;
        }
        return a;
      };
      const L = half(0), R = mirror ? L : half(0);
      const g = new Int8Array(W * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        g[y * W + x] = L[y * w + x] ? BODY : EMPTY;
        g[y * W + W - 1 - x] = R[y * w + x] ? BODY : EMPTY;
      }
      const n = keepLargest(g, W, h);
      if ((n >= W * h * 0.3 && n <= W * h * 0.72) || tries === 29) return { g, W, H: h };
    }
  }
  // paint a grid into a Pix: body shaded by a 4-step ramp with light from the top left, then outline.
  function paintGrid({ g, W, H }, seed, opt) {
    const r = rng(seed * 977 + 13);
    const ramp = MASK_RAMPS[r.int(0, MASK_RAMPS.length - 1)];
    let acc = MASK_RAMPS[r.int(0, MASK_RAMPS.length - 1)];
    if (acc === ramp) acc = MASK_RAMPS[(MASK_RAMPS.indexOf(ramp) + 2) % MASK_RAMPS.length];
    // zfedoran's color variation: now and then a row switches to the accent ramp
    const rowRamp = []; let cur = ramp;
    for (let y = 0; y < H; y++) { if (r() < 0.18) cur = cur === ramp ? acc : ramp; rowRamp.push(cur); }
    const p = new Pix(W + 2, H + 2);
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y * W + x] > 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = g[y * W + x];
      if (v === BORDER && opt.outline) { p.set(x + 1, y + 1, 0); continue; }
      if (v <= 0) continue;
      const rp = rowRamp[y];
      if (v === GLASS) { p.set(x + 1, y + 1, solid(x, y - 1) && !solid(x - 1, y) ? 25 : 23); continue; }
      if (v === EYE) { p.set(x + 1, y + 1, 7); continue; }
      let s = 1;
      if (opt.shade) {
        const lit = !solid(x, y - 1) || !solid(x - 1, y), dark = !solid(x, y + 1) || !solid(x + 1, y);
        if (lit && !dark) s = 2; else if (dark && !lit) s = 0;
        if (lit && !solid(x - 1, y - 1) && !solid(x, y - 1) && !solid(x - 1, y) && !dark) s = 3; // a highlight on lit corners
      }
      p.set(x + 1, y + 1, rp[s]);
    }
    // pupils: the eye cell nearer the mirror line gets a dark dot under it when there is room
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y * W + x] === EYE && solid(x, y + 1) && g[(y + 1) * W + x] === BODY) p.set(x + 1, y + 2, 0);
    return opt.outline ? outline(p, 0) : p;
  }

  Kit.register('sprite-masks', { title: 'Mask sprites', fit: 'prebake' }, host => {
    const COLS = 8, ROWS = 5, CELL = 20;
    const c = Kit.canvas(host, COLS * CELL, ROWS * CELL);
    const st = { kind: 'Creatures', seed: 1234, mirror: true, outline: true, shade: true };
    const draw = () => {
      const p = new Pix(c.w, c.h).fill(2);
      for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
        if ((i + j) & 1) p.rect(i * CELL, j * CELL, CELL, CELL, 1);
        const s = st.seed * 64 + j * COLS + i;
        const grid = st.kind === 'Sprator' ? spratorGrid(s, st.mirror) : maskGrid(st.kind, s, st.mirror);
        const spr = paintGrid(grid, s, st);
        blit(p, spr, i * CELL + ((CELL - spr.w) >> 1), j * CELL + ((CELL - spr.h + 1) >> 1));
      }
      c.put(p);
    };
    const b = Kit.bar(host);
    b.tabs(['Creatures', 'Ships', 'Robots', 'Sprator'], k => { st.kind = k; draw(); });
    const b2 = Kit.bar(host);
    b2.check('Mirror', true, v => { st.mirror = v; draw(); });
    b2.check('Outline', true, v => { st.outline = v; draw(); });
    b2.check('Shade', true, v => { st.shade = v; draw(); });
    b2.seed(st.seed, s => { st.seed = s; draw(); });
    draw();
  });

  // =====================================================================================
  // 2. sprite-people: paper-doll villagers from parts, recolored through ramps
  // =====================================================================================
  // Parts are drawn in material space (skin, hair, top...), each pixel a material and a shade (0 dark, 1 mid,
  // 2 light, or auto). A ramp table turns materials into palette colors, so a recolor is just another table.
  const RAMP = {
    skin: [[28, 29, 13], [27, 28, 29], [26, 27, 28], [29, 13, 7], [27, 28, 13]],
    hair: [[1, 2, 3], [26, 27, 28], [9, 10, 11], [10, 11, 12], [28, 29, 13], [27, 28, 29], [30, 31, 12], [20, 21, 22]],
    grey: [[3, 4, 5], [4, 5, 6], [5, 6, 7]],
    cloth: [[9, 10, 11], [15, 16, 17], [21, 22, 23], [22, 23, 24], [27, 28, 29], [1, 30, 31], [3, 4, 5],
      [11, 12, 13], [14, 15, 16], [20, 21, 22], [8, 9, 10], [16, 17, 18]],
    light: [[4, 5, 6], [5, 6, 7], [29, 13, 7]],
    metal: [3, 5, 6], wood: [26, 27, 28], gold: [11, 12, 13], leather: [26, 27, 28],
  };
  // materials
  const SKIN = 0, HAIR = 1, TOP = 2, BOT = 3, SHOE = 4, ACC = 5, MET = 6, WOOD = 7, INK = 8, WHITE = 9, BLUSH = 10, TOP2 = 11, GEM = 12;
  const AUTO = 3;

  function dollParams(seed) {
    const r = rng(seed * 7 + 3);
    const age = r.pick(['adult', 'adult', 'adult', 'child', 'elder']);
    const P = {
      age, tall: age === 'adult' && r.chance(0.4) ? 1 : 0,
      skin: r.pick(RAMP.skin),
      hair: age === 'elder' ? r.pick(RAMP.grey) : r.pick(RAMP.hair),
      top: r.pick(RAMP.cloth), top2: r.pick(RAMP.cloth), bot: r.pick(RAMP.cloth), acc: r.pick(RAMP.cloth),
      shoe: r.pick([RAMP.leather, [1, 2, 3], [8, 9, 10]]),
      hairStyle: r.pick(['short', 'bangs', 'long', 'bun', 'spiky', 'pony', 'curly', 'bob'].concat(age === 'elder' ? ['bald', 'bald'] : [])),
      beard: age !== 'child' && r.chance(age === 'elder' ? 0.6 : 0.2),
      blush: r.chance(0.5), bigEyes: r.chance(0.35),
      outfit: r.pick(['tunic', 'tunic', 'vest', 'robe', 'dress', 'apron']),
      sleeves: r.pick(['long', 'long', 'short']), belt: r.chance(0.6), skirt: r.chance(0.25),
      hat: r.pick(['none', 'none', 'none', 'brim', 'pointy', 'cap', 'hood', 'band', 'flower']),
      held: r.pick(['none', 'none', 'staff', 'satchel', 'basket', 'cape', 'scarf']),
    };
    if (age === 'child' && P.held === 'staff') P.held = 'none';
    if (P.hat === 'hood') P.hairStyle = 'short';
    if (P.top2 === P.top) P.top2 = RAMP.cloth[(RAMP.cloth.indexOf(P.top) + 5) % RAMP.cloth.length];
    if (P.acc === P.top) P.acc = RAMP.cloth[(RAMP.cloth.indexOf(P.top) + 3) % RAMP.cloth.length];
    return P;
  }

  // a material canvas: m[i] = material or -1, s[i] = shade
  class Mats {
    constructor(w, h) { this.w = w; this.h = h; this.m = new Int8Array(w * h).fill(-1); this.s = new Int8Array(w * h).fill(AUTO); }
    set(x, y, mat, sh = AUTO) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) { const i = y * this.w + x; this.m[i] = mat; this.s[i] = sh; } }
    get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : this.m[y * this.w + x]; }
    row(y, x0, x1, mat, sh) { for (let x = x0; x <= x1; x++) this.set(x, y, mat, sh); }
    // symmetric row around the center line between columns cx-1 and cx
    sym(y, hw, mat, sh, cx = 10) { this.row(y, cx - hw, cx + hw - 1, mat, sh); }
    clear(x, y) { this.set(x, y, -1); }
  }
  // turn materials into palette indexes: auto shade darkens the right edge of each region and lights the
  // top-left edge (light from the top left), then a 1-px ink outline goes around everything.
  function renderMats(M, ramps) {
    const p = new Pix(M.w, M.h);
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
      const i = y * M.w + x, m = M.m[i]; if (m < 0) continue;
      if (m === INK) { p.d[i] = 0; continue; }
      if (m === WHITE) { p.d[i] = 7; continue; }
      if (m === BLUSH) { p.d[i] = 11; continue; }
      let s = M.s[i];
      if (s === AUTO) {
        const R = M.get(x + 1, y) !== m, L = M.get(x - 1, y) !== m, U = M.get(x, y - 1) !== m, D = M.get(x, y + 1) !== m;
        s = 1;
        if (R && !L) s = 0; else if ((L || U) && !R && m !== SKIN && m !== SHOE) s = 2;
        if (m === HAIR && D && !U && s === 1) s = 0;
      }
      p.d[i] = ramps[m][s];
    }
    return outline(p, 0);
  }
  function dollRamps(P) {
    const t = [];
    t[SKIN] = P.skin; t[HAIR] = P.hair; t[TOP] = P.top; t[TOP2] = P.top2; t[BOT] = P.bot; t[SHOE] = P.shoe;
    t[ACC] = P.acc; t[MET] = RAMP.metal; t[WOOD] = RAMP.wood; t[GEM] = [21, 23, 25];
    return t;
  }

  // a basket of apples hanging from a hand: rim, woven body, fruit peeking over
  function basket(M, x, y) {
    M.set(x + 1, y - 1, GEM, 2); M.set(x + 2, y - 1, ACC, 2); M.set(x + 3, y - 1, ACC, 1);
    M.row(y, x, x + 4, WOOD, 2);
    for (let k = 0; k <= 4; k++) { M.set(x + k, y + 1, WOOD, k & 1 ? 0 : 1); M.set(x + k, y + 2, WOOD, k & 1 ? 1 : 0); }
    M.set(x, y + 2, -1); M.set(x + 4, y + 2, -1);
  }
  // front view, 20x32, centered between columns 9 and 10, feet on row 29
  function dollFront(P) {
    const M = new Mats(20, 32), cx = 10;
    const child = P.age === 'child';
    const tl = child ? 4 : 6, ll = child ? 3 : 4 + P.tall;
    const feet = 29, L0 = feet - ll - 1, B0 = L0 - tl, T = B0 - 7; // rows: head top, body top, hips
    const longBody = P.outfit === 'robe' || P.outfit === 'dress';
    // back layer: cape and long hair behind the body
    if (P.held === 'cape') for (let y = B0; y <= feet - 2; y++) M.sym(y, Math.min(5, 4 + ((y - B0) >> 2)), ACC, y > feet - 4 ? 0 : AUTO);
    const hairBack = { long: 7, pony: 0, curly: 3, bob: 2 }[P.hairStyle];
    if (hairBack) for (let y = T + 3; y < B0 + hairBack; y++) M.sym(y, 4 + (P.hairStyle === 'curly' ? 1 : 0), HAIR, y >= B0 + hairBack - 1 ? 0 : AUTO);
    if (P.hairStyle === 'pony') for (let y = T + 2; y < B0 + 4; y++) M.row(y, 14, 15 - (y > B0 + 1 ? 1 : 0), HAIR, y > B0 ? 0 : AUTO);
    // legs and feet
    if (!longBody) {
      if (P.skirt) {
        for (let y = L0; y < L0 + 3; y++) M.sym(y, 3 + (y > L0 ? 1 : 0), BOT);
        for (let y = L0 + 3; y < feet; y++) { M.row(y, 7, 8, SKIN); M.row(y, 11, 12, SKIN); }
      } else {
        M.sym(L0, 3, BOT);
        for (let y = L0 + 1; y < feet; y++) { M.row(y, 7, 8, BOT); M.row(y, 11, 12, BOT, 0); }
      }
      M.row(feet, 6, 8, SHOE); M.row(feet, 11, 13, SHOE);
    } else {
      M.row(feet, 7, 8, SHOE); M.row(feet, 11, 12, SHOE);
    }
    // torso: shoulders, then a taper; arms hang outside it
    for (let y = B0; y < L0; y++) M.sym(y, y === B0 ? 3 : 3, TOP);
    if (longBody) {
      const flare = P.outfit === 'dress' ? 2 : 1;
      for (let y = B0 + 3; y < feet; y++) M.sym(y, Math.min(3 + flare + 1, 3 + Math.floor((y - B0 - 3) * flare / 3)), TOP, y === feet - 1 ? 0 : AUTO);
    }
    if (P.outfit === 'vest') for (let y = B0; y < L0; y++) { M.row(y, 7, 8, TOP2); M.row(y, 11, 12, TOP2); }
    if (P.outfit === 'apron') for (let y = B0 + 2; y < (longBody ? feet - 1 : L0 + 2); y++) M.sym(y, 2, WHITE);
    // arms: 1 px sleeves in the cloth's dark step, hands below
    const armEnd = B0 + tl - 2;
    for (let y = B0; y <= armEnd; y++) {
      const sk = P.sleeves === 'short' && y > B0 + 1;
      M.set(6, y, sk ? SKIN : TOP, sk ? 1 : 0); M.set(13, y, sk ? SKIN : TOP, 0);
    }
    M.set(6, armEnd + 1, SKIN, 1); M.set(13, armEnd + 1, SKIN, 0);
    M.row(B0, 7, 12, TOP); // the shoulder line joins the arms
    if (P.belt && !longBody && P.outfit !== 'apron') { M.sym(L0 - 1, 3, WOOD, 0); M.set(9, L0 - 1, MET, 2); M.set(10, L0 - 1, MET, 1); }
    if (P.belt && P.outfit === 'robe') M.sym(B0 + 3, 3, ACC, 0);
    // head: rows of half widths 3,4,4,4,4,4,3
    [3, 4, 4, 4, 4, 4, 3].forEach((hw, j) => M.sym(T + j, hw, SKIN));
    // face
    const ey = T + 4;
    M.set(8, ey, INK); M.set(11, ey, INK);
    if (P.bigEyes) { M.set(8, ey - 1, INK); M.set(11, ey - 1, INK); }
    if (P.blush) { M.set(7, ey + 1, BLUSH); M.set(12, ey + 1, BLUSH); }
    if (P.beard) { M.sym(T + 6, 3, HAIR); M.sym(T + 5, 4, HAIR); M.row(T + 5, 8, 11, SKIN); M.set(9, T + 5, INK); M.set(10, T + 5, INK); M.sym(T + 7, 2, HAIR, 0); }
    // hair, front layer
    const hs = P.hairStyle;
    if (hs !== 'bald') {
      M.sym(T - 1, 3, HAIR); M.sym(T, 4, HAIR); M.sym(T + 1, 4, HAIR);
      M.set(6, T + 2, HAIR); M.set(13, T + 2, HAIR);
      if (hs === 'bangs' || hs === 'bob') { M.row(T + 2, 6, 13, HAIR); M.set(8, T + 2, SKIN); M.set(11, T + 2, SKIN); }
      if (hs === 'long' || hs === 'curly' || hs === 'bob') for (let y = T + 2; y < T + 6; y++) { M.set(6, y, HAIR); M.set(13, y, HAIR, 0); }
      if (hs === 'curly') { for (let y = T; y < T + 6; y++) { M.set(5, y, HAIR); M.set(14, y, HAIR, 0); } M.sym(T - 2, 2, HAIR); }
      if (hs === 'spiky') { for (let x = 6; x < 14; x += 2) M.set(x, T - 2, HAIR); M.sym(T - 1, 4, HAIR); }
      if (hs === 'bun') { M.sym(T - 3, 1, HAIR); M.sym(T - 2, 2, HAIR); }
      if (hs === 'short') M.set(7, T + 2, HAIR);
    } else { M.set(6, T + 2, HAIR); M.set(13, T + 2, HAIR, 0); M.set(6, T + 3, HAIR); M.set(13, T + 3, HAIR, 0); }
    // hats
    const h = P.hat;
    if (h === 'brim') { M.sym(T + 1, 6, ACC, 0); M.sym(T, 4, ACC); M.sym(T - 1, 4, ACC); M.sym(T - 2, 3, ACC); M.sym(T, 4, ACC); M.row(T, 6, 13, ACC, 0); }
    if (h === 'pointy') {
      M.sym(T + 1, 6, ACC, 0); M.sym(T, 4, ACC); M.sym(T - 1, 3, ACC); M.sym(T - 2, 3, ACC); M.sym(T - 3, 2, ACC); M.sym(T - 4, 2, ACC);
      M.row(T - 5, 10, 11, ACC); M.set(12, T - 6, ACC); M.set(13, T - 6, ACC); M.set(13, T - 7, GEM, 2);
      M.row(T, 6, 13, TOP2, 1);
    }
    if (h === 'cap') { M.sym(T - 1, 3, ACC); M.sym(T, 4, ACC); M.row(T + 1, 6, 15, ACC, 0); }
    if (h === 'hood') {
      for (let y = T - 1; y < B0 + 1; y++) M.sym(y, y === T - 1 ? 3 : 5, ACC);
      M.sym(T, 4, ACC); M.sym(B0, 5, ACC, 0);
      [3, 3, 3, 3, 2].forEach((hw, j) => M.sym(T + 2 + j, hw, SKIN));
      M.set(8, ey, INK); M.set(11, ey, INK); if (P.blush) { M.set(7, ey + 1, BLUSH); M.set(12, ey + 1, BLUSH); }
    }
    if (h === 'band') M.row(T + 1, 6, 13, ACC, 1);
    if (h === 'flower') { M.set(13, T, WHITE); M.set(14, T + 1, WHITE); M.set(12, T + 1, WHITE); M.set(13, T + 2, WHITE); M.set(13, T + 1, ACC, 2); }
    // held things, in front
    if (P.held === 'staff') {
      for (let y = T - 2; y <= feet; y++) M.set(15, y, WOOD, y < T ? 2 : 1);
      M.set(14, armEnd + 1, SKIN, 1); M.set(15, T - 3, GEM, 2); M.set(16, T - 2, GEM, 0); M.set(14, T - 2, GEM, 1); M.set(15, T - 2, GEM, 1);
    }
    if (P.held === 'satchel') {
      for (let k = 0; k < tl; k++) M.set(7 + k, B0 + k, ACC, 0);
      for (let y = L0 - 2; y < L0 + 1; y++) M.row(y, 13, 15, ACC); M.row(L0 - 2, 13, 15, ACC, 0); M.set(14, L0 - 1, MET, 2);
    }
    if (P.held === 'basket') basket(M, 2, armEnd + 2);
    if (P.held === 'scarf') { M.sym(B0, 4, ACC); M.set(11, B0 + 1, ACC); M.set(11, B0 + 2, ACC, 0); }
    return M;
  }

  // side view, facing right: same parameters, different geometry
  function dollSide(P) {
    const M = new Mats(20, 32);
    const child = P.age === 'child';
    const tl = child ? 4 : 6, ll = child ? 3 : 4 + P.tall;
    const feet = 29, L0 = feet - ll - 1, B0 = L0 - tl, T = B0 - 7;
    const longBody = P.outfit === 'robe' || P.outfit === 'dress';
    if (P.held === 'cape') for (let y = B0; y <= feet - 2; y++) M.row(y, 5 - ((y - B0) >> 3), 9, ACC, y > feet - 4 ? 0 : AUTO);
    const hairBack = { long: 7, pony: 2, curly: 3, bob: 2 }[P.hairStyle];
    if (hairBack) for (let y = T + 2; y < B0 + hairBack; y++) M.row(y, 5 + (y > B0 + 2 ? 1 : 0), 8, HAIR, y >= B0 + hairBack - 1 ? 0 : AUTO);
    if (P.hairStyle === 'pony') for (let y = T + 1; y < B0 + 3; y++) M.row(y, 4, 5, HAIR, y > B0 ? 0 : AUTO);
    // legs: back leg darker
    if (!longBody) {
      if (P.skirt) {
        for (let y = L0; y < L0 + 3; y++) M.row(y, 7 - (y > L0 ? 1 : 0), 12 + (y > L0 ? 1 : 0), BOT);
        for (let y = L0 + 3; y < feet; y++) M.row(y, 9, 10, SKIN);
      } else {
        M.row(L0, 8, 12, BOT);
        for (let y = L0 + 1; y < feet; y++) { M.row(y, 8, 9, BOT, 0); M.row(y, 10, 11, BOT); }
      }
      M.row(feet, 8, 12, SHOE);
    } else M.row(feet, 9, 12, SHOE);
    for (let y = B0; y < L0; y++) M.row(y, 8, 12, TOP);
    if (longBody) {
      const flare = P.outfit === 'dress' ? 2 : 1;
      for (let y = B0 + 3; y < feet; y++) { const e = Math.min(flare + 1, Math.floor((y - B0 - 3) * flare / 3)); M.row(y, 8 - e, 12 + e, TOP, y === feet - 1 ? 0 : AUTO); }
    }
    if (P.outfit === 'vest') for (let y = B0; y < L0; y++) M.row(y, 8, 9, TOP2);
    if (P.outfit === 'apron') for (let y = B0 + 2; y < (longBody ? feet - 1 : L0 + 2); y++) M.set(12, y, WHITE);
    if (P.belt && !longBody && P.outfit !== 'apron') { M.row(L0 - 1, 8, 12, WOOD, 0); M.set(12, L0 - 1, MET, 2); }
    if (P.belt && P.outfit === 'robe') M.row(B0 + 3, 8, 12, ACC, 0);
    // the near arm: a lighter strip with an ink line behind it, so it reads in front of the torso
    const armEnd = B0 + tl - 2;
    for (let y = B0 + 1; y <= armEnd; y++) { const sk = P.sleeves === 'short' && y > B0 + 1; M.set(9, y, INK); M.set(10, y, sk ? SKIN : TOP, sk ? 1 : 2); M.set(11, y, sk ? SKIN : TOP, sk ? 0 : 1); }
    M.row(armEnd + 1, 10, 11, SKIN, 1); M.set(9, armEnd + 1, INK);
    // head: 7 wide, face to the right, a nose bump
    [3, 4, 4, 4, 4, 4, 3].forEach((hw, j) => M.row(T + j, 10 - hw + 1, 10 + hw - 1 + (j === 0 || j === 6 ? 0 : 0), SKIN));
    M.set(14, T + 4, SKIN, 1);
    const ey = T + 3;
    M.set(12, ey, INK); if (P.bigEyes) M.set(12, ey + 1, INK);
    if (P.blush) M.set(11, ey + 2, BLUSH);
    if (P.beard) { M.row(T + 5, 9, 13, HAIR); M.row(T + 6, 8, 12, HAIR); M.row(T + 7, 10, 12, HAIR, 0); M.set(13, T + 5, SKIN); }
    const hs = P.hairStyle;
    if (hs !== 'bald') {
      M.row(T - 1, 8, 12, HAIR); M.row(T, 7, 13, HAIR); M.row(T + 1, 7, 12, HAIR); M.row(T + 2, 7, 9, HAIR); M.row(T + 3, 7, 8, HAIR); M.set(7, T + 4, HAIR);
      if (hs === 'bangs' || hs === 'bob') M.row(T + 2, 7, 13, HAIR);
      if (hs === 'long' || hs === 'curly' || hs === 'bob') for (let y = T + 4; y < T + 7; y++) M.row(y, 7, 9, HAIR);
      if (hs === 'curly') { for (let y = T; y < T + 6; y++) M.set(6, y, HAIR); M.row(T - 2, 9, 11, HAIR); }
      if (hs === 'spiky') { for (let x = 8; x < 14; x += 2) M.set(x, T - 2, HAIR); M.set(6, T, HAIR); }
      if (hs === 'bun') { M.row(T - 2, 7, 8, HAIR); M.row(T - 1, 6, 8, HAIR); }
    } else { M.row(T + 2, 7, 8, HAIR); M.row(T + 3, 7, 8, HAIR); }
    const h = P.hat;
    if (h === 'brim') { M.row(T + 1, 5, 15, ACC, 0); M.row(T, 7, 13, ACC); M.row(T - 1, 7, 13, ACC); M.row(T - 2, 8, 12, ACC); M.row(T, 7, 13, ACC, 0); }
    if (h === 'pointy') {
      M.row(T + 1, 5, 15, ACC, 0); M.row(T, 7, 13, TOP2, 1); M.row(T - 1, 7, 12, ACC); M.row(T - 2, 7, 12, ACC); M.row(T - 3, 7, 11, ACC);
      M.row(T - 4, 6, 10, ACC); M.row(T - 5, 5, 8, ACC); M.row(T - 6, 4, 5, ACC); M.set(3, T - 6, GEM, 2);
    }
    if (h === 'cap') { M.row(T - 1, 8, 12, ACC); M.row(T, 7, 13, ACC); M.row(T + 1, 7, 16, ACC, 0); }
    if (h === 'hood') {
      for (let y = T - 1; y < B0 + 1; y++) M.row(y, 6, y === T - 1 ? 12 : 13, ACC);
      [4, 4, 4, 4, 3].forEach((w, j) => M.row(T + 1 + j, 14 - w, 13, SKIN));
      M.set(14, T + 4, SKIN, 1); M.set(12, ey + 1, INK); M.set(12, ey, SKIN);
    }
    if (h === 'band') M.row(T + 1, 7, 13, ACC, 1);
    if (h === 'flower') { M.set(9, T, WHITE); M.set(10, T + 1, WHITE); M.set(8, T + 1, WHITE); M.set(9, T + 2, WHITE); M.set(9, T + 1, ACC, 2); }
    if (P.held === 'staff') { for (let y = T - 2; y <= feet; y++) M.set(13, y, WOOD, y < T ? 2 : 1); M.set(13, T - 3, GEM, 2); M.set(12, T - 2, GEM, 1); M.set(14, T - 2, GEM, 0); M.set(12, armEnd + 1, SKIN, 1); M.set(11, armEnd + 1, INK); }
    if (P.held === 'satchel') { for (let k = 0; k < tl - 1; k++) M.set(8 + (k >> 1), B0 + k, ACC, 0); M.row(L0 - 2, 6, 8, ACC, 0); M.row(L0 - 1, 6, 8, ACC); M.row(L0, 6, 8, ACC); }
    if (P.held === 'basket') basket(M, 11, armEnd + 2);
    if (P.held === 'scarf') { M.row(B0, 8, 13, ACC); M.set(7, B0 + 1, ACC); M.set(6, B0 + 2, ACC, 0); }
    return M;
  }

  Kit.register('sprite-people', { title: 'Paper-doll villagers', fit: 'prebake' }, host => {
    const COLS = 8, ROWS = 2, CW = 20, CH = 32;
    const c = Kit.canvas(host, COLS * CW, ROWS * CH);
    const st = { view: 'Front', seed: 2024 };
    const draw = () => {
      const p = new Pix(c.w, c.h).fill(2);
      const base = dollParams(st.seed * 100);
      const swaps = rng(st.seed + 99);
      for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
        const n = j * COLS + i, x0 = i * CW, y0 = j * CH;
        if ((i + j) & 1) p.rect(x0, y0, CW, CH, 3);
        let P;
        if (st.view === 'Recolor') {
          // one doll, sixteen ramp tables: the parts never change, only the lookup
          P = Object.assign({}, base, n ? { skin: swaps.pick(RAMP.skin), hair: swaps.pick(RAMP.hair), top: swaps.pick(RAMP.cloth),
            top2: swaps.pick(RAMP.cloth), bot: swaps.pick(RAMP.cloth), acc: swaps.pick(RAMP.cloth) } : {});
        } else P = dollParams(st.seed * 100 + n + 1);
        const M = st.view === 'Side' ? dollSide(P) : dollFront(P);
        // a soft ground shadow under the feet
        p.rect(x0 + 5, y0 + 30, 10, 1, 1); p.rect(x0 + 6, y0 + 31, 8, 1, 1);
        blit(p, renderMats(M, dollRamps(P)), x0, y0);
      }
      c.put(p);
    };
    const b = Kit.bar(host);
    b.tabs(['Front', 'Side', 'Recolor'], v => { st.view = v; draw(); });
    b.seed(st.seed, s => { st.seed = s; draw(); });
    draw();
  });

  // =====================================================================================
  // 3. items: part-built loot whose look and name come from the same rolled stats
  // =====================================================================================
  // Four-step ramps (dark to light). The stats pick the parts and ramps: base type picks the shape family,
  // material picks the metal ramp, element picks an accent ramp and an overlay, rarity adds gems and a halo,
  // level stretches the blade. The name is built from the same stats, so picture and name always agree.
  const METALS = { Iron: [2, 3, 5, 6], Steel: [3, 4, 6, 7], Bronze: [27, 28, 29, 13], Gold: [28, 12, 13, 7], Obsidian: [1, 2, 30, 31], Bone: [28, 29, 6, 7] };
  const ELEMENTS = {
    Ember: { ramp: [9, 10, 11, 12], fx: [12, 13], gem: 'Ruby', word: 'fire' },
    Frost: { ramp: [21, 22, 24, 25], fx: [25, 7], gem: 'Sapphire', word: 'frost' },
    Venom: { ramp: [15, 16, 17, 18], fx: [17, 18], gem: 'Emerald', word: 'poison' },
    Storm: { ramp: [11, 12, 13, 7], fx: [13, 7], gem: 'Topaz', word: 'lightning' },
    Gloom: { ramp: [1, 30, 31, 6], fx: [31, 30], gem: 'Amethyst', word: 'shadow' },
    Tide: { ramp: [20, 22, 23, 24], fx: [24, 25], gem: 'Aquamarine', word: 'water' },
  };
  const WOODS = [[26, 27, 28, 29], [8, 9, 10, 11], [20, 21, 22, 23], [26, 27, 28, 13]];
  const SUFFIX = ['of the Fen', 'of Dawn', 'of Echoes', 'of the Moth', 'of Seven Bells', 'of Quiet', 'of the Tide', 'of Ash', 'of the Lark', 'of Thorns'];
  const RARITY = ['common', 'magic', 'rare'];
  const CATS = { Blades: 'blade', Potions: 'potion', Gems: 'gem', Shields: 'shield', 'Rings & keys': 'ring', 'Books & scrolls': 'book' };

  function rollItem(seed, cat) {
    const r = rng(seed * 2654435761 + 17);
    const it = {
      cat, rarity: r() < 0.45 ? 0 : r() < 0.65 ? 1 : 2, level: r.int(1, 10),
      metal: r.pick(Object.keys(METALS)), element: r.pick(Object.keys(ELEMENTS)), r,
    };
    if (it.rarity === 0 && cat === 'blade') it.element = null;
    if (cat === 'ring' && (it.metal === 'Obsidian' || it.metal === 'Bone')) it.metal = 'Gold';
    const base = {
      blade: () => r.pick(['Dagger', 'Sword', 'Blade', 'Saber', 'Cleaver', 'Rapier']),
      potion: () => r.pick(['Draught', 'Tonic', 'Elixir', 'Phial', 'Brew']),
      gem: () => null, shield: () => r.pick(['Buckler', 'Heater', 'Kite Shield', 'Targe']),
      ring: () => r.pick(['Ring', 'Band', 'Signet', 'Key', 'Key']),
      book: () => r.pick(['Tome', 'Grimoire', 'Codex', 'Scroll', 'Scroll']),
    }[cat]();
    it.base = base;
    const el = it.element ? ELEMENTS[it.element] : null;
    const suf = SUFFIX[r.int(0, SUFFIX.length - 1)];
    if (cat === 'gem') {
      it.cut = r.pick(['round', 'oval', 'emerald', 'pear', 'marquise', 'trillion']);
      it.name = (it.rarity === 2 ? 'Flawless ' : it.rarity === 1 ? '' : 'Rough ') + el.gem;
    } else if (cat === 'potion') {
      it.name = (it.rarity ? r.pick(['Greater ', 'Bright ', 'Old ', 'Lesser ']) : '') + base + ' of ' + { Ember: 'Fire', Frost: 'Frost', Venom: 'Venom', Storm: 'Sparks', Gloom: 'Shadow', Tide: 'the Deep' }[it.element];
    } else if (it.rarity === 0) it.name = it.metal + ' ' + base;
    else if (it.rarity === 1) it.name = it.element + ' ' + base;
    else it.name = it.element + ' ' + base + ' ' + suf;
    it.detail = RARITY[it.rarity] + ' · ' + (cat === 'potion' || cat === 'gem' ? '' : it.metal.toLowerCase() + ' · ') + (el && (it.rarity || cat === 'potion' || cat === 'gem') ? el.word + ' · ' : '') + 'level ' + it.level;
    return it;
  }

  // rasterize a stroke along a 45-degree axis: f(t, s) returns a color or -1 for pixel centers,
  // t along the axis from the origin, s across it (negative is the upper-left, lit side)
  function axial(p, ox, oy, f) {
    const k = Math.SQRT1_2;
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const dx = x + 0.5 - ox, dy = y + 0.5 - oy;
      const t = (dx - dy) * k, s = (dx + dy) * k;
      const c = f(t, s); if (c >= 0) p.set(x, y, c);
    }
  }
  function drawBlade(p, it) {
    const r = it.r, m = METALS[it.metal], el = it.element ? ELEMENTS[it.element] : null;
    const kind = it.base, wood = r.pick(WOODS);
    const short = kind === 'Dagger', thin = kind === 'Rapier', wide = kind === 'Cleaver', curve = kind === 'Saber' ? 1.6 : 0;
    const gl = short ? 3 : 3.5, bl = (short ? 7.5 : 10) + it.level * (short ? 0.25 : 0.4);
    const bw = thin ? 0.55 : wide ? 1.9 : short ? 1.1 : 1.25, gw = short ? 2.3 : thin ? 2.0 : 3.1;
    const guardRamp = it.rarity ? el.ramp : (r.chance(0.5) ? METALS.Gold : m);
    const g0 = gl, g1 = gl + 1.3, tip = g1 + bl;
    const ox = 3.2, oy = p.h - 3.2;
    axial(p, ox, oy, (t, s) => {
      if (t < -1.6 || t > tip) return -1;
      if (t < 0) return Math.hypot(t + 0.4, s) < 1.25 ? guardRamp[s + t < -0.6 ? 3 : 1] : -1; // pommel
      if (t < g0) return Math.abs(s) < 0.75 ? wood[(Math.floor(t * 1.4) & 1) ? 1 : 2] : -1; // wrapped grip
      if (t < g1) { // guard, tips bent toward the blade on some swords
        const bend = kind === 'Sword' || kind === 'Blade' ? 0 : 0.6;
        return Math.abs(s) < gw && t < g1 - bend * Math.abs(s) / gw + bend ? guardRamp[s < -0.2 ? 3 : s > 0.6 ? 0 : 2] : -1;
      }
      const u = (t - g1) / bl, c = curve * u * u, ss = s - c;
      const taper = Math.min(1, (tip - t) / (thin ? 2 : wide ? 1.2 : 2.6));
      const hw = bw * (wide ? 1 : taper) + 0.05;
      if (wide && t > tip - 1.5 && ss < -bw + (tip - t)) return -1; // the cleaver's clipped corner
      if (Math.abs(ss) > hw) return -1;
      if (ss < -hw + 0.75) return m[3];
      if (ss > hw - 0.75) return m[1];
      return m[2];
    });
    if (it.rarity) { // a set gem in the guard
      const cx = Math.round(ox + (g0 + 0.6) * Math.SQRT1_2), cy = Math.round(oy - (g0 + 0.6) * Math.SQRT1_2);
      p.set(cx, cy - 1, el.ramp[3]); p.set(cx, cy, el.ramp[1]);
    }
    return { tipX: ox + tip * Math.SQRT1_2, tipY: oy - tip * Math.SQRT1_2 };
  }
  function drawPotion(p, it) {
    const r = it.r, liq = ELEMENTS[it.element].ramp, cx = 10;
    const shape = r.pick(['round', 'round', 'tall', 'cone', 'square']);
    const inBody = {
      round: (x, y) => Math.hypot(x - cx, (y - 12.5) * 1.05) < 5.6,
      tall: (x, y) => x > 6.5 && x < 13.5 && y > 7 && y < 17.5 && !((x < 7.5 || x > 12.5) && (y < 8 || y > 16.5)),
      cone: (x, y) => y > 7.5 && y < 17.5 && Math.abs(x - cx) < 1.6 + (y - 7.5) * 0.6,
      square: (x, y) => x > 5.5 && x < 14.5 && y > 9 && y < 17.5 && !((x < 6.5 || x > 13.5) && (y < 10 || y > 16.5)),
    }[shape];
    let top = 99, bot = 0;
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) if (inBody(x + 0.5, y + 0.5)) { top = Math.min(top, y); bot = Math.max(bot, y); }
    const level = Math.round(top + (bot - top) * (0.2 + r() * 0.45));
    for (let y = top; y <= bot; y++) for (let x = 0; x < 20; x++) {
      if (!inBody(x + 0.5, y + 0.5)) continue;
      if (y < level) { p.set(x, y, x < cx - 2 ? 4 : 3); continue; } // empty glass
      const s = y === level ? 3 : x < cx - 2 ? 2 : x > cx + 1 ? 0 : 1;
      p.set(x, y, liq[s]);
    }
    // neck, lip and cork
    for (let y = top - 3; y < top; y++) { p.set(cx - 1, y, 4); p.set(cx, y, 3); }
    p.rect(cx - 2, top - 4, 4, 1, 5);
    p.rect(cx - 1, top - 6, 2, 2, 28); p.set(cx - 1, top - 6, 29);
    // glass highlight and bubbles
    p.set(cx - 3, level + 1, 7); p.set(cx - 3, level + 2, liq[3]);
    if (shape === 'round' || shape === 'square') p.set(cx - 4, top + 2, 6);
    p.set(cx + 1, bot - 2, liq[3]); if (it.rarity) p.set(cx - 1, bot - 4, 7);
    if (it.rarity === 2) { p.rect(cx - 2, top + 1 + ((level - top) >> 1), 4, 1, 13); } // a gold band on fine bottles
    return { tipX: cx, tipY: top - 6 };
  }
  function drawGem(p, it) {
    const r = it.r, ramp = ELEMENTS[it.element].ramp, cx = 10, cy = 10;
    const R = 4.2 + it.rarity * 1.1 + it.level * 0.08;
    const cut = it.cut;
    const n = { round: 8, oval: 8, emerald: 8, pear: 9, marquise: 10, trillion: 3 }[cut];
    const verts = [];
    for (let k = 0; k < n; k++) {
      let a = -Math.PI / 2 + k * 2 * Math.PI / n + (cut === 'emerald' ? Math.PI / 8 : 0);
      let rx = R, ry = R;
      if (cut === 'oval') ry = R * 1.25, rx = R * 0.9;
      if (cut === 'emerald') rx = R * 0.85, ry = R * 1.15;
      if (cut === 'marquise') { rx = R * 0.7; ry = R * 1.35; }
      let x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      if (cut === 'pear' && y < 0) x *= 1 + y / R * 0.6;
      if (cut === 'trillion') { x *= 1.45; y = y * 1.45 + 1.2; }
      verts.push([cx + x, cy + y]);
    }
    const inside = (x, y, vs) => { let c = false; for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) { const [xi, yi] = vs[i], [xj, yj] = vs[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    const table = verts.map(([x, y]) => [cx - 0.6 + (x - cx) * 0.45, cy - 0.6 + (y - cy) * 0.45]);
    const L = [-0.75, -0.66];
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const px = x + 0.5, py = y + 0.5;
      if (!inside(px, py, verts)) continue;
      if (inside(px, py, table)) { p.set(x, y, ramp[2]); continue; }
      // the facet faces outward along the angle of the sector this pixel falls in
      const a = Math.atan2(py - cy, px - cx), sec = Math.round((a + Math.PI / 2) / (2 * Math.PI / n));
      const fa = -Math.PI / 2 + sec * 2 * Math.PI / n;
      const d = Math.cos(fa) * L[0] + Math.sin(fa) * L[1];
      p.set(x, y, ramp[d > 0.5 ? 3 : d > 0.05 ? 2 : d > -0.55 ? 1 : 0]);
    }
    if (R > 5) verts.forEach(([vx, vy], k) => { // facet edges from the table's corners outward, on the shadow side only
      const [tx0, ty0] = table[k];
      for (let u = 0.2; u < 0.9; u += 0.15) { const x = Math.floor(tx0 + (vx - tx0) * u), y = Math.floor(ty0 + (vy - ty0) * u); if (x + y > cx + cy && p.get(x, y) >= 0) p.set(x, y, ramp[0]); }
    });
    const tx = Math.round(table[0][0]) - 1, ty = Math.round(cy - R * 0.25);
    p.set(tx, ty, 7); if (it.rarity) p.set(tx + 1, ty - 1, 7);
    return { tipX: cx + R * 0.7, tipY: cy - R };
  }
  function drawShield(p, it) {
    const r = it.r, rim = METALS[it.metal], cx = 10;
    const field = r.pick(RAMP.cloth.map(c => [c[0], c[0], c[1], c[2]])), field2 = r.pick(WOODS.concat([[3, 5, 6, 7], [8, 10, 11, 12], [20, 22, 23, 24]]));
    const kind = it.base;
    const inS = {
      Heater: (x, y) => y > 2.5 && y < 18 && Math.abs(x - cx) < (y < 10 ? 7 : 7 * Math.sqrt(Math.max(0, 1 - ((y - 10) / 8) ** 2))),
      'Kite Shield': (x, y) => { const t = (y - 2.5) / 15.5; return t > 0 && t < 1 && Math.abs(x - cx) < (t < 0.3 ? 4 + t / 0.3 * 2.5 : 6.5 * (1 - (t - 0.3) / 0.7) + 0.6); },
      Buckler: (x, y) => Math.hypot(x - cx, y - 10.5) < 6.4,
      Targe: (x, y) => Math.hypot(x - cx, y - 10.5) < 7.6,
    }[kind];
    const div = r.pick(['pale', 'fess', 'chevron', 'cross', 'bend', 'plain', 'saltire']);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const px = x + 0.5, py = y + 0.5;
      if (!inS(px, py)) continue;
      const edge = !inS(px - 1, py) || !inS(px + 1, py) || !inS(px, py - 1) || !inS(px, py + 1);
      const sh = px < cx - 3 ? 3 : px > cx + 3 ? 1 : 2;
      if (edge) { p.set(x, y, rim[(!inS(px - 1, py) || !inS(px, py - 1)) && !(!inS(px + 1, py) || !inS(px, py + 1)) ? 3 : 1]); continue; }
      const dx = px - cx, dy = py - 10;
      const second = { pale: dx > 0, fess: dy > 0, chevron: dy > 2 - Math.abs(dx) * 0.9 && dy < 5 - Math.abs(dx) * 0.9, cross: Math.abs(dx) < 1.1 || Math.abs(dy + 1) < 1.1,
        bend: Math.abs(dx + dy) < 1.6, plain: false, saltire: Math.abs(dx - dy) < 1.1 || Math.abs(dx + dy) < 1.1 }[div];
      p.set(x, y, (second ? field2 : field)[sh]);
    }
    if (kind === 'Buckler' || kind === 'Targe' || it.rarity) { // a boss, or a gem for magic shields
      const bc = it.rarity ? ELEMENTS[it.element].ramp : rim;
      p.set(cx - 1, 10, bc[3]); p.set(cx, 10, bc[2]); p.set(cx - 1, 11, bc[2]); p.set(cx, 11, bc[1]);
      if (kind === 'Targe') for (const [x, y] of [[cx - 5, 7], [cx + 4, 7], [cx - 5, 13], [cx + 4, 13]]) p.set(x, y, rim[3]);
    }
    return { tipX: cx + 6, tipY: 3 };
  }
  function drawRing(p, it) {
    const r = it.r, m = METALS[it.metal], el = ELEMENTS[it.element];
    if (it.base === 'Key') {
      const by = 7, bx = 6;
      for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
        const d = Math.hypot(x + 0.5 - bx, y + 0.5 - by);
        if (d < 3.9 && d > (it.rarity ? 0 : 1.6)) p.set(x, y, m[x + y < bx + by - 2 ? 3 : x + y > bx + by + 2 ? 1 : 2]);
      }
      if (it.rarity) { p.set(bx - 1, by - 1, el.ramp[3]); p.set(bx, by - 1, el.ramp[2]); p.set(bx - 1, by, el.ramp[2]); p.set(bx, by, el.ramp[1]); }
      // shaft along the diagonal, then teeth from the seed's bits
      for (let k = 0; k < 9; k++) { p.set(bx + 2 + k, by + 2 + k, m[2]); p.set(bx + 3 + k, by + 2 + k, m[1]); p.set(bx + 2 + k, by + 1 + k, m[3]); }
      const bits = r.int(1, 15);
      for (let k = 0; k < 4; k++) if (bits >> k & 1 || k === 3) { const x = bx + 7 + k, y = by + 7 + k; p.set(x - 1, y + 1, m[1]); p.set(x - 2, y + 2, m[0 + 1]); }
      return { tipX: 15, tipY: 5 };
    }
    const cx = 10, cy = 12, sig = it.base === 'Signet';
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const dx = (x + 0.5 - cx) / 6, dy = (y + 0.5 - cy) / 4.3, o = dx * dx + dy * dy;
      const ix = (x + 0.5 - cx) / 3.6, iy = (y + 0.5 - cy - 0.4) / 2.0, i = ix * ix + iy * iy;
      if (o < 1 && i > 1) p.set(x, y, m[y + 0.5 < cy ? (x < cx ? 2 : 1) : (x < cx - 1 ? 3 : x > cx + 2 ? 1 : 2)]);
    }
    if (sig) { p.rect(cx - 2, cy - 6, 4, 3, m[2]); p.rect(cx - 2, cy - 6, 2, 1, m[3]); p.set(cx, cy - 5, el.ramp[1]); p.set(cx - 1, cy - 5, el.ramp[2]); }
    else if (it.rarity || it.base === 'Ring') { // a set stone on prongs
      p.set(cx - 2, cy - 4, m[3]); p.set(cx + 1, cy - 4, m[1]);
      p.rect(cx - 1, cy - 7, 2, 3, el.ramp[1]); p.set(cx - 1, cy - 7, el.ramp[3]); p.set(cx - 1, cy - 6, el.ramp[2]); p.set(cx, cy - 7, el.ramp[2]);
      p.set(cx - 2, cy - 6, el.ramp[0]); p.set(cx + 1, cy - 6, el.ramp[0]);
    }
    return { tipX: cx + 4, tipY: cy - 7 };
  }
  function drawBook(p, it) {
    const r = it.r, el = ELEMENTS[it.element];
    if (it.base === 'Scroll') {
      const paper = [28, 29, 13, 7], wood = r.pick(WOODS);
      for (let y = 5; y <= 14; y++) for (let x = 5; x <= 14; x++) p.set(x, y, paper[x === 14 ? 1 : x === 5 ? 3 : 2]);
      for (let y = 6; y < 14; y += 2) for (let x = 7; x < 13; x++) if (r() < 0.8) p.set(x, y, 28); // lines of writing
      for (const ry of [3, 15]) { // the rolls
        p.rect(4, ry, 12, 2, paper[2]); p.rect(4, ry, 12, 1, paper[3]); p.rect(4, ry + 1, 12, 1, paper[1]);
        p.rect(3, ry, 1, 2, wood[2]); p.rect(16, ry, 1, 2, wood[1]);
      }
      // a wax seal and ribbon
      const sc = it.rarity ? el.ramp : [8, 9, 10, 11];
      p.set(9, 16, sc[2]); p.set(10, 16, sc[1]); p.set(9, 17, sc[1]); p.set(10, 17, sc[0]); p.set(8, 18, sc[1]); p.set(11, 18, sc[0]);
      return { tipX: 15, tipY: 3 };
    }
    const cover = r.pick(RAMP.cloth.map(c => [c[0], c[0], c[1], c[2]]).concat([[26, 26, 27, 28]]));
    const trim = METALS[it.metal === 'Bone' ? 'Gold' : it.metal];
    const x0 = 4, x1 = 15, y0 = 3, y1 = 17;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let c = cover[x <= x0 + 1 ? 1 : x === x0 + 2 ? 3 : 2];
      if (x === x1 || y === y1) c = (x + y) & 1 ? 6 : 7; // page edges
      if (x === x1 && y === y0) c = -1;
      if (y === y1 && x === x0) c = -1;
      if (c >= 0) p.set(x, y, c);
    }
    for (const y of [y0 + 2, y1 - 3]) { p.set(x0, y, trim[2]); p.set(x0 + 1, y, trim[1]); } // spine bands
    const deco = r.pick(['corners', 'frame', 'gem', 'strap']);
    if (deco === 'corners' || it.rarity === 2) { p.set(x1 - 1, y0, trim[3]); p.set(x1 - 1, y0 + 1, trim[2]); p.set(x1 - 2, y0, trim[2]); p.set(x1 - 1, y1 - 1, trim[1]); p.set(x1 - 2, y1 - 1, trim[1]); p.set(x1 - 1, y1 - 2, trim[1]); }
    if (deco === 'frame') { for (let x = x0 + 4; x <= x1 - 3; x++) { p.set(x, y0 + 2, trim[2]); p.set(x, y1 - 3, trim[1]); } for (let y = y0 + 2; y <= y1 - 3; y++) { p.set(x0 + 4, y, trim[3]); p.set(x1 - 3, y, trim[1]); } }
    if (deco === 'strap') { p.rect(x1 - 4, y0 + 6, 5, 2, trim[1]); p.set(x1 - 1, y0 + 6, trim[3]); }
    if (deco === 'gem' || it.rarity) { const gx = 10, gy = 9; p.set(gx, gy - 1, el.ramp[3]); p.set(gx - 1, gy, el.ramp[2]); p.set(gx, gy, el.ramp[1]); p.set(gx + 1, gy, el.ramp[0]); p.set(gx, gy + 1, el.ramp[0]); }
    return { tipX: 15, tipY: 3 };
  }
  const DRAW = { blade: drawBlade, potion: drawPotion, gem: drawGem, shield: drawShield, ring: drawRing, book: drawBook };

  function itemSprite(it) {
    const p = new Pix(20, 20);
    const at = DRAW[it.cat](p, it);
    let o = outline(p, 0);
    // rarity halo: blue for magic, orange for rare
    if (it.rarity) {
      const hc = it.rarity === 2 ? 12 : 23, h = outline(o, hc);
      for (let i = 0; i < h.d.length; i++) if (o.d[i] < 0 && h.d[i] >= 0) o.d[i] = hc;
    }
    // element overlay near the tip: flames, frost glints, drips, sparks
    if (it.element && it.rarity) {
      const fx = ELEMENTS[it.element].fx, x = Math.round(at.tipX), y = Math.round(at.tipY);
      const pts = { Ember: [[1, -1], [2, -2], [0, -3], [2, -4]], Frost: [[2, -2], [1, -2], [3, -2], [2, -1], [2, -3]], Venom: [[0, 3], [0, 4], [-1, 6]],
        Storm: [[1, -1], [2, -2], [1, -3], [2, -4]], Gloom: [[1, -2], [2, -3], [3, -2]], Tide: [[2, -1], [3, -2], [1, -3]] }[it.element];
      pts.forEach(([dx, dy], k) => { if (o.get(x + dx, y + dy) < 0) o.set(x + dx, y + dy, fx[k & 1]); });
    }
    return o;
  }

  Kit.register('items', { title: 'Part-built items', fit: 'prebake' }, host => {
    const COLS = 8, ROWS = 3, CELL = 20;
    const c = Kit.canvas(host, COLS * CELL, ROWS * CELL);
    c.cv.style.cursor = 'pointer';
    const info = Kit.el('div', { class: 'ctl' }); host.appendChild(info);
    const st = { tab: 'Mixed', seed: 77, sel: 0, items: [] };
    const cats = Object.values(CATS);
    const roll = () => {
      st.items = [];
      for (let n = 0; n < COLS * ROWS; n++) {
        const cat = st.tab === 'Mixed' ? cats[n % cats.length] : CATS[st.tab];
        const it = rollItem(st.seed * 1000 + n, cat); it.spr = itemSprite(it); st.items.push(it);
      }
      draw();
    };
    const draw = () => {
      const p = new Pix(c.w, c.h).fill(2);
      st.items.forEach((it, n) => {
        const x0 = (n % COLS) * CELL, y0 = (n / COLS | 0) * CELL;
        if (((n % COLS) + (n / COLS | 0)) & 1) p.rect(x0, y0, CELL, CELL, 1);
        if (n === st.sel) { p.rect(x0, y0, CELL, 1, 5); p.rect(x0, y0 + CELL - 1, CELL, 1, 5); p.rect(x0, y0, 1, CELL, 5); p.rect(x0 + CELL - 1, y0, 1, CELL, 5); }
        blit(p, it.spr, x0, y0);
      });
      c.put(p);
      const it = st.items[st.sel];
      info.replaceChildren(Kit.el('strong', {}, it.name), Kit.el('span', { class: 'note' }, it.detail));
    };
    c.cv.addEventListener('pointerdown', e => {
      const [x, y] = c.at(e), n = Math.floor(y / CELL) * COLS + Math.floor(x / CELL);
      if (n >= 0 && n < st.items.length) { st.sel = n; draw(); }
    });
    const b = Kit.bar(host);
    b.tabs(['Mixed'].concat(Object.keys(CATS)), v => { st.tab = v; roll(); });
    const b2 = Kit.bar(host);
    b2.seed(st.seed, s => { st.seed = s; roll(); });
    b2.note('Tap an item for its name. Rarity adds the halo and gems; element sets the accent color and the sparks.');
    roll();
  });

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
