// Joi: an optional language-model voice. Named for Blade Runner 2049's
// companion, who is all voice.
//
// Joi never changes the world. It turns a person's state (needs, mood, what
// they believe about the listener, their file on the player, the line
// Cityspeak would have picked) into a prompt, asks the game's provider for a
// line, and hands back text. If the provider is slow, missing or fails, the
// written line comes back instead. A provider may also suggest flags (from a
// list the game allows); Joi returns them for the game to act on, it doesn't
// apply them. Because nothing changes, time walk is never affected.
import type { Module } from '../core/module';
import type { Id } from '../core/types';
import type { World } from '../core/world';
import type { Said } from './cityspeak';
import { round } from '../core/util';

export interface JoiRequest {
  /** The full prompt Joi built. */
  prompt: string;
  /** A short system line: the game's voice. */
  system: string;
  who: Id;
  to?: Id;
  /** The line the written rules would say (the fallback). */
  line: Said | null;
}

export type JoiReply = string | { text: string; flags?: string[] };
export type JoiProvider = (req: JoiRequest) => Promise<JoiReply>;

export interface Spoken { text: string; key: string | null; flags: string[]; fromModel: boolean }

export class Joi implements Module {
  readonly name = 'joi';
  /** The game's voice, in a sentence: 'neon noir, clipped' or 'cozy, folksy'. */
  voice = 'Speak as this person would, in one or two short sentences.';
  private provider: JoiProvider | null = null;
  private allowed = new Set<string>();
  private w!: World;

  attach(w: World): void { this.w = w; }

  /** Sets the function that calls a model (async). */
  setProvider(fn: JoiProvider | null): this { this.provider = fn; return this; }
  /** Flags a reply may suggest (anything else is dropped). */
  allow(flags: string[]): this { for (const f of flags) this.allowed.add(f); return this; }

  /** The prompt for a person speaking (useful to look at, or to send yourself). */
  prompt(who: Id, opts: { to?: Id; topic?: string } = {}): string {
    const w = this.w;
    const p = w.s.people[who];
    if (!p) return '';
    const lines: string[] = [];
    lines.push(`You are ${p.name}.`);
    const traits = Object.entries(p.def.traits || {}).map(([k, v]) => `${k} ${round(v, 2)}`).join(', ');
    if (traits) lines.push(`Temperament (0 to 1): ${traits}.`);
    const d = p.doing;
    if (d) lines.push(`Right now: ${d.kind === 'travel' ? `walking to ${d.to}` : `${w.actions.get(d.action)?.label ?? d.action} at ${d.place}`}.`);
    const needs = [...w.needs.keys()].map((n) => [n, w.mind.level(p, n)] as const).filter(([, v]) => v > 0.6).map(([n]) => n);
    if (needs.length) lines.push(`You badly want: ${needs.join(', ')}.`);
    if (w.reverie) {
      lines.push(`Mood: ${round(w.reverie.mood(who), 2)} (${w.reverie.emotion(who)}).`);
      const feelings = w.reverie.feelings(who).map((f) => f.label);
      if (feelings.length) lines.push(`On your mind: ${feelings.join('; ')}.`);
      const mem = w.reverie.memories(who).slice(0, 3).map((m) => m.text ?? m.k);
      if (mem.length) lines.push(`You remember: ${mem.join('; ')}.`);
    }
    if (opts.to) {
      const t = w.s.people[opts.to];
      const name = t?.name ?? opts.to;
      const parts: string[] = [];
      if (w.fellowship) parts.push(`your regard for them is ${round(w.fellowship.regard(who, opts.to), 2)} (-1 to 1)`);
      const file = w.reverie?.file(who, opts.to);
      if (file) parts.push(`what they've done: ${Object.entries(file.tally).map(([k, v]) => `${k} x${v}`).join(', ')}`);
      lines.push(`You're talking to ${name}${parts.length ? ': ' + parts.join('; ') : ''}.`);
    }
    if (opts.topic) lines.push(`The subject: ${opts.topic}.`);
    const fallback = w.cityspeak?.choose(who, opts);
    if (fallback?.text) lines.push(`What you'd usually say: "${fallback.text}"`);
    lines.push('Reply with only the words you say.');
    return lines.join('\n');
  }

  /**
   * Speaks: asks the provider, or falls back to the written line. Never
   * changes the world.
   */
  async speak(who: Id, opts: { to?: Id; topic?: string; timeoutMs?: number } = {}): Promise<Spoken> {
    const w = this.w;
    const line = w.cityspeak?.choose(who, opts) ?? null;
    if (line) delete (line as any)._i;
    const fallback: Spoken = { text: line?.text ?? '', key: line?.key ?? null, flags: [], fromModel: false };
    if (!this.provider) return fallback;
    const req: JoiRequest = { prompt: this.prompt(who, opts), system: this.voice, who, line, ...(opts.to ? { to: opts.to } : {}) };
    const timeout = opts.timeoutMs ?? 2500;
    try {
      const reply = await Promise.race([
        this.provider(req),
        new Promise<null>((res) => setTimeout(() => res(null), timeout)),
      ]);
      if (reply === null) return fallback;
      const text = typeof reply === 'string' ? reply : reply.text;
      const flags = typeof reply === 'string' ? [] : (reply.flags || []).filter((f) => this.allowed.has(f));
      if (!text || !text.trim()) return fallback;
      return { text: text.trim(), key: line?.key ?? null, flags, fromModel: true };
    } catch {
      return fallback;
    }
  }
}
