import test from "node:test";
import assert from "node:assert/strict";
import { FootballGame } from "../src/game.js";
function game() {
  const g = Object.create(FootballGame.prototype);
  Object.assign(g, {
    players: [],
    controlled: [2, 7],
    owner: 2,
    ball: { x: -6, z: 0, vx: 0, vz: 0 },
    score: [0, 0],
    elapsed: 0,
    duration: 90,
    kickCooldown: 0,
    goalPause: 0,
    difficulty: 1,
    finished: false,
    onUpdate() {},
    onEnd() {},
  });
  for (let team = 0; team < 2; team++)
    for (let i = 0; i < 5; i++) {
      const p = [
        [-27, 0],
        [-15, -10],
        [-6, 0],
        [-13, 10],
        [4, 5],
      ][i];
      g.players.push({
        x: p[0] * (team ? -1 : 1),
        z: p[1],
        base: { x: p[0] * (team ? -1 : 1), z: p[1] },
        team,
        i,
        dx: team ? -1 : 1,
        dz: 0,
      });
    }
  return g;
}
test("player input moves the selected footballer, and sprint is faster", () => {
  const g = game(),
    x = g.players[2].x;
  g.step(0.1, { x: 1, z: 0, sprint: false });
  const normal = g.players[2].x - x;
  const fast = game();
  fast.step(0.1, { x: 1, z: 0, sprint: true });
  assert.ok(normal > 0);
  assert.ok(fast.players[2].x - x > normal);
});
test("shooting releases the ball toward the attacking goal", () => {
  const g = game();
  g.applyAction("shoot", 0);
  assert.equal(g.owner, -1);
  assert.ok(g.ball.vx > 0);
  assert.ok(g.kickCooldown > 0);
});
test("passing releases possession and switches to the receiver", () => {
  const g = game();
  g.applyAction("pass", 0);
  assert.equal(g.owner, -1);
  assert.notEqual(g.controlled[0], 2);
  assert.equal(g.players[g.controlled[0]].team, 0);
});
test("a ball crossing the goal line scores and kickoff resets safely", () => {
  const g = game();
  g.owner = -1;
  g.kickCooldown = 1;
  g.ball = { x: 29.9, z: 0, vx: 20, vz: 0 };
  g.step(0.02, { x: 0, z: 0 });
  assert.deepEqual(g.score, [1, 0]);
  assert.ok(g.goalPause > 0);
  g.step(3, { x: 0, z: 0 });
  assert.ok(g.owner >= 0);
  assert.equal(g.controlled[g.players[g.owner].team], g.owner);
});
test("out-of-goal shots rebound without scoring", () => {
  const g = game();
  g.owner = -1;
  g.kickCooldown = 1;
  g.ball = { x: 29.9, z: 12, vx: 20, vz: 0 };
  g.step(0.02, { x: 0, z: 0 });
  assert.deepEqual(g.score, [0, 0]);
  assert.ok(g.ball.vx < 0);
});
test("sudden death ends on the first goal and only reports once", () => {
  const g = game();
  g.suddenDeath = true;
  g.owner = -1;
  g.kickCooldown = 1;
  g.ball = { x: 29.9, z: 0, vx: 20, vz: 0 };
  let ended = 0;
  g.onEnd = () => ended++;
  g.step(0.02, { x: 0, z: 0 });
  assert.equal(g.finished, true);
  g.finish();
  assert.equal(ended, 1);
});
test("AI goalkeeper releases the ball instead of holding it forever", () => {
  const g = game();
  g.owner = 5;
  g.ball.x = g.players[5].x;
  g.step(0.01, { x: 0, z: 0 });
  assert.equal(g.owner, -1);
  assert.ok(g.ball.vx < 0);
});
