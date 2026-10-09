extends SceneTree
func _initialize() -> void:
	DirAccess.make_dir_recursive_absolute("res://../public/licenses")
	var file := FileAccess.open("res://../public/licenses/godot-and-third-party.txt", FileAccess.WRITE)
	file.store_string("Godot Engine 4.6.3 and included third-party notices\n\n")
	file.store_string(Engine.get_license_text())
	file.store_string("\n\nTHIRD-PARTY COPYRIGHTS\n" + JSON.stringify(Engine.get_copyright_info(), "  "))
	file.store_string("\n\nTHIRD-PARTY LICENSES\n" + JSON.stringify(Engine.get_license_info(), "  "))
	file.close()
	quit()
