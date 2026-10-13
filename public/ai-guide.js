import { guideAnswer, GUIDE_ROUTES } from "./ai-guide-rules.js";

const pageByPath = {
  "/": "home", "/home.html": "home", "/index.html": "compare", "/company.html": "company",
  "/correlation.html": "correlation", "/mission.html": "correlation", "/backtest.html": "backtest",
  "/etf.html": "etf", "/filings.html": "filings", "/research.html": "research",
};
const page = pageByPath[location.pathname] || "home";
const examples = {
  home: ["업황 BSI가 뭐야?", "안전한 기업은 어떻게 찾아?", "금리와 기업 실적을 같이 보고 싶어"],
  compare: ["PER이 뭐야?", "PBR은 어떻게 봐?", "매출성장률은 어떻게 계산해?"],
  company: ["FCF가 뭐야?", "이자보상배율은 무슨 뜻이야?", "공시 원문은 어디서 봐?"],
  correlation: ["상관계수가 뭐야?", "환율과 주가가 같이 움직였어?", "업황 BSI가 뭐야?"],
  backtest: ["과거 수익률을 비교하고 싶어", "ETF도 비교할 수 있어?", "안전한 기업은 어떻게 찾아?"],
  etf: ["괴리율이 뭐야?", "ETF를 비교하고 싶어", "공시 자료는 어디서 봐?"],
  filings: ["사업보고서는 어디서 봐?", "기업 재무제표를 보고 싶어", "리포트도 볼 수 있어?"],
  research: ["증권사 리포트를 보고 싶어", "DART 공시도 확인하고 싶어", "기업 분석을 보고 싶어"],
};
const questionGroups = [
  { title: "재무지표 뜻", questions: ["PER이 뭐야?", "PBR은 어떻게 봐?", "매출성장률은 어떻게 계산해?", "ROE가 뭐야?"] },
  { title: "어디서 확인하나요?", questions: ["기업 재무제표는 어디서 봐?", "DART 공시는 어디서 봐?", "ETF 괴리율은 뭐야?", "환율과 주가 관계는 어디서 봐?"] },
];

function selectedCompany() {
  try {
    const item = JSON.parse(localStorage.getItem("activeCompany") || "null");
    return item && /^\d{8}$/.test(String(item.corpCode || "")) && typeof item.name === "string"
      ? item.name.slice(0, 40) : "";
  } catch { return ""; }
}

const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = "/ai-guide.css?v=4";
document.head.append(stylesheet);

const trigger = document.createElement("button");
trigger.type = "button";
trigger.className = "ai-guide-trigger";
trigger.textContent = "✦ FinScope 길잡이";
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
  <div class="ai-guide-head"><div><small>FINSCOPE GUIDE</small><h2 id="ai-guide-title">무엇을 살펴볼까요?</h2></div><button class="ai-guide-close" type="button" aria-label="길잡이 닫기">×</button></div>
  <div class="ai-guide-body">
    <p class="ai-guide-intro">궁금한 지표를 물어보거나, 질문 목록과 메뉴에서 바로 골라보세요.</p>
    <p class="ai-guide-context"></p>
    <div class="ai-guide-examples" aria-label="예시 질문"></div>
    <details class="ai-guide-question-list"><summary>질문 목록 보기 <span>지표 뜻 · 메뉴 찾기</span></summary><div class="ai-guide-question-groups"></div></details>
    <div class="ai-guide-menu-head"><strong>전체 메뉴 바로가기</strong><span>8개 화면 모두 안내합니다</span></div>
    <nav class="ai-guide-menu" aria-label="FinScope 전체 메뉴"></nav>
    <div class="ai-guide-answer" aria-live="polite"></div>
  </div>
  <form class="ai-guide-form"><label for="ai-guide-question">궁금한 점</label><div class="ai-guide-form-row"><input id="ai-guide-question" type="text" maxlength="240" autocomplete="off" placeholder="예: PER은 어떻게 읽나요?" /><button type="submit">안내받기</button></div><button class="ai-guide-ai-button" type="button" hidden>AI로 자세히 듣기</button><p class="ai-guide-foot">AI 설명은 버튼을 누를 때만 요청합니다. 확인되지 않은 기업 수치나 투자 전망은 만들지 않습니다. 개인정보는 입력하지 마세요.</p></form>`;
document.body.append(backdrop, panel);

const questionInput = panel.querySelector("#ai-guide-question");
const answerBox = panel.querySelector(".ai-guide-answer");
const aiButton = panel.querySelector(".ai-guide-ai-button");
const context = panel.querySelector(".ai-guide-context");
const exampleBox = panel.querySelector(".ai-guide-examples");
const questionGroupsBox = panel.querySelector(".ai-guide-question-groups");
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
for (const group of questionGroups) {
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  heading.textContent = group.title;
  section.append(heading);
  const questions = document.createElement("div");
  questions.className = "ai-guide-question-buttons";
  for (const question of group.questions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = question;
    button.addEventListener("click", () => submitQuestion(question));
    questions.append(button);
  }
  section.append(questions);
  questionGroupsBox.append(section);
}
let aiAvailable = false;
let aiDailyLimit = 1;
fetch("/api/ai-guide/status", { credentials: "same-origin", signal: AbortSignal.timeout(5000) })
  .then((response) => response.ok ? response.json() : null)
  .then((status) => { aiAvailable = status?.available === true; aiDailyLimit = Number(status?.dailyLimit) || 1; })
  .catch(() => { aiAvailable = false; });

function renderAnswer(answer) {
  answerBox.replaceChildren();
  const badge = document.createElement("span");
  badge.className = "ai-guide-answer-badge";
  badge.textContent = answer.source === "ai" ? "AI 설명 · FinScope 근거" : "FinScope 안내";
  const heading = document.createElement("h3");
  heading.textContent = answer.title || "안내";
  const paragraph = document.createElement("p");
  paragraph.textContent = answer.text || "";
  answerBox.append(badge, heading, paragraph);
  if (Array.isArray(answer.evidence) && answer.evidence.length) {
    const evidence = document.createElement("p");
    evidence.className = "ai-guide-evidence";
    evidence.textContent = `참고한 설명: ${answer.evidence.join(" · ")}`;
    answerBox.append(evidence);
  }
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
  if (answer.kind === "unknown" && !aiAvailable) answer.note = "질문 목록에서 비슷한 예시를 고르거나 원하는 메뉴를 선택해 주세요.";
  renderAnswer(answer);
  aiButton.hidden = !aiAvailable || ["restricted", "empty"].includes(answer.kind);
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
  if (!answerBox.childElementCount) renderAnswer({ title: "질문으로 시작해 보세요", text: "지표의 뜻을 묻거나 질문 목록에서 예시를 선택해 보세요. 원하는 메뉴로도 바로 이동할 수 있습니다.", links: [] });
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
  aiButton.textContent = "근거를 확인하는 중…";
  try {
    const response = await fetch("/api/ai-guide", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: questionInput.value.trim(), page, mode: "explain" }), signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json();
    renderAnswer(result.title ? result : { title: "연결을 확인해 주세요", text: result.error || "잠시 후 다시 시도해 주세요.", links: [] });
  } catch {
    renderAnswer({ title: "AI 연결을 확인해 주세요", text: "지금은 질문 목록이나 메뉴를 이용해 주세요. 잠시 후 다시 시도해 주세요.", links: [] });
  } finally {
    aiButton.disabled = false;
    aiButton.textContent = "AI로 자세히 듣기";
    if (aiDailyLimit <= 1) { aiAvailable = false; aiButton.hidden = true; }
  }
});
