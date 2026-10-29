// The catalog: Eros's living documentation, generated at every build from
// Tyrell's own source and docs, so it can't drift from the engine. It reads
// tyrell/src with TypeScript's parser: every interface and type (with each
// field's type and doc comment), every public method of the world and its
// parts (modules, strangers, Irulan), which of them declare a kind of thing
// (a method taking a ...Def, and a few others), and the config interfaces.
// From tyrell/README.md, the parts and what each is for; from the docs'
// field tables, defaults and meanings, matched to a kind by the fields they
// share. Examples come later, at run time, from Rocinante itself.
import ts from 'typescript';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const files = (dir) => readdirSync(dir).filter((n) => n.endsWith('.ts')).map((n) => join(dir, n));

/** A node's doc comment, as plain text. */
function docOf(node) {
  const tags = ts.getJSDocCommentsAndTags(node);
  const out = [];
  for (const t of tags) {
    const c = t.comment;
    if (typeof c === 'string') out.push(c);
    else if (Array.isArray(c)) out.push(c.map((x) => x.text ?? '').join(''));
  }
  return out.join('\n').replace(/\s*\n\s*/g, ' ').trim();
}

/** Methods that declare things without taking a ...Def: what they declare, by target and method. */
const DECLARES = {
  'world.link': 'Link', 'world.on': 'Listener', 'world.term': 'Condition term', 'world.effect': 'Effect', 'world.keep': 'Kept value',
  'irulan.words': 'Story words', 'bree.starter': 'Starter set', 'cityspeak.addLines': 'Lines',
};

/** Docs pages, by target, and for the world's kinds, by method. */
const PAGES = {
  world: 'tyrell/docs/deciding.md', strangers: 'tyrell/docs/places.md', irulan: 'tyrell/docs/tools.md', ring: 'tyrell/docs/places.md',
  'world.place': 'tyrell/docs/places.md', 'world.link': 'tyrell/docs/places.md', 'world.on': 'tyrell/docs/api.md', 'world.term': 'tyrell/docs/conditions.md',
  'world.effect': 'tyrell/docs/conditions.md', 'world.keep': 'tyrell/docs/saving.md', 'world.person': 'tyrell/docs/concepts.md',
  'world.task': 'tyrell/docs/modules/mentat.md',
};

function parseSources(root) {
  const dirs = ['tyrell/src/core', 'tyrell/src/modules', 'tyrell/src/tools'];
  const types = {}, classes = [];
  for (const f of dirs.flatMap((d) => files(join(root, d)))) {
    const text = readFileSync(f, 'utf8');
    const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true);
    const file = relative(root, f);
    for (const st of sf.statements) {
      if (ts.isInterfaceDeclaration(st)) {
        types[st.name.text] = {
          name: st.name.text, file, doc: docOf(st),
          fields: st.members.filter((m) => ts.isPropertySignature(m) || ts.isMethodSignature(m)).map((m) => ({
            name: m.name.getText(sf), type: m.type ? m.type.getText(sf).replace(/\s+/g, ' ') : ts.isMethodSignature(m) ? 'function' : 'unknown',
            optional: !!m.questionToken, doc: docOf(m),
          })),
        };
      } else if (ts.isTypeAliasDeclaration(st)) {
        types[st.name.text] = { name: st.name.text, file, doc: docOf(st), alias: st.type.getText(sf).replace(/\s+/g, ' '), fields: [] };
      } else if (ts.isClassDeclaration(st) && st.name) {
        const nameProp = st.members.find((m) => ts.isPropertyDeclaration(m) && m.name.getText(sf) === 'name' && m.initializer && ts.isStringLiteral(m.initializer));
        const target = st.name.text === 'World' ? 'world' : st.name.text === 'Strangers' ? 'strangers' : st.name.text === 'Irulan' ? 'irulan'
          : nameProp ? nameProp.initializer.text : null;
        if (!target) continue;
        const methods = [];
        for (const m of st.members) {
          if (!ts.isMethodDeclaration(m) || !m.name || !ts.isIdentifier(m.name)) continue;
          const mods = ts.getCombinedModifierFlags(m);
          if (mods & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected) || m.name.text.startsWith('_')) continue;
          methods.push({
            method: m.name.text, doc: docOf(m),
            params: m.parameters.map((p) => ({ name: p.name.getText(sf), type: p.type ? p.type.getText(sf).replace(/\s+/g, ' ') : 'unknown', optional: !!p.questionToken || !!p.initializer })),
            returns: m.type ? m.type.getText(sf).replace(/\s+/g, ' ') : '',
          });
        }
        classes.push({ target, className: st.name.text, file, doc: docOf(st), methods });
      }
    }
  }
  return { types, classes };
}

/** The docs' tables: their page, heading, header and rows. */
function docTables(root) {
  const out = [];
  const pages = [...readdirSync(join(root, 'tyrell/docs')).filter((n) => n.endsWith('.md')).map((n) => join('tyrell/docs', n)),
    ...readdirSync(join(root, 'tyrell/docs/modules')).filter((n) => n.endsWith('.md')).map((n) => join('tyrell/docs/modules', n))];
  for (const page of pages) {
    const lines = readFileSync(join(root, page), 'utf8').split('\n');
    let heading = '';
    for (let i = 0; i < lines.length; i++) {
      if (/^#{1,6} /.test(lines[i])) heading = lines[i].replace(/^#+ /, '');
      if (!lines[i].startsWith('|') || !lines[i + 1]?.startsWith('|---')) continue;
      const cells = (l) => l.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
      const header = cells(lines[i]);
      const rows = [];
      for (let j = i + 2; j < lines.length && lines[j].startsWith('|'); j++) rows.push(cells(lines[j]));
      out.push({ page, heading, header, rows });
      i += rows.length + 1;
    }
  }
  return out;
}

const keyOf = (cell) => (cell || '').replace(/`/g, '').split(/[ ,(]/)[0];
/** Every field a table row is about: '`onKept`, `onBroken`, `onLapsed`' is three. */
const keysOf = (cell) => ((cell || '').match(/`([^`]+)`/g) || [cell || '']).map((k) => keyOf(k));

/** A kind's docs table: the one whose first column holds most of its fields, on its own page if it has one there. */
function tableFor(fields, tables, page, def) {
  const own = tables.filter((t) => t.page === page);
  // (elsewhere, only a table that names the definition, or shares nearly all its fields: a manner isn't an approach)
  const named = tables.filter((t) => t.heading.includes(def) || (t.header[0] || '').includes(def));
  return (own.length && pick(fields, own, 0.3)) || pick(fields, named, 0.5) || pick(fields, tables, 0.7);
}

function pick(fields, tables, least) {
  const names = new Set(fields.map((f) => f.name));
  let best = null, score = 0;
  for (const t of tables) {
    const keys = t.rows.flatMap((r) => keysOf(r[0]));
    const hit = keys.filter((k) => names.has(k)).length;
    const s = hit / Math.max(names.size, 1);
    if (hit >= 3 && s > score && hit / Math.max(keys.length, 1) >= 0.5) { score = s; best = t; }
  }
  return score >= least ? best : null;
}

/** Where in a docs table the default and the meaning are. */
function columns(header) {
  const h = header.map((c) => c.toLowerCase());
  return { def: h.findIndex((c) => c === 'default'), meaning: h.findIndex((c) => c === 'meaning' || c === 'what it does' || c === 'description') };
}

const words = (s) => s.replace(/Def$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/ (\w)/g, (_, c) => ' ' + c.toLowerCase());

export function buildCatalog(root) {
  const { types, classes } = parseSources(root);
  const tables = docTables(root);
  // the parts, from the README's table
  const parts = [];
  for (const l of readFileSync(join(root, 'tyrell/README.md'), 'utf8').split('\n')) {
    const m = /^\| \*\*(.+?)\*\*(?: \((\w+)\))? \| (.+?) \| (.+?) \|$/.exec(l);
    if (m) parts.push({ title: m[1], kind: m[2] || 'module', origin: m[3], about: m[4] });
  }
  const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '-');
  const modules = parts.map((p) => {
    const name = slug(p.title);
    const cls = classes.find((c) => c.target === name);
    const page = p.kind === 'module' ? `tyrell/docs/modules/${name}.md` : p.kind === 'tool' || p.kind === 'example' ? 'tyrell/docs/tools.md' : 'tyrell/docs/concepts.md';
    const config = types[p.title.replace(/[^A-Za-z]/g, '') + 'Config'];
    return { name, ...p, page, className: cls?.className ?? null, config: config ? config.name : null };
  });
  // the kinds: what a setup declares
  const kinds = [];
  for (const c of classes) {
    for (const m of c.methods) {
      const key = `${c.target}.${m.method}`;
      const defParam = m.params.find((p) => /^[A-Z]\w*Def(\[\])?$/.test(p.type));
      if (!defParam && !DECLARES[key]) continue;
      // (inputs and lookups that take a definition: a stranger promoted, a birth, what an action costs)
      if (/^(apply|eligible|storeOf|taint|promote|birth|cost)/.test(m.method) && !DECLARES[key]) continue;
      const def = defParam ? defParam.type.replace(/\[\]$/, '') : null;
      const t = def ? types[def] : null;
      const page = PAGES[key] ?? PAGES[c.target] ?? `tyrell/docs/modules/${c.target}.md`;
      const table = t ? tableFor(t.fields, tables, page, def) : null;
      const cols = table ? columns(table.header) : null;
      const fields = (t?.fields ?? []).map((f) => {
        const row = table?.rows.find((r) => keysOf(r[0]).includes(f.name));
        // (what every kind has, said once)
        const plain = f.name === 'id' ? 'Its id: how everything else names it' : f.name === 'label' ? 'A readable name, for people to read' : '';
        return { ...f, default: row && cols.def >= 0 ? row[cols.def].replace(/`/g, '') : '', meaning: (row && cols.meaning >= 0 ? row[cols.meaning] : '') || (f.doc ? '' : plain) };
      });
      kinds.push({
        key, target: c.target, method: m.method, name: DECLARES[key] ?? words(def), def, params: m.params, doc: m.doc || t?.doc || '',
        module: modules.find((x) => x.name === c.target)?.title ?? (c.target === 'world' ? 'Core' : c.target),
        page, table: table ? `${table.page} (${table.heading})` : null, fields,
      });
    }
  }
  return {
    generated: 'from tyrell/src, tyrell/README.md and tyrell/docs',
    modules, kinds, types,
    api: classes.map((c) => ({ target: c.target, className: c.className, file: c.file, doc: c.doc, methods: c.methods })),
    // settings, with tuning.md's default and what each does (it lists every one)
    config: ['Config', ...modules.map((m) => m.config).filter(Boolean)].map((n) => {
      const fields = types[n]?.fields ?? [];
      const table = pick(fields, tables.filter((t) => t.page === 'tyrell/docs/tuning.md'), 0.3);
      const cols = table ? columns(table.header) : null;
      return {
        type: n, module: n === 'Config' ? 'core' : modules.find((m) => m.config === n)?.name, table: table ? `tyrell/docs/tuning.md (${table.heading})` : null,
        fields: fields.map((f) => {
          const row = table?.rows.find((r) => keysOf(r[0]).includes(f.name));
          return { ...f, default: row && cols.def >= 0 ? row[cols.def].replace(/`/g, '') : '', meaning: row && cols.meaning >= 0 ? row[cols.meaning] : '' };
        }),
      };
    }),
  };
}

export function writeCatalog(root, out) {
  writeFileSync(out, JSON.stringify(buildCatalog(root), null, 1));
}
