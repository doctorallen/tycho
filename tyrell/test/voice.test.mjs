// Voice: branching conversations. Threads of beats, answers with approaches
// that land by the listener's nature, effects, promises settled later, and
// every choice an input that replays.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tiny, rocinante, HOUR, DAY } from './helpers.mjs';

/** A world to talk in: Merryfolk's "How are you keeping?", and a little more. */
function talky(opts = {}) {
  const w = tiny({ moduleConfig: { voice: { onWell: ['regard+=0.05'], onBadly: ['regard-=0.05'], ...(opts.voice || {}) } }, ...opts });
  const v = w.voice;
  w.term('temper', (c) => (c.person ? (c.person.def.traits?.temper ?? 0.5) > 0.6 ? 'ornery' : 'cheerful' : null));
  v.approach({ id: 'warm', lands: [{ if: ['temper=cheerful'], by: 1 }] });
  v.approach({ id: 'jest', lands: [{ if: ['temper=cheerful'], by: 2 }, { if: ['temper=ornery'], by: -2 }] });
  v.approach({ id: 'ask', base: 1 });
  w.cityspeak.addLines([
    { key: 'greet_1', topic: 'greet', text: 'Good day to you.' },
    { key: 'greet_hungry', topic: 'greet', when: ['need.hunger>0.6'], text: 'Is it nearly lunch?' },
    { key: 'how_1', topic: 'how.start', text: 'Fair enough. Mustn\'t grumble.' },
    { key: 'how_2', topic: 'how.start', text: 'Oh, getting along.' },
    { key: 'how_hungry', topic: 'how.start', when: ['need.hunger>0.6'], text: 'Hungry! Is it nearly time for something?' },
    { key: 'how_why', topic: 'how.why', text: 'Oh, this and that.' },
    { key: 'how_tease', topic: 'how.tease', text: 'Only four breakfasts? You flatter me.' },
    { key: 'how_sulk', topic: 'how.sulk', text: 'Is that meant to be funny?' },
    { key: 'react_bad', topic: 'react.badly', text: 'Hmph.' },
    { key: 'bye_1', topic: 'bye', text: 'Mind how you go.' },
    { key: 'close_1', topic: 'close', text: 'Well, I must be off.' },
  ]);
  v.thread({
    id: 'how', label: 'How are you keeping?', weight: 1.3, open: { warm: 'How are you keeping?' }, approach: 'warm',
    beats: {
      start: { line: 'how.start', answers: [
        { say: 'Why\'s that, then?', approach: 'ask', to: 'why' },
        { say: 'You look like someone who\'s had four breakfasts.', approach: 'jest', to: [{ landed: 'badly', to: 'sulk' }, { to: 'tease' }] },
        { say: 'Tell me what\'s on your mind.', warmth: 4, soft: true, to: 'why' },
        { say: 'Hungry? Have a pie.', if: ['need.hunger>0.6'], then: ['need.hunger-=0.5'], to: 'end' },
      ] },
      why: { line: 'how.why', then: ['learn:trouble="this and that"'], answers: [
        { say: 'I\'ll see to it.', then: ['promise:see_to_it'], to: 'end' },
        { say: 'That\'s hard.', approach: 'warm', then: ['sore:how=1'], to: 'end' },
      ] },
      tease: { line: 'how.tease', end: true },
      sulk: { line: 'how.sulk', end: true },
    },
    then: ['var.chats+=1'],
  });
  v.thread({ id: 'weather', label: 'Fine weather', beats: { start: { text: ['Lovely, isn\'t it.', 'A grand day.'], end: true } } });
  v.thread({ id: 'pies', label: 'Pies', if: ['need.hunger>0.6'], weight: 3, beats: { start: { text: 'Don\'t talk to me about pies.', end: true } } });
  v.thread({ id: 'secret', label: 'Their secret', theirs: true, beats: { start: { text: 'Can I tell you something?', answers: [{ say: 'Go on.', then: ['learn:secret=true'], to: 'end' }] } } });
  v.promise({ id: 'see_to_it', days: 2, kept: ['var.helped>=1'], onKept: ['regard+=0.1'], onLapsed: ['regard-=0.1'] });
  return w;
}

const pick = (view, pred) => view.answers.find(pred);
const choose = (w, pred) => { const v = w.voice.current(); const a = pick(v, pred); assert.ok(a, 'no such answer: ' + JSON.stringify(v.answers)); return w.voice.answer(a.i); };

test('a talk starts with a greeting and offers subjects worth raising, by weight and conditions', () => {
  const w = talky({ voice: { theirs: 0 } });
  w.person('ana', { home: 'home_a', needs: { hunger: 0.8 } });
  const view = w.voice.start('ana');
  assert.equal(view.lines[0].key, 'greet_hungry', 'the most specific greeting');
  assert.equal(view.lines[0].text, 'Is it nearly lunch?');
  const subjects = view.answers.filter((a) => a.kind === 'thread').map((a) => a.id);
  assert.deepEqual(subjects.slice(0, 2), ['pies', 'how']);
  assert.ok(subjects.includes('weather'));
  assert.ok(!subjects.includes('secret'), 'theirs to raise, not offered');
  assert.equal(view.answers[view.answers.length - 1].kind, 'bye');
  assert.deepEqual(w.voice.current(), view);
  assert.equal(w.lang.value('talking', w.ctx(w.get('ana'))), true);
});

test('a thread runs its beats: the opener, their line, answers shown by conditions and warmth', () => {
  const w = talky({ voice: { theirs: 0 } });
  w.person('ana', { home: 'home_a', needs: { hunger: 0.2 } });
  w.voice.start('ana');
  const v = choose(w, (a) => a.id === 'how');
  assert.equal(v.thread.id, 'how');
  assert.equal(v.lines[0].who, 'you');
  assert.equal(v.lines[0].text, 'How are you keeping?');
  assert.ok(['how_1', 'how_2'].includes(v.lines[1].key));
  assert.equal(v.landed, 'well', 'the warm opener landed with a cheerful sort');
  const ids = v.answers.map((a) => a.id);
  assert.deepEqual(ids, ['a0', 'a1', 'a2', 'drop', 'bye'], 'the pie isn\'t offered to someone not hungry');
  assert.equal(v.answers[2].ok, false, 'not yet: the talk isn\'t warm enough');
  assert.deepEqual(w.voice.answer(2), w.voice.current(), 'choosing what isn\'t open changes nothing');
});

test('an approach lands by the listener\'s nature: warmth, a strong landing\'s effects, a reaction, and where it leads', () => {
  const run = (temper) => {
    const w = talky({ voice: { theirs: 0 } });
    w.person('ana', { home: 'home_a', traits: { temper } });
    w.voice.start('ana');
    choose(w, (a) => a.id === 'how');
    const before = w.voice.current().warmth;
    const v = choose(w, (a) => a.approach === 'jest');
    return { w, v, before };
  };
  const cheerful = run(0.2);
  assert.equal(cheerful.v.warmth, cheerful.before + 2);
  assert.equal(cheerful.v.landed, 'well');
  assert.ok(cheerful.v.lines.some((l) => l.key === 'how_tease'));
  assert.equal(cheerful.w.fellowship.regard('ana', 'player'), 0.05);
  const ornery = run(0.9);
  assert.equal(ornery.v.landed, 'badly');
  assert.deepEqual(ornery.v.lines.map((l) => l.key ?? l.text), ['You look like someone who\'s had four breakfasts.', 'react_bad', 'how_sulk']);
  assert.equal(ornery.w.fellowship.regard('ana', 'player'), -0.05);
  assert.equal(ornery.v.thread, null, 'the subject\'s done');
  assert.equal(ornery.w.get('ana').vars.chats, 1, 'talked through: its effects ran');
});

test('effects: learning something, a sore subject, a promise kept later', () => {
  const w = talky({ voice: { theirs: 0 } });
  w.person('ana', { home: 'home_a' });
  w.voice.start('ana');
  choose(w, (a) => a.id === 'how');
  const v = choose(w, (a) => a.say === 'Why\'s that, then?');
  assert.deepEqual(v.lines.find((l) => l.who === 'note'), { who: 'note', learned: 'trouble', value: 'this and that' });
  assert.equal(w.voice.learned('ana').trouble, 'this and that');
  const ctx = () => w.ctx(w.get('ana'), { target: 'player' });
  assert.equal(w.lang.value('learned:trouble', ctx()), 'this and that');
  const events = [];
  w.on('promise', (e) => events.push(e.state));
  choose(w, (a) => a.say === 'I\'ll see to it.');
  assert.equal(w.lang.value('promise:see_to_it', ctx()), 'open');
  w.voice.answer(w.voice.current().answers.findIndex((a) => a.kind === 'bye'));
  w.advance(HOUR);
  w.setVar('ana', 'helped', 1);
  w.advance(HOUR);
  assert.deepEqual(events, ['open', 'kept']);
  assert.equal(w.fellowship.regard('ana', 'player'), 0.1);
  assert.ok(w.voice.familiarity('ana') >= 1.5, 'a talk and a thing learned');
});

test('an unkept promise lapses when it comes due', () => {
  const w = talky({ voice: { theirs: 0 } });
  w.person('ana', { home: 'home_a' });
  w.voice.start('ana');
  choose(w, (a) => a.id === 'how');
  choose(w, (a) => a.say === 'Why\'s that, then?');
  choose(w, (a) => a.say === 'I\'ll see to it.');
  w.voice.end();
  w.advance(2 * DAY + HOUR);
  assert.equal(w.voice.promises('ana')[0].state, 'lapsed');
  assert.equal(w.fellowship.regard('ana', 'player'), -0.1);
});

test('let it lie drops a subject; goodbye ends the talk with their words, and it\'s counted', () => {
  const w = talky({ voice: { theirs: 0 } });
  w.person('ana', { home: 'home_a' });
  const ended = [];
  w.on('voice:end', (e) => ended.push(e));
  w.voice.start('ana');
  choose(w, (a) => a.id === 'how');
  const dropped = choose(w, (a) => a.kind === 'drop');
  assert.equal(dropped.thread, null);
  assert.ok(!dropped.answers.some((a) => a.id === 'how'), 'not offered again in the same talk');
  assert.equal(w.get('ana').vars.chats, undefined, 'let lie: no effects');
  const last = choose(w, (a) => a.kind === 'bye');
  assert.equal(last.ended, true);
  assert.equal(last.lines[0].key, 'bye_1');
  assert.equal(w.voice.current(), null);
  assert.equal(ended[0].why, 'bye');
  assert.deepEqual(ended[0].threads, ['how']);
  assert.equal(w.voice.history('ana').talks, 1);
  assert.equal(w.lang.value('talks', w.ctx(w.get('ana'), { target: 'player' })), 1);
});

test('an answer can open a door into another subject', () => {
  const w = talky({ voice: { theirs: 0 } });
  w.voice.thread({ id: 'family', label: 'Family', beats: { start: { text: 'My sister\'s visiting.', end: true } } });
  w.voice.thread({ id: 'news', label: 'Any news?', beats: { start: { text: 'Well, there is something.', answers: [{ say: 'Go on, tell me about your family.', to: 'thread:family' }] } } });
  w.person('ana', { home: 'home_a' });
  w.voice.start('ana');
  choose(w, (a) => a.id === 'news');
  const v = choose(w, (a) => a.say === 'Go on, tell me about your family.');
  assert.deepEqual(v.lines.map((l) => l.text), ['Go on, tell me about your family.', 'My sister\'s visiting.']);
  assert.equal(v.thread, null, 'talked through, both of them');
  assert.ok(!v.answers.some((a) => a.id === 'family' || a.id === 'news'));
  assert.ok(w.voice.history('ana').seen.family !== undefined);
});

test('patience runs out: they close, and only goodbye is left', () => {
  const w = talky({ voice: { theirs: 0, patience: 2 } });
  w.person('ana', { home: 'home_a' });
  w.voice.start('ana');
  choose(w, (a) => a.id === 'how');
  const v = choose(w, (a) => a.say === 'Why\'s that, then?');
  assert.equal(v.patience, 0);
  const done = choose(w, (a) => a.say === 'That\'s hard.');
  assert.equal(done.over, true);
  assert.ok(done.lines.some((l) => l.key === 'close_1'));
  assert.deepEqual(done.answers.map((a) => a.kind), ['bye']);
});

test('a subject talked of comes round fresh again with time; a sore one is best left a while', () => {
  const w = talky({ voice: { theirs: 0 } });
  w.person('ana', { home: 'home_a' });
  w.voice.start('ana');
  choose(w, (a) => a.id === 'how');
  choose(w, (a) => a.say === 'Why\'s that, then?');
  choose(w, (a) => a.say === 'That\'s hard.');
  w.voice.end();
  assert.equal(w.lang.value('sore:how', w.ctx(w.get('ana'), { target: 'player' })), true);
  w.advance(HOUR);
  let offered = w.voice.start('ana').answers.map((a) => a.id);
  assert.ok(!offered.includes('how'), 'too soon');
  w.voice.end();
  w.advance(4 * DAY);
  offered = w.voice.start('ana').answers.map((a) => a.id);
  assert.ok(offered.includes('how'), 'fresh again, and no longer sore');
});

test('now and then they raise something of their own', () => {
  const w = talky({ voice: { theirs: 1 } });
  w.person('ana', { home: 'home_a' });
  const v = w.voice.start('ana');
  assert.equal(v.thread.id, 'secret');
  assert.equal(v.thread.theirs, true);
  assert.equal(v.lines[v.lines.length - 1].text, 'Can I tell you something?');
  choose(w, (a) => a.say === 'Go on.');
  assert.equal(w.voice.learned('ana').secret, true);
});

test('lines said to someone lately are passed over for fresh ones', () => {
  const w = talky({ voice: { theirs: 0 } });
  w.person('ana', { home: 'home_a' });
  const said = [];
  for (let i = 0; i < 2; i++) {
    w.voice.start('ana');
    said.push(choose(w, (a) => a.id === 'how').lines[1].key);
    w.voice.end();
    w.advance(4 * DAY);
  }
  assert.deepEqual(said.sort(), ['how_1', 'how_2']);
});

test('talks are inputs: a rewind replays them, a save carries a talk in progress, and a world without talks keeps nothing', () => {
  const plain = talky();
  plain.person('ana', { home: 'home_a' });
  plain.advance(DAY);
  assert.equal(plain.s.mod.voice, undefined);
  const build = () => { const w = talky(); w.person('ana', { home: 'home_a' }); w.person('bo', { home: 'home_b' }); return w; };
  const a = build(), b = build();
  for (const w of [a, b]) {
    w.advance(HOUR);
    w.voice.start('ana');
    const v = w.voice.current();
    w.voice.answer(v.answers.findIndex((x) => x.kind === 'thread'));
    w.advance(10);
  }
  assert.equal(a.hash(), b.hash());
  const h = a.hash(), view = a.voice.current();
  a.rewind(30);
  assert.equal(a.voice.current(), null);
  a.advance(30);
  assert.equal(a.hash(), h);
  assert.deepEqual(a.voice.current(), view);
  const c = build();
  c.load(JSON.stringify(a.save()));
  assert.deepEqual(c.voice.current(), view);
  const ia = a.voice.current().answers.length - 1;
  a.voice.answer(ia); c.voice.answer(ia);
  a.advance(DAY); c.advance(DAY);
  assert.equal(c.hash(), a.hash());
});

test('Rocinante: Ruth\'s radio comes up, a promise is made, and kept when the radio\'s back', () => {
  const w = rocinante({ start: 9 * HOUR });
  const view = w.voice.start('ruth');
  const radio = view.answers.find((a) => a.id === 'radio');
  assert.ok(radio, 'what\'s still to learn comes up first: ' + JSON.stringify(view.answers));
  const v = w.voice.answer(radio.i);
  assert.equal(v.lines.find((l) => l.who === 'them').key, 'radio');
  w.voice.answer(v.answers.find((a) => a.say === 'I could fix it for you.').i);
  const bye = w.voice.current().answers.find((a) => a.kind === 'bye');
  assert.equal(w.voice.answer(bye.i).ended, true);
  assert.equal(w.voice.learned('ruth').radio, 'broken');
  const before = w.fellowship.regard('ruth', 'player');
  w.give('ruth', 'broken_radio', -1);
  w.give('ruth', 'radio', 1);
  w.advance(HOUR);
  assert.equal(w.voice.promises('ruth')[0].state, 'kept');
  assert.ok(w.fellowship.regard('ruth', 'player') > before + 0.09);
});

// ---------------------------------------------------------------------------
// Knowing someone: familiarity as trust, answers that recall what's been
// learned, the words for it, and everyone the speaker knows
// ---------------------------------------------------------------------------

/** A talk with Ana that teaches the speaker her trouble, then ends: a talk had and a thing learned (familiarity 1.5). */
function acquainted(opts = {}) {
  const w = talky({ voice: { theirs: 0, ...(opts.voice || {}) }, ...opts });
  w.person('ana', { home: 'home_a', traits: { temper: 0.9 } });
  w.voice.start('ana');
  choose(w, (a) => a.id === 'how');
  choose(w, (a) => a.say === 'Why\'s that, then?');
  w.voice.end();
  w.advance(4 * DAY);
  return w;
}

test('familiarity is trust: with familiarLand, what\'s said lands better with someone who knows you, up to a cap, by the approach', () => {
  const landing = (voice) => {
    const w = acquainted({ voice });
    w.voice.approach({ id: 'flat' });
    w.voice.approach({ id: 'cold', familiar: 0 });
    w.voice.thread({ id: 'flat', label: 'Flat', approach: 'flat', weight: 9, beats: { start: { text: 'Mm.', end: true } } });
    w.voice.thread({ id: 'cold', label: 'Cold', approach: 'cold', weight: 9, beats: { start: { text: 'Mm.', end: true } } });
    w.voice.start('ana');
    const before = w.voice.current().warmth;
    const flat = choose(w, (a) => a.id === 'flat');
    const mid = flat.warmth;
    const cold = choose(w, (a) => a.id === 'cold');
    return { familiar: w.voice.familiarity('ana'), flat: round4(mid - before), landed: flat.landed, cold: round4(cold.warmth - mid), coldLanded: cold.landed };
  };
  const off = landing({});
  assert.equal(off.familiar, 1.5);
  assert.deepEqual([off.flat, off.landed], [0, 'even'], 'by default familiarity changes nothing');
  const on = landing({ familiarLand: 0.4 });
  assert.deepEqual([on.flat, on.landed], [0.6, 'well'], 'a point and a half at 0.4 a point');
  assert.deepEqual([on.cold, on.coldLanded], [0, 'even'], 'an approach with familiar: 0 takes none of it');
  const capped = landing({ familiarLand: 2, familiarLandMax: 1 });
  assert.equal(capped.flat, 1, 'no more than the cap');
});
const round4 = (x) => Math.round(x * 1e4) / 1e4;

test('an answer that recalls something learned: offered only once it\'s known, landing better, its words filled in', () => {
  const build = (learnFirst) => {
    const w = talky({ voice: { theirs: 0 } });
    w.voice.remembered = (ctx, key, value, form) => (form === 'loud' ? String(value).toUpperCase() : String(value));
    w.voice.thread({ id: 'catch', label: 'Catch up', weight: 9, beats: { start: { text: 'So.', answers: [
      { say: 'Still {learned.trouble}?', recalls: 'trouble', to: 'end' },
      { say: 'Still {learned.trouble:loud}, then?', label: 'About {learned.trouble}', recalls: 'trouble', approach: 'ask', to: 'end' },
      { say: 'Not yet.', recalls: 'trouble', soft: true, to: 'end' },
      { say: 'Lovely day.', to: 'end' },
    ] } } });
    w.person('ana', { home: 'home_a', traits: { temper: 0.9 } });
    if (learnFirst) {
      w.voice.start('ana');
      choose(w, (a) => a.id === 'how');
      choose(w, (a) => a.say === 'Why\'s that, then?');
      w.voice.end();
    }
    w.voice.start('ana');
    return { w, v: choose(w, (a) => a.id === 'catch') };
  };
  const stranger = build(false);
  assert.deepEqual(stranger.v.answers.filter((a) => a.kind === 'answer').map((a) => [a.say, a.ok]), [['Not yet.', false], ['Lovely day.', true]], 'nothing to recall yet: hidden, or not yet choosable when soft');
  const { w, v } = build(true);
  const recalls = v.answers.filter((a) => a.recalls === 'trouble');
  assert.deepEqual(recalls.map((a) => a.say), ['Still this and that?', 'Still THIS AND THAT, then?', 'Not yet.']);
  assert.equal(recalls[1].label, 'About this and that');
  assert.ok(recalls.every((a) => a.ok));
  const before = v.warmth;
  const said = w.voice.answer(recalls[0].i);
  assert.equal(said.lines[0].text, 'Still this and that?', 'the words as said');
  assert.equal(said.landed, 'well', 'with no approach, the recall lands on its own');
  assert.equal(said.warmth, before + 1, 'recallLand, 1 by default');
  // with an approach, the recall is added to it
  const w2 = build(true).w;
  const v2 = w2.voice.current();
  const asked = w2.voice.answer(v2.answers.find((a) => a.approach === 'ask').i);
  assert.equal(asked.warmth, v2.warmth + 2, 'ask (base 1) and the recall');
  assert.equal(asked.lines[0].text, 'Still THIS AND THAT, then?');
});

test('a subject that recalls something comes up only once it\'s learned, and its opener lands better; unlearned fills are left as they are', () => {
  const w = talky({ voice: { theirs: 0 } });
  w.voice.thread({ id: 'again', label: 'Is it still {learned.trouble}?', recalls: 'trouble', weight: 9, beats: { start: { text: 'It is, {learned.trouble}. And {learned.nothing}.', end: true } } });
  w.person('ana', { home: 'home_a', traits: { temper: 0.9 } });
  assert.ok(!w.voice.start('ana').answers.some((a) => a.id === 'again'));
  choose(w, (a) => a.id === 'how');
  choose(w, (a) => a.say === 'Why\'s that, then?');
  w.voice.end();
  const hub = w.voice.start('ana');
  const again = hub.answers.find((a) => a.id === 'again');
  assert.deepEqual([again.label, again.recalls], ['Is it still this and that?', 'trouble']);
  const v = w.voice.answer(again.i);
  assert.deepEqual(v.lines.map((l) => l.text), ['Is it still this and that?', 'It is, this and that. And {learned.nothing}.']);
  assert.equal(v.warmth, hub.warmth + 1);
});

test('acquaintances: everyone the speaker has talked with, latest first, changing nothing', () => {
  const w = talky({ voice: { theirs: 0 } });
  w.person('ana', { home: 'home_a' });
  w.person('bo', { home: 'home_b' });
  w.person('cy', { home: 'home_b' });
  assert.deepEqual(w.voice.acquaintances(), []);
  w.voice.start('bo'); w.voice.end();
  w.advance(HOUR);
  w.voice.start('ana');
  choose(w, (a) => a.id === 'how');
  choose(w, (a) => a.say === 'Why\'s that, then?');
  w.voice.end();
  w.advance(HOUR);
  w.voice.start('cy');
  const h = w.hash();
  const all = w.voice.acquaintances();
  assert.equal(w.hash(), h, 'a look');
  assert.deepEqual(all.map((a) => a.who), ['cy', 'ana', 'bo'], 'a first talk still going first, then the latest');
  assert.deepEqual(all[0], { who: 'cy', talks: 0, last: null, familiarity: 0, learned: {} });
  assert.deepEqual(all[1], { who: 'ana', talks: 1, last: w.now - HOUR, familiarity: 1.5, learned: { trouble: 'this and that' } });
  assert.deepEqual(all[2], { who: 'bo', talks: 1, last: w.now - 2 * HOUR, familiarity: 0.5, learned: {} });
  assert.deepEqual(w.voice.acquaintances('bo'), [], 'by speaker');
  all[0].learned.trouble = 'changed';
  assert.equal(w.voice.learned('ana').trouble, 'this and that', 'copies');
});

test('Rocinante: once you know about Ruth\'s radio, you can ask after it, and it lands better', () => {
  const w = rocinante({ start: 9 * HOUR });
  assert.ok(!w.voice.start('ruth').answers.some((a) => a.id === 'radio.again'), 'nothing to ask after yet');
  const radio = w.voice.answer(w.voice.current().answers.find((a) => a.id === 'radio').i);
  w.voice.answer(radio.answers.find((a) => a.say === 'Tomas fixes radios.').i);
  w.voice.end();
  w.advance(HOUR);
  const hub = w.voice.start('ruth');
  const again = hub.answers.find((a) => a.id === 'radio.again');
  assert.equal(again.recalls, 'radio');
  const v = w.voice.answer(again.i);
  assert.equal(v.lines.find((l) => l.who === 'them').text, 'Still broken. Thanks for asking, though.');
  assert.equal(v.landed, 'well');
  assert.equal(w.voice.acquaintances()[0].who, 'ruth');
});
