// motion-shared.js: the helpers the motion demos share (walk-cycle, ik-creature, rotation), loaded before any of them.
// Each helper is exported on StudyShared, and a demo takes the ones it uses. Every random choice comes from
// Kit.rng, Kit.hash2 or Kit.noise2, so a seed always rebuilds the same picture.
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

  window.StudyShared = window.StudyShared || {};
  StudyShared.motion = { Pix, rng, PAL, outline, blit, line, disc, paint, ik2, FONT, text, SKIN, HAIR, TUNIC, PANTS, BOOT, CAPE, BELT, THIGH, SHIN, UARM, FARM, walkPose, idlePose, jumpPose, drawChar };
})();
