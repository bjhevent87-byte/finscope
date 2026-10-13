import { guideAnswer, GUIDE_ROUTES } from "./ai-guide-rules.js";

const pageByPath = {
  "/": "home", "/home.html": "home", "/index.html": "compare", "/company.html": "company",
  "/correlation.html": "correlation", "/mission.html": "correlation", "/backtest.html": "backtest",
  "/etf.html": "etf", "/filings.html": "filings", "/research.html": "research",
};
const page = pageByPath[location.pathname] || "home";
const examples = {
  home: ["업황 BSI가 뭐야?", "안전한 기업은 어떻게 찾아?", "금리와 기업 실적을 같이 보고 싶어"],
  compare: ["돈 잘 버는 기업은 어떻게 골라?", "ROE가 뭐야?", "부채비율은 어떻게 비교해?"],
  company: ["FCF가 뭐야?", "이자보상배율은 무슨 뜻이야?", "공시 원문은 어디서 봐?"],
  correlation: ["상관계수가 뭐야?", "환율과 주가가 같이 움직였어?", "업황 BSI가 뭐야?"],
  backtest: ["과거 수익률을 비교하고 싶어", "ETF도 비교할 수 있어?", "안전한 기업은 어떻게 찾아?"],
  etf: ["괴리율이 뭐야?", "ETF를 비교하고 싶어", "공시 자료는 어디서 봐?"],
  filings: ["사업보고서는 어디서 봐?", "기업 재무제표를 보고 싶어", "리포트도 볼 수 있어?"],
  research: ["증권사 리포트를 보고 싶어", "DART 공시도 확인하고 싶어", "기업 분석을 보고 싶어"],
};

function selectedCompany() {
  try {
    const item = JSON.parse(localStorage.getItem("activeCompany") || "null");
    return item && /^\d{8}$/.test(String(item.corpCode || "")) && typeof item.name === "string"
      ? item.name.slice(0, 40) : "";
  } catch { return ""; }
}

const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = "/ai-guide.css?v=2";
document.head.append(stylesheet);

const trigger = document.createElement("button");
trigger.type = "button";
trigger.className = "ai-guide-trigger";
trigger.textContent = "✦ AI 길잡이";
trigger.setAttribute("aria-haspopup", "dialog");
trigger.setAttribute("aria-expanded", "false");
document.body.append(trigger);

const backdrop = document.createElement("div");
backdrop.className = "ai-guide-backdrop";
backdrop.hidden = true;
const panel = document.createElement("section");
panel.className = "ai-guide-panel";
panel.hidden = true;
panel.setAttribute("role", "dialog");
panel.setAttribute("aria-modal", "true");
panel.setAttribute("aria-labelledby", "ai-guide-title");
panel.innerHTML = `
  <div class="ai-guide-head"><div><small>FINSCOPE AI GUIDE</small><h2 id="ai-guide-title">무엇을 살펴볼까요?</h2></div><button class="ai-guide-close" type="button" aria-label="길잡이 닫기">×</button></div>
  <div class="ai-guide-body">
    <p class="ai-guide-intro">원하는 내용을 적거나 아래에서 메뉴를 바로 골라보세요. 기본 안내는 API 비용 없이 이용할 수 있습니다.</p>
    <p class="ai-guide-context"></p>
    <div class="ai-guide-examples" aria-label="예시 질문"></div>
    <div class="ai-guide-menu-head"><strong>전체 메뉴 바로가기</strong><span>8개 화면 모두 안내합니다</span></div>
    <nav class="ai-guide-menu" aria-label="FinScope 전체 메뉴"></nav>
    <div class="ai-guide-answer" aria-live="polite"></div>
  </div>
  <form class="ai-guide-form"><label for="ai-guide-question">궁금한 점</label><div class="ai-guide-form-row"><input id="ai-guide-question" type="text" maxlength="240" autocomplete="off" placeholder="예: ROE가 뭐야?" /><button type="submit">안내받기</button></div><button class="ai-guide-ai-button" type="button" hidden>AI로 질문 분류하기</button><p class="ai-guide-foot">AI는 질문에 맞는 화면만 찾습니다. 재무 수치·전망·매수 추천을 만들지 않습니다. 개인정보는 입력하지 마세요.</p></form>`;
document.body.append(backdrop, panel);

const questionInput = panel.querySelector("#ai-guide-question");
const answerBox = panel.querySelector(".ai-guide-answer");
const aiButton = panel.querySelector(".ai-guide-ai-button");
const context = panel.querySelector(".ai-guide-context");
const exampleBox = panel.querySelector(".ai-guide-examples");
const menuBox = panel.querySelector(".ai-guide-menu");
const allowedHrefs = new Set(Object.values(GUIDE_ROUTES).map((item) => item.href));
Object.entries(GUIDE_ROUTES).forEach(([key, route], index) => {
  const link = document.createElement("a");
  link.href = route.href;
  link.className = key === page ? "active" : "";
  if (key === page) link.setAttribute("aria-current", "page");
  const number = document.createElement("span");
  number.className = "ai-guide-menu-number";
  number.textContent = String(index + 1).padStart(2, "0");
  const words = document.createElement("span");
  const label = document.createElement("strong");
  label.textContent = route.menuLabel;
  const hint = document.createElement("small");
  hint.textContent = route.menuHint;
  words.append(label, hint);
  link.append(number, words);
  menuBox.append(link);
});
let aiAvailable = false;
fetch("/api/ai-guide/status", { credentials: "same-origin", signal: AbortSignal.timeout(5000) })
  .then((response) => response.ok ? response.json() : null)
  .then((status) => { aiAvailable = status?.available === true; })
  .catch(() => { aiAvailable = false; });

function renderAnswer(answer) {
  answerBox.replaceChildren();
  const badge = document.createElement("span");
  badge.className = "ai-guide-answer-badge";
  badge.textContent = answer.source === "ai" ? "AI가 질문 목적만 분류" : "무료 안내";
  const heading = document.createElement("h3");
  heading.textContent = answer.title || "안내";
  const paragraph = document.createElement("p");
  paragraph.textContent = answer.text || "";
  answerBox.append(badge, heading, paragraph);
  if (answer.note) {
    const note = document.createElement("p");
    note.className = "ai-guide-note";
    note.textContent = answer.note;
    answerBox.append(note);
  }
  const links = document.createElement("div");
  links.className = "ai-guide-links";
  for (const item of answer.links || []) {
    if (!allowedHrefs.has(item.href)) continue;
    const link = document.createElement("a");
    link.href = item.href;
    link.textContent = item.label || "화면 보기";
    links.append(link);
  }
  answerBox.append(links);
}

function submitQuestion(question) {
  const normalized = String(question || "").trim();
  questionInput.value = normalized;
  const answer = guideAnswer(normalized, { companyName: selectedCompany() });
  if (answer.kind === "unknown" && !aiAvailable) answer.note = "AI 질문 분류는 아직 설정되지 않았습니다. 아래 무료 안내 링크를 이용해 주세요.";
  renderAnswer(answer);
  aiButton.hidden = answer.kind !== "unknown" || !aiAvailable;
  answerBox.scrollIntoView({ block: "nearest", behavior: "smooth" });
  return answer;
}

function openPanel() {
  backdrop.hidden = panel.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  context.textContent = `${GUIDE_ROUTES[page].label}${selectedCompany() ? ` · 최근 선택: ${selectedCompany()}` : ""}`;
  exampleBox.replaceChildren();
  for (const item of examples[page]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item;
    button.addEventListener("click", () => submitQuestion(item));
    exampleBox.append(button);
  }
  if (!answerBox.childElementCount) renderAnswer({ title: "모든 메뉴를 안내합니다", text: "질문을 적거나 아래에서 보고 싶은 화면을 직접 선택해 보세요.", links: [] });
  questionInput.focus();
}

function closePanel() {
  backdrop.hidden = panel.hidden = true;
  trigger.setAttribute("aria-expanded", "false");
  trigger.focus();
}

trigger.addEventListener("click", openPanel);
backdrop.addEventListener("click", closePanel);
panel.querySelector(".ai-guide-close").addEventListener("click", closePanel);
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !panel.hidden) closePanel(); });
panel.querySelector(".ai-guide-form").addEventListener("submit", (event) => { event.preventDefault(); submitQuestion(questionInput.value); });
aiButton.addEventListener("click", async () => {
  if (!questionInput.value.trim()) return;
  aiButton.disabled = true;
  aiButton.textContent = "질문 목적을 확인하는 중…";
  try {
    const response = await fetch("/api/ai-guide", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: questionInput.value.trim(), page }), signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json();
    renderAnswer(result.title ? result : { title: "연결을 확인해 주세요", text: result.error || "잠시 후 다시 시도해 주세요.", links: [] });
  } catch {
    renderAnswer({ title: "AI 연결을 확인해 주세요", text: "지금은 무료 안내를 이용할 수 있습니다. 잠시 후 다시 시도해 주세요.", links: [] });
  } finally {
    aiButton.disabled = false;
    aiButton.textContent = "AI로 질문 분류하기";
  }
});
