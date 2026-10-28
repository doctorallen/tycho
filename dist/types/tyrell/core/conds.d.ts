import type { Cond, Ctx, Effect, Value } from './types';
/** Resolves a term to a value: name is the part before ':' or '.', arg the rest. */
export type TermFn = (ctx: Ctx, arg: string) => Value | undefined;
/** Applies an effect: op is '=', '+=', '-=' or '' (a bare effect like 'give:radio'). */
export type EffectFn = (ctx: Ctx, arg: string, op: string, value: Value) => void;
/** Parses a literal: a number, true, false, null, or a string (quotes optional). */
export declare function literal(raw: string): Value;
export declare class Lang {
    private terms;
    private effects;
    private condCache;
    private effCache;
    /** Registers a term: `name` matches 'name.arg', 'name:arg' or bare 'name'. */
    term(name: string, fn: TermFn): void;
    /** Registers an effect. */
    effect(name: string, fn: EffectFn): void;
    hasTerm(name: string): boolean;
    /** The value of a term in a context ('need.hunger', 'target.trait.honesty'). */
    value(term: string, ctx: Ctx): Value | undefined;
    /** Compiles a condition string. */
    compile(cond: string): (ctx: Ctx) => boolean;
    /** Tests one condition. */
    test(cond: Cond, ctx: Ctx): boolean;
    /** Tests all conditions; returns the first that failed, or null. */
    failing(conds: readonly Cond[] | undefined, ctx: Ctx): Cond | null;
    /** True when every condition holds. */
    all(conds: readonly Cond[] | undefined, ctx: Ctx): boolean;
    /** Applies one effect. */
    apply(effect: Effect, ctx: Ctx): void;
    applyAll(effects: readonly Effect[] | undefined, ctx: Ctx): void;
}
/** Applies op to a current numeric or plain value. */
export declare function combine(cur: Value | undefined, op: string, value: Value): Value;
/** Parses 'radio*2' into ['radio', 2]. */
export declare function itemCount(arg: string): [string, number];
