// creatures.js: Generated creatures. A study demo, using animals-shared.js.
// A grid of nine animals for one biome, each from a seeded genome: a body plan (four legs, bird, fish, bug),
// proportions, inks by biome and role (prey hide in the ground's inks, the poisonous wear red, amber and
// black), a four-frame walk, flight or swim loop, and a name and description that agree with the picture.
// Tap a cell to reroll that animal; each cell is checked to stay within eight inks.
(() => {
  const { BIOMES, SLOTS, makeCreature, drawCreature, text, textW, blit } = StudyShared.animals;
  Kit.register('creatures', { title: 'Generated creatures', fit: 'prebake' }, host => {
    const CW = 64, CH = 56, COLS = 3, ROWS = 3, W = CW * COLS, H = CH * ROWS;
    const c = Kit.canvas(host, W, H);
    c.cv.style.cursor = 'pointer';
    const info = Kit.el('div', { style: 'margin-top:8px;font-size:13px;line-height:1.5;min-height:4.5em' });
    let biome = 'Meadow', seed = 7, sel = 0;
    let cells = [];
    const seedOf = (i, k) => (Math.imul(seed + 1, 2654435761) ^ Math.imul(i + 1, 40503) ^ Math.imul(k + 1, 69069) ^ Kit.hashStr(biome)) >>> 0;
    // one cell: its genome, its four frames, its background, its ink count
    function makeCell(i, k) {
      const [plan, role] = SLOTS[biome][i];
      const g = makeCreature(seedOf(i, k), plan, role, biome);
      const frames = [0, 1, 2, 3].map(f => drawCreature(g, f));
      const B = BIOMES[biome], water = plan === 'fish';
      const bg = new Kit.Pix(CW, CH).fill(water ? B.water[0] : B.ground);
      const marks = water ? B.water[1] : B.shade;
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
        const h = Kit.hash2(x + i * 97, y, seed);
        if (water ? (h < 0.02 && x < CW - 3) : h < 0.03) { bg.set(x, y, marks); if (water) { bg.set(x + 1, y, marks); bg.set(x + 2, y, marks); } else bg.set(x, y - 1, marks); }
      }
      // a soft shadow under walkers and crawlers (fliers carry their own, far below)
      if (plan === 'quad' || plan === 'bug') for (let x = -Math.round(g.len / 2) - 1; x <= Math.round(g.len / 2) + 1; x++) { bg.set(CW / 2 + x, CH - 13, B.shade); if (Math.abs(x) < g.len / 2 - 1) bg.set(CW / 2 + x, CH - 12, B.shade); }
      const cell = { g, frames, bg, water, shade: marks };
      // count the inks the cell can show across its frames, with its name
      const inks = new Set(bg.d);
      for (const fr of frames) for (const v of fr.pix.d) if (v >= 0) inks.add(v);
      inks.add(0);
      cell.inks = inks.size;
      return cell;
    }
    let rerolls = [];
    function build() { rerolls = SLOTS[biome].map(() => 0); cells = SLOTS[biome].map((_, i) => makeCell(i, 0)); describe(); }
    function describe() {
      const g = cells[sel].g;
      info.replaceChildren(Kit.el('b', {}, `${g.name}, the ${g.common}. `), g.desc, Kit.el('span', { style: 'opacity:.7' }, ` (${g.plan === 'quad' ? 'four legs' : g.plan}, ${g.role}; ${cells[sel].inks} inks in this cell)`));
    }
    const frame = new Kit.Pix(W, H);
    let shown = -1;
    function draw(t) {
      const f = Math.floor(t / 5) % 4;
      if (f === shown) return;
      shown = f;
      for (let i = 0; i < cells.length; i++) {
        const cx = (i % COLS) * CW, cy = Math.floor(i / COLS) * CH, cell = cells[i];
        blit(frame, cell.bg, cx, cy);
        // stagger the loops so the grid does not march in step
        const fr = cell.frames[(f + i) % 4];
        blit(frame, fr.pix, cx + CW / 2 - fr.ox, cy + CH - 12 - fr.oy, false, cell.shade);
        const name = cell.g.name.toUpperCase();
        text(frame, name, cx + Math.round((CW - textW(name)) / 2), cy + CH - 8, cell.water ? 6 : 0);
        if (i === sel) for (let x = 0; x < CW; x++) { frame.set(cx + x, cy, 7); frame.set(cx + x, cy + CH - 1, 7); }
      }
      for (let k = 1; k < COLS; k++) for (let y = 0; y < H; y++) frame.set(k * CW, y, 0);
      for (let k = 1; k < ROWS; k++) for (let x = 0; x < W; x++) frame.set(x, k * CH, 0);
      c.put(frame);
    }
    c.cv.addEventListener('click', e => {
      const [x, y] = c.at(e);
      const i = Math.min(COLS - 1, Math.floor(x / CW)) + Math.min(ROWS - 1, Math.floor(y / CH)) * COLS;
      rerolls[i]++; sel = i;
      cells[i] = makeCell(i, rerolls[i]);
      describe(); shown = -1;
    });
    const b1 = Kit.bar(host);
    b1.tabs(Object.keys(BIOMES), v => { biome = v; sel = 0; build(); shown = -1; }, biome);
    const b2 = Kit.bar(host);
    b2.seed(seed, s => { seed = s; build(); shown = -1; });
    b2.note('Tap an animal to reroll it.');
    host.appendChild(info);
    build();
    Kit.loop(host, () => {}, draw, 30);
  });
})();
