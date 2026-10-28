// The bridge's harm (dist/tycho-minds): where Tycho.harm, the moment on
// screen, meets Morgul, what follows on screen and off. The means declared to
// both at once, a hit Tycho landed made into Morgul's harm with its
// witnesses, a fight between characters as beats in step with Bree's turns,
// a fight with the player as what a frame-level fighter should do, and traps
// handed between near (the game's triggers) and far (Morgul's chance).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as M from '../dist/tycho-minds.mjs';
import * as Tyrell from '../dist/tyrell.mjs';
import * as Tycho from '../dist/tycho.mjs';

const HOUR = 60, DAY = 1440;
const ALL = ['reverie', 'fellowship', 'wormtongue', 'mentat', 'ceres', 'cradle', 'athelas', 'bree', 'morgul'];
const events = (w, kind) => { const out = []; w.on(kind, (e) => out.push(e)); return out; };
const until = (w, cond, max, step = 1) => { for (let t = 0; t < max; t += step) { if (cond()) return true; w.advance(step); } return cond(); };

/** The game's means, declared once: Tycho.harm plays the move, the blow, the trigger; Morgul reads the rest. */
const MEANS = [
  { id: 'cudgel', kinds: ['blunt'], use: 'strike', severity: 0.2, move: { windup: 0.35, active: 0.1, recover: 0.45, area: { touch: 2 } }, blow: { amount: 8 } },
  { id: 'knife', kinds: ['cut'], use: 'strike', severity: 0.3, blow: { amount: 10 } },
  { id: 'arc', kinds: ['shock'], use: 'cast', severity: 0.15, cost: { cooldown: 0.6 }, blow: { amount: 6 } },
  { id: 'nightshade', kinds: ['poison'], use: 'dose', course: 'nightshade', severity: 0.4 },
  { id: 'snare', kinds: ['cut'], use: 'set', severity: 0.2, catch: 1, trigger: { zone: { w: 12, h: 4 }, once: true, hidden: true }, blow: { amount: 5 } },
];

/** A yard where Ana, Bo and Cy stand about all day, a barn out on the farm, homes; bruises and cuts. */
function yard(opts = {}) {
  const w = Tyrell.create({ seed: opts.seed ?? 'bridge', start: 8 * HOUR, modules: opts.modules ?? ALL,
    moduleConfig: { morgul: { might: [{ input: 'trait.strength', out: [0.5, 1.5] }], ...(opts.morgul || {}) } } });
  w.place({ id: 'yard', region: 'town' });
  w.place({ id: 'barn', region: 'farm' });
  for (const h of ['home_a', 'home_b', 'home_c']) { w.place({ id: h, region: 'town', tags: ['home'] }); w.link(h, 'yard', 3); }
  w.link('yard', 'barn', 10);
  w.action({ id: 'loiter', at: 'yard', minutes: 60, base: 0.01 });
  w.action({ id: 'potter', at: 'barn', minutes: 30, base: 0.01 });
  if (w.athelas) {
    w.athelas.course({ id: 'bruised', again: 'worsen', phases: [{ id: 'sore', minutes: 120 }, { id: 'stiff', minutes: 240, hurts: 0.5 }] });
    w.athelas.course({ id: 'cut', again: 'worsen', phases: [{ id: 'bleeding', minutes: 60 }] });
  }
  const arsenal = M.means(w, MEANS, Tycho.harm.means);
  if (w.morgul && opts.wounds !== false) {
    w.morgul.wound({ id: 'bruised', kinds: ['blunt'], course: 'bruised' });
    w.morgul.wound({ id: 'cut', kinds: ['cut', 'shock'], course: 'cut' });
  }
  const here = opts.where ?? [[0, 'yard', 'loiter']];
  w.person('ana', { name: 'Ana', home: 'home_a', place: 'yard', routine: here, traits: { temper: 0.9, courage: 0.8, strength: 1 }, inv: { cudgel: 1 } });
  w.person('bo', { name: 'Bo', home: 'home_b', place: 'yard', routine: here, traits: { temper: 0.2, courage: 0.3, strength: 0.1 } });
  w.person('cy', { name: 'Cy', home: 'home_c', place: 'yard', routine: here });
  if (w.bree) w.bree.kind({ id: 'fight', tags: ['hostile'], base: -4, weight: 0 });
  return { w, arsenal };
}

// ---------------------------------------------------------------------------
// The means
// ---------------------------------------------------------------------------

test('means: one table declared to both halves, Morgul reading its own fields and Tycho.harm the rest; a set means is a trap too', () => {
  const { w, arsenal } = yard();
  // Tycho.harm's lookup, made by the maker the game passed
  assert.ok(arsenal instanceof Tycho.harm.Arsenal);
  assert.equal(arsenal.get('cudgel').move.windup, 0.35);
  assert.deepEqual(arsenal.of('cast').map((m) => m.id), ['arc']);
  assert.equal(Tycho.harm.cooldown(arsenal.get('arc')), 0.6);
  // Morgul has every one, the same definition, its on-screen fields kept
  assert.deepEqual([...w.morgul.meansDefs.keys()], MEANS.map((m) => m.id));
  assert.equal(w.morgul.meansDefs.get('cudgel').blow.amount, 8);
  assert.equal(w.morgul.might('ana') > w.morgul.might('bo'), true, 'what Ana holds arms her');
  assert.equal(w.lang.value('armed', w.ctx(w.get('ana'))), 1);
  // the snare, set, is Morgul's trap as its trigger and catch say
  const snare = w.morgul.trapDefs.get('snare');
  assert.deepEqual(snare, { id: 'snare', hidden: true, kind: 'cut', severity: 0.2, catch: 1 });
  // declaring is all: no harm yet, so no state
  assert.equal(w.s.mod.morgul, undefined);
  // a trap the game declared itself has the last word; without a maker, a copy of the list; without Morgul, nothing declared
  const w2 = Tyrell.create({ seed: 'two', modules: ALL });
  w2.morgul.trap({ id: 'snare', kind: 'blunt', severity: 0.5 });
  const copy = M.means(w2, MEANS);
  assert.deepEqual(copy.map((m) => m.id), MEANS.map((m) => m.id));
  assert.notEqual(copy, MEANS);
  assert.equal(w2.morgul.trapDefs.get('snare').severity, 0.5);
  const bare = Tyrell.create({ seed: 'bare', modules: ['reverie'] });
  assert.equal(M.means(bare, MEANS, Tycho.harm.means).get('knife').severity, 0.3);
  assert.equal(M.means(null, MEANS).length, MEANS.length);
});

// ---------------------------------------------------------------------------
// A hit on screen, as a harm
// ---------------------------------------------------------------------------

test('harm: a hit Tycho.harm landed becomes Morgul\'s harm: the bodies\' ids, its kind, its share of the whole, what it was done with, and who saw it', () => {
  const { w, arsenal } = yard();
  const said = events(w, 'morgul:harm');
  const player = { id: 'player', x: 0, y: 0 };
  const ana = { id: 'ana', x: 10, y: 0, hp: 40, maxHp: 40 };
  const bo = { id: 'bo', x: 60, y: 4 }, cy = { id: 'cy', x: 600, y: 0 }, crab = { x: 20, y: 0, hp: 10 };
  // the game's pipeline: armor halves it, then the health bar takes it
  const hit = new Tycho.harm.Pipeline([
    Tycho.harm.armor({ k: 10, of: () => 10 }),
    (h) => { h.to.hp -= h.amount; },
  ]);
  const cudgel = arsenal.get('cudgel');
  const h = hit.land(ana, { ...cudgel.blow, kinds: cudgel.kinds, by: player, means: cudgel });
  assert.equal(h.amount, 4);
  const v = M.harm(w, h, { whole: (b) => b.maxHp, people: [player, ana, bo, cy, crab], sight: { reach: [180, 40] } });
  assert.equal(v.to, 'ana');
  assert.equal(v.by, 'player');
  assert.equal(v.kind, 'blunt');
  assert.equal(v.severity, 0.1, 'four of forty');
  assert.equal(v.what, 'cudgel');
  assert.equal(v.via, 'blow');
  assert.deepEqual(v.seenBy, ['bo'], 'Bo was in reach; Cy too far; the struck, the striker and a crab with no mind left out');
  assert.equal(v.wound, 'bruised');
  assert.equal(said.length, 1);
  assert.equal(w.morgul.hurt('ana'), 0.1);
  // with no whole, the means' severity by the share of the blow that got through
  const h2 = hit.land(bo, { ...cudgel.blow, kinds: cudgel.kinds, by: ana, severity: cudgel.severity, what: 'cudgel' });
  const v2 = M.harm(w, h2, { seenBy: ['cy'], intent: 'careless' });
  assert.equal(v2.severity, 0.1, 'half of 0.2 through the armor');
  assert.equal(v2.by, 'ana');
  assert.equal(v2.intent, 'careless');
  assert.deepEqual(v2.seenBy, ['cy']);
  // a body with no mind struck, nothing through, no Morgul: no harm
  assert.equal(M.harm(w, hit.land(crab, { amount: 4, by: player }), {}), null);
  assert.equal(M.harm(w, { to: ana, blow: { amount: 0 }, amount: 0 }, { whole: 40 }), null);
  assert.equal(M.harm(Tyrell.create({ seed: 'x', modules: ['reverie'] }), h, { whole: 40 }), null);
  assert.equal(said.length, 2);
  // it's an input: time walk replays it
  const t = w.now;
  w.advance(HOUR);
  const ahead = w.hash();
  w.advanceTo(t - 1);
  w.advanceTo(t + HOUR);
  assert.equal(w.hash(), ahead);
});

// ---------------------------------------------------------------------------
// The scuffle
// ---------------------------------------------------------------------------

test('scuffles: a fight between characters as beats in step with Bree\'s turns: they square up, who swings at whom and whether it lands, how hard, how it ends', () => {
  const { w } = yard();
  const sc = M.scuffles(w);
  const turns = events(w, 'bree:turn'), ends = events(w, 'bree:end');
  assert.deepEqual(sc.fights(), []);
  w.bree.start('fight', 'ana', 'bo');
  const beats = sc.take();
  assert.equal(beats[0].type, 'start');
  assert.deepEqual(beats[0].who, ['ana', 'bo']);
  assert.equal(beats[0].place, 'yard');
  assert.equal(beats[0].started, 'ana');
  assert.ok(beats.slice(1).every((b) => b.type !== 'start'), 'the first blow may come at once');
  if (!ends.length) {
    assert.equal(sc.fights().length, 1);
    assert.equal(sc.of('bo').id, beats[0].fight);
    assert.equal(sc.of('cy'), null);
  }
  assert.ok(until(w, () => { beats.push(...sc.take()); return ends.length > 0; }, HOUR));
  const blows = beats.filter((b) => b.type === 'blow');
  const told = turns.filter((t) => t.harm);
  assert.equal(blows.length, told.length, 'a beat a blow');
  assert.ok(blows.length >= 1);
  for (let i = 0; i < blows.length; i++) {
    const b = blows[i], t = told[i];
    assert.equal(b.swing, t.who);
    assert.equal(b.at, t.to);
    assert.equal(b.lands, t.harm.by === t.who, 'their own blow lands, or the other counters');
    assert.equal(b.hit.by, t.harm.by);
    assert.equal(b.hit.to, t.harm.to);
    assert.equal(b.hit.severity, t.harm.severity);
    assert.equal(b.hit.heavy, t.harm.severity >= 0.25);
    assert.equal(b.hit.hurt, t.harm.hurt);
    assert.equal(b.hit.harm, t.harm.id);
    if (t.harm.what) assert.equal(b.hit.what, t.harm.what);
  }
  assert.ok(blows.some((b) => b.hit.what === 'cudgel'), 'Ana swings her cudgel');
  const end = beats[beats.length - 1];
  assert.equal(end.type, 'end');
  assert.equal(end.end, ends[0].why);
  if (['down', 'yielded'].includes(ends[0].why)) assert.equal(blows[blows.length - 1].end, ends[0].why, 'the blow that ends it says so');
  if (ends[0].why === 'left') assert.equal(end.left, ends[0].left);
  assert.deepEqual(sc.fights(), [], 'over');
  assert.equal(sc.take().length, 0);
  sc.stop();
});

test('scuffles: only the fights the game keeps; what\'s going on is the world\'s, so a rewind leaves nothing stale', () => {
  const { w } = yard();
  const far = M.scuffles(w, { keep: (f) => f.place !== 'yard' });
  const near = M.scuffles(w);
  w.advance(HOUR);
  const t = w.now;
  w.bree.start('fight', 'ana', 'bo');
  w.advance(3);
  assert.equal(far.take().length, 0, 'not shown');
  assert.equal(far.fights().length, 0);
  const seen = near.take();
  assert.ok(seen.length >= 1);
  assert.equal(near.fights().length, 1);
  w.advanceTo(t - 1);
  assert.deepEqual(near.fights(), [], 'back before it started');
  assert.equal(near.take().length, 0, 'going back tells nothing');
  w.advanceTo(t + 3);
  assert.equal(near.fights().length, 1, 'and on again');
  assert.deepEqual(near.take().map((b) => [b.type, b.t, b.hit && b.hit.severity]), seen.map((b) => [b.type, b.t, b.hit && b.hit.severity]), 'the same beats again');
});

// ---------------------------------------------------------------------------
// Fights with the player
// ---------------------------------------------------------------------------

test('fighters: each answer to the player made into what the frame-level fighter does, with what they hold; the player\'s might the game\'s', () => {
  const { w, arsenal } = yard();
  let pm = 1;
  const f = M.fighters(w, { might: () => pm });
  f.sync();
  assert.equal(w.fact('might:player'), 1);
  const inputs = w.esper.size().inputs;
  f.sync();
  assert.equal(w.esper.size().inputs, inputs, 'unchanged: no input');
  assert.equal(f.means('ana').id, 'cudgel', 'she holds a cudgel');
  assert.equal(f.means('bo'), null, 'fists');
  // a look first: nothing changes
  const before = w.hash();
  const weak = f.ask('bo');
  assert.equal(w.hash(), before);
  assert.equal(weak.against, 'player');
  pm = 6;
  const strong = f.ask('bo');
  assert.equal(w.fact('might:player'), 6);
  assert.ok(strong.odds < weak.odds, 'a mightier player, worse odds');
  // the player strikes: Bo answers as the fight starts, and again after each blow
  const player = { id: 'player', x: 0, y: 0 }, bo = { id: 'bo', x: 8, y: 0 };
  const swing = (amount) => M.harm(w, { to: bo, blow: { amount, kinds: ['blunt'], by: player }, amount }, { whole: 20 });
  swing(4);
  const a = f.take();
  assert.equal(a.length, 1);
  assert.equal(a[0].id, 'bo');
  assert.equal(a[0].start, true);
  assert.ok(['fight', 'flee', 'yield', 'help'].includes(a[0].act));
  assert.equal(a[0].means, null);
  assert.deepEqual(f.plan('bo'), a[0]);
  w.advance(2);
  swing(6);
  const b = f.take();
  assert.equal(b.length, 1);
  assert.equal(b[0].start, false);
  assert.equal(f.plan('bo').t, w.now);
  assert.equal(f.plan('ana'), null, 'nobody struck her');
  // a while after the last blow, the fight's over
  w.advance(31);
  assert.equal(f.plan('bo'), null);
  // and a hit on the player from a character makes them answer too
  const ana = { id: 'ana', x: 4, y: 0 };
  M.harm(w, { to: player, blow: { amount: 3, kinds: ['blunt'], by: ana, means: arsenal.get('cudgel') }, amount: 3 }, { whole: 30 });
  const c = f.take();
  assert.equal(c.length, 1);
  assert.equal(c[0].id, 'ana');
  assert.equal(c[0].means.id, 'cudgel');
  f.stop();
});

// ---------------------------------------------------------------------------
// Traps near and far
// ---------------------------------------------------------------------------

test('traps: the regions the game has loaded are near; their traps are the game\'s triggers, made and dropped as they come and go; a trigger that springs is reported back', () => {
  const { w } = yard({ where: [[0, 'barn', 'potter']] });
  const made = [], dropped = [];
  let regions = ['farm'];
  const T = M.traps(w, { regions: () => regions, make: (t) => { made.push(t.id); return new Tycho.harm.Trigger(t.means.trigger); }, drop: (t) => dropped.push(t.id) });
  // nothing set yet, and no harm: the near regions still recorded (traps are declared), once
  let s = T.sync();
  assert.deepEqual(s, { add: [], drop: [] });
  assert.deepEqual(w.s.mod.morgul.near, ['farm']);
  const inputs = w.esper.size().inputs;
  T.sync();
  assert.equal(w.esper.size().inputs, inputs, 'unchanged: no input');
  // Cy sets a snare in the barn, for Bo
  const id = T.set('snare', { by: 'cy', place: 'barn', for: 'bo', seenBy: [] });
  s = T.sync();
  assert.equal(s.add.length, 1);
  assert.equal(s.add[0].id, id);
  assert.equal(s.add[0].kind, 'snare');
  assert.equal(s.add[0].for, 'bo');
  assert.equal(s.add[0].means.id, 'snare');
  assert.ok(T.get(id).obj instanceof Tycho.harm.Trigger, 'the game\'s own trigger, from the means');
  assert.ok(T.get(id).obj.inside({ x: 0, y: 0 }, 2, 1, 1));
  assert.deepEqual(made, [id]);
  assert.equal(T.sync().add.length, 0, 'kept');
  // near: Morgul doesn't spring it off screen, however long Bo potters there
  const sprung = events(w, 'morgul:sprung');
  w.advance(4 * HOUR);
  assert.equal(sprung.length, 0);
  assert.equal(w.morgul.traps().length, 1);
  // on screen, Bo walks into it: the trigger springs and the bridge reports it
  assert.equal(T.get(id).obj.spring(T.get(id).obj), true);
  T.spring(id, 'bo', ['ana']);
  assert.equal(sprung.length, 1);
  assert.equal(sprung[0].id, 'bo');
  assert.ok(w.morgul.hurt('bo') > 0);
  s = T.sync();
  assert.deepEqual(s.drop.map((t) => t.id), [id], 'spent: let go');
  assert.deepEqual(dropped, [id]);
  assert.equal(T.list().length, 0);
});

test('traps: the player springs one too; and a trap no longer near is Morgul\'s again, off screen', () => {
  const { w } = yard({ where: [[0, 'barn', 'potter']] });
  let regions = ['farm'];
  const T = M.traps(w, { regions: () => regions });
  const answers = events(w, 'morgul:respond'), harms = events(w, 'morgul:harm');
  const a = T.set('snare', { by: 'cy', place: 'barn', seenBy: [] });
  T.sync();
  // the player steps in it: a harm to the player, the trap spent, and Cy (far off) doesn't answer as if in a fight
  T.spring(a, 'player');
  assert.equal(harms.length, 1);
  assert.equal(harms[0].to, 'player');
  assert.equal(harms[0].by, 'cy');
  assert.equal(harms[0].via, 'trap');
  assert.equal(answers.length, 0);
  assert.equal(w.morgul.traps().length, 0);
  assert.equal(T.sync().drop.length, 1);
  // another, then the player goes to town: no longer near, Morgul's own chance catches whoever potters there
  const b = T.set('snare', { by: 'cy', place: 'barn', seenBy: [] });
  T.sync();
  assert.ok(T.get(b));
  regions = ['town'];
  const s = T.sync();
  assert.deepEqual(w.s.mod.morgul.near, ['town']);
  assert.deepEqual(s.drop.map((t) => t.id), [b]);
  assert.ok(until(w, () => w.morgul.traps().length === 0, DAY, 10), 'caught off screen');
  assert.ok(harms.some((h) => h.cause === b && h.via === 'trap'));
  // a world with no traps declared: nothing sent
  const plain = Tyrell.create({ seed: 'plain', modules: ALL });
  M.traps(plain, { regions: () => ['farm'] }).sync();
  assert.equal(plain.s.mod.morgul, undefined);
  assert.equal(plain.esper.size().inputs, 0);
});

test('loaded as a script after the engine, Tycho.minds has the harm helpers', () => {
  const page = { Tycho: {} };
  vm.runInNewContext(readFileSync(new URL('../dist/tycho-minds.js', import.meta.url), 'utf8'), page);
  for (const k of ['means', 'harm', 'might', 'scuffles', 'fighters', 'traps']) assert.equal(typeof page.Tycho.minds[k], 'function', k);
});
