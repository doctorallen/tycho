// herds.js: Herds, flocks and schools. A study demo, using animals-shared.js.
// A small meadow with a pond and a wood, and about 300 animals on one spatial hash: a grazing herd, a flock
// of starlings, a school in the pond, bats at night and a few wolves. Boids (Reynolds 1987) move them; the
// clock decides who is about. By day the herd grazes and the flock wheels; at dusk the herd follows a flow
// field to the water and drinks, the flock gathers over the wood and roosts; at night the herd beds down at
// the wood's edge, bats swarm over the pond and the wolves hunt. Tap to drop a wolf or food. Night is a
// reprint of the same palette (each ink mapped to a darker one), so light only selects inks.
(() => {
  const { outline, clamp } = StudyShared.animals;
  Kit.register('herds', { title: 'Herds, flocks and schools', fit: 'per-frame' }, host => {
    const W = 200, H = 128, CS = 4, GW = W / CS, GH = H / CS;
    const c = Kit.canvas(host, W, H);
    c.cv.style.touchAction = 'pan-y';
    let seed = 12, hour = 16.5, clock = true, mode = 'Wolf', showField = false;
    let land, water, treeAt, trees, bg, fieldWater, fieldBed, den, pondC;
    let deer, birds, fish, bats, wolves, food, flies;
    const hb = Kit.hash2;

    // ---- terrain: meadow, a pond, a wood, a den ----
    function makeLand() {
      const r = Kit.rng(seed);
      water = new Uint8Array(W * H); treeAt = new Uint8Array(GW * GH); trees = [];
      pondC = { x: r.range(70, 110), y: r.range(52, 78) };
      const prx = r.range(24, 32), pry = r.range(15, 20);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = (x - pondC.x) / prx, dy = (y - pondC.y) / pry;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.28 * Kit.noise2(x / 14, y / 14, seed);
        if (d < 1) water[y * W + x] = 1;
      }
      // the wood: Poisson-ish trees in a band along one side
      const side = r.chance(0.5) ? 1 : -1;
      const woodX = side > 0 ? W - 46 : 6;
      for (let k = 0; k < 400 && trees.length < 26; k++) {
        const x = woodX + r.range(0, 40), y = r.range(6, H - 4);
        if (water[Math.round(y) * W + Math.round(x)]) continue;
        if (trees.some(t => (t.x - x) ** 2 + (t.y - y) ** 2 < 100)) continue;
        trees.push({ x, y, r: r.int(4, 6), v: r.int(0, 2) });
      }
      for (let k = 0; k < 4; k++) { // a few lone trees on the meadow
        const x = r.range(10, W - 10), y = r.range(10, H - 6);
        if (water[Math.round(y) * W + Math.round(x)] || Math.hypot(x - pondC.x, y - pondC.y) < 40) continue;
        trees.push({ x, y, r: r.int(4, 5), v: r.int(0, 2) });
      }
      for (const t of trees) treeAt[Math.floor(t.y / CS) * GW + Math.floor(t.x / CS)] = 1;
      den = { x: side > 0 ? 18 : W - 18, y: r.chance(0.5) ? 16 : H - 16 };
      // flow fields: Dijkstra over 4-pixel cells to the shore, and to the wood's edge (where the herd beds down)
      const cellWater = i => { const cx = (i % GW) * CS + 2, cy = Math.floor(i / GW) * CS + 2; return water[cy * W + cx]; };
      const shore = [], edge = [];
      for (let i = 0; i < GW * GH; i++) {
        if (cellWater(i) || treeAt[i]) continue;
        const gx = i % GW, gy = Math.floor(i / GW);
        let nearW = false, nearT = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = gx + dx, y = gy + dy; if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
          if (cellWater(y * GW + x)) nearW = true;
        }
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const x = gx + dx, y = gy + dy; if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
          if (treeAt[y * GW + x]) nearT++;
        }
        if (nearW) shore.push(i);
        if (nearT >= 2 && Math.abs(gx * CS - (woodX + 20)) < 30) edge.push(i);
      }
      const pass = i => !cellWater(i) && !treeAt[i];
      fieldWater = flowField(shore, pass); fieldBed = flowField(edge, pass);
      bake();
    }
    // a flow field: distances by Dijkstra from the goal cells, then each cell's step toward its lowest neighbor
    function flowField(goals, pass) {
      const dist = new Float32Array(GW * GH).fill(1e9), dir = new Int8Array(GW * GH * 2);
      const heap = [];
      const push = (i, d) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, rr = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (rr < heap.length && heap[rr][0] < heap[m][0]) m = rr; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
      for (const g of goals) { dist[g] = 0; push(g, 0); }
      while (heap.length) {
        const [d, i] = pop(); if (d > dist[i]) continue;
        const x = i % GW, y = Math.floor(i / GW);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
          const j = ny * GW + nx; if (!pass(j)) continue;
          const nd = d + (dx && dy ? 1.414 : 1);
          if (nd < dist[j]) { dist[j] = nd; push(j, nd); }
        }
      }
      for (let i = 0; i < GW * GH; i++) {
        const x = i % GW, y = Math.floor(i / GW); let best = dist[i], bx = 0, by = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
          if (dist[ny * GW + nx] < best) { best = dist[ny * GW + nx]; bx = dx; by = dy; }
        }
        dir[i * 2] = bx; dir[i * 2 + 1] = by;
      }
      return { dist, dir };
    }
    const fieldAt = (f, x, y) => { const i = clamp(Math.floor(y / CS), 0, GH - 1) * GW + clamp(Math.floor(x / CS), 0, GW - 1); return [f.dir[i * 2], f.dir[i * 2 + 1], f.dist[i]]; };

    // the ground, painted once: grass, a muddy shore and reeds, water, the den's rocks
    let treeSprites;
    function bake() {
      bg = new Kit.Pix(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (water[i]) {
          const deep = !water[i - 3] || !water[i + 3] || !water[i - 3 * W] || !water[i + 3 * W] ? 22 : 21;
          bg.d[i] = hb(x >> 2, y, seed + 9) < 0.04 ? 23 : deep;
          continue;
        }
        const nearW = water[i - 1] || water[i + 1] || water[i - W] || water[i + W] || water[i - 2 * W];
        if (nearW) { bg.d[i] = 28; continue; }
        const n = Kit.fbm(x / 30, y / 30, seed + 4, 3);
        bg.d[i] = n > 0.15 ? 17 : 16;
        const h = hb(x, y, seed);
        if (h < 0.025 && y > 0) { bg.d[i] = n > 0.15 ? 18 : 17; bg.d[i - W] = n > 0.15 ? 18 : 17; }
      }
      // reeds on part of the shore, flowers on the meadow
      for (let y = 2; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (bg.d[i] === 28 && hb(x, y, seed + 3) < 0.22 && Kit.noise2(x / 12, y / 12, seed + 5) > 0.1) { bg.set(x, y - 1, 15); bg.set(x, y - 2, 18); }
        else if (!water[i] && bg.d[i] !== 28 && hb(x, y, seed + 7) < 0.0015) bg.set(x, y, 12);
      }
      // den: a heap of rocks with a dark mouth
      for (const [dx, dy, rr] of [[-4, 0, 3], [3, -1, 4], [0, -4, 3], [6, 2, 2]]) for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) {
        if (x * x + y * y > rr * rr) continue;
        bg.set(den.x + dx + x, den.y + dy + y, y < -rr / 2 ? 5 : y < rr / 3 ? 4 : 3);
      }
      for (let x = -1; x <= 2; x++) { bg.set(den.x + x, den.y + 1, 0); bg.set(den.x + x, den.y + 2, 0); }
      treeSprites = [4, 5, 6].map(r => [0, 1, 2].map(v => treeSprite(r, v)));
    }
    function treeSprite(r, v) {
      const p = new Kit.Pix(r * 2 + 3, r * 2 + 6), cx = r + 1, cy = r + 1;
      for (let y = 0; y <= 4; y++) { p.set(cx, cy + r - 1 + y, 27); p.set(cx + 1, cy + r - 1 + y, 26); }
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        const d = (x * x) / (r * r) + (y * y) / (r * r * 0.85);
        if (d > 1 + (hb(x, y, v + 40) - 0.5) * 0.4) continue;
        const lit = (x + y) < -r * 0.4 ? 17 : (x + y) > r * 0.6 ? 14 : 15;
        p.set(cx + x, cy + y, hb(x, y, v + 50) < 0.12 ? (lit === 17 ? 18 : 16) : lit);
      }
      return outline(p);
    }

    // ---- animals ----
    const mk = (n, f) => Array.from({ length: n }, (_, i) => f(i));
    function populate() {
      const r = Kit.rng(seed * 31 + 1);
      const hx = W - pondC.x, hy = r.range(30, H - 30);
      deer = mk(26, () => ({ x: hx + r.range(-18, 18), y: hy + r.range(-12, 12), vx: 0, vy: 0, st: 'graze', t: r.range(0, 3), drunk: false, face: 1, step: r.range(0, 1), fear: 0 }));
      birds = mk(170, () => ({ x: r.range(20, W - 20), y: r.range(10, 40), vx: r.range(-30, 30), vy: r.range(-10, 10), perch: null }));
      for (const b of birds) { const t = r.pick(trees); b.roost = { x: t.x + r.range(-t.r + 1, t.r - 1), y: t.y + r.range(-t.r + 1, 0) }; }
      fish = [];
      while (fish.length < 70) { const x = pondC.x + r.range(-20, 20), y = pondC.y + r.range(-12, 12); if (water[Math.round(y) * W + Math.round(x)]) fish.push({ x, y, vx: r.range(-8, 8), vy: r.range(-4, 4) }); }
      bats = mk(40, () => ({ x: pondC.x + r.range(-20, 20), y: pondC.y + r.range(-30, -5), vx: r.range(-20, 20), vy: r.range(-20, 20) }));
      wolves = mk(3, k => ({ x: den.x + k * 4 - 4, y: den.y + 5, vx: 0, vy: 0, st: 'rest', t: 0, face: 1, forced: 0, target: -1, step: 0 }));
      food = [];
      flies = mk(14, () => { const t = r.pick(trees); return { x: t.x + r.range(-12, 12), y: t.y + r.range(-6, 10), p: r.range(0, 100) }; });
    }

    // a uniform grid (spatial hash): heads per cell and a next link per agent, rebuilt every step
    const GC = 8, HW = Math.ceil(W / GC) + 2, HH = Math.ceil(H / GC) + 2;
    function makeGrid(n) { return { head: new Int32Array(HW * HH), next: new Int32Array(n) }; }
    const cellOf = (x, y) => (clamp(Math.floor(y / GC) + 1, 0, HH - 1)) * HW + clamp(Math.floor(x / GC) + 1, 0, HW - 1);
    function buildGrid(gr, list) { gr.head.fill(-1); for (let i = 0; i < list.length; i++) { const k = cellOf(list[i].x, list[i].y); gr.next[i] = gr.head[k]; gr.head[k] = i; } }
    function near(gr, list, a, rad, max, fn) {
      const cx0 = Math.floor((a.x - rad) / GC) + 1, cx1 = Math.floor((a.x + rad) / GC) + 1, cy0 = Math.floor((a.y - rad) / GC) + 1, cy1 = Math.floor((a.y + rad) / GC) + 1;
      let n = 0;
      for (let cy = Math.max(0, cy0); cy <= Math.min(HH - 1, cy1); cy++) for (let cx = Math.max(0, cx0); cx <= Math.min(HW - 1, cx1); cx++) {
        for (let j = gr.head[cy * HW + cx]; j >= 0; j = gr.next[j]) {
          const b = list[j]; if (b === a) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
          if (d2 < rad * rad) { fn(b, dx, dy, d2); if (++n >= max) return n; }
        }
      }
      return n;
    }
    let gDeer, gBirds, gFish, gBats;

    // boids: separation, alignment, cohesion within a radius, at most `max` neighbors (about Ballerini's seven)
    function flock(gr, list, a, o) {
      let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, n = 0;
      near(gr, list, a, o.r, o.max || 7, (b, dx, dy, d2) => {
        if (d2 < o.sep * o.sep) { const d = Math.sqrt(d2) || 0.1; sx -= dx / d * (o.sep - d); sy -= dy / d * (o.sep - d); }
        ax += b.vx; ay += b.vy; cx += dx; cy += dy; n++;
      });
      let fx = sx * o.ws, fy = sy * o.ws;
      if (n) { fx += (ax / n - a.vx) * o.wa + (cx / n) * o.wc; fy += (ay / n - a.vy) * o.wa + (cy / n) * o.wc; }
      return [fx, fy, n];
    }
    const limit = (a, max) => { const s = Math.hypot(a.vx, a.vy); if (s > max) { a.vx *= max / s; a.vy *= max / s; } return s; };
    const isWater = (x, y) => { const xi = Math.round(x), yi = Math.round(y); return xi >= 0 && yi >= 0 && xi < W && yi < H && water[yi * W + xi] === 1; };
    const phase = () => hour >= 6 && hour < 17.5 ? 'day' : hour >= 17.5 && hour < 20 ? 'dusk' : hour >= 5 && hour < 6 ? 'dawn' : 'night';

    let stepMs = 0, stepAcc = 0, stepN = 0;
    function step(dt, tick) {
      const t0 = performance.now();
      if (clock) { hour = (hour + dt / 2.5) % 24; if (slider) { slider.value = hour.toFixed(2); out.textContent = clockText(); } }
      const ph = phase(), r = Kit.rng(seed * 977 + tick);
      if (ph === 'day' && hour > 11 && hour < 12) for (const d of deer) d.drunk = false;
      buildGrid(gDeer, deer); buildGrid(gBirds, birds); buildGrid(gFish, fish); buildGrid(gBats, bats);

      // wolves: rest at the den by day; prowl toward the herd at dusk and night; chase the nearest deer, then tire
      const herd = deer.reduce((s, d) => [s[0] + d.x / deer.length, s[1] + d.y / deer.length], [0, 0]);
      for (const w of wolves) {
        const active = w.forced > 0 || ph === 'night' || ph === 'dusk' || ph === 'dawn';
        w.forced = Math.max(0, w.forced - dt); w.t -= dt;
        let tx = w.x, ty = w.y, sp = 0;
        if (!active) { tx = den.x + (wolves.indexOf(w) - 1) * 5; ty = den.y + 6; sp = 14; if (Math.hypot(tx - w.x, ty - w.y) < 2) { w.st = 'rest'; sp = 0; } else w.st = 'walk'; }
        else if (w.st === 'tired') { sp = 0; if (w.t <= 0) w.st = 'prowl'; }
        else if (w.st === 'chase') {
          const d = deer[w.target]; tx = d.x + d.vx * 0.4; ty = d.y + d.vy * 0.4; sp = 40; // pursuit: seek where the quarry will be
          if (w.t <= 0 || Math.hypot(d.x - w.x, d.y - w.y) < 2) { w.st = 'tired'; w.t = 3; }
        } else {
          w.st = 'prowl'; tx = herd[0] + Math.sin(tick * 0.01 + w.x) * 25; ty = herd[1] + Math.cos(tick * 0.013) * 15; sp = 11;
          let best = -1, bd = 34 * 34;
          deer.forEach((d, i) => { const dd = (d.x - w.x) ** 2 + (d.y - w.y) ** 2; if (dd < bd) { bd = dd; best = i; } });
          if (best >= 0) { w.st = 'chase'; w.target = best; w.t = 4; }
        }
        const dx = tx - w.x, dy = ty - w.y, dl = Math.hypot(dx, dy) || 1;
        const want = sp ? [dx / dl * sp, dy / dl * sp] : [0, 0];
        w.vx += (want[0] - w.vx) * 0.15; w.vy += (want[1] - w.vy) * 0.15;
        for (const o of wolves) if (o !== w) { const ox = w.x - o.x, oy = w.y - o.y, od = Math.hypot(ox, oy); if (od < 5 && od > 0) { w.vx += ox / od * 3; w.vy += oy / od * 3; } }
        move(w, dt, false);
      }

      // the herd: flee a wolf (and the alarm spreads), else graze by day, drink at dusk, bed down at night
      for (const d of deer) {
        let fear = 0, fx = 0, fy = 0;
        for (const w of wolves) {
          if (w.st === 'rest' || w.st === 'walk') continue;
          const dx = d.x - w.x, dy = d.y - w.y, dd = Math.hypot(dx, dy);
          if (dd < 26) { fear = Math.max(fear, 1 - dd / 26); fx += dx / dd; fy += dy / dd; }
        }
        if (!fear) near(gDeer, deer, d, 10, 7, b => { if (b.fear > 0.3) { fear = Math.max(fear, b.fear * 0.7); fx += b.vx; fy += b.vy; } });
        d.fear = fear;
        d.t -= dt;
        const [bx, by] = flock(gDeer, deer, d, { r: 18, sep: 8, ws: 3, wa: 0.15, wc: fear ? 0.9 : 0.12 });
        let ax = bx, ay = by, max = 6;
        if (fear > 0.05) {
          // flee, and close up on the neighbors (Hamilton's selfish herd: shrink your domain of danger)
          const l = Math.hypot(fx, fy) || 1; ax += fx / l * 120 * fear; ay += fy / l * 120 * fear; max = 38; d.st = 'flee';
        } else if (d.st === 'flee') { d.st = 'graze'; d.t = 1; }
        else if (ph === 'dusk' && !d.drunk) {
          const [gx, gy, dist] = fieldAt(fieldWater, d.x, d.y);
          if (dist <= 1 && d.st !== 'drink') { d.st = 'drink'; d.t = r.range(3, 7); }
          if (d.st === 'drink') { max = 0.5; if (d.t <= 0) { d.drunk = true; d.st = 'walk'; } else d.face = (pondC.x > d.x) ? 1 : -1; }
          else { ax += gx * 30 - d.vx; ay += gy * 30 - d.vy; max = 12; d.st = 'walk'; }
        } else if (ph === 'night' || (ph === 'dusk' && d.drunk)) {
          const [gx, gy, dist] = fieldAt(fieldBed, d.x, d.y);
          let crowd = 0;
          if (dist <= 2) near(gDeer, deer, d, 6, 3, b => { if (b.st === 'sleep') crowd++; });
          if (dist <= 2 && !crowd) { d.st = 'sleep'; max = 0; d.vx = d.vy = 0; }
          else if (dist <= 2) { ax += bx * 2 + (gx + Math.sin(d.x)) * 10; ay += by * 2 + (gy + Math.cos(d.y)) * 10; max = 6; d.st = 'walk'; }
          else { ax += gx * 30 - d.vx; ay += gy * 30 - d.vy; max = 11; d.st = 'walk'; }
        } else {
          // graze: stand with the head down, then take a few steps, drifting toward any food
          let best = null, bd = 90 * 90;
          for (const f of food) { const dd = (f.x - d.x) ** 2 + (f.y - d.y) ** 2; if (dd < bd && f.r > 0.5) { bd = dd; best = f; } }
          if (d.st === 'sleep' || d.st === 'drink' || d.st === 'walk') { d.st = 'graze'; d.t = r.range(0, 2); }
          if (best && bd > best.r * best.r) { ax += (best.x - d.x) / Math.sqrt(bd) * 20; ay += (best.y - d.y) / Math.sqrt(bd) * 20; max = 10; d.st = 'step'; }
          else if (d.t <= 0) { d.st = d.st === 'graze' ? 'step' : 'graze'; d.t = d.st === 'graze' ? r.range(1.5, 5) : r.range(0.4, 1.4); if (d.st === 'step') { const a = r.range(0, 6.283); d.vx += Math.cos(a) * 4; d.vy += Math.sin(a) * 4; } }
          if (d.st === 'graze') { max = 0.6; if (best) best.r = Math.max(0, best.r - dt * 0.03); }
        }
        d.vx += ax * dt; d.vy += ay * dt;
        if (max < 1) { d.vx *= 0.8; d.vy *= 0.8; }
        limit(d, Math.max(max, 0.01));
        move(d, dt, false);
      }

      // the flock: wheel over the meadow by day, gather over the wood at dusk, then roost; leave at dawn
      const roostC = trees.reduce((s, t) => [s[0] + t.x / trees.length, s[1] + t.y / trees.length], [0, 0]);
      for (const b of birds) {
        if (ph === 'night' || (ph === 'dusk' && hour > 19.3)) {
          const dx = b.roost.x - b.x, dy = b.roost.y - b.y, dl = Math.hypot(dx, dy);
          if (dl < 1.5) { b.x = b.roost.x; b.y = b.roost.y; b.vx = b.vy = 0; b.perch = true; continue; }
          b.vx += (dx / dl * 30 - b.vx) * 0.2; b.vy += (dy / dl * 30 - b.vy) * 0.2; b.perch = false;
          b.x += b.vx * dt; b.y += b.vy * dt; continue;
        }
        b.perch = false;
        const [fx, fy] = flock(gBirds, birds, b, { r: 16, sep: 3, ws: 3, wa: 0.8, wc: 0.6, max: 7 });
        let ax = fx, ay = fy;
        if (ph === 'dusk') { ax += (roostC[0] - b.x) * 0.5; ay += (roostC[1] - 18 - b.y) * 0.5; } // the murmuration
        else { const lx = W / 2 + Math.sin(tick * 0.011) * 70, ly = H / 2 + Math.sin(tick * 0.017 + 1) * 40; ax += (lx - b.x) * 0.12; ay += (ly - b.y) * 0.12; } // a wandering lure keeps one flock
        // stay over the map: steer back from the edges (containment)
        if (b.x < 12) ax += 40; if (b.x > W - 12) ax -= 40; if (b.y < 8) ay += 40; if (b.y > H - 12) ay -= 40;
        b.vx += ax * dt; b.vy += ay * dt;
        const s = limit(b, ph === 'dusk' ? 48 : 38);
        if (s < 22) { b.vx *= 22 / (s || 1); b.vy *= 22 / (s || 1); } // birds keep their airspeed
        b.x += b.vx * dt; b.y += b.vy * dt;
      }

      // the school: aligned and tight, faster at dawn and dusk, slow at night; stays in the water
      const fishMax = ph === 'night' ? 5 : ph === 'day' ? 12 : 18;
      for (const f of fish) {
        const [fx, fy] = flock(gFish, fish, f, { r: 10, sep: 2.5, ws: 3, wa: 0.9, wc: 0.25, max: 7 });
        let ax = fx, ay = fy;
        if (!isWater(f.x + f.vx * 0.5, f.y + f.vy * 0.5)) { ax += (pondC.x - f.x) * 1.5; ay += (pondC.y - f.y) * 1.5; }
        f.vx += ax * dt; f.vy += ay * dt;
        const s = limit(f, fishMax); if (s < fishMax * 0.4) { f.vx *= 1.05; f.vy *= 1.05; }
        const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt;
        if (isWater(nx, ny)) { f.x = nx; f.y = ny; } else { f.vx = -f.vx; f.vy = -f.vy; }
      }

      // bats: a swarm (attraction and repulsion, no alignment: Couzin's swarm state) over the pond at night
      if (ph === 'night' || (ph === 'dusk' && hour > 19.5)) for (const b of bats) {
        const [fx, fy] = flock(gBats, bats, b, { r: 20, sep: 3, ws: 4, wa: 0, wc: 0.4, max: 9 });
        b.vx += (fx + (pondC.x - b.x) * 0.4 + r.range(-60, 60)) * dt; b.vy += (fy + (pondC.y - 14 - b.y) * 0.4 + r.range(-60, 60)) * dt;
        limit(b, 34); b.x += b.vx * dt; b.y += b.vy * dt;
      } else for (const b of bats) { b.x = roostC[0]; b.y = roostC[1]; }

      stepAcc += performance.now() - t0; stepN++;
    }
    // move a walker: no walking into water or trees, stay on the map, face where it goes
    // when the way ahead is blocked, try turning 45, 90 and 135 degrees either side and take the first free way
    // (a cheap wall-follow, so walkers slide round the pond instead of sticking to it)
    const free = (x, y) => !isWater(x, y) && !treeAt[clamp(Math.floor(y / CS), 0, GH - 1) * GW + clamp(Math.floor(x / CS), 0, GW - 1)] && x > 3 && x < W - 3 && y > 6 && y < H - 2;
    const TURNS = [0, 0.785, -0.785, 1.571, -1.571, 2.356, -2.356];
    function move(a, dt) {
      for (const t of TURNS) {
        const cs = Math.cos(t), sn = Math.sin(t), vx = a.vx * cs - a.vy * sn, vy = a.vx * sn + a.vy * cs;
        const nx = a.x + vx * dt, ny = a.y + vy * dt;
        if (free(nx, ny)) { a.x = nx; a.y = ny; if (t) { a.vx = vx; a.vy = vy; } break; }
      }
      if (Math.abs(a.vx) > 0.8) a.face = a.vx > 0 ? 1 : -1;
      a.step = (a.step || 0) + Math.hypot(a.vx, a.vy) * dt * 0.35;
    }

    // ---- light: dusk and night are reprints of the palette, each ink stepped down its own ramp (a ramp table) ----
    // index: ink -> ink. 13 (amber) is kept in every map, so eyeshine and fireflies stay lit.
    const DUSK = [0, 0, 1, 2, 3, 4, 5, 6, 8, 8, 9, 10, 11, 13, 1, 14, 15, 16, 16, 17, 20, 20, 21, 22, 23, 24, 8, 26, 27, 28, 30, 30];
    const NIGHT = [0, 0, 1, 1, 2, 3, 4, 5, 0, 8, 9, 9, 10, 13, 1, 20, 14, 15, 15, 16, 0, 20, 21, 21, 22, 23, 1, 26, 26, 27, 1, 30];
    const RGB = Kit.RGB, mapPal = m => m.map(i => RGB[i]);
    const PALS = { day: RGB, dusk: mapPal(DUSK), night: mapPal(NIGHT) };
    const palNow = () => hour >= 6.5 && hour < 18.5 ? PALS.day : (hour >= 18.5 && hour < 20) || (hour >= 5 && hour < 6.5) ? PALS.dusk : PALS.night;

    // ---- drawing ----
    const frame = new Kit.Pix(W, H);
    const put = (x, y, c) => frame.set(Math.round(x), Math.round(y), c);
    // tiny sprites, facing right: body rows with the outline added, legs drawn after in the outline ink
    const DEER = { body: [[5, 0, 'm'], [6, 0, 'm'], [4, 1, 'm'], [5, 1, 'm'], ...row(0, 2, 6, 'd'), ...row(0, 3, 6, 'm'), ...row(0, 4, 6, 'l')],
      graze: [...row(0, 2, 6, 'd'), ...row(0, 3, 7, 'm'), ...row(0, 4, 6, 'l'), [6, 4, 'm'], [7, 4, 'm']],
      sleep: [[6, 2, 'm'], [6, 3, 'm'], ...row(0, 3, 6, 'd'), ...row(0, 4, 6, 'm')] };
    const WOLF = { body: [[6, 1, 'm'], [7, 1, 'm'], ...row(0, 2, 8, 'd'), ...row(0, 3, 7, 'm'), ...row(1, 4, 5, 'l'), [-1, 3, 'm'], [-2, 4, 'm']],
      sleep: [...row(1, 3, 5, 'd'), ...row(0, 4, 7, 'm'), [6, 3, 'm']] };
    function row(x, y, n, k) { return Array.from({ length: n }, (_, i) => [x + i, y, k]); }
    const spriteCache = new Map();
    function tiny(parts, ramp, legs, face, step) {
      const key = parts.length + ':' + ramp + ':' + legs + ':' + face + ':' + (step & 1);
      let s = spriteCache.get(key);
      if (!s) {
        const p = new Kit.Pix(14, 10), K = { d: ramp[0], m: ramp[1], l: ramp[2] };
        for (const [x, y, k] of parts) p.set(face > 0 ? x + 3 : 10 - x, y + 1, K[k]);
        s = outline(p);
        if (legs) {
          const a = step & 1, xs = a ? [1, 2, 5, 6] : [0, 3, 4, 7];
          for (const x of [xs[0], xs[3]]) { const px = face > 0 ? x + 3 : 10 - x; s.set(px, 7, 0); s.set(px, 8, 0); }
        }
        spriteCache.set(key, s);
      }
      return s;
    }
    function stamp(s, x, y) { // anchor: bottom center
      const ox = Math.round(x) - 7, oy = Math.round(y) - 8;
      for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) { const v = s.d[j * s.w + i]; if (v >= 0) frame.set(ox + i, oy + j, v); }
    }
    function draw(tick) {
      frame.d.set(bg.d);
      for (const f of food) if (f.r > 0.5) for (let k = 0; k < f.r * 3; k++) { const a = k * 2.4, rr = Math.sqrt(k / (f.r * 3)) * f.r; put(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * 0.6, k % 3 ? 19 : 11); }
      for (const f of fish) { put(f.x, f.y, 5); put(f.x - Math.sign(f.vx || 1), f.y, 3); }
      // ground things sorted by their feet: trees, deer, wolves
      const list = [];
      for (const t of trees) list.push([t.y + t.r, 0, t]);
      for (const d of deer) list.push([d.y, 1, d]);
      for (const w of wolves) list.push([w.y, 2, w]);
      list.sort((a, b) => a[0] - b[0]);
      const ph = phase();
      for (const [, k, o] of list) {
        if (k === 0) {
          const s = treeSprites[clamp(o.r - 4, 0, 2)][o.v];
          const ox = Math.round(o.x - o.r - 1), oy = Math.round(o.y - o.r - 1);
          for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const v = s.d[y * s.w + x]; if (v >= 0) frame.set(ox + x, oy + y, v); }
          for (const b of birds) if (b.perch && Math.abs(b.roost.x - o.x) <= o.r && Math.abs(b.roost.y - o.y) <= o.r) put(b.x, b.y, 1);
        } else if (k === 1) {
          const parts = o.st === 'sleep' ? DEER.sleep : (o.st === 'graze' || o.st === 'drink') ? DEER.graze : DEER.body;
          stamp(tiny(parts, [27, 28, 29], o.st !== 'sleep' && o.st !== 'graze' && o.st !== 'drink', o.face, Math.floor(o.step)), o.x, o.y);
        } else {
          const parts = o.st === 'rest' || o.st === 'tired' ? WOLF.sleep : WOLF.body;
          stamp(tiny(parts, [2, 3, 4], parts === WOLF.body, o.face, Math.floor(o.step)), o.x, o.y);
          if (parts === WOLF.body && ph !== 'day') put(o.x + (o.face > 0 ? 3 : -3), o.y - 6, 13); // eyeshine
        }
      }
      if (ph === 'night') for (const f of flies) if (Math.sin(tick * 0.15 + f.p) > 0.6) put(f.x + Math.sin(tick * 0.03 + f.p) * 3, f.y + Math.cos(tick * 0.02 + f.p) * 2, 13);
      // fliers on top: wings up or down by a per-bird phase
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i]; if (b.perch || (ph === 'night' && Math.hypot(b.x - b.roost.x, b.y - b.roost.y) < 1.5)) continue;
        const up = ((tick >> 2) + i) & 1;
        put(b.x, b.y, 0); put(b.x - 1, b.y - up, 0); put(b.x + 1, b.y - up, 0);
      }
      if (ph === 'night' || (ph === 'dusk' && hour > 19.5)) for (let i = 0; i < bats.length; i++) {
        const b = bats[i], up = ((tick >> 1) + i) & 1;
        put(b.x, b.y, 6); put(b.x - 1, b.y - up, 6); put(b.x + 1, b.y - up, 6);
      }
      if (showField) for (let gy = 1; gy < GH; gy += 2) for (let gx = 1; gx < GW; gx += 2) {
        const i = gy * GW + gx, f = phase() === 'night' ? fieldBed : fieldWater; if (f.dist[i] > 1e8) continue;
        const x = gx * CS + 2, y = gy * CS + 2; put(x, y, 7); put(x + f.dir[i * 2], y + f.dir[i * 2 + 1], 7);
      }
      c.put(frame, palNow());
      if (stepN >= 30) { stepMs = stepAcc / stepN; stepAcc = 0; stepN = 0; stat.textContent = `${deer.length + birds.length + fish.length + bats.length + wolves.length} animals, step ${stepMs.toFixed(2)} ms`; }
    }

    c.cv.addEventListener('click', e => {
      const [x, y] = c.at(e);
      if (mode === 'Wolf') {
        if (isWater(x, y)) return;
        const w = wolves[0]; w.x = x; w.y = y; w.vx = w.vy = 0; w.st = 'prowl'; w.forced = 12;
      } else if (!isWater(x, y)) { food.push({ x, y, r: 6 }); if (food.length > 4) food.shift(); }
    });
    const clockText = () => { const h = Math.floor(hour), m = Math.floor((hour - h) * 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' ' + phase(); };
    const b1 = Kit.bar(host);
    const slider = b1.slider('Hour', 0, 23.75, 0.25, hour, v => { hour = v; out.textContent = clockText(); });
    const out = slider.parentNode.querySelector('output');
    out.textContent = clockText();
    b1.check('Clock runs', clock, v => { clock = v; });
    const b2 = Kit.bar(host);
    b2.tabs(['Wolf', 'Food'], v => { mode = v; }, mode);
    b2.check('Flow field', showField, v => { showField = v; });
    b2.seed(seed, s => { seed = s; reset(); });
    const b3 = Kit.bar(host);
    const stat = b3.note('');
    b3.note('Tap to drop a wolf or food.');
    function reset() { makeLand(); populate(); gDeer = makeGrid(deer.length); gBirds = makeGrid(birds.length); gFish = makeGrid(fish.length); gBats = makeGrid(bats.length); spriteCache.clear(); }
    reset();
    Kit.loop(host, step, draw, 30);
  });
})();
