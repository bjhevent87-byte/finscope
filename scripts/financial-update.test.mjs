import test from "node:test";
import assert from "node:assert/strict";
import { filingSource, latestFiledInterim } from "../financial-update.mjs";

test("latest interim skips an unfiled quarter and compares the same prior-year report", async () => {
  const calls = [];
  const report = await latestFiledInterim(2025, 2026, async (year, code) => {
    calls.push(`${year}:${code}`);
    if (year === 2026 && code === "11014") throw Object.assign(new Error("No report"), { code: "013" });
    return [{ year, code, rcept_no: "20260814000001" }];
  });
  assert.equal(report.year, 2026);
  assert.equal(report.reportCode, "11012");
  assert.deepEqual(calls, ["2026:11014", "2026:11012", "2025:11012"]);
  assert.equal(report.priorRows[0].year, 2025);
});

test("latest interim does not silently hide API failures", async () => {
  await assert.rejects(
    latestFiledInterim(2025, 2026, async () => { throw Object.assign(new Error("Unauthorized"), { code: "901" }); }),
    /Unauthorized/,
  );
});

test("missing prior-year interim is shown without inventing a growth rate", async () => {
  const report = await latestFiledInterim(2025, 2026, async (year, code) => {
    if (code === "11014" || year === 2025) throw Object.assign(new Error("No report"), { code: "013" });
    return [{ year, code }];
  });
  assert.equal(report.reportCode, "11012");
  assert.equal(report.priorRows, null);
});

test("filing links accept only DART receipt numbers", () => {
  assert.equal(filingSource([{ rcept_no: "20260814000001" }]).url,
    "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814000001");
  assert.equal(filingSource([{ rcept_no: "javascript:alert(1)" }]), null);
});
