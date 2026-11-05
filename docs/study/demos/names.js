// names.js: A naming language. A study demo, using people-shared.js.
// After Martin O'Leary: a language is a few phoneme sets, a syllable structure, restrictions and a spelling;
// meanings keep their morphemes, so a coast's places are named from what's there (ford, hill, wood) and can be glossed.
(() => {
  const { lang, calque, terrain, paintTerrain, cap } = StudyShared.people;
  Kit.register('names', { title: 'A naming language', fit: 'prebake' }, host => {
    const W = 80, H = 40, K = 2;
    const cv = Kit.canvas(host, W * K, H * K);
    cv.cv.style.cursor = 'pointer';
    let seed = 7, peopleSeed = 0, tab = 'Places', sel = 0, L, T, base, sites, river;
    const ctl = Kit.bar(host);
    ctl.seed(seed, s => { seed = s; peopleSeed = 0; sel = 0; build(); });
    ctl.button('New names', () => { peopleSeed++; show(); });
    const tabs = Kit.bar(host);
    tabs.tabs(['Places', 'People', 'Sounds'], t => { tab = t; show(); }, 'Places');
    const out = Kit.el('div', { style: 'margin-top:10px;font-size:13.5px;line-height:1.55;overflow-wrap:anywhere' });
    host.appendChild(out);

    // find a site for each kind of feature on the map
    function findSites() {
      const { biome, river: rv, h } = T, at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : biome[y * W + x]);
      const near = (x, y, rad, test) => { let n = 0; for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && test(yy * W + xx)) n++; } return n; };
      const cands = { ford: [], spring: [], hill: [], wood: [], lake: [], shore: [], marsh: [], farm: [] };
      for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
        const i = y * W + x, b = biome[i];
        const rn = near(x, y, 1, j => rv[j]);
        if (rv[i] && rn === 3 && near(x, y, 2, j => biome[j] <= 1) === 0) cands.ford.push([i, Kit.hash2(x, y, seed)]);
        if (rv[i] && rn <= 2 && h[i] > 0.3) cands.spring.push([i, -h[i]]);
        if (b === 5 || b === 6) cands.hill.push([i, -h[i]]);
        if (b === 4) cands.wood.push([i, -near(x, y, 2, j => biome[j] === 4)]);
        if (b > 1 && b !== 7 && near(x, y, 1, j => biome[j] === 7)) cands.lake.push([i, Kit.hash2(x, y, seed + 1)]);
        if (b === 2) cands.shore.push([i, Kit.hash2(x, y, seed + 2)]);
        if (b === 8) cands.marsh.push([i, -near(x, y, 1, j => biome[j] === 8)]);
        if (b === 3 && !rv[i]) cands.farm.push([i, -near(x, y, 2, j => biome[j] === 3) + Kit.hash2(x, y, seed + 4)]);
      }
      const out = [];
      const taken = i => out.some(s => Math.abs(s.x - i % W) + Math.abs(s.y - ((i / W) | 0)) < 9);
      for (const kind of ['ford', 'hill', 'wood', 'spring', 'lake', 'shore', 'marsh', 'farm', 'farm']) {
        const list = cands[kind].sort((a, b) => a[1] - b[1]);
        const hit = list.find(([i]) => !taken(i));
        if (!hit) continue;
        const i = hit[0], x = i % W, y = (i / W) | 0;
        // the qualifier comes from what is around the site, else from a seeded pick
        const r = Kit.rng(seed * 31 + out.length);
        const ctx = [];
        if (near(x, y, 3, j => biome[j] === 4)) ctx.push(r.pick(['oak', 'ash']));
        if (near(x, y, 3, j => biome[j] <= 1)) ctx.push('salt');
        if (h[i] > 0.4) ctx.push('high');
        if (near(x, y, 3, j => biome[j] === 6)) ctx.push('cold');
        if (near(x, y, 3, j => biome[j] === 8)) ctx.push('black');
        const free = ['white', 'red', 'old', 'new', 'long', 'holy', 'wolf', 'crow', 'iron'];
        let q = ctx.length && r() < 0.75 ? r.pick(ctx) : r.pick(free);
        if (out.some(s => s.q === q)) q = r.pick(free.filter(f => !out.some(s => s.q === f)));
        const head = kind === 'shore' ? r.pick(['shore', 'farm']) : kind === 'lake' ? r.pick(['lake', 'town']) : kind === 'farm' ? r.pick(['farm', 'field', 'town']) : kind;
        out.push({ x, y, kind, q, head, name: L.compound(q, head) });
      }
      return out;
    }

    function build() {
      L = lang(seed);
      T = terrain(W, H, seed, 'coast');
      base = paintTerrain(T, K, seed);
      sites = findSites();
      river = L.compound(Kit.rng(seed + 9).pick(['white', 'long', 'cold', 'old']), 'river');
      draw(); show();
    }

    function draw() {
      const pix = new Kit.Pix(base.w, base.h);
      pix.d.set(base.d);
      sites.forEach((s, k) => {
        const px = s.x * K, py = s.y * K, c = k === sel ? 11 : 7;
        // a pin: dark outline, a flat head, a point
        pix.rect(px - 2, py - 7, 5, 5, 0); pix.rect(px - 1, py - 6, 3, 3, c); pix.set(px, py - 2, 0); pix.set(px, py - 1, 0);
        if (k === sel) { pix.rect(px - 3, py - 8, 7, 1, 0); }
      });
      cv.put(pix);
    }

    const row = (b, rest) => Kit.el('div', {}, Kit.el('b', {}, b), ' ', Kit.el('span', { style: 'opacity:.72' }, rest));
    function show() {
      out.replaceChildren();
      if (tab === 'Places') {
        out.append(row('The ' + river, '"' + L.spell(L.m('river')) + '" is river'));
        sites.forEach((s, k) => {
          const d = row(s.name, `${s.q} + ${s.head}${s.head === s.kind ? '' : ' by the ' + s.kind} · in English, ${calque(s.q, s.head)}`);
          d.style.cursor = 'pointer';
          if (k === sel) d.style.color = Kit.PAL[12];
          d.addEventListener('click', () => { sel = k; draw(); show(); });
          out.append(d);
        });
      } else if (tab === 'People') {
        const r = Kit.rng(seed * 977 + peopleSeed);
        const trades = ['smith', 'baker', 'miller', 'fisher', 'weaver'];
        for (let n = 0; n < 7; n++) {
          const g = L.given(r), female = r() < 0.5;
          let fam, fg;
          if (L.surname === 'patronymic') {
            const p = L.given(r), w = female ? 'daughter' : 'son';
            fam = cap(p.name.toLowerCase() + L.spell(L.m(w))); fg = `${w} of ${p.gloss}`;
          } else if (L.surname === 'place') {
            const s = sites[Math.floor(r() * sites.length)];
            fam = cap(L.spell(L.m('of'))) + ' ' + s.name; fg = 'of ' + s.name;
          } else if (L.surname === 'trade') {
            const t = trades[Math.floor(r() * trades.length)];
            fam = cap(L.spell(L.m(t))); fg = t;
          } else {
            const q = ['iron', 'crow', 'wolf', 'ash', 'oak', 'red'][Math.floor(r() * 6)], hd = ['stone', 'hill', 'ford', 'wood'][Math.floor(r() * 4)];
            fam = L.compound(q, hd); fg = `house of ${q} ${hd}`;
          }
          out.append(row(g.name + ' ' + fam, `${g.gloss}, ${fg}`));
        }
        out.append(Kit.el('div', { style: 'opacity:.72;margin-top:6px' }, `Family names here are by ${L.surname === 'house' ? 'house (a name kept by a household)' : L.surname}. Tap the map for more.`));
      } else {
        const inv = L.inventory();
        out.append(row('Consonants', inv.consonants + ` (${L.cname})`), row('Vowels', inv.vowels + ' (capitals are long)'),
          row('Syllable', L.shape + ' (C consonant, V vowel, S sibilant, L liquid, F final; ? optional)'),
          row('Spelling', inv.spelling), row('Compounds', (L.headFirst ? 'head first (like Welsh Aber-, Llan-)' : 'head last (like English -ford, -by)') + ', joined ' + ({ '': 'solid', '-': 'with a hyphen', ' ': 'with a space', "'": 'with an apostrophe' })[L.joiner]),
          row('Words', ['river', 'hill', 'ford', 'wood', 'stone', 'farm', 'white', 'old'].map(g => `${g} ${L.spell(L.m(g))}`).join(' · ')));
      }
    }

    cv.cv.addEventListener('click', e => {
      const [x, y] = cv.at(e);
      let best = -1, bd = 64;
      sites.forEach((s, k) => { const d = (s.x * K - x) ** 2 + (s.y * K - 4 - y) ** 2; if (d < bd) { bd = d; best = k; } });
      if (best >= 0) { sel = best; tab === 'People' ? (peopleSeed++, show()) : show(); draw(); }
      else { peopleSeed++; show(); }
    });
    build();
  });
})();
