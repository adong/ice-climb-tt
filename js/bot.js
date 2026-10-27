/* TT Ice Climb: the autopilot. It plays the title-screen demo and the headless check (js/check.js), with the same
   inputs a kid has: ← →, jump, swing. Each step it looks at the layer above:
   - a drifting or still cloud that will be in reach when the jump comes down: jump now and steer onto it;
   - else the nearest place on the patch it stands on with a hole above (hop up, the landing help puts it on the edge)
     or ice above (bonk it, land, then hop up the new hole);
   - else wait at the edge nearest to where the clouds come by.
   A seal or a bird close by gets a mallet swing first. On the summit it chases the big bird's vegetable. */
(function (root) {
  'use strict';
  const IC = (root.IC = root.IC || {});
  const S = () => IC.sim;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // where on its support the climber can walk without falling
  function reach(w, p) {
    const s = S();
    if (p.sup.k === 'c') {
      const cl = w.clouds[p.sup.i];
      return { a: cl.x - cl.hw + 0.25, b: cl.x + cl.hw - 0.25 };
    }
    const f = p.sup.f;
    let a = s.colOf(p.x), b = a;
    if (!s.solid(w, f, a)) {
      // standing on the edge of a hole: the block under the feet is the one beside it
      const r = s.colOf(p.x + 0.26), l = s.colOf(p.x - 0.26);
      a = b = s.solid(w, f, r) ? r : l;
    }
    while (a > 0 && s.solid(w, f, a - 1)) a--;
    while (b < s.COLS - 1 && s.solid(w, f, b + 1)) b++;
    return { a: s.X0 + a + 0.2, b: s.X0 + b + 0.8 };
  }
  const headClear = (w, k, x) => { const s = S(); for (let c = s.colOf(x - 0.45); c <= s.colOf(x + 0.45); c++) if (s.solid(w, k, c)) return false; return true; };

  function decide(w, i) {
    const s = S(), c = w.cfg;
    const p = w.players[i || 0];
    const inp = { lr: 0, jump: false, swing: false };
    if (w.sab === 'lazyBot') return inp; // broken on purpose: the check must notice
    if (!p || !s.playing(p) || p.dizzy > 0 || w.phase !== 'play') return inp;
    const mem = (w.botMem = w.botMem || [])[p.i] || (w.botMem[p.i] = { plan: null });
    if (p.mode === 'air') {
      if (mem.plan != null && Math.abs(mem.plan - p.x) > 0.08) inp.lr = Math.sign(mem.plan - p.x);
      return inp;
    }
    mem.plan = null;
    const f = p.sup.f;
    // a seal or a bird close by: face it and swing
    for (const sl of w.seals) {
      if (sl.st !== 'walk' || sl.k !== f) continue;
      const dx = sl.x - p.x;
      if (Math.abs(dx) < 2.1 && (Math.sign(sl.dir) === -Math.sign(dx) || Math.abs(dx) < 1.1)) {
        if (Math.sign(dx) !== p.face) inp.lr = Math.sign(dx);
        else if (Math.abs(dx) < 1.45) inp.swing = true;
        return inp;
      }
    }
    for (const b of w.birds) {
      if (b.st !== 'fly') continue;
      const dx = b.x - p.x, dy = b.y - (p.y + 0.6);
      if (Math.abs(dx) < 2.2 && Math.abs(dy) < 1.1) {
        if (Math.sign(dx) !== p.face && Math.abs(dx) > 0.25) inp.lr = Math.sign(dx);
        else if (Math.abs(dx) < 1.45) inp.swing = true;
        return inp;
      }
    }
    const R = reach(w, p);
    const walkTo = (x) => { if (Math.abs(x - p.x) > 0.06) inp.lr = Math.sign(x - p.x); return inp; };
    // the summit: catch the giant vegetable
    if (w.bonus.on && f >= s.TOP) {
      if (w.big.got) return inp;
      const tUp = (c.v0 - Math.sqrt(Math.max(0, c.v0 * c.v0 - 2 * c.grav * 1.2))) / c.grav;
      const vx = w.big.x + w.big.dir * c.bigBird * (tUp + 0.05);
      if (Math.abs(vx - p.x) < 0.5) { inp.jump = true; mem.plan = clamp(vx, R.a, R.b); return inp; }
      return walkTo(clamp(vx, R.a, R.b));
    }
    const nk = f + 1;
    if (nk > s.TOP) return inp;
    const tLand = (c.v0 + Math.sqrt(Math.max(0, c.v0 * c.v0 - 2 * c.grav * s.L))) / c.grav;
    const far = c.air * tLand * 0.7;
    // 1) a cloud on the next layer in reach when we come down
    let hop = null;
    for (const cl of w.clouds) {
      if (cl.k !== nk) continue;
      const cx = s.cloudAt(cl, tLand);
      const near = clamp(p.x, cx - cl.hw + 0.4, cx + cl.hw - 0.4);
      const d = Math.abs(near - p.x);
      if (d <= far && headClear(w, nk, p.x) && (!hop || d < hop.d)) hop = { d, x: near };
    }
    if (hop) { inp.jump = true; mem.plan = hop.d > 0.05 ? hop.x : null; return inp; }
    // 2) a hole to hop up through, or ice to bonk, above the patch we can walk on. A hole is only worth it if a side of
    //    it is a patch with a way further up (bonking ice from below splits patches, and a patch under hard snow traps)
    let opt = null, last = null;
    for (let col = 0; col < s.COLS; col++) {
      const xc = s.X0 + col + 0.5;
      if (xc < R.a - 1e-6 || xc > R.b + 1e-6) continue;
      const v = s.cell(w, nk, col);
      if (v === 2) continue;
      const sides = [-1, 1].filter((d) => goodPatch(w, nk, col + d));
      let cost = Math.abs(xc - p.x) + (v === 0 ? 0 : 1.5);
      const o = { x: xc, cost, side: sides.length ? sides.sort((a, b) => (a === p.face ? -1 : 1))[0] : 0, open: v === 0 };
      if (!sides.length) { if (s.solid(w, nk, col - 1) || s.solid(w, nk, col + 1)) if (!last || cost < last.cost) last = o; continue; }
      if (!opt || cost < opt.cost) opt = o;
    }
    opt = opt || last;
    if (opt) {
      if (Math.abs(opt.x - p.x) < 0.12) { inp.jump = true; mem.plan = opt.open && opt.side ? opt.x + opt.side * 0.78 : null; return inp; }
      return walkTo(opt.x);
    }
    // 3) wait where the clouds come closest
    let wait = null;
    for (const cl of w.clouds) {
      if (cl.k !== nk) continue;
      const mid = cl.v ? (cl.x0 + cl.x1) / 2 : cl.x;
      const x = clamp(mid, R.a, R.b);
      if (!wait || Math.abs(x - mid) < wait.d) wait = { x, d: Math.abs(x - mid) };
    }
    if (wait) return walkTo(wait.x);
    // 4) nothing up from here: drop down the nearest hole beside the patch and try again from below
    const ca = s.colOf(R.a), cb = s.colOf(R.b);
    const left = ca > 0 && !s.solid(w, f, ca - 1), right = cb < s.COLS - 1 && !s.solid(w, f, cb + 1);
    if (left && (!right || p.x - R.a < R.b - p.x)) inp.lr = -1;
    else if (right) inp.lr = 1;
    return inp;
  }
  // the patch of row k holding column col is solid and has a way on up (not all hard snow above, or clouds above)
  function goodPatch(w, k, col) {
    const s = S();
    if (col < 0 || col >= s.COLS || !s.solid(w, k, col)) return false;
    if (k + 1 > s.TOP || w.clouds.some((cl) => cl.k === k + 1)) return true;
    let a = col, b = col;
    while (a > 0 && s.solid(w, k, a - 1)) a--;
    while (b < s.COLS - 1 && s.solid(w, k, b + 1)) b++;
    for (let c = a; c <= b; c++) if (s.cell(w, k + 1, c) !== 2) return true;
    return false;
  }

  IC.bot = { decide, reach };
})(typeof window !== 'undefined' ? window : globalThis);
