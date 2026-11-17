import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validatePricing } from "./prices.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BUNDLED_PRICING_PATH = path.resolve(HERE, "..", "pricing.json");

export function defaultPricingPath() {
  const configDir = process.env.HERDR_PLUGIN_CONFIG_DIR;
  if (configDir) {
    const candidate = path.join(configDir, "pricing.json");
    if (fs.existsSync(candidate)) return candidate;
  }
  return BUNDLED_PRICING_PATH;
}

export function loadPricing(file = defaultPricingPath()) {
  if (!fs.existsSync(file)) {
    throw new Error(`missing pricing file: ${file}`);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`invalid pricing JSON in ${file}: ${error.message}`);
  }

  return validatePricing(data);
}
