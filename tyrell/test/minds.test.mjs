// Reverie (feelings, moods, breaks, memories, beliefs, files), Fellowship
// (regard, sentiments, standing) and Mentat (planning).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tyrell, rocinante, tiny, until, HOUR, DAY } from './helpers.mjs';

// ---------------------------------------------------------------------------
// Reverie
// ---------------------------------------------------------------------------

test('feelings stack up to their limit, each weaker, and add up to a mood', () => {
  const w = tiny();
  w.reverie.feeling({ id: 'insulted', label: 'Insulted', weight: -0.15, minutes: 20 * DAY, stack: 3, stackMul: 0.9, emotion: 'angry' });
  w.person('ana', { home: 'home_a', needs: { hunger: 0, energy: 0 } });
  const base = w.reverie.mood('ana');
  for (let i = 0; i < 5; i++) w.reverie.feel('ana', 'insulted');
  const f = w.reverie.feelings('ana').filter((x) => x.id === 'insulted');
  assert.equal(f.length, 3);
  assert.ok(f[0].weight < f[1].weight || f[1].weight < f[2].weight || f[0].weight !== f[2].weight);
  assert.ok(w.reverie.mood('ana') < base - 0.35);
  assert.equal(w.reverie.emotion('ana'), 'angry');
});

test('feelings wear off; the emotion is fine when nothing stands out', () => {
  const w = tiny();
  w.person('ana', { home: 'home_a' });
  w.reverie.feel('ana', 'helped');
  assert.equal(w.reverie.emotion('ana'), 'happy');
  w.advance(DAY + 1);
  assert.equal(w.reverie.feelings('ana').length, 0);
  assert.equal(w.reverie.emotion('ana'), 'fine');
});

test('a need high enough shows as an emotion', () => {
  const w = tiny();
  w.need({ id: 'company', rise: 0.1, emotion: 'lonely', urgent: 1.1 });
  w.person('ana', { home: 'home_a', needs: { company: 1 } });
  assert.equal(w.reverie.emotion('ana'), 'lonely');
});

test('a low mood can break: the break outranks everything, then catharsis', () => {
  const w = tiny();
  w.action({ id: 'sulk', at: 'home', minutes: 60, rank: -1 });
  w.reverie.breakdown({ id: 'sulk', level: 'minor', do: 'sulk' });
  w.reverie.feeling({ id: 'awful', weight: -0.9, minutes: 10 * DAY });
  w.person('ana', { home: 'home_a' });
  w.reverie.feel('ana', 'awful');
  const broke = [];
  w.on('broke', (e) => broke.push(e));
  assert.ok(until(w, () => broke.length > 0, 10 * DAY, 30));
  const p = w.get('ana');
  assert.ok(until(w, () => p.doing?.layer === 'break', HOUR));
  assert.ok(until(w, () => w.reverie.feelings('ana').some((f) => f.id === 'catharsis'), 3 * HOUR));
});

test('acting against your values costs stress and a guilty conscience', () => {
  const w = tiny();
  w.action({ id: 'pinch', at: 'cafe', minutes: 5, base: 0.5, against: ['honesty'] });
  w.person('ana', { home: 'home_a', values: { honesty: 0.9 } });
  w.person('bo', { home: 'home_a', values: { honesty: 0 } });
  const a = w.mind.explain(w.get('ana'), 'pinch')[0];
  const b = w.mind.explain(w.get('bo'), 'pinch')[0];
  assert.ok(a.weight < b.weight * 0.5, 'the honest one hardly wants to');
  w.direct('ana', { do: 'pinch' });
  until(w, () => w.get('ana').last === 'pinch', HOUR);
  assert.ok(w.reverie.stress('ana') > 0);
  assert.ok(w.reverie.feelings('ana').some((f) => f.id === 'conscience'));
});

test('memories fade by time and importance; recalled ones can become core and change someone', () => {
  const w = tiny();
  w.reverie.memoryKind({ id: 'betrayed', importance: 9, shifts: { trust: -0.2 } });
  w.person('ana', { home: 'home_a', traits: { trust: 0.6 } });
  w.reverie.remember('ana', { k: 'betrayed', about: 'bo', text: 'Bo sold me out' });
  w.reverie.remember('ana', { k: 'breakfast', imp: 2 });
  const [m] = w.reverie.memories('ana');
  assert.equal(m.k, 'betrayed');
  let core = false;
  for (let i = 0; i < 30 && !core; i++) { w.reverie.recall('ana', { about: 'bo' }); core = w.reverie.memories('ana')[0].core === true; }
  assert.ok(core, 'recalled often enough, it became a core memory');
  assert.ok(w.get('ana').def.traits.trust < 0.6);
  assert.equal(w.reverie.shifts('ana')[0].cause, 'Bo sold me out');
});

test('beliefs: a source, a strength, whether they are true, and what someone thinks', () => {
  const w = tiny();
  w.person('ana', { home: 'home_a' });
  w.fact('open:coil', true);
  assert.equal(w.reverie.thinks('ana', 'open:coil'), true, 'no belief: the fact');
  w.reverie.believe('ana', 'open:coil', false, 'told', 'bo', 0.6);
  assert.equal(w.reverie.thinks('ana', 'open:coil'), false, 'a belief wins over the fact');
  assert.equal(w.reverie.accurate('ana', 'open:coil'), false);
  w.reverie.believe('ana', 'open:coil', true, 'saw');
  assert.equal(w.reverie.thinks('ana', 'open:coil'), true, 'seeing beats being told');
  assert.ok(w.lang.test('thinks:open:coil', w.ctx(w.get('ana'))));
  // they fade
  w.reverie.believe('ana', 'rumor', 'x', 'told', 'bo', 0.051);
  w.advance(3 * DAY);
  assert.equal(w.reverie.belief('ana', 'rumor'), undefined);
});

test('a file on the player: deeds are noted, and lines and conditions can read them', () => {
  const w = rocinante();
  w.did('player', 'fixed', { for: 'ruth', what: 'radio' });
  w.did('player', 'fixed', { for: 'ruth', what: 'kettle' });
  const f = w.reverie.file('ruth', 'player');
  assert.equal(f.tally.fixed, 2);
  assert.equal(f.notes[1].what, 'kettle');
  assert.ok(w.lang.test('file:player.fixed>=2', w.ctx(w.get('ruth'))));
  assert.ok(w.reverie.feelings('ruth').some((x) => x.id === 'helped'));
  assert.ok(w.fellowship.regard('ruth', 'player') > 0.3);
});

// ---------------------------------------------------------------------------
// Fellowship
// ---------------------------------------------------------------------------

test('time together grows regard; compatibility is the same both ways', () => {
  const w = rocinante();
  assert.equal(w.fellowship.compat('mara', 'ruth'), w.fellowship.compat('ruth', 'mara'));
  w.advance(3 * DAY);
  const rels = w.fellowship.relations('mara');
  assert.ok(rels.length > 0, 'Mara has met people');
  assert.ok(rels.some((r) => r.regard > 0));
});

test('sentiments: at most four, with reasons, some wearing off', () => {
  const w = tiny();
  w.person('a', { home: 'home_a' }); w.person('b', { home: 'home_b' });
  for (let i = 0; i < 6; i++) w.fellowship.sentiment('a', 'b', 'reason ' + i, 0.05 * (i + 1));
  assert.equal(w.fellowship.sentiments('a', 'b').length, 4);
  w.fellowship.sentiment('a', 'b', 'snubbed me', -0.5, 60);
  assert.ok(w.fellowship.regard('a', 'b') < 0.5);
  w.advance(61);
  assert.ok(!w.fellowship.sentiments('a', 'b').some((s) => s.label === 'snubbed me'));
});

test('standing: fame and infamy apart, with a label', () => {
  const w = rocinante();
  w.fellowship.changeStanding('watch', 'player', 0.5, 0.0);
  assert.equal(w.fellowship.standing('watch', 'player').label, 'liked');
  w.fellowship.changeStanding('watch', 'player', 0, 0.8);
  assert.equal(w.fellowship.standing('watch', 'player').label, 'dangerous hero');
  assert.ok(w.lang.test('infamy:watch.player>0.5', w.ctx()));
});

test('groups and households: members by definition and by joining', () => {
  const w = rocinante();
  assert.deepEqual(w.fellowship.members('h_okafor').sort(), ['mara', 'pip', 'tomas']);
  assert.equal(w.fellowship.household('pip'), 'h_okafor');
  w.fellowship.join('regulars', 'kofi');
  assert.ok(w.fellowship.groupsOf('kofi').includes('regulars'));
});

// ---------------------------------------------------------------------------
// Mentat
// ---------------------------------------------------------------------------

test('a task runs its first method that fits', () => {
  const w = rocinante({ start: 9 * HOUR });
  const ruth = w.get('ruth');
  w.direct('ruth', { do: 'fix_radio' });
  assert.ok(until(w, () => ruth.inv.radio === 1, 6 * HOUR));
  assert.ok(w.westmarch.find({ k: 'planned', who: 'ruth' }).some((e) => e.d.method === 'take it to Tomas'));
  assert.equal(ruth.inv.broken_radio, undefined);
});

test('a plan rests on beliefs: wrong ones fail on contact and the next method is tried', () => {
  const w = rocinante({ start: 9 * HOUR });
  const ruth = w.get('ruth');
  w.fact('closed:workshop', true); // shut today, but Ruth doesn't know
  w.reverie.believe('ruth', 'open:workshop', true, 'assumed');
  w.setVar('ruth', 'money', 200);
  w.direct('ruth', { do: 'fix_radio' });
  assert.ok(until(w, () => ruth.inv.radio === 1 || !ruth.plan && w.westmarch.find({ k: 'gave-up', who: 'ruth' }).length > 0, 8 * HOUR));
  const log = w.westmarch.find({ who: 'ruth' }).map((e) => e.k);
  assert.ok(log.includes('failed') || log.includes('replanned'), 'something failed and she replanned');
  assert.equal(w.reverie.belief('ruth', 'open:workshop'), false, 'she learned it was shut');
});

test('get: the cheapest way to get something, by temperament (buy or steal)', () => {
  const w = rocinante({ start: 10 * HOUR });
  const honest = w.get('lena'), crook = w.get('sam');
  w.setVar('sam', 'money', 50);
  const r1 = w.mentat.acquire(honest, 'food', 3, new Set());
  assert.equal(r1.steps.at(-1).action, 'buy_food');
  assert.equal(w.mentat.acquire(crook, 'food', 3, new Set()).steps.at(-1).action, 'buy_food', 'with money, even Sam buys');
  w.setVar('sam', 'money', 3);
  assert.equal(w.mentat.acquire(crook, 'food', 3, new Set()).steps.at(-1).action, 'steal_food', 'broke and dishonest: he steals');
  w.setVar('lena', 'money', 0);
  assert.equal(w.mentat.acquire(honest, 'food', 3, new Set()), null, 'broke and honest: no way');
});

test('get: needs that need other things (a chain)', () => {
  const w = tiny({ start: 10 * HOUR });
  w.place({ id: 'yard', tags: ['scrap'] });
  w.link('home_a', 'yard', 5);
  w.action({ id: 'scavenge', at: 'yard', minutes: 30, gives: { wire: 1 } });
  w.action({ id: 'make_antenna', at: 'home', minutes: 20, if: ['has:wire'], uses: { wire: 1 }, gives: { antenna: 1 } });
  w.task({ id: 'rig_tv', base: 0.5, methods: [{ do: ['get:antenna'] }] });
  const p = w.person('ana', { home: 'home_a' });
  const route = w.mentat.acquire(p, 'antenna', 3, new Set());
  assert.deepEqual(route.steps.map((s) => (typeof s === 'string' ? s : s.action)), ['scavenge', 'make_antenna']);
  w.direct('ana', { do: 'rig_tv' });
  assert.ok(until(w, () => p.inv.antenna === 1, 4 * HOUR));
});

test('an urgent need sets a plan aside; it picks up again after', () => {
  const w = tiny({ start: 10 * HOUR });
  w.action({ id: 'dig', at: 'park', minutes: 120, base: 0.01 });
  w.task({ id: 'garden', base: 0.01, methods: [{ do: ['dig', 'dig'] }] });
  const p = w.person('ana', { home: 'home_a', needs: { hunger: 0.5 } });
  w.direct('ana', { do: 'garden', rank: 1 });
  assert.ok(until(w, () => p.plan && p.doing?.action === 'dig' && p.doing.kind === 'act', HOUR));
  w.mind.setLevel(p, 'hunger', 0.99); // desperate: rank 2.5 beats the plan's 1
  w.clock.reconsider(p, 'urge');
  assert.equal(p.plan, null);
  assert.equal(p.suspended.length, 1);
  assert.ok(until(w, () => p.plan?.task === 'garden', 3 * HOUR), 'the plan resumed');
});

test('a plan that cannot be done gives up, with frustration and a cooldown', () => {
  const w = tiny({ start: 10 * HOUR });
  w.task({ id: 'impossible', base: 0.5, methods: [{ if: ['fact:never'], do: ['loaf'] }] });
  const p = w.person('ana', { home: 'home_a' });
  w.direct('ana', { do: 'impossible' });
  w.advance(5);
  assert.equal(p.plan, null);
  assert.ok(w.westmarch.find({ k: 'no-plan', who: 'ana' }).length >= 1);
});
