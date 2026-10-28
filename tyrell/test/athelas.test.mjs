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

// ---------------------------------------------------------------------------
// Athelas, grown: severity, worsening, branches, care, ending badly, quiet
// phases (all opt-in: a course without them runs as it always did)
// ---------------------------------------------------------------------------

/** One person in a room, energy rising, a course to give them. */
function room(course, opts = {}) {
  const w = Tyrell.create({ seed: 's', start: 8 * HOUR, modules: opts.modules ?? ['athelas'], moduleConfig: opts.moduleConfig });
  w.need({ id: 'energy', rise: 0.04, start: 0 });
  w.place({ id: 'room' });
  w.action({ id: 'sit', at: 'room', minutes: 2000, base: 0.1 });
  w.action({ id: 'nap', at: 'room', minutes: 60, base: 0.1 });
  if (course) w.athelas.course(course);
  for (const id of opts.people ?? ['ana']) w.person(id, { place: 'room', ...(opts.def?.[id] || {}) });
  return w;
}

test('severity stretches a course\'s phases and deepens what they do; sev reads it', () => {
  const bruise = { id: 'bruise', phases: [{ id: 'sore', minutes: 120, rates: { energy: 2 }, weigh: { nap: 1.5 } }] };
  const at = (sev) => { const w = room(bruise); w.athelas.afflict('ana', 'bruise', undefined, sev); return w; };
  const len = (w) => { const c = w.athelas.of('ana')[0]; return c.until - c.since; };
  assert.equal(len(at(undefined)), 120, 'without a severity, as written');
  assert.equal(len(at(0.5)), 120, 'at sevAt, as written');
  assert.equal(len(at(1)), 240, 'twice as long at 1');
  assert.equal(len(at(0)), 60, 'half as long at 0');
  const w = at(1);
  const ctx = () => w.ctx(w.get('ana'));
  assert.equal(w.athelas.of('ana')[0].severity, 1);
  assert.equal(w.lang.value('sev:bruise', ctx()), 1);
  assert.equal(w.lang.value('sev:nothing', ctx()), 0, 'not running: 0');
  assert.equal(w.lang.value('sev:bruise', room(bruise, {}).ctx()), 0);
  w.advance(60);
  assert.ok(Math.abs(w.needOf('ana', 'energy') - 0.04 * 4) < 1e-9, `rates twice as deep: 2 squared (${w.needOf('ana', 'energy')})`);
  const nap = w.mind.explain(w.get('ana'), 'nap')[0];
  assert.ok(nap.parts.some(([n, v]) => n === 'bruise' && Math.abs(v - 2.25) < 1e-6), 'weights twice as deep: 1.5 squared');
  const plain = at(undefined);
  assert.equal(plain.lang.value('sev:bruise', plain.ctx(plain.get('ana'))), 0.5, 'a course with no severity reads as the one it\'s written for');
  assert.equal(plain.athelas.of('ana')[0].severity, undefined);
  // the effect takes a severity too
  const e = room(bruise);
  e.internally(() => e.lang.apply('afflict:bruise=0.75', e.ctx(e.get('ana'))));
  assert.equal(e.athelas.of('ana')[0].severity, 0.75);
  // and its own numbers, over the config's
  const own = room({ ...bruise, severity: { stretch: 1, depth: 0 } });
  own.athelas.afflict('ana', 'bruise', undefined, 1);
  assert.equal(len(own), 120, 'a course whose severity stretches nothing');
});

test('again: worsen adds to the severity, up to 1, and the phase they\'re in runs as long as it would at the new one', () => {
  const w = room({ id: 'beating', again: 'worsen', phases: [{ id: 'hurting', minutes: 100 }, { id: 'aching', minutes: 100 }] });
  const seen = [];
  w.on('afflicted', (e) => seen.push(e.again ?? 'new'));
  w.athelas.afflict('ana', 'beating', 'bo', 0.5);
  w.advance(50);
  w.athelas.afflict('ana', 'beating', 'bo', 0.3);
  const c = w.athelas.of('ana')[0];
  assert.equal(c.severity, 0.8);
  assert.ok(Math.abs(c.until - c.since - 100 * Math.pow(2, 0.6)) < 1e-3, 'stretched to the new severity');
  w.athelas.afflict('ana', 'beating', 'bo', 0.5);
  assert.equal(w.athelas.of('ana')[0].severity, 1, 'never past 1');
  assert.deepEqual(seen, ['new', 'worsen', 'worsen']);
});

test('branches: a phase\'s next by conditions, so a tended cut heals and an untended one festers', () => {
  const cut = { id: 'cut', phases: [
    { id: 'bleeding', minutes: 60, next: [{ if: ['tended:cut'], to: 'healing' }, { to: 'festering' }] },
    { id: 'festering', minutes: 120, next: 'healing' },
    { id: 'healing', minutes: 60, next: null },
    { id: 'never', minutes: 60 },
  ] };
  const w = room(cut, { people: ['ana', 'bo'] });
  w.athelas.afflict('ana', 'cut');
  w.athelas.afflict('bo', 'cut');
  const tended = [];
  w.on('tended', (e) => tended.push(e));
  w.athelas.tend('ana', 'cut', 'bo');
  assert.equal(w.lang.value('tended:cut', w.ctx(w.get('ana'))), 0.5, 'tendBase, with no skill to make it better');
  assert.equal(w.athelas.of('ana')[0].until, 8 * HOUR + 60 - 60 * 0.25 * 0.5, 'and the phase ends sooner');
  assert.equal(tended.length, 1);
  w.advance(61);
  assert.equal(w.athelas.of('ana')[0].phase, 'healing');
  assert.equal(w.athelas.of('bo')[0].phase, 'festering');
  w.advance(120);
  assert.equal(w.athelas.of('bo')[0].phase, 'healing', 'next by name');
  w.advance(61);
  assert.equal(w.athelas.of('bo').length, 0, 'next null: it passes (never reaching the phase after)');
});

test('care is the better for skill; the effect tends the target, or themselves', () => {
  const w = room({ id: 'cut', phases: [{ id: 'bleeding', minutes: 600 }] }, { people: ['ana', 'doc', 'cy'], moduleConfig: { athelas: { tendSkill: 'medicine' } }, def: { doc: { skills: { medicine: 0.8 } } } });
  w.skill({ id: 'medicine' });
  w.athelas.afflict('ana', 'cut');
  w.athelas.afflict('cy', 'cut');
  w.athelas.tend('ana', undefined, 'doc');
  assert.ok(Math.abs(w.athelas.of('ana')[0].tended - 0.9) < 1e-9, '0.5, and half the rest by skill');
  w.internally(() => w.lang.apply('tend', w.ctx(w.get('doc'), { target: 'cy' })));
  assert.ok(Math.abs(w.athelas.of('cy')[0].tended - 0.9) < 1e-9, 'the person tends the target');
  w.internally(() => w.lang.apply('tend', w.ctx(w.get('cy'))));
  assert.ok(Math.abs(w.athelas.of('cy')[0].tended - 0.9) < 1e-9, 'a worse tending doesn\'t undo a better one');
  w.athelas.tend('nobody');
  assert.equal(w.s.mod.athelas.on.nobody, undefined);
});

test('a phase that ends in death: through Cradle; without it, they pull through to its next', () => {
  const plague = { id: 'plague', phases: [{ id: 'gravely', minutes: 60, dies: 'the plague', next: 'recovering' }, { id: 'recovering', minutes: 60 }] };
  const w = room(plague, { modules: ['athelas', 'cradle'] });
  const gone = [];
  w.on('gone', (e) => gone.push(e));
  w.athelas.afflict('ana', 'plague');
  w.advance(61);
  assert.equal(w.get('ana').status, 'gone');
  assert.deepEqual(gone.map((e) => e.why), ['the plague']);
  assert.equal(w.cradle.departed().ana.why, 'the plague');
  const lives = room(plague);
  lives.athelas.afflict('ana', 'plague');
  lives.advance(61);
  assert.equal(lives.get('ana').status, 'active');
  assert.equal(lives.athelas.of('ana')[0].phase, 'recovering', 'no Cradle: they pull through');
});

test('quiet phases: nobody notices (no feeling, under reads nothing); a phase that tells shows', () => {
  const w = room({ id: 'nightshade', phases: [{ id: 'working', minutes: 60, quiet: true, feel: 'sick', rates: { energy: 3 } }, { id: 'sick', minutes: 60, tells: true, feel: 'sick' }] }, { modules: ['athelas', 'reverie'] });
  w.reverie.feeling({ id: 'sick', label: 'Sick', weight: -0.2, minutes: DAY });
  const shows = [];
  w.on('shows', (e) => shows.push(e.phase));
  w.athelas.afflict('ana', 'nightshade');
  const ctx = () => w.ctx(w.get('ana'));
  assert.equal(w.lang.value('under:nightshade', ctx()), false, 'quiet: not known');
  assert.equal(w.lang.value('under', ctx()), 0);
  assert.equal(w.athelas.of('ana')[0].quiet, true, 'the truth, for the game');
  assert.equal(w.reverie.feelings('ana').length, 0, 'no feeling');
  w.advance(30);
  assert.ok(w.needOf('ana', 'energy') > 0.04 * 0.5 * 2.9, 'it works all the same');
  w.advance(31);
  assert.equal(w.lang.value('under:nightshade', ctx()), 'sick');
  assert.deepEqual(shows, ['sick']);
  assert.ok(w.reverie.feelings('ana').some((f) => f.id === 'sick'));
});

test('a phase only some go through: passed over when its conditions don\'t hold, as it would start', () => {
  // ale by how much is in them: well in drink past 0.6, tipsy past 0.45, mellow below
  const ale = { id: 'ale', again: 'restart', severity: { stretch: 1, depth: 0 }, phases: [
    { id: 'merry', if: ['sev:ale>0.6'], minutes: 60, rates: { energy: 2 } },
    { id: 'tipsy', if: ['sev:ale>0.45'], minutes: 60 },
    { id: 'mellow', minutes: 60 },
  ] };
  const w = room(ale);
  const seen = [];
  w.on('course', (e) => seen.push(e.phase));
  w.athelas.afflict('ana', 'ale', undefined, 0.3);
  assert.equal(w.athelas.of('ana')[0].phase, 'mellow', 'a pint: neither merry nor tipsy');
  assert.deepEqual(seen, ['mellow'], 'the phases passed over aren\'t told');
  w.advance(30);
  assert.equal(w.athelas.afflict('ana', 'ale', undefined, 0.7), true);
  assert.equal(w.athelas.of('ana')[0].phase, 'merry', 'restarted, and well in drink now');
  w.advance(61);
  assert.equal(w.athelas.of('ana')[0].phase, 'tipsy');
  // a course whose every phase is passed over passes at once
  const none = room({ id: 'odd', phases: [{ id: 'only', if: ['sev:odd>0.9'], minutes: 60 }] });
  const rec = [];
  none.on('recovered', (e) => rec.push(e.course));
  assert.equal(none.athelas.afflict('ana', 'odd', undefined, 0.2), true);
  assert.deepEqual(none.athelas.of('ana'), []);
  assert.deepEqual(rec, ['odd']);
  // passed over by its branches, too; and a loop of them ends after one round
  const loop = room({ id: 'loop', phases: [
    { id: 'a', if: ['sev:loop>0.9'], minutes: 60, next: 'b' },
    { id: 'b', if: ['sev:loop>0.9'], minutes: 60, next: 'a' },
  ] });
  loop.athelas.afflict('ana', 'loop', undefined, 0.2);
  assert.equal(loop.athelas.of('ana').length, 1, 'entered after one round');
});
