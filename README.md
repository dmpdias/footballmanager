# Powerplay · Godot gameplay edition

An original browser arcade football game inspired by Power Soccer. Live matches now use Godot 4.6.3, with real colliding player bodies and a rigid-body ball. The clubhouse still uses Vite/Three.js for its lightweight stadium preview.

## Play without npm (Mac)

Download or update this repository, then extract the included production ZIP and serve it:

```sh
cd ~/Downloads/powerplay
git pull
unzip -o powerplay-deploy.zip -d local-game
cd local-game
python3 -m http.server 8000
```

Open http://localhost:8000 and use Quick play. Keep Terminal open. Ctrl+C stops the server. The ZIP also works with Netlify Drop. For an existing deployment, upload the extracted folder with index.html at its root. Replacing source files alone does not update your deployed game.

The browser engine requires WebGL 2 and WebAssembly. It is single-threaded, so no cross-origin isolation headers are needed. The initial engine download is around 37 MB before HTTP compression; the ZIP is smaller. First load can take time. Hardware acceleration improves performance.

## Match controls

- WASD / arrow keys: move with acceleration and braking.
- Shift: sprint; stamina drains and regenerates.
- Hold Space: charge a shot; release: shoot. Movement up/down aims toward goal corners.
- J: directional pass toward a teammate; K: switch player.
- I: through pass into space; E: request a forward teammate run.
- Q (hold): shield the ball or slow down to jockey.
- Alt + Space: charge/release a placed finesse finish.
- L: tackle; approach the exposed ball side. Shielding protects from behind; missed tackles have recovery time.
- Mobile: joystick plus Sprint, Shield, Run, Pass, Through, Switch, Tackle, Shoot and Finesse. Hold/release either shot button.
- Standard-mapped controller: left stick moves; A passes; hold/release B shoots; X tackles; Y switches; right trigger sprints. Controller hardware has not been physically tested; browser gamepad access is optional and keyboard/touch still work if denied.

Matches are 3v3 including one goalkeeper on each side, with a 90-second active clock. Dribbling uses timed foot contacts and first-touch control. Teammates seek open passing lanes and run on request; defenders split pressing and receiver coverage. Keepers react to shot paths, catch slower balls and parry fast/high shots into live rebounds. Arena boards rebound the ball to keep play flowing. Cup ties use sudden death. The camera follows the selected player and ball; Camera toggles a wider view. Goals trigger a camera celebration and synthesized sound. Player animation is procedural and stylized, not motion capture.

XP, six personal ranks, trophies, and profile history remain saved in local browser storage. The current AI cup lasts for the page session.

## Develop the web interface

Node 22.12+ (validated on 24):

```sh
npm ci
npm run dev
npm test
npm run build
```

The predev/prebuild scripts restore the published engine assets from powerplay-deploy.zip into ignored public/engine/ if missing. Editing JavaScript/CSS does not require Godot. Editing Godot scripts requires exporting the engine again before building the site; restored ZIP assets are the last published build, not a compilation of changed source.

## Develop the match engine

Install standard Godot 4.6.3 and its matching official export templates. Open godot/project.godot in the editor, or use a godot command on PATH:

```sh
npm run engine:test
npm run engine:build
npm run build
```

In the cloud environment, export templates are retained at /workspace/.godot-tools/data; set XDG_DATA_HOME=/workspace/.godot-tools/data, XDG_CONFIG_HOME=/workspace/.godot-tools/config and XDG_CACHE_HOME=/workspace/.godot-tools/cache for Godot commands. The downloaded official templates were verified against the release SHA-512 manifest before extraction. Do not disable checksum or TLS verification when refreshing them.

## Multiplayer scope

Friend mode uses the same Godot simulation: the host is authoritative, the guest sends input and receives player/ball snapshots over WebRTC. Exchange invite/reply codes through Play a friend. Both players keep their pages open. Optional STUN: stun:stun.l.google.com:19302. No TURN relay, public matchmaking, accounts, global leaderboard or online tournament server is provided. Codes contain temporary connection metadata: share only with your intended opponent.

Live peer connectivity remains unverified in this cloud environment, whose managed Chromium policy blocks non-proxied UDP. Some networks require a relay. Personal XP is not a secure online competitive rating. Godot improves the simulation foundation; this is a playable arcade prototype, not an FC production-quality replacement.

## Tests

Run npm run engine:test for 15 engine checks and 23 match scenarios. Scenarios exercise actual pass delivery, interceptions, through-ball reception, sprint turns, requested runs, shielding, tackle recovery, keeper parries, shot aim, missed goals and pause. The JavaScript suite covers the retained lobby/legacy renderer simulation. Browser verification exercises the actual WebAssembly export and UI bridge, keyboard/touch controls, loading, pause, camera and layout. See docs/gameplay-engine.md for current evidence and limitations.
