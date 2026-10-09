import { existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
if (!existsSync(new URL("../public/engine/index.wasm", import.meta.url))) {
  mkdirSync(new URL("../public", import.meta.url), { recursive: true });
  try {
    if (process.platform === "win32")
      execFileSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          "Expand-Archive -Force powerplay-deploy.zip .engine-restore; New-Item -ItemType Directory -Force public | Out-Null; Move-Item -Force .engine-restore/engine public/; Remove-Item -Recurse -Force .engine-restore",
        ],
        { cwd: root, stdio: "inherit" },
      );
    else
      execFileSync(
        "unzip",
        ["-o", "powerplay-deploy.zip", "engine/*", "-d", "public"],
        { cwd: root, stdio: "inherit" },
      );
  } catch {
    throw new Error(
      "Unable to restore the Godot engine. Extract engine/ from powerplay-deploy.zip into public/, or export godot/project.godot with Godot 4.6.3.",
    );
  }
}
