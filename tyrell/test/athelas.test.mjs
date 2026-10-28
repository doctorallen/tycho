// Athelas: conditions that run a course (ale wearing off, a cold, a toxin),
// with phases that change needs' rise, weigh and rule out actions, give
// feelings, spread by company and leave immunity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tyrell, tiny, until, HOUR, DAY } from './helpers.mjs';

function cold(w, extra = {}) {
  w.athelas.course({
    id: 'cold', label: 'A cold', tags: ['illness'], immunity: 2 * DAY, then: ['var.colds+=1'],
    phases: [
      { id: 'coming_on', label: 'coming on', minutes: 6 * HOUR, spreads: false },
      { id: 'sniffles', label: 'the sniffles', minutes: 12 * HOUR, rates: { energy: 2 }, weigh: { sleep: 1.5, '*': 0.5 }, blocks: ['stroll'] },
    ],
    ...extra,
  });
}

test('a course runs its phases in order, then passes and leaves immunity', () => {
  const w = tiny();
  cold(w);
  w.person('ana', { home: 'home_a' });
  const seen = [];
  for (const k of ['afflicted', 'course', 'recovered']) w.on(k, (e) => seen.push(`${k} ${e.phase ?? e.course}`));
  assert.equal(w.athelas.afflict('ana', 'cold'), true);
  const ctx = () => w.ctx(w.get('ana'));
  assert.equal(w.lang.value('under:cold', ctx()), 'coming_on');
  assert.equal(w.lang.value('under:tag:illness', ctx()), true);
  assert.equal(w.athelas.afflict('ana', 'cold'), false, 'already has it');
  w.advance(6 * HOUR + 1);
  assert.equal(w.lang.value('under:cold', ctx()), 'sniffles');
  assert.match(w.describe('ana'), /under: A cold \(the sniffles, until day 1 02:00\)/);
  w.advance(12 * HOUR);
  assert.equal(w.lang.value('under:cold', ctx()), false);
  assert.deepEqual(seen, ['afflicted cold', 'course coming_on', 'course sniffles', 'recovered cold']);
  assert.equal(w.get('ana').vars.colds, 1);
  assert.equal(w.lang.value('immune:cold', ctx()), true);
  assert.equal(w.athelas.afflict('ana', 'cold'), false, 'immune for a while');
  w.advance(2 * DAY);
  assert.equal(w.athelas.afflict('ana', 'cold'), true);
});

test('a phase changes how fast needs rise, and the levels carry on smoothly across its edges', () => {
  const build = () => {
    const w = Tyrell.create({ seed: 's', start: 8 * HOUR, modules: ['athelas'] });
    w.need({ id: 'energy', rise: 0.04, start: 0 });
    w.place({ id: 'room' });
    w.action({ id: 'sit', at: 'room', minutes: 600, base: 0.1 });
    w.athelas.course({ id: 'flu', phases: [{ id: 'weak', minutes: 3 * HOUR, rates: { energy: 3 } }] });
    w.person('ana', { place: 'room' });
    return w;
  };
  const a = build(), b = build();
  a.advance(HOUR); b.advance(HOUR);
  a.athelas.afflict('ana', 'flu');
  const at = (w) => w.needOf('ana', 'energy');
  a.advance(2 * HOUR); b.advance(2 * HOUR);
  assert.ok(Math.abs(at(a) - (0.04 + 0.04 * 3 * 2)) < 1e-9, `three times as fast (${at(a)})`);
  assert.ok(Math.abs(at(b) - 0.12) < 1e-9);
  a.advance(HOUR - 0.001);
  const before = at(a);
  a.advance(0.002);
  assert.ok(Math.abs(at(a) - before) < 1e-4, 'no jump when it passes');
  a.advance(HOUR);
  assert.ok(Math.abs(at(a) - (0.04 + 0.36 + 0.04)) < 1e-6, 'back to the usual rate');
});

test('a phase weighs options and rules some out', () => {
  const w = tiny();
  cold(w);
  w.person('ana', { home: 'home_a' });
  w.athelas.afflict('ana', 'cold');
  w.advance(6 * HOUR + 1);
  const p = w.get('ana');
  const sleep = w.mind.explain(p, 'sleep')[0], loaf = w.mind.explain(p, 'loaf')[0];
  assert.ok(sleep.parts.some(([n, v]) => n === 'A cold: the sniffles' && v === 1.5));
  assert.ok(loaf.parts.some(([n, v]) => n === 'A cold: the sniffles' && v === 0.5));
  assert.equal(w.mind.explain(p, 'stroll')[0].blocked, 'A cold: the sniffles');
});

test('a phase that stops them sends them to choose again at once', () => {
  const w = tiny();
  w.action({ id: 'rest_up', at: 'home', minutes: 120, base: 0.01 });
  w.athelas.course({ id: 'flu', phases: [{ id: 'laid_up', minutes: DAY, stop: true, weigh: { rest_up: 50 }, blocks: ['stroll', 'eat'] }] });
  w.person('ana', { home: 'home_a', place: 'park', needs: { hunger: 0, energy: 0 } });
  w.direct('ana', { do: 'stroll' });
  assert.ok(until(w, () => w.get('ana').doing?.kind === 'act' && w.get('ana').doing.action === 'stroll', HOUR, 1));
  w.athelas.afflict('ana', 'flu');
  w.advance(1);
  const d = w.get('ana').doing;
  assert.notEqual(d.action, 'stroll');
  assert.ok(until(w, () => w.get('ana').doing?.action === 'rest_up', HOUR, 1), 'home to rest');
});

test('afflicted again: ignored, extended or restarted, as the course says', () => {
  const w = tiny();
  w.athelas.course({ id: 'ale', label: 'Ale', again: 'extend', phases: [{ id: 'merry', minutes: 60 }, { id: 'sore_head', minutes: 120 }] });
  w.athelas.course({ id: 'scare', again: 'restart', phases: [{ id: 'shaken', minutes: 60 }, { id: 'wary', minutes: 60 }] });
  w.person('ana', { home: 'home_a' });
  w.athelas.afflict('ana', 'ale');
  w.advance(30);
  w.athelas.afflict('ana', 'ale');          // another pint
  w.advance(60);
  assert.equal(w.athelas.of('ana')[0].phase, 'merry', 'still merry at an hour and a half');
  w.advance(31);
  assert.equal(w.athelas.of('ana')[0].phase, 'sore_head');
  w.athelas.afflict('ana', 'scare');
  w.advance(90);
  assert.equal(w.athelas.of('ana').find((c) => c.course === 'scare').phase, 'wary');
  w.athelas.afflict('ana', 'scare');
  assert.equal(w.athelas.of('ana').find((c) => c.course === 'scare').phase, 'shaken');
});

test('a course can be caught from company, unless they\'re immune or it isn\'t catching yet', () => {
  const w = tiny();
  w.need({ id: 'company', rise: 0.1, urgent: 1.1 });
  w.action({ id: 'natter', at: 'cafe', slot: 'seat', minutes: 120, relieves: { company: 0.5 }, base: 0.3 });
  cold(w, { contagion: { chance: 0.9, resist: [{ input: 'trait.hardy', out: [1, 0] }] } });
  w.person('ana', { home: 'home_a', place: 'cafe', needs: { hunger: 0, energy: 0, company: 1 } });
  w.person('bo', { home: 'home_a', place: 'cafe', needs: { hunger: 0, energy: 0, company: 1 } });
  w.person('cy', { home: 'home_a', place: 'cafe', traits: { hardy: 1 }, needs: { hunger: 0, energy: 0, company: 1 } });
  w.athelas.afflict('ana', 'cold');
  w.advance(5 * HOUR);
  assert.equal(w.athelas.of('bo').length, 0, 'not catching while it comes on');
  const caught = [];
  w.on('afflicted', (e) => caught.push(`${e.id} from ${e.from}`));
  assert.ok(until(w, () => w.athelas.of('bo').length > 0, 12 * HOUR, 10), 'Bo caught it');
  assert.ok(caught.includes('bo from ana'));
  assert.equal(w.athelas.of('cy').length, 0, 'the hardy one never does');
});

test('a cure ends it at once, without its effects, and leaves immunity; a phase can give a feeling', () => {
  const w = tiny();
  w.reverie.feeling({ id: 'poorly', label: 'Feeling poorly', weight: -0.1, minutes: DAY });
  cold(w);
  w.athelas.courses.get('cold').phases[1].feel = 'poorly';
  w.person('ana', { home: 'home_a' });
  w.athelas.afflict('ana', 'cold');
  w.advance(7 * HOUR);
  assert.ok(w.reverie.feelings('ana').some((f) => f.id === 'poorly'));
  const cured = [];
  w.on('recovered', (e) => cured.push(e.cured));
  w.athelas.cure('ana');
  assert.deepEqual(cured, [true]);
  assert.equal(w.athelas.of('ana').length, 0);
  assert.equal(w.get('ana').vars.colds, undefined, 'a cure is not the course run out');
  assert.ok(w.athelas.immune('ana', 'cold'));
});

test('a phase can be hastened: a visit or a remedy that helps', () => {
  const w = tiny();
  cold(w);
  w.person('ana', { home: 'home_a' });
  w.athelas.afflict('ana', 'cold');
  w.advance(7 * HOUR);
  const until = w.athelas.of('ana')[0].until;
  w.athelas.hasten('ana', 'cold', 4 * HOUR);
  assert.equal(w.athelas.of('ana')[0].until, until - 4 * HOUR);
  w.advance(until - 4 * HOUR - w.now + 1);
  assert.equal(w.athelas.of('ana').length, 0, 'over sooner');
});

test('courses are state: they rewind and save, and a world without them keeps none', () => {
  const build = () => {
    const w = tiny();
    w.need({ id: 'company', rise: 0.1, urgent: 1.1 });
    w.action({ id: 'natter', at: 'cafe', slot: 'seat', minutes: 90, relieves: { company: 0.5 } });
    cold(w, { contagion: { chance: 0.3 } });
    w.person('ana', { home: 'home_a' });
    w.person('bo', { home: 'home_b' });
    return w;
  };
  const plain = build();
  plain.advance(DAY);
  assert.equal(plain.s.mod.athelas, undefined);
  const a = build(), b = build();
  a.athelas.afflict('ana', 'cold'); b.athelas.afflict('ana', 'cold');
  a.advance(DAY); b.advance(DAY);
  assert.equal(a.hash(), b.hash());
  const h = a.hash();
  a.rewind(8 * HOUR); a.advance(8 * HOUR);
  assert.equal(a.hash(), h);
  const c = build();
  c.load(JSON.stringify(a.save()));
  a.advance(DAY); c.advance(DAY);
  assert.equal(c.hash(), a.hash());
});
