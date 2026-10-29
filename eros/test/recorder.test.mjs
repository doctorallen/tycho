// The recorder and its code: values written as JavaScript and read back,
// setup files recorded call by call, built again into the same world, and
// exported as setup files that build the same world too.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ALL, Eros, Tyrell, folder, rocinante } from './helpers.mjs';

test('values are written as JavaScript and read back the same, functions by their source', () => {
  const value = {
    id: 'x', n: -0, big: Infinity, list: [1, 'two', [3]], 'odd key': true, re: /a+b/g, nothing: null, skipped: undefined,
    fire(w) { return w.now; }, arrow: (ctx) => ctx.world.now + 1, nested: { deep: { deeper: 'yes' } },
  };
  const code = Eros.toCode(value);
  const back = Eros.readValue(code, { w: { now: 5 }, Tyrell });
  assert.equal(back.id, 'x');
  assert.ok(Object.is(back.n, -0));
  assert.equal(back.big, Infinity);
  assert.deepEqual(back.list, [1, 'two', [3]]);
  assert.equal(back['odd key'], true);
  assert.equal(String(back.re), '/a+b/g');
  assert.ok(!('skipped' in back));
  // a method shorthand becomes a function, and both run
  assert.equal(back.fire({ now: 7 }), 7);
  assert.equal(back.arrow({ world: { now: 1 } }), 2);
  // long values spread over lines, short ones stay on one
  assert.ok(Eros.toCode({ a: 1 }) === '{ a: 1 }');
  assert.ok(Eros.toCode({ text: 'x'.repeat(120) }).includes('\n'));
  assert.ok(!Eros.toCode({ text: 'x'.repeat(120) }, '', new Set(), Infinity).includes('\n'));
  assert.throws(() => { const o = {}; o.self = o; Eros.toCode(o); }, /contains itself/);
});

test('names a function leans on from its file are found', () => {
  assert.deepEqual(Eros.freeNames("(e) => (facts[e.d.key] ? facts[e.d.key][0] : undefined)"), ['facts']);
  assert.deepEqual(Eros.freeNames("(world) => { world.fact('raining', true); world.at(world.now + 6 * HOUR, 'x'); }"), []);
  assert.deepEqual(Eros.freeNames("{ a: (ctx) => { const { person } = ctx; return person.id + w.now + helper(); } }"), ['helper']);
  assert.deepEqual(Eros.freeNames("{ strength }"), ['strength']);
});

test('Rocinante, with every option, records and builds again into the same world as its file', () => {
  for (const options of [{}, ALL]) {
    const model = Eros.record(rocinante, Tyrell, options, 'rocinante');
    assert.ok(model.calls.length > 140);
    assert.deepEqual(model.warnings, []);
    assert.equal(Eros.sameAsFile(model, rocinante, Tyrell, 2), null);
    // lookups aren't part of a town, inputs are
    assert.ok(!model.calls.some((c) => c.method === 'kept' || c.method === 'partner'));
    assert.ok(model.calls.some((c) => c.target === 'fellowship' && c.method === 'setPartner'));
    // modules' calls are recorded on the module
    assert.ok(model.calls.some((c) => c.target === 'reverie' && c.method === 'feeling'));
  }
});

test('a setup\'s own lookups and what its functions do once it runs aren\'t recorded; its file\'s variables are warned of', () => {
  const setup = (T, opts) => {
    const w = T.create({ seed: opts.seed || 's', start: 360 });
    const table = { a: 1 };
    w.need({ id: 'hunger', rise: 0.05 });
    w.place({ id: 'home', tags: ['home'] });
    w.action({ id: 'eat', at: 'home', minutes: 20, relieves: { hunger: 0.6 } });
    w.person('ann', { name: 'Ann', home: 'home' });
    w.kept('x');
    w.on('timer:t', () => w.fact('later', table.a));
    w.at(400, 't');
    return w;
  };
  const model = Eros.record(setup, Tyrell, {}, 'tiny');
  assert.deepEqual(model.calls.map((c) => Eros.callName(c)), ['w.need', 'w.place', 'w.action', 'w.person', 'w.on', 'w.at']);
  assert.equal(model.warnings.length, 1);
  assert.match(model.warnings[0], /w\.on #5 names table/);
  // the recorded copy fails where the file's variable is missing, and says so
  const { world } = Eros.replay(model, Tyrell);
  assert.throws(() => world.advance(120), /table/);
});

test('a call that fails is skipped and reported, the rest still made; a module that\'s off is said', () => {
  const model = Eros.record(rocinante, Tyrell, {}, 'rocinante');
  const bad = { ...model, calls: [...model.calls, { id: 999, target: 'world', method: 'action', code: '{ id: 1 }.nope.no' }, { id: 1000, target: 'nomodule', method: 'thing', code: '1' }] };
  const { world, errors } = Eros.replay(bad, Tyrell);
  assert.deepEqual(errors.map((e) => e.id), [999, 1000]);
  assert.match(errors[1].message, /isn't on/);
  assert.ok(world.s.people.mara);
});

test('a town exports as a setup file in Rocinante\'s shape that builds the same world, read as CommonJS or in an ES module package', async () => {
  const dir = folder();
  const model = Eros.record(rocinante, Tyrell, ALL, 'rocinante');
  const code = Eros.exportCode(model);
  assert.match(code, /^\/\/ rocinante: a Tyrell town, exported by Eros/);
  assert.match(code, /function buildRocinante\(Tyrell, opts\)/);
  // (.cjs reads as CommonJS; .js in out/, under eros's "type": "module", reads as an ES module and defines a global)
  for (const name of ['town.cjs', 'town.js']) {
    const file = join(dir, name);
    writeFileSync(file, code);
    const setup = await Eros.loadSetup(file);
    const a = rocinante(Tyrell, { ...ALL, seed: 'x' }), b = setup(Tyrell, { seed: 'x' });
    a.advance(2880);
    b.advance(2880);
    assert.equal(b.hash(), a.hash(), name);
  }
  // the options a runner passes still apply: a seed, config
  const setup = await Eros.loadSetup(join(dir, 'town.cjs'));
  assert.equal(setup(Tyrell, { seed: 'other' }).s.seed, 'other');
  assert.equal(setup(Tyrell, { config: { logSize: 77 } }).cfg.logSize, 77);
});
