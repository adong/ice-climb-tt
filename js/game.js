/* TT Ice Climb: the page. The Three.js scene with a fixed arcade camera that only scrolls up, the HUD and screens, keys
   and touch (one pad each in 2 players), the brother who pops in to smash a row of ice, the celebrations, and the
   window.game test hooks. The rules are js/sim.js (fixed 1/60 s steps); the 3D things are js/art.js; sounds js/sfx.js. */
(function () {
  'use strict';
  const T = THREE, S = IC.sim, A = IC.art, SFX = IC.sfx, MT = IC.mountains;
  const $ = (id) => document.getElementById(id);
  const PI = Math.PI, DT = S.DT, L = S.L;
  const KEY = 'iceClimbTT.v1';
  const NAME = (id) => (Kit.roster.get(id) || { name: String(id).toUpperCase() }).name;
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const SCALE = 0.52; // the kit's people are 2 m tall; climbers here are about 1 m (their bump box is 1.05 m)
  const FRIENDS = { easy: [['foxy', 12000], ['froggy', 7000]], normal: [['foxy', 20000], ['froggy', 12000]] };
  const HATS = { teddy: ['#3d6ad6', '#ffd400'], tommy: ['#ff4d6d', '#ffffff'] };

  const store = {
    d: {},
    load() {
      try { this.d = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { this.d = {}; }
      this.d.top = this.d.top || {};
      this.d.open = this.d.open || {};
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* private mode: fine */ } },
    table(level) {
      const t = (this.d.top[level] || []).slice();
      for (const [who, score] of FRIENDS[level]) if (!t.some((r) => r.who === who && r.cpu)) t.push({ who, score, cpu: true });
      return t.sort((a, b) => b.score - a.score).slice(0, 6);
    },
    add(level, who, score) {
      if (!score) return null;
      const row = { who, score, at: Date.now() };
      const mine = (this.d.top[level] || []).concat([row]).sort((a, b) => b.score - a.score).slice(0, 5);
      this.d.top[level] = mine;
      this.save();
      return mine.includes(row) ? row : null;
    },
    opened(level) { return Math.max(1, Math.min(MT.count, this.d.open[level] || 1)); },
    open(level, n) { if (n > this.opened(level)) { this.d.open[level] = Math.min(MT.count, n); this.save(); } },
  };

  const G = {
    screen: 'loading', w: null, demo: false, paused: false, hold: false, autoPause: true,
    keys: {}, taps: [{}, {}], touch: [{ l: 0, r: 0 }, { l: 0, r: 0 }], jumpBuf: [0, 0], swingBuf: [0, 0], acc: 0, time: 0,
    players: 1, who: 'teddy', level: 'easy', mi: 0, sab: null, botK: 0, botInp: [{}, {}], hitOnce: [false, false],
    scene2: null, overT: 0, newRows: [], frame: 0, sweep: null, cloudsFor: null, cheerT: 0, tickSnd: -1,
  };
  let renderer, scene, cam, layers, confetti, shards, snow, bigBird, treat, ball, peace, last = 0;
  const people = {}, mallets = {}, bubbles = [], stars = [];
  let portraits = {};
  const sealMeshes = new Map(), sealPool = [], birdMeshes = new Map(), birdPool = [];
  let cloudMeshes = [], vegSprites = [], spectatorClouds = [];
  const v3 = new T.Vector3();

  // ---------- start-up ----------
  function boot() {
    renderer = new T.WebGLRenderer({ canvas: $('game'), antialias: true });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(2, Math.max(1, devicePixelRatio || 1)));
    scene = new T.Scene();
    scene.background = new T.Color('#8fd3ff');
    cam = new T.PerspectiveCamera(30, 1, 1, 400);
    scene.add(new T.HemisphereLight('#ffffff', '#9fb6d6', 0.9));
    const sun = new T.DirectionalLight('#fff4dd', 0.75);
    sun.position.set(-8, 20, 30);
    scene.add(sun);
    A.backdrop(scene);
    layers = A.layers(scene);
    shards = A.shards(scene, 260);
    confetti = A.confetti(scene, 700);
    snow = A.snowfall(scene, 160);
    for (const id of ['teddy', 'tommy', 'foxy', 'froggy']) {
      const r = Kit.roster.get(id);
      const p = Kit.people.build(r.look);
      p.root.scale.setScalar(SCALE);
      p.root.visible = false;
      scene.add(p.root);
      people[id] = p;
      if (HATS[id]) {
        p.head.add(A.beanie(HATS[id][0], HATS[id][1]));
        const m = A.mallet();
        m.position.set(0, -0.68, 0);
        p.armR.add(m);
        mallets[id] = m;
      }
    }
    for (let i = 0; i < 2; i++) {
      const b = A.bubble();
      b.visible = false;
      scene.add(b);
      bubbles.push(b);
      const st = A.stars();
      st.visible = false;
      scene.add(st);
      stars.push(st);
    }
    bigBird = A.bigBird();
    scene.add(bigBird);
    treat = A.emoji('🍦', 0.45);
    treat.visible = false;
    scene.add(treat);
    ball = A.emoji('🏀', 0.36);
    ball.visible = false;
    scene.add(ball);
    peace = A.emoji('✌️', 0.4);
    peace.visible = false;
    scene.add(peace);
    for (let i = 0; i < 4; i++) { const s = A.emoji('🥕', 0.55); s.material.depthTest = true; scene.add(s); vegSprites.push(s); }
    for (let i = 0; i < 3; i++) { const c = A.cloud(0.75); c.visible = false; scene.add(c); spectatorClouds.push(c); }
    portraits = Kit.portraits(['teddy', 'tommy', 'foxy', 'froggy'].map((id) => Kit.roster.get(id)), { size: 128 });
    store.load();
    const o = store.d.opts || {};
    if (o.players === 2) G.players = 2;
    if (o.who === 'tommy') G.who = 'tommy';
    if (o.level === 'normal') G.level = 'normal';
    G.mi = Math.max(0, Math.min(store.opened(G.level) - 1, o.mi || 0));
    setupUI();
    addEventListener('resize', fit);
    showTitle();
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  }

  // ---------- the fixed arcade camera: the 16 columns fit the free part of the screen, and it scrolls up with the sim ----------
  const BOX = { x0: -8.25, x1: 8.25, y0: -0.3, h: S.VIEW_H + 0.3 };
  const CAM = { x: 0, rel: 5, D: 40 };
  function fit() {
    const W = innerWidth, H = innerHeight;
    renderer.setSize(W, H, false);
    const short = H <= 460, narrow = W <= 520;
    let top = short ? 48 : narrow ? 56 : 66, bottom = 6, left = 58, right = 10;
    if (document.body.classList.contains('touch') && (G.screen === 'play' || G.screen === 'pause')) {
      const two = G.w && G.w.two;
      if (H > W) bottom = two ? 290 : 222;
      else {
        left = short ? 196 : 226;
        right = two ? (short ? 154 : 184) : short ? 180 : 214;
      }
    }
    const sw = Math.max(50, W - left - right), sh = Math.max(50, H - top - bottom);
    const k = Math.min(sw / (BOX.x1 - BOX.x0), sh / BOX.h);
    const viewH = H / k;
    CAM.D = viewH / 2 / Math.tan((cam.fov * PI) / 360);
    CAM.x = (BOX.x0 + BOX.x1) / 2 - (left + sw / 2 - W / 2) / k;
    CAM.rel = BOX.y0 + (H / 2 - bottom) / k; // the box's bottom sits on the free area's bottom; a tall screen shows more above
    cam.aspect = W / H;
    cam.near = Math.max(1, CAM.D * 0.4);
    cam.far = CAM.D + 160;
    cam.updateProjectionMatrix();
    G.k = k;
    G.margins = { top, bottom, left, right };
    placeCamera();
  }
  function placeCamera() {
    const y = (G.w ? G.w.camY : 0) + CAM.rel;
    cam.position.set(CAM.x, y, CAM.D);
    cam.lookAt(CAM.x, y, 0);
    cam.updateMatrixWorld();
  }
  function toScreen(x, y, z) {
    v3.set(x, y, z || 0).project(cam);
    return [(v3.x * 0.5 + 0.5) * innerWidth, (-v3.y * 0.5 + 0.5) * innerHeight];
  }

  // ---------- games ----------
  function newWorld(demo) {
    const who = demo ? ['teddy'] : G.players === 2 ? ['teddy', 'tommy'] : [G.who];
    const w = S.create({ level: demo ? 'easy' : G.level, players: who, mountain: G.mi, seed: (Math.random() * 1e9) | 0, buddyFor: (id) => Kit.roster.buddyFor(id) });
    return w;
  }
  function resetInput() {
    G.keys = {};
    G.taps = [{}, {}];
    G.touch = [{ l: 0, r: 0 }, { l: 0, r: 0 }];
    G.jumpBuf = [0, 0];
    G.swingBuf = [0, 0];
    document.querySelectorAll('#touch .down').forEach((b) => b.classList.remove('down'));
  }
  function play() {
    Kit.sound.init();
    store.d.opts = { players: G.players, who: G.who, level: G.level, mi: G.mi };
    store.save();
    G.w = newWorld(false);
    G.demo = false;
    G.paused = false;
    G.overT = 0;
    G.scene2 = null;
    G.sweep = null;
    G.hitOnce = [false, false];
    G.acc = 0;
    resetInput();
    confetti.clear();
    shards.clear();
    clearPops();
    document.body.classList.toggle('two', G.w.two);
    showScreen('play');
    setupBud();
    big('READY?', stageLine());
    Kit.sound.music('play');
  }
  function setupBud() {
    const w = G.w;
    const who = w.two ? null : Kit.roster.buddyFor(w.players[0].who);
    const img = w.two ? '' : portraits[who] || '';
    $('budBtn').querySelector('img').src = img || portraits.tommy;
    $('budBtn').querySelector('img').style.display = w.two ? 'none' : '';
    document.querySelector('.tb.call img').src = img;
    setText($('budLbl'), w.two ? '✋ HIGH FIVE' : `CALL ${NAME(who)}`);
    setText(document.querySelector('.tb.call small'), w.two ? 'HIGH FIVE' : 'CALL');
    document.querySelectorAll('.tag2').forEach((t) => setText(t, NAME(w.players[+t.dataset.name] ? w.players[+t.dataset.name].who : 'tommy')));
  }
  function call() {
    if (!G.w || G.demo || G.screen !== 'play' || G.paused) return false;
    const ok = S.call(G.w);
    if (ok) handleEvents(G.w.events.splice(0));
    return ok;
  }

  // ---------- screens ----------
  function showScreen(id) {
    G.screen = id;
    for (const s of ['title', 'pause', 'results']) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', id === 'title' || id === 'results');
    $('touch').classList.toggle('hidden', id !== 'play');
    $('menuMute').classList.toggle('hidden', id === 'play' || id === 'pause');
    document.body.classList.toggle('title', id === 'title');
    if (id !== 'play' && id !== 'pause') { $('bigmsg').classList.remove('show'); $('toast').classList.remove('show'); clearPops(); }
    fit();
  }
  function showTitle() {
    G.w = newWorld(true);
    G.demo = true;
    G.paused = false;
    G.scene2 = null;
    G.sweep = null;
    confetti.clear();
    shards.clear();
    clearPops();
    document.body.classList.remove('two');
    showScreen('title');
    refreshTitle();
    Kit.sound.music('title');
  }
  function refreshTitle() {
    document.querySelectorAll('[data-players]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.players === G.players)));
    document.querySelectorAll('[data-who]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.who === G.who)));
    document.querySelectorAll('[data-level]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === G.level)));
    $('whoRow').classList.toggle('off', G.players === 2);
    const open = store.opened(G.level);
    G.mi = Math.max(0, Math.min(open - 1, G.mi));
    setText($('mName'), `${G.mi + 1} · ${MT.names[G.mi]}`);
    setText($('mSub'), open > 1 ? `${open} OF ${MT.count} OPEN` : `CLIMB IT TO OPEN THE NEXT`);
    $('mPrev').disabled = G.mi <= 0;
    $('mNext').disabled = G.mi >= open - 1;
    const top = store.table(G.level)[0];
    setText($('titleHi'), `HI-SCORE ${fmt(top.score)} · ${NAME(top.who)}`);
  }
  function setOpt(k, v) {
    const was = G.mi;
    G[k] = v;
    SFX.click();
    refreshTitle();
    if (G.mi !== was && G.demo) { G.w = newWorld(true); confetti.clear(); }
  }
  function pickMountain(d) {
    const n = Math.max(0, Math.min(store.opened(G.level) - 1, G.mi + d));
    if (n !== G.mi) setOpt('mi', n);
  }
  function pause() {
    if (G.screen !== 'play' || G.paused) return;
    G.paused = true;
    showScreen('pause');
    Kit.sound.music('pause');
  }
  function resume() {
    if (!G.paused) return;
    G.paused = false;
    resetInput();
    showScreen('play');
    Kit.sound.music('play');
  }
  function showResults() {
    const w = G.w;
    const ps = w.players;
    G.newRows = ps.map((p) => store.add(w.level, p.who, p.score)).filter(Boolean);
    const won = w.phase === 'won';
    setText($('resTitle'), won ? 'TOP OF THE WORLD!' : ps.length === 2 ? 'TEAM CLIMB!' : 'GREAT CLIMBING!');
    const pl = ps[0];
    const reached = won ? MT.count : w.mi + 1;
    setText($('resSub'), ps.length === 2 ? `${NAME(ps[0].who)} ${fmt(ps[0].score)} · ${NAME(ps[1].who)} ${fmt(ps[1].score)}` : `${fmt(pl.score)} points · mountain ${reached} of ${MT.count}`);
    const rows = store.table(w.level);
    const tb = $('resTable');
    tb.innerHTML = '';
    const cap = document.createElement('caption');
    cap.textContent = w.level === 'easy' ? '🐣 TOP CLIMBERS' : '🔥 TOP CLIMBERS';
    tb.appendChild(cap);
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (G.newRows.some((n) => n.at === r.at && n.who === r.who && n.score === r.score)) tr.className = 'me';
      tr.innerHTML = `<td class="rk">${i + 1}</td><td class="who"><img alt="" src="${portraits[r.who] || ''}"><span>${NAME(r.who)}</span></td><td class="pts">${fmt(r.score)}</td>`;
      tb.appendChild(tr);
    });
    const best = $('resBest');
    const isTop = G.newRows.some((n) => rows[0] && n.score === rows[0].score && n.who === rows[0].who && n.at === rows[0].at);
    setText(best, isTop ? '⭐ NEW HI-SCORE!' : G.newRows.length ? '⭐ ON THE BOARD!' : '');
    best.classList.toggle('new', G.newRows.length > 0);
    // the winner (both brothers in 2 players, or on a tie) does his signature move
    const bestScore = Math.max(...ps.map((p) => p.score));
    G.scene2 = { kind: 'win', who: ps.length === 2 && !won ? ps.map((p) => p.who) : ps.filter((p) => p.score === bestScore).map((p) => p.who), t: 0 };
    showScreen('results');
    Kit.sound.music('over');
  }

  // ---------- keys and touch ----------
  const JUMP1 = ['Space', 'ArrowUp', 'KeyW', 'KeyZ', 'KeyJ'];
  const SWING1 = ['KeyX', 'KeyK', 'ArrowDown', 'KeyS', 'ShiftLeft', 'ShiftRight'];
  const TWO = {
    KeyA: [0, 'l'], KeyD: [0, 'r'], KeyW: [0, 'jump'], Space: [0, 'jump'], KeyS: [0, 'swing'], KeyF: [0, 'swing'], ShiftLeft: [0, 'swing'],
    ArrowLeft: [1, 'l'], ArrowRight: [1, 'r'], ArrowUp: [1, 'jump'], ArrowDown: [1, 'swing'], ShiftRight: [1, 'swing'], KeyL: [1, 'jump'],
  };
  function role(c) {
    if (G.w && G.w.two) return TWO[c] || null;
    if (c === 'ArrowLeft' || c === 'KeyA') return [0, 'l'];
    if (c === 'ArrowRight' || c === 'KeyD') return [0, 'r'];
    if (JUMP1.includes(c)) return [0, 'jump'];
    if (SWING1.includes(c)) return [0, 'swing'];
    return null;
  }
  function held(i, d) {
    for (const c in G.keys) { if (!G.keys[c]) continue; const r = role(c); if (r && r[0] === i && r[1] === d) return true; }
    return !!(G.touch[i][d] || G.taps[i][d]);
  }
  function readInput() {
    const out = G.w.players.map((p, i) => {
      let lr = (held(i, 'r') ? 1 : 0) - (held(i, 'l') ? 1 : 0);
      if (G.sab === 'mirror') lr = -lr; // the play check's own sabotage
      const inp = { lr, jump: G.jumpBuf[i] > 0, swing: G.swingBuf[i] > 0 };
      if (G.sab === 'stuckDizzy' && G.hitOnce[i]) { inp.lr = 0; inp.jump = false; }
      return inp;
    });
    G.taps = [{}, {}];
    return out;
  }
  function press(i, k) {
    if (k === 'jump') G.jumpBuf[i] = 0.15;
    else if (k === 'swing') G.swingBuf[i] = 0.12;
  }
  function setupUI() {
    const logo = () => {
      const zh = Kit.lang.is('zh');
      $('logoText').textContent = zh ? IC.ZH : IC.TITLE;
      $('logoSub').textContent = zh ? IC.TITLE : '';
    };
    logo();
    Kit.lang.onChange(logo);
    $('tagline').textContent = IC.TAGLINE;
    document.querySelectorAll('[data-who] img').forEach((im) => (im.src = portraits[im.parentNode.dataset.who] || ''));
    document.querySelectorAll('[data-players]').forEach((b) => b.addEventListener('click', () => setOpt('players', +b.dataset.players)));
    document.querySelectorAll('[data-who]').forEach((b) => b.addEventListener('click', () => setOpt('who', b.dataset.who)));
    document.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => setOpt('level', b.dataset.level)));
    $('mPrev').addEventListener('click', () => pickMountain(-1));
    $('mNext').addEventListener('click', () => pickMountain(1));
    $('startBtn').addEventListener('click', play);
    $('pauseBtn').addEventListener('click', pause);
    $('resumeBtn').addEventListener('click', resume);
    $('quitBtn').addEventListener('click', showTitle);
    $('againBtn').addEventListener('click', play);
    $('menuBtn').addEventListener('click', showTitle);
    $('budBtn').addEventListener('click', call);
    const syncMute = () => document.querySelectorAll('.muteBtn').forEach((b) => (b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊'));
    document.querySelectorAll('.muteBtn').forEach((b) => b.addEventListener('click', () => { Kit.sound.init(); Kit.sound.toggleMute(); syncMute(); }));
    Kit.sound.onMute(syncMute);
    syncMute();

    addEventListener('pointerdown', (e) => {
      Kit.sound.init();
      if (e.pointerType === 'touch' && !document.body.classList.contains('touch')) {
        document.body.classList.add('touch');
        fit();
      }
    }, true);
    if (matchMedia('(hover: none) and (pointer: coarse)').matches || /[?&]touch=1/.test(location.search)) document.body.classList.add('touch');

    addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      Kit.sound.init();
      const c = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
      if (c === 'KeyM' && !e.repeat) { Kit.sound.toggleMute(); syncMute(); return; }
      if (G.screen === 'title') {
        if (e.repeat) return;
        if (c === 'Digit1') setOpt('players', 1);
        else if (c === 'Digit2') setOpt('players', 2);
        else if (c === 'KeyE') setOpt('level', 'easy');
        else if (c === 'KeyN') setOpt('level', 'normal');
        else if (c === 'KeyC' && G.players === 1) setOpt('who', G.who === 'teddy' ? 'tommy' : 'teddy');
        else if (c === 'ArrowLeft') pickMountain(-1);
        else if (c === 'ArrowRight') pickMountain(1);
        else if (c === 'Enter' || c === 'Space') play();
        return;
      }
      if (G.screen === 'results') {
        if (e.repeat) return;
        if (c === 'Enter' || c === 'Space') play();
        else if (c === 'Escape' || c === 'KeyQ') showTitle();
        return;
      }
      if (G.paused) {
        if (e.repeat) return;
        if (c === 'KeyP' || c === 'Escape' || c === 'Space' || c === 'Enter') resume();
        else if (c === 'KeyQ') showTitle();
        return;
      }
      if (G.screen === 'play') {
        if ((c === 'KeyP' || c === 'Escape') && !e.repeat) return pause();
        if ((c === 'KeyT' || c === 'Enter' || c === 'NumpadEnter') && !e.repeat) { call(); return; }
        const r = role(c);
        if (!r) return;
        if (r[1] === 'jump' || r[1] === 'swing') { if (!e.repeat) press(r[0], r[1]); return; }
        G.keys[c] = true;
        G.taps[r[0]][r[1]] = true; // a tap shorter than a frame still moves
      }
    });
    addEventListener('keyup', (e) => { G.keys[e.code] = false; });
    addEventListener('blur', () => resetInput());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && G.autoPause && G.screen === 'play' && !G.paused) pause();
      if (document.hidden) Kit.sound.suspend();
      else Kit.sound.resume();
    });

    // touch: a pad for each player, and the brother's face (the high five in 2 players)
    const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (err) { /* a test's pointer: fine */ } };
    document.querySelectorAll('#touch [data-k]').forEach((b) => {
      const k = b.dataset.k, i = +(b.dataset.p || 0);
      const on = (v) => {
        b.classList.toggle('down', v);
        if (k === 'call') { if (v) call(); return; }
        if (k === 'jump' || k === 'swing') { if (v) press(i, k); return; }
        G.touch[i][k] = v ? 1 : 0;
        if (v) G.taps[i][k] = true;
      };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); capture(b, e); on(true); });
      b.addEventListener('pointerup', () => on(false));
      b.addEventListener('pointercancel', () => on(false));
      b.addEventListener('lostpointercapture', () => on(false));
    });
  }

  // ---------- each frame ----------
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - (last || now)) / 1000));
    last = now;
    if (!G.hold) advance(dt);
    draw();
  }
  function advance(dt) {
    G.time += dt;
    G.frame++;
    if (!G.w) return;
    if (!(G.paused || G.screen === 'pause')) {
      G.acc = Math.min(G.acc + dt, 0.25);
      while (G.acc >= DT - 1e-9) {
        G.acc -= DT;
        tick();
      }
      visuals(dt);
    }
  }
  function tick() {
    const w = G.w;
    let ins;
    if (G.demo) {
      if (G.botK++ % 3 === 0) G.botInp = w.players.map((p, i) => IC.bot.decide(w, i));
      else G.botInp = G.botInp.map((b) => ({ lr: b.lr, jump: false, swing: false }));
      ins = G.botInp;
    } else if (G.screen === 'play') ins = readInput();
    else ins = [];
    S.step(w, ins);
    for (let i = 0; i < 2; i++) {
      if (w.events.some((e) => e.type === 'jump' && e.who === i)) G.jumpBuf[i] = 0;
      else G.jumpBuf[i] = Math.max(0, G.jumpBuf[i] - DT);
      if (w.events.some((e) => e.type === 'swing' && e.who === i)) G.swingBuf[i] = 0;
      else G.swingBuf[i] = Math.max(0, G.swingBuf[i] - DT);
    }
    handleEvents(w.events);
    if (G.demo) {
      if (w.phase === 'over' || w.phase === 'won' || w.t > 400) { G.w = newWorld(true); confetti.clear(); }
    } else if ((w.phase === 'over' || w.phase === 'won') && G.screen === 'play') {
      G.overT += DT;
      if (G.overT > (w.phase === 'won' ? 0.6 : 2.2)) showResults();
    }
  }

  // ---------- what the rules said happened ----------
  function handleEvents(evs) {
    const w = G.w;
    const loud = !G.demo;
    const snd = (f, ...a) => { if (loud) f(...a); };
    const P = (i) => w.players[i] || w.players[0];
    for (const e of evs) {
      switch (e.type) {
        case 'go': snd(SFX.go); big('GO!'); break;
        case 'jump': snd(SFX.jump); break;
        case 'land': snd(SFX.land); break;
        case 'break': {
          const color = w.grid[e.k] ? A.ICE[(e.k - 1 + w.mi) % A.ICE.length] : '#ffffff';
          if (e.why !== 'buddy') { shards.burst(e.x, e.y, color, 10); snd(SFX.bonk); if (e.why === 'head') pop(e.x, e.y + 0.4, 'BONK!', 'ice'); }
          break;
        }
        case 'clunk': snd(SFX.clunk); pop(e.x, e.y + 0.3, 'CLUNK!', 'ice'); break;
        case 'swing': snd(SFX.swing); break;
        case 'layer': snd(SFX.layer); pop(P(e.who).x, P(e.who).y + 1.6, '+100'); G.cheerT = 1; break;
        case 'sealIn': snd(SFX.sealIn); break;
        case 'sealBonk': snd(SFX.sealBonk); pop(e.x, e.y + 0.8, e.who >= 0 ? 'ACHOO! +400' : 'ACHOO!', 'big'); confetti.burst(e.x, e.y + 0.4, 0.5, 18, 3, ['#ffffff', '#bff3ff', '#ff9db7']); G.cheerT = 1; break;
        case 'birdBonk': snd(SFX.birdBonk); pop(e.x, e.y + 0.5, e.who >= 0 ? 'PUFF! +800' : 'PUFF!', 'big'); confetti.burst(e.x, e.y, 0.5, 30, 4); G.cheerT = 1; break;
        case 'hit': snd(SFX.hit); G.hitOnce[e.who] = true; pop(e.x, e.y + 1.5, e.why === 'fall' ? 'WHOOPS!' : 'OOF!', 'ouch'); break;
        case 'bubble': snd(SFX.bubble); { const p = P(e.who); pop(p.x, Math.max(w.camY + 0.8, p.y + 1), 'BUBBLE UP!', 'ice'); } break;
        case 'pop': snd(SFX.pop); confetti.burst(e.x, e.y + 0.5, 0.5, 12, 2.5, ['#bff3ff', '#ffffff']); break;
        case 'fill': snd(SFX.fill); pop(e.x, e.y + 0.6, 'PLOP!', 'ice'); break;
        case 'extraLife': snd(SFX.life); pop(P(e.who).x, P(e.who).y + 1.8, 'EXTRA LIFE!', 'big'); break;
        case 'bonus': snd(SFX.bonus); big('BONUS STAGE!', `GRAB THE GIANT ${w.D.vegName}!`); break;
        case 'veg': snd(SFX.veg, 3); pop(e.x, e.y + 0.4, '+300'); confetti.burst(e.x, e.y, 0.5, 10, 2.5); break;
        case 'bigVeg': snd(SFX.bigVeg); pop(e.x, e.y + 0.6, `+${fmt(e.pts)}`, 'big'); confetti.burst(e.x, e.y, 0.6, 70, 6); break;
        case 'timeUp': snd(SFX.timeUp); break;
        case 'clear':
          if (!e.got) snd(SFX.clear);
          G.scene2 = { kind: 'clear', t: 0 };
          big(e.last ? 'TOP OF THE WORLD!' : 'MOUNTAIN CLEAR!', e.got ? `${w.D.veg} GIANT ${w.D.vegName}!` : 'TIME UP!');
          if (loud) store.open(w.level, w.mi + 2);
          break;
        case 'mountain': G.scene2 = null; G.sweep = null; big(`MOUNTAIN ${w.mi + 1}`, w.D.name); break;
        case 'won': snd(SFX.won); break;
        case 'out': if (w.two) toast(`${NAME(P(e.who).who)} IS OUT OF LIVES`); break;
        case 'over': snd(SFX.gameOver); big('GAME OVER'); break;
        case 'buddyIn': snd(SFX.buddy); { const p = w.players[0]; confetti.burst(p.x - p.face, p.y + 1, 0.6, 16, 2.5, ['#ffffff', '#bff3ff']); } break;
        case 'treat': snd(SFX.treat); pop(w.players[0].x, w.players[0].y + 1.5, `${e.e} +100`); break;
        case 'smash': snd(SFX.smash); toast(`${NAME(e.who)} SAYS: SMASH!`); G.sweep = { k: e.k, t: 0, dir: w.players[0].x < 0 ? 1 : -1, done: new Set() }; break;
        case 'cheerUp': snd(SFX.cheerUp); toast(`${NAME(e.who)} SAYS: GO GO GO!`); pop(w.players[0].x, w.players[0].y + 1.6, '+5 SECONDS', 'big'); break;
        case 'hi5': {
          snd(SFX.hi5);
          const a = w.players[0], b = w.players[1] || a;
          pop((a.x + b.x) / 2, Math.max(a.y, b.y) + 1.7, 'HIGH FIVE! ✋ +50', 'big');
          confetti.burst((a.x + b.x) / 2, Math.max(a.y, b.y) + 1.2, 0.6, 30, 3.5);
          break;
        }
      }
    }
  }
  const stageLine = () => (G.w ? `MOUNTAIN ${G.w.mi + 1} · ${G.w.D.name}` : '');

  // ---------- pops, toasts, big words (page text, so 中文 works by itself) ----------
  function pop(x, y, text, cls) {
    if (G.demo) return;
    const [sx, sy] = toScreen(x, y, 0.5);
    const d = document.createElement('div');
    d.className = 'pop' + (cls ? ' ' + cls : '');
    d.textContent = text;
    d.style.left = sx + 'px';
    d.style.top = sy + 'px';
    $('pops').appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }
  function clearPops() { $('pops').innerHTML = ''; }
  let toastTimer = 0;
  function toast(text) {
    if (G.demo) return;
    const t = $('toast');
    t.textContent = text;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  let bigTimer = 0;
  function big(text, small) {
    if (G.demo) return;
    const b = $('bigmsg');
    b.innerHTML = '';
    b.appendChild(document.createTextNode(text));
    if (small) { const s = document.createElement('small'); s.textContent = small; b.appendChild(s); }
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(bigTimer);
    bigTimer = setTimeout(() => b.classList.remove('show'), 1500);
  }
  const speech = {};
  function say(who, text, secs) {
    if (G.demo) return;
    let b = speech[who];
    if (!b) { b = speech[who] = { el: document.createElement('div'), t: 0, text: '' }; b.el.className = 'bubble off'; $('bubbles').appendChild(b.el); }
    if (b.text !== text) { b.el.textContent = text; b.text = text; }
    b.t = secs;
  }
  function placeSpeech(who, x, y, dt) {
    const b = speech[who];
    if (!b) return;
    b.t -= dt;
    const on = b.t > 0 && G.screen === 'play';
    b.el.classList.toggle('off', !on);
    if (!on) return;
    const [sx, sy] = toScreen(x, y, 0.4);
    b.el.style.left = sx + 'px';
    b.el.style.top = sy + 'px';
  }
  function setText(el, s) {
    if (!el || el._t === s) return;
    el._t = s;
    el.textContent = s;
  }

  // ---------- drawing the world ----------
  function cloudsView() {
    const w = G.w;
    if (G.cloudsFor === w.clouds) return;
    G.cloudsFor = w.clouds;
    for (const m of cloudMeshes) { scene.remove(m); m.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    cloudMeshes = w.clouds.map((cl) => {
      const m = A.cloud(cl.hw);
      if (cl.v) A.cloudFace(m);
      if (cl.summit) {
        const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 1.6, 6), Kit.gfx.std('#8a5a2b'));
        pole.position.set(0.9, 0.7, -0.2);
        m.add(pole);
        const flag = new T.Mesh(new T.PlaneGeometry(0.8, 0.5), new T.MeshStandardMaterial({ color: '#ff3d7f', side: T.DoubleSide }));
        flag.position.set(1.32, 1.25, -0.2);
        m.add(flag);
        m.userData.flag = flag;
      }
      scene.add(m);
      return m;
    });
    vegSprites.forEach((s) => A.setEmoji(s, w.D.veg));
    A.setEmoji(bigBird.userData.veg, w.D.veg);
  }
  const FACE_R = -2.02, FACE_L = 2.02;
  const turn = (cur, want, k) => cur + (((want - cur + PI * 3) % (PI * 2)) - PI) * k;
  function signature(who, n) {
    const sig = (Kit.roster.get(who) || {}).signature || ['wave'];
    return sig[(n || 0) % sig.length];
  }
  function visuals(dt) {
    const w = G.w, t = G.time;
    const k = 1 - Math.exp(-16 * dt);
    cloudsView();
    layers.sync(w);
    // the background slides at its own pace (far things move less)
    A.sky.position.y = w.camY + 15;
    A.sun.position.y = 36 + w.camY * 0.92;
    A.hills.position.y = w.camY * 0.3;
    for (const c of A.bgClouds) { c.position.x += c.userData.v * dt; if (c.position.x > 60) c.position.x = -60; }
    w.clouds.forEach((cl, i) => {
      const m = cloudMeshes[i];
      m.position.set(cl.x, cl.k * L, 0);
      m.position.y += cl.v ? Math.sin(t * 2 + i) * 0.03 : 0;
      if (m.userData.flag) m.userData.flag.rotation.y = Math.sin(t * 4) * 0.25;
    });
    // little vegetables on the bonus clouds
    w.vegs.forEach((v, i) => {
      const s = vegSprites[i];
      if (!s) return;
      s.visible = !v.taken;
      s.position.set(v.x, v.y + Math.sin(t * 2.5 + i) * 0.08, 0.4);
    });
    // the big bird and its giant vegetable
    const B = w.big;
    bigBird.visible = !(B.got && G.scene2 && G.scene2.t > 3);
    const bd = bigBird.userData;
    const fly = B.got && G.scene2 ? G.scene2.t : 0;
    bigBird.position.set(B.x, B.y + fly * 2, 0.2);
    bd.bird.rotation.y = B.dir > 0 ? -0.3 : PI + 0.3;
    bd.bird.userData.wings.forEach((wg) => (wg.rotation.x = wg.userData.sz * Math.sin(t * 9) * 0.9));
    bd.bird.position.y = Math.sin(t * 3) * 0.08;
    bd.veg.visible = !B.got;
    bd.veg.position.set(0, B.vy - B.y, 0.1);
    bd.string.position.set(0, (B.vy - B.y) / 2 + 0.2, 0);
    bd.string.scale.y = Math.abs(B.vy - B.y) - 0.6;
    bd.string.visible = !B.got;
    seals(t, dt);
    birds(t, dt);
    const sc = G.scene2;
    if (sc) sc.t += dt;
    G.cheerT = Math.max(0, G.cheerT - dt);
    sweep(dt);
    climbers(dt, k);
    buddy(dt, k);
    spectators(dt, k);
    shards.update(dt);
    confetti.update(dt);
    snow.update(dt, w.camY, t);
    if (sc && (sc.kind === 'win' || sc.kind === 'clear') && Math.floor(sc.t * 2) !== Math.floor((sc.t - dt) * 2)) confetti.rain(-7, 7, w.camY + S.VIEW_H, sc.kind === 'win' ? 30 : 14);
    hud();
  }

  function seals(t, dt) {
    const w = G.w, seen = new Set();
    for (const s of w.seals) {
      seen.add(s.id);
      let m = sealMeshes.get(s.id);
      if (!m) {
        m = sealPool.pop() || A.seal();
        if (!m.parent) scene.add(m);
        if (!m.userData.bub) { const b = A.bubble(); b.scale.setScalar(0.75); b.position.y = 0.45; m.add(b); m.userData.bub = b; }
        m.visible = true;
        sealMeshes.set(s.id, m);
      }
      const u = m.userData;
      u.block.visible = s.carry && s.st === 'walk';
      u.bub.visible = s.st === 'float';
      if (s.st === 'float') {
        m.position.set(s.x, s.y + 0.1, 0.1);
        u.body.rotation.z = Math.sin(t * 3) * 0.3;
        m.rotation.y += dt * 2;
      } else {
        const walking = s.wait <= 0 && w.phase === 'play';
        m.position.set(s.x, s.k * L + (walking ? Math.abs(Math.sin(t * 9 + s.id)) * 0.08 : 0), 0);
        m.rotation.y = s.dir > 0 ? -0.4 : PI + 0.4;
        u.body.rotation.z = walking ? Math.sin(t * 9 + s.id) * 0.12 : 0;
        u.body.userData.flips.forEach((f) => (f.rotation.x = f.userData.sz * (0.5 + Math.sin(t * 12) * 0.3)));
      }
    }
    for (const [id, m] of sealMeshes) if (!seen.has(id)) { m.visible = false; sealMeshes.delete(id); sealPool.push(m); }
  }
  function birds(t, dt) {
    const w = G.w, seen = new Set();
    for (const b of w.birds) {
      seen.add(b.id);
      let m = birdMeshes.get(b.id);
      if (!m) { m = birdPool.pop() || A.bird(b.id); if (!m.parent) scene.add(m); m.visible = true; birdMeshes.set(b.id, m); }
      m.position.set(b.x, b.y + Math.sin(t * 6 + b.id) * 0.1, 0.35);
      if (b.st === 'float') { m.rotation.z += dt * 6; m.scale.setScalar(1 + Math.min(0.5, b.t)); }
      else { m.rotation.set(0, b.vx > 0 ? -0.3 : PI + 0.3, 0); m.scale.setScalar(1); }
      m.userData.wings.forEach((wg) => (wg.rotation.x = wg.userData.sz * Math.sin(t * 22 + b.id) * 0.9));
    }
    for (const [id, m] of birdMeshes) if (!seen.has(id)) { m.visible = false; birdMeshes.delete(id); birdPool.push(m); }
  }
  // the brother's smash: the row's ice bursts into shards as he zooms along it
  function sweep(dt) {
    const sw = G.sweep;
    if (!sw) return;
    sw.t += dt;
    const x = sw.dir > 0 ? -8 + sw.t * 18 : 8 - sw.t * 18;
    for (let c = 0; c < S.COLS; c++) {
      const cx = S.X0 + c + 0.5;
      if (sw.done.has(c) || (sw.dir > 0 ? cx > x : cx < x)) continue;
      sw.done.add(c);
      if (S.cell(G.w, sw.k, c) === 0 && sw.k <= MT.ICE_TOP) shards.burst(cx, sw.k * L - S.BH / 2, A.ICE[(sw.k - 1 + G.w.mi) % A.ICE.length], 6);
    }
    sw.x = Math.max(-7.6, Math.min(7.6, x));
    if (sw.t > 1.1) G.sweep = null;
  }

  function pose(P, who, p, k) {
    // returns the pose mode for a climber, and puts the mallet where it should be
    let mode = 'stand', ph = 0;
    const w = G.w;
    if (p.mode === 'ground') { if (Math.abs(p.vx) > 0.1 && w.phase === 'play') { mode = 'run'; ph = p.walkT * 11; } }
    else if (p.mode === 'air') mode = 'jump';
    else if (p.mode === 'bubble') mode = 'fall';
    Kit.people.pose(P, ph, mode, k);
    P.rig.position.y = 0;
    P.rig.rotation.z = 0;
    // the mallet arm: held out front when walking, straight up in a jump (that's what bonks the ice), swung in front
    if (p.swing > 0) {
      const u = 1 - p.swing / 0.3;
      P.armR.rotation.x = 2.9 - u * 2.5;
      P.armR.rotation.z = 0;
    } else if (p.mode === 'air' && p.vy > -2) { P.armR.rotation.x = PI - 0.12; P.armR.rotation.z = 0; }
    else if (p.mode === 'ground' || p.mode === 'air') { P.armR.rotation.x = Math.max(P.armR.rotation.x, 0.75); }
    return mode;
  }
  function climbers(dt, k) {
    const w = G.w, sc = G.scene2;
    const inPlay = new Set(w.players.map((p) => p.who));
    for (const id of ['teddy', 'tommy']) if (!inPlay.has(id) && !(w.buddy && w.buddy.who === id)) people[id].root.visible = false;
    ball.visible = false;
    peace.visible = false;
    bubbles.forEach((b) => (b.visible = false));
    stars.forEach((s) => (s.visible = false));
    if (sc && sc.kind === 'win') return winPose(sc, k);
    w.players.forEach((p, i) => {
      const P = people[p.who];
      if (p.mode === 'out') { P.root.visible = false; return; }
      const blink = p.inv > 0 && p.dizzy <= 0 && p.mode !== 'bubble' && Math.floor(G.time * 10) % 2 === 0;
      P.root.visible = !blink;
      P.root.scale.setScalar(SCALE);
      let want = p.face > 0 ? FACE_R : FACE_L;
      const cheer = (w.phase === 'clear' && p.mode === 'ground') || (w.buddy && w.buddy.kind === 'hi5');
      if (cheer) want = w.buddy && w.buddy.kind === 'hi5' && w.two ? (w.players[1 - i].x > p.x ? FACE_R : FACE_L) : PI;
      if (p.mode === 'bubble') want = PI;
      P.root.position.set(p.x, p.y, 0.15);
      P.root.rotation.y = turn(P.root.rotation.y, want, Math.min(1, k * 1.4));
      if (cheer && w.buddy && w.buddy.kind === 'hi5') {
        Kit.people.pose(P, 0, 'give', k);
        P.armR.rotation.x = 2.4;
      } else if (cheer) {
        const mode = signature(p.who, w.mi);
        Kit.people.pose(P, G.time * 8, mode, k);
        P.rig.position.y = 0;
        props(P, mode);
      } else pose(P, p.who, p, k);
      if (p.mode === 'bubble') {
        const b = bubbles[i];
        b.visible = true;
        b.position.set(p.x, p.y + 0.55, 0.3);
        b.scale.setScalar(1 + Math.sin(G.time * 5) * 0.04);
        P.root.position.y += Math.sin(G.time * 3) * 0.05;
      }
      if (p.dizzy > 0) {
        P.rig.rotation.z = Math.sin(G.time * 9) * 0.15;
        const s = stars[i];
        s.visible = true;
        P.head.getWorldPosition(v3);
        s.position.set(v3.x, v3.y + 0.3, v3.z);
        s.userData.spin(G.time);
      }
    });
  }
  function props(P, mode) {
    if (mode === 'jumpshot') {
      P.root.position.y += Math.abs(Math.sin(G.time * 4)) * 0.35;
      ball.visible = true;
      Kit.people.handWorld(P, 1, v3);
      ball.position.set(v3.x, v3.y + 0.22 + Math.max(0, Math.sin(G.time * 4)) * 0.7, v3.z + 0.2);
    } else if (mode === 'peace') {
      peace.visible = true;
      P.head.getWorldPosition(v3);
      peace.position.set(v3.x + 0.4, v3.y + 0.28 + Math.sin(G.time * 5) * 0.05, v3.z + 0.3);
    }
  }
  function winPose(sc, k) {
    // the winner (or both brothers) in front of the mountain doing his signature move
    const w = G.w, ids = sc.who;
    const y = Math.max(0, Math.ceil((w.camY + 0.4) / L)) * L;
    ids.forEach((id, i) => {
      const P = people[id];
      P.root.visible = true;
      P.root.scale.setScalar(SCALE * 1.15);
      P.root.position.set(ids.length === 2 ? (i ? 1.3 : -1.3) : 0, y, 1.2);
      P.root.rotation.y = PI;
      const mode = signature(id, id === 'teddy' ? Math.floor(sc.t / 3) : 0);
      Kit.people.pose(P, G.time * 8, mode, k);
      P.rig.position.y = 0;
      P.rig.rotation.z = 0;
      props(P, mode);
    });
    for (const id of ['teddy', 'tommy']) if (!ids.includes(id)) people[id].root.visible = false;
  }

  function buddy(dt, k) {
    const w = G.w, bd = w.buddy;
    treat.visible = false;
    const cl = spectatorClouds[2];
    cl.visible = false;
    if (!bd || bd.kind === 'hi5' || (G.scene2 && G.scene2.kind === 'win')) return;
    const p = w.players[0];
    const B = people[bd.who];
    const r = Kit.roster.get(bd.who) || {};
    const grow = Math.min(1, bd.t * 5) * (bd.t > S.BUDDY_END - 0.2 ? Math.max(0.01, (S.BUDDY_END - bd.t) / 0.2) : 1);
    B.root.visible = true;
    B.root.scale.setScalar(Math.max(0.01, SCALE * (r.buddyScale || 0.8) * grow));
    const side = -(p.face || 1);
    let bx = Math.max(-7.6, Math.min(7.6, p.x + side * 0.95));
    let by = p.y + 0.4 + Math.sin(G.time * 3) * 0.06;
    let mode, want = PI;
    const sw = G.sweep;
    if (bd.kind === 'smash' && bd.t >= S.BUDDY_INTRO && sw) {
      // zooming along the row above, bonking every block
      bx = sw.x;
      by = sw.k * L - S.BH + 0.05;
      want = sw.dir > 0 ? FACE_R : FACE_L;
      mode = 'jump';
    } else if (bd.t < 0.55) mode = signature(bd.who, bd.n);
    else if (bd.t < S.BUDDY_INTRO) mode = 'give';
    else mode = bd.kind === 'cheer' ? signature(bd.who, bd.n + 1) : 'wave';
    B.root.position.set(bx, by, 0.55);
    B.root.rotation.y = turn(B.root.rotation.y, want, 0.5);
    Kit.people.pose(B, G.time * 8, mode, k);
    B.rig.position.y = 0;
    B.rig.rotation.z = 0;
    if (mode === 'jump' && bd.kind === 'smash') { B.armR.rotation.x = 1.6 + Math.sin(G.time * 30) * 1.2; B.armR.rotation.z = 0; }
    if (bd.t < 0.55 || bd.kind === 'cheer') props(B, mode);
    if (!(sw && bd.t >= S.BUDDY_INTRO)) { cl.visible = true; cl.position.set(bx, by - 0.02, 0.5); cl.scale.setScalar(Math.max(0.01, grow)); }
    if (bd.t >= 0.55 && bd.t < 0.9) {
      const u = (bd.t - 0.55) / 0.35;
      treat.visible = true;
      A.setEmoji(treat, bd.treat);
      treat.position.set(bx + (p.x - bx) * u, by + 1 + Math.sin(u * PI) * 0.7 + (p.y + 0.9 - by - 1) * u, 0.8);
    }
  }

  function spectators(dt, k) {
    const w = G.w;
    for (const id of ['foxy', 'froggy']) people[id].root.visible = false;
    spectatorClouds[0].visible = spectatorClouds[1].visible = false;
    if (w.two || G.demo || (G.scene2 && G.scene2.kind === 'win')) return;
    const cheer = G.cheerT > 0 || (G.scene2 && G.scene2.kind === 'clear');
    [['foxy', -9.7], ['froggy', 9.7]].forEach(([id, x], i) => {
      const P = people[id];
      const y = w.camY + 0.55 + Math.sin(G.time * 1.5 + i) * 0.08;
      P.root.visible = true;
      P.root.scale.setScalar(SCALE * 0.92);
      P.root.position.set(x, y, 1.7);
      P.root.rotation.y = PI + (x < 0 ? 0.5 : -0.5);
      Kit.people.pose(P, G.time * 7, cheer ? 'wave' : 'stand', k);
      P.rig.position.y = cheer ? Math.abs(Math.sin(G.time * 7)) * 0.15 : 0;
      const c = spectatorClouds[i];
      c.visible = true;
      c.position.set(x, y, 1.7);
      c.scale.setScalar(1);
    });
  }

  // ---------- HUD ----------
  function hud() {
    const w = G.w;
    if (!w || G.demo) return;
    const top = store.table(w.level)[0].score;
    for (let i = 0; i < 2; i++) {
      const box = $('hudP' + i);
      const pl = w.players[i];
      box.style.display = pl ? '' : 'none';
      if (!pl) continue;
      setText(box.querySelector('.lbl'), NAME(pl.who));
      setText(box.querySelector('.sc'), fmt(pl.score));
      setText(box.querySelector('.lives'), pl.out ? '—' : pl.lives > 6 ? `❤️ ×${pl.lives}` : '❤️'.repeat(Math.max(0, pl.lives)));
    }
    setText($('hudHi'), fmt(Math.max(top, ...w.players.map((p) => p.score))));
    setText($('hudStage'), stageLine());
    const bb = $('bonusBox');
    bb.classList.remove('off');
    const val = $('hudBonus');
    if (w.bonus.on) {
      setText(bb.querySelector('.lbl'), 'BONUS');
      const s = Math.ceil(w.bonus.t);
      setText(val, `⏱ ${s}`);
      val.classList.toggle('low', s <= 10);
      if (s <= 5 && s !== G.tickSnd && w.phase === 'play') { G.tickSnd = s; SFX.tick(); }
    } else {
      setText(bb.querySelector('.lbl'), 'LAYER');
      setText(val, `${Math.min(MT.ICE_TOP, w.hiLayer)}/${MT.ICE_TOP}`);
      val.classList.remove('low');
    }
    const on = !!w.buddy;
    $('budBtn').classList.toggle('on', on);
    document.querySelector('.tb.call').classList.toggle('on', on);
  }

  function draw() {
    if (G.w) { cloudsView(); layers.sync(G.w); }
    placeCamera();
    renderer.render(scene, cam);
  }

  // ---------- test hooks ----------
  function state() {
    const w = G.w;
    if (!w) return { screen: G.screen };
    placeCamera();
    return {
      screen: G.screen, paused: G.paused, demo: G.demo, phase: w.phase, mi: w.mi, level: w.level, two: w.two, camY: +w.camY.toFixed(3), hiLayer: w.hiLayer,
      players: w.players.map((p) => {
        const [sx, sy] = toScreen(p.x, p.y + 0.5, 0.15);
        return { who: p.who, x: +p.x.toFixed(3), y: +p.y.toFixed(3), mode: p.mode, sup: p.sup ? p.sup.k + p.sup.f : '', face: p.face, dizzy: +p.dizzy.toFixed(2), inv: +p.inv.toFixed(2), lives: p.lives, score: p.score, out: p.out, sx: Math.round(sx), sy: Math.round(sy) };
      }),
      seals: w.seals.length, birds: w.birds.length, bonus: w.bonus.on ? +w.bonus.t.toFixed(1) : null, buddy: w.buddy && { kind: w.buddy.kind, who: w.buddy.who, t: +w.buddy.t.toFixed(2) },
      muted: Kit.sound.isMuted(), sfx: Object.assign({}, SFX.log), lang: Kit.lang.get(), touch: document.body.classList.contains('touch'),
    };
  }
  window.game = {
    start(o) {
      o = o || {};
      if (o.players) G.players = o.players;
      if (o.who) G.who = o.who;
      if (o.level) G.level = o.level;
      if (o.mountain != null) G.mi = o.mountain;
      play();
      if (o.mountain != null && G.w.mi !== o.mountain) { S.loadMountain(G.w, o.mountain); }
      if (o.go) { G.w.phase = 'play'; G.w.phaseT = 0; }
      return state();
    },
    step(secs, o) {
      const n = Math.max(1, Math.round((secs || DT) / DT));
      for (let i = 0; i < n; i++) advance(DT);
      if (!o || o.draw !== false) draw();
      return state();
    },
    state,
    hold(v) { G.hold = v !== false; return G.hold; },
    call,
    pause, resume, showTitle, showResults,
    check: (only) => IC.check.run(only),
    checkFail: () => IC.check.fail(),
    // put climber i on layer k at x (tests): the rules stay the real ones
    put(i, k, x) {
      const w = G.w, p = w.players[i || 0];
      Object.assign(p, { x, y: k * L, vx: 0, vy: 0, mode: 'ground', sup: S.supportAt(w, x, k, S.FW) || { k: 'g', f: k }, dizzy: 0, inv: 0, bub: null, swing: 0 });
      if (k > w.hiLayer) { w.hiLayer = k; }
      return state();
    },
    // no seals or birds (tests that only look at moving)
    quiet() { const w = G.w; w.seals = []; w.birds = []; w.sealT = w.birdT = 1e9; return state(); },
    sabotage(s) { G.sab = s || null; return G.sab; },
    toScreen,
    world: () => G.w,
    G,
    calm() { document.body.classList.add('calm'); },
    info() { draw(); const r = renderer.info.render; let meshes = 0; scene.traverseVisible((o) => { if (o.isMesh || o.isSprite) meshes++; }); return { calls: r.calls, triangles: r.triangles, meshes, pixelRatio: renderer.getPixelRatio() }; },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
