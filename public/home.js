const $ = (selector) => document.querySelector(selector);
const SERIES_INFO = {
  "kr-base-rate": { description: "한국은행이 결정하는 정책금리입니다. 대출·예금금리와 기업의 자금조달 비용을 함께 움직입니다.", digits: 2 },
  "usd-krw": { description: "한국은행이 발표한 날짜별 원/달러 기준 환율입니다. 수출 기업의 매출과 수입 원자재 비용을 살필 때 참고합니다.", digits: 2 },
  "us-10y": { description: "미국 장기금리의 대표 지표입니다. 성장주의 할인율과 글로벌 자금 흐름을 볼 때 참고합니다.", digits: 2 },
  wti: { description: "서부텍사스유 가격입니다. 화학·운송·항공 등 원가 민감 업종을 분석할 때 확인합니다.", digits: 2 },
  "us-policy-rate": { description: "FOMC가 정하는 연방기금 목표금리 범위의 상단입니다. 월평균 실효금리가 아니므로 정책 변경일에 계단형으로 움직입니다.", digits: 2 },
  "us-cpi": { description: "미국 도시 소비자의 상품·서비스 가격 수준입니다. 기본 차트는 물가 상승 속도를 보기 위해 전년동월비로 표시하며, 지수와 전월비로 전환할 수 있습니다.", digits: 2 },
};

const SERIES_IDS = Object.keys(SERIES_INFO);
const state = { series: new Map(), selected: "kr-base-rate", years: 5, cpiMode: "yoy", chart: null, industryChart: null, industryDetail: null, health: null, sourceStatus: {}, selectedIndustries: new Set(), industryFailed: new Set() };

function industryMetricGuide(id, name, industryName) {
  const common = {
    meaning: `${name}은 ${industryName} 업종의 흐름을 점검할 때 함께 보는 보조 지표입니다.`,
    up: "선이 오르면 해당 지표의 수준이 이전 관측치보다 높아졌다는 뜻입니다.",
    down: "선이 내리면 해당 지표의 수준이 이전 관측치보다 낮아졌다는 뜻입니다.",
    caution: "한 지표만으로 업황이나 주가의 원인을 단정하지 말고 같은 업종 카드의 다른 지표와 함께 확인하세요.",
  };
  if (id.startsWith("bsi-")) return {
    meaning: `${name}는 기업 설문을 지수화한 체감경기 지표입니다. 100보다 높으면 업황이 좋다는 응답이, 100보다 낮으면 나쁘다는 응답이 더 많다는 뜻입니다.`,
    up: "숫자가 오르면 기업들이 느끼는 업황이 나아졌다는 뜻입니다. 100을 넘으면 좋다는 응답이 나쁘다는 응답보다 많습니다.",
    down: "100에서 멀어지며 내리면 현장의 체감 업황이 약해지는 흐름입니다.",
    caution: "실제 매출이나 생산량이 아니라 설문 응답입니다. 수출·생산·가격 지표와 같은 방향인지 함께 보세요.",
  };
  if (id.startsWith("krx-future-")) return {
    meaning: `${name}는 미래에 사고팔기로 한 계약 중 만기가 가장 가까운 계약의 가격입니다. 현재 거래 가격보다 먼저 움직일 수 있어 시장의 기대를 살펴볼 때 씁니다.`,
    up: "선물 가격 상승은 해당 자산이나 업종에 대한 기대가 강해졌다는 신호일 수 있습니다.",
    down: "선물 가격 하락은 기대 약화나 위험 회피가 커졌다는 신호일 수 있습니다.",
    caution: "거래되는 계약이 바뀌는 시점이나 사고팔려는 사람의 수에도 영향을 받습니다. 미래 가격을 확정해서 알려주는 값은 아닙니다.",
  };
  if (id === "krx-gasoline" || id === "krx-diesel") return {
    meaning: `${name}는 국내 유통시장의 월말 평균 가격입니다. 운송·건설·화학 업종의 연료비와 원가 부담을 볼 때 참고합니다.`,
    up: "가격 상승은 연료를 많이 쓰는 기업의 비용 부담이 커질 가능성을 뜻합니다.",
    down: "가격 하락은 관련 기업의 비용 부담이 완화될 가능성을 뜻합니다.",
    caution: "기업마다 계약 기간과 재고가 다르고, 오른 비용을 판매가격에 반영할 수 있는지도 달라요. 비용과 이익이 바로 같은 폭으로 움직이지는 않습니다.",
  };
  if (id === "krx-emission-kau") return {
    meaning: "KAU는 국내 배출권시장에서 거래되는 탄소배출권 가격입니다. 탄소를 많이 배출하는 업종의 잠재 비용을 점검합니다.",
    up: "배출권 가격 상승은 철강·화학·발전 등 배출 집약 업종의 탄소 비용 부담이 커질 수 있음을 뜻합니다.",
    down: "가격 하락은 단기적인 배출 비용 부담이 완화될 수 있음을 뜻합니다.",
    caution: "배출권을 무료로 받은 양, 정책 변화, 거래량에 따라 기업별 실제 부담이 달라집니다. 탄소 배출을 줄이기 위한 투자도 함께 보세요.",
  };
  if (id.startsWith("krx-")) return {
    meaning: `${name}는 관련 상장기업들의 주가 움직임을 묶은 KRX 지수입니다. 실물 생산량이 아니라 시장이 평가한 업종의 가격 흐름입니다.`,
    up: "지수 상승은 해당 업종 구성 종목의 주가가 전반적으로 강해졌다는 뜻입니다.",
    down: "지수 하락은 해당 업종 구성 종목의 주가가 전반적으로 약해졌다는 뜻입니다.",
    caution: "규모가 큰 기업의 주가가 지수에 더 큰 영향을 줄 수 있어요. 기업 설문으로 만든 업황 BSI와 수출·원가 지표도 함께 확인하세요.",
  };
  if (["kr-base-rate", "kr-3y", "kr-corp-3y", "us-10y", "us-policy-rate"].includes(id)) return {
    meaning: `${name}는 기업이 돈을 빌리는 비용과 주식의 가치평가에 영향을 주는 금리 지표입니다.`,
    up: "금리가 오르면 보통 이자 부담이 커집니다. 은행·보험은 대출금리와 예금금리의 차이, 보유 자산의 수익에 따라 영향이 달라질 수 있어요.",
    down: "금리 하락은 자금조달 부담을 낮출 수 있지만 금융업의 수익성에는 불리하게 작용할 수도 있습니다.",
    caution: "현재 금리 숫자만 보지 말고 장단기 금리의 차이, 대출 증가, 연체, 기업이 가진 빚의 구조도 함께 확인하세요.",
  };
  if (id === "usd-krw") return {
    meaning: "원/달러 환율은 1달러를 사는 데 필요한 원화입니다. 숫자가 오르면 원화 약세, 내리면 원화 강세입니다.",
    up: "원화 약세는 수출기업의 원화 환산 매출에 유리할 수 있지만 원재료·에너지 수입비용은 높일 수 있습니다.",
    down: "원화 강세는 수입비용을 낮출 수 있지만 수출기업의 원화 환산 매출에는 불리할 수 있습니다.",
    caution: "수출 비중, 수입 비용, 환율 변동에 대비한 계약이 있는지에 따라 기업별 실제 영향은 달라집니다.",
  };
  if (["wti", "brent", "copper"].includes(id)) return {
    meaning: `${name}는 글로벌 원자재 가격입니다. 세계 수요와 공급 차질을 동시에 반영합니다.`,
    up: "가격 상승은 수요 회복 신호일 수도 있지만 해당 원자재를 쓰는 기업에는 원가 부담이 될 수 있습니다.",
    down: "가격 하락은 원가 부담을 낮출 수 있지만 세계 수요 둔화를 반영할 수도 있습니다.",
    caution: "가격 방향만 보지 말고 재고, 공급 차질, 환율과 늘어난 비용을 판매가격에 반영할 수 있는지도 함께 확인하세요.",
  };
  if (["kr-cpi", "kr-ppi", "kr-import-price"].includes(id)) return {
    meaning: `${name}는 상품과 서비스 또는 기업 원가의 가격 수준을 기준연도 100으로 나타낸 지수입니다.`,
    up: "지수 상승은 물가 또는 원가 압력이 높아지는 흐름입니다. 판매가격 전가 여부가 기업 이익을 좌우합니다.",
    down: "지수 하락은 물가·원가 압력이 완화되는 흐름일 수 있습니다.",
    caution: "지수 자체보다 1년 전 같은 달과 비교한 상승률, 최근 오르는 속도, 업종마다 다른 비용 구조를 함께 확인하세요.",
  };
  if (["kr-export-volume", "kr-industrial-production", "us-industrial-production"].includes(id)) return {
    meaning: `${name}는 가격 효과를 줄이고 실제 수출량이나 생산 활동의 크기를 살펴보는 지표입니다.`,
    up: "지수 상승은 수출 물량이나 생산 활동이 확대되는 흐름입니다.",
    down: "지수 하락은 수요나 생산 활동이 둔화되는 흐름일 수 있습니다.",
    caution: "전체 지표이므로 개별 업종·기업 실적과 차이가 날 수 있습니다. 업종별 수주와 재고도 함께 확인하세요.",
  };
  if (id === "kr-ccsi") return {
    meaning: "소비자심리지수는 가계가 느끼는 경기·소득·소비 전망을 종합한 설문 지표입니다. 100보다 높으면 장기평균보다 낙관적입니다.",
    up: "지수가 오르면 소비심리가 개선되는 흐름으로 유통·음식료·미디어 수요에 긍정적일 수 있습니다.",
    down: "지수가 내리면 소비심리가 위축되는 흐름입니다.",
    caution: "심리가 실제 소비로 바로 이어지지는 않으므로 소매판매와 물가를 함께 확인하세요.",
  };
  if (id === "vix") return {
    meaning: "VIX는 미국 주식시장이 예상하는 단기 변동성으로, 시장의 불안 정도를 보여주는 지표입니다.",
    up: "VIX 상승은 위험 회피와 시장 불안이 커지는 흐름입니다.",
    down: "VIX 하락은 시장 불안이 완화되는 흐름입니다.",
    caution: "VIX가 높다고 주가가 반드시 더 하락하거나 낮다고 반드시 상승하는 것은 아닙니다.",
  };
  return common;
}

function industryPointReading(id, value) {
  if (id.startsWith("bsi-")) return value >= 100 ? "100 이상 · 긍정 응답 우세" : "100 미만 · 부정 응답 우세";
  if (id === "kr-ccsi") return value >= 100 ? "100 이상 · 장기평균보다 낙관적" : "100 미만 · 장기평균보다 비관적";
  if (id === "usd-krw") return "숫자가 오르면 원화 약세, 내리면 원화 강세";
  if (id === "vix") return value >= 30 ? "시장 불안이 높은 구간" : value >= 20 ? "변동성 경계 구간" : "시장 불안이 비교적 낮은 구간";
  return "같은 지표의 이전 시점과 비교해 흐름을 확인하세요.";
}

const industryDefinitions = [
  { icon: "▦", name: "반도체", path: "수출·업황 → 환율 → 가동률 → 이익", drivers: [["전자·통신 업황 BSI", "ECOS", "bsi-electronics"], ["수출물량지수", "ECOS", "kr-export-volume"], ["원/달러", "ECOS", "usd-krw"]] },
  { icon: "◆", name: "자동차", path: "글로벌 수요 → 환율·원가 → 판매 믹스 → 이익", drivers: [["자동차 업황 BSI", "ECOS", "bsi-auto"], ["원/달러", "ECOS", "usd-krw"], ["브렌트유", "FRED", "brent"]] },
  { icon: "▣", name: "2차전지", path: "EV 수요 → 메탈 가격 → 가동률 → 마진", drivers: [["국제 구리 가격", "FRED·IMF", "copper"], ["원/달러", "ECOS", "usd-krw"], ["수입물가지수", "ECOS", "kr-import-price"]] },
  { icon: "△", name: "화학", path: "유가 → 원재료비 → 업황 → 이익", drivers: [["화학 업황 BSI", "ECOS", "bsi-chemical"], ["WTI", "FRED", "wti"], ["수입물가지수", "ECOS", "kr-import-price"]] },
  { icon: "▤", name: "은행", path: "기준금리·수익률곡선 → NIM → 충당금 → 이익", drivers: [["한국 기준금리", "ECOS", "kr-base-rate"], ["국고채 3년", "ECOS", "kr-3y"], ["회사채 3년 AA-", "ECOS", "kr-corp-3y"]] },
  { icon: "◇", name: "보험", path: "장기금리 → 운용수익 → CSM·K-ICS → 이익", drivers: [["국고채 3년", "ECOS", "kr-3y"], ["미국 10년물", "FRED", "us-10y"], ["한국 기준금리", "ECOS", "kr-base-rate"]] },
  { icon: "◫", name: "IT하드웨어", path: "세트 수요 → 부품 출하 → 환율 → 마진", drivers: [["전자·통신 업황 BSI", "ECOS", "bsi-electronics"], ["수출물량지수", "ECOS", "kr-export-volume"], ["원/달러", "ECOS", "usd-krw"]] },
  { icon: "⌘", name: "소프트웨어", path: "기업 IT지출 → 할인율 → 고용 → 이익", drivers: [["미국 산업생산", "FRED", "us-industrial-production"], ["미국 10년물", "FRED", "us-10y"], ["VIX", "FRED", "vix"]] },
  { icon: "⚓", name: "조선", path: "대외수요 → 수주잔고 → 원가·환율 → 이익", drivers: [["수출물량지수", "ECOS·공통 대외수요", "kr-export-volume"], ["생산자물가지수", "ECOS·원가 대용", "kr-ppi"], ["원/달러", "ECOS", "usd-krw"]] },
  { icon: "⚙", name: "기계", path: "설비투자 → 수주 → 원재료 → 가동률", drivers: [["제조업 업황 BSI", "ECOS", "bsi-manufacturing"], ["전산업생산", "ECOS", "kr-industrial-production"], ["수출물량지수", "ECOS", "kr-export-volume"]] },
  { icon: "▥", name: "철강", path: "글로벌 수요 → 산업금속·원가 → 스프레드 → 이익", drivers: [["국제 구리 가격", "FRED·산업금속 대용", "copper"], ["생산자물가지수", "ECOS", "kr-ppi"], ["원/달러", "ECOS", "usd-krw"]] },
  { icon: "●", name: "에너지", path: "유가 → 판매량 → 재고평가 → 이익", drivers: [["WTI", "FRED", "wti"], ["브렌트유", "FRED", "brent"], ["수입물가지수", "ECOS", "kr-import-price"]] },
  { icon: "▧", name: "건설", path: "수요·분양 → 원가·금리 → 공정률 → 이익", drivers: [["국고채 3년", "ECOS", "kr-3y"], ["생산자물가지수", "ECOS", "kr-ppi"], ["소비자심리지수", "ECOS", "kr-ccsi"]] },
  { icon: "↗", name: "운송", path: "물동량·운임 → 유가·환율 → 탑승률 → 이익", drivers: [["WTI", "FRED", "wti"], ["브렌트유", "FRED", "brent"], ["원/달러", "ECOS", "usd-krw"]] },
  { icon: "▨", name: "유통", path: "소비심리·물가 → 객단가 → 재고회전 → 이익", drivers: [["소비자심리지수", "ECOS", "kr-ccsi"], ["한국 CPI", "ECOS", "kr-cpi"], ["전산업생산", "ECOS·경기 대용", "kr-industrial-production"]] },
  { icon: "◉", name: "음식료", path: "수입원가·환율 → 판가 → 판매량 → 이익", drivers: [["수입물가지수", "ECOS", "kr-import-price"], ["한국 CPI", "ECOS", "kr-cpi"], ["원/달러", "ECOS", "usd-krw"]] },
  { icon: "✦", name: "화장품", path: "대외수요 → 채널 믹스 → 환율 → 마진", drivers: [["수출물량지수", "ECOS·대외수요 대용", "kr-export-volume"], ["소비자심리지수", "ECOS", "kr-ccsi"], ["원/달러", "ECOS", "usd-krw"]] },
  { icon: "✚", name: "바이오·제약", path: "성장 기대 → 할인율·위험선호 → R&D → 가치", drivers: [["미국 10년물", "FRED", "us-10y"], ["VIX", "FRED", "vix"], ["미국 달러지수", "FRED", "us-dollar-index"]] },
  { icon: "▰", name: "증권", path: "위험선호·금리 → 거래·운용손익 → 이익", drivers: [["VIX", "FRED", "vix"], ["국고채 3년", "ECOS", "kr-3y"], ["한국 기준금리", "ECOS", "kr-base-rate"]] },
  { icon: "◒", name: "통신", path: "경기·금리 → CAPEX → 감가상각 → 현금흐름", drivers: [["전산업생산", "ECOS·경기 대용", "kr-industrial-production"], ["한국 기준금리", "ECOS", "kr-base-rate"], ["미국 10년물", "FRED", "us-10y"]] },
  { icon: "▷", name: "미디어·엔터", path: "소비심리·위험선호 → 광고·구독 → 이익", drivers: [["소비자심리지수", "ECOS", "kr-ccsi"], ["VIX", "FRED", "vix"], ["원/달러", "ECOS", "usd-krw"]] },
  { icon: "≈", name: "유틸리티", path: "연료비·환율 → 요금 → 판매량 → 이익", drivers: [["WTI", "FRED", "wti"], ["수입물가지수", "ECOS", "kr-import-price"], ["원/달러", "ECOS", "usd-krw"]] },
];

const industryBenchmarks = {
  반도체: "krx-semiconductor", 자동차: "krx-auto", "2차전지": "krx-energy-chemical", 화학: "krx-energy-chemical",
  은행: "krx-bank", 보험: "krx-insurance", IT하드웨어: "krx-it", 소프트웨어: "krx-it", 조선: "krx-industrials",
  기계: "krx-machinery", 철강: "krx-steel", 에너지: "krx-energy-chemical", 건설: "krx-construction", 운송: "krx-transport",
  유통: "krx-discretionary", 음식료: "krx-staples", 화장품: "krx-discretionary", "바이오·제약": "krx-healthcare",
  증권: "krx-securities", 통신: "krx-broadcast", "미디어·엔터": "krx-broadcast", 유틸리티: "krx-utilities",
};

const industryDriverOverrides = {
  반도체: [["KRX 반도체", "KRX 업종지수", "krx-semiconductor"], ["반도체 선물 최근월", "KRX 선행시장", "krx-future-semiconductor"], ["전자·통신 업황 BSI", "ECOS", "bsi-electronics"], ["원/달러", "ECOS", "usd-krw"]],
  "2차전지": [["KRX 에너지화학", "KRX 업종지수", "krx-energy-chemical"], ["에너지화학 선물", "KRX 선행시장", "krx-future-energy-chemical"], ["국제 구리 가격", "FRED·IMF", "copper"], ["수입물가지수", "ECOS", "kr-import-price"]],
  화학: [["KRX 에너지화학", "KRX 업종지수", "krx-energy-chemical"], ["KRX 휘발유 유통가격", "KRX 석유시장", "krx-gasoline"], ["화학 업황 BSI", "ECOS", "bsi-chemical"], ["원/달러", "ECOS", "usd-krw"]],
  철강: [["KRX 철강", "KRX 업종지수", "krx-steel"], ["KAU 배출권 최근물", "KRX 배출권시장", "krx-emission-kau"], ["국제 구리 가격", "FRED·산업금속", "copper"], ["생산자물가지수", "ECOS", "kr-ppi"]],
  에너지: [["KRX 에너지화학", "KRX 업종지수", "krx-energy-chemical"], ["KRX 휘발유 유통가격", "KRX 석유시장", "krx-gasoline"], ["WTI", "FRED", "wti"], ["원/달러", "ECOS", "usd-krw"]],
  운송: [["KRX 운송", "KRX 업종지수", "krx-transport"], ["KRX 경유 유통가격", "KRX 석유시장", "krx-diesel"], ["WTI", "FRED", "wti"], ["원/달러", "ECOS", "usd-krw"]],
  유틸리티: [["KRX 유틸리티", "KRX 업종지수", "krx-utilities"], ["KAU 배출권 최근물", "KRX 배출권시장", "krx-emission-kau"], ["수입물가지수", "ECOS", "kr-import-price"], ["원/달러", "ECOS", "usd-krw"]],
};

industryDefinitions.forEach((industry) => {
  industry.benchmark = industryBenchmarks[industry.name];
  if (industryDriverOverrides[industry.name]) industry.drivers = industryDriverOverrides[industry.name];
  else if (industry.benchmark) industry.drivers = [[`KRX ${industry.name} 관련 지수`, "KRX 업종지수", industry.benchmark], ...industry.drivers];
});

const featuredIndustries = new Set(["반도체", "자동차", "2차전지", "화학", "은행", "보험"]);
state.selectedIndustries = new Set(featuredIndustries);

function compactDate(date) { return date.toISOString().slice(0, 10).replaceAll("-", ""); }
function yearsAgo(years) { const date = new Date(); date.setFullYear(date.getFullYear() - years); return compactDate(date); }
function daysAgo(days) { const date = new Date(); date.setDate(date.getDate() - days); return compactDate(date); }
function today() { return compactDate(new Date()); }
function displayDate(value) { if (!value) return "자료 없음"; const text = String(value).replace(/\D/g, ""); return text.length >= 8 ? `${text.slice(0, 4)}.${text.slice(4, 6)}.${text.slice(6, 8)}` : String(value); }
function displayTime(value) { if (!value) return "확인 불가"; return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
function api(path) { return fetch(path).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "데이터를 불러오지 못했습니다."); return body; }); }
function formatSeriesValue(series, value) {
  if (!Number.isFinite(value)) return "자료 없음";
  const digits = SERIES_INFO[series?.id]?.digits ?? 2;
  const number = value.toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const unit = series?.unit || "";
  if (unit === "%") return `${number}%`;
  if (unit === "원") return `${number}원`;
  if (unit === "지수") return `${number}p`;
  if (unit === "달러/배럴") return `${number}달러/배럴`;
  if (unit === "달러/톤") return `${number}달러/톤`;
  if (unit === "원/리터") return `${number}원/리터`;
  if (unit === "원/톤") return `${number}원/톤`;
  return unit ? `${number} (${unit})` : number;
}
function metricValue(series) { return formatSeriesValue(series, series?.latest?.value); }
function metricDelta(series) { const valid = (series?.observations || []).filter((item) => Number.isFinite(item.value)); if (valid.length < 2) return null; const previous = valid.at(-2).value; const latest = valid.at(-1).value; return { value: latest - previous, direction: latest > previous ? "up" : latest < previous ? "down" : "" }; }
function shortDelta(series) { const delta = metricDelta(series); if (!delta) return "변화 비교 없음"; const sign = delta.value > 0 ? "+" : ""; return `${sign}${delta.value.toFixed(SERIES_INFO[series.id]?.digits ?? 2)}${series.unit === "%" ? "%p" : ""}`; }
function money(value) { const amount = Number(value); if (!Number.isFinite(amount)) return "자료 없음"; if (Math.abs(amount) >= 1e12) return `${(amount / 1e12).toFixed(1)}조`; if (Math.abs(amount) >= 1e8) return `${(amount / 1e8).toFixed(0)}억`; return amount.toLocaleString("ko-KR"); }

function monthSerial(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})/);
  return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : null;
}

function cpiDisplaySeries(series) {
  if (series?.id !== "us-cpi" || state.cpiMode === "index") return series;
  const points = (series.observations || []).filter((point) => Number.isFinite(point.value));
  const byMonth = new Map(points.map((point) => [monthSerial(point.date), point.value]));
  const offset = state.cpiMode === "yoy" ? 12 : 1;
  const observations = points.map((point) => {
    const previous = byMonth.get(monthSerial(point.date) - offset);
    return { ...point, value: Number.isFinite(previous) && previous !== 0 ? ((point.value / previous) - 1) * 100 : null };
  }).filter((point) => Number.isFinite(point.value));
  const latest = observations.at(-1) || null;
  return {
    ...series,
    name: state.cpiMode === "yoy" ? "미국 소비자물가 전년동월비" : "미국 소비자물가 전월비",
    unit: "%",
    observations,
    latest,
    quality: { ...series.quality, firstDate: observations[0]?.date, lastDate: latest?.date, validRows: observations.length },
  };
}

function percentChange(current, previous) {
  return Number.isFinite(current) && Number.isFinite(previous) && previous !== 0 ? ((current / previous) - 1) * 100 : null;
}

function signed(value, digits = 2, suffix = "") {
  if (!Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}${suffix}`;
}

function renderCpiReference(series) {
  const panel = $("#cpi-release-panel");
  panel.hidden = series?.id !== "us-cpi";
  if (panel.hidden) return;
  const points = (series.observations || []).filter((point) => Number.isFinite(point.value));
  const byMonth = new Map(points.map((point) => [monthSerial(point.date), point.value]));
  const latest = points.at(-1);
  const latestSerial = latest ? monthSerial(latest.date) : null;
  const previous = byMonth.get(latestSerial - 1);
  const yearAgo = byMonth.get(latestSerial - 12);
  $("#cpi-release-summary").innerHTML = `<div><span>최근 CPI 지수</span><strong>${latest ? latest.value.toFixed(2) : "—"}</strong></div><div><span>전월 대비 지수 변화</span><strong>${signed(latest?.value - previous, 2)}</strong></div><div><span>전년동월비</span><strong>${signed(percentChange(latest?.value, yearAgo), 2, "%")}</strong></div><div><span>통계 기준월</span><strong>${latest?.date?.slice(0, 7) || "—"}</strong></div>`;
  const recent = points.slice(-10).reverse();
  $("#cpi-table").innerHTML = `<div class="cpi-row cpi-head"><span>기준월</span><span>CPI 지수</span><span>이전 기준월</span><span>전년동월비</span></div>${recent.map((point) => {
    const serial = monthSerial(point.date);
    return `<div class="cpi-row"><span>${escapeHtml(point.date.slice(0, 7))}</span><b>${point.value.toFixed(2)}</b><span>${Number.isFinite(byMonth.get(serial - 1)) ? byMonth.get(serial - 1).toFixed(2) : "—"}</span><span>${signed(percentChange(point.value, byMonth.get(serial - 12)), 2, "%")}</span></div>`;
  }).join("")}`;
}

function updateSource(name, status, label) {
  state.sourceStatus[name] = { status, label };
  const rows = [...document.querySelectorAll(".source-row")];
  const row = rows.find((item) => item.querySelector("b")?.textContent === name);
  if (row) {
    const target = row.querySelector("span");
    target.className = status === "ok" ? "ok" : "warn";
    target.textContent = label;
  }
  const successful = Object.values(state.sourceStatus).filter((item) => item.status === "ok").length;
  if (successful >= 3) {
    $("#source-pill").classList.add("ready");
    $("#source-pill").lastChild.textContent = ` 공식 데이터 ${successful}개 출처 연결`;
  }
}

function renderMetricCards() {
  const container = $("#macro-cards");
  const cards = SERIES_IDS.map((id) => {
    const series = state.series.get(id);
    if (!series) return `<div class="metric-card"><span class="metric-name">${escapeHtml(id)}</span><strong>연결 확인</strong><div class="metric-meta"><span>불러오지 못함</span></div></div>`;
    const delta = metricDelta(series);
    return `<button class="metric-card ${state.selected === id ? "active" : ""}" type="button" data-series="${id}" title="${escapeHtml(SERIES_INFO[id].description)}">
      <span class="metric-top"><span class="metric-name">${escapeHtml(series.name)}</span><span class="metric-source">${escapeHtml(series.source)}</span></span>
      <strong>${escapeHtml(metricValue(series))}</strong>
      <span class="metric-meta"><span>${displayDate(series.latest?.date)}</span><span class="metric-delta ${delta?.direction || ""}">${escapeHtml(shortDelta(series))}</span></span>
    </button>`;
  });
  container.innerHTML = cards.join("");
  container.querySelectorAll("[data-series]").forEach((button) => button.addEventListener("click", () => selectSeries(button.dataset.series)));
}

function renderIndustryCards() {
  const visible = industryDefinitions.filter((industry) => state.selectedIndustries.has(industry.name));
  $("#industry-grid").innerHTML = visible.map((industry) => `<article class="industry-card">
    <div class="industry-title"><h3>${industry.name}</h3><span class="industry-icon">${industry.icon}</span></div>
    <div class="driver-list">${industry.drivers.map(([name, source, link]) => {
      const series = state.series.get(link);
      const isConnected = Boolean(series);
      const stateClass = isConnected ? "" : state.industryFailed.has(link) ? "manual" : link === "manual" ? "manual" : link === "pending" ? "pending" : "loading";
      const stateText = isConnected ? metricValue(series) : state.industryFailed.has(link) ? "현재 응답 없음" : link === "manual" ? "원문 표준화 필요" : link === "pending" ? "출처 안내 확인" : "불러오는 중";
      const content = `<span><b>${escapeHtml(name)}</b><small>${escapeHtml(source)}${series?.latest?.date ? ` · ${escapeHtml(displayDate(series.latest.date))}` : ""}</small></span><span class="state ${stateClass}">${escapeHtml(stateText)}</span>`;
      return isConnected ? `<button class="driver driver-link" type="button" data-industry-name="${escapeHtml(industry.name)}" data-industry-series="${escapeHtml(link)}" title="${escapeHtml(name)} 상세 추이 보기">${content}</button>` : `<div class="driver">${content}</div>`;
    }).join("")}</div>
    <p class="industry-path">${industry.path}</p>
  </article>`).join("");
  $("#industry-grid").querySelectorAll("[data-industry-series]").forEach((button) => button.addEventListener("click", () => {
    const industry = industryDefinitions.find((item) => item.name === button.dataset.industryName);
    const driver = industry?.drivers.find((item) => item[2] === button.dataset.industrySeries);
    if (industry && driver) showIndustryMetric(industry, driver);
  }));
  if (state.industryDetail) {
    const active = $("#industry-grid").querySelector(`[data-industry-name="${CSS.escape(state.industryDetail.industry.name)}"][data-industry-series="${CSS.escape(state.industryDetail.driver[2])}"]`);
    active?.classList.add("active");
  }
}

async function loadIndustrySeries() {
  const ids = [...new Set(industryDefinitions.filter((industry) => state.selectedIndustries.has(industry.name)).flatMap((industry) => industry.drivers.map((driver) => driver[2])).filter((id) => !["pending", "manual"].includes(id) && !state.series.has(id)))];
  await Promise.allSettled(ids.map(async (id) => {
    try { state.series.set(id, await api(`/api/macro/series?id=${encodeURIComponent(id)}&beginDate=${daysAgo(550)}&endDate=${today()}`)); state.industryFailed.delete(id); }
    catch { state.industryFailed.add(id); }
  }));
  renderIndustryCards();
}

function renderIndustrySelector() {
  const selectedCount = state.selectedIndustries.size;
  $("#industry-count").textContent = `${selectedCount}/10`;
  $("#industry-selector-status").textContent = `${selectedCount}개 업종이 선택되었습니다.${selectedCount >= 10 ? " 최대 10개까지 선택할 수 있습니다." : ""}`;
  $("#industry-featured").classList.toggle("active", selectedCount === featuredIndustries.size && [...featuredIndustries].every((name) => state.selectedIndustries.has(name)));
  $("#industry-selector-options").innerHTML = industryDefinitions.map((industry) => `<button class="${state.selectedIndustries.has(industry.name) ? "selected" : ""}" type="button" data-industry-name="${escapeHtml(industry.name)}"><span>${industry.icon}</span>${escapeHtml(industry.name)}</button>`).join("");
  $("#industry-selector-options").querySelectorAll("[data-industry-name]").forEach((button) => button.addEventListener("click", () => {
    const name = button.dataset.industryName;
    if (state.selectedIndustries.has(name)) state.selectedIndustries.delete(name);
    else if (state.selectedIndustries.size < 10) state.selectedIndustries.add(name);
    else { $("#industry-selector-status").textContent = "최대 10개까지 선택할 수 있습니다. 기존 업종 하나를 해제해 주세요."; return; }
    renderIndustrySelector(); renderIndustryCards(); loadIndustrySeries();
  }));
}

function chartPoints(series) { return (series?.observations || []).filter((point) => Number.isFinite(point.value)); }
function canvasSize(canvas) { const ratio = Math.max(window.devicePixelRatio || 1, 1); const rect = canvas.getBoundingClientRect(); canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio); const context = canvas.getContext("2d"); context.setTransform(ratio, 0, 0, ratio, 0, 0); return { context, width: rect.width, height: rect.height }; }
function drawIndustryDetailChart(series, hoverIndex = null) {
  const canvas = $("#industry-detail-chart"), empty = $("#industry-detail-empty"), points = chartPoints(series).slice(-90);
  const { context: ctx, width, height } = canvasSize(canvas); ctx.clearRect(0, 0, width, height);
  if (points.length < 2) { empty.hidden = false; state.industryChart = null; return; }
  empty.hidden = true;
  const padding = { top: 22, right: 22, bottom: 34, left: 58 }, plotWidth = width - padding.left - padding.right, plotHeight = height - padding.top - padding.bottom;
  const values = points.map((point) => point.value); let min = Math.min(...values), max = Math.max(...values); const spread = max - min || Math.max(Math.abs(max) * .08, 1); min -= spread * .12; max += spread * .12;
  const x = (index) => padding.left + index / (points.length - 1) * plotWidth, y = (value) => padding.top + (1 - (value - min) / (max - min)) * plotHeight;
  ctx.font = "12px Noto Sans KR"; ctx.textBaseline = "middle";
  for (let step = 0; step <= 4; step += 1) { const yy = padding.top + plotHeight / 4 * step; ctx.strokeStyle = "#e5ebf3"; ctx.beginPath(); ctx.moveTo(padding.left, yy); ctx.lineTo(width - padding.right, yy); ctx.stroke(); ctx.fillStyle = "#7f8da1"; ctx.textAlign = "right"; ctx.fillText((max - (max - min) / 4 * step).toLocaleString("ko-KR", { maximumFractionDigits: 2 }), padding.left - 9, yy); }
  [0, Math.floor((points.length - 1) / 2), points.length - 1].forEach((index) => { ctx.fillStyle = "#7f8da1"; ctx.textAlign = index === 0 ? "left" : index === points.length - 1 ? "right" : "center"; ctx.fillText(String(points[index].date).slice(0, 10), x(index), height - 12); });
  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom); gradient.addColorStop(0, "rgba(40,120,240,.22)"); gradient.addColorStop(1, "rgba(40,120,240,0)");
  ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(x(index), y(point.value)) : ctx.moveTo(x(index), y(point.value))); ctx.lineTo(x(points.length - 1), height - padding.bottom); ctx.lineTo(x(0), height - padding.bottom); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
  ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(x(index), y(point.value)) : ctx.moveTo(x(index), y(point.value))); ctx.strokeStyle = "#2878f0"; ctx.lineWidth = 2.4; ctx.lineJoin = "round"; ctx.stroke();
  const last = points.at(-1); ctx.beginPath(); ctx.arc(x(points.length - 1), y(last.value), 5, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#2878f0"; ctx.lineWidth = 2.5; ctx.stroke();
  state.industryChart = { points, x, y, padding, width, height, series };
  if (Number.isInteger(hoverIndex)) {
    const index = Math.max(0, Math.min(points.length - 1, hoverIndex));
    const point = points[index], px = x(index), py = y(point.value);
    ctx.strokeStyle = "#91a4b9"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px, padding.top); ctx.lineTo(px, height - padding.bottom); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#2878f0"; ctx.lineWidth = 2.5; ctx.stroke();
  }
}
function paintIndustryHover(index) {
  if (!state.industryChart || !state.industryDetail) return;
  const series = state.industryChart.series;
  drawIndustryDetailChart(series, index);
  const chart = state.industryChart, point = chart.points[index], tooltip = $("#industry-detail-tooltip");
  const id = state.industryDetail.driver[2], px = chart.x(index), py = chart.y(point.value);
  tooltip.innerHTML = `<span>${escapeHtml(displayDate(point.date))}</span><strong>${escapeHtml(formatSeriesValue(series, point.value))}</strong><small>${escapeHtml(industryPointReading(id, point.value))}</small>`;
  tooltip.hidden = false;
  tooltip.style.left = `${Math.min(Math.max(px, 110), chart.width - 110)}px`;
  tooltip.style.top = `${Math.max(py, 88)}px`;
}
function showIndustryMetric(industry, driver, options = {}) {
  const [name, source, id] = driver, series = state.series.get(id); if (!series) return;
  state.industryDetail = { industry, driver };
  const panel = $("#industry-detail"), guide = industryMetricGuide(id, name, industry.name), description = SERIES_INFO[id]?.description || guide.meaning;
  $("#industry-detail-title").textContent = `${industry.name} · ${name}`; $("#industry-detail-description").textContent = description;
  $("#industry-detail-value").textContent = metricValue(series); $("#industry-detail-date").textContent = `${displayDate(series.latest?.date)} 기준`;
  $("#industry-detail-delta").textContent = shortDelta(series); $("#industry-detail-source").textContent = source; $("#industry-detail-path").textContent = industry.path;
  $("#industry-guide-meaning").textContent = guide.meaning; $("#industry-guide-up").textContent = guide.up;
  $("#industry-guide-down").textContent = guide.down; $("#industry-guide-caution").textContent = guide.caution;
  $("#industry-detail-tooltip").hidden = true;
  panel.hidden = false; renderIndustryCards(); requestAnimationFrame(() => drawIndustryDetailChart(series));
  if (options.scroll !== false) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function drawChart(series) {
  const canvas = $("#macro-chart");
  const points = chartPoints(series);
  const { context: ctx, width, height } = canvasSize(canvas);
  ctx.clearRect(0, 0, width, height);
  if (points.length < 2) {
    $("#chart-empty").hidden = false;
    $("#chart-empty").textContent = series?.quality?.snapshotOnly ? "현재 연결된 환율 자료에는 기준일의 값만 있어 그래프를 그릴 수 없습니다. 날짜별 자료가 연결되면 추이를 보여드릴게요." : "선택한 기간에 확인된 날짜별 값이 2개 미만이라 그래프를 그릴 수 없습니다. 기간을 늘리거나 다른 지표를 선택해 주세요.";
    state.chart = null;
    return;
  }
  $("#chart-empty").hidden = true;
  const padding = { top: 20, right: 22, bottom: 34, left: 58 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = points.map((point) => point.value);
  let min = Math.min(...values), max = Math.max(...values);
  const spread = max - min || Math.max(Math.abs(max) * .08, 1);
  min -= spread * .12; max += spread * .12;
  const x = (index) => padding.left + (index / (points.length - 1)) * plotWidth;
  const y = (value) => padding.top + (1 - (value - min) / (max - min)) * plotHeight;
  ctx.font = "10px Noto Sans KR"; ctx.textBaseline = "middle";
  for (let step = 0; step <= 4; step += 1) {
    const yy = padding.top + (plotHeight / 4) * step;
    ctx.strokeStyle = "#e4eaf2"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(padding.left, yy); ctx.lineTo(width - padding.right, yy); ctx.stroke();
    const label = max - ((max - min) / 4) * step;
    ctx.fillStyle = "#8a97aa"; ctx.textAlign = "right"; ctx.fillText(label.toLocaleString("ko-KR", { maximumFractionDigits: 2 }), padding.left - 10, yy);
  }
  const tickIndexes = [0, Math.floor((points.length - 1) / 3), Math.floor((points.length - 1) * 2 / 3), points.length - 1];
  tickIndexes.forEach((index) => { ctx.fillStyle = "#8a97aa"; ctx.textAlign = index === 0 ? "left" : index === points.length - 1 ? "right" : "center"; ctx.fillText(points[index].date.slice(0, 7), x(index), height - 12); });
  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom); gradient.addColorStop(0, "rgba(40,120,240,.22)"); gradient.addColorStop(1, "rgba(40,120,240,0)");
  ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(x(index), y(point.value)) : ctx.moveTo(x(index), y(point.value))); ctx.lineTo(x(points.length - 1), height - padding.bottom); ctx.lineTo(x(0), height - padding.bottom); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
  ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(x(index), y(point.value)) : ctx.moveTo(x(index), y(point.value))); ctx.strokeStyle = "#2878f0"; ctx.lineWidth = 2.2; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
  const lastX = x(points.length - 1), lastY = y(points.at(-1).value); ctx.beginPath(); ctx.arc(lastX, lastY, 5, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#2878f0"; ctx.lineWidth = 2.5; ctx.stroke();
  state.chart = { points, x, y, padding, width, height, series };
}

function paintHover(index) {
  const chart = state.chart; if (!chart) return;
  drawChart(chart.series);
  const current = state.chart; const point = current.points[index]; const canvas = $("#macro-chart"); const ctx = canvas.getContext("2d");
  const px = current.x(index), py = current.y(point.value);
  ctx.strokeStyle = "#9aabba"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px, current.padding.top); ctx.lineTo(px, current.height - current.padding.bottom); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#2878f0"; ctx.lineWidth = 2.5; ctx.stroke();
  const tooltip = $("#chart-tooltip"); tooltip.innerHTML = `${escapeHtml(point.date)}<strong>${point.value.toLocaleString("ko-KR", { maximumFractionDigits: 3 })} ${escapeHtml(current.series.unit)}</strong>`; tooltip.hidden = false; tooltip.style.left = `${Math.min(Math.max(px, 90), current.width - 90)}px`; tooltip.style.top = `${Math.max(py, 65)}px`;
}

function renderSelectedSeries() {
  const rawSeries = state.series.get(state.selected); if (!rawSeries) return;
  const series = cpiDisplaySeries(rawSeries);
  const isCpi = rawSeries.id === "us-cpi";
  $("#cpi-mode-control").hidden = !isCpi;
  $("#chart-source").textContent = `${rawSeries.source} · ${rawSeries.providerCode}`;
  $("#chart-title").textContent = `${series.name} 추이`;
  $("#chart-description").textContent = SERIES_INFO[rawSeries.id].description;
  $("#chart-period").textContent = series.quality.firstDate && series.quality.lastDate ? `표시 기간 ${series.quality.firstDate} ~ ${series.quality.lastDate}` : `기준일 ${series.latest?.date || "확인 불가"}`;
  $("#chart-quality").textContent = `그래프에 쓴 값 ${series.quality.validRows.toLocaleString("ko-KR")}개 · 값이 없는 날짜 ${rawSeries.quality.missingCount.toLocaleString("ko-KR")}개(계산에서 제외)`;
  $("#macro-csv").href = `/api/macro/export.csv?id=${encodeURIComponent(rawSeries.id)}&beginDate=${yearsAgo(state.years + (isCpi ? 1 : 0))}&endDate=${today()}`;
  renderCpiReference(rawSeries);
  drawChart(series);
}

async function selectSeries(id, forceFetch = false) {
  state.selected = id; renderMetricCards();
  const existing = state.series.get(id);
  if (forceFetch || !existing || existing.quality.firstDate > `${new Date().getFullYear() - state.years}-12-31`) {
    $("#chart-empty").hidden = false; $("#chart-empty").textContent = "선택한 기간의 날짜별 값을 불러오고 있어요.";
    try { state.series.set(id, await api(`/api/macro/series?id=${encodeURIComponent(id)}&beginDate=${yearsAgo(state.years + (id === "us-cpi" ? 1 : 0))}&endDate=${today()}`)); } catch (error) { $("#chart-empty").textContent = error.message; }
  }
  renderMetricCards(); renderIndustryCards(); renderSelectedSeries();
}

async function loadMacro() {
  const [seriesResults, exchangeResult] = await Promise.all([
    Promise.allSettled(SERIES_IDS.map((id) => api(`/api/macro/series?id=${id}&beginDate=${yearsAgo(id === "us-cpi" ? 6 : 5)}&endDate=${today()}`))),
    api("/api/macro/exchange").catch(() => null),
  ]);
  const results = seriesResults;
  results.forEach((result, index) => { if (result.status === "fulfilled") state.series.set(SERIES_IDS[index], result.value); });
  const hasEcos = [...state.series.values()].some((item) => item.source === "ECOS");
  const hasFred = [...state.series.values()].some((item) => item.source === "FRED");
  const hasExim = Boolean(exchangeResult?.items?.length);
  updateSource("ECOS", hasEcos ? "ok" : "warn", hasEcos ? "정상 · 최신 응답" : "응답 확인 필요");
  updateSource("FRED", hasFred ? "ok" : "warn", hasFred ? "정상 · 없는 값은 제외" : "응답 확인 필요");
  updateSource("EXIM", hasExim ? "ok" : "warn", hasExim ? "정상 · 고시환율" : "응답 확인 필요");
  renderMetricCards(); renderIndustryCards(); renderSelectedSeries();
  const series = [...state.series.values()].filter((item) => item.latest?.date);
  const latest = series.map((item) => item.latest.date).sort().at(-1);
  const collected = series.map((item) => item.collectedAt).filter(Boolean).sort().at(-1);
  $("#latest-basis").textContent = latest ? `${displayDate(latest)} 최근 발표값` : "원천 응답 확인 필요";
  $("#collected-at").textContent = displayTime(collected);
}

async function loadHealth() {
  try {
    const health = await api("/api/health"); state.health = health;
    updateSource("DART", health.dartConfigured ? "ok" : "warn", health.dartConfigured ? "연결 설정됨" : "키 미설정");
    updateSource("KRX", health.krxConfigured ? "ok" : "warn", health.krxConfigured ? "연결 설정됨" : "키 미설정");
  } catch { updateSource("DART", "warn", "서버 확인 필요"); updateSource("KRX", "warn", "서버 확인 필요"); }
}

async function loadLeaders() {
  try {
    const payload = await api("/api/discover?market=KOSPI&limit=20");
    const companies = (payload.companies || []).slice(0, 6);
    $("#leaders-basis").textContent = `${displayDate(payload.basisDate)} KRX 최근 확정 종가 기준`;
    $("#leaders-table").innerHTML = `<div class="leaders-head"><span>순위</span><span>종목</span><span>최근 종가</span><span>등락률</span><span>시가총액</span></div>${companies.map((company, index) => `<a class="leader-row" href="/company.html?corpCode=${encodeURIComponent(company.corpCode)}">
      <span class="rank">${String(index + 1).padStart(2, "0")}</span><span class="leader-name"><b>${escapeHtml(company.name)}</b><small>${escapeHtml(company.industry || "업종 미분류")} · ${company.stockCode}</small></span><span>${Number(company.price).toLocaleString("ko-KR")}원</span><span class="${company.changeRate > 0 ? "positive" : company.changeRate < 0 ? "negative" : ""}">${company.changeRate > 0 ? "+" : ""}${Number(company.changeRate).toFixed(2)}%</span><span>${money(company.marketCap)}</span>
    </a>`).join("")}`;
    updateSource("KRX", "ok", `정상 · ${displayDate(payload.basisDate)}`);
  } catch (error) {
    $("#leaders-table").innerHTML = `<div class="loading-wide">${escapeHtml(error.message)} KRX 원천 응답을 다시 확인해 주세요.</div>`;
    updateSource("KRX", "warn", "응답 확인 필요");
  }
}

document.querySelectorAll("[data-years]").forEach((button) => button.addEventListener("click", async () => {
  document.querySelectorAll("[data-years]").forEach((item) => item.classList.toggle("active", item === button));
  state.years = Number(button.dataset.years); await selectSeries(state.selected, true);
}));

document.querySelectorAll("[data-cpi-mode]").forEach((button) => button.addEventListener("click", () => {
  state.cpiMode = button.dataset.cpiMode;
  document.querySelectorAll("[data-cpi-mode]").forEach((item) => item.classList.toggle("active", item === button));
  renderSelectedSeries();
}));

$("#industry-featured").addEventListener("click", () => { state.selectedIndustries = new Set(featuredIndustries); renderIndustrySelector(); renderIndustryCards(); loadIndustrySeries(); });
$("#industry-custom").addEventListener("click", () => { const panel = $("#industry-selector-panel"); panel.hidden = !panel.hidden; $("#industry-custom").classList.toggle("active", !panel.hidden); });
$("#industry-reset").addEventListener("click", () => { state.selectedIndustries = new Set(featuredIndustries); renderIndustrySelector(); renderIndustryCards(); loadIndustrySeries(); });
$("#source-guide-button").addEventListener("click", (event) => {
  const panel = $("#source-guide-panel");
  panel.hidden = !panel.hidden;
  event.currentTarget.textContent = panel.hidden ? "연결 데이터 출처" : "출처 안내 닫기";
});
$("#industry-detail-close").addEventListener("click", () => {
  state.industryDetail = null;
  state.industryChart = null;
  $("#industry-detail-tooltip").hidden = true;
  $("#industry-detail").hidden = true;
  renderIndustryCards();
});

$("#industry-detail-chart").addEventListener("pointermove", (event) => {
  if (!state.industryChart) return;
  const rect = event.currentTarget.getBoundingClientRect(), localX = event.clientX - rect.left;
  const plotWidth = state.industryChart.width - state.industryChart.padding.left - state.industryChart.padding.right;
  const ratio = (localX - state.industryChart.padding.left) / plotWidth;
  const index = Math.max(0, Math.min(state.industryChart.points.length - 1, Math.round(ratio * (state.industryChart.points.length - 1))));
  paintIndustryHover(index);
});
$("#industry-detail-chart").addEventListener("pointerleave", () => {
  $("#industry-detail-tooltip").hidden = true;
  if (state.industryDetail) drawIndustryDetailChart(state.series.get(state.industryDetail.driver[2]));
});

$("#macro-chart").addEventListener("pointermove", (event) => {
  if (!state.chart) return;
  const rect = event.currentTarget.getBoundingClientRect(); const localX = event.clientX - rect.left;
  const ratio = (localX - state.chart.padding.left) / (state.chart.width - state.chart.padding.left - state.chart.padding.right);
  const index = Math.max(0, Math.min(state.chart.points.length - 1, Math.round(ratio * (state.chart.points.length - 1)))); paintHover(index);
});
$("#macro-chart").addEventListener("pointerleave", () => { $("#chart-tooltip").hidden = true; renderSelectedSeries(); });
$("#quality-detail").addEventListener("click", (event) => {
  const rule = document.querySelector(".quality-rule p"); const expanded = event.currentTarget.dataset.expanded === "true";
  rule.textContent = expanded ? "값이 없는 날짜는 원본에 그대로 남겨두고 계산에서 제외합니다. 차트에서만 연결해 그린 값은 분석 계산에 쓰지 않습니다." : "값이 없는 이유를 휴장, 미발표, 수집 오류로 나눠 기록합니다. 같은 날짜가 여러 번 오면 가장 최근 자료 하나를 쓰고 중복 횟수를 남깁니다. 유난히 큰 값도 자동으로 지우지 않고 확인 대상으로 표시합니다.";
  event.currentTarget.dataset.expanded = String(!expanded); event.currentTarget.textContent = expanded ? "품질 기준 자세히 보기" : "간단히 보기";
});
window.addEventListener("resize", () => {
  renderSelectedSeries();
  if (state.industryDetail) { $("#industry-detail-tooltip").hidden = true; drawIndustryDetailChart(state.series.get(state.industryDetail.driver[2])); }
});
renderIndustrySelector(); renderIndustryCards();
await Promise.all([loadHealth(), loadMacro(), loadLeaders()]);
await loadIndustrySeries();

const homeSideLinks = [...document.querySelectorAll(".side-nav a[href^='#']")];
const activateHomeSideLink = (link) => homeSideLinks.forEach((item) => item.classList.toggle("active", item === link));
homeSideLinks.forEach((link) => link.addEventListener("click", () => activateHomeSideLink(link)));
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const link = homeSideLinks.find((item) => item.getAttribute("href") === `#${visible.target.id}`);
    if (link) activateHomeSideLink(link);
  }, { rootMargin: "-18% 0px -68% 0px", threshold: [0, .1, .35] });
  homeSideLinks.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean).forEach((target) => observer.observe(target));
}
