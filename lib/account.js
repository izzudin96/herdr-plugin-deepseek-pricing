import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const DEFAULT_TTL_MS = 60_000;
const DEEPSEEK_BALANCE_URL = "https://api.deepseek.com/user/balance";

function opencodeDataDir() {
  return path.join(
    process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"),
    "opencode",
  );
}

export function defaultAuthPath() {
  return path.join(opencodeDataDir(), "auth.json");
}

export function defaultDbPath() {
  return path.join(opencodeDataDir(), "opencode.db");
}

export function readApiKey(file = defaultAuthPath()) {
  if (!fs.existsSync(file)) {
    throw new Error(`missing OpenCode auth file: ${file}`);
  }
  const auth = JSON.parse(fs.readFileSync(file, "utf8"));
  const key = auth?.deepseek?.key;
  if (typeof key !== "string" || key.trim() === "") {
    throw new Error(`no DeepSeek API key in ${file}; run opencode auth login deepseek`);
  }
  return key;
}

export function parseBalance(payload) {
  if (!Array.isArray(payload?.balance_infos) || payload.balance_infos.length === 0) {
    throw new Error("DeepSeek balance response has no balance_infos");
  }
  const infos = payload.balance_infos.map((info) => {
    if (typeof info?.currency !== "string" || typeof info.total_balance !== "string") {
      throw new Error("DeepSeek balance entry is missing currency or total_balance");
    }
    return {
      currency: info.currency,
      total: info.total_balance,
      granted: info.granted_balance,
      toppedUp: info.topped_up_balance,
    };
  });
  return { available: payload.is_available === true, infos };
}

export async function fetchBalance({ apiKey, fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error("apiKey is required");
  }
  const response = await fetchImpl(DEEPSEEK_BALANCE_URL, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`DeepSeek balance request failed: HTTP ${response.status}`);
  }
  return parseBalance(await response.json());
}

function localDayStartMs(now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

export function readTodayUsage({ dbPath = defaultDbPath(), now = new Date() } = {}) {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`missing OpenCode database: ${dbPath}`);
  }
  const since = localDayStartMs(now);

  const sql = `
    select
      coalesce(sum(json_extract(data, '$.tokens.input')), 0) as input,
      coalesce(sum(json_extract(data, '$.tokens.output')), 0) as output,
      coalesce(sum(json_extract(data, '$.tokens.reasoning')), 0) as reasoning,
      coalesce(sum(json_extract(data, '$.tokens.cache.read')), 0) as cacheRead,
      coalesce(sum(json_extract(data, '$.tokens.cache.write')), 0) as cacheWrite,
      coalesce(sum(json_extract(data, '$.tokens.total')), 0) as total,
      coalesce(sum(json_extract(data, '$.cost')), 0) as cost,
      count(*) as messages
    from message
    where json_extract(data, '$.role') = 'assistant'
      and json_extract(data, '$.providerID') = 'deepseek'
      and time_created >= ${since};
  `;

  const out = execFileSync("sqlite3", ["-readonly", "-json", dbPath, sql], {
    encoding: "utf8",
  }).trim();
  const [row] = out === "" ? [] : JSON.parse(out);
  if (row === undefined) {
    throw new Error(`sqlite3 returned no row for ${dbPath}`);
  }

  return {
    since: new Date(since).toISOString(),
    messages: Number(row.messages),
    cost: Number(row.cost),
    tokens: {
      input: Number(row.input),
      output: Number(row.output),
      reasoning: Number(row.reasoning),
      cacheRead: Number(row.cacheRead),
      cacheWrite: Number(row.cacheWrite),
      total: Number(row.total),
    },
  };
}

export function createAccountCache({
  balance = () => fetchBalance({ apiKey: readApiKey() }),
  usage = () => readTodayUsage(),
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  if (!Number.isInteger(ttlMs) || ttlMs < 0) {
    throw new Error("ttlMs must be a non-negative integer");
  }
  let cached = null;
  let expiresAt = 0;
  let pending = null;

  function snapshot() {
    return {
      balance: cached?.balance ?? null,
      usage: cached?.usage ?? null,
      error: cached?.error ?? null,
    };
  }

  function refresh() {
    if (pending) return pending;
    pending = (async () => {
      let balanceValue = cached?.balance ?? null;
      let usageValue = cached?.usage ?? null;
      const errors = [];

      const [balanceResult, usageResult] = await Promise.allSettled([balance(), usage()]);
      if (balanceResult.status === "fulfilled") balanceValue = balanceResult.value;
      else errors.push(balanceResult.reason);

      if (usageResult.status === "fulfilled") usageValue = usageResult.value;
      else errors.push(usageResult.reason);

      cached = {
        balance: balanceValue,
        usage: usageValue,
        error: errors.length > 0 ? errors.map((e) => e.message).join("; ") : null,
      };
      expiresAt = Date.now() + ttlMs;
      return;
    })();
    const current = pending;
    pending.finally(() => {
      if (pending === current) pending = null;
    });
    return current;
  }

  return {
    async get() {
      if (cached === null) {
        await refresh();
        return snapshot();
      }
      if (Date.now() >= expiresAt) {
        await refresh();
      }
      return snapshot();
    },
    refresh,
  };
}
