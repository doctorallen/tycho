// Bicameral's pastimes that pall with repetition, and wishes (and dreams)
// that pull people toward what would grant them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tyrell, tiny, until, HOUR, DAY } from './helpers.mjs';

const part = (c, name) => c.parts.find(([n]) => n.startsWith(name))?.[1];

test('a pastime palls with each go, for every action of its kind, and recovers by the hour', () => {
  const w = tiny();
  w.pastime({ id: 'drink', label: 'the ale' });
  w.action({ id: 'ale', at: 'cafe', minutes: 30, base: 0.3, palls: 'drink' });
  w.action({ id: 'cider', at: 'cafe', minutes: 30, base: 0.3, palls: 'drink' });
  w.action({ id: 'darts', at: 'cafe', minutes: 30, base: 0.3, palls: true });
  w.person('ana', { home: 'home_a', place: 'cafe', needs: { hunger: 0, energy: 0 } });
  const p = w.get('ana');
  const fresh = w.mind.explain(p, 'cider')[0].weight;
  w.direct('ana', { do: 'ale' });
  until(w, () => p.last === 'ale', HOUR, 1);
  w.away('ana', w.now + 6 * HOUR);
  assert.ok(Math.abs(w.mind.tolerance(p, 'drink') - 0.35) < 0.01);
  const after = w.mind.explain(p, 'cider')[0];
  assert.ok(Math.abs(part(after, 'had enough of the ale') - (1 - 0.6 * 0.35)) < 0.02, 'the ale palls, cider and all');
  assert.ok(after.weight < fresh);
  assert.equal(part(w.mind.explain(p, 'darts')[0], 'had enough'), undefined, 'darts is a pastime of its own');
  w.advance(5 * HOUR);
  assert.equal(w.mind.tolerance(p, 'drink'), 0, 'it wears off');
  assert.equal(part(w.mind.explain(p, 'cider')[0], 'had enough'), undefined);
});

test('a pastime that palls is exempt from the plain repeat penalty', () => {
  const w = tiny();
  w.action({ id: 'darts', at: 'cafe', minutes: 30, base: 0.3, palls: true });
  w.action({ id: 'cards', at: 'cafe', minutes: 30, base: 0.3 });
  w.person('ana', { home: 'home_a', place: 'cafe', needs: { hunger: 0, energy: 0 } });
  const p = w.get('ana');
  for (const a of ['darts', 'cards']) { w.direct('ana', { do: a }); until(w, () => p.last === a, HOUR, 1); }
  w.direct('ana', { do: 'darts' }); until(w, () => p.last === 'darts' && !p.doing?.action?.startsWith('darts'), HOUR, 1);
  w.direct('ana', null);
  const d = w.mind.explain(p, 'darts')[0];
  assert.equal(part(d, 'did it last'), undefined);
  assert.ok(part(d, 'had enough') < 1);
});

test('people ring the changes when pastimes pall', () => {
  const run = (palls, seed) => {
    const w = Tyrell.create({ seed, start: 8 * HOUR, config: { repeat: 1 } });
    w.place({ id: 'den' });
    w.action({ id: 'cards', at: 'den', minutes: 40, base: 0.3, ...(palls ? { palls: true } : {}) });
    w.action({ id: 'dice', at: 'den', minutes: 40, base: 0.2, ...(palls ? { palls: true } : {}) });
    w.person('ana', { place: 'den' });
    const counts = { cards: 0, dice: 0 };
    w.on('log', (e) => { if (e.k === 'started') counts[e.d.action]++; });
    w.advance(DAY);
    return counts;
  };
  let plain = 0, varied = 0;
  for (const seed of ['a', 'b', 'c', 'd', 'e']) {
    const a = run(false, seed), b = run(true, seed);
    assert.ok(b.dice >= a.dice, `seed ${seed}: ${JSON.stringify(a)} against ${JSON.stringify(b)}`);
    plain += a.dice; varied += b.dice;
  }
  assert.ok(varied > plain * 1.15, `the lesser pastime gets more turns (${plain} against ${varied})`);
});

test('a wish pulls toward what would grant it; finishing it grants it, with its effects and the next wish', () => {
  const w = tiny();
  w.wish({ id: 'treat', label: 'A treat at the cafe', toward: ['eat'], by: ['eat'], then: ['var.happy+=1'], next: 'stroll_after' });
  w.wish({ id: 'stroll_after', label: 'A stroll after', toward: ['stroll'], by: ['stroll'] });
  w.person('ana', { home: 'home_a', needs: { hunger: 0.5, energy: 0 } });
  const p = w.get('ana');
  const events = [];
  w.on('wished', (e) => events.push('wished ' + e.wish));
  w.on('granted', (e) => events.push('granted ' + e.wish));
  w.wishFor('ana', 'treat');
  assert.equal(part(w.mind.explain(p, 'eat')[0], 'wish: A treat at the cafe'), 1.35);
  assert.ok(until(w, () => p.last === 'eat', 6 * HOUR, 5));
  assert.equal(p.vars.happy, 1);
  assert.equal(p.granted.treat, 1);
  assert.deepEqual(w.wishesOf('ana').map((h) => h.id), ['stroll_after']);
  assert.deepEqual(events, ['wished treat', 'granted treat', 'wished stroll_after']);
  assert.match(w.describe('ana'), /wishes: A stroll after/);
});

test('a wish about someone pulls toward them and is granted only by them', () => {
  const w = tiny();
  w.action({ id: 'visit', target: 'person', at: 'here', minutes: 20, base: 0.2, tags: ['social'] });
  w.wish({ id: 'see', label: 'A visit with someone', about: (ctx) => ctx.person.id === 'ana' ? 'cy' : null, toward: ['tag:social'], by: ['visit'] });
  w.person('ana', { home: 'home_a', needs: { hunger: 0, energy: 0 } });
  w.person('bo', { home: 'home_a', needs: { hunger: 0, energy: 0 } });
  w.person('cy', { home: 'home_a', needs: { hunger: 0, energy: 0 } });
  w.wishFor('ana', 'see');
  w.wishFor('bo', 'see');
  assert.equal(w.wishesOf('bo').length, 0, 'nobody for Bo to wish for');
  assert.equal(w.wishesOf('ana')[0].x, 'cy');
  const p = w.get('ana');
  const opts = w.mind.options(p).filter((c) => c.id === 'visit');
  const toCy = opts.find((c) => c.target === 'cy'), toBo = opts.find((c) => c.target === 'bo');
  assert.ok(part(toCy, 'wish') > 1);
  assert.equal(part(toBo, 'wish'), undefined);
  w.direct('ana', { do: 'visit', target: 'bo' });
  until(w, () => p.last === 'visit', HOUR, 1);
  assert.equal(w.wishesOf('ana').length, 1, 'a visit to Bo is not a visit to Cy');
  w.direct('ana', { do: 'visit', target: 'cy' });
  until(w, () => !w.wishesOf('ana').length, HOUR, 1);
  assert.equal(p.granted.see, 1);
});

test('wishes come true when their conditions do, and fade when they don\'t', () => {
  const w = tiny({ config: { wishChance: 0 } });
  w.wish({ id: 'rich', when: ['money>=50'], minutes: 3 * HOUR, fades: ['var.sighs+=1'] });
  w.wish({ id: 'sunny', when: ['fact:sunny'], minutes: 3 * HOUR, fades: ['var.sighs+=1'] });
  w.person('ana', { home: 'home_a' });
  w.wishFor('ana', 'rich');
  w.wishFor('ana', 'sunny');
  w.advance(HOUR);
  w.setVar('ana', 'money', 60);
  w.advance(HOUR);
  assert.deepEqual(w.wishesOf('ana').map((h) => h.id), ['sunny']);
  w.advance(3 * HOUR);
  assert.equal(w.wishesOf('ana').length, 0);
  assert.equal(w.get('ana').vars.sighs, 1);
  assert.equal(w.get('ana').wishes, undefined, 'nothing left behind');
});

test('a dream never fades, comes true when its progress does, and isn\'t dreamed twice', () => {
  const w = tiny({ config: { wishChance: 1 } });
  w.wish({ id: 'savings', label: 'Save a hundred', dream: true, progress: (ctx) => Number(ctx.person.vars.money) / 100, toward: ['stroll'] });
  w.person('ana', { home: 'home_a' });
  assert.ok(until(w, () => w.wishesOf('ana').some((h) => h.dream), DAY, 30), 'dreamed at a wish hour');
  assert.equal(w.wishesOf('ana')[0].until, undefined);
  assert.equal(part(w.mind.explain(w.get('ana'), 'stroll')[0], 'dream: Save a hundred'), 1.35);
  w.advance(5 * DAY);
  assert.equal(w.wishesOf('ana').length, 1);
  assert.equal(w.wishesOf('ana')[0].progress, 0);
  w.setVar('ana', 'money', 100);
  w.advance(HOUR);
  assert.equal(w.get('ana').granted.savings, 1);
  w.setVar('ana', 'money', 0);
  w.advance(2 * DAY);
  assert.equal(w.wishesOf('ana').length, 0, 'once in a life');
});

test('wishes come at the wish hours, by weight and conditions, a couple at a time', () => {
  const w = tiny({ config: { wishChance: 1 } });
  w.wish({ id: 'cake', weight: 3 });
  w.wish({ id: 'tea', weight: 1 });
  w.wish({ id: 'swing', if: ['is:child'] });
  w.wish({ id: 'nap', weight: (ctx) => (ctx.person.def.tags?.includes('child') ? 0 : 0.5) });
  w.person('ana', { home: 'home_a' });
  w.person('kid', { home: 'home_b', tags: ['child'] });
  const seen = new Map();
  w.on('wished', (e) => seen.set(e.id, [...(seen.get(e.id) || []), e.wish]));
  w.advance(2 * DAY);
  assert.ok(!seen.get('ana').includes('swing'));
  for (let i = 0; i < 6; i++) { w.advance(DAY); assert.ok(w.wishesOf('ana').length <= 2); }
  const all = [...seen.get('ana'), ...seen.get('kid')];
  assert.ok(all.filter((x) => x === 'cake').length > all.filter((x) => x === 'nap').length);
  assert.ok(!seen.get('kid').includes('nap'), 'a weight can be a function: no naps for the child');
});

test('wishes and pastimes are state: they rewind and save', () => {
  const build = () => {
    const w = tiny({ config: { wishChance: 0.8 } });
    w.need({ id: 'fun', rise: 0.1, urgent: 1.1 });
    w.action({ id: 'cards', at: 'cafe', minutes: 40, relieves: { fun: 0.5 }, palls: true });
    w.wish({ id: 'cards_night', toward: ['cards'], by: ['cards'] });
    w.wish({ id: 'walk', toward: ['stroll'], by: ['stroll'] });
    w.person('ana', { home: 'home_a' });
    w.person('bo', { home: 'home_b' });
    return w;
  };
  const a = build(), b = build();
  a.advance(2 * DAY); b.advance(2 * DAY);
  assert.equal(a.hash(), b.hash());
  const h = a.hash();
  a.rewind(10 * HOUR);
  a.advance(10 * HOUR);
  assert.equal(a.hash(), h);
  const c = build();
  c.load(JSON.stringify(a.save()));
  assert.equal(c.hash(), a.hash());
  a.advance(DAY); c.advance(DAY);
  assert.equal(c.hash(), a.hash());
});
