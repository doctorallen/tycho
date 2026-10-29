// The sandbox: a town running live, going back in time, changed and built
// again to the same moment (with what the change did to the story), undone,
// checked, and told in every layout and from anyone's point of view.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Eros, sandbox } from './helpers.mjs';

test('it plays by real time, steps, and goes back (dropping what came after from the story)', () => {
  const sb = sandbox();
  const t0 = sb.now;
  sb.tick(1000);
  assert.equal(sb.now, t0, 'paused, the clock stands still');
  sb.playing = true;
  sb.speed = 60;
  sb.tick(1000);
  assert.equal(sb.now, t0 + 60);
  sb.playing = false;
  sb.step(1440);
  const n = sb.entries.length;
  assert.ok(n > 300 && sb.feed.length > 5);
  sb.back(360);
  assert.equal(sb.now, t0 + 60 + 1440 - 360);
  assert.ok(sb.entries.length < n && sb.entries.every((e) => e.t <= sb.now));
  assert.ok(sb.feed.every((b) => b.t <= sb.now));
  // further back than Esper keeps snapshots: built again and run to the moment, the same moment either way
  sb.step(3 * 1440);
  const later = sb.now, hash = sb.world.hash();
  sb.back(2 * 1440 + 30);
  assert.equal(sb.now, later - 2 * 1440 - 30);
  sb.step(2 * 1440 + 30);
  assert.equal(sb.world.hash(), hash);
  // not before the start
  sb.back(99999);
  assert.equal(sb.now, t0);
  sb.restart('another');
  assert.equal(sb.seed, 'another');
  assert.equal(sb.now, t0);
});

test('a change builds the town again to the same moment, with the same seed, and says what it did to the story; undo puts it back', () => {
  const sb = sandbox({}, 1);
  const t = sb.now, hash = sb.world.hash();
  const sleep = sb.model.calls.find((c) => c.method === 'action' && c.code.includes("id: 'sleep'"));
  sb.updateCall(sleep.id, sleep.code.replace('minutes: [420, 510]', 'minutes: [200, 240]'));
  assert.equal(sb.now, t);
  assert.notEqual(sb.world.hash(), hash);
  assert.match(sb.change.summary, new RegExp(`changed w\\.action #${sleep.id}`));
  assert.ok(sb.change.added.length > 10 && sb.change.removed.length > 10);
  assert.ok(sb.undo());
  assert.equal(sb.world.hash(), hash, 'undone, the same world as before');
  assert.ok(!sb.undo());
  // adding, duplicating and removing
  const id = sb.addCall('reverie', 'feeling', "{ id: 'smug', label: 'Smug', weight: 0.05, minutes: 120 }");
  assert.ok(sb.model.calls.some((c) => c.id === id));
  assert.ok(sb.world.reverie.feelingDefs.has('smug'));
  const copy = sb.duplicateCall(id);
  assert.equal(sb.model.calls.filter((c) => c.code.includes("'smug'")).length, 2);
  sb.removeCall(copy);
  sb.removeCall(id);
  assert.ok(!sb.world.reverie.feelingDefs.has('smug'));
  assert.equal(sb.world.hash(), hash);
});

test('a change that fails is reported, call by call', () => {
  const sb = sandbox();
  const id = sb.addCall('world', 'action', '{ id: undefined }.oops.nope');
  assert.deepEqual(sb.change.errors.map((e) => e.id), [id]);
  assert.ok(sb.errors.length);
});

test('the checks run on the town as it is', () => {
  const sb = sandbox();
  const r = sb.runChecks(1);
  assert.equal(r.state, 'passed', r.failures.join('\n'));
  assert.match(r.summary, /1 day/);
});

test('the story in every layout, about someone, from someone\'s point of view, in their words', () => {
  const sb = sandbox({ harm: true }, 2, 'voight-kampff');
  for (const layout of Eros.LAYOUTS) {
    const lines = sb.story({ ...Eros.DEFAULT_STORY, layout });
    assert.ok(lines.length, layout);
    for (const l of lines) assert.equal(typeof l.text, 'string');
  }
  const thread = sb.story({ ...Eros.DEFAULT_STORY, layout: 'thread' });
  assert.ok(thread.some((l) => l.kind === 'head' && /Pip's snare/.test(l.text)), thread.filter((l) => l.kind === 'head').map((l) => l.text).join(', '));
  const about = sb.story({ ...Eros.DEFAULT_STORY, who: 'tomas' }).filter((l) => l.kind === 'beat');
  assert.ok(about.length && about.every((l) => /Tomas/.test(l.text)));
  const mine = sb.story({ ...Eros.DEFAULT_STORY, as: 'tomas', voice: 'first' }).filter((l) => l.kind === 'beat');
  assert.ok(mine.some((l) => /^I /.test(l.text)) && !mine.some((l) => /^Tomas /.test(l.text)));
  const recount = sb.story({ ...Eros.DEFAULT_STORY, layout: 'recount', as: 'tomas', limit: 3 });
  assert.match(recount[0].text, /What Tomas would say/);
  assert.equal(recount.filter((l) => l.kind === 'beat').length, 3);
  assert.match(sb.story({ ...Eros.DEFAULT_STORY, layout: 'changes' })[0].text, /No changes yet/);
});
