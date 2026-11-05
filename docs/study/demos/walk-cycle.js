// walk-cycle.js: Procedural walk, idle and jump. A study demo, using motion-shared.js.
(() => {
  const { Pix, rng, paint, THIGH, SHIN, walkPose, idlePose, jumpPose, drawChar } = StudyShared.motion;
  Kit.register('walk-cycle', { title: 'Procedural walk, idle and jump', fit: 'per-frame' }, host => {
    const W = 160, H = 104, GY = 62, SY = 72;
    const c = Kit.canvas(host, W, H);
    const st = { mode: 'Walk', speed: 26, poses: 8, dist: 0, t: 0, cam: 0,
      jy: 0, jvy: 0, jt: 0, js: 0, air: false, nextJump: 20 };
    const cx = 72;
    // the cape: a verlet chain pinned to the back of the neck
    const N = 6, SEG = 2.6;
    let cape = Array.from({ length: N }, (_, i) => ({ x: cx - 3, y: 30 + i * SEG, px: cx - 3, py: 30 + i * SEG }));
    const blinkAt = rng(5);
    let blinkUntil = -1, nextBlink = 60;
    let pose = walkPose(0), lastPose = null;

    const step = (dt, tick) => {
      st.t += dt;
      let anchorY;
      if (st.mode === 'Walk') {
        st.dist += st.speed * dt; st.cam = st.dist;
        const ph = (st.dist / 16) % 1;
        const q = st.poses ? Math.floor(ph * st.poses) / st.poses : ph; // quantized phase: pixel-art poses, not a slide
        pose = walkPose(q);
      } else if (st.mode === 'Idle') {
        if (tick >= nextBlink) { blinkUntil = tick + 4; nextBlink = tick + 90 + Math.floor(blinkAt() * 120); }
        pose = idlePose(st.t, tick < blinkUntil);
      } else {
        // jump: crouch (anticipation), launch, fly on gravity, land squashed, recover
        st.jt++;
        if (!st.air) {
          if (st.jt >= st.nextJump && st.jt < st.nextJump + 6) st.js = Math.min(1, (st.jt - st.nextJump + 1) / 4);
          else if (st.jt === st.nextJump + 6) { st.air = true; st.jvy = -150; st.js = -1; }
          else st.js *= 0.75;
        } else {
          st.jvy += 420 * dt; st.jy += st.jvy * dt;
          st.js = st.jvy < -60 ? -1 : st.jvy > 90 ? -0.6 : 0;
          if (st.jy >= 0) { st.jy = 0; st.air = false; st.js = 1; st.jt = 0; st.nextJump = 40; }
        }
        pose = jumpPose(st.js, st.air, st.jvy);
      }
      // move the cape: pin the root, integrate, then satisfy segment lengths a few times
      const top = GY - (THIGH + SHIN) - 1 + pose.hip - pose.torso + 1 + Math.round(st.jy);
      const ax = cx - 2 + pose.lean, ay = top + 1;
      anchorY = ay;
      const wind = (st.mode === 'Walk' ? -st.speed * 6 : 0) - 30 * (1 + Math.sin(st.t * 1.7)) * (1 + 0.5 * Math.sin(st.t * 4.1));
      for (let i = 1; i < N; i++) {
        const n = cape[i], vx = (n.x - n.px) * 0.9, vy = (n.y - n.py) * 0.9;
        n.px = n.x; n.py = n.y;
        n.x += vx + wind * dt * dt; n.y += vy + 260 * dt * dt;
      }
      cape[0].x = ax; cape[0].y = anchorY;
      for (let k = 0; k < 4; k++) for (let i = 1; i < N; i++) {
        const a = cape[i - 1], b = cape[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        b.x = a.x + dx / d * SEG; b.y = a.y + dy / d * SEG;
        if (b.x > ax + 1) b.x = ax + 1; // the cape stays behind the back
      }
    };
    // a strip of the poses this mode produces, like a generated sprite sheet
    const stripPoses = () => {
      if (st.mode === 'Walk') { const n = st.poses || 8; return Array.from({ length: n }, (_, i) => walkPose(i / n)); }
      if (st.mode === 'Idle') return [idlePose(0, false), idlePose(0.7, false), idlePose(1.4, false), idlePose(1.4, true)];
      return [jumpPose(0, false, 0), jumpPose(1, false, 0), jumpPose(-1, true, -150), jumpPose(0, true, 0), jumpPose(-0.6, true, 120), jumpPose(1, false, 0)];
    };
    const stripIndex = n => {
      if (st.mode === 'Walk') return Math.floor(((st.dist / 16) % 1) * n);
      if (st.mode === 'Idle') return pose.blink ? 3 : pose.torso > 8 ? 1 : 0;
      if (!st.air) return st.js > 0.5 ? (st.jt > 10 ? 1 : 5) : 0;
      return st.jvy < -60 ? 2 : st.jvy > 90 ? 4 : 3;
    };
    const draw = () => {
      const p = new Pix(W, H).fill(22);
      // sky bands and parallax hills
      p.rect(0, 0, W, 14, 21);
      p.rect(0, 30, W, GY - 30, 23);
      for (let x = 0; x < W; x++) {
        const u = x + st.cam * 0.25, h = Math.round(42 + 5 * Math.sin(u * 0.045) + 3 * Math.sin(u * 0.11));
        for (let y = h; y < GY; y++) p.set(x, y, y === h ? 17 : 16);
        const u2 = x + st.cam * 0.5, h2 = Math.round(52 + 3 * Math.sin(u2 * 0.07 + 2));
        for (let y = h2; y < GY; y++) p.set(x, y, y === h2 ? 16 : 15);
      }
      // ground scrolls with the distance walked, whole pixels only
      for (let x = 0; x < W; x++) {
        const wx = Math.floor(x + st.cam);
        p.set(x, GY, 18); p.rect(x, GY + 1, 1, 2, 17); p.rect(x, GY + 3, 1, SY - GY - 3, 27);
        if (Kit.hash2(wx, 0, 3) < 0.12) p.set(x, GY - 1, 17);
        if (Kit.hash2(wx, 1, 3) < 0.06) p.set(x, GY + 5 + (wx & 3), 28);
      }
      // shadow shrinks with height
      const sh = Math.max(2, 6 - Math.round(-st.jy / 8));
      p.rect(cx - sh + 1, GY + 1, sh * 2 - 1, 1, 16);
      drawChar(p, cx, GY + Math.round(st.jy), pose, cape.map(n => [Math.round(n.x), Math.round(n.y)]));
      // the pose strip
      p.rect(0, SY, W, H - SY, 1);
      const ps = stripPoses(), cw = Math.floor(W / ps.length), cur = stripIndex(ps.length);
      ps.forEach((q, i) => {
        const x = i * cw + (cw >> 1);
        if (i === cur) p.rect(i * cw + 1, H - 2, cw - 2, 1, 12);
        drawChar(p, x, H - 4 + (q.air ? -2 : 0), q, null);
      });
      paint(c.g, p);
    };
    const b = Kit.bar(host);
    b.tabs(['Walk', 'Idle', 'Jump'], v => { st.mode = v; st.jt = 0; st.jy = 0; st.air = false; st.js = 0; });
    b.tabs(['8 poses', '6 poses', '4 poses', 'smooth'], v => { st.poses = v === 'smooth' ? 0 : parseInt(v); });
    const b2 = Kit.bar(host);
    b2.slider('Speed', 8, 48, 1, st.speed, v => { st.speed = v; });
    b2.note('Leg phase follows distance walked, so feet never skate. Strip: the poses the parameters generate.');
    Kit.loop(host, step, draw, 60);
  });
})();
