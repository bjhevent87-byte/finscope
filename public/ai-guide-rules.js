// FinScope AI Guide v1: financial facts are never generated here or by the model.
export const GUIDE_ROUTES = Object.freeze({
  home: { label: "경제·업종 지표 보기", menuLabel: "홈", menuHint: "경제지표·산업별 지표", href: "/home.html", detail: "발표 기준일과 출처를 확인하며 경제·업종 지표를 살펴보세요." },
  correlation: { label: "데이터 실험실 보기", menuLabel: "데이터 실험실", menuHint: "상관관계·산업 스트레스", href: "/correlation.html", detail: "환율·금리·주가의 동반 움직임과 업종 반응을 살펴보세요. 상관관계는 인과관계가 아닙니다." },
  compare: { label: "기업 비교하기", menuLabel: "기업 비교", menuHint: "조건으로 후보 찾기", href: "/index.html", detail: "시장·업종을 고르고 재무 지표를 같은 기준으로 비교해 보세요." },
  company: { label: "기업 분석하기", menuLabel: "기업 분석", menuHint: "한 기업의 재무·주가", href: "/company.html", detail: "선택한 기업의 공시 재무, 주가, 외부요인을 차례로 확인해 보세요." },
  filings: { label: "DART 공시 확인하기", menuLabel: "DART 공시", menuHint: "사업보고서·공시 원문", href: "/filings.html", detail: "공시 원문과 공시일을 직접 확인해 보세요." },
  research: { label: "증권사 리포트 보기", menuLabel: "리포트", menuHint: "네이버·한경 리포트", href: "/research.html", detail: "외부 리포트의 발행일과 작성 기관을 확인해 보세요." },
  backtest: { label: "지난 성과 비교하기", menuLabel: "백테스트", menuHint: "과거 수익률·자산 비중", href: "/backtest.html", detail: "과거 수익률과 기간별 변동을 확인해 보세요. 미래 성과를 보장하지 않습니다." },
  etf: { label: "ETF 비교하기", menuLabel: "ETF 비교", menuHint: "수익률·NAV·괴리율", href: "/etf.html", detail: "ETF의 종가, NAV, 괴리율을 같은 날짜 기준으로 비교해 보세요." },
});

const TERMS = [
  { pattern: /\bPER\b|주가수익비율|주가수익률/i, term: "PER", description: "주가를 주당순이익(EPS)으로 나눈 값입니다. 이익 대비 주가가 몇 배인지 보여 주지만, 이익이 적자이거나 일시적으로 변하면 해석이 어려워요. 같은 업종의 기업과 함께 비교하세요.", route: "compare" },
  { pattern: /\bPBR\b|주가순자산비율/i, term: "PBR", description: "주가를 주당순자산(BPS)으로 나눈 값입니다. 순자산 대비 주가 수준을 보여 주지만, 낮다는 이유만으로 저평가라고 단정할 수는 없어요. 수익성과 업종을 함께 보세요.", route: "compare" },
  { pattern: /매출\s*(?:액\s*)?(?:성장률|증가율)|매출이?\s*(?:얼마나\s*)?(?:늘었|증가했)/i, term: "매출성장률", description: "이전 기간보다 매출이 얼마나 늘거나 줄었는지 나타내는 비율입니다. (이번 매출−이전 매출)÷이전 매출로 계산해요. 연간은 전년과, 분기는 전년 같은 분기와 비교하세요.", route: "compare" },
  { pattern: /\bROE\b|자기자본이익률/i, term: "ROE", description: "자기자본으로 얼마의 순이익을 냈는지 보는 비율입니다. 높다는 사실만 보지 말고 부채 부담과 일회성 이익을 확인한 뒤 같은 업종·기간끼리 비교하세요.", route: "compare" },
  { pattern: /영업이익률/i, term: "영업이익률", description: "매출 중 영업이익이 차지하는 비율입니다. 본업에서 남긴 이익을 보되, 같은 업종·같은 기간의 기업끼리 비교하세요. 금융업에는 일반 제조업과 같은 기준을 적용하기 어렵습니다.", route: "compare" },
  { pattern: /\bEPS\b|주당순이익/i, term: "EPS", description: "주식 한 주에 해당하는 순이익입니다. 일회성 손익과 주식 수 변화를 확인하고 PER과 함께 읽어 보세요.", route: "compare" },
  { pattern: /\bFCF\b|잉여현금흐름/i, term: "FCF", description: "영업에서 들어온 현금에서 설비투자 등에 쓴 현금을 뺀 값입니다. 일시적인 투자 때문에 음수가 될 수도 있어요.", route: "company" },
  { pattern: /\bBSI\b|업황\s*지수|기업경기실사지수/i, term: "업황 BSI", description: "기업이 체감한 업황을 조사한 지표입니다. 기준점과 조사 시점, 업종을 함께 보세요.", route: "home" },
  { pattern: /부채비율/i, term: "부채비율", description: "자기자본에 비해 부채가 어느 정도인지 나타냅니다. 금융업과 비금융업은 같은 잣대로 비교하기 어렵습니다.", route: "compare" },
  { pattern: /이자보상배율/i, term: "이자보상배율", description: "영업이익으로 이자비용을 몇 배 감당할 수 있는지 보여 줍니다. 일회성 손익과 회계 기준도 확인하세요.", route: "company" },
  { pattern: /괴리율/i, term: "ETF 괴리율", description: "ETF 시장가격과 순자산가치(NAV)의 차이를 비율로 나타냅니다. 같은 시점의 값을 비교해야 합니다.", route: "etf" },
  { pattern: /상관계수|상관관계/i, term: "상관계수", description: "두 값이 같은 방향 또는 반대 방향으로 움직이는 정도입니다. 함께 움직였다는 사실만으로 원인을 알 수는 없어요.", route: "correlation" },
];

// Only these reviewed explanations may be supplied as context to the optional model.
const INTERPRETATION_FACTS = [
  { id: "guide-growth", label: "성장성 함께 읽기", text: "매출 성장률은 판매 규모의 변화이고 영업이익 성장률은 본업 이익의 변화입니다. 매출만 늘고 이익이 줄었다면 비용이나 수익성 변화를 추가로 확인해야 합니다.", route: "compare" },
  { id: "guide-profit", label: "수익성 함께 읽기", text: "영업이익률은 매출 대비 본업 이익을, ROE는 자기자본 대비 순이익을 봅니다. 두 지표의 분모와 포함 손익이 달라 같은 뜻으로 읽을 수 없습니다.", route: "compare" },
  { id: "guide-leverage", label: "ROE와 부채 부담", text: "부채를 많이 사용하면 자기자본이 작아져 ROE가 높아 보일 수 있습니다. ROE와 부채비율, 현금흐름을 함께 확인하고 같은 업종 기업끼리 비교해야 합니다.", route: "compare" },
  { id: "guide-cash", label: "이익과 현금", text: "회계상 이익과 실제 현금 유입은 다를 수 있습니다. 영업현금흐름에서 설비투자 지출을 뺀 단순 FCF를 함께 보면 투자 뒤 남는 현금을 점검할 수 있지만, 한 해의 음수만으로 기업의 장기 건전성을 단정할 수 없습니다.", route: "company" },
  { id: "guide-liquidity", label: "현금흐름과 유동성", text: "영업현금흐름과 FCF는 기간 중 현금 창출을 보여 주지만 단기 유동비율을 대체하지 않습니다. 단기 상환 여력 판단에는 유동자산·유동부채와 만기 정보를 별도로 확인해야 합니다.", route: "company" },
  { id: "guide-valuation", label: "가격과 기업의 질", text: "PER과 PBR이 낮다고 곧바로 저평가라고 볼 수 없습니다. 이익의 지속성, ROE, 성장성, 업종 차이를 함께 확인해야 합니다.", route: "compare" },
  { id: "guide-credit", label: "기업여신 관점", text: "기업여신을 검토할 때는 사업과 업종, 성장성과 수익성, 영업현금 창출, 부채와 만기 부담을 순서대로 점검합니다. FinScope의 조건 비교는 학습용 후보 탐색이며 실제 여신 심사나 신용등급을 대신하지 않습니다.", route: "compare" },
];
export const GUIDE_FACTS = Object.freeze([
  ...TERMS.map((item, index) => Object.freeze({ id: `term-${index + 1}`, label: item.term, text: item.description, route: item.route })),
  ...INTERPRETATION_FACTS.map((item) => Object.freeze(item)),
]);

const FOLLOW_UP_PATHS = [
  { pattern: /\bROE\b|자기자본이익률/i, questions: ["ROE가 높아도 부채비율을 함께 봐야 하나?", "ROE와 영업이익률은 어떻게 달라?", "이익과 현금흐름이 다르면 무엇을 확인해야 해?"] },
  { pattern: /\bPER\b|\bPBR\b|저평가|주가수익비율/i, questions: ["PER이 낮으면 무조건 저평가야?", "PBR과 ROE를 함께 보는 이유는?", "같은 업종 기업끼리 비교하는 이유는?"] },
  { pattern: /매출|성장성|성장률/i, questions: ["매출은 늘었는데 영업이익이 줄면 어떻게 봐?", "매출성장률과 영업이익 성장률은 어떻게 달라?", "성장성과 현금흐름을 함께 보는 이유는?"] },
  { pattern: /부채|안정성|여신|상환/i, questions: ["부채비율이 낮으면 무조건 안전해?", "기업여신 관점에서 어떤 순서로 확인해?", "현금흐름과 단기 유동성은 같은 뜻이야?"] },
  { pattern: /\bFCF\b|현금흐름|유동성|CAPEX/i, questions: ["이익은 나는데 현금흐름이 약하면 왜 그래?", "FCF가 음수면 무조건 위험해?", "현금흐름과 단기 유동성은 같은 뜻이야?"] },
  { pattern: /\bBSI\b|업황|산업/i, questions: ["업황 BSI와 기업 실적은 어떻게 연결해 봐?", "같은 업종 기업끼리 비교하는 이유는?", "환율과 주가가 같이 움직이면 원인이라고 볼 수 있어?"] },
  { pattern: /상관|환율|금리|시차/i, questions: ["상관관계가 높으면 원인이라고 볼 수 있어?", "환율과 주가를 비교할 때 기간은 왜 중요해?", "업종별 반응을 함께 보는 이유는?"] },
];
const PAGE_FOLLOW_UPS = {
  home: ["업황 BSI는 어떻게 읽어?", "산업 지표와 기업 실적을 함께 보려면?", "기업 비교는 어디서 시작해?"],
  compare: ["성장성과 수익성은 어떻게 달라?", "ROE와 부채비율을 함께 보는 이유는?", "기업여신 관점에서 어떤 순서로 확인해?"],
  company: ["이익과 현금흐름이 다르면 무엇을 확인해야 해?", "FCF가 음수면 무조건 위험해?", "DART 원문은 어디서 확인해?"],
  correlation: ["상관관계가 높으면 원인이라고 볼 수 있어?", "환율과 주가를 비교할 때 기간은 왜 중요해?", "산업 스트레스 실험은 어디서 해?"],
  backtest: ["과거 수익률이 미래 성과를 보장해?", "ETF도 비교할 수 있어?", "주가 변동성과 재무 안정성은 같은 뜻이야?"],
  etf: ["ETF 괴리율은 어떻게 봐?", "ETF의 NAV와 종가는 왜 달라?", "과거 ETF 수익률은 어디서 비교해?"],
  filings: ["DART 사업보고서는 어디서 봐?", "공시 숫자와 시장가격의 기준일이 같아?", "기업 분석 화면으로 이동하려면?"],
  research: ["리포트 발행일은 왜 확인해야 해?", "DART 공시와 증권사 리포트는 어떻게 달라?", "기업 분석 화면으로 이동하려면?"],
};
export function guideNextQuestions(question, page = "home", asked = []) {
  const text = String(question || "").trim();
  if (!text || guideAnswer(text).kind === "restricted") return [];
  const seen = new Set([text, ...asked].map((item) => String(item || "").trim()));
  const topicQuestions = FOLLOW_UP_PATHS.find((item) => item.pattern.test(text))?.questions || [];
  const pageQuestions = PAGE_FOLLOW_UPS[page] || PAGE_FOLLOW_UPS.home;
  const options = [...topicQuestions, ...pageQuestions, ...FOLLOW_UP_PATHS.flatMap((item) => item.questions)];
  return [...new Set(options)].filter((item) => !seen.has(item)).slice(0, 3);
}

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
  if (term) return { kind: "faq", source: "fixed", title: `${term.term} 이해하기`, text: term.description, links: [{ label: GUIDE_ROUTES[term.route].label, href: GUIDE_ROUTES[term.route].href }] };
  const rules = [
    [/데이터\s*실험실|상관|산점도|시차|이동\s*상관|산업\s*스트레스|시장\s*변화와\s*업종|두\s*(?:지표|데이터)|환율.*(?:주가|금리)|(?:주가|금리).*환율/i, "correlation"],
    [/ETF|상장지수펀드|\bNAV\b|추적\s*오차/i, "etf"],
    [/백테스트|모의\s*투자|포트폴리오|과거\s*수익|수익률\s*비교|자산\s*비중/i, "backtest"],
    [/\bDART\b|공시|사업보고서|분기보고서|반기보고서/i, "filings"],
    [/리포트|컨센서스|애널리스트|한경|증권사\s*보고서/i, "research"],
    [/기업\s*비교|종목\s*비교|스크리닝|후보|조건\s*통과|기업\s*찾기/i, "compare"],
    [/기업\s*분석|재무제표|실적|현금흐름|영업이익|재무\s*상태/i, "company"],
    [/홈|업종|산업|경제지표|기준금리|환율|유가|물가|시가총액|데이터\s*상태/i, "home"],
  ];
  const match = rules.find(([pattern]) => pattern.test(text));
  if (match) {
    const answer = routeAnswer(match[1], "fixed");
    if (match[1] === "company" && context.companyName) answer.text = `${context.companyName}의 공시 재무와 기준일을 기업 분석 화면에서 확인해 보세요. 화면의 값을 확인하기 전에는 수치를 단정하지 않습니다.`;
    return answer;
  }
  return { kind: "unknown", title: "질문을 조금만 더 구체적으로 적어 주세요", text: "아직 이 질문의 뜻을 정확히 파악하지 못했습니다. ‘PER 뜻’, ‘기업 비교 방법’, ‘DART 공시 확인’처럼 묻거나 질문 목록에서 골라 주세요.", links: [{ label: "기업 비교", href: GUIDE_ROUTES.compare.href }, { label: "기업 분석", href: GUIDE_ROUTES.company.href }] };
}
