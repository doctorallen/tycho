// pixel-font.js: Pixel fonts at 320x180. A study demo, using text-shared.js.
// The same paragraph in three faces drawn for the study (3x5 caps, 5x7 monospace with descenders, and a
// proportional face squeezed from it, with or without automatic kerning), over a busy seeded background,
// bare or with a shadow, an outline or a plate, with a readout of characters per line and lines per box.
(() => {
  const { FONTS, measure, wrap, drawText, busy, hex, Pix } = StudyShared.text;
  const W = 320, H = 180;
  // eight inks: dark, deep, moss, grass, sand, rust, blue, paper
  const INKS = ['#141020', '#2b2a4c', '#36603e', '#6f9a44', '#d6ad6a', '#b04a30', '#4f7fbf', '#f3ead2'];
  const I = { dark: 0, deep: 1, moss: 2, grass: 3, sand: 4, rust: 5, blue: 6, paper: 7 };
  const RGB = INKS.map(hex);
  const TEXT = 'The lighthouse keeps a log of every ship it has seen. The last entry is eleven years old and says only: Fog. ' +
    'It would like you to read it the rest, slowly, if you have the time.\nAccents: café, naïve, señor, garçon, Über, Élan, Ñu.';
  const MM = 6 / 460 * 25.4; // one art pixel on an iPhone 15 at 6 device pixels: about 0.33 mm

  Kit.register('pixel-font', { title: 'Pixel fonts at 320×180', fit: 'per-frame' }, host => {
    const c = Kit.canvas(host, W, H);
    const st = { font: 'mono', back: 'outline', busy: true, width: 200, lead: 0 };
    const bg = new Pix(W, H);
    busy(bg, 7, I);
    const p = new Pix(W, H);
    let readout;
    const draw = () => {
      const f = FONTS[st.font], line = f.line + st.lead;
      p.d.set(st.busy ? bg.d : new Int16Array(W * H).fill(I.deep));
      const x0 = 8, y0 = 8, wd = st.width;
      const lines = wrap(f, TEXT, wd);
      const fit = Math.floor((H - y0 - 4) / line);
      const shown = lines.slice(0, fit);
      if (st.back === 'plate') {
        const ph = shown.length * line + 4;
        p.rect(x0 - 4, y0 - 4, wd + 8, ph + 3, I.dark);
        p.rect(x0 - 3, y0 - 3, wd + 6, ph + 1, I.deep);
      }
      const o = st.back === 'outline' ? { outline: I.dark } : st.back === 'shadow' ? { shadow: I.dark } : {};
      // capital accents rise above the line, so the first line starts lower when accents are on
      shown.forEach((s, k) => drawText(p, f, s, x0, y0 + k * line + (f.accents ? 1 : 0), I.paper, o));
      // the measure: a mark at the box's right edge
      for (let y = 2; y < H - 2; y += 3) p.set(x0 + wd + 2, y, I.paper);
      c.put(p, RGB);
      // readout
      const body = TEXT.split('\n')[0], avg = measure(f, body) / body.length;
      const cpl = Math.floor(wd / avg), full = Math.floor(288 / avg);
      readout.textContent = `${f.name}: ${f.short === '3×5' ? 'capitals 5 px' : 'capitals 7 px, x-height 5, descenders 2'}, ` +
        `line ${line} px, average advance ${avg.toFixed(2)} px. At this width (${wd} px) about ${cpl} characters a line; ` +
        `across a full talk box (288 px) ${full}; a 40 px box holds ${Math.floor(40 / line)} lines, the frame ${Math.floor(172 / line)}. ` +
        `On an iPhone 15 (6 device pixels an art pixel, ${MM.toFixed(2)} mm) the capitals are ${(f.asc * MM).toFixed(1)} mm tall` +
        `${f.accents ? '' : '; this face has no room for accents, so they are dropped'}.` +
        (lines.length > fit ? ` ${lines.length - fit} more lines don't fit the frame.` : '');
    };
    const b = Kit.bar(host);
    b.tabs(['Tiny 3×5', 'Mono 5×7', 'Proportional', 'Kerned'], v => { st.font = { 'Tiny 3×5': 'tiny', 'Mono 5×7': 'mono', Proportional: 'prop', Kerned: 'kerned' }[v]; draw(); }, 'Mono 5×7');
    b.tabs(['Bare', 'Shadow', 'Outline', 'Plate'], v => { st.back = v.toLowerCase(); draw(); }, 'Outline');
    const b2 = Kit.bar(host);
    b2.slider('Width', 80, 304, 4, st.width, v => { st.width = v; draw(); });
    b2.slider('Leading', 0, 4, 1, st.lead, v => { st.lead = v; draw(); });
    b2.check('Busy ground', true, v => { st.busy = v; draw(); });
    readout = Kit.bar(host).note('');
    draw();
  });
})();
