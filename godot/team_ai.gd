class_name TeamAI
extends RefCounted

# Tactical decisions stay separate from the physics/controller. Targets are world
# positions; the controller retains authority over acceleration, contact and kicks.
var _keeper_reactions: Dictionary = {}

func decide(players: Array[Dictionary], ball_position: Vector3, ball_velocity: Vector3, possessor: int, index: int, closest: int, possession_age: float, elapsed: float, difficulty: float) -> Dictionary:
	var player: Dictionary = players[index]
	var position: Vector3 = player.body.position
	var team: int = player.team
	var side := 1.0 if team == 0 else -1.0
	var result := {"target": player.base, "movement": Vector2.ZERO, "sprint": false, "action": "", "power": 0.48, "aim": Vector2.ZERO, "save_target": Vector3.ZERO, "save_reach": 0.0}
	if player.role == 0:
		return _keeper(players, ball_position, ball_velocity, possessor, index, possession_age, elapsed, difficulty, result)
	if elapsed < 1.8 and possessor >= 0 and players[possessor].team != team:
		return _finish(result, position)
	if possessor == index:
		_attack(players, index, possession_age, side, result)
	elif possessor >= 0 and players[possessor].team == team:
		_support(players, possessor, index, side, result)
	elif index == closest:
		_press(players, ball_position, ball_velocity, possessor, index, side, result)
	else:
		_cover(players, ball_position, possessor, index, side, result)
	return _finish(result, position)

func _attack(players: Array[Dictionary], index: int, age: float, side: float, result: Dictionary) -> void:
	var player: Dictionary = players[index]
	var position: Vector3 = player.body.position
	var teammate := _teammate(players, index)
	var pressure := _nearest_opponent_distance(players, player.team, position)
	var goal := Vector3(side * 20.3, 0, 0)
	var distance := position.distance_to(goal)
	var shooting_lane := _lane_clearance(players, player.team, position, goal, false)
	# Shoot only from a useful angle and with a clear line. A blocked carrier seeks
	# a passing lane or changes direction instead of firing straight into a defender.
	if age > 0.45 and distance < 12.0 and absf(position.z) < 8.3 and shooting_lane > 1.05:
		result.action = "shoot"
		result.power = clampf(0.3 + distance * 0.025, 0.36, 0.66)
		var keeper := _keeper_index(players, 1 - int(player.team))
		var keeper_z: float = players[keeper].body.position.z if keeper >= 0 else 0.0
		result.aim = Vector2(side, -0.85 if keeper_z >= 0 else 0.85)
	elif teammate >= 0 and age > 0.55:
		var mate_position: Vector3 = players[teammate].body.position
		var lane := _lane_clearance(players, player.team, position, mate_position, true)
		var mate_space := _nearest_opponent_distance(players, player.team, mate_position)
		var progress := (mate_position.x - position.x) * side
		var separation := position.distance_to(mate_position)
		if lane > 1.3 and separation > 3.2 and (pressure < 2.9 or (progress > 2.0 and mate_space > 2.2) or age > 3.8):
			result.action = "pass"
			result.aim = Vector2(mate_position.x - position.x, mate_position.z - position.z).normalized()
	# Score a few dribbling corridors. Goalward progress matters, but nearby
	# opponents make a lateral escape preferable to running directly through them.
	var best_target := Vector3(side * 17.3, 0, position.z * 0.35)
	var best_score := -INF
	for lateral in [-4.0, 0.0, 4.0]:
		var candidate := Vector3(clampf(position.x + side * 5.0, -17.3, 17.3), 0, clampf(position.z + lateral, -10.4, 10.4))
		var space := minf(7.0, _nearest_opponent_distance(players, player.team, candidate))
		var lane := minf(4.0, _lane_clearance(players, player.team, position, candidate, false))
		var value := space * 0.7 + lane * 1.3 - absf(candidate.z) * 0.09 - absf(lateral) * 0.1
		if value > best_score:
			best_score = value
			best_target = candidate
	result.target = best_target
	result.sprint = pressure > 3.0 and distance > 12.0 and float(player.stamina) > 30.0

func _support(players: Array[Dictionary], possessor: int, index: int, side: float, result: Dictionary) -> void:
	var player: Dictionary = players[index]
	var carrier: Vector3 = players[possessor].body.position
	var current: Vector3 = player.body.position
	var pressure := _nearest_opponent_distance(players, player.team, carrier)
	var requested_run := float(player.get("run_requested", 0.0)) > 0.0
	var best_score := -INF
	var best_target := current
	# Different forward depths allow a retreating outlet when a carrier is pressed.
	# Opponents near the pass segment matter as much as space at its endpoint.
	for advance in ([-2.5, 3.5, 7.0] if not requested_run else [7.0, 10.0]):
		for lane in [-8.0, -4.5, 0.0, 4.5, 8.0]:
			var candidate := Vector3(clampf(carrier.x + side * float(advance), -17.0, 17.0), 0, lane)
			var spacing := candidate.distance_to(carrier)
			if spacing < 4.5 or spacing > 15.0: continue
			var openness := minf(6.0, _lane_clearance(players, player.team, carrier, candidate, true))
			var space := minf(7.0, _nearest_opponent_distance(players, player.team, candidate))
			var forward_bias: float = float(advance) * (0.19 if pressure > 3.0 else 0.035)
			if requested_run: forward_bias = float(advance) * 0.6
			var value := openness * 1.5 + space * 0.6 + forward_bias - current.distance_to(candidate) * 0.14
			# Separate the carrier and receiver laterally instead of forming a queue.
			value += minf(6.0, absf(candidate.z - carrier.z)) * 0.12
			if value > best_score:
				best_score = value
				best_target = candidate
	result.target = best_target
	result.sprint = requested_run and current.distance_to(best_target) > 2.5 and float(player.stamina) > 15.0

func _press(players: Array[Dictionary], ball_position: Vector3, ball_velocity: Vector3, possessor: int, index: int, side: float, result: Dictionary) -> void:
	var player: Dictionary = players[index]
	var position: Vector3 = player.body.position
	if possessor < 0:
		var travel := clampf(position.distance_to(ball_position) / 9.0, 0.08, 0.55)
		result.target = ball_position + Vector3(ball_velocity.x, 0, ball_velocity.z) * travel
	else:
		var carrier: Dictionary = players[possessor]
		var carrier_position: Vector3 = carrier.body.position
		# Approach from the goal side: rushing at the carrier's back gives up a lane.
		var goal_side := Vector3(-side, 0, 0)
		result.target = carrier_position + goal_side * 1.0 + carrier.body.velocity * 0.1
		var distance := position.distance_to(ball_position)
		var exposed := Vector3(position.x - carrier_position.x, 0, position.z - carrier_position.z).normalized().dot(carrier.heading) > -0.35
		if distance < 1.35 and exposed and float(player.tackle_cd) <= 0.0:
			result.action = "tackle"
	result.sprint = position.distance_to(result.target) > 5.0 and float(player.stamina) > 25.0

func _cover(players: Array[Dictionary], ball_position: Vector3, possessor: int, index: int, side: float, result: Dictionary) -> void:
	var player: Dictionary = players[index]
	var own_goal := Vector3(-side * 18.2, 0, 0)
	var danger := ball_position
	# Track the unmarked receiver rather than making every defender chase the ball.
	if possessor >= 0:
		var opponent_mate := _teammate(players, possessor)
		if opponent_mate >= 0: danger = players[opponent_mate].body.position
	var goal_side := (own_goal - danger).normalized()
	var target := danger + goal_side * 2.1
	var pressure_line := ball_position.lerp(own_goal, 0.34)
	target = target.lerp(pressure_line, 0.2)
	target.x = clampf(target.x, -17.7, 17.7)
	target.z = clampf(target.z, -10.5, 10.5)
	result.target = target
	result.sprint = player.body.position.distance_to(target) > 5.0 and float(player.stamina) > 25.0

func _keeper(players: Array[Dictionary], ball_position: Vector3, ball_velocity: Vector3, possessor: int, index: int, age: float, elapsed: float, difficulty: float, result: Dictionary) -> Dictionary:
	var player: Dictionary = players[index]
	var position: Vector3 = player.body.position
	var side := 1.0 if player.team == 0 else -1.0
	var own_goal_x := -side * 20.3
	var distance_to_goal := absf(ball_position.x - own_goal_x)
	# Bisect the ball-to-post angle; come out a little against a close carrier.
	var home_x := own_goal_x + side * (2.0 + clampf((10.0 - distance_to_goal) * 0.15, 0, 1.0))
	var ratio := clampf(absf(home_x - own_goal_x) / maxf(2.0, distance_to_goal), 0, 0.8)
	result.target = Vector3(home_x, 0, clampf(ball_position.z * ratio, -2.9, 2.9))
	if possessor == index:
		_keeper_reactions.erase(index)
		if age > 0.7:
			result.action = "pass"
		return _finish(result, position)
	var incoming := possessor < 0 and ball_velocity.x * side < -3.0
	if incoming:
		var crossing_time := (home_x - ball_position.x) / ball_velocity.x
		if crossing_time > 0.0 and crossing_time < 1.7:
			if not _keeper_reactions.has(index): _keeper_reactions[index] = elapsed + clampf(0.2 - difficulty * 0.025, 0.1, 0.18)
			var predicted_z := ball_position.z + ball_velocity.z * crossing_time
			var predicted_y := maxf(0.24, ball_position.y + ball_velocity.y * crossing_time - 4.9 * crossing_time * crossing_time)
			if elapsed >= float(_keeper_reactions[index]):
				result.target = Vector3(home_x, 0, clampf(predicted_z, -3.25, 3.25))
				result.sprint = true
				# Match code applies the actual catch/parry only if ball contact is within
				# reach. A prediction is never permission to teleport or claim possession.
				if crossing_time < 0.5 and absf(predicted_z) < 3.8 and predicted_y > 0.05 and predicted_y < 2.8:
					result.action = "save"
					result.save_target = Vector3(home_x, maxf(0.25, predicted_y), predicted_z)
					result.save_reach = clampf(1.45 + difficulty * 0.08, 1.5, 1.7)
	else:
		_keeper_reactions.erase(index)
	return _finish(result, position)

func _finish(result: Dictionary, position: Vector3) -> Dictionary:
	var target: Vector3 = result.target
	target.x = clampf(target.x, -19.2, 19.2)
	target.z = clampf(target.z, -11.4, 11.4)
	result.target = target
	var delta := target - position
	# Settle inside a small dead zone instead of vibrating around a target.
	result.movement = Vector2.ZERO if delta.length() < 0.25 else Vector2(delta.x, delta.z).limit_length()
	return result

func _teammate(players: Array[Dictionary], index: int) -> int:
	for other in players.size():
		if other != index and players[other].team == players[index].team and players[other].role != 0: return other
	return -1

func _keeper_index(players: Array[Dictionary], team: int) -> int:
	for index in players.size():
		if players[index].team == team and players[index].role == 0: return index
	return -1

func _nearest_opponent_distance(players: Array[Dictionary], team: int, position: Vector3) -> float:
	var nearest := INF
	for opponent in players:
		if opponent.team != team: nearest = minf(nearest, position.distance_to(opponent.body.position))
	return nearest

func _lane_clearance(players: Array[Dictionary], team: int, start: Vector3, end: Vector3, include_keeper: bool) -> float:
	var nearest := INF
	var line := end - start
	var length_squared := line.length_squared()
	if length_squared < 0.01: return 0.0
	for opponent in players:
		if opponent.team == team or (opponent.role == 0 and not include_keeper): continue
		var position: Vector3 = opponent.body.position
		var along := clampf((position - start).dot(line) / length_squared, 0, 1)
		# A defender behind the passer should not block a forward pass.
		if along < 0.06: continue
		nearest = minf(nearest, position.distance_to(start + line * along))
	return nearest
