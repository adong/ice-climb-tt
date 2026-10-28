/* TT Ice Climb: the 3D things, chunky toy style. The sky, far snowy hills and the sun; the mountain's snowy sides; the ice
   layers (colourful blocks with snow on top and little icicles, drawn as instanced meshes so a whole mountain is a few
   draw calls); puffy clouds; the roly-poly snow seal in his knit hat; little birds; the friendly big bird and its giant
   vegetable; the toy mallet and winter beanies; the rescue bubble; ice shards, confetti, snow and dizzy stars.
   js/game.js places and moves them. */
(function () {
  'use strict';
  const T = THREE, G = Kit.gfx;
  const A = (IC.art = {});
  const S = IC.sim;
  // each layer's ice colour, bottom to top
  const ICE = ['#7fe3ff', '#8cf0d0', '#b9a8ff', '#ff9fd2', '#ffd27f', '#9ad8ff', '#a8f59a', '#ffb3a1', '#c5b8ff'];
  A.ICE = ICE;

  const mats = new Map();
  const mat = (color, o) => {
    const k = color + JSON.stringify(o || {});
    if (!mats.has(k)) mats.set(k, G.std(color, o));
    return mats.get(k);
  };
  // many still meshes with one material drawn as one (fewer draw calls for older iPads)
  function merge(meshes, material) {
    const parts = meshes.map((m) => {
      m.updateMatrix();
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(m.matrix);
      return g;
    });
    const cat = (name, n) => {
      const out = new Float32Array(parts.reduce((a, g) => a + g.attributes.position.count * n, 0));
      let o = 0;
      for (const g of parts) { out.set(g.attributes[name].array, o); o += g.attributes.position.count * n; }
      return new T.BufferAttribute(out, n);
    };
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', cat('position', 3));
    geo.setAttribute('normal', cat('normal', 3));
    if (parts.every((g) => g.attributes.uv)) geo.setAttribute('uv', cat('uv', 2));
    parts.forEach((g) => g.dispose());
    return new T.Mesh(geo, material);
  }
  const at = (geo, x, y, z, rx, ry, rz) => { const m = new T.Mesh(geo); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); return m; };

  // ---------- textures ----------
  function iceTex() {
    const [c, g] = G.makeCanvas(64, 64);
    const gr = g.createLinearGradient(0, 0, 64, 64);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(1, '#d6e8f2');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(10, 50); g.lineTo(28, 14); g.stroke();
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(26, 54); g.lineTo(38, 30); g.stroke();
    g.strokeStyle = 'rgba(20,40,80,0.16)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, 61, 61);
    return G.toTexture(c);
  }
  function snowRockTex() {
    const [c, g] = G.makeCanvas(64, 64);
    g.fillStyle = '#eef5ff';
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(150,175,210,${0.12 + (i % 4) * 0.05})`;
      g.beginPath();
      g.arc((i * 37) % 64, (i * 23) % 64, 3 + (i % 3) * 2, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(70,95,140,0.35)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, 61, 61);
    return G.toTexture(c);
  }

  // ---------- the backdrop: sky, sun, far hills, the mountain's sides, background clouds ----------
  A.backdrop = function (scene) {
    const g = new T.Group();
    scene.add(g);
    // the sky: a tall gradient that the camera slides up (it's far back, so it hardly moves)
    const [c, cx] = G.makeCanvas(4, 256);
    const gr = cx.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#3a7bff');
    gr.addColorStop(0.55, '#8fd3ff');
    gr.addColorStop(1, '#e4f7ff');
    cx.fillStyle = gr;
    cx.fillRect(0, 0, 4, 256);
    const sky = new T.Mesh(new T.PlaneGeometry(400, 220), new T.MeshBasicMaterial({ map: G.toTexture(c), depthWrite: false }));
    sky.position.set(0, 40, -90);
    g.add(sky);
    A.sky = sky;
    const sun = new T.Sprite(new T.SpriteMaterial({ map: G.radialTexture(128, [[0, '#fffbe0'], [0.35, '#ffe680'], [0.6, 'rgba(255,220,120,0.35)'], [1, 'rgba(255,220,120,0)']]), depthWrite: false }));
    sun.scale.set(26, 26, 1);
    sun.position.set(-34, 40, -80);
    g.add(sun);
    A.sun = sun;
    // far snowy hills, two rows: they sink away as you climb (js/game.js moves them slower than the camera)
    const hills = new T.Group();
    const capM = mat('#ffffff', { roughness: 1 });
    [['#a9c8f0', -80, [[-52, 9, 16], [-30, 13, 18], [-6, 10, 15], [16, 14, 19], [40, 11, 16], [62, 13, 18]]],
      ['#c8dcf6', -55, [[-40, 6, 11], [-20, 8, 12], [2, 6, 10], [24, 8, 12], [46, 7, 11]]]].forEach(([col, z, list]) => {
      const hillParts = [], capParts = [];
      list.forEach(([x, h, r]) => {
        hillParts.push(at(new T.ConeGeometry(r, h * 2, 7), x, h - 4, z));
        capParts.push(at(new T.ConeGeometry(r * 0.36, h * 0.72, 7), x, h * 2 - 4 - h * 0.36 + 0.05, z + 0.4));
      });
      hills.add(merge(hillParts, mat(col, { roughness: 1 })), merge(capParts, capM));
    });
    g.add(hills);
    A.hills = hills;
    // the mountain's own sides, left and right of the climb: snowy rock in chunky ledges, snow on every ledge
    const rock = mat('#cddcf0', { roughness: 0.95 }), rockDark = mat('#8fa3c2', { roughness: 0.95 }), ledgeSnow = mat('#ffffff', { roughness: 0.9 });
    const sideParts = [], darkParts = [], snowParts = [];
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 15; i++) {
        const y = -2 + i * 2.4;
        const w = 4.2 + Math.sin(i * 1.7 + sx) * 0.9;
        sideParts.push(at(new T.BoxGeometry(w, 2.4, 3.2), sx * (8 + w / 2), y + 1.0, -0.4));
        // a few lumpy boulders and a pine poking out of the snow
        const bx = sx * (8.7 + ((i * 37) % 23) / 10), br = 0.45 + ((i * 13) % 5) / 10;
        darkParts.push(at(new T.DodecahedronGeometry(br, 0), bx, y + 0.35 + ((i * 7) % 4) / 5, 1.25, i, i * 2, 0));
        if (i % 3 === 1) snowParts.push(at(new T.DodecahedronGeometry(br * 0.7, 0), bx + sx * 0.2, y + 0.75 + ((i * 7) % 4) / 5, 1.35, i, 0, 0));
        snowParts.push(at(new T.BoxGeometry(w + 0.15, 0.22, 3.3), sx * (8 + w / 2 - 0.05), y + 2.25, -0.4));
      }
    }
    g.add(merge(sideParts, rock), merge(darkParts, rockDark), merge(snowParts, ledgeSnow));
    // the snowy ground below the first layer
    const ground = merge([at(new T.BoxGeometry(40, 3, 6), 0, -1.5 - S.BH, -1.6)], mat('#f4f9ff', { roughness: 1 }));
    g.add(ground);
    const trees = [];
    const trunk = [];
    [[-10.6, -0.55], [-12.4, -0.6], [10.8, -0.55], [12.6, -0.6], [-14.5, -0.6], [14.8, -0.6]].forEach(([x, y], i) => {
      const s = 0.9 + (i % 2) * 0.3;
      trees.push(at(new T.ConeGeometry(0.9 * s, 1.6 * s, 7), x, y + 1.3 * s, 0.8), at(new T.ConeGeometry(0.7 * s, 1.3 * s, 7), x, y + 2.1 * s, 0.8));
      trunk.push(at(new T.BoxGeometry(0.25, 0.7, 0.25), x, y + 0.3, 0.8));
    });
    g.add(merge(trees, mat('#2fae6b', { roughness: 0.8 })), merge(trunk, mat('#8a5a2b')));
    // background clouds drifting by
    A.bgClouds = [];
    for (let i = 0; i < 7; i++) {
      const cl = A.cloud(1.6 + (i % 3) * 0.6, true);
      cl.position.set(-40 + i * 13, 6 + ((i * 7) % 5) * 7, -26 - (i % 3) * 6);
      cl.userData.v = 0.4 + (i % 3) * 0.25;
      g.add(cl);
      A.bgClouds.push(cl);
    }
    return g;
  };

  // ---------- the ice layers: instanced blocks, snow on top, icicles under ----------
  A.layers = function (scene) {
    const rows = IC.mountains.ROWS, cols = S.COLS, n = rows * cols;
    const ice = new T.InstancedMesh(new T.BoxGeometry(0.97, S.BH, 1.1), new T.MeshStandardMaterial({ map: iceTex(), roughness: 0.25, metalness: 0.05, emissive: '#1a3a55', emissiveIntensity: 0.12 }), n);
    const hard = new T.InstancedMesh(new T.BoxGeometry(0.99, S.BH, 1.12), new T.MeshStandardMaterial({ map: snowRockTex(), roughness: 0.95 }), n);
    const snow = new T.InstancedMesh(new T.BoxGeometry(1.0, 0.13, 1.16), new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }), n);
    const cone = new T.ConeGeometry(0.09, 0.34, 5);
    cone.rotateX(Math.PI);
    const icicle = new T.InstancedMesh(cone, new T.MeshStandardMaterial({ color: '#dff6ff', roughness: 0.2, emissive: '#9fd8ff', emissiveIntensity: 0.25 }), n * 2);
    for (const m of [ice, hard, snow, icicle]) { m.frustumCulled = false; scene.add(m); }
    const m4 = new T.Matrix4(), zero = new T.Matrix4().makeScale(0, 0, 0), col = new T.Color();
    let ver = -1, mi = -1;
    return {
      ice, hard, snow, icicle,
      sync(w, force) {
        if (!force && w.gridV === ver && w.mi === mi) return;
        ver = w.gridV;
        mi = w.mi;
        for (let k = 0; k < rows; k++) {
          for (let c = 0; c < cols; c++) {
            const i = k * cols + c;
            const v = k < w.grid.length ? w.grid[k][c] : 0;
            const x = S.X0 + c + 0.5, y = k * S.L - S.BH / 2;
            const show = k > 0 && v > 0;
            if (show && v !== 2) {
              m4.makeTranslation(x, y, 0);
              ice.setMatrixAt(i, m4);
              ice.setColorAt(i, col.set(v === 3 ? '#e6f7ff' : ICE[(k - 1 + w.mi) % ICE.length]));
            } else ice.setMatrixAt(i, zero);
            hard.setMatrixAt(i, show && v === 2 ? m4.makeTranslation(x, y, 0) : zero);
            snow.setMatrixAt(i, show ? m4.makeTranslation(x, k * S.L + 0.02, 0) : zero);
            for (let j = 0; j < 2; j++) {
              const h = (k * 31 + c * 17 + j * 7) % 5;
              icicle.setMatrixAt(i * 2 + j, show && h < 2 ? m4.compose(new T.Vector3(x - 0.25 + j * 0.45 + h * 0.05, k * S.L - S.BH - 0.12, 0.45), new T.Quaternion(), new T.Vector3(1, 0.7 + h * 0.35, 1)) : zero);
            }
          }
        }
        for (const m of [ice, hard, snow, icicle]) m.instanceMatrix.needsUpdate = true;
        if (ice.instanceColor) ice.instanceColor.needsUpdate = true;
      },
    };
  };

  // ---------- clouds: puffy white balls in a row; the top of the puffs is where you stand ----------
  A.cloud = function (hw, far) {
    const g = new T.Group();
    const n = Math.max(3, Math.round((hw * 2) / 0.55));
    const parts = [];
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / (n - 1);
      const r = 0.36 + Math.sin(u * Math.PI) * 0.16;
      parts.push(at(new T.SphereGeometry(r, 12, 9), -hw + 0.28 + u * (hw * 2 - 0.56), -0.32 + Math.sin(u * Math.PI) * 0.08, 0));
      if (i % 2) parts.push(at(new T.SphereGeometry(r * 0.8, 10, 8), -hw + 0.28 + u * (hw * 2 - 0.56), -0.12 + Math.sin(u * Math.PI) * 0.1, -0.15));
    }
    const m = merge(parts, new T.MeshStandardMaterial({ color: '#ffffff', emissive: far ? '#c9e6ff' : '#e9f6ff', emissiveIntensity: far ? 0.55 : 0.35, roughness: 0.9 }));
    if (far) m.scale.set(2.2, 1.6, 1.4);
    g.add(m);
    return g;
  };
  // a cute face on the drifting (rideable) clouds
  A.cloudFace = function (cl) {
    const f = new T.Group();
    const eye = mat('#2a3a5a');
    for (const sx of [-1, 1]) {
      const e = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), eye);
      e.position.set(sx * 0.2, -0.25, 0.48);
      f.add(e);
      const ch = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), mat('#ffb3c8'));
      ch.position.set(sx * 0.34, -0.33, 0.44);
      ch.scale.set(1.2, 0.7, 0.5);
      f.add(ch);
    }
    const mouth = new T.Mesh(new T.TorusGeometry(0.07, 0.02, 6, 10, Math.PI), eye);
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, -0.32, 0.49);
    f.add(mouth);
    cl.add(f);
    return f;
  };

  // ---------- the roly-poly snow seal in a knit hat ----------
  A.seal = function () {
    const root = new T.Group();
    const body = new T.Group();
    root.add(body);
    const fur = mat('#eef3fb', { roughness: 0.8 }), grey = mat('#b7c3d6', { roughness: 0.8 }), dark = mat('#1d2335'), pink = mat('#ff9db7');
    const ball = new T.Mesh(new T.SphereGeometry(0.42, 16, 12), fur);
    ball.scale.set(1.15, 0.9, 0.95);
    ball.position.y = 0.38;
    body.add(ball);
    const belly = new T.Mesh(new T.SphereGeometry(0.3, 12, 10), mat('#ffffff'));
    belly.scale.set(1, 0.85, 0.6);
    belly.position.set(0, 0.3, 0.2);
    body.add(belly);
    // the face looks along +x (its walking direction); js/game.js turns it
    for (const sz of [-1, 1]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), dark);
      eye.position.set(0.36, 0.5, sz * 0.13);
      body.add(eye);
      const shine = new T.Mesh(new T.SphereGeometry(0.02, 6, 4), mat('#ffffff'));
      shine.position.set(0.41, 0.53, sz * 0.13 + 0.02);
      body.add(shine);
      const cheek = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), pink);
      cheek.position.set(0.34, 0.38, sz * 0.22);
      cheek.scale.set(0.5, 0.6, 1);
      body.add(cheek);
      const fl = new T.Mesh(new T.BoxGeometry(0.22, 0.06, 0.14), grey);
      fl.position.set(0.1, 0.18, sz * 0.4);
      fl.rotation.x = sz * 0.5;
      fl.userData.sz = sz;
      body.add(fl);
      (body.userData.flips = body.userData.flips || []).push(fl);
    }
    const nose = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), dark);
    nose.position.set(0.47, 0.42, 0);
    body.add(nose);
    for (const sz of [-1, 1]) for (const dy of [-0.02, 0.02]) {
      const wh = new T.Mesh(new T.BoxGeometry(0.16, 0.008, 0.008), dark);
      wh.position.set(0.5, 0.42 + dy, sz * 0.08);
      wh.rotation.y = sz * 0.5;
      body.add(wh);
    }
    const tail = new T.Mesh(new T.BoxGeometry(0.16, 0.05, 0.3), grey);
    tail.position.set(-0.48, 0.1, 0);
    body.add(tail);
    // the knit hat with a pom-pom
    const hat = new T.Mesh(new T.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ff4d6d', { roughness: 0.9 }));
    hat.position.set(0.05, 0.66, 0);
    body.add(hat);
    const cuff = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, 0.08, 14), mat('#ffd400', { roughness: 0.9 }));
    cuff.position.set(0.05, 0.68, 0);
    body.add(cuff);
    const pom = new T.Mesh(new T.SphereGeometry(0.08, 10, 8), mat('#ffffff', { roughness: 1 }));
    pom.position.set(0.05, 0.92, 0);
    body.add(pom);
    // the ice block it pushes (NORMAL)
    const block = new T.Mesh(new T.BoxGeometry(0.5, 0.34, 0.6), new T.MeshStandardMaterial({ color: '#e6f7ff', map: iceTex(), roughness: 0.25 }));
    block.position.set(0.72, 0.17, 0);
    root.add(block);
    root.userData = { body, block };
    return root;
  };

  // ---------- a little bird ----------
  const BIRD_COLS = ['#ff7eb6', '#ffd23f', '#7be0ad', '#8ab6ff'];
  A.bird = function (i, scale) {
    const root = new T.Group();
    const c = BIRD_COLS[(i || 0) % BIRD_COLS.length];
    const body = new T.Mesh(new T.SphereGeometry(0.26, 14, 10), mat(c, { roughness: 0.7 }));
    body.scale.set(1.15, 1, 0.95);
    root.add(body);
    const belly = new T.Mesh(new T.SphereGeometry(0.18, 10, 8), mat('#fff6e0'));
    belly.position.set(0.06, -0.06, 0.12);
    root.add(belly);
    const beak = new T.Mesh(new T.ConeGeometry(0.07, 0.18, 6), mat('#ff9a1f'));
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.32, 0.02, 0);
    root.add(beak);
    for (const sz of [-1, 1]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.045, 8, 6), mat('#1d2335'));
      eye.position.set(0.2, 0.1, sz * 0.14);
      root.add(eye);
    }
    const tuft = new T.Mesh(new T.ConeGeometry(0.05, 0.16, 5), mat(c));
    tuft.position.set(0.05, 0.3, 0);
    root.add(tuft);
    const tail = new T.Mesh(new T.BoxGeometry(0.16, 0.04, 0.16), mat(G.shade(c, -0.15)));
    tail.position.set(-0.3, 0.06, 0);
    tail.rotation.z = 0.4;
    root.add(tail);
    const wings = [];
    for (const sz of [-1, 1]) {
      const pivot = new T.Group();
      pivot.position.set(0, 0.05, sz * 0.2);
      const wg = new T.Mesh(new T.BoxGeometry(0.24, 0.03, 0.3), mat(G.shade(c, -0.1)));
      wg.position.z = sz * 0.15;
      pivot.add(wg);
      pivot.userData.sz = sz;
      root.add(pivot);
      wings.push(pivot);
    }
    root.userData.wings = wings;
    if (scale) root.scale.setScalar(scale);
    return root;
  };

  // ---------- the toy mallet and a winter beanie ----------
  A.mallet = function () {
    const g = new T.Group();
    const handle = new T.Mesh(new T.CylinderGeometry(0.045, 0.05, 0.62, 8), mat('#c98a4b'));
    handle.position.y = -0.31;
    g.add(handle);
    const head = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.38, 14), mat('#ff3d7f', { roughness: 0.5 }));
    head.rotation.z = Math.PI / 2;
    head.position.y = -0.66;
    g.add(head);
    for (const sx of [-1, 1]) {
      const band = new T.Mesh(new T.CylinderGeometry(0.165, 0.165, 0.06, 14), mat('#ffd400'));
      band.rotation.z = Math.PI / 2;
      band.position.set(sx * 0.13, -0.66, 0);
      g.add(band);
    }
    return g;
  };
  A.beanie = function (color, pom) {
    const g = new T.Group();
    const knit = new T.Mesh(new T.BoxGeometry(0.54, 0.2, 0.5), mat(color, { roughness: 0.95 }));
    knit.position.y = 0.3;
    g.add(knit);
    const cuff = new T.Mesh(new T.BoxGeometry(0.56, 0.09, 0.52), mat(G.shade(color, 0.25), { roughness: 0.95 }));
    cuff.position.y = 0.2;
    g.add(cuff);
    const p = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), mat(pom || '#ffffff', { roughness: 1 }));
    p.position.y = 0.45;
    g.add(p);
    return g;
  };

  // ---------- the friendly big bird with the giant vegetable ----------
  A.bigBird = function () {
    const root = new T.Group();
    const bird = A.bird(0, 2.4);
    bird.children[0].material = mat('#ff9a3c', { roughness: 0.7 });
    root.add(bird);
    const string = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 1, 5), mat('#8a5a2b'));
    root.add(string);
    const veg = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture('🥕') }));
    veg.scale.set(1.5, 1.5, 1);
    root.add(veg);
    root.userData = { bird, string, veg, e: '🥕' };
    return root;
  };

  // ---------- the bubble that carries a climber back up ----------
  A.bubble = function () {
    const g = new T.Group();
    const s = new T.Mesh(new T.SphereGeometry(0.78, 20, 14), new T.MeshStandardMaterial({ color: '#bff3ff', transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.1, emissive: '#7fdcff', emissiveIntensity: 0.25, depthWrite: false }));
    g.add(s);
    const shine = new T.Sprite(new T.SpriteMaterial({ map: G.radialTexture(64, [[0, 'rgba(255,255,255,0.95)'], [1, 'rgba(255,255,255,0)']]), depthWrite: false }));
    shine.scale.set(0.4, 0.4, 1);
    shine.position.set(-0.32, 0.34, 0.7);
    g.add(shine);
    g.renderOrder = 4;
    return g;
  };

  // ---------- ice shards: one instanced mesh of little tumbling cubes ----------
  A.shards = function (scene, max) {
    max = max || 240;
    const im = new T.InstancedMesh(new T.BoxGeometry(0.16, 0.16, 0.16), new T.MeshStandardMaterial({ roughness: 0.3, emissive: '#335577', emissiveIntensity: 0.15 }), max);
    im.instanceMatrix.setUsage(T.DynamicDrawUsage);
    im.frustumCulled = false;
    scene.add(im);
    const ps = [], col = new T.Color(), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3(), v = new T.Vector3();
    for (let i = 0; i < max; i++) { im.setColorAt(i, col.set('#ffffff')); m4.makeScale(0, 0, 0); im.setMatrixAt(i, m4); }
    let next = 0;
    return {
      burst(x, y, color, n) {
        for (let i = 0; i < (n || 8); i++) {
          const k = next++ % max;
          ps[k] = { x: x + (Math.random() - 0.5) * 0.6, y: y + (Math.random() - 0.5) * 0.3, z: (Math.random() - 0.5) * 0.8, vx: (Math.random() - 0.5) * 5, vy: 1 + Math.random() * 4, vz: (Math.random() - 0.2) * 3, r: Math.random() * 6, s: 0.6 + Math.random() * 0.9, life: 0.9 + Math.random() * 0.5 };
          im.setColorAt(k, col.set(i % 3 ? color : '#ffffff'));
        }
        im.instanceColor.needsUpdate = true;
      },
      update(dt) {
        for (let k = 0; k < max; k++) {
          const p = ps[k];
          if (!p) continue;
          p.life -= dt;
          if (p.life <= 0) { ps[k] = null; m4.makeScale(0, 0, 0); im.setMatrixAt(k, m4); continue; }
          p.vy -= 14 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          p.r += dt * 9;
          q.setFromEuler(e.set(p.r, p.r * 0.7, 0));
          s.setScalar(p.s * Math.min(1, p.life * 3));
          m4.compose(v.set(p.x, p.y, p.z), q, s);
          im.setMatrixAt(k, m4);
        }
        im.instanceMatrix.needsUpdate = true;
      },
      clear() { for (let k = 0; k < max; k++) if (ps[k]) { ps[k] = null; m4.makeScale(0, 0, 0); im.setMatrixAt(k, m4); } im.instanceMatrix.needsUpdate = true; },
    };
  };

  // ---------- falling snow, a field of points that follows the camera ----------
  A.snowfall = function (scene, n) {
    const geo = new T.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 34; pos[i * 3 + 1] = Math.random() * 16; pos[i * 3 + 2] = -3 + Math.random() * 6; }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const pts = new T.Points(geo, new T.PointsMaterial({ size: 0.16, map: G.dotTexture(), transparent: true, depthWrite: false, color: '#ffffff' }));
    pts.frustumCulled = false;
    scene.add(pts);
    return {
      pts,
      update(dt, camY, t) {
        for (let i = 0; i < n; i++) {
          let y = pos[i * 3 + 1] - dt * (0.6 + (i % 5) * 0.12);
          if (y < -1) y += 16;
          pos[i * 3 + 1] = y;
          pos[i * 3] += Math.sin(t * 0.8 + i) * dt * 0.25;
        }
        pts.position.y = camY - 1;
        geo.attributes.position.needsUpdate = true;
      },
    };
  };

  // ---------- confetti: one instanced mesh of little paper squares (from TT Barrel Climb) ----------
  A.confetti = function (scene, max) {
    max = max || 500;
    const geo = new T.PlaneGeometry(0.16, 0.1);
    const im = new T.InstancedMesh(geo, new T.MeshBasicMaterial({ side: T.DoubleSide }), max);
    im.instanceMatrix.setUsage(T.DynamicDrawUsage);
    im.frustumCulled = false;
    scene.add(im);
    const ps = [];
    const col = new T.Color(), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3(1, 1, 1), v = new T.Vector3();
    const COLS = ['#ff3d7f', '#ffd400', '#18d4ff', '#7dff5a', '#ff8a1f', '#c77dff', '#ffffff'];
    for (let i = 0; i < max; i++) { im.setColorAt(i, col.set(COLS[i % COLS.length])); m4.makeScale(0, 0, 0); im.setMatrixAt(i, m4); }
    let next = 0;
    return {
      burst(x, y, z, n, power, colors) {
        for (let i = 0; i < n; i++) {
          const k = next++ % max;
          const a = Math.random() * Math.PI * 2, sp = (0.4 + Math.random()) * (power || 4);
          ps[k] = { x, y, z: z || 0.5, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp + 1.5, vz: (Math.random() - 0.3) * 2, rx: Math.random() * 6, ry: Math.random() * 6, life: 1.6 + Math.random() * 1.2 };
          im.setColorAt(k, col.set(colors ? colors[i % colors.length] : COLS[k % COLS.length]));
        }
        im.instanceColor.needsUpdate = true;
      },
      rain(x0, x1, y, n) {
        for (let i = 0; i < n; i++) {
          const k = next++ % max;
          ps[k] = { x: x0 + Math.random() * (x1 - x0), y: y + Math.random() * 3, z: 0.6 + Math.random(), vx: (Math.random() - 0.5) * 1.5, vy: -1 - Math.random(), vz: 0, rx: Math.random() * 6, ry: Math.random() * 6, life: 4 + Math.random() * 2 };
          im.setColorAt(k, col.set(COLS[k % COLS.length]));
        }
        im.instanceColor.needsUpdate = true;
      },
      update(dt) {
        for (let k = 0; k < max; k++) {
          const p = ps[k];
          if (!p) continue;
          p.life -= dt;
          if (p.life <= 0) { ps[k] = null; m4.makeScale(0, 0, 0); im.setMatrixAt(k, m4); continue; }
          p.vy -= 6 * dt;
          p.vx *= 1 - 1.2 * dt;
          p.vy = Math.max(p.vy, -2.2);
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          p.rx += dt * 7; p.ry += dt * 5;
          q.setFromEuler(e.set(p.rx, p.ry, 0));
          s.setScalar(Math.min(1, p.life * 2));
          m4.compose(v.set(p.x, p.y, p.z), q, s);
          im.setMatrixAt(k, m4);
        }
        im.instanceMatrix.needsUpdate = true;
      },
      clear() { for (let k = 0; k < max; k++) if (ps[k]) { ps[k] = null; m4.makeScale(0, 0, 0); im.setMatrixAt(k, m4); } im.instanceMatrix.needsUpdate = true; },
    };
  };

  // ---------- spinning stars over a dizzy head ----------
  A.stars = function () {
    const g = new T.Group();
    const tex = G.emojiTexture('⭐');
    for (let i = 0; i < 5; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false }));
      s.scale.set(0.26, 0.26, 1);
      g.add(s);
    }
    g.userData.spin = (t) => g.children.forEach((s, i) => { const a = t * 5 + (i / 5) * Math.PI * 2; s.position.set(Math.cos(a) * 0.36, Math.sin(a * 2) * 0.04, Math.sin(a) * 0.36); });
    return g;
  };
  A.emoji = function (e, size) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture(e), depthTest: false }));
    s.scale.set(size || 0.6, size || 0.6, 1);
    s.renderOrder = 5;
    s.userData.e = e;
    return s;
  };
  A.setEmoji = function (s, e) { if (s.userData.e !== e) { s.material.map = G.emojiTexture(e); s.material.needsUpdate = true; s.userData.e = e; } };
  A.merge = merge;
})();
