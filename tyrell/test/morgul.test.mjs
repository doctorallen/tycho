// Morgul: harm between people. Wounds as Athelas courses carrying their
// severity, hurt, down and dead, the victim, onlookers and the law, traps,
// poison, suspicion, fights by numbers, fights with the player, what people
// choose by it, the knobs, and determinism and time walk through all of it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tyrell, rocinante, until, HOUR, DAY } from './helpers.mjs';

const ALL = ['reverie', 'fellowship', 'wormtongue', 'mentat', 'ceres', 'cradle', 'athelas', 'bree', 'morgul'];
const events = (w, kind) => { const out = []; w.on(kind, (e) => out.push(e)); return out; };
const round = (x) => Math.round(x * 1e4) / 1e4;

/**
 * A yard where three people stand about all day (Ana, Bo, Cy), a cafe with
 * a cook and a pot of stew, a barn out on the farm, homes; bruises, cuts and
 * nightshade, a knife, a cudgel and a snare.
 */
function yard(opts = {}) {
  const w = Tyrell.create({ seed: opts.seed ?? 'yard', start: 8 * HOUR, modules: opts.modules ?? ALL, moduleConfig: opts.moduleConfig, esper: opts.esper });
  w.place({ id: 'yard', region: 'town' });
  w.place({ id: 'barn', region: 'farm' });
  w.place({ id: 'cafe', region: 'town', owner: 'cook', stock: { stew: 10 } });
  for (const h of ['home_a', 'home_b', 'home_c', 'home_k']) { w.place({ id: h, region: 'town', tags: ['home'] }); w.link(h, 'yard', 3); }
  w.link('yard', 'barn', 10); w.link('yard', 'cafe', 2);
  w.action({ id: 'loiter', at: 'yard', minutes: 60, base: 0.01 });
  w.action({ id: 'potter', at: 'barn', minutes: 30, rank: -1 });
  w.action({ id: 'cook', at: 'cafe', minutes: 60, rank: -1, job: 'cook' });
  w.action({ id: 'eat_stew', at: 'cafe', minutes: 20, rank: -1, uses: { stew: 1 }, store: 'here', tags: ['food'] });
  w.action({ id: 'buy_stew', at: 'cafe', minutes: 5, rank: -1, buys: { stew: 2 } });
  w.action({ id: 'eat_home', at: 'home', minutes: 20, rank: -1, uses: { stew: 1 }, tags: ['food'] });
  const A = w.athelas, M = w.morgul;
  if (A) {
    A.course({ id: 'bruised', again: 'worsen', phases: [{ id: 'sore', minutes: 120 }, { id: 'stiff', minutes: 240, hurts: 0.5 }] });
    A.course({ id: 'cut', again: 'worsen', phases: [{ id: 'bleeding', minutes: 60 }] });
    A.course({ id: 'nightshade', phases: [{ id: 'working', minutes: 120, quiet: true }, { id: 'sick', minutes: 240, tells: true }] });
  }
  if (M) {
    M.means({ id: 'knife', kinds: ['cut'], use: 'strike', severity: 0.3 });
    M.means({ id: 'cudgel', kinds: ['blunt'], use: 'strike', severity: 0.2 });
    M.means({ id: 'nightshade', kinds: ['poison'], use: 'dose', course: 'nightshade', severity: 0.4 });
    M.wound({ id: 'bruised', kinds: ['blunt'], course: 'bruised' });
    M.wound({ id: 'cut', kinds: ['cut'], course: 'cut' });
    M.trap({ id: 'snare', kind: 'cut', severity: 0.2, catch: 1 });
  }
  const stay = [[0, 'yard', 'loiter']];
  w.person('ana', { name: 'Ana', home: 'home_a', place: 'yard', routine: stay, traits: { temper: 0.9, courage: 0.8 }, ...(opts.ana || {}) });
  w.person('bo', { name: 'Bo', home: 'home_b', place: 'yard', routine: stay, traits: { temper: 0.2, courage: 0.2 }, ...(opts.bo || {}) });
  w.person('cy', { name: 'Cy', home: 'home_c', place: 'yard', routine: stay, ...(opts.cy || {}) });
  w.person('cook', { name: 'Kit', home: 'home_k', place: 'cafe', job: { id: 'cook', place: 'cafe', action: 'cook', shifts: [[0, 24]] }, ...(opts.cook || {}) });
  return w;
}

// ---------------------------------------------------------------------------
// Inert
// ---------------------------------------------------------------------------

test('inert: Morgul on, its means, wounds and traps declared, but no harm: no state, and the world hashes as if it were off', () => {
  const run = (modules) => { const w = yard({ modules }); w.advance(DAY); return w; };
  const on = run(ALL), off = run(ALL.filter((m) => m !== 'morgul'));
  assert.equal(on.s.mod.morgul, undefined);
  assert.equal(on.hash(), off.hash());
  assert.equal(on.lang.value('hurt', on.ctx(on.get('ana'))), 0);
  assert.equal(on.morgul.harms().length, 0);
  // and with nothing declared at all, Bree's fights are Bree's own
  const plain = Tyrell.create({ seed: 'p' });
  assert.equal(plain.morgul.used, false);
  assert.equal(plain.morgul.fights('fight'), false);
});

// ---------------------------------------------------------------------------
// Wounds, hurt, down and dead
// ---------------------------------------------------------------------------

test('a harm leaves a wound: an Athelas course at its severity; hurt is their sum, easing as each heals; a second worsens it', () => {
  const w = yard();
  const seen = events(w, 'morgul:harm');
  const v = w.morgul.harm({ to: 'ana', by: 'bo', kind: 'blunt', severity: 0.2 });
  assert.equal(v.wound, 'bruised');
  assert.equal(v.course, 'bruised');
  assert.equal(v.hurt, 0.2);
  assert.equal(v.via, 'blow');
  assert.equal(v.intent, 'meant');
  assert.deepEqual(v.seenBy, ['cy'], 'everyone there but the two of them');
  assert.equal(w.athelas.of('ana')[0].severity, 0.2);
  w.morgul.harm({ to: 'ana', by: 'bo', kind: 'blunt', severity: 0.3 });
  assert.equal(w.morgul.hurt('ana'), 0.5, 'two beatings are worse than one');
  w.morgul.harm({ to: 'ana', by: 'cy', kind: 'cut', severity: 0.1, what: 'knife' });
  assert.equal(w.morgul.hurt('ana'), 0.6, 'the sum of open wounds');
  assert.deepEqual(w.morgul.wounds('ana').map((x) => [x.wound, x.severity, x.by]), [['bruised', 0.5, ['bo']], ['cut', 0.1, ['cy']]]);
  assert.equal(w.lang.value('wounded:cut', w.ctx(w.get('ana'))), 0.1);
  assert.equal(w.lang.value('wounded', w.ctx(w.get('ana'))), 0.6);
  w.advance(125);
  assert.equal(w.morgul.hurt('ana'), 0.25, 'the cut has healed, the bruise is only stiff now (half)');
  w.advance(5 * HOUR);
  assert.equal(w.morgul.hurt('ana'), 0);
  assert.equal(w.morgul.wounds('ana').length, 0);
  assert.equal(seen.length, 3);
  assert.equal(w.morgul.harm({ to: 'nobody', severity: 1 }), null, 'nobody struck: nothing');
});

test('down at downAt: they stop and lie there, everything else ruled out, till they come round or someone helps them up', () => {
  const w = yard();
  const downs = events(w, 'morgul:down'), ups = events(w, 'morgul:up');
  w.morgul.harm({ to: 'ana', by: 'bo', kind: 'blunt', severity: 0.85 });
  assert.equal(w.morgul.isDown('ana'), true);
  assert.equal(downs.length, 1);
  w.advance(1);
  assert.equal(w.get('ana').doing.action, 'down');
  assert.equal(w.body('ana').pose, 'down');
  assert.equal(w.lang.value('down', w.ctx(w.get('ana'))), true);
  assert.equal(w.mind.explain(w.get('ana'), 'loiter')[0].blocked, 'down');
  assert.ok(until(w, () => !w.morgul.isDown('ana'), 2 * HOUR, 1), 'they come round');
  assert.deepEqual(ups.map((e) => e.why), ['came round']);
  w.advance(1);
  assert.equal(w.get('ana').doing.action, 'loiter', 'and get on');
  // helped up
  w.morgul.harm({ to: 'cy', by: 'bo', kind: 'blunt', severity: 0.9 });
  w.advance(1);
  w.morgul.tend('cy', 'ana');
  assert.equal(w.morgul.isDown('cy'), false);
  assert.equal(ups[1].why, 'helped up');
  assert.equal(ups[1].by, 'ana');
  assert.ok(w.athelas.of('cy')[0].tended > 0, 'their wound tended (Athelas)');
  assert.ok(w.reverie.feelings('cy').some((f) => f.id === 'cared_for'));
  w.advance(1);
  assert.notEqual(w.get('cy').doing.action, 'down');
});

test('lethality 0: nobody dies of harm, even at its worst; raised, through Cradle, a killing and a crime', () => {
  const w = yard();
  w.morgul.harm({ to: 'ana', by: 'bo', kind: 'blunt', severity: 1 });
  w.morgul.harm({ to: 'ana', by: 'bo', kind: 'cut', severity: 1 });
  w.advance(10);
  assert.equal(w.get('ana').status, 'active', 'down, not dead');
  assert.ok(w.morgul.isDown('ana'));
  const k = yard({ moduleConfig: { morgul: { lethality: 2, crimes: { killed: 'murder' } } } });
  k.wormtongue.crime({ kind: 'murder', severity: 1 });
  const killed = events(k, 'morgul:killed'), gone = events(k, 'gone');
  k.morgul.harm({ to: 'ana', by: 'bo', kind: 'blunt', severity: 1 });
  k.advance(1);
  assert.equal(k.get('ana').status, 'gone');
  assert.equal(k.cradle.departed().ana.why, 'killed');
  assert.deepEqual(killed.map((e) => [e.id, e.by]), [['ana', 'bo']]);
  assert.deepEqual(gone.map((e) => e.why), ['killed']);
  assert.equal(k.reverie.belief('cy', 'did:bo:murder'), 'ana', 'whoever saw it saw a murder');
  assert.ok(k.reverie.memories('cy').some((m) => m.k === 'killed' && m.about === 'bo'), 'and remembers who did it');
  // without Cradle nobody can die
  const nc = yard({ modules: ALL.filter((m) => m !== 'cradle'), moduleConfig: { morgul: { lethality: 2 } } });
  nc.morgul.harm({ to: 'ana', by: 'bo', kind: 'blunt', severity: 1 });
  nc.advance(1);
  assert.equal(nc.get('ana').status, 'active');
});

test('a wound\'s phase that ends in death kills only as often as lethality says', () => {
  const build = (lethality) => {
    const w = yard({ moduleConfig: { morgul: { lethality } } });
    w.athelas.course({ id: 'gash', phases: [{ id: 'gone_bad', minutes: 60, dies: true, next: 'healing' }, { id: 'healing', minutes: 60 }] });
    w.morgul.wound({ id: 'gash', kinds: ['gash'], course: 'gash' });
    w.morgul.harm({ to: 'ana', by: 'bo', kind: 'gash', severity: 0.5 });
    w.advance(61);
    return w;
  };
  const spared = build(0);
  assert.equal(spared.get('ana').status, 'active');
  assert.equal(spared.athelas.of('ana')[0].phase, 'healing', 'spared: they pull through');
  const lost = build(1);
  assert.equal(lost.get('ana').status, 'gone');
  assert.equal(lost.cradle.departed().ana.why, 'died');
});

// ---------------------------------------------------------------------------
// The victim, the onlookers and the law
// ---------------------------------------------------------------------------

test('the victim: pain, anger or fear by their temper, a memory, who did it, a grudge, fear of them and of the place, less regard', () => {
  const w = yard();
  const ctx = (id, target) => w.ctx(w.get(id), { target });
  w.morgul.harm({ to: 'ana', by: 'bo', kind: 'blunt', severity: 0.3 });
  const felt = w.reverie.feelings('ana').map((f) => f.id).sort();
  assert.deepEqual(felt, ['furious', 'in_pain', 'shaken'], 'a hot temper: furious');
  assert.ok(w.reverie.memories('ana').some((m) => m.k === 'harmed' && m.about === 'bo'));
  assert.equal(w.reverie.belief('ana', 'did:bo:harm'), 'ana');
  assert.equal(w.bree.grudge('ana', 'bo'), 0.45, 'severity × 1.5');
  assert.equal(w.lang.value('hurt_by', ctx('ana', 'bo')), 0.3);
  assert.equal(w.lang.value('afraid_of:bo', ctx('ana')), 0.21, 'the brave fear less');
  assert.equal(w.lang.value('danger', ctx('ana')), 0.3, 'wary of the yard');
  assert.equal(w.fellowship.regard('ana', 'bo'), -0.18);
  assert.equal(w.lang.value('file:bo.harmed', ctx('ana')), 1);
  // the timid are scared, not furious
  w.morgul.harm({ to: 'bo', by: 'cy', kind: 'blunt', severity: 0.1 });
  assert.ok(w.reverie.feelings('bo').some((f) => f.id === 'scared'));
  // none for a blow they started themselves: harm done in self-defense
  w.morgul.harm({ to: 'ana', by: 'cy', kind: 'blunt', severity: 0.3, intent: 'defense' });
  assert.equal(w.bree.grudge('ana', 'cy'), 0);
  assert.equal(w.morgul.held('ana', 'cy'), 0);
  // an accident nobody did: pain, and no one to blame
  const sus = events(w, 'morgul:suspect');
  w.morgul.harm({ to: 'cy', kind: 'blunt', severity: 0.2, via: 'fall' });
  assert.ok(w.reverie.feelings('cy').some((f) => f.id === 'in_pain'));
  assert.equal(sus.length, 0, 'nobody suspects anyone of an accident');
  assert.ok(w.morgul.suspects('cy').every((x) => x.to !== 'cy'));
});

test('onlookers: what they saw, a memory, less regard; a crime the game declares per intent, through Wormtongue with its severity; self-defense none', () => {
  const w = yard({ moduleConfig: { morgul: { crimes: { meant: 'assault', careless: 'negligence' } } }, cy: { traits: { lawful: 1, courage: 1 } } });
  w.wormtongue.crime({ kind: 'assault', severity: 0.5, report: 1 });
  w.wormtongue.crime({ kind: 'negligence', severity: 0.2, report: 1 });
  w.morgul.harm({ to: 'ana', by: 'bo', kind: 'blunt', severity: 0.4 });
  assert.equal(w.reverie.belief('cy', 'did:bo:assault'), 'ana', 'Wormtongue\'s witness');
  assert.ok(w.reverie.memories('cy').some((m) => m.k === 'saw:assault'));
  assert.equal(w.fellowship.regard('cy', 'bo'), -0.12);
  w.advance(2 * HOUR);
  const reports = w.wormtongue.reports('bo').length;
  assert.ok(reports >= 1);
  assert.equal(w.wormtongue.heat('bo'), 4 * reports, 'each report at the harm\'s severity (0.4 × 10)');
  w.morgul.harm({ to: 'bo', by: 'ana', kind: 'blunt', severity: 0.2, intent: 'careless' });
  assert.equal(w.reverie.belief('cy', 'did:ana:negligence'), 'bo');
  w.morgul.harm({ to: 'ana', by: 'cy', kind: 'blunt', severity: 0.3, intent: 'defense' });
  assert.equal(w.reverie.belief('bo', 'did:cy:assault'), undefined, 'self-defense isn\'t a crime');
  assert.equal(w.reverie.belief('bo', 'did:cy:harm'), 'ana', 'though they saw it');
  // a harm the game calls no crime: Morgul's own witnesses
  const plain = yard();
  plain.morgul.harm({ to: 'ana', by: 'bo', kind: 'blunt', severity: 0.3 });
  assert.equal(plain.reverie.belief('cy', 'did:bo:harm'), 'ana');
  assert.ok(plain.reverie.feelings('cy').some((f) => f.id === 'saw_harm'));
  assert.ok(plain.reverie.memories('cy').some((m) => m.k === 'saw:harm' && m.about === 'bo'));
});

// ---------------------------------------------------------------------------
// Traps
// ---------------------------------------------------------------------------

test('traps: set at a place, known by whoever saw it set, catching whoever comes by off screen (not those who know, only whoever it\'s for)', () => {
  const w = yard();
  const sets = events(w, 'morgul:set'), sprung = events(w, 'morgul:sprung');
  const t = w.morgul.set('snare', { by: 'ana', place: 'barn', seenBy: ['bo'] });
  assert.equal(t, 't1');
  assert.deepEqual(w.morgul.traps('barn').map((x) => [x.id, x.kind, x.by, x.known]), [['t1', 'snare', 'ana', ['ana', 'bo']]]);
  assert.equal(w.reverie.belief('bo', 'set:t1'), 'ana', 'who set it');
  assert.equal(w.reverie.belief('bo', 'trap:t1'), 'barn');
  assert.equal(sets.length, 1);
  assert.equal(w.lang.value('danger:barn', w.ctx(w.get('bo'))), 1, 'a place they know is dangerous');
  // bo knows: he isn't caught
  w.direct('bo', { do: 'potter' });
  assert.ok(until(w, () => w.get('bo').doing?.action === 'potter', HOUR, 1));
  assert.equal(sprung.length, 0);
  // cy doesn't
  w.direct('cy', { do: 'potter' });
  assert.ok(until(w, () => sprung.length > 0, HOUR, 1));
  assert.equal(sprung[0].id, 'cy');
  assert.equal(w.morgul.traps().length, 0, 'spent');
  const h = w.morgul.harms('cy')[0];
  assert.equal(h.via, 'trap');
  assert.equal(h.cause, 't1');
  assert.equal(h.by, 'ana');
  assert.equal(w.morgul.hurt('cy'), 0.2);
  // one set for someone catches only them
  w.morgul.set('snare', { by: 'bo', place: 'barn', for: 'ana', seenBy: [] });
  w.direct('cy', { do: 'potter' });
  w.advance(40);
  assert.equal(w.morgul.traps().length, 1, 'not for Cy');
  w.direct('ana', { do: 'potter' });
  assert.ok(until(w, () => w.morgul.traps().length === 0, HOUR, 1), 'Ana is caught');
});

test('traps near the player are the game\'s: off screen only elsewhere; the game springs and disarms; an effect sets one, another disarms', () => {
  const w = yard();
  w.morgul.near(['farm']);
  assert.deepEqual(w.s.mod.morgul.near, ['farm']);
  assert.equal(w.morgul.nearPlace('barn'), true);
  const t = w.morgul.set('snare', { by: 'ana', place: 'barn', seenBy: [] });
  w.direct('cy', { do: 'potter' });
  assert.ok(until(w, () => w.get('cy').doing?.action === 'potter', HOUR, 1));
  w.advance(5);
  assert.equal(w.morgul.traps().length, 1, 'left to the game\'s trigger');
  w.morgul.spring(t, 'cy');
  assert.equal(w.morgul.traps().length, 0);
  assert.equal(w.morgul.harms('cy')[0].via, 'trap');
  w.focus(['town']);
  w.morgul.near();
  assert.deepEqual(w.s.mod.morgul.near, ['town'], 'the regions in focus, recorded');
  // set and disarmed by effects, inside the simulation
  w.internally(() => w.lang.apply('set:snare', w.ctx(w.get('bo'), { place: 'yard' })));
  assert.equal(w.morgul.traps('yard').length, 1);
  assert.deepEqual(w.morgul.traps('yard')[0].known.sort(), w.ring.present('yard').sort(), 'everyone there saw it set');
  w.internally(() => w.lang.apply('disarm', w.ctx(w.get('ana'))));
  assert.equal(w.morgul.traps().length, 0);
  // and by the game
  const d = events(w, 'morgul:disarmed');
  const t2 = w.morgul.set('snare', { by: 'ana', place: 'barn' });
  w.morgul.disarm(t2, 'bo');
  assert.equal(d.length, 1);
  assert.equal(w.morgul.traps().length, 0);
});

// ---------------------------------------------------------------------------
// Poison
// ---------------------------------------------------------------------------

test('poison: tainted servings travel with the goods, afflict whoever eats them quietly, and show when the course tells', () => {
  const w = yard();
  const harms = events(w, 'morgul:harm'), shows = events(w, 'shows');
  const id = w.morgul.taint({ place: 'cafe', item: 'stew', n: 10, course: 'nightshade', by: 'bo', seenBy: [] });
  assert.deepEqual(w.morgul.taints('cafe').map((x) => [x.id, x.n, x.item, x.by]), [[id, 10, 'stew', 'bo']]);
  // bought: two go home with Cy
  w.direct('cy', { do: 'buy_stew' });
  assert.ok(until(w, () => w.morgul.taints().some((x) => x.owner === 'cy'), HOUR, 1));
  assert.equal(w.morgul.taints().find((x) => x.owner === 'cy').n, 2);
  assert.equal(w.morgul.taints('cafe')[0].n, 8);
  // eaten on the spot: Ana has it, and nobody knows
  w.direct('ana', { do: 'eat_stew' });
  assert.ok(until(w, () => harms.some((h) => h.to === 'ana'), HOUR, 1));
  const h = harms.find((x) => x.to === 'ana');
  assert.equal(h.via, 'dose');
  assert.equal(h.shown, false);
  assert.equal(h.course, 'nightshade');
  assert.equal(h.severity, 0.4, 'the means\' severity');
  const ctx = () => w.ctx(w.get('ana'));
  assert.equal(w.lang.value('under:nightshade', ctx()), false);
  assert.equal(w.reverie.feelings('ana').length, 0, 'no pain yet');
  assert.equal(w.lang.value('hurt', ctx()), 0, 'a quiet phase hurts nothing');
  // eaten at home
  w.direct('cy', { do: 'eat_home' });
  assert.ok(until(w, () => harms.some((x) => x.to === 'cy'), HOUR, 1));
  // it tells
  assert.ok(until(w, () => shows.length > 0, 3 * HOUR, 5));
  assert.equal(w.lang.value('under:nightshade', ctx()), 'sick');
  assert.ok(w.reverie.feelings('ana').some((f) => f.id === 'in_pain'), 'noticed now');
  assert.equal(w.morgul.harms('ana')[0].shown, true);
});

test('a dose aimed at someone: only they get it', () => {
  const w = yard();
  const harms = events(w, 'morgul:harm');
  w.morgul.taint({ place: 'cafe', n: 1, course: 'nightshade', by: 'bo', for: 'cy', seenBy: [] });
  w.direct('ana', { do: 'eat_stew' });
  w.advance(30);
  assert.equal(harms.length, 0, 'not for Ana');
  w.direct('cy', { do: 'eat_stew' });
  assert.ok(until(w, () => harms.length === 1, HOUR, 1));
  assert.equal(harms[0].to, 'cy');
  assert.equal(w.morgul.taints().length, 0);
  assert.equal(w.morgul.taint({ place: 'cafe', course: 'no such course' }), null);
});

// ---------------------------------------------------------------------------
// Suspicion
// ---------------------------------------------------------------------------

test('suspicion: whoever saw it done knows; whoever didn\'t suspects someone by the evidence, and can be wrong', () => {
  // seen dosed: Cy knows who
  const w = yard();
  const sus = events(w, 'morgul:suspect');
  w.morgul.taint({ place: 'cafe', item: 'stew', n: 10, course: 'nightshade', by: 'bo', seenBy: ['cy'] });
  assert.equal(w.reverie.belief('cy', `dosed:x1`), 'bo');
  w.direct('ana', { do: 'eat_stew' });
  w.direct('cy', { do: 'loiter', at: 'cafe' });
  assert.ok(until(w, () => sus.some((e) => e.id === 'cy'), 4 * HOUR, 5));
  const cy = sus.find((e) => e.id === 'cy');
  assert.equal(cy.suspect, 'bo');
  assert.equal(cy.why, 'saw it done');
  assert.equal(cy.right, true);
  assert.equal(w.lang.value('suspects:bo', w.ctx(w.get('cy'))), 1);
  // unseen: the victim blames whoever bore them a grudge, or served it, or was about: here, never Bo
  const blamed = new Set();
  for (const seed of ['s1', 's2', 's3', 's4', 's5', 's6']) {
    const v = yard({ seed, moduleConfig: { morgul: { suspect: 1 } } });
    v.bree.grudgeAgainst('cy', 'ana', 0.8, 'the fence');
    const got = events(v, 'morgul:suspect');
    v.morgul.taint({ place: 'cafe', item: 'stew', n: 10, course: 'nightshade', by: 'bo', seenBy: [] });
    v.advance(30);
    v.direct('ana', { do: 'eat_stew' });
    assert.ok(until(v, () => got.some((e) => e.id === 'ana'), 4 * HOUR, 5), `Ana suspects someone (${seed})`);
    const e = got.find((x) => x.id === 'ana');
    assert.equal(e.right, false);
    assert.ok(['cy', 'cook'].includes(e.suspect), e.suspect);
    blamed.add(e.suspect);
    const b = v.reverie.beliefRecord('ana', `did:${e.suspect}:harm`);
    assert.equal(b.src, 'assumed');
    assert.ok(v.morgul.held('ana', e.suspect) > 0, 'a scapegoat held to blame');
    assert.ok(v.morgul.held('ana', 'bo') === 0);
  }
  assert.deepEqual([...blamed].sort(), ['cook', 'cy'], 'the one with a grudge, or the cook: by the evidence, by chance');
});

test('the poisoner is suspected some of the time, and not always', () => {
  let right = 0, wrong = 0;
  for (const seed of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']) {
    const w = yard({ seed, moduleConfig: { morgul: { suspect: 1 } } });
    const got = events(w, 'morgul:suspect');
    // Bo doses the stew alone in the cafe (but for the cook), then goes back to the yard
    w.morgul.taint({ place: 'cafe', item: 'stew', n: 10, course: 'nightshade', by: 'bo', seenBy: [] });
    w.advance(30);
    w.direct('ana', { do: 'eat_stew' });
    until(w, () => got.some((e) => e.id === 'ana'), 5 * HOUR, 5);
    for (const e of got) if (e.right) right++; else wrong++;
  }
  assert.ok(right > 0, `right ${right}`);
  assert.ok(wrong > 0, `wrong ${wrong}`);
});

test('a trap the game says was set and sprung with others about: they\'re the evidence, the one who set it among them', () => {
  // everyone at a place of their own (as in a game that owns space): nobody is ever about but by the game's say
  const run = (seed, about) => {
    const w = yard({ seed, moduleConfig: { morgul: { suspect: 1 } } });
    w.morgul.near(['farm', 'town']);
    const got = events(w, 'morgul:suspect');
    const t = w.morgul.set('snare', { by: 'bo', place: 'barn', seenBy: [], ...(about ? { about: ['cook'] } : {}) });
    assert.deepEqual(w.s.mod.morgul.traps[t].about, about ? ['bo', 'cook'] : undefined, 'kept only when the game says');
    w.morgul.spring(t, 'ana', [], about ? ['cy'] : undefined);
    const h = w.s.mod.morgul.harms.find((x) => x.cause === t);
    return { w, got, about: h.about };
  };
  const said = run('t1', true);
  assert.deepEqual(said.about, ['bo', 'cook', 'cy'], 'about when it was set, and when it sprang');
  // unsaid: as before, whoever's at the place
  assert.deepEqual(run('t1', false).about, []);
  // over a few seeds, Ana suspects one of them: Bo some of the time, and not always
  const blamed = new Set();
  for (const seed of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']) {
    const { got } = run(seed, true);
    for (const e of got.filter((x) => x.id === 'ana')) { assert.equal(e.why, 'was about'); blamed.add(e.suspect); }
  }
  assert.ok(blamed.has('bo') && blamed.size > 1, [...blamed].join(', '));
});

test('suspicion spreads as gossip, the wrong name as readily as the right', () => {
  const w = yard({ moduleConfig: { morgul: { suspect: 1 }, wormtongue: { gossipChance: 1 } } });
  w.morgul.harm({ to: 'ana', by: 'bo', kind: 'cut', severity: 0.2, via: 'trap', seenBy: [] });
  const s = w.morgul.suspects('ana');
  assert.equal(s.length, 1, 'Ana suspects someone');
  const key = `did:${s[0].id}:harm`;
  assert.ok(until(w, () => w.reverie.belief('cy', key) !== undefined || w.reverie.belief('bo', key) !== undefined, DAY, 10), 'and it gets about');
});

// ---------------------------------------------------------------------------
// Fights by numbers
// ---------------------------------------------------------------------------

/** The yard with Bree's fights: Ana strong and armed, Bo weak. */
function brawlers(opts = {}) {
  const w = yard({
    ...opts,
    moduleConfig: { morgul: { might: [{ input: 'trait.strength', out: [0.5, 1.5] }], ...(opts.morgul || {}) } },
    ana: { traits: { temper: 0.9, courage: 0.8, strength: 1 }, inv: { cudgel: 1 } },
    bo: { traits: { temper: 0.2, courage: 0.3, strength: 0.1 } },
  });
  w.bree.kind({ id: 'fight', tags: ['hostile'], base: -4, weight: 0 });
  return w;
}

test('a fight by numbers: a blow a turn by the odds of might and what they hold; the harm on each turn; it ends when one yields or goes down', () => {
  const w = brawlers();
  assert.ok(w.morgul.odds('ana', 'bo') > 0.7, `odds ${w.morgul.odds('ana', 'bo')}`);
  assert.equal(w.lang.value('armed', w.ctx(w.get('ana'))), 1);
  assert.equal(w.morgul.fights('fight'), true);
  const turns = events(w, 'bree:turn'), ends = events(w, 'bree:end');
  w.bree.start('fight', 'ana', 'bo');
  w.advance(2);
  assert.equal(w.get('ana').doing.action, 'fighting', 'held in it');
  assert.equal(w.get('bo').doing.action, 'fighting');
  assert.ok(until(w, () => ends.length > 0, HOUR, 1));
  const blows = turns.filter((t) => t.harm);
  assert.ok(blows.length >= 1);
  for (const t of blows) assert.ok(t.harm.severity > 0 && ['ana', 'bo'].includes(t.harm.by));
  assert.ok(blows.filter((t) => t.harm.by === 'ana').length >= blows.length / 2, 'the stronger lands more');
  assert.ok(['yielded', 'down', 'left', 'stepped in'].includes(ends[0].why), ends[0].why);
  // the one who started it holds nothing against the other for blows struck back
  assert.equal(w.morgul.held('ana', 'bo'), 0);
  if (blows.some((t) => t.harm.by === 'ana')) assert.ok(w.morgul.held('bo', 'ana') > 0);
  w.advance(2);
  assert.notEqual(w.get('ana').doing.action, 'fighting', 'let go after');
  // the blows' harms are kept, marked with the exchange
  assert.ok(w.morgul.harms().every((h) => h.exchange === ends[0].id && h.via === 'blow'));
});

test('might: the game\'s considerations, what they hold, less what they\'ve been hurt; the player\'s from a fact', () => {
  const w = brawlers();
  const before = w.morgul.might('ana');
  assert.equal(before, round(1.5 * 1.2), 'strength, and a cudgel');
  w.morgul.harm({ to: 'ana', by: 'bo', kind: 'blunt', severity: 0.5 });
  assert.equal(w.morgul.might('ana'), round(1.5 * 1.2 * (1 - 0.5 * 0.6)));
  assert.equal(w.morgul.might('player'), 1);
  w.fact('might:player', 4);
  assert.ok(w.morgul.odds('bo', 'player') < 0.2);
  assert.equal(w.lang.value('odds:player', w.ctx(w.get('bo'))), w.morgul.odds('bo', 'player'));
});

test('a fight with the player: the character answers each harm (fight back, flee, yield, call for help), by nerve, hurt and odds', () => {
  const w = brawlers();
  const said = events(w, 'morgul:respond');
  w.morgul.harm({ to: 'ana', by: 'player', kind: 'blunt', severity: 0.1 });
  assert.equal(said.length, 1);
  assert.equal(said[0].id, 'ana');
  assert.equal(said[0].to, 'player');
  assert.equal(said[0].start, true, 'the fight starts');
  assert.ok(['fight', 'flee', 'yield', 'help'].includes(said[0].act));
  w.morgul.harm({ to: 'ana', by: 'player', kind: 'blunt', severity: 0.1 });
  assert.equal(said[1].start, false);
  // the bold and strong would rather fight; the timid, weak and hurt would rather not
  const bold = w.morgul.respond('ana');
  assert.ok(bold.weights.fight > bold.weights.flee, JSON.stringify(bold.weights));
  w.fact('might:player', 5);
  w.morgul.harm({ to: 'bo', by: 'player', kind: 'blunt', severity: 0.4 });
  const timid = w.morgul.respond('bo');
  assert.ok(timid.weights.fight < Math.max(timid.weights.flee, timid.weights.yield), JSON.stringify(timid.weights));
  assert.equal(w.morgul.fearOf('bo', 'player') > 0, true, 'and fears the player');
  assert.equal(w.morgul.respond('nobody'), null);
  // the character struck the player: they answer too
  w.morgul.harm({ to: 'player', by: 'cy', kind: 'blunt', severity: 0.1 });
  assert.equal(said[said.length - 1].id, 'cy');
});

test('only harm face to face is a fight: a trap or a dose between a character and the player makes nobody answer; the player can spring a trap', () => {
  const w = brawlers();
  const said = events(w, 'morgul:respond'), sprung = events(w, 'morgul:sprung');
  w.morgul.harm({ to: 'player', by: 'cy', kind: 'poison', severity: 0.2, via: 'dose' });
  w.morgul.harm({ to: 'bo', by: 'player', kind: 'cut', severity: 0.2, via: 'trap' });
  assert.equal(said.length, 0);
  w.morgul.harm({ to: 'bo', by: 'player', kind: 'cut', severity: 0.1, via: 'throw' });
  assert.equal(said.length, 1);
  // Cy's snare in the barn catches the player on screen: a harm to the player, the snare spent, Cy far off and silent
  const t = w.morgul.set('snare', { by: 'cy', place: 'barn', seenBy: [] });
  w.morgul.spring(t, 'player');
  assert.equal(sprung.length, 1);
  assert.equal(sprung[0].id, 'player');
  const h = w.morgul.harms().at(-1);
  assert.equal(h.to, 'player');
  assert.equal(h.by, 'cy');
  assert.equal(h.via, 'trap');
  assert.equal(h.cause, t);
  assert.equal(w.morgul.traps().length, 0);
  assert.equal(said.length, 1);
});

// ---------------------------------------------------------------------------
// Choosing harm
// ---------------------------------------------------------------------------

test('violence: harmful actions weigh by it; at 0 nobody ever does harm', () => {
  const build = (violence) => {
    const w = yard({ moduleConfig: { morgul: { violence } } });
    w.action({ id: 'shove', target: 'person', at: 'here', minutes: 5, base: 0.3, tags: ['harm'], then: ['harm:blunt=0.1'] });
    return w;
  };
  const w = build(0);
  const c = w.mind.explain(w.get('ana'), 'shove');
  assert.ok(c.every((x) => x.blocked), 'weighed nothing');
  const some = build(0.5);
  const parts = some.mind.explain(some.get('ana'), 'shove')[0].parts;
  assert.ok(parts.some(([n, v]) => n === 'violence' && v === 0.5));
  // the effect: harm to the target, by the person, with what they hold of that kind
  const e = build(1);
  e.give('ana', 'knife', 1);
  e.internally(() => e.lang.apply('harm:cut=0.2', e.ctx(e.get('ana'), { target: 'bo', place: 'yard' })));
  const h = e.morgul.harms('bo')[0];
  assert.deepEqual([h.by, h.kind, h.severity, h.what], ['ana', 'cut', 0.2, 'knife']);
});

test('revenge: harm past vengeAt makes the game\'s avenge task an option aimed at them, planned through Mentat; doing harm to them sates it', () => {
  const w = yard();
  w.action({ id: 'shove', target: 'person', at: 'target', minutes: 5, rank: -1, tags: ['harm'], then: ['harm:blunt=0.15'] });
  w.task({ id: 'avenge', target: 'person', tags: ['harm'], methods: [{ if: ['target.hurt<0.5'], do: ['shove'] }] });
  assert.equal(w.mind.options(w.get('ana')).filter((c) => c.id === 'avenge').length, 0, 'nothing to avenge');
  w.morgul.harm({ to: 'ana', by: 'bo', kind: 'blunt', severity: 0.4 });
  assert.ok(w.morgul.vengeance('ana', 'bo') >= 0.3);
  assert.equal(w.lang.value('vengeance:bo', w.ctx(w.get('ana'))), w.morgul.vengeance('ana', 'bo'));
  const opt = w.mind.options(w.get('ana')).find((c) => c.id === 'avenge');
  assert.equal(opt.target, 'bo');
  assert.ok(opt.weight > 0 && opt.parts.some(([n]) => n === 'revenge on Bo'), JSON.stringify(opt.parts));
  w.direct('ana', { do: 'avenge', target: 'bo' });
  assert.ok(until(w, () => w.morgul.harms('bo').some((h) => h.by === 'ana'), HOUR, 1), 'the plan\'s step, aimed at Bo');
  assert.ok(w.morgul.held('ana', 'bo') < 0.4 - 0.25, 'sated, some');
  // vengeance 0: none
  const calm = yard({ moduleConfig: { morgul: { vengeance: 0 } } });
  calm.task({ id: 'avenge', target: 'person', methods: [{ do: ['loiter'] }] });
  calm.morgul.harm({ to: 'ana', by: 'bo', kind: 'blunt', severity: 0.6 });
  assert.equal(calm.mind.options(calm.get('ana')).filter((c) => c.id === 'avenge').length, 0);
  // a targeted task is never chosen freely
  const free = yard();
  free.task({ id: 'visit', target: 'person', base: 1, methods: [{ do: ['loiter'] }] });
  assert.equal(free.mind.options(free.get('ana')).filter((c) => c.id === 'visit').length, 0);
});

test('flight, care and caution: away from someone they fear, toward tending the hurt, clear of known danger', () => {
  const w = yard();
  w.action({ id: 'run_home', at: 'home', minutes: 30, base: 0.01, if: ['fleeing>0'], tags: ['flee'] });
  w.action({ id: 'tend', target: 'person', at: 'here', minutes: 20, base: 0.05, tags: ['care'], then: ['tend'] });
  w.action({ id: 'stroll', at: 'barn', minutes: 30, base: 0.05 });
  w.fellowship.adjust('cy', 'ana', 0.5);
  w.morgul.harm({ to: 'bo', by: 'ana', kind: 'blunt', severity: 0.7 });
  const bo = w.get('bo');
  assert.ok(w.lang.value('afraid_of:ana', w.ctx(bo)) > 0.25);
  assert.ok(w.lang.value('fleeing', w.ctx(bo)) > 0, 'Ana is there, and the odds are poor');
  const loiter = w.mind.explain(bo, 'loiter')[0];
  assert.ok(loiter.parts.some(([n, v]) => n === 'afraid of Ana' && v < 1), JSON.stringify(loiter.parts));
  const run = w.mind.explain(bo, 'run_home')[0];
  assert.ok(run.parts.some(([n, v]) => n === 'getting away' && v > 1), JSON.stringify(run.parts));
  // care: tending someone hurt weighs more, the more for someone liked
  const tend = w.mind.explain(w.get('cy'), 'tend').map((c) => c);
  const opts = w.mind.options(w.get('cy')).filter((c) => c.id === 'tend' && c.target === 'bo');
  assert.ok(opts.length && opts[0].parts.some(([n, v]) => n === 'tending Bo' && v > 1), JSON.stringify(opts[0]?.parts));
  void tend;
  // caution: a known trap at the barn
  w.morgul.set('snare', { by: 'cy', place: 'barn', seenBy: [] });
  const stroll = w.mind.explain(w.get('cy'), 'stroll')[0];
  assert.ok(stroll.parts.some(([n, v]) => n === 'danger' && v < 1), JSON.stringify(stroll.parts));
  const careless = yard({ moduleConfig: { morgul: { caution: 0 } } });
  careless.action({ id: 'stroll', at: 'barn', minutes: 30, base: 0.05 });
  careless.morgul.set('snare', { by: 'cy', place: 'barn', seenBy: [] });
  assert.ok(!careless.mind.explain(careless.get('cy'), 'stroll')[0].parts.some(([n]) => n === 'danger'), 'caution 0: no heed');
});

test('a warning: someone who knows of a trap set for someone, and likes them, tells them when they meet', () => {
  const w = yard();
  w.fellowship.adjust('cy', 'ana', 0.6);
  w.morgul.set('snare', { by: 'bo', place: 'barn', for: 'ana', seenBy: ['cy'] });
  assert.equal(w.reverie.belief('ana', 'trap:t1'), undefined);
  assert.ok(until(w, () => w.reverie.belief('ana', 'trap:t1') === 'barn', DAY, 10), 'warned');
  w.direct('ana', { do: 'potter' });
  w.advance(HOUR);
  assert.equal(w.morgul.traps().length, 1, 'and isn\'t caught');
});

// ---------------------------------------------------------------------------
// The knobs
// ---------------------------------------------------------------------------

test('the knobs: healing, suspicion and lethality, the world\'s and a person\'s own', () => {
  const len = (opts) => { const w = yard(opts); w.morgul.harm({ to: 'ana', by: 'bo', kind: 'cut', severity: 0.5 }); const c = w.athelas.of('ana')[0]; return c.until - c.since; };
  assert.equal(len({}), 60);
  assert.equal(len({ moduleConfig: { morgul: { healing: 2 } } }), 30, 'twice as fast');
  assert.equal(len({ ana: { tune: { morgul: { healing: 0.5 } } } }), 120, 'their own pace');
  // a cold isn't a wound: healing leaves it be
  const w = yard({ moduleConfig: { morgul: { healing: 2 } } });
  w.athelas.course({ id: 'cold', phases: [{ id: 'sniffles', minutes: 60 }] });
  w.athelas.afflict('ana', 'cold');
  assert.equal(w.athelas.of('ana')[0].until - w.athelas.of('ana')[0].since, 60);
  // suspicion 0: nobody suspects
  const s = yard({ moduleConfig: { morgul: { suspicion: 0 } } });
  const got = events(s, 'morgul:suspect');
  s.morgul.harm({ to: 'ana', by: 'bo', kind: 'cut', severity: 0.2, via: 'trap' });
  assert.equal(got.length, 0);
  assert.deepEqual(Tyrell.MODULE_DEFAULTS.morgul.lethality, 0);
  assert.deepEqual(Object.keys(s.morgul.knobs).sort(), ['caution', 'healing', 'lethality', 'suspicion', 'vengeance', 'violence']);
  s.tune('morgul', { lethality: 1 }, 'ana');
  assert.equal(s.tuning('morgul', 'ana').lethality, 0, 'the world\'s 0 times her own 1');
});

// ---------------------------------------------------------------------------
// Determinism and time walk
// ---------------------------------------------------------------------------

test('the same seed and the same inputs give the same world; time walk through a poisoning and a trap gives it back; so does saving', () => {
  const build = () => yard({ seed: 'd', moduleConfig: { morgul: { suspect: 1 } } });
  const play = (w) => {
    w.advance(HOUR);
    w.morgul.taint({ place: 'cafe', item: 'stew', n: 6, course: 'nightshade', by: 'bo', seenBy: [] });
    w.morgul.set('snare', { by: 'cy', place: 'barn', seenBy: [] });
    w.direct('ana', { do: 'eat_stew' });
    w.advance(HOUR);
    w.direct('bo', { do: 'potter' });
    w.morgul.harm({ to: 'cy', by: 'ana', kind: 'blunt', severity: 0.3 });
    w.advance(8 * HOUR);
  };
  const a = build(), b = build();
  play(a); play(b);
  assert.ok(a.morgul.harms().some((h) => h.via === 'dose' && h.shown), 'the poison told');
  assert.ok(a.morgul.harms().some((h) => h.via === 'trap'));
  assert.equal(a.hash(), b.hash());
  // back to before the poison told, and forward again
  const h = a.hash();
  a.rewind(7 * HOUR);
  assert.notEqual(a.hash(), h);
  a.advance(7 * HOUR);
  assert.equal(a.hash(), h);
  // saved mid-way, loaded, run on: the same
  const c = build();
  c.load(JSON.stringify(a.save()));
  a.advance(DAY); c.advance(DAY);
  assert.equal(c.hash(), a.hash());
});

test('Rocinante with the harm option: a brawl, a snare and a poisoned stew, and they still behave like people', () => {
  const report = Tyrell.VoightKampff.run({
    build: (seed) => rocinante({ harm: true, seed }), days: 7,
    checks: ['nobody-starves', 'capacity', 'everyone-sleeps', 'no-stuck', 'deterministic', 'esper', 'save-load', 'interactions', 'harm'],
  });
  assert.ok(report.passed, report.failures.join('\n'));
  const h = report.stats.harm;
  assert.ok(h.fights > 0 && h.sprung > 0 && h.doses > 0, JSON.stringify(h));
  assert.equal(h.killed, 0);
  assert.ok(h.right > 0 && h.wrong > 0, 'the poisoner suspected, some of the time');
  // without the option it's the town it always was
  assert.equal(rocinante().morgul.used, false);
});
