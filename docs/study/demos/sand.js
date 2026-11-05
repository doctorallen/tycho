// sand.js: falling sand, built out. 26 materials in five kinds (powders, liquids, gases, solids, energy), each with
// a density, a viscosity, a flammability and a conductivity, over a per-cell heat field that drives phase changes:
// water freezes and boils, steam rains back, lava cools to stone, sand fuses to glass, salt melts ice, acid eats
// all but glass. Typed arrays, a bottom-up scan with alternating direction, a clock bit, and 16×16 chunks that sleep.
'use strict';
(() => {
  const GW = 160, GH = 120, N = GW * GH, CS = 16, CW = GW / CS, CH = Math.ceil(GH / CS), AMB = 20;
  const NONE = 0, POWDER = 1, LIQUID = 2, GAS = 3, SOLID = 4, FLAME = 5;

  // ---- materials ----
  // Numbers follow the sources where they fit (The Powder Toy's C++, Sandboxels' index.html, Sandspiel's species.rs):
  // dens: The Powder Toy's weights (oil 20 floats on water 30, salt water 35 sinks under it, sand 90 sinks through all).
  // visc: Sandboxels' viscosity; a liquid may try sideways with chance 1 / visc^0.25 (oil 25%, lava 10%).
  // disp: how far a liquid runs sideways in one go. rise: chance a gas rises this frame. slide: chance a powder rolls.
  // cond/cool/cap: heat passed to neighbors, lost to the room, and heat capacity. ign/burn: ignition temperature, burn frames.
  // eat: chance acid eats it on a touch (0 is immune, like glass). blast: chance it shrugs off an explosion.
  const MATS = [];
  const mat = (name, group, kind, o) => {
    MATS.push(Object.assign({ name, label: name, group, kind, dens: 0, visc: 1, disp: 0, rise: 0, slide: 1, cond: 0.05, cool: 0.001,
      ign: 0, burn: 0, eat: 0, blast: 0, cap: 1, t: AMB, cols: [3], surf: -1, alpha: 1, emit: 0, active: 0, wet: 0, special: 0 }, o));
    return MATS.length - 1;
  };
  const EMPTY = mat('Air', 'Tools', NONE, { label: 'Erase', cond: 0.005, cool: 0.03, cols: [1] });
  const SAND = mat('Sand', 'Powders', POWDER, { dens: 90, eat: 0.03, blast: 0.4, cols: [29, 29, 28, 29, 13, 29, 29, 29] });
  const SALT = mat('Salt', 'Powders', POWDER, { dens: 75, slide: 0.9, eat: 0.1, cols: [6, 7, 6, 5, 6, 7, 6, 6] });
  const SNOW = mat('Snow', 'Powders', POWDER, { dens: 40, slide: 0.3, cond: 0.04, cool: 0.0004, cap: 2, eat: 0.15, t: -10, cols: [7, 7, 6, 7, 25, 7, 7, 6] });
  const GUNPOWDER = mat('Gunpowder', 'Powders', POWDER, { dens: 85, slide: 0.8, ign: 170, eat: 0.1, cols: [2, 2, 1, 3, 2, 9, 2, 1] });
  const ASH = mat('Ash', 'Powders', POWDER, { dens: 25, slide: 0.5, cond: 0.03, eat: 0.15, cols: [4, 4, 3, 5, 4, 3, 4, 5] });
  const SEED = mat('Seed', 'Powders', POWDER, { dens: 50, slide: 0.7, ign: 200, burn: 15, eat: 0.1, cols: [28, 27, 28, 18, 28, 27, 29, 28] });
  const WATER = mat('Water', 'Liquids', LIQUID, { dens: 30, disp: 5, cond: 0.12, cap: 2, wet: 1, surf: 24, cols: [22, 22, 22, 22, 23, 22, 22, 22] });
  const BRINE = mat('Salt water', 'Liquids', LIQUID, { dens: 35, disp: 5, cond: 0.12, cap: 2, wet: 1, surf: 25, cols: [23, 23, 22, 23, 24, 23, 23, 22] });
  const OIL = mat('Oil', 'Liquids', LIQUID, { dens: 20, visc: 250, disp: 3, cond: 0.06, ign: 200, burn: 70, eat: 0.05, surf: 28, cols: [26, 26, 8, 26, 26, 27, 26, 26] });
  const LAVA = mat('Lava', 'Liquids', LIQUID, { dens: 45, visc: 10000, disp: 2, cond: 0.05, cool: 0.0003, cap: 10, blast: 1, t: 1500, emit: 0.8, active: 1, cols: [11, 12, 11, 10, 12, 13, 11, 12] });
  const ACID = mat('Acid', 'Liquids', LIQUID, { dens: 10, disp: 4, cond: 0.1, surf: 19, cols: [17, 17, 17, 18, 17, 17, 17, 17] });
  const MUD = mat('Mud', 'Liquids', LIQUID, { dens: 55, visc: 1000, disp: 1, cond: 0.08, eat: 0.05, wet: 1, cols: [27, 26, 27, 27, 28, 26, 27, 27] });
  const SMOKE = mat('Smoke', 'Gases', GAS, { dens: 1.2, rise: 0.7, cond: 0.02, cool: 0.02, t: 60, active: 1, alpha: 0.7, cols: [4, 3, 4, 5] });
  const STEAM = mat('Steam', 'Gases', GAS, { dens: 1, rise: 0.9, cond: 0.05, cool: 0.004, t: 120, active: 1, alpha: 0.55, cols: [6, 5, 6, 25] });
  const METHANE = mat('Methane', 'Gases', GAS, { dens: 0.8, rise: 0.8, cond: 0.03, cool: 0.01, ign: 250, active: 1, alpha: 0.5, cols: [31, 30, 31, 31] });
  const STONE = mat('Stone', 'Solids', SOLID, { cond: 0.07, cool: 0.0005, eat: 0.02, blast: 0.9, cols: [3, 3, 3, 4, 3, 3, 2, 3] });
  const WOOD = mat('Wood', 'Solids', SOLID, { cond: 0.05, cool: 0.0005, ign: 280, burn: 170, eat: 0.06, blast: 0.3, cols: [27, 27, 28, 27, 26, 27, 28, 27] });
  const ICE = mat('Ice', 'Solids', SOLID, { cond: 0.12, cool: 0.0002, cap: 4, eat: 0.08, blast: 0.3, t: -40, cols: [24, 24, 25, 24, 24, 24, 23, 24] });
  const GLASS = mat('Glass', 'Solids', SOLID, { cond: 0.06, cool: 0.0005, blast: 0.4, alpha: 0.5, cols: [25, 24, 25, 7] });
  const METAL = mat('Metal', 'Solids', SOLID, { cond: 0.45, cool: 0.0005, eat: 0.001, blast: 1, cols: [5, 5, 6, 4] });
  const PLANT = mat('Plant', 'Solids', SOLID, { cond: 0.05, ign: 200, burn: 40, eat: 0.1, cols: [16, 17, 16, 16, 18, 17, 16, 15] });
  const FIRE = mat('Fire', 'Energy', FLAME, { dens: 2, cond: 0.25, cool: 0, t: 900, emit: 1, active: 1, cols: [12, 13, 11, 12] });
  const TORCH = mat('Torch', 'Energy', SOLID, { cond: 0.25, cool: 0, blast: 1, t: 1000, emit: 1, special: 1, cols: [9, 10, 9, 11] });
  const FROST = mat('Frost', 'Energy', SOLID, { cond: 0.25, cool: 0, blast: 1, t: -120, special: 1, cols: [25, 7, 25, 24] });
  const VOID = mat('Void', 'Energy', SOLID, { cond: 0.02, cool: 0.03, blast: 1, special: 1, cols: [0, 0, 0, 30] });
  const CLONE = mat('Cloner', 'Energy', SOLID, { cond: 0.02, cool: 0.03, blast: 1, special: 1, cols: [30, 31, 30, 30] });

  // the table as typed arrays, so the inner loop reads numbers, not objects
  const tab = (f, A = Float32Array) => A.from(MATS, f);
  const KIND = tab(m => m.kind, Uint8Array), DENS = tab(m => m.dens), SIDE = tab(m => Math.min(1, 1 / m.visc ** 0.25)), DISP = tab(m => m.disp, Uint8Array);
  const RISE = tab(m => m.rise), SLIDE = tab(m => m.slide), COOL = tab(m => m.cool), IGN = tab(m => m.ign), BURN = tab(m => m.burn);
  const EAT = tab(m => m.eat), BLAST = tab(m => m.blast), TEMP0 = tab(m => m.t), EMIT = tab(m => m.emit), ALPHA = tab(m => m.alpha);
  const INV = tab(m => 1 / m.cap), ACTIVE = tab(m => m.active, Uint8Array), WET = tab(m => m.wet, Uint8Array), SPECIAL = tab(m => m.special, Uint8Array);
  // heat passed between two neighbors: the harmonic mean of their conductivities, so an insulator blocks the flow
  const KP = new Float32Array(32 * 32);
  MATS.forEach((a, i) => MATS.forEach((b, j) => { KP[i * 32 + j] = Math.min(0.45, 2 * a.cond * b.cond / (a.cond + b.cond)); }));
  // eight color variants per material from the page palette; a cell picks one at spawn by a hash
  const COL = new Uint8Array(MATS.length * 24), SURF = new Uint8Array(MATS.length * 3);
  MATS.forEach((m, t) => {
    for (let v = 0; v < 8; v++) COL.set(Kit.RGB[m.cols[v % m.cols.length]], (t * 8 + v) * 3);
    SURF.set(Kit.RGB[m.surf >= 0 ? m.surf : m.cols[0]], t * 3);
  });
  const hsh = (i, s) => { let h = Math.imul(i + Math.imul(s, 0x9E3779B1), 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15; return h & 255; };

  // heat view: a color ramp from -140° (white-blue) through room temperature (dark) to 1500° (white-hot)
  const HEAT = new Uint8Array(256 * 3);
  {
    const stops = [[-140, 200, 240, 255], [-60, 60, 120, 230], [20, 18, 15, 30], [200, 110, 20, 40], [500, 220, 70, 40], [900, 247, 170, 80], [1500, 255, 250, 220]];
    for (let k = 0; k < 256; k++) {
      const T = -140 + k / 255 * 1640;
      let s = 0; while (s < stops.length - 2 && T > stops[s + 1][0]) s++;
      const a = stops[s], b = stops[s + 1], f = Math.max(0, Math.min(1, (T - a[0]) / (b[0] - a[0])));
      for (let q = 0; q < 3; q++) HEAT[k * 3 + q] = a[q + 1] + (b[q + 1] - a[q + 1]) * f;
    }
  }

  // the palette and controls get a few styles of their own; the page's button styles do the rest
  function style() {
    if (document.getElementById('sand-style')) return;
    const s = document.createElement('style'); s.id = 'sand-style';
    s.textContent = `
      .sand-read { font: 12px/1.4 ui-monospace, Menlo, Consolas, monospace; color: #cdcbd9; min-height: 17px; margin-top: 6px; text-align: center; }
      .sand-pal { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 8px; }
      .sand-grp { display: flex; flex-direction: column; gap: 3px; }
      .sand-grp > b { font: 600 10.5px/1.2 ui-monospace, Menlo, Consolas, monospace; color: #a29eb6; text-transform: uppercase; letter-spacing: .06em; }
      .sand-sw { display: flex; flex-wrap: wrap; gap: 3px; }
      .sand-pal button { min-height: 26px; padding: 2px 7px 2px 4px; font-size: 12px; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
      .sand-pal i { width: 12px; height: 12px; border-radius: 2px; display: inline-block; box-shadow: inset 0 0 0 1px rgba(0,0,0,.45); }
      @media (max-width: 560px) {
        .sand-pal { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 6px; -webkit-overflow-scrolling: touch; }
        .sand-sw { display: grid; grid-template-rows: repeat(3, auto); grid-auto-flow: column; }
      }`;
    document.head.append(s);
  }

  Kit.register('falling-sand', { title: 'Falling sand', fit: 'shader' }, host => {
    style();
    const c = Kit.canvas(host, GW, GH);
    c.cv.style.touchAction = 'none';
    const type = new Uint8Array(N), life = new Uint8Array(N), burn = new Uint8Array(N), shade = new Uint8Array(N), clock = new Uint8Array(N);
    const temp = new Float32Array(N).fill(AMB);
    let cur = new Uint8Array(CW * CH).fill(1), nxt = new Uint8Array(CW * CH); // chunks awake this frame / next frame
    let clk = 0, frame = 0, stir = false, seed = 1;
    // xorshift32 for the simulation's dice, seeded per scene so a scene plays out the same way each time
    const R = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };

    // wake a cell's chunk (and the chunk across the edge if the cell is on one) for this frame and the next
    const wake = (x, y) => {
      const cx = x >> 4, cy = y >> 4, k = cy * CW + cx, lx = x & 15, ly = y & 15;
      cur[k] = nxt[k] = 1;
      if (lx === 0 && cx > 0) cur[k - 1] = nxt[k - 1] = 1;
      else if (lx === 15 && cx < CW - 1) cur[k + 1] = nxt[k + 1] = 1;
      if (ly === 0 && cy > 0) cur[k - CW] = nxt[k - CW] = 1;
      else if (ly === 15 && cy < CH - 1) cur[k + CW] = nxt[k + CW] = 1;
    };
    const wakeI = i => { const x = i % GW; wake(x, (i - x) / GW); };
    const set = (i, t, T = TEMP0[t]) => {
      type[i] = t; temp[i] = T; burn[i] = 0; clock[i] = clk;
      life[i] = t === FIRE ? 8 + R() * 16 : 0;
      shade[i] = hsh(i, frame * 37 + t);
      wakeI(i);
    };
    const swap = (i, j) => {
      let v = type[i]; type[i] = type[j]; type[j] = v;
      v = life[i]; life[i] = life[j]; life[j] = v;
      v = burn[i]; burn[i] = burn[j]; burn[j] = v;
      v = shade[i]; shade[i] = shade[j]; shade[j] = v;
      const f = temp[i]; temp[i] = temp[j]; temp[j] = f;
      clock[i] = clock[j] = clk;
      wakeI(i); wakeI(j);
    };
    const NB = new Int32Array(4);
    const around = (x, y, i) => { let n = 0; if (y > 0) NB[n++] = i - GW; if (y < GH - 1) NB[n++] = i + GW; if (x > 0) NB[n++] = i - 1; if (x < GW - 1) NB[n++] = i + 1; return n; };

    // ---- movement ----
    // a move that is allowed but loses its dice roll sets `stir`, so the chunk stays awake to try again
    const sinks = (t, tt) => {
      const k = KIND[tt];
      if (tt === EMPTY || k === GAS || k === FLAME) return true;
      if (k === LIQUID && DENS[tt] < DENS[t]) { if (R() < 0.15 + 0.5 * SIDE[tt]) return true; stir = true; }
      return false;
    };
    const flows = (t, tt) => {
      const k = KIND[tt];
      if (tt === EMPTY || k === GAS || k === FLAME) return true;
      if ((k === LIQUID || k === POWDER) && DENS[tt] < DENS[t]) { if (R() < 0.5) return true; stir = true; }
      return false;
    };
    const rises = (t, tt) => tt === EMPTY || (KIND[tt] === GAS && DENS[tt] > DENS[t] && R() < 0.3);
    function powder(x, y, i, t) {
      if (y === GH - 1) return;
      const d = i + GW;
      if (sinks(t, type[d])) { swap(i, d); return; }
      const s = R() < 0.5 ? -1 : 1;
      for (let k = 0; k < 2; k++) {
        const dx = k ? -s : s, nx = x + dx;
        if (nx < 0 || nx >= GW || !sinks(t, type[d + dx])) continue;
        if (R() < SLIDE[t]) swap(i, d + dx); else stir = true;
        return;
      }
    }
    function liquid(x, y, i, t) {
      const s = R() < 0.5 ? -1 : 1;
      if (y < GH - 1) {
        const d = i + GW;
        if (flows(t, type[d])) { swap(i, d); return; }
        for (let k = 0; k < 2; k++) {
          const dx = k ? -s : s, nx = x + dx;
          if (nx >= 0 && nx < GW && flows(t, type[d + dx])) { swap(i, d + dx); return; }
        }
      }
      // Sandboxels' rule: a thick liquid only sometimes gets to try sideways (here it may always run downhill)
      if (SIDE[t] < 1 && R() > SIDE[t]) { stir = true; return; }
      // run sideways as far as `disp` cells through air or gas
      for (let k = 0, n = DISP[t]; k < 2; k++) {
        const dx = k ? -s : s; let best = -1;
        for (let m = 1, nx = x + dx; m <= n && nx >= 0 && nx < GW; m++, nx += dx) {
          const tt = type[i + dx * m];
          if (tt === EMPTY || KIND[tt] === GAS) best = i + dx * m; else break;
        }
        if (best >= 0) { swap(i, best); return; }
      }
    }
    function gas(x, y, i, t) {
      if (R() < RISE[t] && y > 0) {
        const r = R(), dx = r < 0.25 ? -1 : r < 0.5 ? 1 : 0, nx = x + dx;
        if (nx >= 0 && nx < GW && rises(t, type[i - GW + dx])) { swap(i, i - GW + dx); return; }
        if (dx && rises(t, type[i - GW])) { swap(i, i - GW); return; }
      }
      const dx = R() < 0.5 ? -1 : 1, nx = x + dx;
      if (nx >= 0 && nx < GW && type[i + dx] === EMPTY) swap(i, i + dx);
    }

    // ---- fire, burning and blasts ----
    function fire(x, y, i) {
      if (life[i] <= 1) { set(i, R() < 0.2 ? SMOKE : EMPTY, temp[i]); return; }
      life[i]--;
      const n = around(x, y, i);
      for (let q = 0; q < n; q++) {
        const j = NB[q], tt = type[j];
        if (WET[tt] || tt === SNOW || tt === ICE) { if (tt === WATER || tt === BRINE) { if (R() < 0.5) set(j, STEAM); } set(i, SMOKE, 200); return; }
      }
      if (temp[i] < 850) temp[i] = 850;
      const h = NB[(R() * n) | 0];
      if (IGN[type[h]] && !burn[h]) { temp[h] += 30; wakeI(h); }
      wake(x, y);
      if (y > 0 && R() < 0.75) {
        const r = R(), dx = r < 0.3 ? -1 : r < 0.6 ? 1 : 0, nx = x + dx;
        if (nx >= 0 && nx < GW && type[i - GW + dx] === EMPTY) swap(i, i - GW + dx);
      }
    }
    // a burning cell holds its heat, throws flames, and is put out by water; returns true when this cell is done
    function burning(x, y, i, t) {
      const n = around(x, y, i);
      for (let q = 0; q < n; q++) {
        const j = NB[q], tt = type[j];
        if (WET[tt]) { burn[i] = 0; temp[i] = 90; if (tt !== MUD && R() < 0.3) set(j, STEAM); wake(x, y); return KIND[t] === SOLID; }
      }
      if (temp[i] < 900) temp[i] = 900;
      wake(x, y);
      const h = NB[(R() * n) | 0];               // flames lick a neighbor: heat it straight away
      if (IGN[type[h]] && !burn[h]) { temp[h] += 40; wakeI(h); }
      if (--burn[i] === 0) {
        const ash = t === WOOD ? 0.3 : t === PLANT ? 0.15 : t === SEED ? 1 : 0;
        if (R() < ash) set(i, ASH, 500); else if (t === OIL && R() < 0.4) set(i, SMOKE, 400); else set(i, FIRE);
        return true;
      }
      if (R() < 0.3) {
        const j = R() < 0.6 ? (y > 0 ? i - GW : -1) : NB[(R() * n) | 0];
        if (j >= 0 && type[j] === EMPTY) set(j, R() < 0.12 ? SMOKE : FIRE);
      }
      return KIND[t] === SOLID;
    }
    function explode(x, y, i, r) {
      set(i, FIRE, 1300);
      const r2 = r * r, rr = Math.ceil(r);
      for (let dy = -rr; dy <= rr; dy++) {
        const ny = y + dy; if (ny < 0 || ny >= GH) continue;
        for (let dx = -rr; dx <= rr; dx++) {
          const nx = x + dx, d2 = dx * dx + dy * dy; if (nx < 0 || nx >= GW || d2 > r2) continue;
          const j = ny * GW + nx, tt = type[j];
          if (tt === GUNPOWDER) { temp[j] = 1000; wake(nx, ny); continue; }  // the chain: it goes off on its own turn
          if (BLAST[tt] > R()) { if (temp[j] < 400) temp[j] = 400; wake(nx, ny); continue; }
          if (tt === WATER || tt === BRINE) { set(j, STEAM, 200); continue; }
          if (d2 < r2 * 0.6 || R() < 0.5) { set(j, FIRE, 1200); life[j] = 5 + R() * 14; } else set(j, EMPTY, 500);
        }
      }
    }
    // returns true when the cell turned into something else
    function ignite(x, y, i, t) {
      if (t === GUNPOWDER) { explode(x, y, i, 4 + R() * 4); return true; }
      if (t === METHANE) {
        set(i, FIRE, 1100); life[i] = 6 + R() * 10;
        const n = around(x, y, i);
        for (let q = 0; q < n; q++) {
          const j = NB[q], tt = type[j];
          if (tt === METHANE) { temp[j] = 1000; wakeI(j); } else if (tt === EMPTY && R() < 0.6) set(j, FIRE, 1000);
        }
        return true;
      }
      burn[i] = Math.max(1, BURN[t] * (0.7 + R() * 0.6)); wake(x, y);
      return false;
    }

    // ---- one cell's turn ----
    function update(x, y, i) {
      const t = type[i];
      stir = ACTIVE[t] === 1;
      if (burn[i]) { if (burning(x, y, i, t)) return; }
      else if (IGN[t] && temp[i] >= IGN[t] && ignite(x, y, i, t)) return;
      const T = temp[i];
      switch (t) {
        case FIRE: fire(x, y, i); return;
        case LAVA: {
          if (T < 600) { type[i] = STONE; wake(x, y); return; }
          const n = around(x, y, i);
          for (let q = 0; q < n; q++) {
            const j = NB[q], tt = type[j];
            if (tt === WATER || tt === BRINE || tt === SNOW || tt === ICE) {
              set(j, STEAM, 160);
              if (R() < 0.3) { type[i] = STONE; temp[i] = 700; return; }
              break;
            }
          }
          break;
        }
        case WATER:
          if (T >= 100) { if (R() < 0.05) { set(i, STEAM, 110); return; } temp[i] = 100; stir = true; }
          else if (T <= -2) { if (R() < 0.06) { type[i] = ICE; wake(x, y); return; } temp[i] = -2; stir = true; }
          break;
        case BRINE: {
          if (T >= 104) { if (R() < 0.05) { set(i, R() < 0.4 ? SALT : STEAM, 110); return; } temp[i] = 104; stir = true; }
          else if (T <= -20) { if (R() < 0.05) { type[i] = ICE; wake(x, y); return; } temp[i] = -20; }
          const n = around(x, y, i);
          for (let q = 0; q < n; q++) {
            const j = NB[q], tt = type[j];
            if (tt === ICE || tt === SNOW) { stir = true; if (R() < 0.02) set(j, WATER, 0); }  // salt water melts ice
          }
          break;
        }
        case ICE: {
          if (T > 0) { if (R() < 0.02) { type[i] = WATER; temp[i] = 1; } else temp[i] = 0; wake(x, y); return; }
          // cold ice grows into cold water beside it at 7% a frame, as in Sandspiel
          if (T < -10) {
            const n = around(x, y, i);
            for (let q = 0; q < n; q++) {
              const j = NB[q];
              if (type[j] === WATER && temp[j] < 10) { wake(x, y); if (R() < 0.07) { set(j, ICE, (T + temp[j]) / 2); temp[i] = (T + temp[j]) / 2; } break; }
            }
          }
          return;
        }
        case SNOW:
          if (T > 0) { if (R() < 0.08) { type[i] = WATER; temp[i] = 1; wake(x, y); return; } temp[i] = 0; stir = true; }
          break;
        case STEAM:
          if (T < 95 && R() < 0.03) { type[i] = WATER; temp[i] = 80; wake(x, y); return; }
          break;
        case SMOKE:
          // Sandboxels' smoke deletes itself 5% a tick at 30 ticks a second; this runs at 60, so 2.5%
          if (R() < 0.025) { type[i] = EMPTY; wake(x, y); return; }
          break;
        case SALT: {
          const n = around(x, y, i);
          for (let q = 0; q < n; q++) {
            const j = NB[q], tt = type[j];
            // salt dissolves into water at 1/50 a frame (The Powder Toy), and melts ice at 10%, snow at 25% (Sandboxels)
            if (tt === WATER) { stir = true; if (R() < 0.02) { set(j, BRINE, temp[j] - 5); set(i, EMPTY, T); return; } }
            else if (tt === ICE || tt === SNOW) { stir = true; if (R() < (tt === ICE ? 0.1 : 0.25)) { set(j, BRINE, -5); if (R() < 0.5) { set(i, EMPTY, T); return; } } }
          }
          break;
        }
        case ASH: {
          const n = around(x, y, i);
          for (let q = 0; q < n; q++) {
            const j = NB[q];
            if (type[j] === WATER) { stir = true; if (R() < 0.004) { type[i] = MUD; if (R() < 0.5) set(j, EMPTY); wake(x, y); return; } }
          }
          break;
        }
        case MUD:
          if (T > 100) { if (R() < 0.03) { type[i] = SAND; wake(x, y); return; } temp[i] = 100; }
          break;
        case SAND:
          if (T > 900 && R() < 0.05) { type[i] = GLASS; wake(x, y); return; }
          break;
        case SEED: {
          const n = around(x, y, i);
          for (let q = 0; q < n; q++) {
            const j = NB[q], tt = type[j];
            if (tt === WATER || tt === MUD) {
              stir = true;
              if (R() < 0.03) { set(i, PLANT, T); life[i] = 14 + R() * 26; if (tt === WATER && R() < 0.5) set(j, EMPTY); return; }
            }
          }
          break;
        }
        case PLANT: plant(x, y, i); return;
        case ACID: if (acid(x, y, i)) return; break;
        case TORCH:
          temp[i] = 1000;
          if (y > 0 && type[i - GW] === EMPTY) { wake(x, y); if (R() < 0.4) set(i - GW, FIRE); }
          return;
        case FROST: temp[i] = -120; return;
        case VOID: {
          const n = around(x, y, i);
          for (let q = 0; q < n; q++) { const j = NB[q], k = KIND[type[j]]; if (k && k !== SOLID) set(j, EMPTY, AMB); }
          return;
        }
        case CLONE: {
          const n = around(x, y, i);
          if (!life[i]) { for (let q = 0; q < n; q++) { const tt = type[NB[q]]; if (tt && !SPECIAL[tt]) { life[i] = tt; break; } } }
          else {
            wake(x, y);
            for (let q = 0; q < n; q++) if (type[NB[q]] === EMPTY && R() < 0.1) set(NB[q], life[i]);
            // pressure: under its own pour, it pushes up through the column to the first open cell
            const m = life[i];
            if (y > 0 && type[i - GW] === m && KIND[m] !== SOLID && R() < 0.2) {
              let j = i - GW;
              for (let k = 0; k < 12 && j >= GW && type[j] === m; k++) j -= GW;
              if (type[j] === EMPTY || KIND[type[j]] === GAS) set(j, m);
            }
          }
          return;
        }
      }
      const k = KIND[t];
      if (k === POWDER) powder(x, y, i, t);
      else if (k === LIQUID) liquid(x, y, i, t);
      else if (k === GAS) gas(x, y, i, t);
      if (stir) wake(x, y);
    }
    // a plant with growth left climbs toward the light; a grown one creeps slowly over water it touches
    function plant(x, y, i) {
      if (life[i] > 0) {
        wake(x, y);
        if (R() > 0.12) return;
        if (y === 0) { life[i] = 0; return; }
        const r = R(), dx = r < 0.6 ? 0 : r < 0.8 ? -1 : 1, nx = x + dx;
        if (nx < 0 || nx >= GW) return;
        const j = i - GW + dx, tt = type[j];
        if (tt === EMPTY || tt === WATER) { const l = life[i] - 1; set(j, PLANT, temp[i]); life[j] = l; if (R() > 0.12) life[i] = 0; }
        else if (R() < 0.1) life[i] = 0;
        return;
      }
      const n = around(x, y, i);
      for (let q = 0; q < n; q++) {
        const j = NB[q];
        if (type[j] === WATER) { wake(x, y); if (R() < 0.001) { set(j, PLANT, temp[j]); life[j] = 2; } return; }
      }
    }
    // acid eats a neighbor that isn't immune and is sometimes used up doing it
    function acid(x, y, i) {
      const n = around(x, y, i);
      let any = false;
      for (let q = 0; q < n; q++) { if (EAT[type[NB[q]]]) { any = true; break; } }
      if (!any) return false;
      wake(x, y);
      const j = NB[(R() * n) | 0], tt = type[j];
      if (tt === GUNPOWDER) { set(j, FIRE); set(i, FIRE); return true; }   // as in The Powder Toy: acid lights gunpowder
      if (R() < EAT[tt]) {
        set(j, R() < 0.2 ? SMOKE : EMPTY, temp[j]);
        temp[i] += 15;                                                    // dissolving warms the acid
        if (++life[i] >= 25) { set(i, EMPTY, temp[i]); return true; }      // and wears it out after about 25 bites
      }
      return false;
    }

    // ---- heat ----
    // each cell trades heat with its right and lower neighbor and leaks a little to the room; awake chunks only
    function conduct() {
      for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
        const ck = cy * CW + cx; if (!cur[ck]) continue;
        let hot = false;
        const x0 = cx * CS, x1 = x0 + CS, y1 = Math.min(GH, cy * CS + CS);
        for (let y = cy * CS; y < y1; y++) {
          for (let x = x0, i = y * GW + x0; x < x1; x++, i++) {
            const ty = type[i], ti = ty * 32, inv = INV[ty]; let T = temp[i];
            const a = (AMB - T) * COOL[ty]; T += a;
            if (a > 0.3 || a < -0.3) hot = true;
            if (x < GW - 1) { const j = i + 1, f = (temp[j] - T) * KP[ti + type[j]]; T += f * inv; temp[j] -= f * INV[type[j]]; if (f > 0.3 || f < -0.3) hot = true; }
            if (y < GH - 1) { const j = i + GW, f = (temp[j] - T) * KP[ti + type[j]]; T += f * inv; temp[j] -= f * INV[type[j]]; if (f > 0.3 || f < -0.3) hot = true; }
            temp[i] = T;
          }
        }
        if (hot) {
          nxt[ck] = 1;
          if (cx > 0) nxt[ck - 1] = 1; if (cx < CW - 1) nxt[ck + 1] = 1;
          if (cy > 0) nxt[ck - CW] = 1; if (cy < CH - 1) nxt[ck + CW] = 1;
        }
      }
    }

    // ---- one frame: bottom-up, alternating direction per row, awake chunks only, each cell once by the clock bit ----
    function sim() {
      clk ^= 1; frame++;
      for (let y = GH - 1; y >= 0; y--) {
        const cy = y >> 4, ltr = ((y + frame) & 1) === 0, row = y * GW;
        for (let q = 0; q < CW; q++) {
          const cx = ltr ? q : CW - 1 - q;
          if (!cur[cy * CW + cx]) continue;
          const x0 = cx * CS;
          for (let k = 0; k < CS; k++) {
            const x = ltr ? x0 + k : x0 + CS - 1 - k, i = row + x;
            if (type[i] === EMPTY || clock[i] === clk) continue;
            clock[i] = clk;
            update(x, y, i);
          }
        }
      }
      conduct();
      const s = cur; cur = nxt; nxt = s; nxt.fill(0);
    }

    // ---- scenes ----
    const inb = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH;
    const put = (x, y, t, T) => { if (inb(x, y)) set(y * GW + x, t, T); };
    const at = (x, y) => inb(x, y) ? type[y * GW + x] : -1;
    const box = (x0, y0, x1, y1, t) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) put(x, y, t); };
    const blob = (cx, cy, r, t, only = -1) => {
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r * (0.8 + 0.4 * Kit.hash2(x, y, 5)) && (only < 0 || at(x, y) === only)) put(x, y, t);
    };
    const fillEmpty = (x0, y0, x1, y1, t) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (at(x, y) === EMPTY) put(x, y, t); };
    // a tree: a trunk, two branches, and a lumpy crown of plant
    const tree = (x, base, h, r, rnd) => {
      const top = base - h;
      for (let k = 0; k < 6; k++) blob(x + 1 + rnd.range(-r * 0.8, r * 0.8), top + rnd.range(-r * 0.5, r * 0.3), r * rnd.range(0.5, 0.75), PLANT, EMPTY);
      box(x, top + 2, x + 2, base, WOOD);
      for (let k = 0; k < r * 0.7; k++) { put(x - 1 - k, top + 4 - (k >> 1), WOOD); put(x + 2 + k, top + 5 - (k >> 1), WOOD); }
    };
    const cloner = (x, y, t) => { put(x, y, CLONE); life[y * GW + x] = t; };
    const SCENES = {
      'Volcano': rnd => {
        // a stone cone with a crater fed by a lava source, a notch in the rim toward a lake, trees in the way
        for (let x = 0; x < GW; x++) {
          const h = Math.round(70 - Math.abs(x - 42) * 1.6 + 2 * Kit.noise2(x * 0.15, 0, 7));
          for (let y = Math.min(112, 112 - h); y < GH; y++) put(x, y, STONE);
          const bed = 104 + Math.round(3 * Math.sin(x * 0.09));
          if (x > 84) for (let y = bed; y < 112; y++) put(x, y, STONE);
        }
        for (let y = 38; y < 62; y++) { const w = 2 + (62 - y) * 0.22; for (let x = Math.floor(42 - w); x <= 42 + w; x++) put(x, y, EMPTY); }
        box(43, 38, 50, 53, EMPTY);                 // the notch in the right rim
        box(41, 62, 44, 100, LAVA);                 // the throat
        for (let x = 39; x < 46; x++) if (at(x, 61) === EMPTY) cloner(x, 61, LAVA);
        // a sand beach and lake bed, then the water
        for (let x = 56; x < GW; x++) { let y = 0; while (y < GH && at(x, y) !== STONE) y++; for (let k = 1; k <= 3; k++) if (y - k > 84) put(x, y - k, SAND); }
        fillEmpty(56, 85, GW, 112, WATER);
        for (let k = 0; k < 7; k++) { const x = rnd.int(92, 156); let y = 85; while (at(x, y + 1) === WATER) y++; for (let h = rnd.int(4, 9); h > 0 && at(x, y) === WATER; h--, y--) put(x, y, PLANT); }
        // grass and trees on the slopes
        for (let x = 2; x < 80; x++) { let y = 0; while (at(x, y) === EMPTY) y++; if (y < 84 && (x < 31 || x > 53)) put(x, y - 1, PLANT); }
        for (const x of [6, 19, 57, 67]) { let y = 0; while (at(x, y) === EMPTY && at(x + 1, y) === EMPTY) y++; tree(x, y, rnd.int(9, 12), rnd.range(4, 5.5), rnd); }
      },
      'Forest fire': rnd => {
        // rolling ground, a dip full of oil with a tree standing in it, a crate of gunpowder; the left tree is alight
        const g = x => 100 + Math.round(3 * Math.sin(x * 0.045) + 2 * Math.sin(x * 0.13 + 1) + (x > 54 && x < 100 ? 12 * Math.sin(Math.PI * (x - 54) / 46) : 0));
        for (let x = 0; x < GW; x++) { const y0 = g(x); put(x, y0, PLANT); box(x, y0 + 1, x + 1, y0 + 5, SAND); box(x, y0 + 5, x + 1, GH, STONE); }
        fillEmpty(54, Math.min(g(54), g(100)) + 1, 101, GH, OIL);
        for (const x of [5, 20, 35, 77, 108, 123]) tree(x, g(x) + (x === 77 ? 1 : 0), x === 77 ? rnd.int(28, 32) : rnd.int(20, 28), rnd.range(7, 9), rnd);
        const cy = g(150);
        box(143, cy - 10, 157, cy, WOOD); box(144, cy - 9, 156, cy, GUNPOWDER);
        for (let x = 0; x < 14; x++) for (let y = 50; y < 100; y++) if (at(x, y) === PLANT) temp[y * GW + x] = 400;
      },
      'Acid vat': rnd => {
        // a metal tank of acid with two thin stone patches in its floor, over a glass vat full of everything else
        box(8, 64, 10, 118, GLASS); box(150, 64, 152, 118, GLASS); box(8, 116, 152, 118, GLASS);
        box(16, 96, 34, 116, STONE);
        for (let x = 18; x < 33; x += 3) { let y = 95; for (let h = rnd.int(3, 7); h > 0; h--, y--) put(x, y, PLANT); }
        box(40, 92, 42, 116, METAL); box(66, 92, 68, 116, METAL); box(38, 89, 70, 92, METAL);
        box(76, 100, 96, 116, WOOD); box(78, 102, 94, 114, SALT);
        box(100, 104, 114, 116, ICE);
        for (let x = 118; x < 150; x++) { const h = Math.round(14 - Math.abs(x - 134) * 0.85); for (let y = 116 - Math.max(0, h); y < 116; y++) put(x, y, SAND); }
        box(24, 6, 27, 35, METAL); box(133, 6, 136, 35, METAL); box(24, 32, 136, 35, METAL);
        box(27, 19, 133, 32, ACID);
        box(50, 32, 55, 34, ACID); box(104, 32, 108, 34, ACID); box(50, 34, 55, 35, STONE); box(104, 34, 108, 35, STONE);
      },
      'Ice cave': rnd => {
        // a cave in stone, its roof lined with ice held cold by frost; a pool boiled by torches on the left,
        // a rock ridge with an ice spire, salt water eating the ice on the right, snow on a frozen ledge
        const floor = x => x < 64 ? 108 : x < 94 ? Math.round(84 + Math.abs(x - 79) * 1.6) : 106;
        const open = new Uint8Array(N);
        for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
          const d = ((x - 80) / 74) ** 2 + ((y - 70) / 60) ** 2 + 0.2 * Kit.fbm(x / 18, y / 14, 11, 3);
          open[y * GW + x] = d < 1 && y < floor(x) ? 1 : 0;
        }
        for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
          if (open[y * GW + x]) continue;
          let near = 99;
          for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (inb(x + dx, y + dy) && open[(y + dy) * GW + x + dx]) near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy)));
          const icy = (y < 72 || x > 140) && near <= 4;
          put(x, y, icy ? (near === 4 && (x % 5) === 0 ? FROST : ICE) : STONE);
        }
        for (let k = 0; k < 18; k++) {                // icicles
          const x = rnd.int(16, 146); let y = 0; while (y < GH && !open[y * GW + x]) y++;
          if (y > 56) continue;
          for (let h = rnd.int(3, 12); h > 0; h--, y++) for (let dx = 0; dx <= (h > 5 ? 1 : 0); dx++) put(x + dx, y, ICE);
        }
        for (let y = 62; y < 86; y++) { const w = (y - 62) * 0.22; for (let x = Math.round(79 - w); x <= 79 + w; x++) put(x, y, x === 79 && y > 66 ? FROST : ICE); }
        fillEmpty(0, 92, 64, GH, WATER);
        for (let x = 14; x < 62; x += 7) put(x, 108, TORCH);
        box(110, 64, 146, 67, ICE); box(112, 65, 144, 66, FROST);
        for (let x = 111; x < 146; x++) for (let y = 63; y > 60 - 2 * Kit.hash2(x >> 2, 0, 9); y--) if (at(x, y) === EMPTY) put(x, y, SNOW);
        fillEmpty(94, 95, GW, GH, BRINE);
      },
    };
    function build(name) {
      type.fill(0); temp.fill(AMB); life.fill(0); burn.fill(0); shade.fill(0); clock.fill(0); cur.fill(1); nxt.fill(0);
      frame = 0; seed = (Kit.hashStr(name) | 0) || 1;
      if (SCENES[name]) SCENES[name](Kit.rng(name));
      for (let k = 0; k < 30; k++) sim();
    }

    // ---- drawing ----
    const img = new ImageData(GW, GH), px = img.data;
    const BACK = new Uint8Array(N * 3);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const n = Kit.fbm(x / 26, y / 20, 4, 3), k = n > 0.18 ? 2 : (n > 0.12 && (x + y) % 2) ? 2 : 1;
      BACK.set(Kit.RGB[k], (y * GW + x) * 3);
    }
    // glow: emitters summed on a quarter-size grid, blurred, then added back with bilinear filtering
    // haze: smoke and steam summed the same way, so a few scattered gas cells read as a soft plume
    const QW = GW / 4, QH = GH / 4, G = new Float32Array(QW * QH), G2 = new Float32Array(QW * QH);
    const HS = new Float32Array(QW * QH), HW = new Float32Array(QW * QH);
    const QX0 = new Uint8Array(GW), QX1 = new Uint8Array(GW), QFX = new Float32Array(GW), QY0 = new Uint8Array(GH), QY1 = new Uint8Array(GH), QFY = new Float32Array(GH);
    for (let x = 0; x < GW; x++) { const g = Math.max(0, (x + 0.5) / 4 - 0.5); QX0[x] = Math.floor(g); QX1[x] = Math.min(QW - 1, QX0[x] + 1); QFX[x] = g - QX0[x]; }
    for (let y = 0; y < GH; y++) { const g = Math.max(0, (y + 0.5) / 4 - 0.5); QY0[y] = Math.floor(g); QY1[y] = Math.min(QH - 1, QY0[y] + 1); QFY[y] = g - QY0[y]; }
    function blur(A) {
      for (let y = 0; y < QH; y++) for (let x = 0; x < QW; x++) { const i = y * QW + x; G2[i] = (A[x > 0 ? i - 1 : i] + A[i] + A[x < QW - 1 ? i + 1 : i]) / 3; }
      for (let y = 0; y < QH; y++) for (let x = 0; x < QW; x++) { const i = y * QW + x; A[i] = (G2[y > 0 ? i - QW : i] + G2[i] + G2[y < QH - 1 ? i + QW : i]) / 3; }
    }
    const RS = Kit.RGB[4], RW = Kit.RGB[6], R10 = Kit.RGB[10], R12 = Kit.RGB[12], R13 = Kit.RGB[13], R9 = Kit.RGB[9];
    const FIRECOL = [Kit.RGB[10], Kit.RGB[11], Kit.RGB[12], Kit.RGB[13]];
    let heatView = false;
    function draw() {
      steps = 0;
      G.fill(0); HS.fill(0); HW.fill(0);
      let lit = 0, hazy = 0;
      for (let y = 0, i = 0; y < GH; y++) {
        const gr = (y >> 2) * QW;
        for (let x = 0; x < GW; x++, i++) {
          const t = type[i]; if (!t) continue;
          if (t === SMOKE) { HS[gr + (x >> 2)] += 1.3; hazy++; } else if (t === STEAM) { HW[gr + (x >> 2)] += 1; hazy++; }
          let e = EMIT[t];
          if (burn[i]) e = 0.7; else if (!e && temp[i] > 480) e = Math.min(0.6, (temp[i] - 480) / 1500);
          if (e) { G[gr + (x >> 2)] += e; lit++; }
        }
      }
      if (lit) { blur(G); blur(G); }
      if (hazy) { blur(HS); blur(HS); blur(HW); blur(HW); }
      for (let y = 0, i = 0; y < GH; y++) {
        const y0 = QY0[y] * QW, y1 = QY1[y] * QW, fy = QFY[y];
        for (let x = 0; x < GW; x++, i++) {
          const t = type[i], o = i * 4, b3 = i * 3;
          let r, g, b;
          if (heatView) {
            const T = temp[i], h = (Math.max(0, Math.min(255, (T + 140) / 1640 * 255)) | 0) * 3;
            const k = t ? (t * 8 + (shade[i] & 7)) * 3 : -1, m = t ? 0.25 : 0.12;
            const sr = t ? COL[k] : BACK[b3], sg = t ? COL[k + 1] : BACK[b3 + 1], sb = t ? COL[k + 2] : BACK[b3 + 2];
            px[o] = HEAT[h] * (1 - m) + sr * m; px[o + 1] = HEAT[h + 1] * (1 - m) + sg * m; px[o + 2] = HEAT[h + 2] * (1 - m) + sb * m; px[o + 3] = 255;
            continue;
          }
          if (t === EMPTY) { r = BACK[b3]; g = BACK[b3 + 1]; b = BACK[b3 + 2]; }
          else if (t === FIRE) {
            const l = life[i] + (shade[i] & 3), c = FIRECOL[l > 16 ? 3 : l > 11 ? 2 : l > 6 ? 1 : 0];
            r = c[0]; g = c[1]; b = c[2];
          } else if (t === LAVA) {
            const v = (shade[i] + ((frame + (shade[i] << 2)) >> 4)) & 7, k = (t * 8 + v) * 3;
            r = COL[k]; g = COL[k + 1]; b = COL[k + 2];
            const T = temp[i];
            if (T < 1100) { const f = Math.min(1, (1100 - T) / 350); r += (R9[0] - r) * f; g += (R9[1] - g) * f; b += (R9[2] - b) * f; }
          } else {
            let k = (t * 8 + (shade[i] & 7)) * 3;
            const above = y > 0 ? type[i - GW] : EMPTY;
            if (KIND[t] === LIQUID && (above === EMPTY || KIND[above] === GAS)) k = t * 3, r = SURF[k], g = SURF[k + 1], b = SURF[k + 2];
            else r = COL[k], g = COL[k + 1], b = COL[k + 2];
            if (ALPHA[t] < 1) {
              const a = t === SMOKE ? 0.3 : ALPHA[t];
              r = BACK[b3] + (r - BACK[b3]) * a; g = BACK[b3 + 1] + (g - BACK[b3 + 1]) * a; b = BACK[b3 + 2] + (b - BACK[b3 + 2]) * a;
            }
            if (burn[i]) {
              const c = (((shade[i] >> 2) + (frame >> 1)) & 3) < 2 ? R12 : R10, f = c === R12 ? 0.75 : 0.45;
              r += (c[0] - r) * f; g += (c[1] - g) * f; b += (c[2] - b) * f;
            } else if (temp[i] > 450 && t !== TORCH) {
              // hot things glow: dark red, then orange, then yellow
              const f = Math.min(1, (temp[i] - 450) / 800);
              if (f < 0.5) { const q = f * 1.6; r += (R10[0] - r) * q; g += (R10[1] - g) * q; b += (R10[2] - b) * q; }
              else { const q = (f - 0.5) * 2; r = R10[0] + (R13[0] - R10[0]) * q; g = R10[1] + (R13[1] - R10[1]) * q; b = R10[2] + (R13[2] - R10[2]) * q; }
            }
          }
          if (hazy) {
            const x0 = QX0[x], x1 = QX1[x], fx = QFX[x];
            let a = HS[y0 + x0] + (HS[y0 + x1] - HS[y0 + x0]) * fx, c2 = HS[y1 + x0] + (HS[y1 + x1] - HS[y1 + x0]) * fx;
            let q = (a + (c2 - a) * fy) * 0.09;
            if (q > 0.005) { q = q > 0.6 ? 0.6 : q; r += (RS[0] - r) * q; g += (RS[1] - g) * q; b += (RS[2] - b) * q; }
            a = HW[y0 + x0] + (HW[y0 + x1] - HW[y0 + x0]) * fx; c2 = HW[y1 + x0] + (HW[y1 + x1] - HW[y1 + x0]) * fx;
            q = (a + (c2 - a) * fy) * 0.16;
            if (q > 0.005) { q = q > 0.6 ? 0.6 : q; r += (RW[0] - r) * q; g += (RW[1] - g) * q; b += (RW[2] - b) * q; }
          }
          if (lit) {
            const x0 = QX0[x], x1 = QX1[x], fx = QFX[x];
            const a = G[y0 + x0] + (G[y0 + x1] - G[y0 + x0]) * fx, c2 = G[y1 + x0] + (G[y1 + x1] - G[y1 + x0]) * fx;
            const l = a + (c2 - a) * fy;
            if (l > 0.01) { const q = l > 2 ? 1 : l * 0.5; r += 120 * q; g += 62 * q; b += 22 * q; }
          }
          px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
        }
      }
      c.put(img);
      readout();
    }

    // ---- input: hold to pour, drag to draw a line; a readout names what's under the pointer ----
    let brush = 3, pen = SAND, down = false, last = null, ptr = null, hover = null, paused = false, steps = 0;
    function stamp(px0, py0) {
      const r = brush - 1, r2 = r * r + r * 0.8, k = KIND[pen];
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const x = px0 + dx, y = py0 + dy; if (!inb(x, y)) continue;
        const j = y * GW + x, tt = type[j];
        if (pen === EMPTY) { if (tt) set(j, EMPTY, AMB); continue; }
        if (k === SOLID) { if (tt !== pen) set(j, pen); continue; }
        if (pen === FIRE) { if (tt === EMPTY) { if (R() < 0.3) set(j, FIRE); } else if (IGN[tt] && temp[j] < IGN[tt] + 30) { temp[j] = IGN[tt] + 30; wake(x, y); } continue; }
        const fill = brush === 1 ? 1 : k === POWDER ? 0.25 : k === LIQUID ? 0.4 : 0.3;
        if ((tt === EMPTY || (KIND[tt] === GAS && k !== GAS)) && R() < fill) set(j, pen);
      }
    }
    function stroke() {
      const [x1, y1] = ptr, [x0, y0] = last || ptr;
      const d = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), n = Math.max(1, Math.ceil(d / Math.max(1, brush / 2)));
      for (let s = d ? 1 : 0; s <= n; s++) stamp(Math.round(x0 + (x1 - x0) * s / n), Math.round(y0 + (y1 - y0) * s / n));
      last = ptr;
    }
    c.cv.addEventListener('pointerdown', e => { e.preventDefault(); c.cv.setPointerCapture(e.pointerId); down = true; ptr = hover = c.at(e); last = null; stroke(); if (paused) draw(); });
    c.cv.addEventListener('pointermove', e => { hover = c.at(e); if (down) ptr = hover; });
    const end = () => { down = false; last = null; };
    c.cv.addEventListener('pointerup', end); c.cv.addEventListener('pointercancel', end);
    c.cv.addEventListener('pointerleave', () => { if (!down) hover = null; });
    const read = Kit.el('div', { class: 'sand-read' }, ' ');
    host.append(read);
    let shown = '';
    function readout() {
      let s = 'Hold or drag on the picture to pour ' + MATS[pen].label.toLowerCase();
      if (hover && inb(hover[0], hover[1])) {
        const i = hover[1] * GW + hover[0];
        s = MATS[type[i]].name + (burn[i] ? ', burning' : '') + '  ' + Math.round(temp[i]) + '°';
      }
      if (s !== shown) { read.textContent = s; shown = s; }
    }

    // the palette: swatches grouped by kind
    const pal = Kit.el('div', { class: 'sand-pal' });
    const swatches = [];
    for (const grp of ['Tools', 'Powders', 'Liquids', 'Gases', 'Solids', 'Energy']) {
      const sw = Kit.el('div', { class: 'sand-sw' });
      MATS.forEach((m, t) => {
        if (m.group !== grp) return;
        const rgb = Kit.RGB[m.cols[0]];
        const chip = Kit.el('i', { style: `background: rgb(${rgb.join(',')})` });
        const b = Kit.el('button', { type: 'button', 'aria-pressed': String(t === pen), title: m.label, on: { click: () => {
          pen = t; swatches.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        } } }, chip, m.label);
        swatches.push(b); sw.append(b);
      });
      pal.append(Kit.el('div', { class: 'sand-grp' }, Kit.el('b', {}, grp), sw));
    }
    host.append(pal);

    const bar = Kit.bar(host);
    bar.slider('Brush', 1, 8, 1, brush, v => { brush = v; });
    const pb = bar.button('Pause', () => { paused = !paused; pb.textContent = paused ? 'Play' : 'Pause'; });
    bar.button('Clear', () => { build(''); draw(); });
    bar.check('Heat view', heatView, v => { heatView = v; draw(); });
    const scenes = Object.keys(SCENES);
    bar.tabs(scenes, v => { build(v); draw(); }, scenes[0]);
    bar.note('160×120 cells in typed arrays, scanned bottom up with the direction flipped each row and a clock bit so a cell moves once a frame. ' +
      'Each cell carries a temperature that flows to its neighbors; freezing, boiling, melting, ignition and glassmaking all read it. ' +
      'Weights and acid rules follow The Powder Toy, viscosity and smoke follow Sandboxels, ice spreading follows Sandspiel. ' +
      '16×16 chunks with nothing moving or warming sleep. Per-cell work every frame, uploaded as one ImageData: drawPixels in Tycho, or a compute shader.');

    build(scenes[0]);
    // at most two simulation steps per drawn frame, so a slow phone slows down instead of falling behind
    Kit.loop(host, () => {
      if (steps >= 2) return;
      steps++;
      if (down && ptr) stroke();
      if (!paused) sim();
    }, draw, 60);
  });
})();
