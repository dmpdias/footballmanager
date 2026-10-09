/** Host UI ↔ Godot bridge. Match physics runs inside the engine, at 60 Hz. */
export class GodotGame {
  constructor(
    container,
    {
      onUpdate = () => {},
      onEnd = () => {},
      mode = "practice",
      network = null,
      difficulty = 1,
    } = {},
  ) {
    this.container = container;
    this.onUpdate = onUpdate;
    this.onEnd = onEnd;
    this.mode = mode;
    this.network = network;
    this.input = { x: 0, z: 0, sprint: false };
    this.keys = {};
    this.started = true;
    this.finished = false;
    this._paused = false;
    this._camera = 0;
    this.ready = false;
    this.disposed = false;
    this.frame = document.createElement("iframe");
    this.frame.className = "godot-frame";
    this.frame.title = "Powerplay Godot 3D match";
    this.frame.src = `${import.meta.env.BASE_URL}engine/index.html`;
    container.append(this.frame);
    this.loader = document.createElement("div");
    this.loader.className = "engine-loader";
    this.loader.innerHTML =
      '<span class="engine-spinner"></span><strong>Warming up the pitch…</strong><small>Loading the Godot match engine. First load may take a moment.</small>';
    container.append(this.loader);
    this.receive = (e) => {
      if (
        e.source !== this.frame.contentWindow ||
        e.origin !== location.origin ||
        e.data?.source !== "powerplay-godot"
      )
        return;
      const msg = e.data;
      if (msg.type === "ready") {
        this.ready = true;
        this.loader.remove();
        clearTimeout(this.timeout);
        container.tabIndex = -1;
        container.focus({ preventScroll: true });
        this.frame.contentWindow.addEventListener("keydown", this.down);
        this.frame.contentWindow.addEventListener("keyup", this.up);
        this.command({
          type: "config",
          mode,
          difficulty,
          remote: network?.role === "guest",
          localTeam: network?.role === "guest" ? 1 : 0,
        });
        if (this.pendingFrame)
          this.command({ type: "frame", frame: this.pendingFrame });
      }
      if (msg.type === "state") {
        this.lastState = msg.state;
        this.onUpdate(msg.state);
        if (network?.role === "host")
          network.send({ type: "engine-frame", frame: msg.state });
      }
      if (msg.type === "finish") {
        if (network?.role === "host")
          network.send({ type: "engine-finish", score: msg.score });
        this.end(msg.score);
      }
      if (msg.type === "sound") this.sound(msg.kind);
    };
    window.addEventListener("message", this.receive);
    this.timeout = setTimeout(() => {
      if (!this.ready) {
        this.loader.innerHTML =
          "<strong>The match engine hasn’t started.</strong><small>Allow WebAssembly and WebGL 2, check your connection, then reload. The engine is about 37 MB before compression.</small>";
        this.onUpdate({
          error:
            "Engine loading stalled. Reload or try a browser with WebGL 2.",
        });
      }
    }, 45000);
    this.down = (e) => {
      if (
        /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
        document.querySelector(".modal")
      )
        return;
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
      this.keys[e.code] = true;
      this.unlockAudio();
      if (!e.repeat) {
        if (e.code === "Space") this.action("charge");
        if (e.code === "KeyJ") this.action("pass");
        if (e.code === "KeyK") this.action("switch");
        if (e.code === "KeyL") this.action("tackle");
      }
    };
    this.up = (e) => {
      this.keys[e.code] = false;
      if (e.code === "Space") this.action("shoot");
    };
    this.blur = () => {
      this.keys = {};
      this.input = { x: 0, z: 0, sprint: false };
      this.action("shoot");
    };
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.blur);
    this.timer = setInterval(() => {
      let x =
        this.input.x +
        (this.keys.KeyD || this.keys.ArrowRight ? 1 : 0) -
        (this.keys.KeyA || this.keys.ArrowLeft ? 1 : 0);
      let z =
        this.input.z +
        (this.keys.KeyS || this.keys.ArrowDown ? 1 : 0) -
        (this.keys.KeyW || this.keys.ArrowUp ? 1 : 0);
      let pads = [];
      try {
        pads = navigator.getGamepads?.() || [];
      } catch {}
      const pad = Array.from(pads).find(Boolean);
      let padSprint = false;
      if (pad) {
        const dead = (v) => (Math.abs(v) > 0.18 ? v : 0);
        x += dead(pad.axes[0] || 0);
        z += dead(pad.axes[1] || 0);
        padSprint = !!pad.buttons[7]?.pressed;
        const pressed = pad.buttons.map((b) => b.pressed),
          previous = this.padButtons || [];
        for (const [button, action] of [
          [0, "pass"],
          [2, "tackle"],
          [3, "switch"],
        ])
          if (pressed[button] && !previous[button]) this.action(action);
        if (pressed[1] && !previous[1]) this.action("charge");
        if (!pressed[1] && previous[1]) this.action("shoot");
        this.padButtons = pressed;
      } else this.padButtons = [];
      const len = Math.hypot(x, z);
      if (len > 1) {
        x /= len;
        z /= len;
      }
      const input = {
        x,
        z,
        sprint:
          padSprint ||
          this.input.sprint ||
          !!this.keys.ShiftLeft ||
          !!this.keys.ShiftRight,
      };
      this.currentInput = input;
      if (network?.role === "guest")
        network.send({ type: "engine-input", input });
      else this.command({ type: "input", team: 0, ...input });
    }, 33);
    if (network) {
      network.onMessage = (m) => {
        if (network.role === "host" && m.type === "engine-input") {
          this.command({ type: "input", team: 1, ...m.input });
          if (m.action)
            this.command({ type: "action", team: 1, action: m.action });
        }
        if (network.role === "guest" && m.type === "engine-frame") {
          this.pendingFrame = m.frame;
          this.command({ type: "frame", frame: m.frame });
          const controlled = m.frame.controlled[1],
            actor = m.frame.players[controlled];
          this.onUpdate({ ...m.frame, stamina: actor[8], charge: m.frame.charges?.[1] || 0 });
        }
        if (network.role === "guest" && m.type === "engine-finish")
          this.end(m.score);
      };
      network.onDisconnect = () => {
        this.command({ type: "pause", value: true });
        this.onUpdate({
          ...(this.lastState || { score: [0, 0], remaining: 90 }),
          message: "Connection lost. Leave the match and reconnect.",
        });
      };
    }
  }
  command(value) {
    if (!this.ready || this.disposed) return;
    try {
      this.frame.contentWindow.powerplayCommand(JSON.stringify(value));
    } catch {}
  }
  action(action) {
    if (this.finished || this._paused) return;
    this.unlockAudio();
    if (this.network?.role === "guest")
      this.network.send({
        type: "engine-input",
        input: { ...(this.currentInput || this.input) },
        action,
      });
    else this.command({ type: "action", team: 0, action });
  }
  get paused() {
    return this._paused;
  }
  set paused(value) {
    this._paused = value;
    this.command({ type: "pause", value });
  }
  get cameraMode() {
    return this._camera;
  }
  set cameraMode(value) {
    this._camera = value;
    this.command({ type: "camera", value });
  }
  end(score) {
    if (this.finished) return;
    this.finished = true;
    this.onEnd({ score, mode: this.mode });
  }
  unlockAudio() {
    try {
      this.audio ??= new (window.AudioContext || window.webkitAudioContext)();
      if (this.audio.state === "suspended") this.audio.resume().catch(() => {});
    } catch {}
  }
  sound(kind) {
    if (!this.audio || this.audio.state !== "running") return;
    const a = this.audio,
      o = a.createOscillator(),
      g = a.createGain();
    o.connect(g);
    g.connect(a.destination);
    const t = a.currentTime;
    const goal = kind === "GOAL";
    o.type = goal ? "triangle" : "sine";
    o.frequency.setValueAtTime(goal ? 440 : 150, t);
    o.frequency.exponentialRampToValueAtTime(
      goal ? 880 : 50,
      t + (goal ? 0.35 : 0.1),
    );
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (goal ? 0.65 : 0.12));
    o.start();
    o.stop(t + (goal ? 0.7 : 0.15));
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    clearTimeout(this.timeout);
    window.removeEventListener("message", this.receive);
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.up);
    window.removeEventListener("blur", this.blur);
    this.frame.contentWindow?.removeEventListener("keydown", this.down);
    this.frame.contentWindow?.removeEventListener("keyup", this.up);
    this.frame.remove();
    this.loader.remove();
    this.audio?.close().catch(() => {});
    if (this.network) {
      this.network.onMessage = null;
      this.network.onDisconnect = null;
    }
  }
}
