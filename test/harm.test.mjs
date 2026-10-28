// Tycho.harm against Lodestar's fighting, which moved onto it. Lodestar's
// code as it was is kept here, each piece made to run on a small world of
// the test's (W, standing in for Game and Game.dive), and driven side by
// side with Tycho's: the statuses its elements left, how they stacked, wore
// off, bit and spread (circuitStatuses, reactStack, reactTick, the dots, a
// death's poison), the reactions (circuitReact and REACT_DO), the world's
// hold still (freezeFrame), knockback fading, the numbers rising, the shake,
// the vents' and pods' cycles, the snares' and tongues' lines, a crawler's
// lunge, and the spells' cooldowns and charges. Then the pipeline itself,
// held to hits recorded from Lodestar's main before it changed
// (fixtures/lodestar-hits.json): each blow through Tycho's stages (gate,
// scale, resist, armor, soak, react, knock, stagger, hold) and Lodestar's
// own, ported here for what they do to the struck body, must leave it as
// the original did, bit for bit, drawing the same rolls and sending on the
// same blows. And the parts Lodestar doesn't use (means' casts and coats,
// traps by box, the player's wounds) by their own tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Tycho from '../dist/tycho.mjs';

const { harm } = Tycho;
const { Rng, mulberry32 } = Tycho.seed;
const { clamp, dist } = Tycho.math;
const HITS = JSON.parse(readFileSync(new URL('./fixtures/lodestar-hits.json', import.meta.url), 'utf8'));
const L = HITS.tune, R = L.react, El = L.elements, O = L.onHit;
const CORE = ['force', 'shock', 'frost', 'ember', 'blight'];
const PAIRS = { 'force|frost': 'shatter', 'frost|shock': 'conduct', 'ember|frost': 'steam', 'blight|frost': 'brittle', 'blight|ember': 'pyre', 'ember|shock': 'flare', 'ember|force': 'scatter', 'force|shock': 'jolt' };
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---- the test's world, standing in for Game and Game.dive -------------------
let W = null;
function world(seed, n = 6) {
  const rng = new Rng(seed), q = mulberry32(seed ^ 0x9e37);
  const enemies = [];
  for (let i = 0; i < n; i++) enemies.push(foe(q, i));
  // (the one struck is alive: the gate stops a blow on the dead first)
  enemies[0].dead = false;
  return { rng, t: q() * 9, realT: q() * 9, enemies, nums: [], fx: [], sent: [], p: { x: 0, y: 0, hp: 100, restT: 1 }, dying: 0, starts: 0 };
}
// a foe in some state: statuses, stacks, waits, some of them carried
function foe(q, i) {
  const pick = (a) => a[Math.floor(q() * a.length)];
  const e = { type: pick(['crawler', 'wisp', 'construct', 'tusker', 'hollow', 'snapjaw']), boss: q() < 0.1, x: (q() - 0.5) * 120, y: (q() - 0.5) * 120, r: 5 + Math.floor(q() * 4), hp: 40, maxHp: 40, dead: q() < 0.08, state: pick(['chase', 'windup', 'circle', 'dazed']), cd: 0, slowT: q() < 0.3 ? q() * 2 : 0, stunT: q() < 0.2 ? q() : 0, kx: 0, ky: 0 };
  if (q() < 0.7) { e.st = {}; for (const el of CORE) if (q() < 0.4) e.st[el] = q() < 0.2 ? 0 : q() * 3; }
  if (q() < 0.5) { e.stk = { shock: Math.floor(q() * 5), frost: Math.floor(q() * 3) }; }
  if (q() < 0.4) e.burn = { t: q() * 3, dps: q() * 4, n: 1 + Math.floor(q() * 3) };
  if (q() < 0.4) e.blight = { t: q() * 4, dps: q() * 3 };
  if (q() < 0.3) e.frozenT = q() < 0.3 ? -0.01 : q() * 1.5;
  if (q() < 0.3) e.heavyT = q() * 3;
  if (q() < 0.3) e.brittleT = q() * 3;
  if (q() < 0.3) e.lostT = q() * 2;
  if (q() < 0.4) { e.rcd = {}; for (const id of ['inferno', 'plague', 'stun', 'overload', 'freeze']) if (q() < 0.4) e.rcd[id] = q() * 12; }
  if (q() < 0.2) e.wardHit = q() * 0.2;
  return e;
}

// ---- Lodestar's originals (reactions.js, combat.js, enemies.js, foecast.js) --
const carriesL = (e, el) => {
  if (e.st && e.st[el] > 0) return true;
  if (el === 'frost') return e.slowT > 0 || e.frozenT > 0;
  if (el === 'ember') return !!e.burn;
  if (el === 'blight') return !!e.blight;
  return false;
};
const reactPairL = (a, b) => PAIRS[a < b ? a + '|' + b : b + '|' + a] || null;
const reactReadyL = (e, id) => !(e.rcd && e.rcd[id] > W.t);
const reactControlL = (e, t) => (e.type === 'hollow' ? 0 : e.boss ? t * R.control : t);
function reactWordL(e, word) {
  e.reactWordAt = W.realT;
  if (W.nums.some((n) => n.foe === e && n.word === word && n.t > R.word - 0.4)) return;
  W.nums.push({ x: e.x, y: e.y - 26, word, t: R.word, foe: e });
}
function reactFiredL(e, id) { (e.rcd || (e.rcd = {}))[id] = W.t + R.cd; reactWordL(e, id.toUpperCase()); }
// the nearest other living foe within range (the game also asked for a
// clear line through the rock: there's no rock here)
function nearestL(range, from, except) {
  let best = null, bd = range;
  for (const e of W.enemies) { if (e.dead || e.hid || e === except) continue; const m = dist(from.x, from.y, e.x, e.y); if (m < bd) { bd = m; best = e; } }
  return best;
}
function hurtEnemyL(q, dmg, opts) { W.sent.push({ q, dmg, opts }); }
function reactLoseL(q, t) {
  const k = reactControlL(q, t);
  if (k <= 0) return;
  q.lostT = Math.max(q.lostT || 0, k);
  if (q.state === 'windup') { q.state = q.type === 'snapjaw' || q.type === 'spitter' ? 'rest' : 'chase'; q.cd = Math.max(q.cd, 0.6); }
}
function reactStunL(e, t) {
  const k = reactControlL(e, t);
  if (k <= 0) return;
  e.stunT = Math.max(e.stunT, k); e.kx = e.ky = 0;
  if (e.state === 'windup') { e.state = e.type === 'snapjaw' || e.type === 'spitter' ? 'rest' : 'chase'; e.cd = Math.max(e.cd, 0.4); }
}
function reactStackL(e, el, n) {
  const stk = e.stk || (e.stk = {});
  stk[el] = (stk[el] || 0) + n;
  if (el === 'shock' && stk.shock >= R.overload.stacks) {
    stk.shock = 0;
    reactStunL(e, R.overload.stun);
    reactFiredL(e, 'overload');
  } else if (el === 'frost' && stk.frost >= R.freeze.stacks) {
    stk.frost = 0;
    const k = reactControlL(e, R.freeze.time);
    if (k > 0) { e.frozenT = k; e.stunT = Math.max(e.stunT, k); e.kx = e.ky = 0; if (e.state === 'windup') e.state = e.type === 'snapjaw' || e.type === 'spitter' ? 'rest' : 'chase'; }
    reactFiredL(e, 'freeze');
  }
}
function circuitStatusesL(e, els, dmg, o) {
  const d = W, share = dmg / els.length;
  const st = e.st || (e.st = {});
  for (const el of els) {
    const k = (o.att && o.att.includes(el) ? L.attunedStatus : 1) * (o.statusK || 1), had = carriesL(e, el);
    st[el] = Math.max(st[el] || 0, R.status * k);
    if (el === 'shock') {
      if (d.rng.chance(El.shockChance)) { const q = nearestL(O.shockRange, e, e); if (q) hurtEnemyL(q, share * O.shockMult, { els: ['shock'], noProc: true, spell: true }); }
      reactStackL(e, 'shock', 1);
    } else if (el === 'frost') {
      e.slowT = Math.max(e.slowT, O.chillTime * k);
      if (!(e.frozenT > 0)) reactStackL(e, 'frost', 1);
    } else if (el === 'ember') {
      const add = share * El.burn, b = e.burn;
      if (b && had) {
        b.n = Math.min(R.inferno.most, (b.n || 1) + 1);
        b.dps = Math.min(b.dps + add, add * R.inferno.most);
        b.t = Math.max(b.t, El.burnTime * k);
        if (b.n >= R.inferno.most && reactReadyL(e, 'inferno')) {
          for (const q of d.enemies) if (!q.dead && q !== e && dist(q.x, q.y, e.x, e.y) < R.inferno.r + q.r && (!q.burn || q.burn.dps < add)) q.burn = { t: El.burnTime, dps: add, n: 1 };
          reactFiredL(e, 'inferno');
        }
      } else e.burn = { t: El.burnTime * k, dps: add, n: 1 };
    } else if (el === 'blight') {
      const was = e.blight, dps = share * El.blight;
      e.blight = { t: El.blightTime * k, dps: Math.max(dps, was ? was.dps : 0) };
      if (was && reactReadyL(e, 'plague')) {
        let n = 0;
        for (const q of d.enemies) if (!q.dead && q !== e && dist(q.x, q.y, e.x, e.y) < R.plague.r + q.r && (!q.blight || q.blight.dps < e.blight.dps)) { q.blight = { t: El.blightTime, dps: e.blight.dps }; n++; }
        if (n) reactFiredL(e, 'plague');
      }
    } else if (el === 'force' && o.heavy) {
      if (e.heavyT > 0 && reactReadyL(e, 'stun')) { e.heavyT = 0; reactStunL(e, R.stun.time); reactFiredL(e, 'stun'); }
      else e.heavyT = R.status * k;
    }
  }
}
function reactTickL(e, dt) {
  e.slowT = Math.max(0, e.slowT - dt);
  const st = e.st;
  if (st) for (const el in st) if (st[el] > 0 && (st[el] -= dt) <= 0) { st[el] = 0; if (e.stk) e.stk[el] = 0; }
  if (e.heavyT > 0) e.heavyT -= dt;
  if (e.brittleT > 0) e.brittleT -= dt;
  if (e.frozenT > 0) e.frozenT -= dt;
}
function dotsL(e, dt) {
  for (const k of ['burn', 'blight']) {
    const dot = e[k];
    if (!dot) continue;
    dot.t -= dt; e.hp -= dot.dps * dt; dot.tick = (dot.tick || 0) - dt;
    if (dot.tick <= 0) { dot.tick = 0.5; W.nums.push({ x: e.x, y: e.y - 16, v: Math.max(1, Math.round(dot.dps * 0.5)), t: 0.5, elem: k }); }
    if (dot.t <= 0) e[k] = null;
    if (e.hp <= 0 && e.type !== 'dummy') { e.dead = true; break; }
    if (e.type === 'dummy' && e.hp <= 0) e.hp = e.maxHp;
  }
}
function kindlerTickL(d, dt, F, armor) {
  const p = d.p;
  if (p.chillT > 0) { p.chillT -= dt; p.frostSlow = Math.min(p.frostSlow || 1, F.chillSlow); }
  if (p.shockT > 0) p.shockT -= dt;
  for (const k of ['burn', 'blight']) {
    const dot = p[k];
    if (!dot) continue;
    dot.t -= dt;
    if (!d.dying) {
      p.hp -= dot.dps * dt * L.armorK / (L.armorK + armor);
      p.restT = 0;
      if ((dot.tick -= dt) <= 0) { dot.tick = 0.5; d.nums.push({ x: p.x, y: p.y - 22, v: Math.max(1, Math.round(dot.dps * 0.5)), t: 0.5, hurt: true, elem: k }); }
      if (p.hp <= 0) { p.hp = 0; d.dying = 1.4; d.starts++; }
    }
    if (dot.t <= 0) p[k] = null;
  }
}

// ---- the same, on Tycho's: Lodestar's statuses as it declares them ----------
const statusesOf = () => new harm.Statuses([
  ...CORE.map((el) => ({ id: el, at: ['st', el], time: () => R.status, wear: 'clear', ends: (e) => { if (e.stk) e.stk[el] = 0; } })),
  { id: 'chill', at: 'slowT', time: () => O.chillTime, wear: 'clamp' },
  { id: 'burn', dose: 'dps', time: () => El.burnTime, every: 0.5, stack: 'add', most: () => R.inferno.most, spread: { r: () => R.inferno.r } },
  { id: 'poison', at: 'blight', dose: 'dps', time: () => El.blightTime, every: 0.5, stack: 'refresh', spread: { r: () => R.plague.r, on: 'death' } },
  { id: 'brittle', at: 'brittleT', time: () => R.status, stack: 'set', wear: 'down' },
  { id: 'frozen', at: 'frozenT', stack: 'set', wear: 'down' },
  { id: 'heavy', at: 'heavyT', time: () => R.status, stack: 'set', wear: 'down' },
  { id: 'stun', at: 'stunT' },
  { id: 'lost', at: 'lostT' },
  { id: 'shockStack', at: ['stk', 'shock'], stack: 'count', most: () => R.overload.stacks },
  { id: 'frostStack', at: ['stk', 'frost'], stack: 'count', most: () => R.freeze.stacks },
]);
const S = statusesOf();
const carriesT = (e, el) => {
  if (S.has(e, el)) return true;
  if (el === 'frost') return S.has(e, 'chill') || S.has(e, 'frozen');
  if (el === 'ember') return S.has(e, 'burn');
  if (el === 'blight') return S.has(e, 'poison');
  return false;
};
function reactLoseT(q, t) {
  const k = reactControlL(q, t);
  if (k <= 0) return;
  S.give(q, 'lost', { time: k });
  if (q.state === 'windup') { q.state = q.type === 'snapjaw' || q.type === 'spitter' ? 'rest' : 'chase'; q.cd = Math.max(q.cd, 0.6); }
}
function reactStunT(e, t) {
  const k = reactControlL(e, t);
  if (k <= 0) return;
  S.give(e, 'stun', { time: k }); e.kx = e.ky = 0;
  if (e.state === 'windup') { e.state = e.type === 'snapjaw' || e.type === 'spitter' ? 'rest' : 'chase'; e.cd = Math.max(e.cd, 0.4); }
}
function reactStackT(e, el, n) {
  if (S.give(e, el + 'Stack', { n }) !== 'full') return;
  if (el === 'shock') { reactStunT(e, R.overload.stun); reactFiredL(e, 'overload'); }
  else {
    const k = reactControlL(e, R.freeze.time);
    if (k > 0) { S.give(e, 'frozen', { time: k }); S.give(e, 'stun', { time: k }); e.kx = e.ky = 0; if (e.state === 'windup') e.state = e.type === 'snapjaw' || e.type === 'spitter' ? 'rest' : 'chase'; }
    reactFiredL(e, 'freeze');
  }
}
// (as Lodestar's foeStatusesLeft, a stage now)
function statusesStageT(h, near = nearestL) {
  const e = h.to;
  if (!h.kinds || h.blow.noProc) return;
  if (e.dead) { h.stop(); return; }
  const d = W, b = h.blow, els = h.kinds, share = h.amount / els.length;
  for (const el of els) {
    const k = (b.att && b.att.includes(el) ? L.attunedStatus : 1) * (b.statusK || 1);
    S.give(e, el, { scale: k });
    if (el === 'shock') {
      if (h.rng.chance(El.shockChance)) { const q = near(O.shockRange, e, e); if (q) h.send(q, { amount: share * O.shockMult, kinds: ['shock'], noProc: true, spell: true }); }
      reactStackT(e, 'shock', 1);
    } else if (el === 'frost') {
      S.give(e, 'chill', { scale: k });
      if (!S.has(e, 'frozen')) reactStackT(e, 'frost', 1);
    } else if (el === 'ember') {
      const add = share * El.burn;
      if (S.give(e, 'burn', { amount: add, scale: k }) === 'most' && reactReadyL(e, 'inferno')) {
        S.spread(e, 'burn', d.enemies, { who: (q) => !q.dead, take: (q) => !q.burn || q.burn.dps < add, as: () => ({ t: El.burnTime, dps: add, n: 1 }) });
        reactFiredL(e, 'inferno');
      }
    } else if (el === 'blight') {
      if (S.give(e, 'poison', { amount: share * El.blight, scale: k }) === 'again' && reactReadyL(e, 'plague')) {
        const n = S.spread(e, 'poison', d.enemies, { who: (q) => !q.dead, take: (q, s) => !q.blight || q.blight.dps < s.dps, as: (s) => ({ t: El.blightTime, dps: s.dps }) });
        if (n) reactFiredL(e, 'plague');
      }
    } else if (el === 'force' && b.heavy) {
      if (S.has(e, 'heavy') && reactReadyL(e, 'stun')) { S.clear(e, 'heavy'); reactStunT(e, R.stun.time); reactFiredL(e, 'stun'); }
      else S.give(e, 'heavy', { scale: k });
    }
  }
}
const sentOf = (list) => list.map((s) => [W.enemies.indexOf(s.q), s.dmg, JSON.stringify(s.opts.els), !!s.opts.noProc, !!s.opts.spell]);

const ELS = [['force'], ['shock'], ['frost'], ['ember'], ['blight'], ['ember', 'frost'], ['ember', 'shock'], ['force', 'shock'], ['frost', 'blight'], ['ember', 'force'], ['blight', 'ember']];

test('statuses a hit leaves, stacked and spread, as Lodestar\'s circuitStatuses did', () => {
  for (let seed = 1; seed <= 1500; seed++) {
    const q = mulberry32(seed), els = ELS[seed % ELS.length], dmg = q() * 30, o = { heavy: q() < 0.4, att: q() < 0.3 ? [els[0]] : [], statusK: q() < 0.3 ? 1.4 : undefined };
    const a = world(seed), b = clone(a);
    b.rng = new Rng(seed); a.rng = new Rng(seed);
    W = a; circuitStatusesL(a.enemies[0], els, dmg, o);
    W = b; b.sent = [];
    const pipe = new harm.Pipeline([statusesStageT], { rng: b.rng });
    // (what the stage sends on goes through SENT)
    const h = pipe.land(b.enemies[0], { amount: dmg, kinds: els, heavy: o.heavy, att: o.att, statusK: o.statusK });
    for (const f of h.follow) assert.equal(f.pipe, pipe);
    // a.sent was recorded by the original's hurtEnemy; b's follow-ups are the stage's sends
    const bs = h.follow.map((f) => ({ q: f.to, dmg: f.amount, opts: { els: f.kinds, noProc: f.blow.noProc, spell: f.blow.spell } }));
    W = a; const sa = sentOf(a.sent); W = b; const sb = sentOf(bs);
    assert.deepEqual(sb, sa, `seed ${seed}: the blows sent on`);
    assert.deepEqual(JSON.parse(JSON.stringify(b.enemies)), JSON.parse(JSON.stringify(a.enemies)), `seed ${seed}: the foes`);
    assert.deepEqual(b.nums.map((n) => n.word), a.nums.map((n) => n.word));
    assert.equal(b.rng.next(), a.rng.next(), `seed ${seed}: the rolls drawn`);
  }
});

test('statuses wear off, and burns and poison bite, as Lodestar\'s reactTick and its dots did', () => {
  for (let seed = 1; seed <= 400; seed++) {
    const a = world(seed, 8), b = clone(a), dts = [1 / 60, 1 / 60 * 1.5, 0.25, 1 / 60];
    for (let step = 0; step < 300; step++) {
      const dt = dts[step % dts.length];
      W = a; for (const e of a.enemies) { if (e.dead) continue; reactTickL(e, dt); dotsL(e, dt); }
      W = b;
      for (const e of b.enemies) {
        if (e.dead) continue;
        S.wear(e, dt);
        S.tick(e, dt, {
          bite: (x, id, n) => { x.hp -= n; },
          show: (x, id, s) => { W.nums.push({ x: x.x, y: x.y - 16, v: Math.max(1, Math.round(s.dps * 0.5)), t: 0.5, elem: S.def(id).at || id }); },
          after: (x) => { if (x.hp <= 0 && x.type !== 'dummy') { x.dead = true; return true; } if (x.type === 'dummy' && x.hp <= 0) x.hp = x.maxHp; },
        });
      }
    }
    assert.deepEqual(clone(b.enemies), clone(a.enemies), `seed ${seed}`);
    assert.deepEqual(b.nums, a.nums, `seed ${seed}: the numbers`);
  }
});

test('the Kindler\'s chill, jolt, burn and blight, as Lodestar\'s foeStatusTick and foeElementOnPlayer did', () => {
  const F = { chill: 1.6, chillSlow: 0.55, burn: [2, 0.25], blight: [3, 0.18], shock: 0.3 };
  const K = new harm.Statuses([
    { id: 'chill', at: 'chillT', wear: 'down' }, { id: 'shock', at: 'shockT', wear: 'down' },
    { id: 'burn', dose: 'dps', every: 0.5 }, { id: 'poison', at: 'blight', dose: 'dps', every: 0.5 },
  ]);
  const giveL = (d, el, dmg) => {
    const p = d.p;
    if (el === 'frost') p.chillT = Math.max(p.chillT || 0, F.chill);
    else if (el === 'ember') p.burn = { t: F.burn[0], dps: Math.max(1, dmg * F.burn[1]), tick: 0 };
    else if (el === 'blight') p.blight = { t: F.blight[0], dps: Math.max(1, dmg * F.blight[1]), tick: 0 };
    else if (el === 'shock') p.shockT = Math.max(p.shockT || 0, F.shock);
  };
  const giveT = (d, el, dmg) => {
    const p = d.p;
    if (el === 'frost') K.give(p, 'chill', { time: F.chill });
    else if (el === 'ember') K.put(p, 'burn', { t: F.burn[0], dps: Math.max(1, dmg * F.burn[1]), tick: 0 });
    else if (el === 'blight') K.put(p, 'poison', { t: F.blight[0], dps: Math.max(1, dmg * F.blight[1]), tick: 0 });
    else if (el === 'shock') K.give(p, 'shock', { time: F.shock });
  };
  for (let seed = 1; seed <= 300; seed++) {
    const q = mulberry32(seed), armor = Math.floor(q() * 30);
    const a = { p: { x: 1, y: 2, hp: 40 + q() * 60, restT: 1 }, nums: [], dying: 0, starts: 0 }, b = clone(a);
    for (let step = 0; step < 400; step++) {
      if (q() < 0.03) { const el = CORE[Math.floor(q() * 5)], dmg = q() * 20; giveL(a, el, dmg); giveT(b, el, dmg); }
      const dt = step % 7 ? 1 / 60 : 0.1;
      kindlerTickL(a, dt, F, armor);
      if (K.has(b.p, 'chill')) b.p.frostSlow = Math.min(b.p.frostSlow || 1, F.chillSlow);
      K.wear(b.p, dt);
      K.tick(b.p, dt, {
        bites: () => !b.dying,
        bite: (p, id, n) => { p.hp -= harm.armored(n, L.armorK, armor); p.restT = 0; },
        show: (p, id, s) => { b.nums.push({ x: p.x, y: p.y - 22, v: Math.max(1, Math.round(s.dps * 0.5)), t: 0.5, hurt: true, elem: K.def(id).at || id }); },
        after: (p) => { if (!b.dying && p.hp <= 0) { p.hp = 0; b.dying = 1.4; b.starts++; } },
      });
      a.p.frostSlow = b.p.frostSlow = undefined;
      if (a.dying && step % 50 === 0) { a.dying = b.dying = 0; a.p.hp = b.p.hp = 60; }
    }
    assert.deepEqual(b, a, `seed ${seed}`);
  }
});

test('a poisoned foe\'s poison spreads as it falls, as Lodestar\'s killEnemy did', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const a = world(seed, 9), b = clone(a), e = a.enemies[0], eb = b.enemies[0];
    if (!e.blight) continue;
    for (const o of a.enemies) if (!o.dead && o !== e && dist(o.x, o.y, e.x, e.y) < El.blightSpread) o.blight = { t: El.blightTime, dps: e.blight.dps };
    S.spread(eb, 'poison', b.enemies, { r: El.blightSpread, reach: 'middle', who: (o) => !o.dead, as: (s) => ({ t: El.blightTime, dps: s.dps }) });
    assert.deepEqual(clone(b.enemies), clone(a.enemies), `seed ${seed}`);
  }
  // died() spreads only what spreads on a death, as the def says
  const x = { x: 0, y: 0, r: 5, blight: { t: 2, dps: 3 }, burn: { t: 1, dps: 9, n: 1 } }, y = { x: 10, y: 0, r: 5 }, z = { x: 100, y: 0, r: 5 };
  S.died(x, [x, y, z], { as: (s) => ({ t: 4, dps: s.dps }) });
  assert.deepEqual(y.blight, { t: 4, dps: 3 });
  assert.equal(y.burn, undefined);
  assert.equal(z.blight, undefined);
});

// ---- the reactions: Lodestar's circuitReact and REACT_DO as they were -------
const EMBER = { crawler: 1.5, wisp: 1, construct: 1, tusker: 1.5, hollow: 0.6, snapjaw: 1.5 };
const REACT_DO_L = {
  shatter(e, els, o) {
    const d = W, Rs = R.shatter;
    d.fx.push('shatter');
    if (e.frozenT > 0) {
      e.frozenT = 0; e.stunT = Math.min(e.stunT, 0.05);
      d.fx.push('iceBurst');
      for (const q of d.enemies) if (!q.dead && q !== e && dist(q.x, q.y, e.x, e.y) < Rs.burst + q.r) hurtEnemyL(q, o.dmg * Rs.burstMult, { els: ['frost'], noProc: true, spell: true });
    }
    e.slowT = 0;
    if (e.st) e.st.frost = 0;
    if (e.stk) e.stk.frost = 0;
    if (!els.includes('force') && e.st) e.st.force = 0;
    return Rs.mult;
  },
  conduct(e, els, o) {
    const d = W, Rc = R.conduct, share = o.dmg / els.length;
    let n = 0;
    for (const q of d.enemies) {
      if (q.dead || q === e || !carriesL(q, 'frost') || dist(q.x, q.y, e.x, e.y) > Rc.range) continue;
      hurtEnemyL(q, share * Rc.mult, { els: ['shock'], noProc: true, spell: true });
      n++;
    }
    return n ? 1 : null;
  },
  steam(e) {
    const d = W, Rs = R.steam;
    d.fx.push('steam');
    for (const q of d.enemies) if (!q.dead && dist(q.x, q.y, e.x, e.y) < Rs.r + q.r) reactLoseL(q, Rs.lost);
    e.slowT = 0; e.burn = null;
    if (e.st) e.st.frost = e.st.ember = 0;
    return 1;
  },
  brittle(e) { e.brittleT = R.status; return 1; },
  pyre(e, els, o) {
    const b = e.blight;
    if (!b) return null;
    o.extra = (o.extra || 0) + b.dps * b.t * R.pyre.mult * EMBER[e.type];
    e.blight = null;
    if (e.st) e.st.blight = 0;
    return 1;
  },
  flare(e) {
    const d = W, Rf = R.flare;
    d.fx.push('flare');
    for (const q of d.enemies) if (!q.dead && dist(q.x, q.y, e.x, e.y) < Rf.r + q.r) reactLoseL(q, Rf.blind);
    return 1;
  },
  scatter(e, els, o) {
    const d = W, Rs = R.scatter, p = d.p;
    const k = o.knock && Math.hypot(o.knock.x, o.knock.y) > 1 ? norm(o.knock.x, o.knock.y) : norm(e.x - p.x, e.y - p.y);
    let n = 0;
    for (let i = 1; i <= Rs.n; i++) { const x = e.x + k.x * Rs.step * i, y = e.y + k.y * Rs.step * i; if (x > 50) break; d.fx.push({ x, y, dps: o.dmg * Rs.dps }); n++; }
    return n ? 1 : null;
  },
  jolt(e) { reactStackL(e, 'shock', R.jolt.stacks); return 1; },
};
function norm(x, y) { const m = Math.hypot(x, y) || 1; return { x: x / m, y: y / m }; }
function circuitReactL(e, els, o) {
  const fired = [];
  const add = (id) => { if (id && !fired.includes(id)) fired.push(id); };
  if (els.length > 1) add(reactPairL(els[0], els[1]));
  for (const el of els) for (const c of CORE) if (c !== el && carriesL(e, c)) add(reactPairL(el, c));
  let mult = 1;
  for (const id of fired) {
    if (!reactReadyL(e, id)) continue;
    const m = REACT_DO_L[id](e, els, o);
    if (m === null) continue;
    mult *= m;
    reactFiredL(e, id);
  }
  return mult;
}
// and as Lodestar's REACT_DO is now, on Tycho's statuses and its h
const REACT_DO_T = {
  shatter(h) {
    const d = W, Rs = R.shatter, e = h.to;
    d.fx.push('shatter');
    if (S.has(e, 'frozen')) {
      S.clear(e, 'frozen'); e.stunT = Math.min(e.stunT, 0.05);
      d.fx.push('iceBurst');
      for (const q of d.enemies) if (!q.dead && q !== e && dist(q.x, q.y, e.x, e.y) < Rs.burst + q.r) h.send(q, { amount: h.amount * Rs.burstMult, kinds: ['frost'], noProc: true, spell: true });
    }
    S.clear(e, 'chill'); S.clear(e, 'frost'); S.clear(e, 'frostStack');
    if (!h.kinds.includes('force')) S.clear(e, 'force');
    return Rs.mult;
  },
  conduct(h) {
    const d = W, Rc = R.conduct, e = h.to, share = h.amount / h.kinds.length;
    let n = 0;
    for (const q of d.enemies) {
      if (q.dead || q === e || !carriesT(q, 'frost') || dist(q.x, q.y, e.x, e.y) > Rc.range) continue;
      h.send(q, { amount: share * Rc.mult, kinds: ['shock'], noProc: true, spell: true });
      n++;
    }
    return n ? 1 : null;
  },
  steam(h) {
    const d = W, Rs = R.steam, e = h.to;
    d.fx.push('steam');
    for (const q of d.enemies) if (!q.dead && dist(q.x, q.y, e.x, e.y) < Rs.r + q.r) reactLoseT(q, Rs.lost);
    S.clear(e, 'chill'); S.clear(e, 'burn'); S.clear(e, 'frost'); S.clear(e, 'ember');
    return 1;
  },
  brittle(h) { S.give(h.to, 'brittle'); return 1; },
  pyre(h) {
    const e = h.to, b = S.get(e, 'poison');
    if (!b) return null;
    h.extra = (h.extra || 0) + b.dps * b.t * R.pyre.mult * EMBER[e.type];
    S.clear(e, 'poison'); S.clear(e, 'blight');
    return 1;
  },
  flare(h) {
    const d = W, Rf = R.flare, e = h.to;
    d.fx.push('flare');
    for (const q of d.enemies) if (!q.dead && dist(q.x, q.y, e.x, e.y) < Rf.r + q.r) reactLoseT(q, Rf.blind);
    return 1;
  },
  scatter(h) {
    const d = W, Rs = R.scatter, p = d.p, e = h.to, kn = h.blow.knock;
    const k = kn && Math.hypot(kn.x, kn.y) > 1 ? norm(kn.x, kn.y) : norm(e.x - p.x, e.y - p.y);
    let n = 0;
    for (let i = 1; i <= Rs.n; i++) { const x = e.x + k.x * Rs.step * i, y = e.y + k.y * Rs.step * i; if (x > 50) break; d.fx.push({ x, y, dps: h.amount * Rs.dps }); n++; }
    return n ? 1 : null;
  },
  jolt(h) { reactStackT(h.to, 'shock', R.jolt.stacks); return 1; },
};
const TABLE = new harm.Reactions(PAIRS);
const reactStage = () => harm.react({ table: TABLE, kinds: CORE, carries: carriesT, do: REACT_DO_T, ready: reactReadyL, fired: reactFiredL, when: (h) => !h.blow.noProc });

test('the reactions table is Lodestar\'s reactPair, either order', () => {
  for (const a of CORE.concat('x')) for (const b of CORE.concat('x')) assert.equal(TABLE.of(a, b), reactPairL(a, b));
  const flipped = new harm.Reactions({ 'frost|force': 'shatter' });
  assert.equal(flipped.of('force', 'frost'), 'shatter');
  assert.equal(flipped.of('frost', 'force'), 'shatter');
});

test('statuses that meet react, as Lodestar\'s circuitReact and REACT_DO did', () => {
  let fired = 0;
  for (let seed = 1; seed <= 3000; seed++) {
    const q = mulberry32(seed + 77), els = ELS[seed % ELS.length], dmg = q() * 30, knock = q() < 0.5 ? { x: (q() - 0.5) * 200, y: (q() - 0.5) * 200 } : null, heavy = q() < 0.3;
    const a = world(seed, 7), b = clone(a);
    a.rng = new Rng(seed); b.rng = new Rng(seed);
    W = a;
    const o = { dmg, heavy, knock, extra: 0 };
    const outA = dmg * circuitReactL(a.enemies[0], els, o) + o.extra;
    W = b;
    const h = new harm.Pipeline([reactStage()], { rng: b.rng }).land(b.enemies[0], { amount: dmg, kinds: els, heavy, knock });
    const bs = h.follow.map((f) => ({ q: f.to, dmg: f.amount, opts: { els: f.kinds, noProc: f.blow.noProc, spell: f.blow.spell } }));
    assert.equal(h.amount, outA, `seed ${seed}: the amount`);
    W = a; const sa = sentOf(a.sent); W = b; const sb = sentOf(bs);
    assert.deepEqual(sb, sa, `seed ${seed}: the blows sent on`);
    assert.deepEqual(clone(b.enemies), clone(a.enemies), `seed ${seed}: the foes`);
    assert.deepEqual(clone(b.fx), clone(a.fx), `seed ${seed}: what showed`);
    assert.deepEqual(h.marks, a.nums.filter((n) => n.foe === a.enemies[0]).map((n) => n.word.toLowerCase()).filter((w) => PAIRS[Object.keys(PAIRS).find((k) => PAIRS[k] === w)] === w), `seed ${seed}: the marks`);
    fired += h.marks.length;
  }
  assert.ok(fired > 1000, `reactions fired: ${fired}`);
});

// ---- the pipeline, held to hits recorded from Lodestar's main ----------------
// Lodestar's hurtEnemy as a pipeline: Tycho's stages, and Lodestar's own
// ported for what they do to the struck body (what they did to the foes
// about it, and what they looked up in the world, come from the record: the
// nature's multiplier, the affixes' and a Keeper's phase's amounts, what
// each reaction returned and added, whether a poison found another to
// spread to). Every roll is the recorded one, in order, and the blows sent
// on must be the ones the stages would send.
const FOE_KEYS = ['type', 'boss', 'elite', 'affixes', 'home', 'hp', 'maxHp', 'dead', 'hid', 'state', 't', 'cd', 'aggro', 'wakeT', 'flash', 'flashCol', 'slowT', 'stunT', 'lostT', 'frozenT', 'brittleT', 'heavyT', 'st', 'stk', 'rcd', 'burn', 'blight', 'ward', 'wardS', 'wardMax', 'wardHit', 'kx', 'ky', 'kvx', 'kvy', 'hitT', 'flinchAt', 'lastVerdict', 'verdictAt', 'reactWordAt', 'cracked', 'shell'];
const KIN_KEYS = ['hp', 'ward', 'wardS', 'wardHit', 'invuln', 'hurtT', 'restT'];
const EXPOSED = new Set(['stranded', 'spent', 'landed']);
const expected = (rec) => { const x = clone(rec.before); for (const k in rec.after) { if (rec.after[k] === '$gone') delete x[k]; else x[k] = rec.after[k]; } return x; };
const keep = (o, keys) => { const x = {}; for (const k of keys) if (o[k] !== undefined) x[k] = o[k]; return x; };
const recorded = (draws) => { const rng = new Rng(0); let i = 0; rng.next = () => { assert.ok(i < draws.length, 'a roll the original never drew'); return draws[i++]; }; rng.left = () => draws.length - i; return rng; };

function replayFoe(rec) {
  const e = clone(rec.before), st = rec.stats, sends = new Set(), hulking = !!(e.affixes && e.affixes.includes('hulking'));
  e.x = 0; e.y = 0; e.r = 6;
  // (a poison that found another foe to spread to: one stands by)
  const plagued = rec.after.rcd && rec.after.rcd !== '$gone' && rec.after.rcd.plague !== undefined && rec.after.rcd.plague !== (rec.before.rcd || {}).plague;
  W = { t: rec.t, realT: rec.realT, enemies: plagued ? [e, { x: 0, y: 0, r: 6, dead: false }] : [e], nums: [], fx: [], sent: [], p: { x: 0, y: 0 } };
  const rng = recorded(rec.draws || []), react = rec.react || [];
  let ri = 0, cur = null;
  const can = (b) => !b.boss && b.type !== 'hollow';
  const local = {
    shatter(h) { if (S.has(e, 'frozen')) { S.clear(e, 'frozen'); e.stunT = Math.min(e.stunT, 0.05); sends.add(h.amount * R.shatter.burstMult); } S.clear(e, 'chill'); S.clear(e, 'frost'); S.clear(e, 'frostStack'); if (!h.kinds.includes('force')) S.clear(e, 'force'); },
    conduct(h) { sends.add((h.amount / h.kinds.length) * R.conduct.mult); },
    steam() { reactLoseT(e, R.steam.lost); S.clear(e, 'chill'); S.clear(e, 'burn'); S.clear(e, 'frost'); S.clear(e, 'ember'); },
    brittle() { S.give(e, 'brittle'); },
    pyre(h, c) { if (c.ret !== null) { S.clear(e, 'poison'); S.clear(e, 'blight'); } },
    flare() { reactLoseT(e, R.flare.blind); },
    scatter() {},
    jolt() { reactStackT(e, 'shock', R.jolt.stacks); },
  };
  const replayDo = Object.fromEntries(CORE.flatMap((a) => CORE.map((b) => reactPairL(a, b))).filter(Boolean).map((id) => [id, (h) => {
    const c = react[ri++];
    assert.ok(c, `${id} fired, which the original didn't`);
    assert.equal(c.id, id, 'the reactions fired in another order');
    local[id](h, c);
    h.extra = (h.extra || 0) + c.extra;
    return c.ret;
  }]));
  const pipe = new harm.Pipeline([
    harm.gate((h) => !(h.to.dead || h.to.hid)),
    harm.scale((h) => (h.to.state === 'dazed' || EXPOSED.has(h.to.state) ? L.exposed : 1)),
    harm.resist({ of: () => rec.m, shape: (h, m) => {
      if (h.to.type !== 'crab') return m;
      const sh = e.slowT > 0 || e.cracked > 0 ? 1 : h.blow.heavy ? ((e.cracked = L.crab.crackTime), 1) : L.crab.shell;
      assert.equal(sh, rec.crab, 'the crab\'s shell');
      return sh < 1 ? sh * Math.max(1, m) : m;
    } }),
    (h) => { e.lastVerdict = h.verdict; },
    harm.scale((h) => (h.to.brittleT > 0 ? R.brittle.mult : 1)),
    (h) => {
      if (!e.affixes || !e.affixes.length) return;
      assert.equal(h.amount, rec.affix.in, 'the amount into the affixes');
      h.amount = rec.affix.out;
      if (rec.affix.wordAt !== undefined) e.reactWordAt = rec.affix.wordAt;
      if (h.amount <= 0) { harm.flash(e, L.hurtFlash, { col: null }); h.stop(); }
    },
    (h) => {
      if (e.type !== 'keeper') return;
      assert.equal(h.amount, rec.keeper.in, 'the amount into the Keeper\'s phase');
      h.amount = rec.keeper.out;
      if (rec.keeper.wordAt !== undefined) e.reactWordAt = rec.keeper.wordAt;
    },
    harm.react({ table: TABLE, kinds: CORE, carries: carriesT, do: replayDo, ready: reactReadyL, fired: reactFiredL, when: (h) => !h.blow.noProc }),
    (h) => { cur = h; statusesStageT(h, () => { sends.add((cur.amount / cur.kinds.length) * O.shockMult); return null; }); },
    (h) => {
      if (!(h.kinds && h.kinds.includes('force') && e.ward > 0)) return;
      e.ward = Math.max(0, e.ward - (h.blow.heavy ? 2 : 1)); e.wardHit = 0.2;
      if (e.ward <= 0) e.reactWordAt = W.realT;
    },
    harm.soak('ward', { when: (h) => !!h.to.wardS && h.to.ward > 0, gone: (b) => { b.wardS = false; } }),
    (h) => {
      const els = h.kinds, verdict = h.verdict;
      e.hp -= h.amount;
      harm.flash(e, L.hurtFlash, { col: els && els[0] !== 'force' ? L.cols[els[0]] : null });
      const quiet = !verdict || e.reactWordAt === W.realT || W.realT - (e.verdictAt || -9) < R.verdictEvery;
      if (!quiet) e.verdictAt = W.realT;
      W.nums.push({ x: e.x + h.rng.f(-3, 3), v: Math.max(1, Math.round(h.amount)), quiet, verdict, crit: h.blow.crit });
    },
    harm.knock({ weight: (b) => { const kd = L.knock[b.type]; return (b.boss || b.type === 'hollow' ? 0.2 : b.type === 'construct' ? 0.5 : kd !== null && kd !== undefined ? kd : 1) * (hulking ? L.hulkingKnock : 1); } }),
    harm.stagger({ can, steady: () => hulking, open: (b) => b.state !== 'dazed', heavy: L.staggerTime, scale: 'staggerK', flinch: { share: L.impact.flinch, time: L.impact.flinchTime, gap: L.impact.flinchGap, clock: () => W.t } }),
    harm.hold({ field: 'hitT', time: L.impact.targetStop, heavy: L.impact.heavyTargetStop, can }),
    (h) => {
      if (e.type === 'dummy') { if (e.hp <= 0) e.hp = e.maxHp; e.kvx = e.kvy = 0; return; }
      e.wakeT = 0;
      if (!e.aggro) { e.aggro = true; e.cd = Math.max(e.cd, 0.3); }
      if (!h.blow.noProc) {
        if (st.chill && h.rng.f(100) < st.chill) S.put(e, 'chill', O.chillTime);
        if (st.shock && h.rng.f(100) < st.shock) sends.add(h.amount * O.shockMult);
      }
      if (e.hp <= 0) e.dead = true;
    },
  ]);
  const b = rec.blow, blow = Object.assign({}, b, { amount: rec.amount, kinds: b.els || (b.element ? [b.element] : null) });
  pipe.land(e, blow, { rng });
  return { e, rng, ri, react, sends, nums: W.nums };
}

test('blows on foes land as they did in Lodestar, hit for hit, through Tycho\'s stages', () => {
  let reactions = 0, soaked = 0, staggered = 0;
  for (const [i, rec] of HITS.foe.entries()) {
    const at = `hit ${i} (${rec.before.type}, ${JSON.stringify(rec.blow.els || rec.blow.element || null)})`;
    const r = replayFoe(rec);
    assert.equal(r.rng.left(), 0, `${at}: rolls the original drew and this didn't`);
    assert.equal(r.ri, r.react.length, `${at}: reactions the original fired and this didn't`);
    assert.deepEqual(keep(clone(r.e), FOE_KEYS), keep(expected(rec), FOE_KEYS), `${at}: the foe after`);
    assert.deepEqual(clone(r.nums.filter((n) => n.v !== undefined).map((n) => ({ v: n.v, quiet: n.quiet, verdict: n.verdict, crit: n.crit }))), rec.nums || [], `${at}: its number`);
    for (const s of rec.sent || []) if (s.to === 'foe') assert.ok(r.sends.has(s.amount), `${at}: a blow sent on for ${s.amount}, which this wouldn't send`);
    reactions += r.ri; soaked += rec.before.wardS && rec.before.ward > 0 ? 1 : 0; staggered += rec.after.state === 'stagger' ? 1 : 0;
  }
  assert.ok(HITS.foe.length > 400 && reactions > 40 && staggered > 20, `${HITS.foe.length} hits, ${reactions} reactions, ${soaked} soaked, ${staggered} staggered`);
});

test('blows on the Kindler land as they did in Lodestar: thick skin, the lattice\'s armor, a ward\'s soak', () => {
  for (const [i, rec] of HITS.kin.entries()) {
    const p = clone(rec.before);
    let backs = 0, gone = 0;
    const pipe = new harm.Pipeline([
      harm.gate((h) => !(h.to.invuln > 0 || rec.dying)),
      harm.scale(() => rec.thick),
      harm.armor({ k: rec.k, of: () => rec.armor }),
      harm.soak('ward', { first: () => { if (rec.by && p.wardS) backs++; }, gone: (b) => { b.wardS = false; gone++; } }),
      (h) => { p.hp -= h.amount; p.invuln = L.player.hurtInvuln; p.hurtT = 0.25; p.restT = 0; if (p.hp <= 0) p.hp = 0; },
    ]);
    pipe.land(p, { amount: rec.amount, by: rec.by ? {} : null });
    assert.deepEqual(keep(p, KIN_KEYS), keep(expected(rec), KIN_KEYS), `hit ${i}: the Kindler after`);
    assert.equal(backs, (rec.sent || []).filter((s) => s.to === 'foe').length, `hit ${i}: struck back`);
    assert.equal(gone, rec.gone || 0, `hit ${i}: the ward gone`);
  }
});

// ---- the pipeline itself ------------------------------------------------------
test('a pipeline runs its stages in order until one stops it, and sends blows on', () => {
  const log = [];
  const other = new harm.Pipeline([(h) => log.push(['other', h.to.id, h.amount, h.rng.f(), h.ctx])]);
  const rng = new Rng(9), want = new Rng(9);
  const pipe = new harm.Pipeline([
    { name: 'a', land(h) { log.push(['a', h.amount]); h.amount *= 2; } },
    (h) => { h.mark('first'); const f = h.send({ id: 'q' }, { amount: 3 }, other); log.push(['sent', f.amount]); },
    (h) => { if (h.blow.stopHere) h.stop(); },
    (h) => { log.push(['c', h.amount, h.marks.slice()]); },
  ], { rng, ctx: 'ctx' });
  const h = pipe.land({ id: 'p' }, { amount: 5 });
  assert.equal(h.amount, 10);
  assert.equal(h.follow.length, 1);
  assert.equal(h.stopped, false);
  assert.deepEqual(log, [['a', 5], ['other', 'q', 3, want.f(), 'ctx'], ['sent', 3], ['c', 10, ['first']]]);
  const s = pipe.land({ id: 'p' }, { amount: 1, stopHere: true });
  assert.equal(s.stopped, true);
  assert.equal(log[log.length - 1][0], 'sent');
  // the random source and the context a land is given, over the pipeline's own
  const r2 = new Rng(4), w2 = new Rng(4), n0 = log.length;
  pipe.land({ id: 'p' }, { amount: 1 }, { rng: r2, ctx: 7 });
  const o = log.slice(n0).find((x) => x[0] === 'other');
  assert.equal(o[3], w2.f()); assert.equal(o[4], 7);
});

test('stock stages: resist, armor, soak, knock, stagger, hold and afflict, by their options', () => {
  const hit = (stages, body, blow) => new harm.Pipeline(stages).land(body, blow);
  // resist: verdicts by the thresholds; no kind, no change; the shape's last say
  assert.equal(hit([harm.resist({ of: () => 1.5 })], {}, { amount: 10, kinds: ['x'] }).verdict, 'W');
  assert.equal(hit([harm.resist({ of: () => 0.5 })], {}, { amount: 10, kinds: ['x'] }).verdict, 'R');
  assert.equal(hit([harm.resist({ of: () => 1 })], {}, { amount: 10, kinds: ['x'] }).verdict, null);
  assert.equal(hit([harm.resist({ of: () => 9 })], {}, { amount: 10 }).amount, 10);
  assert.equal(hit([harm.resist({ of: () => 0.5, shape: (h, m) => m * 3 })], {}, { amount: 10, kinds: ['x'] }).amount, 15);
  // armor and what it lets through of a drain, as Lodestar's hurtPlayer and its drains
  for (let a = 0; a < 40; a += 3.7) for (const x of [1, 7.3, 13.9]) {
    assert.equal(hit([harm.armor({ k: 50, of: () => a })], {}, { amount: x }).amount, x * (50 / (50 + a)));
    assert.equal(harm.armored(x * (1 / 60), 50, a), x * (1 / 60) * 50 / (50 + a));
  }
  // soak: what's there takes it first; struck back first; gone when spent
  const p = { ward: 5 }, log = [];
  const sk = harm.soak('ward', { first: () => log.push('back'), gone: () => log.push('gone') });
  assert.equal(hit([sk], p, { amount: 3 }).amount, 0); assert.equal(p.ward, 2);
  assert.equal(hit([sk], p, { amount: 3 }).amount, 1); assert.equal(p.ward, 0);
  assert.equal(hit([sk], p, { amount: 3 }).amount, 3);
  assert.deepEqual(log, ['back', 'back', 'gone']);
  assert.equal(hit([harm.soak('ward', { when: () => false })], { ward: 9 }, { amount: 3 }).amount, 3);
  // knock by weight
  const b = { kvx: 1, kvy: 2 };
  const kh = hit([harm.knock({ weight: () => 0.5 })], b, { amount: 1, knock: { x: 10, y: -4 } });
  assert.deepEqual([b.kvx, b.kvy, kh.knock], [6, 0, { x: 5, y: -2 }]);
  // stagger: heavy; flinch out of a wind-up once a gap (a flinch at 0 counts
  // as none, as Lodestar's did); steady shrugs both
  let t = 0.5;
  const sg = harm.stagger({ heavy: 0.35, scale: 'k', flinch: { share: 0.15, time: 0.25, gap: 1.2, clock: () => t } });
  const f = { state: 'windup', t: 1, maxHp: 100 };
  assert.ok(hit([sg], f, { amount: 20 }).flinch); assert.deepEqual([f.state, f.t, f.flinchAt], ['stagger', 0.25, 0.5]);
  f.state = 'windup'; t = 1; assert.ok(!hit([sg], f, { amount: 20 }).flinch);
  assert.ok(!hit([sg], f, { amount: 10 }).flinch);
  t = 1.8; assert.ok(hit([sg], f, { amount: 20 }).flinch);
  f.state = 'chase'; assert.ok(hit([sg], f, { amount: 1, heavy: true, k: 2 }).stagger); assert.equal(f.t, 0.7);
  assert.ok(!hit([harm.stagger({ heavy: 0.35, steady: () => true })], { state: 'chase' }, { amount: 1, heavy: true }).stagger);
  // hold: the longer of what's there and the blow's
  const ho = { hitT: 0.1 };
  hit([harm.hold({ time: 0.07, heavy: 0.13 })], ho, { amount: 1 }); assert.equal(ho.hitT, 0.1);
  hit([harm.hold({ time: 0.07, heavy: 0.13 })], ho, { amount: 1, heavy: true }); assert.equal(ho.hitT, 0.13);
  // afflict: a blow's statuses, and its kinds'
  const AS = new harm.Statuses([{ id: 'wet', time: 2 }, { id: 'cut', dose: 'dps', time: 4 }]);
  const v = {};
  hit([harm.afflict(AS, { of: (k) => (k === 'blade' ? 'cut' : null), amount: () => 3 })], v, { amount: 1, kinds: ['blade'], statuses: ['wet'] });
  assert.deepEqual(v, { wet: 2, cut: { t: 4, dps: 3 } });
});

test('statuses: each stacking, each wear, a dose biting on its beat', () => {
  const ST = new harm.Statuses([
    { id: 'max', time: 2 }, { id: 'set', time: 2, stack: 'set' }, { id: 'keep', time: 2, stack: 'keep' },
    { id: 'count', stack: 'count', most: 3 }, { id: 'add', dose: 'dps', time: 3, stack: 'add', most: 3 }, { id: 'fresh', dose: 'dps', time: 3 },
    { id: 'beat', dose: 'dps', time: 2, every: 0.5, bite: 'beat' },
    { id: 'clamp', time: 1, wear: 'clamp' }, { id: 'down', time: 1, wear: 'down' }, { id: 'clear', at: ['m', 'k'], time: 1, wear: 'clear', ends: (b) => { b.ended = (b.ended || 0) + 1; } },
  ]);
  const b = {};
  assert.equal(ST.give(b, 'max'), 'new'); assert.equal(ST.give(b, 'max', { time: 1 }), 'again'); assert.equal(b.max, 2);
  ST.give(b, 'set'); ST.give(b, 'set', { time: 1 }); assert.equal(b.set, 1);
  ST.give(b, 'keep'); assert.equal(ST.give(b, 'keep', { time: 9 }), 'kept'); assert.equal(b.keep, 2);
  assert.deepEqual([ST.give(b, 'count'), ST.give(b, 'count'), ST.give(b, 'count'), b.count], ['new', 'again', 'full', 0]);
  assert.deepEqual([ST.give(b, 'add', { amount: 2 }), ST.give(b, 'add', { amount: 2, scale: 2 }), ST.give(b, 'add', { amount: 3 })], ['new', 'again', 'most']);
  assert.deepEqual(b.add, { t: 6, dps: 7, n: 3 });
  ST.give(b, 'fresh', { amount: 4 }); ST.give(b, 'fresh', { amount: 1 }); assert.deepEqual(b.fresh, { t: 3, dps: 4 });
  assert.ok(ST.has(b, 'fresh')); ST.clear(b, 'fresh'); assert.equal(b.fresh, null); assert.ok(!ST.has(b, 'fresh'));
  // wear
  ST.give(b, 'clamp'); ST.give(b, 'down'); ST.give(b, 'clear');
  for (let i = 0; i < 90; i++) ST.wear(b, 1 / 60);
  assert.equal(b.clamp, 0); assert.ok(b.down < 0 && b.down > -0.02); assert.equal(b.m.k, 0); assert.equal(b.ended, 1);
  // a dose on its beat
  const c = {}, bites = [];
  ST.give(c, 'beat', { amount: 4 });
  for (let i = 0; i < 150; i++) ST.tick(c, 1 / 60, { bite: (x, id, n) => bites.push(n) });
  assert.equal(c.beat, null);
  assert.equal(bites.length, 4); assert.ok(bites.every((n) => n === 2));
  assert.throws(() => ST.give(b, 'nothing'));
});

// ---- the feel -----------------------------------------------------------------
test('the world held still as Lodestar\'s freezeFrame and step held it', () => {
  const gap = 0.15;
  for (let seed = 1; seed <= 200; seed++) {
    const q = mulberry32(seed), A = { realT: 0, hitstop: 0 }, B = { realT: 0, hitstop: 0 };
    const freezeL = (t, heavy) => { if (!heavy && A.realT - (A.frozeAt || -1) < gap) return; A.hitstop = Math.max(A.hitstop, t); A.frozeAt = A.realT; };
    const H = new harm.Hitstop({ state: B, gap: () => gap, clock: () => B.realT });
    let ha = 0, hb = 0;
    for (let i = 0; i < 600; i++) {
      A.realT += 1 / 60; B.realT += 1 / 60;
      // (each step: held still, or the world runs, and a hit may land)
      const heldA = A.hitstop > 0;
      if (heldA) { A.hitstop -= 1 / 60; ha++; }
      if (H.hold(1 / 60)) hb++;
      if (!heldA && q() < 0.2) { const t = q() < 0.5 ? 0.045 : 0.09, heavy = q() < 0.3; freezeL(t, heavy); H.freeze(t, heavy); }
    }
    assert.deepEqual([B.hitstop, B.frozeAt, hb], [A.hitstop, A.frozeAt, ha]);
  }
});

test('knockback fades, the numbers rise and the view\'s shake dies away, as in Lodestar', () => {
  const K = new harm.Knock({ decay: () => 9 });
  for (let seed = 1; seed <= 100; seed++) {
    const q = mulberry32(seed), a = { x: 0, y: 0, kvx: (q() - 0.5) * 300, kvy: (q() - 0.5) * 300 }, b = { ...a };
    const moved = [];
    for (let i = 0; i < 120; i++) {
      const dt = i % 3 ? 1 / 60 : 1 / 30, fade = Math.exp(-9 * dt);
      if (Math.abs(a.kvx) + Math.abs(a.kvy) > 1) { a.x += a.kvx * dt; a.y += a.kvy * dt; a.kvx *= fade; a.kvy *= fade; }
      if (K.step(b, dt, (o, dx, dy) => { o.x += dx; o.y += dy; moved.push(i); }, K.fade(dt))) assert.ok(moved.includes(i));
    }
    assert.deepEqual(b, a);
  }
  // numbers: Lodestar's loop (t and y each, then the spent dropped) and rise
  for (let seed = 1; seed <= 50; seed++) {
    const q = mulberry32(seed), a = [], b = [];
    for (let i = 0; i < 200; i++) {
      if (q() < 0.3) { const n = { x: q(), y: q() * 100, v: 3, t: q() * 0.8 }; a.push({ ...n }); b.push({ ...n }); }
      const dt = 1 / 60;
      for (const n of a) { n.t -= dt; n.y -= 14 * dt; }
      const kept = a.filter((n) => n.t > 0); a.length = 0; a.push(...kept);
      harm.rise(b, dt, 14);
    }
    assert.deepEqual(b, a);
  }
  // the shake: View.shake = max(View.shake || 0, n), then × e^(-14 dt)
  const V = {}, U = {}, Sh = new harm.Shake(U, 14);
  for (let i = 0; i < 300; i++) {
    if (i % 37 === 0) { const n = (i % 5) + 1; V.shake = Math.max(V.shake || 0, n); Sh.kick(n); }
    V.shake = (V.shake || 0) * Math.exp(-14 * (1 / 60)); Sh.step(1 / 60);
    assert.equal(U.shake, V.shake);
  }
  // a flash: its time, and its color as given (even none)
  const e = { flashCol: 'x' };
  harm.flash(e, 0.12); assert.deepEqual(e, { flashCol: 'x', flash: 0.12 });
  harm.flash(e, 0.12, { col: undefined }); assert.ok('flashCol' in e && e.flashCol === undefined);
  for (let i = 0; i < 10; i++) harm.fade(e, 1 / 60);
  assert.equal(e.flash, Math.max(0, 0.12 - 10 / 60));
});

// ---- triggers -----------------------------------------------------------------
test('a vent glows then bursts once a cycle, a pod lets go as its cycle begins again, as Lodestar\'s did', () => {
  const V = { every: 5, tell: 1.2, burst: 0.6 };
  const VENT = new harm.Trigger({ cycle: { every: () => V.every, tell: () => V.tell, bite: () => V.burst } });
  const POD = new harm.Trigger({ cycle: { every: 7 } });
  for (let seed = 1; seed <= 60; seed++) {
    const q = mulberry32(seed), va = { ph: q() }, vb = { ...va }, pa = { ph: q() }, pb = { ...pa }, every = 5 + q() * 4;
    let hazT = 0;
    for (let i = 0; i < 1500; i++) {
      hazT += i % 4 ? 1 / 60 : 1 / 20;
      // the vent: ventPhase and the burst's once-a-cycle
      const s = ((hazT || 0) / V.every + va.ph) % 1 * V.every, bursting = s >= V.every - V.burst;
      let fa = false;
      if (bursting && !va.fired) { va.fired = true; fa = true; } else if (!bursting) va.fired = false;
      assert.equal(VENT.fires(vb, hazT), fa);
      assert.equal(VENT.at(hazT, vb.ph), s);
      const tellAt = V.every - V.burst - V.tell;
      assert.equal(VENT.phase(s), s >= V.every - V.burst ? 'bite' : s >= tellAt ? 'tell' : 'rest');
      // the pod: its share, and the wrap
      const ps = (hazT / every + pa.ph) % 1, wa = pa.last !== undefined && ps < pa.last;
      pa.last = ps;
      assert.equal(POD.wraps(pb, hazT, every), wa);
      assert.equal(POD.share(hazT, pb.ph, every), ps);
    }
    assert.deepEqual(vb, va);
  }
});

test('marks, zones and traps: a tell then a bite, inside by shape, set off once', () => {
  // a mark: its tell counted down (the storm, a blink), or burnt down by others (a volatile fuse)
  const M = new harm.Trigger({ tell: 1, zone: { r: 10 }, once: true });
  const m = { x: 5, y: 5, t: 0.04 };
  assert.equal(M.down(m, 1 / 60), false); assert.equal(M.down(m, 1 / 60), false); assert.equal(M.down(m, 1 / 60), true);
  const fx = { t: 0.01 };
  assert.equal(M.goes(fx), false); fx.t = 0; assert.equal(M.goes(fx), true); assert.equal(M.goes(fx), false);
  assert.ok(M.inside(m, 14, 5, 0.5)); assert.ok(!M.inside(m, 16, 5, 0.5));
  // zones, as Lodestar measured them: dist < r + the body's r; a line by its distance; tiles; a box as collide feels it
  for (let seed = 1; seed <= 300; seed++) {
    const q = mulberry32(seed), x = q() * 60, y = q() * 60, r = q() * 6, cx = 30, cy = 30;
    assert.equal(harm.inZone({ r: 12 }, cx, cy, x, y, r), dist(cx, cy, x, y) < 12 + r);
    assert.equal(harm.inZone({ x0: 10, y0: 10, x1: 50, y1: 40, w: 4 }, 0, 0, x, y, r), harm.segDist(x, y, 10, 10, 50, 40) < 4 + r);
    const box = new Tycho.collide.Space().boxes([{ x0: 20, y0: 25, x1: 40, y1: 35 }]).circleHits(x, y, r);
    assert.equal(harm.inZone({ w: 20, h: 10 }, cx, cy, x, y, r), box);
    assert.equal(harm.inZone({ x0: 20, y0: 25, x1: 40, y1: 35 }, 0, 0, x, y, r), box);
    assert.equal(harm.inZone({ tiles: (a, b) => a + b > 60 }, 0, 0, x, y, r), x + y > 60);
  }
  // a beat, as Lodestar's lingering fields ticked
  const a = { every: 0.5 }, b = { every: 0.5 };
  for (let i = 0; i < 200; i++) { a.tick = (a.tick || 0) - 1 / 60; let fa = false; if (a.tick <= 0) { a.tick = a.every; fa = true; } assert.equal(harm.beat(b, 1 / 60), fa); }
  // a trap set off once, by whoever; disarmed, never
  const snare = new harm.Trigger({ zone: { w: 12, h: 4 }, once: true, hidden: true });
  const s1 = { x: 0, y: 0, by: 'vey' };
  assert.equal(snare.spring(s1, 'ana'), true); assert.equal(s1.sprungBy, 'ana'); assert.equal(snare.spring(s1, 'bo'), false);
  const wire = new harm.Trigger({ zone: { x0: 0, y0: 0, x1: 10, y1: 0, w: 1 } });
  const w1 = { armed: true };
  assert.equal(wire.spring(w1), true); assert.equal(wire.spring(w1), true);
  w1.armed = false; assert.equal(wire.spring(w1), false);
  // traps in a world of boxes, found by a body's box through Tycho.collide
  const traps = new harm.Traps((p) => ({ x0: p.x - 6, y0: p.y - 2, x1: p.x + 6, y1: p.y + 2 }));
  const t1 = traps.add({ x: 50, y: 10 }), t2 = traps.add({ x: 80, y: 10 });
  assert.equal(traps.entered(40, 0, 46, 9), t1);
  assert.equal(traps.entered(76, 0, 82, 30), t2);
  assert.equal(traps.entered(60, 0, 70, 30), null);
  t1.armed = false; assert.equal(traps.entered(40, 0, 46, 9), null);
  traps.remove(t2); assert.equal(traps.entered(76, 0, 82, 30), null);
});

// ---- moves --------------------------------------------------------------------
test('a crawler\'s lunge on a Move, as Lodestar\'s updateCrawler ran it; strikes once a swing', () => {
  const def = { windup: 0.38, lungeTime: 0.28, recover: 0.55, lungeSpeed: 145 };
  const M = new harm.Move({ windup: () => def.windup, active: () => def.lungeTime, recover: () => def.recover, names: { active: 'lunge' }, once: 'hitDone', area: { touch: 3 } });
  for (let seed = 1; seed <= 100; seed++) {
    const q = mulberry32(seed), a = { x: 0, y: 0, r: 6, state: 'circle', t: 0, hitDone: false }, b = { ...a }, p = { x: 0, y: 0 };
    const hitsA = [], hitsB = [];
    for (let i = 0; i < 400; i++) {
      p.x = 4 + q() * 30; p.y = q() * 4;
      const dt = 1 / 60;
      // Lodestar's
      a.t -= dt;
      if (a.state === 'windup') { if (a.t <= 0) { a.state = 'lunge'; a.t = def.lungeTime; a.hitDone = false; } }
      else if (a.state === 'lunge') { if (!a.hitDone && dist(a.x, a.y, p.x, p.y) < a.r + 4 + 3) { a.hitDone = true; hitsA.push(i); } if (a.t <= 0) { a.state = 'recover'; a.t = def.recover; } }
      else if (a.state === 'recover') { if (a.t <= 0) { a.state = 'circle'; a.t = 0.3; } }
      else if (a.t <= 0 && q() < 0.2) { a.state = 'windup'; a.t = def.windup; }
      // on Tycho's
      b.t -= dt;
      if (b.state === 'windup') { if (b.t <= 0) M.next(b); }
      else if (b.state === 'lunge') { if (M.hits(b, p, p.x, p.y, 4)) hitsB.push(i); if (b.t <= 0) M.next(b); }
      else if (b.state === 'recover') { if (b.t <= 0) { assert.equal(M.next(b), null); b.state = 'circle'; b.t = 0.3; } }
      else if (b.t <= 0 && a.state === 'windup') M.start(b);
      assert.deepEqual(b, a, `seed ${seed} step ${i}`);
    }
    assert.deepEqual(hitsB, hitsA);
  }
  // several targets once each a swing; phases by name; a move from a wind-up alone
  const sweep = new harm.Move({ windup: 0.1, active: 0.5, area: { r: 20 } });
  const s = { x: 0, y: 0 };
  sweep.start(s); assert.equal(sweep.phase(s), 'windup'); assert.equal(sweep.next(s), 'active'); assert.equal(s.state, 'strike');
  const t1 = {}, t2 = {};
  assert.ok(sweep.hits(s, t1, 10, 0, 2)); assert.ok(!sweep.hits(s, t1, 10, 0, 2)); assert.ok(sweep.hits(s, t2, 0, 15, 2)); assert.ok(!sweep.hits(s, {}, 30, 0, 2));
  assert.equal(sweep.next(s), null);
  const only = new harm.Move({ windup: 0.5 });
  only.start(s); assert.equal(s.state, 'windup'); assert.equal(only.next(s), null);
  assert.equal(new harm.Move({ windup: 1 }).next({ state: 'chase' }), null);
});

test('reaches: up close, round, along a line (Lodestar\'s foeSegDist), in a cone', () => {
  const segL = (px, py, x0, y0, x1, y1) => { const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, k = clamp(((px - x0) * dx + (py - y0) * dy) / L2, 0, 1); return Math.hypot(px - x0 - dx * k, py - y0 - dy * k); };
  for (let seed = 1; seed <= 2000; seed++) {
    const q = mulberry32(seed), x = q() * 40, y = q() * 40, tx = q() * 40, ty = q() * 40, a = q() * 6.3, dx = Math.cos(a), dy = Math.sin(a), reach = q() * 60;
    assert.equal(harm.segDist(tx, ty, x, y, x + dx * reach, y + dy * reach), segL(tx, ty, x, y, x + dx * reach, y + dy * reach));
    assert.equal(harm.reaches({ ahead: reach, w: 5 }, x, y, 6, dx, dy, tx, ty, 4), segL(tx, ty, x, y, x + dx * reach, y + dy * reach) < 5 + 4);
    assert.equal(harm.reaches({ touch: 3 }, x, y, 6, 0, 0, tx, ty, 4), dist(x, y, tx, ty) < 6 + 4 + 3);
    assert.equal(harm.reaches({ r: 24 }, x, y, 6, 0, 0, tx, ty, 4), dist(x, y, tx, ty) < 24 + 4);
    const m = dist(x, y, tx, ty), cone = m <= 2 || ((tx - x) * dx + (ty - y) * dy) / m >= 0.3;
    assert.equal(harm.reaches({ r: 22, cos: 0.3 }, x, y, 6, dx, dy, tx, ty, 4), m <= 22 + 4 && cone);
    assert.equal(harm.reaches({ r: 22, cos: 0.3, close: 3 }, x, y, 6, dx, dy, tx, ty, 4), m <= 6 + 4 + 3 || (m <= 22 + 4 && cone));
  }
});

// ---- means --------------------------------------------------------------------
test('means: Lodestar\'s Forms as casts, their cooldowns and charges as its spellWait and groupCost read them', () => {
  const forms = {
    arc: { cost: 3, combo: [[1, 0.24, 0.3, 90], [1, 0.24, 0.3, 90], [1.7, 0.45, -0.1, 170]] }, glaive: { cost: 6, cd: 0.4 }, bolt: { cost: 4, cd: 0.3 },
    lance: { cost: 6, cd: 0.35 }, orb: { cost: 7, cd: 0.45 }, nova: { cost: 10, cd: 0.4 }, well: { cost: 10, cd: 0.45 }, ward: { cost: 9, cd: 0.45 },
  };
  const spark = { cost: 3, cd: 0.3 }, quicken = 0.67, rig = 0.9;
  const MEANS = harm.means(Object.keys(forms).map((id) => ({ id, use: 'cast', kinds: [], move: forms[id], cost: { cooldown: forms[id].combo ? forms[id].combo.map((c) => c[1]) : forms[id].cd, charge: forms[id].cost } })).concat([{ id: 'spark', use: 'cast', kinds: ['force'], cost: { cooldown: spark.cd, charge: spark.cost } }]));
  for (const id of Object.keys(forms)) for (let step = 0; step < 7; step++) for (const n of [0, 1, 2]) for (const wrist of [1, 0.85]) {
    const F = forms[id], cdL = id === 'arc' ? F.combo[step % F.combo.length][1] : F.cd;
    assert.equal(harm.cooldown(MEANS.get(id), step) * Math.pow(quicken, n) * rig * wrist, cdL * Math.pow(quicken, n) * rig * wrist);
    assert.equal(harm.costOf(MEANS.get(id)), F.cost);
  }
  assert.equal(harm.cooldown(MEANS.get('spark')) * rig, spark.cd * rig);
  assert.equal(MEANS.of('cast').length, 9); assert.ok(MEANS.has('arc')); assert.equal(MEANS.get('sword'), undefined);
});

test('means used: a cooldown, a charge or a pool paid, a coat that lasts some blows', () => {
  const arsenal = harm.means([
    { id: 'cudgel', kinds: ['blunt'], use: 'strike', severity: 0.2, move: { windup: 0.35, active: 0.1, recover: 0.45, area: { touch: 2 } }, blow: { amount: 8, knock: { x: 120, y: 0 } } },
    { id: 'arc', kinds: ['shock'], use: 'cast', cost: { cooldown: 0.6, charge: 2 }, severity: 0.15, blow: { amount: 6, statuses: ['shock'] } },
    { id: 'glow', kinds: ['light'], use: 'cast', cost: { cooldown: 1, pool: 'light', amount: 5 } },
    { id: 'nightshade', kinds: ['poison'], use: 'dose', course: 'nightshade' },
    { id: 'venom', kinds: ['poison'], use: 'coat', uses: 3, blow: { statuses: ['poison'] } },
    { id: 'snare', kinds: ['cut'], use: 'set', severity: 0.25, trigger: { zone: { w: 12, h: 4 }, once: true, hidden: true }, blow: { amount: 5 } },
  ]);
  // (what Morgul reads of them, as declared)
  assert.deepEqual(arsenal.list.map((m) => [m.id, m.use, m.kinds[0], m.severity, m.course]).slice(3, 4), [['nightshade', 'dose', 'poison', undefined, 'nightshade']]);
  const me = { cd: 0, charge: 3 };
  assert.ok(harm.ready(me));
  assert.ok(harm.use(arsenal.get('arc'), me, { scale: 0.5 })); assert.equal(me.cd, 0.3); assert.equal(me.charge, 1);
  assert.ok(!harm.use(arsenal.get('arc'), me)); me.cd = 0;
  assert.ok(!harm.use(arsenal.get('arc'), me)); assert.equal(me.charge, 1);
  const pools = { light: 7 };
  assert.ok(harm.use(arsenal.get('glow'), me, { pools })); assert.equal(pools.light, 2); me.cd = 0;
  assert.ok(!harm.use(arsenal.get('glow'), me, { pools })); assert.equal(pools.light, 2);
  assert.ok(harm.use(arsenal.get('cudgel'), me)); assert.equal(me.cd, 0);
  harm.coat(me, arsenal.get('venom'));
  assert.deepEqual(harm.coatOf(me), { id: 'venom', uses: 3 });
  assert.deepEqual([harm.spendCoat(me), harm.spendCoat(me), harm.spendCoat(me), harm.spendCoat(me)], ['venom', 'venom', 'venom', null]);
  assert.equal(harm.coatOf(me), null);
  // a means' move and trigger are Tycho's own kinds
  const M = new harm.Move(arsenal.get('cudgel').move);
  const b = { x: 0, y: 0, r: 4 }; M.start(b); M.next(b); assert.ok(M.hits(b, 't', 9, 0, 4));
  assert.ok(new harm.Trigger(arsenal.get('snare').trigger).inside({ x: 0, y: 0 }, 5, 1, 1));
});

// ---- the player's wounds --------------------------------------------------------
test('the player\'s wounds run in phases on the game\'s clock, in plain JSON', () => {
  const W2 = new harm.Wounds([
    { id: 'sprain', phases: [{ id: 'sore', minutes: 60, has: ['limping'] }, { id: 'stiff', minutes: [600, 900] }], again: 'extend' },
    { id: 'shock', phases: [{ id: 'shaky', minutes: [20, 40], has: ['shaky'] }], has: ['jumpy'], again: 'restart' },
    { id: 'bruise', phases: [{ id: 'bruised', minutes: 30 }] },
  ]);
  const rng = new Rng(3), want = new Rng(3);
  const s = W2.fresh(100);
  assert.ok(W2.give(s, 'sprain', rng));
  assert.ok(W2.has(s, 'sprain') && W2.has(s, 'sore') && W2.has(s, 'limping') && !W2.has(s, 'shaky'));
  assert.ok(W2.give(s, 'shock', rng)); const shockFor = want.f(20, 40);
  assert.equal(s.on.shock.until, 100 + shockFor);
  assert.ok(W2.give(s, 'bruise')); assert.ok(!W2.give(s, 'bruise'));
  assert.ok(W2.has(s, 'jumpy'));
  let ev = W2.step(s, 45, rng);
  assert.deepEqual(ev, [{ id: 'shock', phase: null, healed: true, at: 100 + shockFor }, { id: 'bruise', phase: null, healed: true, at: 130 }].sort((a, b) => a.at - b.at));
  ev = W2.step(s, 30, rng); const stiff = want.f(600, 900);
  assert.deepEqual(ev, [{ id: 'sprain', phase: 'stiff', healed: false, at: 160 }]);
  assert.equal(s.on.sprain.until, 160 + stiff);
  assert.ok(!W2.has(s, 'limping') && W2.has(s, 'stiff'));
  // again: extend runs the phase on as long again
  W2.give(s, 'sprain'); assert.equal(s.on.sprain.until, 160 + 2 * stiff);
  assert.deepEqual(W2.of(s), [{ id: 'sprain', phase: 'stiff', left: 160 + 2 * stiff - 175 }]);
  // its state is plain JSON: saved and loaded, it goes on the same
  const saved = JSON.parse(JSON.stringify(s));
  const a = W2.step(s, 5000, rng), b = W2.step(saved, 5000, new Rng(0));
  assert.deepEqual(b, a); assert.deepEqual(saved, s); assert.deepEqual(s.on, {});
  W2.give(s, 'bruise'); W2.heal(s); assert.deepEqual(s.on, {});
  assert.throws(() => W2.give(s, 'stiff', rng));
  // a range of minutes is drawn from the game's rng, so it needs one
  const s2 = W2.fresh(); W2.give(s2, 'sprain');
  assert.throws(() => W2.step(s2, 100));
});
