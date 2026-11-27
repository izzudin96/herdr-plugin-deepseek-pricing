import assert from "node:assert/strict";
import test from "node:test";

import { createAccountCache, parseBalance } from "../lib/account.js";

const balance = {
  is_available: true,
  balance_infos: [{ currency: "CNY", total_balance: "5.03", granted_balance: "0.00", topped_up_balance: "5.03" }],
};
const parsedBalance = {
  available: true,
  infos: [{ currency: "CNY", total: "5.03", granted: "0.00", toppedUp: "5.03" }],
};
const usage = {
  since: "2026-11-26T16:00:00.000Z",
  messages: 3,
  cost: 0.02,
  tokens: { input: 10, output: 20, reasoning: 1, cacheRead: 30, cacheWrite: 0, total: 61 },
};

test("parseBalance keeps every currency and rejects empty payloads", () => {
  assert.deepEqual(parseBalance(balance), parsedBalance);
  assert.throws(() => parseBalance({ is_available: true, balance_infos: [] }), /balance_infos/);
  assert.throws(() => parseBalance(undefined), /balance_infos/);
});

test("createAccountCache fetches once inside the ttl", async () => {
  let balanceCalls = 0;
  let usageCalls = 0;
  const cache = createAccountCache({
    balance: async () => {
      balanceCalls += 1;
      return parsedBalance;
    },
    usage: async () => {
      usageCalls += 1;
      return usage;
    },
    ttlMs: 60_000,
  });

  await cache.get();
  const second = await cache.get();
  assert.equal(balanceCalls, 1);
  assert.equal(usageCalls, 1);
  assert.deepEqual(second.balance, parsedBalance);
  assert.deepEqual(second.usage, usage);
});

test("createAccountCache keeps the last good value when a fetch fails", async () => {
  let fail = false;
  const cache = createAccountCache({
    balance: async () => {
      if (fail) throw new Error("network down");
      return parsedBalance;
    },
    usage: async () => {
      if (fail) throw new Error("network down");
      return usage;
    },
    ttlMs: 0,
  });

  await cache.get();
  fail = true;
  const stale = await cache.get();
  assert.deepEqual(stale.balance, parsedBalance);
  assert.deepEqual(stale.usage, usage);
  assert.match(stale.error, /network down/);
});

test("createAccountCache reports an error when nothing has loaded", async () => {
  const cache = createAccountCache({
    balance: async () => {
      throw new Error("no key");
    },
    usage: async () => {
      throw new Error("no db");
    },
  });
  const snapshot = await cache.get();
  assert.equal(snapshot.balance, null);
  assert.equal(snapshot.usage, null);
  assert.match(snapshot.error, /no key/);
});
