export const PRICE_KEYS = Object.freeze([
  "inputCacheHit",
  "inputCacheMiss",
  "output",
]);

export const PRICE_LABELS = Object.freeze({
  inputCacheHit: "1M input tokens (cache hit)",
  inputCacheMiss: "1M input tokens (cache miss)",
  output: "1M output tokens",
});

const DECIMAL_PATTERN = /^(0|[1-9]\d*)(\.\d{1,6})?$/;

export function toMicros(value, label = "price") {
  if (typeof value !== "string" || !DECIMAL_PATTERN.test(value)) {
    throw new Error(`${label} must be a decimal string with at most 6 fractional digits`);
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 1_000_000n + BigInt((fraction + "000000").slice(0, 6));
}

export function validatePricing(pricing) {
  if (!pricing || typeof pricing !== "object" || Array.isArray(pricing)) {
    throw new Error("pricing must be an object");
  }

  for (const field of ["model", "modelVersion", "currency", "unit"]) {
    if (typeof pricing[field] !== "string" || pricing[field].trim() === "") {
      throw new Error(`pricing.${field} must be a non-empty string`);
    }
  }

  for (const state of ["peak", "offPeak"]) {
    const table = pricing[state];
    if (!table || typeof table !== "object" || Array.isArray(table)) {
      throw new Error(`pricing.${state} must be an object`);
    }
    for (const key of PRICE_KEYS) {
      toMicros(table[key], `pricing.${state}.${key}`);
    }
  }

  for (const key of PRICE_KEYS) {
    const peak = toMicros(pricing.peak[key], `pricing.peak.${key}`);
    const offPeak = toMicros(pricing.offPeak[key], `pricing.offPeak.${key}`);
    if (offPeak * 2n !== peak) {
      throw new Error(
        `pricing.offPeak.${key} must be exactly half of pricing.peak.${key}`,
      );
    }
  }

  return pricing;
}

export function pricesForState(pricing, state) {
  if (state === "peak") return pricing.peak;
  if (state === "off-peak") return pricing.offPeak;
  throw new Error(`unknown pricing state: ${state}`);
}
