// Esper (time walk), determinism and saving.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tyrell, rocinante, tiny, HOUR, DAY } from './helpers.mjs';

test('the same seed and the same calls give the same world', () => {
  const a = rocinante({ seed: 'same' }), b = rocinante({ seed: 'same' });
  a.advance(DAY); b.advance(DAY);
  assert.equal(a.hash(), b.hash());
  const c = rocinante({ seed: 'other' });
  c.advance(DAY);
  assert.notEqual(a.hash(), c.hash());
});

test('ticking by frames gives the same world as one big jump', () => {
  const a = rocinante(), b = rocinante();
  a.config.minutesPerSecond = 10;
  for (let i = 0; i < 36 * 6; i++) a.tick(1 / 6); // 6 hours at 10 game minutes a second
  b.advance(6 * HOUR);
  a.advanceTo(b.now); // catch up anything a frame budget left over
  assert.equal(Math.round(a.now), Math.round(b.now));
  assert.equal(a.hash(), b.hash());
});

test('speed: faster, paused', () => {
  const w = rocinante();
  w.config.budgetMs = Infinity; // the frame budget reads the wall clock: a slow first frame would stop short
  const t0 = w.now;
  w.speed = 4;
  w.tick(1);
  assert.equal(w.now - t0, 4);
  w.speed = 0;
  w.tick(1);
  assert.equal(w.now - t0, 4);
});

test('rewind: back to an earlier moment exactly, and forward again to the same present', () => {
  const w = rocinante();
  w.advance(5 * HOUR);
  const mid = w.now, midHash = w.hash();
  w.advance(7 * HOUR);
  const endHash = w.hash(), end = w.now;
  w.seek(mid);
  assert.equal(w.now, mid);
  assert.equal(w.hash(), midHash, 'the past is exactly as it was');
  w.seek(end);
  assert.equal(w.hash(), endHash, 'and so is the present');
});

test('rewind between snapshots lands on the exact minute', () => {
  const w = rocinante();
  w.advance(3 * HOUR);
  const ref = rocinante();
  ref.advance(2 * HOUR + 7);
  w.seek(ref.now);
  assert.equal(w.hash(), ref.hash());
});

test('inputs from the game replay after a rewind', () => {
  const w = rocinante();
  w.advance(2 * HOUR);
  w.fact('raining', true);
  w.did('player', 'fixed', { for: 'ruth', what: 'radio' });
  w.sense({ kind: 'strip', actor: 'player', place: 'market', seenBy: ['dev'] });
  w.advance(3 * HOUR);
  const h = w.hash();
  w.rewind(4 * HOUR);
  assert.equal(w.fact('raining'), undefined, 'before the rain');
  w.advance(4 * HOUR);
  assert.equal(w.fact('raining'), true, 'the rain came again');
  assert.equal(w.hash(), h);
});

test('a new input in the past starts a new timeline (branch)', () => {
  const w = rocinante();
  w.advance(4 * HOUR);
  const branches = [];
  w.on('branch', (e) => branches.push(e));
  w.fact('raining', true);
  w.advance(2 * HOUR);
  w.rewind(HOUR);
  w.fact('festival', true);
  assert.equal(branches.length, 1);
  w.advance(3 * HOUR);
  assert.equal(w.fact('raining'), true, 'the rain was before the branch point, so it stays');
  assert.equal(w.fact('festival'), true);
  const [, latest] = w.esper.span();
  assert.equal(latest, w.now);
});

test('reverse playback: a negative speed plays history backward', () => {
  const w = rocinante();
  w.advance(4 * HOUR);
  const t = w.now;
  w.speed = -60; // an hour back per second
  w.tick(1);
  assert.equal(w.now, t - 60);
  w.tick(0.5);
  assert.equal(w.now, t - 90);
  w.speed = 1;
  w.tick(1);
  assert.equal(w.now, t - 89);
});

test('reverse playback stops at the start of history', () => {
  const w = rocinante();
  const start = w.now;
  w.advance(HOUR);
  const events = [];
  w.on('esper:start', (e) => events.push(e));
  w.speed = -600;
  w.tick(1);
  assert.equal(w.now, start);
  w.tick(1);
  assert.equal(w.speed, 0);
  assert.equal(events.length, 1);
});

test('marks: name a moment and come back to it', () => {
  const w = rocinante();
  w.advance(HOUR);
  w.esper.mark('before');
  const h = w.hash();
  w.advance(3 * HOUR);
  assert.ok(w.esper.seekMark('before'));
  assert.equal(w.hash(), h);
});

test('history is bounded: old snapshots go, the rest thin out', () => {
  const w = rocinante({ esper: { keep: 6 * HOUR, every: 15, sparseAfter: 2 * HOUR, sparseEvery: 60 } });
  w.advance(DAY);
  const [from] = w.esper.span();
  assert.ok(w.now - from <= 6 * HOUR + 15, `kept ${w.now - from} minutes`);
  const { snapshots } = w.esper.size();
  assert.ok(snapshots <= 6 + 8 + 2, `${snapshots} snapshots`);
});

test('with time walk off, nothing is recorded', () => {
  const w = rocinante({ esper: { on: false } });
  w.advance(2 * HOUR);
  assert.equal(w.esper.size().snapshots, 0);
  const t = w.now;
  w.seek(t - HOUR);
  assert.equal(w.now, t, "can't go back");
});

test('bodies are refreshed after a rewind', () => {
  const w = rocinante();
  w.focus(['main']);
  w.advance(9 * HOUR); // the middle of the day: people about in main
  const events = [];
  w.on('seek', (e) => events.push(['seek', e.to]));
  w.on('embody', (b) => events.push(['embody', b.id]));
  w.on('disembody', (b) => events.push(['disembody', b.id]));
  w.rewind(4 * HOUR);
  assert.ok(events.some(([k]) => k === 'seek'));
  assert.deepEqual(w.bodies().map((b) => b.id).sort(), w.people().filter((p) => w.clock.isNear(p)).map((p) => p.id).sort());
});

test('calls made inside a listener replay at the same point', () => {
  // a game that reports a failure the moment a body starts walking to the bar
  const run = () => {
    const w = rocinante();
    w.focus(['main', 'blocks', 'river']);
    let n = 0;
    w.on('step', (b) => { if (b.action === 'travel' && b.travel.to === 'bar' && n < 3) { n++; w.report(b.id, 'failed', 'the door stuck'); } });
    w.advance(20 * HOUR);
    return w;
  };
  const w = run();
  const h = w.hash();
  w.rewind(16 * HOUR);
  w.advance(16 * HOUR);
  assert.equal(w.hash(), h);
  assert.equal(run().hash(), h);
});

test('loading or seeking from a listener waits until the running call returns', () => {
  // a time loop: at dusk, back to dawn
  const w = rocinante();
  const dawn = w.save();
  w.at(w.now + 3 * HOUR, 'dusk');
  let loops = 0;
  w.on('timer:dusk', () => { loops++; w.load(dawn); });
  w.advance(4 * HOUR);
  assert.equal(loops, 1);
  const ref = rocinante();
  assert.equal(w.now, ref.now, 'back at dawn');
  assert.equal(w.hash(), ref.hash());
  w.advance(2 * HOUR); ref.advance(2 * HOUR);
  assert.equal(w.hash(), ref.hash(), 'and the clock runs on as from a fresh dawn');
  // a rewind from a listener
  const a = rocinante(), b = rocinante();
  for (const x of [a, b]) { x.advance(2 * HOUR); x.at(x.now + HOUR, 'bell'); }
  const back = a.now;
  a.on('timer:bell', () => a.seek(back));
  a.advance(2 * HOUR); b.advance(2 * HOUR);
  b.seek(back);
  assert.equal(a.now, back);
  assert.equal(a.hash(), b.hash());
});

test('save and load: the same world, and it runs on the same', () => {
  const a = rocinante();
  a.advance(DAY + 3 * HOUR);
  const saved = JSON.stringify(a.save());
  const b = rocinante();
  b.load(saved);
  assert.equal(b.hash(), a.hash());
  a.advance(DAY); b.advance(DAY);
  assert.equal(b.hash(), a.hash());
});

test('the same save loaded twice gives the same world twice (a time loop)', () => {
  const w = rocinante();
  const dawn = w.save(true);
  w.load(dawn);
  w.advance(3 * HOUR);
  const h = w.hash();
  w.load(dawn);
  assert.equal(w.now, rocinante().now, 'the save was left as it was');
  w.advance(3 * HOUR);
  assert.equal(w.hash(), h);
});

test('a save can keep its history, so a loaded world can still rewind', () => {
  const a = rocinante();
  a.advance(6 * HOUR);
  const mid = a.now - 2 * HOUR;
  const saved = JSON.stringify(a.save(true));
  const b = rocinante();
  b.load(saved);
  b.seek(mid);
  a.seek(mid);
  assert.equal(b.hash(), a.hash());
});

test('saves migrate forward and refuse the future', () => {
  const w = tiny();
  const data = w.save();
  data.v = Tyrell.SCHEMA + 1;
  assert.throws(() => tiny().load(data), /newer/);
  Tyrell.MIGRATIONS[0] = (s) => ({ ...s, v: 1 });
  const old = w.save();
  old.v = 0;
  tiny().load(old);
  delete Tyrell.MIGRATIONS[0];
});

test('recall, silence, resolve, attract, draw and log from the game are inputs: a rewind replays them', () => {
  const w = rocinante();
  w.reverie.memoryKind({ id: 'betrayed', importance: 9, shifts: { trust: -0.2 } });
  w.gaff.deck('d', ['a', 'b', 'c']);
  w.advance(HOUR);
  w.reverie.remember('kofi', { k: 'betrayed', about: 'sam' });
  for (let i = 0; i < 10; i++) assert.equal(w.reverie.recall('kofi', { about: 'sam' }).length, 1);
  w.reverie.believe('ruth', 'secret:x', true, 'saw');
  w.reverie.silence('ruth', 'secret:x');
  assert.equal(typeof w.cityspeak.resolve('chat', 'ruth', 'kofi'), 'boolean');
  w.fellowship.attract('ruth', 'kofi', 0.2);
  assert.ok(['a', 'b', 'c'].includes(w.gaff.draw('d')));
  w.log('note', 'kofi', { said: 'hello' });
  w.advance(HOUR);
  const h = w.hash();
  w.rewind(90); // back before all of it
  w.advance(90);
  assert.equal(w.hash(), h);
});

test('reading changes nothing: relationships, intensity, strangers', () => {
  const w = rocinante();
  w.strangers.define('main', { perHour: 4, errands: [{ from: 'park', to: 'market', minutes: 10 }] });
  w.advance(HOUR);
  const h = w.hash();
  assert.equal(w.fellowship.rel('ruth', 'nobody'), undefined);
  assert.equal(w.gaff.phase('docks'), 'build');
  assert.equal(w.gaff.intensity('docks'), 0);
  w.strangers.at('main');
  assert.equal(w.hash(), h);
});

test('keep: the game\'s own state rewinds with the world', () => {
  const w = rocinante();
  w.advance(HOUR);
  w.keep('tills', { stripped: ['ueda'] });
  w.advance(2 * HOUR);
  w.keep('tills', { stripped: ['ueda', 'mo'] });
  w.advance(HOUR);
  w.rewind(2 * HOUR);
  assert.deepEqual(w.kept('tills'), { stripped: ['ueda'] });
});
