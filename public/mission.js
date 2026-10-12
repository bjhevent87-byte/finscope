import { $, nav } from "./pages.js?v=19";

$("#nav").innerHTML = nav("mission");
let lastReport = null;
let lastDraw = null;

const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const dateKey = (value) => String(value || "").replace(/\D/g, "").slice(0, 8);
const avg = (values) => { const valid = values.filter(finite).map(Number); return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null; };
const pct = (value, digits = 2) => finite(value) ? `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(digits)}%` : "—";
const pp = (value) => finite(value) ? `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}%p` : "—";
const coefficient = (value) => finite(value) ? Number(value).toFixed(2) : "—";
const formatDate = (value) => `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;

function levelMap(rows, field) {
  return new Map((rows || []).filter((row) => dateKey(row.date).length === 8 && finite(row[field])).map((row) => [dateKey(row.date), Number(row[field])]));
}

function dailyChanges(levels, point = false) {
  const result = new Map(), dates = [...levels.keys()].sort();
  for (let index = 1; index < dates.length; index += 1) {
    const current = levels.get(dates[index]), previous = levels.get(dates[index - 1]);
    if (!finite(current) || !finite(previous) || (!point && previous === 0)) continue;
    result.set(dates[index], point ? (current - previous) * 100 : ((current / previous) - 1) * 100);
  }
  return result;
}

function correlation(pairs) {
  const rows = pairs.filter(([x, y]) => finite(x) && finite(y));
  if (rows.length < 3) return null;
  const meanX = avg(rows.map((row) => row[0])), meanY = avg(rows.map((row) => row[1]));
  const covariance = rows.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0);
  const varianceX = rows.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0);
  const varianceY = rows.reduce((sum, [, y]) => sum + (y - meanY) ** 2, 0);
  return varianceX && varianceY ? covariance / Math.sqrt(varianceX * varianceY) : null;
}

function cumulative(values) {
  const valid = values.filter(finite).map(Number);
  return valid.length ? (valid.reduce((product, value) => product * (1 + value / 100), 1) - 1) * 100 : null;
}

function analyze(payload) {
  const requested = Number(payload.requestedTradingDays || 250);
  const fx = dailyChanges(levelMap(payload.macro.usdKrw.observations, "value"));
  const rate = dailyChanges(levelMap(payload.macro.kr3y.observations, "value"), true);
  const industries = payload.industries.map((industry) => ({ ...industry, returns: dailyChanges(levelMap(industry.history, "close")) }));
  let dates = [...fx.keys()].filter((date) => rate.has(date) && industries.every((industry) => industry.returns.has(date))).sort();
  dates = dates.slice(-requested);
  if (dates.length < 250) throw new Error(`공통 거래일이 ${dates.length}일뿐입니다. 미션 조건인 250일을 충족하지 못했습니다.`);
  const stressDates = dates.filter((date) => fx.get(date) > 0 && rate.get(date) > 0);
  const stressSet = new Set(stressDates), normalDates = dates.filter((date) => !stressSet.has(date));
  const results = industries.map((industry) => {
    const allReturns = dates.map((date) => industry.returns.get(date));
    const stressReturns = stressDates.map((date) => industry.returns.get(date));
    const normalReturns = normalDates.map((date) => industry.returns.get(date));
    const companyResults = industry.companies.map((company) => {
      const returns = dailyChanges(levelMap(company.history, "close"));
      const values = stressDates.map((date) => returns.get(date)).filter(finite);
      return { ...company, stressAverage: avg(values), positiveRate: values.length ? values.filter((value) => value > 0).length / values.length * 100 : null, observations: values.length };
    });
    const stressAverage = avg(stressReturns), normalAverage = avg(normalReturns);
    return {
      ...industry,
      returns: undefined,
      stressAverage,
      normalAverage,
      excess: finite(stressAverage) && finite(normalAverage) ? stressAverage - normalAverage : null,
      fxCorrelation: correlation(dates.map((date) => [fx.get(date), industry.returns.get(date)])),
      rateCorrelation: correlation(dates.map((date) => [rate.get(date), industry.returns.get(date)])),
      positiveRate: stressReturns.filter((value) => value > 0).length / stressReturns.length * 100,
      periodReturn: cumulative(allReturns),
      companyAverage: avg(companyResults.map((company) => company.stressAverage)),
      companyCount: companyResults.filter((company) => finite(company.stressAverage)).length,
      companyTotal: companyResults.length,
      companies: companyResults,
    };
  }).sort((a, b) => b.stressAverage - a.stressAverage).map((item, index, list) => ({ ...item, rank: index + 1, verdict: index < 3 ? "상위" : index >= list.length - 3 ? "하위" : "중간" }));
  return { payload, dates, stressDates, normalDates, results, fx, rate };
}

function drawStressChart(results) {
  const canvas = $("#stress-chart"), ratio = devicePixelRatio || 1, width = canvas.clientWidth || 700, height = canvas.clientHeight || 440;
  canvas.width = width * ratio; canvas.height = height * ratio;
  const ctx = canvas.getContext("2d"); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
  const pad = { left: 100, right: 54, top: 24, bottom: 35 }, values = results.map((item) => item.stressAverage);
  const bound = Math.max(.1, ...values.map((value) => Math.abs(value))) * 1.25;
  const x = (value) => pad.left + ((value + bound) / (bound * 2)) * (width - pad.left - pad.right);
  const rowHeight = (height - pad.top - pad.bottom) / results.length;
  ctx.font = "11px sans-serif"; ctx.textBaseline = "middle";
  [-bound, -bound / 2, 0, bound / 2, bound].forEach((tick) => { const xx = x(tick); ctx.beginPath(); ctx.moveTo(xx, pad.top); ctx.lineTo(xx, height - pad.bottom); ctx.strokeStyle = tick === 0 ? "#9aa8ba" : "#e3e9f0"; ctx.stroke(); ctx.fillStyle = "#7b899d"; ctx.textAlign = "center"; ctx.fillText(`${tick.toFixed(2)}%`, xx, height - 14); });
  results.forEach((item, index) => {
    const center = pad.top + rowHeight * (index + .5), zero = x(0), target = x(item.stressAverage);
    ctx.fillStyle = item.verdict === "상위" ? "#21b486" : item.verdict === "하위" ? "#ef5b67" : "#7a8da6";
    ctx.fillRect(Math.min(zero, target), center - rowHeight * .25, Math.max(2, Math.abs(target - zero)), rowHeight * .5);
    ctx.textAlign = "right"; ctx.fillStyle = "#253044"; ctx.fillText(item.name, pad.left - 12, center);
    ctx.textAlign = "left"; ctx.fillText(pct(item.stressAverage), target + 7, center);
  });
}

function drawFactorChart(results) {
  const canvas = $("#factor-chart"), ratio = devicePixelRatio || 1, width = canvas.clientWidth || 700, height = canvas.clientHeight || 440;
  canvas.width = width * ratio; canvas.height = height * ratio;
  const ctx = canvas.getContext("2d"); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
  const pad = { left: 48, right: 34, top: 28, bottom: 44 }, x = (value) => pad.left + ((value + 1) / 2) * (width - pad.left - pad.right), y = (value) => pad.top + ((1 - value) / 2) * (height - pad.top - pad.bottom);
  [-1, -.5, 0, .5, 1].forEach((tick) => { ctx.strokeStyle = tick === 0 ? "#9aa8ba" : "#e3e9f0"; ctx.beginPath(); ctx.moveTo(x(tick), pad.top); ctx.lineTo(x(tick), height - pad.bottom); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pad.left, y(tick)); ctx.lineTo(width - pad.right, y(tick)); ctx.stroke(); ctx.fillStyle = "#7b899d"; ctx.font = "10px sans-serif"; ctx.textAlign = "center"; ctx.fillText(tick.toFixed(1), x(tick), height - 18); });
  results.forEach((item) => { const xx = x(item.fxCorrelation), yy = y(item.rateCorrelation); ctx.beginPath(); ctx.arc(xx, yy, 7, 0, Math.PI * 2); ctx.fillStyle = item.verdict === "상위" ? "#21b486" : item.verdict === "하위" ? "#ef5b67" : "#3182f6"; ctx.fill(); ctx.fillStyle = "#253044"; ctx.font = "10px sans-serif"; ctx.textAlign = xx > width - 110 ? "right" : "left"; ctx.fillText(item.name, xx + (xx > width - 110 ? -10 : 10), yy - 9); });
}

function render(report) {
  const { payload, dates, stressDates, results } = report, resilient = results.slice(0, 3), vulnerable = results.slice(-3).reverse();
  const period = `${formatDate(dates[0])}~${formatDate(dates.at(-1))}`;
  $("#mission-kpis").innerHTML = [
    ["비교한 기간", period, `환율·금리·업종지수 값이 모두 있는 ${dates.length}일`], ["환율·금리가 함께 오른 날", `${stressDates.length}일`, `전체의 ${(stressDates.length / dates.length * 100).toFixed(1)}%`], ["업종", `${results.length}개`, "KRX 업종지수 기준"], ["대표기업", `${results.reduce((sum, item) => sum + item.companies.length, 0)}개`, "업종별 최대 3곳"], ["빠진 데이터 처리", "평균에서 제외", "날짜와 값이 모두 있는 날만 계산"],
  ].map(([title, value, note]) => `<article class="card"><h3>${escapeHtml(title)}</h3><div class="value">${escapeHtml(value)}</div><div class="sub">${escapeHtml(note)}</div></article>`).join("");
  const describe = (items) => items.map((item) => `${item.name} ${pct(item.stressAverage)}`).join(" · ");
  $("#mission-conclusion").innerHTML = `<article class="conclusion-box resilient"><b>하루 평균이 가장 높았던 업종</b><p>${describe(resilient)}<br>환율·금리가 함께 오른 날, 비교한 8개 업종 중 상위 3개입니다.</p></article><article class="conclusion-box vulnerable"><b>하루 평균이 가장 낮았던 업종</b><p>${describe(vulnerable)}<br>같은 날을 기준으로 비교한 8개 업종 중 하위 3개입니다.</p></article>`;
  $("#ranking-period").textContent = period;
  const example = results[0];
  $("#mission-reading").innerHTML = `<b>첫 번째 업종을 예로 볼게요</b> 환율과 금리가 함께 오른 ${stressDates.length}일에 <strong>${escapeHtml(example.name)}</strong> 업종지수는 하루 평균 <strong>${pct(example.stressAverage)}</strong> 움직였어요. 함께 오르지 않은 ${dates.length - stressDates.length}일에는 평균 ${pct(example.normalAverage)}였고, 차이는 <strong>${pp(example.excess)}</strong>로 나타났어요. 데이터가 있는 대표기업 ${example.companyCount}/${example.companyTotal}곳의 하루 평균은 ${pct(example.companyAverage)}예요.`;
  $("#industry-body").innerHTML = results.map((item) => `<tr><td>${item.rank}</td><td><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.indexName)}</small></td><td><span class="verdict ${item.verdict === "상위" ? "resilient" : item.verdict === "하위" ? "vulnerable" : "neutral"}">${item.verdict}</span></td><td class="${item.stressAverage >= 0 ? "up" : "down"}">${pct(item.stressAverage)}</td><td>${pct(item.normalAverage)}</td><td>${pp(item.excess)}</td><td>${coefficient(item.fxCorrelation)}</td><td>${coefficient(item.rateCorrelation)}</td><td>${pct(item.positiveRate, 1)}</td><td>${pct(item.periodReturn, 1)}</td><td>${pct(item.companyAverage)}<small class="mission-company-count">${item.companyCount}/${item.companyTotal}곳</small></td></tr>`).join("");
  $("#company-grid").innerHTML = results.map((item) => `<article class="company-card"><h3>${item.rank}. ${escapeHtml(item.name)} <span class="verdict ${item.verdict === "상위" ? "resilient" : item.verdict === "하위" ? "vulnerable" : "neutral"}">${item.verdict}</span></h3><p>환율·금리가 함께 오른 날, 대표기업 ${item.companyCount}/${item.companyTotal}곳의 하루 평균 ${pct(item.companyAverage)}</p>${item.companies.map((company) => `<div class="company-row"><b>${escapeHtml(company.name)}</b><span class="${company.stressAverage >= 0 ? "up" : "down"}">${pct(company.stressAverage)} · 상승 ${pct(company.positiveRate, 1)}</span></div>`).join("")}</article>`).join("");
  $("#mission-sources").textContent = `출처: ${payload.sources.join(" · ")} · 생성 ${new Date(payload.generatedAt).toLocaleString("ko-KR")} · 상관관계와 과거 조건부 평균은 미래 수익을 보장하지 않습니다.`;
  $("#mission-status").className = "status";
  $("#mission-status").textContent = `${period} · ${dates.length}거래일 중 환율·금리가 함께 오른 날 ${stressDates.length}일 · 업종 ${results.length}개와 자료가 있는 대표기업 ${results.reduce((sum, item) => sum + item.companyCount, 0)}곳 비교 완료`;
  $("#mission-result").hidden = false; $("#mission-csv").disabled = false;
  drawStressChart(results); drawFactorChart(results); lastDraw = results;
}

$("#run-mission").addEventListener("click", async () => {
  $("#mission-result").hidden = true; $("#mission-csv").disabled = true; $("#mission-status").className = "status";
  $("#mission-status").textContent = "ECOS·금융위원회 공식 데이터를 수집하고 8개 산업·24개 기업을 정렬하고 있습니다. 첫 조회는 잠시 걸릴 수 있습니다.";
  try {
    const response = await fetch(`/api/mission/rate-fx-industry?days=${$("#mission-days").value}`);
    const payload = await response.json(); if (!response.ok || payload.error) throw new Error(payload.error || `요청 실패 (${response.status})`);
    lastReport = analyze(payload); render(lastReport);
  } catch (error) {
    $("#mission-status").className = "status error"; $("#mission-status").textContent = error.message;
  }
});

$("#mission-csv").addEventListener("click", () => {
  if (!lastReport) return;
  const safe = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = [["순위", "업종", "순위 구간", "환율·금리가 함께 오른 날의 업종지수 하루 평균(%)", "함께 오르지 않은 날의 업종지수 하루 평균(%)", "두 평균의 차이(%p)", "환율과의 상관계수", "금리와의 상관계수", "함께 오른 날 중 업종지수도 오른 비율(%)", "전체 기간의 수익률(%)", "자료가 있는 대표기업의 하루 평균 수익률(각 기업 같은 비중, %)", "평균에 포함된 대표기업 수"], ...lastReport.results.map((item) => [item.rank, item.name, item.verdict, item.stressAverage, item.normalAverage, item.excess, item.fxCorrelation, item.rateCorrelation, item.positiveRate, item.periodReturn, item.companyAverage, item.companyCount])];
  const url = URL.createObjectURL(new Blob([`\ufeff${rows.map((row) => row.map(safe).join(",")).join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `finscope-rate-fx-industry-${lastReport.dates.at(-1)}.csv`; link.click(); URL.revokeObjectURL(url);
});

window.addEventListener("resize", () => { if (lastDraw) { drawStressChart(lastDraw); drawFactorChart(lastDraw); } });
$("#run-mission").click();
