// A single stroke-icon system for the home, screener and all module sidebars.
const PATHS = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-8h6v8"/>',
  compass: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  chart: '<path d="M3 19h18"/><path d="M5 15 10 10l4 3 5-7"/><path d="M16 6h3v3"/>',
  bars: '<path d="M4 20V10h4v10M10 20V5h4v15M16 20v-8h4v8"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  sliders: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="8" cy="18" r="2" fill="currentColor" stroke="none"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  activity: '<path d="M2 12h4l3-5 5 10 3-5h5"/>',
  arrows: '<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
  file: '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5M9 12h8M9 16h8"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  spark: '<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8zM19 17l.6 1.4L21 19l-1.4.6L19 21l-.6-1.4L17 19l1.4-.6z"/>',
};

function iconFor(label) {
  if (/질문|예시/.test(label)) return "spark";
  if (/처음|시작|한눈|둘러/.test(label)) return "compass";
  if (/리포트|공시|보고서|원문/.test(label)) return "file";
  if (/ETF|상품|자산/.test(label)) return "layers";
  if (/고르기|선택|찾기|검색|담기/.test(label)) return "search";
  if (/조건|비중|설정/.test(label)) return "sliders";
  if (/기준|방법|확인할 점|정책/.test(label)) return "help";
  if (/데이터 상태|결론|검증/.test(label)) return "check";
  if (/금리|환율|외부요인|먼저 움직인/.test(label)) return "arrows";
  if (/산업|업종|관계의 방향/.test(label)) return "grid";
  if (/상관|움직임|변화|월별/.test(label)) return "activity";
  if (/주가|시가총액|거래량|추이|성과/.test(label)) return "chart";
  if (/재무|결과|비교/.test(label)) return "bars";
  return "home";
}

function upgrade() {
  const links = document.querySelectorAll(".workspace-side>a, .side-nav>a");
  if (!links.length) return false;
  for (const link of links) {
    const slot = link.querySelector(":scope > span");
    if (!slot || slot.classList.contains("fs-nav-icon")) continue;
    const icon = iconFor(link.textContent.trim());
    slot.className = "fs-nav-icon";
    slot.setAttribute("aria-hidden", "true");
    slot.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[icon]}</svg>`;
  }
  return true;
}

const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = "/sidebar-icons.css?v=1";
document.head.append(stylesheet);

if (!upgrade()) {
  const observer = new MutationObserver(() => { if (upgrade()) observer.disconnect(); });
  observer.observe(document.body, { childList: true, subtree: true });
}
