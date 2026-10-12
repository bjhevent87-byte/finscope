import { $, setupSearch, nav, money, percent } from "./pages.js?v=19";

$("#nav").innerHTML = nav("etf");
const colors = ["#3182f6", "#f97316", "#6366f1", "#a855f7", "#14b8a6", "#ef4444"];
let selected = JSON.parse(localStorage.getItem("compareEtfs") || "[]").slice(0, 6);
let chartState = null;

function compact(date) { return date.toISOString().slice(0, 10).replaceAll("-", ""); }
function formatDate(date) { return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`; }
function won(value) { return Number.isFinite(value) ? `${Math.round(value).toLocaleString("ko-KR")}원` : "자료 없음"; }

function range() {
  const end = new Date();
  const start = new Date(end);
  const period = $("#etf-period").value;
  if (period === "max") start.setFullYear(2020, 0, 1);
  else start.setFullYear(start.getFullYear() - Number(period));
  return { beginDate: compact(start), endDate: compact(end) };
}

function addEtf(etf) {
  if (selected.length >= 6 || selected.some((item) => item.corpCode === etf.corpCode)) return;
  selected.push(etf);
  renderSelected();
}

function renderSelected() {
  localStorage.setItem("compareEtfs", JSON.stringify(selected));
  $("#selected-etfs").innerHTML = selected.map((item) => `<span class="asset-chip">${item.name}<small>${item.stockCode}</small><button data-remove-etf="${item.corpCode}" aria-label="${item.name} 제거">×</button></span>`).join("") || '<span class="status-inline">검색창에서 비교할 ETF를 담아 주세요.</span>';
  document.querySelectorAll("[data-remove-etf]").forEach((button) => button.onclick = () => {
    selected = selected.filter((item) => item.corpCode !== button.dataset.removeEtf);
    renderSelected();
  });
}

setupSearch($("#etf-search"), $("#etf-results"), addEtf, true, "/api/etfs");

async function loadEtfGuide() {
  const labels = { korea: "한국", us: "미국", global: "글로벌", asset: "자산군" };
  await Promise.all(Object.keys(labels).map(async (category) => {
    const host = document.querySelector(`[data-etf-category="${category}"]`);
    host.innerHTML = '<span class="status-inline">불러오는 중…</span>';
    try {
      const items = await fetch(`/api/etfs?category=${category}&limit=8`).then((response) => response.json());
      host.innerHTML = items.map((item) => `<button type="button" class="etf-guide-item" data-guide-etf="${item.corpCode}"><span><b>${item.name}</b><small>${item.stockCode} · ${money(item.marketCap)}</small></span><em>담기</em></button>`).join("") || '<span class="status-inline">표시할 ETF가 없습니다.</span>';
      host.querySelectorAll("[data-guide-etf]").forEach((button) => button.onclick = () => {
        const item = items.find((candidate) => candidate.corpCode === button.dataset.guideEtf);
        if (item) addEtf(item);
      });
    } catch { host.innerHTML = '<span class="status-inline">목록을 불러오지 못했습니다.</span>'; }
  }));
}

$("#compare-etf").onclick = async () => {
  if (!selected.length) { $("#etf-status").textContent = "비교할 ETF를 먼저 선택해 주세요."; return; }
  $("#etf-status").textContent = "KRX ETF 시장지표와 기간별 가격을 불러오는 중입니다.";
  const { beginDate, endDate } = range();
  try {
    const [latest, history] = await Promise.all([
      fetch(`/api/etfs?codes=${encodeURIComponent(selected.map((item) => item.stockCode).join(","))}&limit=6`).then((response) => response.json()),
      fetch(`/api/backtest-data?corpCodes=${encodeURIComponent(selected.map((item) => item.corpCode).join(","))}&beginDate=${beginDate}&endDate=${endDate}`).then((response) => response.json()),
    ]);
    if (history.error) throw new Error(history.error);
    const byCode = new Map(latest.map((item) => [item.stockCode, item]));
    const rows = selected.map((item) => byCode.get(item.stockCode) || item);
    renderTable(rows);
    prepareChart(history.companies || []);
    $("#etf-output").hidden = false;
    const unofficial = (history.companies || []).filter((item) => item.sourceOfficial === false);
    const sourceText = unofficial.length
      ? ` · 기간 가격: 네이버 공개 일봉 보조 경로(${unofficial.map((item) => item.name).join(", ")})`
      : " · 기간 가격: 공식 공공 API";
    $("#etf-status").textContent = `${selected.length}개 ETF · 실제 공통 가격 기간 ${chartState ? `${formatDate(chartState.dates[0])} ~ ${formatDate(chartState.dates.at(-1))}` : "확인 불가"}${sourceText}`;
    requestAnimationFrame(() => drawChart());
  } catch (error) {
    $("#etf-status").textContent = `ETF 비교 실패: ${error.message}`;
  }
};

function renderTable(rows) {
  $("#etf-basis").textContent = rows[0]?.basisDate ? `KRX ${formatDate(rows[0].basisDate)}` : "KRX 최근 거래일";
  $("#etf-table").innerHTML = rows.map((item) => `<tr><td><b>${item.name}</b><small>${item.stockCode}</small></td><td>${won(item.price)}</td><td class="${item.changeRate > 0 ? "positive" : item.changeRate < 0 ? "negative" : ""}">${percent(item.changeRate)}</td><td>${won(item.nav)}</td><td>${percent(item.premium)}</td><td>${money(item.marketCap)}</td><td>${money(item.netAssets)}</td><td>${Number.isFinite(item.volume) ? `${item.volume.toLocaleString("ko-KR")}주` : "자료 없음"}</td><td>${item.underlying || "자료 없음"}</td></tr>`).join("");
}

function prepareChart(companies) {
  const maps = companies.map((company) => ({ ...company, values: new Map(company.history.map((row) => [row.date, row.close])) }));
  const dates = maps[0]?.history.map((row) => row.date).filter((date) => maps.every((item) => Number.isFinite(item.values.get(date)))) || [];
  const series = maps.map((item, index) => {
    const base = item.values.get(dates[0]);
    return { name: item.name, color: colors[index % colors.length], values: dates.map((date) => ((item.values.get(date) / base) - 1) * 100) };
  });
  chartState = dates.length > 1 ? { dates, series } : null;
}

function drawChart(active = null) {
  const canvas = $("#etf-chart");
  if (!chartState || !canvas) return;
  const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
  const { dates, series } = chartState, pad = { left: 66, right: 24, top: 40, bottom: 42 };
  const all = series.flatMap((item) => item.values), low = Math.min(...all), high = Math.max(...all), margin = (high - low || 10) * .1;
  const min = low - margin, max = high + margin;
  const x = (index) => pad.left + index / Math.max(dates.length - 1, 1) * (rect.width - pad.left - pad.right);
  const y = (value) => pad.top + (max - value) / (max - min) * (rect.height - pad.top - pad.bottom);
  ctx.font = "11px Noto Sans KR"; ctx.strokeStyle = "#e5e8eb"; ctx.fillStyle = "#8b95a1";
  for (let i = 0; i < 5; i++) { const value = min + (max - min) * i / 4, py = y(value); ctx.beginPath(); ctx.moveTo(pad.left, py); ctx.lineTo(rect.width - pad.right, py); ctx.stroke(); ctx.fillText(`${value.toFixed(0)}%`, 8, py + 4); }
  series.forEach((item) => { ctx.strokeStyle = item.color; ctx.lineWidth = 2.4; ctx.beginPath(); item.values.forEach((value, index) => index ? ctx.lineTo(x(index), y(value)) : ctx.moveTo(x(index), y(value))); ctx.stroke(); });
  ctx.textAlign = "center";
  for (let i = 0; i < 5; i++) { const index = Math.round((dates.length - 1) * i / 4); ctx.fillStyle = "#8b95a1"; ctx.fillText(`${dates[index].slice(0, 4)}-${dates[index].slice(4, 6)}`, x(index), rect.height - 13); }
  ctx.textAlign = "left"; series.forEach((item, index) => { ctx.fillStyle = item.color; ctx.fillText(`● ${item.name}`, pad.left + (index % 3) * 180, 18 + Math.floor(index / 3) * 16); });
  if (Number.isInteger(active)) series.forEach((item) => { ctx.fillStyle = "#fff"; ctx.strokeStyle = item.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x(active), y(item.values[active]), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
  canvas.onmousemove = (event) => { const bounds = canvas.getBoundingClientRect(), index = Math.max(0, Math.min(dates.length - 1, Math.round((event.clientX - bounds.left - pad.left) / (rect.width - pad.left - pad.right) * (dates.length - 1)))); const panel = $("#etf-hover"); panel.classList.add("active"); panel.innerHTML = `<strong>${formatDate(dates[index])}</strong><div class="etf-hover-grid">${series.map((item) => `<span><b style="color:${item.color}">${item.name}</b><em>${percent(item.values[index])}</em></span>`).join("")}</div>`; drawChart(index); };
  canvas.onmouseleave = () => { const panel = $("#etf-hover"); panel.classList.remove("active"); panel.innerHTML = "<span>그래프에 마우스를 올리면 날짜별 수익률을 이 영역에서 확인할 수 있습니다.</span>"; drawChart(); };
}

$("#etf-period").onchange = () => { if (selected.length) $("#compare-etf").click(); };
window.addEventListener("resize", () => chartState && drawChart());
renderSelected();
loadEtfGuide();
