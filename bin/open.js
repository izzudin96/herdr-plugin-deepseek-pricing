#!/usr/bin/env node

import { spawnSync } from "node:child_process";

if (process.env.HERDR_ENV !== "1") {
  process.stderr.write("deepseek-pricing: run this from inside a Herdr pane\n");
  process.exit(1);
}

const bin = process.env.HERDR_BIN_PATH || "herdr";
const args = [
  "plugin",
  "pane",
  "open",
  "--plugin",
  "deepseek.pricing",
  "--entrypoint",
  "watch",
  "--placement",
  "overlay",
  "--focus",
];

const result = spawnSync(bin, args, { stdio: "inherit" });
if (result.error) {
  process.stderr.write(`deepseek-pricing: ${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
