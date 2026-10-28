// The condition and effect language. Conditions and effects are short strings
// so they can live in plain JSON (person definitions, saved directives) and
// survive a rewind; functions are allowed wherever a definition is code.
//
//   'money>=6'            a comparison on a term
//   'has:radio'           a term on its own is true when it's truthy
//   '!open:noodles'       '!' negates
//   'fact:raining'        a world fact
//   'thinks:open:coil'    the person's belief, or the fact if they have none
//
// Effects:
//   'money-=6'  'var.tips+=1'  'give:radio'  'take:radio*2'
//   'fact:open:noodles=false'  'feel:tired'  'believe:fixed:radio=true'
//
// Terms are looked up in a registry, so modules add their own (Reverie adds
// 'mood', Fellowship adds 'regard', and so on). See docs/conditions.md.
import type { Cond, Ctx, Effect, Value } from './types';

/** Resolves a term to a value: name is the part before ':' or '.', arg the rest. */
export type TermFn = (ctx: Ctx, arg: string) => Value | undefined;
/** Applies an effect: op is '=', '+=', '-=' or '' (a bare effect like 'give:radio'). */
export type EffectFn = (ctx: Ctx, arg: string, op: string, value: Value) => void;

const OPS = ['>=', '<=', '!=', '==', '+=', '-=', '*=', '>', '<', '='] as const;

/** Parses a literal: a number, true, false, null, or a string (quotes optional). */
export function literal(raw: string): Value {
  const s = raw.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  if (s !== '' && !isNaN(Number(s))) return Number(s);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}

/** Splits 'lhs>=rhs' at its first operator. */
function splitOp(s: string): [string, string, string] {
  let best = -1, op = '';
  for (const o of OPS) {
    const i = s.indexOf(o);
    if (i > 0 && (best < 0 || i < best || (i === best && o.length > op.length))) { best = i; op = o; }
  }
  if (best < 0) return [s.trim(), '', ''];
  return [s.slice(0, best).trim(), op, s.slice(best + op.length).trim()];
}

/** Splits a term into its name and argument: 'need.hunger' -> ['need', 'hunger']. */
function splitTerm(term: string): [string, string] {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)[.:](.*)$/.exec(term);
  return m ? [m[1], m[2]] : [term, ''];
}

const truthy = (v: Value | undefined): boolean => !(v === undefined || v === null || v === false || v === 0 || v === '');

function compare(a: Value | undefined, op: string, b: Value): boolean {
  switch (op) {
    case '>=': return Number(a ?? 0) >= Number(b);
    case '<=': return Number(a ?? 0) <= Number(b);
    case '>': return Number(a ?? 0) > Number(b);
    case '<': return Number(a ?? 0) < Number(b);
    case '!=': return (a ?? null) !== b;
    case '==': case '=': return (a ?? null) === b || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9);
    default: return truthy(a);
  }
}

export class Lang {
  private terms = new Map<string, TermFn>();
  private effects = new Map<string, EffectFn>();
  private condCache = new Map<string, (ctx: Ctx) => boolean>();
  private effCache = new Map<string, (ctx: Ctx) => void>();

  /** Registers a term: `name` matches 'name.arg', 'name:arg' or bare 'name'. */
  term(name: string, fn: TermFn): void { this.terms.set(name, fn); this.condCache.clear(); }
  /** Registers an effect. */
  effect(name: string, fn: EffectFn): void { this.effects.set(name, fn); this.effCache.clear(); }
  hasTerm(name: string): boolean { return this.terms.has(name); }

  /** The value of a term in a context ('need.hunger', 'target.trait.honesty'). */
  value(term: string, ctx: Ctx): Value | undefined {
    const [name, arg] = splitTerm(term);
    const fn = this.terms.get(name);
    if (fn) return fn(ctx, arg);
    // an unknown bare word: a fact of that name
    return ctx.world.s.facts[term];
  }

  /** Compiles a condition string. */
  compile(cond: string): (ctx: Ctx) => boolean {
    let fn = this.condCache.get(cond);
    if (fn) return fn;
    let s = cond.trim(), neg = false;
    if (s.startsWith('!')) { neg = true; s = s.slice(1).trim(); } else if (s.startsWith('not ')) { neg = true; s = s.slice(4).trim(); }
    const [lhs, op, rhs] = splitOp(s);
    const rv = op ? literal(rhs) : null;
    fn = (ctx: Ctx) => {
      const r = compare(this.value(lhs, ctx), op, rv);
      return neg ? !r : r;
    };
    this.condCache.set(cond, fn);
    return fn;
  }

  /** Tests one condition. */
  test(cond: Cond, ctx: Ctx): boolean {
    return typeof cond === 'function' ? !!cond(ctx) : this.compile(cond)(ctx);
  }

  /** Tests all conditions; returns the first that failed, or null. */
  failing(conds: readonly Cond[] | undefined, ctx: Ctx): Cond | null {
    if (!conds) return null;
    for (const c of conds) if (!this.test(c, ctx)) return c;
    return null;
  }

  /** True when every condition holds. */
  all(conds: readonly Cond[] | undefined, ctx: Ctx): boolean { return this.failing(conds, ctx) === null; }

  /** Applies one effect. */
  apply(effect: Effect, ctx: Ctx): void {
    if (typeof effect === 'function') { effect(ctx); return; }
    let fn = this.effCache.get(effect);
    if (!fn) {
      const [lhs, op, rhs] = splitOp(effect.trim());
      const [name, arg] = splitTerm(lhs);
      const value = op ? literal(rhs) : null;
      const handler = this.effects.get(name);
      if (!handler) {
        // 'money+=5' style shorthand for a variable
        const v = this.effects.get('var');
        if (!v) throw new Error(`Tyrell: unknown effect '${effect}'`);
        fn = (ctx: Ctx) => v(ctx, lhs, op, value);
      } else fn = (ctx: Ctx) => handler(ctx, arg, op, value);
      this.effCache.set(effect, fn);
    }
    fn(ctx);
  }

  applyAll(effects: readonly Effect[] | undefined, ctx: Ctx): void {
    if (effects) for (const e of effects) this.apply(e, ctx);
  }
}

/** Applies op to a current numeric or plain value. */
export function combine(cur: Value | undefined, op: string, value: Value): Value {
  switch (op) {
    case '+=': return Number(cur ?? 0) + Number(value);
    case '-=': return Number(cur ?? 0) - Number(value);
    case '*=': return Number(cur ?? 0) * Number(value);
    case '=': case '==': return value;
    default: return value ?? true;
  }
}

/** Parses 'radio*2' into ['radio', 2]. */
export function itemCount(arg: string): [string, number] {
  const m = /^(.*?)\*(\d+(?:\.\d+)?)$/.exec(arg);
  return m ? [m[1], Number(m[2])] : [arg, 1];
}
