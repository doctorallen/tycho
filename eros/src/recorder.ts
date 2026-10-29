// The recorder: opens a setup file (a function of Tyrell and options that
// returns a world, as Rocinante is), and records every call it makes to
// declare its town, in order, as code: a need, a place, an action, a person,
// a feeling, a storylet, a listener, the setup's own inputs (a partner, a
// purse). From that record it builds worlds again, and writes the town out
// as a setup file of its own, in the same shape. Lookups the setup makes
// along the way (`w.kept`, a partner) aren't recorded; calls made by the
// town's own functions once it runs aren't either.
import { argsCode, freeNames, readArgs, toCode } from './code';
import type { Setup, TyrellLib } from './tyrell';

/** One recorded call: `w.<target>.<method>(<code>)`, or `w.<method>(<code>)` for the world itself. */
export interface Call {
  id: number;
  target: string;
  method: string;
  /** Its arguments, as JavaScript source. */
  code: string;
}

/** A town, as code. */
export interface Model {
  /** A short name for it ('rocinante'). */
  name: string;
  /** The file it was opened from, and the options it was opened with. */
  file?: string;
  options: Record<string, unknown>;
  /** Tyrell.create's options, as code. */
  create: string;
  calls: Call[];
  /** What didn't record cleanly: functions naming the file's own variables, a copy that differs from the file. */
  warnings: string[];
}

/** Lookups on the world and its modules: they change nothing, so they aren't part of a town. */
const READS = new Set([
  'get', 'kept', 'people', 'have', 'needOf', 'why', 'whyNot', 'describe', 'hash', 'save', 'stream', 'worldStream', 'worldStreamPeek', 'skillOf', 'wishesOf',
  'tuning', 'bodies', 'body', 'ctx', 'nextSeq', 'own', 'partner', 'friends', 'regard', 'attraction', 'mood', 'feelings', 'isDown', 'animosity', 'present',
  'eligible', 'storeOf', 'within', 'travel', 'capacity', 'free', 'holders', 'allowed', 'about', 'find', 'since', 'chronicle', 'beats', 'tell', 'day',
  'recap', 'threads', 'recount', 'when', 'ago', 'book', 'emit', 'off', 'knows', 'beliefs', 'memories', 'grudge', 'feud', 'current', 'view', 'choose',
]);
const isRead = (method: string) => READS.has(method) || /^(is|has|get|find|list|view|peek|count)[A-Z]/.test(method);

/** The world's parts a setup declares things on (its modules, strangers, Irulan). */
function parts(w: any): string[] {
  return [...(w.modules ? [...w.modules.keys()] : []), 'strangers', 'irulan', 'ring', 'skills'];
}

/** Runs a setup and records the town it declares. */
export function record(setup: Setup, Tyrell: TyrellLib, options: Record<string, unknown> = {}, name = 'town'): Model {
  const calls: Call[] = [];
  let createOpts: Record<string, unknown> = {};
  let recording = true;
  const proxies = new WeakMap<object, unknown>();
  const wrap = (obj: any, target: string, w: any): any => {
    if (proxies.has(obj)) return proxies.get(obj);
    const named = target === 'world' ? new Set(parts(obj)) : null;
    const proxy = new Proxy(obj, {
      get(o, prop) {
        const v = Reflect.get(o, prop, o);
        if (typeof prop !== 'string') return v;
        if (typeof v === 'function') {
          return (...args: unknown[]) => {
            if (recording && !isRead(prop)) calls.push({ id: calls.length + 1, target, method: prop, code: argsCode(args) });
            const r = v.apply(o, args);
            return r === o ? proxy : r;
          };
        }
        if (named && named.has(prop) && v && typeof v === 'object') return wrap(v, prop, w);
        return v;
      },
    });
    proxies.set(obj, proxy);
    return proxy;
  };
  const recordingTyrell = {
    ...Tyrell,
    create: (o: Record<string, unknown>) => {
      createOpts = o;
      const w = Tyrell.create(o);
      return wrap(w, 'world', w);
    },
  };
  setup(recordingTyrell, { ...options });
  recording = false;
  const model: Model = { name, options: { ...options }, create: toCode(createOpts, '  '), calls, warnings: [] };
  model.warnings.push(...lint(model));
  return model;
}

/** Functions that name variables the town won't have when it's built again. */
export function lint(model: Model): string[] {
  const out: string[] = [];
  for (const c of model.calls) {
    const names = freeNames(c.code);
    if (names.length) out.push(`${callName(c)} #${c.id} names ${names.join(', ')}, which only its file had: it will fail when it runs`);
  }
  return out;
}

/** How a call is written: w.reverie.feeling, w.action. */
export const callName = (c: Pick<Call, 'target' | 'method'>) => (c.target === 'world' ? `w.${c.method}` : `w.${c.target}.${c.method}`);

/** A call that failed when the town was built. */
export interface CallError { id: number; call: string; message: string }

/** Tyrell.create's options for a model, a seed and options of the moment over its own. */
export function createOptions(model: Model, Tyrell: TyrellLib, over: { seed?: string; config?: Record<string, unknown> } = {}): Record<string, unknown> {
  const base = readArgs(model.create, { w: undefined, Tyrell })[0] as Record<string, unknown>;
  return {
    ...base,
    ...(over.seed !== undefined ? { seed: over.seed } : {}),
    config: { ...((base.config as object) || {}), ...(over.config || {}) },
  };
}

/**
 * Builds a world from a town: Tyrell.create, then every call in order, each
 * read afresh in the new world's scope. A call that fails is skipped and
 * reported, the rest still made.
 */
export function replay(model: Model, Tyrell: TyrellLib, over: { seed?: string; config?: Record<string, unknown> } = {}): { world: any; errors: CallError[] } {
  const world = Tyrell.create(createOptions(model, Tyrell, over));
  const errors: CallError[] = [];
  for (const c of model.calls) {
    const on = c.target === 'world' ? world : world[c.target];
    if (!on || typeof on[c.method] !== 'function') {
      errors.push({ id: c.id, call: callName(c), message: on ? `there's no ${callName(c)}` : `the ${c.target} module isn't on` });
      continue;
    }
    try {
      on[c.method](...readArgs(c.code, { w: world, Tyrell, opts: model.options }));
    } catch (e: any) {
      errors.push({ id: c.id, call: callName(c), message: e?.message ?? String(e) });
    }
  }
  return { world, errors };
}

/**
 * A town as a setup file, in Rocinante's shape: a function of Tyrell and
 * options returning the world, that works as a script, with require and with
 * import. The options a runner passes (seed, start, modules, config, esper,
 * moduleConfig) still apply, over the town's own.
 */
export function exportCode(model: Model): string {
  const fnName = 'build' + (model.name.replace(/[^\w]+(\w)/g, (_, c) => c.toUpperCase()).replace(/^\w/, (c) => c.toUpperCase()) || 'Town');
  const opts = Object.keys(model.options).length ? ` (opened with ${Object.entries(model.options).map(([k, v]) => (v === true ? k : `${k}: ${JSON.stringify(v)}`)).join(', ')})` : '';
  const lines = [
    `// ${model.name}: a Tyrell town, exported by Eros${model.file ? ` from ${model.file.replace(/^.*[\\/]/, '')}${opts}` : ''}.`,
    '//',
    '// Plain JavaScript that works three ways: in a browser after dist/tyrell.js',
    `// (it defines ${fnName}), with require() in Node, and with import. Options:`,
    '// seed, start, modules, config, esper and moduleConfig, over the town\'s own.',
    '(function (root, factory) {',
    "  if (typeof module === 'object' && module.exports) module.exports = factory;",
    `  else root.${fnName} = factory;`,
    `})(typeof globalThis !== 'undefined' ? globalThis : this, function ${fnName}(Tyrell, opts) {`,
    '  opts = opts || {};',
    '  const HOUR = 60, DAY = 1440;',
    `  const base = ${model.create};`,
    '  const moduleConfig = Object.assign({}, base.moduleConfig);',
    '  for (const k of Object.keys(opts.moduleConfig || {})) moduleConfig[k] = Object.assign({}, moduleConfig[k], opts.moduleConfig[k]);',
    '  const w = Tyrell.create(Object.assign({}, base, {',
    '    seed: opts.seed || base.seed,',
    '    start: opts.start !== undefined ? opts.start : base.start,',
    '    modules: opts.modules || base.modules,',
    '    esper: opts.esper !== undefined ? opts.esper : base.esper,',
    '    config: Object.assign({}, base.config, opts.config || {}),',
    '    moduleConfig,',
    '  }));',
    '',
  ];
  let last = '';
  for (const c of model.calls) {
    if (c.target !== last && last) lines.push('');
    last = c.target;
    lines.push(`  ${callName(c)}(${c.code});`);
  }
  lines.push('', '  return w;', '});', '');
  return lines.join('\n');
}

/**
 * Whether a town as recorded builds the same world as its file: both built
 * with a seed and run for some days, then compared by hash. Returns null when
 * they match, or what differs.
 */
export function sameAsFile(model: Model, setup: Setup, Tyrell: TyrellLib, days = 1, seed = 'eros'): string | null {
  const a = setup(Tyrell, { ...model.options, seed });
  const { world: b, errors } = replay(model, Tyrell, { seed });
  if (errors.length) return `the recorded copy fails at ${errors.map((e) => `${e.call} #${e.id}`).join(', ')}: ${errors[0].message}`;
  a.advance(days * 1440);
  b.advance(days * 1440);
  return a.hash() === b.hash() ? null : `after ${days} day${days === 1 ? '' : 's'}, the recorded copy differs from the file (hash ${b.hash()}, not ${a.hash()})`;
}
