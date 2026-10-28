import type { Lang } from '../core/conds';
import type { Cond, Ctx } from '../core/types';
/** Rules added up when their conditions hold (ctx: the one who hears it as the person, the speaker as the target), or a function. */
export type LandRules = Array<{
    if?: Cond[];
    by: number;
}> | ((ctx: Ctx) => number);
/** How it lands: base plus the rules that hold (or the function's answer), rounded to four places. */
export declare function landing(lang: Lang, base: number, lands: LandRules | undefined, ctx: Ctx): number;
