// Skills that grow with practice, talents that set the pace, and instincts
// (inborn tastes) that weigh choices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tiny, until, HOUR, DAY } from './helpers.mjs';

test('practice raises a skill at the talent\'s pace, harder near the top', () => {
  const w = tiny();
  w.skill({ id: 'cooking', rate: 0.05 });
  w.person('ana', { home: 'home_a', talents: { cooking: 1.5 } });
  w.person('bo', { home: 'home_b' });
  w.train('ana', 'cooking', 4);
  w.train('bo', 'cooking', 4);
  const a = w.skillOf('ana', 'cooking'), b = w.skillOf('bo', 'cooking');
  assert.ok(a > b, 'the talented one learns faster');
  assert.ok(Math.abs(b - (1 - Math.exp(-0.2))) < 1e-4, 'progress follows the curve exactly');
  // the second four hours give less than the first
  w.train('bo', 'cooking', 4);
  assert.ok(w.skillOf('bo', 'cooking') - b < b);
  assert.ok(w.skillOf('bo', 'cooking') < 1);
});

test('eight hours at once is the same as eight one-hour goes', () => {
  const w = tiny();
  w.skill({ id: 'lore', rate: 0.03, max: 100, diminish: 2 });
  w.person('ana', { home: 'home_a' });
  w.person('bo', { home: 'home_b' });
  w.train('ana', 'lore', 8);
  for (let i = 0; i < 8; i++) w.train('bo', 'lore', 1);
  assert.ok(Math.abs(w.skillOf('ana', 'lore') - w.skillOf('bo', 'lore')) < 1e-3);
});

test('an action that trains a skill teaches whoever does it, even when it\'s cut short', () => {
  const w = tiny();
  w.skill({ id: 'cooking', rate: 0.1 });
  w.action({ id: 'cook', at: 'home', minutes: 120, base: 0.5, trains: { cooking: 1 } });
  w.person('ana', { home: 'home_a', needs: { hunger: 0, energy: 0 } });
  w.direct('ana', { do: 'cook' });
  until(w, () => w.get('ana').doing?.action === 'cook', HOUR, 1);
  w.advance(60);
  w.direct('ana', { do: 'loaf' });
  const v = w.skillOf('ana', 'cooking');
  assert.ok(v > 0.08 && v < 0.12, `about an hour's worth (${v})`);
});

test('a skill slips when it\'s let go, after its grace, but not below its floor', () => {
  const w = tiny();
  w.skill({ id: 'fiddle', rate: 0.2, decay: 0.05, grace: 2, floor: 0.3 });
  w.person('ana', { home: 'home_a' });
  w.train('ana', 'fiddle', 10);
  const top = w.skillOf('ana', 'fiddle');
  w.advance(2 * DAY);
  assert.equal(w.skillOf('ana', 'fiddle'), top, 'nothing lost in the grace days');
  w.advance(2 * DAY);
  assert.ok(Math.abs(w.skillOf('ana', 'fiddle') - (top - 0.1)) < 1e-3);
  w.advance(30 * DAY);
  assert.equal(w.skillOf('ana', 'fiddle'), 0.3);
  // practice picks up from where it slipped to
  w.train('ana', 'fiddle', 0.01);
  assert.ok(w.skillOf('ana', 'fiddle') < 0.31);
});

test('reaching a named level is an event, with the skill\'s effects', () => {
  const w = tiny();
  w.skill({ id: 'baking', rate: 0.5, levels: [[0.25, 'competent'], [0.5, 'skilled'], [0.75, 'expert']], then: ['var.prizes+=1'] });
  w.person('ana', { home: 'home_a' });
  const seen = [];
  w.on('skill', (e) => seen.push(e.level));
  w.train('ana', 'baking', 1.5);
  assert.deepEqual(seen, ['competent', 'skilled']);
  assert.equal(w.get('ana').vars.prizes, 2);
  assert.equal(w.skills.named(w.get('ana'), 'baking'), 'skilled');
  assert.match(w.describe('ana'), /skills: baking 0\.53 \(skilled\)/);
});

test('conditions and considerations read skills; effects train and set them', () => {
  const w = tiny();
  w.skill({ id: 'carving' });
  w.action({ id: 'carve_fine', at: 'home', minutes: 30, base: 0.5, if: ['skill.carving>=0.5'] });
  w.action({ id: 'show_off', at: 'home', minutes: 10, base: 0.5, considerations: [{ input: 'skill.carving', out: [0.1, 1] }], then: ['skill.carving+=0.05', 'train:carving=2'] });
  w.person('ana', { home: 'home_a', skills: { carving: 0.6 } });
  w.person('bo', { home: 'home_b' });
  assert.ok(!w.mind.explain(w.get('ana'), 'carve_fine')[0].blocked);
  assert.match(w.mind.explain(w.get('bo'), 'carve_fine')[0].blocked, /skill\.carving>=0\.5/);
  const a = w.mind.explain(w.get('ana'), 'show_off')[0], b = w.mind.explain(w.get('bo'), 'show_off')[0];
  assert.ok(a.weight > b.weight * 3);
  w.direct('ana', { do: 'show_off' });
  until(w, () => w.get('ana').last === 'show_off', HOUR, 1);
  assert.ok(w.skillOf('ana', 'carving') > 0.65);
});

test('instincts weigh actions for good; talents and instincts read as terms', () => {
  const w = tiny();
  w.person('ana', { home: 'home_a', instincts: { stroll: 1.4 }, talents: { cooking: 0.7 } });
  w.person('bo', { home: 'home_a' });
  const a = w.mind.explain(w.get('ana'), 'stroll')[0], b = w.mind.explain(w.get('bo'), 'stroll')[0];
  assert.ok(a.parts.some(([n, v]) => n === 'instinct' && v === 1.4));
  assert.ok(!b.parts.some(([n]) => n === 'instinct'));
  const ctx = w.ctx(w.get('ana'));
  assert.equal(w.lang.value('talent.cooking', ctx), 0.7);
  assert.equal(w.lang.value('instinct.stroll', ctx), 1.4);
  assert.equal(w.lang.value('talent.cooking', w.ctx(w.get('bo'))), 1);
});

test('practice from the game is an input: a rewind replays it exactly', () => {
  const w = tiny();
  w.skill({ id: 'reading', rate: 0.1 });
  w.person('ana', { home: 'home_a' });
  w.advance(HOUR);
  w.train('ana', 'reading', 3);
  w.setSkill('ana', 'riding', 0.4);
  w.advance(2 * HOUR);
  const h = w.hash(), v = w.skillOf('ana', 'reading');
  w.rewind(150);
  assert.equal(w.skillOf('ana', 'reading'), 0);
  w.advance(150);
  assert.equal(w.hash(), h);
  assert.equal(w.skillOf('ana', 'reading'), v);
  assert.equal(w.skillOf('ana', 'riding'), 0.4);
});
