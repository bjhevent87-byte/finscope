import assert from "node:assert/strict";
import test from "node:test";
import { financialAxisRange } from "../public/chart-scale.js";

test("change zoom keeps a 75% operating margin visible alongside lower values", () => {
  const values = [8, 10, 11, 12, 14, 18, 75];
  const axis = financialAxisRange(values);
  assert.ok(axis.min < Math.min(...values));
  assert.ok(axis.max > 75);
  assert.ok((axis.max - 75) / (axis.max - axis.min) < .15);
});

test("full financial axis includes zero and all values", () => {
  const axis = financialAxisRange([8, 13, 75], { includeZero: true });
  assert.ok(axis.min < 0);
  assert.ok(axis.max > 75);
});

test("flat and empty financial series are handled safely", () => {
  assert.deepEqual(financialAxisRange([null, NaN]), null);
  const axis = financialAxisRange([75, 75]);
  assert.ok(axis.min < 75 && axis.max > 75);
});
