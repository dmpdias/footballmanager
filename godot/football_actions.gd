extends RefCounted
## Football action calculations shared by human controls, AI and scenario tests.
## These helpers never move scene nodes or award possession themselves.

static func flat(value: Vector3) -> Vector3:
	return Vector3(value.x, 0, value.z)

static func attack_direction(player: Dictionary) -> float:
	return 1.0 if player.team == 0 else -1.0

static func lane_clearance(players: Array[Dictionary], team: int, start: Vector3, finish: Vector3) -> float:
	var segment := flat(finish - start)
	var length_squared := segment.length_squared()
	if length_squared < 0.01: return 0.0
	var closest := 8.0
	for opponent in players:
		if opponent.team == team: continue
		var offset := flat(opponent.body.position - start)
		var progress := offset.dot(segment) / length_squared
		# A defender behind the passer or beyond the recipient cannot block this lane.
		if progress < 0.08 or progress > 1.05: continue
		var distance := offset.distance_to(segment * clampf(progress, 0, 1))
		closest = minf(closest, distance)
	return closest

static func pass_plan(players: Array[Dictionary], index: int, aim: Vector2, through: bool = false) -> Dictionary:
	if index < 0 or index >= players.size(): return {}
	var passer: Dictionary = players[index]
	var origin: Vector3 = passer.body.position
	var side := attack_direction(passer)
	var selected := -1
	var best_score := -INF
	var selected_target := Vector3.ZERO
	for i in players.size():
		var teammate: Dictionary = players[i]
		if i == index or teammate.team != passer.team: continue
		# A backward directed pass can use the goalkeeper as a pressure outlet.
		if teammate.role == 0 and (aim.length() < 0.2 or aim.x * side > -0.25): continue
		var offset := flat(teammate.body.position - origin)
		var distance := offset.length()
		if distance < 1.2: continue
		var run := flat(teammate.body.velocity)
		var flight_time := clampf(distance / 16.0, 0.12, 1.2)
		var target: Vector3 = teammate.body.position + run * flight_time * 0.7
		if through:
			var run_direction := run.normalized() if run.length() > 1.0 else Vector3(side, 0, 0)
			# Through balls invite the recipient to run beyond their current position.
			target += run_direction * clampf(2.4 + distance * 0.13, 2.8, 5.8)
		target.x = clampf(target.x, -18.8, 18.8)
		target.z = clampf(target.z, -11.8, 11.8)
		var alignment := 0.0
		if aim.length() > 0.2:
			alignment = Vector2(offset.x, offset.z).normalized().dot(aim.normalized())
			# Direction is authoritative: never choose a player behind a directed pass.
			if alignment < 0.05: continue
		var clearance := lane_clearance(players, passer.team, origin, target)
		var value := alignment * 12.0 + offset.x * side * 0.08 - distance * 0.10
		value += clampf(clearance, 0, 3) * 0.85
		if teammate.role == 0: value -= 0.8
		if value > best_score:
			selected = i
			selected_target = target
			best_score = value
	if selected < 0: return {}
	var offset := flat(selected_target - origin)
	var speed := clampf(11.2 + offset.length() * (0.43 if through else 0.34), 12.0, 23.0 if through else 20.0)
	return {"receiver": selected, "target": selected_target, "velocity": offset.normalized() * speed + Vector3.UP * 0.18, "through": through}

static func shot_velocity(player: Dictionary, power: float, aim: Vector2, variant: String = "normal") -> Vector3:
	power = clampf(power, 0, 1)
	var side := attack_direction(player)
	var origin: Vector3 = player.body.position
	# The stick selects a goal-mouth lane. A reverse stick allows a deliberate
	# back-facing shot rather than silently turning the player toward goal.
	var corner := clampf(origin.z * 0.06 + aim.y * 3.05, -3.05, 3.05)
	if variant == "finesse" and absf(aim.y) < 0.15:
		corner = -2.65 if origin.z > 0 else 2.65
	var target := Vector3(side * 21.0, 0, corner)
	var direction := flat(target - origin).normalized()
	if aim.x * side < -0.55:
		direction = Vector3(aim.x, 0, aim.y).normalized()
	var speed := lerpf(17.5, 30.5, power)
	if variant == "finesse": speed = lerpf(16.0, 24.0, power)
	if variant == "chip":
		speed = lerpf(10.0, 16.0, power)
		return direction * speed + Vector3.UP * lerpf(6.4, 9.0, power)
	var distance := flat(target - origin).length()
	var travel_time := maxf(0.08, (distance - 0.9) / speed)
	# Solve the arc to arrive under the crossbar. Driven shots arrive low;
	# finesse has less pace but can reach a corner from outside the box.
	var goal_height := 0.7 if variant == "finesse" else 0.46
	var vertical_speed := clampf((goal_height - 0.28) / travel_time + 4.9 * travel_time, 0.65, 8.0)
	return direction * speed + Vector3.UP * vertical_speed

static func can_collect(player: Dictionary, ball_position: Vector3, incoming: Vector3) -> bool:
	var keeper: bool = player.role == 0
	if ball_position.y > (1.6 if keeper else 0.68): return false
	var reach := 1.25 if keeper else 1.04
	if flat(player.body.position - ball_position).length() > reach: return false
	var relative_speed := flat(incoming - player.body.velocity).length()
	# Fast shots require the goalkeeper reaction/save routine, not automatic
	# collection. Outfield players can cushion ordinary passes but not hard shots.
	return relative_speed < (11.5 if keeper else 14.0)

static func first_touch(player: Dictionary, incoming: Vector3) -> Vector3:
	var running := flat(player.body.velocity)
	var residual := flat(incoming - running) * 0.20
	return running + residual.limit_length(2.8) + Vector3.UP * clampf(incoming.y * 0.12, 0, 0.5)

static func dribble_step(player: Dictionary, ball_position: Vector3, ball_velocity: Vector3, dt: float, sprint: bool, shielding: bool = false) -> Dictionary:
	var clock := maxf(0, float(player.get("touch_timer", 0)) - dt)
	player.touch_timer = clock
	var running := flat(player.body.velocity)
	var speed := running.length()
	var heading: Vector3 = flat(player.heading).normalized()
	var lead := 0.65 if shielding else (1.2 if sprint and speed > 4 else 0.82)
	var target: Vector3 = player.body.position + heading * lead + Vector3.UP * 0.28
	var gap := flat(ball_position - player.body.position).length()
	if gap > (2.7 if sprint else 2.2): return {"lost": true, "touched": false, "velocity": ball_velocity}
	if clock > 0 or ball_position.y > 0.65:
		return {"lost": false, "touched": false, "velocity": ball_velocity}
	player.touch_timer = 0.17 if sprint and speed > 4 else 0.11
	var correction := flat(target - ball_position) * (7.0 if shielding else 8.0)
	var velocity := (running + correction).limit_length(14.0)
	# Apply discrete foot contacts, preserving the free rigid body's movement
	# between touches instead of overwriting its velocity every physics tick.
	velocity.y = clampf(ball_velocity.y, -0.3, 0.5)
	return {"lost": false, "touched": true, "velocity": velocity}

static func tackle_quality(attacker: Dictionary, defender: Dictionary, ball_position: Vector3) -> float:
	var reach := flat(ball_position - attacker.body.position)
	var distance := reach.length()
	if distance > 1.55: return 0.0
	var facing: Vector3 = flat(attacker.heading).normalized()
	var alignment := facing.dot(reach.normalized()) if distance > 0.1 else 1.0
	if alignment < -0.15: return 0.0
	var quality := clampf(1.15 - distance * 0.35 + alignment * 0.15, 0, 1)
	if bool(defender.get("shield", false)):
		var defender_to_attacker := flat(attacker.body.position - defender.body.position).normalized()
		if flat(defender.heading).normalized().dot(defender_to_attacker) < -0.2:
			quality *= 0.35
	return quality
