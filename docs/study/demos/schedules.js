// schedules.js: A village day. A study demo, using people-shared.js.
// A dozen villagers in four households follow routines generated from their job, age, habits and the village's values,
// written as Tyrell routine entries ([hour, place, activity], with weekday variants for market and rest days). Where
// anyone is, is a pure function of the clock: the same sum Tyrell's far people and strangers use off screen.
(() => {
  const { lang, villager, LOOKS, cap } = StudyShared.people;
  const W = 160, H = 104, ROAD = 61, SPEED = 4; // art pixels a game minute on foot
  const DAYS = ['Moonday', 'Market', 'Thirdday', 'Fourthday', 'Market', 'Sixthday', 'Rest'];
  const MARKET = [1, 4], REST = 6;
  const ACT_INK = { sleep: 2, eat: 13, pray: 31, play: 18, chat: 23, drink: 9, buy: 11, sell: 11, trade: 11, walk: 6, travel: 4, herd: 4 };
  const WORKINK = 28;
  // the village's places: buildings above the road, open places below it; doors are where paths start
  const P = {
    home0: { x: 4, y: 34, w: 18, h: 22, roof: 9, inside: true }, home1: { x: 25, y: 32, w: 18, h: 24, roof: 27, inside: true },
    bakery: { x: 46, y: 34, w: 20, h: 22, roof: 10, inside: true }, tavern: { x: 82, y: 30, w: 24, h: 26, roof: 22, inside: true },
    home2: { x: 109, y: 34, w: 18, h: 22, roof: 3, inside: true }, home3: { x: 130, y: 32, w: 18, h: 24, roof: 28, inside: true },
    shrine: { x: 69, y: 4, w: 16, h: 14, roof: 30, door: [77, 19], spot: [77, 25], spread: 7 },
    smithy: { x: 4, y: 68, w: 24, h: 14, door: [16, 66], spot: [16, 79], spread: 4 },
    well: { door: [44, 66], spot: [44, 78], spread: 6 },
    market: { x: 56, y: 67, w: 40, h: 22, door: [76, 66], spot: [76, 79], spread: 15 },
    field: { x: 102, y: 68, w: 56, h: 34, door: [110, 66], spot: [130, 85], spread: 22 },
    east: { door: [172, ROAD], away: true }, west: { door: [-12, ROAD], away: true },
  };
  for (const k in P) { const p = P[k]; if (p.inside) p.door = [p.x + (p.w >> 1), p.y + p.h]; }
  const JOBS = {
    farmer: { work: [[6, 'field', 'farm'], [12, 'field', 'eat'], [12.5, 'field', 'farm']], end: 17 },
    smith: { work: [[7, 'smithy', 'forge'], [12, 'home', 'eat'], [13, 'smithy', 'forge']], end: 17 },
    baker: { wake: 4, work: [[4.5, 'bakery', 'bake']], end: 11, market: [[4.5, 'bakery', 'bake'], [7.5, 'market', 'sell']], marketEnd: 12 },
    priest: { work: [[6, 'shrine', 'tend'], [12, 'home', 'eat'], [14, 'shrine', 'tend']], end: 18 },
    innkeeper: { wake: 9, work: [[10.5, 'tavern', 'serve']], end: 23.5, late: true },
    trader: { work: [[7, 'east', 'travel']], end: 17.5, market: [[7, 'market', 'trade']], marketEnd: 16 },
    herder: { work: [[6, 'west', 'herd']], end: 18 },
    weaver: { work: [[8, 'porch', 'weave'], [12, 'home', 'eat'], [13, 'porch', 'weave']], end: 17 },
  };
  const VALUES = ['kin', 'faith', 'trade', 'merriment'];

  Kit.register('schedules', { title: 'A village day', fit: 'per-frame' }, host => {
    const cv = Kit.canvas(host, W, H);
    cv.cv.style.cursor = 'pointer';
    const g = cv.g;
    let seed = 5, minute = 1 * 1440 + 6 * 60, speed = 30, sel = null, V, base, lastInfo = -1;
    const ctl = Kit.bar(host);
    ctl.seed(seed, s => { seed = s; build(); });
    ctl.tabs(['pause', '5 min/s', '30 min/s', '2 h/s'], v => { speed = { pause: 0, '5 min/s': 5, '30 min/s': 30, '2 h/s': 120 }[v]; }, '30 min/s');
    const clock = ctl.note('');
    const pick = Kit.el('select', { style: 'font:inherit;max-width:100%;min-height:32px', on: { change: () => { sel = V.people[+pickSel.value] || null; lastInfo = -1; } } });
    const pickSel = pick;
    const row2 = Kit.bar(host); row2.row.append(Kit.el('label', {}, 'Follow ', pick));
    const info = Kit.el('div', { style: 'margin-top:8px;font-size:13px;line-height:1.5' });
    const barHost = Kit.el('div', { style: 'margin-top:6px' });
    const code = Kit.el('pre', { style: 'margin:6px 0 0;font-size:11.5px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere;background:none;padding:0' });
    host.append(info, barHost, code);
    const bar = Kit.canvas(barHost, 96, 5, { max: 4 });

    // ---- a village, its households and their routines ----
    function build() {
      const r = Kit.rng('village' + seed), L = lang(seed + 300);
      const vals = [];
      while (vals.length < 2) { const v = r.pick(VALUES); if (!vals.includes(v)) vals.push(v); }
      const founded = r.int(70, 140), founder = L.given(r).name;
      const shrineWhy = r.pick(['the fever', 'the dry summer', 'a child was pulled alive from the river', 'the great storm']);
      const shrineAgo = r.int(25, founded - 10), fireAgo = r.int(8, 40);
      const vname = L.compound(r.pick(['oak', 'ash', 'white', 'old', 'red']), r.pick(['ford', 'field', 'farm', 'spring']));
      const elsewhere = () => L.compound(r.pick(['salt', 'high', 'cold', 'long', 'black']), r.pick(['hill', 'town', 'shore', 'wood']));
      const deck = ['smith', 'baker', 'priest', 'innkeeper', 'trader', 'farmer'].map(j => [r(), j]).sort((a, b) => a[0] - b[0]).map(x => x[1]).concat(['farmer', 'weaver', 'herder', 'farmer']);
      const people = [], homes = ['home0', 'home1', 'home2', 'home3'];
      const mkLook = (age) => ({ skin: r.pick(LOOKS.skin), hair: age > 60 ? 6 : r.pick(LOOKS.hair), shirt: r.pick(LOOKS.shirt), legs: r.pick([1, 2, 26, 27]) });
      homes.forEach((home, hh) => {
        const house = L.surname === 'house' || L.surname === 'trade' ? L.compound(r.pick(['iron', 'crow', 'wolf', 'ash', 'oak']), r.pick(['stone', 'hill', 'ford', 'wood'])) : null;
        const fam = [];
        const add = (stage, age, female, extra = {}) => {
          const g = L.given(r);
          const p = { id: people.length, hh, home, stage, age, female, name: g.name, gloss: g.gloss, look: mkLook(age), devout: r(), social: r(), lark: r(), ...extra };
          people.push(p); fam.push(p); return p;
        };
        const elder = r.chance(0.5) ? add('elder', r.int(62, 81), r.chance(0.5), { job: 'elder' }) : null;
        const a1 = add('adult', r.int(26, 52), r.chance(0.5), { job: deck.shift() });
        const a2 = r.chance(0.75) ? add('adult', Math.max(22, a1.age + r.int(-6, 6)), !a1.female, { job: deck.shift(), married: true, from: r.chance(0.5) ? elsewhere() : null }) : null;
        const kids = r.int(0, a2 ? 2 : 1);
        for (let k = 0; k < kids; k++) add('child', r.int(4, Math.min(15, a1.age - 18)), r.chance(0.5), { job: 'child' });
        // family names by the language's rule, so a household reads as one
        for (const p of fam) {
          if (house) p.family = house;
          else if (L.surname === 'patronymic') { const par = p.stage === 'child' ? a1 : elder && p !== elder ? elder : null; p.family = par ? cap(par.name.toLowerCase() + L.spell(L.m(p.female ? 'daughter' : 'son'))) : cap(L.word(r).toLowerCase() + L.spell(L.m(p.female ? 'daughter' : 'son'))); }
          else p.family = cap(L.spell(L.m('of'))) + ' ' + (p.from || vname);
          p.kin = { elder, a1, a2, kids: fam.filter(q => q.stage === 'child') };
        }
      });
      // a history line for each: where they came from and which of the village's few events touches them
      for (const p of people) {
        const { elder, a1, a2 } = p.kin, them = p.female ? 'She' : 'He';
        const bits = [];
        if (p.stage === 'child') { const par = r.chance(0.5) && a2 ? a2 : a1; bits.push(`${par.name}'s ${p.female ? 'daughter' : 'son'}, born ${p.age} years ago in this house.`); if (elder) bits.push(`${elder.name} is ${p.female ? 'her' : 'his'} grandparent.`); }
        else if (p.stage === 'elder') bits.push(p.age > shrineAgo + 10 ? `Old enough to remember ${shrineWhy}, ${shrineAgo} years ago, and the shrine raised after it.` : `Came to ${vname} as a young ${p.female ? 'woman' : 'man'}.`, r.chance(0.5) ? `A grandchild of ${founder}, who cleared the first field ${founded} years ago.` : '');
        else {
          bits.push(p.from ? `Born in ${p.from}; came to ${vname} to marry ${p === a2 ? a1.name : a2?.name || 'and stayed'}.` : `Born in ${vname} ${p.age} years ago.`);
          if (p.job === 'smith') bits.push(`Works the forge built on the stones of the mill that burned ${fireAgo} years ago.`);
          else if (p.job === 'priest') bits.push(`Keeps the shrine raised after ${shrineWhy}.`);
          else if (p.job === 'trader') bits.push(`Walks the east road to sell in the towns, home for market days.`);
          else if (p.job === 'herder') bits.push(`Takes the flock to the west hills by day.`);
          else if (p.age > fireAgo + 8 && r.chance(0.5)) bits.push(`${them} carried water the night the mill burned.`);
        }
        p.story = bits.filter(Boolean).join(' ');
        p.routine = routine(p, vals, r);
      }
      V = { L, vals, people, founded, founder, vname, cache: new Map() };
      sel = people.find(p => p.job === 'trader') || people[0];
      pick.replaceChildren(...people.map(p => Kit.el('option', { value: p.id }, `${p.name} ${p.family}, ${p.job}`)));
      pick.value = sel.id;
      base = paint(r);
      lastInfo = -1;
    }

    // Tyrell routine variants: rest day, market days, other days. Each plan is a list of [hour, place, activity].
    function routine(p, vals, r) {
      const J = JOBS[p.job];
      const wake = J?.wake ?? (p.stage === 'child' ? 7 : p.stage === 'elder' ? 5 : 5 + Math.round(p.lark * 4) / 2);
      const bed = J?.late ? 24 : p.stage === 'child' ? 20 : p.stage === 'elder' ? 21 : Math.min(23, wake + 16);
      const devout = vals.includes('faith') ? p.devout > 0.35 : p.devout > 0.75;
      const supper = vals.includes('kin') ? 18 : 18 + Math.round(p.lark * 2) / 2 - 0.5;
      const evening = p.social > (vals.includes('merriment') ? 0.35 : 0.65) ? ['tavern', 'drink'] : p.social > 0.3 ? ['well', 'chat'] : ['home', '*'];
      const day = (kind) => {
        const plan = [[wake, 'home', 'eat']];
        let t = wake + 0.5;
        if (devout && kind !== 'rest' && !J?.late) { plan.push([t, 'shrine', 'pray']); t += 0.5; }
        if (kind === 'rest') {
          plan.push([Math.max(t, 8), 'home', '*'], [9, 'shrine', 'pray'], [10.5, evening[0] === 'tavern' ? 'well' : evening[0], evening[0] === 'tavern' ? 'chat' : evening[1]], [12.5, 'home', 'eat'], [14, p.stage === 'child' ? 'well' : 'home', p.stage === 'child' ? 'play' : '*']);
        } else if (p.stage === 'child') {
          plan.push([9, kind === 'market' ? 'market' : 'well', 'play'], [12, 'home', 'eat'], [13, 'home', 'chores'], [14.5, 'well', 'play']);
        } else if (p.stage === 'elder') {
          plan.push([Math.max(t, 9), 'well', 'chat'], [11.5, 'home', 'eat'], [13, 'home', 'sleep'], [15, kind === 'market' ? 'market' : 'shrine', kind === 'market' ? 'buy' : 'pray'], [16.5, 'home', '*']);
        } else {
          const work = kind === 'market' && J.market ? J.market : J.work, end = kind === 'market' && J.marketEnd ? J.marketEnd : J.end;
          for (const [h, place, act] of work) plan.push([Math.max(h, t), place, act]);
          // one adult in each house that isn't selling goes to market for an hour
          if (kind === 'market' && !J.market && p === (p.kin.a2 && p.kin.a2.job !== 'trader' ? p.kin.a2 : p.kin.a1)) plan.push([end, 'market', 'buy'], [end + 1, 'home', '*']);
          else if (!J.late) plan.push([end, 'home', '*']);
        }
        if (!J?.late) {
          plan.push([supper, 'home', 'eat']);
          if (p.stage === 'adult' || kind === 'rest') plan.push([supper + 1, ...evening]);
        }
        plan.push([bed, 'home', 'sleep']);
        // keep it in order: an entry that would start before the last one is dropped
        const out = [];
        for (const e of plan.sort((a, b) => a[0] - b[0])) if (!out.length || e[0] > out[out.length - 1][0]) out.push(e); else out[out.length - 1] = e;
        return out.filter(e => e[0] < 24 || e[2] === 'sleep').map(e => [Math.min(e[0], 23.75), e[1], e[2]]);
      };
      return [{ days: [REST], plan: day('rest') }, { days: MARKET, plan: day('market') }, { plan: day('work') }];
    }

    // the day's concrete plan: the routine for that weekday, with a few minutes of seeded slack per entry
    function today(p, d) {
      const key = p.id + ':' + d;
      if (V.cache.has(key)) return V.cache.get(key);
      const wd = d % 7, v = p.routine.find(x => !x.days || x.days.includes(wd));
      let prev = 0;
      const plan = v.plan.map(([h, place, act], k) => {
        const fixed = act === 'pray' && wd === REST || (V.vals.includes('kin') && act === 'eat' && h >= 17);
        let m = h * 60 + (fixed || k === 0 ? 0 : (Kit.hash2(p.id * 31 + k, d, seed) - 0.5) * 24);
        m = Math.max(m, prev + 6); prev = m;
        return { m, place: place === 'home' ? p.home : place === 'porch' ? p.home + ':porch' : place, act };
      });
      if (V.cache.size > 400) V.cache.clear();
      V.cache.set(key, plan);
      return plan;
    }
    const placeOf = id => P[id.split(':')[0]];
    const door = id => placeOf(id).door;
    function route(a, b) {
      const A = door(a), B = door(b);
      if (a === b) return [A, A];
      return [A, [A[0], ROAD], [B[0], ROAD], B];
    }
    const lenOf = pts => { let s = 0; for (let k = 1; k < pts.length; k++) s += Math.abs(pts[k][0] - pts[k - 1][0]) + Math.abs(pts[k][1] - pts[k - 1][1]); return s; };
    function along(pts, d) {
      for (let k = 1; k < pts.length; k++) {
        const s = Math.abs(pts[k][0] - pts[k - 1][0]) + Math.abs(pts[k][1] - pts[k - 1][1]);
        if (d <= s) { const f = s ? d / s : 0; return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f]; }
        d -= s;
      }
      return pts[pts.length - 1];
    }
    // where someone is at a minute: a pure function of the clock, nothing stepped
    function where(p, t) {
      const d = Math.floor(t / 1440), m = t - d * 1440;
      let plan = today(p, d), e = -1;
      for (let k = 0; k < plan.length; k++) if (plan[k].m <= m) e = k;
      let cur, prevPlace, start;
      if (e < 0) { const y = today(p, d - 1); cur = y[y.length - 1]; prevPlace = cur.place; start = -1e9; }
      else { cur = plan[e]; start = d * 1440 + cur.m; prevPlace = e > 0 ? plan[e - 1].place : today(p, d - 1).slice(-1)[0].place; }
      const pts = route(prevPlace, cur.place), len = lenOf(pts), walked = (t - start) * SPEED;
      if (prevPlace !== cur.place && walked < len) return { walking: true, act: 'walk', to: cur.place, xy: along(pts, walked), cur, next: plan[e + 1] };
      const pl = placeOf(cur.place);
      let xy = null;
      if (cur.place.endsWith(':porch')) xy = [pl.door[0] + 6, pl.door[1] + 2];
      else if (pl.spot) { const s = pl.spread; xy = [pl.spot[0] + Math.round((Kit.hash2(p.id, 7, seed) - 0.5) * 2 * s), pl.spot[1] + Math.round((Kit.hash2(p.id, 9, seed) - 0.5) * s * 0.8)]; }
      return { walking: false, act: cur.act, at: cur.place, xy: pl.inside || pl.away ? null : xy, cur, next: plan[e + 1] };
    }

    // ---- painting: the village once, offscreen; people, lit windows and night each frame ----
    function paint(r) {
      const pix = new Kit.Pix(W, H).fill(17);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Kit.hash2(x, y, seed) < 0.06) pix.set(x, y, 18);
      pix.rect(0, ROAD - 3, W, 6, 29); pix.rect(0, ROAD - 3, W, 1, 28); pix.rect(0, ROAD + 2, W, 1, 28);
      pix.rect(75, 19, 4, ROAD - 22, 29);
      for (const k of ['home0', 'home1', 'bakery', 'tavern', 'home2', 'home3']) pix.rect(P[k].door[0] - 1, P[k].door[1], 3, ROAD - 3 - P[k].door[1], 29);
      // field rows, market cobbles and stalls, the well, the smithy's open shed
      const F = P.field;
      pix.rect(F.x, F.y, F.w, F.h, 27);
      for (let y = F.y + 1; y < F.y + F.h - 1; y += 3) for (let x = F.x + 1; x < F.x + F.w - 1; x++) pix.set(x, y, Kit.hash2(x, y, 5) < 0.8 ? 16 : 18);
      const M = P.market;
      pix.rect(M.x, M.y, M.w, M.h, 5);
      for (let y = M.y; y < M.y + M.h; y++) for (let x = M.x; x < M.x + M.w; x++) if ((x + (y >> 1) * 2) % 4 === 0 || y % 2 === 0 && Kit.hash2(x, y, 2) < 0.2) pix.set(x, y, 4);
      [[M.x + 3, 10], [M.x + 15, 22], [M.x + 27, 12]].forEach(([x, c]) => { pix.rect(x - 1, M.y + 2, 12, 6, 0); for (let i = 0; i < 10; i++) pix.rect(x + i, M.y + 3, 1, 3, i % 4 < 2 ? c : 7); pix.rect(x, M.y + 6, 10, 1, 28); });
      pix.rect(40, 72, 9, 7, 0); pix.rect(41, 73, 7, 5, 4); pix.rect(42, 74, 5, 3, 21); pix.rect(40, 69, 1, 4, 0); pix.rect(48, 69, 1, 4, 0); pix.rect(39, 68, 11, 2, 26);
      const S = P.smithy;
      pix.rect(S.x - 1, S.y - 1, S.w + 2, 6, 0); pix.rect(S.x, S.y, S.w, 4, 26); pix.rect(S.x, S.y + 3, S.w, 1, 0);
      pix.rect(S.x, S.y + 4, 2, S.h - 4, 0); pix.rect(S.x + S.w - 2, S.y + 4, 2, S.h - 4, 0); pix.rect(S.x + 2, S.y + 4, S.w - 4, S.h - 6, 2);
      pix.rect(S.x + 4, S.y + 7, 5, 4, 10); pix.rect(S.x + 5, S.y + 8, 3, 2, 12); pix.rect(S.x + 14, S.y + 10, 5, 2, 3);
      // buildings: dark outline, flat roof in two inks, a wall, a door, two windows (lit at night by the frame)
      const house = (k) => {
        const b = P[k], rh = Math.round(b.h * 0.45);
        pix.rect(b.x - 1, b.y - 1, b.w + 2, b.h + 2, 0);
        pix.rect(b.x, b.y, b.w, rh, b.roof); pix.rect(b.x, b.y + rh - 1, b.w, 1, b.roof === 30 ? 1 : b.roof - 1 >= 0 ? b.roof - 1 : 0);
        for (let x = b.x + 2; x < b.x + b.w - 1; x += 3) pix.set(x, b.y + 1 + (x % 2), b.roof === 3 ? 4 : b.roof + 1 > 31 ? 7 : b.roof + 1);
        pix.rect(b.x, b.y + rh, b.w, b.h - rh, k === 'shrine' ? 6 : 7); pix.rect(b.x, b.y + rh, b.w, 1, 0);
        pix.rect(b.door[0] - 1, b.y + b.h - 5, 3, 5, 26);
        b.win = [[b.x + 2, b.y + rh + 3], [b.x + b.w - 5, b.y + rh + 3]];
        if (k !== 'shrine') for (const [x, y] of b.win) { pix.rect(x, y, 3, 3, 0); pix.set(x + 1, y + 1, 2); }
      };
      ['home0', 'home1', 'bakery', 'tavern', 'home2', 'home3', 'shrine'].forEach(house);
      P.shrine.door = [77, 19];
      pix.rect(P.bakery.x + P.bakery.w - 5, P.bakery.y - 4, 3, 5, 0); pix.rect(P.bakery.x + P.bakery.w - 4, P.bakery.y - 3, 1, 3, 4);
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      c.getContext('2d').putImageData(pix.toImage(), 0, 0);
      return c;
    }

    const darkness = h => (h < 4 ? 0.75 : h < 7 ? 0.75 * (7 - h) / 3 : h < 18 ? 0 : h < 21 ? 0.75 * (h - 18) / 3 : 0.75);
    const fmt = m => { const h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60); return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
    const VERB = { eat: 'eating', sleep: 'asleep', pray: 'praying', play: 'playing', chat: 'talking', drink: 'drinking', buy: 'buying', sell: 'selling bread', trade: 'trading', farm: 'working the field', forge: 'at the forge', bake: 'baking', tend: 'tending the shrine', serve: 'serving', travel: 'away selling in the towns', herd: 'with the flock in the hills', weave: 'weaving', chores: 'doing chores', '*': 'at home' };

    function frame() {
      if (!V) return;
      const hour = (minute % 1440) / 60, d = Math.floor(minute / 1440);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.drawImage(base, 0, 0);
      const states = V.people.map(p => ({ p, s: where(p, minute) }));
      // night: a multiply over everything, then lit windows where someone is in and awake
      const dk = darkness(hour);
      if (dk > 0) {
        g.globalCompositeOperation = 'multiply';
        const k = 1 - dk;
        g.fillStyle = `rgb(${Math.round(255 * (0.25 + 0.75 * k))},${Math.round(255 * (0.3 + 0.7 * k))},${Math.round(255 * (0.55 + 0.45 * k))})`;
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'source-over';
        for (const k2 of ['home0', 'home1', 'bakery', 'tavern', 'home2', 'home3']) {
          const awake = states.some(({ s }) => !s.walking && s.at === k2 && s.act !== 'sleep');
          if (awake && P[k2].win) for (const [x, y] of P[k2].win) { g.fillStyle = Kit.PAL[13]; g.fillRect(x + 1, y + 1, 1, 1); g.fillStyle = Kit.PAL[12]; g.fillRect(x + 1, y + 2, 1, 1); }
        }
      }
      // people, back to front
      const vis = states.filter(({ s }) => s.xy).sort((a, b) => a.s.xy[1] - b.s.xy[1]);
      for (const { p, s } of vis) {
        const x = Math.round(s.xy[0]) - 2, y = Math.round(s.xy[1]) - 8;
        villager(g, x, y + (p.stage === 'child' ? 2 : 0), p.look, s.walking ? Math.floor(minute / 3) % 2 : 0);
      }
      // the followed person: a marker over their head, or over the door of where they are inside
      if (sel) {
        const s = states[sel.id].s;
        let mx, my;
        if (s.xy) { mx = Math.round(s.xy[0]); my = Math.round(s.xy[1]) - 11; }
        else if (!placeOf(s.at).away) { const dr = door(s.at); mx = dr[0]; my = dr[1] - 9; }
        if (mx !== undefined && Math.floor(minute / 4) % 4 !== 0) { g.fillStyle = Kit.PAL[0]; g.fillRect(mx - 2, my - 1, 5, 3); g.fillRect(mx - 1, my + 2, 3, 1); g.fillStyle = Kit.PAL[13]; g.fillRect(mx - 1, my, 3, 1); g.fillRect(mx, my + 1, 1, 1); }
      }
      clock.textContent = `${V.vname}, day ${d}: ${DAYS[d % 7]}${MARKET.includes(d % 7) ? ' (market day)' : d % 7 === REST ? ' (rest day)' : ''}, ${fmt(minute)}. Values ${V.vals.join(' and ')}.`;
      if (sel && Math.floor(minute / 10) !== lastInfo) { lastInfo = Math.floor(minute / 10); describe(states[sel.id].s); }
    }

    function describe(s) {
      const p = sel, d = Math.floor(minute / 1440);
      const now = s.walking ? `walking to the ${s.to.replace(/home\d/, 'house').replace(':porch', '')}` : VERB[s.act] || s.act;
      const nxt = s.next ? ` Next, at ${fmt(s.next.m)}: ${VERB[s.next.act] || s.next.act}.` : '';
      info.replaceChildren(Kit.el('b', {}, `${p.name} ${p.family}`), ` ("${p.gloss}"), ${p.age}, ${p.job === 'child' ? 'a child' : p.job === 'elder' ? 'an elder' : 'the ' + p.job}. Now ${now}.${nxt} `, Kit.el('span', { style: 'opacity:.75' }, p.story));
      // today's plan as a strip: one pixel per 15 minutes, the clock's place marked
      const pix = new Kit.Pix(96, 5).fill(1), plan = today(p, d);
      for (let k = 0; k < plan.length; k++) {
        const a = Math.floor(plan[k].m / 15), b = k + 1 < plan.length ? Math.floor(plan[k + 1].m / 15) : 96;
        const ink = ACT_INK[plan[k].act] ?? (plan[k].act === '*' || plan[k].act === 'chores' ? 3 : WORKINK);
        pix.rect(a, 0, Math.max(1, b - a), 4, ink);
      }
      const nowX = Math.floor((minute % 1440) / 15);
      pix.rect(nowX, 0, 1, 5, 7);
      bar.put(pix);
      const wd = d % 7;
      code.textContent = `world.person('${p.name.toLowerCase()}', { home: '${p.home}', routine: [\n` + p.routine.map(v => {
        const head = v.days ? `days: [${v.days}], ` : '';
        const on = !v.days || v.days.includes(wd) ? (v.days ? v.days.includes(wd) : !p.routine.some(x => x.days && x.days.includes(wd))) : false;
        return `  { ${head}plan: [${v.plan.map(e => `[${+e[0].toFixed(2)}, '${e[1]}', '${e[2]}']`).join(', ')}] },${on ? '   // today' : ''}`;
      }).join('\n') + '\n] });';
    }

    cv.cv.addEventListener('click', e => {
      if (!V) return;
      const [x, y] = cv.at(e);
      let best = null, bd = 60;
      for (const p of V.people) { const s = where(p, minute); if (!s.xy) continue; const dd = (s.xy[0] - x) ** 2 + (s.xy[1] - 4 - y) ** 2; if (dd < bd) { bd = dd; best = p; } }
      if (best) { sel = best; pick.value = best.id; lastInfo = -1; }
    });

    Kit.loop(host, dt => { minute += dt * speed; }, frame, 30);
    build();
    frame();
  });
})();
