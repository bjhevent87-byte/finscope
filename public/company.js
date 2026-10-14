import{$,money,percent,setupSearch,setupMarketGuide,nav}from"./pages.js?v=22";
import{hankyungReportSearchUrl,stockDisplayName}from"./stock-identity.js";
import{assessCompany,assessmentThreshold}from"./company-assessment.js";
$("#nav").innerHTML=nav("company");
let selected=null,analysis=null,analysisRequestId=0;
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
const selectCompany=company=>{
  const picked={...company,name:company.name||company.stockCode||company.corpCode};
  if(selected?.corpCode!==picked.corpCode){
    analysisRequestId++;
    analysis=null;
    $("#content").hidden=true;
  }
  selected=picked;
  $("#search").value=picked.name;
  $("#company-agent-selected").textContent=`선택한 기업: ${picked.name}`;
  $("#company-agent-result").hidden=true;
  $("#company-agent-result").replaceChildren();
  $("#status").hidden=false;
  $("#status").textContent=`${picked.name} 선택됨 · 분석 목적을 확인한 뒤 ‘기업 분석하기’를 눌러주세요.`;
  localStorage.setItem("activeCompany",JSON.stringify(picked));
  markComparedSelection();
};

function comparedCompanies(){
  try{
    const saved=JSON.parse(localStorage.getItem("compareCompanies")||"[]");
    if(!Array.isArray(saved))return[];
    const seen=new Set();
    return saved.filter(company=>{
      const code=String(company?.corpCode||"");
      if(!/^\d{8}$/.test(code)||seen.has(code))return false;
      seen.add(code);return true;
    }).slice(0,10);
  }catch{return[]}
}
function markComparedSelection(){
  const basket=$("#company-compare-basket");
  if(!basket)return;
  basket.querySelectorAll("[data-compare-corp]").forEach(button=>{
    const active=button.dataset.compareCorp===String(selected?.corpCode||"");
    button.classList.toggle("selected",active);
    button.setAttribute("aria-pressed",String(active));
  });
  const hint=$("#company-compare-basket-hint");
  if(hint)hint.textContent=selected?`${selected.name} 선택됨 · 위에서 분석 목적을 확인하고 분석하기를 눌러주세요.`:"기업명을 누르면 분석할 기업으로 선택됩니다.";
}
function renderComparedCompanies(){
  const basket=$("#company-compare-basket"),list=$("#company-compare-basket-list"),companies=comparedCompanies();
  basket.hidden=!companies.length;
  list.replaceChildren();
  for(const company of companies){
    const button=document.createElement("button"),name=document.createElement("strong"),code=document.createElement("span");
    button.type="button";button.className="company-compare-basket-item";button.dataset.compareCorp=String(company.corpCode);
    button.setAttribute("aria-label",`${company.name||company.stockCode||company.corpCode} 분석할 기업으로 선택`);
    name.textContent=company.name||company.stockCode||company.corpCode;
    code.textContent=company.stockCode||"";
    button.append(name,code);
    button.addEventListener("click",()=>selectCompany(company));
    list.append(button);
  }
  markComparedSelection();
}

setupSearch($("#search"),$("#results"),selectCompany);
setupMarketGuide(document.querySelector(".analysis-entry"),company=>{selectCompany(company);$("#run").click()},"시장과 업종에서 분석할 기업 고르기");
renderComparedCompanies();
window.addEventListener("storage",event=>{if(event.key==="compareCompanies")renderComparedCompanies()});
$("#run").onclick=runAnalysis;
$("#price-period").onchange=()=>{if(analysis)runAnalysis()};
$("#analysis-purpose").onchange=()=>{if(analysis)renderDecision(analysis)};
$("#analysis-csv").onclick=()=>{if(analysis)downloadCsv(analysis)};
const agentForm=$("#company-agent-form"),agentQuestion=$("#company-agent-question"),agentResult=$("#company-agent-result"),agentSubmit=$("#company-agent-submit");
document.querySelectorAll("[data-agent-question]").forEach(button=>button.onclick=()=>{agentQuestion.value=button.dataset.agentQuestion;agentQuestion.focus()});
const agentText=(element,text)=>{const item=document.createElement(element);item.textContent=text;return item};
const agentBlock=(className,...children)=>{const item=document.createElement("div");item.className=className;item.append(...children);return item};
const agentValue=(value,unit)=>unit==="원"?money(value):`${Number(value).toFixed(2)}%`;
agentForm.addEventListener("submit",async event=>{
  event.preventDefault();
  const company=selected||analysis?.company;
  if(!company?.corpCode){agentResult.hidden=false;agentResult.replaceChildren(agentText("p","먼저 기업을 검색해 선택해 주세요."));return}
  agentSubmit.disabled=true;agentResult.hidden=false;agentResult.replaceChildren(agentText("p","AI가 필요한 조회 도구를 고르고 DART 공시를 확인하는 중입니다."));
  try{
    const response=await fetch("/api/company-agent",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({corpCode:company.corpCode,question:agentQuestion.value.trim()}),signal:AbortSignal.timeout(55000)});
    const answer=await response.json();
    if(!response.ok)throw new Error(answer.error||"근거를 확인하지 못했습니다.");
    const evidence=answer.evidence||{},ready=answer.status==="ready";
    const main=agentBlock("company-agent-answer",agentText("span",ready?"공시 근거 답변":"자료 확인 필요"),agentText("h3",answer.explanation||(ready?"공시 자료를 확인했습니다.":"비교 가능한 자료를 찾지 못했습니다.")));
    if(answer.nextCheck)main.append(agentBlock("company-agent-next",agentText("b","다음에 확인할 점"),agentText("p",answer.nextCheck)));
    const facts=agentBlock("company-agent-proof",agentText("h4",ready?"답변에 사용한 근거":"확인한 자료"));
    if(answer.status==="ready"&&answer.tool==="get_financial_trend"){
      const change=evidence.unit==="원"?`${evidence.difference>=0?"+":""}${money(evidence.difference)}`:`${evidence.difference>=0?"+":""}${Number(evidence.difference).toFixed(2)}%p`;
      const figure=(label,value)=>agentBlock("company-agent-figure",agentText("span",label),agentText("strong",value));
      facts.append(agentBlock("company-agent-figures",figure(`${evidence.previous.year}년`,agentValue(evidence.previous.value,evidence.unit)),figure(`${evidence.current.year}년`,agentValue(evidence.current.value,evidence.unit)),figure(`${evidence.label} 변화`,change)));
      const basis=document.createElement("details");basis.className="company-agent-basis";basis.append(agentText("summary","비교·계산 기준 보기"),agentText("p",`DART 사업보고서 · ${evidence.basis} 기준 · ${evidence.calculation}`));
      if(evidence.comparisonNote)basis.append(agentText("p",evidence.comparisonNote));facts.append(basis);
    }else if(!ready)facts.append(agentText("p",evidence.reason||"비교 가능한 공시가 없습니다."));
    const sources=document.createElement("div");sources.className="company-agent-sources";
    for(const source of evidence.sources||[]){
      if(!/^https:\/\/dart\.fss\.or\.kr\/dsaf001\/main\.do\?rcpNo=\d{14}$/.test(source.url))continue;
      const link=document.createElement("a");link.href=source.url;link.target="_blank";link.rel="noopener noreferrer";
      link.textContent=`${source.year?source.year+"년 · ":""}${source.title} · DART 원문 ↗`;sources.append(link);
    }
    if(sources.childElementCount)facts.append(agentText("h4","DART 원문에서 확인하기"),sources);
    else facts.append(agentText("p","연결된 DART 원문 링크가 없습니다. 답변의 근거를 추가로 확인해 주세요."));
    facts.append(agentText("small",`조회 도구: ${answer.tool==="get_financial_trend"?"재무 추이":"최근 공시"} · 숫자 계산과 AI 설명을 분리했습니다. 투자 판단 전 원문을 확인하세요.`));
    agentResult.hidden=false;agentResult.replaceChildren(main,facts);
  }catch(error){agentResult.hidden=false;agentResult.replaceChildren(agentText("p",error.message))}
  finally{agentSubmit.disabled=false}
});

async function runAnalysis(){
  if(!selected){$("#status").textContent="먼저 분석할 기업을 선택해 주세요.";return}
  const target=selected,requestId=++analysisRequestId;
  $("#status").hidden=false;$("#status").textContent="DART 재무, KRX 주가, ECOS 환율·금리를 한 기준으로 맞추는 중입니다.";
  try{
    const year=new Date().getFullYear()-1,dates=range(),query=new URLSearchParams({corpCodes:target.corpCode,year:String(year),reportCode:"11011",...dates});
    const updatePromise=fetchJson(`/api/company-update?${new URLSearchParams({corpCode:target.corpCode,afterYear:String(year-1)})}`).catch(error=>({status:"error",note:error.message}));
    const [compare,market,benchmark,fx,rate,research]=await Promise.all([
      fetchJson(`/api/compare?corpCodes=${target.corpCode}&year=${year}&reportCode=11011`),
      fetchJson(`/api/backtest-data?${new URLSearchParams({corpCodes:target.corpCode,...dates})}`),
      fetchJson(`/api/benchmarks?${query}`),
      fetchJson(`/api/macro/series?id=usd-krw&beginDate=${dates.beginDate}&endDate=${dates.endDate}`),
      fetchJson(`/api/macro/series?id=kr-base-rate&beginDate=${dates.beginDate}&endDate=${dates.endDate}`),
      fetchJson(`/api/naver-research?stockCode=${target.stockCode}`).catch(error=>({items:[],error:error.message})),
    ]);
    if(requestId!==analysisRequestId)return;
    const company=compare.companies?.[0];if(!company)throw new Error("기업 재무정보를 찾지 못했습니다.");
    company.name=stockDisplayName(company);
    const history=market.companies?.[0]?.history||company.market?.history||[];
    analysis={...buildAnalysis({...company,longHistory:history},benchmark.benchmarks?.[0]||null,{fx,rate},market),research,interim:{status:"loading"}};renderAnalysis(analysis);
    const currentAnalysis=analysis;
    updatePromise.then(update=>{
      if(requestId!==analysisRequestId||analysis!==currentAnalysis||selected?.corpCode!==company.corpCode)return;
      analysis.interim=update.status==="ready"&&update.year<=Number(company.latest?.year||0)
        ?{status:"none",note:"최근 연간 사업보고서 이후 새로 확정된 분기·반기 재무제표가 없습니다."}:update;
      renderLatestUpdate(analysis);renderDecision(analysis);
    });
  }catch(error){if(requestId!==analysisRequestId)return;$("#status").hidden=false;$("#status").textContent=`분석을 완료하지 못했습니다: ${error.message}`}
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
  return{company,financials,latest,benchmark,macro,marketPayload,market,sensitivities,metrics,quality:qualityChecks(company,financials,macro,benchmark),assessment:assessCompany(company,benchmark,"11011"),generatedAt:new Date().toISOString()};
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
  $("#status").hidden=true;$("#content").hidden=false;renderDecision(data);renderLatestUpdate(data);renderAssessment(data);renderSummary(data);renderHealth(data);renderFactors(data);renderMarket(data);renderFinancials(data);renderResearch(data);
  $("#open-lab").href=`/correlation.html?${new URLSearchParams({mode:"company-macro",company:data.company.corpCode,b:"usd-krw",autorun:"1"})}#analysis-settings`;
  $("#decision").scrollIntoView({behavior:"smooth",block:"start"});
}
function decisionModel(data){
  const purpose=$("#analysis-purpose").value,latest=data.latest||{},financial=data.company.isFinancial;
  const fact=(label,value,format)=>({label,value,display:format(value)});
  const facts=financial?{
    investment:[fact("ROE",latest.roe,percent),fact("순이익",latest.netIncome,money),fact("자기자본",latest.equity,money),fact("배당수익률",data.company.dividend?.dividendYield,percent)],
    credit:[fact("순이익",latest.netIncome,money),fact("자기자본",latest.equity,money),fact("ROE",latest.roe,percent)],
    performance:[fact("순이익",latest.netIncome,money),fact("ROE",latest.roe,percent),fact("자기자본",latest.equity,money)],
  }:{
    investment:[fact("영업이익률",latest.operatingMargin,percent),fact("ROE",latest.roe,percent),fact("잉여현금흐름",latest.fcf,money),fact("부채비율",latest.debtRatio,percent)],
    credit:[fact("영업현금흐름",latest.operatingCashFlow,money),fact("이자보상배율",latest.interestCoverage,multiple),fact("부채비율",latest.debtRatio,percent),fact("잉여현금흐름",latest.fcf,money)],
    performance:[fact("매출",latest.revenue,money),fact("영업이익",latest.operatingProfit,money),fact("영업이익률",latest.operatingMargin,percent),fact("순이익",latest.netIncome,money)],
  };
  const purposeLabel={investment:"투자 후보 검토",credit:"여신·상환능력 검토",performance:"경영성과 진단"}[purpose]||"기업 분석";
  const purposeFocus={investment:"수익성과 현금흐름",credit:"현금흐름과 이자 부담",performance:"매출과 이익의 변화"}[purpose]||"실적";
  const statementBasis={CFS:"연결",OFS:"별도"}[latest.statementBasis]||latest.statementBasis||"재무제표 기준 확인 필요";
  const basis=latest.year?`${latest.year}년 사업보고서 · ${statementBasis} 기준`:"연간 재무제표 기준 확인 필요";
  return{title:data.company.name,basis,purposeLabel,purposeGuide:`${purposeLabel}: ${purposeFocus}에 해당하는 수치를 먼저 보여줍니다. 분석 목적에 따라 여기서 확인할 수치가 달라지지만 원본 자료나 점수 계산은 바뀌지 않습니다.`,evidence:(facts[purpose]||facts.investment).filter(item=>finite(item.value))};
}
function renderDecision(data){
  const model=decisionModel(data),evidence=$("#decision-evidence");$("#decision-title").textContent=model.title;
  $("#decision-copy").textContent=`${model.basis}${data.interim?.status==="ready"?` · 최신: ${data.interim.year}년 ${data.interim.reportLabel}`:""}`;
  $("#decision-purpose-note").textContent=model.purposeGuide;
  evidence.innerHTML=model.evidence.length?model.evidence.map(item=>`<div class="evidence-row"><b>${esc(item.label)}</b><strong>${esc(item.display)}</strong></div>`).join(""):"<p>표시할 주요 수치가 없습니다. 아래 DART 공시 자료를 확인해 주세요.</p>";
}
function renderLatestUpdate(data){
  const target=$("#latest-disclosure-content"),update=data.interim;
  if(!update||update.status==="loading"){target.innerHTML='<p class="latest-status">최신 분기·반기보고서를 확인하고 있습니다. 연간 분석은 먼저 살펴볼 수 있어요.</p>';return}
  if(update.status!=="ready"){target.innerHTML=`<p class="latest-status">${esc(update.note||"확정된 최신 분기·반기보고서를 확인하지 못했습니다.")} 아래 연간 실적은 계속 확인할 수 있어요.</p>`;return}
  const samePeriod=update.prior?`${update.year-1}년 ${update.reportLabel}`:"전년 같은 기간 자료 없음";
  const items=[["매출",update.current?.revenue,update.prior?.revenue],["영업이익",update.current?.operatingProfit,update.prior?.operatingProfit],["순이익",update.current?.netIncome,update.prior?.netIncome]];
  const cards=items.filter(([,value])=>finite(value)).map(([label,value,prior])=>{
    const change=finite(prior)&&prior>0?growth(value,prior):null;
    return `<article><span>${esc(label)}</span><strong>${esc(money(value))}</strong><small>${finite(change)?`전년 같은 기간 대비 ${esc(signedPercent(change))}`:"비교 가능한 전년 수치 없음"}</small></article>`;
  }).join("");
  const source=update.source?.url&&/^https:\/\/dart\.fss\.or\.kr\/dsaf001\/main\.do\?rcpNo=\d{14}$/.test(update.source.url)
    ?`<a href="${update.source.url}" target="_blank" rel="noopener">${update.year}년 ${esc(update.reportLabel)} DART 원문 ↗</a>`:"";
  const preliminary=update.preliminary?.url&&/^https:\/\/dart\.fss\.or\.kr\/dsaf001\/main\.do\?rcpNo=\d{14}$/.test(update.preliminary.url)
    ?`<p class="latest-preliminary">이후 발표된 잠정실적이 있습니다. 확정 재무제표 숫자와 합치지 않았습니다. <a href="${update.preliminary.url}" target="_blank" rel="noopener">잠정실적 공시 확인 ↗</a></p>`:"";
  target.innerHTML=`<div class="latest-period"><b>${update.year}년 ${esc(update.reportLabel)}</b><span>확정 공시 · ${esc(update.current?.statementBasis||"기준 확인 필요")} · ${samePeriod} 비교</span></div><div class="latest-grid">${cards||'<p>표시 가능한 핵심 손익 계정이 없습니다.</p>'}</div><p class="latest-explainer">${esc(update.comparisonNote)} 연간 추이와 분기 누적 수치를 한 그래프에 섞지 않습니다.</p><div class="latest-links">${source}<a href="/filings.html?corpCode=${encodeURIComponent(data.company.corpCode)}&name=${encodeURIComponent(data.company.name)}&stockCode=${encodeURIComponent(data.company.stockCode)}">다른 공시 보기 →</a></div>${preliminary}`;
}
function assessmentValue(check){
  if(!check.available)return"자료 없음";
  if(["netIncome","equity","fcf"].includes(check.key))return money(check.value);
  if(check.key==="interestCoverage"||check.key==="per"||check.key==="pbr")return multiple(check.value);
  return percent(check.value);
}
function renderAssessment(data){
  const assessment=data.assessment;
  const block=(title,result,note)=>`<article class="assessment-card"><div class="assessment-head"><span>${title}</span><strong>${finite(result.score)?`${result.score}점 · ${result.grade}`:result.grade}</strong></div><p>${esc(note)}</p><details><summary>평가 근거 ${result.available}/${result.total}개 확인하기</summary><ul>${result.checks.map(check=>`<li><span>${esc(check.label)} · ${esc(assessmentValue(check))}</span><b class="${check.available?(check.passed?"assessment-good":"assessment-caution"):""}">${check.available?(check.passed?"기준 충족":"기준 미달"):"자료 없음"}</b><small>기준 ${esc(assessmentThreshold(check))}</small></li>`).join("")}</ul></details></article>`;
  $("#company-assessment-content").innerHTML=`<div class="assessment-grid">${block("재무 기초체력 · 예비점수",assessment.quality,assessment.qualityNote)}${block("같은 업종 내 상대 가격",assessment.price,assessment.priceNote)}</div><p class="assessment-footnote">점수 기준은 ${esc(data.latest.year||"확인 불가")}년 연간 실적입니다. 위의 최신 분기·반기 실적은 아직 이 점수에 더하지 않았습니다. 자료가 부족하면 점수를 내지 않으며, 이 평가는 매수·매도 추천이 아닙니다.</p>`;
}
function renderSummary(data){
  const f=data.latest,basis=f.year?`${f.year}년 사업보고서 · ${f.statementBasis||"기준 확인 필요"}`:"선택 기간 공시 없음";
  const cards=[
    ["최신 종가",won(data.company.market?.price),`${dateText(data.company.market?.date)} 기준`,"KRX 최근 확정 종가입니다. 재무 숫자와 발표일이 다를 수 있어요."],
    ["분석기간 수익률",signedPercent(data.market.periodReturn),`${data.market.tradingDays}거래일`,"선택한 기간의 첫 종가와 마지막 종가를 비교한 값입니다. 배당 수익은 포함하지 않아요."],
    ["매출",money(f.revenue),basis,"고객에게 재화와 서비스를 제공해 얻은 수익입니다. DART 사업보고서의 회계 기준을 확인해 주세요."],
    ["영업이익",money(f.operatingProfit),basis,"본업에서 발생한 이익입니다. 비용 변화와 함께 읽어 주세요."],
    ["순이익",money(f.netIncome),basis,"영업 외 손익과 세금까지 반영한 최종 이익입니다."],
    ["ROE",percent(f.roe),`${f.year||"기준 연도 없음"}년 · DART 기반 계산`,"순이익을 자기자본으로 나눈 비율입니다. 업종과 계산 기간을 맞춰 비교해 주세요."],
    [data.company.isFinancial?"자기자본":"부채비율",data.company.isFinancial?money(f.equity):percent(f.debtRatio),basis,data.company.isFinancial?"자산에서 부채를 뺀 자본입니다. 금융업 건전성은 BIS 비율·연체율도 따로 확인해야 해요.":"부채를 자기자본으로 나눈 비율입니다. 금융업에는 같은 판단 기준을 적용하지 않아요."],
    ["잉여현금흐름",money(f.fcf),basis,"영업현금흐름에서 유형자산 취득액을 뺀 값입니다. 자본적 지출 계정이 없으면 실제 투자액을 충분히 반영하지 못할 수 있어요."],
  ];
  const primary=data.company.isFinancial?[0,4,5,6]:[0,2,3,7];
  const card=([title,value,sub,description])=>`<article class="card"><h3>${esc(title)}</h3><div class="value">${esc(value)}</div><p class="sub">${esc(sub)}</p><details><summary>값 읽는 법</summary><p>${esc(description)}</p></details></article>`;
  $("#summary").innerHTML=primary.map(index=>card(cards[index])).join("");
  $("#summary-extra").innerHTML=cards.filter((_,index)=>!primary.includes(index)).map(card).join("");
}
function renderHealth(data){
  const basis=[...new Set(data.financials.map(item=>item.statementBasis).filter(Boolean))];$("#financial-basis").textContent=basis.length?`DART ${basis.join("·")} 기준`:"재무제표 기준 확인 필요";
  $("#health-cards").innerHTML=data.metrics.map(item=>`<article class="health-card"><header><h3>${esc(item.label)}</h3><span class="trend-chip ${item.tone}">${item.state}</span></header><div class="health-value">${esc(item.display)}</div><details class="health-context"><summary>업종 비교·3년 변화 보기</summary><p>${esc(item.peer)}${finite(item.change)?`<br>3년 변화 ${item.change>=0?"+":""}${item.format==="multiple"?item.change.toFixed(1)+"배":item.format==="money"?money(item.change):item.change.toFixed(1)+"%p"}`:""}</p></details></article>`).join("");
  const revGrowth=growth(data.financials.at(-1)?.revenue,data.financials.at(-2)?.revenue),opGrowth=growth(data.financials.at(-1)?.operatingProfit,data.financials.at(-2)?.operatingProfit),bullets=[];if(finite(revGrowth))bullets.push(`매출은 전년보다 ${signedPercent(revGrowth)} 변했습니다.`);if(finite(opGrowth))bullets.push(`영업이익은 전년보다 ${signedPercent(opGrowth)} 변했습니다.`);const worsening=data.metrics.filter(item=>item.state==="악화").map(item=>item.label);bullets.push(worsening.length?`${worsening.join("·")} 추세는 악화로 분류됐습니다.`:"최근 3년 지표에서 뚜렷한 동시 악화는 확인되지 않았습니다.");if(data.company.isFinancial)bullets.push("금융업은 BIS비율·NIM·연체율 등 전용 건전성 지표를 공시 원문에서 추가 확인해야 합니다.");
  $("#performance-insight").innerHTML=`<h3>실적에서 눈여겨볼 점</h3><p>이 영역은 연간 실적 기준입니다. 위의 최신 분기·반기 실적과 함께 살펴보세요.</p><ul class="insight-list">${bullets.map(text=>`<li><b>•</b><span>${esc(text)}</span></li>`).join("")}</ul>`;
  $("#data-quality").innerHTML=`<h3>비교하기 전에 확인한 자료</h3><ul class="quality-list">${data.quality.map(item=>`<li class="${item.ok?"ok":"warn"}"><b>${item.ok?"확인":"주의"}</b><span>${esc(item.text)}</span></li>`).join("")}</ul>`;
}
const growth=(current,prior)=>finite(current)&&finite(prior)&&prior!==0?(current/prior-1)*100:null;
function renderFactors(data){$("#factor-cards").innerHTML=data.sensitivities.map(item=>{const value=finite(item.coefficient)?item.coefficient:null,position=finite(value)?(value+1)*50:50,coefficient=finite(value)?value.toFixed(2):"판단 유보";return`<article class="factor-card"><header><div><h3>${esc(item.name)}</h3><span class="trend-chip ${finite(value)&&Math.abs(value)>=.4?"bad":"neutral"}">${item.strength}</span></div><div class="factor-coeff">${coefficient}</div></header><div class="factor-meter"><i style="left:${position}%"></i></div><p>${esc(item.direction)}</p><details class="factor-context"><summary>분석에 사용한 자료 보기</summary><p>${esc(item.description)} · 공통 월 ${item.pairs.length}개 · 서로 다른 변화값 ${item.distinct}개</p></details></article>`}).join("")}
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
  $("#hankyung-consensus-link").href=hankyungReportSearchUrl(data.company);
  $("#company-research-list").innerHTML=items.length?items.map(item=>`<a class="company-research-item" href="${esc(item.url)}" target="_blank" rel="noopener"><span><b>${esc(item.title||"제목 없음")}</b><small>${esc(item.broker||"작성기관 확인 필요")} · ${esc(item.date?dateText(String(item.date).replace(/\D/g,"")):"작성일 확인 필요")}</small></span><em>원문 보기 ↗</em></a>`).join(""):`<div class="research-empty"><b>연결된 최신 리포트가 없습니다.</b><span>${esc(data.research?.error||"종목 리포트가 제공되지 않으면 리포트 화면에서 기업명으로 다시 검색해 보세요.")}</span></div>`;
}
function downloadCsv(data){
  const overview=decisionModel(data),rows=[["기업",data.company.name],["종목코드",data.company.stockCode],["업종",data.company.industry],["분석 목적",overview.purposeLabel],["연간 재무 기준",overview.basis],["최신 확정 실적",data.interim?.status==="ready"?`${data.interim.year}년 ${data.interim.reportLabel}`:"별도 확인 필요"],["생성 시각",data.generatedAt],[],["지표","최신값","3년 분류","업종 비교"],...data.metrics.map(item=>[item.label,item.display,item.state,item.peer]),[],["외부요인","상관계수","강도","공통 관측월"],...data.sensitivities.map(item=>[item.name,finite(item.coefficient)?item.coefficient.toFixed(3):"판단 유보",item.strength,item.pairs.length])],csv="\uFEFF"+rows.map(row=>row.map(value=>`"${String(value??"").replaceAll('"','""')}"`).join(",")).join("\r\n"),url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})),link=document.createElement("a");link.href=url;link.download=`${data.company.name}_기업분석.csv`;link.click();URL.revokeObjectURL(url);
}

function draw(history){
  const canvas=$("#chart"),tip=$("#chart-tip");if(!canvas)return;
  const render=active=>{const rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;const ctx=canvas.getContext("2d");ctx.scale(dpr,dpr);if(!history.length){ctx.fillStyle="#8b95a1";ctx.font="14px sans-serif";ctx.fillText("표시할 주가 이력이 없습니다.",20,40);return null}const closes=history.map(row=>row.close),pad={l:76,r:24,t:25,b:42},priceBottom=rect.height*.7,volumeTop=rect.height*.79,min=Math.min(...closes)*.94,max=Math.max(...closes)*1.06,x=index=>pad.l+index/Math.max(history.length-1,1)*(rect.width-pad.l-pad.r),y=value=>pad.t+(max-value)/(max-min)*(priceBottom-pad.t),rolling=days=>closes.map((_,index)=>index+1>=days?average(closes.slice(index+1-days,index+1)):null),series=[["종가",closes,"#191f28",2.5],["5일",rolling(5),"#f04452",1.5],["20일",rolling(20),"#3182f6",1.7],["60일",rolling(60),"#14b8a6",1.6],["120일",rolling(120),"#a855f7",1.6]];ctx.font="11px sans-serif";ctx.textAlign="left";for(let i=0;i<5;i++){const value=min+(max-min)*i/4,py=y(value);ctx.strokeStyle="#e5e8eb";ctx.beginPath();ctx.moveTo(pad.l,py);ctx.lineTo(rect.width-pad.r,py);ctx.stroke();ctx.fillStyle="#8b95a1";ctx.fillText(Math.round(value).toLocaleString("ko-KR"),4,py+4)}series.forEach(item=>{ctx.strokeStyle=item[2];ctx.lineWidth=item[3];ctx.beginPath();let on=false;item[1].forEach((value,index)=>{if(!finite(value)){on=false;return}on?ctx.lineTo(x(index),y(value)):ctx.moveTo(x(index),y(value));on=true});ctx.stroke()});const volumes=history.map(row=>row.volume||0),vmax=Math.max(...volumes,1),barWidth=Math.max(1,(rect.width-pad.l-pad.r)/history.length*.7);history.forEach((row,index)=>{const height=volumes[index]/vmax*(rect.height-pad.b-volumeTop);ctx.fillStyle=index&&row.close<history[index-1].close?"rgba(49,130,246,.55)":"rgba(240,68,82,.55)";ctx.fillRect(x(index)-barWidth/2,rect.height-pad.b-height,barWidth,height)});ctx.fillStyle="#8b95a1";ctx.textAlign="center";for(let i=0;i<6;i++){const index=Math.round((history.length-1)*i/5),date=history[index]?.date||"";ctx.fillText(`${date.slice(0,4)}-${date.slice(4,6)}`,x(index),rect.height-12)}if(Number.isInteger(active)){ctx.setLineDash([4,4]);ctx.strokeStyle="rgba(25,31,40,.3)";ctx.beginPath();ctx.moveTo(x(active),pad.t);ctx.lineTo(x(active),rect.height-pad.b);ctx.stroke();ctx.setLineDash([]);series.forEach(item=>{const value=item[1][active];if(!finite(value))return;ctx.fillStyle="#fff";ctx.strokeStyle=item[2];ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(x(active),y(value),5,0,Math.PI*2);ctx.fill();ctx.stroke()})}return{rect,pad,x,series}};
  let geometry=render(null);canvas.onmousemove=event=>{if(!geometry||!history.length)return;const bounds=canvas.getBoundingClientRect(),{rect,pad,x}=geometry,index=Math.max(0,Math.min(history.length-1,Math.round((event.clientX-bounds.left-pad.l)/(rect.width-pad.l-pad.r)*(history.length-1)))),row=history[index];geometry=render(index);tip.innerHTML=`<b>${dateText(row.date)}</b>${geometry.series.map(item=>`<span>${item[0]} ${won(item[1][index])}</span>`).join("")}<span>거래량 ${Number(row.volume||0).toLocaleString("ko-KR")}주</span>`;tip.hidden=false;tip.style.left=`${Math.max(110,Math.min(rect.width-110,x(index)))}px`;tip.style.top="12px"};canvas.onmouseleave=()=>{geometry=render(null);tip.hidden=true};window.addEventListener("resize",()=>{geometry=render(null)},{once:true});
}
const requestedCorpCode=new URLSearchParams(location.search).get("corpCode");
if(/^\d{8}$/.test(requestedCorpCode||"")){
  const known=comparedCompanies().find(company=>company.corpCode===requestedCorpCode);
  if(known)selectCompany(known);
  else fetch(`/api/companies?q=${encodeURIComponent(requestedCorpCode)}`).then(response=>response.json()).then(companies=>{
    if(selected)return;
    const matched=Array.isArray(companies)?companies.find(company=>company.corpCode===requestedCorpCode):null;
    if(matched)selectCompany(matched);
    else $("#status").textContent="링크의 기업을 찾지 못했습니다. 기업명이나 종목코드로 다시 검색해 주세요.";
  }).catch(()=>{if(!selected)$("#status").textContent="링크의 기업을 불러오지 못했습니다. 기업명이나 종목코드로 검색해 주세요."});
}
