import test from "node:test";
import assert from "node:assert/strict";
import { hankyungReportSearchUrl, stockDisplayName } from "../public/stock-identity.js";

test("KRX stock label is distinct from the DART legal name", () => {
  assert.equal(stockDisplayName({ stockCode: "005380", name: "현대자동차" }), "현대차");
  assert.equal(stockDisplayName({ stockCode: "005930", name: "삼성전자" }), "삼성전자");
});

test("Hankyung link pre-fills official stock name and a one-year date range", () => {
  const url = new URL(hankyungReportSearchUrl({ stockCode: "005380", name: "현대자동차" }, new Date("2026-10-13T05:00:00Z")));
  assert.equal(url.origin, "https://consensus.hankyung.com");
  assert.equal(url.pathname, "/analysis/list");
  assert.equal(url.searchParams.get("skinType"), "business");
  assert.equal(url.searchParams.get("search_text"), "현대차");
  assert.equal(url.searchParams.get("sdate"), "2025-10-13");
  assert.equal(url.searchParams.get("edate"), "2026-10-13");
});
