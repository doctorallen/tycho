// talk-box.js: A talk box at 320x180. A study demo, using text-shared.js.
// A nine-slice frame, a portrait slot and a name tab, text revealed a letter at a time with Tycho's Typer
// timings (40 a second, a breath after sentences and clauses), word wrap in the font's own advances, a tap
// that completes the line and then moves on, and three choices sized for fingers: their height is Apple's 44 pt
// or Android's 48 dp for the chosen phone, in this frame's pixels, and the circles show a 9 mm fingertip.
(() => {
  const { FONTS, wrap, measure, drawText, busy, ellipse, hex, Pix } = StudyShared.text;
  const W = 320, H = 180;
  const INKS = ['#120e1c', '#262242', '#36603e', '#6f9a44', '#d6ad6a', '#b04a30', '#5a86c4', '#f4ecd6'];
  const K = 0, DEEP = 1, MOSS = 2, GRASS = 3, SAND = 4, RUST = 5, BLUE = 6, PAPER = 7;
  const RGB = INKS.map(hex);
  // phones: device pixels per art pixel (the 180-pixel short side at a whole scale), device pixel ratio, pixels per inch,
  // and the platform's minimum target (44 pt on iOS, 48 dp on Android)
  const PHONES = {
    'iPhone 15': { dev: 6, dpr: 3, ppi: 460, target: 44, unit: 'pt' },
    'iPhone SE': { dev: 4, dpr: 2, ppi: 326, target: 44, unit: 'pt' },
    'Pixel 8': { dev: 6, dpr: 2.625, ppi: 428, target: 48, unit: 'dp' },
    'Galaxy S24': { dev: 6, dpr: 3, ppi: 416, target: 48, unit: 'dp' },
  };
  // the frame, sliced in nine: 3-pixel corners, edges repeated, the middle filled. k outline, l bevel, m fill, d shade
  const FRAME = ['.kkkkkk.', 'kllllllk', 'klmmmmdk', 'klmmmmdk', 'klmmmmdk', 'klmmmmdk', 'kddddddk', '.kkkkkk.'];
  function nine(p, src, map, x, y, w, h, cut = 3) {
    const S = src.length, mid = S - 2 * cut;
    const pick = (i, n) => (i < cut ? i : i >= n - cut ? S - (n - i) : cut + ((i - cut) % mid));
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const v = map[src[pick(j, h)][pick(i, w)]];
      if (v !== undefined) p.set(x + i, y + j, v);
    }
  }
  const BOXMAP = { k: K, l: BLUE, m: DEEP, d: K };
  const PICKMAP = { k: K, l: PAPER, m: BLUE, d: K }; // a picked choice turns lighter, not only bluer
  // the mayor, a frog, for the portrait slot
  function portrait(p, x, y) {
    p.rect(x, y, 32, 32, MOSS);
    ellipse(p, x + 16, y + 21, 15, 10, K); ellipse(p, x + 16, y + 21, 14, 9, GRASS);
    for (const ex of [8, 24]) { ellipse(p, x + ex, y + 10, 6, 6, K); ellipse(p, x + ex, y + 10, 5, 5, PAPER); p.rect(x + ex - 1, y + 9, 3, 3, K); }
    for (let i = 7; i < 26; i++) p.set(x + i, y + 22 + (i > 9 && i < 23 ? 1 : 0), K);
    p.rect(x + 5, y + 19, 3, 2, RUST); p.rect(x + 24, y + 19, 3, 2, RUST);
    for (let i = 0; i < 32; i++) { p.set(x + i, y + 31, K); }
    // a small hat, for office
    p.rect(x + 11, y + 1, 10, 4, K); p.rect(x + 12, y + 1, 8, 3, RUST); p.rect(x + 9, y + 4, 14, 1, K);
  }
  const SCRIPT = [
    "You're the one with the lantern. Good. The stall needs a hand for the lunch rush, and nobody else here has hands.",
    "Three bowls of noodles and one fly. Please don't ask about the fly.",
  ];
  const CHOICES = ["I'll help.", 'Why a fly?', 'Goodbye.'];
  const REPLIES = [
    'Splendid. Aprons are on the hook by the pot. The fly is called Gerald.',
    'He asked for it. In writing. We respect a written order here.',
    "Of course. The noodles will wait. They're good at waiting.",
  ];
  const STOP = 0.26, PAUSE = 0.11; // Tycho's Typer: a breath after a sentence, a shorter one after a clause

  Kit.register('talk-box', { title: 'A talk box at 320×180', fit: 'per-frame' }, host => {
    const c = Kit.canvas(host, W, H);
    const bg = new Pix(W, H);
    busy(bg, 21, { dark: K, deep: DEEP, moss: MOSS, grass: GRASS, sand: SAND, rust: RUST, blue: BLUE, paper: PAPER });
    const p = new Pix(W, H);
    const st = { font: 'kerned', cps: 40, phone: 'iPhone 15', layout: 'stacked', finger: true, portrait: true };
    // the conversation: which text, how much is shown, and what comes next
    const talk = { text: SCRIPT[0], step: 0, page: 0, shown: 0, wait: 0, mode: 'type', pick: -1, tap: null, tapT: 0 };
    let lines = [], pages = [];
    const geom = () => {
      const bh = 44, by = H - 4 - bh, tx = st.portrait ? 48 : 12;
      return { bx: 4, by, bw: W - 8, bh, tx, ty: by + 7, tw: W - 8 - tx - 4 };
    };
    const sizes = () => {
      const ph = PHONES[st.phone], mm = ph.dev / ph.ppi * 25.4;
      return { target: Math.round(ph.target * ph.dpr / ph.dev), finger: 9 / mm, mm, ph };
    };
    const layoutText = () => {
      const g = geom(), f = FONTS[st.font];
      lines = wrap(f, talk.text, g.tw);
      pages = [];
      for (let i = 0; i < lines.length; i += 3) pages.push(lines.slice(i, i + 3));
    };
    const pageLen = () => (pages[talk.page] || []).join(' ').length;
    const say = text => { talk.text = text; talk.page = 0; talk.shown = 0; talk.wait = 0.16; talk.mode = 'type'; layoutText(); };
    // choice boxes, in art pixels
    const choiceRects = () => {
      const g = geom(), f = FONTS[st.font], { target } = sizes();
      if (st.layout === 'stacked') {
        const w = Math.max(...CHOICES.map(s => measure(f, s))) + 16;
        return CHOICES.map((s, i) => ({ x: W - 4 - w, y: g.by - 3 - (CHOICES.length - i) * (target + 2), w, h: target, s }));
      }
      const gap = 4, w = Math.floor((g.tw - 2 * gap) / 3);
      return CHOICES.map((s, i) => ({ x: g.tx + i * (w + gap), y: g.by + Math.max(4, Math.floor((g.bh - target) / 2)), w, h: Math.min(target, g.bh - 4), s }));
    };

    const step = dt => {
      if (talk.tapT > 0) talk.tapT -= dt;
      // a picked choice stays lit for a moment, then the reply starts
      if (talk.mode === 'picked') { talk.wait -= dt; if (talk.wait <= 0) say(REPLIES[talk.pick]); return; }
      if (talk.mode !== 'type') return;
      if (talk.wait > 0) { talk.wait -= dt; return; }
      const all = (pages[talk.page] || []).join(' ');
      const before = Math.floor(talk.shown);
      talk.shown = Math.min(all.length, talk.shown + dt * st.cps);
      for (let i = before; i < Math.floor(talk.shown); i++) {
        const ch = all[i], next = all[i + 1];
        if ((next === ' ' || next === undefined) && '.!?'.includes(ch)) { talk.shown = i + 1; talk.wait = STOP; break; }
        if (next === ' ' && ',;:'.includes(ch)) { talk.shown = i + 1; talk.wait = PAUSE; break; }
      }
      if (talk.shown >= all.length && talk.wait <= 0) talk.mode = talk.page < pages.length - 1 || talk.step < SCRIPT.length - 1 || talk.step >= SCRIPT.length ? 'wait' : 'choose';
    };
    const tap = (x, y) => {
      talk.tap = [x, y]; talk.tapT = 0.6;
      if (talk.mode === 'type') { talk.shown = pageLen(); talk.wait = 0; step(0); if (talk.mode === 'type') talk.mode = 'wait'; return; }
      if (talk.mode === 'wait') {
        if (talk.page < pages.length - 1) { talk.page++; talk.shown = 0; talk.mode = 'type'; return; }
        talk.step = talk.step >= SCRIPT.length ? 0 : talk.step + 1;
        say(SCRIPT[talk.step]);
        return;
      }
      if (talk.mode === 'choose') {
        const hit = choiceRects().findIndex(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
        if (hit < 0) return;
        talk.pick = hit; talk.step = SCRIPT.length; // a reply, then back to the start
        talk.mode = 'picked'; talk.wait = 0.3;
      }
    };
    // a circle's outline, dotted, for the fingertip
    const ring = (cx, cy, r, ink) => {
      const n = Math.ceil(r * 8);
      for (let i = 0; i < n; i += 2) { const a = i / n * Math.PI * 2; p.set(Math.round(cx + Math.cos(a) * r - 0.5), Math.round(cy + Math.sin(a) * r - 0.5), ink); }
    };
    let readout;
    const draw = t => {
      const g = geom(), f = FONTS[st.font], sz = sizes();
      p.d.set(bg.d);
      nine(p, FRAME, BOXMAP, g.bx, g.by, g.bw, g.bh);
      if (st.portrait) { p.rect(g.bx + 5, g.by + 5, 34, 34, K); portrait(p, g.bx + 6, g.by + 6); }
      // the name tab
      const name = 'Mayor Bufo', nw = measure(FONTS.prop, name) + 10;
      nine(p, FRAME, BOXMAP, g.tx - 4, g.by - 11, nw, 14);
      drawText(p, FONTS.prop, name, g.tx + 1, g.by - 8, SAND);
      // the text (in a row layout, the choices take the text's place)
      const rows = pages[talk.page] || [];
      if (!((talk.mode === 'choose' || talk.mode === 'picked') && st.layout === 'row')) {
        let left = Math.floor(talk.shown);
        rows.forEach((s, k) => { drawText(p, f, s, g.tx, g.ty + k * 10, PAPER, { upto: Math.max(0, left) }); left -= s.length + 1; });
      }
      // the marker when a line is done and more is waiting
      if (talk.mode === 'wait' && (t >> 3) % 2 === 0) {
        const mx = g.bx + g.bw - 12, my = g.by + g.bh - 9;
        ['#####', '.###.', '..#..'].forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') p.set(mx + i, my + j, SAND); });
      }
      if (talk.mode === 'choose' || talk.mode === 'picked') {
        choiceRects().forEach((r, i) => {
          nine(p, FRAME, talk.mode === 'picked' && i === talk.pick ? PICKMAP : BOXMAP, r.x, r.y, r.w, r.h);
          const tw = measure(f, r.s);
          drawText(p, f, r.s, r.x + Math.floor((r.w - tw) / 2), r.y + Math.floor((r.h - 7) / 2), PAPER);
          if (st.finger) ring(r.x + r.w / 2, r.y + r.h / 2, sz.finger / 2, SAND);
        });
      }
      if (talk.tap && talk.tapT > 0) ring(talk.tap[0] + 0.5, talk.tap[1] + 0.5, sz.finger / 2, RUST);
      c.put(p, RGB);
    };
    const report = () => {
      const sz = sizes(), rects = choiceRects(), top = Math.min(...rects.map(r => r.y));
      const used = st.layout === 'stacked' ? H - top : geom().bh + 8;
      readout.textContent = `${st.phone}: one art pixel is ${sz.mm.toFixed(2)} mm, so ${sz.ph.target} ${sz.ph.unit} is ${sz.target} art pixels and a 9 mm fingertip ${sz.finger.toFixed(0)}. ` +
        `The choices are ${sz.target} px tall; ${st.layout === 'stacked' ? 'stacked over the box' : 'in a row inside the box'}, the talk takes ${used} of the frame's 180 rows. ` +
        `Text at ${st.cps} letters a second; adults read about 24 a second (238 words a minute, Brysbaert 2019), so a tap always completes the line first.`;
    };
    const redo = () => { layoutText(); talk.shown = Math.min(talk.shown, pageLen()); report(); draw(0); };
    c.cv.addEventListener('pointerdown', e => { e.preventDefault(); const [x, y] = c.at(e); tap(x, y); draw(0); });
    c.cv.style.touchAction = 'manipulation';
    const b = Kit.bar(host);
    b.tabs(Object.keys(PHONES), v => { st.phone = v; redo(); }, st.phone);
    b.tabs(['Stacked', 'Row'], v => { st.layout = v.toLowerCase(); redo(); }, 'Stacked');
    const b2 = Kit.bar(host);
    b2.tabs(['Proportional', 'Mono 5×7'], v => { st.font = v === 'Proportional' ? 'kerned' : 'mono'; redo(); }, 'Proportional');
    b2.slider('Letters a second', 10, 120, 5, st.cps, v => { st.cps = v; report(); });
    b2.check('Fingertip', true, v => { st.finger = v; draw(0); });
    b2.check('Portrait', true, v => { st.portrait = v; redo(); });
    readout = Kit.bar(host).note('');
    say(SCRIPT[0]);
    report();
    Kit.loop(host, step, draw, 30);
  });
})();
