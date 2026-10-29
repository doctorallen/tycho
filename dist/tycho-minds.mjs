/* Tycho 2.0.0 (tycho-minds): the bridge between Tycho and Tyrell. Built from minds/ by scripts/build.mjs; don't edit. MIT license. */

// minds/index.ts
var VERSION = "2.0.0";
function minutes(day, hour) {
  return (day * 24 + hour) * 60;
}
function hourOf(t) {
  return (t / 60 % 24 + 24) % 24;
}
function progress(d, now) {
  const f = (now - d.start) / Math.max(1e-6, d.end - d.start);
  return f < 0 ? 0 : f > 1 ? 1 : f;
}
function clock(o) {
  const eps = o.eps ?? 1e-6;
  return {
    sync() {
      const w = o.world();
      if (!w) return "off";
      const t = o.minutes();
      if (o.back === false && t < w.now) return "same";
      if (o.remake && t < w.esper.earliest() - eps) {
        o.remake(t);
        return "remade";
      }
      if (Math.abs(t - w.now) > eps) {
        w.advanceTo(t);
        return "ran";
      }
      return "same";
    }
  };
}
function stash(world, extra) {
  return Object.assign({ tyrell: "world", v: world.s.v }, extra, { s: world.s });
}
function restore(world, saved, o = {}) {
  const sv = saved;
  let loaded = false;
  if (sv && typeof sv === "object" && sv.s && (!o.accept || o.accept(sv))) {
    try {
      world.load(sv);
      loaded = true;
    } catch (e) {
      if (o.onError) o.onError(e);
    }
  }
  if (!loaded && o.now !== void 0) world.advanceTo(o.now);
  return loaded;
}
var Seats = class {
  constructor(world) {
    this.world = world;
    this.m = /* @__PURE__ */ new Map();
  }
  /** The seat (0 to n-1) for id doing act at place since start, given n seats and the one they'd pick first. */
  take(id, place, act, start, n, first) {
    const k = place + "|" + act;
    let m = this.m.get(k);
    if (!m) this.m.set(k, m = /* @__PURE__ */ new Map());
    const mine = m.get(id);
    if (mine && mine.start === start) return mine.i;
    const w = this.world();
    for (const [q] of m) {
      const p = w && w.get(q);
      if (!p || p.place !== place || !p.doing || p.doing.kind === "travel" || p.doing.action !== act) m.delete(q);
    }
    const used = /* @__PURE__ */ new Set();
    for (const v of m.values()) used.add(v.i);
    let i = first;
    for (let t = 0; t < n; t++) {
      const j = (first + t) % n;
      if (!used.has(j)) {
        i = j;
        break;
      }
    }
    m.set(id, { i, start });
    return i;
  }
  /** Everyone stands up (a new world). */
  clear() {
    this.m.clear();
  }
};
var Presence = class {
  constructor(world, regions) {
    this.world = world;
    this.regions = regions;
    this.c = /* @__PURE__ */ new Map();
  }
  /** Whether id might be in region now (false for anyone not about). */
  may(id, region) {
    const w = this.world(), p = w && w.get(id);
    if (!p || p.status !== "active") return false;
    const d = p.doing, key = d ? d.kind + d.start + "|" + d.to + "|" + d.place : "idle|" + p.place;
    let c = this.c.get(id);
    if (!c || c.key !== key) {
      c = { key, set: new Set(this.regions(p)) };
      this.c.set(id, c);
    }
    return c.set.has(region);
  }
  /** Forgets every doing (a new world). */
  clear() {
    this.c.clear();
  }
};
function travelTimes(f) {
  const pts = /* @__PURE__ */ new Map();
  const t = (a, b) => {
    if (a === b) return 0;
    let row = pts.get(a);
    if (!row) pts.set(a, row = /* @__PURE__ */ new Map());
    let m = row.get(b);
    if (m === void 0) {
      m = f(a, b);
      row.set(b, m);
    }
    return m;
  };
  return Object.assign(t, { clear: () => pts.clear() });
}
function witnesses(at, people, o = {}) {
  const [rx, ry] = o.reach ?? [180, 40], far = o.far ?? ((n, p) => Math.abs(n.x - p.x));
  const near = (n) => o.room || Math.abs(n.x - at.x) < rx && Math.abs(n.y - at.y) < ry;
  return people.filter((n) => (!o.can || o.can(n)) && near(n)).sort((a, b) => far(a, at) - far(b, at));
}
function collect(world, kind, keep) {
  const c = { list: [], take() {
    const l = c.list;
    c.list = [];
    return l;
  } };
  world.on(kind, (d) => {
    if (!keep || keep(d)) c.list.push(d);
  });
  return c;
}
var round4 = (x) => Math.round(x * 1e4) / 1e4;
var clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
var str = (v) => typeof v === "string" ? v : v && typeof v === "object" && typeof v.id === "string" ? v.id : void 0;
function listen(world, kind, fn) {
  const off = world.on(kind, fn);
  return typeof off === "function" ? off : () => {
  };
}
function means(world, list, arsenal) {
  const mg = world && world.morgul;
  if (mg) {
    for (const m of list) {
      mg.means(m);
      if (m.use !== "set" || mg.trapDefs && mg.trapDefs.has(m.id)) continue;
      const def = { id: m.id };
      if (m.trigger && typeof m.trigger.hidden === "boolean") def.hidden = m.trigger.hidden;
      if (m.kinds && m.kinds.length) def.kind = m.kinds[0];
      if (typeof m.severity === "number") def.severity = m.severity;
      if (typeof m.uses === "number") def.uses = m.uses;
      if (typeof m.catch === "number") def.catch = m.catch;
      mg.trap(def);
    }
  }
  return arsenal ? arsenal(list) : list.slice();
}
function idOfBody(b) {
  return str(b) ?? null;
}
function harm(world, hit, o = {}) {
  const mg = world && world.morgul;
  if (!mg) return null;
  const id = o.id ?? idOfBody;
  const to = id(hit.to);
  if (!to) return null;
  const blow = hit.blow;
  let sev;
  if (o.severity) sev = o.severity(hit);
  else if (o.whole !== void 0) {
    const whole = typeof o.whole === "function" ? o.whole(hit.to) : o.whole;
    sev = whole > 0 ? hit.amount / whole : 0;
  } else if (typeof blow.severity === "number") sev = blow.amount > 0 ? blow.severity * hit.amount / blow.amount : blow.severity;
  else sev = hit.amount;
  sev = round4(clamp01(Number(sev) || 0));
  if (sev <= 0) return null;
  const by = o.by !== void 0 ? o.by : blow.by === void 0 || blow.by === null ? null : id(blow.by) ?? null;
  const h = { to, by, severity: sev, via: o.via ?? str(blow.via) ?? "blow" };
  const kind = hit.kinds && hit.kinds[0] || blow.kinds && blow.kinds[0];
  if (kind) h.kind = kind;
  const intent = o.intent ?? str(blow.intent);
  if (intent) h.intent = intent;
  const what = o.what ?? str(blow.what) ?? str(blow.means);
  if (what) h.what = what;
  const cause = o.cause ?? str(blow.cause);
  if (cause) h.cause = cause;
  const course = o.course ?? str(blow.course);
  if (course) h.course = course;
  if (o.place !== void 0) h.place = o.place;
  if (o.seenBy) h.seenBy = o.seenBy.slice();
  else if (o.people) {
    const at = o.at ?? hit.to;
    const seen = witnesses(at, o.people, o.sight);
    h.seenBy = seen.map((n) => id(n)).filter((x) => !!x && x !== to && x !== by);
  }
  return mg.harm(h);
}
function might(world, value, key) {
  if (!world || !world.fact) return;
  const k = key ?? (world.morgul && world.morgul.config.playerMight) ?? "might:player";
  const v = round4(Number(value) || 0);
  if (world.fact(k) !== v) world.fact(k, v);
}
function armOf(world, id) {
  const mg = world.morgul, p = world.get(id);
  if (!mg || !mg.meansDefs || !p || !world.have) return null;
  let best = null;
  for (const m of mg.meansDefs.values()) {
    if (!(m.use === "strike" || m.use === "throw" || m.use === "shoot" || m.use === "cast") || world.have(p, m.id) <= 0) continue;
    const a = m.severity ?? 0, b = best ? best.severity ?? 0 : -1;
    if (!best || a > b || a === b && m.id < best.id) best = m;
  }
  return best;
}
function scuffles(world, o = {}) {
  const heavyAt = o.heavyAt ?? 0.25;
  const known = /* @__PURE__ */ new Map();
  let beats = [];
  const fightsKind = (kind) => !!(world.morgul && world.morgul.fights(kind));
  const open = (v) => {
    const mg = world.morgul;
    const f = { id: v.id, kind: v.kind, who: v.who.slice(), place: v.place, t: v.t, blows: 0, hurt: {}, last: null };
    if (v.by) f.started = v.by;
    for (const x of f.who) f.hurt[x] = mg ? round4(mg.hurt(x)) : 0;
    known.set(v.id, f);
    return f;
  };
  const push = (f, b) => {
    f.last = b;
    if (!o.keep || o.keep(f)) beats.push(b);
  };
  const base = (f, type) => {
    const b = { fight: f.id, t: world.now, type, kind: f.kind, who: f.who.slice(), place: f.place };
    if (f.started) b.started = f.started;
    return b;
  };
  const start = (v) => {
    if (v && fightsKind(v.kind) && !known.has(v.id)) {
      const f = open(v);
      push(f, base(f, "start"));
    }
  };
  const offs = [
    listen(world, "bree:start", (v) => start(v)),
    listen(world, "bree:escalated", (e) => {
      if (fightsKind(e.to) && world.bree) start(world.bree.exchange(e.id));
    }),
    listen(world, "bree:turn", (t) => {
      if (!t.harm) return;
      const f = known.get(t.id) ?? (world.bree && world.bree.exchange(t.id) ? open(world.bree.exchange(t.id)) : null);
      if (!f) return;
      const h = t.harm, b = base(f, "blow");
      b.swing = t.who;
      b.at = t.to;
      b.lands = h.by === t.who;
      b.hit = { by: h.by, to: h.to, kind: h.kind, severity: h.severity, heavy: h.severity >= heavyAt, hurt: h.hurt, harm: h.id };
      if (h.what) b.hit.what = h.what;
      if (h.end) b.end = h.end;
      f.blows++;
      f.hurt[h.to] = h.hurt;
      push(f, b);
    }),
    listen(world, "bree:end", (e) => {
      const f = known.get(e.id);
      if (!f) return;
      known.delete(e.id);
      const b = base(f, "end");
      b.end = e.why;
      if (e.left) b.left = e.left;
      if (e.mediator) b.mediator = e.mediator;
      if (e.outcome) b.outcome = e.outcome;
      push(f, b);
    })
  ];
  return {
    /** The beats since the last take, in order (those at or after `since`, world minutes, if given). */
    take(since) {
      const l = beats;
      beats = [];
      return since === void 0 ? l : l.filter((b) => b.t >= since);
    },
    /** The fights going on now, as the world has them (those the game keeps). */
    fights() {
      const bree = world.bree;
      if (!bree || !world.morgul) {
        known.clear();
        return [];
      }
      const live = bree.exchanges().filter((v) => fightsKind(v.kind));
      const ids = new Set(live.map((v) => v.id));
      for (const k of [...known.keys()]) if (!ids.has(k)) known.delete(k);
      return live.map((v) => known.get(v.id) ?? open(v)).filter((f) => !o.keep || o.keep(f));
    },
    /** The fight someone's in now, or null. */
    of(id) {
      return this.fights().find((f) => f.who.includes(id)) ?? null;
    },
    /** Forgets every fight and beat (a new world, or a jump the game won't show). */
    clear() {
      known.clear();
      beats = [];
    },
    /** Stops listening. */
    stop() {
      for (const f of offs) f();
    }
  };
}
function fighters(world, o = {}) {
  const last = /* @__PURE__ */ new Map();
  let fresh = [];
  const gap = () => o.gap ?? (world.morgul && world.morgul.config.fightGap) ?? 30;
  const plan = (r) => {
    const p = { id: r.id, against: r.to, act: r.act, t: world.now, start: r.start, odds: r.odds, hurt: r.hurt, means: armOf(world, r.id), weights: { ...r.weights } };
    if (r.help) p.help = r.help.slice();
    return p;
  };
  const sync = () => {
    if (o.might) might(world, o.might());
  };
  const off = listen(world, "morgul:respond", (r) => {
    const p = plan(r);
    last.set(r.id, p);
    fresh.push(p);
  });
  return {
    /** Sets the player's might (call it before reporting the player's hits, or each frame: it's an input only when it changes). */
    sync,
    /** The answers since the last take, in order. */
    take() {
      const l = fresh;
      fresh = [];
      return l;
    },
    /** Someone's answer now: their last, unless the fight's gone quiet longer than the gap. */
    plan(id) {
      const p = last.get(id);
      return p && world.now - p.t <= gap() + 1e-6 && p.t <= world.now + 1e-6 ? p : null;
    },
    /** How someone would answer now, without changing anything (Morgul's respond, a look). */
    ask(id) {
      sync();
      const r = world.morgul && world.morgul.respond(id);
      return r ? plan(r) : null;
    },
    /** What someone would fight with: the strongest means they hold that arms them, or null (fists). */
    means(id) {
      return armOf(world, id);
    },
    /** Forgets every answer (a new world). */
    clear() {
      last.clear();
      fresh = [];
    },
    stop() {
      off();
    }
  };
}
function nearOf(world) {
  const mod = world.s.mod;
  return mod && mod.morgul && mod.morgul.near || [];
}
function traps(world, o) {
  const kept = /* @__PURE__ */ new Map();
  const anyTraps = (mg) => {
    if (mg.trapDefs && mg.trapDefs.size) return true;
    if (mg.meansDefs) {
      for (const m of mg.meansDefs.values()) if (m.use === "set") return true;
    }
    const mod = world.s.mod;
    return !!(mod && mod.morgul);
  };
  const meansOf = (mg, kind) => {
    if (mg.meansDefs) {
      for (const m of mg.meansDefs.values()) if (m.id === kind) return m;
    }
    return null;
  };
  return {
    /** Tells Morgul what's near and works out the game's traps: those come near (made) and those gone (dropped). */
    sync() {
      const mg = world.morgul, add = [], drop = [];
      if (!mg || !anyTraps(mg)) return { add, drop };
      const want = [...new Set(o.regions())].sort();
      if (want.join("\n") !== nearOf(world).join("\n")) mg.near(want);
      const now = mg.traps().filter((t) => mg.nearPlace(t.place));
      const ids = new Set(now.map((t) => t.id));
      for (const [k, t] of [...kept]) if (!ids.has(k)) {
        kept.delete(k);
        drop.push(t);
        if (o.drop) o.drop(t);
      }
      for (const t of now) {
        const had = kept.get(t.id);
        if (had) {
          had.uses = t.uses;
          had.known = t.known.slice();
          continue;
        }
        const n = { ...t, means: meansOf(mg, t.kind) };
        if (o.make) n.obj = o.make(n);
        kept.set(t.id, n);
        add.push(n);
      }
      return { add, drop };
    },
    /** The traps that are the game's now. */
    list() {
      return [...kept.values()];
    },
    get(id) {
      return kept.get(id) ?? null;
    },
    /** A trigger sprang on someone (a character, or the player), seen by whoever (default everyone there), with whoever else was about by the game's sight (evidence, for suspicion): Morgul's harm follows. */
    spring(id, who, seenBy, about) {
      if (world.morgul) {
        if (about) world.morgul.spring(id, who, seenBy, about);
        else world.morgul.spring(id, who, seenBy);
      }
    },
    /** Someone (the player, a character) disarmed one on screen. */
    disarm(id, by) {
      if (world.morgul) world.morgul.disarm(id, by);
    },
    /** A trap set on screen (by the player, a character the game walks there), at a place, for someone, seen by whoever, with whoever else was about: its id. */
    set(kind, s) {
      return world.morgul ? world.morgul.set(kind, s) : null;
    },
    /** Lets every trap go (a new world): the game's drop told of each. */
    clear() {
      for (const t of kept.values()) if (o.drop) o.drop(t);
      kept.clear();
    }
  };
}
var g = globalThis;
if (g.Tycho && typeof g.Tycho === "object" && !Object.isFrozen(g.Tycho)) {
  try {
    g.Tycho.minds = { VERSION, minutes, hourOf, progress, clock, stash, restore, Seats, Presence, travelTimes, witnesses, collect, means, harm, might, scuffles, fighters, traps };
  } catch (e) {
  }
}
export {
  Presence,
  Seats,
  VERSION,
  clock,
  collect,
  fighters,
  harm,
  hourOf,
  means,
  might,
  minutes,
  progress,
  restore,
  scuffles,
  stash,
  traps,
  travelTimes,
  witnesses
};
