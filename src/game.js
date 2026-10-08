import * as THREE from "three";
export class FootballGame {
  constructor(
    container,
    {
      onUpdate = () => {},
      onEnd = () => {},
      mode = "preview",
      network = null,
      difficulty = 1,
    } = {},
  ) {
    this.container = container;
    this.onUpdate = onUpdate;
    this.onEnd = onEnd;
    this.mode = mode;
    this.network = network;
    this.difficulty = difficulty;
    this.keys = {};
    this.input = { x: 0, z: 0, sprint: false };
    this.elapsed = 0;
    this.duration = 90;
    this.score = [0, 0];
    this.finished = false;
    this.started = mode !== "preview";
    this.paused = false;
    this.controlled = [2, 7];
    this.owner = 2;
    this.ball = { x: -6, z: 0, vx: 0, vz: 0, y: 0.4 };
    this.kickCooldown = 0;
    this.goalPause = 0;
    this.lastTime = 0;
    this.lastNet = 0;
    this.message =
      network?.role === "guest"
        ? "You are blue. Attack the left goal."
        : "You are orange. Attack the right goal.";
    this.cameraMode = 0;
    this.disposed = false;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      container.innerHTML =
        '<div class="webgl-error"><strong>3D needs WebGL</strong><p>Enable hardware acceleration or try a recent Chrome, Safari or Firefox.</p></div>';
      this.onUpdate({ error: "WebGL is unavailable" });
      return;
    }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    container.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#8da6ac");
    this.scene.fog = new THREE.Fog("#8da6ac", 100, 200);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 250);
    this.camera.position.set(0, 49, 46);
    this.camera.lookAt(0, 0, 0);
    this.build();
    this.observer = new ResizeObserver(() => {
      this.renderer.setSize(container.clientWidth, container.clientHeight);
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
    });
    this.observer.observe(container);
    this.down = (e) => {
      if (
        /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
        document.querySelector(".modal") ||
        !this.started
      )
        return;
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          e.code,
        )
      )
        e.preventDefault();
      this.keys[e.code] = true;
      if (!e.repeat) {
        if (e.code === "Space") this.action("shoot");
        if (e.code === "KeyJ") this.action("pass");
        if (e.code === "KeyK") this.action("switch");
      }
    };
    this.up = (e) => (this.keys[e.code] = false);
    this.blur = () => {
      this.keys = {};
      this.input = { x: 0, z: 0, sprint: false };
    };
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.blur);
    if (network) {
      network.onMessage = (m) => {
        if (m.type === "input" && network.role === "host") {
          this.remoteInput = m.input;
          if (m.action) this.applyAction(m.action, 1);
        }
        if (m.type === "frame" && network.role === "guest") {
          this.applyFrame(m.frame);
        }
        if (m.type === "finish" && network.role === "guest") {
          this.score = m.score;
          this.finish();
        }
      };
      network.onDisconnect = () => {
        this.paused = true;
        this.message = "Connection lost. Leave the match and reconnect.";
        this.onUpdate(this.snapshot());
      };
    }
    this.animate = (now) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(this.animate);
      const dt = Math.min((now - (this.lastTime || now)) / 1000, 0.04);
      this.lastTime = now;
      const input = this.getInput();
      if (this.network?.role === "guest") {
        if (now - this.lastNet > 55) {
          this.network.send({ type: "input", input });
          this.lastNet = now;
        }
      } else if (this.started && !this.finished && !this.paused)
        this.step(dt, input);
      if (this.network?.role === "host" && now - this.lastNet > 65) {
        this.network.send({ type: "frame", frame: this.frame() });
        this.lastNet = now;
      }
      this.draw(now / 1000);
      if (now - (this.lastUI || 0) > 150) {
        this.onUpdate(this.snapshot());
        this.lastUI = now;
      }
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(this.animate);
  }
  build() {
    const scene = this.scene;
    scene.add(new THREE.HemisphereLight(0xecfbff, 0x5d7443, 2.8));
    const sun = new THREE.DirectionalLight(0xffe8c1, 3);
    sun.position.set(-22, 45, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -46,
      right: 46,
      top: 38,
      bottom: -38,
      near: 1,
      far: 100,
    });
    sun.shadow.bias = -0.001;
    scene.add(sun);
    const mat = (c) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
    this.mat = mat;
    this.box = (w, h, d, x, y, z, m) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      o.position.set(x, y, z);
      o.castShadow = true;
      o.receiveShadow = true;
      scene.add(o);
      return o;
    };
    const concrete = mat("#677777"),
      white = mat("#f7f5e7"),
      navy = mat("#263942");
    this.box(90, 1, 64, 0, -0.7, 0, concrete);
    for (let i = 0; i < 12; i++)
      this.box(
        5,
        0.1,
        38,
        -27.5 + i * 5,
        0,
        0,
        mat(i % 2 ? "#4d8d58" : "#458451"),
      );
    const line = (points) => {
      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(
            points.map((p) => new THREE.Vector3(p[0], 0.12, p[1])),
          ),
          new THREE.LineBasicMaterial({ color: 0xeeefd9 }),
        ),
      );
    };
    const rect = (x1, z1, x2, z2) =>
      line([
        [x1, z1],
        [x2, z1],
        [x2, z2],
        [x1, z2],
        [x1, z1],
      ]);
    rect(-30, -19, 30, 19);
    line([
      [0, -19],
      [0, 19],
    ]);
    const points = [];
    for (let i = 0; i <= 64; i++)
      points.push([
        Math.cos((i / 64) * Math.PI * 2) * 5,
        Math.sin((i / 64) * Math.PI * 2) * 5,
      ]);
    line(points);
    for (const side of [-1, 1]) {
      rect(side * 30, -10, side * 21, 10);
      rect(side * 30, -5, side * 26, 5);
      this.box(0.16, 2.8, 0.16, side * 30, 1.4, -4.2, white);
      this.box(0.16, 2.8, 0.16, side * 30, 1.4, 4.2, white);
      this.box(0.16, 0.16, 8.6, side * 30, 2.8, 0, white);
      const lm = new THREE.LineBasicMaterial({
        color: "#e4eee2",
        transparent: true,
        opacity: 0.45,
      });
      for (let z = -4.2; z <= 4.2; z += 0.5) {
        scene.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(side * 30, 0.1, z),
              new THREE.Vector3(side * 32, 0.1, z),
              new THREE.Vector3(side * 32, 2.8, z),
              new THREE.Vector3(side * 30, 2.8, z),
            ]),
            lm,
          ),
        );
      }
      for (let y = 0.1; y <= 2.8; y += 0.4)
        line([
          [side * 32, -4.2],
          [side * 32, 4.2],
        ]);
      for (let row = 0; row < 6; row++) {
        this.box(
          76,
          0.8,
          2.1,
          0,
          0.5 + row * 0.85,
          side * (23 + row * 1.8),
          concrete,
        );
        this.box(
          76,
          0.14,
          1.4,
          0,
          1 + row * 0.85,
          side * (23 + row * 1.8),
          row % 3 === 0 ? mat("#e0dfca") : navy,
        );
      }
      for (let row = 0; row < 5; row++)
        this.box(
          2,
          0.8,
          43,
          side * (36 + row * 1.8),
          0.5 + row * 0.85,
          0,
          row % 2 ? navy : concrete,
        );
      if (side === -1) {
        this.box(78, 0.45, 13, 0, 8, -28, navy);
        for (let x = -36; x <= 36; x += 18)
          this.box(0.35, 8, 0.35, x, 4, -33, navy);
      }
    }
    const crowd = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.22, 5, 4),
        mat("#beb6a7"),
        840,
      ),
      dummy = new THREE.Object3D();
    let ci = 0;
    for (let side of [-1, 1])
      for (let row = 0; row < 6; row++)
        for (let j = 0; j < 70; j++) {
          dummy.position.set(
            -35 + j,
            1.5 + row * 0.85,
            side * (23 + row * 1.8),
          );
          dummy.scale.set(1, 1.8, 1);
          dummy.updateMatrix();
          crowd.setMatrixAt(ci, dummy.matrix);
          crowd.setColorAt(
            ci,
            new THREE.Color(
              ["#e1cfb1", "#254454", "#ec9a63", "#7599a0", "#d3e0d0"][j % 5],
            ),
          );
          ci++;
        }
    scene.add(crowd);
    const ad = document.createElement("canvas");
    ad.width = 1024;
    ad.height = 64;
    const ctx = ad.getContext("2d");
    ctx.fillStyle = "#ff8659";
    ctx.fillRect(0, 0, 1024, 64);
    ctx.fillStyle = "#253a35";
    ctx.font = "bold 27px sans-serif";
    ctx.fillText(
      "POWERPLAY  /  ALL GAME. NO SIDELINES.  /  POWERPLAY  /  PLAY YOUR WAY.",
      15,
      42,
    );
    const tex = new THREE.CanvasTexture(ad);
    for (let side of [-1, 1]) {
      const b = new THREE.Mesh(
        new THREE.PlaneGeometry(65, 1.3),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
      );
      b.position.set(0, 0.85, side * 21);
      scene.add(b);
    }
    for (const x of [-36, 36])
      for (const z of [-23, 23]) {
        this.box(0.2, 16, 0.2, x, 8, z, concrete);
        this.box(3, 1, 0.3, x, 16, z, white);
      }
    this.players = [];
    for (let team = 0; team < 2; team++)
      for (let i = 0; i < 5; i++) {
        const group = new THREE.Group();
        const shirt = mat(team === 0 ? "#ff7845" : "#7bd0e8");
        const shorts = mat(team === 0 ? "#243832" : "#263e62");
        const skin = mat(i % 2 ? "#bc805f" : "#e2ad83");
        const torso = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.32, 0.5, 3, 6),
          shirt,
        );
        torso.position.y = 1.1;
        torso.castShadow = true;
        group.add(torso);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 9, 7), skin);
        head.position.y = 1.78;
        head.castShadow = true;
        group.add(head);
        const short = new THREE.Mesh(
          new THREE.BoxGeometry(0.58, 0.32, 0.38),
          shorts,
        );
        short.position.y = 0.65;
        group.add(short);
        const legs = [];
        for (let s of [-1, 1]) {
          const leg = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.1, 0.4, 2, 6),
            shorts,
          );
          leg.position.set(s * 0.17, 0.3, 0);
          group.add(leg);
          legs.push(leg);
          const arm = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.09, 0.35, 2, 6),
            skin,
          );
          arm.position.set(s * 0.4, 1, 0);
          group.add(arm);
        }
        const formation = [
          [-27, 0],
          [-15, -10],
          [-6, 0],
          [-13, 10],
          [4, 5],
        ][i];
        const x = formation[0] * (team === 0 ? 1 : -1),
          z = formation[1];
        group.position.set(x, 0.1, z);
        scene.add(group);
        this.players.push({
          x,
          z,
          team,
          i,
          group,
          legs,
          base: { x, z },
          dx: team === 0 ? 1 : -1,
          dz: 0,
          moving: false,
        });
      }
    this.ballMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.35, 2),
      white,
    );
    this.ballMesh.castShadow = true;
    this.ballMesh.add(
      new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.355, 0),
        new THREE.MeshBasicMaterial({ color: "#263832", wireframe: true }),
      ),
    );
    scene.add(this.ballMesh);
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 0.85, 32),
      new THREE.MeshBasicMaterial({ color: "#ffe4a4", side: THREE.DoubleSide }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    scene.add(this.marker);
  }
  getInput() {
    let x =
        this.input.x +
        (this.keys.KeyD || this.keys.ArrowRight ? 1 : 0) -
        (this.keys.KeyA || this.keys.ArrowLeft ? 1 : 0),
      z =
        this.input.z +
        (this.keys.KeyS || this.keys.ArrowDown ? 1 : 0) -
        (this.keys.KeyW || this.keys.ArrowUp ? 1 : 0);
    const n = Math.hypot(x, z);
    if (n > 1) {
      x /= n;
      z /= n;
    }
    return {
      x,
      z,
      sprint:
        this.input.sprint || !!this.keys.ShiftLeft || !!this.keys.ShiftRight,
    };
  }
  action(action) {
    if (!this.started || this.finished || this.paused) return;
    if (this.network?.role === "guest") {
      this.network.send({ type: "input", input: this.getInput(), action });
      return;
    }
    this.applyAction(action, 0);
  }
  applyAction(action, team) {
    const idx = this.controlled[team],
      p = this.players[idx];
    if (action === "switch") {
      const list = this.players
        .map((p, i) => ({ p, i }))
        .filter((x) => x.p.team === team && x.p.i !== 0);
      list.sort(
        (a, b) =>
          Math.hypot(a.p.x - this.ball.x, a.p.z - this.ball.z) -
          Math.hypot(b.p.x - this.ball.x, b.p.z - this.ball.z),
      );
      this.controlled[team] = list.find((x) => x.i !== idx)?.i || idx;
      return;
    }
    if (this.owner !== idx) return;
    if (action === "shoot") {
      const dir = team === 0 ? 1 : -1;
      const goalZ = Math.max(-3, Math.min(3, p.z * 0.16));
      const dx = dir * 31 - p.x,
        dz = goalZ - p.z,
        n = Math.hypot(dx, dz);
      this.kick((dx / n) * 29, (dz / n) * 29);
      this.message =
        team === 0 ? "You take the shot!" : "Your opponent shoots!";
    }
    if (action === "pass") {
      const mates = this.players
        .map((p, i) => ({ p, i }))
        .filter((x) => x.p.team === team && x.i !== idx && x.p.i !== 0);
      mates.sort(
        (a, b) =>
          Math.hypot(a.p.x - p.x, a.p.z - p.z) -
          (a.p.x - p.x) * (team === 0 ? 1 : -1) * 0.4 -
          (Math.hypot(b.p.x - p.x, b.p.z - p.z) -
            (b.p.x - p.x) * (team === 0 ? 1 : -1) * 0.4),
      );
      const t = mates[0];
      const dx = t.p.x - p.x,
        dz = t.p.z - p.z,
        n = Math.hypot(dx, dz) || 1;
      this.kick((dx / n) * 19, (dz / n) * 19);
      this.controlled[team] = t.i;
      this.message = "A quick pass. Keep it moving.";
    }
  }
  kick(vx, vz) {
    const p = this.players[this.owner];
    this.ball.x = p.x + Math.sign(vx) * 1;
    this.ball.z = p.z;
    this.ball.vx = vx;
    this.ball.vz = vz;
    this.owner = -1;
    this.kickCooldown = 0.3;
  }
  step(dt, input) {
    if (this.goalPause > 0) {
      this.goalPause -= dt;
      if (this.goalPause <= 0) this.resetKickoff();
      return;
    }
    this.elapsed += dt;
    this.kickCooldown = Math.max(0, this.kickCooldown - dt);
    const ball = this.ball;
    const closest = [0, 0];
    for (let team = 0; team < 2; team++) {
      let best = Infinity;
      this.players.forEach((p, i) => {
        if (p.team !== team || p.i === 0) return;
        const d = Math.hypot(p.x - ball.x, p.z - ball.z);
        if (d < best) {
          best = d;
          closest[team] = i;
        }
      });
    }
    this.players.forEach((p, i) => {
      let dx = 0,
        dz = 0,
        run = false;
      const user = i === this.controlled[0],
        remote = this.network && i === this.controlled[1];
      if (user || remote) {
        const v = user ? input : this.remoteInput || { x: 0, z: 0 };
        dx = v.x;
        dz = v.z;
        run = v.sprint;
      } else if (p.i === 0) {
        dx = (p.base.x - p.x) * 0.6;
        dz = (Math.max(-3.4, Math.min(3.4, ball.z * 0.4)) - p.z) * 1.8;
        if (this.owner === i && this.kickCooldown === 0) {
          this.kick((p.team === 0 ? 1 : -1) * 20, 0);
          this.message = "The keeper plays it out.";
        }
      } else if (i === closest[p.team] && this.owner !== i) {
        dx = ball.x - p.x;
        dz = ball.z - p.z;
      } else if (this.owner === i) {
        dx = p.team === 0 ? 1 : -1;
        dz = -p.z * 0.03;
        if (Math.abs(p.x) > 13 && this.kickCooldown === 0) {
          const sx = (p.team === 0 ? 31 : -31) - p.x,
            sz = -p.z + Math.sin(this.elapsed * 2) * 2,
            n = Math.hypot(sx, sz);
          this.kick(
            (sx / n) * (23 + this.difficulty * 2),
            (sz / n) * (23 + this.difficulty * 2),
          );
          this.message = "A strike from distance!";
        }
      } else {
        dx = p.base.x + ball.x * 0.22 - p.x;
        dz = p.base.z + ball.z * 0.22 - p.z;
      }
      const n = Math.hypot(dx, dz);
      if (n > 1) {
        dx /= n;
        dz /= n;
      }
      const sp =
        p.i === 0
          ? 4
          : run
            ? 10
            : 7 + (p.team === 1 && !this.network ? this.difficulty * 0.4 : 0);
      p.x = Math.max(-29, Math.min(29, p.x + dx * sp * dt));
      p.z = Math.max(-18, Math.min(18, p.z + dz * sp * dt));
      p.moving = n > 0.05;
      if (n > 0.05) {
        p.dx = dx;
        p.dz = dz;
      }
    });
    if (this.owner >= 0) {
      const p = this.players[this.owner];
      ball.x = p.x + p.dx * 0.8;
      ball.z = p.z + p.dz * 0.8;
      ball.vx = 0;
      ball.vz = 0;
      const opponent = this.players.find(
        (q, i) => q.team !== p.team && Math.hypot(q.x - p.x, q.z - p.z) < 0.78,
      );
      if (opponent && this.kickCooldown === 0) {
        this.owner = this.players.indexOf(opponent);
        this.kickCooldown = 0.55;
        this.message = "A clean tackle. Possession changes.";
        if (opponent.team === 0) this.controlled[0] = this.owner;
        if (this.network && opponent.team === 1)
          this.controlled[1] = this.owner;
      }
    } else {
      ball.x += ball.vx * dt;
      ball.z += ball.vz * dt;
      ball.vx *= Math.exp(-0.52 * dt);
      ball.vz *= Math.exp(-0.52 * dt);
      if (Math.abs(ball.z) > 18.8) {
        ball.z = Math.sign(ball.z) * 18.8;
        ball.vz *= -0.65;
      }
      if (Math.abs(ball.x) > 30) {
        if (Math.abs(ball.z) < 4.2) {
          const team = ball.x > 0 ? 0 : 1;
          this.score[team]++;
          this.goalPause = 2.4;
          this.message =
            team === 0
              ? "GOOOAL! What a finish."
              : "Goal for the visitors. Time to respond.";
          this.onUpdate(this.snapshot());
          if (this.suddenDeath) this.finish();
        } else {
          ball.x = Math.sign(ball.x) * 29.8;
          ball.vx *= -0.7;
        }
      }
      if (this.kickCooldown === 0 && this.goalPause === 0) {
        const near = this.players
          .map((p, i) => ({ p, i, d: Math.hypot(p.x - ball.x, p.z - ball.z) }))
          .sort((a, b) => a.d - b.d)[0];
        if (near.d < 1.05) {
          this.owner = near.i;
          if (near.p.team === 0) this.controlled[0] = near.i;
          if (this.network && near.p.team === 1) this.controlled[1] = near.i;
          this.kickCooldown = 0.25;
        }
      }
    }
    if (this.elapsed >= this.duration) this.finish();
  }
  resetKickoff() {
    this.players.forEach((p) => {
      p.x = p.base.x;
      p.z = p.base.z;
    });
    this.owner = this.score[0] > this.score[1] ? 7 : 2;
    this.controlled[this.players[this.owner].team] = this.owner;
    this.ball = { x: this.players[this.owner].x, z: 0, vx: 0, vz: 0, y: 0.4 };
    this.message = "Back underway. Make the next chance count.";
  }
  finish() {
    if (this.finished) return;
    this.finished = true;
    this.message = "Full time";
    if (this.network?.role === "host")
      this.network.send({ type: "finish", score: this.score });
    this.onEnd({ score: [...this.score], mode: this.mode });
  }
  snapshot() {
    return {
      score: [...this.score],
      remaining: Math.max(0, Math.ceil(this.duration - this.elapsed)),
      message: this.message,
      goal: this.goalPause > 0,
      finished: this.finished,
      paused: this.paused,
      owner: this.owner,
      controlled: this.controlled[this.network?.role === "guest" ? 1 : 0],
    };
  }
  frame() {
    return {
      players: this.players.map((p) => [p.x, p.z, p.dx, p.dz, p.moving]),
      ball: this.ball,
      owner: this.owner,
      controlled: this.controlled,
      score: this.score,
      elapsed: this.elapsed,
      goalPause: this.goalPause,
      message: this.message,
    };
  }
  applyFrame(f) {
    f.players.forEach((p, i) =>
      Object.assign(this.players[i], {
        x: p[0],
        z: p[1],
        dx: p[2],
        dz: p[3],
        moving: p[4],
      }),
    );
    this.ball = f.ball;
    this.owner = f.owner;
    this.controlled = f.controlled;
    this.score = f.score;
    this.elapsed = f.elapsed;
    this.goalPause = f.goalPause;
    this.message = f.message;
  }
  draw(t) {
    this.players.forEach((p) => {
      p.group.position.set(p.x, 0.1, p.z);
      p.group.rotation.y = Math.atan2(p.dx, p.dz);
      p.legs.forEach(
        (l, i) =>
          (l.rotation.x =
            p.moving && !this.finished
              ? Math.sin(t * 12 + i * Math.PI) * 0.5
              : 0),
      );
    });
    this.ballMesh.position.set(this.ball.x, 0.4, this.ball.z);
    this.ballMesh.rotation.z = t * 3;
    const p =
      this.players[this.controlled[this.network?.role === "guest" ? 1 : 0]];
    this.marker.position.set(p.x, 0.15, p.z);
    this.marker.visible = this.started;
    const fit = Math.max(1, 1.3 / this.camera.aspect);
    const cameraPos = this.cameraMode
      ? new THREE.Vector3(this.ball.x * 0.25, 33 * fit, 34 * fit)
      : new THREE.Vector3(0, 49 * fit, 46 * fit);
    this.camera.position.lerp(cameraPos, 0.04);
    this.camera.lookAt(this.cameraMode ? this.ball.x * 0.35 : 0, 0, 0);
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.up);
    window.removeEventListener("blur", this.blur);
    this.scene?.traverse((o) => {
      o.geometry?.dispose();
      if (o.material)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          m.map?.dispose();
          m.dispose();
        });
    });
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    if (this.network) {
      this.network.onMessage = null;
      this.network.onDisconnect = null;
    }
  }
}
