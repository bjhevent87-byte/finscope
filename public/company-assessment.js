const finite = Number.isFinite;

function median(values) {
  const sorted = values.filter(finite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function grade(checks, minimum, required = []) {
  const available = checks.filter((check) => check.available);
  const missingRequired = required.some((key) => !checks.find((check) => check.key === key)?.available);
  if (available.length < minimum || missingRequired) {
    return { score: null, grade: "자료 부족", checks, available: available.length, total: checks.length };
  }
  const possible = available.reduce((sum, check) => sum + check.weight, 0);
  const earned = available.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0);
  const score = Math.round(earned / possible * 100);
  return { score, grade: score >= 75 ? "A" : score >= 50 ? "B" : "C", checks, available: available.length, total: checks.length };
}

function check(key, label, value, threshold, passed, weight = 1) {
  return { key, label, value, threshold, available: finite(value), passed: finite(value) && Boolean(passed), weight };
}

export function assessCompany(company, benchmark = null, reportCode = "11011") {
  const financials = company.financials || [];
  const latest = company.latest || financials.at(-1) || {};
  const prior = financials.at(-2) || {};
  const older = financials.at(-3) || {};
  const sameBasis = (a, b) => a.statementBasis && a.statementBasis === b.statementBasis;
  const financial = Boolean(company.isFinancial);
  const trend = (key) => sameBasis(latest, older) && finite(latest[key]) && finite(older[key]) && older[key] > 0
    ? (latest[key] / older[key] - 1) * 100 : null;
  const qualityChecks = financial ? [
    check("roe", "ROE", latest.roe, "8% 이상", latest.roe >= 8, 30),
    check("netIncome", "순이익", latest.netIncome, "흑자", latest.netIncome > 0, 25),
    check("netIncomeTrend", "3개 보고기간 순이익", trend("netIncome"), "증가", trend("netIncome") > 0, 25),
    check("equity", "자기자본", latest.equity, "0 초과", latest.equity > 0, 20),
  ] : [
    check("operatingMargin", "영업이익률", latest.operatingMargin, "10% 이상", latest.operatingMargin >= 10, 20),
    check("roe", "ROE", latest.roe, "10% 이상", latest.roe >= 10, 15),
    check("operatingProfitTrend", "3개 보고기간 영업이익", trend("operatingProfit"), "증가", trend("operatingProfit") > 0, 15),
    check("fcf", "잉여현금흐름", latest.fcf, "0 초과", latest.fcf > 0, 20),
    check("debtRatio", "부채비율", latest.debtRatio, "100% 이하", latest.debtRatio <= 100, 15),
    check("interestCoverage", "이자보상배율", latest.interestCoverage, "3배 이상", latest.interestCoverage >= 3, 15),
  ];
  const quality = grade(qualityChecks, financial ? 3 : 4, financial ? ["roe", "netIncome"] : ["fcf", "debtRatio"]);

  const distributions = benchmark?.metricDistributions || {};
  const peerMedian = (key) => {
    const values = (distributions[key] || []).filter((value) => finite(value) && value > 0);
    return values.length >= 3 ? median(values) : null;
  };
  const evaluation = company.evaluation || {};
  const perMedian = peerMedian("per"), pbrMedian = peerMedian("pbr"), fcfMedian = peerMedian("fcfYield");
  const priceChecks = [
    check("per", "PER / 같은 업종 중위", finite(evaluation.per) && evaluation.per > 0 && finite(perMedian) ? evaluation.per : null,
      perMedian, evaluation.per <= perMedian),
    check("pbr", "PBR / 업종 중위 (ROE도 중위 이상)", finite(evaluation.pbr) && evaluation.pbr > 0 && finite(pbrMedian) && finite(latest.roe) && finite(benchmark?.roe) ? evaluation.pbr : null,
      pbrMedian, evaluation.pbr <= pbrMedian && latest.roe >= benchmark.roe),
    ...(!financial ? [check("fcfYield", "FCF 수익률 / 같은 업종 중위",
      finite(evaluation.fcfYield) && finite(fcfMedian) ? evaluation.fcfYield : null,
      fcfMedian, evaluation.fcfYield >= fcfMedian)] : []),
  ];
  const price = reportCode === "11011" ? grade(priceChecks, 2)
    : { score: null, grade: "비교 보류", checks: priceChecks, available: 0, total: priceChecks.length };
  return {
    quality, price,
    qualityNote: financial
      ? "금융업 예비 재무점수입니다. BIS·CET1·NIM·CSM 등 업종 전용 지표와 사업 경쟁력은 포함되지 않습니다."
      : "공시 재무지표만으로 만든 예비 점수입니다. 사업 경쟁력·ROIC·산업 전망은 포함되지 않습니다.",
    priceNote: reportCode === "11011"
      ? "최근 시가총액과 연간 실적을 같은 업종 주요 기업의 중위값과 비교한 신호입니다. 성장 전망과 적정가치를 뜻하지 않습니다."
      : "분기·반기 누적 이익을 연간 PER처럼 비교하지 않기 위해 가격 평가는 보류합니다.",
  };
}

export function rankByQuality(companies, assessments) {
  return [...companies].sort((a, b) => {
    const left = assessments[a.corpCode]?.quality?.score;
    const right = assessments[b.corpCode]?.quality?.score;
    return (finite(right) ? right : -1) - (finite(left) ? left : -1);
  });
}

export function assessmentThreshold(check) {
  if (!finite(check.threshold)) return String(check.threshold ?? "확인 필요");
  if (check.key === "fcfYield") return `같은 업종 중위 ${check.threshold.toFixed(1)}% 이상`;
  return `같은 업종 중위 ${check.threshold.toFixed(1)}배 이하`;
}
