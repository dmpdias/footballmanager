import "./style.css";
import { FootballGame } from "./game.js";
import { FriendConnection } from "./network.js";
const $ = (s) => document.querySelector(s);
const safe = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let profile;
try {
  profile = JSON.parse(localStorage.getItem("powerplay-profile"));
} catch {}
profile = {
  name: "Rookie",
  xp: 0,
  played: 0,
  wins: 0,
  goals: 0,
  cups: 0,
  history: [],
  ...profile,
};
let page = "home",
  game,
  connection,
  matchMode = "practice",
  cup = null,
  award = null;
const save = () => {
  try {
    localStorage.setItem("powerplay-profile", JSON.stringify(profile));
  } catch {
    toast(
      "Browser storage is unavailable. Progress lasts for this session only.",
    );
  }
};
const ranks = [
  { name: "Rookie", min: 0 },
  { name: "Bronze", min: 250 },
  { name: "Silver", min: 700 },
  { name: "Gold", min: 1500 },
  { name: "Platinum", min: 3000 },
  { name: "Legend", min: 6000 },
];
function rank() {
  return ranks.findLast((r) => profile.xp >= r.min);
}
const icon = (name) =>
  ({ home: "▦", play: "▷", tournaments: "♜", ranks: "◈", profile: "◉" })[name];
function nav() {
  return ["home", "play", "tournaments", "ranks", "profile"]
    .map(
      (p) =>
        `<button data-nav="${p}" class="nav-item ${page === p ? "active" : ""}"><span>${icon(p)}</span>${p === "play" ? "Play now" : p[0].toUpperCase() + p.slice(1)}</button>`,
    )
    .join("");
}
function render() {
  game?.dispose();
  game = null;
  $("#app").innerHTML =
    `<aside class="sidebar"><a class="brand" href="#"><span class="brand-logo">p<span>⚡</span></span><div>POWERPLAY<small>ALL GAME. NO SIDELINES.</small></div></a><div class="profile-mini"><span class="avatar">${safe(profile.name.slice(0, 2).toUpperCase())}</span><div><b>${safe(profile.name)}</b><small><i></i> ${rank().name} · Level ${Math.floor(profile.xp / 200) + 1}</small></div><span>⌄</span></div><span class="nav-label">YOUR PLAYGROUND</span><nav>${nav()}</nav><div class="sidebar-cup"><span class="cup-icon">♜</span><span class="eyebrow">THE WEEKEND CUP</span><h3>Small teams.<br>Big moments.</h3><p>Three rounds. One trophy.<br>Your next story starts here.</p><button data-nav="tournaments">Enter the cup <span>→</span></button></div><div class="sidebar-bottom"><span class="status-dot"></span> Browser football, reimagined.<small>Original prototype · Inspired by Power Soccer</small></div></aside><div class="main-wrap"><header><div class="breadcrumb">The clubhouse <span>/</span> ${page === "home" ? "Overview" : page === "play" ? "Match arena" : page[0].toUpperCase() + page.slice(1)}</div><div class="header-right"><span class="local-label">LOCAL PROFILE</span><span class="xp-icon">✦</span><b>${profile.xp.toLocaleString()} XP</b><button data-nav="profile" class="avatar">${safe(profile.name.slice(0, 2).toUpperCase())}</button></div></header><main>${page === "home" ? home() : page === "play" ? arena() : page === "tournaments" ? tournaments() : page === "ranks" ? rankPage() : profilePage()}</main><footer><span>POWERPLAY <i>•</i> A little competition. A lot of football.</span><span>5-a-side <i>•</i> 90-second matches</span></footer></div><nav class="mobile-nav">${nav()}</nav><div id="toast" role="status"></div><div id="modal-root"></div>`;
  bind();
  if (page === "home")
    game = new FootballGame($("#stadium"), { mode: "preview" });
  if (page === "play") {
    game = new FootballGame($("#stadium"), {
      mode: matchMode,
      network: matchMode === "friend" ? connection : null,
      difficulty: cup ? cup.round + 1 : 1,
      onUpdate: update,
      onEnd: matchEnd,
    });
    bindControls();
  }
}
function home() {
  const r = rank();
  return `<section class="intro"><div class="eyebrow">LESS WAITING. MORE PLAYING.</div><h1>Football. No sidelines.</h1><p>Jump in. Find your feet. Make your mark.</p><span class="intro-pill"><span class="status-dot"></span> Your next match is one click away</span></section><div class="home-grid"><section class="arena-card"><div class="card-bar"><div><span class="status-dot"></span><b>THE MATCHDAY ARENA</b><span class="tag">3D FOOTBALL</span></div><span>Riverside Park</span></div><div class="hero-stadium"><div id="stadium"></div><div class="tv-label"><span>POWERPLAY <b>TV</b></span><span>YOUR FRONT-ROW SEAT</span></div><div class="hero-overlay"><span class="eyebrow">THE PITCH IS YOURS</span><h2>Don’t watch the game.<br>Be the game.</h2><p>Five a side. Ninety seconds. All you.</p></div><div class="stadium-bottom"><span>◉ REAL-TIME PLAYER CONTROL</span><span>WEBGL / 3D</span></div></div><div class="hero-actions"><div><strong>Ready for a little beautiful game?</strong><span>No downloads. No complicated tactics.</span></div><button class="button orange" id="quick-play">Quick play <span>→</span></button></div><div class="control-strip"><span><kbd>W A S D</kbd> Move</span><span><kbd>SPACE</kbd> Shoot</span><span><kbd>J</kbd> Pass</span><span><kbd>K</kbd> Switch</span><span>⌁ Touch controls on mobile</span></div></section><aside class="home-right"><section class="card rank-card"><div class="section-title"><h2>Your climb</h2><button data-nav="ranks">View ranks →</button></div><div class="rank-main"><span class="rank-emblem">◈</span><div><span class="eyebrow">CURRENT RANK</span><h3>${r.name}</h3><span>Level ${Math.floor(profile.xp / 200) + 1} · ${profile.xp} XP</span></div></div>${rankProgress()}<div class="rank-stats"><div><strong>${profile.played}</strong><span>MATCHES</span></div><div><strong>${profile.wins}</strong><span>WINS</span></div><div><strong>${profile.goals}</strong><span>GOALS</span></div></div><p class="card-note">Your progress, saved on this device.</p></section><section class="card friend-card"><span class="friend-visual">→<i>←</i></span><span class="eyebrow">BETTER WITH A RIVAL</span><h3>Same pitch.<br>Different screens.</h3><p>Challenge a friend to a real head-to-head match. Bragging rights included.</p><button class="button outline" id="friend-play">Play a friend <span>→</span></button><span class="friend-note">Peer-to-peer · Exchange connection codes</span></section></aside></div><section class="mode-heading"><h2>Find your game</h2><span>ONE MORE MATCH? ALWAYS.</span></section><section class="mode-grid"><button class="mode-card" id="practice-mode"><span class="mode-icon mint">▷</span><span class="eyebrow">LEARN BY PLAYING</span><h3>Quick match <span>→</span></h3><p>Find the net against AI. No pressure, just football.</p><div><span>90 seconds</span><b>+ XP</b></div></button><button class="mode-card" data-nav="tournaments"><span class="mode-icon peach">♜</span><span class="eyebrow">CHASE THE SILVERWARE</span><h3>Weekend Cup <span>→</span></h3><p>Three knockout rounds. Win your way to the top.</p><div><span>8 teams · vs AI</span><b>+ 300 XP</b></div></button><button class="mode-card" data-nav="ranks"><span class="mode-icon lilac">◈</span><span class="eyebrow">MAKE YOUR MARK</span><h3>The rank ladder <span>→</span></h3><p>Every match moves you forward. What’s your ceiling?</p><div><span>6 ranks to unlock</span><b>ROOKIE → LEGEND</b></div></button></section><section class="welcome-strip"><span>✦</span><div><strong>Easy to pick up. Hard to put down.</strong><p>Simple controls, quick matches, and that just-one-more-game feeling.</p></div><button id="how-to">How to play <span>→</span></button></section>`;
}
function rankProgress() {
  const next = ranks.find((r) => r.min > profile.xp),
    prev = rank();
  const progress = next
    ? ((profile.xp - prev.min) / (next.min - prev.min)) * 100
    : 100;
  return `<div class="rank-progress"><div><span>${profile.xp} XP</span><span>${next ? `${next.min} XP · ${next.name}` : "Top rank reached"}</span></div><div class="progress"><span style="width:${progress}%"></span></div></div>`;
}
function arena() {
  const opponent =
    matchMode === "friend"
      ? "Your friend"
      : cup
        ? ["Eastfield", "Northbridge", "Kingsport"][cup.round]
        : "Blue Comets";
  return `<section class="page-heading"><div><div class="eyebrow">${matchMode === "friend" ? "FRIEND MATCH" : cup ? "WEEKEND CUP · " + ["QUARTER-FINAL", "SEMI-FINAL", "FINAL"][cup.round] : "QUICK MATCH · VS AI"}</div><h1>Make every touch count.</h1></div><button class="button outline" id="leave-match">Leave match</button></section><section class="play-card"><div class="match-score"><div><span class="team-badge orange-team">P</span><b>${matchMode === "friend" && connection?.role === "guest" ? "Host" : safe(profile.name)}</b></div><div><strong id="score">0 <i>:</i> 0</strong><span id="clock">1:30</span></div><div><b>${safe(opponent)}</b><span class="team-badge blue-team">B</span></div></div><div class="play-stadium"><div id="stadium"></div><div class="play-top"><span class="live-tag"><i></i> LIVE PLAY <b>3D</b></span><button id="camera">▣ Camera</button></div><div id="goal-banner"></div><div class="play-caption" id="match-message">You’re the orange team. The glowing ring marks your player.</div></div><div class="play-toolbar"><div><span class="status-dot"></span><span>${matchMode === "friend" ? "Connected friend match" : "You vs AI"}</span></div><div><button id="pause" ${matchMode === "friend" ? "disabled" : ""}>Ⅱ Pause</button><button id="help-match">? Controls</button></div></div><div class="touch-controls"><div id="joystick" aria-label="Movement joystick"><div id="stick"></div><span>MOVE</span></div><div class="action-buttons"><button id="sprint" class="sprint">Sprint</button><button data-action="switch">Switch <kbd>K</kbd></button><button data-action="pass">Pass <kbd>J</kbd></button><button data-action="shoot" class="shoot">Shoot <kbd>SPACE</kbd></button></div></div><div class="controls-hint"><span><kbd>WASD</kbd> / <kbd>↑ ↓ ← →</kbd> Move</span><span><kbd>SHIFT</kbd> Sprint</span><span>Run into the ball to win possession. Aim toward the opposite goal.</span></div></section>`;
}
function tournaments() {
  return `<section class="page-heading"><div><div class="eyebrow">A LITTLE SILVERWARE GOES A LONG WAY</div><h1>The Weekend Cup.</h1><p>Win three rounds. Lift the trophy. Come back for more.</p></div><span class="tag">LOCAL TOURNAMENT · VS AI</span></section><div class="tournament-layout"><section class="card cup-feature"><span class="big-trophy">♜</span><span class="eyebrow">8 TEAMS. ONE WINNER.</span><h2>A cup worth chasing.</h2><p>Five-a-side knockout football.<br>90 seconds per match. A draw goes to sudden death.</p><div class="cup-details"><span>3 rounds</span><span>Increasing difficulty</span><span>300 bonus XP</span></div><button class="button orange" id="enter-cup">${cup ? "Resume round " + (cup.round + 1) : "Enter tournament"} <span>→</span></button><small>No entry fee. AI opponents. Progress saved for this session.</small></section><section class="card bracket-card"><div class="section-title"><h2>Your route to the final</h2><span class="subtle">KNOCKOUT</span></div><div class="bracket">${["Quarter-final", "Semi-final", "Final"].map((name, i) => `<div class="bracket-round ${cup?.round === i ? "current" : ""}"><span>0${i + 1}</span><div><small>${name.toUpperCase()}</small><b>${["Eastfield Athletic", "Northbridge United", "Kingsport City"][i]}</b><p>${cup && cup.round > i ? "✓ Won" : cup?.round === i ? "Your next challenge" : "Win to advance"}</p></div><span>${i === 2 ? "♜" : "→"}</span></div>`).join("")}</div><div class="bracket-foot">${profile.cups} trophies in your cabinet. Room for one more?</div></section></div><section class="card future-card"><span class="mode-icon lilac">⇄</span><div><h3>Looking for a human opponent?</h3><p>Invite a friend for a live match. Public tournament lobbies and global rankings need a hosted multiplayer service.</p></div><button class="button outline" id="friend-play">Challenge a friend →</button></section>`;
}
function rankPage() {
  return `<section class="page-heading"><div><div class="eyebrow">THE JOURNEY IS THE GAME</div><h1>From rookie to legend.</h1><p>Play matches. Score goals. Bring home trophies.</p></div><span class="tag">DEVICE-LOCAL PROGRESSION</span></section><section class="card progress-feature"><span class="rank-emblem">◈</span><div><span class="eyebrow">${rank().name.toUpperCase()} · LEVEL ${Math.floor(profile.xp / 200) + 1}</span><h2>${profile.xp.toLocaleString()} XP and counting.</h2>${rankProgress()}</div></section><div class="rank-ladder">${ranks.map((r, i) => `<section class="card ladder-card ${rank().name === r.name ? "current" : ""}"><span class="ladder-icon rank-${i}">◈</span><span class="eyebrow">RANK 0${i + 1}</span><h3>${r.name}</h3><p>${r.min.toLocaleString()} XP</p><span class="rank-status">${profile.xp >= r.min ? (rank().name === r.name ? "YOU ARE HERE" : "UNLOCKED ✓") : "LOCKED"}</span></section>`).join("")}</div><section class="card xp-rules"><h2>Every match counts.</h2><div><span>Complete a match <b>+ 40 XP</b></span><span>Win a match <b>+ 60 XP</b></span><span>Score a goal <b>+ 15 XP</b></span><span>Win the cup <b>+ 300 XP</b></span></div><p>Practice and friend matches award XP. This is a personal progression ladder, not a verified global competitive ranking.</p></section>`;
}
function profilePage() {
  return `<section class="page-heading"><div><div class="eyebrow">YOUR CORNER OF THE CLUBHOUSE</div><h1>Player profile.</h1><p>Your name. Your goals. Your journey.</p></div></section><section class="card profile-settings"><span class="avatar big">${safe(profile.name.slice(0, 2).toUpperCase())}</span><form id="profile-form"><label for="player-name">PLAYER NAME</label><div><input id="player-name" maxlength="20" required value="${safe(profile.name)}"/><button class="button orange">Save name</button></div></form><div class="profile-numbers">${[
    ["Matches", profile.played],
    ["Wins", profile.wins],
    ["Goals", profile.goals],
    ["Cups", profile.cups],
  ]
    .map(([name, value]) => `<div><b>${value}</b><span>${name}</span></div>`)
    .join(
      "",
    )}</div></section><section class="card history"><div class="section-title"><h2>Recent matches</h2><span class="subtle">LAST 10</span></div>${profile.history.length ? profile.history.map((h) => `<div class="history-row"><span class="result-${h.result}">${h.result}</span><div><b>${h.mode === "friend" ? "Friend match" : h.mode === "cup" ? "Weekend Cup" : "Quick match"}</b><small>${new Date(h.date).toLocaleDateString()}</small></div><strong>${h.score[0]} – ${h.score[1]}</strong><span>+${h.xp} XP</span></div>`).join("") : '<div class="empty-state">Your story is just getting started. Play your first match.</div>'}</section>`;
}
function start(mode = "practice") {
  if (game?.started && !game.finished) return;
  matchMode = mode;
  award = null;
  page = "play";
  render();
  window.scrollTo(0, 0);
}
function update(s) {
  if (page !== "play") return;
  if (s.error) {
    $("#match-message").textContent = s.error;
    return;
  }
  $("#score").innerHTML = `${s.score[0]} <i>:</i> ${s.score[1]}`;
  $("#clock").textContent =
    `${Math.floor(s.remaining / 60)}:${String(s.remaining % 60).padStart(2, "0")}`;
  $("#match-message").textContent = s.message;
  $("#goal-banner").textContent = s.goal ? "GOAL!" : "";
  $("#goal-banner").classList.toggle("visible", s.goal);
}
function matchEnd({ score, mode }) {
  if (award) return;
  if (mode === "cup" && score[0] === score[1]) {
    game.finished = false;
    game.duration += 30;
    game.message = "Sudden death! Next goal wins.";
    game.suddenDeath = true;
    return;
  }
  const own = mode === "friend" && connection?.role === "guest" ? 1 : 0;
  const forScore = score[own],
    against = score[1 - own];
  const result = forScore > against ? "W" : forScore < against ? "L" : "D";
  let xp = 40 + (result === "W" ? 60 : 0) + forScore * 15;
  let cupWon = false;
  if (mode === "cup") {
    if (result === "W") {
      cup.round++;
      if (cup.round === 3) {
        xp += 300;
        profile.cups++;
        cupWon = true;
        cup = null;
      }
    } else cup = null;
  }
  profile.xp += xp;
  profile.played++;
  if (result === "W") profile.wins++;
  profile.goals += forScore;
  profile.history.unshift({
    score: [forScore, against],
    result,
    xp,
    mode,
    date: Date.now(),
  });
  profile.history = profile.history.slice(0, 10);
  save();
  award = { xp, result, cupWon };
  modal(
    `<div class="result-icon">${cupWon ? "♜" : result === "W" ? "✦" : "⚽"}</div><span class="eyebrow">${cupWon ? "CUP CHAMPION" : "FULL TIME"}</span><h2>${cupWon ? "Silverware secured." : result === "W" ? "That’s how it’s done." : result === "D" ? "Honours even." : "The comeback starts here."}</h2><div class="final-score">${forScore} <i>–</i> ${against}</div><p>+${xp} XP · ${rank().name} · Level ${Math.floor(profile.xp / 200) + 1}</p><button class="button orange" id="result-next">${cup ? "Next round →" : "Back to clubhouse →"}</button>`,
    false,
  );
  $("#result-next").onclick = () => {
    if (mode === "friend") {
      connection?.close();
      connection = null;
    }
    if (cup) {
      game.dispose();
      game = null;
      start("cup");
    } else {
      page = "home";
      render();
    }
  };
}
function bind() {
  document
    .querySelectorAll("[data-nav]")
    .forEach((b) => (b.onclick = () => navigate(b.dataset.nav)));
  $("#quick-play")?.addEventListener("click", () => start());
  $("#practice-mode")?.addEventListener("click", () => start());
  $("#friend-play")?.addEventListener("click", friendModal);
  $("#enter-cup")?.addEventListener("click", () => {
    cup = cup || { round: 0 };
    start("cup");
  });
  $("#leave-match")?.addEventListener("click", () =>
    leave(() => {
      page = "home";
      render();
    }),
  );
  $("#camera")?.addEventListener(
    "click",
    () => (game.cameraMode = 1 - game.cameraMode),
  );
  $("#pause")?.addEventListener("click", () => {
    game.paused = !game.paused;
    $("#pause").textContent = game.paused ? "▷ Resume" : "Ⅱ Pause";
    game.message = game.paused
      ? "Paused. Catch your breath."
      : "Back in the game.";
  });
  $("#how-to")?.addEventListener("click", help);
  $("#help-match")?.addEventListener("click", help);
  $("#profile-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#player-name").value.trim();
    if (!name) return;
    profile.name = name;
    save();
    render();
    toast("Looking good. Player name saved.");
  });
}
function navigate(target) {
  const go = () => {
    if (target === "play") {
      game?.dispose();
      game = null;
      start();
      return;
    }
    page = target;
    render();
    window.scrollTo(0, 0);
  };
  if (game?.started && !game.finished) leave(go);
  else go();
}
function leave(callback) {
  modal(
    '<h2>Leave this match?</h2><p>Unfinished matches don’t earn XP. Your current tournament round can be replayed.</p><div class="modal-actions"><button class="button outline" id="stay">Keep playing</button><button class="button orange" id="leave-confirm">Leave match</button></div>',
    false,
  );
  $("#stay").onclick = closeModal;
  $("#leave-confirm").onclick = () => {
    connection?.close();
    connection = null;
    callback();
  };
}
function bindControls() {
  document
    .querySelectorAll("[data-action]")
    .forEach((b) => (b.onclick = () => game.action(b.dataset.action)));
  const sprint = $("#sprint");
  sprint.onpointerdown = (e) => {
    e.preventDefault();
    sprint.setPointerCapture(e.pointerId);
    game.input.sprint = true;
    sprint.classList.add("held");
  };
  const stop = () => {
    game.input.sprint = false;
    sprint.classList.remove("held");
  };
  sprint.onpointerup = stop;
  sprint.onpointercancel = stop;
  const pad = $("#joystick"),
    stick = $("#stick");
  let active = null;
  function move(e) {
    if (active !== e.pointerId) return;
    const r = pad.getBoundingClientRect(),
      dx = e.clientX - r.left - r.width / 2,
      dz = e.clientY - r.top - r.height / 2,
      len = Math.hypot(dx, dz),
      max = 32,
      scale = len > max ? max / len : 1;
    stick.style.transform = `translate(${dx * scale}px,${dz * scale}px)`;
    game.input.x = (dx * scale) / max;
    game.input.z = (dz * scale) / max;
  }
  pad.onpointerdown = (e) => {
    e.preventDefault();
    active = e.pointerId;
    pad.setPointerCapture(active);
    move(e);
  };
  pad.onpointermove = move;
  const reset = () => {
    active = null;
    stick.style.transform = "";
    game.input.x = 0;
    game.input.z = 0;
  };
  pad.onpointerup = reset;
  pad.onpointercancel = reset;
}
function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3500);
}
function modal(html, closable = true) {
  $("#modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" tabindex="-1">${closable ? '<button class="close-modal" aria-label="Close dialog">×</button>' : ""}${html}</section></div>`;
  $(".modal").focus();
  $(".close-modal")?.addEventListener("click", closeModal);
}
function closeModal() {
  $("#modal-root").innerHTML = "";
}
function help() {
  modal(
    `<span class="eyebrow">NO PLAYBOOK REQUIRED</span><h2>Get on the ball.</h2><p>You control the orange team (blue when you join a friend). Attack the opposite goal. Run into the ball to collect it, or into an opponent to tackle.</p><div class="help-grid"><span><kbd>WASD</kbd> / Arrows</span><b>Move your player</b><span><kbd>SPACE</kbd></span><b>Shoot toward goal</b><span><kbd>J</kbd></span><b>Pass to a teammate</b><span><kbd>K</kbd></span><b>Switch player</b><span><kbd>SHIFT</kbd></span><b>Hold to sprint</b></div><p>On mobile, use the joystick and action buttons. Matches last 90 seconds. Cup draws continue into sudden death.</p>`,
  );
}
function friendModal() {
  if (!window.RTCPeerConnection)
    return toast("Your browser does not support peer-to-peer matches.");
  modal(
    `<span class="eyebrow">A REAL HUMAN ON THE OTHER SIDE</span><h2>Bring your rival.</h2><p>Open this site on both devices. The host shares an invite code; the friend sends a reply code back.</p><div class="friend-choices"><button class="button orange" id="host-friend">Host a match →</button><button class="button outline" id="join-friend">Join a friend →</button></div><p class="network-note">No account required. Peer-to-peer may not connect on restrictive networks; there is no relay server. Codes contain connection metadata—share only with your opponent.</p>`,
  );
  $("#host-friend").onclick = () => signalModal("host");
  $("#join-friend").onclick = () => signalModal("guest");
}
async function signalModal(role) {
  connection?.close();
  connection = new FriendConnection(role, (status) => {
    if (status === "connected") {
      $("#network-status") &&
        ($("#network-status").textContent = "Connected. Starting…");
      setTimeout(() => {
        if (connection !== peer) return;
        game?.dispose();
        game = null;
        start("friend");
      }, 600);
    } else if ($("#network-status")) $("#network-status").textContent = status;
  });
  const peer = connection;
  modal(
    `<span class="eyebrow">${role === "host" ? "HOST A MATCH" : "JOIN A FRIEND"}</span><h2>${role === "host" ? "Set up your pitch." : "Step onto their pitch."}</h2><p>${role === "host" ? "1. Send your invite code to your friend." : "1. Paste the invite code your friend sent you."}</p>${role === "host" ? '<textarea id="out-code" readonly aria-label="Your invite code" placeholder="Creating invite code…"></textarea><button class="button outline" id="copy-code">Copy invite code</button><p>2. Paste their reply code below to connect.</p>' : ""}<textarea id="in-code" aria-label="Connection code" placeholder="Paste ${role === "host" ? "reply" : "invite"} code here"></textarea><button class="button orange" id="connect-friend">${role === "host" ? "Connect & play" : "Create reply code"}</button>${role === "guest" ? '<div id="reply-area"></div>' : ""}<p id="network-status" role="status">${role === "host" ? "Creating secure connection…" : "Waiting for an invite."}</p><p class="network-note">Both players must keep this page open. Allow a few seconds to connect. Public matchmaking is not available.</p>`,
  );
  $(".close-modal").onclick = () => {
    connection?.close();
    connection = null;
    closeModal();
  };
  try {
    if (role === "host") {
      const offer = await peer.offer();
      if (connection !== peer || !$("#out-code")) return;
      $("#out-code").value = offer;
      $("#network-status").textContent =
        "Invite ready. Waiting for your friend’s reply.";
      $("#copy-code").onclick = () => copy($("#out-code"));
    }
  } catch (e) {
    if ($("#network-status")) $("#network-status").textContent = e.message;
    if ($("#connect-friend")) $("#connect-friend").disabled = true;
  }
  if (!$("#connect-friend")) return;
  $("#connect-friend").onclick = async () => {
    const b = $("#connect-friend");
    b.disabled = true;
    try {
      if (role === "host") {
        await peer.accept($("#in-code").value);
        $("#network-status").textContent =
          "Connecting… If this stalls, try another network.";
      } else {
        const reply = await peer.answer($("#in-code").value);
        if (connection !== peer || !$("#reply-area")) return;
        $("#reply-area").innerHTML =
          '<p>2. Send this reply code to the host.</p><textarea id="out-code" readonly aria-label="Your reply code"></textarea><button class="button outline" id="copy-code">Copy reply code</button>';
        $("#out-code").value = reply;
        $("#copy-code").onclick = () => copy($("#out-code"));
        $("#network-status").textContent =
          "Reply ready. Waiting for the host to connect.";
      }
    } catch (e) {
      if ($("#network-status")) $("#network-status").textContent = e.message;
      b.disabled = false;
    }
  };
}
async function copy(el) {
  try {
    await navigator.clipboard.writeText(el.value);
    toast("Copied. Send the code to your friend.");
  } catch {
    el.select();
    toast("Select the code and copy it manually.");
  }
}
render();
