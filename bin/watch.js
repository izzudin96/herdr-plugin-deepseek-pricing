#!/usr/bin/env node

import { spawnSync } from "node:child_process";

import { parseArgs } from "../lib/args.js";
import { loadPricing } from "../lib/config.js";
import { createHolidayCalendar } from "../lib/calendar.js";
import { buildReport } from "../lib/report.js";
import { formatStatus } from "../lib/format.js";

const out = process.stdout;
const isTTY = Boolean(out.isTTY);

let cleanedUp = false;
let rawMode = false;
let timer;
let lastState = null;
let lastReportAt = 0;

function herdrBin() {
  return process.env.HERDR_BIN_PATH || "herdr";
}

function workspaceID() {
  if (process.env.HERDR_WORKSPACE_ID) return process.env.HERDR_WORKSPACE_ID;
  try {
    const context = JSON.parse(process.env.HERDR_PLUGIN_CONTEXT_JSON || "null");
    return (
      context?.workspace_id ??
      context?.workspace?.workspace_id ??
      context?.workspace?.id ??
      null
    );
  } catch {
    return null;
  }
}

function reportMetadata(state, force = false) {
  const now = Date.now();
  if (!force && state === lastState && now - lastReportAt < 30_000) return;
  lastState = state;
  lastReportAt = now;

  const workspace = workspaceID();
  if (!workspace) return;

  const label = state === "peak" ? "PEAK" : "OFF-PEAK";
  spawnSync(
    herdrBin(),
    [
      "workspace",
      "report-metadata",
      workspace,
      "--source",
      "plugin:deepseek.pricing",
      "--token",
      `deepseek=${label}`,
      "--ttl-ms",
      "90000",
    ],
    { stdio: "ignore", timeout: 1_000 },
  );
}

function clearMetadata() {
  const workspace = workspaceID();
  if (!workspace) return;
  spawnSync(
    herdrBin(),
    [
      "workspace",
      "report-metadata",
      workspace,
      "--source",
      "plugin:deepseek.pricing",
      "--clear-token",
      "deepseek",
    ],
    { stdio: "ignore", timeout: 1_000 },
  );
}

function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  clearInterval(timer);
  clearMetadata();
  if (rawMode) {
    try {
      process.stdin.setRawMode(false);
    } catch {}
    process.stdin.pause();
  }
  if (isTTY) out.write("\x1b[?25h\x1b[?1049l");
}

function fail(error) {
  cleanup();
  process.stderr.write(`deepseek-pricing: ${error.message}\n`);
  process.exit(1);
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("Usage: watch.js [--no-color] [--interval <ms>]\n");
    process.exit(0);
  }
  if (options.json) throw new Error("--json is not supported in watch mode");
  if (options.at) throw new Error("watch mode always uses the current time");

  const pricing = loadPricing(options.pricing ?? undefined);
  const calendar = createHolidayCalendar({ dir: options.holidays ?? undefined });
  const intervalMs = options.intervalMs ?? 1_000;

  function render() {
    const report = buildReport({
      now: new Date(),
      pricing,
      calendar,
    });
    const text = formatStatus(report, {
      color: options.color && isTTY && !process.env.NO_COLOR,
      width: out.columns || 80,
      footer: "q or Esc to close",
    });

    if (isTTY) out.write("\x1b[2J\x1b[H");
    out.write(`${text}\n`);
    reportMetadata(report.state);
  }

  function tick() {
    try {
      render();
    } catch (error) {
      fail(error);
    }
  }

  if (isTTY) out.write("\x1b[?1049h\x1b[?25l");
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (data) => {
      const key = data.toString("utf8");
      if (key === "q" || key === "Q" || key === "\u001b" || key === "\u0003") {
        cleanup();
        process.exit(0);
      }
    });
    rawMode = true;
  }

  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });
  process.on("exit", cleanup);

  tick();
  timer = setInterval(tick, intervalMs);
} catch (error) {
  fail(error);
}
