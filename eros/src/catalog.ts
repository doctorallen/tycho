// The catalog at run time: the living documentation the build generated
// (out/catalog.json: every kind, field, module, method and setting, from
// Tyrell's own source and docs), with an example of every kind, taken from
// Rocinante where it uses it and written here where it doesn't, and the
// setup's own inputs (a partner, a purse) described from the API.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { argsCode } from './code';
import { callName, type Model } from './recorder';
import type { TyrellLib } from './tyrell';

export interface Field { name: string; type: string; optional: boolean; doc: string; default: string; meaning: string }
export interface Param { name: string; type: string; optional: boolean }
export interface Kind {
  /** 'world.action', 'reverie.feeling'. */
  key: string;
  target: string;
  method: string;
  /** 'Action', 'Feeling', 'Condition term'. */
  name: string;
  /** Its definition's type ('ActionDef'), if it takes one. */
  def: string | null;
  params: Param[];
  doc: string;
  /** The part it belongs to ('Core', 'Reverie'). */
  module: string;
  /** Its docs page, and the table its fields' defaults and meanings come from. */
  page: string;
  table: string | null;
  fields: Field[];
  /** A setup's input (a partner set, money paid) rather than a declaration. */
  input?: boolean;
}
export interface Module { name: string; title: string; kind: string; origin: string; about: string; page: string; className: string | null; config: string | null }
export interface Method { method: string; doc: string; params: Param[]; returns: string }
export interface Api { target: string; className: string; file: string; doc: string; methods: Method[] }
export interface TypeInfo { name: string; file: string; doc: string; alias?: string; fields: Array<Omit<Field, 'default' | 'meaning'>> }
export interface Catalog {
  modules: Module[];
  kinds: Kind[];
  types: Record<string, TypeInfo>;
  api: Api[];
  config: Array<{ type: string; module: string; table: string | null; fields: Field[] }>;
}

/** The catalog the build wrote beside the app. */
export function loadCatalog(): Catalog {
  return JSON.parse(readFileSync(fileURLToPath(new URL('./catalog.json', import.meta.url)), 'utf8')) as Catalog;
}

/** A recorded call's kind: a declaration from the catalog, or an input described from the API (or, failing that, by name). */
export function kindOf(cat: Catalog, target: string, method: string): Kind {
  const k = cat.kinds.find((x) => x.target === target && x.method === method);
  if (k) return k;
  const m = cat.api.find((a) => a.target === target)?.methods.find((x) => x.method === method);
  const words = method.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return {
    key: `${target}.${method}`, target, method, name: words.charAt(0).toUpperCase() + words.slice(1), def: null, params: m?.params ?? [],
    doc: m?.doc ?? '', module: cat.modules.find((x) => x.name === target)?.title ?? (target === 'world' ? 'Core' : target),
    page: target === 'world' ? 'tyrell/docs/api.md' : `tyrell/docs/modules/${target}.md`, table: null, fields: [], input: true,
  };
}

/** Examples written for the kinds Rocinante doesn't use, in a town's own terms (the world is `w`). */
const WRITTEN: Record<string, string> = {
  'world.term': "'weekend', (ctx) => ctx.world.weekday >= 5",
  'world.effect': "'stress', (ctx, _arg, op, value) => {\n  if (ctx.person && ctx.world.reverie) ctx.world.reverie.addStress(ctx.person.id, Number(value));\n}",
  'cityspeak.line': "{ key: 'usual', topic: 'greet', who: 'job:bartender', to: ['target.member:regulars'], text: 'The usual?' }",
  'delos.look': "{ id: 'skin', founders: [0, 5], bounds: [0, 5], cross: 0, noise: 0.7, round: true }",
};

/** An example of every kind (and every input a town uses), as a call's code: Rocinante's own, Bree's starter set's, or written here. */
export function examples(cat: Catalog, Tyrell: TyrellLib, rocinante: Model): Map<string, { code: string; from: string }> {
  const out = new Map<string, { code: string; from: string }>();
  for (const c of rocinante.calls) {
    const key = `${c.target}.${c.method}`;
    if (!out.has(key)) out.set(key, { code: c.code, from: `Rocinante, ${callName(c)} #${c.id}` });
  }
  const starter = Tyrell.breeStarter?.();
  if (starter) {
    for (const [method, list] of [['kind', starter.kinds], ['topic', starter.topics], ['manner', starter.manners]] as const) {
      if (list?.length && !out.has(`bree.${method}`)) out.set(`bree.${method}`, { code: argsCode([list[0]]), from: "Bree's starter set (Tyrell.breeStarter())" });
    }
  }
  for (const [key, code] of Object.entries(WRITTEN)) if (!out.has(key)) out.set(key, { code, from: 'written for Eros, after the docs' });
  void cat;
  return out;
}
