// Code: values written as JavaScript and read back. Eros keeps a town as
// code (every definition's arguments as source), so what it runs is exactly
// what it exports: functions are kept by their source and made again in
// each world, with the world in scope as `w` (and HOUR, DAY and Tyrell).
import ts from 'typescript';

const IDENT = /^[A-Za-z_$][\w$]*$/;

/** A function's source as an expression: a method shorthand ('fire(w) {...}') becomes a function. */
export function fnSource(fn: Function): string {
  const src = fn.toString();
  if (/^(async\s+)?(function\b|class\b|\(|[A-Za-z_$][\w$]*\s*=>)/.test(src)) return src;
  return /^async\s/.test(src) ? 'async function ' + src.replace(/^async\s+/, '') : 'function ' + src;
}

const quote = (s: string) => "'" + JSON.stringify(s).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'") + "'";

/** A value as JavaScript source, short ones on a line, long ones spread over lines with this indent. */
export function toCode(value: unknown, indent = '', seen: Set<unknown> = new Set()): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : String(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'bigint') return value + 'n';
  if (typeof value === 'function') return fnSource(value);
  if (value instanceof RegExp) return value.toString();
  if (typeof value !== 'object') return 'undefined';
  if (seen.has(value)) throw new Error('a value that contains itself can\'t be written as code');
  seen.add(value);
  const inner = indent + '  ';
  let parts: string[], open: string, close: string;
  if (Array.isArray(value)) {
    parts = value.map((v) => toCode(v, inner, seen));
    open = '['; close = ']';
  } else {
    parts = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${IDENT.test(k) ? k : quote(k)}: ${toCode(v, inner, seen)}`);
    open = '{ '; close = ' }';
    if (!parts.length) { seen.delete(value); return '{}'; }
  }
  seen.delete(value);
  const line = Array.isArray(value) ? `[${parts.join(', ')}]` : `${open}${parts.join(', ')}${close}`;
  if (line.length + indent.length <= 100 && !line.includes('\n')) return line;
  return `${open.trim()}\n${parts.map((p) => inner + p).join(',\n')},\n${indent}${close.trim()}`;
}

/** Arguments as source: 'mara', { ... }. */
export const argsCode = (args: unknown[], indent = '  '): string => args.map((a) => toCode(a, indent)).join(', ');

/** What the code of a town sees: the world as `w`, HOUR, DAY, Tyrell, and opts (the options it's built with). */
export interface Scope { w: unknown; Tyrell: unknown; opts?: Record<string, unknown> }

/** Reads code back: the arguments of a call, made in a world's scope. Throws what the code throws. */
export function readArgs(code: string, scope: Scope): unknown[] {
  // eslint-disable-next-line no-new-func
  const f = new Function('w', 'Tyrell', 'HOUR', 'DAY', 'opts', `"use strict";\nreturn [\n${code}\n];`);
  return f(scope.w, scope.Tyrell, 60, 1440, scope.opts ?? {}) as unknown[];
}

/** Reads one value (an object a form or the editor made). */
export const readValue = (code: string, scope: Scope): unknown => readArgs(code, scope)[0];

/** Names code may use without declaring them: JavaScript's own, and what Eros puts in scope. */
const GLOBALS = new Set([
  'w', 'Tyrell', 'HOUR', 'DAY', 'opts', 'undefined', 'NaN', 'Infinity', 'globalThis', 'Math', 'Object', 'Array', 'JSON', 'Number', 'String', 'Boolean',
  'Symbol', 'Set', 'Map', 'WeakMap', 'WeakSet', 'Date', 'RegExp', 'Error', 'TypeError', 'Promise', 'console', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'arguments', 'this', 'structuredClone', 'BigInt',
]);

/**
 * Names a piece of code uses but neither declares nor has in scope: a
 * function from a setup file that leans on the file's own variables (a
 * table, a helper), which won't be there when it's made again elsewhere.
 */
export function freeNames(code: string): string[] {
  const sf = ts.createSourceFile('code.js', `[${code}]`, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const declared = new Set<string>(), used = new Set<string>();
  const bind = (n: ts.BindingName) => {
    if (ts.isIdentifier(n)) declared.add(n.text);
    else for (const e of n.elements) if (!ts.isOmittedExpression(e)) bind(e.name);
  };
  const visit = (n: ts.Node) => {
    if (ts.isParameter(n) || ts.isVariableDeclaration(n) || ts.isBindingElement(n)) bind(n.name);
    if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isClassDeclaration(n) || ts.isClassExpression(n)) && n.name) declared.add(n.name.text);
    if (ts.isCatchClause(n) && n.variableDeclaration) bind(n.variableDeclaration.name);
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const isName = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n)
        || (ts.isMethodDeclaration(p) && p.name === n) || ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p)
        || (ts.isBindingElement(p) && p.propertyName === n) || ts.isPropertyDeclaration(p) || ts.isGetAccessor(p) || ts.isSetAccessor(p);
      if (!isName) used.add(n.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return [...used].filter((n) => !declared.has(n) && !GLOBALS.has(n)).sort();
}
