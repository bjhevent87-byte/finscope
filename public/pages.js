export const $=(s)=>document.querySelector(s);
if(!document.querySelector('link[data-finscope-fonts]'))document.head.insertAdjacentHTML("beforeend",'<link data-finscope-fonts rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;600;700&family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap">');
document.head.insertAdjacentHTML("beforeend",'<link rel="stylesheet" href="ui-v7.css?v=16">');
document.head.insertAdjacentHTML("beforeend",'<link rel="stylesheet" href="pages-v11.css?v=17">');
document.head.insertAdjacentHTML("beforeend",'<link rel="stylesheet" href="workspace-refresh.css?v=2">');
document.head.insertAdjacentHTML("beforeend",'<link rel="stylesheet" href="workspace-unified.css?v=6">');
export const money=(v)=>{if(!Number.isFinite(v))return"공시 계정 없음";const a=Math.abs(v),s=v<0?"-":"";if(a>=1e12)return`${s}${(a/1e12).toFixed(a>=1e14?0:1)}조`;if(a>=1e8)return`${s}${(a/1e8).toFixed(0)}억`;return`${Math.round(v).toLocaleString("ko-KR")}원`};
export const percent=(v)=>Number.isFinite(v)?`${v.toFixed(1)}%`:"자료 없음";
export function setupSearch(input,results,onPick,clearAfterPick=false,endpoint="/api/companies"){
  let timer;input.addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(async()=>{
    if(!input.value.trim()){results.hidden=true;return}
    const items=await fetch(`${endpoint}?q=${encodeURIComponent(input.value)}`).then(r=>r.json());
    results.innerHTML=items.map(x=>`<button class="search-item" data-code="${x.corpCode}" data-name="${x.name}" data-stock="${x.stockCode}" data-type="${x.assetType||"STOCK"}"><b>${x.name}</b><span>${x.assetType==="ETF"?"ETF · ":""}${x.stockCode}${x.listingStatus==="inactive_or_unverified"?" · 구종목·상장 여부 확인":""}</span></button>`).join("")||'<div class="status">검색 결과가 없습니다.</div>';
    results.hidden=false;results.querySelectorAll("button").forEach(b=>b.onclick=()=>{onPick({corpCode:b.dataset.code,name:b.dataset.name,stockCode:b.dataset.stock,assetType:b.dataset.type});input.value=clearAfterPick?"":b.dataset.name;results.hidden=true;if(clearAfterPick)input.focus()});
  },220)});
}
export async function setupMarketGuide(anchor,onPick,title="기업 선택 가이드"){
  const guide=document.createElement("section");guide.className="market-guide";guide.innerHTML=`<div class="market-guide-head"><h3>${title}</h3><label class="field">시장<select data-guide-market><option>KOSPI</option><option>KOSDAQ</option></select></label><label class="field">업종<select data-guide-industry><option value="all">전체 업종</option></select></label><label class="field">정렬<select data-guide-sort><option value="marketCap">시가총액 상위</option><option value="volume">거래량 상위</option><option value="changeRate">등락률 상위</option></select></label><button class="button secondary" data-guide-load>목록 갱신</button></div><p class="note">종목을 모르더라도 시장·업종·관심 기준으로 살펴본 뒤 바로 선택할 수 있습니다. 거래량은 급증률이 아닌 최신 거래일 절대 거래량 기준입니다.</p><div class="guide-list" data-guide-list><div class="status">시장 목록을 불러오는 중입니다.</div></div>`;anchor.parentElement.insertBefore(guide,anchor);let data=[];
  const render=()=>{const industry=guide.querySelector('[data-guide-industry]').value,sort=guide.querySelector('[data-guide-sort]').value;const items=data.filter(x=>industry==="all"||x.industry===industry).sort((a,b)=>(Number(b[sort])||0)-(Number(a[sort])||0)).slice(0,12);guide.querySelector('[data-guide-list]').innerHTML=items.map(x=>`<button class="guide-item" data-guide-code="${x.corpCode}"><b>${x.name}</b><span>${x.industry}<br>${sort==="marketCap"?money(x.marketCap):sort==="volume"?`${Number(x.volume||0).toLocaleString("ko-KR")}주`:percent(x.changeRate)}</span></button>`).join("")||'<div class="status">선택한 업종의 기업이 없습니다.</div>';guide.querySelectorAll('[data-guide-code]').forEach(b=>b.onclick=()=>{const x=data.find(v=>v.corpCode===b.dataset.guideCode);if(x)onPick(x)})};
  const load=async()=>{const market=guide.querySelector('[data-guide-market]').value;guide.querySelector('[data-guide-list]').innerHTML='<div class="status">KRX·DART 목록을 불러오는 중입니다.</div>';const payload=await fetch(`/api/discover?market=${market}&limit=100`).then(r=>r.json());data=payload.companies||[];const industries=[...new Set(data.map(x=>x.industry))].sort((a,b)=>a.localeCompare(b,"ko"));guide.querySelector('[data-guide-industry]').innerHTML='<option value="all">전체 업종</option>'+industries.map(x=>`<option>${x}</option>`).join("");render()};
  guide.querySelector('[data-guide-load]').onclick=load;guide.querySelector('[data-guide-market]').onchange=load;guide.querySelector('[data-guide-industry]').onchange=render;guide.querySelector('[data-guide-sort]').onchange=render;load();return guide;
}
function setupWorkspaceNavigation() {
  if (window.__workspaceNavigationReady) return;
  const links = [...document.querySelectorAll(".workspace-side>a[href^='#']")];
  if (!links.length) return;
  window.__workspaceNavigationReady = true;
  const activate = (link) => links.forEach((item) => item.classList.toggle("active", item === link));
  const targetFor = (link) => document.querySelector(link.getAttribute("href"));
  const unavailable = (target) => Boolean(target && (target.hidden || target.closest("[hidden]")));
  const showHint = () => {
    let toast = document.querySelector(".workspace-nav-toast");
    if (!toast) { toast = document.createElement("div"); toast.className = "workspace-nav-toast"; document.body.append(toast); }
    toast.textContent = "먼저 데이터를 선택하고 분석해 주세요.";
    toast.classList.add("show");
    clearTimeout(window.__workspaceNavToastTimer);
    window.__workspaceNavToastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  };
  const refreshAvailability = () => links.forEach((link) => {
    const disabled = unavailable(targetFor(link));
    link.classList.toggle("unavailable", disabled);
    link.setAttribute("aria-disabled", String(disabled));
    link.title = disabled ? "분석을 실행하면 확인할 수 있어요." : "";
  });
  links.forEach((link, index) => link.addEventListener("click", (event) => {
    const target = targetFor(link);
    if (unavailable(target)) {
      event.preventDefault();
      const fallback = links.slice(1, index).reverse().find((item) => !unavailable(targetFor(item))) || links.find((item, itemIndex) => itemIndex > 0 && !unavailable(targetFor(item)));
      if (fallback) { activate(fallback); targetFor(fallback)?.scrollIntoView({ behavior: "smooth", block: "start" }); }
      showHint();
      return;
    }
    activate(link);
  }));
  refreshAvailability();
  new MutationObserver(refreshAvailability).observe(document.body, { attributes: true, attributeFilter: ["hidden"], subtree: true });
  if (!("IntersectionObserver" in window)) return;
  const targets = links.map(targetFor).filter(Boolean);
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const link = links.find((item) => item.getAttribute("href") === `#${visible.target.id}`);
    if (link) activate(link);
  }, { rootMargin: "-18% 0px -68% 0px", threshold: [0, .1, .35] });
  targets.forEach((target) => observer.observe(target));
}
export function nav(active) {
  document.body.classList.add("workspace-navigation");
  const links = [
    ["home", "/", "⌂", "홈"], ["correlation", "/correlation.html", "⌁", "데이터 실험실"],
    ["compare", "/index.html", "▦", "기업 비교"], ["company", "/company.html", "◎", "기업 분석"],
    ["filings", "/filings.html", "▤", "DART 공시"], ["research", "/research.html", "⌕", "리서치"],
    ["backtest", "/backtest.html", "↗", "백테스트"], ["etf", "/etf.html", "◇", "ETF 비교"],
  ];
  const topActive = active === "mission" ? "correlation" : active;
  const topLinks = links.map(([key, href, icon, label]) => `<a class="${topActive === key ? "active" : ""}" href="${href}">${label}</a>`).join("");
  const localMenus = {
    correlation: [["#relationship-overview", "◎", "처음 보기"], ["#analysis-examples", "☆", "궁금한 질문 고르기"], ["#analysis-settings", "⚙", "두 데이터 비교"], ["#scatter-analysis", "⌁", "월별 움직임"], ["#matrix-analysis", "▦", "관계의 방향"], ["#lag-analysis", "↔", "먼저 움직인 쪽"], ["#rolling-analysis", "∿", "시간별 관계 변화"], ["#method-guide", "?", "계산 방법"], ["#industry-lab", "◆", "시장 변화와 업종"]],
    mission: [["#mission-overview", "◆", "처음 보기"], ["#mission-result", "▦", "업종별 결과"], ["#mission-chart", "↗", "업종 움직임"], ["#company-check", "◎", "대표기업 주가"], ["#mission-method", "?", "계산 방법"]],
    company: [["#company-overview", "◎", "분석 시작"], ["#company-analysis", "⌕", "기업·목적 선택"], ["#decision", "✓", "한 줄 결론"], ["#financial-health", "▦", "재무 상태"], ["#external-factors", "↔", "환율·금리 관계"], ["#market-behavior", "↗", "주가·거래량"], ["#financials", "≡", "연도별 재무"], ["#company-research", "▤", "관련 리포트"], ["#analysis-method", "?", "분석 기준"]],
    filings: [["#filings-overview", "◎", "공시 한눈에"], ["#filing-search", "⌕", "기업·기간 선택"], ["#list", "▤", "결과 보기"]],
    research: [["#research-overview", "◎", "리서치 한눈에"], ["#research-search", "⌕", "기업 고르기"], ["#links", "↗", "보고서 보기"], ["#research-policy", "!", "확인할 점"]],
    backtest: [["#backtest-overview", "◎", "처음 보기"], ["#backtest-builder", "+", "자산 담기"], ["#weights", "%", "비중 정하기"], ["#summary", "▦", "결과 비교"], ["#backtest-policy", "!", "꼭 확인할 점"]],
    etf: [["#etf-overview", "◎", "ETF 둘러보기"], ["#etf-select", "⌕", "상품 담기"], ["#etf-output", "▦", "한눈에 비교"], ["#etf-policy", "!", "꼭 확인할 점"]],
  };
  const sideTitles = { correlation: "데이터 실험실", company: "기업 분석", filings: "DART 공시", research: "리서치", backtest: "백테스트", etf: "ETF 비교", mission: "환율·금리 업종 비교" };
  const sideNotes = {
    correlation: ["질문부터 골라보세요", "예시 질문을 고르면 필요한 데이터와 분석 방법이 자동으로 설정돼요."],
    company: ["읽는 순서", "한 줄 결론 → 재무 상태 → 환율·금리 관계 → 공시 원문 순서로 확인해보세요."],
    filings: ["원문도 확인하세요", "공시 제목을 누르면 DART 원문에서 내용을 직접 확인할 수 있어요."],
    research: ["확인 순서", "요약보다 작성일·작성기관·원문 내용을 먼저 확인해보세요."],
    backtest: ["빠르게 시작하기", "예시 구성을 고르면 투자 비중을 하나씩 입력하지 않아도 돼요."],
    etf: ["비교하는 순서", "관심 ETF를 담고 같은 기간의 수익률과 시장가격·자산가치의 차이를 비교해보세요."],
    mission: ["이 결과를 볼 때", "환율과 금리가 함께 오른 날의 평균입니다. 미래 수익을 예측한 값은 아니에요."],
  };
  const localIdSelectors = {
    filings: [["main .hero", "filings-overview"], ["main .panel", "filing-search"]],
    research: [["main .hero", "research-overview"], ["main .panel", "research-search"], ["main .panel.note", "research-policy"]],
  };
  (localIdSelectors[active] || []).forEach(([selector, id]) => { const element = document.querySelector(selector); if (element && !element.id) element.id = id; });
  const sideLinks = (localMenus[active] || []).map(([href, icon, label], index) => `<a class="${index === 0 ? "active" : ""}" href="${href}"><span>${icon}</span>${label}</a>`).join("");
  const note = sideNotes[active] || ["데이터 확인", "출처와 기준일을 함께 확인해보세요."];
  setTimeout(setupWorkspaceNavigation, 0);
  return `<header class="topbar"><a class="brand" href="/"><span class="brand-mark">F</span><span><b>FinScope</b><small>핀스코프</small></span></a><nav>${topLinks}</nav></header><aside class="workspace-side"><p>${sideTitles[active] || "FINSCOPE"}</p>${sideLinks}<div class="workspace-side-note"><b>${note[0]}</b><span>${note[1]}</span></div></aside>`;
}
