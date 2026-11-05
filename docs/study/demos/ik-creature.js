// ik-creature.js: IK creature. A study demo, using motion-shared.js.
(() => {
  const { Pix, outline, blit, line, disc, paint, ik2 } = StudyShared.motion;
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
})();
