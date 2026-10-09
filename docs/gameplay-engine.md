# Match engine decision

Godot 4.6.3 was chosen because it provides a real 3D physics world, fixed physics ticks, character collision/movement, rigid-body ball behavior, cameras, animation tools, and single-threaded browser export. No MCP replaces these systems. The existing interface, cups and progression are retained around an embedded browser export.

This milestone improves control and simulation: acceleration/deceleration, stamina, charged shots with airborne trajectories, directional passing, explicit tackling, support runs, predictive keepers, procedural running/kicking, gamepad mapping, camera following, and sound. Models are original procedural low-poly geometry. Professional motion capture, licensed player models, advanced football rules, scalable matchmaking and authoritative online ratings are outside this milestone.

Native validation: 15 meaningful Godot checks pass. WebRTC remains unverified due to managed browser UDP restrictions. Controller mappings are implemented but physical controller hardware is unavailable. Browser and export validation results are recorded in the completion report.

Browser validation passed for actual WASM startup, six rendered footballers, charged shot input, movement, sprint drain, pause, desktop/mobile rendering and leaving a match. The final 390×844 layout has no horizontal overflow and keeps Shoot above the bottom navigation. Clean-directory restoration of the published engine from the ZIP was verified.
