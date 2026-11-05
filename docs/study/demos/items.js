// items.js: Part-built items. A study demo, using sprites-shared.js.
(() => {
  const { Pix, rng, outline, blit, RAMP } = StudyShared.sprites;
  // =====================================================================================
  // 3. items: part-built loot whose look and name come from the same rolled stats
  // =====================================================================================
  // Four-step ramps (dark to light). The stats pick the parts and ramps: base type picks the shape family,
  // material picks the metal ramp, element picks an accent ramp and an overlay, rarity adds gems and a halo,
  // level stretches the blade. The name is built from the same stats, so picture and name always agree.
  const METALS = { Iron: [2, 3, 5, 6], Steel: [3, 4, 6, 7], Bronze: [27, 28, 29, 13], Gold: [28, 12, 13, 7], Obsidian: [1, 2, 30, 31], Bone: [28, 29, 6, 7] };
  const ELEMENTS = {
    Ember: { ramp: [9, 10, 11, 12], fx: [12, 13], gem: 'Ruby', word: 'fire' },
    Frost: { ramp: [21, 22, 24, 25], fx: [25, 7], gem: 'Sapphire', word: 'frost' },
    Venom: { ramp: [15, 16, 17, 18], fx: [17, 18], gem: 'Emerald', word: 'poison' },
    Storm: { ramp: [11, 12, 13, 7], fx: [13, 7], gem: 'Topaz', word: 'lightning' },
    Gloom: { ramp: [1, 30, 31, 6], fx: [31, 30], gem: 'Amethyst', word: 'shadow' },
    Tide: { ramp: [20, 22, 23, 24], fx: [24, 25], gem: 'Aquamarine', word: 'water' },
  };
  const WOODS = [[26, 27, 28, 29], [8, 9, 10, 11], [20, 21, 22, 23], [26, 27, 28, 13]];
  const SUFFIX = ['of the Fen', 'of Dawn', 'of Echoes', 'of the Moth', 'of Seven Bells', 'of Quiet', 'of the Tide', 'of Ash', 'of the Lark', 'of Thorns'];
  const RARITY = ['common', 'magic', 'rare'];
  const CATS = { Blades: 'blade', Potions: 'potion', Gems: 'gem', Shields: 'shield', 'Rings & keys': 'ring', 'Books & scrolls': 'book' };

  function rollItem(seed, cat) {
    const r = rng(seed * 2654435761 + 17);
    const it = {
      cat, rarity: r() < 0.45 ? 0 : r() < 0.65 ? 1 : 2, level: r.int(1, 10),
      metal: r.pick(Object.keys(METALS)), element: r.pick(Object.keys(ELEMENTS)), r,
    };
    if (it.rarity === 0 && cat === 'blade') it.element = null;
    if (cat === 'ring' && (it.metal === 'Obsidian' || it.metal === 'Bone')) it.metal = 'Gold';
    const base = {
      blade: () => r.pick(['Dagger', 'Sword', 'Blade', 'Saber', 'Cleaver', 'Rapier']),
      potion: () => r.pick(['Draught', 'Tonic', 'Elixir', 'Phial', 'Brew']),
      gem: () => null, shield: () => r.pick(['Buckler', 'Heater', 'Kite Shield', 'Targe']),
      ring: () => r.pick(['Ring', 'Band', 'Signet', 'Key', 'Key']),
      book: () => r.pick(['Tome', 'Grimoire', 'Codex', 'Scroll', 'Scroll']),
    }[cat]();
    it.base = base;
    const el = it.element ? ELEMENTS[it.element] : null;
    const suf = SUFFIX[r.int(0, SUFFIX.length - 1)];
    if (cat === 'gem') {
      it.cut = r.pick(['round', 'oval', 'emerald', 'pear', 'marquise', 'trillion']);
      it.name = (it.rarity === 2 ? 'Flawless ' : it.rarity === 1 ? '' : 'Rough ') + el.gem;
    } else if (cat === 'potion') {
      it.name = (it.rarity ? r.pick(['Greater ', 'Bright ', 'Old ', 'Lesser ']) : '') + base + ' of ' + { Ember: 'Fire', Frost: 'Frost', Venom: 'Venom', Storm: 'Sparks', Gloom: 'Shadow', Tide: 'the Deep' }[it.element];
    } else if (it.rarity === 0) it.name = it.metal + ' ' + base;
    else if (it.rarity === 1) it.name = it.element + ' ' + base;
    else it.name = it.element + ' ' + base + ' ' + suf;
    it.detail = RARITY[it.rarity] + ' · ' + (cat === 'potion' || cat === 'gem' ? '' : it.metal.toLowerCase() + ' · ') + (el && (it.rarity || cat === 'potion' || cat === 'gem') ? el.word + ' · ' : '') + 'level ' + it.level;
    return it;
  }

  // rasterize a stroke along a 45-degree axis: f(t, s) returns a color or -1 for pixel centers,
  // t along the axis from the origin, s across it (negative is the upper-left, lit side)
  function axial(p, ox, oy, f) {
    const k = Math.SQRT1_2;
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const dx = x + 0.5 - ox, dy = y + 0.5 - oy;
      const t = (dx - dy) * k, s = (dx + dy) * k;
      const c = f(t, s); if (c >= 0) p.set(x, y, c);
    }
  }
  function drawBlade(p, it) {
    const r = it.r, m = METALS[it.metal], el = it.element ? ELEMENTS[it.element] : null;
    const kind = it.base, wood = r.pick(WOODS);
    const short = kind === 'Dagger', thin = kind === 'Rapier', wide = kind === 'Cleaver', curve = kind === 'Saber' ? 1.6 : 0;
    const gl = short ? 3 : 3.5, bl = (short ? 7.5 : 10) + it.level * (short ? 0.25 : 0.4);
    const bw = thin ? 0.55 : wide ? 1.9 : short ? 1.1 : 1.25, gw = short ? 2.3 : thin ? 2.0 : 3.1;
    const guardRamp = it.rarity ? el.ramp : (r.chance(0.5) ? METALS.Gold : m);
    const g0 = gl, g1 = gl + 1.3, tip = g1 + bl;
    const ox = 3.2, oy = p.h - 3.2;
    axial(p, ox, oy, (t, s) => {
      if (t < -1.6 || t > tip) return -1;
      if (t < 0) return Math.hypot(t + 0.4, s) < 1.25 ? guardRamp[s + t < -0.6 ? 3 : 1] : -1; // pommel
      if (t < g0) return Math.abs(s) < 0.75 ? wood[(Math.floor(t * 1.4) & 1) ? 1 : 2] : -1; // wrapped grip
      if (t < g1) { // guard, tips bent toward the blade on some swords
        const bend = kind === 'Sword' || kind === 'Blade' ? 0 : 0.6;
        return Math.abs(s) < gw && t < g1 - bend * Math.abs(s) / gw + bend ? guardRamp[s < -0.2 ? 3 : s > 0.6 ? 0 : 2] : -1;
      }
      const u = (t - g1) / bl, c = curve * u * u, ss = s - c;
      const taper = Math.min(1, (tip - t) / (thin ? 2 : wide ? 1.2 : 2.6));
      const hw = bw * (wide ? 1 : taper) + 0.05;
      if (wide && t > tip - 1.5 && ss < -bw + (tip - t)) return -1; // the cleaver's clipped corner
      if (Math.abs(ss) > hw) return -1;
      if (ss < -hw + 0.75) return m[3];
      if (ss > hw - 0.75) return m[1];
      return m[2];
    });
    if (it.rarity) { // a set gem in the guard
      const cx = Math.round(ox + (g0 + 0.6) * Math.SQRT1_2), cy = Math.round(oy - (g0 + 0.6) * Math.SQRT1_2);
      p.set(cx, cy - 1, el.ramp[3]); p.set(cx, cy, el.ramp[1]);
    }
    return { tipX: ox + tip * Math.SQRT1_2, tipY: oy - tip * Math.SQRT1_2 };
  }
  function drawPotion(p, it) {
    const r = it.r, liq = ELEMENTS[it.element].ramp, cx = 10;
    const shape = r.pick(['round', 'round', 'tall', 'cone', 'square']);
    const inBody = {
      round: (x, y) => Math.hypot(x - cx, (y - 12.5) * 1.05) < 5.6,
      tall: (x, y) => x > 6.5 && x < 13.5 && y > 7 && y < 17.5 && !((x < 7.5 || x > 12.5) && (y < 8 || y > 16.5)),
      cone: (x, y) => y > 7.5 && y < 17.5 && Math.abs(x - cx) < 1.6 + (y - 7.5) * 0.6,
      square: (x, y) => x > 5.5 && x < 14.5 && y > 9 && y < 17.5 && !((x < 6.5 || x > 13.5) && (y < 10 || y > 16.5)),
    }[shape];
    let top = 99, bot = 0;
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) if (inBody(x + 0.5, y + 0.5)) { top = Math.min(top, y); bot = Math.max(bot, y); }
    const level = Math.round(top + (bot - top) * (0.2 + r() * 0.45));
    for (let y = top; y <= bot; y++) for (let x = 0; x < 20; x++) {
      if (!inBody(x + 0.5, y + 0.5)) continue;
      if (y < level) { p.set(x, y, x < cx - 2 ? 4 : 3); continue; } // empty glass
      const s = y === level ? 3 : x < cx - 2 ? 2 : x > cx + 1 ? 0 : 1;
      p.set(x, y, liq[s]);
    }
    // neck, lip and cork
    for (let y = top - 3; y < top; y++) { p.set(cx - 1, y, 4); p.set(cx, y, 3); }
    p.rect(cx - 2, top - 4, 4, 1, 5);
    p.rect(cx - 1, top - 6, 2, 2, 28); p.set(cx - 1, top - 6, 29);
    // glass highlight and bubbles
    p.set(cx - 3, level + 1, 7); p.set(cx - 3, level + 2, liq[3]);
    if (shape === 'round' || shape === 'square') p.set(cx - 4, top + 2, 6);
    p.set(cx + 1, bot - 2, liq[3]); if (it.rarity) p.set(cx - 1, bot - 4, 7);
    if (it.rarity === 2) { p.rect(cx - 2, top + 1 + ((level - top) >> 1), 4, 1, 13); } // a gold band on fine bottles
    return { tipX: cx, tipY: top - 6 };
  }
  function drawGem(p, it) {
    const r = it.r, ramp = ELEMENTS[it.element].ramp, cx = 10, cy = 10;
    const R = 4.2 + it.rarity * 1.1 + it.level * 0.08;
    const cut = it.cut;
    const n = { round: 8, oval: 8, emerald: 8, pear: 9, marquise: 10, trillion: 3 }[cut];
    const verts = [];
    for (let k = 0; k < n; k++) {
      let a = -Math.PI / 2 + k * 2 * Math.PI / n + (cut === 'emerald' ? Math.PI / 8 : 0);
      let rx = R, ry = R;
      if (cut === 'oval') ry = R * 1.25, rx = R * 0.9;
      if (cut === 'emerald') rx = R * 0.85, ry = R * 1.15;
      if (cut === 'marquise') { rx = R * 0.7; ry = R * 1.35; }
      let x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      if (cut === 'pear' && y < 0) x *= 1 + y / R * 0.6;
      if (cut === 'trillion') { x *= 1.45; y = y * 1.45 + 1.2; }
      verts.push([cx + x, cy + y]);
    }
    const inside = (x, y, vs) => { let c = false; for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) { const [xi, yi] = vs[i], [xj, yj] = vs[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    const table = verts.map(([x, y]) => [cx - 0.6 + (x - cx) * 0.45, cy - 0.6 + (y - cy) * 0.45]);
    const L = [-0.75, -0.66];
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const px = x + 0.5, py = y + 0.5;
      if (!inside(px, py, verts)) continue;
      if (inside(px, py, table)) { p.set(x, y, ramp[2]); continue; }
      // the facet faces outward along the angle of the sector this pixel falls in
      const a = Math.atan2(py - cy, px - cx), sec = Math.round((a + Math.PI / 2) / (2 * Math.PI / n));
      const fa = -Math.PI / 2 + sec * 2 * Math.PI / n;
      const d = Math.cos(fa) * L[0] + Math.sin(fa) * L[1];
      p.set(x, y, ramp[d > 0.5 ? 3 : d > 0.05 ? 2 : d > -0.55 ? 1 : 0]);
    }
    if (R > 5) verts.forEach(([vx, vy], k) => { // facet edges from the table's corners outward, on the shadow side only
      const [tx0, ty0] = table[k];
      for (let u = 0.2; u < 0.9; u += 0.15) { const x = Math.floor(tx0 + (vx - tx0) * u), y = Math.floor(ty0 + (vy - ty0) * u); if (x + y > cx + cy && p.get(x, y) >= 0) p.set(x, y, ramp[0]); }
    });
    const tx = Math.round(table[0][0]) - 1, ty = Math.round(cy - R * 0.25);
    p.set(tx, ty, 7); if (it.rarity) p.set(tx + 1, ty - 1, 7);
    return { tipX: cx + R * 0.7, tipY: cy - R };
  }
  function drawShield(p, it) {
    const r = it.r, rim = METALS[it.metal], cx = 10;
    const field = r.pick(RAMP.cloth.map(c => [c[0], c[0], c[1], c[2]])), field2 = r.pick(WOODS.concat([[3, 5, 6, 7], [8, 10, 11, 12], [20, 22, 23, 24]]));
    const kind = it.base;
    const inS = {
      Heater: (x, y) => y > 2.5 && y < 18 && Math.abs(x - cx) < (y < 10 ? 7 : 7 * Math.sqrt(Math.max(0, 1 - ((y - 10) / 8) ** 2))),
      'Kite Shield': (x, y) => { const t = (y - 2.5) / 15.5; return t > 0 && t < 1 && Math.abs(x - cx) < (t < 0.3 ? 4 + t / 0.3 * 2.5 : 6.5 * (1 - (t - 0.3) / 0.7) + 0.6); },
      Buckler: (x, y) => Math.hypot(x - cx, y - 10.5) < 6.4,
      Targe: (x, y) => Math.hypot(x - cx, y - 10.5) < 7.6,
    }[kind];
    const div = r.pick(['pale', 'fess', 'chevron', 'cross', 'bend', 'plain', 'saltire']);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const px = x + 0.5, py = y + 0.5;
      if (!inS(px, py)) continue;
      const edge = !inS(px - 1, py) || !inS(px + 1, py) || !inS(px, py - 1) || !inS(px, py + 1);
      const sh = px < cx - 3 ? 3 : px > cx + 3 ? 1 : 2;
      if (edge) { p.set(x, y, rim[(!inS(px - 1, py) || !inS(px, py - 1)) && !(!inS(px + 1, py) || !inS(px, py + 1)) ? 3 : 1]); continue; }
      const dx = px - cx, dy = py - 10;
      const second = { pale: dx > 0, fess: dy > 0, chevron: dy > 2 - Math.abs(dx) * 0.9 && dy < 5 - Math.abs(dx) * 0.9, cross: Math.abs(dx) < 1.1 || Math.abs(dy + 1) < 1.1,
        bend: Math.abs(dx + dy) < 1.6, plain: false, saltire: Math.abs(dx - dy) < 1.1 || Math.abs(dx + dy) < 1.1 }[div];
      p.set(x, y, (second ? field2 : field)[sh]);
    }
    if (kind === 'Buckler' || kind === 'Targe' || it.rarity) { // a boss, or a gem for magic shields
      const bc = it.rarity ? ELEMENTS[it.element].ramp : rim;
      p.set(cx - 1, 10, bc[3]); p.set(cx, 10, bc[2]); p.set(cx - 1, 11, bc[2]); p.set(cx, 11, bc[1]);
      if (kind === 'Targe') for (const [x, y] of [[cx - 5, 7], [cx + 4, 7], [cx - 5, 13], [cx + 4, 13]]) p.set(x, y, rim[3]);
    }
    return { tipX: cx + 6, tipY: 3 };
  }
  function drawRing(p, it) {
    const r = it.r, m = METALS[it.metal], el = ELEMENTS[it.element];
    if (it.base === 'Key') {
      const by = 7, bx = 6;
      for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
        const d = Math.hypot(x + 0.5 - bx, y + 0.5 - by);
        if (d < 3.9 && d > (it.rarity ? 0 : 1.6)) p.set(x, y, m[x + y < bx + by - 2 ? 3 : x + y > bx + by + 2 ? 1 : 2]);
      }
      if (it.rarity) { p.set(bx - 1, by - 1, el.ramp[3]); p.set(bx, by - 1, el.ramp[2]); p.set(bx - 1, by, el.ramp[2]); p.set(bx, by, el.ramp[1]); }
      // shaft along the diagonal, then teeth from the seed's bits
      for (let k = 0; k < 9; k++) { p.set(bx + 2 + k, by + 2 + k, m[2]); p.set(bx + 3 + k, by + 2 + k, m[1]); p.set(bx + 2 + k, by + 1 + k, m[3]); }
      const bits = r.int(1, 15);
      for (let k = 0; k < 4; k++) if (bits >> k & 1 || k === 3) { const x = bx + 7 + k, y = by + 7 + k; p.set(x - 1, y + 1, m[1]); p.set(x - 2, y + 2, m[0 + 1]); }
      return { tipX: 15, tipY: 5 };
    }
    const cx = 10, cy = 12, sig = it.base === 'Signet';
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const dx = (x + 0.5 - cx) / 6, dy = (y + 0.5 - cy) / 4.3, o = dx * dx + dy * dy;
      const ix = (x + 0.5 - cx) / 3.6, iy = (y + 0.5 - cy - 0.4) / 2.0, i = ix * ix + iy * iy;
      if (o < 1 && i > 1) p.set(x, y, m[y + 0.5 < cy ? (x < cx ? 2 : 1) : (x < cx - 1 ? 3 : x > cx + 2 ? 1 : 2)]);
    }
    if (sig) { p.rect(cx - 2, cy - 6, 4, 3, m[2]); p.rect(cx - 2, cy - 6, 2, 1, m[3]); p.set(cx, cy - 5, el.ramp[1]); p.set(cx - 1, cy - 5, el.ramp[2]); }
    else if (it.rarity || it.base === 'Ring') { // a set stone on prongs
      p.set(cx - 2, cy - 4, m[3]); p.set(cx + 1, cy - 4, m[1]);
      p.rect(cx - 1, cy - 7, 2, 3, el.ramp[1]); p.set(cx - 1, cy - 7, el.ramp[3]); p.set(cx - 1, cy - 6, el.ramp[2]); p.set(cx, cy - 7, el.ramp[2]);
      p.set(cx - 2, cy - 6, el.ramp[0]); p.set(cx + 1, cy - 6, el.ramp[0]);
    }
    return { tipX: cx + 4, tipY: cy - 7 };
  }
  function drawBook(p, it) {
    const r = it.r, el = ELEMENTS[it.element];
    if (it.base === 'Scroll') {
      const paper = [28, 29, 13, 7], wood = r.pick(WOODS);
      for (let y = 5; y <= 14; y++) for (let x = 5; x <= 14; x++) p.set(x, y, paper[x === 14 ? 1 : x === 5 ? 3 : 2]);
      for (let y = 6; y < 14; y += 2) for (let x = 7; x < 13; x++) if (r() < 0.8) p.set(x, y, 28); // lines of writing
      for (const ry of [3, 15]) { // the rolls
        p.rect(4, ry, 12, 2, paper[2]); p.rect(4, ry, 12, 1, paper[3]); p.rect(4, ry + 1, 12, 1, paper[1]);
        p.rect(3, ry, 1, 2, wood[2]); p.rect(16, ry, 1, 2, wood[1]);
      }
      // a wax seal and ribbon
      const sc = it.rarity ? el.ramp : [8, 9, 10, 11];
      p.set(9, 16, sc[2]); p.set(10, 16, sc[1]); p.set(9, 17, sc[1]); p.set(10, 17, sc[0]); p.set(8, 18, sc[1]); p.set(11, 18, sc[0]);
      return { tipX: 15, tipY: 3 };
    }
    const cover = r.pick(RAMP.cloth.map(c => [c[0], c[0], c[1], c[2]]).concat([[26, 26, 27, 28]]));
    const trim = METALS[it.metal === 'Bone' ? 'Gold' : it.metal];
    const x0 = 4, x1 = 15, y0 = 3, y1 = 17;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let c = cover[x <= x0 + 1 ? 1 : x === x0 + 2 ? 3 : 2];
      if (x === x1 || y === y1) c = (x + y) & 1 ? 6 : 7; // page edges
      if (x === x1 && y === y0) c = -1;
      if (y === y1 && x === x0) c = -1;
      if (c >= 0) p.set(x, y, c);
    }
    for (const y of [y0 + 2, y1 - 3]) { p.set(x0, y, trim[2]); p.set(x0 + 1, y, trim[1]); } // spine bands
    const deco = r.pick(['corners', 'frame', 'gem', 'strap']);
    if (deco === 'corners' || it.rarity === 2) { p.set(x1 - 1, y0, trim[3]); p.set(x1 - 1, y0 + 1, trim[2]); p.set(x1 - 2, y0, trim[2]); p.set(x1 - 1, y1 - 1, trim[1]); p.set(x1 - 2, y1 - 1, trim[1]); p.set(x1 - 1, y1 - 2, trim[1]); }
    if (deco === 'frame') { for (let x = x0 + 4; x <= x1 - 3; x++) { p.set(x, y0 + 2, trim[2]); p.set(x, y1 - 3, trim[1]); } for (let y = y0 + 2; y <= y1 - 3; y++) { p.set(x0 + 4, y, trim[3]); p.set(x1 - 3, y, trim[1]); } }
    if (deco === 'strap') { p.rect(x1 - 4, y0 + 6, 5, 2, trim[1]); p.set(x1 - 1, y0 + 6, trim[3]); }
    if (deco === 'gem' || it.rarity) { const gx = 10, gy = 9; p.set(gx, gy - 1, el.ramp[3]); p.set(gx - 1, gy, el.ramp[2]); p.set(gx, gy, el.ramp[1]); p.set(gx + 1, gy, el.ramp[0]); p.set(gx, gy + 1, el.ramp[0]); }
    return { tipX: 15, tipY: 3 };
  }
  const DRAW = { blade: drawBlade, potion: drawPotion, gem: drawGem, shield: drawShield, ring: drawRing, book: drawBook };

  function itemSprite(it) {
    const p = new Pix(20, 20);
    const at = DRAW[it.cat](p, it);
    let o = outline(p, 0);
    // rarity halo: blue for magic, orange for rare
    if (it.rarity) {
      const hc = it.rarity === 2 ? 12 : 23, h = outline(o, hc);
      for (let i = 0; i < h.d.length; i++) if (o.d[i] < 0 && h.d[i] >= 0) o.d[i] = hc;
    }
    // element overlay near the tip: flames, frost glints, drips, sparks
    if (it.element && it.rarity) {
      const fx = ELEMENTS[it.element].fx, x = Math.round(at.tipX), y = Math.round(at.tipY);
      const pts = { Ember: [[1, -1], [2, -2], [0, -3], [2, -4]], Frost: [[2, -2], [1, -2], [3, -2], [2, -1], [2, -3]], Venom: [[0, 3], [0, 4], [-1, 6]],
        Storm: [[1, -1], [2, -2], [1, -3], [2, -4]], Gloom: [[1, -2], [2, -3], [3, -2]], Tide: [[2, -1], [3, -2], [1, -3]] }[it.element];
      pts.forEach(([dx, dy], k) => { if (o.get(x + dx, y + dy) < 0) o.set(x + dx, y + dy, fx[k & 1]); });
    }
    return o;
  }

  Kit.register('items', { title: 'Part-built items', fit: 'prebake' }, host => {
    const COLS = 8, ROWS = 3, CELL = 20;
    const c = Kit.canvas(host, COLS * CELL, ROWS * CELL);
    c.cv.style.cursor = 'pointer';
    const info = Kit.el('div', { class: 'ctl' }); host.appendChild(info);
    const st = { tab: 'Mixed', seed: 77, sel: 0, items: [] };
    const cats = Object.values(CATS);
    const roll = () => {
      st.items = [];
      for (let n = 0; n < COLS * ROWS; n++) {
        const cat = st.tab === 'Mixed' ? cats[n % cats.length] : CATS[st.tab];
        const it = rollItem(st.seed * 1000 + n, cat); it.spr = itemSprite(it); st.items.push(it);
      }
      draw();
    };
    const draw = () => {
      const p = new Pix(c.w, c.h).fill(2);
      st.items.forEach((it, n) => {
        const x0 = (n % COLS) * CELL, y0 = (n / COLS | 0) * CELL;
        if (((n % COLS) + (n / COLS | 0)) & 1) p.rect(x0, y0, CELL, CELL, 1);
        if (n === st.sel) { p.rect(x0, y0, CELL, 1, 5); p.rect(x0, y0 + CELL - 1, CELL, 1, 5); p.rect(x0, y0, 1, CELL, 5); p.rect(x0 + CELL - 1, y0, 1, CELL, 5); }
        blit(p, it.spr, x0, y0);
      });
      c.put(p);
      const it = st.items[st.sel];
      info.replaceChildren(Kit.el('strong', {}, it.name), Kit.el('span', { class: 'note' }, it.detail));
    };
    c.cv.addEventListener('pointerdown', e => {
      const [x, y] = c.at(e), n = Math.floor(y / CELL) * COLS + Math.floor(x / CELL);
      if (n >= 0 && n < st.items.length) { st.sel = n; draw(); }
    });
    const b = Kit.bar(host);
    b.tabs(['Mixed'].concat(Object.keys(CATS)), v => { st.tab = v; roll(); });
    const b2 = Kit.bar(host);
    b2.seed(st.seed, s => { st.seed = s; roll(); });
    b2.note('Tap an item for its name. Rarity adds the halo and gems; element sets the accent color and the sparks.');
    roll();
  });
})();
