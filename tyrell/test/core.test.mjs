// The core: needs, actions, places, the layered stack, the pick, travel,
// slots, hours, bodies and the plain-script build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { Tyrell, tiny, until, HOUR, DAY } from './helpers.mjs';

test('the plain-script build defines one global, Tyrell', () => {
  const code = readFileSync(new URL('../dist/tyrell.js', import.meta.url), 'utf8');
  const ctx = { console, performance, setTimeout };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  assert.equal(typeof ctx.Tyrell, 'object');
  assert.equal(typeof ctx.Tyrell.create, 'function');
  const w = ctx.Tyrell.create({ seed: 'vm' });
  w.need({ id: 'hunger', rise: 0.1 });
  w.place({ id: 'home' });
  w.action({ id: 'eat', at: 'home', minutes: 10, relieves: { hunger: 0.5 } });
  w.person('a', { home: 'home' });
  w.advance(5 * HOUR);
  assert.ok(w.westmarch.find({ k: 'started' }).length > 0);
});

test('needs rise by the hour and actions relieve them', () => {
  const w = tiny();
  const p = w.person('ana', { home: 'home_a', needs: { hunger: 0.2 } });
  assert.equal(w.needOf('ana', 'hunger'), 0.2);
  w.mind.setLevel(p, 'hunger', 0.9);
  assert.ok(until(w, () => p.doing?.action === 'eat' && p.doing.kind === 'act'));
  const before = w.needOf('ana', 'hunger');
  assert.ok(until(w, () => p.last === 'eat'));
  assert.ok(w.needOf('ana', 'hunger') < before - 0.3, 'eating brought hunger down');
});

test('people walk to where an action is, taking the travel time', () => {
  const w = tiny();
  const p = w.person('ana', { home: 'home_a', needs: { hunger: 0.95 } });
  w.advance(1);
  assert.equal(p.doing.kind, 'travel');
  const to = p.doing.to;
  assert.ok(to === 'cafe' || to === 'diner');
  const minutes = w.ring.travel('home_a', to);
  assert.equal(Math.round(p.doing.end - p.doing.start), minutes);
  w.advance(minutes + 1);
  assert.equal(p.place, to);
  assert.equal(p.doing.action, 'eat');
});

test('a full place sends people elsewhere', () => {
  const w = tiny();
  const ids = ['a', 'b', 'c', 'd', 'e'];
  for (const id of ids) w.person(id, { home: 'home_a', needs: { hunger: 0.95 } });
  w.advance(15);
  const atCafe = ids.filter((id) => w.get(id).place === 'cafe' && w.get(id).doing?.action === 'eat');
  assert.ok(atCafe.length <= 3, `at most three seats (${atCafe.length})`);
  assert.equal(w.ring.holders('cafe', 'seat').length, atCafe.length);
  const elsewhere = ids.filter((id) => !atCafe.includes(id));
  assert.ok(elsewhere.some((id) => { const d = w.get(id).doing; return d && (d.to === 'diner' || d.place === 'diner'); }), 'someone went to the diner');
});

test('closed places are ruled out, and the reason is given', () => {
  const w = tiny({ start: 23 * HOUR });
  const p = w.person('ana', { home: 'home_a', needs: { hunger: 0.95 } });
  w.advance(1);
  assert.notEqual(p.doing?.to, 'cafe');
  const cafe = w.mind.explain(p, 'eat').find((c) => c.place === 'cafe');
  assert.equal(cafe.blocked, 'cafe is closed then');
  w.fact('closed:diner', true);
  assert.match(w.whyNot('ana', 'eat'), /closed|doing it now/);
});

test('a routine is required at its hours; free time is not', () => {
  const w = tiny({ start: 6 * HOUR });
  const p = w.person('ana', { home: 'home_a', routine: [[7, null, '*'], [12, 'cafe', 'eat'], [13, null, '*'], [22, 'home', 'sleep']] });
  w.advanceTo(12 * HOUR + 15);
  assert.equal(p.doing?.action, 'eat');
  assert.equal(p.doing.layer, 'routine');
  // routine choices fill the entry: eating until 13:00
  assert.equal(p.doing.end, 13 * HOUR);
  w.advanceTo(22 * HOUR + 15);
  assert.equal(p.doing?.action, 'sleep');
});

test('routine variants: the first that fits the day', () => {
  const w = tiny({ start: 6 * HOUR });
  const p = w.person('ana', {
    home: 'home_a',
    routine: [
      { when: ['fact:holiday'], plan: [[7, 'park', 'stroll'], [22, 'home', 'sleep']] },
      { plan: [[7, 'home', 'loaf'], [22, 'home', 'sleep']] },
    ],
  });
  w.advanceTo(8 * HOUR);
  assert.equal(p.doing?.action, 'loaf');
  w.fact('holiday', true);
  w.direct('ana', null); // a nudge to think again
  w.advance(20);
  assert.equal(p.doing?.action === 'stroll' || p.doing?.to === 'park', true);
});

test('a job outranks a routine; a directive outranks a job', () => {
  const w = tiny({ start: 8 * HOUR });
  w.action({ id: 'work', at: 'cafe', minutes: 60, job: 'cook', rank: -1, pose: 'work' });
  const p = w.person('ana', { home: 'home_a', job: { id: 'cook', place: 'cafe', action: 'work', shifts: [[9, 17]] }, routine: [[7, 'home', 'loaf']] });
  w.advanceTo(9 * HOUR + 30);
  assert.equal(p.doing?.action, 'work');
  assert.equal(p.doing.layer, 'job');
  w.direct('ana', { do: 'stroll', at: 'park', until: 11 * HOUR });
  w.advance(10);
  assert.equal(p.doing?.layer, 'story');
  w.advanceTo(11 * HOUR + 30);
  assert.equal(p.doing?.action, 'work', 'back to work after the directive');
});

test('an urgent need breaks through a routine, a desperate one through work', () => {
  const w = tiny({ start: 8 * HOUR });
  const p = w.person('ana', { home: 'home_a', routine: [[7, 'home', 'loaf'], [22, 'home', 'sleep']], needs: { hunger: 0.3 } });
  w.advance(5);
  assert.equal(p.doing.action, 'loaf');
  w.mind.setLevel(p, 'hunger', 0.9);
  w.clock.reconsider(p, 'urge');
  assert.ok(p.doing.action === 'eat' || p.doing.kind === 'travel', 'urgent hunger beat the routine');
  assert.equal(p.doing.rank, w.config.urgentRank);
});

test('urgent checks are scheduled: hunger wakes people without any nudge', () => {
  const w = tiny({ start: 8 * HOUR });
  const p = w.person('ana', { home: 'home_a', routine: [[7, 'home', 'loaf'], [23, 'home', 'sleep']], needs: { hunger: 0.6 } });
  assert.ok(until(w, () => p.doing?.layer === 'need' && (p.doing.action === 'eat'), 10 * HOUR));
});

test('the pick is the top rank; options under the cut are dropped', () => {
  const w = tiny();
  const p = w.person('ana', { home: 'home_a', needs: { hunger: 0.6 } });
  w.advance(1);
  const d = w.why('ana');
  assert.ok(d && d.picked);
  const valid = d.candidates.filter((c) => !c.blocked);
  const top = Math.max(...valid.map((c) => c.rank));
  assert.equal(d.picked.rank, top);
  assert.ok(d.picked.parts[0][0] === 'base');
});

test('bodies: focus hands out bodies and takes them back; steps are announced', () => {
  const w = tiny();
  const events = [];
  for (const k of ['embody', 'disembody', 'step']) w.on(k, (b) => events.push([k, b.id, b.action ?? '']));
  w.person('ana', { home: 'home_a', needs: { hunger: 0.95 } });
  w.focus(['main']);
  w.advance(1); // ana is walking from homes to main: near (the walk touches main)
  assert.ok(events.some(([k, id]) => k === 'embody' && id === 'ana'));
  const b = w.body('ana');
  assert.equal(b.pose, 'walk');
  assert.ok(['cafe', 'diner'].includes(b.travel.to));
  w.focus(['homes']);
  w.advance(40); // she's arrived in main by now, out of view
  assert.ok(events.some(([k, id]) => k === 'disembody' && id === 'ana'));
});

test('the same arrival time whether watched or not', () => {
  const a = tiny(), b = tiny();
  a.person('ana', { home: 'home_a', needs: { hunger: 0.95 } });
  b.person('ana', { home: 'home_a', needs: { hunger: 0.95 } });
  a.focus(['main', 'homes']);
  for (let i = 0; i < 200; i++) { a.tick(1); b.advance(1); }
  assert.equal(a.hash(), b.hash());
});

test('a body that fails sends the person back to think', () => {
  const w = tiny();
  const p = w.person('ana', { home: 'home_a', needs: { hunger: 0.95 } });
  w.advance(1);
  assert.equal(p.doing.kind, 'travel');
  w.report('ana', 'failed', 'a car in the way');
  assert.ok(w.westmarch.find({ k: 'failed', who: 'ana' }).length === 1);
  assert.ok(p.doing);
});

test('a failure backs off: what failed is ruled out at that place for a while', () => {
  const w = tiny();
  const p = w.person('ana', { home: 'home_a', needs: { hunger: 0.95 } });
  w.focus(['main', 'homes']);
  let reports = 0;
  // a body that can never get through the door of anywhere that serves food
  w.on('step', (b) => { if (b.id === 'ana' && b.next === 'eat' && reports < 200) { reports++; w.report('ana', 'failed', 'the door stuck'); } });
  w.advance(1);
  assert.ok(reports <= 2, `failed ${reports} times in a row`); // the cafe and the diner, once each
  assert.match(w.whyNot('ana', 'eat'), /failed recently/);
  w.advance(w.config.backoff + 1);
  assert.doesNotMatch(w.whyNot('ana', 'eat'), /failed recently/, 'and after a while it can be tried again');
  void p;
});

test('failing in a loop stops: someone who fails again and again at one moment rests', () => {
  const w = tiny();
  const p = w.person('ana', { home: 'home_a', needs: { hunger: 0.95 } });
  w.focus(['main', 'homes']);
  let reports = 0;
  // a body that fails at everything
  w.on('step', (b) => { if (b.id === 'ana' && reports < 500) { reports++; w.report('ana', 'failed', 'nothing works'); } });
  w.advance(1);
  assert.ok(reports < 20, `failed ${reports} times at one moment`);
  assert.equal(p.doing?.kind, 'wait');
});

test('travel uses the shell when there is one', () => {
  const w = Tyrell.create({ seed: 's', shell: { travel: (a, b) => (a === b ? 0 : 42) } });
  w.need({ id: 'hunger', rise: 0.1 });
  w.place({ id: 'a' }); w.place({ id: 'b', tags: ['food'] });
  w.action({ id: 'eat', at: 'tag:food', minutes: 10, relieves: { hunger: 0.6 } });
  const p = w.person('x', { place: 'a', needs: { hunger: 0.9 } });
  w.advance(1);
  assert.equal(p.doing.kind, 'travel');
  assert.equal(p.doing.end - p.doing.start, 42);
});

test('places inside places: travel between them is free, closing the outer closes the inner', () => {
  const w = tiny();
  w.place({ id: 'cafe_counter', in: 'cafe', tags: ['till'] });
  assert.equal(w.ring.travel('cafe', 'cafe_counter'), 0);
  assert.equal(w.ring.region('cafe_counter'), 'main');
  w.fact('closed:cafe', true);
  assert.equal(w.ring.open('cafe_counter', 12 * HOUR), false);
});

test('the condition language: terms, comparisons, negation, effects', () => {
  const w = tiny();
  const p = w.person('ana', { home: 'home_a', vars: { money: 10 }, inv: { radio: 1 }, traits: { thrift: 0.8 } });
  const ctx = w.ctx(p);
  assert.ok(w.lang.test('money>=10', ctx));
  assert.ok(w.lang.test('!money>10', ctx));
  assert.ok(w.lang.test('has:radio', ctx));
  assert.ok(w.lang.test('trait.thrift>0.5', ctx));
  assert.ok(w.lang.test('at:home', ctx));
  assert.ok(w.lang.test('!fact:raining', ctx));
  w.lang.apply('money-=4', ctx);
  w.lang.apply('give:apple*3', ctx);
  w.lang.apply('take:radio', ctx);
  w.lang.apply('fact:raining=true', ctx);
  assert.equal(p.vars.money, 6);
  assert.equal(p.inv.apple, 3);
  assert.equal(p.inv.radio, undefined);
  assert.ok(w.lang.test('fact:raining', ctx));
  w.term('lucky', () => 7);
  assert.ok(w.lang.test('lucky==7', ctx));
});

test('considerations: curves, ranges, outputs and compensation', () => {
  const w = tiny();
  const p = w.person('ana', { home: 'home_a', traits: { courage: 0.25 } });
  const ctx = w.ctx(p);
  assert.equal(w.mind.consider({ input: 'trait.courage' }, ctx), 0.25);
  assert.equal(w.mind.consider({ input: 'trait.courage', curve: 'inverse' }, ctx), 0.75);
  assert.equal(w.mind.consider({ input: 'trait.courage', out: [1, 3] }, ctx), 1.5);
  assert.equal(w.mind.consider({ input: 'trait.courage', curve: [[0, 0], [0.5, 1], [1, 1]] }, ctx), 0.5);
  assert.equal(w.mind.consider({ input: 'travel', range: [0, 60], curve: 'inverse' }, ctx, 30), 0.5);
  assert.equal(Tyrell.curveAt('step', 0.6), 1);
});

test('habits learn from how things went, and rewards nudge them', () => {
  const w = tiny();
  const p = w.person('ana', { home: 'home_a' });
  assert.equal(w.mind.habit(p, 'eat'), 1);
  w.reward('ana', 'eat', 0.5);
  assert.ok(w.mind.habit(p, 'eat') > 1.1);
  w.reward('ana', 'stroll', -0.5);
  assert.ok(w.mind.habit(p, 'stroll') < 0.9);
});

test('waking from nothing: idle people wait and think again', () => {
  const w = Tyrell.create({ seed: 'idle' });
  w.place({ id: 'void' });
  const p = w.person('x', { place: 'void' });
  w.advance(5);
  assert.equal(p.doing.layer, 'idle');
  w.advance(60);
  assert.ok(w.westmarch.find({ k: 'started', who: 'x' }).length === 0);
  assert.ok(p.doing);
});

test('followers walk and sit with their leader', () => {
  const w = tiny();
  const a = w.person('ana', { home: 'home_a', needs: { hunger: 0.2 } });
  const b = w.person('bo', { home: 'home_a', needs: { hunger: 0.2 } });
  w.follow('bo', 'ana');
  w.mind.setLevel(a, 'hunger', 0.95);
  w.clock.rethink(a, 'test');
  assert.equal(b.doing?.kind, a.doing?.kind);
  assert.equal(b.doing?.to, a.doing?.to);
  assert.equal(b.doing?.end, a.doing?.end);
});

test('away and back: dormant people return with a summary', () => {
  const w = tiny();
  const p = w.person('ana', { home: 'home_a' });
  const back = [];
  w.on('back', (e) => back.push(e));
  w.away('ana', w.now + 2 * DAY, 'visiting her sister');
  assert.equal(p.status, 'away');
  w.advance(DAY);
  assert.equal(p.status, 'away');
  w.advance(DAY + 10);
  assert.equal(p.status, 'active');
  assert.equal(back[0].summary, 'visiting her sister');
});

test('remove: gone for good, slots let go', () => {
  const w = tiny();
  const p = w.person('ana', { home: 'home_a', needs: { hunger: 0.95 } });
  until(w, () => p.doing?.action === 'eat' && p.doing.kind === 'act');
  const place = p.place;
  assert.equal(w.ring.holders(place, 'seat').includes('ana'), true);
  w.remove('ana', 'moved away');
  assert.equal(p.status, 'gone');
  assert.equal(w.ring.holders(place, 'seat').includes('ana'), false);
});

test('timers call the game back', () => {
  const w = tiny();
  const got = [];
  w.on('timer:bell', (e) => got.push(e.t));
  w.at(w.now + 30, 'bell');
  w.advance(29);
  assert.equal(got.length, 0);
  w.advance(2);
  assert.equal(got.length, 1);
});

test('strangers: the same passers-by from the seed, and one can be promoted', () => {
  const w = tiny({ start: 12 * HOUR });
  w.strangers.define('main', { perHour: 6, errands: [{ from: 'park', to: 'cafe', action: 'eat', minutes: [10, 30] }] });
  const a = w.strangers.at('main');
  const b = w.strangers.at('main');
  assert.ok(a.length > 0);
  assert.deepEqual(a.map((s) => s.id), b.map((s) => s.id));
  const id = w.strangers.promote(a[0].id, { name: 'A stranger' });
  assert.equal(w.get(id).name, 'A stranger');
  assert.equal(w.strangers.at('main').some((s) => s.id === a[0].id), false);
});

test('a big city stays fast: 150 people for a day', () => {
  const w = tiny();
  for (let i = 0; i < 150; i++) w.person('p' + i, { home: i % 2 ? 'home_a' : 'home_b', needs: { hunger: (i % 10) / 10 } });
  const t0 = Date.now();
  w.advance(DAY);
  const ms = Date.now() - t0;
  assert.ok(ms < 8000, `a day for 150 people took ${ms} ms`);
});
