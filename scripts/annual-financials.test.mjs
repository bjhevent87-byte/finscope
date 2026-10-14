import test from "node:test";
import assert from "node:assert/strict";
import { loadFinancialPeriods } from "../server.mjs";

function account(id, name, section, amounts) {
  return {
    account_id: id,
    account_nm: name,
    sj_div: section,
    fs_div: "CFS",
    thstrm_amount: String(amounts[0] ?? ""),
    frmtrm_amount: String(amounts[1] ?? ""),
    bfefrmtrm_amount: String(amounts[2] ?? ""),
  };
}

function annualRows(current, prior, priorPrior) {
  const scaled = (value, factor) => Number.isFinite(value) ? value * factor : null;
  return [
    account("ifrs-full_Revenue", "매출액", "IS", [current, prior, priorPrior]),
    account("dart_OperatingIncomeLoss", "영업이익", "IS", [scaled(current, 0.1), scaled(prior, 0.1), scaled(priorPrior, 0.1)]),
    account("ifrs-full_ProfitLoss", "당기순이익", "IS", [scaled(current, 0.05), scaled(prior, 0.05), scaled(priorPrior, 0.05)]),
    account("ifrs-full_Assets", "자산총계", "BS", [scaled(current, 2), scaled(prior, 2), scaled(priorPrior, 2)]),
    account("ifrs-full_Equity", "자본총계", "BS", [current, prior, priorPrior]),
  ];
}

test("2023 annual comparisons restore 2021 and 2022 when their direct API years are unavailable", async () => {
  const calls = [];
  const reports = new Map([
    [2025, annualRows(500, 400, 300)],
    [2023, annualRows(300, 200, 100)],
  ]);
  const { financials, warnings } = await loadFinancialPeriods("01596425", [2021, 2022, 2023, 2024, 2025], "11011", async (_, year) => {
    calls.push(year);
    if (!reports.has(year)) throw Object.assign(new Error(`DART ${year}: 조회된 데이타가 없습니다.`), { code: "013" });
    return reports.get(year);
  });
  assert.deepEqual(calls.sort(), [2023, 2025]);
  assert.deepEqual(financials.map((period) => [period.year, period.revenue]), [[2021, 100], [2022, 200], [2023, 300], [2024, 400], [2025, 500]]);
  assert.match(financials[0].dataSource, /2023년 사업보고서 비교표\(전전기\)/);
  assert.match(financials[1].dataSource, /2023년 사업보고서 비교표\(전기\)/);
  assert.deepEqual(warnings, []);
});

test("missing comparative fields trigger only the missing year's direct report", async () => {
  const calls = [];
  const reports = new Map([
    [2025, annualRows(500, null, 300)],
    [2024, annualRows(400, 300, 200)],
    [2023, annualRows(300, 200, 100)],
  ]);
  const { financials } = await loadFinancialPeriods("00688996", [2021, 2022, 2023, 2024, 2025], "11011", async (_, year) => {
    calls.push(year);
    return reports.get(year);
  });
  assert.deepEqual(calls.sort(), [2023, 2024, 2025]);
  assert.deepEqual(financials.map((period) => period.year), [2021, 2022, 2023, 2024, 2025]);
  assert.match(financials.find((period) => period.year === 2024).dataSource, /2024년 사업보고서 직접 조회/);
});

test("a blank matching account falls through to another row with a real comparative amount", async () => {
  const rows = annualRows(300, 200, 100);
  rows.unshift(account("ifrs-full_Revenue", "매출액", "IS", [null, null, null]));
  const { financials } = await loadFinancialPeriods("00688996", [2021, 2022, 2023], "11011", async (_, year) => {
    if (year === 2023) return rows;
    throw Object.assign(new Error("No data"), { code: "013" });
  });
  assert.deepEqual(financials.map((period) => period.revenue), [100, 200, 300]);
});

test("unavailable source years are not represented as invented zero-valued periods", async () => {
  const { financials, warnings } = await loadFinancialPeriods("01596425", [2021, 2022, 2023, 2024, 2025], "11011", async (_, year) => {
    if (year === 2025) return annualRows(500, 400, 300);
    throw Object.assign(new Error(`DART ${year}: 조회된 데이타가 없습니다.`), { code: "013" });
  });
  assert.deepEqual(financials.map((period) => period.year), [2023, 2024, 2025]);
  assert.equal(warnings.length, 2);
});

test("a DART rate-limit error does not trigger extra requests for every missing year", async () => {
  const calls = [];
  const { financials, warnings } = await loadFinancialPeriods("00688996", [2021, 2022, 2023, 2024, 2025], "11011", async (_, year) => {
    calls.push(year);
    throw Object.assign(new Error("DART 요청 제한"), { code: "020" });
  });
  assert.deepEqual(calls.sort(), [2023, 2025]);
  assert.deepEqual(financials, []);
  assert.equal(warnings.length, 2);
});
