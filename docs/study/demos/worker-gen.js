// worker-gen.js: one world-generation job run three ways: on the main thread (the page freezes), in a Web Worker
// made from a Blob URL (no extra file; the job's source is copied into it), and sliced across frames on the main
// thread under a 6 ms budget. A windmill turns and a ball bounces the whole time, so a freeze shows; the strip under
// them plots the gap before every frame, and the readout gives each way's timings, including the worker's startup
// and the transfer of the finished map back to the page.
(() => {
  const { worldJob, workerSource, mapImage, text, textW, fmt } = StudyShared.phones;
  const PAL = Kit.PAL;
  const W = 320, H = 180, MAP = 160, BUDGET = 6;

  Kit.register('worker-gen', { title: 'Generation off the main thread', fit: 'prebake' }, host => {
    const c = Kit.canvas(host, W, H), g = c.g;
    const J = worldJob();
    const mapC = document.createElement('canvas'); mapC.width = MAP; mapC.height = MAP;
    const mg = mapC.getContext('2d');
    let N = 512, seed = 11, busy = '', progress = 0, angle = 0, ballT = 0;
    const gaps = new Float32Array(150); let gi = 0, lastFrame = 0, longest = 0;
    const lines = { main: 'Main thread: not run yet.', worker: 'Worker: not run yet.', sliced: 'Sliced: not run yet.' };
    let blobURL = null;
    host.__done = {};

    let hasMap = false;
    function showMap(idx, n) { mg.putImageData(mapImage(idx, n, MAP), 0, 0); hasMap = true; }
    mg.fillStyle = PAL[1]; mg.fillRect(0, 0, MAP, MAP);

    // ---- the frame ----
    function draw() {
      const now = performance.now();
      if (lastFrame) { const gap = now - lastFrame; gaps[gi++ % gaps.length] = gap; if (busy) longest = Math.max(longest, gap); }
      lastFrame = now;
      g.fillStyle = PAL[0]; g.fillRect(0, 0, W, H);
      g.drawImage(mapC, 8, 10);
      g.fillStyle = PAL[3]; g.fillRect(7, 9, MAP + 2, 1); g.fillRect(7, MAP + 10, MAP + 2, 1); g.fillRect(7, 9, 1, MAP + 2); g.fillRect(MAP + 8, 9, 1, MAP + 2);
      if (busy || !hasMap) {
        const s = !busy ? 'PICK A WAY BELOW' : busy.toUpperCase() + (progress ? ' ' + Math.round(progress * 100) + '%' : '');
        g.fillStyle = PAL[0]; g.fillRect(8 + MAP / 2 - textW(s) / 2 - 3, 10 + MAP / 2 - 5, textW(s) + 6, 11);
        text(g, s, 8 + MAP / 2 - textW(s) / 2, 10 + MAP / 2 - 2, 13);
      }
      // the windmill: a tower and four sails, turned by the fixed step
      const cx = 214, cy = 58;
      g.fillStyle = PAL[27]; g.fillRect(cx - 4, cy, 9, 40); g.fillStyle = PAL[28]; g.fillRect(cx - 3, cy, 3, 40);
      g.fillStyle = PAL[26]; g.fillRect(cx - 1, cy + 30, 3, 10);
      for (let k = 0; k < 4; k++) {
        const a = angle + k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
        for (let r = 3; r < 30; r++) {
          const x = Math.round(cx + ca * r), y = Math.round(cy + sa * r);
          g.fillStyle = PAL[6]; g.fillRect(x, y, 1, 1);
          if (r > 8) { const ox = Math.round(-sa * 3), oy = Math.round(ca * 3); g.fillStyle = PAL[r & 2 ? 5 : 7]; g.fillRect(x + ox, y + oy, 2, 2); }
        }
      }
      g.fillStyle = PAL[13]; g.fillRect(cx - 1, cy - 1, 3, 3);
      // the ball: bounces on a parabola, squashes on landing
      const p = (ballT % 1), bx = 280, floor = 98, by = floor - Math.round(44 * 4 * p * (1 - p));
      const sq = p < 0.06 || p > 0.94 ? 2 : 0;
      g.fillStyle = PAL[2]; g.fillRect(bx - 6, floor + 6, 13, 2);
      g.fillStyle = PAL[10]; g.fillRect(bx - 5 - sq, by - 5 + sq, 11 + sq * 2, 11 - sq);
      g.fillStyle = PAL[12]; g.fillRect(bx - 3 - sq, by - 3 + sq, 4, 3);
      g.fillStyle = PAL[3]; g.fillRect(176, floor + 8, 140, 1);
      // the gap before each of the last 140 frames, 0 to 100 ms; red past 50 (a long frame)
      const sx = 176, sy = 120, sh = 34;
      text(g, 'GAP BEFORE EACH FRAME', sx, sy - 8, 6);
      g.fillStyle = PAL[1]; g.fillRect(sx, sy, 140, sh);
      g.fillStyle = PAL[3]; g.fillRect(sx, sy + sh - Math.round(16.7 / 100 * sh), 140, 1); g.fillRect(sx, sy + sh - Math.round(50 / 100 * sh), 140, 1);
      for (let i = 0; i < 140; i++) {
        const v = gaps[(gi - 140 + i + gaps.length * 2) % gaps.length]; if (!v) continue;
        const h = Math.min(sh, Math.max(1, Math.round(v / 100 * sh)));
        g.fillStyle = PAL[v > 50 ? 11 : v > 20 ? 12 : 17]; g.fillRect(sx + i, sy + sh - h, 1, h);
      }
      const big = Math.max(...gaps);
      text(g, 'LONGEST ' + fmt(big) + ' MS', sx, sy + sh + 4, big > 50 ? 11 : 5);
      text(g, N + 'X' + N + ' SEED ' + seed, 8, H - 7, 4);
    }
    Kit.loop(host, () => { angle += 0.12; ballT += 1 / 30; }, draw, 30);

    // ---- the three ways ----
    const done = (mode, line) => { lines[mode] = line; busy = ''; progress = 0; readout(); setButtons(true); host.__done[label[mode]] = true; };
    const label = { main: 'Main thread', worker: 'Worker', sliced: 'Sliced' };

    // the main thread: wait one frame so the label paints, then run the job in one go
    function runMain() {
      begin('main thread');
      requestAnimationFrame(() => setTimeout(() => {
        const t0 = performance.now(), r = J.run(N, seed, () => performance.now()), work = performance.now() - t0;
        showMap(r.idx, N);
        // the freeze shows as the gap before the next frame
        requestAnimationFrame(() => requestAnimationFrame(() => done('main', 'Main thread: ' + fmt(work) + ' ms of work (' + stages(r.ms) + '); the longest frame gap was ' + fmt(longest) + ' ms.')));
      }, 0));
    }
    // a worker: a fresh one each run, so its startup is timed too (a game would make one and reuse it)
    function runWorker() {
      begin('worker');
      let w;
      try {
        if (!blobURL) blobURL = URL.createObjectURL(new Blob([workerSource()], { type: 'text/javascript' }));
        const abs = () => performance.timeOrigin + performance.now();
        const t0 = abs(); let ready = 0;
        w = new Worker(blobURL);
        w.onmessage = e => {
          const d = e.data;
          if (d.type === 'ready') { ready = d.at; w.postMessage({ N, seed }); return; }
          const got = abs();
          showMap(d.idx, d.N);
          w.terminate();
          done('worker', 'Worker: startup ' + fmt(ready - t0) + ' ms, ' + fmt(d.work) + ' ms of work (' + stages(d.ms) + '), transfer back ' + fmt(Math.max(0, got - d.at)) + ' ms, ' + fmt(got - t0) + ' ms in all; the longest frame gap was ' + fmt(longest) + ' ms.');
        };
        w.onerror = e => { done('worker', 'Worker: failed to start here (' + (e.message || 'blocked') + ').'); };
      } catch (e) { done('worker', 'Worker: not available here (' + e.message + ').'); }
    }
    // sliced: the same generator, stepped for at most BUDGET ms per animation frame
    function runSliced() {
      begin('sliced');
      const it = J.gen(N, seed, () => performance.now()), t0 = performance.now();
      let frames = 0, work = 0;
      const slice = () => {
        frames++;
        const s = performance.now(); let r;
        while (performance.now() - s < BUDGET) {
          r = it.next();
          if (r.done) break;
        }
        work += performance.now() - s;
        progress = Math.min(0.99, frames * BUDGET / (frames * BUDGET + 300));
        if (r && r.done) {
          showMap(r.value.idx, N);
          return done('sliced', 'Sliced (' + BUDGET + ' ms a frame): ' + frames + ' frames, ' + fmt(work) + ' ms of work, ' + fmt(performance.now() - t0) + ' ms in all; the longest frame gap was ' + fmt(longest) + ' ms.');
        }
        requestAnimationFrame(slice);
      };
      requestAnimationFrame(slice);
    }
    const stages = ms => 'noise ' + fmt(ms.noise) + ', flood ' + fmt(ms.flood) + ', flow ' + fmt(ms.flow) + ', paint ' + fmt(ms.paint);
    function begin(what) { busy = what; longest = 0; progress = 0; seed = (seed * 7 + 3) % 1000; setButtons(false); }

    // ---- controls ----
    const b = Kit.bar(host);
    b.tabs(['256', '512'], v => { N = +v; }, '512');
    const btns = [b.button('Main thread', runMain), b.button('Worker', runWorker), b.button('Sliced', runSliced)];
    const setButtons = on => btns.forEach(x => { x.disabled = !on; });
    const out = Kit.el('div', { class: 'note', style: 'margin-top:6px;line-height:1.45;' });
    host.appendChild(out);
    function readout() {
      out.replaceChildren(...['main', 'worker', 'sliced'].map(k => Kit.el('div', {}, lines[k])));
    }
    readout();
  });
})();
