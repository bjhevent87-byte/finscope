import test from "node:test";
import assert from "node:assert/strict";
import { assessCriteria, rankByCriteria } from "../public/criteria-score.js";

const value = (company, metric) => company[metric] ?? null;
const applicable = (company, criterion) => !(company.isFinancial && criterion.metric === "debtRatio");

test("score uses only the investor's selected conditions", () => {
  const company = { corpCode: "a", roe: 13, debtRatio: 120, per: 8 };
  const chosen = [{ metric: "roe", operator: ">=", value: 10 }, { metric: "debtRatio", operator: "<=", value: 100 }];
  const result = assessCriteria(company, chosen, value, applicable);
  assert.equal(result.score, 50);
  assert.equal(result.passed, 1);
  assert.equal(result.applicable, 2);
  assert.equal(result.passes, false);
  assert.equal(assessCriteria(company, [{ metric: "per", operator: "<=", value: 10 }], value, applicable).score, 100);
});

test("missing data is visible and never counts as a passed condition", () => {
  const result = assessCriteria({ corpCode: "a", roe: 13 }, [
    { metric: "roe", operator: ">=", value: 10 },
    { metric: "per", operator: "<=", value: 10 },
  ], value, applicable);
  assert.deepEqual([result.passed, result.available, result.missing, result.score, result.passes], [1, 1, 1, null, false]);
});

test("inapplicable industry conditions are excluded, not silently passed", () => {
  const bank = { corpCode: "bank", isFinancial: true, roe: 12, debtRatio: 500 };
  const onlyDebt = [{ metric: "debtRatio", operator: "<=", value: 100 }];
  const result = assessCriteria(bank, onlyDebt, value, applicable);
  assert.deepEqual([result.applicable, result.notApplicable, result.score, result.passes], [0, 1, null, false]);
  const mixed = assessCriteria(bank, [{ metric: "roe", operator: ">=", value: 10 }, ...onlyDebt], value, applicable);
  assert.deepEqual([mixed.passed, mixed.applicable, mixed.notApplicable, mixed.score, mixed.passes], [1, 1, 1, null, false]);
  assert.equal(assessCriteria(bank, [], value, applicable).passes, true);
});

test("ranking follows selected-condition scores and preserves equal-score order", () => {
  const companies = [{ corpCode: "a" }, { corpCode: "b" }, { corpCode: "c" }];
  const ranked = rankByCriteria(companies, {
    a: { score: 50, available: 2 },
    b: { score: 100, available: 2 },
    c: { score: 50, available: 1 },
  });
  assert.deepEqual(ranked.map((company) => company.corpCode), ["b", "a", "c"]);
  assert.deepEqual(companies.map((company) => company.corpCode), ["a", "b", "c"]);
});
