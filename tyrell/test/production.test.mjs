// Ceres' production: actions that use goods from a store and make goods into
// it, the daily report (stock, made and used yesterday, days left) and the
// bottleneck in a chain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tyrell, until, HOUR, DAY } from './helpers.mjs';

/** A hamlet: a mill and a bakery round a store, a miller, a baker and someone who eats bread. */
function hamlet(opts = {}) {
  const w = Tyrell.create({ seed: 'hamlet', start: 6 * HOUR, modules: ['ceres', 'fellowship'], ...opts });
  w.need({ id: 'hunger', rise: 0.08, start: 0.2 });
  w.place({ id: 'store', region: 'square', stock: { grain: 20, flour: 0, bread: 4 } });
  w.place({ id: 'mill', region: 'square', slots: { stones: 1 } });
  w.place({ id: 'bakery', region: 'square', slots: { oven: 1 } });
  w.place({ id: 'house', region: 'square', tags: ['home'] });
  w.link('store', 'mill', 3); w.link('store', 'bakery', 3); w.link('store', 'house', 2);
  w.skill({ id: 'baking', rate: 0.01 });
  w.action({ id: 'grind', at: 'mill', slot: 'stones', minutes: 60, job: 'miller', rank: -1, fill: false, store: 'store', uses: { grain: 2 }, makes: { flour: 2 } });
  w.action({ id: 'bake', at: 'bakery', slot: 'oven', minutes: 60, job: 'baker', rank: -1, fill: false, store: 'store', uses: { flour: 1 }, makes: { bread: 4 },
    yields: [{ input: 'skill.baking', out: [0.5, 1.5] }], trains: { baking: 1 } });
  w.action({ id: 'eat', at: 'store', minutes: 20, relieves: { hunger: 0.6 }, store: 'store', uses: { bread: 1 } });
  w.action({ id: 'rest', at: 'house', minutes: 60, base: 0.01 });
  w.ceres.chain({ id: 'bread', goods: ['grain', 'flour', 'bread'], store: 'store' });
  w.person('mo', { home: 'house', job: { id: 'miller', place: 'mill', action: 'grind', shifts: [[7, 12]] } });
  w.person('bea', { home: 'house', skills: { baking: 0.5 }, job: { id: 'baker', place: 'bakery', action: 'bake', shifts: [[13, 17]] } });
  w.person('cy', { home: 'house' });
  return w;
}

test('a store\'s goods are used and made: grain to flour to bread', () => {
  const w = hamlet();
  const s = () => w.s.places.store.stock;
  w.advance(12 * HOUR - 6 * HOUR);
  assert.ok(s().flour >= 8, `the miller made flour (${s().flour})`);
  assert.ok(s().grain <= 12, `out of the grain (${s().grain})`);
  w.advance(6 * HOUR);
  assert.ok(s().bread > 8, `the baker made bread (${s().bread})`);
  assert.ok(w.get('bea').skills.baking[0] > 0.5, 'and got better at it');
});

test('using from a store is ruled out when it has run out; makes goes to the place itself by default', () => {
  const w = Tyrell.create({ seed: 'x', start: 8 * HOUR, modules: ['ceres'] });
  w.place({ id: 'bakery', stock: { flour: 1 } });
  w.action({ id: 'bake', at: 'bakery', minutes: 30, base: 0.5, store: 'here', uses: { flour: 1 }, makes: { bread: 3 } });
  w.action({ id: 'whittle', at: 'bakery', minutes: 30, base: 0.2, makes: { spoon: 1 } });
  w.person('bea', { place: 'bakery' });
  const p = w.get('bea');
  assert.equal(w.mind.explain(p, 'bake')[0].blocked, undefined);
  w.direct('bea', { do: 'bake' });
  until(w, () => p.last === 'bake', HOUR, 1);
  assert.equal(w.ceres.stock('bakery', 'bread'), 3);
  assert.equal(w.ceres.stock('bakery', 'flour'), 0);
  assert.equal(p.inv.flour, undefined, 'it came out of the store, not her pockets');
  assert.equal(w.mind.explain(p, 'bake')[0].blocked, 'no flour left at bakery');
  assert.ok(until(w, () => w.ceres.stock('bakery', 'spoon') >= 1, HOUR, 1), 'a spoon, into the bakery\'s stock');
});

test('what\'s made scales with yields, and with how much was done when it\'s cut short', () => {
  const w = Tyrell.create({ seed: 'x', start: 8 * HOUR, modules: ['ceres'] });
  w.place({ id: 'shop' });
  w.action({ id: 'carve', at: 'shop', minutes: 60, base: 0.5, makes: { bowl: 4 }, yields: [{ input: 'skill.carving', out: [0.5, 1.5] }] });
  w.person('ana', { place: 'shop', skills: { carving: 1 } });
  w.person('bo', { place: 'shop' });
  for (const id of ['ana', 'bo']) { w.direct(id, { do: 'carve' }); }
  until(w, () => w.get('ana').last === 'carve' && w.get('bo').last === 'carve', 2 * HOUR, 1);
  assert.equal(w.ceres.stock('shop', 'bowl'), 6 + 2);
  w.direct('ana', { do: 'carve' });
  w.advance(15);
  w.direct('ana', null);
  w.advance(1);
  assert.equal(w.ceres.stock('shop', 'bowl'), 8 + 1.5, 'a quarter done, at one and a half times: a bowl and a half');
});

test('the daily report: stock, made and used yesterday, days left, and the bottleneck', () => {
  const w = hamlet();
  const reports = [];
  w.on('production', (r) => reports.push(r));
  w.advance(DAY - 6 * HOUR + 1);
  assert.equal(reports.length, 1);
  const r = reports[0];
  assert.equal(r.day, 0);
  const store = r.places.store;
  assert.ok(store.flour.made > 0 && store.flour.used > 0);
  assert.ok(store.grain.used > 0 && store.grain.net < 0);
  assert.equal(store.grain.days, Math.round(store.grain.stock / -store.grain.net * 100) / 100);
  assert.deepEqual(w.ceres.production('store').places.store, store);
  // the baker stays home: flour piles up, the bread runs out
  w.remove('bea');
  w.advance(2 * DAY);
  const b = w.ceres.production().bottlenecks;
  assert.ok(b.some((x) => x.chain === 'bread' && x.from === 'flour' && x.to === 'bread'), JSON.stringify(b));
});

test('worlds with no production keep no figures', () => {
  const w = Tyrell.create({ seed: 'x', start: 8 * HOUR, modules: ['ceres'] });
  w.place({ id: 'shop', stock: { pie: 5 }, restock: { pie: [2, 1] } });
  w.action({ id: 'buy', at: 'shop', minutes: 5, base: 0.5, buys: { pie: 1 }, cooldown: 60 });
  w.person('ana', { place: 'shop' });
  w.ceres.restock('shop', 'pie', 3);
  w.advance(2 * DAY);
  assert.equal(w.s.mod.ceres.prod, undefined);
  assert.deepEqual(w.ceres.production().places, {});
});

test('production is state: it rewinds and saves', () => {
  const a = hamlet(), b = hamlet();
  a.advance(DAY + 3 * HOUR); b.advance(DAY + 3 * HOUR);
  assert.equal(a.hash(), b.hash());
  const h = a.hash();
  a.rewind(6 * HOUR); a.advance(6 * HOUR);
  assert.equal(a.hash(), h);
  const c = hamlet();
  c.load(JSON.stringify(a.save()));
  a.advance(DAY); c.advance(DAY);
  assert.equal(c.hash(), a.hash());
  assert.deepEqual(c.ceres.production(), a.ceres.production());
});
