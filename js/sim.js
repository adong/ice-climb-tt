/* TT Ice Climb: the rules, with no Three.js, so node can run them (tools/check.js) and the autopilot can look ahead.
   Fixed steps of 1/60 s. The page (js/game.js) draws whatever this says is happening.
   - The mountain is a grid: 16 columns, a layer every 2.4 m. Walk on ice, jump straight up: the toy mallet bonks the ONE
     block right above your head (and you bounce back down), and over a hole you hop up through it onto the next layer.
     Hard snow never breaks. Clouds are soft: jump up through them and land on top; drifting ones carry you along.
   - The roly-poly snow seal waddles along a layer. On NORMAL it pushes ice back into holes; on EASY holes stay open.
     Little birds flutter about. A bump makes you dizzy and costs a life. Bonk them with the mallet (swing, a stomp, or a
     jump into a bird) and they float away, puffed and sneezy.
   - The screen scrolls up only: it follows the highest layer anyone has stood on. Anyone below the bottom of the screen
     floats back up in a bubble (on NORMAL in 1 player a fall costs a life first).
   - Above layer 8 is the bonus stage: hop up the clouds and grab the giant vegetable the friendly big bird carries,
     before the timer runs out. 8 mountains.
   Sabotage switches (w.sab) exist only so js/check.js can prove its checks can fail. */
(function (root) {
  'use strict';
  const IC = (root.IC = root.IC || {});
  const MT = () => IC.mountains;
  const DT = 1 / 60, L = 2.4, BH = 0.55, PH = 1.05, BW = 0.27, FW = 0.3, X0 = -8, COLS = 16, VIEW_H = 10.8;
  const ICE_TOP = 8, TOP = 12;
  const LEVELS = {
    easy: {
      lives: 5, grav: 18, jumpH: 3.05, walk: 3.0, air: 3.2, airAcc: 40, assist: 4.5, assistR: 1.9,
      seal: 0.85, maxSeals: 1, sealGap: [8, 12], fill: false, bird: 1.0, maxBirds: 1, birdGap: [9, 14], swoop: 0,
      bonusT: 60, bigBird: 1.1, fallLife: false, inv: 2.5, veg: 3000,
    },
    normal: {
      lives: 3, grav: 25, jumpH: 2.8, walk: 3.4, air: 2.7, airAcc: 16, assist: 3.4, assistR: 1.25,
      seal: 1.35, maxSeals: 2, sealGap: [4, 7], fill: true, bird: 1.6, maxBirds: 2, birdGap: [5, 9], swoop: 0.35,
      bonusT: 40, bigBird: 1.6, fallLife: true, inv: 2.0, veg: 5000,
    },
  };
  const TREATS = ['🍦', '💧', '🧃', '🍪', '🍉', '🍌'];
  const BUDDY_INTRO = 1.0, BUDDY_END = 1.9, HI5_END = 1.2, DIZZY = 1.2, LIFE_EVERY = 20000;

  function rnd(w) {
    let t = (w.rng = (w.rng + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const ev = (w, type, o) => { if (!w.quiet) w.events.push(Object.assign({ type }, o || {})); };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const colOf = (x) => Math.floor(x - X0);

  function create(o) {
    o = o || {};
    const level = o.level === 'normal' ? 'normal' : 'easy';
    const cfg = Object.assign({}, LEVELS[level], o.cfg || {});
    cfg.v0 = Math.sqrt(2 * cfg.grav * cfg.jumpH);
    const who = o.players || ['teddy'];
    const w = {
      level, cfg, sab: o.sabotage || null, two: who.length === 2, rng: (o.seed || 1) | 0, t: 0, events: [], quiet: false,
      players: who.map((id, i) => ({ i, who: id, score: 0, lives: cfg.lives, out: false, nextLife: LIFE_EVERY })),
      mi: o.mountain || 0, calls: 0, sid: 0, bid: 0, buddy: null, hi5T: 0,
      buddyFor: o.buddyFor || ((id) => (id === 'tommy' ? 'teddy' : 'tommy')),
    };
    loadMountain(w, w.mi);
    if (o.go) { w.phase = 'play'; w.phaseT = 0; }
    return w;
  }

  function loadMountain(w, mi) {
    const D = MT().get(mi);
    w.mi = D.index;
    w.D = D;
    w.grid = D.rows.map((r) => r.slice());
    w.gridV = (w.gridV || 0) + 1;
    w.clouds = D.clouds.map((c, i) => Object.assign({ i, dx: 0 }, c));
    w.vegs = D.vegs.map((v) => ({ k: v.k, x: v.x, y: v.k * L + 0.65, taken: false }));
    w.big = { x: -5.5, dir: 1, y: TOP * L + 3.4, vy: TOP * L + 2.5, got: false };
    w.seals = [];
    w.birds = [];
    w.sealT = 4;
    w.birdT = 6;
    w.camY = -0.9;
    w.hiLayer = 0;
    w.bonus = { on: false, t: w.cfg.bonusT };
    w.buddy = null;
    w.players.forEach((pl, i) => {
      const x = w.two ? (i ? 2.5 : -2.5) : -2.5;
      Object.assign(pl, {
        x, y: 0, vx: 0, vy: 0, mode: pl.out ? 'out' : 'ground', sup: { k: 'g', f: 0 }, face: 1, swing: 0, swingCd: 0, inv: 0, dizzy: 0,
        hi: 0, walkT: 0, bub: null, passK: -1, cheer: 0,
      });
    });
    w.phase = 'ready';
    w.phaseT = 1.5;
  }

  // ---------- the grid ----------
  const cell = (w, k, c) => (k < 0 || c < 0 || c >= COLS || k >= w.grid.length ? (k === 0 ? 2 : 0) : w.grid[k][c]);
  const solid = (w, k, c) => cell(w, k, c) > 0;
  const breakable = (w, k, c) => { const v = cell(w, k, c); return v === 1 || v === 3; };
  function setCell(w, k, c, v) { if (k > 0 && k < w.grid.length && c >= 0 && c < COLS) { w.grid[k][c] = v; w.gridV++; } }
  // what holds you up on layer k at x: the grid or a cloud
  function supportAt(w, x, k, fw) {
    if (k < 0) return null;
    const a = x - fw + 0.04, b = x + fw - 0.04;
    for (let c = colOf(a); c <= colOf(b); c++) if (solid(w, k, c)) return { k: 'g', f: k };
    for (const cl of w.clouds) if (cl.k === k && Math.abs(x - cl.x) < cl.hw + fw - 0.04) return { k: 'c', f: k, i: cl.i };
    return null;
  }
  function bodyHitsGrid(w, x, y) {
    const k0 = Math.max(0, Math.floor(y / L)), k1 = Math.floor((y + PH + BH) / L) + 1;
    for (let k = k0; k <= k1; k++) {
      const top = k * L, bot = top - BH;
      if (!(bot < y + PH - 0.01 && top > y + 0.01)) continue;
      for (let c = colOf(x - BW); c <= colOf(x + BW); c++) if (solid(w, k, c)) return { k, c };
    }
    return null;
  }
  const playing = (p) => p.mode !== 'out' && p.mode !== 'bubble';

  // ---------- breaking ice ----------
  function breakCell(w, k, c, p, why) {
    if (!breakable(w, k, c)) return false;
    setCell(w, k, c, 0);
    if (p) addScore(w, p, 10);
    ev(w, 'break', { k, c, x: X0 + c + 0.5, y: k * L - BH / 2, who: p ? p.i : -1, why: why || 'head' });
    // a seal standing on that block gets bonked off it
    for (const s of w.seals) if (s.st === 'walk' && s.k === k && Math.abs(s.x - (X0 + c + 0.5)) < 0.55) bonkSeal(w, s, p, 'below');
    return true;
  }

  // ---------- the climbers ----------
  function addScore(w, p, n) {
    p.score += n;
    while (p.score >= p.nextLife) { p.nextLife += LIFE_EVERY; p.lives++; ev(w, 'extraLife', { who: p.i }); }
  }
  function land(w, p, s, y) {
    p.mode = 'ground';
    p.sup = s;
    p.y = y;
    if (p.vy < -6) ev(w, 'land', { who: p.i, hard: true });
    p.vy = 0;
    p.passK = -1;
    if (s.f > p.hi) { addScore(w, p, 100 * (s.f - p.hi)); p.hi = s.f; }
    if (s.f > w.hiLayer) {
      w.hiLayer = s.f;
      ev(w, 'layer', { k: s.f, who: p.i });
      if (s.f >= ICE_TOP && !w.bonus.on) startBonus(w);
    }
  }
  function hurt(w, p, why) {
    if (p.inv > 0 || p.dizzy > 0 || !playing(p) || w.phase !== 'play') return false;
    if (w.buddy && w.buddy.kind !== 'hi5') return false; // your brother is here: nothing can bump you
    p.dizzy = DIZZY;
    p.inv = DIZZY + w.cfg.inv;
    p.swing = 0;
    loseLife(w, p, why);
    return true;
  }
  function loseLife(w, p, why) {
    p.lives--;
    ev(w, 'hit', { who: p.i, why, x: p.x, y: p.y });
    if (p.lives <= 0) {
      p.lives = 0;
      p.out = true;
      p.mode = 'out';
      ev(w, 'out', { who: p.i });
      if (w.players.every((q) => q.out)) { w.phase = 'over'; w.phaseT = 0; ev(w, 'over'); }
    }
  }

  function stepPlayer(w, p, inp) {
    const c = w.cfg;
    p.swing = Math.max(0, p.swing - DT);
    p.swingCd = Math.max(0, p.swingCd - DT);
    p.inv = Math.max(0, p.inv - DT);
    if (p.dizzy > 0) { p.dizzy = Math.max(0, p.dizzy - DT); if (!p.dizzy) ev(w, 'wake', { who: p.i }); }
    if (p.mode === 'bubble') return stepBubble(w, p);
    if (p.mode === 'out') return;
    const free = w.phase === 'play' && p.dizzy <= 0;
    let lr = free ? inp.lr | 0 : 0;
    if (lr) p.face = lr;
    if (free && inp.swing && p.swingCd <= 0) { p.swing = 0.3; p.swingCd = 0.42; ev(w, 'swing', { who: p.i }); }
    if (p.mode === 'ground') {
      if (p.sup.k === 'c') p.x += w.clouds[p.sup.i].dx;
      p.vx = lr * c.walk;
      if (lr) p.walkT += DT;
      if (free && inp.jump) {
        p.mode = 'air';
        p.vy = c.v0;
        p.jumpX = p.x;
        ev(w, 'jump', { who: p.i });
      }
    } else {
      let want = lr * c.air;
      if (!lr && p.vy < 0 && !(p.dizzy > 0)) want = assist(w, p);
      const d = want - p.vx, m = c.airAcc * DT;
      p.vx += clamp(d, -m, m);
      p.vy = Math.max(-15, p.vy - c.grav * DT);
    }
    moveX(w, p, p.vx * DT);
    if (p.mode === 'ground') {
      const s = supportAt(w, p.x, p.sup.f, FW);
      if (!s) { p.mode = 'air'; p.vy = 0; p.vx *= 0.5; }
      else p.sup = s;
    } else moveY(w, p);
  }
  // no key held while dropping onto a layer: steer gently to the nearest place to stand (so a hop up a hole lands on its edge)
  function assist(w, p) {
    const c = w.cfg;
    const k = Math.floor((p.y + 1e-3) / L);
    if (supportAt(w, p.x, k, FW)) return 0;
    for (let d = 0.1; d <= c.assistR + 1e-6; d += 0.1) {
      for (const s of [p.face || 1, -(p.face || 1)]) {
        const x = p.x + s * d;
        if (x < X0 + BW || x > -X0 - BW) continue;
        if (supportAt(w, x, k, FW)) return s * Math.min(c.assist, d / DT);
      }
    }
    return 0;
  }
  function moveX(w, p, dx) {
    p.x = clamp(p.x + dx, X0 + BW, -X0 - BW);
    for (let n = 0; n < 3; n++) {
      const h = bodyHitsGrid(w, p.x, p.y);
      if (!h) break;
      const cl = X0 + h.c;
      p.x = p.x < cl + 0.5 ? cl - BW - 1e-4 : cl + 1 + BW + 1e-4;
      p.vx = 0;
    }
  }
  function moveY(w, p) {
    const y0 = p.y;
    let y1 = y0 + p.vy * DT;
    if (p.vy > 0) {
      const k = Math.ceil((y0 + PH + BH - 1e-6) / L); // the next layer above the head
      const bot = k * L - BH;
      if (y0 + PH <= bot + 1e-6 && y1 + PH > bot) {
        const cc = colOf(p.x);
        let any = false;
        for (let c = colOf(p.x - BW); c <= colOf(p.x + BW); c++) if (solid(w, k, c)) any = true;
        if (any) {
          if (solid(w, k, cc)) {
            // the block right above the head: bonk! (one block, only that one), and back down
            y1 = bot - PH - 1e-4;
            p.vy = 0;
            if (breakable(w, k, cc)) {
              breakCell(w, k, cc, p, 'head');
              if (w.sab === 'breakRow') { breakCell(w, k, cc - 1, p); breakCell(w, k, cc + 1, p); }
            } else ev(w, 'clunk', { who: p.i, x: p.x, y: bot });
          } else {
            // the hole is right above: slide into it and go on up
            p.x = clamp(p.x, X0 + cc + BW + 1e-3, X0 + cc + 1 - BW - 1e-3);
          }
        }
      }
      const kp = Math.floor(y1 / L);
      if (Math.floor(y0 / L) < kp) p.passK = kp;
      // a bird just over the head gets bonked by the mallet
      for (const b of w.birds) if (b.st === 'fly' && Math.abs(b.x - p.x) < 0.6 && b.y > y1 + PH - 0.3 && b.y < y1 + PH + 0.55) bonkBird(w, b, p);
    } else {
      // feet: land on the first top we pass on the way down
      for (let k = Math.floor((y0 + 1e-6) / L); k >= 0 && k * L > y1 - 1e-6; k--) {
        const top = k * L;
        if (y0 >= top - 1e-6 && y1 < top + 1e-9) {
          const s = supportAt(w, p.x, k, FW);
          if (s) { land(w, p, s, top); return; }
        }
      }
    }
    p.y = y1;
  }

  // ---------- off the bottom of the screen: the bubble ----------
  function bubbleTarget(w, p) {
    const others = w.players.filter((q) => q !== p && playing(q));
    const near = others.length ? others[0].x : p.x;
    for (let k = Math.max(0, Math.ceil((w.camY + 0.7) / L)); k <= TOP; k++) {
      let best = null;
      for (let c = 0; c < COLS; c++) {
        const x = X0 + c + 0.5;
        if (!supportAt(w, x, k, FW) || bodyHitsGrid(w, x, k * L + 0.3)) continue;
        if (best === null || Math.abs(x - near) < Math.abs(best - near)) best = x;
      }
      for (const cl of w.clouds) if (cl.k === k && !cl.v && (best === null || Math.abs(cl.x - near) < Math.abs(best - near))) best = cl.x;
      if (best !== null) return { x: best, k };
    }
    return { x: 0, k: TOP };
  }
  function startBubble(w, p, why) {
    if (why === 'fall' && w.cfg.fallLife && !w.two && w.phase === 'play') {
      loseLife(w, p, 'fall');
      if (p.out) return;
    }
    p.mode = 'bubble';
    p.bub = { t: 0, why };
    p.vx = 0;
    p.vy = 0;
    p.dizzy = 0;
    p.swing = 0;
    ev(w, 'bubble', { who: p.i, why });
  }
  function stepBubble(w, p) {
    const b = p.bub;
    b.t += DT;
    if (w.sab === 'noBubble') return; // broken on purpose: he stays down there
    const tg = bubbleTarget(w, p);
    const ty = tg.k * L + 0.35;
    p.y = Math.min(ty, p.y + Math.max(2, Math.min(7, (ty - p.y) * 2.5)) * DT);
    if (p.y < w.camY + 0.3) p.y = Math.max(p.y, w.camY - PH - 0.3); // rise into view quickly
    const dx = tg.x - p.x;
    p.x += clamp(dx, -4 * DT, 4 * DT);
    if (Math.abs(ty - p.y) < 0.02 && Math.abs(dx) < 0.05 && b.t > 0.6) {
      p.mode = 'air';
      p.vy = 0;
      p.vx = 0;
      p.bub = null;
      p.inv = Math.max(p.inv, 1.5);
      ev(w, 'pop', { who: p.i, x: p.x, y: p.y });
    }
  }

  // ---------- clouds ----------
  function stepClouds(w) {
    for (const cl of w.clouds) {
      if (!cl.v) { cl.dx = 0; continue; }
      const x0 = cl.x;
      cl.x += cl.v * DT;
      if (cl.x > cl.x1) { cl.x = cl.x1; cl.v = -Math.abs(cl.v); }
      if (cl.x < cl.x0) { cl.x = cl.x0; cl.v = Math.abs(cl.v); }
      cl.dx = cl.x - x0;
    }
  }
  // where a drifting cloud will be in t seconds (the autopilot times its hops with this)
  function cloudAt(cl, t) {
    if (!cl.v) return cl.x;
    const span = cl.x1 - cl.x0;
    let u = (cl.x - cl.x0) + cl.v * t;
    const per = 2 * span;
    u = ((u % per) + per) % per;
    return cl.x0 + (u <= span ? u : per - u);
  }

  // ---------- the snow seal ----------
  function spawnSeal(w) {
    const lo = Math.max(1, Math.ceil((w.camY + 0.6) / L)), hi = Math.min(ICE_TOP, w.hiLayer + 2);
    const want = [w.hiLayer + 1, w.hiLayer + 2, w.hiLayer];
    const pick = rnd(w);
    const order = pick < 0.6 ? want : pick < 0.85 ? [want[1], want[0], want[2]] : [want[2], want[0], want[1]];
    for (const k of order) {
      if (k < lo || k > hi) continue;
      for (const side of rnd(w) < 0.5 ? [-1, 1] : [1, -1]) {
        const c = side < 0 ? 0 : COLS - 1;
        if (!solid(w, k, c) || !solid(w, k, c - side)) continue;
        if (w.seals.some((s) => s.k === k && s.st === 'walk')) continue;
        w.seals.push({ id: ++w.sid, k, x: side * (-X0 - 0.4), dir: -side, carry: w.cfg.fill || w.sab === 'easyFill', st: 'walk', t: 0, life: 16 + rnd(w) * 6, vy: 0, y: k * L, wait: 0, home: side });
        ev(w, 'sealIn', { k, side });
        return true;
      }
    }
    return false;
  }
  function bonkSeal(w, s, p, how) {
    if (s.st !== 'walk') return;
    s.st = 'float';
    s.t = 0;
    s.y = s.k * L;
    if (p) addScore(w, p, 400);
    ev(w, 'sealBonk', { x: s.x, y: s.k * L + 0.4, who: p ? p.i : -1, how });
  }
  function stepSeals(w) {
    const c = w.cfg;
    for (const s of w.seals) {
      s.t += DT;
      if (s.st === 'float') { s.y += (1.2 + s.t) * DT; s.x += Math.sin(s.t * 3) * DT * 0.6; if (s.t > 3) s.gone = true; continue; }
      if (s.wait > 0) { s.wait -= DT; continue; }
      if (s.life < -6) { s.st = 'float'; s.t = 0; s.y = s.k * L; continue; } // stuck between two holes for ages: off it floats
      const sp = c.seal * (w.phase === 'play' ? 1 : 0);
      s.x += s.dir * sp * DT;
      s.life -= DT;
      const yk = s.k * L;
      // its own block went away (a bonk from below, or the companion): bonked off
      if (!supportAt(w, s.x, s.k, 0.3)) { bonkSeal(w, s, null, 'fall'); continue; }
      const front = s.x + s.dir * 0.42;
      if (Math.abs(front) > -X0 - 0.05) {
        // the edge of the mountain: home to get more ice (or just turn round)
        if ((!s.carry && (c.fill || w.sab === 'easyFill')) || s.life <= 0) { s.gone = true; ev(w, 'sealOut', { k: s.k }); continue; }
        s.dir = -s.dir;
        continue;
      }
      const fc = colOf(front);
      if (!solid(w, s.k, fc)) {
        const fill = s.carry && (c.fill || w.sab === 'easyFill');
        if (fill) {
          // push the ice block into the hole, unless somebody is in it
          const cx = X0 + fc + 0.5;
          const busy = w.players.some((p) => playing(p) && Math.abs(p.x - cx) < 0.5 + BW && p.y < yk + 0.05 && p.y + PH > yk - BH - 0.05);
          if (!busy) {
            setCell(w, s.k, fc, 3);
            s.carry = false;
            s.wait = 0.45;
            ev(w, 'fill', { k: s.k, c: fc, x: cx, y: yk - BH / 2 });
            s.dir = -s.dir;
          } else s.wait = 0.2;
        } else s.dir = -s.dir;
      }
      // bumping into a climber
      for (const p of w.players) {
        if (!playing(p)) continue;
        if (Math.abs(p.x - s.x) > 0.66 || p.y < yk - 0.25 || p.y > yk + 0.9) continue;
        if (p.vy < -1 && p.y > yk + 0.3) { bonkSeal(w, s, p, 'stomp'); p.vy = w.cfg.v0 * 0.45; break; }
        hurt(w, p, 'seal');
      }
    }
    w.seals = w.seals.filter((s) => !s.gone);
  }

  // ---------- birds ----------
  function spawnBird(w) {
    const side = rnd(w) < 0.5 ? -1 : 1;
    const y = w.camY + 3 + rnd(w) * (VIEW_H - 4.5);
    w.birds.push({ id: ++w.bid, x: side * 8.6, y, ty: y, vx: -side * w.cfg.bird, t: 0, st: 'fly', turns: 0, vy: 0 });
    ev(w, 'birdIn', { side });
  }
  function bonkBird(w, b, p) {
    if (b.st !== 'fly') return;
    b.st = 'float';
    b.t = 0;
    if (p) addScore(w, p, 800);
    ev(w, 'birdBonk', { x: b.x, y: b.y, who: p ? p.i : -1 });
  }
  function stepBirds(w) {
    const c = w.cfg;
    for (const b of w.birds) {
      b.t += DT;
      if (b.st === 'float') { b.y += 1.6 * DT; b.x += Math.sin(b.t * 4) * DT; if (b.t > 2.5) b.gone = true; continue; }
      if (w.phase !== 'play') continue;
      b.x += b.vx * DT;
      if (Math.abs(b.x) > 8.7 && Math.sign(b.x) === Math.sign(b.vx)) {
        b.turns++;
        if (b.turns > 3) { b.gone = true; continue; }
        b.vx = -b.vx;
      }
      if (Math.floor(b.t / 2.6) !== Math.floor((b.t - DT) / 2.6)) {
        const tgt = w.players.filter(playing)[0];
        if (tgt && rnd(w) < c.swoop) b.ty = tgt.y + 0.6;
        else b.ty = w.camY + 3 + rnd(w) * (VIEW_H - 4.5);
      }
      b.ty = clamp(b.ty, w.camY + 1.4, w.camY + VIEW_H - 0.8);
      b.y += clamp(b.ty - b.y, -1.2 * DT, 1.2 * DT);
      for (const p of w.players) {
        if (!playing(p)) continue;
        const dx = Math.max(0, Math.abs(b.x - p.x) - BW), dy = Math.max(0, p.y - b.y, b.y - (p.y + PH));
        if (dx * dx + dy * dy > 0.34 * 0.34) continue;
        hurt(w, p, 'bird');
      }
    }
    w.birds = w.birds.filter((b) => !b.gone);
  }
  // the mallet swing: a seal or a bird just in front gets bonked
  function swings(w) {
    for (const p of w.players) {
      if (!(p.swing > 0) || !playing(p)) continue;
      const xa = Math.min(p.x, p.x + p.face * 1.3), xb = Math.max(p.x, p.x + p.face * 1.3);
      for (const s of w.seals) if (s.st === 'walk' && s.x + 0.35 > xa && s.x - 0.35 < xb && s.k * L + 0.4 > p.y - 0.4 && s.k * L + 0.4 < p.y + 1.3) bonkSeal(w, s, p, 'swing');
      for (const b of w.birds) if (b.st === 'fly' && b.x + 0.3 > xa && b.x - 0.3 < xb && b.y > p.y - 0.4 && b.y < p.y + 1.5) bonkBird(w, b, p);
    }
  }

  // ---------- the bonus stage ----------
  function startBonus(w) {
    w.bonus.on = true;
    w.bonus.t = w.cfg.bonusT;
    for (const s of w.seals) if (s.st === 'walk') { s.st = 'float'; s.t = 0; s.y = s.k * L; }
    for (const b of w.birds) if (b.st === 'fly') { b.st = 'float'; b.t = 0; }
    ev(w, 'bonus', { t: w.bonus.t });
  }
  function stepBonus(w) {
    const B = w.big, c = w.cfg;
    B.x += B.dir * c.bigBird * DT;
    if (B.x > 6.2) { B.x = 6.2; B.dir = -1; }
    if (B.x < -6.2) { B.x = -6.2; B.dir = 1; }
    if (!w.bonus.on || w.phase !== 'play') return;
    for (const v of w.vegs) {
      if (v.taken) continue;
      for (const p of w.players) if (playing(p) && Math.abs(p.x - v.x) < 0.6 && v.y > p.y - 0.2 && v.y < p.y + PH + 0.3) {
        v.taken = true;
        addScore(w, p, 300);
        ev(w, 'veg', { who: p.i, x: v.x, y: v.y });
        break;
      }
    }
    if (!B.got) {
      for (const p of w.players) {
        if (!playing(p)) continue;
        const dx = Math.max(0, Math.abs(B.x - p.x) - BW), dy = Math.max(0, p.y - B.vy, B.vy - (p.y + PH));
        if (dx * dx + dy * dy > 0.62 * 0.62) continue;
        B.got = true;
        const pts = c.veg + 500 * w.mi;
        addScore(w, p, pts);
        ev(w, 'bigVeg', { who: p.i, x: B.x, y: B.vy, pts, veg: w.D.veg, name: w.D.vegName });
        clear(w, true);
        return;
      }
    }
    w.bonus.t = Math.max(0, w.bonus.t - DT);
    if (!w.bonus.t) { ev(w, 'timeUp'); clear(w, false); }
  }
  function clear(w, got) {
    w.phase = 'clear';
    w.phaseT = 4.2;
    w.buddy = null;
    for (const p of w.players) if (playing(p)) { p.cheer = 1; p.vx = 0; }
    ev(w, 'clear', { got, mi: w.mi, last: w.mi === MT().count - 1 });
  }

  // ---------- the companion ----------
  // 1 player: the other brother pops in, does his move, tosses a treat, then bonks a whole row of ice above you.
  // 2 players: T is a high five.
  function call(w) {
    if (w.phase !== 'play' && w.phase !== 'ready') return false;
    if (w.two) {
      if (w.buddy) return false;
      w.buddy = { kind: 'hi5', t: 0, who: null };
      ev(w, 'hi5Start');
      return true;
    }
    if (w.buddy && w.buddy.t < BUDDY_INTRO) return false; // he's still on his way: wait for the smash
    const p = w.players[0];
    if (!playing(p)) return false;
    const who = w.buddyFor(p.who);
    w.buddy = { kind: w.bonus.on ? 'cheer' : 'smash', who, t: 0, n: w.calls, treat: TREATS[w.calls % TREATS.length], treated: false, done: false };
    w.calls++;
    ev(w, 'buddyIn', { who });
    return true;
  }
  function stepBuddy(w) {
    const bd = w.buddy;
    if (!bd) return;
    bd.t += DT;
    if (bd.kind === 'hi5') {
      if (!bd.done && bd.t > 0.45) {
        bd.done = true;
        for (const p of w.players) if (!p.out) addScore(w, p, 50);
        ev(w, 'hi5');
      }
      if (bd.t > HI5_END) w.buddy = null;
      return;
    }
    const p = w.players[0];
    if (!bd.treated && bd.t > 0.55) { bd.treated = true; addScore(w, p, 100); ev(w, 'treat', { e: bd.treat }); }
    if (!bd.done && bd.t > BUDDY_INTRO) {
      bd.done = true;
      if (bd.kind === 'smash') {
        const base = p.mode === 'ground' ? p.sup.f : Math.floor((p.y + 1e-3) / L);
        const k = Math.min(base + 1, ICE_TOP);
        let n = 0;
        if (w.sab !== 'noBuddyBreak' && k > base) for (let c = 0; c < COLS; c++) if (breakCell(w, k, c, p, 'buddy')) n++;
        bd.k = k;
        ev(w, 'smash', { who: bd.who, k, n });
      } else {
        w.bonus.t += 5;
        ev(w, 'cheerUp', { who: bd.who });
      }
    }
    if (bd.t > BUDDY_END) { w.buddy = null; ev(w, 'buddyOut'); }
  }

  // ---------- the screen: up only ----------
  function stepCamera(w) {
    let target = Math.max(-0.9, (w.hiLayer - 1) * L - 0.6);
    if (w.sab === 'scrollDown') {
      // broken on purpose: the screen follows the lowest climber, down too
      const ps = w.players.filter(playing);
      if (ps.length) target = Math.max(-0.9, (Math.floor(Math.min(...ps.map((p) => p.y)) / L) - 1) * L - 0.6);
      w.camY += clamp(target - w.camY, -5 * DT, 5 * DT);
      return;
    }
    if (target > w.camY) w.camY = Math.min(target, w.camY + Math.max(1.2, (target - w.camY) * 2.2) * DT);
  }
  function offScreen(w) {
    for (const p of w.players) {
      if (!playing(p)) continue;
      if (p.y + PH < w.camY - 0.05) startBubble(w, p, p.mode === 'ground' ? 'left' : 'fall');
    }
  }

  // ---------- one step ----------
  function step(w, inputs) {
    w.events.length = 0;
    w.t += DT;
    const ins = Array.isArray(inputs) ? inputs : [inputs || {}];
    if (w.phase === 'ready') {
      w.phaseT -= DT;
      if (w.phaseT <= 0) { w.phase = 'play'; ev(w, 'go'); }
    } else if (w.phase === 'clear') {
      w.phaseT -= DT;
      if (w.phaseT <= 0) {
        if (w.mi >= MT().count - 1) { w.phase = 'won'; w.phaseT = 0; ev(w, 'won'); }
        else { loadMountain(w, w.mi + 1); ev(w, 'mountain', { mi: w.mi }); }
      }
    } else if (w.phase === 'over' || w.phase === 'won') w.phaseT += DT;
    stepClouds(w);
    w.players.forEach((p, i) => stepPlayer(w, p, ins[i] || {}));
    if (w.phase === 'play') {
      swings(w);
      if (!w.bonus.on) {
        w.sealT -= DT;
        if (w.sealT <= 0) {
          const n = w.seals.filter((s) => s.st === 'walk').length;
          const max = w.cfg.maxSeals + (w.mi >= 4 && w.level === 'normal' ? 1 : 0);
          if (n < max && w.hiLayer < ICE_TOP) spawnSeal(w);
          w.sealT = w.cfg.sealGap[0] + rnd(w) * (w.cfg.sealGap[1] - w.cfg.sealGap[0]);
        }
        w.birdT -= DT;
        if (w.birdT <= 0) {
          if (w.birds.filter((b) => b.st === 'fly').length < w.cfg.maxBirds && w.hiLayer >= 2) spawnBird(w);
          w.birdT = w.cfg.birdGap[0] + rnd(w) * (w.cfg.birdGap[1] - w.cfg.birdGap[0]);
        }
      }
    }
    stepSeals(w);
    stepBirds(w);
    stepBuddy(w);
    stepBonus(w);
    stepCamera(w);
    if (w.phase === 'play' || w.phase === 'ready') offScreen(w);
  }

  IC.sim = {
    DT, L, BH, PH, BW, FW, X0, COLS, VIEW_H, ICE_TOP, TOP, LEVELS, TREATS, BUDDY_INTRO, BUDDY_END,
    create, loadMountain, step, call, cell, solid, breakable, supportAt, bodyHitsGrid, colOf, cloudAt, setCell, playing,
    spawnSeal, spawnBird, bubbleTarget, startBonus,
  };
})(typeof window !== 'undefined' ? window : globalThis);
