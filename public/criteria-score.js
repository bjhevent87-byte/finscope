// The comparison score and the pass-only filter must read the same criteria.
// Every applicable criterion has equal weight; missing values are not guessed.
export function assessCriteria(company, criteria, getValue, isApplicable = () => true) {
  const checks = criteria.map((criterion) => {
    const applicable = Boolean(isApplicable(company, criterion));
    const value = applicable ? getValue(company, criterion.metric) : null;
    const target = Number(criterion.value);
    const available = applicable && Number.isFinite(value) && Number.isFinite(target);
    const passed = available && ({
      ">=": value >= target,
      "<=": value <= target,
      ">": value > target,
      "<": value < target,
      "=": value === target,
    })[criterion.operator] === true;
    return { criterion, value, target, applicable, available, passed };
  });
  const applicable = checks.filter((check) => check.applicable).length;
  const available = checks.filter((check) => check.available).length;
  const passed = checks.filter((check) => check.passed).length;
  const missing = applicable - available;
  const notApplicable = checks.length - applicable;
  return {
    checks, applicable, available, passed, missing, notApplicable,
    score: applicable && missing === 0 && notApplicable === 0 ? Math.round(passed / applicable * 100) : null,
    passes: criteria.length === 0 || (applicable === criteria.length && passed === applicable && missing === 0),
  };
}

export function rankByCriteria(companies, assessments) {
  return [...companies].sort((a, b) => {
    const left = assessments[a.corpCode];
    const right = assessments[b.corpCode];
    const leftScore = Number.isFinite(left?.score) ? left.score : -1;
    const rightScore = Number.isFinite(right?.score) ? right.score : -1;
    return rightScore - leftScore || (right?.available || 0) - (left?.available || 0);
  });
}
