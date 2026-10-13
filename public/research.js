import { $, setupSearch, setupMarketGuide, nav } from "./pages.js?v=21";
import { hankyungReportSearchUrl, stockDisplayName } from "./stock-identity.js";

$("#nav").innerHTML = nav("research");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

async function showResearch(company) {
  const name = stockDisplayName(company);
  const selected = { ...company, name };
  localStorage.setItem("activeCompany", JSON.stringify(selected));
  const stockCode = /^\d{6}$/.test(String(company.stockCode || "")) ? String(company.stockCode) : "";
  const consensusUrl = stockCode ? `https://markets.hankyung.com/stock/${stockCode}/consensus` : "https://markets.hankyung.com/consensus";
  const hankyungSearchUrl = hankyungReportSearchUrl(selected);
  $("#search").value = name;
  $("#status").textContent = `${name} (${stockCode}) 리포트를 불러오는 중입니다.`;
  $("#links").innerHTML = `<a class="link-card" href="https://stock.naver.com/domestic/stock/${stockCode}/total" target="_blank" rel="noopener"><b>네이버증권 종목정보 ↗</b><p>시세·재무·뉴스 원문으로 이동합니다.</p></a><a class="link-card" href="https://stock.naver.com/research/company?searchText=${encodeURIComponent(name)}" target="_blank" rel="noopener"><b>네이버증권 리포트 검색 ↗</b><p>${escapeHtml(name)}의 공개 리포트를 바로 찾습니다.</p></a><a class="link-card" href="${escapeHtml(hankyungSearchUrl)}" target="_blank" rel="noopener"><b>한경 컨센서스 리포트 검색 ↗</b><p>${escapeHtml(name)}의 최근 1년 기업 리포트를 바로 찾습니다.</p></a><a class="link-card" href="${consensusUrl}" target="_blank" rel="noopener"><b>선택 기업 컨센서스 ↗</b><p>투자의견과 목표주가를 한경 종목 화면에서 확인합니다.</p></a><div class="research-list panel" id="research-list"><div class="status">목록을 불러오는 중입니다.</div></div>`;
  try {
    const payload = await fetch(`/api/naver-research?stockCode=${stockCode}`).then((response) => response.json());
    const items = payload.items || [];
    $("#status").textContent = `${name} · 네이버증권 최근 공개 리포트 ${items.length}건`;
    $("#research-list").innerHTML = `<div class="section-row"><div><p class="eyebrow">RECENT REPORTS</p><h2>최근 리포트 목록</h2></div><span class="tag">출처: 네이버증권 · 비공식 공개 응답</span></div><div class="list">${items.map((item) => `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" title="네이버증권 리포트 원문으로 이동"><span>${escapeHtml(String(item.date || "").slice(0, 4))}-${escapeHtml(String(item.date || "").slice(4, 6))}-${escapeHtml(String(item.date || "").slice(6, 8))}</span><b>${escapeHtml(item.title)}<small>${escapeHtml(item.broker)} · 조회 ${Number(item.views || 0).toLocaleString("ko-KR")} · 제공 화면 네이버증권</small></b><span class="tag">네이버증권 원문 ↗</span></a>`).join("") || '<div class="status">최근 공개 리포트가 없습니다.</div>'}</div>`;
  } catch {
    $("#status").textContent = `${name} · 네이버 목록을 직접 불러오지 못했습니다.`;
    $("#research-list").innerHTML = '<div class="status">내부 응답이 변경되면 목록 제공이 제한될 수 있습니다. 위의 한경·네이버 검색 링크를 이용해 주세요.</div>';
  }
}

setupSearch($("#search"), $("#results"), showResearch);
setupMarketGuide(document.querySelector(".panel"), showResearch, "시장의 관심 기업에서 리포트 찾기");
const query = new URLSearchParams(location.search);
const linked = { corpCode: query.get("corpCode"), name: query.get("name"), stockCode: query.get("stockCode") };
if (/^\d{6}$/.test(linked.stockCode || "") && linked.name) showResearch(linked);
else try {
  const saved = JSON.parse(localStorage.getItem("activeCompany") || "null");
  if (saved?.stockCode) showResearch(saved);
} catch { /* no saved company */ }
