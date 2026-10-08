export class FriendConnection {
  constructor(role, onStatus) {
    this.role = role;
    this.onStatus = onStatus;
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    this.connectTimeout = setTimeout(() => {
      if (this.pc.connectionState !== "connected")
        this.onStatus(
          "Not connected yet. Check that both codes were exchanged. Restrictive networks may need a relay server.",
        );
    }, 30000);
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      if (
        state === "failed" ||
        state === "disconnected" ||
        state === "closed"
      ) {
        this.onStatus(
          "Connection unavailable. Try another network; some networks require a relay server.",
        );
        this.onDisconnect?.();
      }
    };
    this.pc.ondatachannel = (e) => this.bind(e.channel);
  }
  bind(channel) {
    this.channel = channel;
    channel.onopen = () => {
      this.onStatus("connected");
      this.onReady?.();
    };
    channel.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        this.onMessage?.(m);
      } catch {}
    };
    channel.onclose = () => this.onDisconnect?.();
  }
  async gathered() {
    if (this.pc.iceGatheringState === "complete") return;
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }, 6500);
      const check = () => {
        if (this.pc.iceGatheringState === "complete") {
          clearTimeout(timeout);
          this.pc.removeEventListener("icegatheringstatechange", check);
          resolve();
        }
      };
      this.pc.addEventListener("icegatheringstatechange", check);
    });
  }
  encode() {
    if (!this.pc.localDescription?.sdp.includes("a=candidate:"))
      throw Error(
        "This browser blocked peer-to-peer networking. Try a browser or network that allows WebRTC.",
      );
    return btoa(JSON.stringify(this.pc.localDescription));
  }
  decode(code) {
    if (code.trim().length > 35000) throw Error("That code is too long.");
    let data;
    try {
      data = JSON.parse(atob(code.trim()));
    } catch {
      throw Error(
        "Invalid connection code. Copy the entire code and try again.",
      );
    }
    if (
      !["offer", "answer"].includes(data.type) ||
      typeof data.sdp !== "string"
    )
      throw Error("Invalid connection code.");
    return data;
  }
  async offer() {
    this.bind(this.pc.createDataChannel("powerplay", { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this.gathered();
    return this.encode();
  }
  async answer(code) {
    const offer = this.decode(code);
    if (offer.type !== "offer")
      throw Error("Paste the host’s invite code, not a reply code.");
    await this.pc.setRemoteDescription(offer);
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this.gathered();
    return this.encode();
  }
  async accept(code) {
    const answer = this.decode(code);
    if (answer.type !== "answer")
      throw Error("Paste your friend’s reply code.");
    await this.pc.setRemoteDescription(answer);
  }
  send(data) {
    if (this.channel?.readyState === "open")
      this.channel.send(JSON.stringify(data));
  }
  close() {
    clearTimeout(this.connectTimeout);
    this.onMessage = null;
    this.onReady = null;
    this.onDisconnect = null;
    this.pc.onconnectionstatechange = null;
    this.channel?.close();
    this.pc.close();
  }
}
