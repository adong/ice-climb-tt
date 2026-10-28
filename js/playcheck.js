/* TT Ice Climb: the play check with real keys and taps, in the page: game.playCheck().
   Everything here presses keys with real keydown/keyup events on window and taps the touch pads with pointer events,
   so it goes through the same input code a kid's fingers do (never the autopilot). Time moves with game.step, which
   runs the same frame code as the browser's own frames. Positions are read on the screen.
   - direction: → moves right and ← moves left on screen on every mountain, on an ice layer and on the summit cloud, for
     Teddy, Tommy and both brothers in 2 players (A D and ← →), with keys and with the touch pads; the jump goes up the
     screen and lands; the swing key swings.
   - nothing leaves him stuck: dizzy after a bump, the bubble after dropping off the screen, a drifting cloud, his
     brother's visit, a key held through pause, a jump up a hole with a key held, 2 players each on his own keys, and a
     "keyboard kid" mashing keys on every mountain with seals and birds about.
   game.playCheck('mirror') and game.playCheck('stuckDizzy') prove the check fails when the controls are wrong. */
(function () {
  'use strict';
  const S = IC.sim;
  const NAMES = { ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', Space: ' ', KeyT: 't', KeyP: 'p', KeyA: 'a', KeyD: 'd', KeyW: 'w', KeyS: 's', KeyX: 'x' };
  const key = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: NAMES[code] || code, bubbles: true, cancelable: true }));
  const step = (s) => game.step(s, { draw: false });
  const st = () => game.state();
  function press(code, secs) {
    key(code, true);
    step(secs);
    key(code, false);
    step(1 / 60);
  }
  function tap(p, k, secs) {
    const el = k === 'call' ? document.querySelector('#touch [data-k="call"]') : document.querySelector(`#touch [data-p="${p}"][data-k="${k}"]`);
    const o = { pointerId: 11 + p, bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    step(secs);
    el.dispatchEvent(new PointerEvent('pointerup', o));
    step(1 / 60);
  }
  function fresh(mi, o) {
    game.start(Object.assign({ mountain: mi, go: true, level: 'easy', players: 1, who: 'teddy' }, o || {}));
    game.quiet();
    return st();
  }
  // a spot on layer k with solid ice for 2 blocks each way (or the middle of a still cloud)
  function roomy(k, skip) {
    const w = game.world();
    for (let c = 2; c < S.COLS - 2; c++) {
      const x = S.X0 + c + 0.5;
      if (skip && Math.abs(x - skip) < 5) continue;
      let ok = true;
      for (let d = -2; d <= 2; d++) if (!S.solid(w, k, c + d)) ok = false;
      if (ok) return x;
    }
    return null;
  }
  const keysFor = (players, i) => (players === 2 ? (i ? { r: 'ArrowRight', l: 'ArrowLeft', jump: 'ArrowUp', swing: 'ArrowDown' } : { r: 'KeyD', l: 'KeyA', jump: 'KeyW', swing: 'KeyS' }) : { r: 'ArrowRight', l: 'ArrowLeft', jump: 'Space', swing: 'KeyX' });
  const inBlock = (p) => !!S.bodyHitsGrid(game.world(), p.x, p.y);

  function run(sab) {
    const results = [];
    const ok = (name, pass, info) => results.push({ name, ok: !!pass, info });
    const wasHold = game.G.hold;
    game.hold(true);
    const hadTouch = document.body.classList.contains('touch');
    game.sabotage(sab || null);
    try {
      // ---------- direction on every mountain, on the ice and on the summit, keys and touch ----------
      const setups = [['teddy', 1], ['tommy', 1], ['teddy', 2]];
      for (let mi = 0; mi < IC.mountains.count; mi++) {
        for (const [who, players] of setups) {
          for (const how of ['keys', 'touch']) {
            document.body.classList.toggle('touch', how === 'touch');
            fresh(mi, { who, players });
            const w = game.world();
            const tag = `${w.D.id} ${players === 2 ? '2P' : who} ${how}`;
            // jump first, on the ground (the screen hasn't moved yet): up the screen and back down; the swing key swings
            {
              const i = players === 2 ? 1 : 0, K = keysFor(players, i);
              if (players === 2) game.put(0, 0, -6.5);
              game.put(i, 0, roomy(0, players === 2 ? -6.5 : null) || 2.5);
              step(0.05);
              const j0 = st().players[i];
              if (how === 'keys') press(K.jump, 0.05); else tap(i, 'jump', 0.05);
              step(0.15);
              const j1 = st().players[i];
              step(1.6);
              const j2 = st().players[i];
              const sw0 = st().sfx.swing || 0;
              if (how === 'keys') press(K.swing, 0.05); else tap(i, 'swing', 0.05);
              const sw1 = st().sfx.swing || 0;
              ok(`jump+swing ${tag}`, j1.sy < j0.sy - 20 && j2.mode === 'ground' && sw1 > sw0, `${j0.sy}→${j1.sy}→${j2.sy} px (${j2.mode}), swings ${sw0}→${sw1}`);
            }
            // then walking: on an ice layer (layer 2, or the next one with room) and on the summit cloud
            let k = 2;
            while (k < 8 && roomy(k) === null) k++;
            const summit = w.clouds.find((c) => c.summit);
            for (const spot of ['ice', 'summit']) {
              for (let i = 0; i < players; i++) {
                const K = keysFor(players, i);
                const at = spot === 'ice' ? [k, roomy(k)] : [IC.mountains.TOP, summit.x];
                if (players === 2) {
                  // the other brother stands on the same layer, out of the way
                  if (spot === 'ice') {
                    let ox = roomy(k, at[1]);
                    if (ox === null) for (let c = 0; c < S.COLS && ox === null; c++) if (S.solid(w, k, c) && Math.abs(S.X0 + c + 0.5 - at[1]) > 3.5) ox = S.X0 + c + 0.5;
                    game.put(1 - i, k, ox);
                  } else game.put(1 - i, IC.mountains.TOP, i ? -6.8 : 6.8);
                }
                const go = (dir) => {
                  game.put(i, at[0], at[1]);
                  step(0.05);
                  const a = st().players[i], other = players === 2 ? st().players[1 - i] : null;
                  if (how === 'keys') press(K[dir], 0.45); else tap(i, dir, 0.45);
                  const b = st().players[i], ob = players === 2 ? st().players[1 - i] : null;
                  return { moved: b.sx - a.sx, x: b.x - a.x, alone: !other || Math.abs(ob.sx - other.sx) < 2 };
                };
                const r = go('r'), l = go('l');
                const right = r.moved > 25 && r.x > 0 && r.alone, left = l.moved < -25 && l.x < 0 && l.alone;
                ok(`dir ${tag} ${spot}${players === 2 ? ' ' + (i ? 'tommy' : 'teddy') : ''}`, right && left, `→ ${right ? 'right' : 'WRONG'} (${r.moved} px), ← ${left ? 'left' : 'WRONG'} (${l.moved} px)${r.alone && l.alone ? '' : ', moved the other brother too'}`);
              }
            }
          }
        }
      }
      document.body.classList.toggle('touch', hadTouch);

      // ---------- nothing leaves him stuck ----------
      // a seal bump: dizzy, then the keys work again
      fresh(0);
      let w = game.world();
      game.put(0, 1, -5.5);
      w.seals.push({ id: 901, k: 1, x: -4.9, dir: -1, carry: false, st: 'walk', t: 0, life: 20, vy: 0, y: S.L, wait: 0, home: 1 });
      step(0.2);
      const d0 = st().players[0];
      step(4);
      game.quiet();
      game.put(0, 1, roomy(1));
      let a = st().players[0];
      press('ArrowRight', 0.4);
      let b = st().players[0];
      press('Space', 0.05);
      step(0.2);
      const c = st().players[0];
      ok('after a bump', d0.dizzy > 0 && b.sx > a.sx + 20 && c.sy < b.sy - 15, `dizzy ${d0.dizzy}, then → ${b.sx - a.sx} px, jump ${b.sy}→${c.sy}`);

      // off the bottom of the screen: the bubble brings him back, then the keys work
      fresh(0);
      w = game.world();
      game.put(0, 1, roomy(1));
      w.hiLayer = 5;
      const pops0 = st().sfx.pop || 0, camTo = (w.hiLayer - 1) * S.L - 0.6;
      let popped = false;
      for (let n = 0; n < 80 && !(popped && st().camY >= camTo - 1e-3 && st().players[0].mode === 'ground'); n++) { step(0.1); if ((st().sfx.pop || 0) > pops0) popped = true; }
      step(0.3);
      const p0 = st();
      a = p0.players[0];
      press('ArrowRight', 0.35);
      b = st().players[0];
      press('ArrowLeft', 0.35);
      const c2 = st().players[0];
      ok('after the bubble', popped && a.mode === 'ground' && a.y >= p0.camY && b.sx > a.sx + 15 && c2.sx < b.sx - 15, `popped ${popped}, ${a.mode} at y ${a.y} (screen ${p0.camY}), → ${b.sx - a.sx} px, ← ${c2.sx - b.sx} px`);

      // a drifting cloud: walk on it, walk off it onto the ice beside it, jump from it
      fresh(1);
      w = game.world();
      const cl = w.clouds.find((q) => q.v && q.k <= 8);
      cl.x = cl.x0;
      cl.v = Math.abs(cl.v);
      game.put(0, cl.k, cl.x);
      const onCloud = st().players[0].sup === 'c' + cl.k;
      a = st().players[0];
      key('ArrowLeft', true);
      let off = false;
      for (let n = 0; n < 40 && !off; n++) { step(0.05); const q = st().players[0]; if (q.sup === 'g' + cl.k) off = true; }
      key('ArrowLeft', false);
      step(0.05);
      b = st().players[0];
      ok('cloud', onCloud && off && b.sx < a.sx - 20 && b.mode === 'ground', `on the cloud ${onCloud}, walked off onto the ice ${off} (${b.sup}), ← ${b.sx - a.sx} px`);

      // his brother's visit: the keys still work while he smashes the row
      fresh(0);
      game.put(0, 0, roomy(0));
      press('KeyT', 0.05);
      step(0.5);
      a = st();
      press('ArrowRight', 0.35);
      b = st();
      step(1.5);
      const tc = (fresh(0), game.put(0, 0, roomy(0)), document.body.classList.add('touch'), tap(0, 'call', 0.05), st().buddy);
      document.body.classList.toggle('touch', hadTouch);
      ok('brother visiting', a.buddy && b.players[0].sx > a.players[0].sx + 15 && tc && tc.kind === 'smash', `buddy ${a.buddy && a.buddy.who}, → ${b.players[0].sx - a.players[0].sx} px, touch call ${tc && tc.kind}`);

      // a key held through pause: no runaway walking afterwards
      fresh(0);
      game.put(0, 0, roomy(0));
      key('ArrowRight', true);
      step(0.2);
      press('KeyP', 0.05);
      key('ArrowRight', false);
      press('KeyP', 0.05);
      a = st().players[0];
      step(0.5);
      b = st().players[0];
      ok('key held through pause', !st().paused && Math.abs(b.sx - a.sx) < 2, `after resume it moved ${b.sx - a.sx} px with no key held`);

      // a jump up a hole with → held all the way: he comes out on top, never inside the ice
      let holes = 0, bad = 0;
      for (let mi = 0; mi < IC.mountains.count; mi += 2) {
        fresh(mi);
        w = game.world();
        for (let k = 0; k < 4; k++) {
          const col = [...Array(S.COLS).keys()].find((c) => c > 1 && c < 14 && S.cell(w, k + 1, c) === 0 && S.solid(w, k, c) && S.solid(w, k + 1, c + 1));
          if (col === undefined) continue;
          game.put(0, k, S.X0 + col + 0.5);
          key('ArrowRight', true);
          press('Space', 0.05);
          step(1.2);
          key('ArrowRight', false);
          step(0.6);
          const q = st().players[0];
          holes++;
          if (inBlock(w.players[0]) || q.mode !== 'ground') bad++;
        }
      }
      ok('up a hole holding →', holes >= 4 && !bad, `${holes} hops, ${bad} ended inside ice or in the air`);

      // 2 players: each brother on his own keys, and T is a high five
      fresh(2, { players: 2 });
      game.put(0, 0, -5.5);
      game.put(1, 0, 4.5);
      a = st();
      press('KeyD', 0.35);
      b = st();
      press('ArrowLeft', 0.35);
      const c3 = st();
      press('KeyT', 0.05);
      step(0.6);
      const h = st();
      ok('2 players own keys', b.players[0].sx > a.players[0].sx + 15 && Math.abs(b.players[1].sx - a.players[1].sx) < 2 && c3.players[1].sx < b.players[1].sx - 15 && Math.abs(c3.players[0].sx - b.players[0].sx) < 2 && h.players[0].score >= 50 && h.players[1].score >= 50,
        `D: Teddy ${b.players[0].sx - a.players[0].sx} px, Tommy ${b.players[1].sx - a.players[1].sx} px; ←: Tommy ${c3.players[1].sx - b.players[1].sx} px; high five ${h.players[0].score}/${h.players[1].score}`);

      // the keyboard kid: random mashing on every mountain, with seals and birds; afterwards → and ← still move him
      let rnd = 7;
      const r = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
      const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyX'];
      for (let mi = 0; mi < IC.mountains.count; mi++) {
        fresh(mi);
        w = game.world();
        w.sealT = 0.5;
        w.birdT = 1;
        w.hiLayer = 2;
        const down = new Set();
        let errors = 0;
        try {
          for (let n = 0; n < 300; n++) {
            const kk = KEYS[Math.floor(r() * KEYS.length)];
            if (down.has(kk)) { key(kk, false); down.delete(kk); } else { key(kk, true); down.add(kk); }
            if (r() < 0.04) press('KeyT', 0.02);
            step(0.05 + r() * 0.1);
          }
        } catch (e) { errors++; }
        down.forEach((kk) => key(kk, false));
        step(4.5);
        game.quiet();
        for (let n = 0; n < 40 && st().players[0].mode !== 'ground'; n++) step(0.2);
        const s1 = st().players[0];
        press('ArrowRight', 0.4);
        const s2 = st().players[0];
        press('ArrowLeft', 0.4);
        const s3 = st().players[0];
        const moved = s2.x !== s1.x || s3.x !== s2.x;
        const ph = st().phase;
        ok(`keyboard kid ${w.D.id}`, !errors && s1.mode === 'ground' && !inBlock(w.players[0]) && (ph !== 'play' || moved), `${errors} errors, ${ph} ${s1.mode} on ${s1.sup}, keys move him ${moved}`);
      }
    } finally {
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyX'].forEach((k) => key(k, false));
      game.sabotage(null);
      document.body.classList.toggle('touch', hadTouch);
      game.hold(wasHold);
    }
    const failed = results.filter((x) => !x.ok);
    return { ok: !failed.length, total: results.length, failed: failed.map((x) => `${x.name}: ${x.info}`), results };
  }
  game.playCheck = run;
})();
// layout: the kit's left-edge buttons, the HUD and the touch pads never cover the play area (the 16 columns, from the
// bottom of the screen to the top of the climb) or each other; the smallest tap target is reported
(function () {
  'use strict';
  game.layoutCheck = function () {
    const S = IC.sim, w = game.world();
    const r = (el) => el && el.getBoundingClientRect();
    const hit = (a, b) => a && b && a.width && b.width && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const shown = (e) => e && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
    const kit = ['kit-help-btn', 'kit-lang-btn', 'kit-sound-btn'].map((id) => document.getElementById(id)).filter(shown);
    const touch = [...document.querySelectorAll('#touch .dk, #touch .tb')].filter(shown);
    const hud = [...document.querySelectorAll('#hud .box, #hud .ibtn, #hud .bud')].filter(shown);
    const [x0, y0] = game.toScreen(S.X0, w.camY + S.VIEW_H), [x1, y1] = game.toScreen(-S.X0, w.camY - 0.05);
    const area = { left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0 };
    const name = (e) => e.id || (e.dataset && e.dataset.k ? `${e.dataset.k}${e.dataset.p || ''}` : e.className);
    const bad = [];
    for (const k of kit) {
      for (const c of touch.concat(hud)) if (hit(r(k), r(c))) bad.push(`${k.id} x ${name(c)}`);
      if (hit(r(k), area)) bad.push(`${k.id} x play area`);
    }
    for (const c of touch) {
      if (hit(r(c), area)) bad.push(`${name(c)} x play area`);
      for (const d of touch) if (c !== d && name(c) < name(d) && hit(r(c), r(d))) bad.push(`${name(c)} x ${name(d)}`);
    }
    const sizes = touch.map((e) => Math.round(Math.min(r(e).width, r(e).height)));
    return { touch: document.body.classList.contains('touch'), two: w.two, area: [x0, y0, x1, y1].map(Math.round), k: +(game.G.k || 0).toFixed(1), bad, smallestTap: sizes.length ? Math.min(...sizes) : null, scroll: document.documentElement.scrollHeight > innerHeight + 2 };
  };
  window.layoutCheck = game.layoutCheck;
})();
