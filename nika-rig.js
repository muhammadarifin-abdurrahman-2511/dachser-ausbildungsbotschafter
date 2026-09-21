/* nika-rig.js — rig karet "Nika" (Maskot-Truck), dipakai editor
   (mascot-truck-nika.html) dan presentasi (index.html).
   Sengaja script biasa, bukan ES module: editor harus tetap jalan kalau
   dibuka dobel-klik (file://), dan import modul lokal diblokir di sana.

   const nika = createNika(THREE, { onClipEnd });
   scene.add(nika.root); scene.add(nika.smoke);
   tiap frame: nika.update(dtDetik, performance.now(), hook?)
   hook(R, dt) jalan setelah klip, sebelum pegas: R.add / R.squash / R.E
   (ekspresi) / R.F (spin, emit, blink[2], gaze) buat gerakan dari luar. */
(function () {
  window.createNika = function createNika(THREE, opts) {
    opts = opts || {};

    /* ── cel-shade materials ──────────────────────────────────────────── */
    function ramp(stops) {
      const d = new Uint8Array(stops.length * 4);
      stops.forEach((v, i) => { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; });
      const t = new THREE.DataTexture(d, stops.length, 1, THREE.RGBAFormat);
      t.minFilter = t.magFilter = THREE.NearestFilter;
      t.generateMipmaps = false; t.needsUpdate = true;
      return t;
    }
    const G3 = ramp([120, 196, 255]), G2 = ramp([165, 255]);
    const toon = (name, color, g = G3, x = {}) => new THREE.MeshToonMaterial(Object.assign({ name, color, gradientMap: g }, x));
    const M = {
      bodyBlue: toon('bodyBlue', 0x1f56a8),
      shellWhite: toon('shellWhite', 0xfbfaf6, G2),
      accent: toon('accentYellow', 0xffcb3d, G2),
      tire: toon('tireBlack', 0x2b2d39),
      chrome: toon('chrome', 0xd9dee8, G2),
      glass: toon('glassDark', 0x6fb6e8, G2),
      eyelid: toon('eyelid', 0x1f56a8, G3, { side: 2 }),
      eyeWhite: new THREE.MeshBasicMaterial({ name: 'eyeWhite', color: 0xffffff }),
      iris: toon('iris', 0x2f7fd6, G2),
      pupil: new THREE.MeshBasicMaterial({ name: 'pupilDark', color: 0x15182a }),
      brow: new THREE.MeshBasicMaterial({ name: 'brow', color: 0x2a2118 }),
      shine: new THREE.MeshBasicMaterial({ name: 'eyeShine', color: 0xffffff }),
      blush: new THREE.MeshBasicMaterial({ name: 'blush', color: 0xff9aa8, transparent: true, opacity: 0.55 }),
      dot: new THREE.MeshBasicMaterial({ name: 'jointDot', color: 0xff7a1a })
    };

    /* ── joint rig ────────────────────────────────────────────────────── */
    const truck = new THREE.Group(); truck.name = 'maskotTruck';
    const PROPS = ['rx', 'ry', 'rz', 'x', 'y', 'z', 'sx', 'sy', 'sz'];
    const ident = () => ({ rx: 0, ry: 0, rz: 0, x: 0, y: 0, z: 0, sx: 1, sy: 1, sz: 1 });
    const J = {}, JL = [];
    function joint(name, parent, pos = [0, 0, 0], label = name, soft = 1) {
      const g = new THREE.Group(); g.name = 'J_' + name;
      g.position.set(pos[0], pos[1], pos[2]);
      (parent ? parent.g : truck).add(g);
      const j = { name, label, g, base: pos.slice(), soft, t: ident(), c: ident(), v: ident(), man: {} };
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), M.dot);
      dot.name = 'dot_' + name; j.dot = dot; g.add(dot);
      J[name] = j; JL.push(j);
      return j;
    }
    const jBody = joint('body', null, [0, 0, 0], 'badan (semua)', 1.2);

    /* geometry helpers — parented to joints */
    function roundedShape(w, h, r) {
      const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y);
      s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      return s;
    }
    function slab(j, name, mat, w, h, d, r, pos) {
      const g = new THREE.ExtrudeGeometry(roundedShape(w, h, r), { depth: d, bevelEnabled: false, curveSegments: 10 });
      g.translate(0, 0, -d / 2);
      const m = new THREE.Mesh(g, mat); m.name = name;
      m.position.set(pos[0], pos[1], pos[2] || 0); j.g.add(m); return m;
    }
    function box(j, name, mat, w, h, d, pos) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.name = name;
      m.position.set(pos[0], pos[1], pos[2] || 0); j.g.add(m); return m;
    }

    /* ── cab ──────────────────────────────────────────────────────────── */
    const jCab = joint('cab', jBody, [-2.05, 0.55, 0], 'kabin', 1);
    slab(jCab, 'cabBody', M.bodyBlue, 2.25, 2.15, 2.2, 0.4, [0, 1.07, 0]);
    slab(jCab, 'cabRoofVisor', M.accent, 0.62, 0.2, 2.06, 0.08, [-0.95, 2.07, 0]);
    slab(jCab, 'facePlate', M.bodyBlue, 0.16, 1.15, 1.9, 0.3, [-1.07, 1.51, 0]);
    slab(jCab, 'sideWindowL', M.glass, 0.72, 0.72, 0.12, 0.2, [0.05, 1.5, 1.105]);
    slab(jCab, 'sideWindowR', M.glass, 0.72, 0.72, 0.12, 0.2, [0.05, 1.5, -1.105]);
    for (const s of [1, -1]) slab(jCab, s > 0 ? 'fenderFrontLeft' : 'fenderFrontRight', M.bodyBlue, 1.3, 0.34, 0.12, 0.16, [-0.5, 0.37, 1.12 * s]);

    /* ── face ─────────────────────────────────────────────────────────── */
    const jFace = joint('face', jCab, [-1.07, 1.49, 0], 'muka', 1.1);
    const EYE_R = 0.42;
    const eyeJ = [], pupils = [], lids = [], brows = [];
    for (const s of [1, -1]) {
      const je = joint(s > 0 ? 'eyeL' : 'eyeR', jFace, [-0.02, 0, 0.55 * s], s > 0 ? 'mata kiri' : 'mata kanan', 1.4);
      je.dot.scale.setScalar(0.6);
      eyeJ.push(je);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(EYE_R, 44, 32), M.eyeWhite);
      eye.name = s > 0 ? 'eyeLeft' : 'eyeRight'; eye.scale.set(0.92, 1.12, 1); je.g.add(eye);

      const p = new THREE.Group(); p.name = s > 0 ? 'pupilLeft' : 'pupilRight';
      const mk = (r, mat, sc, pos, nm) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 26, 20), mat);
        m.name = p.name + nm; m.scale.set(sc, 1.05, 1); m.position.set(pos[0], pos[1], pos[2]); p.add(m);
      };
      mk(0.215, M.iris, 0.42, [0, 0, 0], 'Iris');
      mk(0.105, M.pupil, 0.42, [-0.035, 0, 0], 'Core');
      mk(0.078, M.shine, 0.42, [-0.075, 0.1, 0.09 * s], 'ShineA');
      mk(0.042, M.shine, 0.42, [-0.075, -0.1, -0.07 * s], 'ShineB');
      p.position.set(-0.33, 0, 0); je.g.add(p); pupils.push(p);

      const lidG = new THREE.Group(); lidG.name = 'eyelid' + (s > 0 ? 'L' : 'R');
      const lid = new THREE.Mesh(new THREE.SphereGeometry(EYE_R + 0.035, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.eyelid);
      lid.name = lidG.name + 'Shell'; lid.scale.set(0.94, 1.12, 1.02); lidG.add(lid);
      je.g.add(lidG); lids.push(lidG);

      const browG = new THREE.Group(); browG.name = 'brow' + (s > 0 ? 'L' : 'R');
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.11, 0.66), M.brow);
      brow.name = browG.name + 'Bar'; browG.add(brow);
      browG.position.set(-0.26, 0.5, 0); je.g.add(browG); brows.push(browG);

      const bl = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 18), M.blush);
      bl.name = s > 0 ? 'blushLeft' : 'blushRight';
      bl.scale.set(0.2, 0.62, 1.15); bl.position.set(-0.06, -0.52, 0.72 * s); jFace.g.add(bl);
    }
    const jMouth = joint('mouth', jFace, [-0.27, -0.86, 0], 'mulut', 1.5);
    jMouth.dot.scale.setScalar(0.6);
    const mouthOpen = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), M.pupil);
    mouthOpen.name = 'mouthOpen'; mouthOpen.scale.set(0.07, 0.02, 0.06); jMouth.g.add(mouthOpen);
    const smileGroup = new THREE.Group(); smileGroup.name = 'smile';
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.065, 20, 48, Math.PI), M.pupil);
    smile.rotation.z = Math.PI; smileGroup.add(smile);
    smileGroup.rotation.y = Math.PI / 2; jMouth.g.add(smileGroup);

    /* ── front end, mirrors, stack ────────────────────────────────────── */
    const jNose = joint('nose', jCab, [-1.09, -0.03, 0], 'bumper', 1);
    slab(jNose, 'bumper', M.accent, 0.46, 0.5, 2.3, 0.16, [0, 0, 0]);
    for (const s of [1, -1]) {
      const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 28), M.shellWhite);
      hl.name = s > 0 ? 'headlightLeft' : 'headlightRight';
      hl.rotation.z = Math.PI / 2; hl.position.set(-0.24, 0, 0.82 * s); jNose.g.add(hl);
    }
    const jMirror = [];
    for (const s of [1, -1]) {
      const jm = joint(s > 0 ? 'mirrorL' : 'mirrorR', jCab, [-0.95, 1.79, 1.22 * s], s > 0 ? 'spion kiri' : 'spion kanan', 1.8);
      jm.dot.scale.setScalar(0.6); jMirror.push(jm);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.36, 16), M.chrome);
      arm.name = 'mirrorArm' + (s > 0 ? 'L' : 'R'); arm.rotation.x = Math.PI / 2; arm.position.z = 0; jm.g.add(arm);
      slab(jm, 'mirror' + (s > 0 ? 'L' : 'R'), M.pupil, 0.14, 0.32, 0.1, 0.05, [0, -0.04, 0.2 * s]);
    }
    const jStack = joint('stack', jCab, [1.03, 1.0, -0.95], 'knalpot', 1.6);
    jStack.dot.scale.setScalar(0.6);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 1.75, 28), M.chrome);
    stack.name = 'exhaustStack'; jStack.g.add(stack);

    /* ── trailer ──────────────────────────────────────────────────────── */
    const jHitch = joint('hitch', jBody, [-1.0, 0.86, 0], 'sambungan', 1);
    box(jHitch, 'fifthWheel', M.chrome, 0.7, 0.18, 1.1, [0, 0, 0]);
    const jTrailer = joint('trailer', jHitch, [0, 0, 0], 'boks trailer', 1.1);
    slab(jTrailer, 'trailerBody', M.shellWhite, 4.1, 2.3, 2.2, 0.22, [2.15, 1.09, 0]);
    slab(jTrailer, 'trailerStripeL', M.bodyBlue, 3.9, 0.36, 0.08, 0.1, [2.15, 1.6, 1.105]);
    slab(jTrailer, 'trailerStripeR', M.bodyBlue, 3.9, 0.36, 0.08, 0.1, [2.15, 1.6, -1.105]);
    slab(jTrailer, 'trailerRearDoor', M.bodyBlue, 0.1, 1.9, 2.0, 0.16, [4.2, 1.04, 0]);
    box(jTrailer, 'chassis', M.tire, 4.3, 0.26, 1.5, [2.05, -0.14, 0]);
    const jAxle = joint('axle', jTrailer, [2.25, -0.34, 0], 'as belakang', 1.2);

    /* ── wheels (joint → spin group) ──────────────────────────────────── */
    const spins = [];
    function wheel(name, parent, pos, label) {
      const j = joint(name, parent, pos, label, 1.5);
      j.dot.scale.setScalar(0.55);
      const g = new THREE.Group(); g.name = name + 'Spin'; j.g.add(g); spins.push(g);
      const zs = Math.sign(pos[2]) || 1;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.38, 40), M.tire);
      t.name = name + 'Tire'; t.rotation.x = Math.PI / 2; g.add(t);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.42, 32), M.chrome);
      h.name = name + 'Hub'; h.rotation.x = Math.PI / 2; g.add(h);
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.085, 24, 18), M.accent);
      c.name = name + 'Cap'; c.position.z = 0.215 * zs; g.add(c);
      const face = 0.215 * zs;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const lug = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.05, 6), M.pupil);
        lug.name = name + 'Lug' + i; lug.rotation.x = Math.PI / 2;
        lug.position.set(Math.cos(a) * 0.165, Math.sin(a) * 0.165, face); g.add(lug);
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.03), M.chrome);
        sp.name = name + 'Spoke' + i;
        sp.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, face - 0.02); sp.rotation.z = a; g.add(sp);
      }
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const tb = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.34), M.pupil);
        tb.name = name + 'Tread' + i;
        tb.position.set(Math.cos(a) * 0.525, Math.sin(a) * 0.525, 0); tb.rotation.z = a; g.add(tb);
      }
      return j;
    }
    wheel('wheelFL', jCab, [-0.5, -0.03, 1.02], 'roda depan kiri');
    wheel('wheelFR', jCab, [-0.5, -0.03, -1.02], 'roda depan kanan');
    wheel('wheelRLA', jAxle, [0, 0, 1.02], 'roda blkg kiri 1');
    wheel('wheelRRA', jAxle, [0, 0, -1.02], 'roda blkg kanan 1');
    wheel('wheelRLB', jAxle, [1.1, 0, 1.02], 'roda blkg kiri 2');
    wheel('wheelRRB', jAxle, [1.1, 0, -1.02], 'roda blkg kanan 2');

    /* ── blinkers ─────────────────────────────────────────────────────── */
    const blinkerMat = [0, 1].map((i) => new THREE.MeshBasicMaterial({
      name: i ? 'blinkerRight' : 'blinkerLeft', color: 0x9a7a28
    }));
    [1, -1].forEach((s, i) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), blinkerMat[i]);
      f.name = (i ? 'blinkerRight' : 'blinkerLeft') + 'Front';
      f.position.set(-0.16, 0.26, 1.0 * s); jNose.g.add(f);
      const r = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), blinkerMat[i]);
      r.name = (i ? 'blinkerRight' : 'blinkerLeft') + 'Rear';
      r.position.set(4.26, 0.19, 0.88 * s); jTrailer.g.add(r);
    });

    /* ── ink outline ──────────────────────────────────────────────────── */
    // aspect = lebar/tinggi canvas; default 1 = persis seperti versi asli.
    // Dengan aspect yang benar garisnya sama tebal horizontal & vertikal.
    const INK = new THREE.ShaderMaterial({
      name: 'inkOutline', side: THREE.BackSide,
      uniforms: { thickness: { value: 0.0055 }, aspect: { value: 1 }, ink: { value: new THREE.Color(0x2a2118) } },
      vertexShader: `uniform float thickness; uniform float aspect;
        void main(){ vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);
          vec3 n=normalize(normalMatrix*normal);
          vec2 o=(projectionMatrix*vec4(n,0.0)).xy;
          if(length(o)>0.0001){ vec2 d=normalize(vec2(o.x*aspect,o.y)); p.xy+=vec2(d.x/aspect,d.y)*thickness*p.w; }
          gl_Position=p; }`,
      fragmentShader: `uniform vec3 ink; void main(){ gl_FragColor=vec4(ink,1.0); }`
    });
    const SKIP_INK = /^dot_|Shine|blush|Lug|Spoke|Cap|Tread|smile|mouthOpen|blinker|Window/;
    truck.traverse((o) => {
      if (!o.isMesh || SKIP_INK.test(o.name) || o.name.endsWith('Ink')) return;
      const sh = new THREE.Mesh(o.geometry, INK); sh.name = o.name + 'Ink'; o.add(sh);
    });

    /* ── smoke ────────────────────────────────────────────────────────── */
    const smokeGroup = new THREE.Group(); smokeGroup.name = 'smoke';
    const smoke = [];
    for (let i = 0; i < 60; i++) {
      const mat = new THREE.MeshBasicMaterial({ name: 'smoke', color: 0xf4f2ec, transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), mat);
      mesh.visible = false; smokeGroup.add(mesh);
      smoke.push({ mesh, mat, life: 0, dur: 1, s0: 0.4, s1: 1, o: 0.3, vel: new THREE.Vector3() });
    }
    let sc = 0;
    const wpos = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3();
    function puff(x, y, z, strength) {
      sc = (sc + 1) % smoke.length; const p = smoke[sc];
      wpos.set(x, y, z); truck.localToWorld(wpos);
      // Asap ikut skala & arah truck: di editor (truck diam, skala 1) hasilnya sama
      // seperti dulu; di presentasi asap tetap keluar ke belakang walau truck berbalik.
      const k = truck.getWorldScale(ws).x;
      p.mesh.position.copy(wpos); p.mesh.visible = true; p.life = 0;
      p.dur = 0.8 + Math.random() * 0.7;
      p.s0 = (0.3 + Math.random() * 0.25) * k; p.s1 = p.s0 * (2.4 + Math.random() * 1.2);
      p.o = 0.4 * strength;
      p.vel.set(0.6 + Math.random() * 0.8, 0.45 + Math.random() * 0.7, (Math.random() - 0.5) * 0.6)
        .applyQuaternion(truck.getWorldQuaternion(wq)).multiplyScalar(k);
    }

    /* ── pose API ─────────────────────────────────────────────────────── */
    const G = { k: 150, d: 9, speed: 1 };
    function add(name, p) {
      const j = J[name]; if (!j) return;
      for (const key in p) {
        if (key[0] === 's') j.t[key] *= p[key]; else j.t[key] += p[key];
      }
    }
    // volume-preserving squash: sy>1 = melar tinggi, sy<1 = gepeng
    function squash(name, sy, axis = 'y') {
      const inv = 1 / Math.sqrt(Math.max(0.05, sy));
      if (axis === 'y') add(name, { sy, sx: inv, sz: inv });
      else add(name, { sx: sy, sy: inv, sz: inv });
    }
    const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
    const step = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
    const bell = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));

    /* face expression targets */
    const E = { lid: 0, brow: 0, tilt: 0, asym: 0, mouth: 0, smile: 0.12, pupil: 1 };
    const cur = Object.assign({}, E);
    let spinRate = 0, emitRate = 0, gaze = null, blink = [0, 0];
    const dirV = new THREE.Vector3();
    const dir3 = (x, y, z) => dirV.set(x, y, z).normalize();

    /* ── clips: gaya karet, lebay, overshoot ──────────────────────────── */
    const CLIPS = {
      ngakak: { label: 'Ngakak (Nika)', dur: 2.6, fn(u) {
        const env = Math.sin(Math.PI * clamp01(u)) ** 0.5;
        const b = Math.sin(u * Math.PI * 9);
        squash('body', 1 + 0.3 * b * env);
        add('body', { y: 0.55 * Math.abs(Math.sin(u * Math.PI * 4.5)) * env, rz: 0.08 * Math.sin(u * 11) * env });
        add('cab', { rz: -0.22 * env * Math.sin(u * 13), ry: 0.1 * Math.sin(u * 7) * env });
        add('trailer', { rz: 0.16 * Math.sin(u * 9 + 1) * env, ry: -0.12 * Math.sin(u * 6) * env });
        squash('trailer', 1 - 0.22 * b * env, 'x');
        add('face', { rz: 0.14 * Math.sin(u * 15) * env, y: 0.06 * env });
        add('mouth', { sy: 1 + 2.4 * env, sx: 1 + 0.6 * env });
        add('stack', { rz: 0.3 * Math.sin(u * 16) * env });
        jMirror.forEach((m, i) => add(m.name, { rz: (i ? -1 : 1) * 0.9 * Math.sin(u * 14) * env }));
        ['wheelFL', 'wheelFR', 'wheelRLA', 'wheelRRA'].forEach((w, i) =>
          add(w, { y: 0.14 * Math.sin(u * 12 + i) * env }));
        E.smile = 0.4 + 0.6 * env; E.mouth = env; E.lid = 0.62 * env; E.brow = 0.85 * env;
        E.pupil = 1 - 0.2 * env;
        emitRate = 0.35 * env;
        spinRate = 5 * env;
      } },
      molor: { label: 'Molor (karet)', dur: 2.4, fn(u) {
        const wind = bell(u, 0.12, 0.09), pull = step(0.16, 0.45, u) * (1 - step(0.58, 0.78, u));
        squash('body', 1 - 0.35 * wind, 'x');
        squash('body', 1 + 1.15 * pull, 'x');
        add('cab', { x: -1.5 * pull, rz: -0.18 * pull });
        add('trailer', { sx: 1 + 0.5 * pull });
        add('face', { sx: 1 + 0.5 * pull, rz: -0.1 * pull });
        add('nose', { sx: 1 + 0.6 * pull, x: -0.25 * pull });
        add('mouth', { sy: 1 + 1.6 * pull });
        E.mouth = 0.9 * pull; E.lid = -0.3 * pull; E.brow = 0.9 * pull; E.smile = 0.2 + 0.5 * pull;
        gaze = dir3(-1, 0.05, 0);
        spinRate = 8 * pull;
      } },
      melenting: { label: 'Melenting', dur: 2.2, fn(u) {
        const hop = (p) => Math.max(0, Math.sin(Math.PI * clamp01((u - p) / 0.34)));
        const h = hop(0.08) + 0.75 * hop(0.5) + 0.45 * hop(0.82);
        const crush = bell(u, 0.06, 0.05) + bell(u, 0.46, 0.05) + bell(u, 0.8, 0.05);
        squash('body', 1 + 0.45 * h - 0.4 * crush);
        add('body', { y: 1.5 * h });
        add('trailer', { rz: -0.2 * h + 0.14 * crush });
        add('cab', { rz: 0.16 * h });
        add('face', { y: 0.05 * h });
        ['wheelFL', 'wheelFR', 'wheelRLA', 'wheelRRA', 'wheelRLB', 'wheelRRB'].forEach((w) =>
          add(w, { y: -0.16 * h }));
        E.lid = -0.25 * h; E.brow = 0.8 * h; E.mouth = 0.55 * h; E.smile = 0.5 + 0.4 * h;
        spinRate = 10 * h;
      } },
      ngebut: { label: 'Ngebut', dur: 3.6, fn(u) {
        const rev = step(0, 0.1, u) * (1 - step(0.86, 1, u));
        const launch = bell(u, 0.09, 0.06), brake = bell(u, 0.9, 0.05);
        squash('body', 1 - 0.18 * launch + 0.12 * brake, 'x');
        add('body', { rz: -0.16 * launch + 0.12 * brake, x: -0.2 * step(0.05, 0.4, u) * (1 - step(0.85, 1, u)) });
        add('cab', { rx: 0.03 * Math.sin(u * 44) * rev });
        add('trailer', { rz: 0.1 * launch, ry: 0.05 * Math.sin(u * 9) * rev });
        add('face', { x: -0.06 * rev });
        add('stack', { rz: -0.12 * rev });
        E.lid = 0.34 * rev; E.brow = -0.5 * rev; E.tilt = 0.55 * rev;
        E.mouth = 0.3 * rev; E.smile = 0.15 + 0.5 * rev;
        gaze = dir3(-1, 0.04, 0);
        spinRate = 24 * rev; emitRate = rev;
      } },
      belokKiri: { label: 'Belok kiri', dur: 4.2, fn(u) { turn(u, 1); } },
      belokKanan: { label: 'Belok kanan', dur: 4.2, fn(u) { turn(u, -1); } },
      rem: { label: 'Rem', dur: 2.4, fn(u) {
        const rev = 1 - step(0.15, 0.4, u), shock = bell(u, 0.33, 0.13);
        squash('body', 1 + 0.3 * shock, 'x');
        add('body', { rz: -0.06 * rev + 0.2 * bell(u, 0.3, 0.07) - 0.06 * bell(u, 0.52, 0.09) });
        add('trailer', { rz: -0.24 * shock, ry: 0.1 * shock });
        add('face', { x: -0.12 * shock });
        add('mouth', { sy: 1 + 1.2 * shock });
        jMirror.forEach((m, i) => add(m.name, { rz: (i ? -1 : 1) * 0.7 * shock }));
        E.lid = -0.32 * shock; E.brow = 1 * shock; E.mouth = 0.85 * shock;
        E.smile = -0.75 * shock; E.pupil = 1 - 0.35 * shock;
        gaze = dir3(-1, -0.2, 0);
        spinRate = 20 * rev; emitRate = 0.8 * (1 - step(0.2, 0.55, u));
      } }
    };
    function turn(u, d) {
      const idx = d > 0 ? 0 : 1;
      const check = 1 - step(0.26, 0.32, u);
      const swing = step(0.3, 0.62, u) - step(0.76, 1, u);
      if (u < 0.82) blink[idx] = Math.sin(u * 34) > 0 ? 1 : 0;
      add('body', { ry: d * 0.12 * Math.sin(u * 16) * check + d * 0.8 * swing, rx: -d * 0.11 * swing, rz: -0.04 * swing, z: d * 0.55 * swing, x: -0.35 * swing });
      add('cab', { ry: d * 0.22 * swing });
      add('trailer', { ry: -d * 0.3 * swing, rz: 0.08 * swing });
      add('face', { ry: d * 0.25 * (check * 0.7 + swing) });
      add('wheelFL', { ry: d * 0.5 * swing }); add('wheelFR', { ry: d * 0.5 * swing });
      E.lid = 0.18 * check; E.asym = d * (0.6 * check + 0.25 * swing);
      E.brow = 0.25 * check; E.smile = 0.3 + 0.2 * swing;
      gaze = dir3(-1, 0, d * 1.1);
      spinRate = 4 + 11 * swing; emitRate = 0.45 * swing;
    }

    /* ── playback + keyframes ─────────────────────────────────────────── */
    const anim = { name: null, t: 0, loop: false };
    const kf = { frames: [], t: null };          // t === null → keyframe tidak diputar
    function play(name, loop) {
      if (!CLIPS[name]) return;
      kf.t = null;
      anim.name = name; anim.t = 0; anim.loop = !!loop;
    }
    function stop() { anim.name = null; }
    function kfSample(time) {
      const KF = kf.frames;
      if (KF.length === 0) return;
      let a = KF[0], b = KF[KF.length - 1];
      for (let i = 0; i < KF.length - 1; i++) if (time >= KF[i].t && time <= KF[i + 1].t) { a = KF[i]; b = KF[i + 1]; break; }
      const span = Math.max(1e-4, b.t - a.t);
      const w = clamp01((time - a.t) / span), s = w * w * (3 - 2 * w);
      const names = new Set([...Object.keys(a.pose), ...Object.keys(b.pose)]);
      names.forEach((n) => {
        const pa = a.pose[n] || {}, pb = b.pose[n] || {}, out = {};
        PROPS.forEach((k) => {
          const base = k[0] === 's' ? 1 : 0;
          const va = pa[k] ?? base, vb = pb[k] ?? base;
          if (va !== base || vb !== base) out[k] = va + (vb - va) * s;
        });
        add(n, out);
      });
    }

    /* ── frame update ─────────────────────────────────────────────────── */
    const F = { spin: 0, emit: 0, blink: [0, 0], gaze: null };
    const hookApi = { add, squash, E, F, J };
    const tmp = new THREE.Vector3();
    let blinkIn = 1.6 + Math.random() * 3, blinkT = 2;

    function update(dtReal, now, hook) {
      const dt = dtReal * G.speed;

      JL.forEach((j) => { j.t = ident(); });
      spinRate = 0; emitRate = 0; gaze = null; blink = [0, 0];
      E.lid = 0; E.brow = 0; E.tilt = 0; E.asym = 0; E.mouth = 0; E.smile = 0.12; E.pupil = 1;

      if (!anim.name && kf.t === null) {
        add('body', { y: 0.012 * Math.sin(now / 900), ry: 0.008 * Math.sin(now / 1700) });
        add('trailer', { rz: 0.006 * Math.sin(now / 1300) });
      }
      blinkIn -= dt;
      if (blinkIn <= 0) { blinkT = 0; blinkIn = 2.2 + Math.random() * 4.5; }
      if (blinkT < 1) { blinkT += dt / 0.16; E.lid = Math.max(E.lid, Math.sin(Math.PI * Math.min(blinkT, 1))); }

      if (anim.name) {
        anim.t += dt;
        const c = CLIPS[anim.name], u = anim.t / c.dur;
        if (u >= 1) {
          if (anim.loop) { anim.t = 0; c.fn(0); }
          else { anim.name = null; if (opts.onClipEnd) opts.onClipEnd(); }
        } else c.fn(u);
      }
      if (kf.t !== null && kf.frames.length) {
        kf.t += dt;
        const end = kf.frames[kf.frames.length - 1].t;
        if (kf.t > end + 0.6) kf.t = 0;
        kfSample(Math.min(kf.t, end));
      }
      if (hook) {
        F.spin = 0; F.emit = 0; F.blink[0] = F.blink[1] = 0; F.gaze = null;
        hook(hookApi, dt);
        spinRate += F.spin; emitRate = Math.max(emitRate, F.emit);
        blink[0] = blink[0] || F.blink[0]; blink[1] = blink[1] || F.blink[1];
        if (!gaze && F.gaze) gaze = F.gaze;
      }
      JL.forEach((j) => { for (const k in j.man) { if (k[0] === 's') j.t[k] *= j.man[k]; else j.t[k] += j.man[k]; } });

      // spring integration (2 substeps for stability)
      for (let s = 0; s < 2; s++) {
        const h = dt / 2;
        JL.forEach((j) => {
          const k = G.k / j.soft, d = G.d * Math.sqrt(1 / j.soft);
          PROPS.forEach((p) => {
            const a = k * (j.t[p] - j.c[p]) - d * j.v[p];
            j.v[p] += a * h; j.c[p] += j.v[p] * h;
          });
        });
      }
      JL.forEach((j) => {
        j.g.position.set(j.base[0] + j.c.x, j.base[1] + j.c.y, j.base[2] + j.c.z);
        j.g.rotation.set(j.c.rx, j.c.ry, j.c.rz);
        j.g.scale.set(Math.max(0.05, j.c.sx), Math.max(0.05, j.c.sy), Math.max(0.05, j.c.sz));
        if (j.dot.visible) {
          const sx = j.g.scale.x || 1, sy = j.g.scale.y || 1, sz = j.g.scale.z || 1;
          j.dot.scale.set(1 / sx, 1 / sy, 1 / sz);
        }
      });

      blinkerMat[0].color.setHex(blink[0] ? 0xffd24a : 0x9a7a28);
      blinkerMat[1].color.setHex(blink[1] ? 0xffd24a : 0x9a7a28);
      // += : truck menghadap -X, jadi putaran positif di sumbu Z = roda menggelinding maju
      spins.forEach((g) => { g.rotation.z += spinRate * dt; });

      if (emitRate > 0.02) {
        const n = emitRate * dt * 26;
        for (let i = 0; i < n + Math.random(); i++) {
          puff(2.75 + Math.random() * 0.5, 0.3, (Math.random() < 0.5 ? 1 : -1) * 1.05, emitRate);
          if (Math.random() < 0.5) puff(-1.02, 2.45, -0.95, emitRate * 0.8);
        }
      }
      smoke.forEach((p) => {
        if (!p.mesh.visible) return;
        p.life += dt; const k = p.life / p.dur;
        if (k >= 1) { p.mesh.visible = false; p.mat.opacity = 0; return; }
        p.mesh.position.addScaledVector(p.vel, dt);
        p.vel.multiplyScalar(1 - 1.1 * dt);
        p.mesh.scale.setScalar(p.s0 + (p.s1 - p.s0) * k);
        p.mat.opacity = p.o * (1 - k) * Math.min(1, k * 7);
      });

      const ek = 1 - Math.pow(0.0015, dt);
      for (const key in E) cur[key] += (E[key] - cur[key]) * ek;
      eyeJ.forEach((je, i) => {
        let d;
        if (gaze) d = gaze.clone();
        else if (api.look) {
          d = je.g.worldToLocal(api.look.clone()).normalize();
          if (d.x > -0.4) { d.x = -0.4; d.normalize(); }
        } else d = new THREE.Vector3(-1, 0, 0);
        tmp.copy(d).multiplyScalar(0.33);
        pupils[i].position.lerp(tmp, 1 - Math.pow(0.001, dt));
        pupils[i].scale.setScalar(cur.pupil);
        const side = i === 0 ? 1 : -1;
        lids[i].rotation.z = -0.5 + Math.max(-0.25, cur.lid) * 1.9;
        brows[i].position.y = 0.5 + 0.11 * cur.brow;
        brows[i].position.x = -0.26 - 0.03 * cur.brow;
        brows[i].rotation.x = side * (0.55 * cur.tilt + 0.5 * (side > 0 ? cur.asym : -cur.asym));
      });
      const sm = cur.smile;
      smileGroup.scale.set(1 + 0.45 * Math.abs(sm), (sm < 0 ? -1 : 1) * (0.9 + 0.6 * Math.abs(sm)), 1);
      smileGroup.position.y = -0.05 * Math.max(0, sm) + 0.16 * Math.max(0, -sm);
      mouthOpen.visible = cur.mouth > 0.03;
      mouthOpen.scale.set(0.075, 0.03 + 0.25 * cur.mouth, 0.07 + 0.3 * cur.mouth);
      mouthOpen.position.y = -0.02 - 0.16 * cur.mouth;
    }

    const api = {
      root: truck, smoke: smokeGroup, ink: INK,
      M, J, JL, PROPS, ident, CLIPS, G, E, anim, kf,
      add, squash, play, stop, update,
      look: null                                  // titik dunia yang dilirik mata (atau null)
    };
    return api;
  };
})();
