// sprites-shared.js: the helpers the sprites demos share (sprite-masks, sprite-people, items, resolution-tiers), loaded before any of them.
// Each helper is exported on StudyShared, and a demo takes the ones it uses. Every random choice comes from
// Kit.rng, Kit.hash2 or Kit.noise2, so a seed always rebuilds the same picture.
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

  window.StudyShared = window.StudyShared || {};
  StudyShared.sprites = { Pix, rng, copy, outline, blit, FONT, text, textW, inb, MASKS, MASK_RAMPS, EMPTY, BODY, BORDER, GLASS, EYE, maskGrid, keepLargest, spratorGrid, paintGrid, RAMP, SKIN, HAIR, TOP, BOT, SHOE, ACC, MET, WOOD, INK, WHITE, BLUSH, TOP2, GEM, AUTO, dollParams, Mats, renderMats, dollRamps, basket, dollFront };
})();
