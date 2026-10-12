const DAY_MS = 86_400_000;

export const MACRO_SERIES = [
  { id: "kr-base-rate", name: "한국 기준금리", category: "한국 금리", source: "ECOS", frequency: "D", unit: "%", transform: "point", transformLabel: "월말 전월차(%p)", providerCode: "722Y001", itemCodes: ["0101000"] },
  { id: "kr-3y", name: "한국 국고채 3년", category: "한국 금리", source: "ECOS", frequency: "D", unit: "%", transform: "point", transformLabel: "월말 전월차(%p)", providerCode: "817Y002", itemCodes: ["010200000"] },
  { id: "kr-corp-3y", name: "한국 회사채 3년 AA-", category: "한국 금리", source: "ECOS", frequency: "D", unit: "%", transform: "point", transformLabel: "월말 전월차(%p)", providerCode: "817Y002", itemCodes: ["010300000"] },
  { id: "usd-krw", name: "원/달러 환율", category: "환율·원자재", source: "ECOS", frequency: "D", unit: "원", transform: "percent", transformLabel: "월간 변화율(%)", providerCode: "731Y001", itemCodes: ["0000001"] },
  { id: "kr-cpi", name: "한국 소비자물가지수", category: "한국 물가·경기", source: "ECOS", frequency: "M", unit: "2020=100", transform: "yoy", transformLabel: "전년동월비(%)", providerCode: "901Y009", itemCodes: ["0"] },
  { id: "kr-ppi", name: "한국 생산자물가지수", category: "한국 물가·경기", source: "ECOS", frequency: "M", unit: "2020=100", transform: "yoy", transformLabel: "전년동월비(%)", providerCode: "404Y014", itemCodes: ["*AA"] },
  { id: "kr-import-price", name: "한국 수입물가지수(원화)", category: "한국 물가·경기", source: "ECOS", frequency: "M", unit: "2020=100", transform: "yoy", transformLabel: "전년동월비(%)", providerCode: "401Y015", itemCodes: ["*AA", "W"] },
  { id: "kr-export-price", name: "한국 수출물가지수(원화)", category: "한국 물가·경기", source: "ECOS", frequency: "M", unit: "2020=100", transform: "yoy", transformLabel: "전년동월비(%)", providerCode: "402Y014", itemCodes: ["*AA", "W"] },
  { id: "kr-export-volume", name: "한국 수출물량지수", category: "한국 물가·경기", source: "ECOS", frequency: "M", unit: "2020=100", transform: "yoy", transformLabel: "전년동월비(%)", providerCode: "403Y002", itemCodes: ["*AA"] },
  { id: "kr-industrial-production", name: "한국 전산업생산(계절조정)", category: "한국 물가·경기", source: "ECOS", frequency: "M", unit: "2020=100", transform: "yoy", transformLabel: "전년동월비(%)", providerCode: "901Y033", itemCodes: ["A00", "2"] },
  { id: "kr-esi", name: "한국 경제심리지수", category: "한국 물가·경기", source: "ECOS", frequency: "M", unit: "지수", transform: "point", transformLabel: "전월차(p)", providerCode: "513Y001", itemCodes: ["E1000"] },
  { id: "kr-ccsi", name: "한국 소비자심리지수", category: "한국 물가·경기", source: "ECOS", frequency: "M", unit: "지수", transform: "point", transformLabel: "전월차(p)", providerCode: "511Y002", itemCodes: ["FME"] },
  { id: "bsi-manufacturing", name: "제조업 업황 BSI", category: "한국 산업 BSI", source: "ECOS", frequency: "M", unit: "지수", transform: "point", transformLabel: "전월차(p)", providerCode: "512Y007", itemCodes: ["AA", "C0000"] },
  { id: "bsi-electronics", name: "전자·영상·통신 업황 BSI", category: "한국 산업 BSI", source: "ECOS", frequency: "M", unit: "지수", transform: "point", transformLabel: "전월차(p)", providerCode: "512Y007", itemCodes: ["AA", "C2600"] },
  { id: "bsi-auto", name: "자동차 업황 BSI", category: "한국 산업 BSI", source: "ECOS", frequency: "M", unit: "지수", transform: "point", transformLabel: "전월차(p)", providerCode: "512Y007", itemCodes: ["AA", "C3000"] },
  { id: "bsi-chemical", name: "화학 업황 BSI", category: "한국 산업 BSI", source: "ECOS", frequency: "M", unit: "지수", transform: "point", transformLabel: "전월차(p)", providerCode: "512Y007", itemCodes: ["AA", "C2000"] },
  { id: "us-policy-rate", name: "미국 기준금리 상단", category: "미국 금리·시장", source: "FRED", frequency: "D", unit: "%", transform: "point", transformLabel: "월말 전월차(%p)", providerCode: "DFEDTARU" },
  { id: "us-2y", name: "미국 국채 2년물", category: "미국 금리·시장", source: "FRED", frequency: "D", unit: "%", transform: "point", transformLabel: "월말 전월차(%p)", providerCode: "DGS2" },
  { id: "us-10y", name: "미국 국채 10년물", category: "미국 금리·시장", source: "FRED", frequency: "D", unit: "%", transform: "point", transformLabel: "월말 전월차(%p)", providerCode: "DGS10" },
  { id: "us-dollar-index", name: "미국 광의 달러지수", category: "미국 금리·시장", source: "FRED", frequency: "D", unit: "2006=100", transform: "percent", transformLabel: "월간 변화율(%)", providerCode: "DTWEXBGS" },
  { id: "vix", name: "VIX 변동성지수", category: "미국 금리·시장", source: "FRED", frequency: "D", unit: "지수", transform: "percent", transformLabel: "월간 변화율(%)", providerCode: "VIXCLS" },
  { id: "us-cpi", name: "미국 소비자물가지수", category: "미국 물가·경기", source: "FRED", frequency: "M", unit: "지수", transform: "yoy", transformLabel: "전년동월비(%)", providerCode: "CPIAUCNS" },
  { id: "us-ppi", name: "미국 생산자물가지수", category: "미국 물가·경기", source: "FRED", frequency: "M", unit: "1982=100", transform: "yoy", transformLabel: "전년동월비(%)", providerCode: "PPIACO" },
  { id: "us-unemployment", name: "미국 실업률", category: "미국 물가·경기", source: "FRED", frequency: "M", unit: "%", transform: "point", transformLabel: "전월차(%p)", providerCode: "UNRATE" },
  { id: "us-industrial-production", name: "미국 산업생산", category: "미국 물가·경기", source: "FRED", frequency: "M", unit: "2017=100", transform: "yoy", transformLabel: "전년동월비(%)", providerCode: "INDPRO" },
  { id: "us-nonfarm-payroll", name: "미국 비농업 고용", category: "미국 물가·경기", source: "FRED", frequency: "M", unit: "천명", transform: "yoy", transformLabel: "전년동월비(%)", providerCode: "PAYEMS" },
  { id: "wti", name: "WTI 국제유가", category: "환율·원자재", source: "FRED", frequency: "D", unit: "달러/배럴", transform: "percent", transformLabel: "월간 변화율(%)", providerCode: "DCOILWTICO" },
  { id: "brent", name: "브렌트 국제유가", category: "환율·원자재", source: "FRED", frequency: "D", unit: "달러/배럴", transform: "percent", transformLabel: "월간 변화율(%)", providerCode: "DCOILBRENTEU" },
  { id: "copper", name: "국제 구리 가격", category: "환율·원자재", source: "FRED", frequency: "M", unit: "달러/톤", transform: "percent", transformLabel: "월간 변화율(%)", providerCode: "PCOPPUSDM" },
  { id: "krx-tmi", name: "KRX 전체시장", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX TMI", valueField: "CLSPRC_IDX", industryTags: ["시장", "전체"] },
  { id: "krx-semiconductor", name: "KRX 반도체", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX 반도체", valueField: "CLSPRC_IDX", industryTags: ["반도체", "IT하드웨어"] },
  { id: "krx-auto", name: "KRX 자동차", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX 자동차", valueField: "CLSPRC_IDX", industryTags: ["자동차"] },
  { id: "krx-bank", name: "KRX 은행", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX 은행", valueField: "CLSPRC_IDX", industryTags: ["은행"] },
  { id: "krx-energy-chemical", name: "KRX 에너지화학", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX 에너지화학", valueField: "CLSPRC_IDX", industryTags: ["2차전지", "화학", "에너지"] },
  { id: "krx-steel", name: "KRX 철강", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX 철강", valueField: "CLSPRC_IDX", industryTags: ["철강", "소재"] },
  { id: "krx-construction", name: "KRX 건설", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX 건설", valueField: "CLSPRC_IDX", industryTags: ["건설"] },
  { id: "krx-insurance", name: "KRX 보험", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX 보험", valueField: "CLSPRC_IDX", industryTags: ["보험"] },
  { id: "krx-transport", name: "KRX 운송", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX 운송", valueField: "CLSPRC_IDX", industryTags: ["운송", "항공", "해운"] },
  { id: "krx-healthcare", name: "KRX 헬스케어", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX 헬스케어", valueField: "CLSPRC_IDX", industryTags: ["바이오", "제약"] },
  { id: "krx-utilities", name: "KRX 유틸리티", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX 유틸리티", valueField: "CLSPRC_IDX", industryTags: ["유틸리티", "전력", "가스"] },
  { id: "krx-it", name: "KRX 정보기술", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX 정보기술", valueField: "CLSPRC_IDX", industryTags: ["IT하드웨어", "소프트웨어"] },
  { id: "krx-discretionary", name: "KRX 경기소비재", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX 경기소비재", valueField: "CLSPRC_IDX", industryTags: ["유통", "화장품", "미디어"] },
  { id: "krx-staples", name: "KRX 필수소비재", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX 필수소비재", valueField: "CLSPRC_IDX", industryTags: ["음식료", "생활소비재"] },
  { id: "krx-securities", name: "KRX 증권", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX 증권", valueField: "CLSPRC_IDX", industryTags: ["증권"] },
  { id: "krx-broadcast", name: "KRX 방송통신", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX 방송통신", valueField: "CLSPRC_IDX", industryTags: ["통신", "미디어"] },
  { id: "krx-machinery", name: "KRX 기계장비", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX 기계장비", valueField: "CLSPRC_IDX", industryTags: ["기계"] },
  { id: "krx-industrials", name: "KRX 300 산업재", category: "KRX 업종지수", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "idx/krx_dd_trd", krxType: "index", itemName: "KRX 300 산업재", valueField: "CLSPRC_IDX", industryTags: ["조선", "기계", "운송", "산업재"] },
  { id: "krx-gasoline", name: "KRX 휘발유 유통가격", category: "KRX 산업·환경", source: "KRX", frequency: "M", rawFrequency: "D", unit: "원/리터", transform: "percent", transformLabel: "월말 변화율(%)", providerCode: "gen/oil_bydd_trd", krxType: "oil", itemName: "휘발유", valueField: "WT_DIS_AVG_PRC", industryTags: ["에너지", "운송", "화학"] },
  { id: "krx-diesel", name: "KRX 경유 유통가격", category: "KRX 산업·환경", source: "KRX", frequency: "M", rawFrequency: "D", unit: "원/리터", transform: "percent", transformLabel: "월말 변화율(%)", providerCode: "gen/oil_bydd_trd", krxType: "oil", itemName: "경유", valueField: "WT_DIS_AVG_PRC", industryTags: ["운송", "건설", "기계"] },
  { id: "krx-emission-kau", name: "KRX 배출권 KAU 최근물", category: "KRX 산업·환경", source: "KRX", frequency: "M", rawFrequency: "D", unit: "원/톤", transform: "percent", transformLabel: "월말 변화율(%)", providerCode: "gen/ets_bydd_trd", krxType: "emission", valueField: "TDD_CLSPRC", industryTags: ["철강", "화학", "유틸리티"] },
  { id: "krx-future-kospi200", name: "KOSPI 200 선물 최근월", category: "KRX 선행시장", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "drv/fut_bydd_trd", krxType: "future", itemName: "코스피200 선물", valueField: "TDD_CLSPRC", industryTags: ["시장", "선행"] },
  { id: "krx-future-usd", name: "미국달러 선물 최근월", category: "KRX 선행시장", source: "KRX", frequency: "M", rawFrequency: "D", unit: "원", transform: "percent", transformLabel: "월말 변화율(%)", providerCode: "drv/fut_bydd_trd", krxType: "future", itemName: "미국달러 선물", valueField: "TDD_CLSPRC", industryTags: ["환율", "선행"] },
  { id: "krx-future-3y", name: "3년 국채선물 최근월", category: "KRX 선행시장", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 변화율(%)", providerCode: "drv/fut_bydd_trd", krxType: "future", itemName: "3년국채 선물", valueField: "TDD_CLSPRC", industryTags: ["금리", "은행", "보험"] },
  { id: "krx-future-semiconductor", name: "KRX 반도체 선물 최근월", category: "KRX 선행시장", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "drv/fut_bydd_trd", krxType: "future", itemName: "KRX 반도체 선물", valueField: "TDD_CLSPRC", industryTags: ["반도체", "선행"] },
  { id: "krx-future-energy-chemical", name: "에너지화학 선물 최근월", category: "KRX 선행시장", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "drv/fut_bydd_trd", krxType: "future", itemName: "에너지화학 선물", valueField: "TDD_CLSPRC", industryTags: ["2차전지", "화학", "에너지", "선행"] },
  { id: "krx-esg-leaders", name: "KRX ESG Leaders 150", category: "KRX ESG", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "esg/esg_index_info", krxType: "index", itemName: "KRX ESG Leaders 150", valueField: "CLSPRC_IDX", industryTags: ["ESG"] },
  { id: "krx-climate", name: "KRX 300 기후변화지수", category: "KRX ESG", source: "KRX", frequency: "M", rawFrequency: "D", unit: "지수", transform: "percent", transformLabel: "월말 수익률(%)", providerCode: "esg/esg_index_info", krxType: "index", itemName: "KRX 300 기후변화지수", valueField: "CLSPRC_IDX", industryTags: ["ESG", "기후"] },
];

function valueOf(row, ...names) {
  for (const name of names) {
    if (row && row[name] !== undefined && row[name] !== null) return row[name];
  }
  return null;
}

function numeric(value) {
  if (value === null || value === undefined || value === "" || value === ".") return null;
  const parsed = Number(String(value).replaceAll(",", "").replaceAll("%", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function compactDate(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 8);
}

function isoDate(value) {
  const text = compactDate(value);
  if (text.length === 8) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  if (text.length === 6) return `${text.slice(0, 4)}-${text.slice(4, 6)}`;
  return String(value || "");
}

function kstDate(offsetDays = 0) {
  const date = new Date(Date.now() + (9 * 60 * 60 * 1000) + (offsetDays * DAY_MS));
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function yearsAgo(years) {
  const date = new Date(Date.now() + (9 * 60 * 60 * 1000));
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function moveCompactDate(value, offsetDays) {
  const text = compactDate(value);
  if (text.length !== 8) return "";
  const date = new Date(Date.UTC(Number(text.slice(0, 4)), Number(text.slice(4, 6)) - 1, Number(text.slice(6, 8)) + offsetDays));
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function monthlyTargets(beginDate, endDate, limit = 180) {
  const startText = (compactDate(beginDate) || yearsAgo(5)).padEnd(8, "01");
  const endText = (compactDate(endDate) || kstDate()).padEnd(8, "01");
  const start = new Date(Date.UTC(Number(startText.slice(0, 4)), Number(startText.slice(4, 6)) - 1, 1));
  const end = new Date(Date.UTC(Number(endText.slice(0, 4)), Number(endText.slice(4, 6)) - 1, Number(endText.slice(6, 8)) || 1));
  const targets = [];
  for (let cursor = new Date(start); cursor <= end && targets.length < limit; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const target = monthEnd > end ? end : monthEnd;
    targets.push(target.toISOString().slice(0, 10).replaceAll("-", ""));
  }
  return targets;
}

function quality(points, extra = {}) {
  const missingCount = points.filter((point) => !Number.isFinite(point.value)).length;
  return {
    status: missingCount ? "partial" : "normal",
    sourceRows: points.length,
    validRows: points.length - missingCount,
    missingCount,
    firstDate: points[0]?.date || null,
    lastDate: points.at(-1)?.date || null,
    ...extra,
  };
}

function normalizePoints(rows, mapper) {
  const byDate = new Map();
  let duplicateCount = 0;
  rows.forEach((row) => {
    const point = mapper(row);
    if (!point?.date) return;
    if (byDate.has(point.date)) duplicateCount += 1;
    byDate.set(point.date, point);
  });
  const points = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { points, duplicateCount };
}

function standardSeries(meta, points, collectedAt, extraQuality = {}) {
  const valid = points.filter((point) => Number.isFinite(point.value));
  return {
    id: meta.id,
    name: meta.name,
    source: meta.source,
    providerCode: meta.providerCode,
    frequency: meta.frequency,
    unit: meta.unit,
    category: meta.category,
    transform: meta.transform,
    transformLabel: meta.transformLabel,
    collectedAt,
    latest: valid.at(-1) || null,
    observations: points,
    quality: quality(points, extraQuality),
  };
}

export function correlationInterpretation(coefficient, beginDate, endDate) {
  const value = Number(coefficient);
  if (!Number.isFinite(value) || value < -1 || value > 1) throw new Error("상관계수는 -1 이상 1 이하이어야 합니다.");
  const absolute = Math.abs(value);
  const strength = absolute < 0.2 ? "매우 약합니다" : absolute < 0.5 ? "약합니다" : absolute < 0.7 ? "보통입니다" : absolute < 0.9 ? "강합니다" : "매우 강합니다";
  const period = beginDate && endDate ? `${isoDate(beginDate).slice(0, 7)}~${isoDate(endDate).slice(0, 7)}` : null;
  return {
    coefficient: value,
    strength,
    period,
    text: `관계는 ${strength} · 상관계수 ${value.toFixed(2)}`,
  };
}

export function macroSeriesCsv(series) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const header = ["날짜", "지표코드", "지표명", "값", "단위", "출처", "상태", "결측사유", "수집시각"];
  const rows = series.observations.map((point) => [
    point.date,
    series.id,
    series.name,
    Number.isFinite(point.value) ? point.value : "",
    series.unit,
    series.source,
    point.status || (Number.isFinite(point.value) ? "valid" : "missing"),
    point.missingReason || "",
    series.collectedAt,
  ]);
  return `\uFEFF${[header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n")}`;
}

export function createMacroService({ ecosKey, fredKey, eximKey, krxKey, fetchJson, cache }) {
  const collectedAt = () => new Date().toISOString();
  const inflight = new Map();
  const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  let krxQueue = Promise.resolve();
  let krxLastStartedAt = 0;
  const catalog = () => MACRO_SERIES.map(({ providerCode, itemCode, itemCodes, krxType, itemName, valueField, ...item }) => ({
    ...item,
    configured: item.source === "ECOS" ? Boolean(ecosKey) : item.source === "FRED" ? Boolean(fredKey) : item.source === "KRX" ? Boolean(krxKey) : Boolean(eximKey),
  }));

  async function ecosSeries(meta, beginDate, endDate) {
    if (!ecosKey) throw new Error("ECOS_API_KEY가 설정되지 않았습니다.");
    const periodLength = meta.frequency === "M" ? 6 : 8;
    const start = (compactDate(beginDate) || yearsAgo(5)).slice(0, periodLength);
    const end = (compactDate(endDate) || kstDate()).slice(0, periodLength);
    const cacheKey = `macro:ecos:${meta.id}:${start}:${end}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const pageSize = 1000;
    const rows = [];
    let cursor = 1;
    let totalCount = Infinity;
    while (cursor <= totalCount) {
      const finish = cursor + pageSize - 1;
      const itemPath = (meta.itemCodes || [meta.itemCode]).filter(Boolean).map((item) => encodeURIComponent(item)).join("/");
      const url = `https://ecos.bok.or.kr/api/StatisticSearch/${encodeURIComponent(ecosKey)}/json/kr/${cursor}/${finish}/${meta.providerCode}/${meta.frequency}/${start}/${end}/${itemPath}`;
      const payload = await fetchJson(url);
      const block = payload?.StatisticSearch;
      const pageRows = Array.isArray(block?.row) ? block.row : [];
      totalCount = Number(block?.list_total_count || pageRows.length || 0);
      rows.push(...pageRows);
      if (!pageRows.length || rows.length >= totalCount) break;
      cursor += pageSize;
    }
    const normalized = normalizePoints(rows, (row) => {
      const value = numeric(row.DATA_VALUE);
      return {
        date: isoDate(row.TIME),
        value,
        status: Number.isFinite(value) ? "valid" : "missing",
        missingReason: Number.isFinite(value) ? null : "not_published",
      };
    });
    const result = standardSeries(meta, normalized.points, collectedAt(), {
      requestedRows: totalCount,
      duplicateCount: normalized.duplicateCount,
      paginationComplete: Number.isFinite(totalCount) && rows.length >= totalCount,
    });
    cache.set(cacheKey, result, 60 * 60_000);
    return result;
  }

  async function fredSeries(meta, beginDate, endDate) {
    if (!fredKey) throw new Error("FRED_API_KEY가 설정되지 않았습니다.");
    const start = isoDate(compactDate(beginDate) || yearsAgo(5));
    const end = isoDate(compactDate(endDate) || kstDate());
    const cacheKey = `macro:fred:${meta.id}:${start}:${end}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const params = new URLSearchParams({
      series_id: meta.providerCode,
      api_key: fredKey,
      file_type: "json",
      observation_start: start,
      observation_end: end,
      limit: "100000",
      sort_order: "asc",
    });
    const payload = await fetchJson(`https://api.stlouisfed.org/fred/series/observations?${params}`);
    const rows = Array.isArray(payload?.observations) ? payload.observations : [];
    const normalized = normalizePoints(rows, (row) => {
      const value = numeric(row.value);
      return {
        date: row.date,
        value,
        status: Number.isFinite(value) ? "valid" : "missing",
        missingReason: Number.isFinite(value) ? null : "not_published",
      };
    });
    const result = standardSeries(meta, normalized.points, collectedAt(), {
      duplicateCount: normalized.duplicateCount,
      missingPolicy: "원본 결측 보존 · 분석 계산에서 제외",
    });
    cache.set(cacheKey, result, 60 * 60_000);
    return result;
  }

  async function krxRows(endpoint, basisDate) {
    if (!krxKey) throw new Error("KRX_AUTH_KEY가 설정되지 않았습니다.");
    const cacheKey = `macro:krx:${endpoint}:${basisDate}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    if (inflight.has(cacheKey)) return inflight.get(cacheKey);
    const requestTask = async () => {
      const gap = 220 - (Date.now() - krxLastStartedAt);
      if (gap > 0) await delay(gap);
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          krxLastStartedAt = Date.now();
          return await fetchJson(`https://data-dbg.krx.co.kr/svc/apis/${endpoint}?basDd=${basisDate}`, { headers: { AUTH_KEY: krxKey } });
        } catch (error) {
          lastError = error;
          const throttled = /\(403\)/.test(String(error?.message || ""));
          const unpublishedToday = basisDate >= kstDate();
          if (!throttled || unpublishedToday || attempt === 2) throw error;
          await delay((attempt + 1) * 900);
        }
      }
      throw lastError;
    };
    const scheduled = krxQueue.then(requestTask, requestTask);
    krxQueue = scheduled.catch(() => {});
    const request = scheduled
      .then((payload) => {
        const rows = Array.isArray(payload?.OutBlock_1) ? payload.OutBlock_1 : [];
        cache.set(cacheKey, rows, 24 * 60 * 60_000);
        return rows;
      })
      .finally(() => inflight.delete(cacheKey));
    inflight.set(cacheKey, request);
    return request;
  }

  async function krxRowsAtOrBefore(endpoint, targetDate) {
    let lastError = null;
    for (let offset = 0; offset >= -12; offset -= 1) {
      const basisDate = moveCompactDate(targetDate, offset);
      try {
        const rows = await krxRows(endpoint, basisDate);
        if (rows.length) return { basisDate, rows };
      } catch (error) {
        // KRX는 미공개 당일·휴장일에 빈 배열 대신 403을 주기도 한다.
        // 최대 12일 전까지 거래일을 찾되, 모두 실패하면 원래 오류를 전달한다.
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    return { basisDate: targetDate, rows: [] };
  }

  function krxRow(meta, rows, basisDate) {
    if (meta.krxType === "index") return rows.find((row) => row.IDX_NM === meta.itemName) || null;
    if (meta.krxType === "oil") return rows.find((row) => row.OIL_NM === meta.itemName) || null;
    if (meta.krxType === "emission") {
      const target = `KAU${basisDate.slice(2, 4)}`;
      const candidates = rows.filter((row) => /^KAU\d{2}$/.test(String(row.ISU_NM || "")) && Number.isFinite(numeric(row[meta.valueField])));
      return candidates.find((row) => row.ISU_NM === target)
        || candidates.sort((a, b) => Math.abs(Number(a.ISU_NM.slice(-2)) - Number(target.slice(-2))) - Math.abs(Number(b.ISU_NM.slice(-2)) - Number(target.slice(-2))) || numeric(b.ACC_TRDVOL) - numeric(a.ACC_TRDVOL))[0]
        || null;
    }
    if (meta.krxType === "future") {
      const currentMonth = Number(basisDate.slice(0, 6));
      const candidates = rows.filter((row) => row.PROD_NM === meta.itemName && row.MKT_NM === "정규" && Number.isFinite(numeric(row[meta.valueField])))
        .map((row) => ({ row, expiry: Number(String(row.ISU_NM || "").match(/20\d{4}/)?.[0] || 999999) }))
        .filter((item) => item.expiry >= currentMonth)
        .sort((a, b) => a.expiry - b.expiry || (numeric(b.row.ACC_TRDVOL) || 0) - (numeric(a.row.ACC_TRDVOL) || 0));
      return candidates[0]?.row || null;
    }
    return null;
  }

  async function krxSeries(meta, beginDate, endDate) {
    const targets = monthlyTargets(beginDate, endDate);
    const points = [];
    const errors = [];
    for (let index = 0; index < targets.length; index += 2) {
      const batch = await Promise.all(targets.slice(index, index + 2).map(async (targetDate) => {
        try {
          const { basisDate, rows } = await krxRowsAtOrBefore(meta.providerCode, targetDate);
          const row = krxRow(meta, rows, basisDate);
          const value = numeric(row?.[meta.valueField]);
          return {
            date: row?.BAS_DD ? isoDate(row.BAS_DD) : isoDate(targetDate),
            value,
            status: Number.isFinite(value) ? "valid" : "missing",
            missingReason: Number.isFinite(value) ? null : "not_traded_or_unavailable",
            instrument: row?.IDX_NM || row?.OIL_NM || row?.ISU_NM || null,
          };
        } catch (error) {
          errors.push({ targetDate, message: error.message });
          return { date: isoDate(targetDate), value: null, status: "missing", missingReason: "provider_temporarily_unavailable" };
        }
      }));
      points.push(...batch);
    }
    const normalized = normalizePoints(points, (point) => point);
    const result = standardSeries(meta, normalized.points, collectedAt(), {
      requestedMonths: targets.length,
      duplicateCount: normalized.duplicateCount,
      samplingMethod: "각 월의 마지막 KRX 거래일 종가",
      rawFrequency: meta.rawFrequency || "D",
      apiEndpoint: meta.providerCode,
      providerErrorCount: errors.length,
      providerErrors: errors.slice(0, 5),
    });
    if (!result.observations.some((point) => Number.isFinite(point.value))) throw new Error(errors[0]?.message || "KRX 관측값을 불러오지 못했습니다.");
    return result;
  }

  async function eximRequest(path, dataCode, requestedDate = "") {
    if (!eximKey) throw new Error("KOREA_EXIM_API_KEY가 설정되지 않았습니다.");
    const requested = compactDate(requestedDate);
    for (let offset = 0; offset >= -14; offset -= 1) {
      const searchDate = requested || kstDate(offset);
      const cacheKey = `macro:exim:${path}:${searchDate}`;
      if (cache.has(cacheKey)) return cache.get(cacheKey);
      const params = new URLSearchParams({ authkey: eximKey, searchdate: searchDate, data: dataCode });
      const payload = await fetchJson(`https://oapi.koreaexim.go.kr/site/program/financial/${path}?${params}`);
      const rows = Array.isArray(payload) ? payload : (payload && typeof payload === "object" ? [payload] : []);
      const resultCode = Number(valueOf(rows[0], "RESULT", "result"));
      if (resultCode === 1 && rows.length) {
        const result = { searchDate, rows };
        cache.set(cacheKey, result, 60 * 60_000);
        return result;
      }
      if (requested) break;
    }
    throw new Error("한국수출입은행에서 최근 발표 데이터를 찾지 못했습니다.");
  }

  async function exchangeSnapshot(requestedDate = "") {
    const { searchDate, rows } = await eximRequest("exchangeJSON", "AP01", requestedDate);
    return {
      source: "EXIM",
      basisDate: isoDate(searchDate),
      collectedAt: collectedAt(),
      items: rows.map((row) => ({
        currency: valueOf(row, "CUR_UNIT", "cur_unit"),
        name: valueOf(row, "CUR_NM", "cur_nm"),
        baseRate: numeric(valueOf(row, "DEAL_BAS_R", "deal_bas_r")),
        telegraphicBuy: numeric(valueOf(row, "TTB", "ttb")),
        telegraphicSell: numeric(valueOf(row, "TTS", "tts")),
        bookRate: numeric(valueOf(row, "BKPR", "bkpr")),
      })).filter((item) => item.currency),
    };
  }

  async function loanRates(requestedDate = "") {
    const { searchDate, rows } = await eximRequest("interestJSON", "AP02", requestedDate);
    return {
      source: "EXIM",
      basisDate: isoDate(searchDate),
      collectedAt: collectedAt(),
      items: rows.map((row) => ({
        name: valueOf(row, "SFLN_INTRC_NM", "sfln_intrc_nm"),
        rate: numeric(valueOf(row, "INT_R", "int_r")),
      })).filter((item) => item.name),
    };
  }

  async function internationalRates(requestedDate = "") {
    const { searchDate, rows } = await eximRequest("internationalJSON", "AP03", requestedDate);
    const wrapper = rows[0] || {};
    const groups = [
      ["SOFR", "sofr_list"], ["ESTR", "estr_list"], ["EURIBOR", "euribor_list"], ["TONA", "tona_list"],
      ["TIBOR", "tibor_list"], ["SWAP_RFR", "swapRfr_list"], ["SWAP", "swap_list"],
      ["LIBOR", "libor_list"], ["CIRR", "cirr_list"], ["NEW_CIRR", "new_cirr_list"],
    ];
    const items = groups.flatMap(([group, key]) => {
      const list = valueOf(wrapper, key, key.toUpperCase());
      return (Array.isArray(list) ? list : []).map((row, index) => {
        const name = valueOf(row, "SFLN_INTRC_NM", "sfln_intrc_nm");
        const rate = numeric(valueOf(row, "INT_R", "int_r"));
        return {
          group,
          currency: valueOf(row, "CUR_FUND", "cur_fund"),
          name,
          rate,
          usable: Boolean(name) && Number.isFinite(rate),
          qualityFlag: !name ? "missing_maturity_label" : Number.isFinite(rate) ? "valid" : "missing_value",
          sourceOrder: index + 1,
        };
      });
    });
    return {
      source: "EXIM",
      basisDate: isoDate(searchDate),
      collectedAt: collectedAt(),
      items,
      quality: {
        status: items.some((item) => !item.usable) ? "partial" : "normal",
        totalRows: items.length,
        usableRows: items.filter((item) => item.usable).length,
        warning: items.some((item) => item.qualityFlag === "missing_maturity_label")
          ? "만기명이 없는 CIRR 항목은 임의 명칭을 붙이지 않고 분석에서 제외합니다."
          : null,
      },
    };
  }

  async function getSeries(id, beginDate = "", endDate = "") {
    const meta = MACRO_SERIES.find((item) => item.id === id);
    if (!meta) throw new Error("지원하지 않는 매크로 지표입니다.");
    if (meta.source === "ECOS") return ecosSeries(meta, beginDate, endDate);
    if (meta.source === "FRED") return fredSeries(meta, beginDate, endDate);
    if (meta.source === "KRX") return krxSeries(meta, beginDate, endDate);
    const exchange = await exchangeSnapshot(endDate);
    const usd = exchange.items.find((item) => String(item.currency).toUpperCase().startsWith("USD"));
    const point = usd ? [{ date: exchange.basisDate, value: usd.baseRate, status: Number.isFinite(usd.baseRate) ? "valid" : "missing", missingReason: Number.isFinite(usd.baseRate) ? null : "not_published" }] : [];
    return standardSeries(meta, point, exchange.collectedAt, { snapshotOnly: true });
  }

  async function snapshot(requestedDate = "") {
    const beginDate = yearsAgo(1);
    const [baseRate, us10y, wti] = await Promise.all([
      getSeries("kr-base-rate", beginDate, requestedDate),
      getSeries("us-10y", beginDate, requestedDate),
      getSeries("wti", beginDate, requestedDate),
    ]);
    // EXIM은 같은 인증키의 동시 요청에서 간헐적으로 500을 반환하므로 순차 호출한다.
    const exchange = await exchangeSnapshot(requestedDate);
    const loans = await loanRates(requestedDate);
    const international = await internationalRates(requestedDate);
    return {
      generatedAt: collectedAt(),
      series: [baseRate, us10y, wti],
      exchange,
      loans,
      international,
    };
  }

  return { catalog, getSeries, snapshot, exchangeSnapshot, loanRates, internationalRates };
}
