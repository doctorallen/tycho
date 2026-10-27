# Joi

An optional language-model voice. Joi turns a person's state (temperament, what they're doing, their needs, mood, feelings and memories, what they think of the listener, the line Cityspeak would have picked) into a prompt, asks the game's provider for a line, and hands back text. Named for Blade Runner 2049's companion, who is all voice.

Joi never changes the world. If the provider is slow, missing or fails, the written line comes back instead. A provider may suggest flags from a list the game allows; Joi returns them for the game to act on and doesn't apply them. Because nothing changes, time walk is never affected.

- [Setting it up](#setting-it-up)
- [Speaking](#speaking)
- [The prompt](#the-prompt)
- [Flags](#flags)
- [API](#api)
- [With other modules](#with-other-modules)
- [Example](#example)

## Setting it up

Joi does nothing until the game gives it a provider: an async function that takes a request and returns a reply. Keep API keys off the client: point the provider at your own server, which calls the model.

```js
world.joi.voice = 'A rainy harbor town. People are wry, warm and a little nosy. One or two short sentences.';
world.joi.allow(['offers_job', 'refuses_service']);
world.joi.setProvider(async (req) => {
  const res = await fetch('/api/voice', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ system: req.system, prompt: req.prompt }),
  });
  if (!res.ok) throw new Error('voice failed');
  return res.json();   // { text, flags? } or a plain string
});
```

`JoiRequest`:

| Field | Meaning |
|---|---|
| `prompt` | The full prompt Joi built |
| `system` | `joi.voice`: a short line for the game's voice |
| `who` | The speaker |
| `to` | The listener, if any |
| `line` | The `Said` Cityspeak would choose (the fallback), or `null` |

A `JoiReply` is a string, or `{ text, flags? }`.

## Speaking

```js
const spoken = await world.joi.speak('ruth', { topic: 'greet', to: 'player', timeoutMs: 2000 });
showBubble('ruth', spoken.text || strings[spoken.key]);
```

`speak(who, { to?, topic?, timeoutMs? })` returns a promise of a `Spoken`:

| Field | Meaning |
|---|---|
| `text` | The words: the model's, or the written line's text (`''` if the line has none) |
| `key` | The key of the line Cityspeak chose, or `null` |
| `flags` | Allowed flags the model suggested |
| `fromModel` | Whether the text came from the model |

It falls back to the written line when there's no provider, when the provider takes longer than `timeoutMs` (2500 by default), when it throws, or when it returns empty text.

Because the reply comes back later, a game shouldn't wait on it in the frame loop. Show the written line at once if the conversation can't wait, or show a "..." until the promise settles. Speaking with Joi doesn't say the line in Cityspeak's sense: if the line's `once`, `cooldown` or `then` should count, call `cityspeak.say` too.

## The prompt

`joi.prompt(who, { to?, topic? })` returns the prompt without sending it, which is useful for tuning. It's built from:

- the name, and the temperament (traits, 0 to 1);
- what they're doing right now (the action's `label`, or walking somewhere);
- needs above 0.6 ("You badly want: hunger");
- with Reverie: mood and emotion, the feelings on their mind, and their three strongest memories (`text`, or the kind);
- the listener, with Fellowship's regard and Reverie's file on them (the tally of their deeds);
- the topic;
- the line they'd usually say;
- "Reply with only the words you say."

Give actions `label`s, memories `text`, and feelings `label`s so the prompt reads well.

## Flags

A provider can suggest that something should happen: the speaker offers a job, refuses to serve the player. Only flags passed to `joi.allow` come back; the rest are dropped. Joi doesn't act on them. The game decides what a flag means, and makes the change through the API, like any other input:

```js
const spoken = await world.joi.speak('mara', { topic: 'work', to: 'player' });
if (spoken.flags.includes('offers_job')) world.fact('job_offer:mara', true);
```

## API

`world.joi`:

| Member | | |
|---|---|---|
| `voice` | string | The system line sent with every request |
| `setProvider(fn)` | this | Sets the provider (`null` removes it) |
| `allow(flags)` | this | Flags a reply may suggest |
| `prompt(who, { to?, topic? })` | string | The prompt for a person speaking |
| `speak(who, { to?, topic?, timeoutMs? })` | Promise of Spoken | Asks the provider, or falls back |

Joi has no state, terms, effects, events or config.

## With other modules

- **Cityspeak** supplies the fallback line and the "what you'd usually say" hint; without it, there's no fallback text.
- **Reverie** supplies mood, emotion, feelings, memories and the file on the listener.
- **Fellowship** supplies the speaker's regard for the listener.

Joi reads the world through Cityspeak's `choose`, so a line whose conditions use `chance:` would advance the speaker's stream: keep `chance:` out of lines (see [Conditions](../conditions.md#rewind-safety)).

## Example

```js
world.joi.voice = 'A small seaside town. Warm, a little nosy.';
world.joi.allow(['offers_tea']);
world.joi.setProvider(async (req) => ({ text: 'Morning! Kettle is on.', flags: ['offers_tea', 'burns_house'] }));

world.joi.speak('ruth', { topic: 'greet', to: 'player' }).then((s) => {
  console.log(s.text, s.flags, s.fromModel);   // 'Morning! Kettle is on.' ['offers_tea'] true
});
```
