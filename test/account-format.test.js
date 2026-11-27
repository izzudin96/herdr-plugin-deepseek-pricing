import assert from "node:assert/strict";
import test from "node:test";

import { formatAccount } from "../lib/account-format.js";

const balance = {
  available: true,
  infos: [
    { currency: "CNY", total: "3.74", granted: "0.00", toppedUp: "3.74" },
    { currency: "USD", total: "-0.00", granted: "0.00", toppedUp: "-0.00" },
  ],
};
const usage = {
  since: "2026-11-26T16:00:00.000Z",
  messages: 2,
  cost: 0.0123,
  tokens: { input: 1000, output: 2000, reasoning: 300, cacheRead: 50000, cacheWrite: 0, total: 53300 },
};

test("formatAccount prefers the CNY balance and prints usage", () => {
  const text = formatAccount({ balance, usage, error: null });
  assert.match(text, /Balance: CNY 3\.74/);
  assert.match(text, /Today:   53,300 tokens, \$0\.0123 across 2 requests/);
  assert.match(text, /cache read 50,000/);
});

test("formatAccount says unavailable instead of inventing values", () => {
  const text = formatAccount({ balance: null, usage: null, error: "network down" });
  assert.match(text, /Balance: unavailable/);
  assert.match(text, /Today:   unavailable/);
  assert.match(text, /network down/);
});

test("formatAccount renders nothing before the first snapshot", () => {
  assert.equal(formatAccount(null), "");
});
