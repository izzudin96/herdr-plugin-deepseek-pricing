#!/usr/bin/env node

import { createAccountCache } from "../lib/account.js";

const args = new Set(process.argv.slice(2));

if (args.has("-h") || args.has("--help")) {
  process.stdout.write(
    [
      "Usage: account.js [--json] [--no-color]",
      "",
      "Shows DeepSeek account balance and today's DeepSeek token usage.",
      "Balance comes from https://api.deepseek.com/user/balance using the key in",
      "~/.local/share/opencode/auth.json. Usage comes from the local OpenCode database.",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

const color = !args.has("--no-color") && process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (text, code) => (color ? `\x1b[${code}m${text}\x1b[0m` : text);

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value, currency) {
  return `${currency} ${value}`;
}

try {
  const cache = createAccountCache();
  const snapshot = await cache.get();

  if (args.has("--json")) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    process.exit(0);
  }

  if (snapshot.balance) {
    for (const info of snapshot.balance.infos) {
      process.stdout.write(
        `${paint("balance  ", "2")}${formatMoney(info.total, info.currency)}` +
          `${paint(`  granted ${info.granted}  topped up ${info.toppedUp}`, "2")}\n`,
      );
    }
  }

  if (snapshot.usage) {
    const usage = snapshot.usage;
    const { tokens } = usage;
    process.stdout.write(
      `${paint("today    ", "2")}${usage.messages} requests, ` +
        `${formatNumber(tokens.total)} tokens, $${usage.cost.toFixed(4)}\n` +
        `${paint("  ", "2")}in ${formatNumber(tokens.input)} · ` +
        `cache read ${formatNumber(tokens.cacheRead)} · ` +
        `out ${formatNumber(tokens.output)} (reasoning ${formatNumber(tokens.reasoning)})\n`,
    );
  }

  if (snapshot.error) {
    process.stderr.write(`${paint("warning  ", "33")}${snapshot.error}\n`);
    process.exit(1);
  }
} catch (error) {
  process.stderr.write(`deepseek-account: ${error.message}\n`);
  process.exit(1);
}
