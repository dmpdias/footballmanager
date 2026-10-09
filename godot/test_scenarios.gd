extends SceneTree

# Match scenarios run the real physics loop: actions must produce useful football
# outcomes, rather than merely setting the requested velocity or flag.
var failures := 0
var checks := 0
var scene: Node3D

func _initialize() -> void:
	call_deferred("run_tests")

func check(condition: bool, label: String) -> void:
	checks += 1
	if condition:
		print("PASS: ", label)
	else:
		failures += 1
		push_error("FAIL: " + label)

func frames(count: int) -> void:
	for i in count:
		await physics_frame

func fixture() -> void:
	if is_instance_valid(scene):
		scene.queue_free()
		await process_frame
	scene = load("res://match.tscn").instantiate()
	root.add_child(scene)
	await physics_frame
	scene.mode = "friend"
	scene.elapsed = 5.0
	scene.input_vectors = [Vector2.ZERO, Vector2.ZERO]
	scene.controlled = [1, 4]
	# Isolate the tested encounter. The six real colliders remain on the pitch;
	# actors outside it cannot turn this into a different tactical scenario.
	for i in scene.players.size():
		var p: Dictionary = scene.players[i]
		p.body.position = Vector3(-17 if p.team == 0 else 17, 0, -11 + p.role * 2)
		p.body.velocity = Vector3.ZERO
		p.stunned = 20.0
		p.tackle_cd = 20.0
		p.heading = Vector3.RIGHT if p.team == 0 else Vector3.LEFT
	scene.possessor = 1
	scene.players[1].body.position = Vector3(0, 0, 0)
	scene.players[1].stunned = 0.0
	scene.ball.freeze = true
	scene.ball.position = Vector3(0.85, 0.28, 0)
	scene.ball.linear_velocity = Vector3.ZERO
	scene.ball.angular_velocity = Vector3.ZERO
	scene.ball.freeze = false
	scene.cooldown = 0.0
	scene.previous_ball = scene.ball.position
	scene.paused = true
	await frames(2)
	scene.paused = false

func run_tests() -> void:
	await fixture()
	scene.players[2].body.position = Vector3(8, 0, 0)
	scene.pass_ball(1, Vector2.RIGHT)
	await frames(75)
	check(scene.possessor == 2, "an unobstructed short pass reaches a stationary teammate")
	check(scene.controlled[0] == 2, "pass receiver is selected for the next player action")

	await fixture()
	scene.players[2].body.position = Vector3(10, 0, 0)
	scene.players[4].body.position = Vector3(4, 0, 0)
	scene.pass_ball(1, Vector2.RIGHT)
	var intercepted := false
	for i in 75:
		await physics_frame
		if scene.possessor >= 0 and scene.players[scene.possessor].team == 1:
			intercepted = true
			break
	check(intercepted, "a defender standing in the pass lane can intercept before the receiver")

	await fixture()
	scene.input_vectors[0] = Vector2.RIGHT
	scene.sprinting[0] = true
	await frames(45)
	var sprint_stamina: float = scene.players[1].stamina
	check(scene.players[1].body.position.x > 3.0, "sprinting progresses the carrier several metres")
	check(scene.ball.position.distance_to(scene.players[1].body.position) < 2.3, "an uncontested forward sprint keeps the ball in playing distance")
	scene.sprinting[0] = false
	scene.input_vectors[0] = Vector2.ZERO
	await frames(45)
	check(scene.players[1].stamina > sprint_stamina, "resting after a sprint restores stamina")
	check(Vector2(scene.players[1].body.velocity.x, scene.players[1].body.velocity.z).length() < 0.3, "releasing movement brakes the player")

	await fixture()
	scene.players[2].body.position = Vector3(6, 0, 0)
	scene.players[2].stunned = 0
	scene.pass_ball(1, Vector2.RIGHT, true)
	scene.input_vectors[0] = Vector2.RIGHT
	var received_run := false
	for i in 100:
		await physics_frame
		if scene.possessor == 2:
			received_run = true
			break
	check(received_run and scene.players[2].body.position.x > 7.0, "a through ball can be collected by its teammate running into space")

	await fixture()
	scene.input_vectors[0] = Vector2.RIGHT
	scene.sprinting[0] = true
	await frames(45)
	scene.input_vectors[0] = Vector2.DOWN
	await frames(35)
	check(scene.possessor == 1 and scene.ball.position.distance_to(scene.players[1].body.position) < 2.7, "a controlled sprint turn leaves the ball within reach")
	check(scene.players[1].body.velocity.z > 5 and absf(scene.players[1].body.velocity.x) < 1, "turning changes running direction after player inertia settles")

	await fixture()
	scene.players[2].stunned = 0
	scene.players[2].body.position = Vector3(4, 0, 5)
	var run_start: float = scene.players[2].body.position.x
	scene.perform_action("run", 0)
	await frames(45)
	check(scene.players[2].body.position.x > run_start + 2.0, "requesting a teammate run creates forward movement without passing possession")
	check(scene.possessor == 1, "requesting a run leaves the controlled player carrying the ball")

	await fixture()
	scene.players[1].shield = true
	scene.players[4].body.position = Vector3(-0.3, 0, 0)
	scene.players[4].heading = Vector3.RIGHT
	scene.players[4].tackle_cd = 0
	scene.tackle(4)
	check(scene.possessor == 1, "shielding protects the ball from a tackle through the carrier's back")
	scene.players[4].body.position = Vector3(1.4, 0, 0)
	scene.players[4].heading = Vector3.LEFT
	scene.tackle(4)
	check(scene.possessor == 1, "a missed tackle cannot be instantly repeated during recovery")
	scene.players[4].tackle_cd = 0
	scene.tackle(4)
	check(scene.possessor == 4, "shielding still allows a correctly timed tackle from the exposed ball side")

	await fixture()
	scene.players[3].body.position = Vector3(18.3, 0, 0)
	scene.players[3].stunned = 0
	scene.possessor = -1
	scene.cooldown = 0
	scene.ball.freeze = true
	scene.ball.position = Vector3(12, 1.7, 0)
	scene.ball.linear_velocity = Vector3.ZERO
	scene.paused = true
	await frames(2)
	scene.paused = false
	scene.ball.freeze = false
	scene.ball.linear_velocity = Vector3(28, 2.0, 0)
	var parried := false
	for i in 60:
		await physics_frame
		if scene.message.begins_with("Parried"):
			parried = true
			break
	check(parried and scene.ball.linear_velocity.x < 0 and scene.possessor == -1, "keeper reacts to a high fast shot and parries it into a live rebound")
	check(scene.score == [0, 0], "a reachable goalkeeper parry prevents the shot crossing the goal line")

	await fixture()
	scene.players[1].body.position = Vector3(10, 0, 0)
	scene.input_vectors[0] = Vector2(1, -1).normalized()
	scene.shoot(1, 0.65)
	var first_aim: float = scene.ball.linear_velocity.z
	await fixture()
	scene.players[1].body.position = Vector3(10, 0, 0)
	scene.input_vectors[0] = Vector2(1, 1).normalized()
	scene.shoot(1, 0.65)
	check(first_aim < -1.0 and scene.ball.linear_velocity.z > 1.0, "opposite shot aim inputs target opposite goal corners")

	for variant in ["normal", "finesse"]:
		await fixture()
		scene.players[1].body.position = Vector3(10, 0, 0)
		scene.ball.freeze = true
		scene.ball.position = Vector3(10.85, 0.28, 0)
		scene.paused = true
		await frames(2)
		scene.paused = false
		scene.ball.freeze = false
		scene.input_vectors[0] = Vector2(1, 1 if variant == "normal" else -1).normalized()
		scene.shoot(1, 0.65, variant)
		for i in 80:
			await physics_frame
			if scene.score[0] == 1:
				break
		check(scene.score == [1, 0] and scene.goal_pause > 0, "an unopposed %s corner shot crosses under the bar and scores" % variant)

	await fixture()
	scene.possessor = -1
	scene.cooldown = 2.0
	scene.previous_ball = Vector3(20, 3.1, 0)
	scene.ball.position = Vector3(20.7, 3.1, 0)
	scene.ball.linear_velocity = Vector3(8, 0, 0)
	await frames(2)
	check(scene.score == [0, 0], "a shot above the crossbar is not awarded a goal")

	await fixture()
	scene.possessor = -1
	scene.cooldown = 2.0
	scene.previous_ball = Vector3(20, 0.6, 5)
	scene.ball.position = Vector3(20.7, 0.6, 5)
	scene.ball.linear_velocity = Vector3(8, 0, 0)
	await frames(2)
	check(scene.score == [0, 0], "a shot outside the posts is not awarded a goal")

	await fixture()
	scene.paused = true
	var paused_at: Vector3 = scene.players[1].body.position
	var paused_time: float = scene.elapsed
	scene.input_vectors[0] = Vector2.RIGHT
	scene.perform_action("shoot", 0)
	await frames(10)
	check(scene.players[1].body.position.is_equal_approx(paused_at) and is_equal_approx(scene.elapsed, paused_time), "pause stops movement, shooting and the match clock")

	print("Godot match scenarios: %d passed, %d failed" % [checks - failures, failures])
	scene.queue_free()
	await process_frame
	quit(1 if failures else 0)
