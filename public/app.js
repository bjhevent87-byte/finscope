import { CRITERION_GROUPS } from "./criterion-groups.js";
import { assessCriteria, rankByCriteria } from "./criteria-score.js";

const state = {
  selected: JSON.parse(localStorage.getItem("compareCompanies") || "[]"),
  data: null,
  metric: "operatingMargin",
  chartMode: "financial",
  discovery: null,
  benchmarks: {},
  marketIndex: null,
  returnData: null,
  returnView: { start: 0, end: 1 },
  longPriceData: {},
  screenedCandidates: null,
  screeningDetails: new Map(),
  movingAverages: JSON.parse(localStorage.getItem("movingAverages") || "[5,20,60,120]"),
  criteria: JSON.parse(localStorage.getItem("investmentCriteria") || '[{"metric":"operatingMargin","operator":">=","value":10},{"metric":"roe","operator":">=","value":10},{"metric":"debtRatio","operator":"<=","value":100},{"metric":"fcf","operator":">","value":0}]'),
  criterionGroup: localStorage.getItem("criterionGroup") || "growth",
  comparisonOrder: "criteria",
  chartSelectionMode: "automatic",
  manualChartCodes: [],
};

const metrics = {
  price: { label: "최신 수신 종가", unit: "원", format: won, source: "금융위원회", chartable: false },
  marketCap: { label: "시가총액", unit: "원", format: money, source: "금융위원회", chartable: false },
  revenue: { label: "매출", unit: "원", format: money, source: "DART" },
  operatingProfit: { label: "영업이익", unit: "원", format: money, source: "DART" },
  netIncome: { label: "순이익", unit: "원", format: money, source: "DART" },
  interestRevenue: { label: "이자수익", unit: "원", format: money, source: "DART" },
  feeIncome: { label: "수수료수익", unit: "원", format: money, source: "DART" },
  insuranceRevenue: { label: "보험수익", unit: "원", format: money, source: "DART" },
  assets: { label: "자산총계", unit: "원", format: money, source: "DART" },
  liabilities: { label: "부채총계", unit: "원", format: money, source: "DART" },
  equity: { label: "자본총계", unit: "원", format: money, source: "DART" },
  operatingCashFlow: { label: "영업현금흐름", unit: "원", format: money, source: "DART" },
  capex: { label: "CAPEX", unit: "원", format: money, source: "DART" },
  operatingMargin: { label: "영업이익률", unit: "%", format: percent, source: "계산" },
  netMargin: { label: "순이익률", unit: "%", format: percent, source: "계산" },
  debtRatio: { label: "부채비율", unit: "%", format: percent, source: "계산" },
  roe: { label: "ROE", unit: "%", format: percent, source: "계산" },
  fcf: { label: "FCF", unit: "원", format: money, source: "계산" },
  fcfMargin: { label: "FCF 마진", unit: "%", format: percent, source: "계산" },
  revenueGrowth: { label: "매출 성장률", unit: "%", format: percent, source: "계산", chartable: false },
  operatingProfitGrowth: { label: "영업이익 성장률", unit: "%", format: percent, source: "계산", chartable: false },
  per: { label: "PER*", unit: "배", format: multiple, source: "계산", chartable: false },
  pbr: { label: "PBR*", unit: "배", format: multiple, source: "계산", chartable: false },
  fcfYield: { label: "FCF Yield*", unit: "%", format: percent, source: "계산", chartable: false },
  return1M: { label: "최근 1개월", unit: "%", format: percent, source: "금융위원회", chartable: false },
  return3M: { label: "최근 3개월", unit: "%", format: percent, source: "금융위원회", chartable: false },
  return6M: { label: "최근 6개월", unit: "%", format: percent, source: "금융위원회", chartable: false },
  return1Y: { label: "최근 1년", unit: "%", format: percent, source: "금융위원회", chartable: false },
  dividendYield: { label: "배당수익률", unit: "%", format: percent, source: "DART", chartable: false },
  dividendPerShare: { label: "주당배당금", unit: "원", format: won, source: "DART", chartable: false },
};

const metricDescriptions = {
  price: "금융위원회 API에서 현재 수신 가능한 가장 최근 일별 종가입니다. 실시간이 아니며 영업일 다음 날 오후 1시 이후 갱신됩니다.",
  marketCap: "확정 종가에 상장주식수를 곱한 기업의 시장가치입니다.",
  revenue: "보고기간 동안 고객에게 재화와 서비스를 제공해 얻은 수익입니다.",
  operatingProfit: "본업에서 발생한 이익으로, 매출에서 영업비용을 차감합니다.",
  netIncome: "영업외손익과 세금까지 반영한 최종 이익입니다.",
  interestRevenue: "금융회사가 대출·채권 등에서 인식해 공시한 이자수익입니다. 이자비용을 차감한 순이자이익과는 다릅니다.",
  feeIncome: "금융회사가 카드·증권·은행 서비스 등에서 인식해 공시한 수수료수익입니다.",
  insuranceRevenue: "보험계약 서비스 제공으로 인식해 공시한 보험수익입니다. 회사에 따라 공시하지 않을 수 있습니다.",
  assets: "기업이 보유하거나 통제하는 경제적 자원의 총액입니다.",
  liabilities: "기업이 미래에 상환해야 하는 의무의 총액입니다.",
  equity: "자산에서 부채를 차감한 주주 귀속 장부가치입니다.",
  operatingCashFlow: "본업을 통해 실제로 유입·유출된 현금의 순액입니다.",
  capex: "유형자산 취득에 사용한 투자지출입니다. 성장투자와 유지투자를 구분해 해석해야 합니다.",
  operatingMargin: "영업이익÷매출×100. 높을수록 본업의 수익성이 좋지만 반드시 동종업계와 비교해야 합니다.",
  netMargin: "순이익÷매출×100. 금융비용·세금·일회성 손익까지 반영합니다.",
  debtRatio: "부채÷자본×100. 낮을수록 일반적으로 재무 부담이 작지만 금융업 등은 업종별 기준이 다릅니다.",
  roe: "순이익÷기말 자본×100의 단순 ROE입니다. 평균자본 ROE와 차이가 날 수 있습니다.",
  fcf: "영업현금흐름-유형자산 취득액으로 계산한 단순 잉여현금흐름입니다.",
  fcfMargin: "FCF÷매출×100. 매출이 실제 잉여현금으로 전환되는 정도를 봅니다.",
  revenueGrowth: "동일 보고기간의 전년 대비 매출 증가율입니다.",
  operatingProfitGrowth: "동일 보고기간의 전년 대비 영업이익 증가율입니다.",
  per: "시가총액÷순이익의 단순 계산값입니다. 일회성 손익과 적자 기업에 주의해야 합니다.",
  pbr: "시가총액÷자본총계의 단순 계산값입니다. 자산의 질과 ROE를 함께 봐야 합니다.",
  fcfYield: "FCF÷시가총액×100. 높을수록 가격 대비 현금창출력이 크다는 의미지만 CAPEX 사이클을 확인해야 합니다.",
  return1M: "금융위원회 일별 종가 기준 최근 20거래일 가격수익률입니다.",
  return3M: "금융위원회 일별 종가 기준 최근 60거래일 가격수익률입니다.",
  return6M: "금융위원회 일별 종가 기준 최근 120거래일 가격수익률입니다.",
  return1Y: "금융위원회 일별 종가 기준 최근 251거래일 가격수익률입니다. 배당은 포함하지 않습니다.",
  dividendYield: "최근 확인 가능한 DART 사업보고서의 보통주 현금배당수익률입니다.",
  dividendPerShare: "최근 확인 가능한 DART 사업보고서의 보통주 1주당 현금배당금입니다.",
};

const metricGuides = {
  operatingMargin: { operator: ">=", value: 10, text: "영업이익÷매출×100. 일반적으로 10% 이상을 우수 후보로 보지만 업종별 차이가 큽니다." },
  roe: { operator: ">=", value: 10, text: "순이익÷자본×100. 10% 이상을 참고선으로 사용하며 부채와 일회성 이익을 함께 확인합니다." },
  debtRatio: { operator: "<=", value: 100, text: "부채÷자본×100. 일반기업은 100% 이하를 보수적 참고선으로 보지만 금융업에는 부적합합니다." },
  fcf: { operator: ">", value: 0, text: "영업현금흐름-CAPEX. 0보다 크면 투자 후에도 현금이 남았다는 뜻입니다." },
  revenueGrowth: { operator: ">=", value: 5, text: "전년 대비 매출 증가율. 물가와 산업 성장률을 고려해 5% 이상을 참고선으로 둡니다." },
  operatingProfitGrowth: { operator: ">=", value: 10, text: "전년 대비 영업이익 증가율. 변동성이 커 여러 기간을 함께 봐야 합니다." },
  per: { operator: "<=", value: 15, text: "시가총액÷순이익. 15배 이하는 단순 참고선이며 성장률과 업종 PER을 함께 봅니다." },
  pbr: { operator: "<=", value: 1.5, text: "시가총액÷자본. 1.5배 이하는 참고선이며 ROE가 낮으면 싼 이유가 있을 수 있습니다." },
  fcfYield: { operator: ">=", value: 5, text: "FCF÷시가총액×100. 5% 이상을 현금창출력 참고선으로 활용합니다." },
  dividendYield: { operator: ">=", value: 2, text: "최근 사업보고서 현금배당수익률. 배당 지속성과 이익·현금흐름을 함께 확인합니다." },
  return3M: { operator: ">=", value: 0, text: "최근 60거래일 가격수익률. 0% 이상은 단기 상대강도 확인용이며 매수 신호는 아닙니다." },
};

const reportNames = { "11011": "4분기·연간 사업보고서", "11013": "1분기보고서", "11012": "반기보고서", "11014": "3분기보고서" };

const colors = ["#3182f6", "#f97316", "#6366f1", "#a855f7", "#14b8a6", "#ef4444", "#84a928", "#334155", "#d6a21e", "#8b6f5a"];
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const financialUnsupportedMetrics = new Set(["revenue", "revenueGrowth", "operatingProfitGrowth", "operatingMargin", "netMargin", "debtRatio", "operatingCashFlow", "capex", "fcf", "fcfMargin", "fcfYield"]);

function money(value) {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(abs >= 1e14 ? 0 : 1)}조`;
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(0)}억`;
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(0)}만`;
  return value.toLocaleString("ko-KR");
}

function won(value) {
  return Number.isFinite(value) ? `${Math.round(value).toLocaleString("ko-KR")}원` : "—";
}

function percent(value, suffix = "%") {
  return Number.isFinite(value) ? `${value.toFixed(1)}${suffix}` : "—";
}

function multiple(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}배` : "—";
}

function renderYears() {
  const reportCode = $("#report-select").value;
  const year = new Date().getFullYear() - (reportCode === "11011" ? 1 : 0);
  $("#year-select").innerHTML = Array.from({ length: 8 }, (_, i) => year - i)
    .map((item) => `<option value="${item}">${item}</option>`).join("");
}

function renderSelected() {
  localStorage.setItem("compareCompanies", JSON.stringify(state.selected));
  $("#selected-count").textContent = state.selected.length;
  $("#selected-companies").innerHTML = state.selected.map((company) => `
    <span class="company-chip">${company.name}<button data-remove="${company.corpCode}" aria-label="${company.name} 제거">×</button></span>
  `).join("");
  document.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => {
    state.selected = state.selected.filter((item) => item.corpCode !== button.dataset.remove);
    renderSelected();
  }));
  if (state.discovery) renderLeaderList();
}

$("#clear-selected").addEventListener("click", () => {
  state.selected = [];
  state.data = null;
  renderSelected();
  $("#results").hidden = true;
  showStatus("비교함을 비웠습니다. 조건으로 후보를 찾거나 기업을 검색해 주세요.", false, false);
});

function criterionMetricKeys() {
  return [...new Set(state.criteria.map((criterion) => criterion.metric).filter((key) => metrics[key]))];
}

function renderMetricButtons() {
  const selectedMetrics = criterionMetricKeys().map((key) => [key, metrics[key]]);
  if (selectedMetrics.length && !selectedMetrics.some(([key]) => key === state.metric)) state.metric = selectedMetrics[0][0];
  if (!selectedMetrics.length) state.metric = null;
  const markup = selectedMetrics.map(([key, metric]) => `
    <button class="metric-button ${state.metric === key ? "active" : ""}" data-metric="${key}" title="${metric.chartable === false ? "선택 기업의 현재값 비교" : "5개년 공시 추이"}">${metric.label}</button>
  `).join("") || '<span class="empty-metrics">나만의 투자조건에서 지표를 추가하면 여기에 자동으로 나타납니다.</span>';
  $("#metric-buttons").innerHTML = markup;
  const chartButtons = $("#chart-metric-buttons");
  if (chartButtons) chartButtons.innerHTML = markup;
  document.querySelectorAll("[data-metric]").forEach((button) => button.addEventListener("click", () => {
    state.metric = button.dataset.metric;
    renderMetricButtons();
    if (state.data) renderResults();
  }));
}

function metricValue(company, key) {
  if (["price", "marketCap", "return1M", "return3M", "return6M", "return1Y"].includes(key)) return company.market?.[key] ?? null;
  if (["dividendYield", "dividendPerShare"].includes(key)) return company.dividend?.[key] ?? null;
  if (["revenueGrowth", "operatingProfitGrowth", "per", "pbr", "fcfYield"].includes(key)) return company.evaluation?.[key] ?? null;
  return company.latest?.[key] ?? null;
}

function visibleMetricKeys(companies) {
  const mandatory = ["price", "marketCap", "return1M", "return3M", "return6M", "return1Y"];
  const dividends = ["dividendYield", "dividendPerShare"];
  return [...new Set([...mandatory, ...criterionMetricKeys().filter((key) => !mandatory.includes(key) && !dividends.includes(key)), ...dividends])];
}

function savePreferences() {
  localStorage.setItem("investmentCriteria", JSON.stringify(state.criteria));
  localStorage.removeItem("visibleMetrics");
}

function criterionApplicable(company, criterion) {
  return !(company.isFinancial && financialUnsupportedMetrics.has(criterion.metric));
}

function criterionAssessment(company) {
  return assessCriteria(company, state.criteria, metricValue, criterionApplicable);
}

function companyPassesCriteria(company) {
  return criterionAssessment(company).passes;
}

function analysisCompanies() {
  const companies = state.data?.companies || [];
  return $("#filter-passed")?.checked ? companies.filter(companyPassesCriteria) : companies;
}

function orderedCompanies() {
  const companies = analysisCompanies();
  if (state.comparisonOrder === "selected" || !state.criteria.length) return companies;
  const assessments = Object.fromEntries(companies.map((company) => [company.corpCode, criterionAssessment(company)]));
  return rankByCriteria(companies, assessments);
}

function chartCompanies(limit = 5) {
  const companies = orderedCompanies();
  if (state.chartSelectionMode !== "manual") return companies.slice(0, limit);
  return state.manualChartCodes.map((code) => companies.find((company) => company.corpCode === code))
    .filter(Boolean).slice(0, limit);
}

function chartScopeLabel(count, limit) {
  const scope = $("#filter-passed").checked ? "조건 통과 기업" : "비교함 전체 기업";
  if (state.chartSelectionMode === "manual") return `${scope} ${count}개 중 직접 고른 기업 ${chartCompanies(limit).length}개 표시`;
  return count > limit
    ? `${scope} ${count}개 중 ${state.comparisonOrder === "criteria" && state.criteria.length ? "내 조건 적합도" : "비교함 순서"} 앞 ${limit}개만 차트에 표시합니다. 전체 값은 위 표에서 확인하세요.`
    : `${scope} ${count}개를 차트에 표시합니다.`;
}

function invalidateScreening(message = "바뀐 조건으로 기업을 다시 찾아주세요.") {
  state.screenedCandidates = null;
  state.screeningDetails = new Map();
  const status = $("#screen-status");
  if (status) status.textContent = message;
  if (state.discovery) renderLeaderList();
}

function positionCanvasTooltip(tooltipId, canvas, event, html) {
  const tooltip = $(tooltipId);
  if (!tooltip) return;
  const bounds = canvas.getBoundingClientRect();
  const x = Math.max(12, Math.min(bounds.width - 12, event.clientX - bounds.left));
  const y = Math.max(12, Math.min(bounds.height - 12, event.clientY - bounds.top));
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  tooltip.classList.toggle("align-right", x > bounds.width * .63);
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideCanvasTooltip(tooltipId) {
  const tooltip = $(tooltipId);
  if (tooltip) tooltip.hidden = true;
}

function renderCriterionCatalog() {
  const selectedGroup = CRITERION_GROUPS.find((group) => group.id === state.criterionGroup) || CRITERION_GROUPS[0];
  const selectedMetrics = new Set(criterionMetricKeys());
  $("#criterion-catalog").innerHTML = `
    <div class="criterion-group-tabs" aria-label="조건 지표 분류">
      ${CRITERION_GROUPS.map((group) => `<button type="button" class="criterion-group-tab ${group.id === selectedGroup.id ? "active" : ""}" data-criterion-group="${group.id}" aria-pressed="${group.id === selectedGroup.id}"><strong>${group.title}</strong><small>${group.metrics.filter((key) => selectedMetrics.has(key)).length}/${group.metrics.length} 선택</small></button>`).join("")}
    </div>
    <div class="criterion-group-info"><strong>${selectedGroup.title}</strong><p>${selectedGroup.note}</p></div>
    <div class="criterion-group-grid">${selectedGroup.metrics.map((key) => {
      const metric = metrics[key];
      const guide = metricGuides[key] || { operator: ">=", value: 0, text: metricDescriptions[key] };
      const selected = selectedMetrics.has(key);
      return `<button type="button" class="criterion-preset ${selected ? "is-selected" : ""}" data-criterion-metric="${key}"><b>${selected ? "✓" : "+"} ${metric.label}</b><span>${metricGuides[key] ? `${guide.operator} ${guide.value}${metric.unit}` : "기준 직접 설정"}</span><small>${guide.text}</small></button>`;
    }).join("")}</div>`;
  document.querySelectorAll("[data-criterion-group]").forEach((button) => button.addEventListener("click", () => {
    state.criterionGroup = button.dataset.criterionGroup;
    localStorage.setItem("criterionGroup", state.criterionGroup);
    renderCriterionCatalog();
  }));
  document.querySelectorAll("[data-criterion-metric]").forEach((button) => button.addEventListener("click", () => {
    const metric = button.dataset.criterionMetric;
    const existingIndex = state.criteria.findIndex((criterion) => criterion.metric === metric);
    if (existingIndex >= 0) {
      $(".criterion-catalog").open = false;
      document.querySelector(`.criterion-row[data-index="${existingIndex}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    const guide = metricGuides[metric] || { operator: ">=", value: 0 };
    state.criteria.push({ metric, operator: guide.operator, value: guide.value });
    state.metric = metric;
    savePreferences(); invalidateScreening(); renderCriteria(); renderMetricButtons(); if (state.data) renderResults();
    $(".criterion-catalog").open = false;
    document.querySelector(`.criterion-row[data-index="${state.criteria.length - 1}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }));
}

function renderCriteria() {
  const options = Object.entries(metrics).map(([key, metric]) => `<option value="${key}">${metric.label} (${metric.unit})</option>`).join("");
  $("#criteria-list").innerHTML = state.criteria.map((criterion, index) => `
    <div class="criterion-row" data-index="${index}">
      <select class="criterion-metric" aria-label="비교 지표">${options}</select>
      <select class="criterion-operator" aria-label="비교 방법"><option>&gt;=</option><option>&lt;=</option><option>&gt;</option><option>&lt;</option><option>=</option></select>
      <input class="criterion-value" type="number" step="any" value="${criterion.value}" aria-label="기준값" />
      <button class="criterion-remove" aria-label="조건 삭제">×</button>
    </div>
  `).join("");
  document.querySelectorAll(".criterion-row").forEach((row) => {
    const index = Number(row.dataset.index);
    row.querySelector(".criterion-metric").value = state.criteria[index].metric;
    row.querySelector(".criterion-operator").value = state.criteria[index].operator;
    row.querySelector(".criterion-metric").addEventListener("change", (event) => { state.criteria[index].metric = event.target.value; state.metric = event.target.value; savePreferences(); invalidateScreening(); renderCriteria(); renderMetricButtons(); if (state.data) renderResults(); });
    row.querySelector(".criterion-operator").addEventListener("change", (event) => { state.criteria[index].operator = event.target.value; savePreferences(); invalidateScreening(); if (state.data) renderResults(); });
    row.querySelector(".criterion-value").addEventListener("input", (event) => { state.criteria[index].value = Number(event.target.value); savePreferences(); invalidateScreening(); if (state.data) renderResults(); });
    row.querySelector(".criterion-remove").addEventListener("click", () => { state.criteria.splice(index, 1); savePreferences(); invalidateScreening(); renderCriteria(); renderMetricButtons(); if (state.data) renderResults(); });
  });
  renderCriterionCatalog();
}

$("#add-criterion").addEventListener("click", () => {
  const catalog = $(".criterion-catalog");
  catalog.open = true;
  catalog.scrollIntoView({ block: "start", behavior: "smooth" });
});
$("#filter-passed").addEventListener("change", () => state.data && renderResults());

async function loadDiscovery() {
  const button = $("#discover-button");
  button.disabled = true; button.textContent = "불러오는 중…";
  $("#leader-list").innerHTML = "<p>KRX 상위 종목과 DART 산업분류를 결합하고 있습니다.</p>";
  try {
    const market = $("#market-select").value;
    const response = await fetch(`/api/discover?market=${market}&limit=100`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "목록 조회 실패");
    state.discovery = payload;
    state.screenedCandidates = null;
    state.screeningDetails = new Map();
    const industries = [...new Set(payload.companies.map((item) => item.industry))].sort((a, b) => a.localeCompare(b, "ko"));
    $("#industry-select").innerHTML = `<option value="all">전체 업종</option>${industries.map((item) => `<option>${item}</option>`).join("")}`;
    renderLeaderList();
    $("#screen-status").textContent = `${payload.companies.length}개 기업을 불러왔어요. 조건에 맞는 기업을 찾아보세요.`;
  } catch (error) { $("#leader-list").innerHTML = `<p>${error.message}</p>`; }
  finally { button.disabled = false; button.textContent = "목록 새로고침"; }
}

function currentDiscoveryItems() {
  if (!state.discovery) return [];
  const industry = $("#industry-select").value;
  const count = Number($("#leader-count").value);
  return state.discovery.companies
    .filter((item) => industry === "all" || item.industry === industry)
    .slice(0, count);
}

function renderLeaderList() {
  if (!state.discovery) return;
  const candidates = currentDiscoveryItems();
  const items = state.screenedCandidates
    ? candidates.filter((item) => state.screenedCandidates.has(item.corpCode))
    : candidates;
  $("#leader-list").innerHTML = items.length ? items.map((item, index) => {
    const selected = state.selected.some((company) => company.corpCode === item.corpCode);
    const detail = state.screeningDetails.get(item.corpCode);
    const passLabel = state.screenedCandidates ? `<small class="screen-pass">${state.criteria.length ? `내 조건 ${detail?.passCount ?? 0}/${detail?.criterionCount ?? 0}개 충족` : "설정한 조건 없음"}</small>` : "";
    return `<div class="leader-item"><span class="leader-rank">${String(index + 1).padStart(2, "0")}</span><span class="leader-name">${item.name}<small>${item.industry} · ${item.stockCode}</small>${passLabel}</span><span class="leader-value">${money(item.marketCap)}<small class="subvalue">${percent(item.changeRate)}</small></span><button class="add-company" data-add-corp="${item.corpCode}" ${selected || state.selected.length >= 10 ? "disabled" : ""}>${selected ? "담김" : "+ 담기"}</button></div>`;
  }).join("") : `<p>${state.screenedCandidates ? "현재 조건을 모두 통과한 기업이 없습니다. 기준을 조정해 보세요." : "선택한 범위에 표시할 종목이 없습니다."}</p>`;
  document.querySelectorAll("[data-add-corp]").forEach((button) => button.addEventListener("click", () => {
    const item = state.discovery.companies.find((company) => company.corpCode === button.dataset.addCorp);
    if (item && state.selected.length < 10) { state.selected.push(item); renderSelected(); }
  }));
}

async function screenDiscoveryCandidates() {
  const button = $("#screen-button");
  const status = $("#screen-status");
  if (!state.discovery) await loadDiscovery();
  const candidates = currentDiscoveryItems();
  if (!candidates.length) return;
  button.disabled = true;
  state.screenedCandidates = new Set();
  state.screeningDetails = new Map();
  try {
    for (let offset = 0; offset < candidates.length; offset += 10) {
      const batch = candidates.slice(offset, offset + 10);
      status.textContent = `재무·시장 데이터를 확인하고 있습니다. ${Math.min(offset + batch.length, candidates.length)}/${candidates.length}`;
      const params = new URLSearchParams({ corpCodes: batch.map((item) => item.corpCode).join(","), year: $("#year-select").value, reportCode: $("#report-select").value });
      const response = await fetch(`/api/compare?${params}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "조건에 맞는 기업을 찾지 못했습니다.");
      payload.companies.forEach((company) => {
        const result = criterionAssessment(company);
        state.screeningDetails.set(company.corpCode, { passCount: result.passed, criterionCount: result.applicable });
        if (result.passes) state.screenedCandidates.add(company.corpCode);
      });
    }
    status.textContent = `${candidates.length}개 중 ${state.screenedCandidates.size}개가 모든 조건을 통과했습니다.`;
    renderLeaderList();
  } catch (error) {
    state.screenedCandidates = null;
    status.textContent = error.message;
    renderLeaderList();
  } finally {
    button.disabled = false;
  }
}

$("#discover-button").addEventListener("click", loadDiscovery);
$("#screen-button").addEventListener("click", screenDiscoveryCandidates);
$("#market-select").addEventListener("change", loadDiscovery);
$("#industry-select").addEventListener("change", () => { invalidateScreening("업종을 바꿨어요. 조건에 맞는 기업을 다시 찾아주세요."); renderLeaderList(); });
$("#leader-count").addEventListener("change", () => { invalidateScreening("표시 개수를 바꿨어요. 기업을 다시 찾아주세요."); renderLeaderList(); });
$("#report-select").addEventListener("change", () => { renderYears(); invalidateScreening("보고서를 바꿨어요. 기업을 다시 찾아주세요."); });
$("#year-select").addEventListener("change", () => invalidateScreening("연도를 바꿨어요. 기업을 다시 찾아주세요."));

let searchTimer;
$("#company-search").addEventListener("input", (event) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => searchCompanies(event.target.value), 220);
});

async function searchCompanies(query) {
  const panel = $("#search-results");
  if (!query.trim()) { panel.hidden = true; return; }
  try {
    const response = await fetch(`/api/companies?q=${encodeURIComponent(query)}`);
    const items = await response.json();
    panel.innerHTML = items.length ? items.map((item) => `
      <button class="search-result" data-company='${JSON.stringify(item)}'><strong>${item.name}</strong><span>${item.stockCode}</span></button>
    `).join("") : `<div class="search-result">검색 결과가 없습니다.</div>`;
    panel.hidden = false;
    panel.querySelectorAll("[data-company]").forEach((button) => button.addEventListener("click", () => {
      const company = JSON.parse(button.dataset.company);
      if (state.selected.length >= 10 || state.selected.some((item) => item.corpCode === company.corpCode)) return;
      state.selected.push(company);
      renderSelected();
      panel.hidden = true;
      $("#company-search").value = "";
    }));
  } catch { panel.innerHTML = `<div class="search-result">기업 검색에 실패했습니다.</div>`; panel.hidden = false; }
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-panel")) $("#search-results").hidden = true;
});

function showStatus(message, error = false, spinning = true) {
  const panel = $("#status-panel");
  panel.hidden = false;
  panel.className = `status-panel${error ? " error" : ""}`;
  panel.innerHTML = `${spinning ? '<div class="spinner"></div>' : ""}<span>${message}</span>`;
}

async function runAnalysis() {
  if (!state.selected.length) return showStatus("비교할 기업을 한 곳 이상 선택해 주세요.", true, false);
  const button = $("#run-button");
  button.disabled = true;
  $("#results").hidden = true;
  const companyCount = state.selected.length;
  showStatus(`${companyCount}개 기업의 공시와 시장 데이터를 3개씩 나누어 불러오고 있습니다.`);
  const slowTimer = setTimeout(() => showStatus(`공식 API 응답을 기다리고 있습니다. ${companyCount}개 기업은 첫 조회에 시간이 조금 더 걸릴 수 있어요.`), 12000);
  try {
    const params = new URLSearchParams({ corpCodes: state.selected.map((item) => item.corpCode).join(","), year: $("#year-select").value, reportCode: $("#report-select").value });
    const response = await fetch(`/api/compare?${params}`, { signal: AbortSignal.timeout(90000) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "분석에 실패했습니다.");
    state.data = payload;
    if (payload.companies.length && payload.companies.every((company) => company.isFinancial) && financialUnsupportedMetrics.has(state.metric)) {
      state.metric = "roe";
      renderMetricButtons();
    }
    state.benchmarks = {};
    state.returnData = null;
    state.longPriceData = {};
    $("#status-panel").hidden = true;
    $("#results").hidden = false;
    renderResults();
    loadBenchmarks(params);
  } catch (error) {
    const message = error.name === "TimeoutError"
      ? "공식 API 응답이 90초를 넘었습니다. 잠시 후 다시 분석하거나 기업 수를 줄여 확인해 주세요."
      : error.message;
    showStatus(message, true, false);
  }
  finally { clearTimeout(slowTimer); button.disabled = false; }
}

async function loadBenchmarks(params) {
  try {
    const range = chartDateRange($("#return-period")?.value || "1");
    const query = new URLSearchParams(params);
    query.set("beginDate", range.beginDate); query.set("endDate", range.endDate);
    const response = await fetch(`/api/benchmarks?${query}`);
    const payload = await response.json();
    if (!response.ok) return;
    state.benchmarks = Object.fromEntries(payload.benchmarks.map((item) => [item.corpCode, item]));
    renderResults();
  } catch {}
}

function chartDateRange(period) {
  const end = new Date(), start = new Date(end);
  if (period === "max") start.setFullYear(2020, 0, 1);
  else start.setFullYear(start.getFullYear() - Number(period || 1));
  const compact = (date) => date.toISOString().slice(0, 10).replaceAll("-", "");
  return { beginDate: compact(start), endDate: compact(end) };
}

async function loadLongMarket(period, target = "return") {
  const companies = target === "return" ? chartCompanies(4) : orderedCompanies();
  if (!companies.length) return null;
  const range = chartDateRange(period), codes = companies.map((item) => item.corpCode).join(",");
  const key = `${codes}:${range.beginDate}:${range.endDate}`;
  if (target === "return" && state.returnData?.key === key) return state.returnData.payload;
  const query = new URLSearchParams({ corpCodes: codes, ...range });
  const payload = await fetch(`/api/backtest-data?${query}`).then((response) => response.json());
  if (payload.error) throw new Error(payload.error);
  if (target === "return") state.returnData = { key, payload };
  return payload;
}

$("#run-button").addEventListener("click", runAnalysis);

function signalClass(value) {
  if (["강함", "매수 가능"].includes(value)) return "good";
  if (["주의", "기술적 경계"].includes(value)) return "caution";
  return "neutral";
}

function renderComparisonAssessment(companies) {
  const selectedCount = state.criteria.length;
  const cards = companies.map((company) => {
    const result = criterionAssessment(company);
    const status = !selectedCount ? "조건을 먼저 골라주세요" : !result.applicable ? "이 기업에 적용할 조건 없음" : `선택 조건 ${result.passed}/${selectedCount}개 충족`;
    const exceptions = [result.missing ? `자료 없음 ${result.missing}개` : "", result.notApplicable ? `업종상 제외 ${result.notApplicable}개` : ""].filter(Boolean).join(" · ");
    const checks = result.checks.map((check) => {
      const metric = metrics[check.criterion.metric];
      const actual = check.available ? metric?.format(check.value) || String(check.value) : check.applicable ? "자료 없음" : "업종상 적용 제외";
      const target = `${check.criterion.operator} ${metric?.format(check.target) || check.target}`;
      const verdict = !check.applicable ? "적용 제외" : !check.available ? "확인 불가" : check.passed ? "충족" : "미충족";
      return `<li><span><b>${esc(metric?.label || check.criterion.metric)}</b><small>실제 ${esc(actual)} · 내 기준 ${esc(target)}</small></span><strong class="criterion-verdict ${check.passed ? "is-met" : ""}">${verdict}</strong></li>`;
    }).join("");
    const score = Number.isFinite(result.score) ? `${result.score}<small>점</small>` : selectedCount ? '<small class="assessment-unscored">점수 보류</small>' : "—";
    return `<article class="comparison-assessment-card"><div class="assessment-company"><b>${esc(company.name)}</b><small>${esc(company.industry || "업종 확인 필요")}</small></div><strong class="assessment-score">${score}</strong><p class="assessment-status">${status}${exceptions ? ` <span>추가 확인: ${exceptions}</span>` : ""}</p><details><summary>적용된 조건과 실제 값 보기</summary><ul>${checks || "<li>선택한 조건이 없습니다.</li>"}</ul></details></article>`;
  });
  const remaining = cards.slice(5);
  $("#comparison-assessment").innerHTML = `<div class="comparison-assessment-heading"><div><h4>내 조건 적합도</h4><p>직접 선택한 ${selectedCount}개 조건만 점수에 반영합니다. 각 기업의 실제 값은 카드를 열어 확인하세요.</p></div></div><div class="comparison-assessment-list">${cards.slice(0, 5).join("") || "<p>표시할 기업이 없습니다.</p>"}</div>${remaining.length ? `<details class="comparison-assessment-more"><summary>나머지 ${remaining.length}개 기업의 조건 결과 보기</summary><div class="comparison-assessment-list">${remaining.join("")}</div></details>` : ""}<details class="assessment-method"><summary>점수 계산 기준</summary><p>선택한 조건을 같은 비중으로 계산합니다. 모든 조건에 해당 수치가 있을 때만 충족 수 ÷ 선택 조건 수 × 100으로 점수를 냅니다. 자료가 없거나 업종에 맞지 않는 조건이 있으면 점수를 보류하고 이유를 표시합니다. 이 점수는 투자 추천이나 업종 간 우열이 아닙니다.</p><p>재무값은 ${state.data.year}년 ${reportNames[state.data.reportCode]} 기준이며, 가격·주가 지표는 최신 수신일 기준입니다. 최신 분기 실적은 기업 분석에서 별도로 확인하세요.</p></details>`;
}

function renderChartChoices() {
  const container = $("#chart-company-options");
  container.hidden = state.chartSelectionMode !== "manual";
  if (container.hidden) return;
  const companies = orderedCompanies();
  const visibleCodes = new Set(companies.map((company) => company.corpCode));
  state.manualChartCodes = state.manualChartCodes.filter((code) => visibleCodes.has(code));
  container.innerHTML = companies.map((company) => {
    const selected = state.manualChartCodes.includes(company.corpCode);
    return `<label><input type="checkbox" value="${company.corpCode}" ${selected ? "checked" : ""} ${!selected && state.manualChartCodes.length >= 5 ? "disabled" : ""}><span>${esc(company.name)}</span></label>`;
  }).join("");
  container.querySelectorAll("input").forEach((input) => input.addEventListener("change", () => {
    state.manualChartCodes = input.checked
      ? [...state.manualChartCodes, input.value].slice(0, 5)
      : state.manualChartCodes.filter((code) => code !== input.value);
    state.returnData = null;
    renderChartChoices(); renderChart(); renderReturnChart();
  }));
}

function renderResults() {
  const { companies, year, reportCode } = state.data;
  const displayCompanies = orderedCompanies();
  const passedCount = companies.filter(companyPassesCriteria).length;
  const passedOnly = $("#filter-passed").checked;
  $("#filter-count").textContent = `통과 ${passedCount} / 비교함 ${companies.length}`;
  $("#result-scope").textContent = `비교함 ${companies.length}개 모두 분석 · 조건 통과 ${passedCount}개 · 현재 ${passedOnly ? "통과 기업" : "전체 기업"} ${displayCompanies.length}개 표시`;
  const displayMetrics = visibleMetricKeys(displayCompanies);
  const priceSelect = $("#price-company-select");
  const previousPriceCompany = priceSelect.value;
  priceSelect.innerHTML = displayCompanies.map((company) => `<option value="${company.corpCode}">${company.name}</option>`).join("");
  if (displayCompanies.some((company) => company.corpCode === previousPriceCompany)) priceSelect.value = previousPriceCompany;
  $("#result-kicker").textContent = `${year}년 ${reportNames[reportCode] || "보고서"} · 연결 우선 · 손익/현금흐름 누적 기준`;
  $("#result-title").textContent = `${displayCompanies.length}개 기업 핵심 비교`;
  const ranked=[...displayCompanies].filter(company=>Number.isFinite(metricValue(company,state.metric))).sort((a,b)=>{
    const direction=state.metric==="debtRatio"?-1:1;return (metricValue(b,state.metric)-metricValue(a,state.metric))*direction;
  }).slice(0,3);
  $("#decision-grid").innerHTML = `<div class="comparison-summary"><div><b>선택 지표: ${metrics[state.metric]?.label||"지표 없음"} 순</b><span>이 순위는 한 지표의 값만 비교합니다. 여러 조건을 합친 점수는 바로 아래에서 확인하세요.</span></div><ol>${ranked.map((company,index)=>`<li><em>${index+1}</em><span><b>${company.name}</b><small>${company.industry||"업종 확인 중"}</small></span><strong>${metrics[state.metric]?.format(metricValue(company,state.metric))||"자료 없음"}</strong></li>`).join("")||"<li>비교할 수 있는 값이 없습니다.</li>"}</ol></div>`;
  renderComparisonAssessment(displayCompanies);
  renderChartChoices();

  $("#table-head").innerHTML = `<th>기업</th>${displayMetrics.map((key) => `<th><span class="metric-help" title="${metricDescriptions[key] || ""}" data-tooltip="${metricDescriptions[key] || ""}">${metrics[key]?.label || key} ⓘ</span></th>`).join("")}`;
  $("#table-body").innerHTML = displayCompanies.length ? displayCompanies.map((company) => {
    const coverage = `${company.financials.length}/${state.data.years.length}개년 공시 반영`;
    const warning = company.latest
      ? `<span class="subvalue">${company.stockCode} · ${coverage}${company.isFinancial ? " · 금융업 지표" : ""}</span>`
      : `<span class="subvalue">선택 기간 공시 없음 · ${company.stockCode}</span>`;
    const benchmark = state.benchmarks[company.corpCode];
    return `<tr><td>${company.name}${warning}</td>${displayMetrics.map((key) => {
      const value = metricValue(company, key);
      let detail = "";
      if (key === "price") detail = `<span class="subvalue">${company.market?.date ? `${company.market.date.slice(0,4)}-${company.market.date.slice(4,6)}-${company.market.date.slice(6)} 기준 · 익일 13시 이후 갱신` : "기준일 없음"}</span>`;
      else if (key === "revenue" && company.latest?.revenueSource) detail = `<span class="subvalue">${company.latest.revenueSource}${company.latest.revenueSource.includes("합산") ? " · 금융업 참고값" : ""}</span>`;
      else if (["dividendYield", "dividendPerShare"].includes(key) && company.dividend?.year) detail = `<span class="subvalue">${company.dividend.year}년 사업보고서</span>`;
      else if (!Number.isFinite(value)) detail = `<span class="subvalue">해당 보고서에 일치하는 공시 계정 없음</span>`;
      else if (company.isFinancial && financialUnsupportedMetrics.has(key)) detail = `<span class="subvalue">금융업 비교 부적합 · ROE/PBR 확인</span>`;
      else if (company.isFinancial && key === "debtRatio") detail = `<span class="subvalue">은행은 BIS·CET1 비율 확인 필요</span>`;
      else if (benchmark && Number.isFinite(benchmark[key])) {
        const difference = value - benchmark[key];
        detail = `<span class="subvalue">업종 중위 ${metrics[key].format(benchmark[key])} · ${difference >= 0 ? "+" : ""}${difference.toFixed(1)}%p</span>`;
      }
      const displayValue = ["dividendYield", "dividendPerShare"].includes(key) && !Number.isFinite(value) ? "배당 미지급" : (metrics[key]?.format(value) || "—");
      return `<td>${displayValue}${detail}</td>`;
    }).join("")}</tr>`;
  }).join("") : `<tr><td colspan="${displayMetrics.length + 1}">설정한 모든 조건을 통과한 기업이 없습니다.</td></tr>`;
  hideCanvasTooltip("#trend-tooltip");
  hideCanvasTooltip("#return-tooltip");
  renderChart();
  renderReturnChart();
}

function renderChart(hoverIndex = null) {
  document.querySelectorAll("[data-chart-mode]").forEach((button) => button.classList.toggle("active", button.dataset.chartMode === state.chartMode));
  $("#price-company-select").hidden = state.chartMode !== "price";
  $("#price-period").hidden = state.chartMode !== "price";
  $("#ma-control").hidden = state.chartMode !== "price";
  $("#financial-scale").hidden = state.chartMode !== "financial";
  if (state.chartMode === "price") return renderPriceChart(hoverIndex);
  const canvas = $("#trend-chart");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
  const width = rect.width, height = rect.height, pad = { left: 58, right: 22, top: 20, bottom: 38 };
  const metric = metrics[state.metric];
  const allCompanies = orderedCompanies();
  const companies = chartCompanies(5);
  if (!metric) {
    ctx.fillStyle = "#66716b";
    ctx.font = "13px Noto Sans KR";
    ctx.fillText("나만의 투자조건에서 차트로 볼 재무지표를 추가해 주세요.", 20, 40);
    $("#chart-title").textContent = "투자조건 연동 재무 추이";
    $("#chart-legend").innerHTML = "";
    return;
  }
  if (!companies.length) {
    ctx.fillStyle = "#66716b";
    ctx.font = "14px Noto Sans KR";
    ctx.fillText("현재 조건을 통과한 기업이 없습니다. 조건을 조정해 주세요.", 20, 40);
    $("#chart-legend").innerHTML = "";
    return;
  }
  if (metric.chartable === false) {
    $("#financial-scale").hidden = true;
    return renderSnapshotChart(metric, hoverIndex);
  }
  $(".chart-label").textContent = companies.every((company) => company.isFinancial) ? "FINANCIAL ROE TREND" : "DISCLOSED TREND";
  $("#chart-title").textContent = `${metric.label} 추이`;
  const years = state.data.years;
  const series = companies.map((company, index) => ({ name: company.name, corpCode: company.corpCode, color: colors[index], values: years.map((year) => company.financials.find((item) => item.year === year)?.[state.metric] ?? null) }));
  $("#chart-legend").innerHTML = series.map((item) => `<span><i style="background:${item.color}"></i>${item.name}</span>`).join("") + `<span class="chart-limit-note">${chartScopeLabel(allCompanies.length, 5)} · ${$("#financial-scale").value === "readable" ? "가독성 축" : "전체 값 축"}</span>`;
  const values = series.flatMap((item) => item.values).filter(Number.isFinite);
  if (!values.length) { ctx.fillStyle = "#66716b"; ctx.fillText("표시할 데이터가 없습니다.", 20, 40); return; }
  let min = Math.min(...values), max = Math.max(...values);
  if ($("#financial-scale").value === "readable" && values.length >= 8) {
    const sorted = [...values].sort((a, b) => a - b);
    const quantile = (ratio) => { const position = (sorted.length - 1) * ratio, lower = Math.floor(position), upper = Math.ceil(position); return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower); };
    const low = quantile(.1), high = quantile(.9), readableRange = high - low;
    if (readableRange > 0 && (max - min) > readableRange * 2.4) { min = low - readableRange * .18; max = high + readableRange * .18; }
  }
  if (min === max) { min *= .9; max *= 1.1; }
  const range = max - min || 1; min -= range * .12; max += range * .12;
  const x = (index) => pad.left + (index / Math.max(years.length - 1, 1)) * (width - pad.left - pad.right);
  const y = (value) => pad.top + ((max - Math.max(min, Math.min(max, value))) / (max - min)) * (height - pad.top - pad.bottom);
  ctx.font = "11px Noto Sans KR"; ctx.textAlign = "right"; ctx.fillStyle = "#7a847e"; ctx.strokeStyle = "#e5e9e5"; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const value = min + ((max - min) * i / 4); const py = y(value); ctx.beginPath(); ctx.moveTo(pad.left, py); ctx.lineTo(width - pad.right, py); ctx.stroke(); ctx.fillText(metric.format(value), pad.left - 9, py + 4); }
  ctx.textAlign = "center"; years.forEach((year, index) => ctx.fillText(year, x(index), height - 12));
  series.forEach((item) => { ctx.strokeStyle = item.color; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.beginPath(); let started = false; item.values.forEach((value, index) => { if (!Number.isFinite(value)) { started = false; return; } started ? ctx.lineTo(x(index), y(value)) : ctx.moveTo(x(index), y(value)); started = true; }); ctx.stroke(); item.values.forEach((value, index) => { if (!Number.isFinite(value)) return; const clipped = value < min || value > max; ctx.fillStyle = clipped ? item.color : "#fff"; ctx.strokeStyle = item.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x(index), y(value), clipped ? 6 : 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }); });
  if (Number.isInteger(hoverIndex)) {
    ctx.strokeStyle = "rgba(24,37,31,.35)"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x(hoverIndex), pad.top); ctx.lineTo(x(hoverIndex), height - pad.bottom); ctx.stroke(); ctx.setLineDash([]);
  }
  state.chart = { years, series, x, pad, width };
  canvas.onmousemove = (event) => {
    const bounds = canvas.getBoundingClientRect();
    const mouseX = event.clientX - bounds.left;
    const index = Math.max(0, Math.min(years.length - 1, Math.round(((mouseX - pad.left) / (width - pad.left - pad.right)) * (years.length - 1))));
    positionCanvasTooltip("#trend-tooltip", canvas, event, `<strong>${years[index]}년 · ${metric.label}</strong><div class="trend-hover-grid">${series.map((item) => { const company = companies.find((candidate) => candidate.corpCode === item.corpCode), financial = company?.financials.find((row) => row.year === years[index]); return `<span><b><i style="background:${item.color}"></i>${item.name}</b><em>${metric.format(item.values[index])}<small>${financial?.dataSource || "공시값 없음"}</small></em></span>`; }).join("")}</div>`);
    if (state.hoverIndex !== index) { state.hoverIndex = index; renderChart(index); }
  };
  canvas.onmouseleave = () => { hideCanvasTooltip("#trend-tooltip"); state.hoverIndex = null; renderChart(); };
}

function renderSnapshotChart(metric, hoverIndex = null) {
  const canvas = $("#trend-chart"), rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
  const width = rect.width, height = rect.height, pad = { left: 72, right: 24, top: 28, bottom: 78 };
  const allCompanies = orderedCompanies();
  const companies = chartCompanies(5);
  const values = companies.map((company) => metricValue(company, state.metric));
  const finite = values.filter(Number.isFinite);
  $(".chart-label").textContent = "CURRENT SNAPSHOT";
  $("#chart-title").textContent = `${metric.label} 선택 기업 비교`;
  $("#chart-legend").innerHTML = `<span class="chart-limit-note">${chartScopeLabel(allCompanies.length, 5)} · 현재 지표 · ${metric.source} 기준</span>`;
  if (!finite.length) { ctx.fillStyle = "#66716b"; ctx.font = "13px Noto Sans KR"; ctx.fillText("선택 기업에서 확인 가능한 현재값이 없습니다.", 20, 40); return; }
  let min = Math.min(0, ...finite), max = Math.max(0, ...finite); if (min === max) max = min + 1;
  const margin = (max - min) * .1; min -= margin; max += margin;
  const x = (index) => pad.left + (index + .5) / companies.length * (width - pad.left - pad.right);
  const y = (value) => pad.top + (max - value) / (max - min) * (height - pad.top - pad.bottom);
  const zeroY = y(0), barWidth = Math.max(12, Math.min(62, (width - pad.left - pad.right) / companies.length * .58));
  ctx.font = "11px Noto Sans KR"; ctx.textAlign = "right"; ctx.fillStyle = "#8b95a1"; ctx.strokeStyle = "#e5e8eb";
  for (let i = 0; i < 5; i++) { const value = min + (max - min) * i / 4, py = y(value); ctx.beginPath(); ctx.moveTo(pad.left, py); ctx.lineTo(width - pad.right, py); ctx.stroke(); ctx.fillText(metric.format(value), pad.left - 8, py + 4); }
  companies.forEach((company, index) => { const value = values[index]; if (!Number.isFinite(value)) return; const py = y(value), top = Math.min(py, zeroY), barHeight = Math.max(2, Math.abs(zeroY - py)); ctx.fillStyle = colors[index % colors.length]; ctx.globalAlpha = hoverIndex === null || hoverIndex === index ? .9 : .28; ctx.fillRect(x(index) - barWidth / 2, top, barWidth, barHeight); ctx.globalAlpha = 1; ctx.fillStyle = "#4e5968"; ctx.textAlign = "center"; ctx.fillText(metric.format(value), x(index), Math.max(16, top - 7)); ctx.save(); ctx.translate(x(index), height - pad.bottom + 16); ctx.rotate(-.32); ctx.textAlign = "right"; ctx.fillText(company.name, 0, 0); ctx.restore(); });
  canvas.onmousemove = (event) => { const bounds = canvas.getBoundingClientRect(), index = Math.max(0, Math.min(companies.length - 1, Math.floor((event.clientX - bounds.left - pad.left) / (width - pad.left - pad.right) * companies.length))), company = companies[index]; positionCanvasTooltip("#trend-tooltip", canvas, event, `<strong>${company.name} · ${metric.label}</strong><div class="trend-hover-grid"><span><b><i style="background:${colors[index % colors.length]}"></i>${company.stockCode}</b><em>${metric.format(values[index])}<small>${metricDescriptions[state.metric] || metric.source}</small></em></span></div>`); renderSnapshotChart(metric, index); };
  canvas.onmouseleave = () => { hideCanvasTooltip("#trend-tooltip"); renderSnapshotChart(metric); };
}

function renderPriceChart(hoverIndex = null) {
  const canvas = $("#trend-chart");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
  const width = rect.width, height = rect.height, pad = { left: 76, right: 24, top: 22, bottom: 42 };
  const priceBottom = height * .72, volumeTop = height * .79;
  const companies = analysisCompanies();
  if (!companies.length) { ctx.fillStyle = "#66716b"; ctx.font = "14px Noto Sans KR"; ctx.fillText("현재 조건을 통과한 기업이 없습니다.", 24, 42); return; }
  const selectedCode = $("#price-company-select").value || companies[0]?.corpCode;
  const company = companies.find((item) => item.corpCode === selectedCode) || companies[0];
  const period = $("#price-period")?.value || "1", range = chartDateRange(period), historyKey = `${selectedCode}:${range.beginDate}:${range.endDate}`;
  if (period !== "1" && !state.longPriceData[historyKey]) {
    state.longPriceData[historyKey] = "loading";
    fetch(`/api/backtest-data?${new URLSearchParams({ corpCodes: selectedCode, ...range })}`).then((response) => response.json()).then((payload) => {
      state.longPriceData[historyKey] = payload.companies?.[0]?.history || [];
      renderChart();
    }).catch(() => { state.longPriceData[historyKey] = []; renderChart(); });
  }
  const history = period === "1" ? (company?.market?.history || []) : (Array.isArray(state.longPriceData[historyKey]) ? state.longPriceData[historyKey] : []);
  $(".chart-label").textContent = "PRICE & MOVING AVERAGES";
  $("#chart-title").textContent = `${company?.name || "기업"} 주가·이동평균선·거래량`;
  const maColors = ["#f04452", "#3182f6", "#14b8a6", "#a855f7", "#f59f00", "#8b5cf6"];
  const closes = history.map((row) => row.close);
  const rolling = (days) => closes.map((_, index) => index + 1 >= days
    ? closes.slice(index + 1 - days, index + 1).reduce((sum, value) => sum + value, 0) / days
    : null);
  const series = [{ key: "close", name: "종가", color: "#191f28", lineWidth: 2.6, values: closes },
    ...state.movingAverages.map((days, index) => ({ key: `ma${days}`, name: `${days}일선`, color: maColors[index % maColors.length], lineWidth: 1.8, values: rolling(days) }))];
  $("#chart-legend").innerHTML = `${series.map((item) => `<span><i style="background:${item.color}"></i>${item.name}</span>`).join("")}<span><i style="background:#f04452"></i>골든크로스</span><span><i style="background:#3182f6"></i>데드크로스</span><span><i style="background:#b8c2cc"></i>거래량</span><span>개인·기관·외국인 수급은 현재 API 미제공</span>`;
  const values = series.flatMap((item) => item.values).filter(Number.isFinite);
  if (!history.length || !values.length) { ctx.fillStyle = "#8b95a1"; ctx.font = "13px Noto Sans KR"; ctx.fillText("표시할 주가 이력이 없습니다.", 24, 42); return; }
  let min = Math.min(...values), max = Math.max(...values); const margin = (max - min || max * .1 || 1) * .09; min -= margin; max += margin;
  const x = (index) => pad.left + (index / Math.max(history.length - 1, 1)) * (width - pad.left - pad.right);
  const y = (value) => pad.top + ((max - value) / (max - min)) * (priceBottom - pad.top);
  ctx.font = "11px Noto Sans KR"; ctx.textAlign = "right"; ctx.fillStyle = "#8b95a1"; ctx.strokeStyle = "#e5e8eb"; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const value = min + ((max - min) * i / 4); const py = y(value); ctx.beginPath(); ctx.moveTo(pad.left, py); ctx.lineTo(width - pad.right, py); ctx.stroke(); ctx.fillText(won(value), pad.left - 10, py + 4); }
  const volumes = history.map((row) => row.volume || 0), maxVolume = Math.max(...volumes, 1);
  const barWidth = Math.max(1, (width - pad.left - pad.right) / history.length * .72);
  history.forEach((row, index) => { const barHeight = (volumes[index] / maxVolume) * (height - pad.bottom - volumeTop); ctx.fillStyle = index && row.close < history[index - 1].close ? "rgba(49,130,246,.55)" : "rgba(240,68,82,.55)"; ctx.fillRect(x(index) - barWidth / 2, height - pad.bottom - barHeight, barWidth, barHeight); });
  ctx.fillStyle = "#8b95a1"; ctx.textAlign = "left"; ctx.fillText("거래량", pad.left, volumeTop - 7);
  ctx.textAlign = "center";
  for (let i = 0; i < 5; i++) { const index = Math.round((history.length - 1) * i / 4); const date = history[index]?.date || ""; ctx.fillText(`${date.slice(0,4)}-${date.slice(4,6)}`, x(index), height - 13); }
  series.forEach((item) => { ctx.strokeStyle = item.color; ctx.lineWidth = item.lineWidth; ctx.lineJoin = "round"; ctx.beginPath(); let started = false; item.values.forEach((value, index) => { if (!Number.isFinite(value)) { started = false; return; } started ? ctx.lineTo(x(index), y(value)) : ctx.moveTo(x(index), y(value)); started = true; }); ctx.stroke(); });
  const fast = rolling(5), slow = rolling(20), crossEvents = [];
  for (let index = 1; index < history.length; index++) {
    if (![fast[index - 1], slow[index - 1], fast[index], slow[index]].every(Number.isFinite)) continue;
    if (fast[index - 1] <= slow[index - 1] && fast[index] > slow[index]) crossEvents.push({ index, type: "골든" });
    if (fast[index - 1] >= slow[index - 1] && fast[index] < slow[index]) crossEvents.push({ index, type: "데드" });
  }
  crossEvents.forEach((event) => { const py = y(history[event.index].close); ctx.fillStyle = event.type === "골든" ? "#f04452" : "#3182f6"; ctx.beginPath(); ctx.arc(x(event.index), py, 5, 0, Math.PI * 2); ctx.fill(); });
  if (Number.isInteger(hoverIndex)) {
    ctx.strokeStyle = "rgba(25,31,40,.28)"; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(x(hoverIndex), pad.top); ctx.lineTo(x(hoverIndex), height - pad.bottom); ctx.stroke(); ctx.setLineDash([]);
    series.forEach((item) => { const value = item.values[hoverIndex]; if (!Number.isFinite(value)) return; ctx.fillStyle = "#fff"; ctx.strokeStyle = item.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x(hoverIndex), y(value), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
  }
  canvas.onmousemove = (event) => {
    const bounds = canvas.getBoundingClientRect(); const mouseX = event.clientX - bounds.left;
    const index = Math.max(0, Math.min(history.length - 1, Math.round(((mouseX - pad.left) / (width - pad.left - pad.right)) * (history.length - 1))));
    const date = history[index]?.date || "";
    const cross = crossEvents.find((event) => event.index === index);
    positionCanvasTooltip("#trend-tooltip", canvas, event, `<strong>${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)} · ${company.name}</strong><div class="trend-hover-grid">${series.map((item) => `<span><b><i style="background:${item.color}"></i>${item.name}</b><em>${won(item.values[index])}</em></span>`).join("")}<span><b>거래량</b><em>${Number(history[index]?.volume || 0).toLocaleString("ko-KR")}주</em></span>${cross ? `<span><b>교차 신호</b><em>${cross.type}크로스</em></span>` : ""}</div>`);
    if (state.hoverIndex !== index) { state.hoverIndex = index; renderChart(index); }
  };
  canvas.onmouseleave = () => { hideCanvasTooltip("#trend-tooltip"); state.hoverIndex = null; renderChart(); };
}

async function renderReturnChart(hoverIndex = null) {
  const canvas = $("#return-chart");
  if (!canvas || !state.data?.companies?.length) return;
  const allDisplayCompanies = orderedCompanies();
  const displayCompanies = chartCompanies(4);
  if (!displayCompanies.length) {
    const rect = canvas.getBoundingClientRect(), ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, rect.width, rect.height); ctx.fillStyle = "#66716b"; ctx.font = "14px Noto Sans KR"; ctx.fillText("현재 조건을 통과한 기업이 없습니다.", 24, 42);
    $("#return-chart-legend").innerHTML = "";
    return;
  }
  const period = $("#return-period")?.value || "1";
  const range = chartDateRange(period), key = `${displayCompanies.map((item) => item.corpCode).join(",")}:${range.beginDate}:${range.endDate}`;
  if (state.returnData?.key !== key) {
    const rect = canvas.getBoundingClientRect(), ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, rect.width, rect.height); ctx.fillStyle = "#8b95a1"; ctx.font = "13px Noto Sans KR"; ctx.fillText("선택 기간의 수익률 데이터를 불러오는 중입니다.", 24, 42);
    try { await loadLongMarket(period); return renderReturnChart(hoverIndex); } catch { return; }
  }
  const payload = state.returnData.payload;
  const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
  const width = rect.width, height = rect.height, pad = { left: 62, right: 24, top: 24, bottom: 40 };
  const fullDates = payload.companies?.[0]?.history?.map((row) => row.date) || [];
  const normalize = (history) => { const map = new Map(history.map((row) => [row.date, row.close])); const base = fullDates.map((date) => map.get(date)).find(Number.isFinite); return fullDates.map((date) => Number.isFinite(map.get(date)) && Number.isFinite(base) ? ((map.get(date) / base) - 1) * 100 : null); };
  const companySeries = displayCompanies.map((company, index) => { const source = payload.companies.find((item) => item.corpCode === company.corpCode); return { name: company.name, corpCode: company.corpCode, industry: state.benchmarks[company.corpCode]?.industry, color: colors[index % colors.length], values: normalize(source?.history || []) }; });
  const series = [...companySeries];
  if (payload.benchmark?.history?.length) series.push({ name: "KOSPI 200", market: true, color: "#111827", values: normalize(payload.benchmark.history) });
  const seenIndustries = new Set();
  displayCompanies.forEach((company, index) => { const benchmark = state.benchmarks[company.corpCode]; if (!benchmark?.returnHistory?.length || seenIndustries.has(benchmark.industry)) return; seenIndustries.add(benchmark.industry); const map = new Map(benchmark.returnHistory.map((row) => [row.date, row.value])); series.push({ name: `${benchmark.industry} 업종 평균`, industry: benchmark.industry, color: colors[index % colors.length], dash: true, values: fullDates.map((date) => map.get(date) ?? null) }); });
  const industryByName = new Map(series.filter((item) => item.dash).map((item) => [item.industry, item]));
  $("#return-chart-legend").innerHTML = `<div class="legend-pairs">${companySeries.map((item) => { const industry = industryByName.get(item.industry); return `<span class="legend-pair"><b><i class="line-swatch" style="--line:${item.color}"></i>${item.name}</b>${industry ? `<em><i class="line-swatch dashed" style="--line:${industry.color}"></i>${industry.name}</em>` : ""}</span>`; }).join("")}</div><span><i class="line-swatch" style="--line:#111827"></i>KOSPI 200</span><span class="chart-limit-note">${chartScopeLabel(allDisplayCompanies.length, 4)}</span>`;
  const startIndex = Math.max(0, Math.floor((fullDates.length - 1) * state.returnView.start)), endIndex = Math.max(startIndex + 1, Math.ceil((fullDates.length - 1) * state.returnView.end));
  const dates = fullDates.slice(startIndex, endIndex + 1);
  series.forEach((item) => { item.values = item.values.slice(startIndex, endIndex + 1); });
  const values = series.flatMap((item) => item.values).filter(Number.isFinite);
  if (!dates.length || !values.length) { ctx.fillStyle = "#8b95a1"; ctx.fillText("수익률 비교 데이터가 없습니다.", 24, 40); return; }
  let min = Math.min(...values), max = Math.max(...values); const margin = (max - min || 10) * .1; min -= margin; max += margin;
  const x = (index) => pad.left + index / Math.max(dates.length - 1, 1) * (width - pad.left - pad.right);
  const y = (value) => pad.top + (max - value) / (max - min) * (height - pad.top - pad.bottom);
  ctx.font = "11px Noto Sans KR"; ctx.strokeStyle = "#e5e8eb"; ctx.fillStyle = "#8b95a1";
  for (let i = 0; i <= 4; i++) { const value = min + (max - min) * i / 4, py = y(value); ctx.beginPath(); ctx.moveTo(pad.left, py); ctx.lineTo(width - pad.right, py); ctx.stroke(); ctx.fillText(`${value.toFixed(0)}%`, 8, py + 4); }
  ctx.textAlign = "center"; for (let i = 0; i < 5; i++) { const index = Math.round((dates.length - 1) * i / 4), date = dates[index] || ""; ctx.fillText(`${date.slice(0,4)}-${date.slice(4,6)}`, x(index), height - 12); }
  series.forEach((item) => { ctx.strokeStyle = item.color; ctx.lineWidth = item.dash ? 1.8 : 2.2; ctx.setLineDash(item.dash ? [6,4] : []); ctx.beginPath(); let started = false; item.values.forEach((value, index) => { if (!Number.isFinite(value)) { started = false; return; } started ? ctx.lineTo(x(index), y(value)) : ctx.moveTo(x(index), y(value)); started = true; }); ctx.stroke(); ctx.setLineDash([]); });
  if (Number.isInteger(hoverIndex)) series.forEach((item) => { const value = item.values[hoverIndex]; if (!Number.isFinite(value)) return; ctx.fillStyle = "#fff"; ctx.strokeStyle = item.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x(hoverIndex), y(value), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
  canvas.onmousemove = (event) => { const bounds = canvas.getBoundingClientRect(), index = Math.max(0, Math.min(dates.length - 1, Math.round((event.clientX - bounds.left - pad.left) / (width - pad.left - pad.right) * (dates.length - 1)))), date = dates[index]; const market = series.find((item) => item.market); positionCanvasTooltip("#return-tooltip", canvas, event, `<strong>${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}</strong><div class="tooltip-grid">${companySeries.map((company) => { const item = series.find((row) => row.corpCode === company.corpCode), industry = industryByName.get(company.industry); return `<span><b><i style="background:${company.color}"></i>${company.name}</b><em>${percent(item?.values[index])}</em></span>${industry ? `<span class="industry-row"><b><i class="dash-dot" style="--line:${industry.color}"></i>${industry.name}</b><em>${percent(industry.values[index])}</em></span>` : ""}`; }).join("")}${market ? `<span><b>KOSPI 200</b><em>${percent(market.values[index])}</em></span>` : ""}</div>`); renderReturnChart(index); };
  canvas.onmouseleave = () => { hideCanvasTooltip("#return-tooltip"); renderReturnChart(); };
  canvas.onwheel = (event) => { event.preventDefault(); const bounds = canvas.getBoundingClientRect(), pointer = Math.max(0, Math.min(1, (event.clientX - bounds.left - pad.left) / (width - pad.left - pad.right))), current = state.returnView, range = current.end - current.start, nextRange = Math.max(.08, Math.min(1, range * (event.deltaY < 0 ? .8 : 1.25))), anchor = current.start + pointer * range; let start = anchor - pointer * nextRange, end = start + nextRange; if (start < 0) { end -= start; start = 0; } if (end > 1) { start -= end - 1; end = 1; } state.returnView = { start: Math.max(0, start), end: Math.min(1, end) }; renderReturnChart(); };
}

document.querySelectorAll("[data-chart-mode]").forEach((button) => button.addEventListener("click", () => {
  state.chartMode = button.dataset.chartMode; state.hoverIndex = null; renderChart();
}));
$("#comparison-order").addEventListener("change", (event) => {
  state.comparisonOrder = event.target.value === "selected" ? "selected" : "criteria";
  state.returnData = null;
  renderResults();
});
$("#chart-selection-mode").addEventListener("change", (event) => {
  state.chartSelectionMode = event.target.value === "manual" ? "manual" : "automatic";
  if (state.chartSelectionMode === "manual" && !state.manualChartCodes.length) {
    state.manualChartCodes = orderedCompanies().slice(0, 5).map((company) => company.corpCode);
  }
  state.returnData = null;
  renderChartChoices(); renderChart(); renderReturnChart();
});
$("#price-company-select").addEventListener("change", () => { state.hoverIndex = null; renderChart(); });
$("#price-period").addEventListener("change", () => { state.hoverIndex = null; renderChart(); });
$("#financial-scale").addEventListener("change", () => { state.hoverIndex = null; renderChart(); });
$("#return-period").addEventListener("change", async () => {
  state.returnData = null; state.returnView = { start: 0, end: 1 };
  if (state.data) {
    const params = new URLSearchParams({ corpCodes: state.data.companies.map((item) => item.corpCode).join(","), year: state.data.year, reportCode: state.data.reportCode });
    state.benchmarks = {}; renderReturnChart(); await loadBenchmarks(params);
  }
});
$("#return-reset").addEventListener("click", () => { state.returnView = { start: 0, end: 1 }; renderReturnChart(); });
$("#ma-periods").value = state.movingAverages.join(", ");
$("#apply-ma").addEventListener("click", () => {
  const periods = [...new Set($("#ma-periods").value.split(/[^0-9]+/).map(Number).filter((value) => value >= 2 && value <= 250))].slice(0, 6).sort((a, b) => a - b);
  if (!periods.length) return;
  state.movingAverages = periods;
  localStorage.setItem("movingAverages", JSON.stringify(periods));
  $("#ma-periods").value = periods.join(", ");
  state.hoverIndex = null;
  renderChart();
});

window.addEventListener("resize", () => { if (state.data) { renderChart(); renderReturnChart(); } });

$("#csv-button").addEventListener("click", () => {
  if (!state.data) return;
  const headers = ["기업", "종목코드", "연도", ...Object.values(metrics).map((item) => item.label)];
  const rows = analysisCompanies().flatMap((company) => company.financials.map((f) => [company.name, company.stockCode, f.year, ...Object.keys(metrics).map((key) => f[key] ?? "")]));
  const csv = "\ufeff" + [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = Object.assign(document.createElement("a"), { href: url, download: `기업비교_${state.data.year}.csv` }); anchor.click(); URL.revokeObjectURL(url);
});

async function init() {
  renderYears(); renderSelected(); renderMetricButtons(); renderCriteria();
  try {
    const health = await fetch("/api/health").then((response) => response.json());
    if (!health.dartConfigured) return showStatus("DART 인증키 설정이 필요합니다.", true, false);
    showStatus("조건에 맞는 기업을 찾거나, 기업 이름을 검색해 비교함에 담아주세요.", false, false);
    loadDiscovery();
  } catch { showStatus("서버 연결을 확인해 주세요.", true, false); }
}

init();

const compareSideLinks = [...document.querySelectorAll(".workspace-side a[href^='#']")];
const compareMenuButton = $("#compare-menu-toggle");
const compareSectionsButton = $("#compare-sections-toggle");
const closeCompareMobileMenus = () => {
  document.body.classList.remove("compare-menu-open", "compare-sections-open");
  compareMenuButton.setAttribute("aria-expanded", "false");
  compareSectionsButton.setAttribute("aria-expanded", "false");
};
compareMenuButton.addEventListener("click", () => {
  const open = !document.body.classList.contains("compare-menu-open");
  closeCompareMobileMenus();
  document.body.classList.toggle("compare-menu-open", open);
  compareMenuButton.setAttribute("aria-expanded", String(open));
});
compareSectionsButton.addEventListener("click", () => {
  const open = !document.body.classList.contains("compare-sections-open");
  closeCompareMobileMenus();
  document.body.classList.toggle("compare-sections-open", open);
  compareSectionsButton.setAttribute("aria-expanded", String(open));
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeCompareMobileMenus(); });
document.addEventListener("click", (event) => {
  if (!event.target.closest(".topbar, .workspace-side")) closeCompareMobileMenus();
});
window.addEventListener("resize", () => { if (window.innerWidth > 760) closeCompareMobileMenus(); });
const activateCompareSideLink = (link) => {
  compareSideLinks.forEach((item) => item.classList.toggle("active", item === link));
  $("#compare-current-section").textContent = link.lastChild?.textContent?.trim() || link.textContent.trim();
};
compareSideLinks.forEach((link) => link.addEventListener("click", () => {
  activateCompareSideLink(link);
  closeCompareMobileMenus();
}));
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const link = compareSideLinks.find((item) => item.getAttribute("href") === `#${visible.target.id}`);
    if (link) activateCompareSideLink(link);
  }, { rootMargin: "-18% 0px -68% 0px", threshold: [0, .1, .35] });
  compareSideLinks.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean).forEach((target) => observer.observe(target));
}
const refreshCompareNavigation = () => compareSideLinks.forEach((link) => {
  const target = document.querySelector(link.getAttribute("href"));
  const unavailable = Boolean(target && (target.hidden || target.closest("[hidden]")));
  link.classList.toggle("unavailable", unavailable);
  link.setAttribute("aria-disabled", String(unavailable));
  link.title = unavailable ? "기업을 선택하고 비교를 실행하면 확인할 수 있어요." : "";
});
compareSideLinks.forEach((link) => link.addEventListener("click", (event) => {
  const target = document.querySelector(link.getAttribute("href"));
  if (!target || (!target.hidden && !target.closest("[hidden]"))) return;
  event.preventDefault();
  const fallback = compareSideLinks.find((item) => item.getAttribute("href") === "#compare");
  if (fallback) { activateCompareSideLink(fallback); document.querySelector("#compare")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  showStatus("먼저 기업을 선택하고 비교 분석을 실행해 주세요.", false, false);
}));
refreshCompareNavigation();
new MutationObserver(refreshCompareNavigation).observe(document.body, { attributes: true, attributeFilter: ["hidden"], subtree: true });
