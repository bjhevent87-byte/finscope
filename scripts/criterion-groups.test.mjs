import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CRITERION_GROUPS } from "../public/criterion-groups.js";

test("every company comparison metric has exactly one purpose group", () => {
  const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const block = source.match(/const metrics = \{([\s\S]*?)\n\};/)?.[1];
  assert.ok(block, "metrics catalog exists");
  const metricKeys = [...block.matchAll(/^  ([A-Za-z][A-Za-z0-9]*): \{/gm)].map((match) => match[1]).sort();
  const groupedKeys = CRITERION_GROUPS.flatMap((group) => group.metrics).sort();
  assert.equal(new Set(groupedKeys).size, groupedKeys.length, "group membership is unique");
  assert.deepEqual(groupedKeys, metricKeys);
  assert.ok(CRITERION_GROUPS.find((group) => group.id === "cash")?.note.includes("유동비율"));
});
