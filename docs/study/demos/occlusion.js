// occlusion.js: the `occlusion` demo, a village block a figure walks through, using buildings-shared.js.
// Every wall run, piece of furniture, roof, tree and fence is its own pre-painted sprite with a 3D box. Each frame the
// sprites are drawn with drawImage in one of two orders: Naive, one point per thing (the middle of its footprint, as a
// y-sort does), or Boxes, a dependency graph of overlapping pictures ordered by Lebron's box test and sorted
// topologically. Step inside a house and its roof and upper walls fade out through a Bayer dither (only that house's,
// as Fallout's roof flood does); stand behind something and an x-ray silhouette shows through it, masked with
// destination-out. Tap the ground to walk there; Auto-walk follows a round that goes behind, under and inside.
(() => {
  const { Raster, bounds, makeHouse, houseParts, topoSort, ySort, figureSprites, overlap } = StudyShared.buildings;
  Kit.register('occlusion', { title: 'Walking behind, under and inside', fit: 'per-frame' }, host => {
    const W = 240, H = 172, GW = 15, GH = 13, OX = 112, OY = 50;
    const cv = Kit.canvas(host, W, H), g = cv.g;
    const S = (x, y, z = 0) => [OX + (x - y) * 8, OY + (x + y) * 4 - z * 8];
    const houses = [
      { h: makeHouse(5, 'Temperate', { w: 7, d: 4, front: 'S' }), x: 2, y: 2, f: 1 },
      { h: makeHouse(21, 'Temperate', { w: 4, d: 5, front: 'S' }), x: 10, y: 6, f: 1 },
    ];
    const TREES = [[5.5, 0.9], [13.6, 0.9], [12.6, 3.4], [0.8, 6.9], [8.6, 11.6], [3.3, 11.4]];
    const FENCE = { x0: 1, x1: 8, y: 9 }, WELL = [5, 11];

    // ---- the ground: grass, shadows, and the houses' floors, painted once ----
    const G = new Raster(W, H, OX, OY);
    G.col.fill(17); G.flat.fill(1); G.isFlat = true;
    for (let gy = -12; gy < GH + 12; gy++) for (let gx = -12; gx < GW + 12; gx++) {
      const v = Kit.hash2(gx, gy, 77);
      if (v < 0.09) G.line([gx + v * 5, gy + 0.3, 0], [gx + v * 5 + 0.22, gy + 0.08, 0], v < 0.045 ? 18 : 16, -1e6);
    }
    for (const H0 of houses) G.poly([[H0.x + 1.1, H0.y - 0.6, 0], [H0.x + H0.h.W + 1.1, H0.y - 0.6, 0], [H0.x + H0.h.W + 1.1, H0.y + H0.h.D - 0.6, 0], [H0.x + 1.1, H0.y + H0.h.D - 0.6, 0]], 16, -1e5);
    for (const [tx, ty] of TREES) G.poly([[tx + 0.2, ty - 0.9, 0], [tx + 1.3, ty - 0.9, 0], [tx + 1.3, ty + 0.3, 0], [tx + 0.2, ty + 0.3, 0]], 16, -1e5);
    houses.forEach(H0 => { H0.parts = houseParts(H0.h, { ox: H0.x, oy: H0.y }); for (const p of H0.parts) if (p.group === 'floor') p.paint(G); });
    const ground = G.canvas();

    // ---- the things that stand up: one sprite each, with its box. Parts that fade get five Bayer levels. ----
    const items = [];
    const union = (a, b) => ({ x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1), z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) });
    function addSprite(box, sizeBox, paint, fade = -1, keepId = null, same) {
      const b = bounds(sizeBox, 3), R = new Raster(b.w, b.h, -b.x, -b.y);
      paint(R); R.outline(0, same);
      const keep = keepId === null ? null : i => R.obj[i] === keepId, gx = OX + b.x, gy = OY + b.y;
      const cvs = fade >= 0 ? [null, 1, 2, 3, 4].map(l => l && R.canvas(keep, l, gx, gy)) : [null, null, null, null, R.canvas(keep)];
      items.push({ box, rect: { x: gx, y: gy, w: b.w, h: b.h }, cvs, fade });
    }
    houses.forEach((H0, hi) => {
      for (const p of H0.parts) {
        if (p.group === 'floor') continue;
        const fades = p.group === 'upper' || p.group === 'roof' ? hi : -1;
        if (p.sib) { // paint both pieces of a cut wall so the seam isn't outlined, keep this piece's pixels
          const s = p.sib, same = (a, c) => a === c || (a === p.id && c === s.id) || (a === s.id && c === p.id);
          addSprite(p.box, union(p.box, s.box), R => { R.id = p.id; p.paint(R); R.id = s.id; s.paint(R); }, fades, p.id, same);
        } else addSprite(p.box, p.size || p.box, R => { R.id = p.id; p.paint(R); }, fades);
      }
    });
    for (const [tx, ty] of TREES) {
      const box = { x0: tx - 0.7, x1: tx + 0.7, y0: ty - 0.7, y1: ty + 0.7, z0: 0, z1: 4.4 }; // the crown's footprint, not the trunk's
      addSprite(box, { x0: tx - 1.4, x1: tx + 1.4, y0: ty - 1.4, y1: ty + 1.4, z0: 0, z1: 4.3 }, R => paintTree(R, tx, ty));
    }
    {
      const f = FENCE, box = { x0: f.x0 - 0.13, x1: f.x1 + 0.13, y0: f.y - 0.13, y1: f.y + 0.13, z0: 0, z1: 1.0 };
      addSprite(box, box, R => {
        for (let x = f.x0; x <= f.x1; x++) R.box({ x0: x - 0.13, x1: x + 0.13, y0: f.y - 0.13, y1: f.y + 0.13, z0: 0, z1: 1.0 }, [29, 28, 27]);
        for (const z of [0.28, 0.62]) R.box({ x0: f.x0, x1: f.x1, y0: f.y - 0.06, y1: f.y + 0.06, z0: z, z1: z + 0.22 }, [29, 29, 28]);
      });
      const [wx, wy] = WELL, wb = { x0: wx + 0.15, x1: wx + 0.85, y0: wy + 0.15, y1: wy + 0.85, z0: 0, z1: 0.7 };
      addSprite(wb, wb, R => { R.box(wb, [6, 5, 4]); R.top(0.7, wx + 0.3, wx + 0.7, wy + 0.3, wy + 0.7, 21, 0.02); R.line([wx + 0.15, wy + 0.85, 0.35], [wx + 0.85, wy + 0.85, 0.35], 4, 0.02); });
    }
    function paintTree(R, tx, ty) {
      const [bx, by] = R.P(tx, ty, 0), [cx, cy] = R.P(tx, ty, 2.75);
      const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < R.w && y < R.h) { const i = y * R.w + x; R.col[i] = c; R.obj[i] = 1; R.dep[i] = 0; } };
      for (let y = Math.round(cy) + 3; y <= by; y++) { set(bx - 1, y, 27); set(bx, y, 26); }
      const lumps = [[0, -2, 7], [-5, 2, 5.5], [5, 2, 5.5], [0, 4, 6]];
      for (let y = -12; y <= 12; y++) for (let x = -12; x <= 12; x++) {
        let hit = null; for (const l of lumps) if ((x - l[0]) ** 2 + ((y - l[1]) * 1.15) ** 2 <= l[2] * l[2]) hit = l;
        if (!hit) continue;
        const dx = (x - hit[0]) / hit[2], dy = (y - hit[1]) / hit[2], lit = -0.6 * dx - 0.7 * dy;
        set(cx + x, cy + y, lit > 0.45 ? 18 : lit > -0.25 ? 17 : 16);
      }
      for (const [x, y] of [[-3, -5], [2, -3], [-6, 1], [4, 3]]) set(cx + x, cy + y, 19);
    }

    // ---- where one can walk: cells, walls on cell edges, solid cells ----
    const wall = new Uint8Array(GW * GH), solid = new Uint8Array(GW * GH);
    const blockH = (x, y) => { if (x < 0 || x >= GW) return; if (y - 1 >= 0 && y - 1 < GH) wall[(y - 1) * GW + x] |= 4; if (y >= 0 && y < GH) wall[y * GW + x] |= 1; };
    const blockV = (x, y) => { if (y < 0 || y >= GH) return; if (x - 1 >= 0 && x - 1 < GW) wall[y * GW + x - 1] |= 2; if (x >= 0 && x < GW) wall[y * GW + x] |= 8; };
    for (const H0 of houses) {
      for (const e of H0.h.edges) if (e.kind !== 'door') (e.o === 'h' ? blockH : blockV)(H0.x + e.x, H0.y + e.y);
      for (const f of H0.h.furniture) if (f.type !== 'rug') for (const [x, y] of f.cells) solid[(H0.y + y) * GW + H0.x + x] = 1;
      const e = H0.h.edges.find(q => q.front);
      H0.out = e.o === 'h' ? [H0.x + e.x, H0.y + e.y] : [H0.x + e.x, H0.y + e.y];
      H0.in = e.o === 'h' ? [H0.x + e.x, H0.y + e.y - 1] : [H0.x + e.x - 1, H0.y + e.y];
    }
    for (const [tx, ty] of TREES) solid[Math.floor(ty) * GW + Math.floor(tx)] = 1;
    solid[WELL[1] * GW + WELL[0]] = 1;
    for (let x = FENCE.x0; x < FENCE.x1; x++) blockH(x, FENCE.y);
    const STEP = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];
    function bfs(sx, sy) {
      const prev = new Int32Array(GW * GH).fill(-2), q = [sy * GW + sx]; prev[q[0]] = -1;
      for (let k = 0; k < q.length; k++) {
        const c = q[k], x = c % GW, y = (c / GW) | 0;
        for (const [dx, dy, bit] of STEP) {
          const nx = x + dx, ny = y + dy, n = ny * GW + nx;
          if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || (wall[c] & bit) || solid[n] || prev[n] !== -2) continue;
          prev[n] = c; q.push(n);
        }
      }
      return prev;
    }
    const route = (sx, sy, tx, ty) => {
      const prev = bfs(sx, sy), out = []; let c = ty * GW + tx;
      if (prev[c] === -2) return null;
      while (c !== sy * GW + sx) { out.unshift([c % GW, (c / GW) | 0]); c = prev[c]; }
      return out;
    };
    // the deepest free cell of each house, for the round
    for (const H0 of houses) {
      const prev = bfs(...H0.in); let best = H0.in, bd = -1;
      for (let y = H0.y; y < H0.y + H0.h.D; y++) for (let x = H0.x; x < H0.x + H0.h.W; x++) {
        if (prev[y * GW + x] === -2) continue;
        let d = 0, c = y * GW + x; while (prev[c] >= 0) { c = prev[c]; d++; }
        if (d > bd) { bd = d; best = [x, y]; }
      }
      H0.deep = best;
    }
    const [A, B] = houses;
    const ROUND = [[1, 1], [11, 1], [9, 7], B.out, B.deep, B.out, [7, 8], [1, 8], A.out, A.deep, A.out, [0, 4]];

    // ---- the walker ----
    const FIGS = figureSprites();
    const me = { x: 1.5, y: 1.5, path: [], face: 'r', moving: false, wp: 1, target: null };
    const fig = { box: null, rect: { x: 0, y: 0, w: 7, h: 14 }, fig: true };
    let mode = 'Boxes', auto = true, xray = true, sortMs = 0, drawMs = 0, tick = 0, inside = -1;
    const mA = document.createElement('canvas'), mB = document.createElement('canvas');
    mA.width = mB.width = 7; mA.height = mB.height = 14;
    const gA = mA.getContext('2d'), gB = mB.getContext('2d');

    function step() {
      tick++;
      if (!me.path.length && auto) {
        const [tx, ty] = ROUND[me.wp % ROUND.length]; me.wp++;
        me.path = route(Math.floor(me.x), Math.floor(me.y), tx, ty) || []; me.target = [tx, ty];
      }
      me.moving = false;
      if (me.path.length) {
        const [cx, cy] = me.path[0], tx = cx + 0.5, ty = cy + 0.5, dx = tx - me.x, dy = ty - me.y, d = Math.hypot(dx, dy), v = 0.11;
        if (d <= v) { me.x = tx; me.y = ty; me.path.shift(); } else { me.x += dx / d * v; me.y += dy / d * v; }
        if (Math.abs(dx - dy) > 0.01) me.face = dx - dy > 0 ? 'r' : 'l';
        me.moving = true;
      }
      inside = houses.findIndex(H0 => me.x >= H0.x && me.x < H0.x + H0.h.W && me.y >= H0.y && me.y < H0.y + H0.h.D);
      houses.forEach((H0, i) => { const want = i === inside ? 0 : 1; H0.f += Math.sign(want - H0.f) * Math.min(0.2, Math.abs(want - H0.f)); });
    }
    function draw() {
      const tDraw = performance.now();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.drawImage(ground, 0, 0);
      const list = [];
      for (const it of items) { it.lvl = it.fade < 0 ? 4 : Math.round(houses[it.fade].f * 4); if (it.lvl) list.push(it); }
      const [sx, sy] = S(me.x, me.y);
      fig.box = { x0: me.x - 0.25, x1: me.x + 0.25, y0: me.y - 0.25, y1: me.y + 0.25, z0: 0, z1: 1.75 };
      fig.rect.x = Math.round(sx - 3); fig.rect.y = Math.round(sy - 13);
      list.push(fig);
      const t0 = performance.now();
      const order = mode === 'Boxes' ? topoSort(list) : ySort(list);
      sortMs = sortMs * 0.9 + (performance.now() - t0) * 0.1;
      const frame = FIGS[me.moving ? ((tick / 5) | 0) % 2 : 0];
      let at = -1;
      order.forEach((it, k) => {
        if (it.fig) {
          at = k;
          g.globalAlpha = 0.35; g.fillStyle = Kit.PAL[0]; g.fillRect(fig.rect.x + 1, Math.round(sy) - 1, 5, 2); g.globalAlpha = 1;
          g.drawImage(frame[me.face], fig.rect.x, fig.rect.y);
        } else g.drawImage(it.cvs[it.lvl], it.rect.x, it.rect.y);
      });
      // x-ray: the silhouette, kept only where something drawn after the figure covers it (two destination-out passes)
      const occ = order.slice(at + 1).filter(it => overlap(it.rect, fig.rect));
      if (xray && occ.length) {
        gA.globalCompositeOperation = 'source-over'; gA.clearRect(0, 0, 7, 14); gA.drawImage(frame['s' + me.face], 0, 0);
        gB.globalCompositeOperation = 'source-over'; gB.clearRect(0, 0, 7, 14); gB.fillStyle = '#000'; gB.fillRect(0, 0, 7, 14);
        gB.globalCompositeOperation = 'destination-out';
        for (const it of occ) gB.drawImage(it.cvs[it.lvl], it.rect.x - fig.rect.x, it.rect.y - fig.rect.y);
        gA.globalCompositeOperation = 'destination-out'; gA.drawImage(mB, 0, 0);
        g.drawImage(mA, fig.rect.x, fig.rect.y);
      }
      if (me.target && me.path.length) { const [tx, ty] = S(me.target[0] + 0.5, me.target[1] + 0.5); g.fillStyle = Kit.PAL[13]; g.fillRect(tx - 2, ty, 5, 1); g.fillRect(tx, ty - 1, 1, 3); }
      drawMs = drawMs * 0.9 + (performance.now() - tDraw) * 0.1;
      if (tick % 10 === 0) note.textContent = `${mode === 'Boxes' ? 'Box sort' : 'Naive sort'}: ${list.length} things, ${sortMs.toFixed(3)} ms to order, ${drawMs.toFixed(2)} ms to draw. ` +
        (inside >= 0 ? `Inside house ${'AB'[inside]}: its roof and upper walls fade; the other keeps its roof.` : 'Outside: every roof is on.');
    }
    cv.cv.addEventListener('pointerdown', e => {
      const [px, py] = cv.at(e), u = (px - OX) / 8, v = (py - OY) / 4;
      const tx = Math.floor((u + v) / 2), ty = Math.floor((v - u) / 2);
      if (tx < 0 || ty < 0 || tx >= GW || ty >= GH || solid[ty * GW + tx]) return;
      const p = route(Math.floor(me.x), Math.floor(me.y), tx, ty);
      if (!p) return;
      me.path = p; me.target = [tx, ty]; auto = false; autoBox.checked = false;
    });
    const b1 = Kit.bar(host);
    b1.tabs(['Naive', 'Boxes'], v => { mode = v; }, mode);
    const autoBox = b1.check('Auto-walk', auto, v => { auto = v; });
    b1.check('X-ray', xray, v => { xray = v; });
    const note = Kit.bar(host).note('');
    Kit.loop(host, step, draw, 30);
  });
})();
