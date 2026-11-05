// people-shared.js: the helpers the people demos share (names, history, schedules), loaded before any of them.
// A naming language after Martin O'Leary's "Generating naming languages" (phoneme sets, a syllable structure,
// restrictions, a spelling, and morphemes kept by meaning so names can be glossed), a small seeded terrain
// with rivers, a cost-based road finder, and a tiny villager sprite. Every random choice comes from Kit.rng or
// Kit.hash2, so a seed always rebuilds the same language, map and people.
(() => {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  // ---- the naming language ----
  // Phonemes are single characters: IPA where English spelling is ambiguous (ʃ ʒ ʧ ʤ ŋ x ɣ ʔ),
  // capitals for long vowels. The sets are O'Leary's kind: small, and each one a recognizable sound.
  const CONS = [
    ['minimal', 'ptkmnls'], ['english-ish', 'ptkbdgmnlrsʃzʧ'], ['soft', 'ptkmnh'], ['island', 'hklmnpwʔ'],
    ['northern', 'ptkqvsgrmnŋlj'], ['desert', 'tksʃdbqɣxmnlrwj'], ['plain', 'ptkbdgmnszʒʧhjw'], ['ridge', 'tkdgmnsʃrlvz'],
  ];
  const VOWS = [['five', 'aeiou'], ['three', 'aiu'], ['long', 'aeiouAEIOU'], ['open', 'aeiouaeiouAE'], ['back', 'aeouOU']];
  const SIBS = ['s', 'sʃ', 'sʃf'], LIQS = ['rl', 'r', 'l', 'wj', 'rlwj'], FINS = ['mn', 'sk', 'mnŋ', 'sʃzʒ', 'nrl'];
  const SHAPES = ['CVC', 'CVV?C', 'CVVC?', 'CVC?', 'CV', 'C?VC', 'CVF', 'CVF?', 'CL?VC', 'CL?VF', 'S?CVC', 'S?CVF', 'C?VF', 'C?VC?', 'C?L?VC', 'CVL?C?', 'C?VLC?'];
  const RESTRICT = [/(.)\1/, /[sʃf][sʃ]/, /[rl][rl]/, /[ʔh][^aeiouAEIOU]/];
  // spellings: each language picks one row per sound that has a choice.
  const CORTHO = {
    'ʃ': ['sh', 'sch', 'x', 'sj', 'š'], 'ʒ': ['zh', 'j', 'zj', 'ž'], 'ʧ': ['ch', 'tsch', 'c', 'tj', 'č'],
    'ʤ': ['j', 'dz', 'dj'], 'j': ['y', 'j', 'i'], 'x': ['kh', 'ch', 'x'], 'ŋ': ['ng', 'ñ', 'nh'], 'ɣ': ['gh', 'g', 'ǧ'], 'ʔ': ["'", '’', 'h'],
  };
  const VORTHO = { A: ['á', 'aa', 'â', 'ä'], E: ['é', 'ee', 'ê', 'ë'], I: ['í', 'ii', 'î', 'y'], O: ['ó', 'oo', 'ô', 'ö'], U: ['ú', 'uu', 'û', 'w'] };
  const JOINERS = ['', '', '-', ' ', "'"];

  // Meanings the demos ask for. Geographic heads, qualifiers, and the elements of personal names.
  const HEADS = ['river', 'hill', 'ford', 'wood', 'stone', 'lake', 'field', 'marsh', 'spring', 'farm', 'town', 'shore', 'bridge'];
  const QUALS = ['white', 'black', 'red', 'old', 'new', 'high', 'long', 'cold', 'holy', 'oak', 'ash', 'wolf', 'crow', 'salt', 'iron'];
  const NAMEPARTS = ['bright', 'wolf', 'stone', 'gift', 'peace', 'wise', 'raven', 'gold', 'hope', 'bear', 'sea', 'ember', 'oath', 'swift', 'kin', 'dawn'];
  // How an English place-namer would say the same thing: Old English and Norse elements (see the page's sources).
  const OE = {
    river: 'burn', hill: 'don', ford: 'ford', wood: 'ley', stone: 'stan', lake: 'mere', field: 'field', marsh: 'fen',
    spring: 'well', farm: 'by', town: 'bury', shore: 'sea', bridge: 'bridge',
    white: 'whit', black: 'black', red: 'red', old: 'ald', new: 'new', high: 'high', long: 'long', cold: 'cold',
    holy: 'holy', oak: 'ock', ash: 'ash', wolf: 'wool', crow: 'crow', salt: 'salt', iron: 'iron',
  };

  function lang(seed) {
    const r = Kit.rng('lang' + seed);
    const [cname, cons] = r.pick(CONS), [vname, vows] = r.pick(VOWS);
    const L = {
      seed, cname, vname, C: cons, V: vows, S: r.pick(SIBS), Lq: r.pick(LIQS), F: r.pick(FINS), shape: r.pick(SHAPES),
      cortho: {}, vortho: {}, joiner: r.pick(JOINERS), headFirst: r.chance(0.35),
      surname: r.pick(['patronymic', 'place', 'trade', 'house']), morphs: {}, used: new Set(),
      minSyl: r.chance(0.5) ? 1 : 2, maxSyl: 0,
    };
    L.maxSyl = L.minSyl + r.int(1, 2);
    for (const k in CORTHO) L.cortho[k] = r.pick(CORTHO[k]);
    for (const k in VORTHO) L.vortho[k] = r.pick(VORTHO[k]);
    // a morpheme is one or two syllables that obey the structure and the restrictions
    const syll = rr => {
      for (let tries = 0; tries < 50; tries++) {
        let s = '';
        for (let i = 0; i < L.shape.length; i++) {
          const k = L.shape[i];
          if (L.shape[i + 1] === '?') { i++; if (rr() < 0.5) continue; }
          const set = k === 'C' ? L.C : k === 'V' ? L.V : k === 'S' ? L.S : k === 'L' ? L.Lq : L.F;
          s += set[Math.floor(rr() * set.length)];
        }
        if (s && !RESTRICT.some(re => re.test(s))) return s;
      }
      return L.C[0] + L.V[0];
    };
    const morph = (rr, n) => {
      for (let tries = 0; tries < 60; tries++) {
        let m = '';
        for (let i = 0; i < n; i++) m += syll(rr);
        if (!RESTRICT.some(re => re.test(m)) && !L.used.has(m)) { L.used.add(m); return m; }
      }
      return syll(rr) + syll(rr);
    };
    // the same meaning always gives the same morpheme, so "river" reads the same in every name
    L.m = gloss => {
      if (!L.morphs[gloss]) L.morphs[gloss] = morph(Kit.rng(seed + ':' + gloss), gloss.length > 4 && Kit.hash2(gloss.length, seed, 3) < 0.2 ? 2 : 1);
      return L.morphs[gloss];
    };
    L.spell = ph => {
      let s = '';
      for (const c of ph) s += L.cortho[c] || L.vortho[c] || c;
      return s;
    };
    // a compound of meanings: qualifier + head, or head + qualifier in a head-first language (like Welsh Aber-, Llan-)
    L.compound = (qual, head) => {
      const a = L.spell(L.m(qual)), b = L.spell(L.m(head));
      const parts = L.headFirst ? [b, a] : [a, b];
      return cap(parts[0] + L.joiner + (L.joiner === ' ' ? cap(parts[1]) : parts[1]));
    };
    // a meaningless name: a few syllables, for people whose names are just names
    L.word = rr => cap(L.spell(morph(rr, L.minSyl + Math.floor(rr() * (L.maxSyl - L.minSyl + 1)))));
    // a personal name of two meaningful elements, as Old English and Germanic names were (Ælf-red, "elf counsel")
    L.given = rr => {
      const a = NAMEPARTS[Math.floor(rr() * NAMEPARTS.length)];
      let b = NAMEPARTS[Math.floor(rr() * NAMEPARTS.length)];
      if (b === a) b = NAMEPARTS[(NAMEPARTS.indexOf(a) + 3) % NAMEPARTS.length];
      return { name: cap(L.spell(L.m(a) + L.m(b))), gloss: a + '-' + b };
    };
    L.inventory = () => ({
      consonants: [...new Set(L.C + L.S + L.Lq + L.F)].join(' '),
      vowels: [...new Set(L.V)].join(' '),
      spelling: [...new Set(L.C + L.S + L.Lq + L.F + L.V)].filter(c => L.cortho[c] || L.vortho[c]).map(c => c + ' = ' + (L.cortho[c] || L.vortho[c])).join(', ') || 'as written',
    });
    // every meaning the demos use, made once in a fixed order, so a language is the same whatever asks first
    for (const g of [...HEADS, ...QUALS, ...NAMEPARTS, 'people', 'son', 'daughter', 'of', 'smith', 'baker', 'miller', 'fisher', 'weaver', 'priest', 'herder', 'trader', 'farmer']) L.m(g);
    return L;
  }
  // an English calque of a two-part name, for the gloss: white + farm = Whitby
  const calque = (qual, head) => cap((OE[qual] || qual) + (OE[head] || head));

  // ---- terrain ----
  // A small seeded height field with sea, hills, woods, marsh and rivers that run downhill to the sea or a lake.
  // shape 'island' sinks the edges; 'coast' puts the sea along the left and bottom.
  function terrain(W, H, seed, shape = 'island') {
    const N = W * H, h = new Float32Array(N), m = new Float32Array(N), biome = new Uint8Array(N), river = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = x / W, ny = y / H, i = y * W + x;
      let v = Kit.fbm(nx * 3.2, ny * 3.2 * H / W, seed, 5) * 0.9;
      if (shape === 'island') { const dx = nx - 0.5, dy = (ny - 0.5) * H / W; v += 0.42 - 2.6 * (dx * dx + dy * dy); }
      else v += 0.3 - 0.55 * Math.max(0, 0.35 - nx) * 3 - 0.55 * Math.max(0, ny - 0.75) * 4;
      h[i] = v;
      m[i] = Kit.fbm(nx * 2.5 + 9, ny * 2.5, seed + 77, 3);
    }
    // rivers: from seeded high cells, step to the lowest neighbor until the sea; a pit becomes a small lake
    const order = [];
    for (let i = 0; i < N; i++) if (h[i] > 0.42) order.push(i);
    order.sort((a, b) => Kit.hash2(a, 1, seed) - Kit.hash2(b, 1, seed));
    let made = 0;
    for (const s of order) {
      if (made >= Math.max(3, Math.round(N / 900))) break;
      let i = s, len = 0;
      const path = [];
      while (h[i] > 0 && len < W + H) {
        path.push(i);
        const x = i % W, y = (i / W) | 0;
        let best = -1, bh = h[i];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (river[j] && j !== i) { best = j; bh = -9; break; }
          if (h[j] < bh) { bh = h[j]; best = j; }
        }
        if (best < 0) { for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) biome[yy * W + xx] = 7; } break; }
        if (bh === -9) { path.push(best); break; }
        i = best; len++;
      }
      if (path.length > 6) { for (const j of path) river[j] = 1; made++; }
    }
    // biomes: 0 sea, 1 shallows, 2 beach, 3 grass, 4 wood, 5 hill, 6 mountain, 7 lake, 8 marsh
    for (let i = 0; i < N; i++) {
      if (biome[i] === 7) { river[i] = 0; continue; }
      const v = h[i];
      biome[i] = v < -0.08 ? 0 : v < 0 ? 1 : v < 0.03 ? 2 : v > 0.62 ? 6 : v > 0.45 ? 5 : m[i] > 0.28 && v < 0.12 ? 8 : m[i] > 0.05 ? 4 : 3;
    }
    return { W, H, h, m, biome, river, water: i => biome[i] <= 1 || biome[i] === 7 };
  }
  // paint a terrain into a Pix at `k` pixels a cell: flat inks, a dark coastline, a few bold marks (trees, hills)
  const FILL = [21, 22, 29, 17, 16, 28, 4, 22, 15];
  function paintTerrain(T, k, seed) {
    const { W, H, biome, river } = T, pix = new Kit.Pix(W * k, H * k);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, b = biome[i];
      let c = FILL[b];
      if (b === 3 && Kit.hash2(x, y, seed) < 0.5) c = 18;
      if (river[i]) c = 23;
      pix.rect(x * k, y * k, k, k, c);
    }
    // coastline: a dark pixel row wherever land meets sea
    const land = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? true : biome[y * W + x] > 1 && biome[y * W + x] !== 7;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (land(x, y)) continue;
      if (land(x, y - 1)) pix.rect(x * k, y * k, k, 1, 1);
      if (land(x - 1, y)) pix.rect(x * k, y * k, 1, k, 1);
      if (land(x + 1, y)) pix.rect(x * k + k - 1, y * k, 1, k, 1);
      if (land(x, y + 1)) pix.rect(x * k, y * k + k - 1, k, 1, 1);
    }
    // marks: trees in woods, ridges on hills, peaks on mountains, reeds in marsh, every few cells by hash
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const b = biome[y * W + x], hv = Kit.hash2(x, y, seed + 3), px = x * k, py = y * k;
      if (river[y * W + x]) continue;
      if (b === 4 && hv < 0.3 && (x + y) % 2) { pix.set(px + 1, py, 14); pix.rect(px, py + 1, 3, 1, 14); pix.set(px + 1, py + 1, 15); }
      else if (b === 5 && hv < 0.14) { pix.set(px + 1, py, 29); pix.set(px, py + 1, 27); pix.set(px + 2, py + 1, 27); }
      else if (b === 6 && hv < 0.2) { pix.set(px + 1, py, 6); pix.set(px, py + 1, 2); pix.set(px + 2, py + 1, 2); }
      else if (b === 8 && hv < 0.3) pix.set(px + 1, py, 23);
    }
    return pix;
  }

  // ---- roads ----
  // Dijkstra over cells with a cost per step: hills, woods and marsh cost more, crossing a river costs a lot
  // (so roads gather at fords), sea can't be crossed, and an existing road is cheap (so roads join up).
  const STEP = [1, 1, 1.2, 1, 2.2, 3.2, 9, Infinity, 4];
  function road(T, from, to, roads) {
    const { W, H, biome, river } = T, N = W * H, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
    const heap = [];
    const push = (i, d) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const a = 2 * k + 1, b = a + 1; let s = k; if (a < heap.length && heap[a][0] < heap[s][0]) s = a; if (b < heap.length && heap[b][0] < heap[s][0]) s = b; if (s === k) break; [heap[s], heap[k]] = [heap[k], heap[s]]; k = s; } } return top; };
    dist[from] = 0; push(from, 0);
    while (heap.length) {
      const [d, i] = pop();
      if (i === to) break;
      if (d > dist[i]) continue;
      const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        let c = STEP[biome[j]] ?? Infinity;
        if (biome[j] <= 1 && j !== to) c = Infinity;
        if (river[j] && !river[i]) c += 7;
        if (roads && roads[j]) c = 0.45;
        c *= dx && dy ? 1.41 : 1;
        if (d + c < dist[j]) { dist[j] = d + c; prev[j] = i; push(j, d + c); }
      }
    }
    if (prev[to] < 0) return null;
    const path = [];
    for (let i = to; i >= 0 && path.length <= N; i = prev[i]) path.push(i);
    return path.reverse();
  }

  // ---- a villager sprite ----
  // 5×8: hair, face, shirt, legs, with a dark outline, the frogs' rule at its smallest. Faces down the screen.
  function villager(g, x, y, look, frame = 0) {
    const P = Kit.PAL, px = (a, b, c) => { g.fillStyle = P[c]; g.fillRect(x + a, y + b, 1, 1); };
    g.fillStyle = P[0];
    g.fillRect(x + 1, y, 3, 1); g.fillRect(x, y + 1, 5, 6); g.fillRect(x + 1, y + 7, 3, 1);
    px(1, 1, look.hair); px(2, 1, look.hair); px(3, 1, look.hair);
    px(1, 2, look.skin); px(2, 2, look.skin); px(3, 2, look.skin);
    for (let b = 3; b <= 4; b++) for (let a = 1; a <= 3; a++) px(a, b, look.shirt);
    px(1, 5, look.legs); px(3, 5, look.legs);
    if (frame) px(1, 6, look.legs); else px(3, 6, look.legs);
  }
  const LOOKS = { skin: [13, 29, 28, 12], hair: [0, 26, 27, 9, 4, 13], shirt: [10, 22, 16, 30, 28, 11, 3, 23, 31, 15] };

  window.StudyShared = window.StudyShared || {};
  StudyShared.people = { clamp, cap, lang, calque, HEADS, QUALS, NAMEPARTS, OE, terrain, paintTerrain, road, villager, LOOKS };
})();
