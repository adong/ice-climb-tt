/* TT Ice Climb: sound effects, all synth through Kit.sound (so the page's one mute switch covers them).
   IC.sfx.log counts every effect played, so tests can check sound in code while muted. */
(function () {
  'use strict';
  const S = Kit.sound;
  const log = {};
  const note = (name, fn) => (...a) => { log[name] = (log[name] || 0) + 1; fn(...a); };
  const crunch = (at, f) => { S.hiss({ filter: 'bandpass', f: f || 2600, q: 1.4, dur: 0.12, vol: 0.16, at }); S.tone({ type: 'triangle', f: (f || 2600) * 0.6, to: (f || 2600) * 0.9, dur: 0.06, vol: 0.06, at }); };
  IC.sfx = {
    log,
    jump: note('jump', () => S.tone({ type: 'square', f: 330, to: 660, dur: 0.12, vol: 0.06, lp: 2000 })),
    land: note('land', () => S.tone({ f: 170, to: 90, dur: 0.07, vol: 0.1 })),
    bonk: note('bonk', () => { crunch(0, 2800); [1568, 2093, 2637].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.08, vol: 0.05, at: 0.02 + i * 0.03 })); }),
    clunk: note('clunk', () => { S.tone({ type: 'square', f: 180, to: 120, dur: 0.09, vol: 0.08, lp: 900 }); S.hiss({ filter: 'lowpass', f: 900, dur: 0.06, vol: 0.06 }); }),
    swing: note('swing', () => S.swish()),
    sealBonk: note('sealBonk', () => { S.tone({ type: 'sine', f: 520, to: 980, dur: 0.12, vol: 0.12 }); S.hiss({ filter: 'bandpass', f: 1800, q: 0.8, dur: 0.28, vol: 0.12, at: 0.14 }); S.tone({ type: 'sine', f: 700, to: 1400, dur: 0.3, vol: 0.06, at: 0.3 }); }),
    birdBonk: note('birdBonk', () => { [2200, 2800, 2400, 3200].forEach((f, i) => S.tone({ type: 'sine', f, to: f * 1.15, dur: 0.05, vol: 0.06, at: i * 0.05 })); S.hiss({ f: 3000, to: 6000, dur: 0.2, vol: 0.08, at: 0.05 }); }),
    hit: note('hit', () => { S.tone({ f: 600, to: 180, dur: 0.35, vol: 0.16, type: 'triangle' }); for (let i = 0; i < 4; i++) S.tone({ f: 900 - i * 120, to: 1000 - i * 120, dur: 0.12, vol: 0.05, at: 0.35 + i * 0.13, type: 'sine' }); }),
    bubble: note('bubble', () => { S.tone({ type: 'sine', f: 300, to: 700, dur: 0.18, vol: 0.1 }); S.tone({ type: 'sine', f: 450, to: 900, dur: 0.16, vol: 0.07, at: 0.16 }); }),
    pop: note('pop', () => { S.tone({ type: 'sine', f: 900, to: 300, dur: 0.08, vol: 0.12 }); S.hiss({ f: 4000, dur: 0.05, vol: 0.06 }); }),
    layer: note('layer', () => { S.tone({ type: 'triangle', f: 784, dur: 0.08, vol: 0.06 }); S.tone({ type: 'triangle', f: 1175, dur: 0.1, vol: 0.06, at: 0.07 }); }),
    fill: note('fill', () => { S.tone({ type: 'square', f: 140, to: 220, dur: 0.12, vol: 0.07, lp: 800 }); S.hiss({ filter: 'lowpass', f: 1200, dur: 0.1, vol: 0.05 }); }),
    sealIn: note('sealIn', () => [392, 330].forEach((f, i) => S.tone({ type: 'sine', f, to: f * 0.9, dur: 0.12, vol: 0.06, at: i * 0.12 }))),
    veg: note('veg', (n) => S.coin(n || 2)),
    bigVeg: note('bigVeg', () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.24, vol: 0.13, at: i * 0.12 }))),
    bonus: note('bonus', () => [659, 784, 988, 1319].forEach((f, i) => S.tone({ type: 'square', f, dur: 0.1, vol: 0.06, at: i * 0.09 }))),
    tick: note('tick', () => S.tone({ type: 'square', f: 1200, dur: 0.04, vol: 0.04 })),
    timeUp: note('timeUp', () => [523, 392, 330].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.22, vol: 0.1, at: i * 0.18 }))),
    clear: note('clear', () => [523, 659, 784, 1047].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.22, vol: 0.14, at: i * 0.12 }))),
    won: note('won', () => [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.3, vol: 0.13, at: i * 0.13 }))),
    buddy: note('buddy', () => { S.tone({ f: 400, to: 900, dur: 0.15, vol: 0.12 }); S.hiss({ f: 2000, to: 500, dur: 0.25, vol: 0.08 }); }),
    treat: note('treat', () => S.coin(4)),
    smash: note('smash', () => { for (let i = 0; i < 6; i++) crunch(i * 0.07, 2200 + i * 260); }),
    cheerUp: note('cheerUp', () => [784, 988, 1175].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.12, vol: 0.08, at: i * 0.08 }))),
    hi5: note('hi5', () => { S.hiss({ filter: 'bandpass', f: 1800, dur: 0.08, vol: 0.25, q: 1 }); S.tone({ f: 880, to: 1320, dur: 0.15, vol: 0.08, at: 0.05 }); }),
    life: note('life', () => [784, 988, 1175, 1568].forEach((f, i) => S.tone({ type: 'square', f, dur: 0.1, vol: 0.06, at: i * 0.09 }))),
    go: note('go', () => { S.tone({ type: 'square', f: 660, dur: 0.1, vol: 0.07 }); S.tone({ type: 'square', f: 990, dur: 0.18, vol: 0.07, at: 0.12 }); }),
    gameOver: note('gameOver', () => [523, 440, 392, 523].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.25, vol: 0.12, at: i * 0.2 }))),
    click: note('click', () => S.click()),
  };
})();
