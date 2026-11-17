import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { utcDateKey } from "./peak.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BUNDLED_HOLIDAY_DIR = path.resolve(HERE, "..", "holidays");
export const HOLIDAY_SOURCE = "https://github.com/NateScarlet/holiday-cn";

export function defaultHolidayDir() {
  const configDir = process.env.HERDR_PLUGIN_CONFIG_DIR;
  if (configDir) {
    const candidate = path.join(configDir, "holidays");
    if (fs.existsSync(candidate)) return candidate;
  }
  return BUNDLED_HOLIDAY_DIR;
}

export function createHolidayCalendar({ dir = defaultHolidayDir() } = {}) {
  const cache = new Map();

  function load(year) {
    if (cache.has(year)) return cache.get(year);

    const candidates = [
      path.join(dir, `${year}.json`),
      path.join(BUNDLED_HOLIDAY_DIR, `${year}.json`),
    ];
    const file = candidates.find((candidate) => fs.existsSync(candidate));

    if (!file) {
      throw new Error(
        `missing Chinese holiday data for ${year}; expected holidays/${year}.json from ${HOLIDAY_SOURCE}`,
      );
    }

    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      throw new Error(`invalid holiday JSON in ${file}: ${error.message}`);
    }

    if (Number(data?.year) !== Number(year) || !Array.isArray(data.days)) {
      throw new Error(`invalid holiday data in ${file}`);
    }

    const offDays = new Set();
    for (const day of data.days) {
      if (typeof day?.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
        throw new Error(`invalid holiday date in ${file}`);
      }
      if (!day.date.startsWith(`${year}-`)) {
        throw new Error(`holiday date ${day.date} does not belong to ${year}`);
      }
      if (typeof day.isOffDay !== "boolean") {
        throw new Error(`invalid isOffDay for ${day.date} in ${file}`);
      }
      if (day.isOffDay) offDays.add(day.date);
    }

    const calendar = {
      year: Number(year),
      offDays,
      source: Array.isArray(data.papers) ? data.papers[0] : undefined,
      file,
    };
    cache.set(year, calendar);
    return calendar;
  }

  return {
    isOffDay(date) {
      const key = utcDateKey(date);
      return load(key.slice(0, 4)).offDays.has(key);
    },
    year(year) {
      return load(String(year));
    },
  };
}
