// What a game doesn't use changes nothing. Rocinante as it was in Tyrell
// 2.0.0 (frozen in fixtures/) runs two days with a few inputs, a birth, a
// rewind and a replay, and must come out exactly as 2.0.0 made it: with
// every module (Athelas, Delos and Voice on but unused), with the White
// Dragon's set of modules, and with none. The hashes were recorded with the
// 2.0.0 build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Tyrell, HOUR } from './helpers.mjs';

const require = createRequire(import.meta.url);
const build = require('./fixtures/rocinante-2.0.0.js');

function run(opts) {
  const w = build(Tyrell, opts);
  const out = [];
  w.focus(['main']);
  for (let h = 1; h <= 48; h++) {
    w.advanceTo(6 * HOUR + h * HOUR);
    if (h === 10) { w.did('player', 'helped', { for: 'ruth' }); w.sense({ kind: 'theft', actor: 'sam', place: 'market' }); }
    if (h === 20) w.fact('raining', true);
    if (h === 25 && w.ceres) w.ceres.pay('world', 'kofi', 30, 'gift');
    if (h === 30 && w.cityspeak) w.cityspeak.say('ines', { topic: 'greet', to: 'player' });
    if (h === 35 && w.cradle) w.cradle.birth(['mara', 'tomas'], {}, 'baby');
    if (h % 24 === 0) out.push(w.hash());
  }
  w.rewind(5 * HOUR);
  out.push(w.hash());
  w.advance(5 * HOUR);
  out.push(w.hash());
  return { out, w };
}

const DRAGON = { modules: ['reverie', 'fellowship', 'wormtongue', 'cityspeak', 'mentat', 'ceres'], esper: { every: 60, keep: 26 * 60, sparseAfter: 180, sparseEvery: 240 } };

test('a 2.0.0 world with every module runs exactly as it did, the new ones on but unused', () => {
  const { out, w } = run({});
  assert.deepEqual(out, ['75fe5159', 'd3243f2c', '400a49d3', 'd3243f2c']);
  for (const m of ['athelas', 'delos', 'voice']) assert.equal(w.s.mod[m], undefined, `${m} keeps nothing`);
  assert.equal(w.s.mod.ceres.prod, undefined, 'Ceres counts no production');
  for (const p of Object.values(w.s.people)) for (const k of ['skills', 'tol', 'wishes', 'granted']) assert.equal(p[k], undefined);
});

test('a 2.0.0 world with the White Dragon\'s modules runs exactly as it did', () => {
  assert.deepEqual(run(DRAGON).out, ['2774f681', 'e9b9ac1c', '2b9aee7b', 'e9b9ac1c']);
});

test('a 2.0.0 world with no modules runs exactly as it did', () => {
  assert.deepEqual(run({ modules: [] }).out, ['bad441ec', '3b79c413', '66e9491f', '3b79c413']);
});
