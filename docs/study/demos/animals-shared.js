// animals-shared.js: the helpers the animal demos share (creatures, herds, ecology), loaded before any of them.
// A seeded creature generator: a genome from a body plan, a role and a biome, a painter that draws any
// frame of its walk, flight or swim loop into palette indexes, and a name and description that agree with
// the picture. Also the biomes' inks, a 3x5 font and an outline pass. Every random choice comes from Kit.rng
// or Kit.hash2, so a seed always rebuilds the same animal.
(() => {
  const { Pix } = Kit;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---- biomes ----
  // Each biome lends its animals inks. Prey take the camo ramp, one step off the ground, so they hide by
  // construction; predators take a darker ramp; the poisonous take the warning inks (red, amber, black),
  // which are the same in every biome. A cell of the grid stays within eight inks.
  const BIOMES = {
    Meadow: { ground: 16, mark: 17, shade: 15, camo: [27, 28, 29], pred: [2, 3, 4], pale: 29, water: [21, 22, 20] },
    Forest: { ground: 15, mark: 27, shade: 14, camo: [26, 27, 28], pred: [1, 2, 3], pale: 29, water: [20, 21, 1] },
    Desert: { ground: 29, mark: 13, shade: 28, camo: [27, 28, 13], pred: [26, 27, 28], pale: 13, water: [22, 23, 21] },
    Snow: { ground: 6, mark: 7, shade: 5, camo: [4, 5, 7], pred: [2, 3, 4], pale: 7, water: [21, 22, 20] },
    Marsh: { ground: 15, mark: 16, shade: 14, camo: [14, 15, 17], pred: [26, 27, 28], pale: 18, water: [20, 21, 14] },
  };
  const WARN = [10, 13]; // red and amber, with black (0) for bands and spots
  const FISHCAMO = [3, 5, 6]; // silver: a dark back over a pale belly, the countershading of open water

  // The slots each biome's grid shows: [plan, role]. Rerolling a cell keeps its slot.
  const SLOTS = {
    Meadow: [['quad', 'prey'], ['quad', 'prey'], ['quad', 'predator'], ['bird', 'prey'], ['bird', 'predator'], ['bug', 'prey'], ['bug', 'poison'], ['fish', 'prey'], ['quad', 'poison']],
    Forest: [['quad', 'prey'], ['quad', 'predator'], ['bird', 'prey'], ['bird', 'poison'], ['bug', 'prey'], ['bug', 'predator'], ['bug', 'poison'], ['quad', 'poison'], ['fish', 'predator']],
    Desert: [['quad', 'prey'], ['quad', 'prey'], ['quad', 'predator'], ['quad', 'poison'], ['bird', 'prey'], ['bird', 'predator'], ['bug', 'prey'], ['bug', 'poison'], ['bug', 'predator']],
    Snow: [['quad', 'prey'], ['quad', 'prey'], ['quad', 'predator'], ['bird', 'prey'], ['bird', 'predator'], ['fish', 'prey'], ['fish', 'predator'], ['bug', 'prey'], ['quad', 'predator']],
    Marsh: [['fish', 'prey'], ['fish', 'predator'], ['fish', 'poison'], ['bird', 'prey'], ['bird', 'predator'], ['quad', 'prey'], ['quad', 'poison'], ['bug', 'prey'], ['bug', 'poison']],
  };

  // ---- words ----
  const COLOR_WORD = { 0: 'black', 1: 'night', 2: 'dusk', 3: 'smoke', 4: 'grey', 5: 'ash', 6: 'pale', 7: 'snow', 9: 'rust', 10: 'red', 11: 'ember',
    13: 'amber', 14: 'moss', 15: 'olive', 16: 'green', 17: 'leaf', 26: 'umber', 27: 'brown', 28: 'dun', 29: 'fawn' };
  const NOUN = {
    quad: { prey: ['grazer', 'strider', 'hind', 'browser', 'leaper'], predator: ['stalker', 'prowler', 'hound', 'lurker'], poison: ['newt', 'skink', 'crawler', 'toadlet'] },
    bird: { prey: ['finch', 'piper', 'warbler', 'flitter', 'lark'], predator: ['hawk', 'kite', 'shrike', 'harrier'], poison: ['pitta', 'jay', 'tanager'] },
    fish: { prey: ['dart', 'minnow', 'shiner', 'roach'], predator: ['pike', 'gar', 'snapper'], poison: ['puffer', 'toadfish', 'blowfish'] },
    bug: { prey: ['beetle', 'weevil', 'hopper', 'grub'], predator: ['mantis', 'tiger beetle', 'assassin'], poison: ['blister beetle', 'bloodbug', 'wasp'] },
  };
  const ON = ['b', 'd', 'g', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'sh', 'th', 'gr', 'br', 'kr', 'fl', 'sn', 'w'];
  const VO = ['a', 'e', 'i', 'o', 'u', 'oo', 'ai', 'ee', 'au'];
  const CO = ['', '', 'n', 'k', 'l', 'r', 'sh', 'm', 't', 'x'];
  function properName(r) {
    let s = '';
    const n = r.chance(0.6) ? 2 : r.chance(0.5) ? 1 : 3;
    for (let i = 0; i < n; i++) s += r.pick(ON) + r.pick(VO) + (i === n - 1 ? r.pick(CO) : '');
    return s[0].toUpperCase() + s.slice(1);
  }
  const ACT = {
    diurnal: 'by day', nocturnal: 'at night', crepuscular: 'at dawn and dusk', cathemeral: 'at any hour',
  };

  // ---- the genome ----
  // makeCreature(seed, plan, role, biome): every number the painter and the words need, as plain JSON.
  function makeCreature(seed, plan, role, biomeName) {
    const r = Kit.rng(seed), B = BIOMES[biomeName];
    const g = { seed, plan, role, biome: biomeName };
    g.size = role === 'predator' ? r.range(0.45, 1) : role === 'poison' ? r.range(0, 0.45) : r.range(0.1, 0.9);
    // inks: prey borrow the biome's camo ramp; predators a darker one; poisonous the warning inks
    if (role === 'poison') {
      const flip = r.chance(0.5);
      g.ramp = flip ? [9, WARN[0], WARN[1]] : [12, WARN[1], WARN[0]]; g.pale = g.ramp[2];
      g.pattern = r.pick(plan === 'bird' ? ['hood', 'hood'] : ['bands', 'spots', 'bands']);
      g.counter = false; g.accent = 0;
    } else {
      g.ramp = (plan === 'fish' && role === 'prey') ? FISHCAMO : role === 'predator' ? B.pred : B.camo;
      g.pale = role === 'prey' && plan === 'fish' ? 7 : B.pale;
      g.counter = true; // countershading: dark back, pale belly
      g.pattern = r.pick(role === 'prey' ? ['none', 'none', 'spots', 'saddle'] : ['none', 'stripes', 'saddle', 'stripes']);
      g.accent = role === 'predator' ? 13 : 0; // a predator's eye catches the light
    }
    if (plan === 'quad') {
      const lizard = role === 'poison';
      g.len = Math.round(lizard ? 10 + g.size * 10 : role === 'predator' ? 12 + g.size * 12 : 9 + g.size * 13);
      g.ht = Math.round(lizard ? 3 + g.size * 2 : 4 + g.size * 5 + (role === 'prey' ? 1 : 0));
      // runners get long legs; leg thickness grows with size (McMahon's elastic similarity, roughly)
      g.leg = Math.round(lizard ? 1 + r.range(0, 1.5) : role === 'prey' ? 4 + g.size * 6 + r.range(0, 2) : 3 + g.size * 2 + r.range(0, 1.5));
      g.legW = lizard ? 1 : g.size > 0.6 ? 2 : 1;
      g.neck = lizard ? 0 : role === 'prey' ? Math.round(1 + r.range(0, 1) * (2 + g.size * 4)) : Math.round(r.range(0, 2));
      g.head = Math.round(lizard ? 2 : role === 'predator' ? 3 + g.size * 2 : 2 + g.size * 2);
      g.snout = role === 'predator' ? 2 + r.int(0, 2) : lizard ? 1 : r.int(1, 2);
      g.tail = lizard ? Math.round(g.len * r.range(0.6, 1)) : role === 'predator' ? r.int(7, 11) : r.int(1, 4);
      g.tailUp = role === 'prey' ? r.chance(0.6) : false;
      g.ears = lizard ? 'none' : role === 'predator' ? 'pointed' : r.pick(['round', 'long', 'pointed']);
      g.horns = role === 'prey' && !lizard ? r.pick(['none', 'none', 'spikes', 'curved', g.size > 0.6 ? 'antlers' : 'spikes']) : 'none';
    } else if (plan === 'bird') {
      g.len = Math.round(8 + g.size * (role === 'predator' ? 8 : 5));
      g.ht = Math.round(3 + g.size * 2.5);
      g.head = role === 'predator' ? 2 : r.chance(0.5) ? 2 : 1;
      g.beak = role === 'predator' ? 'hook' : r.pick(['short', 'short', 'long']);
      g.wing = Math.round(g.len * (role === 'predator' ? 1 : 0.8));
      g.tail = r.int(2, 4);
      g.crest = r.chance(0.3);
    } else if (plan === 'fish') {
      const puff = role === 'poison';
      g.len = Math.round(puff ? 9 + g.size * 6 : role === 'predator' ? 14 + g.size * 12 : 10 + g.size * 7);
      g.ht = Math.round(puff ? g.len * 0.75 : role === 'predator' ? 3 + g.size * 2 : 3 + g.size * 3);
      g.fin = r.int(2, 3); g.tail = r.int(3, 5); g.dorsalBack = role === 'predator';
    } else {
      g.len = Math.round(9 + g.size * 7);
      g.ht = Math.round(4 + g.size * 3);
      g.leg = r.int(2, 4);
      g.ant = role === 'predator' ? 1 : r.int(2, 4);
      g.wings = role === 'poison' && r.chance(0.5);
      g.shell = !g.wings && r.chance(0.7);
      g.raptorial = role === 'predator';
    }
    // behavior: activity (most mammals are nocturnal, Bennie 2014) and groups
    const actW = {
      quad: { prey: ['diurnal', 'crepuscular', 'crepuscular'], predator: ['nocturnal', 'nocturnal', 'crepuscular'], poison: ['nocturnal', 'crepuscular'] },
      bird: { prey: ['diurnal'], predator: ['diurnal', 'diurnal', 'nocturnal'], poison: ['diurnal'] },
      fish: { prey: ['cathemeral', 'diurnal'], predator: ['crepuscular', 'nocturnal'], poison: ['diurnal'] },
      bug: { prey: ['nocturnal', 'diurnal'], predator: ['diurnal'], poison: ['diurnal'] },
    };
    g.activity = r.pick(actW[plan][role]);
    const lo = { quad: { prey: [4, 30], predator: [1, 6], poison: [1, 1] }, bird: { prey: [12, 200], predator: [1, 2], poison: [3, 8] },
      fish: { prey: [20, 300], predator: [1, 1], poison: [1, 2] }, bug: { prey: [1, 40], predator: [1, 1], poison: [6, 60] } }[plan][role];
    g.group = lo[1] === 1 ? 1 : [Math.max(lo[0], Math.round(lo[0] * (1 + r.range(0, 1)))), Math.round(lo[1] * r.range(0.4, 1))];
    if (g.group[1] <= g.group[0]) g.group[1] = g.group[0] + 2;
    // mass in kg: a rough cube of body length, so the ecology demo can size populations by it
    const k = { quad: 0.9, bird: 0.03, fish: 0.06, bug: 0.00008 }[plan];
    g.mass = +(k * Math.pow(g.len / 6, 3) * (plan === 'quad' && role !== 'poison' ? 6 : 1)).toPrecision(2);
    words(g, r);
    return g;
  }

  // The words agree with the picture: the color word is the body's mid ink, the features are the ones drawn.
  function words(g, r) {
    g.name = properName(r);
    const feats = [];
    if (g.plan === 'quad') {
      if (g.horns !== 'none') feats.push(g.horns === 'antlers' ? 'antlered' : 'horned');
      if (g.tail >= 6) feats.push('long-tailed');
      if (g.ears === 'long') feats.push('long-eared');
      if (g.leg >= 8) feats.push('long-legged');
    } else if (g.plan === 'bird') {
      if (g.beak === 'hook') feats.push('hook-billed'); else if (g.beak === 'long') feats.push('long-billed');
      if (g.crest) feats.push('crested');
    } else if (g.plan === 'fish') {
      if (g.role === 'poison') feats.push('spined'); else if (g.dorsalBack) feats.push('long-jawed');
    } else {
      if (g.wings) feats.push('winged'); if (g.raptorial) feats.push('grasping');
    }
    const pat = { spots: 'spotted', stripes: 'striped', saddle: 'saddled', bands: 'banded', hood: 'hooded' }[g.pattern];
    if (pat) feats.unshift(pat);
    const color = COLOR_WORD[g.ramp[1]] || 'dun';
    const feat = feats.length ? feats[0] : '';
    g.noun = r.pick(NOUN[g.plan][g.role]);
    g.common = [color, feat, g.noun].filter(Boolean).join(' ');
    const sizeW = g.size < 0.25 ? 'small' : g.size < 0.6 ? 'middling' : g.size < 0.85 ? 'large' : 'great';
    const art = /^[aeiou]/.test(sizeW) ? 'An' : 'A';
    const mass = g.mass >= 1 ? 'about ' + Math.round(g.mass) + ' kg' : g.mass >= 0.001 ? 'about ' + Math.round(g.mass * 1000) + ' g' : 'under a gram';
    let s = `${art} ${sizeW} ${color} ${g.noun}${feats.length > 1 ? ', ' + feats.slice(1).join(' and ') : ''}, ${mass}. `;
    const grp = g.group === 1 ? 'alone' : `in ${g.plan === 'bird' ? 'flocks' : g.plan === 'fish' ? 'schools' : g.role === 'predator' ? 'packs' : g.plan === 'bug' ? 'swarms' : 'herds'} of ${g.group[0]} to ${g.group[1]}`;
    s += `It ${g.role === 'predator' ? 'hunts' : g.plan === 'fish' ? 'swims' : g.plan === 'bird' ? 'flies' : 'feeds'} ${grp}, ${ACT[g.activity]}. `;
    if (g.role === 'poison') s += `Beware its ${COLOR_WORD[g.ramp[1]]}-and-black ${g.plan === 'fish' ? 'spines' : 'back'}: it is bitter to eat.`;
    else if (g.role === 'prey') s += g.plan === 'fish' ? 'Its dark back hides it from above, its pale belly from below.' : `Its back is darker than its belly, so its shadow vanishes against the ${g.biome.toLowerCase()}.`;
    else s += g.plan === 'bird' ? 'It watches from high up and stoops on what moves.' : 'It waits downwind, then runs its prey down.';
    g.desc = s;
  }

  // ---- painting ----
  function ellipse(p, cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / (rx + 0.01), dy = (y + 0.5 - cy) / (ry + 0.01);
      if (dx * dx + dy * dy <= 1) p.set(x, y, c);
    }
  }
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
  // a filled triangle, by testing each pixel center against the three edges
  function tri(p, x0, y0, x1, y1, x2, y2, c) {
    const minx = Math.floor(Math.min(x0, x1, x2)), maxx = Math.ceil(Math.max(x0, x1, x2));
    const miny = Math.floor(Math.min(y0, y1, y2)), maxy = Math.ceil(Math.max(y0, y1, y2));
    const e = (ax, ay, bx, by, px, py) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    const area = e(x0, y0, x1, y1, x2, y2);
    if (!area) { line(p, x0, y0, x2, y2, c); return; }
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const px = x + 0.5, py = y + 0.5;
      const a = e(x1, y1, x2, y2, px, py) / area, b = e(x2, y2, x0, y0, px, py) / area, d = e(x0, y0, x1, y1, px, py) / area;
      if (a >= -0.05 && b >= -0.05 && d >= -0.05) p.set(x, y, c);
    }
    line(p, x0, y0, x2, y2, c); line(p, x1, y1, x2, y2, c);
  }
  // outline: every clear pixel touching a filled one (4-neighbors) becomes the outline ink
  function outline(p, col = 0) {
    const o = new Pix(p.w, p.h); o.d.set(p.d);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++)
      if (p.get(x, y) < 0 && (p.get(x - 1, y) >= 0 || p.get(x + 1, y) >= 0 || p.get(x, y - 1) >= 0 || p.get(x, y + 1) >= 0)) o.set(x, y, col);
    return o;
  }
  // shade a filled region by rows: the top rows dark (the back), the bottom rows pale (the belly)
  function countershade(p, x0, x1, g, y0, y1) {
    for (let x = x0; x <= x1; x++) {
      let top = -1, bot = -1;
      for (let y = y0; y <= y1; y++) if (p.get(x, y) === g.ramp[1]) { if (top < 0) top = y; bot = y; }
      if (top < 0) continue;
      const h = bot - top + 1;
      for (let y = top; y < top + Math.max(1, Math.round(h * 0.3)); y++) p.set(x, y, g.ramp[0]);
      if (g.counter && h >= 3) for (let y = bot - Math.max(0, Math.round(h * 0.3) - 1); y <= bot; y++) p.set(x, y, g.pale);
    }
  }
  function pattern(p, g, x0, x1, y0, y1) {
    const mid = g.ramp[1];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const c = p.get(x, y);
      if (c !== mid && c !== g.ramp[0]) continue;
      if (g.pattern === 'spots' && ((x * 3 + y * 5) % 7 === 0) && Kit.hash2(x, y, g.seed) < 0.8) p.set(x, y, g.role === 'poison' ? 0 : g.pale);
      if (g.pattern === 'stripes' && (x % 3 === 0) && c === mid) p.set(x, y, g.ramp[0]);
      if (g.pattern === 'bands' && (Math.floor(x / 2) % 2 === 0)) p.set(x, y, 0);
    }
  }

  // drawCreature(g, frame): one frame (0..3) of the creature's loop, facing right, as a Pix with its
  // feet (or its shadow) on the bottom row. Returns {pix, ox, oy}: the anchor (center of the feet).
  function drawCreature(g, frame) {
    const W = 48, H = 40, p = new Pix(W, H);
    const f = frame & 3, ph = f / 4 * Math.PI * 2;
    let gy = H - 3, cx = 22;
    if (g.plan === 'quad') {
      const lizard = g.role === 'poison';
      const bob = (!lizard && (f === 1 || f === 3)) ? -1 : 0;
      const by = gy - g.leg - g.ht + bob, bx0 = cx - g.len / 2, bx1 = cx + g.len / 2;
      // legs: diagonal pairs swing together (a trot); far legs one row up and darker
      const stride = Math.max(1, Math.round(g.leg * 0.35)), legs = [];
      const hipY = by + g.ht - 1;
      const fx = Math.round(bx1 - 2 - g.legW), bxk = Math.round(bx0 + 2);
      legs.push([fx + 1, 0, true], [bxk + 1, Math.PI, true], [fx, Math.PI, false], [bxk, 0, false]);
      const leg = (x, phase, far) => {
        const s = Math.sin(ph + phase), lift = Math.cos(ph + phase) > 0.3 ? 1 : 0;
        const footX = x + Math.round(s * stride), footY = gy - (far ? 1 : 0) - lift;
        const c = far ? g.ramp[0] : (g.role === 'poison' ? g.ramp[1] : g.ramp[1]);
        if (lizard) { line(p, x, hipY, footX + (far ? -1 : 1), footY, c, 1); return; }
        line(p, x, hipY, footX, footY, c, g.legW);
      };
      for (const [x, phs, far] of legs) if (far) leg(x, phs, far);
      // tail
      const tx = Math.round(bx0), ty = by + 1;
      if (lizard) { for (let i = 0; i < g.tail; i++) p.set(tx - i, Math.round(ty + 1 + i * 0.25 + Math.sin(ph + i * 0.6) * 0.6), g.ramp[1]); }
      else if (g.tailUp) line(p, tx, ty, tx - Math.ceil(g.tail / 2), ty - g.tail, g.ramp[1], 1);
      else if (g.tail >= 6) { line(p, tx, ty, tx - Math.round(g.tail * 0.8), ty + Math.round(g.tail * 0.45) + (f % 2), g.ramp[1], 2); line(p, tx, ty + 1, tx - Math.round(g.tail * 0.7), ty + Math.round(g.tail * 0.45) + 1 + (f % 2), g.ramp[1], 2); }
      else line(p, tx, ty, tx - Math.round(g.tail * 0.6), ty + Math.round(g.tail * 0.7) + (f % 2), g.ramp[1], 1);
      // body
      ellipse(p, cx, by + g.ht / 2, g.len / 2, g.ht / 2, g.ramp[1]);
      // neck and head
      const hx = Math.round(bx1 - 1 + g.head * 0.4), hy = Math.round(by - g.neck + (lizard ? g.ht * 0.4 : 0) + (g.role === 'predator' ? 2 : 0));
      if (g.neck > 0) line(p, Math.round(bx1 - 2), by + 1, hx, hy, g.ramp[1], 2);
      ellipse(p, hx, hy, g.head * 0.75, g.head * 0.6, g.ramp[1]);
      for (let i = 1; i <= g.snout; i++) line(p, hx + Math.round(g.head * 0.5) + i - 1, hy, hx + Math.round(g.head * 0.5) + i - 1, hy + Math.max(0, Math.round(g.head * 0.5) - (i === g.snout ? 1 : 0)), g.ramp[1]);
      // ears and horns
      const top = Math.round(hy - g.head * 0.6);
      if (g.ears === 'pointed') { p.set(hx - 1, top - 1, g.ramp[1]); p.set(hx, top - 1, g.ramp[0]); }
      if (g.ears === 'round') p.set(hx - 1, top - 1, g.ramp[1]);
      if (g.ears === 'long') line(p, hx - 1, top, hx - 2, top - 3, g.ramp[1]);
      const hc = 0; // horns in the outline ink read as horn against any fur
      if (g.horns === 'spikes') line(p, hx, top, hx - 1, top - 2, hc);
      if (g.horns === 'curved') { line(p, hx, top, hx - 2, top - 2, hc); p.set(hx - 3, top - 1, hc); }
      if (g.horns === 'antlers') { line(p, hx, top, hx - 2, top - 4, hc); line(p, hx - 1, top - 2, hx + 1, top - 4, hc); p.set(hx - 3, top - 3, hc); }
      countershade(p, Math.round(bx0) - 1, Math.round(hx + g.head + g.snout), g, 0, gy - 2);
      pattern(p, g, Math.round(bx0), Math.round(bx1), by, by + g.ht);
      for (const [x, phs, far] of legs) if (!far) leg(x, phs, far);
      const o = outline(p);
      o.set(hx + 1, hy - 1, g.accent || 0);
      if (g.accent) o.set(hx + 1, hy - 1, g.accent);
      return { pix: o, ox: cx, oy: gy, w: W, h: H };
    }
    if (g.plan === 'bird') {
      const by = gy - 12 - (f === 0 ? 1 : f === 2 ? -1 : 0);
      ellipse(p, cx, by, g.len / 2, g.ht / 2, g.ramp[1]);
      // tail: a wedge behind
      const tb = Math.round(cx - g.len / 2);
      for (let i = 0; i < g.tail; i++) line(p, tb - i, by - 1 - Math.floor(i / 2), tb - i, by + Math.floor(i / 2), g.ramp[1]);
      // head
      const hx = Math.round(cx + g.len / 2 - 1), hy = Math.round(by - g.ht / 2);
      ellipse(p, hx, hy, g.head + 0.6, g.head + 0.3, g.ramp[1]);
      if (g.crest) { line(p, hx - 1, hy - g.head - 1, hx - 3, hy - g.head - 2, g.ramp[0]); }
      countershade(p, tb - g.tail, hx + 4, g, 0, gy - 2);
      pattern(p, g, tb, hx + 3, 0, gy);
      if (g.pattern === 'hood') ellipse(p, hx, hy, g.head + 0.6, g.head + 0.3, 0);
      // beak: amber, or black on a bright bird
      const bc = g.role === 'poison' ? 0 : 13, bx = hx + g.head + 1;
      if (g.beak === 'short') { p.set(bx, hy, bc); }
      if (g.beak === 'long') line(p, bx, hy, bx + 2, hy, bc);
      if (g.beak === 'hook') { p.set(bx, hy, bc); p.set(bx + 1, hy, bc); p.set(bx + 1, hy + 1, bc); }
      // the near wing, a filled triangle from the shoulder: up, level, down, level
      const wc = g.role === 'poison' ? 0 : g.ramp[0], wl = g.wing, sx = Math.round(cx + 1), sy = by - 1;
      const tip = [[cx - 3, by - wl * 0.8], [cx - wl * 0.7, by - 2], [cx - 3, by + wl * 0.7 - 2], [cx - wl * 0.7, by - 2]][f];
      tri(p, sx - 4, sy, sx + 1, sy, tip[0], tip[1], wc);
      const o = outline(p);
      o.set(hx + 1, hy - 1, g.role === 'poison' ? 13 : 0);
      // a shadow far below says it is flying
      for (let x = -2; x <= 2; x++) o.set(cx + x, gy, -2);
      return { pix: o, ox: cx, oy: gy, w: W, h: H };
    }
    if (g.plan === 'fish') {
      const cy = gy - 6 - g.ht / 2, sw = [0, 1, 0, -1][f];
      ellipse(p, cx, cy, g.len / 2, g.ht / 2, g.ramp[1]);
      // tail fin swings: the loop of a swim
      const tx = Math.round(cx - g.len / 2);
      for (let i = 0; i < g.tail; i++) line(p, tx - i, Math.round(cy - 1 - i * 0.6 + sw * (i / g.tail)), tx - i, Math.round(cy + 1 + i * 0.6 + sw * (i / g.tail)), g.ramp[1]);
      // dorsal fin
      const dx = Math.round(g.dorsalBack ? cx - g.len / 4 : cx);
      for (let i = 0; i < g.fin; i++) line(p, dx - i, Math.round(cy - g.ht / 2 - 1 - (g.fin - i - 1) * 0.5), dx - i, Math.round(cy - g.ht / 2), g.ramp[0]);
      countershade(p, tx - g.tail, Math.round(cx + g.len / 2) + 1, g, 0, gy);
      pattern(p, g, tx, Math.round(cx + g.len / 2), 0, gy);
      if (g.role === 'poison') for (let a = 0; a < 8; a++) { const ang = a / 8 * Math.PI * 2; p.set(Math.round(cx + Math.cos(ang) * (g.len / 2 + 1)), Math.round(cy + Math.sin(ang) * (g.ht / 2 + 1)), 0); }
      const o = outline(p);
      const ex = Math.round(cx + g.len / 2 - 2), ey = Math.round(cy - g.ht / 4);
      o.set(ex, ey, 0);
      if (g.dorsalBack) line(o, ex + 1, Math.round(cy + 1), ex + 3, Math.round(cy + 1), 0);
      return { pix: o, ox: cx, oy: gy, w: W, h: H, water: true };
    }
    // bug, seen from above at an angle: three segments in a row, six legs out to both sides in two tripods
    const cy = gy - g.leg - Math.ceil(g.ht / 2);
    const ab = Math.ceil(g.len * 0.5), th = Math.max(2, Math.round(g.len * 0.22));
    const ax = Math.round(cx - g.len / 2 + ab / 2), tx = Math.round(ax + ab / 2 + th / 2), hx = Math.round(tx + th / 2 + 1);
    const tri2 = f % 2;
    let o = null;
    const bugLeg = (i, far) => {
      const s = ((i + (far ? 1 : 0)) % 2 === tri2) ? 1 : -1;
      const x = tx - 1 + i, side = far ? -1 : 1;
      const y0 = cy + side * Math.floor(g.ht / 2 - 0.5), knee = [x + (i - 1) * 2 + s, y0 + side * Math.ceil(g.leg / 2)];
      const foot = [knee[0] + (i - 1) + s, far ? y0 - Math.max(1, g.leg - 1) : gy];
      line(o, x, y0, knee[0], knee[1], 0);
      line(o, knee[0], knee[1], foot[0], foot[1], 0);
    };
    if (g.wings) { const wu = f % 2 ? -1 : 0; ellipse(p, ax + 1, cy - g.ht / 2 - 1 + wu, ab / 2 - 1, 1.2, 6); }
    ellipse(p, ax, cy, ab / 2 + 0.5, g.ht / 2 + 0.3, g.ramp[1]);
    ellipse(p, tx, cy, th / 2 + 0.2, g.ht / 2 - 0.4, g.ramp[1]);
    ellipse(p, hx, cy, 1.4, 1.4, g.ramp[1]);
    if (g.raptorial) { line(p, hx + 1, cy + 1, hx + 3, cy - 1, g.ramp[1]); line(p, hx + 3, cy - 1, hx + 4, cy + 1, g.ramp[1]); }
    countershade(p, Math.round(ax - ab / 2) - 1, hx + 4, g, 0, gy - 1);
    pattern(p, g, Math.round(ax - ab / 2), Math.round(tx + th / 2), 0, gy);
    if (g.shell) line(p, Math.round(ax - ab / 2) + 1, cy, Math.round(ax + ab / 2), cy, 0);
    // legs go on after the outline, one pixel thick, so they read as legs and not as blobs
    o = outline(p);
    for (let i = 0; i < 3; i++) { bugLeg(i, true); bugLeg(i, false); }
    for (let i = 1; i <= g.ant; i++) { o.set(hx + 1 + i, cy - 1 - i, 0); o.set(hx + 1 + i, cy + 1 + i - (i === g.ant ? 1 : 0), 0); }
    o.set(hx + 1, cy - 1, 0);
    return { pix: o, ox: cx, oy: gy, w: W, h: H };
  }

  // ---- font ----
  const GLYPH = {
    A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
    G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
    M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5],
    S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
    Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
    0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6], 4: [5, 5, 7, 1, 1],
    5: [7, 4, 6, 1, 6], 6: [3, 4, 6, 5, 2], 7: [7, 1, 2, 2, 2], 8: [2, 5, 2, 5, 2], 9: [2, 5, 3, 1, 6],
    '-': [0, 0, 7, 0, 0], ',': [0, 0, 0, 2, 4], '.': [0, 0, 0, 0, 2], ' ': [0, 0, 0, 0, 0], ':': [0, 2, 0, 2, 0], '/': [1, 1, 2, 4, 4],
  };
  function text(pix, s, x, y, c) {
    for (let i = 0; i < s.length; i++) {
      const gl = GLYPH[s[i].toUpperCase()] || GLYPH[' '];
      for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if (gl[r] & (4 >> b)) pix.set(x + i * 4 + b, y + r, c);
    }
  }
  const textW = s => s.length * 4 - 1;

  // copy src into dst at (dx, dy); flip mirrors it (facing left); ink -2 in src means "shadow": dst's shade ink
  function blit(dst, src, dx, dy, flip = false, shade = -1) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.d[y * src.w + (flip ? src.w - 1 - x : x)];
      if (c === -1) continue;
      if (c === -2) { if (shade >= 0) dst.set(dx + x, dy + y, shade); continue; }
      dst.set(dx + x, dy + y, c);
    }
  }

  window.StudyShared = window.StudyShared || {};
  StudyShared.animals = { BIOMES, SLOTS, WARN, makeCreature, drawCreature, outline, ellipse, line, text, textW, blit, clamp };
})();
