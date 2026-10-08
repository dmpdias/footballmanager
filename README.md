# Powerplay

An original, mobile-first arcade football prototype inspired by Power Soccer / Power Challenge. The player controls the footballers, rather than managing a team from the sidelines. Uses Vite, vanilla JavaScript and Three.js; no licensed branding or artwork.

## Run locally

Node.js 22.12+ is required (validated on Node 24).

```sh
npm ci --cache /tmp/football-npm-cache
npm run dev
```

Open the address printed by Vite. For a production build:

```sh
npm test
npm run build
npm run preview
```

## Controls

- WASD or arrow keys: move; Shift: sprint.
- Space: shoot; J: pass; K: switch to a teammate.
- On mobile: movement joystick and Shoot, Pass, Switch, Sprint buttons.
- Collect the ball by running into it; tackle by getting close to an opponent.
- Orange attacks the right goal; blue attacks the left.

Quick matches run for 90 seconds against AI. The Weekend Cup has three increasingly difficult AI opponents. A cup draw continues into sudden death. Completed matches, goals, wins and trophies earn XP. Six ranks are earned from that XP. Profile, rank, and match history are saved in this browser's local storage. The current cup bracket lasts for the page session.

## Friend matches

Open the deployed site on both devices. Select Play a friend. The host creates an invite code; the other player selects Join, pastes that code, and creates a reply code. Send the reply back to the host and paste it into their reply box. Keep both pages open. The host simulates the match; the guest sends player inputs and receives snapshots through a WebRTC data channel.

The optional Google STUN server is `stun:stun.l.google.com:19302`. No signaling service, account, or credential is required. Codes contain temporary connection metadata: share them only with the intended opponent. HTTPS or localhost is recommended. There is no TURN relay, reconnection, public matchmaking, global leaderboard, or online tournament service. Restrictive networks or managed browser policies can prevent peer connections. Ranks are local personal progression, not secure global ratings.

Live WebRTC gameplay could not be verified in the cloud test environment: its managed Chromium policy disables non-proxied UDP, yielding zero ICE candidates. The app reports this restriction instead of pretending to connect. Remote internet connectivity needs validation on ordinary browsers and compatible networks before an online readiness claim.

## Deployment

The repository includes `footballmanager-deploy.zip` for compatibility with the original download link and `powerplay-deploy.zip` for the new game. Both contain the current production build. Download either ZIP from GitHub using Download raw file, extract it, and upload the extracted directory (with index.html at its root) to Netlify Drop. The old deployment will only change after you upload the new build.

## Validation

Seven automated gameplay tests cover movement, sprinting, shooting, passing/switching, goal detection, out-of-goal rebounds, sudden death, and goalkeeper release. Browser checks cover desktop/mobile rendering, no horizontal overflow at 390px, keyboard shooting, pause, profile persistence, cup entry, three-round advancement, XP/trophy calculation and rank persistence. Cup outcome integration tests inject deterministic results to exercise rewards; the physics tests independently exercise real scoring. Peer connection testing remains blocked as described above.

Historical identification was confirmed by the user. External reference-page requests were denied by the cloud proxy, so historical details have not been independently verified. See docs/design.md.
