const $lab = (selector) => document.querySelector(selector);
const DEFAULT_INDUSTRIES = ["semiconductor", "auto", "bank", "energy", "steel", "construction", "insurance", "healthcare"];
let industryCatalog = [];
let lastIndustryReport = null;
let lastChartRows = null;

const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const dateKey = (value) => String(value || "").replace(/\D/g, "").slice(0, 8);
const average = (values) => { const valid = values.filter(finite).map(Number); return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null; };
const percent = (value) => finite(value) ? `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}%` : "—";
const percentagePoint = (value) => finite(value) ? `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}%p` : "—";
const formatDate = (value) => value?.length === 8 ? `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}` : value;

function levelMap(rows, field) {
  return new Map((rows || []).filter((row) => dateKey(row.date).length === 8 && finite(row[field])).map((row) => [dateKey(row.date), Number(row[field])]));
}

function dailyChanges(levels, point = false) {
  const output = new Map();
  const dates = [...levels.keys()].sort();
  for (let index = 1; index < dates.length; index += 1) {
    const current = levels.get(dates[index]), previous = levels.get(dates[index - 1]);
    if (!finite(current) || !finite(previous) || (!point && previous === 0)) continue;
    output.set(dates[index], point ? (current - previous) * 100 : ((current / previous) - 1) * 100);
  }
  return output;
}

function selectedScenario() {
  const factorA = $lab("#lab-factor-a")?.value || "usd-krw";
  const factorB = $lab("#lab-factor-b")?.value || "kr-3y";
  const factorAName = $lab("#lab-factor-a")?.selectedOptions[0]?.textContent || "원/달러 환율";
  const factorBName = $lab("#lab-factor-b")?.selectedOptions[0]?.textContent || "국고채 3년";
  const factorADirection = $lab("#lab-factor-a-direction")?.value || "up";
  const factorBDirection = $lab("#lab-factor-b-direction")?.value || "up";
  return {
    factorA, factorB, factorADirection, factorBDirection,
    label: `${factorAName} ${factorADirection === "up" ? "상승" : "하락"} + ${factorBName} ${factorBDirection === "up" ? "상승" : "하락"}`,
  };
}

const matchesDirection = (value, direction) => direction === "down" ? value < 0 : value > 0;

function analyzeIndustryPayload(payload) {
  const scenario = selectedScenario();
  const factorA = dailyChanges(levelMap((payload.macro.factorA || payload.macro.usdKrw).observations, "value"), payload.factorMeta?.a?.changeMode === "point");
  const factorB = dailyChanges(levelMap((payload.macro.factorB || payload.macro.kr3y).observations, "value"), payload.factorMeta?.b?.changeMode === "point");
  const industries = payload.industries.map((industry) => ({ ...industry, returns: dailyChanges(levelMap(industry.history, "close")) }));
  let dates = [...factorA.keys()].filter((date) => factorB.has(date) && industries.every((industry) => industry.returns.has(date))).sort();
  dates = dates.slice(-Number(payload.requestedTradingDays || 250));
  if (dates.length < 250) throw new Error(`공통 거래일이 ${dates.length}일뿐입니다. 분석하려면 250일 이상 필요합니다.`);
  const stressDates = dates.filter((date) => matchesDirection(factorA.get(date), scenario.factorADirection) && matchesDirection(factorB.get(date), scenario.factorBDirection));
  if (stressDates.length < 5) throw new Error(`${scenario.label} 조건의 거래일이 ${stressDates.length}일뿐입니다. 분석 기간을 늘리거나 다른 방향을 선택해 주세요.`);
  const stressSet = new Set(stressDates);
  const normalDates = dates.filter((date) => !stressSet.has(date));
  const rows = industries.map((industry) => {
    const stressAverage = average(stressDates.map((date) => industry.returns.get(date)));
    const normalAverage = average(normalDates.map((date) => industry.returns.get(date)));
    const companyRows = industry.companies.map((company) => {
      const returns = dailyChanges(levelMap(company.history, "close"));
      return average(stressDates.map((date) => returns.get(date)));
    });
    return {
      id: industry.id,
      name: industry.name,
      indexName: industry.indexName,
      stressAverage,
      normalAverage,
      excess: finite(stressAverage) && finite(normalAverage) ? stressAverage - normalAverage : null,
      companyAverage: average(companyRows),
      companyCount: companyRows.filter(finite).length,
      companyTotal: companyRows.length,
    };
  }).sort((a, b) => b.stressAverage - a.stressAverage).map((row, index) => ({ ...row, rank: index + 1 }));
  return { payload, dates, stressDates, rows, scenario };
}

function selectedIndustryIds() {
  return [...document.querySelectorAll('[data-industry-id]:checked')].map((input) => input.dataset.industryId);
}

function updateSelectionCount(message = "") {
  const count = selectedIndustryIds().length;
  $lab("#industry-count").textContent = message || `${count}/10개 선택`;
}

function setIndustries(ids) {
  const allowed = new Set(ids.slice(0, 10));
  document.querySelectorAll("[data-industry-id]").forEach((input) => { input.checked = allowed.has(input.dataset.industryId); });
  updateSelectionCount();
}

function renderIndustryPicker() {
  $lab("#industry-picker").innerHTML = industryCatalog.map((industry) => `<label class="industry-option"><input type="checkbox" data-industry-id="${escapeHtml(industry.id)}"><span><b>${escapeHtml(industry.name)}</b><small>${escapeHtml(industry.indexName)} · 대표 ${industry.companies.length}개</small></span></label>`).join("");
  document.querySelectorAll("[data-industry-id]").forEach((input) => input.addEventListener("change", () => {
    const selected = selectedIndustryIds();
    if (selected.length > 10) {
      input.checked = false;
      $lab("#industry-lab-status").textContent = "한 화면에서 비교할 수 있는 업종은 최대 10개입니다.";
    }
    updateSelectionCount();
  }));
  setIndustries(DEFAULT_INDUSTRIES);
}

function drawIndustryChart(rows) {
  const canvas = $lab("#industry-stress-chart");
  const ratio = devicePixelRatio || 1, width = canvas.clientWidth || 700, height = canvas.clientHeight || 390;
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d"); context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height);
  const padding = { left: 92, right: 60, top: 18, bottom: 34 };
  const values = rows.map((row) => Number(row.stressAverage));
  const bound = Math.max(.1, ...values.map((value) => Math.abs(value))) * 1.3;
  const x = (value) => padding.left + ((value + bound) / (bound * 2)) * (width - padding.left - padding.right);
  const rowHeight = (height - padding.top - padding.bottom) / rows.length;
  context.font = "13px Pretendard, Noto Sans KR, sans-serif"; context.textBaseline = "middle";
  [-bound, 0, bound].forEach((tick) => {
    const xx = x(tick); context.beginPath(); context.moveTo(xx, padding.top); context.lineTo(xx, height - padding.bottom);
    context.strokeStyle = tick === 0 ? "#9ba9ba" : "#e4e9ef"; context.stroke(); context.textAlign = "center"; context.fillStyle = "#7b899d"; context.fillText(`${tick.toFixed(2)}%`, xx, height - 13);
  });
  rows.forEach((row, index) => {
    const centerY = padding.top + rowHeight * (index + .5), zeroX = x(0), valueX = x(row.stressAverage);
    context.fillStyle = index < 3 ? "#21b486" : index >= rows.length - 3 ? "#ef5b67" : "#6f87a5";
    context.fillRect(Math.min(zeroX, valueX), centerY - rowHeight * .24, Math.max(2, Math.abs(valueX - zeroX)), rowHeight * .48);
    context.fillStyle = "#26354b"; context.textAlign = "right"; context.fillText(row.name, padding.left - 10, centerY);
    context.textAlign = valueX >= zeroX ? "left" : "right"; context.fillText(percent(row.stressAverage), valueX + (valueX >= zeroX ? 6 : -6), centerY);
  });
  lastChartRows = rows;
}

function renderIndustryReport(report) {
  const { payload, dates, stressDates, rows, scenario } = report;
  const period = `${formatDate(dates[0])}~${formatDate(dates.at(-1))}`;
  const winner = rows[0], loser = rows.at(-1);
  $lab("#industry-summary").innerHTML = [
    ["비교한 기간", period, `두 시장지표와 업종지수가 모두 있는 ${dates.length}일`],
    ["두 변화가 겹친 날", `${stressDates.length}일`, `${scenario.label} · 전체 ${dates.length}일 중`],
    ["하루 평균이 가장 높았던 업종", winner.name, percent(winner.stressAverage)],
    ["하루 평균이 가장 낮았던 업종", loser.name, percent(loser.stressAverage)],
  ].map(([label, value, note]) => `<article><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b><small>${escapeHtml(note)}</small></article>`).join("");
  $lab("#industry-reading").innerHTML = `<b>첫 번째 업종을 예로 볼게요</b> 선택한 두 변화(${escapeHtml(scenario.label)})가 함께 나타난 <strong>${stressDates.length}일</strong>에 <strong>${escapeHtml(winner.name)}</strong> 업종지수는 하루 평균 <strong>${percent(winner.stressAverage)}</strong> 움직였어요. 두 변화가 겹치지 않은 ${dates.length - stressDates.length}일에는 평균 ${percent(winner.normalAverage)}였고, 차이는 <strong>${percentagePoint(winner.excess)}</strong>예요. 같은 날을 기준으로 데이터가 있는 대표기업 ${winner.companyCount}/${winner.companyTotal}곳의 하루 평균은 ${percent(winner.companyAverage)}예요.`;
  $lab("#industry-lab-body").innerHTML = rows.map((row) => `<tr><td>${row.rank}</td><td><b>${escapeHtml(row.name)}</b></td><td class="${row.stressAverage >= 0 ? "positive" : "negative"}">${percent(row.stressAverage)}</td><td>${percentagePoint(row.excess)}<small class="industry-metric-detail">겹치지 않은 날 ${percent(row.normalAverage)}</small></td><td>${percent(row.companyAverage)}<small class="industry-metric-detail">${row.companyCount}/${row.companyTotal}곳</small></td></tr>`).join("");
  $lab("#industry-lab-status").className = "status";
  $lab("#industry-lab-status").textContent = `${period} · 두 변화가 겹친 ${stressDates.length}일 · 업종 ${rows.length}개와 대표기업 ${rows.reduce((sum, row) => sum + row.companyCount, 0)}곳 비교 완료`;
  $lab("#industry-lab-result").hidden = false;
  $lab("#industry-csv").disabled = false;
  drawIndustryChart(rows);
}

async function loadIndustryCatalog() {
  try {
    const response = await fetch("/api/lab/industry-catalog");
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || "업종 목록을 불러오지 못했습니다.");
    industryCatalog = payload.industries || [];
    $lab("#classification-note").textContent = payload.note;
    renderIndustryPicker();
  } catch (error) {
    $lab("#industry-picker").innerHTML = `<div class="status error">${escapeHtml(error.message)}</div>`;
    updateSelectionCount("불러오기 실패");
  }
}

$lab("#industry-default").addEventListener("click", () => setIndustries(DEFAULT_INDUSTRIES));
$lab("#industry-clear").addEventListener("click", () => setIndustries([]));
["#lab-factor-a", "#lab-factor-a-direction", "#lab-factor-b", "#lab-factor-b-direction"].forEach((selector) => $lab(selector)?.addEventListener("change", () => {
  $lab("#industry-lab-result").hidden = true;
  $lab("#industry-csv").disabled = true;
  $lab("#industry-lab-status").textContent = `시장 변화를 바꿨어요. ‘선택한 상황에서 비교하기’를 눌러 새 결과를 확인하세요.`;
}));
$lab("#run-industry-lab").addEventListener("click", async () => {
  const selected = selectedIndustryIds();
  if (selected.length < 2) { $lab("#industry-lab-status").textContent = "비교할 업종을 2개 이상 골라주세요."; return; }
  $lab("#industry-lab-result").hidden = true; $lab("#industry-csv").disabled = true;
  $lab("#industry-lab-status").className = "status";
  $lab("#industry-lab-status").textContent = `선택한 시장 변화와 ${selected.length}개 업종의 데이터를 불러오고 있어요.`;
  try {
    const scenario = selectedScenario();
    const query = new URLSearchParams({ days: $lab("#lab-days").value, industries: selected.join(","), factorA: scenario.factorA, factorB: scenario.factorB });
    const response = await fetch(`/api/mission/rate-fx-industry?${query}`);
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || `요청 실패 (${response.status})`);
    lastIndustryReport = analyzeIndustryPayload(payload);
    renderIndustryReport(lastIndustryReport);
  } catch (error) {
    $lab("#industry-lab-status").className = "status error";
    $lab("#industry-lab-status").textContent = error.message;
  }
});

$lab("#industry-csv").addEventListener("click", () => {
  if (!lastIndustryReport) return;
  const safe = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = [["선택한 두 변화", lastIndustryReport.scenario.label], [], ["순위", "KRX 업종", "KRX 지수명", "두 변화가 겹친 날 업종지수 하루 평균(%)", "겹치지 않은 날 업종지수 하루 평균(%)", "하루 평균의 차이(%p)", "대표기업 주가 하루 평균(%)", "평균에 포함된 대표기업 수"], ...lastIndustryReport.rows.map((row) => [row.rank, row.name, row.indexName, row.stressAverage, row.normalAverage, row.excess, row.companyAverage, row.companyCount])];
  const url = URL.createObjectURL(new Blob([`\ufeff${rows.map((row) => row.map(safe).join(",")).join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `finscope-industry-stress-${lastIndustryReport.dates.at(-1)}.csv`; link.click(); URL.revokeObjectURL(url);
});

window.addEventListener("resize", () => { if (lastChartRows) drawIndustryChart(lastChartRows); });
loadIndustryCatalog().then(() => {
  if (location.hash === "#industry-lab" && industryCatalog.length) $lab("#run-industry-lab").click();
});
