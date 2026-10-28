// How something said lands with whoever hears it: a base, plus every rule
// whose conditions hold (or a function's answer), rounded. Above 0 it lands
// well, below badly. Voice's approaches land this way with the one the player
// talks to, and Bree's kinds, manners and topics with the one spoken to, so a
// game's approaches (warm, a joke, a haggle...) can serve both.
import type { Lang } from '../core/conds';
import type { Cond, Ctx } from '../core/types';
import { round } from '../core/util';

/** Rules added up when their conditions hold (ctx: the one who hears it as the person, the speaker as the target), or a function. */
export type LandRules = Array<{ if?: Cond[]; by: number }> | ((ctx: Ctx) => number);

/** How it lands: base plus the rules that hold (or the function's answer), rounded to four places. */
export function landing(lang: Lang, base: number, lands: LandRules | undefined, ctx: Ctx): number {
  let d = base;
  if (typeof lands === 'function') d += Number(lands(ctx)) || 0;
  else for (const r of lands || []) if (!r.if || lang.all(r.if, ctx)) d += r.by;
  return round(d, 4);
}
