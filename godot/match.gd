extends Node3D

const FIELD_X := 20.0
const FIELD_Z := 13.0
const GOAL_HALF := 3.4
const GAME_LENGTH := 90.0
var players: Array[Dictionary] = []
var ball: RigidBody3D
var camera: Camera3D
var ring: MeshInstance3D
var direction_arrow: MeshInstance3D
var score := [0, 0]
var controlled := [1, 4]
var possessor := 1
var last_owner := 1
var receiver := -1
var elapsed := 0.0
var duration := GAME_LENGTH
var goal_pause := 0.0
var cooldown := 0.0
var emit_clock := 0.0
var possession_age := 0.0
var previous_ball := Vector3.ZERO
var finished := false
var paused := false
var remote_only := false
var sudden_death := false
var charge := [0.0, 0.0]
var charging := [false, false]
var input_vectors := [Vector2.ZERO, Vector2.ZERO]
var sprinting := [false, false]
var local_team := 0
var mode := "practice"
var difficulty := 1.0
var camera_mode := 0
var message := "Orange attacks right. Pass, find space, and shoot."
var callback: JavaScriptObject
var native_shooting := false

func _ready() -> void:
	paused = OS.has_feature("web")
	build_world()
	build_players()
	build_ball()
	reset_kickoff(0)
	if OS.has_feature("web"):
		callback = JavaScriptBridge.create_callback(browser_command)
		JavaScriptBridge.get_interface("window").powerplayCommand = callback
		send_event({"type": "ready"})

func material(color: Color, roughness: float = 0.8) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = roughness
	return m

func box(parent: Node3D, size: Vector3, at: Vector3, color: Color, solid: bool = false) -> MeshInstance3D:
	var mesh := MeshInstance3D.new()
	var shape := BoxMesh.new()
	shape.size = size
	mesh.mesh = shape
	mesh.material_override = material(color)
	mesh.position = at
	parent.add_child(mesh)
	if solid:
		var body := StaticBody3D.new()
		var collider := CollisionShape3D.new()
		var collision := BoxShape3D.new()
		collision.size = size
		collider.shape = collision
		body.position = at
		body.add_child(collider)
		parent.add_child(body)
	return mesh

func build_world() -> void:
	var env := WorldEnvironment.new()
	var settings := Environment.new()
	settings.background_mode = Environment.BG_COLOR
	settings.background_color = Color("91b1bd")
	settings.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	settings.ambient_light_color = Color("d2e0dd")
	settings.ambient_light_energy = 0.35
	settings.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	settings.tonemap_white = 4.0
	settings.tonemap_exposure = 0.85
	env.environment = settings
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-58, -35, 0)
	sun.light_color = Color("fff0d5")
	sun.light_energy = 0.9
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 85.0
	add_child(sun)
	box(self, Vector3(64, 0.5, 46), Vector3(0, -0.25, 0), Color("586e66"), true)
	for i in 10:
		box(self, Vector3(4, 0.08, 26), Vector3(-18 + i * 4, -0.025, 0), Color("438554") if i % 2 else Color("4d905b"))
	# Painted lines sit just above the physical turf.
	for z in [-FIELD_Z, FIELD_Z]:
		box(self, Vector3(40, 0.012, 0.065), Vector3(0, 0.026, z), Color("e5edd6"))
	for x in [-FIELD_X, 0.0, FIELD_X]:
		box(self, Vector3(0.065, 0.012, 26), Vector3(x, 0.026, 0), Color("e5edd6"))
	var centre := TorusMesh.new()
	centre.inner_radius = 3.4
	centre.outer_radius = 3.46
	var circle := MeshInstance3D.new()
	circle.mesh = centre
	circle.material_override = material(Color("e5edd6"))
	circle.position.y = 0.026
	circle.scale.y = 0.02
	add_child(circle)
	for side in [-1, 1]:
		for z in [-7.0, 7.0]:
			box(self, Vector3(6, 0.012, 0.06), Vector3(side * 17, 0.026, z), Color("e5edd6"))
		box(self, Vector3(0.06, 0.012, 14), Vector3(side * 14, 0.026, 0), Color("e5edd6"))
		for z in [-GOAL_HALF, GOAL_HALF]:
			box(self, Vector3(0.14, 2.5, 0.14), Vector3(side * 20.3, 1.25, z), Color("eeeeda"), true)
		box(self, Vector3(0.14, 0.14, GOAL_HALF * 2 + 0.14), Vector3(side * 20.3, 2.5, 0), Color("eeeeda"), true)
		# Back/side netting and solid catch wall.
		box(self, Vector3(0.1, 2.6, 7.0), Vector3(side * 22.0, 1.3, 0), Color(0.75, 0.85, 0.79, 0.12), true).visible = false
		for z in range(-6, 7):
			box(self, Vector3(0.025, 2.45, 0.025), Vector3(side * 22.0, 1.2, z * 0.52), Color("adbeb0"))
		for y in range(1, 6):
			box(self, Vector3(0.025, 0.025, 6.8), Vector3(side * 22.0, y * 0.42, 0), Color("adbeb0"))
		for z in [-GOAL_HALF, GOAL_HALF]:
			for y in range(1, 6):
				box(self, Vector3(1.7, 0.025, 0.025), Vector3(side * 21.15, y * 0.42, z), Color("adbeb0"))
		# Arena boundaries: live rebounds keep short arcade matches flowing.
		box(self, Vector3(44, 0.7, 0.3), Vector3(0, 0.35, side * 13.6), Color("203c33"), true)
		for z in [-8.5, 8.5]:
			box(self, Vector3(0.3, 0.7, 10), Vector3(side * 20.8, 0.35, z), Color("203c33"), true)
		for row in range(5):
			box(self, Vector3(52, 0.7, 1.6), Vector3(0, 0.4 + row * 0.75, side * (15.4 + row * 1.4)), Color("687d7b"))
			box(self, Vector3(52, 0.15, 1.1), Vector3(0, 0.88 + row * 0.75, side * (15.4 + row * 1.4)), Color("253f4b") if row % 2 else Color("bdc7af"))
		# Multimesh spectators: hundreds of seats in a single draw call per stand.
		var crowd := MultiMeshInstance3D.new()
		var multimesh := MultiMesh.new()
		multimesh.transform_format = MultiMesh.TRANSFORM_3D
		multimesh.use_colors = true
		var spectator := CapsuleMesh.new()
		spectator.radius = 0.12
		spectator.height = 0.42
		multimesh.mesh = spectator
		multimesh.instance_count = 300
		for i in 300:
			var x := -25.0 + (i % 60) * 0.84
			var row := int(i / 60)
			multimesh.set_instance_transform(i, Transform3D(Basis(), Vector3(x, 1.25 + row * 0.75, side * (15.4 + row * 1.4))))
			multimesh.set_instance_color(i, [Color("ecc295"), Color("273f50"), Color("e88a60"), Color("a6baad")][i % 4])
		crowd.multimesh = multimesh
		var crowd_mat := material(Color.WHITE)
		crowd_mat.vertex_color_use_as_albedo = true
		crowd.material_override = crowd_mat
		add_child(crowd)
		if side == -1:
			box(self, Vector3(54, 0.35, 9), Vector3(0, 7.0, -18), Color("243c42"))
		for x in [-25, 25]:
			box(self, Vector3(0.2, 12, 0.2), Vector3(x, 6, side * 17), Color("81918c"))
			box(self, Vector3(2.7, 0.8, 0.4), Vector3(x, 12, side * 17), Color("ece6c9"))
	camera = Camera3D.new()
	camera.position = Vector3(0, 27, 24)
	camera.fov = 52
	camera.current = true
	add_child(camera)
	camera.look_at(Vector3.ZERO)
	ring = MeshInstance3D.new()
	var marker := TorusMesh.new()
	marker.inner_radius = 0.56
	marker.outer_radius = 0.7
	ring.mesh = marker
	ring.scale.y = 0.04
	ring.material_override = material(Color("ffe9a3"))
	add_child(ring)
	direction_arrow = box(self, Vector3(0.09, 0.015, 1.0), Vector3.ZERO, Color("ffe9a3"))

func build_players() -> void:
	for team in 2:
		for role in 3:
			var p := CharacterBody3D.new()
			p.name = "Player_%d_%d" % [team, role]
			p.collision_layer = 2
			p.collision_mask = 3
			var shape := CollisionShape3D.new()
			var capsule := CapsuleShape3D.new()
			capsule.radius = 0.31
			capsule.height = 1.6
			shape.shape = capsule
			shape.position.y = 0.82
			p.add_child(shape)
			add_child(p)
			var model := Node3D.new()
			p.add_child(model)
			var kit := Color("f68048") if team == 0 else Color("76c6df")
			if role == 0: kit = Color("dde76e") if team == 0 else Color("af92d0")
			box(model, Vector3(0.55, 0.63, 0.3), Vector3(0, 1.13, 0), kit)
			box(model, Vector3(0.51, 0.29, 0.3), Vector3(0, 0.69, 0), Color("263e39") if team == 0 else Color("24425a"))
			var head := MeshInstance3D.new()
			var sphere := SphereMesh.new()
			sphere.radius = 0.21
			sphere.height = 0.42
			head.mesh = sphere
			head.material_override = material(Color("b87f5d") if role % 2 else Color("e2ac82"))
			head.position.y = 1.68
			model.add_child(head)
			box(model, Vector3(0.35, 0.1, 0.33), Vector3(0, 1.87, 0), Color("33332b"))
			var limbs: Array[Node3D] = []
			for side in [-1, 1]:
				var leg := Node3D.new()
				leg.position = Vector3(side * 0.16, 0.62, 0)
				model.add_child(leg)
				box(leg, Vector3(0.14, 0.48, 0.14), Vector3(0, -0.22, 0), kit)
				box(leg, Vector3(0.16, 0.12, 0.27), Vector3(0, -0.53, 0.05), Color("fff0d6"))
				limbs.append(leg)
				var arm := Node3D.new()
				arm.position = Vector3(side * 0.36, 1.37, 0)
				model.add_child(arm)
				box(arm, Vector3(0.13, 0.42, 0.13), Vector3(0, -0.18, 0), Color("dbab83"))
				limbs.append(arm)
			var sign_x := 1.0 if team == 0 else -1.0
			var start: Vector3 = [Vector3(-18, 0, 0), Vector3(-5, 0, -2), Vector3(1, 0, 7)][role] * Vector3(sign_x, 1, 1)
			p.position = start
			players.append({"body": p, "model": model, "limbs": limbs, "team": team, "role": role, "base": start, "stamina": 100.0, "stunned": 0.0, "tackle_cd": 0.0, "kick_anim": 0.0, "heading": Vector3(sign_x, 0, 0), "target": start})

func build_ball() -> void:
	ball = RigidBody3D.new()
	ball.name = "Ball"
	ball.mass = 0.44
	ball.collision_layer = 4
	ball.collision_mask = 3
	ball.continuous_cd = true
	ball.linear_damp = 0.15
	ball.angular_damp = 0.35
	var physics := PhysicsMaterial.new()
	physics.bounce = 0.46
	physics.friction = 0.3
	ball.physics_material_override = physics
	var mesh := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.24
	sphere.height = 0.48
	mesh.mesh = sphere
	mesh.material_override = material(Color("fff9e3"), 0.65)
	ball.add_child(mesh)
	# Small dark panels rotate with the physical ball.
	for i in 6:
		var panel := MeshInstance3D.new()
		var patch := SphereMesh.new()
		patch.radius = 0.075
		patch.height = 0.15
		panel.mesh = patch
		panel.material_override = material(Color("263b35"))
		var positions := [Vector3.UP, Vector3.DOWN, Vector3.LEFT, Vector3.RIGHT, Vector3.FORWARD, Vector3.BACK]
		panel.position = positions[i] * 0.205
		ball.add_child(panel)
	var collider := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 0.24
	collider.shape = shape
	ball.add_child(collider)
	add_child(ball)

func browser_command(args: Array) -> void:
	if args.is_empty(): return
	var command = JSON.parse_string(str(args[0]))
	if not command is Dictionary: return
	apply_command(command)

func apply_command(command: Dictionary) -> void:
	var team := clampi(int(command.get("team", 0)), 0, 1)
	match command.get("type", ""):
		"config":
			mode = str(command.get("mode", "practice"))
			paused = false
			elapsed = 0.0
			difficulty = clampf(float(command.get("difficulty", 1)), 1, 3)
			remote_only = bool(command.get("remote", false))
			local_team = int(command.get("localTeam", 0))
			ball.freeze = remote_only
			message = "You are blue. Attack left." if local_team == 1 else "You are orange. Attack right. Hold Shoot to charge."
		"input":
			input_vectors[team] = Vector2(clampf(float(command.get("x", 0)), -1, 1), clampf(float(command.get("z", 0)), -1, 1)).limit_length()
			sprinting[team] = bool(command.get("sprint", false))
		"action": perform_action(str(command.get("action", "")), team)
		"pause":
			paused = bool(command.get("value", false))
			message = "Paused. Catch your breath." if paused else "Back in play."
			send_event({"type": "state", "state": state()})
		"camera": camera_mode = int(command.get("value", 0))
		"frame": adopt_frame(command.get("frame", {}))

func perform_action(action: String, team: int) -> void:
	if finished or paused or goal_pause > 0 or remote_only: return
	match action:
		"charge":
			if possessor == controlled[team]: charging[team] = true
		"shoot":
			if possessor == controlled[team]: shoot(controlled[team], maxf(0.18, charge[team]))
			charging[team] = false
			charge[team] = 0.0
		"pass": pass_ball(controlled[team], input_vectors[team])
		"switch":
			var best := -1
			var dist := INF
			for i in players.size():
				if players[i].team != team or players[i].role == 0 or i == controlled[team]: continue
				var d: float = players[i].body.position.distance_to(ball.position)
				if d < dist:
					best = i
					dist = d
			if best >= 0: controlled[team] = best
		"tackle": tackle(controlled[team])

func shoot(index: int, power: float) -> void:
	if possessor != index: return
	var p: Dictionary = players[index]
	var side := 1.0 if p.team == 0 else -1.0
	var aim: Vector2 = input_vectors[p.team] if index == controlled[p.team] else Vector2.ZERO
	var target := Vector3(side * 21.0, 0, clampf(p.body.position.z * 0.13 + aim.y * 3.0, -3.1, 3.1))
	var direction: Vector3 = (target - p.body.position).normalized()
	var speed := lerpf(15.0, 28.0, clampf(power, 0, 1))
	kick(index, direction * speed + Vector3.UP * lerpf(0.9, 4.6, power), "SHOT")
	message = "A charged strike!" if power > 0.65 else "Quick shot. Find the corner!"

func pass_ball(index: int, aim: Vector2 = Vector2.ZERO) -> void:
	if possessor != index: return
	var p: Dictionary = players[index]
	var best := -1
	var value := -INF
	var side := 1.0 if p.team == 0 else -1.0
	for i in players.size():
		if i == index or players[i].team != p.team or players[i].role == 0: continue
		var offset: Vector3 = players[i].body.position - p.body.position
		var desirability: float = -offset.length() * 0.2 + offset.x * side * 0.15
		if aim.length() > 0.2: desirability += Vector2(offset.x, offset.z).normalized().dot(aim.normalized()) * 8.0
		if desirability > value:
			best = i
			value = desirability
	if best < 0: return
	var target: Vector3 = players[best].body.position + players[best].body.velocity * 0.25
	var offset: Vector3 = target - p.body.position
	receiver = best
	kick(index, offset.normalized() * clampf(10.5 + offset.length() * 0.32, 11, 19) + Vector3.UP * 0.25, "PASS")
	controlled[p.team] = best
	message = "Pass into space. Meet the ball."

func kick(index: int, velocity: Vector3, kind: String) -> void:
	var p: Dictionary = players[index]
	last_owner = index
	possessor = -1
	cooldown = 0.28
	possession_age = 0
	p.kick_anim = 0.3
	# Place the ball outside the kicker's collider before applying real velocity.
	var direction := Vector3(velocity.x, 0, velocity.z).normalized()
	ball.position = p.body.position + direction * 0.9 + Vector3.UP * 0.28
	ball.linear_velocity = velocity
	ball.angular_velocity = Vector3(velocity.z, 0, -velocity.x) * 1.4
	send_event({"type": "sound", "kind": kind})

func tackle(index: int) -> void:
	var p: Dictionary = players[index]
	if p.tackle_cd > 0: return
	p.tackle_cd = 1.0
	p.kick_anim = 0.22
	if possessor >= 0 and players[possessor].team != p.team:
		var opponent: Dictionary = players[possessor]
		if p.body.position.distance_to(opponent.body.position) < 1.8:
			opponent.stunned = 0.5
			possessor = index
			cooldown = 0.25
			possession_age = 0
			controlled[p.team] = index
			message = "Clean tackle. Turn defence into attack."
			return
	p.stunned = 0.15

func _physics_process(dt: float) -> void:
	if remote_only: return
	if finished or paused:
		ball.freeze = true
		return
	ball.freeze = false
	for i in players.size():
		if i == possessor: ball.add_collision_exception_with(players[i].body)
		else: ball.remove_collision_exception_with(players[i].body)
	cooldown = maxf(0, cooldown - dt)
	if goal_pause > 0:
		ball.freeze = true
		goal_pause -= dt
		if goal_pause <= 0: reset_kickoff(1 if ball.position.x > 0 else 0)
		emit_state(dt)
		return
	if not OS.has_feature("web") and DisplayServer.get_name() != "headless":
		input_vectors[0] = Vector2(float(Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT)) - float(Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT)), float(Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN)) - float(Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP))).limit_length()
		sprinting[0] = Input.is_physical_key_pressed(KEY_SHIFT)
	elapsed += dt
	possession_age += dt
	for team in 2:
		if charging[team]: charge[team] = minf(1.0, charge[team] + dt / 1.1)
	var nearest := [-1, -1]
	var distances := [INF, INF]
	for i in players.size():
		if players[i].role == 0: continue
		var d: float = players[i].body.position.distance_to(ball.position)
		var team: int = players[i].team
		if d < distances[team]:
			nearest[team] = i
			distances[team] = d
	for i in players.size():
		var p: Dictionary = players[i]
		p.stunned = maxf(0, p.stunned - dt)
		p.tackle_cd = maxf(0, p.tackle_cd - dt)
		p.kick_anim = maxf(0, p.kick_anim - dt)
		var body: CharacterBody3D = p.body
		var human: bool = i == controlled[0] or (mode == "friend" and i == controlled[1])
		var movement := Vector2.ZERO
		var sprint := false
		if human:
			movement = input_vectors[p.team]
			sprint = sprinting[p.team] and p.stamina > 5
		else:
			movement = ai_movement(i, nearest[p.team])
			if possessor >= 0 and players[possessor].team != p.team and body.position.distance_to(players[possessor].body.position) < 1.6 and p.tackle_cd == 0:
				tackle(i)
		if p.stunned > 0: movement = Vector2.ZERO
		var speed := 8.5 if sprint else 5.8
		if not human and p.team == 1: speed += (difficulty - 1) * 0.28
		if possessor == i: speed *= 0.91
		p.stamina = clampf(p.stamina + (-20.0 if sprint and movement.length() > 0.1 else 12.0) * dt, 0, 100)
		var desired := Vector3(movement.x, 0, movement.y) * speed
		var acceleration := 22.0 if movement.length() > 0.1 else 30.0
		body.velocity.x = move_toward(body.velocity.x, desired.x, acceleration * dt)
		body.velocity.z = move_toward(body.velocity.z, desired.z, acceleration * dt)
		body.velocity.y = -1.0 if body.is_on_floor() else body.velocity.y - 9.8 * dt
		body.move_and_slide()
		body.position.x = clampf(body.position.x, -19.6, 19.6)
		body.position.z = clampf(body.position.z, -12.7, 12.7)
		if movement.length() > 0.12: p.heading = Vector3(movement.x, 0, movement.y).normalized()
	if possessor >= 0:
		var p: Dictionary = players[possessor]
		var target: Vector3 = p.body.position + p.heading * 0.85 + Vector3.UP * 0.27
		# Spring-like dribbling: the ball remains a colliding rigid body.
		ball.linear_velocity = (target - ball.position) * 13.0 + p.body.velocity * 0.7
		if p.body.position.distance_to(ball.position) > 2.2:
			possessor = -1
			cooldown = 0.15
	else:
		for i in players.size():
			var p: Dictionary = players[i]
			var height_ok: bool = ball.position.y < (1.6 if p.role == 0 else 0.75)
			if cooldown <= 0 and height_ok and p.body.position.distance_to(ball.position) < (1.25 if p.role == 0 else 1.05):
				possessor = i
				possession_age = 0
				cooldown = 0.22
				if p.role != 0: controlled[p.team] = i
				if p.role == 0: message = "Saved! The goalkeeper gathers the ball."
				break
	if absf(ball.position.x) > 20.45:
		var crossed: bool = absf(previous_ball.x) <= 20.45
		if crossed and absf(ball.position.z) < GOAL_HALF and ball.position.y < 2.42:
			register_goal(0 if ball.position.x > 0 else 1)
		elif absf(ball.position.x) > 22.5 or (ball.position.y < 0.4 and goal_pause <= 0):
			reset_ball(Vector3(signf(ball.position.x) * 18, 0.3, clampf(ball.position.z, -11, 11)))
	if ball.position.y < -2 or absf(ball.position.z) > 15: reset_ball(Vector3(0, 0.4, 0))
	if elapsed >= duration and not finished:
		if mode == "cup" and score[0] == score[1]:
			sudden_death = true
			duration += 30
			message = "SUDDEN DEATH. Next goal wins the round."
		else: end_match()
	previous_ball = ball.position
	emit_state(dt)

func ai_movement(index: int, closest: int) -> Vector2:
	var p: Dictionary = players[index]
	var body: CharacterBody3D = p.body
	var team: int = p.team
	var side := 1.0 if team == 0 else -1.0
	var target: Vector3 = p.base
	# A brief kickoff grace period gives the carrier time to choose the first pass.
	if elapsed < 1.8 and possessor >= 0 and players[possessor].team != team:
		var hold: Vector3 = target - body.position
		return Vector2(hold.x, hold.z).limit_length()
	if p.role == 0:
		var projected_z := ball.position.z
		if absf(ball.linear_velocity.x) > 3:
			var time_to_goal: float = (p.base.x - ball.position.x) / ball.linear_velocity.x
			if time_to_goal > 0 and time_to_goal < 1.5: projected_z += ball.linear_velocity.z * time_to_goal
		target = Vector3(p.base.x, 0, clampf(projected_z, -3, 3))
		if possessor == index and possession_age > 0.7: pass_ball(index)
	elif possessor == index:
		target = Vector3(side * 18, 0, body.position.z * 0.3)
		if absf(body.position.x - side * 20) < 14 and possession_age > 0.55:
			shoot(index, 0.4 + difficulty * 0.08)
		elif possession_age > 2.5: pass_ball(index)
	elif possessor >= 0 and players[possessor].team == team:
		# Give the ball carrier a forward passing lane; do not crowd them.
		var carrier: Vector3 = players[possessor].body.position
		target = Vector3(clampf(carrier.x + side * 6, -16, 16), 0, -6 if carrier.z > 0 else 6)
	elif index == closest:
		target = ball.position + ball.linear_velocity * 0.12
	else:
		target = Vector3(ball.position.x * 0.5 - side * 4, 0, ball.position.z * 0.45 + (4 if p.role == 2 else -4))
	p.target = target
	var direction: Vector3 = target - body.position
	return Vector2(direction.x, direction.z).limit_length()

func register_goal(team: int) -> void:
	if goal_pause > 0 or finished: return
	score[team] += 1
	possessor = -1
	goal_pause = 2.8
	message = "ORANGE SCORE! A brilliant finish." if team == 0 else "BLUE SCORE! Reset and respond."
	for p in players: p.body.velocity = Vector3.ZERO
	send_event({"type": "sound", "kind": "GOAL"})
	if sudden_death: end_match()

func end_match() -> void:
	if finished: return
	finished = true
	message = "Full time"
	ball.freeze = true
	send_event({"type": "finish", "score": score, "mode": mode})

func reset_ball(at: Vector3) -> void:
	ball.position = at
	previous_ball = at
	ball.linear_velocity = Vector3.ZERO
	ball.angular_velocity = Vector3.ZERO
	possessor = -1
	cooldown = 0.2

func reset_kickoff(team: int) -> void:
	for p in players:
		p.body.position = p.base
		p.body.velocity = Vector3.ZERO
		p.stunned = 0.0
	controlled = [1, 4]
	possessor = controlled[team]
	players[possessor].body.position = Vector3(-1 if team == 0 else 1, 0.01, 0)
	ball.freeze = true
	ball.position = players[possessor].body.position + Vector3(0.8 if team == 0 else -0.8, 0.28, 0)
	ball.linear_velocity = Vector3.ZERO
	ball.angular_velocity = Vector3.ZERO
	cooldown = 0.4
	possession_age = 0
	ball.freeze = remote_only
	previous_ball = ball.position
	charging = [false, false]
	charge = [0.0, 0.0]
	if elapsed > 0: message = "Back underway. Work the passing lanes."

func _process(dt: float) -> void:
	if players.is_empty(): return
	var t := Time.get_ticks_msec() / 1000.0
	for p in players:
		var body: CharacterBody3D = p.body
		var model: Node3D = p.model
		var speed := Vector2(body.velocity.x, body.velocity.z).length()
		var heading: Vector3 = p.heading
		model.rotation.y = lerp_angle(model.rotation.y, atan2(heading.x, heading.z), minf(1, dt * 12))
		model.rotation.z = lerpf(model.rotation.z, -body.velocity.x * 0.008, dt * 8)
		model.position.y = absf(sin(t * 11)) * minf(0.06, speed * 0.009)
		for i in p.limbs.size():
			var swing := sin(t * (10 + speed * 0.5) + (0 if i < 2 else PI)) * minf(0.65, speed * 0.085)
			p.limbs[i].rotation.x = swing if i % 2 == 0 else -swing
		if p.kick_anim > 0: p.limbs[0].rotation.x = -sin(p.kick_anim / 0.3 * PI) * 1.0
	var actor: Vector3 = players[controlled[local_team]].body.position
	ring.position = actor + Vector3.UP * 0.035
	direction_arrow.position = actor + players[controlled[local_team]].heading * 1.25 + Vector3.UP * 0.035
	direction_arrow.rotation.y = atan2(players[controlled[local_team]].heading.x, players[controlled[local_team]].heading.z)
	var aspect := get_viewport().get_visible_rect().size.x / maxf(1, get_viewport().get_visible_rect().size.y)
	var zoom := maxf(1, 1.35 / aspect)
	var follow: Vector3 = actor.lerp(ball.position, 0.35)
	follow.y = 0
	follow.x = clampf(follow.x, -11, 11)
	follow.z = clampf(follow.z, -5, 5)
	if camera_mode == 1: follow = Vector3.ZERO
	var target: Vector3 = follow + Vector3(0, (23 if camera_mode == 0 else 32) * zoom, (22 if camera_mode == 0 else 29) * zoom)
	if goal_pause > 0: target = Vector3(signf(ball.position.x) * 11, 14, 18)
	camera.position = camera.position.lerp(target, 1 - exp(-dt * 4))
	camera.look_at(follow)

func state() -> Dictionary:
	var actors: Array = []
	for p in players:
		var pos: Vector3 = p.body.position
		var velocity: Vector3 = p.body.velocity
		var heading: Vector3 = p.heading
		actors.append([pos.x, pos.y, pos.z, velocity.x, velocity.y, velocity.z, heading.x, heading.z, p.stamina, p.kick_anim])
	return {"score": score.duplicate(), "remaining": maxf(0, ceil(duration - elapsed)), "message": message, "goal": goal_pause > 0, "finished": finished, "paused": paused, "owner": possessor, "controlled": controlled.duplicate(), "elapsed": elapsed, "duration": duration, "charge": charge[local_team], "charges": charge.duplicate(), "stamina": players[controlled[local_team]].stamina, "players": actors, "ball": [ball.position.x, ball.position.y, ball.position.z], "goalPause": goal_pause}

func emit_state(dt: float) -> void:
	emit_clock += dt
	if emit_clock >= 0.07:
		emit_clock = 0
		send_event({"type": "state", "state": state()})

func adopt_frame(frame: Dictionary) -> void:
	if not remote_only or not frame.has("players"): return
	for i in mini(players.size(), frame.players.size()):
		var a: Array = frame.players[i]
		players[i].body.position = Vector3(a[0], a[1], a[2])
		players[i].body.velocity = Vector3(a[3], a[4], a[5])
		players[i].heading = Vector3(a[6], 0, a[7])
		players[i].stamina = a[8]
		players[i].kick_anim = a[9]
	ball.position = Vector3(frame.ball[0], frame.ball[1], frame.ball[2])
	controlled = frame.controlled
	score = frame.score
	possessor = int(frame.owner)
	elapsed = float(frame.elapsed)
	duration = float(frame.duration)
	goal_pause = float(frame.goalPause)
	message = frame.message

func send_event(event: Dictionary) -> void:
	if OS.has_feature("web"):
		event["source"] = "powerplay-godot"
		JavaScriptBridge.eval("window.parent.postMessage(%s, window.location.origin);" % JSON.stringify(event))

func _unhandled_input(event: InputEvent) -> void:
	if OS.has_feature("web") or not event is InputEventKey or event.echo: return
	if event.physical_keycode == KEY_SPACE:
		perform_action("charge" if event.pressed else "shoot", 0)
	elif event.pressed:
		match event.physical_keycode:
			KEY_J: perform_action("pass", 0)
			KEY_K: perform_action("switch", 0)
			KEY_L: perform_action("tackle", 0)
			KEY_ESCAPE: paused = not paused
