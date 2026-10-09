# Match engine decision

Godot 4.6.3 was chosen because it provides a real 3D physics world, fixed physics ticks, character collision/movement, rigid-body ball behavior, cameras, animation tools, and single-threaded browser export. No MCP replaces these systems. The existing interface, cups and progression are retained around an embedded browser export.

This milestone improves control and simulation: acceleration/deceleration, stamina, charged shots with airborne trajectories, directional passing, explicit tackling, support runs, predictive keepers, procedural running/kicking, gamepad mapping, camera following, and sound. Models are original procedural low-poly geometry. Professional motion capture, licensed player models, advanced football rules, scalable matchmaking and authoritative online ratings are outside this milestone.

Native validation: 15 meaningful Godot checks pass. WebRTC remains unverified due to managed browser UDP restrictions. Controller mappings are implemented but physical controller hardware is unavailable. Browser and export validation results are recorded in the completion report.

Browser validation passed for actual WASM startup, six rendered footballers, charged shot input, movement, sprint drain, pause, desktop/mobile rendering and leaving a match. The final 390×844 layout has no horizontal overflow and keeps Shoot above the bottom navigation. Clean-directory restoration of the published engine from the ZIP was verified.

## Gameplay revision with four agents

Separate action, tactics, controls and scenario-testing agents contributed this revision. Dribbling now uses discrete physical touches; turning preserves inertia. First touches reject fast outfield traps. Directional passes can lead runners, through balls invite runs, and finesse is a placed lower-pace shot (no simulated curl). Shielding slows the carrier and protects the ball from rear tackles; misses impose recovery. AI chooses open support lanes, splits pressing from coverage and reacts before catches/parries.

Validation: 15 native engine checks and 23 real-physics match scenarios pass. Tests cover completed passes, interceptions, sprint turns, through-ball reception, teammate runs, shielding from both sides, keeper parry/rebound, goal bounds and pause. Browser bridge/layout tests cover new keyboard and touch actions. These are functional checks; tuning subjective feel still needs human playtesting.

The revision browser smoke observed actual WASM startup, charging, movement/stamina, pause and desktop/mobile rendering. Its final leave-match/cleanup step stalled under software rendering and was interrupted; that final step is not counted as passed in this revision. Keyboard/touch command delivery and mobile layout passed separately using a mocked engine bridge.
