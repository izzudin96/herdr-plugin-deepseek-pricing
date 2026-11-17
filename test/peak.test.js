import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createHolidayCalendar } from "../lib/calendar.js";
import { classify, nextTransition, utcDateKey } from "../lib/peak.js";

const at = (iso) => new Date(iso);
const noHoliday = () => false;

test("peak windows on a normal weekday", () => {
  const cases = [
    ["2026-11-17T00:59:00Z", "off-peak"],
    ["2026-11-17T01:00:00Z", "peak"],
    ["2026-11-17T03:59:59Z", "peak"],
    ["2026-11-17T04:00:00Z", "off-peak"],
    ["2026-11-17T05:59:59Z", "off-peak"],
    ["2026-11-17T06:00:00Z", "peak"],
    ["2026-11-17T09:59:59Z", "peak"],
    ["2026-11-17T10:00:00Z", "off-peak"],
  ];

  for (const [iso, expected] of cases) {
    assert.equal(classify(at(iso), noHoliday).state, expected, iso);
  }
});

test("weekends are off-peak", () => {
  assert.equal(classify(at("2026-11-21T02:00:00Z"), noHoliday).state, "off-peak");
  assert.equal(classify(at("2026-11-22T02:00:00Z"), noHoliday).state, "off-peak");
});

test("Chinese public holidays are off-peak", () => {
  const calendar = createHolidayCalendar();
  const status = classify(
    at("2026-02-17T02:00:00Z"),
    (date) => calendar.isOffDay(date),
  );

  assert.equal(status.state, "off-peak");
  assert.equal(status.reason, "holiday");
  assert.equal(calendar.isOffDay(at("2026-02-17T00:00:00Z")), true);
  assert.equal(calendar.isOffDay(at("2026-02-24T00:00:00Z")), false);
});

test("next transition finds the next state change", () => {
  assert.equal(
    nextTransition(at("2026-11-17T00:00:00Z"), noHoliday).at.toISOString(),
    "2026-11-17T01:00:00.000Z",
  );
  assert.equal(
    nextTransition(at("2026-11-17T03:59:00Z"), noHoliday).at.toISOString(),
    "2026-11-17T04:00:00.000Z",
  );
  assert.equal(
    nextTransition(at("2026-11-17T09:59:00Z"), noHoliday).at.toISOString(),
    "2026-11-17T10:00:00.000Z",
  );
  assert.equal(
    nextTransition(at("2026-11-20T10:00:00Z"), noHoliday).at.toISOString(),
    "2026-11-23T01:00:00.000Z",
  );
});

test("holiday transition skips the full holiday period", () => {
  const calendar = createHolidayCalendar();
  const next = nextTransition(
    at("2026-02-17T02:00:00Z"),
    (date) => calendar.isOffDay(date),
  );

  assert.equal(next.state, "peak");
  assert.equal(next.at.toISOString(), "2026-02-24T01:00:00.000Z");
});

test("missing holiday year fails loudly", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deepseek-holidays-"));
  const calendar = createHolidayCalendar({ dir });

  try {
    assert.throws(
      () => calendar.isOffDay(at("2035-06-01T00:00:00Z")),
      /missing Chinese holiday data for 2035/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("utcDateKey uses the UTC date", () => {
  assert.equal(utcDateKey(at("2026-11-17T23:59:59Z")), "2026-11-17");
  assert.equal(utcDateKey(at("2026-11-18T00:00:00Z")), "2026-11-18");
});
