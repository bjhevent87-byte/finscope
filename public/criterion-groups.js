// One home for each comparison metric. Cash-flow indicators are not a substitute
// for a current ratio or a credit decision.
export const CRITERION_GROUPS = Object.freeze([
  { id: "growth", title: "성장성", note: "매출과 본업 이익이 같은 기간에 함께 늘었는지 확인합니다.", metrics: ["revenueGrowth", "operatingProfitGrowth", "revenue"] },
  { id: "profitability", title: "수익성", note: "매출에서 남기는 이익과 자기자본으로 낸 이익을 구분해 봅니다.", metrics: ["operatingMargin", "netMargin", "roe", "operatingProfit", "netIncome"] },
  { id: "stability", title: "재무 안정성", note: "부채 부담과 자본 규모를 점검합니다. 금융업은 일반 기업의 부채비율 기준을 그대로 적용하지 마세요.", metrics: ["debtRatio", "liabilities", "equity", "assets"] },
  { id: "cash", title: "현금흐름·자금 여력", note: "영업에서 벌어들인 현금과 투자 뒤 남는 현금을 봅니다. 단기 유동비율과는 다른 지표입니다.", metrics: ["operatingCashFlow", "capex", "fcf", "fcfMargin", "fcfYield"] },
  { id: "valuation", title: "시장 평가·규모", note: "가격 지표는 성장성·수익성과 함께 해석합니다. 종가와 시가총액은 실시간 값이 아닙니다.", metrics: ["per", "pbr", "price", "marketCap"] },
  { id: "returns", title: "주가 흐름", note: "과거 가격수익률은 재무 건전성이나 미래 성과를 보장하지 않습니다.", metrics: ["return1M", "return3M", "return6M", "return1Y"] },
  { id: "dividend", title: "배당", note: "배당 수준뿐 아니라 이익과 현금흐름이 배당을 뒷받침하는지 확인합니다.", metrics: ["dividendYield", "dividendPerShare"] },
  { id: "financial", title: "금융업 공시", note: "이자·수수료·보험수익은 회사별 공시 여부가 다릅니다. 같은 업종과 공시 기준을 먼저 확인하세요.", metrics: ["interestRevenue", "feeIncome", "insuranceRevenue"] },
]);
