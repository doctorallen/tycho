// house.js: the `house` demo, a house generated from a seed and drawn isometric, using buildings-shared.js.
// The footprint and materials come from the climate; rooms come from a squarified treemap inside zones (social,
// service, private); doors from a room graph; furniture from a few rules checked by a flood fill; the roof is hip,
// gable or flat at the climate's pitch. Whole shows the house; Cutaway lifts the roof and cuts the front and inner
// walls to stubs. The plan in the corner shows the zones: amber social, blue service, green private.
(() => {
  const { Raster, CLIMATES, makeHouse, houseParts, bounds, H: WALL_H } = StudyShared.buildings;
  Kit.register('house', { title: 'A house from a seed', fit: 'prebake' }, host => {
    const W = 200, H = 150;
    const cv = Kit.canvas(host, W, H);
    let seed = 12, climate = 'Temperate', cut = false;
    const SHADOW = { 17: 16, 6: 5, 13: 29, 22: 21 };
    const ZC = { social: 12, service: 23, private: 17 };

    function render() {
      const t0 = performance.now();
      const h = makeHouse(seed, climate), C = h.C;
      const tp = Math.tan(C.pitch * Math.PI / 180);
      // center the house's box in the frame, nudged right and down to leave the corner for the plan
      const box = { x0: -0.5, x1: h.W + 0.5, y0: -0.5, y1: h.D + h.veranda + 1.2, z0: 0, z1: h.z0 + WALL_H + Math.min(h.W, h.D) / 2 * tp + 0.6 };
      const b = bounds(box, 0), ox = Math.round((W - b.w) / 2 - b.x + 10), oy = Math.round((H - b.h) / 2 - b.y + 6);
      const R = new Raster(W, H, ox, oy);
      // ground that runs off every edge, with a few marks, and the house's shadow to the right
      R.col.fill(C.ground); R.flat.fill(1);
      R.isFlat = true; R.id = 999;
      const gx0 = Math.floor((-ox / 8 + -oy / 4) / 2) - 12, gx1 = gx0 + 50;
      for (let gy = gx0; gy < gx1; gy++) for (let gx = gx0; gx < gx1; gx++) {
        const v = Kit.hash2(gx, gy, 41 + climate.length);
        if (v < 0.07) { const len = C.kind === 'bamboo' ? 0.5 : 0.22; R.line([gx, gy, 0], [gx + len, gy - len, 0], C.gmarks[v < 0.035 ? 0 : 1], -1e6 + 1); }
      }
      const sh = SHADOW[C.ground] ?? 0, sx = 1.1;
      for (const q of h.rects) R.poly([[q.x + sx, q.y - 0.6, 0], [q.x + q.w + sx, q.y - 0.6, 0], [q.x + q.w + sx, q.y + q.d - 0.6, 0], [q.x + sx, q.y + q.d - 0.6, 0]], sh, -1e6 + 2);
      // the house: every part into one z-buffer, so the painter's order doesn't matter here
      const parts = houseParts(h, { leaf: true });
      for (const p of parts) {
        if (cut && (p.group === 'upper' || p.group === 'roof')) continue;
        R.id = p.id; R.isFlat = p.group === 'floor';
        p.paint(R);
      }
      const sib = new Map(); for (const p of parts) if (p.sib) sib.set(p.id, p.sib.id);
      R.outline(0, (a, b) => a === b || sib.get(a) === b);
      // count the inks before the plan goes on
      const inks = new Set(); for (const c of R.col) if (c >= 0) inks.add(c);
      plan(R, h);
      cv.put(toPix(R));
      const ms = performance.now() - t0;
      const names = h.rooms.map(q => q.type).join(', ');
      note.textContent = `${h.W}x${h.D} tiles${h.rects.length > 1 ? ' in an L' : ''}${h.z0 ? ' on stilts' : ''}; ${h.rooms.length} rooms (${names}); ` +
        `${h.furniture.length} pieces; ${h.roof} roof${h.roof === 'flat' ? '' : ' at ' + C.pitch + '°'}; plan ${h.ms.toFixed(2)} ms, picture ${(ms - h.ms).toFixed(1)} ms; ${inks.size} inks.`;
    }
    function toPix(R) { const p = new Kit.Pix(W, H); p.d.set(R.col); return p; }
    // the plan: 3 px a tile, rooms by zone, walls dark, doors as gaps, windows pale
    function plan(R, h) {
      const s = 3, px = 4, py = 4, set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) R.col[y * W + x] = c; };
      for (let y = -1; y <= h.D * s + 1; y++) for (let x = -1; x <= h.W * s + 1; x++) set(px + x, py + y, 1);
      for (const q of h.rooms) for (let y = 0; y <= q.d * s; y++) for (let x = 0; x <= q.w * s; x++) set(px + q.x * s + x, py + q.y * s + y, ZC[q.zone]);
      for (const e of h.edges) for (let k = 0; k <= s; k++) {
        const x = e.o === 'h' ? e.x * s + k : e.x * s, y = e.o === 'h' ? e.y * s : e.y * s + k;
        const inner = k > 0 && k < s;
        set(px + x, py + y, inner && e.kind === 'door' ? 7 : inner && e.kind === 'window' ? 25 : 0);
      }
    }
    const b1 = Kit.bar(host);
    b1.seed(seed, v => { seed = v; render(); });
    b1.tabs(['Whole', 'Cutaway'], v => { cut = v === 'Cutaway'; render(); });
    const b2 = Kit.bar(host);
    b2.tabs(Object.keys(CLIMATES), v => { climate = v; render(); }, climate);
    const note = Kit.bar(host).note('');
    render();
  });
})();
