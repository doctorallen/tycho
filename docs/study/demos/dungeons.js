// dungeons.js: Dungeons: BSP, caves, drunkard's walk, room templates. A study demo, using worlds-shared.js.
(() => {
  const { clamp, D4, D8, textPix, bfs, farthest, route } = StudyShared.worlds;
  // =====================================================================================
  // 3. dungeons: BSP rooms, cellular caves, a drunkard's walk, and Spelunky-style room templates.
  // =====================================================================================
  Kit.register('dungeons', { title: 'Dungeons: BSP, caves, drunkard\'s walk, room templates', fit: 'prebake' }, host => {
    const GW = 40, GH = 32, TS = 4;
    const cv = Kit.canvas(host, GW * TS, GH * TS);
    const MODES = ['BSP', 'Caves', 'Drunkard', 'Templates'];
    let seed = 7, mode = 'BSP', showRoute = true, showStruct = false;
    const at = (m, x, y) => x >= 0 && y >= 0 && x < GW && y < GH && m[y * GW + x] === 1;
    // entrance and exit: the two ends of the longest walk (find the farthest cell twice)
    function ends(m, from) {
      const a = farthest(bfs(GW, GH, m, [from]));
      const d = bfs(GW, GH, m, [a]);
      return { start: a, end: farthest(d), dist: d };
    }

    function genBSP(r) {
      const m = new Uint8Array(GW * GH), leaves = [], rooms = [];
      const carve = (x, y, w, h) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) m[j * GW + i] = 1; };
      const inRoom = rm => [rm.x + r.int(0, rm.w - 1), rm.y + r.int(0, rm.h - 1)];
      function corridor(a, b) {
        const [x1, y1] = inRoom(a), [x2, y2] = inRoom(b);
        const h = (xa, xb, y) => { for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) m[y * GW + x] = 1; };
        const v = (ya, yb, x) => { for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++) m[y * GW + x] = 1; };
        if (r.chance(0.5)) { h(x1, x2, y1); v(y1, y2, x2); } else { v(y1, y2, x1); h(x1, x2, y2); }
      }
      function split(x, y, w, h, depth) {
        const MIN = 8, canV = w >= MIN * 2, canH = h >= MIN * 2;
        if ((!canV && !canH) || depth > 4 || (depth > 2 && r.chance(0.15))) {
          leaves.push({ x, y, w, h });
          const rw = r.int(Math.max(3, (w * 0.5) | 0), w - 2), rh = r.int(Math.max(3, (h * 0.5) | 0), h - 2);
          const room = { x: x + r.int(1, w - rw - 1), y: y + r.int(1, h - rh - 1), w: rw, h: rh };
          carve(room.x, room.y, room.w, room.h); rooms.push(room);
          return room;
        }
        const vert = canV && (!canH || r.chance(w > h ? 0.8 : 0.2));
        const c = vert ? r.int(MIN, w - MIN) : r.int(MIN, h - MIN);
        const a = vert ? split(x, y, c, h, depth + 1) : split(x, y, w, c, depth + 1);
        const b = vert ? split(x + c, y, w - c, h, depth + 1) : split(x, y + c, w, h - c, depth + 1);
        corridor(a, b); // siblings always join, so the whole tree is connected
        return r.chance(0.5) ? a : b;
      }
      split(0, 0, GW, GH, 0);
      const c0 = rooms[0], s = (c0.y + (c0.h >> 1)) * GW + c0.x + (c0.w >> 1);
      const d = bfs(GW, GH, m, [s]);
      let end = s, best = -1;
      for (const rm of rooms) { const i = (rm.y + (rm.h >> 1)) * GW + rm.x + (rm.w >> 1); if (d[i] > best) { best = d[i]; end = i; } }
      return { m, start: s, end, dist: d, leaves };
    }

    function genCaves(r) {
      let m = new Uint8Array(GW * GH);
      for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) m[y * GW + x] = r.chance(0.45) ? 0 : 1;
      // 4-5 rule: a wall stays with 4+ wall neighbors, a floor becomes wall with 5+
      for (let it = 0; it < 4; it++) {
        const n = new Uint8Array(GW * GH);
        for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
          let walls = 0;
          for (const [dx, dy] of D8) if (!at(m, x + dx, y + dy)) walls++;
          const wall = m[y * GW + x] ? walls >= 5 : walls >= 4;
          n[y * GW + x] = wall ? 0 : 1;
        }
        m = n;
      }
      // keep only the largest connected region; remember the rest to show what the flood fill removed
      const label = new Int32Array(GW * GH).fill(-1), sizes = [];
      for (let i = 0; i < GW * GH; i++) {
        if (!m[i] || label[i] >= 0) continue;
        const d = bfs(GW, GH, m, [i]);
        let n = 0;
        for (let j = 0; j < GW * GH; j++) if (d[j] >= 0) { label[j] = sizes.length; n++; }
        sizes.push(n);
      }
      const big = sizes.indexOf(Math.max(...sizes));
      const culled = new Uint8Array(GW * GH);
      let any = -1;
      for (let i = 0; i < GW * GH; i++) if (m[i]) { if (label[i] !== big) { m[i] = 0; culled[i] = 1; } else any = i; }
      return Object.assign({ m, culled }, ends(m, any));
    }

    function genDrunk(r) {
      const m = new Uint8Array(GW * GH);
      let x = GW >> 1, y = GH >> 1, floor = 0;
      const start = y * GW + x, target = (GW * GH * 0.36) | 0;
      for (let s = 0; s < 40000 && floor < target; s++) {
        if (!m[y * GW + x]) { m[y * GW + x] = 1; floor++; }
        const [dx, dy] = r.pick(D4);
        x = clamp(x + dx, 1, GW - 2); y = clamp(y + dy, 1, GH - 2);
      }
      const d = bfs(GW, GH, m, [start]);
      return { m, start, end: farthest(d), dist: d };
    }

    // Spelunky: a 4x4 grid of 10x8 rooms. A path drops from the top row to the bottom; each room on it gets a template
    // with the openings it needs (1 left-right, 2 also a hole in the floor, 3 also open above, 4 open above and below).
    const TPL = {
      0: [['0000000000', '0002200000', '0000000220', '0000000000', '0220000000', '0000002200', '1110000000', '1111111111'],
        ['1111111111', '1100000011', '1000000001', '1022002201', '1000000001', '1100000011', '1111111111', '1111111111'],
        ['1111111111', '1111111111', '1110000111', '1100000011', '1000220001', '1100000011', '1111111111', '1111111111']],
      1: [['0000000000', '0000000000', '0002222000', '0000000000', '0000000000', '0000000000', '1100000011', '1111111111'],
        ['0000000000', '0000000000', '0000000000', '0000110000', '0001111000', '2000000002', '1100000011', '1112222111'],
        ['0000000000', '0000000000', '0000000000', '0220000000', '0000000220', '0000000000', '0000000000', '1111111111']],
      2: [['0000000000', '0000000000', '0002222000', '0000000000', '0000000000', '1100000011', '1110000111', '1110000111'],
        ['0000000000', '0000000000', '0000000000', '0220000220', '0000000000', '2000000002', '1110000111', '1110000111']],
      3: [['0000000000', '0000000000', '0000000000', '0000000000', '0011000110', '0000000000', '1000000001', '1111111111'],
        ['0000000000', '0000000000', '0000000000', '2000000002', '1100000011', '1100220011', '1110000111', '1111111111']],
      4: [['0000000000', '0000000000', '0000000000', '0110000110', '0000000000', '1000000001', '1110000111', '1110000111'],
        ['0000000000', '0000000000', '2200000022', '0000000000', '0220000220', '0000000000', '1110000111', '1110000111']],
    };
    function genRooms(r) {
      const RW = 10, RH = 8, types = new Int8Array(16), order = [];
      let col = r.int(0, 3), row = 0, dir = r.chance(0.5) ? -1 : 1;
      types[col] = 1; order.push(col);
      for (let guard = 0; guard < 64; guard++) {
        const nc = col + dir;
        if (nc < 0 || nc > 3 || r.chance(0.3)) { // go down a row (or finish at the bottom)
          if (row === 3) break;
          types[row * 4 + col] = types[row * 4 + col] === 3 ? 4 : 2;
          row++; types[row * 4 + col] = 3; order.push(row * 4 + col);
          dir = r.chance(0.5) ? -1 : 1;
        } else { col = nc; types[row * 4 + col] = 1; order.push(row * 4 + col); }
      }
      const m = new Uint8Array(GW * GH); // 1 = solid here
      const onPath = new Uint8Array(16);
      for (const k of order) onPath[k] = 1;
      for (let k = 0; k < 16; k++) {
        const t = onPath[k] ? types[k] : 0;
        const tpl = r.pick(TPL[t]), flip = r.chance(0.5);
        const ox = (k % 4) * RW, oy = ((k / 4) | 0) * RH;
        for (let j = 0; j < RH; j++) for (let i = 0; i < RW; i++) {
          const ch = tpl[j][flip ? RW - 1 - i : i];
          m[(oy + j) * GW + ox + i] = ch === '1' || (ch === '2' && r.chance(0.5)) ? 1 : 0;
        }
      }
      for (let x = 0; x < GW; x++) { m[x] = 2; m[(GH - 1) * GW + x] = 2; }
      for (let y = 0; y < GH; y++) { m[y * GW] = 2; m[y * GW + GW - 1] = 2; }
      // a door stands on a floor inside the first and last rooms
      const door = k => {
        const ox = (k % 4) * RW, oy = ((k / 4) | 0) * RH;
        const xs = [4, 5, 3, 6, 2, 7, 1, 8];
        for (let j = RH - 1; j >= 1; j--) for (const i of xs) {
          const x = ox + i, y = oy + j;
          if (!m[y * GW + x] && !m[(y - 1) * GW + x] && m[(y + 1) * GW + x]) return y * GW + x;
        }
        return (oy + RH - 2) * GW + ox + 4;
      };
      return { m, side: true, start: door(order[0]), end: door(order[order.length - 1]), order, types, onPath };
    }

    const THEME = {
      BSP: { floor: 3, speck: 2, shade: 2, top: 1, rim: 4, face: 5, faceDark: 4, seam: 4, joint: 2 },
      Caves: { floor: 27, speck: 26, shade: 26, top: 14, rim: 16, face: 15, faceDark: 14, seam: 14, joint: -1 },
      Drunkard: { floor: 3, speck: 2, shade: 2, top: 20, rim: 22, face: 21, faceDark: 20, seam: 20, joint: -1 },
    };
    function renderTop(L, th) {
      const pix = new Kit.Pix(GW * TS, GH * TS).fill(0), m = L.m;
      const fl = (x, y) => at(m, x, y);
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        const ox = x * TS, oy = y * TS;
        if (fl(x, y)) {
          pix.rect(ox, oy, TS, TS, th.floor);
          if (th.joint >= 0) pix.set(ox, oy, th.joint);
          if (Kit.hash2(x, y, seed) < 0.12) pix.set(ox + 1 + ((x * 7 + y) % 2), oy + 2, th.speck);
          if (!fl(x, y - 1)) pix.rect(ox, oy, TS, 1, th.shade); // the wall above casts a short shadow
          continue;
        }
        let near = false;
        for (const [dx, dy] of D8) if (fl(x + dx, y + dy)) { near = true; break; }
        if (!near) continue; // solid rock far from any floor stays ink
        pix.rect(ox, oy, TS, TS, th.top);
        // a light rim where the wall top meets open floor
        if (fl(x - 1, y)) pix.rect(ox, oy, 1, TS, th.rim);
        if (fl(x + 1, y)) pix.rect(ox + TS - 1, oy, 1, TS, th.rim);
        if (fl(x, y - 1)) pix.rect(ox, oy, TS, 1, th.rim);
        if (fl(x - 1, y - 1)) pix.set(ox, oy, th.rim);
        if (fl(x + 1, y - 1)) pix.set(ox + TS - 1, oy, th.rim);
        if (fl(x - 1, y + 1)) pix.set(ox, oy + TS - 1, th.rim);
        if (fl(x + 1, y + 1)) pix.set(ox + TS - 1, oy + TS - 1, th.rim);
        if (fl(x, y + 1)) { // the wall's face, seen from the south in 3/4 view
          pix.rect(ox, oy, TS, 1, th.rim);
          pix.rect(ox, oy + 1, TS, 2, th.face);
          pix.rect(ox, oy + 3, TS, 1, th.faceDark);
          pix.set(ox + ((x + y) % 2 ? 1 : 3), oy + 1, th.seam);
        }
      }
      if (showStruct && L.leaves) {
        for (const lf of L.leaves) {
          const x0 = lf.x * TS, y0 = lf.y * TS, x1 = (lf.x + lf.w) * TS - 1, y1 = (lf.y + lf.h) * TS - 1;
          for (let x = x0; x <= x1; x += 2) { pix.set(x, y0, 31); pix.set(x, y1, 31); }
          for (let y = y0; y <= y1; y += 2) { pix.set(x0, y, 31); pix.set(x1, y, 31); }
        }
      }
      if (showStruct && L.culled) {
        for (let i = 0; i < GW * GH; i++) if (L.culled[i]) {
          const ox = (i % GW) * TS, oy = ((i / GW) | 0) * TS;
          pix.rect(ox, oy, TS, TS, 9); pix.rect(ox + 1, oy + 1, 2, 2, 10);
        }
      }
      if (showStruct && mode === 'Drunkard') {
        const ox = (L.start % GW) * TS, oy = ((L.start / GW) | 0) * TS;
        for (let k = -6; k <= 9; k += 2) { pix.set(ox + k, oy - 3, 31); pix.set(ox + k, oy + 6, 31); pix.set(ox - 3, oy + k, 31); pix.set(ox + 6, oy + k, 31); }
      }
      return pix;
    }
    function renderSide(L) {
      const pix = new Kit.Pix(GW * TS, GH * TS), m = L.m;
      for (let k = 0; k < 16; k++) pix.rect((k % 4) * 40, ((k / 4) | 0) * 32, 40, 32, L.onPath[k] ? 2 : 1);
      const solid = (x, y) => x < 0 || y < 0 || x >= GW || y >= GH || m[y * GW + x] > 0;
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        const v = m[y * GW + x];
        if (!v) continue;
        const ox = x * TS, oy = y * TS;
        const [base, lite, dark, top] = v === 2 ? [3, 4, 2, 5] : [27, 28, 26, 17];
        pix.rect(ox, oy, TS, TS, base);
        if (!solid(x - 1, y)) pix.rect(ox, oy, 1, TS, lite);
        if (!solid(x + 1, y)) pix.rect(ox + TS - 1, oy, 1, TS, dark);
        if (!solid(x, y + 1)) pix.rect(ox, oy + TS - 1, TS, 1, dark);
        if (!solid(x, y - 1)) { pix.rect(ox, oy, TS, 1, top); if (v === 1) pix.set(ox + ((x * 3 + y) % 3), oy + 1, 16); }
        else if (v === 1 && Kit.hash2(x, y, seed) < 0.3) pix.set(ox + 1 + (x % 2), oy + 2, 26);
      }
      if (showStruct) {
        for (let x = 0; x < GW * TS; x += 2) for (let k = 1; k < 4; k++) pix.set(x, k * 32, 4);
        for (let y = 0; y < GH * TS; y += 2) for (let k = 1; k < 4; k++) pix.set(k * 40, y, 4);
        for (let k = 0; k < 16; k++) if (L.onPath[k]) textPix(pix, String(L.types[k]), (k % 4) * 40 + 2, ((k / 4) | 0) * 32 + 2, 6, 0);
      }
      return pix;
    }
    function door(pix, i, frame) { // side view: a 4x6 doorway standing on the floor
      const ox = (i % GW) * TS, oy = ((i / GW) | 0) * TS + TS - 6;
      pix.rect(ox, oy, 4, 6, frame); pix.rect(ox + 1, oy + 1, 2, 5, 0);
      pix.set(ox, oy, -1); pix.set(ox + 3, oy, -1);
      pix.set(ox, oy, pix.get(ox - 1, oy) < 0 ? 1 : pix.get(ox - 1, oy));
    }
    function stairs(pix, i, a, b) { // top-down: a 6x6 stair marker with an ink outline
      const ox = (i % GW) * TS - 1, oy = ((i / GW) | 0) * TS - 1;
      pix.rect(ox, oy, 6, 6, 0);
      for (let j = 1; j < 5; j++) pix.rect(ox + 1, oy + j, 4, 1, j % 2 ? a : b);
    }

    const note = { BSP: 'Split the map in two again and again; one room per leaf; join sibling rooms with L-shaped corridors.',
      Caves: '45% walls, four passes of the 4-5 rule, then a flood fill keeps the largest cave (Structure shows what it cut).',
      Drunkard: 'One walker steps at random from the center until 36% of the map is floor. Always connected, never planned.',
      Templates: 'Spelunky: a path drops through a 4x4 grid of rooms; each room picks a template with the openings it needs (side view).' };
    let noteEl;
    function draw() {
      const r = Kit.rng(seed * 31 + MODES.indexOf(mode));
      const L = mode === 'BSP' ? genBSP(r) : mode === 'Caves' ? genCaves(r) : mode === 'Drunkard' ? genDrunk(r) : genRooms(r);
      let pix;
      if (L.side) {
        pix = renderSide(L);
        if (showRoute) { // a dotted line through the centers of the rooms on the path
          for (let k = 1; k < L.order.length; k++) {
            const a = L.order[k - 1], b = L.order[k];
            const ax = (a % 4) * 40 + 20, ay = ((a / 4) | 0) * 32 + 16, bx = (b % 4) * 40 + 20, by = ((b / 4) | 0) * 32 + 16;
            const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
            for (let s = 0; s <= n; s += 3) { const x = Math.round(ax + (bx - ax) * s / n), y = Math.round(ay + (by - ay) * s / n); pix.rect(x, y, 2, 2, 13); }
          }
        }
        door(pix, L.start, 18); door(pix, L.end, 12);
      } else {
        pix = renderTop(L, THEME[mode]);
        if (showRoute) {
          const path = route(GW, L.dist, L.end);
          path.forEach((i, k) => { if (k % 2 === 0) pix.rect((i % GW) * TS + 1, ((i / GW) | 0) * TS + 1, 2, 2, 13); });
        }
        stairs(pix, L.start, 18, 16); stairs(pix, L.end, 12, 10);
      }
      cv.put(pix);
      if (noteEl) noteEl.textContent = note[mode];
    }
    const bar = Kit.bar(host);
    bar.tabs(MODES, v => { mode = v; draw(); }, mode);
    bar.seed(seed, s => { seed = s; draw(); });
    bar.check('Route', showRoute, v => { showRoute = v; draw(); });
    bar.check('Structure', showStruct, v => { showStruct = v; draw(); });
    noteEl = Kit.bar(host).note('');
    draw();
  });
})();
