# Touchline

A mobile-first football management prototype inspired by the approachable management games of the early 2000s. Built with Vite, vanilla JavaScript and Three.js.

## Develop

Use Node.js 22.12+ (validated on Node 24).

```sh
npm ci --cache /tmp/football-npm-cache
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

## Play

Manage Riverside FC from the dashboard. Set a formation and mentality in Tactics, sign one of the three scouting recommendations in Transfers, and inspect the updated Squad. Kick off from Match Centre, pause or change match speed, and toggle the stadium camera. Goals trigger a close-up 3D shot sequence. Completed results are recorded in Fixtures. Continue advances to the next matchweek.

Progress, transfers and tactics are saved in this browser's local storage. Club → Start a new season resets the save after confirmation. WebGL is required for 3D; commentary and match controls remain available without it. No accounts, credentials or external services are required.

## Prototype scope

The match is a scripted 2–1 demonstration with procedural low-poly 3D graphics. It is not yet a tactical football engine: tactics do not affect the result, other league teams do not simulate their fixtures, and subsequent demo matches repeat the opponent. The league position, board confidence, news and historical form are sample data. There is no backend, multiplayer, cloud save or licensed game content.

Browser checks cover 3D rendering, tactics persistence, transfer signing, squad updates, start/speed/pause controls, mobile navigation and no horizontal overflow at 390px. The production build also passes.
