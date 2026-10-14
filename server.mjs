import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMacroService, correlationInterpretation, macroSeriesCsv } from "./macro-data.mjs";
import { handleAiGuide, spendAccess, aiGuideStatus } from "./ai-guide-api.mjs";
import { buildTrendEvidence, runCompanyAgent } from "./company-agent.mjs";
import { filingSource, latestFiledInterim } from "./financial-update.mjs";
import { stockDisplayName } from "./public/stock-identity.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(HERE, "public");
const env = { ...process.env };

for (const envPath of [
  path.join(HERE, ".env"),
  path.join(HERE, "..", "stock", ".env"),
  path.join(HERE, "..", "..", "stock", ".env"),
]) {
  if (!existsSync(envPath)) continue;
  const body = await readFile(envPath, "utf8");
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || env[match[1]]) continue;
    env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

const COMPANY_DATA_PATH = env.COMPANY_DATA_PATH
  ? path.resolve(HERE, env.COMPANY_DATA_PATH)
  : path.join(HERE, "data", "companies.json");
const CORP_CODE_PATH = [
  path.join(HERE, "..", "stock", ".cache", "corp_codes.xml"),
  path.join(HERE, "..", "..", "stock", ".cache", "corp_codes.xml"),
].find(existsSync) || path.join(HERE, "..", "stock", ".cache", "corp_codes.xml");

const PORT = Number(env.PORT || 4173);
const HOST = env.HOST || "0.0.0.0";
const DART_KEY = env.OPEN_DART_API_KEY || env.DART_API_KEY || "";
const DATA_KEY = env.DATA_GO_KR_SERVICE_KEY || env.SERVICE_KEY || "";
const KRX_KEY = env.KRX_AUTH_KEY || "";
const ECOS_KEY = env.ECOS_API_KEY || "";
const EXIM_KEY = env.KOREA_EXIM_API_KEY || "";
const FRED_KEY = env.FRED_API_KEY || "";
const CACHE_TTL_MS = Math.max(Number(env.CACHE_TTL_MINUTES || 360), 1) * 60_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Math.max(Number(env.RATE_LIMIT_PER_MINUTE || 60), 10);

class ExpiringCache extends Map {
  set(key, value, ttl = CACHE_TTL_MS) {
    return super.set(key, { value, expiresAt: Date.now() + ttl });
  }
  get(key) {
    const entry = super.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      super.delete(key);
      return undefined;
    }
    return entry.value;
  }
  has(key) { return this.get(key) !== undefined; }
}

const cache = new ExpiringCache();
const requestCounts = new Map();
let companies = [];

function xmlValue(block, tag) {
  return block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() || "";
}

function latestListedCompanies(items) {
  const byName = new Map();
  for (const item of items.filter((entry) => /^\d{6}$/.test(entry.stockCode || ""))) {
    const current = byName.get(item.name);
    if (!current || String(item.modifiedAt || "") > String(current.modifiedAt || "")) byName.set(item.name, item);
  }
  return [...byName.values()];
}

async function loadCompanies() {
  if (companies.length) return companies;
  if (existsSync(COMPANY_DATA_PATH)) {
    companies = latestListedCompanies(JSON.parse(await readFile(COMPANY_DATA_PATH, "utf8")));
    return companies;
  }
  if (!existsSync(CORP_CODE_PATH)) throw new Error("DART 기업코드 캐시가 없습니다.");
  const xml = await readFile(CORP_CODE_PATH, "utf8");
  companies = latestListedCompanies([...xml.matchAll(/<list>([\s\S]*?)<\/list>/g)]
    .map((match) => ({
      corpCode: xmlValue(match[1], "corp_code"),
      name: xmlValue(match[1], "corp_name"),
      stockCode: xmlValue(match[1], "stock_code"),
      modifiedAt: xmlValue(match[1], "modify_date"),
    })));
  return companies;
}

function json(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...securityHeaders() });
  res.end(JSON.stringify(value));
}

function csv(res, filename, body) {
  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename.replace(/[^A-Za-z0-9_.-]/g, "_")}"`,
    "Cache-Control": "no-store",
    ...securityHeaders(),
  });
  res.end(body);
}

function securityHeaders() {
  return {
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}

function withinRateLimit(req, res) {
  const now = Date.now();
  const key = clientIp(req);
  const current = requestCounts.get(key);
  const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS } : current;
  entry.count += 1;
  requestCounts.set(key, entry);
  res.setHeader("X-RateLimit-Limit", String(RATE_LIMIT_MAX));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(RATE_LIMIT_MAX - entry.count, 0)));
  if (entry.count <= RATE_LIMIT_MAX) return true;
  res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
  json(res, 429, { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." });
  return false;
}

function number(value) {
  const cleaned = String(value ?? "").replaceAll(",", "").trim();
  if (!cleaned || cleaned === "-") return null;
  const wrapped = cleaned.startsWith("(") && cleaned.endsWith(")");
  const parsed = Number(wrapped ? `-${cleaned.slice(1, -1)}` : cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function ratio(a, b, multiplier = 100) {
  return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? (a / b) * multiplier : null;
}

function selectAccount(rows, ids, names, statements = null, amountField = "thstrm_amount") {
  const candidates = statements ? rows.filter((row) => statements.includes(row.sj_div)) : rows;
  const amount = (row) => {
    const preferred = row?.[amountField];
    const fallback = amountField.startsWith("thstrm") ? row?.thstrm_amount : null;
    return number(String(preferred ?? "").trim() ? preferred : fallback);
  };
  for (const id of ids) {
    for (const row of candidates) {
      if (row.account_id !== id) continue;
      const value = amount(row);
      if (value !== null) return value;
    }
  }
  for (const name of names) {
    const normalized = name.replaceAll(" ", "");
    for (const row of candidates) {
      if (String(row.account_nm || "").replaceAll(" ", "") !== normalized) continue;
      const value = amount(row);
      if (value !== null) return value;
    }
  }
  return null;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(25000), ...options });
  if (!response.ok) throw new Error(`외부 API 오류 (${response.status})`);
  return response.json();
}

const macroService = createMacroService({
  ecosKey: ECOS_KEY,
  eximKey: EXIM_KEY,
  fredKey: FRED_KEY,
  krxKey: KRX_KEY,
  fetchJson,
  cache,
});

async function dartStatement(corpCode, year, reportCode = "11011") {
  const key = `dart:${corpCode}:${year}:${reportCode}`;
  if (cache.has(key)) return cache.get(key);
  if (!DART_KEY) throw new Error("OPEN_DART_API_KEY가 설정되지 않았습니다.");
  const params = new URLSearchParams({
    crtfc_key: DART_KEY,
    corp_code: corpCode,
    bsns_year: String(year),
    reprt_code: reportCode,
    fs_div: "CFS",
  });
  let payload = await fetchJson(`https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?${params}`);
  if (payload.status === "013") {
    params.set("fs_div", "OFS");
    payload = await fetchJson(`https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?${params}`);
  }
  let rows = Array.isArray(payload.list) ? payload.list : [];
  if (payload.status === "013") {
    const fallbackParams = new URLSearchParams({
      crtfc_key: DART_KEY,
      corp_code: corpCode,
      bsns_year: String(year),
      reprt_code: reportCode,
    });
    const fallback = await fetchJson(`https://opendart.fss.or.kr/api/fnlttSinglAcnt.json?${fallbackParams}`);
    if (fallback.status === "000") {
      const fallbackRows = Array.isArray(fallback.list) ? fallback.list : [];
      const hasConsolidated = fallbackRows.some((row) => row.fs_div === "CFS");
      rows = fallbackRows.filter((row) => row.fs_div === (hasConsolidated ? "CFS" : "OFS"));
      payload = fallback;
    }
  }
  if (payload.status !== "000") {
    const error = new Error(`DART ${year}: ${payload.message || payload.status}`);
    error.code = payload.status;
    throw error;
  }
  const statementBasis = rows.find((row) => ["CFS", "OFS"].includes(row.fs_div))?.fs_div || params.get("fs_div") || null;
  rows = rows.map((row) => ({ ...row, __statementBasis: statementBasis }));
  cache.set(key, rows);
  return rows;
}

function summarize(rows, year, reportCode = "11011", comparisonField = null, sourceReportYear = year) {
  const income = ["IS", "CIS"];
  const statementField = comparisonField || "thstrm_amount";
  const flowField = comparisonField || (reportCode === "11011" ? "thstrm_amount" : "thstrm_add_amount");
  const disclosedRevenue = selectAccount(rows,
    ["ifrs-full_Revenue", "ifrs_Revenue", "dart_OperatingRevenue"],
    ["매출액", "수익(매출액)", "영업수익"], income, flowField);
  const operatingProfit = selectAccount(rows,
    ["dart_OperatingIncomeLoss", "ifrs-full_ProfitLossFromOperatingActivities"],
    ["영업이익", "영업이익(손실)", "영업손익"], income, flowField);
  const interestRevenue = selectAccount(rows,
    ["ifrs-full_RevenueFromInterest"], ["이자수익"], income, flowField);
  const feeIncome = selectAccount(rows,
    ["ifrs-full_FeeAndCommissionIncome"], ["수수료수익"], income, flowField);
  const insuranceRevenue = selectAccount(rows,
    ["ifrs-full_InsuranceRevenue", "dart_OperatingIncomeInsurance"], ["보험수익"], income, flowField);
  const financialRevenueParts = [interestRevenue, feeIncome, insuranceRevenue].filter(Number.isFinite);
  const revenue = Number.isFinite(disclosedRevenue)
    ? disclosedRevenue
    : (financialRevenueParts.length >= 2 ? financialRevenueParts.reduce((sum, value) => sum + value, 0) : null);
  const revenueSource = Number.isFinite(disclosedRevenue) ? "공시 매출·영업수익" : (Number.isFinite(revenue) ? "이자·수수료·보험수익 합산" : null);
  const netIncome = selectAccount(rows,
    ["ifrs-full_ProfitLoss", "ifrs_ProfitLoss"],
    ["당기순이익", "당기순이익(손실)", "연결당기순이익"], income, flowField);
  const interestExpense = selectAccount(rows,
    ["ifrs-full_FinanceCosts", "ifrs-full_InterestExpense", "ifrs_InterestExpense", "dart_InterestExpenseFinanceExpense"],
    ["금융비용", "이자비용", "이자비용(금융원가)", "이자비용및할인료"], income, flowField);
  const assets = selectAccount(rows, ["ifrs-full_Assets", "ifrs_Assets"], ["자산총계"], null, statementField);
  const liabilities = selectAccount(rows, ["ifrs-full_Liabilities", "ifrs_Liabilities"], ["부채총계"], null, statementField);
  const equity = selectAccount(rows, ["ifrs-full_Equity", "ifrs_Equity"], ["자본총계"], null, statementField);
  const operatingCashFlow = selectAccount(rows,
    ["ifrs-full_CashFlowsFromUsedInOperatingActivities", "ifrs_CashFlowsFromUsedInOperatingActivities"],
    ["영업활동현금흐름", "영업활동으로 인한 현금흐름"], ["CF"], flowField);
  const capex = selectAccount(rows,
    ["ifrs-full_PurchaseOfPropertyPlantAndEquipment", "ifrs-full_PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"],
    ["유형자산의 취득", "유형자산 취득"], ["CF"], flowField);
  const fcf = Number.isFinite(operatingCashFlow)
    ? operatingCashFlow - Math.abs(Number.isFinite(capex) ? capex : 0)
    : null;
  const statementBasis = rows.find((row) => ["CFS", "OFS"].includes(row.fs_div))?.fs_div
    || rows.find((row) => ["CFS", "OFS"].includes(row.__statementBasis))?.__statementBasis || null;
  return {
    year, reportCode, statementBasis, revenue, revenueSource, operatingProfit, netIncome, interestExpense, interestRevenue, feeIncome, insuranceRevenue, assets, liabilities, equity,
    dataSource: comparisonField ? `${sourceReportYear}년 사업보고서 비교표(${comparisonField === "frmtrm_amount" ? "전기" : "전전기"})` : `${year}년 ${reportCode === "11011" ? "사업보고서" : "정기보고서"} 직접 조회`,
    operatingCashFlow, capex, fcf,
    operatingMargin: ratio(operatingProfit, revenue),
    netMargin: ratio(netIncome, revenue),
    debtRatio: ratio(liabilities, equity),
    interestCoverage: Number.isFinite(operatingProfit) && Number.isFinite(interestExpense) && interestExpense !== 0
      ? operatingProfit / Math.abs(interestExpense) : null,
    roe: ratio(netIncome, equity),
    fcfMargin: ratio(fcf, revenue),
  };
}

async function marketHistory(stockCode, beginDate = "", endDate = "") {
  const key = `market:${stockCode}:${beginDate}:${endDate}`;
  if (cache.has(key)) return cache.get(key);
  if (!DATA_KEY) return [];
  const end = endDate ? new Date(`${endDate.slice(0,4)}-${endDate.slice(4,6)}-${endDate.slice(6,8)}T00:00:00Z`) : new Date();
  const start = beginDate ? new Date(`${beginDate.slice(0,4)}-${beginDate.slice(4,6)}-${beginDate.slice(6,8)}T00:00:00Z`) : new Date(end);
  if (!beginDate) start.setDate(start.getDate() - 430);
  const dateText = (date) => date.toISOString().slice(0, 10).replaceAll("-", "");
  const params = new URLSearchParams({
    serviceKey: decodeURIComponent(DATA_KEY), resultType: "json", numOfRows: "3000", pageNo: "1",
    likeSrtnCd: stockCode, beginBasDt: dateText(start), endBasDt: dateText(end),
  });
  const payload = await fetchJson(`https://apis.data.go.kr/1160100/GetStockSecuritiesInfoService_V2/getStockPriceInfo_V2?${params}`);
  const header = payload?.response?.header;
  if (String(header?.resultCode) !== "00") throw new Error(`금융위원회 API: ${header?.resultMsg || "조회 실패"}`);
  let rows = payload?.response?.body?.items?.item || [];
  if (!Array.isArray(rows)) rows = [rows];
  rows = rows
    .filter((row) => String(row.srtnCd || "").replace(/\D/g, "").slice(-6) === stockCode)
    .map((row) => ({ ...row, dataSource: "FSC_STOCK_PRICE", sourceOfficial: true }))
    .sort((a, b) => String(a.basDt).localeCompare(String(b.basDt)));
  // 금융위원회 일별 시세는 영업일 다음 날 13시 이후 갱신된다. 장시간 캐시로 새 기준일을 가리지 않는다.
  cache.set(key, rows, 30 * 60_000);
  return rows;
}

async function etfHistory(stockCode, beginDate = "", endDate = "") {
  const key = `etf-history:${stockCode}:${beginDate}:${endDate}`;
  if (cache.has(key)) return cache.get(key);
  if (!DATA_KEY) return [];
  const end = endDate ? new Date(`${endDate.slice(0,4)}-${endDate.slice(4,6)}-${endDate.slice(6,8)}T00:00:00Z`) : new Date();
  const start = beginDate ? new Date(`${beginDate.slice(0,4)}-${beginDate.slice(4,6)}-${beginDate.slice(6,8)}T00:00:00Z`) : new Date(end);
  if (!beginDate) start.setDate(start.getDate() - 430);
  const dateText = (date) => date.toISOString().slice(0, 10).replaceAll("-", "");
  const params = new URLSearchParams({
    serviceKey: decodeURIComponent(DATA_KEY), resultType: "json", numOfRows: "3000", pageNo: "1",
    likeSrtnCd: stockCode, beginBasDt: dateText(start), endBasDt: dateText(end),
  });
  let rows = [];
  try {
    const payload = await fetchJson(`https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService/getETFPriceInfo?${params}`);
    const header = payload?.response?.header;
    if (String(header?.resultCode) !== "00") throw new Error(header?.resultMsg || "조회 실패");
    rows = payload?.response?.body?.items?.item || [];
    if (!Array.isArray(rows)) rows = [rows];
    rows = rows.filter((row) => String(row.srtnCd || "").replace(/\D/g, "").slice(-6) === stockCode)
      .map((row) => ({ ...row, dataSource: "FSC_ETF_PRICE", sourceOfficial: true }))
      .sort((a, b) => String(a.basDt).localeCompare(String(b.basDt)));
  } catch (officialError) {
    // 금융위원회 ETF 서비스가 별도 미승인(403)인 경우 공개 네이버 일봉을 읽기 전용 보조 경로로 사용한다.
    const response = await fetch(`https://fchart.stock.naver.com/sise.nhn?symbol=${stockCode}&timeframe=day&count=2000&requestType=0`, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error(`ETF 기간시세 조회 실패 (${response.status})`);
    const xml = await response.text();
    rows = [...xml.matchAll(/<item\s+data="(\d{8})\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^\"]*)"\s*\/>/g)].map((match) => ({
      basDt: match[1], clpr: match[5], trqu: match[6], dataSource: "NAVER_PUBLIC_CHART", sourceOfficial: false,
      qualityFlag: "unofficial_fallback", sourceWarning: `금융위원회 ETF 기간시세 사용 불가: ${officialError.message}`,
    }))
      .filter((row) => (!beginDate || row.basDt >= beginDate) && (!endDate || row.basDt <= endDate));
  }
  cache.set(key, rows, 30 * 60_000);
  return rows;
}

async function indexHistory(indexName = "코스피 200", beginDate = "", endDate = "") {
  const key = `index:${indexName}:${beginDate}:${endDate}`;
  if (cache.has(key)) return cache.get(key);
  if (!DATA_KEY) throw new Error("DATA_GO_KR_SERVICE_KEY가 설정되지 않았습니다.");
  const end = endDate ? new Date(`${endDate.slice(0,4)}-${endDate.slice(4,6)}-${endDate.slice(6,8)}T00:00:00Z`) : new Date();
  const start = beginDate ? new Date(`${beginDate.slice(0,4)}-${beginDate.slice(4,6)}-${beginDate.slice(6,8)}T00:00:00Z`) : new Date(end);
  if (!beginDate) start.setDate(start.getDate() - 430);
  const dateText = (date) => date.toISOString().slice(0, 10).replaceAll("-", "");
  const params = new URLSearchParams({
    serviceKey: decodeURIComponent(DATA_KEY), resultType: "json", numOfRows: "10000", pageNo: "1",
    idxNm: indexName, likeIdxNm: indexName, beginBasDt: dateText(start), endBasDt: dateText(end),
  });
  const payload = await fetchJson(`https://apis.data.go.kr/1160100/GetMarketIndexInfoService_V2/getStockMarketIndex_V2?${params}`);
  const header = payload?.response?.header;
  if (String(header?.resultCode) !== "00") throw new Error(`금융위원회 지수 API: ${header?.resultMsg || "조회 실패"}`);
  let rows = payload?.response?.body?.items?.item || [];
  if (!Array.isArray(rows)) rows = [rows];
  rows = rows.filter((row) => String(row.idxNm || "").replaceAll(" ", "") === indexName.replaceAll(" ", ""))
    .map((row) => ({ ...row, dataSource: "FSC_MARKET_INDEX", sourceOfficial: true }))
    .sort((a, b) => String(a.basDt).localeCompare(String(b.basDt)));
  cache.set(key, rows, 30 * 60_000);
  return rows;
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, item) => sum + item, 0) / valid.length : null;
}

function marketSummary(rows) {
  if (!rows.length) return {};
  const latest = rows.at(-1);
  const closes = rows.map((row) => number(row.clpr));
  const sma = (days) => average(closes.slice(-days));
  const rolling = (days) => closes.map((_, index) => index + 1 >= days ? average(closes.slice(index + 1 - days, index + 1)) : null);
  const rolling5 = rolling(5), rolling20 = rolling(20), rolling60 = rolling(60), rolling120 = rolling(120), rolling200 = rolling(200);
  const price = number(latest.clpr);
  const returnFor = (days) => {
    const base = closes.at(-(days + 1));
    return Number.isFinite(price) && Number.isFinite(base) && base !== 0 ? ((price / base) - 1) * 100 : null;
  };
  const ma5 = sma(5), ma20 = sma(20), ma60 = sma(60), ma120 = sma(120), ma200 = sma(200);
  let technicalSignal = "대기";
  if ([price, ma20, ma60, ma120].every(Number.isFinite)) {
    if (price > ma20 && ma20 > ma60 && ma60 > ma120) technicalSignal = "매수 가능";
    else if (price > ma60) technicalSignal = "분할매수";
    else if (price < ma120) technicalSignal = "기술적 경계";
  }
  return {
    date: latest.basDt,
    price,
    marketCap: number(latest.mrktTotAmt),
    changeRate: number(latest.fltRt),
    return1W: returnFor(5),
    return1M: returnFor(20),
    return3M: returnFor(60),
    return6M: returnFor(120),
    return1Y: returnFor(251),
    ma5, ma20, ma60, ma120, ma200,
    history: rows.map((row, index) => ({
      date: row.basDt,
      close: closes[index],
      volume: number(row.trqu),
      ma5: rolling5[index],
      ma20: rolling20[index],
      ma60: rolling60[index],
      ma120: rolling120[index],
      ma200: rolling200[index],
    })).slice(-252),
    technicalSignal,
  };
}

function growth(current, previous) {
  return Number.isFinite(current) && Number.isFinite(previous) && previous !== 0
    ? ((current / previous) - 1) * 100 : null;
}

const INDUSTRY_NAMES = {
  "10": "식료품", "11": "음료", "12": "담배", "13": "섬유", "14": "의복", "15": "가죽·신발",
  "16": "목재", "17": "펄프·종이", "18": "인쇄", "19": "석유정제품", "20": "화학", "21": "의약품",
  "22": "고무·플라스틱", "23": "비금속광물", "24": "1차금속", "25": "금속가공", "26": "전자·컴퓨터·통신",
  "27": "의료·정밀기기", "28": "전기장비", "29": "기계장비", "30": "자동차", "31": "기타 운송장비",
  "32": "가구", "33": "기타 제조", "35": "전기·가스", "36": "수도", "37": "하수처리", "38": "폐기물",
  "41": "종합건설", "42": "전문건설", "45": "자동차 판매", "46": "도매", "47": "소매", "49": "육상운송",
  "50": "수상운송", "51": "항공운송", "52": "창고·운송서비스", "55": "숙박", "56": "음식점",
  "58": "출판", "59": "영상·오디오", "60": "방송", "61": "통신", "62": "소프트웨어", "63": "정보서비스",
  "64": "금융", "65": "보험", "66": "금융지원", "68": "부동산", "70": "연구개발", "71": "전문서비스",
  "72": "건축·엔지니어링", "73": "기타 전문서비스", "74": "사업시설관리", "85": "교육"
};

const RATE_FX_MISSION_INDUSTRIES = [
  { id: "semiconductor", name: "반도체", indexName: "KRX 반도체", companies: [{ name: "삼성전자", stockCode: "005930" }, { name: "SK하이닉스", stockCode: "000660" }, { name: "DB하이텍", stockCode: "000990" }] },
  { id: "auto", name: "자동차", indexName: "KRX 자동차", companies: [{ name: "현대차", stockCode: "005380" }, { name: "기아", stockCode: "000270" }, { name: "현대모비스", stockCode: "012330" }] },
  { id: "bank", name: "은행", indexName: "KRX 은행", companies: [{ name: "KB금융", stockCode: "105560" }, { name: "신한지주", stockCode: "055550" }, { name: "하나금융지주", stockCode: "086790" }] },
  { id: "energy", name: "에너지·화학", indexName: "KRX 에너지화학", companies: [{ name: "LG화학", stockCode: "051910" }, { name: "S-Oil", stockCode: "010950" }, { name: "금호석유", stockCode: "011780" }] },
  { id: "steel", name: "철강", indexName: "KRX 철강", companies: [{ name: "POSCO홀딩스", stockCode: "005490" }, { name: "현대제철", stockCode: "004020" }, { name: "세아베스틸지주", stockCode: "001430" }] },
  { id: "construction", name: "건설", indexName: "KRX 건설", companies: [{ name: "현대건설", stockCode: "000720" }, { name: "GS건설", stockCode: "006360" }, { name: "대우건설", stockCode: "047040" }] },
  { id: "insurance", name: "보험", indexName: "KRX 보험", companies: [{ name: "삼성생명", stockCode: "032830" }, { name: "삼성화재", stockCode: "000810" }, { name: "DB손해보험", stockCode: "005830" }] },
  { id: "healthcare", name: "헬스케어", indexName: "KRX 헬스케어", companies: [{ name: "삼성바이오로직스", stockCode: "207940" }, { name: "셀트리온", stockCode: "068270" }, { name: "유한양행", stockCode: "000100" }] },
  { id: "transport", name: "운송", indexName: "KRX 운송", companies: [{ name: "HMM", stockCode: "011200" }, { name: "대한항공", stockCode: "003490" }, { name: "현대글로비스", stockCode: "086280" }] },
  { id: "utilities", name: "유틸리티", indexName: "KRX 유틸리티", companies: [{ name: "한국전력", stockCode: "015760" }, { name: "한국가스공사", stockCode: "036460" }, { name: "지역난방공사", stockCode: "071320" }] },
  { id: "information-technology", name: "정보기술", indexName: "KRX 정보기술", companies: [{ name: "NAVER", stockCode: "035420" }, { name: "카카오", stockCode: "035720" }, { name: "삼성SDS", stockCode: "018260" }] },
  { id: "consumer-staples", name: "필수소비재", indexName: "KRX 필수소비재", companies: [{ name: "KT&G", stockCode: "033780" }, { name: "CJ제일제당", stockCode: "097950" }, { name: "오리온", stockCode: "271560" }] },
  { id: "machinery", name: "기계장비", indexName: "KRX 기계장비", companies: [{ name: "두산에너빌리티", stockCode: "034020" }, { name: "HD현대인프라코어", stockCode: "042670" }, { name: "현대로템", stockCode: "064350" }] },
  { id: "broadcast-telecom", name: "방송통신", indexName: "KRX 방송통신", companies: [{ name: "SK텔레콤", stockCode: "017670" }, { name: "KT", stockCode: "030200" }, { name: "LG유플러스", stockCode: "032640" }] },
  { id: "consumer-discretionary", name: "경기소비재", indexName: "KRX 경기소비재", companies: [{ name: "아모레퍼시픽", stockCode: "090430" }, { name: "호텔신라", stockCode: "008770" }, { name: "이마트", stockCode: "139480" }] },
];

const DEFAULT_MISSION_INDUSTRY_IDS = RATE_FX_MISSION_INDUSTRIES.slice(0, 8).map((industry) => industry.id);
const INDUSTRY_STRESS_FACTORS = {
  "usd-krw": { id: "usd-krw", name: "원/달러 환율", group: "market", changeMode: "percent" },
  "us-dollar-index": { id: "us-dollar-index", name: "미국 광의 달러지수", group: "market", changeMode: "percent" },
  wti: { id: "wti", name: "WTI 국제유가", group: "market", changeMode: "percent" },
  brent: { id: "brent", name: "브렌트유", group: "market", changeMode: "percent" },
  vix: { id: "vix", name: "VIX 변동성지수", group: "market", changeMode: "percent" },
  "kr-base-rate": { id: "kr-base-rate", name: "한국 기준금리", group: "rate", changeMode: "point" },
  "kr-3y": { id: "kr-3y", name: "국고채 3년", group: "rate", changeMode: "point" },
  "kr-corp-3y": { id: "kr-corp-3y", name: "회사채 3년 AA-", group: "rate", changeMode: "point" },
  "us-policy-rate": { id: "us-policy-rate", name: "미국 기준금리 상단", group: "rate", changeMode: "point" },
  "us-2y": { id: "us-2y", name: "미국 국채 2년", group: "rate", changeMode: "point" },
  "us-10y": { id: "us-10y", name: "미국 국채 10년", group: "rate", changeMode: "point" },
};

function calendarDaysAgo(compactEnd, days) {
  const text = compactEnd || kstDate(-1);
  const date = new Date(`${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

async function rateFxIndustryMission(requestedDays = 250, requestedIndustryIds = DEFAULT_MISSION_INDUSTRY_IDS, requestedFactorA = "usd-krw", requestedFactorB = "kr-3y") {
  const days = Math.min(Math.max(Number(requestedDays) || 250, 250), 500);
  const requested = Array.isArray(requestedIndustryIds) ? requestedIndustryIds : [];
  const uniqueIds = [...new Set(requested.map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 10);
  const selectedIndustries = (uniqueIds.length ? uniqueIds : DEFAULT_MISSION_INDUSTRY_IDS)
    .map((id) => RATE_FX_MISSION_INDUSTRIES.find((industry) => industry.id === id))
    .filter(Boolean);
  if (selectedIndustries.length < 2) throw new Error("비교할 KRX 업종을 2개 이상 선택해 주세요.");
  const factorA = INDUSTRY_STRESS_FACTORS[requestedFactorA] || INDUSTRY_STRESS_FACTORS["usd-krw"];
  const factorB = INDUSTRY_STRESS_FACTORS[requestedFactorB] || INDUSTRY_STRESS_FACTORS["kr-3y"];
  if (factorA.id === factorB.id) throw new Error("서로 다른 두 외부요인을 선택해 주세요.");
  const endDate = kstDate(-1);
  const beginDate = calendarDaysAgo(endDate, Math.ceil(days * 1.8));
  const cacheKey = `mission:rate-fx:${days}:${factorA.id}:${factorB.id}:${selectedIndustries.map((industry) => industry.id).join(",")}:${endDate}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const listed = await loadCompanies();
  const byStock = new Map(listed.map((company) => [company.stockCode, company]));

  const [macroRows, industries] = await Promise.all([
    Promise.all([
      macroService.getSeries(factorA.id, beginDate, endDate),
      macroService.getSeries(factorB.id, beginDate, endDate),
    ]),
    mapLimit(selectedIndustries, 3, async (industry) => {
      const [indexRows, companies] = await Promise.all([
        indexHistory(industry.indexName, beginDate, endDate),
        mapLimit(industry.companies, 3, async (representative) => {
          const rows = await marketHistory(representative.stockCode, beginDate, endDate);
          const company = byStock.get(representative.stockCode);
          return {
            ...representative,
            corpCode: company?.corpCode || null,
            history: rows.map((row) => ({ date: row.basDt, close: number(row.clpr) })).filter((row) => Number.isFinite(row.close)),
          };
        }),
      ]);
      return {
        ...industry,
        history: indexRows.map((row) => ({ date: row.basDt, close: number(row.clpr) })).filter((row) => Number.isFinite(row.close)),
        companies,
      };
    }),
  ]);

  const result = {
    requestedTradingDays: days,
    beginDate,
    endDate,
    generatedAt: new Date().toISOString(),
    methodology: {
      stressCondition: `${factorA.name}과 ${factorB.name}이 선택한 방향으로 같은 날 움직인 거래일`,
      industryReturn: "KRX 업종지수의 하루 수익률",
      companyReturn: "자료가 있는 업종별 대표기업 최대 3곳의 하루 평균 수익률을 같은 비중으로 평균",
      interpretation: "두 변화가 함께 나타난 날의 업종지수 하루 평균으로 순위를 정하고, 그렇지 않은 날의 평균도 함께 비교합니다. 함께 움직였다는 사실만으로 원인과 결과를 알 수는 없습니다.",
    },
    sources: [factorA.name, factorB.name, "금융위원회 지수시세정보", "금융위원회 주식시세정보"],
    factorMeta: { a: factorA, b: factorB },
    macro: { factorA: macroRows[0], factorB: macroRows[1], usdKrw: macroRows[0], kr3y: macroRows[1] },
    industries,
  };
  cache.set(cacheKey, result, 30 * 60_000);
  return result;
}

const KRX_INVESTOR_INDUSTRIES = [
  "반도체", "자동차", "2차전지", "화학", "은행", "보험", "IT하드웨어", "소프트웨어",
  "조선", "기계", "철강", "에너지", "건설", "운송", "유통", "음식료", "화장품",
  "바이오·제약", "증권", "통신", "미디어·엔터", "유틸리티", "기타·미분류",
];

function industryLabel(code, companyName = "") {
  const prefix = String(code || "").padStart(2, "0").slice(0, 2);
  const name = String(companyName || "");
  const namedRules = [
    [/(삼성전자|SK하이닉스|DB하이텍|한미반도체|리노공업|원익IPS|테크윙|ISC)/i, "반도체"],
    [/(LG에너지솔루션|삼성SDI|에코프로|포스코퓨처엠|엘앤에프|SK온)/i, "2차전지"],
    [/(KB금융|신한지주|하나금융|우리금융|기업은행|카카오뱅크|BNK금융|DGB금융|JB금융)/i, "은행"],
    [/(증권|투자증권|금융투자|키움)/i, "증권"],
    [/(조선|한화오션|삼성중공업|HD현대중공업|HD한국조선)/i, "조선"],
    [/(아모레|LG생활건강|한국콜마|코스맥스|클리오)/i, "화장품"],
    [/(S-Oil|에쓰오일|SK이노베이션|현대오일뱅크)/i, "에너지"],
    [/(삼성전기|LG이노텍|LG디스플레이)/i, "IT하드웨어"],
    [/(하이브|에스엠|JYP|YG|스튜디오드래곤|엔터테인먼트)/i, "미디어·엔터"],
    [/(NAVER|네이버|카카오|더존비즈온|안랩)/i, "소프트웨어"],
  ];
  const named = namedRules.find(([pattern]) => pattern.test(name));
  if (named) return named[1];
  const prefixMap = {
    "10": "음식료", "11": "음식료", "12": "음식료", "13": "유통", "14": "유통", "15": "유통",
    "16": "건설", "17": "유통", "18": "미디어·엔터", "19": "에너지", "20": "화학", "21": "바이오·제약",
    "22": "화학", "23": "건설", "24": "철강", "25": "철강", "26": "IT하드웨어", "27": "바이오·제약",
    "28": "2차전지", "29": "기계", "30": "자동차", "31": "조선", "32": "유통", "33": "기계",
    "35": "유틸리티", "36": "유틸리티", "37": "유틸리티", "38": "유틸리티", "41": "건설", "42": "건설",
    "45": "유통", "46": "유통", "47": "유통", "49": "운송", "50": "운송", "51": "운송", "52": "운송",
    "55": "유통", "56": "음식료", "58": "미디어·엔터", "59": "미디어·엔터", "60": "미디어·엔터",
    "61": "통신", "62": "소프트웨어", "63": "소프트웨어", "64": "은행", "65": "보험", "66": "증권",
    "68": "건설", "70": "바이오·제약", "71": "소프트웨어", "72": "건설", "73": "소프트웨어", "74": "유통",
  };
  return prefixMap[prefix] || "기타·미분류";
}

function isFinancialIndustry(code) {
  return ["64", "65", "66"].includes(String(code || "").padStart(2, "0").slice(0, 2));
}

function normalizeForIndustry(financial, industryCode) {
  // 업종에 따라 비교 적합성은 달라도 DART 원자료 자체는 숨기지 않는다.
  return financial;
}

async function dartDividend(corpCode, requestedYear) {
  if (!DART_KEY) return null;
  for (let year = requestedYear; year >= requestedYear - 2; year--) {
    const key = `dividend:${corpCode}:${year}`;
    let rows = cache.get(key);
    if (!rows) {
      const params = new URLSearchParams({ crtfc_key: DART_KEY, corp_code: corpCode, bsns_year: String(year), reprt_code: "11011" });
      const payload = await fetchJson(`https://opendart.fss.or.kr/api/alotMatter.json?${params}`);
      rows = payload.status === "000" && Array.isArray(payload.list) ? payload.list : [];
      cache.set(key, rows);
    }
    const ordinary = (label) => rows.find((row) => row.se === label && (!row.stock_knd || row.stock_knd.includes("보통")))
      || rows.find((row) => row.se === label);
    const dividendYield = number(ordinary("현금배당수익률(%)")?.thstrm);
    const dividendPerShare = number(ordinary("주당 현금배당금(원)")?.thstrm);
    const payoutRatio = number(rows.find((row) => row.se === "현금배당성향(%)")?.thstrm);
    if ([dividendYield, dividendPerShare, payoutRatio].some(Number.isFinite)) {
      return { year, dividendYield, dividendPerShare, payoutRatio, source: "DART 사업보고서" };
    }
  }
  return null;
}

async function dartCompanyInfo(corpCode) {
  const key = `company:${corpCode}`;
  if (cache.has(key)) return cache.get(key);
  const params = new URLSearchParams({ crtfc_key: DART_KEY, corp_code: corpCode });
  const payload = await fetchJson(`https://opendart.fss.or.kr/api/company.json?${params}`);
  const result = payload.status === "000" ? payload : {};
  cache.set(key, result);
  return result;
}

function kstDate(offsetDays = 0) {
  const date = new Date(Date.now() + (9 * 60 * 60 * 1000));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

async function krxMarketRows(market) {
  if (!KRX_KEY) throw new Error("KRX_AUTH_KEY가 설정되지 않았습니다.");
  const marketName = market === "KOSDAQ" ? "KOSDAQ" : "KOSPI";
  const endpoint = marketName === "KOSDAQ" ? "ksq_bydd_trd" : "stk_bydd_trd";
  for (let offset = -1; offset >= -10; offset--) {
    const basisDate = kstDate(offset);
    const key = `krx:${marketName}:${basisDate}`;
    if (cache.has(key)) return { basisDate, rows: cache.get(key) };
    const payload = await fetchJson(`https://data-dbg.krx.co.kr/svc/apis/sto/${endpoint}?basDd=${basisDate}`, {
      headers: { AUTH_KEY: KRX_KEY },
    });
    const rows = Array.isArray(payload.OutBlock_1) ? payload.OutBlock_1 : [];
    if (rows.length) {
      cache.set(key, rows);
      return { basisDate, rows };
    }
  }
  throw new Error("최근 KRX 거래일 데이터를 찾지 못했습니다.");
}

async function krxEtfRows() {
  if (!KRX_KEY) throw new Error("KRX_AUTH_KEY가 설정되지 않았습니다.");
  for (let offset = -1; offset >= -10; offset--) {
    const basisDate = kstDate(offset);
    const key = `krx:ETF:${basisDate}`;
    if (cache.has(key)) return { basisDate, rows: cache.get(key) };
    const payload = await fetchJson(`https://data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd?basDd=${basisDate}`, { headers: { AUTH_KEY: KRX_KEY } });
    const rows = Array.isArray(payload.OutBlock_1) ? payload.OutBlock_1 : [];
    if (rows.length) { cache.set(key, rows); return { basisDate, rows }; }
  }
  throw new Error("최근 KRX ETF 거래일 데이터를 찾지 못했습니다.");
}

async function activeListingCodes() {
  const key = "krx:active-listing-codes";
  if (cache.has(key)) return cache.get(key);
  const markets = await Promise.all([krxMarketRows("KOSPI"), krxMarketRows("KOSDAQ")]);
  const codes = new Set(markets.flatMap(({ rows }) => rows.map((row) => String(row.ISU_CD || "").padStart(6, "0"))));
  cache.set(key, codes, 6 * 60 * 60_000);
  return codes;
}

async function searchCompanies(query, limit = 12) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const list = await loadCompanies();
  let activeCodes = null;
  try { activeCodes = await activeListingCodes(); } catch {}
  const exactCode = q.replace(/\D/g, "").slice(-6);
  return list
    .filter((item) => item.corpCode === q || item.name.toLowerCase().includes(q) || stockDisplayName(item).toLowerCase().includes(q) || item.stockCode.includes(q))
    .map((item) => ({
      ...item,
      name: stockDisplayName(item),
      ...(stockDisplayName(item) !== item.name ? { legalName: item.name } : {}),
      listingStatus: activeCodes ? (activeCodes.has(item.stockCode) ? "active" : "inactive_or_unverified") : "unverified",
    }))
    .sort((a, b) => {
      const aExact = exactCode.length === 6 && a.stockCode === exactCode;
      const bExact = exactCode.length === 6 && b.stockCode === exactCode;
      if (aExact !== bExact) return Number(bExact) - Number(aExact);
      const aActive = a.listingStatus === "active";
      const bActive = b.listingStatus === "active";
      if (aActive !== bActive) return Number(bActive) - Number(aActive);
      const aStarts = a.name.toLowerCase().startsWith(q);
      const bStarts = b.name.toLowerCase().startsWith(q);
      if (aStarts !== bStarts) return Number(bStarts) - Number(aStarts);
      return a.name.localeCompare(b.name, "ko") || b.stockCode.localeCompare(a.stockCode);
    })
    .slice(0, limit);
}

function mapEtfRow(row, basisDate) {
  const stockCode = String(row.ISU_CD || "").padStart(6, "0");
  const price = number(row.TDD_CLSPRC ?? row.CLSPRC);
  const nav = number(row.NAV ?? row.NAV_VAL);
  const name = row.ISU_NM || stockCode;
  const underlying = row.IDX_IND_NM || row.OBJ_STKPRC_IDX || row.TRACK_IDX_NM || "KRX ETF";
  const classifier = `${name} ${underlying}`;
  const category = /(채권|국고채|회사채|단기|머니|KOFR|CD금리|금현물|골드|금선물|원유|오일|은선물|구리|원자재|리츠|부동산|인프라|커버드콜)/i.test(classifier)
    ? "asset"
    : /(미국|나스닥|NASDAQ|S&P|다우|DOW|러셀|Russell|필라델피아)/i.test(classifier)
      ? "us"
      : /(중국|차이나|일본|니케이|인도|유럽|베트남|대만|홍콩|글로벌|선진국|신흥국|MSCI World)/i.test(classifier)
        ? "global"
        : "korea";
  return {
    assetId: `ETF:${stockCode}`,
    corpCode: `ETF:${stockCode}`,
    stockCode,
    name,
    assetType: "ETF",
    basisDate,
    price,
    change: number(row.CMPPREVDD_PRC),
    changeRate: number(row.FLUC_RT),
    nav,
    premium: Number.isFinite(price) && Number.isFinite(nav) && nav !== 0 ? ((price / nav) - 1) * 100 : null,
    open: number(row.TDD_OPNPRC),
    high: number(row.TDD_HGPRC),
    low: number(row.TDD_LWPRC),
    volume: number(row.ACC_TRDVOL),
    tradingValue: number(row.ACC_TRDVAL),
    marketCap: number(row.MKTCAP),
    netAssets: number(row.INVSTASST_NETASST_TOTAMT),
    listedShares: number(row.LIST_SHRS),
    underlying,
    category,
    dataSource: "KRX_OPEN_API",
    sourceOfficial: true,
  };
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
}

async function discoverMarket(market, limit) {
  const { basisDate, rows } = await krxMarketRows(market);
  const listed = await loadCompanies();
  const companyByStock = new Map(listed.map((item) => [item.stockCode, item]));
  const leaders = rows
    .map((row) => ({
      stockCode: String(row.ISU_CD || "").padStart(6, "0"),
      name: row.ISU_NM,
      market: row.MKT_NM,
      price: number(row.TDD_CLSPRC),
      changeRate: number(row.FLUC_RT),
      marketCap: number(row.MKTCAP),
      volume: number(row.ACC_TRDVOL),
      tradingValue: number(row.ACC_TRDVAL),
    }))
    .filter((item) => companyByStock.has(item.stockCode))
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, limit);
  const enriched = await mapLimit(leaders, 8, async (item) => {
    const company = companyByStock.get(item.stockCode);
    try {
      const info = await dartCompanyInfo(company.corpCode);
      return { ...item, ...company, industryCode: info.induty_code || "", industry: industryLabel(info.induty_code, company.name || item.name) };
    } catch {
      return { ...item, ...company, industryCode: "", industry: "기타·미분류" };
    }
  });
  return { basisDate, market, companies: enriched };
}

function evaluate(financials, market, isFinancial = false) {
  const latest = financials.at(-1) || {};
  const prior = financials.at(-2) || {};
  const positives = isFinancial ? [
    latest.roe >= 8,
    latest.netIncome > 0,
    growth(latest.netIncome, prior.netIncome) > 0,
    latest.equity > 0,
  ] : [
    latest.operatingMargin >= 10,
    latest.roe >= 10,
    latest.fcf > 0,
    latest.debtRatio < 100,
    growth(latest.operatingProfit, financials.at(-3)?.operatingProfit) > 0,
  ];
  const passed = positives.filter(Boolean).length;
  const quality = isFinancial
    ? (passed >= 3 ? "강함" : passed >= 2 ? "중립" : "주의")
    : (passed >= 4 ? "강함" : passed >= 2 ? "중립" : "주의");
  const per = ratio(market.marketCap, latest.netIncome, 1);
  const pbr = ratio(market.marketCap, latest.equity, 1);
  const fcfYield = ratio(latest.fcf, market.marketCap);
  return {
    quality,
    qualityEvidence: `${passed}/${positives.length} ${isFinancial ? "금융업" : "일반"} 조건 충족`,
    priceView: "업종 기준 필요",
    technical: market.technicalSignal || "자료 부족",
    revenueGrowth: growth(latest.revenue, prior.revenue),
    operatingProfitGrowth: growth(latest.operatingProfit, prior.operatingProfit),
    per, pbr, fcfYield,
  };
}

function hasCoreFinancialValue(period) {
  return [period.revenue, period.operatingProfit, period.netIncome, period.assets, period.equity].some(Number.isFinite);
}

export async function loadFinancialPeriods(corpCode, years, reportCode = "11011", statementLoader = dartStatement) {
  // 사업보고서에는 당기·전기·전전기 값이 있습니다. 5개년은 최신 연도와
  // 2년 전 보고서의 비교표로 확인합니다. 오래된 연도의 직접 API 조회가
  // 013이어도 2023년 보고서에서 2021·2022년을 복원할 수 있습니다.
  const annual = reportCode === "11011";
  const initialYears = annual && years.length === 5
    ? [years.at(-1), years.at(-3)]
    : years;
  const requested = new Set(years);
  const fetched = new Map();
  async function fetchYear(year) {
    if (fetched.has(year)) return fetched.get(year);
    try {
      const result = { rows: await statementLoader(corpCode, year, reportCode) };
      fetched.set(year, result);
      return result;
    } catch (error) {
      const result = { error };
      fetched.set(year, result);
      return result;
    }
  }
  function periodsFromReports() {
    const periods = new Map();
    const reports = [...fetched.entries()]
      .filter(([, result]) => Array.isArray(result.rows))
      .sort(([a], [b]) => a - b);
    for (const [year, { rows }] of reports) {
      const period = summarize(rows, year, reportCode);
      if (!annual || hasCoreFinancialValue(period)) periods.set(year, period);
    }
    if (annual) {
      for (const [reportYear, { rows }] of reports) {
        for (const [offset, field] of [[1, "frmtrm_amount"], [2, "bfefrmtrm_amount"]]) {
          const year = reportYear - offset;
          if (!requested.has(year) || periods.has(year)) continue;
          const period = summarize(rows, year, reportCode, field, reportYear);
          if (hasCoreFinancialValue(period)) periods.set(year, period);
        }
      }
    }
    return periods;
  }
  await Promise.all(initialYears.map(fetchYear));
  let periods = periodsFromReports();
  const hasNonMissingFailure = [...fetched.values()].some(({ error }) => error && !["013", "014"].includes(error.code));
  // 비교표가 없는 회사·연도만 직접 조회합니다. 정상 회사는 2회 호출로 끝납니다.
  if (!hasNonMissingFailure) {
    for (const year of years) {
      if (periods.has(year) || fetched.has(year)) continue;
      const result = await fetchYear(year);
      periods = periodsFromReports();
      if (result.error && !["013", "014"].includes(result.error.code)) break;
    }
  }
  const financials = years.filter((year) => periods.has(year)).map((year) => periods.get(year));
  const warnings = [...fetched.entries()]
    .filter(([year, result]) => requested.has(year) && !periods.has(year) && result.error)
    .map(([, result]) => result.error.message);
  if (hasNonMissingFailure && years.some((year) => !periods.has(year)) && !warnings.length) {
    warnings.push("DART 재무자료 조회 중 오류가 발생했습니다. 잠시 후 다시 확인해 주세요.");
  }
  return { financials, warnings };
}

async function buildCompany(company, years, reportCode = "11011") {
  const { financials: rawFinancials, warnings: financialWarnings } = await loadFinancialPeriods(company.corpCode, years, reportCode);
  const [marketResult, companyInfoResult, dividendResult] = await Promise.allSettled([
    marketHistory(company.stockCode),
    dartCompanyInfo(company.corpCode),
    dartDividend(company.corpCode, Math.max(...years)),
  ]);
  const market = marketResult.status === "fulfilled" ? marketSummary(marketResult.value) : {};
  const marketError = marketResult.status === "rejected" ? marketResult.reason.message : null;
  const companyInfo = companyInfoResult.status === "fulfilled" ? companyInfoResult.value : {};
  const industryCode = companyInfo.induty_code || "";
  const isFinancial = isFinancialIndustry(industryCode);
  const financials = rawFinancials.map((item) => normalizeForIndustry(item, industryCode));
  const dividend = dividendResult.status === "fulfilled" ? dividendResult.value : null;
  return {
    ...company,
    name: stockDisplayName(company),
    ...(stockDisplayName(company) !== company.name ? { legalName: company.name } : {}),
    industryCode,
    industry: industryLabel(industryCode, company.name),
    isFinancial,
    metricProfile: isFinancial ? "financial" : "general",
    exchange: companyInfo.corp_cls === "K" ? "KOSDAQ" : companyInfo.corp_cls === "N" ? "KONEX" : "KOSPI",
    financials,
    latest: financials.at(-1) || null,
    market,
    dividend,
    evaluation: evaluate(financials, market, isFinancial),
    warnings: [
      ...financialWarnings,
      ...(marketError ? [marketError] : []),
    ],
  };
}

async function companyUpdate(company, afterYear) {
  const today = kstDate();
  const currentYear = Number(today.slice(0, 4));
  const baseYear = Math.max(currentYear - 2, Math.min(Math.trunc(Number(afterYear)) || currentYear - 1, currentYear - 1));
  const cacheKey = `company-update:${company.corpCode}:${currentYear}:${baseYear}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const report = await latestFiledInterim(baseYear, currentYear,
    (year, reportCode) => dartStatement(company.corpCode, year, reportCode));
  if (!report) {
    const result = { status: "none", afterYear: baseYear, note: "연간 보고서 이후 발표된 분기·반기 재무제표가 없습니다." };
    cache.set(cacheKey, result, 10 * 60_000);
    return result;
  }
  const info = await dartCompanyInfo(company.corpCode).catch(() => ({}));
  const industryCode = info.induty_code || "";
  const current = normalizeForIndustry(summarize(report.currentRows, report.year, report.reportCode), industryCode);
  const prior = report.priorRows?.length
    ? normalizeForIndustry(summarize(report.priorRows, report.year - 1, report.reportCode), industryCode)
    : null;
  const source = filingSource(report.currentRows);
  const priorSource = filingSource(report.priorRows);
  const comparable = Boolean(prior && current.statementBasis && current.statementBasis === prior.statementBasis);
  const filings = await dartFilings(company.corpCode, source?.receiptDate || `${report.year}0101`, today).catch(() => []);
  const preliminary = filings.find((item) => /잠정.*실적|실적.*잠정/.test(item.reportName)
    && (!source?.receiptDate || item.receiptDate > source.receiptDate)) || null;
  const result = {
    status: "ready", year: report.year, reportCode: report.reportCode, reportLabel: report.reportLabel,
    current, prior: comparable ? prior : null, source, priorSource: comparable ? priorSource : null,
    comparisonNote: comparable ? "같은 종류의 전년 보고서·같은 재무제표 기준으로 비교했습니다. 손익과 현금흐름은 해당 시점까지의 누적 수치입니다."
      : "같은 기간·같은 재무제표 기준의 전년 수치가 없어 증감률은 표시하지 않습니다.",
    preliminary: preliminary && { title: preliminary.reportName, receiptDate: preliminary.receiptDate, url: preliminary.url },
  };
  cache.set(cacheKey, result, 30 * 60_000);
  return result;
}

async function dartFilings(corpCode, beginDate, endDate, type = "", detailType = "", finalOnly = false) {
  if (!DART_KEY) throw new Error("OPEN_DART_API_KEY가 설정되지 않았습니다.");
  const params = new URLSearchParams({
    crtfc_key: DART_KEY,
    corp_code: corpCode,
    bgn_de: beginDate,
    end_de: endDate,
    page_count: "100",
    sort: "date",
    sort_mth: "desc",
  });
  if (/^[A-J]$/.test(type)) params.set("pblntf_ty", type);
  if (/^[A-J]\d{3}$/.test(detailType)) params.set("pblntf_detail_ty", detailType);
  if (finalOnly) params.set("last_reprt_at", "Y");
  const payload = await fetchJson(`https://opendart.fss.or.kr/api/list.json?${params}`);
  if (!['000', '013'].includes(payload.status)) throw new Error(payload.message || "DART 공시 조회 실패");
  let filings = (payload.list || []).map((item) => ({
    receiptNo: item.rcept_no,
    receiptDate: item.rcept_dt,
    reportName: item.report_nm,
    submitter: item.flr_nm,
    remarks: item.rm || "",
    url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`,
  }));
  const detailPatterns = {
    A001: /(^|\])사업보고서\s*\(/,
    A002: /(^|\])반기보고서\s*\(/,
    A003: /(^|\])분기보고서\s*\(/,
    B001: /주요사항보고서/,
    D001: /대량보유상황보고/,
    D002: /임원.*주요주주.*소유상황보고/,
    D003: /의결권대리행사권유/,
  };
  if (detailPatterns[detailType]) filings = filings.filter((item) => detailPatterns[detailType].test(item.reportName));
  return filings;
}

async function agentTrend(company, metric) {
  const year = Number(kstDate().slice(0, 4)) - 1;
  const key = `company-agent:${company.corpCode}:${metric}:${year}`;
  if (cache.has(key)) return cache.get(key);
  const [latestRows, priorRows, info, latestFilings, priorFilings] = await Promise.allSettled([
    dartStatement(company.corpCode, year),
    dartStatement(company.corpCode, year - 1),
    dartCompanyInfo(company.corpCode),
    dartFilings(company.corpCode, `${year + 1}0101`, `${year + 1}1231`, "A", "A001", true),
    dartFilings(company.corpCode, `${year}0101`, `${year}1231`, "A", "A001", true),
  ]);
  if ([latestRows, priorRows, info, latestFilings, priorFilings].some((result) => result.status === "rejected")) {
    return { status: "insufficient", reason: "DART의 재무 수치 또는 사업보고서 원문을 확인하지 못했습니다." };
  }
  const reportFor = (items, reportYear) => items.value.find((item) =>
    new RegExp(`\\(${reportYear}\\.\\d{2}\\)`).test(item.reportName) && /^\d{14}$/.test(item.receiptNo));
  const sources = [year - 1, year].map((reportYear) => {
    const match = reportFor(reportYear === year ? latestFilings : priorFilings, reportYear);
    return match && { year: reportYear, title: match.reportName, receiptDate: match.receiptDate, url: match.url };
  }).filter(Boolean);
  const latest = summarize(latestRows.value, year);
  const directlyReportedPrior = summarize(priorRows.value, year - 1);
  const comparativePrior = summarize(latestRows.value, year - 1, "11011", "frmtrm_amount", year);
  const useComparative = Number.isFinite(comparativePrior[metric]);
  const previous = useComparative ? comparativePrior : directlyReportedPrior;
  const evidence = buildTrendEvidence({
    company: { name: stockDisplayName(company), isFinancial: isFinancialIndustry(info.value.induty_code) },
    metric, current: latest, previous, sources,
  });
  if (evidence.status === "ready") evidence.comparisonNote = useComparative
    ? `${year}년 사업보고서의 전기 비교표 수치를 사용했습니다.`
    : `${year - 1}년 사업보고서 직접 공시 수치를 사용했습니다.`;
  if (evidence.status === "ready") cache.set(key, evidence, 30 * 60_000);
  return evidence;
}

async function agentFilings(company) {
  const today = kstDate();
  const start = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  const filings = await dartFilings(company.corpCode, start, today);
  return filings.length ? {
    status: "ready", company: stockDisplayName(company),
    sources: filings.slice(0, 5).map(({ reportName, receiptDate, url }) => ({ title: reportName, receiptDate, url })),
    caution: "공시 제목·날짜만 확인했습니다. 재무 수치와 내용은 원문에서 확인하세요.",
  } : { status: "insufficient", reason: "최근 일 년의 DART 공시가 확인되지 않았습니다." };
}

async function agentBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string" || Buffer.isBuffer(req.body)) return JSON.parse(String(req.body));
  const chunks = []; let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 2048) throw new Error("too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function handleCompanyAgent(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "POST 요청만 지원합니다." });
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (req.headers.origin) {
    let originHost = "";
    try { originHost = new URL(req.headers.origin).host; } catch {}
    if (originHost !== host) return json(res, 403, { error: "이 사이트에서만 요청할 수 있습니다." });
  }
  if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) return json(res, 415, { error: "JSON 요청만 지원합니다." });
  let body;
  try { body = await agentBody(req); } catch { return json(res, 400, { error: "질문 형식을 확인해 주세요." }); }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const corpCode = String(body.corpCode || "");
  if (!question || question.length > 180 || !/^\d{8}$/.test(corpCode)) return json(res, 400, { error: "기업과 180자 이내 질문을 입력해 주세요." });
  if (/목표\s*주가|매수|매도|주가\s*예측|수익\s*보장|계좌|비밀번호|주민등록/.test(question)) {
    return json(res, 400, { error: "투자 권유·주가 예측·개인정보 질문은 지원하지 않습니다." });
  }
  if (!DART_KEY || !aiGuideStatus(env).available) return json(res, 503, { error: "DART 또는 AI 연결이 준비되지 않았습니다." });
  const list = await loadCompanies();
  const company = list.find((item) => item.corpCode === corpCode);
  if (!company) return json(res, 404, { error: "기업을 찾지 못했습니다." });
  const access = spendAccess(clientIp(req), env);
  if (!access.allowed) return json(res, 429, { error: access.reason === "cooldown"
    ? `${access.retryAfterSeconds}초 뒤에 다시 질문해 주세요.`
    : "오늘의 AI 시험 호출 한도에 도달했습니다.", retryAfterSeconds: access.retryAfterSeconds || 0 });
  try {
    const answer = await runCompanyAgent({
      question, company, apiKey: env.OPENAI_API_KEY || env.OPEN_API_KEY,
      model: env.FINSCOPE_AI_MODEL || "gpt-6-luna",
      getTrend: (metric) => agentTrend(company, metric),
      getFilings: () => agentFilings(company),
    });
    return json(res, 200, answer);
  } catch {
    return json(res, 502, { error: "근거 확인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요." });
  }
}

function median(values) {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
}

async function buildBenchmarks(selected, year, reportCode, beginDate = "", endDate = "") {
  const marketCache = new Map();
  const industryCache = new Map();
  const output = [];
  for (const company of selected) {
    if (!company.industryCode || !["KOSPI", "KOSDAQ"].includes(company.market)) continue;
    if (!marketCache.has(company.market)) marketCache.set(company.market, await discoverMarket(company.market, 80));
    const isFinancial = isFinancialIndustry(company.industryCode);
    const groupKey = `${company.market}:${company.industry}:${beginDate}:${endDate}`;
    if (!industryCache.has(groupKey)) {
      const peers = marketCache.get(company.market).companies.filter((item) => item.industry === company.industry).slice(0, 5);
      const results = await mapLimit(peers, 5, async (peer) => {
        let financial = null, history = [];
        try { financial = normalizeForIndustry(summarize(await dartStatement(peer.corpCode, year, reportCode), year, reportCode), peer.industryCode); } catch {}
        try { history = (await marketHistory(peer.stockCode, beginDate, endDate)).map((row) => ({ date: row.basDt, close: number(row.clpr) })).filter((row) => Number.isFinite(row.close)); } catch {}
        const valuation = financial && Number.isFinite(peer.marketCap) ? {
          per: ratio(peer.marketCap, financial.netIncome, 1),
          pbr: ratio(peer.marketCap, financial.equity, 1),
          fcfYield: ratio(financial.fcf, peer.marketCap),
        } : {};
        return { name: peer.name, corpCode: peer.corpCode, financial, valuation, history };
      });
      const financials = results.map((item) => item.financial).filter(Boolean);
      const histories = results.map((item) => item.history).filter((history) => history.length > 1);
      const dateSets = histories.map((history) => new Map(history.map((item) => [item.date, item.close])));
      const peerReturnHistory = histories.length ? histories[0].filter((row) => dateSets.every((map) => map.has(row.date))).map((row) => {
        const returns = dateSets.map((map, index) => {
          const current = map.get(row.date), base = histories[index][0]?.close;
          return Number.isFinite(current) && Number.isFinite(base) && base !== 0 ? ((current / base) - 1) * 100 : null;
        }).filter(Number.isFinite);
        return { date: row.date, value: average(returns) };
      }) : [];
      industryCache.set(groupKey, {
        peerCount: financials.length, peers: peers.map((peer) => peer.name), returnHistory: peerReturnHistory,
        basisDate: marketCache.get(company.market).basisDate,
        metricProfile: isFinancial ? "financial" : "general",
        operatingMargin: isFinancial ? null : median(financials.map((item) => item.operatingMargin)),
        roe: median(financials.map((item) => item.roe)),
        debtRatio: isFinancial ? null : median(financials.map((item) => item.debtRatio)),
        interestCoverage: isFinancial ? null : median(financials.map((item) => item.interestCoverage)),
        fcfMargin: isFinancial ? null : median(financials.map((item) => item.fcfMargin)),
        metricDistributions: {
          operatingMargin: isFinancial ? [] : financials.map((item) => item.operatingMargin).filter(Number.isFinite),
          roe: financials.map((item) => item.roe).filter(Number.isFinite),
          debtRatio: isFinancial ? [] : financials.map((item) => item.debtRatio).filter(Number.isFinite),
          interestCoverage: isFinancial ? [] : financials.map((item) => item.interestCoverage).filter(Number.isFinite),
          fcfMargin: isFinancial ? [] : financials.map((item) => item.fcfMargin).filter(Number.isFinite),
          per: results.map((item) => item.valuation.per).filter((value) => Number.isFinite(value) && value > 0),
          pbr: results.map((item) => item.valuation.pbr).filter((value) => Number.isFinite(value) && value > 0),
          fcfYield: isFinancial ? [] : results.map((item) => item.valuation.fcfYield).filter(Number.isFinite),
        },
      });
    }
    output.push({ corpCode: company.corpCode,
      industry: company.industry,
      ...industryCache.get(groupKey),
    });
  }
  return output;
}

async function api(req, res, url) {
  if (url.pathname === "/api/company-agent") return handleCompanyAgent(req, res);
  if (url.pathname === "/api/ai-guide" || url.pathname === "/api/ai-guide/status") {
    return handleAiGuide(req, res, url, env, json, clientIp);
  }
  if (url.pathname === "/api/health") {
    return json(res, 200, {
      ok: true,
      dartConfigured: Boolean(DART_KEY),
      dataGoKrConfigured: Boolean(DATA_KEY),
      krxConfigured: Boolean(KRX_KEY),
      ecosConfigured: Boolean(ECOS_KEY),
      fredConfigured: Boolean(FRED_KEY),
      eximConfigured: Boolean(EXIM_KEY),
      companyData: existsSync(COMPANY_DATA_PATH) || existsSync(CORP_CODE_PATH),
    });
  }
  if (url.pathname === "/api/companies") {
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    if (q.length < 1) return json(res, 200, []);
    return json(res, 200, await searchCompanies(q));
  }
  if (url.pathname === "/api/company-update") {
    const corpCode = url.searchParams.get("corpCode") || "";
    if (!/^\d{8}$/.test(corpCode)) return json(res, 400, { error: "기업 고유번호를 확인해 주세요." });
    if (!DART_KEY) return json(res, 503, { error: "DART 연결이 준비되지 않았습니다." });
    const company = (await loadCompanies()).find((item) => item.corpCode === corpCode);
    if (!company) return json(res, 404, { error: "기업을 찾지 못했습니다." });
    return json(res, 200, await companyUpdate(company, url.searchParams.get("afterYear")));
  }
  if (url.pathname === "/api/assets") {
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    if (!q) return json(res, 200, []);
    const stocks = (await searchCompanies(q, 8)).map((item) => ({ ...item, assetType: "STOCK" }));
    let etfs = [];
    try {
      const { rows } = await krxEtfRows();
      etfs = rows.map((row) => ({ assetId: `ETF:${String(row.ISU_CD || "").padStart(6, "0")}`, corpCode: `ETF:${String(row.ISU_CD || "").padStart(6, "0")}`, stockCode: String(row.ISU_CD || "").padStart(6, "0"), name: row.ISU_NM, assetType: "ETF", underlying: row.IDX_IND_NM || "ETF", marketCap: number(row.MKTCAP) }))
        .filter((item) => item.name.toLowerCase().includes(q) || item.stockCode.includes(q)).slice(0, 8);
    } catch {}
    return json(res, 200, [...stocks, ...etfs].slice(0, 12));
  }
  if (url.pathname === "/api/macro/catalog") {
    return json(res, 200, { series: macroService.catalog() });
  }
  if (url.pathname === "/api/macro/series") {
    const id = (url.searchParams.get("id") || "").trim();
    const beginDate = (url.searchParams.get("beginDate") || "").replace(/\D/g, "").slice(0, 8);
    const endDate = (url.searchParams.get("endDate") || "").replace(/\D/g, "").slice(0, 8);
    return json(res, 200, await macroService.getSeries(id, beginDate, endDate));
  }
  if (url.pathname === "/api/macro/snapshot") {
    const date = (url.searchParams.get("date") || "").replace(/\D/g, "").slice(0, 8);
    return json(res, 200, await macroService.snapshot(date));
  }
  if (url.pathname === "/api/macro/exchange") {
    const date = (url.searchParams.get("date") || "").replace(/\D/g, "").slice(0, 8);
    return json(res, 200, await macroService.exchangeSnapshot(date));
  }
  if (url.pathname === "/api/macro/loan-rates") {
    const date = (url.searchParams.get("date") || "").replace(/\D/g, "").slice(0, 8);
    return json(res, 200, await macroService.loanRates(date));
  }
  if (url.pathname === "/api/macro/international-rates") {
    const date = (url.searchParams.get("date") || "").replace(/\D/g, "").slice(0, 8);
    return json(res, 200, await macroService.internationalRates(date));
  }
  if (url.pathname === "/api/macro/export.csv") {
    const id = (url.searchParams.get("id") || "").trim();
    const beginDate = (url.searchParams.get("beginDate") || "").replace(/\D/g, "").slice(0, 8);
    const endDate = (url.searchParams.get("endDate") || "").replace(/\D/g, "").slice(0, 8);
    const series = await macroService.getSeries(id, beginDate, endDate);
    return csv(res, `${id || "macro"}.csv`, macroSeriesCsv(series));
  }
  if (url.pathname === "/api/correlation-interpretation") {
    const coefficient = Number(url.searchParams.get("coefficient"));
    const beginDate = (url.searchParams.get("beginDate") || "").replace(/\D/g, "").slice(0, 8);
    const endDate = (url.searchParams.get("endDate") || "").replace(/\D/g, "").slice(0, 8);
    return json(res, 200, correlationInterpretation(coefficient, beginDate, endDate));
  }
  if (url.pathname === "/api/mission/rate-fx-industry") {
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 250, 250), 500);
    const industries = (url.searchParams.get("industries") || "").split(",").filter(Boolean);
    const factorA = (url.searchParams.get("factorA") || "usd-krw").trim();
    const factorB = (url.searchParams.get("factorB") || "kr-3y").trim();
    return json(res, 200, await rateFxIndustryMission(days, industries.length ? industries : DEFAULT_MISSION_INDUSTRY_IDS, factorA, factorB));
  }
  if (url.pathname === "/api/lab/industry-catalog") {
    return json(res, 200, {
      standard: "KRX 업종지수",
      maxSelection: 10,
      stressFactors: Object.values(INDUSTRY_STRESS_FACTORS),
      industries: RATE_FX_MISSION_INDUSTRIES.map(({ id, name, indexName, companies }) => ({ id, name, indexName, companies })),
      note: "업종 평균은 KRX 업종지수로 계산해요. 대표기업은 이해를 돕기 위해 고른 기업이며, 실제 지수 구성종목과 다를 수 있어요.",
    });
  }
  if (url.pathname === "/api/etfs") {
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const category = (url.searchParams.get("category") || "").trim().toLowerCase();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 150);
    const codes = new Set((url.searchParams.get("codes") || "").split(",").map((code) => code.replace(/\D/g, "").slice(-6)).filter((code) => code.length === 6));
    const { basisDate, rows } = await krxEtfRows();
    const items = rows.map((row) => mapEtfRow(row, basisDate))
      .filter((item) => (!category || item.category === category) && (!codes.size || codes.has(item.stockCode)) && (!q || item.name.toLowerCase().includes(q) || item.stockCode.includes(q) || item.underlying.toLowerCase().includes(q)))
      .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
      .slice(0, limit);
    return json(res, 200, items);
  }
  if (url.pathname === "/api/compare") {
    const codes = (url.searchParams.get("corpCodes") || "").split(",").filter(Boolean).slice(0, 10);
    const endYear = Math.min(Number(url.searchParams.get("year")) || new Date().getFullYear() - 1, new Date().getFullYear());
    const requestedReport = url.searchParams.get("reportCode") || "11011";
    const reportCode = ["11011", "11013", "11012", "11014"].includes(requestedReport) ? requestedReport : "11011";
    if (!codes.length) return json(res, 400, { error: "비교할 기업을 선택해 주세요." });
    const list = await loadCompanies();
    const selected = codes.map((code) => list.find((item) => item.corpCode === code)).filter(Boolean);
    const years = Array.from({ length: 5 }, (_, index) => endYear - 4 + index);
    const cacheKey = `compare:${selected.map((company) => company.corpCode).join(",")}:${endYear}:${reportCode}`;
    if (cache.has(cacheKey)) return json(res, 200, cache.get(cacheKey));
    // 외부 API에 수십 건을 한꺼번에 보내지 않도록 기업을 3개씩 처리합니다.
    const data = await mapLimit(selected, 3, (company) => buildCompany(company, years, reportCode));
    const payload = { year: endYear, reportCode, years, companies: data, generatedAt: new Date().toISOString() };
    if (data.some((company) => company.financials.length)) cache.set(cacheKey, payload, 30 * 60_000);
    return json(res, 200, payload);
  }
  if (url.pathname === "/api/benchmarks") {
    const codes = (url.searchParams.get("corpCodes") || "").split(",").filter(Boolean).slice(0, 10);
    const year = Number(url.searchParams.get("year")) || new Date().getFullYear() - 1;
    const requestedReport = url.searchParams.get("reportCode") || "11011";
    const reportCode = ["11011", "11013", "11012", "11014"].includes(requestedReport) ? requestedReport : "11011";
    const list = await loadCompanies();
    const selected = codes.map((code) => list.find((item) => item.corpCode === code)).filter(Boolean);
    const enriched = await mapLimit(selected, 3, async (company) => {
      const info = await dartCompanyInfo(company.corpCode);
      return { ...company, industryCode: info.induty_code || "", industry: industryLabel(info.induty_code, company.name), market: info.corp_cls === "K" ? "KOSDAQ" : "KOSPI" };
    });
    const beginDate = (url.searchParams.get("beginDate") || "").replace(/\D/g, "").slice(0, 8);
    const endDate = (url.searchParams.get("endDate") || "").replace(/\D/g, "").slice(0, 8);
    return json(res, 200, { benchmarks: await buildBenchmarks(enriched, year, reportCode, beginDate, endDate) });
  }
  if (url.pathname === "/api/discover") {
    const market = url.searchParams.get("market") === "KOSDAQ" ? "KOSDAQ" : "KOSPI";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 20), 150);
    return json(res, 200, await discoverMarket(market, limit));
  }
  if (url.pathname === "/api/industry-catalog") {
    return json(res, 200, {
      standard: "KRX 업종지수 기준 투자자용 매핑",
      note: "DART 산업코드를 원자료로 보존하고, 화면에서는 KRX 업종지수에 가까운 공통 분류로 변환합니다. 공식 지수 구성종목을 뜻하지 않습니다.",
      industries: KRX_INVESTOR_INDUSTRIES,
    });
  }
  if (url.pathname === "/api/filings") {
    const corpCode = (url.searchParams.get("corpCode") || "").replace(/\D/g, "");
    if (corpCode.length !== 8) return json(res, 400, { error: "기업을 선택해 주세요." });
    const endDate = (url.searchParams.get("endDate") || kstDate()).replace(/\D/g, "").slice(0, 8);
    const beginDate = (url.searchParams.get("beginDate") || `${Number(endDate.slice(0, 4)) - 1}${endDate.slice(4)}`).replace(/\D/g, "").slice(0, 8);
    const type = (url.searchParams.get("type") || "").toUpperCase();
    const detailType = (url.searchParams.get("detailType") || "").toUpperCase();
    const finalOnly = url.searchParams.get("finalOnly") === "Y";
    return json(res, 200, { filings: await dartFilings(corpCode, beginDate, endDate, type, detailType, finalOnly) });
  }
  if (url.pathname === "/api/naver-research") {
    const stockCode = (url.searchParams.get("stockCode") || "").replace(/\D/g, "").slice(-6);
    if (stockCode.length !== 6) return json(res, 400, { error: "종목코드를 확인해 주세요." });
    const payload = await fetchJson(`https://m.stock.naver.com/api/stock/${stockCode}/integration`);
    const items = (Array.isArray(payload?.researches) ? payload.researches : []).map((item) => ({
      id: item.id, stockCode: item.cd, company: item.nm, broker: item.bnm, title: item.tit,
      views: number(item.rcnt), date: item.wdt, url: `https://stock.naver.com/research/company/${item.id}`,
    }));
    return json(res, 200, { source: "네이버증권 공개 내부 응답(비공식)", items });
  }
  if (url.pathname === "/api/index-history") {
    const beginDate = (url.searchParams.get("beginDate") || "").replace(/\D/g, "").slice(0, 8);
    const endDate = (url.searchParams.get("endDate") || "").replace(/\D/g, "").slice(0, 8);
    const rows = await indexHistory(url.searchParams.get("name") || "코스피 200", beginDate, endDate);
    return json(res, 200, {
      name: "코스피 200",
      history: rows.map((row) => ({ date: row.basDt, close: number(row.clpr), volume: number(row.trqu) })).filter((row) => Number.isFinite(row.close)),
    });
  }
  if (url.pathname === "/api/backtest-data") {
    const codes = (url.searchParams.get("corpCodes") || "").split(",").filter(Boolean).slice(0, 10);
    const beginDate = (url.searchParams.get("beginDate") || "20200101").replace(/\D/g, "").slice(0, 8);
    const endDate = (url.searchParams.get("endDate") || kstDate()).replace(/\D/g, "").slice(0, 8);
    if (!codes.length) return json(res, 400, { error: "백테스트 종목을 선택해 주세요." });
    const list = await loadCompanies();
    const selected = codes.map((code) => code.startsWith("ETF:")
      ? { corpCode: code, assetId: code, stockCode: code.slice(4), name: code.slice(4), assetType: "ETF" }
      : list.find((item) => item.corpCode === code)).filter(Boolean);
    if (selected.some((item) => item.assetType === "ETF")) {
      try { const { rows } = await krxEtfRows(); const names = new Map(rows.map((row) => [String(row.ISU_CD || "").padStart(6, "0"), row.ISU_NM])); selected.forEach((item) => { if (item.assetType === "ETF") item.name = names.get(item.stockCode) || item.name; }); } catch {}
    }
    const companyRows = await mapLimit(selected, 3, async (company) => {
      const raw = await (company.assetType === "ETF" ? etfHistory(company.stockCode, beginDate, endDate) : marketHistory(company.stockCode, beginDate, endDate));
      const sources = [...new Set(raw.map((row) => row.dataSource).filter(Boolean))];
      const warnings = [...new Set(raw.map((row) => row.sourceWarning).filter(Boolean))];
      return {
        ...company,
        dataSources: sources,
        sourceOfficial: raw.length ? raw.every((row) => row.sourceOfficial !== false) : null,
        dataWarnings: warnings,
        history: raw.map((row) => ({
          date: row.basDt,
          close: number(row.clpr),
          volume: number(row.trqu),
          dataSource: row.dataSource || null,
          sourceOfficial: row.sourceOfficial !== false,
          qualityFlag: row.qualityFlag || "valid",
        })).filter((row) => Number.isFinite(row.close)),
      };
    });
    const benchmarkRows = await indexHistory("코스피 200", beginDate, endDate);
    return json(res, 200, {
      beginDate, endDate,
      companies: companyRows,
      benchmark: {
        name: "코스피 200",
        dataSources: [...new Set(benchmarkRows.map((row) => row.dataSource).filter(Boolean))],
        sourceOfficial: benchmarkRows.length ? benchmarkRows.every((row) => row.sourceOfficial !== false) : null,
        history: benchmarkRows.map((row) => ({ date: row.basDt, close: number(row.clpr), dataSource: row.dataSource || null, sourceOfficial: row.sourceOfficial !== false })).filter((row) => Number.isFinite(row.close)),
      },
    });
  }
  return json(res, 404, { error: "API를 찾을 수 없습니다." });
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

export async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname !== "/api/health" && !withinRateLimit(req, res)) return;
      return await api(req, res, url);
    }
    const requested = url.pathname === "/" ? "home.html" : url.pathname.slice(1);
    const filePath = path.resolve(PUBLIC_DIR, requested);
    if (!filePath.startsWith(path.resolve(PUBLIC_DIR))) throw new Error("잘못된 경로입니다.");
    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mime[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": [".html", ".js", ".css"].includes(path.extname(filePath)) ? "no-cache" : "public, max-age=3600",
      ...securityHeaders(),
    });
    res.end(body);
  } catch (error) {
    if (req.url.startsWith("/api/")) return json(res, 500, { error: error.message });
    try {
      const body = await readFile(path.join(PUBLIC_DIR, "home.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", ...securityHeaders() });
      res.end(body);
    } catch { res.writeHead(500); res.end("Server error"); }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await loadCompanies();
  const server = http.createServer(handleRequest);
  server.listen(PORT, HOST, () => console.log(`FinScope: http://localhost:${PORT}`));
}
