extends SceneTree
var failures := 0
var checks := 0
func _initialize() -> void:
	call_deferred("run_tests")
func check(condition: bool, label: String) -> void:
	checks += 1
	if condition: print("PASS: ", label)
	else:
		failures += 1
		push_error("FAIL: " + label)
func run_tests() -> void:
	var scene = load("res://match.tscn").instantiate()
	root.add_child(scene)
	await physics_frame
	check(scene.players.size() == 6, "3v3 includes six colliding player bodies")
	check(scene.ball is RigidBody3D, "ball uses rigid body physics")
	scene.input_vectors[0] = Vector2.RIGHT
	scene.sprinting[0] = true
	var initial_x: float = scene.players[1].body.position.x
	await physics_frame
	check(scene.players[1].body.velocity.x > 0 and scene.players[1].body.velocity.x < 8.5, "movement accelerates instead of snapping to top speed")
	for i in 15: await physics_frame
	check(scene.players[1].body.position.x > initial_x, "movement advances the controlled player")
	check(scene.players[1].stamina < 100, "sprint drains stamina")
	scene.reset_kickoff(0)
	scene.input_vectors[0] = Vector2.ZERO
	scene.sprinting[0] = false
	scene.perform_action("charge", 0)
	for i in 15: await physics_frame
	check(scene.charge[0] > 0.1, "holding shoot charges power")
	scene.perform_action("shoot", 0)
	check(scene.possessor == -1 and scene.ball.linear_velocity.x > 10, "shot releases the ball toward the attacking goal")
	check(scene.ball.linear_velocity.y > 0, "shots have a physical trajectory")
	check(not scene.charging[0] and scene.charge[0] == 0, "release clears charging state")
	scene.reset_kickoff(0)
	scene.pass_ball(1, Vector2(0, 1))
	check(scene.controlled[0] == 2 and scene.possessor == -1, "directional passing selects and releases to a teammate")
	scene.reset_kickoff(0)
	scene.possessor = 4
	scene.players[4].body.position = scene.players[1].body.position + Vector3(0.9, 0, 0)
	scene.players[1].tackle_cd = 0
	scene.tackle(1)
	check(scene.possessor == 1 and scene.players[4].stunned > 0, "nearby tackle steals possession and delays the opponent")
	scene.reset_kickoff(0)
	scene.possessor = -1
	scene.cooldown = 1
	scene.ball.position = Vector3(20.6, 0.6, 0)
	scene.ball.linear_velocity = Vector3(2, 0, 0)
	for i in 3: await physics_frame
	check(scene.score[0] == 1 and scene.goal_pause > 0, "ball crossing the goal mouth scores")
	scene.goal_pause = 0
	scene.reset_kickoff(0)
	scene.score = [1, 1]
	scene.mode = "cup"
	scene.elapsed = 90
	scene.duration = 90
	for i in 2: await physics_frame
	check(scene.sudden_death and not scene.finished, "a tied cup enters sudden death")
	scene.register_goal(0)
	check(scene.finished and scene.score[0] == 2, "first sudden-death goal ends the round")
	scene.register_goal(0)
	check(scene.score[0] == 2, "finished match cannot award the same goal twice")
	print("Godot gameplay checks: %d passed, %d failed" % [checks - failures, failures])
	scene.queue_free()
	await process_frame
	quit(1 if failures else 0)
