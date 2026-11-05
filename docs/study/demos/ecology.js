// ecology.js: Who lives where, and how many. A study demo, using animals-shared.js.
// A small map of biomes from height and moisture, and eight species placed on it by rules like Dwarf Fortress's
// creature tokens: the biomes each lives in, a height range, how far from water it strays, a cluster size.
// How many of each comes from body mass: plant eaters by Damuth's density rule (density falls as mass^-0.75),
// meat eaters by Carbone and Gittleman's (about 90 kg of a carnivore per 10,000 kg of its prey). The pyramid
// shows the biomass at each level; the graph runs a hare-and-lynx cycle over forty years of seasons
// (Rosenzweig-MacArthur, the Lotka-Volterra model with a food limit), where more food makes wilder swings.
(() => {
  const { BIOMES, text, textW, clamp } = StudyShared.animals;
  Kit.register('ecology', { title: 'Who lives where, and how many', fit: 'prebake' }, host => {
    const MW = 96, MH = 50, CZ = 2, W = MW * CZ, H = 168, PY = 104;
    const c = Kit.canvas(host, W, H);
    c.cv.style.cursor = 'crosshair';
    let seed = 5, K = 1.6, sel = -1;
    let biome, elev, wdist, placed, counts;
    const B_NAMES = ['Water', 'Marsh', 'Meadow', 'Forest', 'Desert', 'Snow'];
    const B_INK = [21, BIOMES.Marsh.ground, BIOMES.Meadow.ground, BIOMES.Forest.ground, BIOMES.Desert.ground, BIOMES.Snow.ground];
    const B_MARK = [22, 21, 17, 14, 13, 7];
    // the species, as rules: biomes (with a weight), height range, the farthest from water, cluster size, mass, level, ink
    const SPECIES = [
      { name: 'grazer', biomes: { Meadow: 1, Forest: 0.4 }, elev: [0, 0.72], water: 12, cluster: [5, 12], mass: 60, level: 1, ink: 28 },
      { name: 'hare', biomes: { Meadow: 1, Desert: 0.5, Snow: 0.6, Forest: 0.3 }, elev: [0, 1], water: 99, cluster: [1, 2], mass: 2, level: 1, ink: 7 },
      { name: 'ibex', biomes: { Snow: 1, Meadow: 0.2 }, elev: [0.6, 1], water: 99, cluster: [3, 8], mass: 50, level: 1, ink: 4 },
      { name: 'heron', biomes: { Marsh: 1 }, elev: [0, 0.5], water: 1, cluster: [1, 3], mass: 1.5, level: 2, ink: 25, eats: ['fish'] },
      { name: 'fish', biomes: { Water: 1 }, elev: [0, 1], water: 0, cluster: [6, 14], mass: 0.5, level: 1, ink: 24, aquatic: true },
      { name: 'skink', biomes: { Desert: 1 }, elev: [0, 0.7], water: 99, cluster: [1, 1], mass: 0.08, level: 1, ink: 11 },
      { name: 'wolf', biomes: { Meadow: 1, Forest: 1, Snow: 0.6 }, elev: [0, 0.9], water: 99, cluster: [3, 6], mass: 40, level: 2, ink: 0, eats: ['grazer', 'ibex'] },
      { name: 'fox', biomes: { Meadow: 1, Forest: 0.8, Desert: 0.6, Snow: 0.5 }, elev: [0, 0.9], water: 99, cluster: [1, 2], mass: 6, level: 2, ink: 12, eats: ['hare', 'skink'] },
    ];

    function gen() {
      const r = Kit.rng(seed);
      biome = new Uint8Array(MW * MH); elev = new Float32Array(MW * MH); wdist = new Int16Array(MW * MH).fill(999);
      const q = [];
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        const i = y * MW + x;
        const e = clamp(0.5 + 0.55 * Kit.fbm(x / 34, y / 34, seed, 4) + 0.25 * (x / MW - 0.5), 0, 1);
        const m = 0.5 + 0.6 * Kit.fbm(x / 26 + 40, y / 26, seed + 7, 3);
        elev[i] = e;
        let b;
        if (e < 0.34) b = 0; else if (e > 0.74) b = 5; else if (e < 0.42 && m > 0.45) b = 1; else if (m > 0.58) b = 3; else if (m < 0.36) b = 4; else b = 2;
        biome[i] = b;
        if (b === 0) { wdist[i] = 0; q.push(i); }
      }
      // distance to water: breadth-first from every water cell
      for (let h = 0; h < q.length; h++) {
        const i = q[h], x = i % MW, y = (i / MW) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
          const j = ny * MW + nx; if (wdist[j] > wdist[i] + 1) { wdist[j] = wdist[i] + 1; q.push(j); }
        }
      }
      place(r);
    }
    const fits = (s, i) => {
      const bw = s.biomes[B_NAMES[biome[i]]] || 0;
      if (!bw || elev[i] < s.elev[0] || elev[i] > s.elev[1] || wdist[i] > s.water) return 0;
      if (!s.aquatic && biome[i] === 0) return 0;
      return bw;
    };
    // how many: plant eaters by density ~ mass^-0.75 over their habitat; meat eaters from their prey's biomass
    function place(r) {
      counts = {}; placed = [];
      const habitat = SPECIES.map(s => { let a = 0; for (let i = 0; i < MW * MH; i++) a += fits(s, i); return a; });
      SPECIES.forEach((s, k) => {
        if (s.level !== 1) return;
        counts[s.name] = Math.round(habitat[k] * 2.5 * Math.pow(s.mass, -0.75)); // individuals per habitat cell, scaled for the demo
      });
      SPECIES.forEach(s => {
        if (s.level !== 2) return;
        const prey = s.eats.reduce((sum, n) => sum + counts[n] * SPECIES.find(p => p.name === n).mass, 0);
        counts[s.name] = Math.max(prey > 0 ? 1 : 0, Math.round(prey * 0.009 / s.mass)); // Carbone and Gittleman: 90 kg per 10,000 kg of prey
      });
      SPECIES.forEach((s, k) => {
        // a dot is one animal, or ten or a hundred of the small and many, so the map stays readable
        s.per = counts[s.name] > 3000 ? 100 : counts[s.name] > 300 ? 10 : 1;
        const cells = [], wts = []; let tot = 0;
        for (let i = 0; i < MW * MH; i++) { const f = fits(s, i); if (f) { cells.push(i); tot += f; wts.push(tot); } }
        let left = Math.ceil(counts[s.name] / s.per), guard = 0;
        while (left > 0 && cells.length && guard++ < 5000) {
          const u = r() * tot; let lo = 0, hi = wts.length - 1;
          while (lo < hi) { const m = (lo + hi) >> 1; if (wts[m] < u) lo = m + 1; else hi = m; }
          const ci = cells[lo], n = Math.min(left, s.per > 1 ? 1 : r.int(s.cluster[0], s.cluster[1]));
          for (let j = 0; j < n; j++) {
            const x = (ci % MW) * CZ + r.int(-3, 4), y = ((ci / MW) | 0) * CZ + r.int(-3, 4);
            const cx = clamp(Math.floor(x / CZ), 0, MW - 1), cy = clamp(Math.floor(y / CZ), 0, MH - 1);
            if (!fits(s, cy * MW + cx) || y >= MH * CZ || x < 0 || x >= W) continue;
            placed.push({ x, y, k });
            left--;
          }
        }
      });
    }

    // Rosenzweig-MacArthur with seasons: prey grow toward K (more in summer), predators eat with a saturating appetite
    function cycle() {
      const r0 = 2.7, a = 12, h = 0.2, e = 0.3, m = 0.75, s = 0.15, dt = 0.002;
      let Hh = 0.5, L = 0.12; const out = [];
      for (let t = 0, k = 0; t < 60; t += dt, k++) {
        const f = a * Hh / (1 + a * h * Hh);
        const dH = r0 * Hh * (1 - Hh / K) * (1 + s * Math.sin(2 * Math.PI * t)) - f * L, dL = e * f * L - m * L;
        Hh = Math.max(1e-4, Hh + dH * dt); L = Math.max(1e-4, L + dL * dt);
        if (t >= 20 && k % 50 === 0) out.push([t - 20, Hh, L]); // skip twenty years of settling in
      }
      return out;
    }

    function draw() {
      const p = new Kit.Pix(W, H).fill(1);
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        const i = y * MW + x, b = biome[i];
        let ink = B_INK[b];
        for (let dy = 0; dy < CZ; dy++) for (let dx = 0; dx < CZ; dx++) {
          const hh = Kit.hash2(x * CZ + dx, y * CZ + dy, seed + 3);
          p.set(x * CZ + dx, y * CZ + dy, hh < (b === 3 ? 0.35 : 0.08) ? B_MARK[b] : ink);
        }
      }
      for (const a of placed) {
        const s = SPECIES[a.k];
        if (sel >= 0 && sel !== a.k) continue;
        p.set(a.x, a.y, s.ink);
      }
      // the pyramid: biomass at each level, bars on a log scale (each step down the bars is about ten times)
      const herb = SPECIES.filter(s => s.level === 1).reduce((t, s) => t + counts[s.name] * s.mass, 0);
      const carn = SPECIES.filter(s => s.level === 2).reduce((t, s) => t + counts[s.name] * s.mass, 0);
      const plants = herb * 10; // Lindeman's ten percent, read backward
      const lvls = [['MEAT', carn, 11], ['GRAZE', herb, 28], ['PLANT', plants, 16]];
      const top = PY + 6, bx = 36;
      text(p, 'BIOMASS', 4, PY, 5);
      const lg = v => Math.max(1, Math.log10(Math.max(1, v)));
      const maxL = lg(plants);
      lvls.forEach(([name, v, ink], j) => {
        const w = Math.max(2, Math.round(60 * lg(v) / maxL)), y = top + 4 + j * 14;
        p.rect(bx - Math.floor(w / 2), y, w, 8, ink);
        const label = name + ' ' + (v >= 1000 ? Math.round(v / 1000) + 'K' : String(Math.round(v))) + ' KG';
        text(p, label, Math.max(2, bx - Math.floor(textW(label) / 2)), y + 9, 6);
      });
      // the cycle: prey and predators over forty years, scaled to the panel
      const gx = 74, gy = PY + 2, gw = W - gx - 4, gh = H - gy - 12;
      p.rect(gx, gy, gw, gh, 0);
      const data = cycle(), years = 40, maxV = Math.max(...data.map(d => Math.max(d[1], d[2] * 2))) * 1.05;
      for (let yr = 0; yr <= years; yr += 10) { const x = gx + Math.round(yr / years * (gw - 1)); for (let y = gy; y < gy + gh; y += 2) p.set(x, y, 2); }
      let last = [null, null];
      for (const [t, Hh, L] of data) {
        if (t > years) break;
        const x = gx + Math.round(t / years * (gw - 1));
        [[Hh, 29], [L * 2, 11]].forEach(([v, ink], j) => {
          const y = gy + gh - 1 - Math.round(v / maxV * (gh - 2));
          if (last[j] !== null) for (let yy = Math.min(last[j], y); yy <= Math.max(last[j], y); yy++) p.set(x, yy, ink);
          last[j] = y;
        });
      }
      p.rect(gx + 1, gy + 1, 56, 7, 0);
      text(p, 'HARES', gx + 2, gy + 2, 29); text(p, 'LYNX X2', gx + 26, gy + 2, 11);
      text(p, '40 YEARS', gx + gw - textW('40 YEARS') - 1, gy + gh + 3, 5);
      c.put(p);
    }

    const info = Kit.el('div', { style: 'margin-top:8px;font-size:13px;line-height:1.5;min-height:3em' });
    const legend = Kit.el('div', { style: 'margin-top:6px;font-size:13px;line-height:1.6' });
    function showLegend() {
      legend.replaceChildren(...SPECIES.map((s, k) => {
        const sw = Kit.el('span', { style: `display:inline-block;width:10px;height:10px;margin-right:4px;vertical-align:-1px;background:${Kit.PAL[s.ink]};outline:1px solid #4a4566` });
        const b = Kit.el('button', { type: 'button', 'aria-pressed': String(sel === k), style: 'margin:0 4px 4px 0', on: { click: () => { sel = sel === k ? -1 : k; showLegend(); draw(); } } }, sw, `${s.name} ${counts[s.name]}${s.per > 1 ? ' (a dot is ' + s.per + ')' : ''}`);
        return b;
      }));
    }
    c.cv.addEventListener('click', e => {
      const [x, y] = c.at(e);
      if (y >= MH * CZ) return;
      const i = clamp(Math.floor(y / CZ), 0, MH - 1) * MW + clamp(Math.floor(x / CZ), 0, MW - 1);
      const here = SPECIES.filter(s => fits(s, i)).map(s => s.name);
      info.textContent = `${B_NAMES[biome[i]]}, height ${elev[i].toFixed(2)}, ${wdist[i] === 0 ? 'in the water' : wdist[i] + ' cells from water'}: ${here.length ? here.join(', ') : 'nothing lives here'}.`;
    });
    const b1 = Kit.bar(host);
    b1.seed(seed, s => { seed = s; sel = -1; gen(); showLegend(); draw(); info.textContent = 'Tap the map to see who can live there.'; });
    b1.slider('Food for hares', 0.6, 3, 0.1, K, v => { K = v; draw(); });
    host.append(legend, info);
    info.textContent = 'Tap the map to see who can live there.';
    gen(); showLegend(); draw();
  });
})();
