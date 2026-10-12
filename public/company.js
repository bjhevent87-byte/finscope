import{$,money,percent,setupSearch,setupMarketGuide,nav}from"./pages.js?v=21";
$("#nav").innerHTML=nav("company");
let selected=null,analysis=null;
const finite=Number.isFinite;
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const dateText=value=>value?`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`:"기준일 없음";
const won=value=>finite(value)?`${Math.round(value).toLocaleString("ko-KR")}원`:"자료 없음";
const multiple=value=>finite(value)?`${value.toFixed(1)}배`:"자료 없음";
const signedPercent=value=>finite(value)?`${value>=0?"+":""}${value.toFixed(1)}%`:"자료 없음";
const average=values=>{const valid=values.filter(finite);return valid.length?valid.reduce((sum,value)=>sum+value,0)/valid.length:null};
const std=values=>{const mean=average(values);return finite(mean)&&values.length>1?Math.sqrt(values.reduce((sum,value)=>sum+(value-mean)**2,0)/(values.length-1)):null};
const fetchJson=async url=>{const response=await fetch(url),payload=await response.json().catch(()=>({}));if(!response.ok||payload.error)throw new Error(payload.error||`데이터 요청 실패 (${response.status})`);return payload};
const range=()=>{const end=new Date(),start=new Date(end),value=$("#price-period").value;if(value==="max")start.setFullYear(2020,0,1);else start.setFullYear(start.getFullYear()-Number(value));const compact=date=>date.toISOString().slice(0,10).replaceAll("-","");return{beginDate:compact(start),endDate:compact(end)}};
const selectCompany=company=>{selected=company;$("#search").value=company.name;localStorage.setItem("activeCompany",JSON.stringify(company))};

setupSearch($("#search"),$("#results"),selectCompany);
setupMarketGuide(document.querySelector(".analysis-entry"),company=>{selectCompany(company);$("#run").click()},"시장과 업종에서 분석할 기업 고르기");
$("#run").onclick=runAnalysis;
$("#price-period").onchange=()=>{if(selected)runAnalysis()};
$("#analysis-purpose").onchange=()=>{if(analysis)renderDecision(analysis)};
$("#analysis-csv").onclick=()=>{if(analysis)downloadCsv(analysis)};

async function runAnalysis(){
  if(!selected){$("#status").textContent="먼저 분석할 기업을 선택해 주세요.";return}
  $("#status").hidden=false;$("#status").textContent="DART 재무, KRX 주가, ECOS 환율·금리를 한 기준으로 맞추는 중입니다.";
  try{
    const year=new Date().getFullYear()-1,dates=range(),query=new URLSearchParams({corpCodes:selected.corpCode,year:String(year),reportCode:"11011",...dates});
    const [compare,market,benchmark,fx,rate,research]=await Promise.all([
      fetchJson(`/api/compare?corpCodes=${selected.corpCode}&year=${year}&reportCode=11011`),
      fetchJson(`/api/backtest-data?${new URLSearchParams({corpCodes:selected.corpCode,...dates})}`),
      fetchJson(`/api/benchmarks?${query}`),
      fetchJson(`/api/macro/series?id=usd-krw&beginDate=${dates.beginDate}&endDate=${dates.endDate}`),
      fetchJson(`/api/macro/series?id=kr-base-rate&beginDate=${dates.beginDate}&endDate=${dates.endDate}`),
      fetchJson(`/api/naver-research?stockCode=${selected.stockCode}`).catch(error=>({items:[],error:error.message})),
    ]);
    const company=compare.companies?.[0];if(!company)throw new Error("기업 재무정보를 찾지 못했습니다.");
    const history=market.companies?.[0]?.history||company.market?.history||[];
    analysis={...buildAnalysis({...company,longHistory:history},benchmark.benchmarks?.[0]||null,{fx,rate},market),research};renderAnalysis(analysis);
  }catch(error){$("#status").hidden=false;$("#status").textContent=`분석을 완료하지 못했습니다: ${error.message}`}
}

function buildAnalysis(company,benchmark,macro,marketPayload){
  const financials=(company.financials||[]).filter(item=>item&&item.year).sort((a,b)=>a.year-b.year),latest=financials.at(-1)||{},history=company.longHistory||[];
  const market=marketAnalysis(history,benchmark?.returnHistory?.at(-1)?.value);
  const sensitivities=[sensitivity("원/달러 환율",macro.fx,history,"percent","환율이 오른 달에 주가 수익률이 어떻게 움직였는지 봅니다."),sensitivity("한국 기준금리",macro.rate,history,"point","기준금리가 바뀐 달의 주가 수익률 방향을 봅니다.")];
  const metrics=company.isFinancial?[
    metric("ROE",financials,"roe",false,1,benchmark,"roe"),metric("순이익",financials,"netIncome",false,null,null,null,"money"),metric("자기자본",financials,"equity",false,null,null,null,"money"),metric("배당수익률",[{year:latest.year,dividendYield:company.dividend?.dividendYield}],"dividendYield",false,null,null,null,"percent"),
  ]:[
    metric("영업이익률",financials,"operatingMargin",false,1,benchmark,"operatingMargin"),metric("ROE",financials,"roe",false,1,benchmark,"roe"),metric("부채비율",financials,"debtRatio",true,5,benchmark,"debtRatio"),metric("이자보상배율",financials,"interestCoverage",false,.5,benchmark,"interestCoverage","multiple"),metric("FCF 마진",financials,"fcfMargin",false,1,benchmark,"fcfMargin"),
  ];
  return{company,financials,latest,benchmark,macro,marketPayload,market,sensitivities,metrics,quality:qualityChecks(company,financials,macro,benchmark),generatedAt:new Date().toISOString()};
}

function metric(label,financials,key,lowerBetter=false,threshold=1,benchmark=null,benchmarkKey=null,format="percent"){
  const valid=financials.filter(item=>finite(item[key])),recent=valid.slice(-3),value=valid.at(-1)?.[key],change=recent.length>1?recent.at(-1)[key]-recent[0][key]:null;let state="자료 부족",tone="neutral";
  if(finite(change)){const boundary=threshold??Math.max(Math.abs(recent[0][key])*.05,1);if(Math.abs(change)<boundary)state="보합";else if((change>0)!==lowerBetter){state="개선";tone="good"}else{state="악화";tone="bad"}if(recent.length===3){const first=recent[1][key]-recent[0][key],second=recent[2][key]-recent[1][key];if(first*second<0&&Math.abs(change)<boundary*2){state="변동";tone="neutral"}}}
  const distribution=benchmark?.metricDistributions?.[benchmarkKey]||[];let peer="같은 업종의 비교자료가 부족해요",rank=null;if(finite(value)&&distribution.length){rank=distribution.filter(item=>lowerBetter?item<value:item>value).length+1;peer=`같은 업종 기업 ${distribution.length}곳 중 ${rank}위 수준`}
  const formatter=format==="money"?money:format==="multiple"?multiple:percent;return{label,key,value,change,state,tone,peer,rank,peerCount:distribution.length,format,display:formatter(value)};
}

function marketAnalysis(history,benchmarkReturn){
  const returns=history.slice(1).map((row,index)=>{const prior=history[index]?.close;return finite(row.close)&&finite(prior)&&prior!==0?(row.close/prior-1)*100:null}).filter(finite),periodReturn=history.length>1?(history.at(-1).close/history[0].close-1)*100:null,sd=std(returns),volatility=finite(sd)?sd*Math.sqrt(252):null;let volumeSurgeDays=0;
  history.forEach((row,index)=>{if(index<20||!finite(row.volume))return;const baseline=average(history.slice(index-20,index).map(item=>item.volume));if(finite(baseline)&&baseline>0&&row.volume>=baseline*3)volumeSurgeDays++});
  return{periodReturn,volatility,volumeSurgeDays,benchmarkReturn,excessReturn:finite(periodReturn)&&finite(benchmarkReturn)?periodReturn-benchmarkReturn:null,tradingDays:history.length};
}
function monthlyLast(rows,dateKey="date",valueKey="value"){const map=new Map();rows.forEach(row=>{const raw=String(row[dateKey]||""),month=raw.replace(/\D/g,"").slice(0,6),value=Number(row[valueKey]);if(month.length===6&&finite(value))map.set(month,value)});return[...map].sort(([a],[b])=>a.localeCompare(b)).map(([month,value])=>({month,value}))}
function monthlyChanges(rows,mode){return rows.slice(1).map((row,index)=>{const prior=rows[index].value,value=mode==="point"?row.value-prior:prior!==0?(row.value/prior-1)*100:null;return{month:row.month,value}}).filter(item=>finite(item.value))}
function pearson(pairs){if(pairs.length<6)return null;const xs=pairs.map(item=>item.x),ys=pairs.map(item=>item.y),mx=average(xs),my=average(ys),sx=Math.sqrt(xs.reduce((sum,value)=>sum+(value-mx)**2,0)),sy=Math.sqrt(ys.reduce((sum,value)=>sum+(value-my)**2,0));if(!sx||!sy)return null;return xs.reduce((sum,value,index)=>sum+(value-mx)*(ys[index]-my),0)/(sx*sy)}
function sensitivity(name,series,history,mode,description){
  const stock=monthlyChanges(monthlyLast(history,"date","close"),"percent"),factor=monthlyChanges(monthlyLast(series?.observations||[]),mode),factorMap=new Map(factor.map(item=>[item.month,item.value])),pairs=stock.filter(item=>factorMap.has(item.month)).map(item=>({month:item.month,x:factorMap.get(item.month),y:item.value})),coefficient=pearson(pairs),distinct=new Set(pairs.map(item=>item.x.toFixed(6))).size,usable=finite(coefficient)&&pairs.length>=12&&distinct>=3,absolute=usable?Math.abs(coefficient):null,strength=!usable?"판단 유보":absolute<.2?"매우 약함":absolute<.4?"약함":absolute<.6?"보통":"강함",direction=!usable?"변화 관측치가 부족해 방향을 단정하기 어렵습니다.":coefficient>0?"지표가 오를 때 주가도 같은 방향인 경향이 있었습니다.":"지표가 오를 때 주가는 반대 방향인 경향이 있었습니다.";
  return{name,series,coefficient:usable?coefficient:null,rawCoefficient:coefficient,pairs,distinct,strength,direction,description,mode};
}
function qualityChecks(company,financials,macro,benchmark){
  const latest=financials.at(-1)||{},years=financials.filter(item=>[item.revenue,item.operatingProfit,item.netIncome,item.assets,item.equity].some(finite)).map(item=>item.year),bases=[...new Set(financials.map(item=>item.statementBasis).filter(Boolean))],core=company.isFinancial?["netIncome","equity","roe"]:["revenue","operatingProfit","netIncome","debtRatio","fcf"],missing=core.filter(key=>!finite(latest[key]));
  return[{ok:years.length>=3,text:`재무자료 ${years.length}년치 사용${years.length?` (${years.slice(-3).join("·")})`:""}`},{ok:bases.length===1,text:bases.length?`재무제표 기준: ${bases.join("·")} · ${bases.length===1?"연도별 기준이 같아요":"연도별 기준이 섞여 있어요"}`:"연결·별도 재무제표 기준 확인 필요"},{ok:missing.length===0,text:missing.length?`주요 재무 숫자 ${missing.length}개가 없어요`:"주요 재무 숫자를 확인했어요"},{ok:Boolean(benchmark?.peerCount),text:benchmark?.peerCount?`같은 업종 기업 ${benchmark.peerCount}곳과 비교`:"같은 업종의 비교자료가 없어요"},{ok:(macro.fx?.observations?.length||0)>12&&(macro.rate?.observations?.length||0)>12,text:`환율 데이터 ${macro.fx?.observations?.length||0}개 · 금리 데이터 ${macro.rate?.observations?.length||0}개`},...(company.warnings||[]).slice(0,2).map(message=>({ok:false,text:`데이터 수집 주의: ${message}`}))];
}

function renderAnalysis(data){
  $("#status").hidden=true;$("#content").hidden=false;renderDecision(data);renderSummary(data);renderHealth(data);renderFactors(data);renderMarket(data);renderFinancials(data);renderResearch(data);
  $("#open-lab").href=`/correlation.html?${new URLSearchParams({mode:"company-macro",company:data.company.corpCode,b:"usd-krw",autorun:"1"})}#analysis-settings`;
  $("#decision").scrollIntoView({behavior:"smooth",block:"start"});
}
function decisionModel(data){
  const purpose=$("#analysis-purpose").value,latest=data.latest,evidence=[];let internalRisk=0;
  if(data.company.isFinancial){if(finite(latest.roe)){evidence.push(`ROE ${percent(latest.roe)}로 업종 내 상대 위치를 함께 확인해야 합니다.`);if(latest.roe<5)internalRisk++}if(finite(latest.netIncome)){evidence.push(`최신 순이익은 ${money(latest.netIncome)}입니다.`);if(latest.netIncome<=0)internalRisk+=2}}
  else{if(finite(latest.operatingMargin)){evidence.push(`영업이익률 ${percent(latest.operatingMargin)} · ${data.metrics.find(item=>item.key==="operatingMargin")?.state||"추세 확인"}`);if(latest.operatingMargin<5)internalRisk++}if(finite(latest.interestCoverage)){evidence.push(`이자보상배율 ${multiple(latest.interestCoverage)}로 영업이익의 이자 감당력을 확인했습니다.`);if(latest.interestCoverage<3)internalRisk+=2}else evidence.push("이자비용 계정이 없어 이자보상배율은 판단에서 제외했습니다.");if(finite(latest.fcf)){evidence.push(`잉여현금흐름은 ${money(latest.fcf)}입니다.`);if(latest.fcf<0)internalRisk++}}
  const sensitive=data.sensitivities.filter(item=>finite(item.coefficient)&&Math.abs(item.coefficient)>=.3).sort((a,b)=>Math.abs(b.coefficient)-Math.abs(a.coefficient))[0];if(sensitive)evidence.push(`${sensitive.name}과 월간 주가 수익률의 상관계수는 ${sensitive.coefficient.toFixed(2)} (${sensitive.strength})입니다.`);
  const purposeLabel={investment:"투자 후보",credit:"여신·상환능력",performance:"경영성과"}[purpose];let title,copy;
  if(data.company.isFinancial){title=`${data.company.name}: 수익성은 확인되지만 금융업 전용 건전성 지표가 더 필요합니다.`;copy=`${purposeLabel} 관점의 1차 진단입니다. 일반 제조기업의 부채비율·FCF 규칙을 적용하지 않았으며 BIS비율, NIM, 연체율 등 금융업 지표를 공시에서 추가 확인해야 합니다.`}
  else if(internalRisk>=2){title=`${data.company.name}: 현금흐름과 빚을 감당할 힘을 먼저 살펴보세요.`;copy=`${purposeLabel} 관점에서 현금 창출이나 이자 부담에 주의할 신호가 있어요. 아래 근거와 DART 공시 원문을 확인한 뒤 판단해 주세요.`}
  else if(sensitive){title=`${data.company.name}: 재무 상태와 ${sensitive.name}의 관계를 함께 보세요.`;copy=`${purposeLabel} 관점에서 뚜렷한 내부 위험 신호는 적지만, ${sensitive.name}과 주가가 함께 움직인 달이 있었어요. 원인과 결과를 뜻하지는 않습니다.`}
  else{title=`${data.company.name}: 뚜렷한 단일 위험요인보다 추세의 지속성을 확인하세요.`;copy=`${purposeLabel} 관점에서 한 가지 숫자로 단정하기 어렵습니다. 재무 3년 추세, 업종 내 위치, 현금흐름을 함께 읽는 것이 적절합니다.`}
  return{title,copy,evidence:evidence.slice(0,4)};
}
function renderDecision(data){const model=decisionModel(data);$("#decision-title").textContent=model.title;$("#decision-copy").textContent=model.copy;$("#decision-evidence").innerHTML=model.evidence.map((text,index)=>`<div class="evidence-row"><b>근거 ${index+1}</b><span>${esc(text)}</span></div>`).join("")}
function renderSummary(data){
  const f=data.latest,basis=f.year?`${f.year}년 사업보고서 · ${f.statementBasis||"연결 우선"}`:"선택 기간 공시 없음",cards=[["최신 종가",won(data.company.market?.price),`${dateText(data.company.market?.date)} 기준`],["분석기간 수익률",signedPercent(data.market.periodReturn),`${data.market.tradingDays}거래일`],["매출",money(f.revenue),basis],["영업이익",money(f.operatingProfit),basis],["순이익",money(f.netIncome),basis],["ROE",percent(f.roe),"단순 계산값"],[data.company.isFinancial?"자기자본":"부채비율",data.company.isFinancial?money(f.equity):percent(f.debtRatio),basis],["잉여현금흐름",money(f.fcf),finite(f.fcfMargin)?`매출 대비 ${percent(f.fcfMargin)}`:"영업CF-투자CF 기준"]];
  $("#summary").innerHTML=cards.map(([title,value,sub])=>`<article class="card"><h3>${esc(title)}</h3><div class="value">${esc(value)}</div><div class="sub">${esc(sub)}</div></article>`).join("");
}
function renderHealth(data){
  const basis=[...new Set(data.financials.map(item=>item.statementBasis).filter(Boolean))];$("#financial-basis").textContent=basis.length?`DART ${basis.join("·")} 기준`:"재무제표 기준 확인 필요";
  $("#health-cards").innerHTML=data.metrics.map(item=>`<article class="health-card"><header><h3>${esc(item.label)}</h3><span class="trend-chip ${item.tone}">${item.state}</span></header><div class="health-value">${esc(item.display)}</div><div class="health-peer">${esc(item.peer)}${finite(item.change)?`<br>3년 변화 ${item.change>=0?"+":""}${item.format==="multiple"?item.change.toFixed(1)+"배":item.format==="money"?money(item.change):item.change.toFixed(1)+"%p"}`:""}</div><div class="metric-track"><i style="width:${item.peerCount?Math.max(8,100-(item.rank-1)/item.peerCount*100):50}%"></i></div></article>`).join("");
  const revGrowth=growth(data.financials.at(-1)?.revenue,data.financials.at(-2)?.revenue),opGrowth=growth(data.financials.at(-1)?.operatingProfit,data.financials.at(-2)?.operatingProfit),bullets=[];if(finite(revGrowth))bullets.push(`매출은 전년보다 ${signedPercent(revGrowth)} 변했습니다.`);if(finite(opGrowth))bullets.push(`영업이익은 전년보다 ${signedPercent(opGrowth)} 변했습니다.`);const worsening=data.metrics.filter(item=>item.state==="악화").map(item=>item.label);bullets.push(worsening.length?`${worsening.join("·")} 추세는 악화로 분류됐습니다.`:"최근 3년 지표에서 뚜렷한 동시 악화는 확인되지 않았습니다.");if(data.company.isFinancial)bullets.push("금융업은 BIS비율·NIM·연체율 등 전용 건전성 지표를 공시 원문에서 추가 확인해야 합니다.");
  $("#performance-insight").innerHTML=`<h3>실적에서 눈여겨볼 점</h3><p>올해 실적뿐 아니라 지난 3년의 변화와 실제 현금흐름도 살펴보세요.</p><ul class="insight-list">${bullets.map(text=>`<li><b>•</b><span>${esc(text)}</span></li>`).join("")}</ul>`;
  $("#data-quality").innerHTML=`<h3>비교하기 전에 확인한 자료</h3><ul class="quality-list">${data.quality.map(item=>`<li class="${item.ok?"ok":"warn"}"><b>${item.ok?"확인":"주의"}</b><span>${esc(item.text)}</span></li>`).join("")}</ul>`;
}
const growth=(current,prior)=>finite(current)&&finite(prior)&&prior!==0?(current/prior-1)*100:null;
function renderFactors(data){$("#factor-cards").innerHTML=data.sensitivities.map(item=>{const value=finite(item.coefficient)?item.coefficient:null,position=finite(value)?(value+1)*50:50,coefficient=finite(value)?value.toFixed(2):"판단 유보";return`<article class="factor-card"><header><div><h3>${esc(item.name)}</h3><span class="trend-chip ${finite(value)&&Math.abs(value)>=.4?"bad":"neutral"}">${item.strength}</span></div><div class="factor-coeff">${coefficient}</div></header><div class="factor-meter"><i style="left:${position}%"></i></div><p>${esc(item.direction)}</p><p class="factor-meta">${esc(item.description)} · 공통 월 ${item.pairs.length}개 · 서로 다른 변화값 ${item.distinct}개</p></article>`}).join("")}
function renderMarket(data){
  $("#price-title").textContent=`${data.company.name} · ${$("#price-period").selectedOptions[0].textContent} 주가·이동평균선·거래량`;
  const metrics=[["이 기간에 주가가 얼마나 변했나",signedPercent(data.market.periodReturn),`${data.market.tradingDays}거래일`],["주가가 얼마나 흔들렸나",percent(data.market.volatility),"일별 변동을 연간 기준으로 환산"],["같은 업종과의 수익률 차이",signedPercent(data.market.excessReturn),finite(data.market.benchmarkReturn)?`같은 업종 주요 기업 평균 ${signedPercent(data.market.benchmarkReturn)}`:"업종 비교자료 부족"],["거래량이 크게 늘어난 날",`${data.market.volumeSurgeDays}일`,"직전 20일 평균의 3배 이상"]];
  $("#market-metrics").innerHTML=metrics.map(([title,value,sub])=>`<article class="market-metric"><small>${esc(title)}</small><b>${esc(value)}</b><span>${esc(sub)}</span></article>`).join("");draw(data.company.longHistory);
}
const cell=(text,value)=>finite(value)?esc(text):'<span class="missing">공시 계정 없음</span>';
function renderFinancials(data){
  const first=data.financials.filter(item=>[item.revenue,item.operatingProfit,item.netIncome].some(finite)).at(0)?.year;
  $("#financials").innerHTML=`<div class="section-row"><div><p class="eyebrow">DART FINANCIALS</p><h2>연도별 실적 자세히 보기</h2></div><a class="button link-button" href="/filings.html?corpCode=${data.company.corpCode}&name=${encodeURIComponent(data.company.name)}&stockCode=${data.company.stockCode}">DART 공시 원문 확인 →</a></div><p class="note">최근 연도가 위에 있어요. ${first?`처음 보이는 ${first}년은 상장 연도를 뜻하지 않습니다. `:""}공시 방식이 바뀌었거나 보고서가 없으면 일부 값이 비어 있을 수 있어요.</p><div class="financial-table-wrap"><table class="financial-table"><thead><tr><th>연도</th><th>기준</th><th>매출</th><th>영업이익</th><th>순이익</th><th>영업이익률</th><th>ROE</th><th>부채비율</th><th>이자보상배율</th><th>FCF</th></tr></thead><tbody>${[...data.financials].reverse().map((item,index)=>`<tr class="${index===0?"latest":""}"><th>${item.year}</th><td>${esc(item.statementBasis||"확인 필요")}</td><td>${cell(money(item.revenue),item.revenue)}</td><td>${cell(money(item.operatingProfit),item.operatingProfit)}</td><td>${cell(money(item.netIncome),item.netIncome)}</td><td>${cell(percent(item.operatingMargin),item.operatingMargin)}</td><td>${cell(percent(item.roe),item.roe)}</td><td>${data.company.isFinancial?'<span class="missing">금융업 제외</span>':cell(percent(item.debtRatio),item.debtRatio)}</td><td>${data.company.isFinancial?'<span class="missing">금융업 제외</span>':cell(multiple(item.interestCoverage),item.interestCoverage)}</td><td>${cell(money(item.fcf),item.fcf)}</td></tr>`).join("")}</tbody></table></div>`;
}
function renderResearch(data){
  const items=(data.research?.items||[]).slice(0,5),params=new URLSearchParams({corpCode:data.company.corpCode,name:data.company.name,stockCode:data.company.stockCode});
  $("#research-hub-link").href=`/research.html?${params}`;
  $("#hankyung-consensus-link").href=/^\d{6}$/.test(String(data.company.stockCode||""))?`https://markets.hankyung.com/stock/${data.company.stockCode}/consensus`:"https://markets.hankyung.com/consensus";
  $("#company-research-list").innerHTML=items.length?items.map(item=>`<a class="company-research-item" href="${esc(item.url)}" target="_blank" rel="noopener"><span><b>${esc(item.title||"제목 없음")}</b><small>${esc(item.broker||"작성기관 확인 필요")} · ${esc(item.date?dateText(String(item.date).replace(/\D/g,"")):"작성일 확인 필요")}</small></span><em>원문 보기 ↗</em></a>`).join(""):`<div class="research-empty"><b>연결된 최신 리포트가 없습니다.</b><span>${esc(data.research?.error||"종목 리포트가 제공되지 않으면 리포트 화면에서 기업명으로 다시 검색해 보세요.")}</span></div>`;
}
function downloadCsv(data){
  const decision=decisionModel(data),rows=[["기업",data.company.name],["종목코드",data.company.stockCode],["업종",data.company.industry],["분석 목적",$("#analysis-purpose").selectedOptions[0].textContent],["한 줄 결론",decision.title],["설명",decision.copy],["생성 시각",data.generatedAt],[],["지표","최신값","3년 분류","업종 비교"],...data.metrics.map(item=>[item.label,item.display,item.state,item.peer]),[],["외부요인","상관계수","강도","공통 관측월"],...data.sensitivities.map(item=>[item.name,finite(item.coefficient)?item.coefficient.toFixed(3):"판단 유보",item.strength,item.pairs.length])],csv="\uFEFF"+rows.map(row=>row.map(value=>`"${String(value??"").replaceAll('"','""')}"`).join(",")).join("\r\n"),url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})),link=document.createElement("a");link.href=url;link.download=`${data.company.name}_기업분석.csv`;link.click();URL.revokeObjectURL(url);
}

function draw(history){
  const canvas=$("#chart"),tip=$("#chart-tip");if(!canvas)return;
  const render=active=>{const rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;const ctx=canvas.getContext("2d");ctx.scale(dpr,dpr);if(!history.length){ctx.fillStyle="#8b95a1";ctx.font="14px sans-serif";ctx.fillText("표시할 주가 이력이 없습니다.",20,40);return null}const closes=history.map(row=>row.close),pad={l:76,r:24,t:25,b:42},priceBottom=rect.height*.7,volumeTop=rect.height*.79,min=Math.min(...closes)*.94,max=Math.max(...closes)*1.06,x=index=>pad.l+index/Math.max(history.length-1,1)*(rect.width-pad.l-pad.r),y=value=>pad.t+(max-value)/(max-min)*(priceBottom-pad.t),rolling=days=>closes.map((_,index)=>index+1>=days?average(closes.slice(index+1-days,index+1)):null),series=[["종가",closes,"#191f28",2.5],["5일",rolling(5),"#f04452",1.5],["20일",rolling(20),"#3182f6",1.7],["60일",rolling(60),"#14b8a6",1.6],["120일",rolling(120),"#a855f7",1.6]];ctx.font="11px sans-serif";ctx.textAlign="left";for(let i=0;i<5;i++){const value=min+(max-min)*i/4,py=y(value);ctx.strokeStyle="#e5e8eb";ctx.beginPath();ctx.moveTo(pad.l,py);ctx.lineTo(rect.width-pad.r,py);ctx.stroke();ctx.fillStyle="#8b95a1";ctx.fillText(Math.round(value).toLocaleString("ko-KR"),4,py+4)}series.forEach(item=>{ctx.strokeStyle=item[2];ctx.lineWidth=item[3];ctx.beginPath();let on=false;item[1].forEach((value,index)=>{if(!finite(value)){on=false;return}on?ctx.lineTo(x(index),y(value)):ctx.moveTo(x(index),y(value));on=true});ctx.stroke()});const volumes=history.map(row=>row.volume||0),vmax=Math.max(...volumes,1),barWidth=Math.max(1,(rect.width-pad.l-pad.r)/history.length*.7);history.forEach((row,index)=>{const height=volumes[index]/vmax*(rect.height-pad.b-volumeTop);ctx.fillStyle=index&&row.close<history[index-1].close?"rgba(49,130,246,.55)":"rgba(240,68,82,.55)";ctx.fillRect(x(index)-barWidth/2,rect.height-pad.b-height,barWidth,height)});ctx.fillStyle="#8b95a1";ctx.textAlign="center";for(let i=0;i<6;i++){const index=Math.round((history.length-1)*i/5),date=history[index]?.date||"";ctx.fillText(`${date.slice(0,4)}-${date.slice(4,6)}`,x(index),rect.height-12)}if(Number.isInteger(active)){ctx.setLineDash([4,4]);ctx.strokeStyle="rgba(25,31,40,.3)";ctx.beginPath();ctx.moveTo(x(active),pad.t);ctx.lineTo(x(active),rect.height-pad.b);ctx.stroke();ctx.setLineDash([]);series.forEach(item=>{const value=item[1][active];if(!finite(value))return;ctx.fillStyle="#fff";ctx.strokeStyle=item[2];ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(x(active),y(value),5,0,Math.PI*2);ctx.fill();ctx.stroke()})}return{rect,pad,x,series}};
  let geometry=render(null);canvas.onmousemove=event=>{if(!geometry||!history.length)return;const bounds=canvas.getBoundingClientRect(),{rect,pad,x}=geometry,index=Math.max(0,Math.min(history.length-1,Math.round((event.clientX-bounds.left-pad.l)/(rect.width-pad.l-pad.r)*(history.length-1)))),row=history[index];geometry=render(index);tip.innerHTML=`<b>${dateText(row.date)}</b>${geometry.series.map(item=>`<span>${item[0]} ${won(item[1][index])}</span>`).join("")}<span>거래량 ${Number(row.volume||0).toLocaleString("ko-KR")}주</span>`;tip.hidden=false;tip.style.left=`${Math.max(110,Math.min(rect.width-110,x(index)))}px`;tip.style.top="12px"};canvas.onmouseleave=()=>{geometry=render(null);tip.hidden=true};window.addEventListener("resize",()=>{geometry=render(null)},{once:true});
}
try{const saved=JSON.parse(localStorage.getItem("activeCompany")||"null");if(saved?.corpCode){selectCompany(saved);runAnalysis()}}catch{}
