// Delos: genomes. Founders' genes and blends, dominance, inheritance through
// Cradle's births, mutations, and what a genome means for traits, talents
// and instincts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tyrell, tiny, HOUR, DAY } from './helpers.mjs';

/** A world with Delos's definitions (Merryfolk's, in small). */
function genetic(opts = {}) {
  const w = tiny({ moduleConfig: { cradle: { autoPair: null }, ...(opts.moduleConfig || {}) }, ...opts });
  const d = w.delos;
  d.gene({ id: 'eyes', alleles: ['brown', 'hazel', 'green', 'blue'], weights: [5, 2, 1.5, 2.5] });
  d.gene({ id: 'freckles', alleles: ['plain', 'freckled'] });          // freckles only with two copies
  d.gene({ id: 'hair', alleles: ['auburn', 'black', 'flaxen', 'chestnut'], copies: 1 });
  d.trait({ id: 'merriness' });
  d.trait({ id: 'temper', bounds: [0.03, 1] });
  d.talent({ id: 'baking', founders: [0.15, 1], bounds: [0.05, 1], express: (a) => 0.4 + a * 1.2 });
  d.instinct({ id: 'stroll' });
  d.look({ id: 'skin', founders: [0, 5], bounds: [0, 5], cross: 0, noise: 0.7, round: true });
  return w;
}

test('founders get a genome when they join, drawn from the founders\' ranges and expressed into their definition', () => {
  const w = genetic();
  w.person('ana', { home: 'home_a', traits: { merriness: 0.9, honesty: 0.4 } });
  const g = w.delos.genome('ana');
  assert.equal(g.genes.eyes.length, 2);
  assert.equal(g.genes.hair.length, 1);
  assert.equal(g.traits.merriness, 0.9, 'a value the game gave is kept');
  const def = w.get('ana').def;
  assert.equal(def.traits.merriness, 0.9);
  assert.equal(def.traits.honesty, 0.4, 'traits Delos doesn\'t carry are left alone');
  assert.ok(def.traits.temper >= 0.1 && def.traits.temper <= 0.9);
  assert.equal(def.talents.baking, Math.round((0.4 + g.talents.baking * 1.2) * 1e4) / 1e4, 'talents are expressed');
  assert.ok(def.instincts.stroll >= 0.8 && def.instincts.stroll <= 1.25);
  assert.ok(Number.isInteger(w.delos.looks('ana').skin));
  // the same seed makes the same people
  const again = genetic();
  again.person('ana', { home: 'home_a', traits: { merriness: 0.9, honesty: 0.4 } });
  assert.deepEqual(again.delos.genome('ana'), g);
});

test('a gene shows its most dominant allele, so a recessive one can skip a generation', () => {
  const w = genetic();
  w.person('mom', { home: 'home_a' });
  w.person('dad', { home: 'home_a' });
  w.delos.set('mom', { genes: { eyes: ['brown', 'blue'], freckles: ['plain', 'freckled'] } });
  w.delos.set('dad', { genes: { eyes: ['brown', 'blue'], freckles: ['plain', 'freckled'] } });
  assert.equal(w.delos.express('mom', 'eyes'), 'brown');
  assert.equal(w.delos.express('mom', 'freckles'), 'plain');
  assert.equal(w.lang.value('carries:eyes.blue', w.ctx(w.get('mom'))), true);
  const eyes = new Set(), freckles = new Set();
  for (let i = 0; i < 24; i++) {
    const kid = w.cradle.birth(['mom', 'dad'], {}, 'kid' + i);
    eyes.add(w.delos.express(kid, 'eyes'));
    freckles.add(w.lang.value('gene:freckles', w.ctx(w.get(kid))));
  }
  assert.ok(eyes.has('blue') && eyes.has('brown'), [...eyes].join());
  assert.ok(freckles.has('freckled') && freckles.has('plain'));
});

test('a child\'s traits blend its parents\', with a little of its own; single-copy genes come whole from one parent', () => {
  const w = genetic({ moduleConfig: { delos: { jump: { chance: 0, by: 0 }, gift: { chance: 0, by: 0 } } } });
  w.person('mom', { home: 'home_a' });
  w.person('dad', { home: 'home_a' });
  w.delos.set('mom', { traits: { merriness: 0.9, temper: 0.2 }, genes: { hair: ['auburn'] } });
  w.delos.set('dad', { traits: { merriness: 0.3, temper: 0.8 }, genes: { hair: ['black'] } });
  for (let i = 0; i < 12; i++) {
    const kid = w.cradle.birth(['mom', 'dad'], {}, 'kid' + i);
    const m = w.get(kid).def.traits.merriness;
    assert.ok(m >= 0.3 * 0.65 + 0.6 * 0.35 - 0.1 - 1e-9 && m <= 0.9 * 0.65 + 0.6 * 0.35 + 0.1 + 1e-9, `merriness ${m}`);
    assert.ok(['auburn', 'black'].includes(w.delos.express(kid, 'hair')));
    assert.ok(w.get(kid).def.talents.baking > 0 && w.get(kid).def.instincts.stroll > 0, 'talents and instincts come with it');
  }
});

test('mutations: a jump, a gift, an allele that turns, each kept and told', () => {
  const w = genetic({ moduleConfig: { delos: { jump: { chance: 1, by: 0.35 }, gift: { chance: 1, by: 0.4 } } } });
  w.delos.genes.get('eyes').mutate = 1;
  w.person('mom', { home: 'home_a' });
  w.person('dad', { home: 'home_a' });
  const seen = [];
  w.on('mutated', (e) => seen.push(e.kind));
  const kid = w.cradle.birth(['mom', 'dad']);
  const g = w.delos.genome(kid);
  assert.ok(g.mut.some((m) => m.kind === 'trait') && g.mut.some((m) => m.kind === 'talent'));
  assert.ok(seen.includes('trait') && seen.includes('talent'));
  assert.ok(w.westmarch.find({ k: 'mutated' }).length >= 2);
});

test('with Delos on but nothing declared, Cradle blends traits as it always has', () => {
  const build = (modules) => {
    const w = Tyrell.create({ seed: 'kin', start: 8 * HOUR, modules, moduleConfig: { cradle: { autoPair: null } } });
    w.place({ id: 'home', tags: ['home'] });
    w.person('mom', { home: 'home', traits: { kind: 0.8, bold: 0.2 } });
    w.person('dad', { home: 'home', traits: { kind: 0.4 } });
    w.cradle.birth(['mom', 'dad'], {}, 'kid');
    return w;
  };
  const a = build(['fellowship', 'cradle']), b = build(['fellowship', 'cradle', 'delos']);
  assert.deepEqual(b.get('kid').def, a.get('kid').def);
  assert.equal(b.s.mod.delos, undefined);
  assert.equal(b.hash(), a.hash());
});

test('with Delos, a child\'s talents set how fast it learns, and its instincts weigh its choices', () => {
  const w = genetic();
  w.skill({ id: 'baking', rate: 0.05 });
  w.person('mom', { home: 'home_a' });
  w.person('dad', { home: 'home_a' });
  w.delos.set('mom', { talents: { baking: 1 }, instincts: { stroll: 1.4 } });
  w.delos.set('dad', { talents: { baking: 1 }, instincts: { stroll: 1.4 } });
  w.person('other', { home: 'home_b' });
  w.delos.set('other', { talents: { baking: 0.05 }, instincts: { stroll: 0.6 } });
  const kid = w.cradle.birth(['mom', 'dad'], { home: 'home_a' });
  assert.ok(w.get(kid).def.talents.baking > 1.2);
  w.train(kid, 'baking', 3); w.train('other', 'baking', 3);
  assert.ok(w.skillOf(kid, 'baking') > w.skillOf('other', 'baking') * 1.5);
  const k = w.mind.explain(w.get(kid), 'stroll')[0];
  assert.ok(k.parts.some(([n, v]) => n === 'instinct' && v > 1.1));
});

test('genomes are state: they rewind and save', () => {
  const build = () => { const w = genetic(); w.person('mom', { home: 'home_a' }); w.person('dad', { home: 'home_a' }); return w; };
  const a = build();
  a.advance(HOUR);
  a.cradle.birth(['mom', 'dad'], {}, 'kid');
  a.advance(HOUR);
  const h = a.hash(), g = a.delos.genome('kid');
  a.rewind(90);
  assert.equal(a.delos.genome('kid'), undefined);
  a.advance(90);
  assert.equal(a.hash(), h);
  assert.deepEqual(a.delos.genome('kid'), g);
  const c = build();
  c.load(JSON.stringify(a.save()));
  assert.equal(c.hash(), a.hash());
  assert.deepEqual(c.delos.looks('kid'), a.delos.looks('kid'));
});
