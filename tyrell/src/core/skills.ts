// Skills: what practice teaches. Part of the minds, beside Bicameral's
// habits: where a habit is how much someone likes doing a thing, a skill is
// how good they've got at it. Each person has a level per skill that rises
// with practice at their own pace (their talent, which Delos can inherit),
// harder the nearer the top, and slips back slowly when it's let go.
// Actions train skills (`trains`), and conditions and considerations read
// them (`skill.<id>`), so practice can open doors and weigh choices.
// Merryfolk's skills and schooling, generalized.
//
// Levels are kept as [level, when last practiced]; forgetting is worked out
// from that when the level is read, so nothing ticks for it.
import type { Id, PersonState, SkillDef } from './types';
import type { World } from './world';
import { DAY, HOUR, clamp, round } from './util';

export class Skills {
  readonly defs = new Map<Id, SkillDef>();

  constructor(private w: World) {}

  /** A skill's definition, or the defaults for one that was never declared. */
  def(id: Id): SkillDef { return this.defs.get(id) ?? { id }; }

  /** A person's level in a skill at time t (default now), forgetting included. */
  level(p: PersonState, id: Id, t = this.w.s.now): number {
    const rec = p.skills?.[id];
    const def = this.defs.get(id);
    if (!rec) return p.def.skills?.[id] ?? def?.start ?? 0;
    const [v, since] = rec;
    if (!def?.decay) return v;
    const idle = (t - since) / DAY - (def.grace ?? this.w.cfg.skillGrace);
    if (idle <= 0) return v;
    return round(Math.max(Math.min(v, def.floor ?? 0), v - def.decay * idle), 5);
  }

  /** How fast a person learns a skill: their talent for it (default 1). */
  talent(p: PersonState, id: Id): number { return p.def.talents?.[id] ?? 1; }

  /** Every skill a person has practiced or started with, and its level now. */
  of(p: PersonState): Record<Id, number> {
    const out: Record<Id, number> = {};
    const ids = new Set<Id>([...Object.keys(p.def.skills || {}), ...Object.keys(p.skills || {})]);
    for (const id of [...ids].sort()) out[id] = this.level(p, id);
    return out;
  }

  /** The name of the highest level reached (from the skill's `levels`), or null. */
  named(p: PersonState, id: Id): string | null {
    const v = this.level(p, id);
    let out: string | null = null;
    for (const [at, name] of this.def(id).levels || []) if (v >= at - 1e-9) out = name;
    return out;
  }

  /**
   * Practice, inside the simulation: `hours` of it at the person's pace,
   * times `mul`. The progress is worked out exactly over the hours (eight
   * hours at once is the same as eight one-hour goes). Returns the new level.
   */
  applyTrain(p: PersonState, id: Id, hours: number, mul = 1): number {
    const before = this.level(p, id);
    if (!(hours > 0) || !(mul > 0)) return before;
    const def = this.def(id);
    const max = def.max ?? 1;
    // the headline knob: how fast skills are learned, the world's times the person's own
    const pace = this.w.cfg.learning * this.w.own(p, 'core', 'learning');
    let rate = (def.rate ?? this.w.cfg.skillRate) * this.talent(p, id) * mul * pace;
    if (def.learn?.length) {
      const ctx = this.w.ctx(p);
      for (const k of def.learn) rate *= this.w.mind.consider(k, ctx);
    }
    // the room left to the top shrinks as it fills: du/dt = -(rate / max) u^d, u = 1 - level / max
    const d = def.diminish ?? 1;
    const u0 = clamp(1 - before / max);
    const k = (rate * hours) / max;
    let u: number;
    if (d === 1) u = u0 * Math.exp(-k);
    else {
      const b = Math.pow(u0, 1 - d) - (1 - d) * k;
      u = b <= 0 || !isFinite(b) ? 0 : Math.pow(b, 1 / (1 - d));
    }
    const after = round(Math.max(before, clamp(max * (1 - u), 0, max)), 5);
    this.store(p, id, after, before);
    return after;
  }

  /** Sets a level outright, inside the simulation. */
  applySet(p: PersonState, id: Id, level: number): void {
    const before = this.level(p, id);
    const max = this.def(id).max ?? 1;
    this.store(p, id, round(clamp(level, 0, max), 5), before);
  }

  /** Keeps a new level, and marks any named level reached on the way up. */
  private store(p: PersonState, id: Id, after: number, before: number): void {
    const w = this.w;
    (p.skills ||= {})[id] = [after, w.s.now];
    const def = this.def(id);
    for (const [at, name] of def.levels || []) {
      if (before < at - 1e-9 && after >= at - 1e-9) {
        w.log('skill', p.id, { skill: id, level: name });
        w.emit('skill', { id: p.id, skill: id, level: name, value: after });
        if (def.then) w.lang.applyAll(def.then, w.ctx(p, { data: { skill: id, level: name } }));
      }
    }
  }

  /** An action ended: the skills it trains get the time spent on it. */
  practiced(p: PersonState, trains: Record<Id, number>, start: number): void {
    const hours = Math.max(0, this.w.s.now - start) / HOUR;
    if (hours <= 0) return;
    for (const id of Object.keys(trains).sort()) this.applyTrain(p, id, hours, trains[id]);
  }

  /** The terms, effects and inputs (World calls this once). */
  register(): void {
    const w = this.w, L = w.lang;
    L.term('skill', (c, a) => (c.person ? this.level(c.person, a) : 0));
    L.term('talent', (c, a) => (c.person ? this.talent(c.person, a) : 1));
    L.term('instinct', (c, a) => c.person?.def.instincts?.[a || c.action || ''] ?? 1);
    L.effect('skill', (c, a, op, v) => {
      if (!c.person) return;
      const id = a.startsWith('skill.') ? a.slice(6) : a;
      const cur = this.level(c.person, id);
      const next = op === '+=' ? cur + Number(v) : op === '-=' ? cur - Number(v) : op === '*=' ? cur * Number(v) : Number(v);
      this.applySet(c.person, id, next);
    });
    L.effect('train', (c, a, _op, v) => { if (c.person) this.applyTrain(c.person, a, v === null || v === true ? 1 : Number(v)); });
    w.defineInput('train', (id: Id, skill: Id, hours: number) => {
      const p = w.s.people[id];
      return p ? this.applyTrain(p, skill, hours) : 0;
    });
    w.defineInput('skill', (id: Id, skill: Id, level: number) => {
      const p = w.s.people[id];
      if (p) this.applySet(p, skill, level);
    });
  }
}
