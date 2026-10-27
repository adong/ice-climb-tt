/* TT Ice Climb: the 8 mountains. Each one is 8 layers of ice over the snowy ground, then the bonus stage on top: 4 layers
   of clouds (some still, some drifting) and the summit, where a friendly big bird flies with a giant vegetable.
   The layers come from a fixed seed per mountain, so a mountain is always the same, and every layer is checked as it is
   made: every patch you can stand on has a way up (ice to bonk or a hole), so no layer can trap a climber.
   Cells: 0 nothing, 1 ice (bonk it), 2 hard snow (it won't break), 3 ice the seal pushed back in (bonk it too). */
(function (root) {
  'use strict';
  const IC = (root.IC = root.IC || {});
  const COLS = 16, ICE_TOP = 8, TOP = 12, ROWS = TOP + 1;
  const NAMES = ['BUNNY HILL', 'SNOWBALL PEAK', 'CLOUDY TOP', 'POLAR POINT', 'ICICLE RIDGE', 'MARSHMALLOW MOUNTAIN', 'RAINBOW RIDGE', 'SUPER SUMMIT'];
  const VEG = ['🥕', '🌽', '🍅', '🥦', '🥔', '🫑', '🥒', '🎃'];
  const VEG_NAMES = ['CARROT', 'CORN', 'TOMATO', 'BROCCOLI', 'POTATO', 'PEPPER', 'CUCUMBER', 'PUMPKIN'];
  // holes already open in each layer, runs of hard snow (how many, how long), layers that are a drifting cloud
  const PLAN = [
    { holes: 2, hard: 0, len: 0, clouds: [], v: 0.9 },
    { holes: 1, hard: 1, len: 2, clouds: [6], v: 1.0 },
    { holes: 2, hard: 1, len: 3, clouds: [4], v: 1.1 },
    { holes: 1, hard: 2, len: 2, clouds: [3, 7], v: 1.1 },
    { holes: 2, hard: 2, len: 3, clouds: [5], v: 1.2 },
    { holes: 2, hard: 2, len: 3, clouds: [3, 6], v: 1.25 },
    { holes: 1, hard: 3, len: 3, clouds: [4, 7], v: 1.3 },
    { holes: 2, hard: 3, len: 4, clouds: [2, 5, 7], v: 1.35 },
  ];
  const STUB = [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1];

  function rng(seed) {
    let s = seed | 0;
    return () => {
      let t = (s = (s + 0x6d2b79f5) | 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // the patches of a row you can stand on: runs of solid cells (a cloud layer's mover doesn't count)
  function segments(row) {
    const out = [];
    let a = -1;
    for (let c = 0; c <= COLS; c++) {
      const solid = c < COLS && row[c] > 0;
      if (solid && a < 0) a = c;
      if (!solid && a >= 0) { out.push([a, c - 1]); a = -1; }
    }
    return out;
  }
  // every patch of the row below needs a cell above it that isn't hard snow
  function fair(below, row) {
    if (row.filter((v) => v !== 2).length < 6) return false;
    return segments(below).every(([a, b]) => { for (let c = a; c <= b; c++) if (row[c] !== 2) return true; return false; });
  }

  function build(m) {
    const P = PLAN[m], r = rng(9001 + m * 131);
    const rows = [new Array(COLS).fill(2)]; // the snowy ground
    const clouds = [];
    for (let k = 1; k <= ICE_TOP; k++) {
      let row = null;
      for (let tries = 0; tries < 400 && !row; tries++) {
        let cand;
        if (P.clouds.includes(k)) cand = STUB.slice();
        else {
          cand = new Array(COLS).fill(1);
          const holes = [];
          for (let h = 0, n = 0; h < P.holes && n < 50; n++) {
            const c = 1 + Math.floor(r() * (COLS - 2));
            if (holes.some((o) => Math.abs(o - c) < 3)) continue;
            holes.push(c);
            h++;
          }
          if (k >= 2) {
            for (let h = 0; h < P.hard; h++) {
              const len = Math.max(1, P.len - (r() < 0.4 ? 1 : 0));
              const s = Math.floor(r() * (COLS - len + 1));
              for (let c = s; c < s + len; c++) cand[c] = 2;
            }
          }
          for (const c of holes) cand[c] = 0;
        }
        if (fair(rows[k - 1], cand)) row = cand;
      }
      if (!row) throw new Error(`mountain ${m} layer ${k}: no fair row`);
      rows.push(row);
      if (P.clouds.includes(k)) clouds.push({ k, x: k % 2 ? -4.4 : 4.4, hw: 1.3, v: P.v * (k % 2 ? 1 : -1), x0: -4.4, x1: 4.4 });
    }
    // the bonus stage: clouds only
    for (let k = ICE_TOP + 1; k <= TOP; k++) rows.push(new Array(COLS).fill(0));
    const bv = 1.1 + m * 0.05;
    clouds.push(
      { k: 9, x: -6.5, hw: 1.5, v: 0 }, { k: 9, x: 6.5, hw: 1.5, v: 0 }, { k: 9, x: 0, hw: 1.3, v: bv, x0: -4.2, x1: 4.2 },
      { k: 10, x: -5.6, hw: 1.3, v: bv * 1.1, x0: -5.6, x1: 5.6 }, { k: 10, x: 5.6, hw: 1.3, v: -bv * 1.1, x0: -5.6, x1: 5.6 },
      { k: 11, x: -6.5, hw: 1.5, v: 0 }, { k: 11, x: 6.5, hw: 1.5, v: 0 }, { k: 11, x: 2, hw: 1.3, v: -bv * 1.2, x0: -4.2, x1: 4.2 },
      { k: 12, x: 0, hw: 2.4, v: 0, summit: true }, { k: 12, x: -6.8, hw: 1.2, v: 0 }, { k: 12, x: 6.8, hw: 1.2, v: 0 },
    );
    // little vegetables on the bonus clouds, and the giant one the big bird carries
    const vegs = [[9, -6.5], [10, 0], [11, 6.5], [11, -6.5]].map(([k, x]) => ({ k, x }));
    return { index: m, id: 'm' + (m + 1), name: NAMES[m], veg: VEG[m], vegName: VEG_NAMES[m], rows, clouds, vegs };
  }

  const cache = [];
  IC.mountains = {
    COLS, ICE_TOP, TOP, ROWS, count: NAMES.length, names: NAMES, veg: VEG, vegNames: VEG_NAMES,
    get(m) { m = ((m % NAMES.length) + NAMES.length) % NAMES.length; return cache[m] || (cache[m] = build(m)); },
    segments,
    fair,
  };
})(typeof window !== 'undefined' ? window : globalThis);
