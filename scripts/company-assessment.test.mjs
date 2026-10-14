import test from "node:test";
import assert from "node:assert/strict";
import { assessCompany, rankByQuality } from "../public/company-assessment.js";

const base = { statementBasis: "CFS" };
const company = {
  corpCode: "00000001", isFinancial: false,
  financials: [
    { ...base, year: 2023, operatingProfit: 80 },
    { ...base, year: 2024, operatingProfit: 90 },
    { ...base, year: 2025, operatingProfit: 120, operatingMargin: 12, roe: 15,
      fcf: 30, debtRatio: 70, interestCoverage: 5 },
  ],
  evaluation: { per: 12, pbr: 1.2, fcfYield: 6 },
};
company.latest = company.financials.at(-1);
const peers = {
  roe: 12, metricDistributions: {
    per: [10, 13, 15], pbr: [1, 1.4, 1.8], fcfYield: [4, 5, 6],
  },
};

test("quality and price have separate transparent scores", () => {
  const result = assessCompany(company, peers, "11011");
  assert.equal(result.quality.score, 100);
  assert.equal(result.quality.grade, "A");
  assert.equal(result.price.score, 100);
  assert.equal(result.price.grade, "A");
  assert.equal(result.quality.checks.length, 6);
  assert.equal(result.price.checks.length, 3);
});

test("missing critical financial data withholds the quality score", () => {
  const partial = { ...company, latest: { ...company.latest, fcf: null, debtRatio: null } };
  assert.equal(assessCompany(partial, peers).quality.score, null);
});

test("interim earnings are not treated as annual valuation denominators", () => {
  assert.equal(assessCompany(company, peers, "11012").price.score, null);
});

test("financial companies use a different checklist and no general-company cash rule", () => {
  const bank = {
    ...company, isFinancial: true,
    financials: [
      { ...base, year: 2023, netIncome: 60 },
      { ...base, year: 2024, netIncome: 80 },
      { ...base, year: 2025, netIncome: 100, roe: 11, equity: 900 },
    ],
  };
  bank.latest = bank.financials.at(-1);
  const result = assessCompany(bank, peers);
  assert.equal(result.quality.score, 100);
  assert.equal(result.quality.checks.length, 4);
  assert.equal(result.price.checks.length, 2);
  assert.match(result.qualityNote, /BIS/);
});

test("missing same-industry peers withholds the price score", () => {
  assert.equal(assessCompany(company).price.score, null);
});

test("quality ordering is stable and does not turn unknown scores into recommendations", () => {
  const rows = [{ corpCode: "a" }, { corpCode: "b" }, { corpCode: "c" }];
  assert.deepEqual(rankByQuality(rows, {
    a: { quality: { score: 50 } }, b: { quality: { score: 90 } }, c: { quality: { score: null } },
  }).map((row) => row.corpCode), ["b", "a", "c"]);
  assert.deepEqual(rows.map((row) => row.corpCode), ["a", "b", "c"]);
});
