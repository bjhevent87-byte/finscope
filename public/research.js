import{$,setupSearch,setupMarketGuide,nav}from"./pages.js?v=19";
$("#nav").innerHTML=nav("research");

async function showResearch(company){
  localStorage.setItem("activeCompany",JSON.stringify(company));
  $("#search").value=company.name;$("#status").textContent=`${company.name} (${company.stockCode}) 리서치를 불러오는 중입니다.`;
  $("#links").innerHTML=`<a class="link-card" href="https://stock.naver.com/domestic/stock/${company.stockCode}/total" target="_blank" rel="noopener"><b>네이버증권 종목정보 ↗</b><p>시세·재무·뉴스 원문으로 이동합니다.</p></a><a class="link-card" href="https://stock.naver.com/research/company?searchText=${encodeURIComponent(company.name)}" target="_blank" rel="noopener"><b>전체 리서치 검색 ↗</b><p>네이버증권의 전체 검색결과를 엽니다.</p></a><div class="research-list panel" id="research-list"><div class="status">목록을 불러오는 중입니다.</div></div>`;
  try{
    const payload=await fetch(`/api/naver-research?stockCode=${company.stockCode}`).then(r=>r.json());
    const items=payload.items||[];$("#status").textContent=`${company.name} · 최근 공개 리서치 ${items.length}건`;
    $("#research-list").innerHTML=`<div class="section-row"><div><p class="eyebrow">RECENT REPORTS</p><h2>최근 리서치 목록</h2></div><span class="tag">출처: 네이버증권 · 비공식 공개 응답</span></div><div class="list">${items.map(item=>`<a href="${item.url}" target="_blank" rel="noopener" title="네이버증권 리서치 원문으로 이동"><span>${item.date.slice(0,4)}-${item.date.slice(4,6)}-${item.date.slice(6,8)}</span><b>${item.title}<small>${item.broker} · 조회 ${Number(item.views||0).toLocaleString("ko-KR")} · 제공 화면 네이버증권</small></b><span class="tag">네이버증권 원문 ↗</span></a>`).join("")||'<div class="status">최근 공개 리서치가 없습니다.</div>'}</div>`;
  }catch{$("#status").textContent=`${company.name} · 네이버 목록을 직접 불러오지 못했습니다.`;$("#research-list").innerHTML='<div class="status">내부 응답이 변경되면 목록 제공이 제한될 수 있습니다. 위의 전체 검색 링크를 이용해 주세요.</div>'}
}

setupSearch($("#search"),$("#results"),showResearch);
setupMarketGuide(document.querySelector(".panel"),showResearch,"시장의 관심 기업에서 리서치 시작하기");
const query=new URLSearchParams(location.search),linked={corpCode:query.get("corpCode"),name:query.get("name"),stockCode:query.get("stockCode")};
if(linked.stockCode&&linked.name)showResearch(linked);else try{const saved=JSON.parse(localStorage.getItem("activeCompany")||"null");if(saved?.stockCode)showResearch(saved)}catch{}
