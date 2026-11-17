export const PEAK_WINDOWS = Object.freeze([
  Object.freeze({ startHour: 1, endHour: 4, label: "01:00-04:00 UTC" }),
  Object.freeze({ startHour: 6, endHour: 10, label: "06:00-10:00 UTC" }),
]);

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export function utcDateKey(date) {
  return date.toISOString().slice(0, 10);
}

export function classify(now, isHoliday) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("invalid date");
  }
  if (typeof isHoliday !== "function") {
    throw new Error("isHoliday must be a function");
  }

  const date = utcDateKey(now);
  if (isHoliday(now)) {
    return { state: "off-peak", reason: "holiday", date };
  }

  const day = now.getUTCDay();
  if (day === 0 || day === 6) {
    return { state: "off-peak", reason: "weekend", date };
  }

  const hour = now.getUTCHours();
  for (const window of PEAK_WINDOWS) {
    if (hour >= window.startHour && hour < window.endHour) {
      return {
        state: "peak",
        reason: "window",
        date,
        window: {
          startHour: window.startHour,
          endHour: window.endHour,
          label: window.label,
        },
      };
    }
  }

  return { state: "off-peak", reason: "outside-window", date };
}

export function nextTransition(now, isHoliday, { maxDays = 14 } = {}) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("invalid date");
  }
  if (!Number.isInteger(maxDays) || maxDays < 1) {
    throw new Error("maxDays must be a positive integer");
  }

  const current = classify(now, isHoliday).state;
  let at = Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS + MINUTE_MS;
  const limit = now.getTime() + maxDays * DAY_MS;

  for (; at <= limit; at += MINUTE_MS) {
    const date = new Date(at);
    const status = classify(date, isHoliday);
    if (status.state !== current) {
      return { at: date, state: status.state, reason: status.reason };
    }
  }

  throw new Error(`no peak/off-peak transition within ${maxDays} days`);
}
