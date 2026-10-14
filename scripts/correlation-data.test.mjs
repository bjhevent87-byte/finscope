import test from "node:test";
import assert from "node:assert/strict";
import { isNumericObservation, monthlyLast, monthlyChanges, lastCompletedMonthEnd, hasConsecutiveMonthlyRows } from "../public/correlation-data.js";

test("missing source observations are not converted to zero", () => {
  assert.equal(isNumericObservation(null), false);
  assert.equal(isNumericObservation(""), false);
  assert.equal(isNumericObservation("  "), false);
  assert.equal(isNumericObservation([]), false);
  assert.equal(isNumericObservation(0), true);
  const levels = monthlyLast([
    { date: "2025-01-31", value: 100 },
    { date: "2025-02-28", value: null },
    { date: "2025-02-28", value: 0, status: "missing" },
    { date: "2025-03-31", value: 110 },
  ], "value");
  assert.deepEqual([...levels.keys()], ["202501", "202503"]);
  assert.equal(monthlyChanges(levels, "percent").size, 0);
});

test("a genuine zero remains valid for point changes", () => {
  const levels = monthlyLast([
    { date: "2025-01-31", value: 0 },
    { date: "2025-02-28", value: 1.5 },
  ], "value");
  assert.equal(monthlyChanges(levels, "point").get("202502"), 1.5);
  assert.equal(monthlyChanges(levels, "percent").size, 0);
});

test("monthly comparisons stop at the last completed Korean calendar month", () => {
  assert.equal(lastCompletedMonthEnd(new Date("2026-10-14T03:00:00Z")).toISOString().slice(0, 10), "2026-09-30");
  assert.equal(lastCompletedMonthEnd(new Date("2026-09-30T14:59:59Z")).toISOString().slice(0, 10), "2026-08-31");
  assert.equal(lastCompletedMonthEnd(new Date("2026-09-30T15:00:00Z")).toISOString().slice(0, 10), "2026-09-30");
});

test("a rolling 24-month estimate requires 24 consecutive months", () => {
  const months = Array.from({ length: 24 }, (_, index) => ({ month: `${2024 + Math.floor(index / 12)}${String(index % 12 + 1).padStart(2, "0")}` }));
  assert.equal(hasConsecutiveMonthlyRows(months), true);
  assert.equal(hasConsecutiveMonthlyRows(months.filter((row) => row.month !== "202410")), false);
});
