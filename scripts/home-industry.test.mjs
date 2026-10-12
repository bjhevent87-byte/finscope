import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("업종 핵심지표 차트는 날짜·값 툴팁을 제공한다", async () => {
  const [html, script] = await Promise.all([
    readFile(path.join(ROOT, "public", "home.html"), "utf8"),
    readFile(path.join(ROOT, "public", "home.js"), "utf8"),
  ]);
  assert.match(html, /id="industry-detail-tooltip"/);
  assert.match(script, /industry-detail-chart"\)\.addEventListener\("pointermove"/);
  assert.match(script, /formatSeriesValue\(series, point\.value\)/);
});

test("업종 핵심지표는 의미·상승·하락·주의 설명을 제공한다", async () => {
  const [html, script] = await Promise.all([
    readFile(path.join(ROOT, "public", "home.html"), "utf8"),
    readFile(path.join(ROOT, "public", "home.js"), "utf8"),
  ]);
  for (const id of ["industry-guide-meaning", "industry-guide-up", "industry-guide-down", "industry-guide-caution"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(script, /100보다 높으면 업황이 좋다는 응답/);
  assert.match(script, /실제 매출이나 생산량이 아니라 설문 응답/);
});
