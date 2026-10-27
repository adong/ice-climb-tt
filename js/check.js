/* TT Ice Climb: the headless check of the brief's rules, on the real rules in js/sim.js (no drawing).
   Runs in node (node tools/check.js) and in the page (game.check()).
   - autopilotEasy: the autopilot climbs every mountain on 🐣 EASY (3 seeds each) and grabs the giant vegetable, and
     plays a whole game of all 8 mountains in one go.
   - jumpBreaksOnlyAbove: on every layer of every mountain, a jump under ice breaks exactly the one block right above the
     head, even when the head pokes under the next block too; under a hole nothing breaks and you hop up; hard snow stays.
   - scrollsUpOnly: the screen never scrolls down, in long autopilot games (1 and 2 players, both levels) and when a
     climber drops down three layers.
   - lowerNeverStuck: in 2 players the screen follows the higher climber, and the lower one (standing still, or mashing
     keys) is never off the screen without a bubble carrying him up, and every bubble lands him on the screen.
   - plus the companion's row smash, holes staying open on EASY (and seals refilling them on NORMAL), clouds carrying
     you, bumps and bonks, the bonus stage and lives.
   fail() turns on one sabotage at a time (see w.sab in js/sim.js and js/bot.js) and each must be caught by its check. */
(function (root) {
  'use strict';
  const IC = (root.IC = root.IC || {});
  const S = () => IC.sim;
  const MT = () => IC.mountains;

  function world(m, o) {
    const w = S().create(Object.assign({ level: 'easy', seed: 5, mountain: m, go: true }, o || {}));
    w.sealT = w.birdT = 1e9; // no seals or birds unless a check wants them
    return w;
  }
  function place(w, k, x, i) {
    const p = w.players[i || 0];
    Object.assign(p, { x, y: k * S().L, vx: 0, vy: 0, mode: 'ground', sup: S().supportAt(w, x, k, S().FW) || { k: 'g', f: k }, dizzy: 0, inv: 0, bub: null });
    return p;
  }
  const snap = (w) => w.grid.map((r) => r.slice());
  function diff(a, b) {
    const out = [];
    for (let k = 0; k < a.length; k++) for (let c = 0; c < a[k].length; c++) if (a[k][c] !== b[k][c]) out.push([k, c, a[k][c], b[k][c]]);
    return out;
  }
  // the autopilot plays (both players in 2P unless a player has its own input function)
  function autoplay(w, secs, o) {
    o = o || {};
    const stop = o.until || ((ww) => ww.phase === 'clear' || ww.phase === 'won' || ww.phase === 'over');
    let lost = 0;
    const start = w.t;
    while (w.t - start < secs) {
      const ins = w.players.map((p, i) => (o.inputs && o.inputs[i] ? o.inputs[i](w, i) : IC.bot.decide(w, i)));
      S().step(w, ins);
      for (const e of w.events) if (e.type === 'hit') lost++;
      if (o.each && o.each(w) === false) break;
      if (stop(w)) break;
    }
    return { phase: w.phase, t: +(w.t - start).toFixed(1), lost, got: w.big.got, hi: w.hiLayer };
  }

  const checks = {
    autopilotEasy(sab) {
      const bad = [];
      let n = 0, t = 0;
      for (let m = 0; m < MT().count; m++) {
        for (const seed of [3, 7, 19]) {
          const w = S().create({ level: 'easy', seed, mountain: m, go: true, sabotage: sab });
          const r = autoplay(w, 240);
          n++;
          t += r.t;
          if (!(r.phase === 'clear' && r.got)) bad.push(`${w.D.id} seed ${seed}: ${r.phase} at layer ${r.hi} after ${r.t} s`);
        }
      }
      // all 8 in one go, with the mountain-to-mountain changes
      const w = S().create({ level: 'easy', seed: 11, go: true, sabotage: sab });
      let got = 0;
      const r = autoplay(w, 8 * 240, { until: (ww) => ww.phase === 'won' || ww.phase === 'over', each: (ww) => { for (const e of ww.events) if (e.type === 'bigVeg') got++; } });
      if (r.phase !== 'won' || got !== 8) bad.push(`whole game: ${r.phase} on ${w.D.id}, ${got} giant vegetables`);
      return [!bad.length, bad.length ? bad.slice(0, 4).join('; ') : `climbed ${n} mountain runs (avg ${(t / n).toFixed(0)} s each) and the whole game (${r.t} s, ${got} vegetables, ${w.players[0].score} points)`];
    },

    jumpBreaksOnlyAbove(sab) {
      const bad = [];
      let breaks = 0, holes = 0, hard = 0;
      for (let m = 0; m < MT().count; m++) {
        const D = MT().get(m);
        for (let f = 0; f < MT().ICE_TOP; f++) {
          const cols = [];
          for (let c = 0; c < S().COLS; c++) if (D.rows[f][c] > 0) cols.push(c);
          for (const c of cols) {
            for (const off of [-0.32, 0, 0.32]) {
              const w = world(m, { sabotage: sab });
              const x = S().X0 + c + 0.5 + off;
              if (!S().supportAt(w, x, f, S().FW)) continue;
              const above = S().cell(w, f + 1, c);
              if (above === 0 && !S().solid(w, f + 1, c - 1) && !S().solid(w, f + 1, c + 1) && !w.clouds.some((cl) => cl.k === f + 1)) continue;
              const p = place(w, f, x);
              const g0 = snap(w);
              autoplay(w, 3, { inputs: [(ww) => (ww.t < 0.02 ? { jump: true } : {})], until: (ww) => ww.t > 0.1 && p.mode === 'ground' });
              const d = diff(g0, w.grid);
              const land = p.sup.f;
              if (above === 1 || above === 3) {
                breaks++;
                if (!(d.length === 1 && d[0][0] === f + 1 && d[0][1] === c && w.grid[f + 1][c] === 0)) bad.push(`${D.id} layer ${f} col ${c} ${off}: broke ${JSON.stringify(d.map((q) => q.slice(0, 2)))}`);
                if (land !== f) bad.push(`${D.id} layer ${f} col ${c}: after the bonk he landed on layer ${land}`);
              } else if (above === 0) {
                holes++;
                if (d.length) bad.push(`${D.id} layer ${f} col ${c} ${off}: a jump through a hole broke ${d.length}`);
                if (land !== f + 1 && !w.clouds.some((cl) => cl.k === f + 1 && cl.v)) bad.push(`${D.id} layer ${f} col ${c} ${off}: hopped up the hole but landed on ${land}`);
              } else {
                hard++;
                if (d.length) bad.push(`${D.id} layer ${f} col ${c}: hard snow broke`);
              }
            }
          }
        }
      }
      return [!bad.length && breaks > 300, bad.length ? bad.slice(0, 4).join('; ') + ` (${bad.length} wrong)` : `${breaks} jumps under ice each broke just the block above, ${holes} hops up holes broke nothing, ${hard} under hard snow broke nothing`];
    },

    scrollsUpOnly(sab) {
      const bad = [];
      let ticks = 0;
      const watch = (label) => {
        let last = null, mi = -1;
        return (w) => {
          ticks++;
          if (w.mi !== mi) { mi = w.mi; last = w.camY; return; }
          if (w.camY < last - 1e-9) { bad.push(`${label} ${w.D.id}: the screen went down ${last.toFixed(2)}→${w.camY.toFixed(2)}`); return false; }
          last = w.camY;
        };
      };
      for (const [level, two] of [['easy', false], ['normal', false], ['easy', true], ['normal', true]]) {
        const w = S().create({ level, seed: 23, go: true, sabotage: sab, players: two ? ['teddy', 'tommy'] : ['teddy'] });
        autoplay(w, 8 * 200, { until: (ww) => ww.phase === 'won' || ww.phase === 'over', each: watch(`${level}${two ? ' 2P' : ''}`) });
      }
      // a climber drops three layers: the screen stays where it was, and the bubble brings him back up
      const w = world(0, { sabotage: sab });
      autoplay(w, 60, { until: (ww) => ww.hiLayer >= 5 && ww.players[0].mode === 'ground' });
      for (let i = 0; i < 120; i++) S().step(w, {});
      const p = w.players[0], cam = w.camY, c = S().colOf(p.x);
      for (let k = 1; k <= p.sup.f; k++) for (let d = -3; d <= 3; d++) S().setCell(w, k, c + d, 0); // wider than the landing help reaches
      let low = Infinity, bubbled = false;
      for (let i = 0; i < 360; i++) { S().step(w, {}); low = Math.min(low, w.camY); if (p.mode === 'bubble') bubbled = true; }
      if (low < cam - 1e-9) bad.push(`after a fall the screen went down ${cam.toFixed(2)}→${low.toFixed(2)}`);
      if (!bubbled || p.mode !== 'ground' || p.y < w.camY) bad.push(`after a fall: bubble ${bubbled}, ${p.mode} at ${p.y.toFixed(1)} (screen ${w.camY.toFixed(1)})`);
      return [!bad.length, bad.length ? bad.slice(0, 3).join('; ') : `${ticks} steps of 1 and 2 player games on both levels never scrolled down; a 3-layer drop left the screen still and the bubble brought him back`];
    },

    lowerNeverStuck(sab) {
      const bad = [];
      let bubbles = 0, runs = 0, worst = 0;
      let seed = 41;
      const mash = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const idle = () => ({});
      const masher = () => ({ lr: mash() < 0.3 ? -1 : mash() < 0.5 ? 1 : 0, jump: mash() < 0.08, swing: mash() < 0.05 });
      const setups = [['easy', [null, idle]], ['easy', [idle, null]], ['easy', [null, masher]], ['normal', [null, idle]], ['normal', [null, masher]]];
      for (const [level, inputs] of setups) {
        for (let m = 0; m < MT().count; m += level === 'easy' ? 1 : 2) {
          const w = S().create({ level, seed: 9 + m, mountain: m, go: true, sabotage: sab, players: ['teddy', 'tommy'] });
          const off = [0, 0];
          runs++;
          const r = autoplay(w, 200, {
            inputs,
            each: (ww) => {
              ww.players.forEach((p, i) => {
                if (p.out) return;
                for (const e of ww.events) if (e.type === 'bubble' && e.who === i) bubbles++;
                const seen = p.y + S().PH > ww.camY && p.y < ww.camY + S().VIEW_H;
                if (seen && p.mode !== 'bubble') off[i] = 0;
                else off[i] += S().DT;
                worst = Math.max(worst, off[i]);
                if (off[i] > 6) { bad.push(`${level} ${ww.D.id} ${p.who}: ${p.mode} off the screen for 6 s (y ${p.y.toFixed(1)}, screen ${ww.camY.toFixed(1)})`); off[i] = -1e9; }
                if (p.mode !== 'bubble' && !seen && p.y + S().PH < ww.camY - 0.2) { bad.push(`${level} ${ww.D.id} ${p.who}: below the screen without a bubble`); off[i] = -1e9; }
              });
            },
          });
          if (r.phase !== 'clear') bad.push(`${level} ${w.D.id}: the climb ended ${r.phase} at layer ${r.hi}`);
        }
      }
      return [!bad.length && bubbles > 10, bad.length ? bad.slice(0, 3).join('; ') : `${runs} 2-player climbs: ${bubbles} bubbles all brought the lower brother back up (longest time off the screen ${worst.toFixed(1)} s, in his bubble)`];
    },

    companionBreaksRow(sab) {
      const bad = [];
      let rows = 0;
      for (const m of [0, 3, 7]) {
        for (const f of [0, 2]) {
          const w = world(m, { sabotage: sab });
          const D = w.D;
          const x = S().X0 + D.rows[f].findIndex((v, c) => v > 0 && S().cell(w, f + 1, c) !== 0 && c > 2) + 0.5;
          place(w, f, x);
          const g0 = snap(w);
          const s0 = w.players[0].score;
          if (!S().call(w)) { bad.push(`${D.id}: call refused`); continue; }
          if (S().call(w)) bad.push(`${D.id}: a second call before he smashed was taken`);
          const evs = [];
          autoplay(w, 2.0, { inputs: [() => ({})], until: () => false, each: (ww) => { evs.push(...ww.events.map((e) => e.type)); } });
          const d = diff(g0, w.grid);
          const want = g0[f + 1].map((v, c) => (v === 1 || v === 3 ? c : -1)).filter((c) => c >= 0);
          const broke = d.filter((q) => q[0] === f + 1 && q[3] === 0).map((q) => q[1]);
          const other = d.filter((q) => q[0] !== f + 1);
          if (broke.length !== want.length || other.length || d.some((q) => q[2] === 2)) bad.push(`${D.id} layer ${f}: broke ${broke.length} of ${want.length} ice blocks in the row above, ${other.length} elsewhere`);
          if (!evs.includes('treat') || !evs.includes('smash') || w.players[0].score < s0 + 100) bad.push(`${D.id}: no treat or smash (${evs.join(',')})`);
          if (w.buddy) bad.push(`${D.id}: still visiting after 2 s`);
          if (!S().call(w)) bad.push(`${D.id}: he can't be called again`);
          rows++;
        }
      }
      return [!bad.length, bad.length ? bad.slice(0, 3).join('; ') : `${rows} calls: each time he tossed a treat and broke every ice block in the row above (hard snow left), and could be called again`];
    },

    holesStayOpenOnEasy(sab) {
      const res = {};
      for (const level of ['easy', 'normal']) {
        const w = S().create({ level, seed: 13, mountain: 0, go: true, sabotage: sab, cfg: { sealGap: [1, 2], maxSeals: 2 } });
        w.birdT = 1e9;
        w.players[0].inv = 1e9;
        const g0 = snap(w);
        let fills = 0, seals = 0;
        autoplay(w, 120, { inputs: [() => ({})], until: () => false, each: (ww) => { for (const e of ww.events) { if (e.type === 'fill') fills++; if (e.type === 'sealIn') seals++; } } });
        const refilled = diff(g0, w.grid).filter((q) => q[2] === 0 && q[3] > 0).length;
        res[level] = { fills, seals, refilled };
      }
      const ok = res.easy.seals > 5 && res.easy.fills === 0 && res.easy.refilled === 0 && res.normal.fills > 0 && res.normal.refilled > 0;
      return [ok, `EASY: ${res.easy.seals} seals, ${res.easy.refilled} holes refilled; NORMAL: ${res.normal.seals} seals pushed ice into ${res.normal.refilled} holes`];
    },

    cloudsCarry() {
      const bad = [];
      const w = world(1);
      const cl = w.clouds.find((c) => c.v && c.k <= MT().ICE_TOP);
      cl.x = 0;
      const p = place(w, cl.k, 0);
      if (p.sup.k !== 'c') bad.push('not on the cloud');
      const x0 = p.x, c0 = cl.x;
      autoplay(w, 1, { inputs: [() => ({})], until: () => false });
      if (Math.abs((p.x - x0) - (cl.x - c0)) > 0.01 || p.mode !== 'ground') bad.push(`rode ${(p.x - x0).toFixed(2)} while the cloud went ${(cl.x - c0).toFixed(2)}`);
      const a = p.x - cl.x;
      autoplay(w, 0.3, { inputs: [() => ({ lr: 1 })], until: () => false });
      if (!(p.x - cl.x > a + 0.6)) bad.push('could not walk on the cloud');
      // and jumping up through a cloud from below lands on top of it
      const w2 = world(0);
      const st = w2.clouds.find((c) => c.k === 9 && !c.v);
      const q = place(w2, 8, st.x);
      if (q.sup.k !== 'g') { w2.grid[8][S().colOf(st.x)] = 2; place(w2, 8, st.x); }
      autoplay(w2, 2, { inputs: [(ww) => (ww.t < 0.02 ? { jump: true } : {})], until: (ww) => ww.t > 0.1 && ww.players[0].mode === 'ground' });
      if (!(w2.players[0].sup.k === 'c' && w2.players[0].sup.f === 9)) bad.push('jumping up through a cloud did not land on it');
      return [!bad.length, bad.length ? bad.join('; ') : 'a drifting cloud carries you, you can walk on it, and you can jump up through a cloud and land on it'];
    },

    bumpsAndBonks() {
      const bad = [];
      // a seal bump: dizzy and a life
      let w = world(0);
      let p = place(w, 1, -5.5);
      w.seals.push({ id: 99, k: 1, x: -4.9, dir: -1, carry: false, st: 'walk', t: 0, life: 20, vy: 0, y: S().L, wait: 0, home: 1 });
      autoplay(w, 0.3, { inputs: [() => ({})], until: () => false });
      if (!(p.lives === w.cfg.lives - 1 && p.dizzy > 0)) bad.push(`seal bump: lives ${p.lives}, dizzy ${p.dizzy.toFixed(2)}`);
      // a swing bonks it instead
      w = world(0);
      p = place(w, 1, -5.5);
      p.face = 1;
      w.seals.push({ id: 98, k: 1, x: -4.4, dir: -1, carry: false, st: 'walk', t: 0, life: 20, vy: 0, y: S().L, wait: 0, home: 1 });
      autoplay(w, 0.5, { inputs: [(ww) => (ww.t < 0.1 ? { swing: true } : {})], until: () => false });
      if (!(p.lives === w.cfg.lives && w.seals.every((s) => s.st !== 'walk') && p.score >= 400)) bad.push(`swing: lives ${p.lives}, seal ${w.seals.map((s) => s.st)}, score ${p.score}`);
      // a jump into a bird bonks it
      w = world(0);
      p = place(w, 0, 0.5);
      w.grid[1][8] = 0;
      w.birds.push({ id: 97, x: 0.5, y: 2.0, ty: 2.0, vx: 0, t: 0, st: 'fly', turns: 0, vy: 0 });
      autoplay(w, 0.6, { inputs: [(ww) => (ww.t < 0.02 ? { jump: true } : {})], until: () => false });
      if (!(w.birds.every((b) => b.st !== 'fly') && p.lives === w.cfg.lives)) bad.push(`head bonk: bird ${w.birds.map((b) => b.st)}, lives ${p.lives}`);
      // the brother's visit keeps you safe
      w = world(0);
      p = place(w, 1, -5.5);
      S().call(w);
      w.seals.push({ id: 96, k: 1, x: -4.9, dir: -1, carry: false, st: 'walk', t: 0, life: 20, vy: 0, y: S().L, wait: 0, home: 1 });
      autoplay(w, 0.5, { inputs: [() => ({})], until: () => false });
      if (p.lives !== w.cfg.lives) bad.push('bumped while his brother was there');
      return [!bad.length, bad.length ? bad.join('; ') : 'a seal bump costs a life and makes you dizzy, a swing or a jump bonks seals and birds away, and nothing bumps you while your brother visits'];
    },

    bonusStage() {
      const bad = [];
      const w = world(2);
      const summit = w.clouds.find((c) => c.summit);
      w.hiLayer = MT().TOP;
      w.bonus.on = true;
      place(w, MT().TOP, summit.x);
      const r = autoplay(w, 40);
      if (!(r.phase === 'clear' && r.got)) bad.push(`veg: ${r.phase} got ${r.got}`);
      const w2 = world(2);
      place(w2, MT().TOP, 0);
      w2.hiLayer = MT().TOP;
      w2.bonus.on = true;
      w2.bonus.t = 1;
      let up = false;
      autoplay(w2, 3, { inputs: [() => ({})], each: (ww) => { if (ww.events.some((e) => e.type === 'timeUp')) up = true; } });
      if (!(up && w2.phase === 'clear' && !w2.big.got)) bad.push('the timer ran out but the mountain did not end');
      // landing on the top ice layer starts the bonus timer and sends the baddies away
      const w3 = world(0);
      w3.seals.push({ id: 95, k: 8, x: 5, dir: -1, carry: false, st: 'walk', t: 0, life: 20, vy: 0, y: 8 * S().L, wait: 0, home: 1 });
      const p3 = place(w3, 7, -2.5);
      w3.grid[8][S().colOf(-2.5)] = 0;
      autoplay(w3, 2, { inputs: [(ww) => (ww.t < 0.02 ? { jump: true } : {})], until: (ww) => ww.bonus.on });
      if (!(w3.bonus.on && w3.seals.every((s) => s.st !== 'walk') && p3.sup.f === 8)) bad.push(`top layer: bonus ${w3.bonus.on}, seals ${w3.seals.map((s) => s.st)}`);
      return [!bad.length, bad.length ? bad.join('; ') : 'grabbing the giant vegetable ends the mountain with points, the timer running out ends it without, and the bonus starts on the top layer'];
    },

    livesAndFalls() {
      const bad = [];
      for (const level of ['easy', 'normal']) {
        const w = world(0, { level });
        autoplay(w, 60, { until: (ww) => ww.hiLayer >= 4 && ww.players[0].mode === 'ground' && ww.players[0].sup.k === 'g' });
        for (let i = 0; i < 150; i++) S().step(w, {}); // the screen catches up
        const p = w.players[0];
        const lives = p.lives, c = S().colOf(p.x);
        for (let k = 1; k <= p.sup.f; k++) for (let d = -3; d <= 3; d++) S().setCell(w, k, c + d, 0);
        p.x = S().X0 + c + 0.5;
        p.mode = 'air';
        autoplay(w, 5, { inputs: [() => ({})], until: () => false });
        const want = level === 'easy' ? lives : lives - 1;
        if (p.lives !== want || p.mode !== 'ground') bad.push(`${level}: a fall off the bottom left ${p.lives} lives (want ${want}), ${p.mode}`);
      }
      const w = world(0, { level: 'normal' });
      const p = w.players[0];
      p.lives = 1;
      place(w, 1, -5.5);
      w.seals.push({ id: 94, k: 1, x: -4.9, dir: -1, carry: false, st: 'walk', t: 0, life: 20, vy: 0, y: S().L, wait: 0, home: 1 });
      autoplay(w, 1, { inputs: [() => ({})] });
      if (w.phase !== 'over') bad.push(`the last life went but the game is ${w.phase}`);
      return [!bad.length, bad.length ? bad.join('; ') : 'a fall off the bottom costs nothing on EASY and a life on NORMAL, and the last life ends the game'];
    },
  };

  const SABOTAGE = [
    ['lazyBot', 'autopilotEasy', 'the autopilot stands still'],
    ['breakRow', 'jumpBreaksOnlyAbove', 'a jump breaks three blocks'],
    ['scrollDown', 'scrollsUpOnly', 'the screen follows the lowest climber, down too'],
    ['noBubble', 'lowerNeverStuck', 'the bubble never carries anybody up'],
    ['noBuddyBreak', 'companionBreaksRow', "the brother's smash breaks nothing"],
    ['easyFill', 'holesStayOpenOnEasy', 'seals push ice into holes on EASY too'],
  ];

  IC.check = {
    names: Object.keys(checks),
    run(only) {
      const results = [];
      for (const name of Object.keys(checks)) {
        if (only && !only.includes(name)) continue;
        let ok, info;
        try { [ok, info] = checks[name](); } catch (e) { ok = false; info = 'threw ' + ((e && e.stack) || e); }
        results.push({ name, ok, info });
      }
      return { ok: results.every((r) => r.ok), results, failed: results.filter((r) => !r.ok).map((r) => r.name) };
    },
    fail() {
      const caught = SABOTAGE.map(([sab, name, what]) => {
        let ok, info;
        try { [ok, info] = checks[name](sab); } catch (e) { ok = false; info = 'threw ' + e; }
        return { sabotage: sab, check: name, what, caught: !ok, failed: [info] };
      });
      return { ok: caught.every((c) => c.caught), caught };
    },
    autoplay,
  };
})(typeof window !== 'undefined' ? window : globalThis);
