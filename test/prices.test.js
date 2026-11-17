import assert from "node:assert/strict";
import test from "node:test";

import { loadPricing } from "../lib/config.js";
import { PRICE_KEYS, toMicros, validatePricing } from "../lib/prices.js";

test("bundled pricing matches the official Flash table", () => {
  const pricing = loadPricing();

  assert.equal(pricing.model, "deepseek-flash");
  assert.equal(pricing.modelVersion, "DeepSeek-V4.1-Flash-1017");
  assert.equal(pricing.peak.inputCacheHit, "0.006");
  assert.equal(pricing.peak.inputCacheMiss, "0.3");
  assert.equal(pricing.peak.output, "1.2");
  assert.equal(pricing.offPeak.inputCacheHit, "0.003");
  assert.equal(pricing.offPeak.inputCacheMiss, "0.15");
  assert.equal(pricing.offPeak.output, "0.6");
});

test("off-peak is exactly half of peak", () => {
  const pricing = loadPricing();

  for (const key of PRICE_KEYS) {
    assert.equal(
      toMicros(pricing.offPeak[key], key) * 2n,
      toMicros(pricing.peak[key], key),
      key,
    );
  }
});

test("invalid off-peak price fails loudly", () => {
  const pricing = structuredClone(loadPricing());
  pricing.offPeak.output = "0.7";

  assert.throws(
    () => validatePricing(pricing),
    /pricing\.offPeak\.output must be exactly half of pricing\.peak\.output/,
  );
});

test("non-decimal prices fail loudly", () => {
  const pricing = structuredClone(loadPricing());
  pricing.peak.output = 1.2;

  assert.throws(() => validatePricing(pricing), /pricing\.peak\.output must be a decimal string/);
});
