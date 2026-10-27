// Palantír: the inspector. Named for the seeing-stones of The Lord of the
// Rings. Every decision is kept (the last few per person) with every option,
// its rank, its weight and what the weight was made of, so "why did she go to
// the bar?" and "why didn't she?" both have answers.
//
// Decisions aren't part of the world's state: they're for looking, so they
// don't save and a rewind clears them.
import type { Candidate, Decision, Id } from '../core/types';
import type { World } from '../core/world';
import { hourOf, round } from '../core/util';

const clock = (t: number): string => {
  const h = hourOf(t);
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `day ${Math.floor(t / 1440)} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export class Palantir {
  private decisions = new Map<Id, Decision[]>();
  /** Turn off to save a little time in big headless runs. */
  enabled = true;

  constructor(private w: World) {}

  record(d: Decision): void {
    if (!this.enabled || this.w.replaying) return;
    const list = this.decisions.get(d.who) || [];
    // keep the options that matter: the top of each rank, and anything required
    const cands = d.candidates.slice().sort((a, b) => b.rank - a.rank || b.weight - a.weight);
    d.candidates = cands.filter((c, i) => i < 16 || c.layer !== 'need');
    list.push(d);
    if (list.length > this.w.config.decisions) list.shift();
    this.decisions.set(d.who, list);
    this.w.emit('decided', { who: d.who, picked: d.picked?.id ?? null, place: d.picked?.place ?? null });
  }

  clear(): void { this.decisions.clear(); }

  /** The latest decision for a person. */
  why(id: Id): Decision | null {
    const list = this.decisions.get(id);
    return list && list.length ? list[list.length - 1] : null;
  }

  /** A person's recent decisions, oldest first. */
  history(id: Id): Decision[] { return this.decisions.get(id)?.slice() ?? []; }

  /** Why someone isn't doing something: weighs it now and says what stops it or what beat it. */
  whyNot(id: Id, action: Id): string {
    const w = this.w;
    const p = w.s.people[id];
    if (!p) return `${id} isn't in the world`;
    if (p.status !== 'active') return `${p.name} is ${p.status}`;
    if (!w.actions.has(action) && !w.tasks.has(action)) return `${action} isn't declared`;
    if (p.doing?.action === action) return `${p.name} is doing it now`;
    const options = w.mind.explain(p, action);
    if (!options.length) return `nowhere offers ${action} to ${p.name}`;
    const open = options.filter((c) => !c.blocked);
    if (!open.length) return options.map((c) => `${c.place ?? 'here'}: ${c.blocked}`).join('; ');
    const best = open.sort((a, b) => b.rank - a.rank || b.weight - a.weight)[0];
    const last = this.why(id);
    const picked = last?.picked;
    if (!picked) return `${action} at ${best.place ?? 'here'} weighs ${round(best.weight, 3)} (${this.parts(best)}), but they haven't decided anything yet`;
    if (picked.rank > best.rank) return `${picked.id} outranks it (${picked.layer}, rank ${picked.rank} against ${best.rank})`;
    return `${action} at ${best.place ?? 'here'} weighs ${round(best.weight, 3)} (${this.parts(best)}); ${picked.id} weighed ${round(picked.weight, 3)} (${this.parts(picked)})`;
  }

  /** "base 0.4 x habit 1.2 x travel 0.6" */
  parts(c: Candidate): string { return c.parts.map(([n, v]) => `${n} ${round(v, 3)}`).join(' x '); }

  /** A readable account of a person: what they're doing and why, needs, mood, plan, beliefs. */
  describe(id: Id): string {
    const w = this.w;
    const p = w.s.people[id];
    if (!p) return `${id}: not in the world`;
    const lines: string[] = [];
    lines.push(`${p.name} (${p.id}), ${p.status}, ${clock(w.s.now)}`);
    const d = p.doing;
    if (d) {
      const what = d.kind === 'travel' ? `walking from ${d.from} to ${d.to} to ${d.action}` : d.kind === 'wait' ? `waiting at ${d.place}` : `${d.action} at ${d.place}`;
      lines.push(`doing: ${what}, until ${clock(d.end)} (${d.layer}, rank ${d.rank})`);
    } else lines.push('doing: nothing');
    const needs = [...w.needs.keys()].map((n) => `${n} ${round(w.mind.level(p, n), 2)}`).join(', ');
    if (needs) lines.push(`needs: ${needs}`);
    const money = p.vars.money;
    if (money !== undefined) lines.push(`money: ${money}`);
    const inv = Object.entries(p.inv).map(([k, v]) => `${k} x${v}`).join(', ');
    if (inv) lines.push(`carrying: ${inv}`);
    const rv = w.reverie;
    if (rv) {
      lines.push(`mood: ${round(rv.mood(id), 2)} (${rv.emotion(id)}), stress ${round(rv.stress(id), 2)}`);
      const feelings = rv.feelings(id).map((f) => `${f.label} ${f.weight > 0 ? '+' : ''}${round(f.weight, 2)}`).join(', ');
      if (feelings) lines.push(`feelings: ${feelings}`);
      const beliefs = rv.beliefs(id).slice(0, 6).map((b) => `${b.key}=${String(b.v)} (${b.src}${b.from ? ' from ' + b.from : ''})`).join(', ');
      if (beliefs) lines.push(`believes: ${beliefs}`);
    }
    if (p.plan) {
      const top = p.plan.stack[p.plan.stack.length - 1];
      lines.push(`plan: ${p.plan.task}${top ? `, step ${top.i + 1} of ${top.steps.length} of ${top.task}` : ''}`);
    }
    if (p.directive) lines.push(`directed to: ${p.directive.do}${p.directive.done ? ' (done)' : ''}`);
    const req = w.mind.required(p).map((r) => `${r.layer}: ${r.do}${r.at ? ' at ' + r.at : ''}`).join('; ');
    if (req) lines.push(`expected: ${req}`);
    const last = this.why(id);
    if (last?.picked) {
      lines.push(`chose ${last.picked.id}${last.picked.place ? ' at ' + last.picked.place : ''}: ${last.reason}`);
      lines.push(`  ${this.parts(last.picked)}`);
    }
    return lines.join('\n');
  }

  /** The full state of a person as JSON-ready data. */
  inspect(id: Id): unknown {
    const w = this.w;
    const p = w.s.people[id];
    if (!p) return null;
    return {
      person: p,
      needs: Object.fromEntries([...w.needs.keys()].map((n) => [n, round(w.mind.level(p, n), 3)])),
      mood: w.reverie?.mood(id), emotion: w.reverie?.emotion(id),
      decision: this.why(id),
      body: w.body(id),
    };
  }
}
