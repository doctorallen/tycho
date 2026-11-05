// motion.js: demos of procedural animation for the research page: a parametric walk/idle/jump with a verlet
// cape, a pointer-following creature on a follow-the-leader spine with two-bone IK legs, and pixel rotation
// (nearest neighbor against a RotSprite-style upscale-rotate-downsample). All state steps on a fixed clock.
'use strict';
(() => {
  const { Pix, rng, PAL } = Kit;

  // ---- small helpers ----
  function outline(p, col = 0) {
    const o = new Pix(p.w, p.h); o.d.set(p.d);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++)
      if (p.get(x, y) < 0 && (p.get(x - 1, y) >= 0 || p.get(x + 1, y) >= 0 || p.get(x, y - 1) >= 0 || p.get(x, y + 1) >= 0)) o.set(x, y, col);
    return o;
  }
  function blit(dst, src, dx, dy) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.d[y * src.w + x]; if (c >= 0) dst.set(dx + x, dy + y, c); }
  }
  // Bresenham line with a brush (w x 1 or 1 x 1)
  function line(p, x0, y0, x1, y1, c, w = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      for (let k = 0; k < w; k++) p.set(x0 + k, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  function disc(p, cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++)
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) p.set(x, y, c);
  }
  // draw a Pix onto a 2D context with fillRect runs: the per-frame path a GPU stand-in allows
  function paint(g, p) {
    g.clearRect(0, 0, p.w, p.h);
    for (let y = 0; y < p.h; y++) {
      let x = 0;
      while (x < p.w) {
        const c = p.d[y * p.w + x]; let e = x + 1;
        while (e < p.w && p.d[y * p.w + e] === c) e++;
        if (c >= 0) { g.fillStyle = PAL[c]; g.fillRect(x, y, e - x, 1); }
        x = e;
      }
    }
  }
  // two-bone IK by the law of cosines; for a limb hanging down, bend +1 puts the joint forward (+x), -1 back
  function ik2(ax, ay, bx, by, l1, l2, bend) {
    const dx = bx - ax, dy = by - ay;
    let d = Math.hypot(dx, dy);
    d = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(l1 + l2 - 0.01, d));
    const base = Math.atan2(dy, dx), t = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
    const a = base - bend * t, jx = ax + Math.cos(a) * l1, jy = ay + Math.sin(a) * l1;
    // the end may be out of reach: put it where the chain actually ends
    const b2 = Math.atan2(by - jy, bx - jx);
    return [jx, jy, jx + Math.cos(b2) * l2, jy + Math.sin(b2) * l2];
  }
  const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
    G: '011100101101011', H: '101101111101101', I: '111010010010111', K: '101101110101101', L: '100100100100111', M: '101111111101101',
    N: '10011101101110011001', O: '010101101101010', P: '110101110100100', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', 0: '111101101101111',
    1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110', 6: '011100111101111',
    7: '111001010010010', 8: '111101111101111', 9: '111101111001110', ' ': '000000000000000', '-': '000000111000000',
  };
  function text(p, s, x, y, c) {
    // glyphs are 3x5, or 4x5 when a letter needs a diagonal (N)
    for (const ch of s) { const g = FONT[ch] || FONT[' '], w = g.length / 5; for (let i = 0; i < g.length; i++) if (g[i] === '1') p.set(x + i % w, y + (i / w | 0), c); x += w + 1; }
  }

  // =====================================================================================
  // 1. walk-cycle: a character built from parameters each frame
  // =====================================================================================
  // Colors (dark, mid, light)
  const SKIN = [28, 29, 13], HAIR = [26, 27, 28], TUNIC = [21, 22, 23], PANTS = [26, 27, 28], BOOT = [1, 2, 3], CAPE = [9, 10, 11], BELT = 28;
  const THIGH = 5, SHIN = 5, UARM = 4, FARM = 4;

  // pose: everything needed to draw one frame, relative to the ground point under the hip
  // { hip: drop of the hip in px, torso: torso length, wide: +1/-1 torso width, feet: [[x,y] near, far] relative to the hip,
  //   hands: [[x,y] near, far] relative to the shoulder, blink, lean }
  function walkPose(phase) {
    const S = 8, lift = 3;
    const foot = ph => {
      ph = ((ph % 1) + 1) % 1;
      if (ph < 0.5) return [S / 2 - S * (ph / 0.5), 0];               // stance: planted, sliding back under the body
      const u = (ph - 0.5) / 0.5, e = u * u * (3 - 2 * u);              // swing: eased forward, lifted on a sine
      return [-S / 2 + S * e, -lift * Math.sin(Math.PI * u)];
    };
    const f0 = foot(phase), f1 = foot(phase + 0.5);
    const drop = Math.round(1 - Math.abs(Math.sin(2 * Math.PI * phase))); // lowest when the legs are spread
    // arms swing against the legs on the same side, from the same (quantized) phase
    return { hip: drop, torso: 8, wide: 0, feet: [f0, f1], hands: [[-f0[0] * 0.7, 7], [-f1[0] * 0.7, 7]], lean: 1 };
  }
  function idlePose(t, blink) {
    const breath = Math.sin(2 * Math.PI * t / 2.6) > 0.2 ? 1 : 0; // a held 1-px inhale, not a slide
    return { hip: 0, torso: 8 + breath, wide: 0, feet: [[1, 0], [-1, 0]], hands: [[0.5, 7 - breath * 0], [-0.5, 7]], lean: 0, blink };
  }
  // squash/stretch from a single number s: positive squashes (shorter, wider), negative stretches
  function jumpPose(s, air, vy) {
    const sq = Math.round(s * 2);
    const tuck = air ? Math.max(0, 1 - Math.abs(vy) / 90) : 0; // knees come up near the apex
    const feet = air ? [[1 + tuck * 2, -tuck * 4 + (vy < 0 ? 1 : 0)], [-1 + tuck, -tuck * 3]] : [[2, 0], [-2, 0]];
    const arms = s < -0.3 ? [[2, -6], [-2, -6]] : s > 0.3 ? [[-3, 5], [-4, 5]] : [[3, 2], [-2, 3]];
    return { hip: Math.max(0, sq * (air ? 0 : 1)), torso: 8 - (s > 0.4 ? 1 : 0) + (s < -0.4 ? 1 : 0), wide: s > 0.4 ? 1 : s < -0.4 ? -1 : 0, feet, hands: arms, lean: 0, blink: false, air };
  }

  // draw the character facing right; (gx, gy) is the ground point under the hip
  function drawChar(p, gx, gy, pose, cape) {
    const c = new Pix(p.w, p.h);
    const hipY = gy - (THIGH + SHIN) - 1 + pose.hip, hx = gx; // legs a touch bent when standing, so IK has room
    const top = hipY - pose.torso + 1, sx = hx + pose.lean, shY = top + 1;
    const halfL = 2 + (pose.wide > 0 ? 1 : 0), halfR = 2 - (pose.wide < 0 ? 1 : 0);
    // cape behind everything: thick near the shoulders, thin at the tip
    if (cape) for (let i = 1; i < cape.length; i++) {
      const w = i < 3 ? 3 : i < 5 ? 2 : 1;
      line(c, cape[i - 1][0] - (w >> 1), cape[i - 1][1], cape[i][0] - (w >> 1), cape[i][1], i > 3 ? CAPE[0] : CAPE[1], w);
    }
    const limb = (ax, ay, ex, ey, l1, l2, bend, col, colEnd, endLen, w) => {
      const [kx, ky, fx, fy] = ik2(ax, ay, ex, ey, l1, l2, bend);
      line(c, ax, ay, kx, ky, col, w); line(c, kx, ky, fx, fy, col, w);
      if (colEnd >= 0) line(c, kx + (fx - kx) * (1 - endLen / l2), ky + (fy - ky) * (1 - endLen / l2), fx, fy, colEnd, w);
      return [fx, fy];
    };
    // far leg and far arm first, a shade darker
    const legs = pose.feet.map(([fx, fy]) => [hx + fx, gy + fy - 1]);
    const far = limb(hx - 1, hipY + 1, legs[1][0] - 1, legs[1][1], THIGH, SHIN, 1, PANTS[0], BOOT[0], 2, 2);
    line(c, far[0] - 1, far[1], far[0] + 2, far[1], BOOT[0]);
    limb(sx - 1, shY + 1, sx - 1 + pose.hands[1][0], shY + 1 + pose.hands[1][1], UARM, FARM, -1, TUNIC[0], SKIN[0], 1, 1);
    // torso with a belt
    for (let y = top; y <= hipY; y++) for (let x = hx - halfL; x <= hx + halfR; x++) {
      const xx = x + (y < top + 3 ? pose.lean : 0);
      c.set(xx, y, x === hx - halfL ? TUNIC[2] : x === hx + halfR ? TUNIC[0] : TUNIC[1]);
    }
    for (let x = hx - halfL; x <= hx + halfR; x++) c.set(x, hipY - 1, BELT);
    // near leg
    const near = limb(hx, hipY + 1, legs[0][0], legs[0][1], THIGH, SHIN, 1, PANTS[1], BOOT[1], 2, 2);
    line(c, near[0], near[1], near[0] + 3, near[1], BOOT[1]);
    c.set(near[0] + 3, near[1] - 1, -1);
    // head: 7x7, hair on the back and top, face to the right
    const hy0 = top - 7, hx0 = sx - 3;
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      if ((x === 0 || x === 6) && (y === 0 || y === 6)) continue;
      const hair = y < 2 || (x < 3 && y < 5) || (x === 3 && y === 2);
      c.set(hx0 + x, hy0 + y, hair ? (y === 0 || x === 0 ? HAIR[2] : HAIR[1]) : x === 6 ? SKIN[0] : SKIN[1]);
    }
    c.set(hx0 + 7, hy0 + 4, SKIN[1]); // nose
    c.set(hx0 + 5, hy0 + 3, pose.blink ? SKIN[0] : 0);
    if (!pose.blink) c.set(hx0 + 5, hy0 + 4, 0);
    // near arm, over the torso
    limb(sx, shY + 1, sx + pose.hands[0][0], shY + 1 + pose.hands[0][1], UARM, FARM, -1, TUNIC[2], SKIN[1], 1, 1);
    blit(p, outline(c, 0), 0, 0);
  }

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

  // =====================================================================================
  // 2. ik-creature: follow-the-leader spine with bend limits, legs placed by two-bone IK
  // =====================================================================================
  const CREATURES = {
    Lizard: { n: 15, seg: 3, speed: 34, turn: 3.2, bend: 0.38, radius: i => i === 0 ? 3.2 : i === 1 ? 2.6 : i < 7 ? 3.6 - Math.abs(i - 4) * 0.25 : Math.max(0.6, 3.2 - (i - 6) * 0.36),
      ramp: [15, 16, 17, 19], spots: 31, legs: [[2, 1, 4.5, 4.5, 1.5], [2, -1, 4.5, 4.5, 1.5], [6, 1, 4.5, 4.5, -1], [6, -1, 4.5, 4.5, -1]], pairs: [[0, 3], [1, 2]], reach: 6.5, ahead: 1.5, trigger: 4.5 },
    Spider: { n: 4, seg: 4, speed: 32, turn: 4.5, bend: 0.3, radius: i => [2.2, 3, 4, 2.6][i],
      ramp: [1, 30, 31, 12], spots: 13, pairs: [[0, 3, 4, 7], [1, 2, 5, 6]], reach: 12, ahead: 0, trigger: 5.5,
      legs: [[1, 1, 8, 9, 7], [1, -1, 8, 9, 7], [1, 1, 8, 9, 2.5], [1, -1, 8, 9, 2.5], [1, 1, 8, 9, -2.5], [1, -1, 8, 9, -2.5], [1, 1, 8, 9, -7], [1, -1, 8, 9, -7]] },
  };
  Kit.register('ik-creature', { title: 'IK creature', fit: 'per-frame' }, host => {
    const W = 160, H = 96;
    const c = Kit.canvas(host, W, H);
    c.cv.style.touchAction = 'pan-y';
    let kind = 'Lizard', C, pts, heading, legs, tick = 0, ptr = null, ptrTick = -9999, bones = false;
    const reset = () => {
      C = CREATURES[kind];
      heading = 0; pts = Array.from({ length: C.n }, (_, i) => ({ x: 60 - i * C.seg, y: 48 }));
      legs = C.legs.map(() => ({ x: 0, y: 0, fx: 0, fy: 0, tx: 0, ty: 0, t: 1, placed: false }));
    };
    reset();
    // the background is fixed, so it is painted once
    // calm ground: two close tones in soft patches, a few pebbles, so the creature carries the contrast
    const ground = new Pix(W, H).fill(27);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Kit.fbm(x / 30, y / 30, 3, 3) > 0.22) ground.set(x, y, 26);
    for (let k = 0; k < 16; k++) { const x = Math.floor(Kit.hash2(k, 0, 9) * W), y = Math.floor(Kit.hash2(k, 1, 9) * H); ground.set(x, y, 28); ground.set(x + 1, y, 28); ground.set(x, y + 1, 26); ground.set(x + 1, y + 1, 26); }
    for (let k = 0; k < 18; k++) { const x = Math.floor(Kit.hash2(k, 4, 9) * W), y = Math.floor(Kit.hash2(k, 5, 9) * H); ground.set(x, y, 17); ground.set(x - 1, y + 1, 16); ground.set(x + 1, y + 1, 16); }
    const frame = (i) => { // forward and left-normal at spine point i
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + (i === 0 ? 1 : 0))];
      let fx = a.x - b.x, fy = a.y - b.y; if (i === 0) { fx = Math.cos(heading); fy = Math.sin(heading); }
      const l = Math.hypot(fx, fy) || 1; fx /= l; fy /= l;
      return [fx, fy, fy, -fx];
    };
    const step = dt => {
      tick++;
      // target: the pointer while it is recent, otherwise a slow figure-eight that never repeats exactly
      let tx, ty;
      if (ptr && tick - ptrTick < 180) [tx, ty] = ptr;
      else { const t = tick / 60; tx = W / 2 + 58 * Math.sin(t * 0.41) + 8 * Math.sin(t * 1.3); ty = H / 2 + 28 * Math.sin(t * 0.67 + 1); }
      const head = pts[0], dx = tx - head.x, dy = ty - head.y, dist = Math.hypot(dx, dy);
      if (dist > 3) {
        let da = Math.atan2(dy, dx) - heading;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        heading += Math.max(-C.turn * dt, Math.min(C.turn * dt, da));
        const sp = C.speed * Math.min(1, dist / 20) * (Math.abs(da) > 1.5 ? 0.4 : 1);
        head.x += Math.cos(heading) * sp * dt; head.y += Math.sin(heading) * sp * dt;
      }
      // follow the leader with an angle limit at each joint
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        let ang = Math.atan2(b.y - a.y, b.x - a.x);
        const prev = i === 1 ? heading + Math.PI : Math.atan2(a.y - pts[i - 2].y, a.x - pts[i - 2].x);
        let rel = Math.atan2(Math.sin(ang - prev), Math.cos(ang - prev));
        rel = Math.max(-C.bend, Math.min(C.bend, rel));
        ang = prev + rel;
        b.x = a.x + Math.cos(ang) * C.seg; b.y = a.y + Math.sin(ang) * C.seg;
      }
      // legs: a foot steps when its ideal spot drifts too far, and only while its partners are planted
      const stepping = legs.map(l => l.t < 1);
      C.legs.forEach(([si, side, l1, l2, fwd], k) => {
        const L = legs[k], [fx, fy, nx, ny] = frame(si);
        L.x = pts[si].x + nx * side * C.radius(si) * 0.5; L.y = pts[si].y + ny * side * C.radius(si) * 0.5;
        const ix = L.x + nx * side * C.reach + fx * (fwd + C.ahead), iy = L.y + ny * side * C.reach + fy * (fwd + C.ahead);
        L.ix = ix; L.iy = iy;
        if (!L.placed) { L.fx = L.tx = ix; L.fy = L.ty = iy; L.placed = true; }
        const group = C.pairs.find(g => g.includes(k)), other = C.pairs.find(g => !g.includes(k));
        const busy = other.some(j => stepping[j]);
        if (L.t >= 1 && !busy && Math.hypot(ix - L.fx, iy - L.fy) > C.trigger) {
          L.sx = L.fx; L.sy = L.fy; L.tx = ix + fx * C.trigger * 0.5; L.ty = iy + fy * C.trigger * 0.5; L.t = 0;
          group.forEach(j => { stepping[j] = true; });
        }
        if (L.t < 1) {
          L.t = Math.min(1, L.t + dt * 7);
          const e = L.t * L.t * (3 - 2 * L.t);
          L.fx = L.sx + (L.tx - L.sx) * e; L.fy = L.sy + (L.ty - L.sy) * e;
        }
      });
    };
    const draw = () => {
      const p = new Pix(W, H); p.d.set(ground.d);
      const body = new Pix(W, H), ramp = C.ramp;
      // legs under the body: thigh and shin from IK, knee bent away from the body
      C.legs.forEach(([si, side, l1, l2], k) => {
        const L = legs[k];
        const [kx, ky, ex, ey] = ik2(L.x, L.y, L.fx, L.fy, l1, l2, side > 0 ? -1 : 1);
        line(body, L.x, L.y, kx, ky, ramp[1]); line(body, kx, ky, ex, ey, ramp[1]);
        body.set(Math.round(kx), Math.round(ky), ramp[2]);
        body.set(Math.round(ex), Math.round(ey), L.t < 1 ? ramp[3] : ramp[0]); // a lifted foot catches the light
      });
      // body: discs from tail to head, a lit stripe along the back, spots, then eyes
      for (let i = pts.length - 1; i >= 0; i--) disc(body, pts[i].x, pts[i].y, C.radius(i), ramp[1]);
      for (let i = pts.length - 1; i >= 0; i--) { const r = C.radius(i); if (r > 1.6) disc(body, pts[i].x - 0.4, pts[i].y - 0.6, r * 0.45, ramp[2]); }
      for (let i = 2; i < pts.length - 2; i += 2) { const [, , nx, ny] = frame(i), s = i % 4 ? 1 : -1, r = C.radius(i); if (r > 2) body.set(Math.round(pts[i].x + nx * s * r * 0.55), Math.round(pts[i].y + ny * s * r * 0.55), C.spots); }
      const [fx, fy, nx, ny] = frame(0), hx = pts[0].x + fx * 1.4, hy = pts[0].y + fy * 1.4;
      for (const s of [1, -1]) body.set(Math.round(hx + nx * s * 1.6), Math.round(hy + ny * s * 1.6), 7);
      if (kind === 'Spider') for (const s of [1, -1]) body.set(Math.round(hx + nx * s * 0.6 + fx), Math.round(hy + ny * s * 0.6 + fy), 13);
      const o = outline(body, 0);
      // a drop shadow on the ground, then the creature
      for (let i = 0; i < o.d.length; i++) if (o.d[i] >= 0) { const x = i % W + 1, y = (i / W | 0) + 2; if (x < W && y < H) p.d[y * W + x] = 26; }
      blit(p, o, 0, 0);
      if (bones) {
        C.legs.forEach((_, k) => { const L = legs[k]; p.set(Math.round(L.ix), Math.round(L.iy), 13); });
        pts.forEach(q => p.set(Math.round(q.x), Math.round(q.y), 11));
      }
      paint(c.g, p);
    };
    const toTarget = e => { ptr = c.at(e); ptrTick = tick; };
    c.cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') toTarget(e); });
    c.cv.addEventListener('pointerdown', toTarget);
    const b = Kit.bar(host);
    b.tabs(['Lizard', 'Spider'], v => { kind = v; reset(); });
    b.check('Show bones', false, v => { bones = v; });
    b.note('Point or tap to lead it; it wanders on its own after a few seconds.');
    Kit.loop(host, step, draw, 60);
  });

  // =====================================================================================
  // 3. rotation: nearest neighbor against RotSprite-style (Scale2x three times, rotate, most common color)
  // =====================================================================================
  const SPR = {
    Sword: () => {
      const p = new Pix(16, 16);
      for (let y = 1; y <= 9; y++) { p.set(7, y, 7); p.set(8, y, 5); }
      p.set(7, 0, 6); p.set(8, 0, -1);
      for (let x = 4; x <= 11; x++) p.set(x, 10, x < 8 ? 13 : 12);
      for (let y = 11; y <= 13; y++) { p.set(7, y, y & 1 ? 28 : 27); p.set(8, y, 27); }
      p.rect(6, 14, 4, 1, 12); p.set(6, 14, 13);
      return outline(p, 0);
    },
    Ship: () => {
      const rows = ['.......aa.......', '......abba......', '......abba......', '.....abccba.....', '.....abccba.....', '.....abbbba.....',
        '....aabbbbaa....', '...aaabbbbaaa...', '..aaaabbbbaaaa..', '.aaa.abbbba.aaa.', '.aa..abbbba..aa.', '.a...aaaaaa...a.', '.....dd..dd.....', '......d..d......'];
      const map = { a: 10, b: 6, c: 24, d: 12 };
      const p = new Pix(16, 16);
      rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') p.set(x, y + 1, map[ch]); }));
      return outline(p, 0);
    },
    Hero: () => {
      const rows = ['....hhhhh.....', '...hhhhhhh....', '...hssssshh...', '...hsesesh....', '...sssssss....', '....sssss.....', '...ttttttt....', '..tttttttTt...',
        '..stttttTTs...', '...tttttTt....', '...bbbbbbB....', '...bb...bB....', '...bb...bB....', '..fff..fff....'];
      const map = { h: 27, s: 29, e: 0, t: 22, T: 21, b: 28, B: 27, f: 2 };
      const p = new Pix(16, 16);
      rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') p.set(x + 1, y + 1, map[ch]); }));
      return outline(p, 0);
    },
  };
  // Scale2x (EPX), treating clear (-1) as just another color
  function scale2x(s) {
    const o = new Pix(s.w * 2, s.h * 2), g = (x, y) => s.get(Math.max(0, Math.min(s.w - 1, x)), Math.max(0, Math.min(s.h - 1, y)));
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const B = g(x, y - 1), D = g(x - 1, y), E = g(x, y), F = g(x + 1, y), Hh = g(x, y + 1);
      let e0 = E, e1 = E, e2 = E, e3 = E;
      if (B !== Hh && D !== F) { if (D === B) e0 = D; if (B === F) e1 = F; if (D === Hh) e2 = D; if (Hh === F) e3 = F; }
      o.set(2 * x, 2 * y, e0); o.set(2 * x + 1, 2 * y, e1); o.set(2 * x, 2 * y + 1, e2); o.set(2 * x + 1, 2 * y + 1, e3);
    }
    return o;
  }
  function rotNearest(src, deg, D) {
    const o = new Pix(D, D), a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
      const dx = x + 0.5 - D / 2, dy = y + 0.5 - D / 2;
      o.set(x, y, src.get(Math.floor(ca * dx + sa * dy + src.w / 2), Math.floor(-sa * dx + ca * dy + src.h / 2)));
    }
    return o;
  }
  function rotSprite(big, srcW, srcH, deg, D) {
    const o = new Pix(D, D), a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), K = 8;
    const count = new Map();
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
      count.clear();
      for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) {
        const dx = x + (i + 0.5) / K - D / 2, dy = y + (j + 0.5) / K - D / 2;
        const c = big.get(Math.floor((ca * dx + sa * dy + srcW / 2) * K), Math.floor((-sa * dx + ca * dy + srcH / 2) * K));
        count.set(c, (count.get(c) || 0) + (c === 0 ? 1.35 : 1)); // a small nudge toward the outline keeps it closed
      }
      let best = -1, bn = -1;
      for (const [c, n] of count) if (n > bn) { bn = n; best = c; }
      o.set(x, y, best);
    }
    return o;
  }
  Kit.register('rotation', { title: 'Rotating pixel sprites', fit: 'prebake' }, host => {
    const W = 160, H = 136, D = 24, ANG = [0, 15, 30, 45, 60, 75];
    const c = Kit.canvas(host, W, H);
    const st = { spr: 'Sword', angle: 37, spin: false };
    let src, big;
    const prep = () => { src = SPR[st.spr](); big = scale2x(scale2x(scale2x(src))); };
    const cell = (p, x0, y0) => { for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) p.set(x0 + x, y0 + y, (x + y) & 1 ? 3 : 4); };
    const big2 = (p, s, x0, y0) => { for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const v = s.get(x, y); if (v >= 0) p.rect(x0 + x * 2, y0 + y * 2, 2, 2, v); } };
    const draw = () => {
      const p = new Pix(W, H).fill(1);
      ANG.forEach((a, k) => {
        const x0 = 2 + k * 26, s = String(a);
        text(p, s, x0 + 12 - s.length * 2, 1, 6);
        cell(p, x0, 15); blit(p, rotNearest(src, a, D), x0, 15);
        cell(p, x0, 49); blit(p, rotSprite(big, src.w, src.h, a, D), x0, 49);
      });
      text(p, 'NEAREST NEIGHBOR', 2, 8, 12);
      text(p, 'ROTSPRITE 8X', 2, 42, 24);
      const a = Math.round(st.angle) % 360;
      text(p, 'NEAREST', 8, 79, 12); text(p, 'ROTSPRITE', 96, 79, 24); text(p, a + ' DEG', 64, 104, 6);
      for (const [x0, f] of [[8, rotNearest], [96, null]]) {
        for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) p.set(x0 + x, 86 + y, ((x >> 1) + (y >> 1)) & 1 ? 3 : 4);
        big2(p, f ? f(src, a, D) : rotSprite(big, src.w, src.h, a, D), x0, 86);
      }
      c.put(p);
    };
    prep();
    const b = Kit.bar(host);
    b.tabs(['Sword', 'Ship', 'Hero'], v => { st.spr = v; prep(); draw(); });
    const sl = b.slider('Angle', 0, 359, 1, st.angle, v => { st.angle = v; draw(); });
    b.check('Spin', false, v => { st.spin = v; });
    // spinning steps 5 degrees at 10 Hz, enough to see nearest neighbor shimmer while RotSprite holds its lines
    Kit.loop(host, () => { if (st.spin) { st.angle = (st.angle + 5) % 360; sl.value = st.angle; sl.nextSibling.nextSibling.textContent = st.angle; } }, () => { if (st.spin) draw(); }, 10);
    draw();
  });
})();
