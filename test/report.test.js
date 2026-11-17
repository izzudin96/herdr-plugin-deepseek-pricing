import assert from "node:assert/strict";
import test from "node:test";

import { createHolidayCalendar } from "../lib/calendar.js";
import { loadPricing } from "../lib/config.js";
import { buildReport } from "../lib/report.js";
import { formatCountdown, formatStatus } from "../lib/format.js";

const pricing = loadPricing();
const calendar = createHolidayCalendar();

test("builds a peak report", () => {
  const report = buildReport({
    now: new Date("2026-11-17T02:00:00Z"),
    pricing,
    calendar,
  });

  assert.equal(report.state, "peak");
  assert.equal(report.reason, "window");
  assert.equal(report.window.label, "01:00-04:00 UTC");
  assert.equal(report.nextState, "off-peak");
  assert.equal(report.nextAtUtc, "2026-11-17T04:00:00.000Z");
  assert.equal(report.nextInSeconds, 7200);
  assert.equal(report.currentPrices.inputCacheMiss, "0.3");
});

test("builds a holiday report", () => {
  const report = buildReport({
    now: new Date("2026-02-17T02:00:00Z"),
    pricing,
    calendar,
  });

  assert.equal(report.state, "off-peak");
  assert.equal(report.reason, "holiday");
  assert.equal(report.holiday, "2026-02-17");
  assert.equal(report.currentPrices.inputCacheMiss, "0.15");
});

test("formats countdowns", () => {
  assert.equal(formatCountdown(30), "30s");
  assert.equal(formatCountdown(90), "1m 30s");
  assert.equal(formatCountdown(7200), "2h");
  assert.equal(formatCountdown(90000), "1d 1h");
});

test("formats human output", () => {
  const report = buildReport({
    now: new Date("2026-11-17T02:00:00Z"),
    pricing,
    calendar,
  });

  const text = formatStatus(report, { color: false, width: 80 });
  assert.match(text, /PEAK/);
  assert.match(text, /\$0\.006/);
  assert.match(text, /\$0\.003/);
  assert.match(text, /OFF-PEAK at 2026-11-17 04:00:00 UTC/);
});

test("formats compact output for narrow terminals", () => {
  const report = buildReport({
    now: new Date("2026-11-17T10:30:00Z"),
    pricing,
    calendar,
  });

  const text = formatStatus(report, { color: false, width: 40 });
  assert.match(text, /OFF-PEAK/);
  assert.match(text, /in-hit \/ in-miss \/ out/);
});
