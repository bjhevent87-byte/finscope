import { $, nav, setupMarketGuide, setupSearch } from "./pages.js?v=19";

$("#nav").innerHTML = nav("correlation");
const correlationPage = document.querySelector(".correlation-page");
const methodGuide = $("#method-guide");
const industryLab = $("#industry-lab");
if (methodGuide) correlationPage.append(methodGuide);
if (industryLab) correlationPage.append(industryLab);
let selectedCompany = null;
let lastScatter = null;
let lastRolling = null;
let lastAnalysis = null;
let companyGuide = null;
let macroCatalog = [];
const catalogReady = loadMacroCatalog();

function enterAnalysisFocus(message = "") {
  document.body.classList.add("analysis-focus");
  document.querySelectorAll(".lab-mode-grid a").forEach((link) => link.classList.toggle("active", link.getAttribute("href") === "#analysis-settings"));
  if (message) {
    const panel = $("#guided-context");
    panel.hidden = false;
    panel.innerHTML = `<b>${escapeHtml(message)}</b><p>설정이 적용되었습니다. 아래 결과에서 한 줄 결론부터 확인하세요.</p>`;
  }
}

function leaveAnalysisFocus() {
  document.body.classList.remove("analysis-focus", "analysis-complete");
  history.replaceState(null, "", `${location.pathname}#relationship-overview`);
  const target = $("#relationship-overview");
  target.hidden = false;
  requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
  setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 180);
}

function openAnalysisControls() {
  document.body.classList.remove("analysis-complete");
  $("#analysis-settings").scrollIntoView({ behavior: "smooth", block: "start" });
}

setupSearch($("#company-search"), $("#company-results"), (company) => {
  selectedCompany = company;
  $("#company-search").value = `${company.name} · ${company.stockCode}`;
  localStorage.setItem("activeCompany", JSON.stringify(company));
});

setupMarketGuide($(".analysis-controls"), (company) => {
  selectedCompany = company;
  $("#company-search").value = `${company.name} · ${company.stockCode}`;
  localStorage.setItem("activeCompany", JSON.stringify(company));
  $("#analysis-status").textContent = `${company.name}을 선택했어요. 함께 비교할 지표와 계산 방법을 확인한 뒤 분석해 주세요.`;
}, "시장·업종에서 분석 기업 선택").then((guide) => { companyGuide = guide; companyGuide.id = "company-guide"; updateAnalysisMode(); });

const compact = (date) => date.toISOString().slice(0, 10).replaceAll("-", "");
const monthSerial = (month) => Number(month.slice(0, 4)) * 12 + Number(month.slice(4, 6)) - 1;
const serialMonth = (value) => `${Math.floor(value / 12)}${String((value % 12) + 1).padStart(2, "0")}`;
const finite = (value) => Number.isFinite(Number(value));
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) throw new Error(payload.error || `데이터 요청 실패 (${response.status})`);
  return payload;
}

function monthlyLast(rows, field) {
  const result = new Map();
  rows.forEach((row) => {
    const date = String(row.date || "").replace(/\D/g, "");
    const value = Number(row[field]);
    if (date.length < 6 || !Number.isFinite(value)) return;
    result.set(date.slice(0, 6), value);
  });
  return result;
}

function changes(levels, mode) {
  const months = [...levels.keys()].sort();
  const result = new Map();
  months.forEach((month, index) => {
    const interval = mode === "yoy" ? 12 : 1;
    if (index < interval) return;
    const previousMonth = months[index - interval];
    if (monthSerial(month) - monthSerial(previousMonth) !== interval) return;
    const current = levels.get(month), previous = levels.get(previousMonth);
    if (!finite(current) || !finite(previous) || (!previous && mode !== "point")) return;
    result.set(month, mode === "point" ? current - previous : ((current / previous) - 1) * 100);
  });
  return result;
}

function macroChanges(payload, id) {
  const levels = monthlyLast(payload.observations || [], "value");
  return changes(levels, payload.transform || "percent");
}

function groupedOptions(items) {
  const groups = new Map();
  items.forEach((item) => {
    const category = item.category || "기타";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  });
  return [...groups.entries()].map(([category, series]) => `<optgroup label="${escapeHtml(category)}">${series.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.transformLabel || "월간 변화")}</option>`).join("")}</optgroup>`).join("");
}

async function loadMacroCatalog() {
  try {
    const payload = await fetchJson("/api/macro/catalog");
    macroCatalog = (payload.series || []).filter((item) => item.configured);
    const options = groupedOptions(macroCatalog);
    $("#series-a").innerHTML = options;
    $("#macro-series").innerHTML = options;
    $("#series-a").value = "usd-krw";
    $("#macro-series").value = "kr-base-rate";
    updateSeriesContext();
    queueMicrotask(applyQueryParams);
    return macroCatalog;
  } catch (error) {
    $("#analysis-status").textContent = `지표 목록을 불러오지 못했습니다: ${error.message}`;
    return [];
  }
}

function seriesMeta(id) {
  return macroCatalog.find((item) => item.id === id);
}

function metaChip(meta) {
  if (!meta) return "";
  const tags = (meta.industryTags || []).slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  return `<article><b>${escapeHtml(meta.name)}</b><p>${escapeHtml(meta.source)} · ${escapeHtml(meta.transformLabel || "월간 변화")} · ${escapeHtml(meta.frequency || "월간")}</p><div>${tags}</div></article>`;
}

function updateSeriesContext() {
  if (!macroCatalog.length) return;
  const mode = $("#analysis-mode").value;
  const selected = mode === "macro-macro"
    ? [seriesMeta($("#series-a").value), seriesMeta($("#macro-series").value)]
    : [seriesMeta($("#macro-series").value)];
  $("#series-context").innerHTML = `<strong>비교하는 데이터</strong>${selected.map(metaChip).join("")}`;
}

function applyQueryParams() {
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode");
  const a = params.get("a"), b = params.get("b");
  const guide = params.get("guide");
  if (mode === "macro-macro" || mode === "company-macro") $("#analysis-mode").value = mode;
  if (a && seriesMeta(a)) $("#series-a").value = a;
  if (b && seriesMeta(b)) $("#macro-series").value = b;
  updateAnalysisMode();
  updateSeriesContext();
  if (guide) {
    const first = seriesMeta(a), second = seriesMeta(b);
    const panel = $("#guided-context");
    panel.hidden = false;
    panel.innerHTML = `<b>${escapeHtml(guide)}에서 고른 두 지표를 비교해요.</b><p><strong>${escapeHtml(first?.name || "업종지수")}</strong>와 <strong>${escapeHtml(second?.name || "경제지표")}</strong>가 같은 달에 어떻게 움직였는지 보여드립니다.</p><ol><li>같은 방향인지, 반대 방향인지 확인</li><li>평소와 달랐던 달 찾기</li><li>시간이 지나도 관계가 비슷했는지 확인</li></ol>`;
  }
  if (params.get("autorun") === "1" && (!b || seriesMeta(b))) setTimeout(() => $("#run-analysis").click(), 0);
}

function align(stock, macro, lag = 0) {
  const rows = [];
  macro.forEach((x, macroMonth) => {
    const stockMonth = serialMonth(monthSerial(macroMonth) + lag);
    const y = stock.get(stockMonth);
    if (finite(x) && finite(y)) rows.push({ month: stockMonth, macroMonth, x: Number(x), y: Number(y) });
  });
  return rows.sort((a, b) => a.month.localeCompare(b.month));
}

function averageRanks(values) {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = Array(values.length);
  for (let start = 0; start < sorted.length;) {
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1].value === sorted[start].value) end += 1;
    const rank = (start + end + 2) / 2;
    for (let index = start; index <= end; index += 1) ranks[sorted[index].index] = rank;
    start = end + 1;
  }
  return ranks;
}

function statistics(rows, method = "pearson") {
  if (rows.length < 3) return { correlation: null, beta: null, intercept: null, rSquared: null };
  const meanX = rows.reduce((sum, row) => sum + row.x, 0) / rows.length;
  const meanY = rows.reduce((sum, row) => sum + row.y, 0) / rows.length;
  const covariance = rows.reduce((sum, row) => sum + (row.x - meanX) * (row.y - meanY), 0);
  const varianceX = rows.reduce((sum, row) => sum + (row.x - meanX) ** 2, 0);
  const beta = varianceX ? covariance / varianceX : null;
  const correlationRows = method === "spearman"
    ? (() => { const rankX = averageRanks(rows.map((row) => row.x)); const rankY = averageRanks(rows.map((row) => row.y)); return rows.map((row, index) => ({ ...row, x: rankX[index], y: rankY[index] })); })()
    : rows;
  const correlationMeanX = correlationRows.reduce((sum, row) => sum + row.x, 0) / correlationRows.length;
  const correlationMeanY = correlationRows.reduce((sum, row) => sum + row.y, 0) / correlationRows.length;
  const correlationCovariance = correlationRows.reduce((sum, row) => sum + (row.x - correlationMeanX) * (row.y - correlationMeanY), 0);
  const correlationVarianceX = correlationRows.reduce((sum, row) => sum + (row.x - correlationMeanX) ** 2, 0);
  const correlationVarianceY = correlationRows.reduce((sum, row) => sum + (row.y - correlationMeanY) ** 2, 0);
  const correlation = correlationVarianceX && correlationVarianceY ? correlationCovariance / Math.sqrt(correlationVarianceX * correlationVarianceY) : null;
  const rawVarianceY = rows.reduce((sum, row) => sum + (row.y - meanY) ** 2, 0);
  const rawCorrelation = varianceX && rawVarianceY ? covariance / Math.sqrt(varianceX * rawVarianceY) : null;
  return { correlation, beta, intercept: finite(beta) ? meanY - beta * meanX : null, rSquared: finite(rawCorrelation) ? rawCorrelation ** 2 : null, method };
}

function strength(value) {
  const absolute = Math.abs(value);
  return absolute < .2 ? "매우 약함" : absolute < .5 ? "약함" : absolute < .7 ? "보통" : absolute < .9 ? "강함" : "매우 강함";
}

function strengthSentence(value) {
  const label = strength(value);
  return label === "보통" ? "보통입니다" : `${label.replace("함", "")}합니다`;
}

function renderMatrix(xLabel, yLabel, correlation) {
  const value = finite(correlation) ? Number(correlation) : 0;
  const intensity = .12 + Math.abs(value) * .55;
  const relationStyle = value < 0
    ? `background:rgba(240,68,82,${intensity});color:${Math.abs(value) > .55 ? "#fff" : "#9f2634"}`
    : `background:rgba(49,130,246,${intensity});color:${Math.abs(value) > .55 ? "#fff" : "#145ab2"}`;
  $("#correlation-matrix").innerHTML = `<span></span><b>${escapeHtml(xLabel)}</b><b>${escapeHtml(yLabel)}</b><b>${escapeHtml(xLabel)}</b><strong>1.00</strong><strong style="${relationStyle}">${value.toFixed(2)}</strong><b>${escapeHtml(yLabel)}</b><strong style="${relationStyle}">${value.toFixed(2)}</strong><strong>1.00</strong>`;
  const directionCopy = Math.abs(value) < .2
    ? "두 지표가 함께 움직이는 뚜렷한 방향은 없습니다."
    : `${value > 0 ? "같은 방향" : "반대 방향"}으로 움직이는 경향은 ${strength(value)}입니다.`;
  $("#matrix-summary").innerHTML = `<b>읽어야 할 값은 ${value.toFixed(2)} 하나예요.</b> ${directionCopy}`;
}

function drawScatter(rows, stats) {
  const canvas = $("#scatter-chart"), rect = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
  const pad = { left: 58, right: 24, top: 24, bottom: 44 };
  const xs = rows.map((row) => row.x), ys = rows.map((row) => row.y);
  let minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spreadX = maxX - minX || 1, spreadY = maxY - minY || 1;
  minX -= spreadX * .12; maxX += spreadX * .12; minY -= spreadY * .12; maxY += spreadY * .12;
  const x = (value) => pad.left + (value - minX) / (maxX - minX) * (rect.width - pad.left - pad.right);
  const y = (value) => pad.top + (maxY - value) / (maxY - minY) * (rect.height - pad.top - pad.bottom);
  const uniqueX = new Set(xs.map((value) => value.toFixed(6))).size;
  const uniqueY = new Set(ys.map((value) => value.toFixed(6))).size;
  const discreteX = uniqueX <= Math.min(8, Math.ceil(rows.length / 3));
  const discreteY = uniqueY <= Math.min(8, Math.ceil(rows.length / 3));
  ctx.font = "13px Pretendard, Noto Sans KR, sans-serif";
  for (let step = 0; step <= 4; step += 1) {
    const xx = pad.left + (rect.width - pad.left - pad.right) * step / 4;
    const yy = pad.top + (rect.height - pad.top - pad.bottom) * step / 4;
    ctx.strokeStyle = "#e5e8eb"; ctx.beginPath(); ctx.moveTo(xx, pad.top); ctx.lineTo(xx, rect.height - pad.bottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad.left, yy); ctx.lineTo(rect.width - pad.right, yy); ctx.stroke();
    ctx.fillStyle = "#8b95a1"; ctx.textAlign = "center"; ctx.fillText((minX + (maxX - minX) * step / 4).toFixed(1), xx, rect.height - 17);
    ctx.textAlign = "right"; ctx.fillText((maxY - (maxY - minY) * step / 4).toFixed(1), pad.left - 9, yy + 3);
  }
  if (finite(stats.beta)) {
    ctx.strokeStyle = "#f04452"; ctx.lineWidth = 2.2; ctx.beginPath();
    ctx.moveTo(x(minX), y(stats.intercept + stats.beta * minX)); ctx.lineTo(x(maxX), y(stats.intercept + stats.beta * maxX)); ctx.stroke();
  }
  const plotted = rows.map((row, index) => {
    const jitter = ((index % 7) - 3) * 2.2;
    return { ...row, px: x(row.x) + (discreteX ? jitter : 0), py: y(row.y) + (discreteY ? jitter : 0) };
  });
  plotted.forEach((row) => { ctx.beginPath(); ctx.arc(row.px, row.py, 4, 0, Math.PI * 2); ctx.fillStyle = "rgba(49,130,246,.72)"; ctx.fill(); });
  const relation = Math.abs(stats.correlation) < .2 ? "뚜렷한 방향이 없는" : stats.correlation > 0 ? "같은 방향" : "반대 방향";
  $("#scatter-summary").innerHTML = discreteX || discreteY
    ? `<b>오류가 아니라 데이터 특성이에요.</b> ${discreteX ? `첫 번째 지표가 ${uniqueX}가지 값` : `두 번째 지표가 ${uniqueY}가지 값`}에 몰려 점이 ${discreteX ? "세로" : "가로"}로 겹칩니다. 점은 보기 좋게 조금만 펼쳤고 계산은 원값으로 했어요.`
    : `<b>두 지표는 ${relation} 관계이며 강도는 ${strength(stats.correlation)}입니다.</b> 직선과 멀리 떨어진 점은 평소와 달랐던 달입니다.`;
  lastScatter = { rows, stats, plotted };
}

function renderLags(stockChanges, macroChanges, method) {
  const values = Array.from({ length: 13 }, (_, index) => index - 6).map((lag) => {
    const rows = align(stockChanges, macroChanges, lag), result = statistics(rows, method);
    return { lag, count: rows.length, value: result.correlation };
  });
  $("#lag-bars").innerHTML = values.map(({ lag, count, value }) => {
    const width = finite(value) ? Math.abs(value) * 50 : 0;
    const left = finite(value) && value < 0 ? 50 - width : 50;
    const meaning = lag > 0 ? `첫 번째 지표가 ${lag}개월 먼저` : lag < 0 ? `두 번째 지표가 ${Math.abs(lag)}개월 먼저` : "같은 달";
    return `<div class="lag-row" title="${meaning} · 상관계수 ${finite(value) ? value.toFixed(2) : "계산 불가"}"><span>${lag > 0 ? "+" : ""}${lag}개월</span><div class="lag-track"><i class="lag-fill ${value < 0 ? "negative" : ""}" style="left:${left}%;width:${width}%"></i></div><b>${finite(value) ? value.toFixed(2) : "—"}</b><small>${count}개</small></div>`;
  }).join("");
  const strongest = values.filter((item) => finite(item.value)).sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
  if (strongest) {
    const timing = strongest.lag > 0 ? `첫 번째 지표가 ${strongest.lag}개월 먼저 움직인 조합` : strongest.lag < 0 ? `두 번째 지표가 ${Math.abs(strongest.lag)}개월 먼저 움직인 조합` : "같은 달 조합";
    $("#lag-summary").innerHTML = `<b>가장 크게 나온 관계는 ${strongest.value.toFixed(2)}예요.</b> ${timing}에서 나온 값입니다. 가장 큰 값이라는 이유만으로 한 지표가 다른 지표보다 먼저 움직인다고 단정할 수는 없어요.`;
  }
}

function rollingStatistics(rows, windowSize, method) {
  const values = [];
  for (let index = windowSize - 1; index < rows.length; index += 1) {
    const sample = rows.slice(index - windowSize + 1, index + 1);
    const result = statistics(sample, method);
    if (finite(result.correlation)) values.push({ month: rows[index].month, value: result.correlation });
  }
  return values;
}

function drawRolling(values, windowSize) {
  const canvas = $("#rolling-chart"), context = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1, width = canvas.clientWidth || 900, height = canvas.clientHeight || 300;
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height);
  const margin = { left: 52, right: 24, top: 24, bottom: 38 }, plotWidth = width - margin.left - margin.right, plotHeight = height - margin.top - margin.bottom;
  const x = (index) => margin.left + (values.length <= 1 ? plotWidth / 2 : (index / (values.length - 1)) * plotWidth);
  const y = (value) => margin.top + ((1 - value) / 2) * plotHeight;
  context.font = "13px Pretendard, Noto Sans KR, sans-serif"; context.textAlign = "right"; context.textBaseline = "middle";
  [-1, -.5, 0, .5, 1].forEach((tick) => { context.beginPath(); context.moveTo(margin.left, y(tick)); context.lineTo(width - margin.right, y(tick)); context.strokeStyle = tick === 0 ? "#aebdce" : "#e3e9f0"; context.stroke(); context.fillStyle = "#7b899d"; context.fillText(tick.toFixed(1), margin.left - 9, y(tick)); });
  if (values.length) {
    context.beginPath(); values.forEach((point, index) => index ? context.lineTo(x(index), y(point.value)) : context.moveTo(x(index), y(point.value))); context.strokeStyle = "#3182f6"; context.lineWidth = 2.5; context.stroke();
    const last = values.at(-1); context.beginPath(); context.arc(x(values.length - 1), y(last.value), 5, 0, Math.PI * 2); context.fillStyle = "#fff"; context.fill(); context.strokeStyle = "#3182f6"; context.lineWidth = 2.5; context.stroke();
    context.textAlign = "center"; context.textBaseline = "top"; [0, Math.floor((values.length - 1) / 2), values.length - 1].forEach((index) => { const month = values[index].month; context.fillStyle = "#7b899d"; context.fillText(`${month.slice(0, 4)}.${month.slice(4)}`, x(index), height - margin.bottom + 12); });
    const min = Math.min(...values.map((item) => item.value)), max = Math.max(...values.map((item) => item.value));
    $("#rolling-label").textContent = `${windowSize}개월씩 비교 · 최근 ${last.value.toFixed(2)}`;
    $("#rolling-summary").textContent = `${windowSize}개월씩 옮겨가며 계산한 관계는 ${min.toFixed(2)}~${max.toFixed(2)}였어요. 가장 최근 값은 ${last.value.toFixed(2)}입니다. 플러스와 마이너스를 오갔다면 관계가 늘 같지는 않았다는 뜻이에요.`;
  } else {
    context.fillStyle = "#7b899d"; context.textAlign = "center"; context.fillText(`${windowSize}개월씩 비교하기에는 데이터가 부족해요.`, width / 2, height / 2);
    $("#rolling-label").textContent = `${windowSize}개월씩 비교`;
  }
  const points = values.map((point, index) => ({ ...point, px: x(index), py: y(point.value) }));
  lastRolling = { values, windowSize, points };
}

function updateAnalysisMode() {
  const mode = $("#analysis-mode").value;
  const isMacroPair = mode === "macro-macro";
  $("#company-field").hidden = isMacroPair;
  $("#series-a-field").hidden = !isMacroPair;
  $("#series-b-label").textContent = isMacroPair ? "두 번째 지표" : "비교할 경제지표";
  if (companyGuide) companyGuide.hidden = isMacroPair;
  $("#analysis-status").textContent = isMacroPair
    ? "비교할 경제지표 두 개와 기간을 골라주세요."
    : "기업을 고른 뒤 함께 비교할 경제지표를 확인해 주세요.";
  updateSeriesContext();
}

async function setExample(name, label) {
  await catalogReady;
  const presets = {
    "fx-kr-rate": { mode: "macro-macro", a: "usd-krw", b: "kr-base-rate" },
    "fx-us-rate": { mode: "macro-macro", a: "usd-krw", b: "us-policy-rate" },
    "oil-fx": { mode: "macro-macro", a: "wti", b: "usd-krw" },
    "cpi-rate": { mode: "macro-macro", a: "kr-cpi", b: "kr-base-rate" },
    "copper-electronics": { mode: "macro-macro", a: "copper", b: "bsi-electronics" },
    "bond-spread": { mode: "macro-macro", a: "kr-3y", b: "kr-corp-3y" },
    "export-bsi": { mode: "macro-macro", a: "kr-export-volume", b: "bsi-electronics" },
    "emission-steel": { mode: "macro-macro", a: "krx-emission-kau", b: "krx-steel" },
    "diesel-transport": { mode: "macro-macro", a: "krx-diesel", b: "krx-transport" },
    "future-semiconductor": { mode: "macro-macro", a: "krx-future-semiconductor", b: "krx-semiconductor" },
    "esg-market": { mode: "macro-macro", a: "krx-esg-leaders", b: "krx-tmi" },
    "stock-fx": { mode: "company-macro", b: "usd-krw", company: { corpCode: "00126380", stockCode: "005930", name: "삼성전자" } },
  };
  const preset = presets[name]; if (!preset) return;
  $("#analysis-mode").value = preset.mode;
  if (preset.a) $("#series-a").value = preset.a;
  $("#macro-series").value = preset.b;
  if (preset.company) { selectedCompany = preset.company; $("#company-search").value = `${preset.company.name} · ${preset.company.stockCode}`; localStorage.setItem("activeCompany", JSON.stringify(preset.company)); }
  updateAnalysisMode();
  updateSeriesContext();
  document.querySelectorAll("[data-example]").forEach((button) => button.classList.toggle("selected", button.dataset.example === name));
  const message = `${label || "예시 조합"}을 선택했어요.`;
  $("#analysis-status").textContent = `${message} 실제 데이터를 계산하고 있습니다.`;
  enterAnalysisFocus(message);
  $("#analysis-settings").scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => $("#run-analysis").click(), 260);
}

$("#analysis-mode").addEventListener("change", updateAnalysisMode);
$("#series-a").addEventListener("change", updateSeriesContext);
$("#macro-series").addEventListener("change", updateSeriesContext);
document.querySelectorAll("[data-example]").forEach((button) => button.addEventListener("click", () => setExample(button.dataset.example, button.querySelector("b")?.textContent)));
$("#leave-analysis-focus").addEventListener("click", leaveAnalysisFocus);
document.querySelector('.workspace-side a[href="#relationship-overview"]')?.addEventListener("click", (event) => {
  event.preventDefault();
  leaveAnalysisFocus();
});
$("#toggle-analysis-controls").addEventListener("click", openAnalysisControls);
document.querySelectorAll(".lab-mode-grid a").forEach((link) => link.addEventListener("click", (event) => {
  document.querySelectorAll(".lab-mode-grid a").forEach((item) => item.classList.toggle("active", item === link));
  const target = document.querySelector(link.getAttribute("href"));
  if (!target) return;
  if (target.closest("#analysis-result") && $("#analysis-result").hidden) {
    event.preventDefault();
    enterAnalysisFocus("먼저 두 지표를 분석해 주세요.");
    $("#analysis-settings").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}));
document.querySelectorAll(".workspace-side a[href^='#']").forEach((link) => link.addEventListener("click", (event) => {
  const target = document.querySelector(link.getAttribute("href"));
  if (target?.closest("#analysis-result") && $("#analysis-result").hidden) {
    event.preventDefault();
    enterAnalysisFocus("먼저 두 지표를 분석해 주세요.");
    $("#analysis-settings").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}));

$("#run-analysis").onclick = async () => {
  await catalogReady;
  enterAnalysisFocus();
  const mode = $("#analysis-mode").value;
  if (mode === "company-macro" && !selectedCompany) { $("#analysis-status").textContent = "먼저 분석할 기업을 검색해 선택해 주세요."; return; }
  const years = Number($("#analysis-years").value), end = new Date(), begin = new Date(end); begin.setFullYear(begin.getFullYear() - years);
  const seriesBId = $("#macro-series").value;
  const method = $("#correlation-method").value;
  $("#analysis-status").className = "status"; $("#analysis-status").textContent = "두 데이터에서 같은 달의 값을 찾아 비교하고 있어요.";
  try {
    let xChanges, yChanges, xLabel, yLabel, missingCount = 0;
    if (mode === "macro-macro") {
      const seriesAId = $("#series-a").value;
      if (seriesAId === seriesBId) throw new Error("서로 다른 두 시계열을 선택해 주세요.");
      const [seriesA, seriesB] = await Promise.all([
        fetchJson(`/api/macro/series?id=${seriesAId}&beginDate=${compact(begin)}&endDate=${compact(end)}`),
        fetchJson(`/api/macro/series?id=${seriesBId}&beginDate=${compact(begin)}&endDate=${compact(end)}`),
      ]);
      if (seriesA.error || seriesB.error) throw new Error(seriesA.error || seriesB.error);
      xChanges = macroChanges(seriesA, seriesAId); yChanges = macroChanges(seriesB, seriesBId);
      xLabel = $("#series-a").selectedOptions[0].textContent; yLabel = $("#macro-series").selectedOptions[0].textContent;
      missingCount = Number(seriesA.quality?.missingCount || 0) + Number(seriesB.quality?.missingCount || 0);
    } else {
      const query = new URLSearchParams({ corpCodes: selectedCompany.corpCode, beginDate: compact(begin), endDate: compact(end) });
      const [market, macro] = await Promise.all([
        fetchJson(`/api/backtest-data?${query}`),
        fetchJson(`/api/macro/series?id=${seriesBId}&beginDate=${compact(begin)}&endDate=${compact(end)}`),
      ]);
      if (market.error || macro.error) throw new Error(market.error || macro.error);
      const priceLevels = monthlyLast(market.companies?.[0]?.history || [], "close");
      xChanges = macroChanges(macro, seriesBId); yChanges = changes(priceLevels, "percent");
      xLabel = $("#macro-series").selectedOptions[0].textContent; yLabel = `${selectedCompany.name} 월간 수익률`;
      missingCount = Number(macro.quality?.missingCount || 0);
    }
    const rows = align(yChanges, xChanges), stats = statistics(rows, method);
    if (rows.length < 12 || !finite(stats.correlation)) throw new Error(`두 지표에 모두 값이 있는 달이 ${rows.length}개월뿐이에요. 기간을 늘리거나 다른 지표를 골라주세요.`);
    const period = `${rows[0].month.slice(0, 4)}.${rows[0].month.slice(4)}~${rows.at(-1).month.slice(0, 4)}.${rows.at(-1).month.slice(4)}`;
    const methodLabel = method === "spearman" ? "스피어만 순위상관" : "피어슨 상관계수";
    const split = Math.max(3, Math.floor(rows.length / 2));
    const earlyCorrelation = statistics(rows.slice(0, split), method).correlation;
    const recentCorrelation = statistics(rows.slice(-split), method).correlation;
    $("#result-cards").innerHTML = [
      ["두 값의 관계", stats.correlation.toFixed(2), `${methodLabel} · ${strength(stats.correlation)}`],
      ["비교한 기간", period, `두 값이 모두 있는 ${rows.length}개월`],
      ["변화 폭(기울기)", stats.beta.toFixed(2), `첫 번째 지표(${xLabel})가 1단위 변할 때 두 번째 지표(${yLabel})의 평균 변화`],
      ["직선으로 설명되는 비율", finite(stats.rSquared) ? `${(stats.rSquared * 100).toFixed(1)}%` : "—", "R² · 원인과 결과를 뜻하지 않음"],
      ["처음과 최근의 관계", `${finite(earlyCorrelation) ? earlyCorrelation.toFixed(2) : "—"} → ${finite(recentCorrelation) ? recentCorrelation.toFixed(2) : "—"}`, "비교 기간의 앞부분 → 뒷부분"],
      ["원본에서 빠진 값", `${missingCount}건`, "빠진 값을 0으로 채우지 않고 계산에서 제외"],
    ].map(([title, value, note]) => `<article class="card"><h3>${escapeHtml(title)}</h3><div class="value">${escapeHtml(value)}</div><div class="sub">${escapeHtml(note)}</div></article>`).join("");
    $("#scatter-label").textContent = `${xLabel} × ${yLabel}`;
    $("#analysis-status").textContent = `분석기간: ${period} · 두 지표의 관계는 ${strengthSentence(stats.correlation)} · 상관계수 ${stats.correlation.toFixed(2)}`;
    $("#analysis-result").hidden = false;
    const relationDirection = Math.abs(stats.correlation) < .2 ? "뚜렷한 방향 없음" : stats.correlation > 0 ? "같은 방향" : "반대 방향";
    $("#analysis-insight-title").textContent = `두 지표의 관계는 ${strengthSentence(stats.correlation)}`;
    $("#analysis-insight-detail").textContent = `${period} · ${relationDirection} · 관계 수치 ${stats.correlation.toFixed(2)} · 두 값이 모두 있는 달 ${rows.length}개월. 한 지표가 다른 지표의 원인이라는 뜻은 아닙니다.`;
    $("#analysis-focus-summary").textContent = `${xLabel} × ${yLabel} · 상관계수 ${stats.correlation.toFixed(2)}`;
    document.body.classList.add("analysis-complete");
    lastAnalysis = { rows, xLabel, yLabel, method: methodLabel, period, stats, missingCount };
    $("#correlation-csv").disabled = false;
    renderMatrix(xLabel, yLabel, stats.correlation); drawScatter(rows, stats); renderLags(yChanges, xChanges, method);
    const rollingWindow = Number($("#rolling-window").value);
    drawRolling(rollingStatistics(rows, rollingWindow, method), rollingWindow);
    setTimeout(() => $("#analysis-result").scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  } catch (error) {
    lastAnalysis = null; $("#correlation-csv").disabled = true;
    $("#analysis-result").hidden = true; $("#analysis-status").className = "status error"; $("#analysis-status").textContent = error.message;
  }
};

$("#correlation-csv").addEventListener("click", () => {
  if (!lastAnalysis) return;
  const safe = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = [
    ["분석기간", lastAnalysis.period], ["분석법", lastAnalysis.method], ["상관계수", lastAnalysis.stats.correlation], ["민감도", lastAnalysis.stats.beta], ["R제곱", lastAnalysis.stats.rSquared], [],
    ["기준월", lastAnalysis.xLabel, lastAnalysis.yLabel],
    ...lastAnalysis.rows.map((row) => [row.month, row.x, row.y]),
  ].map((row) => row.map(safe).join(","));
  const url = URL.createObjectURL(new Blob([`\ufeff${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `finscope-correlation-${lastAnalysis.rows.at(-1).month}.csv`; link.click(); URL.revokeObjectURL(url);
});

$("#rolling-window").addEventListener("change", () => { if (!$("#analysis-result").hidden) $("#run-analysis").click(); });
function placeTip(tip, canvas, event, html) {
  const rect = canvas.getBoundingClientRect();
  tip.innerHTML = html;
  tip.hidden = false;
  tip.style.left = `${Math.min(rect.width - 190, Math.max(8, event.clientX - rect.left + 14))}px`;
  tip.style.top = `${Math.max(8, event.clientY - rect.top - 92)}px`;
}

$("#scatter-chart").addEventListener("mousemove", (event) => {
  if (!lastScatter?.plotted?.length || !lastAnalysis) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const px = event.clientX - rect.left, py = event.clientY - rect.top;
  const nearest = lastScatter.plotted.map((point) => ({ point, distance: Math.hypot(point.px - px, point.py - py) })).sort((a, b) => a.distance - b.distance)[0];
  if (!nearest || nearest.distance > 28) { $("#scatter-tip").hidden = true; return; }
  const point = nearest.point;
  placeTip($("#scatter-tip"), event.currentTarget, event, `<b>${point.month.slice(0, 4)}.${point.month.slice(4)}</b><span>${escapeHtml(lastAnalysis.xLabel)} <strong>${point.x.toFixed(2)}</strong></span><span>${escapeHtml(lastAnalysis.yLabel)} <strong>${point.y.toFixed(2)}</strong></span>`);
});
$("#scatter-chart").addEventListener("mouseleave", () => { $("#scatter-tip").hidden = true; });

$("#rolling-chart").addEventListener("mousemove", (event) => {
  if (!lastRolling?.points?.length) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const px = event.clientX - rect.left;
  const nearest = lastRolling.points.reduce((best, point) => Math.abs(point.px - px) < Math.abs(best.px - px) ? point : best);
  placeTip($("#rolling-tip"), event.currentTarget, event, `<b>${nearest.month.slice(0, 4)}.${nearest.month.slice(4)}</b><span>상관계수 <strong>${nearest.value.toFixed(2)}</strong></span><span>관계 강도 <strong>${strength(nearest.value)}</strong></span>`);
});
$("#rolling-chart").addEventListener("mouseleave", () => { $("#rolling-tip").hidden = true; });
window.addEventListener("resize", () => { if (lastScatter) drawScatter(lastScatter.rows, lastScatter.stats); if (lastRolling) drawRolling(lastRolling.values, lastRolling.windowSize); });
try { const saved = JSON.parse(localStorage.getItem("activeCompany") || "null"); if (saved?.corpCode) { selectedCompany = saved; $("#company-search").value = `${saved.name} · ${saved.stockCode}`; } } catch {}
updateAnalysisMode();
