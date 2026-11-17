#!/usr/bin/env node

import { parseArgs } from "../lib/args.js";
import { loadPricing } from "../lib/config.js";
import { createHolidayCalendar } from "../lib/calendar.js";
import { buildReport } from "../lib/report.js";
import { formatStatus } from "../lib/format.js";

function printHelp() {
  process.stdout.write(
    [
      "Usage: status.js [options]",
      "",
      "Options:",
      "  --json             Print machine-readable JSON",
      "  --at <ISO>         Evaluate a specific time instead of now",
      "  --pricing <file>   Use a specific pricing.json",
      "  --holidays <dir>   Use a specific holidays directory",
      "  --no-color         Disable ANSI colors",
      "  -h, --help         Show this help",
      "",
    ].join("\n"),
  );
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const pricing = loadPricing(options.pricing ?? undefined);
  const calendar = createHolidayCalendar({ dir: options.holidays ?? undefined });
  const report = buildReport({
    now: options.at ?? new Date(),
    pricing,
    calendar,
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(
      `${formatStatus(report, {
        color: options.color && Boolean(process.stdout.isTTY),
        width: process.stdout.columns || 80,
      })}\n`,
    );
  }
} catch (error) {
  process.stderr.write(`deepseek-pricing: ${error.message}\n`);
  process.exit(1);
}
