// The minds inspector, for a game whose people are Tyrell's: anyone's mind,
// read from the world (what they're doing and until when, their needs, the
// last decision with every option weighed and what ruled the rest out, from
// Palantír; today's routine; what they've done lately, from Westmarch; who
// they know, from Fellowship), and the clock to run from there: play at a
// speed, or step back and forward, going back by Esper's time walk as far as
// it remembers. The White Dragon's Tyrell mode, made for any game.
//
// Two levels. `mind(world, id, o)` is someone's mind as HTML, alone (a
// game's own dev drawer can show it). An `Inspector` is the whole panel: a
// bar (the clock, the steps, play and its speed, and the game's own), a view
// (a canvas the game draws its map on, putting people on it with `dot` and
// tappable boxes with `badge`, as its streets and rooms are its own), and a
// side (the mind of whoever's picked, a list of who's somewhere, or the
// game's summary). The game passes the world, the people, their names and
// what they're doing, its clock and its map; the words of the mind are the
// inspector's, its looks (the CSS) the game's: every class and data
// attribute carries the prefix it gives.
//
// The world is read through the shapes below (what Tyrell's World has), so
// the engine never takes Tyrell itself: a game passes its world in.

/** A person as the inspector reads them. */
export interface MindsPerson {
  id: string;
  name?: string;
  place: string | null;
  needs: Record<string, unknown>;
  vars?: Record<string, unknown>;
  doing: { kind: string; action: string; place?: string | null; from?: string | null; to?: string | null; end: number; rank?: number; layer?: string } | null;
  directive?: { do: string; label?: string; done?: boolean } | null;
}
/** An option weighed in a decision. */
export interface MindsCandidate { id: string; place: string | null; target?: string; rank: number; weight: number; layer?: string; parts?: [string, number][]; blocked?: string }
export interface MindsDecision { t: number; picked: MindsCandidate | null; candidates: MindsCandidate[]; reason?: string }
/** A routine's entry: [hour, place, activity, extra]. */
export type MindsEntry = [number, unknown, string, { rank?: number; [k: string]: unknown }?];
/** What the inspector reads of a world (Tyrell's World has all of it). */
export interface MindsWorld {
  readonly now: number;
  get(id: string): MindsPerson | undefined;
  needOf(id: string, need: string): number;
  why(id: string): MindsDecision | null;
  mind: { routineAt(p: MindsPerson, t?: number): { entry: MindsEntry; until: number } | null; routineFor(p: MindsPerson, t?: number): MindsEntry[] | null; options?(p: MindsPerson): MindsCandidate[] };
  westmarch: { chronicle(who: string, since: number): string[] };
  readonly fellowship?: { relations(id: string): { id: string; regard: number }[] } | null;
  readonly reverie?: { mood(id: string): number } | null;
  readonly esper?: { earliest(): number } | null;
  /** The pick's settings (its cut, how many it draws from, and the power of
   * the weights), for the chances. */
  readonly cfg?: { cut: number; top: number; power: number };
  /** Runs fn changing nothing (for the options weighed now). */
  peek?<T>(fn: () => T): T;
  /** Irulan, the narrator (for `story`): the log told as beats, and the
   * storylines running through it. */
  readonly irulan?: MindsNarrator | null;
}
/** A piece of a told sentence: its words, and the person or place it names. */
export interface MindsPart { text: string; person?: string; place?: string }
/** A beat Irulan tells: when, how much it matters, and its sentence in parts. */
export interface MindsBeat { t: number; end?: number; who?: string[]; with?: string[]; score: number; text: string; parts: MindsPart[] }
/** A storyline: its title, its beats, and whether it's still going. */
export interface MindsThread { id: string; title: string; parts: MindsPart[]; beats: MindsBeat[]; active: boolean; score: number }
/** What the inspector reads of Irulan (Tyrell's world.irulan has all of it). */
export interface MindsNarrator {
  beats(entries?: number | unknown[], opts?: Record<string, unknown>): MindsBeat[];
  threads(entries?: number | unknown[], opts?: Record<string, unknown>): { threads: MindsThread[] };
}

/** HH:MM of a time in minutes (the time of day). */
export function hhmm(m: number): string { const h = (((m / 60) % 24) + 24) % 24; return String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0'); }
/** Text made safe for HTML (&, < and >). */
export function esc(t: unknown): string { return String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string); }

/** How a mind is shown. */
export interface MindOptions {
  /** The prefix of every class and data attribute (`tm`: .tmneeds,
   * data-tmsel). */
  prefix?: string;
  /** A person's name (else the world's, else their id). */
  name?(id: string): string;
  /** A line under the name: who they are. */
  who?(id: string): string;
  /** A place's label; null is anywhere. */
  place?(pid: unknown, id: string): string;
  /** Said after "Walking" (" (off screen)", say). */
  walking?(id: string): string;
  /** What follows the mood on its line (money, hobbies). */
  about?(id: string, p: MindsPerson): string;
  /** Whether someone they know can be picked (a button), or is only named. */
  selectable?(id: string): boolean;
  /** The game's buttons for this mind (HTML), before Close. */
  buttons?(id: string): string;
  /** The needs' bars: [low, high (over 0.6), worst (over 0.85)]. */
  needColors?: [string, string, string];
  /** Options of the last decision shown (9), the chronicle's span in minutes
   * (12 hours) and lines (10), and people they know (4). */
  options?: number; lately?: number; lines?: number; known?: number;
  /** Dense, for a dev drawer: each need's value beside its bar (numbers),
   * the chance each option had of being drawn (chances, from the world's
   * cfg), the options as a table (table), and what they'd choose if they
   * chose now, every option weighed again without changing anything, with
   * what's ruled out by reason (now: the world's peek and mind.options). */
  numbers?: boolean; chances?: boolean; table?: boolean; now?: boolean;
  /** Lately told as a story by Irulan, when the world has it: their beats
   * since `lately`, a sentence each with its time, the people in them
   * buttons to their own minds; then the storylines they're in (Irulan's
   * threads, from the story kept or the whole log). Only the beats that are
   * theirs or that they took part in, unless `around` (those they were only
   * about for too); `min` leaves out the beats that score under it (0.1:
   * what's routine), `threads` how many storylines (3, 0 for none), and
   * `weights` is Irulan's, by kind of entry. A list of more than `names`
   * people (3) folds after that many: "…+4", to open. Without it, or without
   * Irulan, Westmarch's chronicle as it was. */
  story?: boolean | { min?: number; threads?: number; around?: boolean; weights?: Record<string, number>; names?: number };
}

/** The chance each option had of being picked: Tyrell's pick, worked out
 * (the top rank only, the weak cut, a draw from the best few by weight to
 * the power). Those it couldn't draw aren't in the map. */
export function chances(cands: MindsCandidate[], cfg?: { cut: number; top: number; power: number }): Map<MindsCandidate, number> {
  const out = new Map<MindsCandidate, number>();
  const valid = cands.filter((c) => !c.blocked && c.weight > 0);
  if (!cfg || !valid.length) return out;
  let top = -Infinity;
  for (const c of valid) top = Math.max(top, c.rank);
  let pool = valid.filter((c) => c.rank === top);
  const best = Math.max(...pool.map((c) => c.weight));
  pool = pool.filter((c) => c.weight >= best * cfg.cut).sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : 1)).slice(0, cfg.top);
  const tot = pool.reduce((s, c) => s + Math.pow(c.weight, cfg.power), 0) || 1;
  for (const c of pool) out.set(c, Math.pow(c.weight, cfg.power) / tot);
  return out;
}

/** Options weighed: a table (option and where, rank, weight, chance, what
 * the weight was made of or what ruled it out), or the inspector's plain
 * list's lines (inside its .why box, which the caller opens). */
function weighed(P: string, cands: MindsCandidate[], isPick: (c: MindsCandidate) => boolean, at: (pid: unknown) => string, o: MindOptions, odds: Map<MindsCandidate, number>): string {
  const why = (c: MindsCandidate) => esc(c.blocked || (c.parts || []).map(([n, v]) => n + ' ' + (+v).toFixed(2)).join(' × '));
  const pct = (c: MindsCandidate) => (odds.has(c) ? Math.round((odds.get(c) as number) * 100) + '%' : '');
  const cls = (c: MindsCandidate) => (isPick(c) ? 'pick' : c.blocked ? 'no' : '');
  if (o.table) {
    // (the same option at places of the same name, weighed the same, is one row: ×n)
    const rows = new Map<string, { c: MindsCandidate; n: number; odds: number }>();
    for (const c of cands) {
      const k = [isPick(c), c.id, at(c.place), c.rank, c.blocked || c.weight.toFixed(3), why(c)].join('|'), r = rows.get(k);
      if (r) { r.n++; r.odds += odds.get(c) || 0; } else rows.set(k, { c, n: 1, odds: odds.get(c) || 0 });
    }
    let h = `<table class="${P}why"><tr><th>option</th><th>rank</th><th>weight</th>${o.chances ? '<th>chance</th>' : ''}<th>why</th></tr>`;
    for (const { c, n, odds: p } of rows.values()) h += `<tr class="${cls(c)}"><td><b>${c.id}</b><br><small>${esc(at(c.place))}${n > 1 ? ' ×' + n : ''}</small></td><td class="num">${c.rank}</td><td class="num">${c.blocked ? '' : c.weight.toFixed(3)}</td>${o.chances ? `<td class="num">${p ? Math.round(p * 100) + '%' : ''}</td>` : ''}<td><small>${why(c)}</small></td></tr>`;
    return h + '</table>';
  }
  return cands.map((c) => `<div class="${cls(c)}"><b>${c.id}</b> <small>${esc(at(c.place))} · rank ${c.rank}${c.blocked ? '' : ' · ' + c.weight.toFixed(3)}${o.chances && odds.has(c) ? ' · ' + pct(c) : ''}</small><br><small>${why(c)}</small></div>`).join('');
}

const NEED_COLORS: [string, string, string] = ['#3af0e0', '#ffb040', '#ff4a5a'];

/** Someone's mind, as HTML: who, what now and until when, what they were
 * told to do, their needs, their mood, why (the last decision), today's
 * routine, lately, the people they know best, and buttons. */
export function mind(w: MindsWorld, id: string, o: MindOptions = {}): string {
  const P = o.prefix ?? 'insp', p = w.get(id);
  const name = (x: string) => (o.name ? o.name(x) : (w.get(x) && w.get(x)!.name) || x);
  if (!p) return `<h3>${esc(name(id))}</h3><p class="dim">Not in the world.</p><div class="buttons"><button data-${P}do="close">Close</button></div>`;
  // (the game's note on a walk is asked first, as its view would: it may
  // hand out a seat)
  const walk = o.walking ? o.walking(id) : '';
  const d = p.doing, at = (pid: unknown) => (o.place ? o.place(pid, id) : !pid ? 'anywhere' : String(pid));
  let h = `<h3>${esc(name(id))}</h3>${o.who ? `<p class="sub">${esc(o.who(id))}</p>` : ''}`;
  const now = !d ? 'Nothing, waiting to choose.' : d.kind === 'travel' ? `Walking${walk} from ${esc(at(d.from))} to ${esc(at(d.to))}, to ${d.action}, till ${hhmm(d.end)}.` : d.kind === 'wait' ? `Waiting at ${esc(at(p.place))} till ${hhmm(d.end)}.` : `${d.action} at ${esc(at(d.place || p.place))}, till ${hhmm(d.end)}.`;
  h += `<p><b>Now</b> ${now}${d && d.rank !== undefined ? ` <small class="dim">(${d.layer || 'free'}, rank ${d.rank})</small>` : ''}</p>`;
  if (p.directive && !p.directive.done) h += `<p class="dim">Told to: ${p.directive.do}${p.directive.label ? ' · ' + esc(p.directive.label) : ''}</p>`;
  // needs, as bars
  const NC = o.needColors || NEED_COLORS;
  h += `<div class="${P}needs">` + Object.keys(p.needs).map((k) => { const v = w.needOf(id, k), c = v < 0 ? 0 : v > 1 ? 1 : v; return `<div><span>${k}</span><i><b style="width:${Math.round(c * 100)}%;background:${v > 0.85 ? NC[2] : v > 0.6 ? NC[1] : NC[0]}"></b></i>${o.numbers ? `<em>${v.toFixed(2)}</em>` : ''}</div>`; }).join('') + '</div>';
  const rv = w.reverie; if (rv) h += `<p class="dim">Mood ${(rv.mood(id) || 0).toFixed(2)}${o.about ? o.about(id, p) : ''}</p>`;
  // why: the last decision, every option weighed
  const dec = w.why(id);
  if (!dec) h += '<h3>Why</h3><p class="dim">No choice made since the last time walk: play the clock on a little.</p>';
  if (dec) {
    const pk = dec.picked, isPick = (c: MindsCandidate) => !!pk && c.id === pk.id && c.place === pk.place && c.target === pk.target;
    const cands = dec.candidates.slice().sort((a, b) => +isPick(b) - +isPick(a) || b.rank - a.rank || b.weight - a.weight).slice(0, o.options ?? 9);
    const odds = o.chances ? chances(dec.candidates, w.cfg) : new Map<MindsCandidate, number>();
    const chose = pk ? `<p>Chose <b>${pk.id}</b> at ${esc(at(pk.place))}${pk.layer ? ` <small class="dim">(${pk.layer})</small>` : ''}. It's drawn from the best few, by weight squared, so the top one doesn't always win.</p>` : '';
    h += `<h3>Why · ${hhmm(dec.t)}</h3><p class="dim">${esc(dec.reason || '')}</p>`;
    h += o.table ? chose + weighed(P, cands, isPick, at, o, odds) : `<div class="${P}why">${chose}${weighed(P, cands, isPick, at, o, odds)}</div>`;
  }
  // if they chose now: every option weighed again, changing nothing
  if (o.now && w.peek && w.mind.options) {
    const opts = w.peek(() => (w.mind.options as (p: MindsPerson) => MindsCandidate[])(p)), odds = chances(opts, w.cfg);
    const doing = (c: MindsCandidate) => !!d && c.id === d.action && c.place === (d.kind === 'travel' ? d.to : d.place || p.place); // (what they're doing now, marked)
    const ok = opts.filter((c) => !c.blocked && c.weight > 0).sort((a, b) => b.rank - a.rank || b.weight - a.weight).slice(0, o.options ?? 9);
    const rows = weighed(P, ok, doing, at, o, odds);
    h += `<h3>If they chose now</h3>` + (!ok.length ? '<p class="dim">Nothing they could do.</p>' : o.table ? rows : `<div class="${P}why">${rows}</div>`);
    const out: Record<string, string[]> = {};
    for (const c of opts) if (c.blocked) (out[c.blocked] = out[c.blocked] || []).push(c.id);
    const n = opts.filter((c) => c.blocked).length;
    if (n) h += `<details class="${P}out"><summary>Ruled out (${n})</summary>` + Object.keys(out).map((r) => `<div><b>${esc(r)}</b>: ${[...new Set(out[r])].join(', ')}</div>`).join('') + '</details>';
  }
  // today's routine, the hour they're in marked
  const ra = w.mind.routineAt(p), plan = (w.mind.routineFor(p, w.now) || []).slice().sort((a, b) => a[0] - b[0]), cur = ra && ra.entry;
  if (plan.length) h += `<h3>Today</h3><div class="${P}day">` + plan.map((e) => `<div class="${e === cur ? 'cur' : ''}"><span>${String(Math.floor(e[0])).padStart(2, '0')}:${String(Math.round((e[0] % 1) * 60)).padStart(2, '0')}</span> ${e[2] === '*' ? 'free' : e[2]} <small>${e[1] === null ? '' : esc(e[1] === 'home' ? 'home' : at(e[1]))}${e[3] && e[3].rank ? ' · holds' : ''}</small></div>`).join('') + '</div>';
  // lately: what they've done, told as a story (Irulan) or a line at a time (Westmarch)
  const can = (x: string) => (o.selectable ? o.selectable(x) : !!w.get(x));
  if (o.story && w.irulan) h += story(P, w, w.irulan, id, o, o.story === true ? {} : o.story, can);
  else {
    const lines = w.westmarch.chronicle(id, w.now - (o.lately ?? 12 * 60)).slice(-(o.lines ?? 10));
    if (lines.length) h += `<h3>Lately</h3><div class="${P}log">` + lines.map((l) => `<div>${esc(l)}</div>`).join('') + '</div>';
  }
  // who they know best
  const fs = w.fellowship ? w.fellowship.relations(id).slice(0, o.known ?? 4) : [];
  if (fs.length) h += `<h3>People</h3><div class="${P}list">` + fs.map((f) => can(f.id) ? `<button data-${P}sel="${f.id}">${esc(name(f.id))} <small>regard ${f.regard.toFixed(2)}</small></button>` : `<span class="dim">${esc(f.id)} · ${f.regard.toFixed(2)}</span>`).join('') + '</div>';
  h += `<div class="buttons">${o.buttons ? o.buttons(id) : ''}<button data-${P}do="close">Close</button></div>`;
  return h;
}

/** Lately, told by Irulan: their beats since `lately` with their times, and
 * the storylines they're in, each folded under its title. */
function story(P: string, w: MindsWorld, I: MindsNarrator, id: string, o: MindOptions, S: { min?: number; threads?: number; around?: boolean; weights?: Record<string, number>; names?: number }, can: (x: string) => boolean): string {
  // (a sentence's people are buttons to their minds, themselves and those
  // who can't be picked only named; places as they're said; and a list of
  // more than `names` people folds after that many, "…+4", kept open or
  // shut by its key through a redraw)
  const one = (q: MindsPart) => (q.person && q.person !== id && can(q.person) ? `<a data-${P}sel="${q.person}">${esc(q.text)}</a>` : q.person ? `<b>${esc(q.text)}</b>` : q.place ? `<i>${esc(q.text)}</i>` : esc(q.text));
  const N = Math.max(1, S.names ?? 3), sep = (q: MindsPart | undefined) => !!q && !q.person && !q.place && /^(, | and |, and )$/.test(q.text);
  const told = (parts: MindsPart[], key?: string) => {
    let h = '', run = 0;
    for (let i = 0; i < parts.length;) {
      if (!parts[i].person || !key) { h += one(parts[i]); i++; continue; }
      const at = [i];
      while (sep(parts[at[at.length - 1] + 1]) && parts[at[at.length - 1] + 2] && parts[at[at.length - 1] + 2].person) at.push(at[at.length - 1] + 2);
      const end = at[at.length - 1] + 1;
      if (at.length > N + 1) h += parts.slice(i, at[N - 1] + 1).map(one).join('') + `<details class="${P}more" data-keep="${key}:${run}"><summary>…+${at.length - N}</summary>${parts.slice(at[N - 1] + 1, end).map(one).join('')}</details>`;
      else h += parts.slice(i, end).map(one).join('');
      run++; i = end;
    }
    return h;
  };
  // (a line a beat with its time, and the day named where it changes: Day 3)
  const day = (t: number) => Math.floor(t / 1440);
  const lines = (beats: MindsBeat[], span: boolean) => {
    let d = day(w.now), out = '';
    for (const b of beats) {
      if (day(b.t) !== d) { d = day(b.t); out += `<div class="${P}when">Day ${d}</div>`; }
      out += `<div><span>${hhmm(b.t)}${span && b.end !== undefined && b.end - b.t >= 30 ? '–' + hhmm(b.end) : ''}</span> ${told(b.parts, `${P}more:${id}:${b.t}:${(b.who || []).join(',')}`)}</div>`;
    }
    return out;
  };
  let h = '';
  const theirs = (b: MindsBeat) => S.around || (b.who || []).includes(id) || (b.with || []).includes(id);
  const beats = I.beats(w.now - (o.lately ?? 12 * 60), { who: id, min: S.min ?? 0.1, weights: S.weights }).filter(theirs).slice(-(o.lines ?? 10));
  if (beats.length) h += `<h3>Lately</h3><div class="${P}story">` + lines(beats, true) + '</div>';
  const n = S.threads ?? 3, threads = n > 0 ? I.threads(undefined, { who: id, weights: S.weights }).threads.slice(0, n) : [];
  if (threads.length) h += `<h3>Storylines</h3><div class="${P}threads">` + threads.map((t) => `<details data-keep="${P}thread:${id}:${esc(t.id)}"${t.active ? ' open' : ''}><summary>${told(t.parts)}${t.active ? ' <small>going on</small>' : ''}</summary>` + lines(t.beats, false) + '</details>').join('') + '</div>';
  return h;
}

// ---------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------

/** A kind of doing, for the colors on the map and the legend. */
export interface Kind { color: string; word: string }
/** A person drawn on the view, to be picked by a tap. */
export interface Dot { x: number; y: number; id: string }
/** A tappable box on the view, with whatever the game wants to know of it. */
export interface Badge { x0: number; x1: number; y0: number; y1: number; [k: string]: unknown }

/** The game's map, drawn on the inspector's canvas. */
export interface InspectView {
  /** The canvas's height (CSS px) for a box this high (taller scrolls). */
  height?(box: number, ins: Inspector): number;
  /** Draws it (the canvas is cleared, scaled to CSS px): people with
   * ins.dot, boxes to tap with ins.badge. */
  draw(g: CanvasRenderingContext2D, ins: Inspector): void;
  /** A tap that found nobody: the box under it, if any. */
  tap?(badge: Badge | null, x: number, y: number, ins: Inspector): void;
  /** A drag: grab() when it starts, drag(dx, dy, what grab gave) as it goes. */
  grab?(ins: Inspector): unknown;
  drag?(dx: number, dy: number, at: unknown, ins: Inspector): void;
  wheel?(e: WheelEvent, x: number, y: number, ins: Inspector): void;
}

export interface InspectorOptions extends MindOptions {
  /** The world, or null when there are no minds. */
  world(): MindsWorld | null;
  /** Everyone to show, in order. */
  people(): string[];
  /** The kinds of doing, in the legend's order. */
  kinds?: Record<string, Kind>;
  /** What someone's doing now: a key of kinds. */
  kind?(id: string): string;
  /** What someone's doing, in a list of who's somewhere. */
  note?(id: string): string;
  /** The game's clock: now (minutes, Tyrell's), set to a time (and bring the
   * minds there), and how it reads. */
  clock: { now(): number; set(minutes: number): void; text(): string };
  /** Speeds to play at (game minutes a second) and the first. */
  speeds?: number[]; speed?: number;
  /** Steps of the clock's buttons, minutes. */
  steps?: number[];
  /** Says something (Esper can't go back that far). */
  say?(text: string): void;
  view?: InspectView;
  /** The game's own at the bar's end (HTML); its buttons' data-<prefix>
   * keys go to act. */
  bar?(): string;
  /** The game's own, after the clock is drawn (its bar's state). */
  status?(ins: Inspector): void;
  /** The side with nobody picked (else a count and the legend). */
  summary?(ins: Inspector): string;
  /** Someone picked from a list or a mind. */
  onSelect?(id: string, ins: Inspector): void;
  /** A button of the game's (a mind's data-<prefix>do, or the bar's), with
   * whoever's picked; false leaves the panel as it is. */
  act?(key: string, id: string | null, ins: Inspector): boolean | void;
  /** Whether the panel is still showing (else it stops). */
  open?(): boolean;
  /** The view's background. */
  bg?: string;
}

const STEP_LABEL = (m: number) => (m < 0 ? '−' : '+') + (Math.abs(m) % 60 ? Math.abs(m) + 'm' : Math.abs(m) / 60 + 'h');

/** The inspector: `html()` its markup, `attach(root)` once it's in the page
 * (it runs until the panel closes). */
export class Inspector {
  o: InspectorOptions;
  P: string;
  /** Whoever's picked. */
  sel: string | null = null;
  /** Who's somewhere, listed in the side: a title and their ids. */
  list: { title: string; ids: string[] } | null = null;
  playing = false;
  speed: number;
  dots: Dot[] = [];
  badges: Badge[] = [];
  /** The canvas's size in CSS px, and the device pixels to one. */
  w = 0; h = 0; dpr = 1;
  root: ParentNode | null = null;
  private raf = 0; private last = 0; private sideT = 0;
  constructor(o: InspectorOptions) { this.o = o; this.P = o.prefix ?? 'insp'; this.speed = o.speed ?? 60; }

  /** An element of the panel, by its name (its id is the prefix and it). */
  el<T extends HTMLElement = HTMLElement>(name: string): T | null {
    const r = this.root as (ParentNode & { getElementById?: (id: string) => HTMLElement | null }) | null, id = this.P + name;
    if (r && r.querySelector) return r.querySelector('#' + id) as T | null;
    return typeof document !== 'undefined' ? (document.getElementById(id) as T | null) : null;
  }
  html(): string {
    const P = this.P, speeds = this.o.speeds || [1, 10, 60, 240], steps = this.o.steps || [-60, -15, 15, 60];
    const sp = speeds.map((v) => `<option value="${v}"${v === this.speed ? ' selected' : ''}>×${v === 1 ? '1 (game)' : v}</option>`).join('');
    const btn = (m: number) => `<button data-${P}="${m}"${m === -60 ? ' title="Back an hour"' : ''}>${STEP_LABEL(m)}</button>`;
    const back = steps.filter((m) => m < 0).map(btn).join(''), on = steps.filter((m) => m > 0).map(btn).join('');
    return `<div class="${P}"><div class="${P}bar">
      <span class="${P}clock" id="${P}clock"></span>
      ${back}<button data-${P}="play" class="go" id="${P}play">Play</button>${on}
      <select id="${P}speed" aria-label="Speed">${sp}</select>
      ${this.o.bar ? this.o.bar() : ''}
    </div><div class="${P}body"><div class="${P}view" id="${P}view"><canvas id="${P}cv"></canvas></div><div class="${P}side" id="${P}side"></div></div></div>`;
  }
  /** Wires the panel in root (where html() went) and runs it. */
  attach(root: ParentNode): void {
    this.root = root;
    const P = this.P, cv = this.el<HTMLCanvasElement>('cv');
    if (!cv) return;
    root.querySelectorAll<HTMLButtonElement>(`button[data-${P}]`).forEach((b) => (b.onclick = () => {
      const k = b.dataset[P] as string;
      if (k === 'play') { this.playing = !this.playing; this.last = performance.now(); }
      else if (/^-?\d+(\.\d+)?$/.test(k)) this.step(+k);
      else if (this.o.act && this.o.act(k, null, this) === false) return;
      this.draw(); this.side(true);
    }));
    const sp = this.el<HTMLSelectElement>('speed');
    if (sp) sp.onchange = (e) => { this.speed = +(e.target as HTMLSelectElement).value; };
    // a tap picks someone (or the box under it); a drag is the view's
    let down: { x: number; y: number; at: unknown; moved: number } | null = null;
    const V = this.o.view;
    cv.onpointerdown = (e) => { down = { x: e.clientX, y: e.clientY, at: V && V.grab ? V.grab(this) : null, moved: 0 }; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = (e) => { if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y; down.moved = Math.max(down.moved, Math.abs(dx) + Math.abs(dy)); if (V && V.drag) V.drag(dx, dy, down.at, this); };
    cv.onpointerup = (e) => { const d = down; down = null; if (d && d.moved < 6) { const r = cv.getBoundingClientRect(); this.tap(e.clientX - r.left, e.clientY - r.top); } };
    cv.onwheel = (e) => { if (!V || !V.wheel) return; const r = cv.getBoundingClientRect(); V.wheel(e, e.clientX - r.left, e.clientY - r.top, this); };
    this.size(); this.draw(); this.side(true);
    cancelAnimationFrame(this.raf); this.last = performance.now();
    const tick = (t: number) => {
      const c = this.el('cv');
      if ((this.o.open && !this.o.open()) || !c || !c.isConnected) { this.playing = false; return; }
      const dt = Math.min(0.1, (t - this.last) / 1000); this.last = t;
      if (this.playing) { this.step(this.speed * dt, true); this.draw(); }
      if (t - this.sideT > 250) { this.sideT = t; this.side(); this.clock(); }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  /** The canvas, sized to its box (or taller, as the view asks: the box scrolls). */
  size(): void {
    const cv = this.el<HTMLCanvasElement>('cv'), box = this.el('view');
    if (!cv || !box) return;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1, V = this.o.view;
    const w = box.clientWidth, h = V && V.height ? V.height(box.clientHeight, this) : box.clientHeight;
    cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    this.w = w; this.h = h; this.dpr = dpr;
  }
  /** Draws the view afresh (sized again if its box or its height changed). */
  draw(): void {
    const cv = this.el<HTMLCanvasElement>('cv'), box = this.el('view');
    if (!cv || !box) return;
    const V = this.o.view, want = V && V.height ? V.height(box.clientHeight, this) : box.clientHeight;
    if (want !== this.h || cv.width !== Math.round(box.clientWidth * this.dpr)) this.size();
    const g = cv.getContext('2d') as CanvasRenderingContext2D;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.fillStyle = this.o.bg || '#0a0812'; g.fillRect(0, 0, this.w, this.h);
    this.dots = []; this.badges = [];
    if (V) V.draw(g, this);
  }
  /** Someone on the view, at x, y (CSS px), in their color: a ring if
   * they're picked, another if they're on the move. */
  dot(g: CanvasRenderingContext2D, x: number, y: number, col: string, id: string, moving?: boolean, r = 2.2): void {
    const sel = id === this.sel;
    if (sel) { g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r + 3, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    if (moving) { g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r + 1.2, 0, Math.PI * 2); g.stroke(); }
    this.dots.push({ x, y, id });
  }
  /** A box on the view to tap. */
  badge(b: Badge): void { this.badges.push(b); }
  /** A person's color now. */
  color(id: string): string { const K = this.o.kinds || {}, k = this.o.kind ? this.o.kind(id) : ''; return (K[k] || K.other || { color: '#c8c0d8' }).color; }
  /** A tap at x, y (CSS px on the view): the nearest person within 9 px is
   * picked; else the view hears of it, with the box under it. */
  tap(x: number, y: number): void {
    let best: Dot | null = null, bd = 9;
    for (const d of this.dots) { const dd = Math.hypot(d.x - x, d.y - y); if (dd < bd) { bd = dd; best = d; } }
    if (best) { this.sel = best.id; this.list = null; this.draw(); this.side(true); return; }
    const b = this.badges.find((q) => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1) || null;
    if (this.o.view && this.o.view.tap) this.o.view.tap(b, x, y, this);
  }
  /** The clock on (or back) by `min` game minutes; back no further than
   * Esper remembers (the nearest quarter hour after, said unless quiet). */
  step(min: number, quiet?: boolean): void {
    const w = this.o.world();
    let t = this.o.clock.now() + min;
    if (min < 0 && w && w.esper) { const e = w.esper.earliest(); if (t < e) { t = Math.ceil(e / 15) * 15; if (!quiet && this.o.say) this.o.say('Esper only remembers back to ' + hhmm(e) + '.'); } }
    this.o.clock.set(t);
    this.clock();
  }
  /** The bar: the clock's text, Play or Pause, and the game's own. */
  clock(): void {
    const c = this.el('clock'); if (c) c.textContent = this.o.clock.text();
    const p = this.el('play'); if (p) p.textContent = this.playing ? 'Pause' : 'Play';
    if (this.o.status) this.o.status(this);
  }
  /** Picks someone (or nobody). */
  select(id: string | null): void { this.sel = id; this.list = null; if (id && this.o.onSelect) this.o.onSelect(id, this); this.draw(); this.side(true); }
  /** The side: someone's mind, a list, or the summary; not redrawn under
   * the pointer while it's being read, unless forced. */
  side(force?: boolean): void {
    const el = this.el('side');
    if (!el) return;
    if (!force && el.matches(':hover')) return;
    const w = this.o.world();
    el.innerHTML = this.sel && w ? mind(w, this.sel, Object.assign({}, this.o, { prefix: this.P })) : this.list ? this.listHtml(this.list) : this.summary();
    const P = this.P;
    el.querySelectorAll<HTMLElement>(`[data-${P}sel]`).forEach((b) => (b.onclick = () => this.select(b.dataset[P + 'sel'] as string)));
    el.querySelectorAll<HTMLElement>(`[data-${P}do]`).forEach((b) => (b.onclick = () => {
      const k = b.dataset[P + 'do'] as string;
      if (k === 'close') { this.sel = null; this.list = null; }
      else if (this.o.act && this.o.act(k, this.sel, this) === false) return;
      this.draw(); this.side(true);
    }));
  }
  /** Counts of everyone by kind, with their colors and words. */
  legend(n: Record<string, number>): string {
    const K = this.o.kinds || {};
    return `<div class="${this.P}legend">` + Object.keys(K).filter((k) => n[k]).map((k) => `<span><i style="background:${K[k].color}"></i>${K[k].word} <b>${n[k]}</b></span>`).join('') + '</div>';
  }
  summary(): string {
    if (this.o.summary) return this.o.summary(this);
    const n: Record<string, number> = {}, ids = this.o.people();
    for (const id of ids) { const k = this.o.kind ? this.o.kind(id) : 'other'; n[k] = (n[k] || 0) + 1; }
    return `<h3>${ids.length} people</h3><p class="dim">Tap someone to see their mind.</p>` + this.legend(n);
  }
  /** Who's somewhere: a button each, in their color, with what they're doing. */
  listHtml(L: { title: string; ids: string[] }): string {
    const P = this.P, name = (id: string) => (this.o.name ? this.o.name(id) : id);
    return `<h3>${L.title}</h3><div class="${P}list">` + L.ids.map((id) => `<button data-${P}sel="${id}"><i style="background:${this.color(id)}"></i>${name(id)} <small>${this.o.note ? this.o.note(id) : ''}</small></button>`).join('') + `</div><div class="buttons"><button data-${P}do="close">Back</button></div>`;
  }
}
