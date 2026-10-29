# Voice

Branching conversations: a talk is a run of threads, each a few beats about one subject; a beat is something they say and two or three answers; each answer comes at them some way (warm, a joke, a question: the game names its approaches) that lands well or badly with them, by their nature and how things stand. Named for the Voice of Dune, the Bene Gesserit's art of saying the right thing the right way.

Beside [Cityspeak](cityspeak.md)'s single lines and barks, Voice is for talks the player takes part in: Merryfolk's talks with the wizard, a customer's offer at a counter, a resident's small talk. The words stay the game's: beats name line topics, and Cityspeak's chooser picks the most specific line for the moment.

- [A talk](#a-talk)
- [Threads and beats](#threads-and-beats)
- [Answers and approaches](#answers-and-approaches)
- [Warmth and patience](#warmth-and-patience)
- [What comes up](#what-comes-up)
- [A talk that follows itself](#a-talk-that-follows-itself)
- [The words](#the-words)
- [What a talk leaves](#what-a-talk-leaves)
- [Knowing someone](#knowing-someone)
- [Promises](#promises)
- [Driving it from the game](#driving-it-from-the-game)
- [State](#state)
- [API](#api)
- [Terms, effects, events and log](#terms-effects-events-and-log)
- [Config](#config)
- [With other modules](#with-other-modules)
- [Example](#example)

## A talk

```js
const view = world.voice.start('rose');            // the player starts a talk with Rose
// view.lines: [{ who: 'them', key: 'greet_back_again', text: 'Back again! We were talking about your evenings.' }]
// view.answers: [{ i: 0, kind: 'thread', id: 'how', label: 'How are you keeping?' }, ..., { i: 3, kind: 'bye', id: 'bye' }]
world.voice.answer(0);                             // raise "How are you keeping?"
world.voice.current();                             // the beat: what was said, and what can be said back
world.voice.answer(1);                             // a joke...
```

A talk opens with their greeting, and then, at the hub, offers a few subjects worth raising (and goodbye). Choosing one starts its thread; each beat shows what they say and the answers; an answer leads to another beat or ends the subject; then it's back to the hub, unless they raise something of their own. "Let it lie" (`drop`) drops a subject without its effects; goodbye ends the talk with their farewell. Everyone's patience runs out: after so many beats they close the talk and only goodbye is left.

Talks are held by whoever is talking (`by`, default `'player'`): one talk at a time each, so a game where residents talk to each other through Voice can run several. Starting a talk with someone else ends the one in progress.

## Threads and beats

```js
world.voice.thread({
  id: 'how', label: 'How are you keeping?', weight: 1.3, cooldown: 1440, approach: 'warm',
  open: { warm: 'How are you keeping?' },
  beats: {
    start: { line: 'how.start', answers: [
      { say: "Why's that, then?", approach: 'ask', if: ['mood<0.45'], to: 'why' },
      { say: "You look like someone who's had four breakfasts.", approach: 'jest', to: [{ landed: 'badly', to: 'sulk' }, { to: 'tease' }] },
      { say: "Tell me what's on your mind.", warmth: 3, soft: true, to: 'why' },
    ] },
    why: { line: 'how.why', then: ['learn:trouble'], answers: [
      { say: "That's hard. I'm sorry.", approach: 'comfort', then: ['need.company-=0.1'], to: 'end' },
      { say: "I'll see what I can do.", then: ['promise:help'], to: 'end' },
    ] },
    tease: { line: 'how.tease', end: true },
    sulk: { line: 'how.sulk', end: true },
  },
  then: ['regard+=0.01'],
});
```

A thread's first beat is `start` (or `start: '<name>'`). A beat's words are a `line` topic (chosen by Cityspeak) or `text`; `who` says them: `'them'` (the person, the default), `'you'` (the speaker), or `'aside'` (narration). Reaching a beat runs its `then` effects and costs a point of patience. A beat with `end`, or with no answers, ends the subject. A subject talked through to its end runs the thread's `then`; one let lie doesn't.

## Answers and approaches

An answer is `say` (the words, or a line topic for a speaker who's a person with lines), an optional `label` for the choice, an `approach`, effects (`then`), and where it leads (`to`): a beat, `'end'` (the subject's done; the default), `'thread:<id>'` (a door into another subject: this one is talked through, and that one starts at once, without an opener, since the answer was the way in), `'bye'` (the talk's over), or a list whose first fitting entry wins: `{ if?, landed?, warmth?, to }`.

At most `config.choices` (3) answers are offered, in order, besides "let it lie" and goodbye. An answer whose `if` fails, or that needs more `warmth` than the talk has, is hidden, or, with `soft`, shown but not yet choosable (`ok: false`). A beat come round again doesn't offer an answer already said in the talk.

```js
world.term('temper', (ctx) => temperOf(ctx.person));   // the game's own reading of someone
world.voice.approach({ id: 'jest', lands: [{ if: ['temper=cheerful'], by: 2 }, { if: ['temper=witty'], by: 2 }, { if: ['temper=ornery'], by: -2 }, { if: ['temper=shy'], by: -1 }] });
world.voice.approach({ id: 'advise', lands: [{ if: ['temper=proud'], by: -2 }, { if: ['regard>0.3'], by: 1 }] });
world.voice.approach({ id: 'comfort', lands: (ctx) => (ctx.world.lang.value('mood', ctx) < 0.3 ? 2 : 0) });
```

An approach **lands** with a number: its `base`, plus every `lands` rule whose conditions hold (or a function's answer), with the listener as the person and the speaker as the target (and, when the game turns it on, what they know of each other: [Knowing someone](#knowing-someone)). Above 0 it lands `'well'`, below `'badly'`, at 0 `'even'`: the talk keeps it (`landed`, for the answer's `to` and for lines' conditions) and adds the number to the talk's warmth. A landing of `config.strong` (2) or more either way runs `config.onWell` or `config.onBadly` (say, `regard+=0.015` and `regard-=0.02`), and they react, if they have a line for it: topic `react.<approach>.well`, else `react.well` (and `badly`). A thread's `approach` lands as it's opened.

## Warmth and patience

**Warmth** is how open the talk is: it starts at `voice.warmth(ctx)` (by default their regard for the speaker × 3, rounded, between -1 and 3, with Fellowship: `warmthRegard`, `warmthMin`, `warmthMax`; else 0), rises and falls with each landing, and with the `warmth` effect. Answers can need it.

**Patience** is how many beats they'll talk for: `voice.patience(ctx)` (by default `config.patience`, 8), times the headline knob `chatter` (the world's times the person's own, rounded, at least 1). `chatter` scales the chance they raise something of their own (`theirs`) too. Merryfolk's is 6, more for the chatty and those fond of the wizard, less for the hungry, the tired and those at work. When it's spent and a subject ends, they close the talk (topic `close`) and only goodbye is left.

`warmth` and `patience` are definitions: set them on every start, like Cradle's namer.

```js
world.voice.patience = (ctx) => 6 + (ctx.world.lang.value('trait.talkative', ctx) > 0.7 ? 2 : 0) - (ctx.world.lang.value('need.hunger', ctx) > 0.65 ? 2 : 0);
```

## What comes up

At the hub, the subjects offered are the `config.offers` (3) best, among threads whose `if` holds (the person, with the speaker as target) that aren't theirs and haven't come up in this talk:

```
score = weight × fresh × (0.1 if sore: soreWeight) × (1.5 if it reveals something not yet learned: revealPull)  + a little variety
fresh = 1 if never talked of, else 1 - e^(-(minutes since) / cooldown)
```

A subject under 0.05 (`salientFloor`) before the variety isn't offered. The variety is up to 0.2 (`variety`), the same for a pair all day (it changes nothing), or, with `reshuffle`, drawn afresh each time the subjects are offered (each talk, and each return to them). With `followPull`, a subject about what was just said is worth more ([below](#a-talk-that-follows-itself)). `weight` can be a function. A subject just talked of comes round again gradually over its `cooldown` (`config.cooldown`, three days, by default).

**Their turn.** At the start of a talk, and whenever a subject ends, with chance `config.theirs` (0.3, times `chatter`), they raise a thread marked `theirs` (one whose `if` holds, not talked of within its cooldown, drawn by weight from the talk's own stream). Its first beat is theirs; there's no opener from the speaker. The view's thread says `theirs: true`.

## A talk that follows itself

By default a greeting is only a greeting, and the subjects on offer are weighed without regard to what was just said. A game can have the talk follow on from itself.

**Opening with a subject.** A thread marked `opens` is how they start the talk when it can (its `if` holds, it recalls nothing not yet learned, and it hasn't been talked of within its `cooldown`): its first beat is their greeting, with answers, in place of the plain one, so what they say first can be answered (one is drawn by weight from the talk's stream if several can; with none, the plain greeting). It's theirs (the view's thread says `theirs: true`) and never offered. When it ends, they may raise something of their own as usual. The beat's `line` can be the greeting's own topic, so the words are the same and only the answers are new.

```js
v.thread({ id: 'at.pies', opens: true, if: ['doing:eat'], cooldown: 60, about: ['food'], beats: {
  start: { line: 'greet', answers: [
    { say: 'What kind?', approach: 'ask', to: 'kind' },
    { say: 'Don\'t let me stop you.', approach: 'warm' },
    { say: 'Who taught you to cook?', approach: 'ask', to: 'thread:family' }] },
  kind: { text: 'Pork. Always pork.', end: true } } });
```

**What it's about.** A thread can say what it's about (`about: ['work', 'family']`). While it's talked of, and after it's talked through, those are the talk's topics (the term `about:<topic>`); an effect `about:<topic>` turns the talk to one more ("And your family?" with `then: ['about:family']`). At the hub, a subject sharing a topic with them is worth `followPull` times more, so what comes up follows from what was said. A subject let lie leaves nothing to follow, and a thread without `about` clears them. `followPull` is 1 by default: it changes nothing until a game sets it.

Together with doors (`to: 'thread:<id>'`), which carry an answer straight into a related subject, these let a talk run from one thing to the next instead of back to the same few subjects.

## The words

A beat's `line`, the greeting (`config.greet`), their goodbye (`bye`), their closing (`close`) and reactions are line topics. With Cityspeak on and the speaker a person, the words are Cityspeak's most specific line on that topic (lines without the topic don't count), passing over lines said in this talk or said to this listener within `config.fresh` (seven days), unless there's nothing else. The view's line carries the line's `key` and `text`. With no line for a topic, the line carries only the `key` (the topic), for a game that looks its words up itself; a beat's `text` stands in when there's no line. Lines' conditions can read the talk: `warmth`, `landed`, `learned:<key>`, `talks`, `promise:<id>`...

The speaker's words (answers, openers) are returned as they're written; when the speaker is a person with lines on a topic of that name, their line is chosen instead. Any of the words can say what's been learned about them, `{learned.<key>}`, filled in as they're said ([Knowing someone](#knowing-someone)).

Voice keeps its own record of the lines said in talks (for freshness); Cityspeak's `once` and `cooldown` still count only lines said with `cityspeak.say`, and they still rule lines out in talks.

## What a talk leaves

Effects in beats, answers and threads run with the person talked to as the person and the speaker as the target, so any module's effects work: `feel:<feeling>` (Reverie), `regard+=0.05` (their regard for the speaker), `believe:<key>`, `need.company-=0.2`, `var.x+=1`. Voice adds:

- `learn:<key>=<value>` (`true` without a value): the speaker learns something about them, kept for good (`learned:<key>`; `voice.learned(who)`), with a note in the view the first time (`{ who: 'note', learned, value }`).
- `promise:<id>=<days>`: a promise to them (below).
- `sore:<thread>=<days>` (the current thread, two days, `soreDays`, by default): a subject best left a while (weighed at a tenth).
- `warmth+=n`: the talk warms (or cools).
- `about:<topic>`: the talk turns to a topic ([A talk that follows itself](#a-talk-that-follows-itself)).

Each pair keeps a bond: how many talks (counted as each ends), when the last ended, when each subject was last talked of, sore subjects, what's been learned, lines said lately. `familiarity` is half a point a talk plus a point for each thing learned (`familiarTalk`, `familiarLearned`). With `config.deed` set (say, `'talked'`), the end of a talk is a deed the speaker did for them (a [deed](../integration.md#sensing-and-deeds): feelings, regard, a note in their file).

## Knowing someone

What the speaker learns and how familiar the two of them are can matter in a talk, as far as the game wants it to.

**Familiarity as trust.** With `familiarLand` set, every approach lands better with someone who knows the speaker: `familiarity × familiarLand`, up to `familiarLandMax` (1), added to the landing. So warm words, a joke, a lie or a bribe go down better with someone who's talked with you and told you things. An approach's own `familiar` scales its share (1 by default; 0 for one that knowing you doesn't help, like a haggle with a hard bargainer). `familiarLand` is 0 by default: it changes nothing until a game sets it. [Wormtongue](wormtongue.md#witnessing) has its own: a witness who knows you is slower to report you (`familiarReport`).

**Recalling what you've learned.** An answer, or a subject, can carry `recalls: '<key>'`: it's only offered once the speaker has learned that key about them (with `soft`, shown but not yet choosable), and it lands `recallLand` (1) better, on top of its approach, or on its own if it has none. The view's option carries `recalls` too, for a game that shows it. A subject's opener lands with it; their reaction to a strong one is `react.<approach>.well`, or `react.recall.well` with no approach.

```js
v.thread({ id: 'radio.again', label: 'How\'s the radio?', recalls: 'radio', approach: 'warm',
  beats: { start: { text: 'Still {learned.radio}. Thanks for asking, though.', end: true } } });
v.thread({ id: 'family', label: 'How are the kids?', recalls: 'home', beats: { start: { line: 'family.start', answers: [
  { say: 'Say hello to {learned.home:kids} for me.', recalls: 'home', approach: 'warm' },
  { say: 'Sounds loud.', approach: 'jest' },
] } } });
```

**The words.** Anything Voice says or offers (answers' words and labels, subjects' labels and openers, beats' `text`, Cityspeak's lines in a talk) can say what's been learned: `{learned.<key>}`, or `{learned.<key>:<form>}` for a form the sentence asks for. They're filled by the definition `voice.remembered(ctx, key, value, form)` (the person talked to, the speaker as target), which by default gives a word or a number as it is and nothing for anything else; a key not learned is left as it is, for the game to see. Set it on every start, like `warmth`:

```js
v.remembered = (ctx, key, value, form) => (key === 'home' && form === 'kids' ? kidsOf(value).join(' and ') : String(value));
```

**Everyone you know.** `voice.acquaintances(by)` lists everyone the speaker has talked with, `{ who, talks, last, familiarity, learned }` each, the latest first (someone in a first talk still going first of all, with `last: null`), then by id: a notebook of people, a map's names on doors. It changes nothing.

## Promises

```js
world.voice.promise({ id: 'see_to_wish', label: 'You said you would see to my wish', days: 3,
  kept: ['granted:pint>0'], onKept: ['regard+=0.05'], onBroken: ['regard-=0.1'], lapse: 'lapsed' });
```

An effect `promise:<id>` opens one (once: not while one of the kind is open). Each hour, open promises are checked: `kept` conditions holding keep it, `broken` ones break it, and when it comes due it comes to its `lapse` (`'lapsed'` by default; Merryfolk's secrets lapse to `'kept'`). Settling runs `onKept`, `onBroken` or `onLapsed` (the one promised to as the person, the speaker as the target), logs and emits `promise`. `promise:<id>` reads the latest one's state (`open`, `kept`, `broken`, `lapsed`), so greetings can say "You kept your word!"

## Driving it from the game

`start`, `answer` and `end` are inputs: recorded for time walk and replayed exactly, and they apply at once even from a listener (`start` and `answer` return the view). `current` only reads. The answers on offer are worked out as each choice is made and kept with the talk, so a replay offers the same. Every draw (their turn, which of several texts) comes from a stream of the talk itself, so the person's own stream is untouched; choosing among equal lines peeks.

```js
function showTalk(view) {
  for (const l of view.lines) bubble(l.who, l.text ?? words(l.key));
  menu(view.answers.map((a) => ({ text: a.label ?? a.say ?? (a.kind === 'drop' ? 'Let it lie' : a.kind === 'bye' ? 'Good day' : ''), disabled: !a.ok, pick: () => showTalk(world.voice.answer(a.i)) })));
  if (view.ended) closeMenu();
}
showTalk(world.voice.start(villager.id));
```

Voice doesn't hold the person still: a game that wants them to stop and talk can give them a directive while the talk lasts (`world.direct`), or an action that `talking` allows.

## State

In `world.s.mod.voice`, made with the first talk:

| Key | Holds |
|---|---|
| `talks` | By speaker: the talk in progress (`who`, `by`, its start and counter, warmth, patience, the thread and beat, subjects done, what was said, the lines and answers on show, how the last approach landed, whether they've had enough) |
| `bonds` | By `'<who>><by>'`: `{ talks, last?, seen, sore?, known?, said?, lastThread? }` |
| `promises` | `{ who, by, id, t, due, state, settled? }` (settled ones kept 30 days, `promiseKeep`) |

## API

`world.voice`. **Input** methods are recorded and safe from the game.

| Method | Returns | |
|---|---|---|
| `approach(def)`, `thread(def)`, `promise(def)` | this | Declarations: [ApproachDef](#approachdef), [ThreadDef](#threaddef), [PromiseDef](#promisedef) |
| `start(who, by = 'player')` | TalkView or null | **Input** (applies at once). Starts a talk (null if they can't talk) |
| `answer(i, by = 'player')` | TalkView or null | **Input** (applies at once). Chooses `current().answers[i]` |
| `end(by = 'player')` | void | **Input.** Ends the talk without a goodbye |
| `current(by = 'player')` | TalkView or null | The talk in progress |
| `familiarity(who, by = 'player')` | number | Half a point a talk, a point for each thing learned |
| `learned(who, by = 'player')` | object | What the speaker has learned about them |
| `acquaintances(by = 'player')` | Acquaintance[] | Everyone the speaker has talked with: `{ who, talks, last, familiarity, learned }`, the latest first; a look |
| `history(who, by = 'player')` | object | `{ talks, last, lastThread, seen }` |
| `promises(who?)` | array | Promises (copies) |
| `warmth`, `patience` | functions | `(ctx) => number`: a talk's starting warmth and patience (definitions) |
| `remembered` | function | `(ctx, key, value, form) => string`: what's been learned in words, for `{learned.<key>:<form>}` (a definition) |
| `applyStart`, `applyAnswer`, `applyEnd`, `applyLearn`, `applyPromise` | | **Engine** versions |
| `approaches`, `threads`, `promiseDefs`, `config` | | Declarations and config |

**TalkView**: `{ who, by, thread: { id, label, beat, theirs } | null, lines: TalkLine[], answers: Array<{ i, kind, id, ok, label?, say?, approach?, recalls? }>, warmth, patience, landed, over, ended }`. `kind` is `'thread'`, `'answer'`, `'drop'` or `'bye'`. **TalkLine**: `{ who: 'them' | 'you' | 'aside' | 'note', key?, text?, learned?, value? }`.

### ThreadDef

| Field | Default | Meaning |
|---|---|---|
| `id` | required | |
| `label` | the id | What it's offered as: words, or `(ctx) => string` |
| `if` | none | Conditions for it to come up |
| `weight` | 1 | A number, or `(ctx) => number` |
| `cooldown` | `config.cooldown` (3 days) | Minutes for it to come round fresh again |
| `theirs` | false | They raise it themselves |
| `opens` | false | They open the talk with it when it can: its first beat is their greeting, with answers |
| `about` | none | Topics it's about: subjects sharing one are offered first after it (`followPull`) |
| `reveals` | none | A key it's for learning: wanted more until learned |
| `recalls` | none | A key it recalls: it comes up only once that's learned, and its opener lands `recallLand` better |
| `open` | the label | The speaker's opener: words or a topic, or `{ approach: words }` |
| `approach` | none | The opener's approach (it lands as the thread opens) |
| `start` | `'start'` | The first beat |
| `beats` | required | By name: [BeatDef](#beatdef) |
| `then` | none | Effects when talked through to the end |

### BeatDef

| Field | Default | Meaning |
|---|---|---|
| `line` | none | A line topic: the words, chosen by Cityspeak |
| `text` | none | Or the words (one picked, if several) |
| `who` | `'them'` | `'them'`, `'you'` or `'aside'` |
| `then` | none | Effects when reached |
| `answers` | none | [AnswerDef](#answerdef)s |
| `end` | false | The subject ends here |

### AnswerDef

| Field | Default | Meaning |
|---|---|---|
| `say` | required | Words, or a line topic |
| `label` | none | The choice's label, if not the words |
| `approach` | none | How it comes at them |
| `if` | none | Offered only when these hold |
| `recalls` | none | A key it recalls: offered only once that's learned, and it lands `recallLand` better |
| `soft` | false | Shown but not choosable when `if`, `recalls` or `warmth` fails |
| `warmth` | none | Needs at least this much warmth |
| `then` | none | Effects when chosen |
| `to` | `'end'` | A beat, `'end'`, `'thread:<id>'`, `'bye'`, or `[{ if?, landed?, warmth?, to }]` (the first that fits) |

### ApproachDef

| Field | Default | Meaning |
|---|---|---|
| `id` | required | |
| `label` | none | |
| `lands` | none | `[{ if?, by }]` added up when their conditions hold, or `(ctx) => number` |
| `base` | 0 | Added to every landing |
| `familiar` | 1 | How much the listener's familiarity counts for it (times `familiarLand`); 0 for none |

### PromiseDef

| Field | Default | Meaning |
|---|---|---|
| `id` | required | |
| `label` | none | |
| `kept`, `broken` | none | Conditions checked each hour |
| `days` | `config.promiseDays` (3) | Days until it's due (the effect's value overrides) |
| `lapse` | `'lapsed'` | What it comes to when due: `'kept'`, `'broken'` or `'lapsed'` |
| `onKept`, `onBroken`, `onLapsed` | none | Effects when settled |

## Terms, effects, events and log

Terms (the person, with the speaker as target): `talks` (talks they've had), `familiar` (their familiarity with the speaker), `talking` / `talking:<by>`, `warmth`, `patience`, `landed`, `about:<topic>` (the talk's on it), `learned:<key>`, `sore:<thread>`, `talked:<thread>` (ever talked of), `talked` (minutes since their last talk ended, or `null`), `promise:<id>`. Effects: `learn:<key>=v`, `promise:<id>=days`, `sore:<thread>=days`, `warmth+=n`, `about:<topic>`.

| Event | Payload |
|---|---|
| `voice:start` | `{ who, by }` |
| `voice:end` | `{ who, by, threads, why }`: `why` is `'bye'`, `'left'` or `'gone'` |
| `promise` | `{ who, by, id, state }` |

Log entries: `talk`, `talked`, `learned`, `promised`, `promise`.

## Config

`Tyrell.create({ moduleConfig: { voice: { ... } } })`:

| Field | Default | Meaning |
|---|---|---|
| `offers` | 3 | Subjects offered at once |
| `choices` | 3 | Answers offered at once (besides let it lie and goodbye) |
| `theirs` | 0.3 | The chance they raise something of their own |
| `patience` | 8 | Beats before they've had enough (unless `voice.patience` says) |
| `fresh` | 10080 (7 days) | Minutes a line said to someone is passed over |
| `strong` | 2 | A landing this strong runs `onWell` or `onBadly`, and draws a reaction |
| `onWell`, `onBadly` | `[]` | Effects of a strong landing |
| `greet`, `bye`, `close`, `react` | `'greet'`, `'bye'`, `'close'`, `'react'` | Line topics |
| `deed` | `null` | A deed recorded when a talk ends |
| `chatter` | 1 | Headline knob: how chatty they are (patience and `theirs`, times it). A person's own (`tune: { voice: { chatter } }`) multiplies it |
| `warmthRegard`, `warmthMin`, `warmthMax` | 3, -1, 3 | The default warmth: regard times this, rounded, between these |
| `familiarTalk`, `familiarLearned` | 0.5, 1 | `familiarity`: for each talk, for each thing learned |
| `familiarLand`, `familiarLandMax` | 0, 1 | Familiarity as trust: every approach lands this much better a point of familiarity, up to the most (0: it doesn't count) |
| `recallLand` | 1 | An answer or subject that `recalls` something learned lands this much better |
| `cooldown` | 4320 (3 days) | A thread's `cooldown` when it gives none |
| `soreDays`, `soreWeight` | 2, 0.1 | How long `sore` lasts with no number, and what a sore subject is worth |
| `revealPull` | 1.5 | A subject for learning something not yet learned is worth this much more |
| `salientFloor`, `variety` | 0.05, 0.2 | Subjects under this aren't offered; up to this much variety |
| `reshuffle` | false | The variety drawn afresh each time the subjects are offered, not once a day |
| `followPull` | 1 | A subject sharing a topic with the one just talked of is worth this much more (1: it doesn't count) |
| `promiseDays`, `promiseKeep` | 3, 30 | A promise's `days` when it gives none; days a settled promise is remembered |

See [Tuning](../tuning.md#voice); during play, `world.tune('voice', { ... })`.

## With other modules

- **Cityspeak** chooses the words (Voice works without it, with beats' own `text`, or keys the game looks up).
- **Fellowship**: the default warmth reads regard; `regard` effects change it.
- **Wormtongue** reads familiarity: with its `familiarReport` set, a witness who knows the speaker is slower to report them.
- **Reverie**: `feel:` effects, `believe:` for something told; the `deed` notes a talk in their file on the speaker.
- **Bicameral**'s wishes: a promise can be kept by `granted:<wish>`, an answer can `wish:` or `grant:`.
- **Athelas**: lines and threads can read `under:cold`; an answer can `cure:`.

## Example

The White Dragon's counter, a customer with a job:

```js
const v = world.voice;
v.approach({ id: 'firm', lands: [{ if: ['trait.thrift>0.6'], by: -1 }, { if: ['regard>0.3'], by: 1 }] });
v.approach({ id: 'kind', base: 1 });
v.thread({
  id: 'offer', label: 'A job', theirs: true, if: ['has:broken_radio'],
  beats: {
    start: { line: 'offer.start', answers: [
      { say: "I'll have it done by tomorrow.", approach: 'kind', then: ['promise:fix_radio'], to: 'thanks' },
      { say: "It'll cost you double.", approach: 'firm', to: [{ landed: 'badly', to: 'walks' }, { to: 'grudging' }] },
      { say: "Can't help you.", to: 'bye' },
    ] },
    thanks: { line: 'offer.thanks', end: true },
    grudging: { line: 'offer.grudging', then: ['var.pays+=1'], end: true },
    walks: { line: 'offer.walks', then: ['regard-=0.1'], end: true },
  },
});
v.promise({ id: 'fix_radio', days: 1, kept: ['has:radio'], onKept: ['regard+=0.1'], onBroken: ['regard-=0.2'], lapse: 'broken' });
```
