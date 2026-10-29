// The catalog, the living documentation: generated from Tyrell's source and
// docs, it must cover everything, with nothing undocumented and no kind
// without an example, and every example must be something a town can take.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Eros, Tyrell, cat, examples, rocinante } from './helpers.mjs';

test('every part of Tyrell is in the catalog, from the README, with its docs page', () => {
  const names = cat.modules.map((m) => m.name);
  for (const n of ['reverie', 'fellowship', 'wormtongue', 'cityspeak', 'mentat', 'gaff', 'ceres', 'cradle', 'joi', 'athelas', 'delos', 'voice', 'bree', 'morgul', 'irulan', 'palantir', 'westmarch', 'esper']) assert.ok(names.includes(n), n);
  for (const m of cat.modules) assert.ok(m.about && m.origin && m.page, m.name);
  // every module with settings has its settings
  for (const m of cat.modules.filter((x) => x.kind === 'module' && x.name !== 'mentat' && x.name !== 'joi')) assert.ok(m.config, m.name);
});

test('every kind a town declares is there, every field documented, and an example of each', () => {
  for (const key of ['world.need', 'world.place', 'world.link', 'world.action', 'world.task', 'world.skill', 'world.wish', 'world.person', 'world.deed', 'world.pastime',
    'world.term', 'world.effect', 'world.on', 'reverie.feeling', 'reverie.breakdown', 'fellowship.group', 'wormtongue.crime', 'cityspeak.line', 'gaff.storylet', 'ceres.good',
    'athelas.course', 'delos.gene', 'voice.thread', 'bree.kind', 'morgul.trap', 'strangers.define', 'irulan.words']) assert.ok(cat.kinds.some((k) => k.key === key), key);
  for (const k of cat.kinds) {
    for (const f of k.fields) assert.ok(f.meaning || f.doc, `${k.key}: ${f.name} has no documentation (a doc comment in tyrell/src, or a row in its docs table)`);
    assert.ok(examples.has(k.key), `${k.key} has no example: Rocinante doesn't use it, so write one in src/catalog.ts`);
  }
  // not kinds: an input or a lookup that takes a definition
  for (const key of ['strangers.promote', 'cradle.birth', 'mentat.cost', 'morgul.taint']) assert.ok(!cat.kinds.some((k) => k.key === key), key);
});

test('every setting is documented, from its comment or tuning.md, and every type has its fields', () => {
  for (const c of cat.config) for (const f of c.fields) assert.ok(f.doc || f.meaning, `${c.type}.${f.name}`);
  assert.ok(cat.config.find((c) => c.type === 'Config').fields.some((f) => f.name === 'storySize'));
  assert.ok(cat.types.ActionDef.fields.some((f) => f.name === 'together'));
});

test('every example is something a town takes: each added to Rocinante builds without a failing call', () => {
  const model = Eros.record(rocinante, Tyrell, { bree: true, harm: true, together: true, tuned: true }, 'rocinante');
  let id = 10000;
  for (const [key, ex] of examples) {
    const [target, method] = key.split('.');
    const town = { ...model, calls: [...model.calls, { id: ++id, target, method, code: ex.code }] };
    const { world, errors } = Eros.replay(town, Tyrell);
    assert.deepEqual(errors, [], `${key}: ${ex.code}`);
    world.advance(60);
  }
});

test('a call the catalog doesn\'t declare is still described, from the API', () => {
  const k = Eros.kindOf(cat, 'fellowship', 'setPartner');
  assert.equal(k.input, true);
  assert.match(k.doc, /partners/);
  assert.deepEqual(k.params.map((p) => p.name), ['a', 'b']);
  const unknown = Eros.kindOf(cat, 'world', 'somethingNew');
  assert.equal(unknown.name, 'Something new');
});
