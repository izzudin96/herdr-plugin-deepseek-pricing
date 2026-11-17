import { classify, nextTransition } from "./peak.js";
import { pricesForState } from "./prices.js";

function formatLocal(date) {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

export function buildReport({ now, pricing, calendar }) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("invalid date");
  }

  const isHoliday = (date) => calendar.isOffDay(date);
  const status = classify(now, isHoliday);
  const next = nextTransition(now, isHoliday);

  return {
    model: pricing.model,
    modelVersion: pricing.modelVersion,
    currency: pricing.currency,
    unit: pricing.unit,
    nowUtc: now.toISOString(),
    nowLocal: formatLocal(now),
    state: status.state,
    reason: status.reason,
    window: status.window ?? null,
    holiday: status.reason === "holiday" ? status.date : null,
    nextState: next.state,
    nextReason: next.reason,
    nextAtUtc: next.at.toISOString(),
    nextInSeconds: Math.max(
      0,
      Math.ceil((next.at.getTime() - now.getTime()) / 1000),
    ),
    prices: {
      peak: pricing.peak,
      offPeak: pricing.offPeak,
    },
    currentPrices: pricesForState(pricing, status.state),
  };
}
