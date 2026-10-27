# Cityspeak

Talk: lines chosen by the most specific rule that matches, barks between people near the player, practices (situations with roles), social acts the target can refuse, the mood of a room, and a bridge to ink stories. Named for Blade Runner's street language, a mix of everything spoken in the city.

The ideas come from Valve's dialogue rules (the most specific matching rule wins), Versu (practices with roles), and Prom Week's Comme il Faut (social acts with an accept test).

- [Lines](#lines)
- [Saying, choosing and answering](#saying-choosing-and-answering)
- [Barks](#barks)
- [Practices and the room](#practices-and-the-room)
- [Social acts](#social-acts)
- [ink](#ink)
- [State](#state)
- [API](#api)
- [Terms](#terms)
- [Events](#events)
- [With other modules](#with-other-modules)
- [Example](#example)

## Lines

The game owns the words. A line is a key (what the game looks up) with rules for when it fits, and optionally the words themselves.

```js
world.cityspeak.addLines([
  { key: 'greet', topic: 'greet', text: ['Morning.', 'All right?', 'Hey.'] },
  { key: 'greet_friend', topic: 'greet', to: ['friend'], text: 'There you are!' },
  { key: 'greet_tired', topic: 'greet', when: ['need.energy>0.7'], text: "Don't. I'm half asleep." },
  { key: 'greet_fixer', topic: 'greet', to: ['file:target.fixed>0'], text: "You're the one who fixed my radio." },
  { key: 'bread', topic: 'greet', who: 'mara', when: ['at:cafe'], text: "Bread's fresh this morning.", cooldown: 360 },
]);
```

`LineDef`:

| Field | Default | Meaning |
|---|---|---|
| `key` | required | What the game looks up for the words |
| `text` | none | The words, if the engine should carry them: a string, or several (one is picked) |
| `who` | anyone | Who says it: a person id, `'tag:<tag>'`, `'job:<id>'`, `'group:<id>'` (from their definition), or a list of conditions |
| `when` | none | Conditions on the speaker and the moment |
| `to` | none | Conditions about the listener. The speaker is still `person`; the listener is `target` (`'friend'`, `'regard>0.5'`, `'target.is:child'`, `'file:target.fixed>0'`). A line with `to` needs a listener |
| `topic` | none | The topic it answers: `'greet'`, `'bye'`, `'rumor'`... |
| `weight` | 1 | Among equally specific lines, how likely |
| `cooldown` | none | Minutes before the same speaker says it again |
| `once` | false | Said only once per speaker |
| `then` | none | Effects when said on purpose (`say`), not when barked |
| `reply` | none | What the listener answers with: a line key, or `'topic:<x>'` for the listener's best line on that topic |

**The most specific line wins.** Among the lines that match, the one with the most specificity is chosen: +1 for a topic, +2 for a `who` string, +1 per condition in `who`, `when` and `to`. Ties are drawn by `weight` from a stream that changes nothing.

**Topics.** Asked with a topic, a line matches if it has that topic or no topic (topical lines win, being more specific). Asked without a topic, only lines without a topic match.

`once` and `cooldown` count lines said with `say`, per speaker.

## Saying, choosing and answering

```js
const line = world.cityspeak.choose('ruth', { topic: 'greet', to: 'player' });   // what she'd say; nothing changes
const said = world.cityspeak.say('ruth', { topic: 'greet', to: 'player' });      // she says it
// said: { who: 'ruth', key: 'greet', text: 'Morning.', to: 'player', topic: 'greet' }
const back = world.cityspeak.answer(said, 'player');                             // the reply, if the line has one
```

- `choose(who, { to?, topic? })` returns a `Said` or `null` and changes nothing. In this version the returned object also carries an internal `_i` field (the line's index); ignore it.
- `say(who, { to?, topic? })` is an input: it chooses, remembers it was said (for `once` and `cooldown`), applies the line's `then` effects (with the speaker as `person` and the listener as `target`), logs `said` and emits `say`. It returns the `Said`, or `null`. It applies at once even inside a listener.
- `answer(said, by)` returns the listener's reply. A `reply` of `'topic:<x>'` chooses the listener's best line on topic `x` (to the first speaker); a reply key returns that line directly, with the first of its texts, without checking its conditions.

`Said` is `{ who, key, text?, to?, topic?, reply? }`.

## Barks

When two people meet and at least one of them is near (has a body), Cityspeak plays a short exchange between them: a line from one on topic `'chat'`, the other's reply, and so on, up to `barkLength` (3) lines, `barkGap` (2.2) seconds apart.

```js
world.on('bark', ({ a, b, lines }) => {
  for (const line of lines) setTimeout(() => showBubble(line.who, line.text ?? strings[line.key]), line.after * 1000);
});
```

Barks never change the world: they're chosen with a stream that changes nothing, and their cooldowns (each line's `cooldown`, or 60 minutes) are kept outside the state, so they aren't saved or rewound. A watched day hashes the same as an unwatched one, as long as no line's conditions use `chance:` (see [Conditions](../conditions.md#rewind-safety)). `world.cityspeak.barkGap` and `barkLength` can be changed.

## Practices and the room

A practice is a situation with roles, like dinner at a cafe or last orders at a bar. While it's going on, the people who fill a role find the role's actions more appealing.

```js
world.cityspeak.practice({
  id: 'dinner', at: 'cafe', hours: [17, 21], tone: 0.05,
  roles: { cook: { job: 'baker', actions: ['bake'] }, diner: { actions: ['eat_cafe', 'chat'] } },
});
world.cityspeak.practice({ id: 'last_orders', at: 'tag:drink', hours: [0, 1], roles: { drinker: { actions: ['drink'] } }, boost: 1.3 });
```

`PracticeDef`:

| Field | Default | Meaning |
|---|---|---|
| `id` | required | The practice's id |
| `at` | required | A place id (and anywhere inside it) or `'tag:<tag>'` |
| `hours` | always | When it's going on |
| `roles` | required | By role name: `{ who?, job?, actions }`: who can fill it (conditions on the person, at their place; a job) and the actions it makes more appealing |
| `tone` | 0 | Shifts the mood of the room, -1..1 |
| `boost` | 1.5 | How much more appealing role actions are |

An option's weight is multiplied by `boost` when the action is one of a role's actions, the practice is going on at the option's place, and the person fills the role (the part is shown as `dinner: diner`).

**The room** is the mood of a place: the mean mood of everyone in the outermost place (0.5 when it's empty, or without Reverie), plus the tone of practices going on. Lines can read it with the `room` term.

## Social acts

A social act is something aimed at someone that they can accept or refuse: a chat, an invitation, a request.

```js
world.cityspeak.act({
  id: 'chat',
  accept: [{ name: 'regard', input: 'regard', range: [-1, 1], out: [0.2, 1] }],
  feelings: { refused: 'lonely' },
  regard: [0.03, -0.02],
});
world.action({ id: 'chat', target: 'person', at: 'here', minutes: 20, relieves: { company: 0.4 }, tags: ['social'], social: 'chat' });
```

`SocialActDef`:

| Field | Meaning |
|---|---|
| `id` | The act's id, named by an action's `social` |
| `accept` | Considerations multiplied into a score, read from the target's side: `person` is the target, `target` is the asker |
| `acceptIf` | Plain conditions on the target, the same way; if any fails, the score is 0 |
| `threshold` | Accepted when the score reaches this. Without it, accepted with probability equal to the score |
| `onAccept`, `onRefuse` | Effects, with the asker as `person` and the target as `target` |
| `feelings` | `{ accepted?, refused?, target? }`: feelings for the asker on yes or no, and for the target either way |
| `regard` | `[onYes, onNo]`: change in the target's regard for the asker |

The act is resolved when an action with `social` and a target ends, if it wasn't interrupted and at least half was done. The outcome is logged as `social` and emitted.

`resolve(act, from, to)` resolves one directly and returns whether it was accepted. It changes state and isn't an input: call it from inside the simulation, or wrap it in a custom input.

## ink

`bindInk(story)` binds Tyrell to an [ink](https://github.com/inkle/ink) story (inkjs), so the story can ask about the world:

| Function | Returns |
|---|---|
| `tyrell_fact(key)` | The fact, or null |
| `tyrell_thinks(who, key)` | What someone takes to be true (Reverie), else the fact |
| `tyrell_regard(a, b)` | a's regard for b (0 without Fellowship) |
| `tyrell_mood(who)` | Their mood (0.5 without Reverie) |
| `tyrell_test(who, condition)` | A condition, for that person |
| `tyrell_did(actor, verb, target)` | Reports a deed (`world.did(actor, verb, { for: target })`); returns true |

The first five are bound as lookahead-safe; `tyrell_did` isn't. In ink, declare them with `EXTERNAL tyrell_fact(key)` and so on.

## State

In `world.s.mod.cityspeak`:

| Key | Holds |
|---|---|
| `said` | By speaker, by line index: when they last said it |
| `acts` | The last 100 social acts: `{ t, act, from, to, ok }` |

Lines, practices and acts are definitions. Barks' cooldowns live outside the state.

## API

`world.cityspeak`:

| Method | Returns | |
|---|---|---|
| `line(def)` | this | Declares a line |
| `addLines(defs)` | this | Declares several |
| `practice(def)` | this | Declares a practice |
| `act(def)` | this | Declares a social act |
| `choose(who, { to?, topic?, skip? })` | Said or null | What they'd say; changes nothing (`skip(line, index)` can rule lines out) |
| `say(who, { to?, topic? })` | Said or null | **Input.** Says it |
| `answer(said, by)` | Said or null | The reply to a line |
| `converse(a, b, topic = 'chat')` | array | A bark exchange now: `Said & { after }`. Updates bark cooldowns, which aren't state |
| `activeAt(place)` | PracticeDef[] | Practices going on at a place now |
| `roleOf(person, role)` | boolean | Does a person (a PersonState) fill the role where they are? |
| `room(place)` | number | The mood of the room |
| `resolve(act, from, to)` | boolean | **Engine.** Resolves a social act |
| `bindInk(story)` | void | Binds an ink story |
| `lines`, `practices`, `acts`, `barkGap`, `barkLength` | | The declared definitions and bark settings |

## Terms

`room`, `said:<index>`, `practice:<id>`, `role:<name>`. `said` is keyed by the line's index (the order lines were declared, from 0), not its key. See [Conditions](../conditions.md#cityspeak).

## Events

| Event | Payload |
|---|---|
| `say` | Said: `{ who, key, text?, to?, topic?, reply? }` |
| `bark` | `{ a, b, lines }`: `lines` is `Array<Said & { after }>`, `after` in seconds |
| `social` | `{ act, from, to, ok }` |

Log entries: `said`, `social`. Cityspeak has no config through `moduleConfig`; set `barkGap` and `barkLength` on the module.

## With other modules

- **Reverie**: lines read mood, emotion, beliefs (`knows:did:sam:theft`) and files; social acts give feelings; the room is the mean mood.
- **Fellowship**: social acts change regard; `regard` is the natural input for `accept`.
- **Joi** uses the line Cityspeak would choose as the fallback and as a hint in its prompt.

## Example

```js
const cs = world.cityspeak;
cs.addLines([
  { key: 'chat_weather', topic: 'chat', text: 'Looks like rain.', reply: 'topic:chat_reply' },
  { key: 'chat_theft', topic: 'chat', when: ['knows:did:sam:theft'], text: 'Did you hear about Sam at the market?', reply: 'topic:gossip_reply', weight: 3 },
  { key: 'reply_ok', topic: 'chat_reply', text: ['Mm.', 'Too right.'] },
  { key: 'reply_gossip', topic: 'gossip_reply', text: 'No! Really?' },
]);

const opener = cs.choose('kofi', { topic: 'chat', to: 'ruth' });
const reply = opener && cs.answer(opener, 'ruth');
console.log(opener?.text, '/', reply?.text);
```
