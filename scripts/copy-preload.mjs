import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

mkdirSync(path.join("dist", "tray"), { recursive: true });
copyFileSync(
  path.join("src", "tray", "preload.cjs"),
  path.join("dist", "tray", "preload.cjs"),
);
