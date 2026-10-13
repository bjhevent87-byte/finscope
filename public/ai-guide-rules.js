// FinScope AI Guide v1: financial facts are never generated here or by the model.
export const GUIDE_ROUTES = Object.freeze({
  home: { label: "경제·업종 지표 보기", href: "/home.html#macro", detail: "발표 기준일과 출처를 확인하며 경제·업종 지표를 살펴보세요." },
  compare: { label: "기업 비교하기", href: "/index.html", detail: "시장·업종을 고르고 재무 지표를 같은 기준으로 비교해 보세요." },
  company: { label: "기업 분석하기", href: "/company.html", detail: "선택한 기업의 공시 재무, 주가, 외부요인을 차례로 확인해 보세요." },
  correlation: { label: "두 지표의 관계 보기", href: "/correlation.html", detail: "환율·금리·주가의 동반 움직임을 살펴보세요. 상관관계는 인과관계가 아닙니다." },
  backtest: { label: "지난 성과 비교하기", href: "/backtest.html", detail: "과거 수익률과 기간별 변동을 확인해 보세요. 미래 성과를 보장하지 않습니다." },
  etf: { label: "ETF 비교하기", href: "/etf.html", detail: "ETF의 종가, NAV, 괴리율을 같은 날짜 기준으로 비교해 보세요." },
  filings: { label: "DART 공시 확인하기", href: "/filings.html", detail: "공시 원문과 공시일을 직접 확인해 보세요." },
  research: { label: "증권사 리포트 보기", href: "/research.html", detail: "외부 리포트의 발행일과 작성 기관을 확인해 보세요." },
});

const TERMS = [
  { pattern: /\bROE\b|자기자본이익률/i, term: "ROE", description: "자기자본으로 얼마의 순이익을 냈는지 보는 비율입니다. 업종과 기간을 맞춰 비교하세요.", route: "compare" },
  { pattern: /\bFCF\b|잉여현금흐름/i, term: "FCF", description: "영업에서 들어온 현금에서 설비투자 등에 쓴 현금을 뺀 값입니다. 일시적인 투자 때문에 음수가 될 수도 있어요.", route: "company" },
  { pattern: /\bBSI\b|업황\s*지수|기업경기실사지수/i, term: "업황 BSI", description: "기업이 체감한 업황을 조사한 지표입니다. 기준점과 조사 시점, 업종을 함께 보세요.", route: "home" },
  { pattern: /부채비율/i, term: "부채비율", description: "자기자본에 비해 부채가 어느 정도인지 나타냅니다. 금융업과 비금융업은 같은 잣대로 비교하기 어렵습니다.", route: "compare" },
  { pattern: /이자보상배율/i, term: "이자보상배율", description: "영업이익으로 이자비용을 몇 배 감당할 수 있는지 보여 줍니다. 일회성 손익과 회계 기준도 확인하세요.", route: "company" },
  { pattern: /괴리율/i, term: "ETF 괴리율", description: "ETF 시장가격과 순자산가치(NAV)의 차이를 비율로 나타냅니다. 같은 시점의 값을 비교해야 합니다.", route: "etf" },
  { pattern: /상관계수|상관관계/i, term: "상관계수", description: "두 값이 같은 방향 또는 반대 방향으로 움직이는 정도입니다. 함께 움직였다는 사실만으로 원인을 알 수는 없어요.", route: "correlation" },
];

export function routeAnswer(route, source = "guide") {
  const target = GUIDE_ROUTES[route] || GUIDE_ROUTES.home;
  return { kind: "route", source, title: target.label, text: target.detail, links: [{ label: target.label, href: target.href }] };
}

export function guideAnswer(question, context = {}) {
  const text = String(question || "").trim().replace(/\s+/g, " ");
  if (!text) return { kind: "empty", title: "질문을 입력해 주세요", text: "예: ROE가 뭐야? / 안전한 기업을 어떻게 찾아?", links: [] };
  if (/(?:매수|매도|사도\s*돼|팔아야|목표\s*주가|종목\s*추천|수익\s*보장|얼마나\s*오를|내년\s*주가)/i.test(text)) {
    return { kind: "restricted", title: "투자 결정을 대신할 수는 없어요", text: "매수·매도나 목표주가는 제시하지 않습니다. 공시 재무와 과거 가격을 직접 비교해 판단 근거를 확인해 보세요.", links: [{ label: "기업 분석하기", href: GUIDE_ROUTES.company.href }, { label: "공시 원문 보기", href: GUIDE_ROUTES.filings.href }] };
  }
  if (/(?:비밀번호|주민등록|계좌번호|전화번호|이메일)/i.test(text) || /\b\d{3}[- ]?\d{4}[- ]?\d{4}\b/.test(text) || /\S+@\S+\.\S+/.test(text)) {
    return { kind: "restricted", title: "개인정보는 입력하지 마세요", text: "이 안내 기능에는 계좌번호, 연락처 등 개인정보가 필요하지 않습니다.", links: [] };
  }
  if (/(?:안전한|튼튼한|안정적인|위험\s*적은)\s*(?:회사|기업|종목)?/i.test(text)) {
    return { kind: "clarify", title: "어떤 의미의 ‘안전’인가요?", text: "재무적으로 버티는 힘과 주가가 덜 흔들리는 정도는 다른 기준입니다. 먼저 보고 싶은 기준을 골라 주세요.", links: [{ label: "부채·현금흐름 비교", href: GUIDE_ROUTES.compare.href }, { label: "주가 변동 살펴보기", href: GUIDE_ROUTES.backtest.href }] };
  }
  if (/(?:돈\s*잘\s*버는|좋은|유망한)\s*(?:반도체|기업|회사|종목)?/i.test(text)) {
    return { kind: "clarify", title: "‘좋은 기업’의 기준을 먼저 정해 볼까요?", text: "이익률, 자기자본이익률, 현금흐름은 서로 다른 강점입니다. 업종을 고르고 기준을 정해 비교해 보세요.", links: [{ label: "조건으로 기업 비교", href: GUIDE_ROUTES.compare.href }, { label: "한 기업 깊이 보기", href: GUIDE_ROUTES.company.href }] };
  }
  const term = TERMS.find((item) => item.pattern.test(text));
  if (term) return { kind: "faq", source: "fixed", title: `${term.term}란?`, text: term.description, links: [{ label: GUIDE_ROUTES[term.route].label, href: GUIDE_ROUTES[term.route].href }] };
  const rules = [
    [/ETF|상장지수펀드/i, "etf"], [/백테스트|과거\s*수익|수익률\s*비교/i, "backtest"], [/공시|사업보고서|분기보고서/i, "filings"], [/리포트|증권사\s*보고서/i, "research"], [/상관|환율.*금리|금리.*환율/i, "correlation"], [/기업\s*비교|종목\s*비교|스크리닝|후보/i, "compare"], [/기업\s*분석|재무제표|실적|현금흐름/i, "company"], [/업종|산업|경제지표|금리|환율/i, "home"],
  ];
  const match = rules.find(([pattern]) => pattern.test(text));
  if (match) {
    const answer = routeAnswer(match[1], "fixed");
    if (match[1] === "company" && context.companyName) answer.text = `${context.companyName}의 공시 재무와 기준일을 기업 분석 화면에서 확인해 보세요. 화면의 값을 확인하기 전에는 수치를 단정하지 않습니다.`;
    return answer;
  }
  return { kind: "unknown", title: "질문을 더 구체적으로 알려 주세요", text: "어떤 기업, 지표, 기간을 보고 싶은지 적어 주시면 알맞은 화면을 찾기 쉬워요.", links: [{ label: "기업 비교 보기", href: GUIDE_ROUTES.compare.href }, { label: "데이터 실험실 보기", href: GUIDE_ROUTES.correlation.href }] };
}
