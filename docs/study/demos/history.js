// history.js: A world with a past. A study demo, using people-shared.js.
// Simulate, then summarize: three or four cultures, each shaped (not dictated) by the land it starts on, found towns,
// grow, trade, fight and raise shrines over three hundred years on a seeded island. Every event is kept with its year
// and the things it left on the map (a road, a ruin, a cairn), so the timeline can be scrubbed and any site asked why.
(() => {
  const { lang, terrain, paintTerrain, road, cap } = StudyShared.people;
  const YEARS = 300;
  const WAYS = {
    sea: { label: 'seafarers', likes: { trade: 2, freedom: 1 }, build: 'turf halls roofed with upturned boats' },
    river: { label: 'river farmers', likes: { faith: 1.5, kin: 1.5 }, build: 'wattle houses on raised banks' },
    hill: { label: 'herders', likes: { honor: 2, kin: 1 }, build: 'round stone houses' },
    wood: { label: 'foresters', likes: { craft: 2, freedom: 1 }, build: 'timber longhouses' },
    fen: { label: 'fen folk', likes: { faith: 2, craft: 1 }, build: 'houses on stilts' },
  };
  const VALUES = ['kin', 'faith', 'trade', 'honor', 'craft', 'freedom', 'learning'];
  const TABOOS = ['never cut a living oak', 'the dead go to the river', 'no guest eats without bringing a gift', 'the names of the dead are not said for a year',
    'iron may not touch a shrine stone', 'no well is refused to anyone', 'nothing is planted in the year of a death', 'no fire burns on the longest night'];
  const INK = [10, 22, 30, 12];

  Kit.register('history', { title: 'A world with a past', fit: 'prebake' }, host => {
    const W = 96, H = 60, K = 2;
    const cv = Kit.canvas(host, W * K, H * K);
    cv.cv.style.cursor = 'pointer';
    let seed = 12, year = YEARS - 1, playing = false, dirty = true, sel = null, world = null;
    const ctl = Kit.bar(host);
    ctl.seed(seed, s => { seed = s; sel = null; gen(); });
    const playBtn = ctl.button('Play', () => { playing = !playing; if (playing && year >= YEARS - 1) year = 0; playBtn.textContent = playing ? 'Pause' : 'Play'; });
    const slider = ctl.slider('Year', 0, YEARS - 1, 1, year, v => { year = v; playing = false; playBtn.textContent = 'Play'; dirty = true; listing(); });
    const timing = ctl.note('');
    const cards = Kit.el('div', { style: 'margin-top:10px;font-size:13px;line-height:1.5' });
    const info = Kit.el('div', { style: 'margin-top:8px;font-size:13px;line-height:1.5;min-height:1.5em' });
    const legends = Kit.el('div', { style: 'margin-top:6px;font-size:13px;line-height:1.5;max-height:15em;overflow-y:auto;border-top:1px solid #2f2b4a;padding-top:6px' });
    host.append(cards, info, legends);

    function gen() {
      const t0 = performance.now();
      const r = Kit.rng('history' + seed);
      const T = terrain(W, H, seed, 'island');
      const { biome, river } = T, N = W * H;
      const near = (i, rad, test) => { const x = i % W, y = (i / W) | 0; let n = 0; for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && test(yy * W + xx)) n++; } return n; };
      const BASE = [0, 0, 1, 3, 2, 1.5, 0, 0, 0.6];
      const score = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const b = biome[i];
        if (!BASE[b] || river[i]) continue;
        score[i] = BASE[b] + (near(i, 1, j => river[j]) ? 2 : 0) + (near(i, 2, j => biome[j] <= 1) ? 1.2 : 0) + (near(i, 1, j => biome[j] === 7) ? 1 : 0);
      }
      const dist2 = (a, b) => { const dx = a % W - b % W, dy = ((a / W) | 0) - ((b / W) | 0); return dx * dx + dy * dy; };

      // cultures: spread apart on good land; their way of life is read from the land around them
      const nC = r.chance(0.5) ? 3 : 4, cultures = [];
      const land = [...score.keys()].filter(i => score[i] > 3);
      for (let k = 0; k < nC && land.length; k++) {
        let best = -1, bs = -1;
        for (let t = 0; t < 80; t++) {
          const i = land[Math.floor(r() * land.length)];
          const d = cultures.length ? Math.min(...cultures.map(c => dist2(i, c.home))) : 400;
          const s = Math.min(d, 900) + score[i] * 20;
          if (s > bs) { bs = s; best = i; }
        }
        const env = { sea: near(best, 6, j => biome[j] <= 1) * 0.3, river: near(best, 6, j => river[j]) * 1.6, hill: near(best, 6, j => biome[j] >= 5 && biome[j] <= 6), wood: near(best, 6, j => biome[j] === 4) * 0.7, fen: near(best, 6, j => biome[j] === 8) * 1.4 };
        const way = Object.keys(env).sort((a, b) => env[b] - env[a])[0];
        const L = lang(seed * 13 + k);
        // values: the land leans on the draw but never decides it
        const vals = [];
        while (vals.length < 2) {
          const ws = VALUES.map(v => (vals.includes(v) ? 0 : 1 + (WAYS[way].likes[v] || 0)));
          let x = r() * ws.reduce((a, b) => a + b), j = 0;
          while ((x -= ws[j]) > 0) j++;
          vals.push(VALUES[j]);
        }
        const people = cap(L.spell(L.m('people')));
        cultures.push({ k, L, home: best, way, vals, taboo: TABOOS.filter(t => !cultures.some(o => o.taboo === t))[r.int(0, TABOOS.length - 1 - cultures.length)], name: people + (people.length < 5 ? 'i' : ''), ink: INK[k], rel: [], war: null, ruler: null });
      }
      for (const c of cultures) c.rel = cultures.map(() => 0);
      const has = (c, v) => c.vals.includes(v);

      const towns = [], shrines = [], battles = [], roads = [], events = [], roadGrid = new Uint8Array(N);
      const log = (y, text, refs = []) => events.push({ y, text, refs });
      const person = (c, born) => { const g = c.L.given(r); return { name: g.name, gloss: g.gloss, born, female: r() < 0.5 }; };
      const tName = (c, i, founder) => {
        const L = c.L, nb = (rad, t) => near(i, rad, t) > 0;
        const head = nb(1, j => river[j]) ? r.pick(['ford', 'bridge', 'river']) : nb(2, j => biome[j] <= 1) ? 'shore' : nb(1, j => biome[j] === 7) ? 'lake'
          : biome[i] >= 5 ? 'hill' : biome[i] === 4 ? 'wood' : biome[i] === 8 ? 'marsh' : r.pick(['farm', 'field', 'town']);
        for (let t = 0; t < 6; t++) {
          let name, gloss;
          if (founder && r() < 0.3) { name = cap(founder.name.toLowerCase() + L.joiner.trim() + L.spell(L.m(head))); gloss = `${founder.name}'s ${head}`; }
          else { const q = r.pick(['white', 'black', 'red', 'old', 'new', 'high', 'long', 'cold', 'holy', 'oak', 'ash', 'wolf', 'crow', 'salt', 'iron']); name = L.compound(q, head); gloss = `${q} ${head}`; }
          if (!towns.some(o => o.name === name)) return { name, gloss };
        }
        return { name: L.word(r), gloss: 'a name nobody remembers the meaning of' };
      };
      const ref = o => o.id;
      function found(c, i, y, parent) {
        const founder = person(c, y - r.int(20, 40));
        const nm = tName(c, i, founder);
        const t = { id: 't' + towns.length, kind: 'town', i, x: i % W, y: (i / W) | 0, ...nm, pop: parent ? 12 : 30, founded: y, fell: null, owners: [[y, c.k]], founder };
        towns.push(t);
        if (parent) {
          parent.pop -= 10;
          const p = road(T, parent.i, i, roadGrid);
          if (p) { p.forEach(j => (roadGrid[j] = 1)); roads.push({ y, p }); }
          log(y, `${founder.name} led families from ${parent.name} to found ${t.name} ("${t.gloss}").`, [ref(t), ref(parent)]);
        } else log(y, `The ${c.name}, ${WAYS[c.way].label}, raised their first hall at ${t.name} ("${t.gloss}").`, [ref(t)]);
        return t;
      }
      const owner = (t, y) => { let o = t.owners[0][1]; for (const [yy, k] of t.owners) if (yy <= y) o = k; return o; };
      const alive = (t, y) => t.founded <= y && (t.fell === null || t.fell > y);
      const shrine = (c, i, y, why, refs) => { const s = { id: 's' + shrines.length, kind: 'shrine', i, x: i % W, y: (i / W) | 0, year: y, c: c.k, why }; shrines.push(s); log(y, why, [ref(s), ...refs]); };
      const landNear = (i, rad) => { for (let t = 0; t < 40; t++) { const j = i + r.int(-rad, rad) + r.int(-rad, rad) * W; if (j >= 0 && j < N && score[j] > 0) return j; } return i; };

      for (const c of cultures) { found(c, c.home, 0, null); c.ruler = { ...person(c, -30), from: 0 }; }

      for (let y = 1; y < YEARS; y++) {
        const live = towns.filter(t => alive(t, y));
        // growth toward what the site can feed
        for (const t of live) {
          const capy = 30 + score[t.i] * 22;
          t.pop = Math.max(4, t.pop + 0.05 * t.pop * (1 - t.pop / capy) + r.range(-1.5, 1.5));
        }
        // daughter towns, on the best free site within a few days' walk
        for (const t of live) {
          if (towns.length >= 28 || t.pop < 34 || !r.chance(0.07)) continue;
          const c = cultures[owner(t, y)];
          let best = -1, bs = 0;
          for (let s = 0; s < 50; s++) {
            const j = t.i + r.int(-13, 13) + r.int(-13, 13) * W;
            if (j < 0 || j >= N || score[j] <= 1.5 || dist2(j, t.i) < 25) continue;
            if (towns.some(o => alive(o, y) && dist2(o.i, j) < 30)) continue;
            if (score[j] > bs) { bs = score[j]; best = j; }
          }
          if (best >= 0) found(c, best, y, t); else c.cramped = y;
        }
        // rulers die and are succeeded by a child
        for (const c of cultures) {
          const age = y - c.ruler.born;
          if (r.chance(age > 55 ? 0.08 : 0.015)) {
            const heir = { ...person(c, y - r.int(18, 35)), from: y };
            log(y, `${c.ruler.name} of the ${c.name} died; ${heir.name}, ${heir.female ? 'daughter' : 'son'} of ${c.ruler.name}, took the chair.`, []);
            c.ruler = heir;
          }
        }
        // neighbors: contact, trade, quarrels and wars
        for (let a = 0; a < cultures.length; a++) for (let b = a + 1; b < cultures.length; b++) {
          const A = cultures[a], B = cultures[b];
          const ta = live.filter(t => owner(t, y) === a), tb = live.filter(t => owner(t, y) === b);
          if (!ta.length || !tb.length) continue;
          let pair = null, pd = Infinity;
          for (const x of ta) for (const z of tb) { const d = dist2(x.i, z.i); if (d < pd) { pd = d; pair = [x, z]; } }
          if (pd > 22 * 22) continue;
          let d = r.range(-0.03, 0.03) + (has(A, 'trade') || has(B, 'trade') ? 0.012 : 0) - (has(A, 'honor') && has(B, 'honor') ? 0.02 : 0) - (pd < 100 ? 0.012 : 0);
          if (has(A, 'kin') !== has(B, 'kin')) d -= 0.006;
          if (y - (A.cramped ?? -99) < 8 || y - (B.cramped ?? -99) < 8) d -= 0.018; // land hunger
          const rel = (A.rel[b] = B.rel[a] = Math.max(-1, Math.min(1, A.rel[b] + d)));
          const war = A.war && A.war.with === b;
          if (!war && rel > 0.25 && !A.trade?.includes(b)) {
            A.trade = [...(A.trade || []), b]; B.trade = [...(B.trade || []), a];
            const p = road(T, pair[0].i, pair[1].i, roadGrid);
            if (p) { p.forEach(j => (roadGrid[j] = 1)); roads.push({ y, p }); }
            log(y, `Traders from ${pair[0].name} first walked the road to ${pair[1].name}; the ${A.name} and the ${B.name} began to trade.`, [ref(pair[0]), ref(pair[1])]);
          }
          if (!war && !A.war && !B.war && rel < -0.45 && r.chance(0.25)) {
            A.war = { with: b, since: y }; B.war = { with: a, since: y };
            log(y, `The ${A.name} and the ${B.name} went to war over the land between ${pair[0].name} and ${pair[1].name}.`, [ref(pair[0]), ref(pair[1])]);
          } else if (war) {
            if (r.chance(0.4)) {
              const [x, z] = pair, mid = landNear(Math.round((x.x + z.x) / 2) + Math.round((x.y + z.y) / 2) * W, 2);
              const xs = x.pop * r.range(0.5, 1.5), zs = z.pop * r.range(0.5, 1.5);
              const [win, lose, wc, lc] = xs > zs ? [x, z, A, B] : [z, x, B, A];
              const hero = person(lc, y - r.int(20, 45));
              const bt = { id: 'b' + battles.length, kind: 'battle', i: mid, x: mid % W, y: (mid / W) | 0, year: y, name: `the battle of ${lc.L.compound(r.pick(['red', 'black', 'crow', 'wolf']), 'field')}` };
              battles.push(bt);
              lose.pop *= 0.6;
              let what = '';
              if (lose.pop < 16 && r.chance(0.5)) { lose.fell = y; what = ` ${lose.name} was burned and left empty.`; }
              else if (r.chance(0.35)) { lose.owners.push([y, wc.k]); what = ` ${lose.name} passed to the ${wc.name}.`; }
              log(y, `At ${bt.name} the ${wc.name} of ${win.name} beat the ${lc.name}; ${hero.name} ("${hero.gloss}") fell there.${what}`, [ref(bt), ref(win), ref(lose)]);
              if (has(lc, 'faith') || has(lc, 'honor') || r.chance(0.3)) shrine(lc, mid, y + 1, `The ${lc.name} raised a cairn where ${hero.name} fell, at ${bt.name}.`, [ref(bt)]);
            }
            if (y - A.war.since > 3 && r.chance(0.15)) {
              A.war = B.war = null; A.rel[b] = B.rel[a] = 0;
              log(y, `The ${A.name} and the ${B.name} made peace at ${pair[r() < 0.5 ? 0 : 1].name}.`, [ref(pair[0]), ref(pair[1])]);
            }
          }
        }
        // floods and visions: the reasons shrines are where they are
        for (const t of live) {
          const c = cultures[owner(t, y)];
          if (near(t.i, 1, j => river[j]) && r.chance(0.006)) {
            t.pop *= 0.7;
            log(y, `The river rose and took a third of ${t.name}.`, [ref(t)]);
            if (has(c, 'faith') || r.chance(0.3)) { let j = t.i; for (let s = 0; s < 8; s++) { const up = [j - 1, j + 1, j - W, j + W].find(q => river[q] && T.h[q] > T.h[j]); if (up === undefined) break; j = up; } shrine(c, landNear(j, 1), y, `After the flood, the people of ${t.name} built a shrine upstream to keep the river kind.`, [ref(t)]); }
          }
          if (has(c, 'faith') && r.chance(0.004)) {
            let hill = -1;
            for (let s = 0; s < 30; s++) { const j = t.i + r.int(-6, 6) + r.int(-6, 6) * W; if (j >= 0 && j < N && (biome[j] === 5 || biome[j] === 6)) { hill = j; break; } }
            const seer = person(c, y - r.int(15, 60));
            if (hill >= 0) shrine(c, hill, y, `${seer.name} of ${t.name} saw a light on the hill; a shrine was raised there.`, [ref(t)]);
          }
        }
      }
      for (const t of towns) t.pop = Math.round(t.pop);
      const ms = performance.now() - t0;
      world = { T, base: paintTerrain(T, K, seed), cultures, towns, shrines, battles, roads, events, owner, alive };
      timing.textContent = `${YEARS} years, ${towns.length} towns, ${events.length} events, made in ${ms.toFixed(0)} ms.`;
      cards.replaceChildren(...cultures.map(c => Kit.el('div', {},
        Kit.el('span', { style: `display:inline-block;width:10px;height:10px;margin-right:6px;background:${Kit.PAL[c.ink]};border:1px solid #0e0b16` }),
        Kit.el('b', {}, 'The ' + c.name), ` ${WAYS[c.way].label}; value ${c.vals.join(' and ')}; build ${WAYS[c.way].build}; `, Kit.el('i', {}, c.taboo + '.'))));
      dirty = true; listing();
    }

    function draw() {
      const { base, towns, shrines, battles, roads, cultures, owner, alive } = world;
      const pix = new Kit.Pix(base.w, base.h);
      pix.d.set(base.d);
      for (const rd of roads) if (rd.y <= year) for (let k = 1; k < rd.p.length; k++) {
        const a = rd.p[k - 1], b = rd.p[k], ax = (a % W) * K, ay = ((a / W) | 0) * K, bx = (b % W) * K, by = ((b / W) | 0) * K;
        pix.set(ax, ay, 27); pix.set((ax + bx) >> 1, (ay + by) >> 1, 27);
      }
      const hi = o => sel && sel.id === o.id;
      for (const b of battles) if (b.year <= year) { const x = b.x * K, y = b.y * K; for (let d = -1; d <= 1; d++) { pix.set(x + d, y + d, 10); pix.set(x + d, y - d, 10); } }
      for (const s of shrines) if (s.year <= year) { const x = s.x * K, y = s.y * K; pix.rect(x - 1, y - 4, 3, 5, 0); pix.rect(x, y - 3, 1, 3, hi(s) ? 13 : 6); }
      for (const t of towns) {
        if (t.founded > year) continue;
        const x = t.x * K, y = t.y * K;
        if (!alive(t, year)) { pix.rect(x - 2, y - 2, 5, 3, 0); pix.set(x - 1, y - 1, 4); pix.set(x + 1, y - 1, 3); continue; }
        const c = cultures[owner(t, year)], big = t.pop > 50 && year - t.founded > 40;
        const w = big ? 5 : 3;
        pix.rect(x - (w >> 1) - 1, y - 3, w + 2, 5, 0);
        pix.rect(x - (w >> 1), y - 2, w, 2, hi(t) ? 13 : c.ink);
        pix.rect(x - (w >> 1), y, w, 1, 7);
        pix.set(x, y, 0);
        if (big) { pix.set(x - 2, y, 0); pix.set(x, y - 3, 0); }
      }
      cv.put(pix);
    }

    function listing() {
      if (!world) return;
      const { events } = world;
      const shown = [];
      for (let k = events.length - 1; k >= 0 && shown.length < 60; k--) if (events[k].y <= year) shown.push(events[k]);
      legends.replaceChildren(...shown.map(e => Kit.el('div', { style: sel && e.refs.includes(sel.id) ? `color:${Kit.PAL[12]}` : '' }, Kit.el('b', {}, 'Year ' + e.y + ' '), e.text)));
      if (!sel) { info.textContent = 'Tap a town, shrine or battlefield to ask why it is there.'; return; }
      const mine = events.filter(e => e.refs.includes(sel.id));
      info.replaceChildren(Kit.el('b', {}, sel.kind === 'town' ? `${sel.name} ("${sel.gloss}")` : sel.kind === 'shrine' ? 'A shrine' : cap(sel.name)), ': ',
        ...mine.map((e, k) => Kit.el('span', {}, (k ? ' Then, in ' : 'In ') + e.y + ': ' + e.text + ' ')));
    }

    cv.cv.addEventListener('click', e => {
      if (!world) return;
      const [px, py] = cv.at(e);
      let best = null, bd = 50;
      for (const o of [...world.towns.filter(t => t.founded <= year), ...world.shrines.filter(s => s.year <= year), ...world.battles.filter(b => b.year <= year)]) {
        const d = (o.x * K - px) ** 2 + (o.y * K - 2 - py) ** 2;
        if (d < bd) { bd = d; best = o; }
      }
      sel = best; dirty = true; listing();
    });

    Kit.loop(host, () => {
      if (!playing) return;
      year = Math.min(YEARS - 1, year + 1);
      slider.value = year; slider.nextElementSibling.textContent = String(year);
      if (year >= YEARS - 1) { playing = false; playBtn.textContent = 'Play'; }
      dirty = true; if (year % 5 === 0 || !playing) listing();
    }, () => { if (dirty && world) { draw(); dirty = false; } }, 24);
    gen();
  });
})();
