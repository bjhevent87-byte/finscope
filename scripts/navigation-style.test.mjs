import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(`../public/${file}`, import.meta.url), "utf8");
const order = ["홈", "기업 비교", "기업 분석", "DART 공시", "리포트", "데이터 실험실", "백테스트", "ETF 비교"];

test("all module pages load the full navigation typography before JavaScript executes", async () => {
  for (const file of ["company.html", "correlation.html", "filings.html", "research.html", "etf.html", "backtest.html", "mission.html"]) {
    const html = await read(file);
    const head = html.split("</head>")[0];
    for (const stylesheet of ["fonts.googleapis.com/css2", "ui-v7.css", "pages-v11.css", "workspace-refresh.css", "workspace-unified.css"]) {
      assert.ok(head.includes(stylesheet), `${file} is missing ${stylesheet} in <head>`);
    }
    assert.match(html, /<body class="workspace-navigation">/, `${file} must reserve its final layout before JavaScript runs`);
  }
  const pages = await read("pages.js");
  assert.ok(!pages.includes('document.head.insertAdjacentHTML("beforeend"'), "core styles must not load after the page is rendered");
});

test("home, comparison and generated navigation keep company work before the data lab", async () => {
  for (const file of ["home.html", "index.html", "pages.js"]) {
    const content = await read(file);
    const positions = order.map((label) => content.indexOf(`"${label}"`) >= 0
      ? content.indexOf(`"${label}"`) : content.indexOf(`>${label}</a>`));
    assert.ok(positions.every((position) => position >= 0), `${file}: missing menu item`);
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, `${file}: wrong menu order`);
  }
});

test("late company analysis cannot hide a completed AI answer", async () => {
  const company = await read("company.js");
  const renderAnalysis = company.split("function renderAnalysis(data){")[1]?.split("function decisionModel")[0] || "";
  assert.ok(renderAnalysis);
  assert.ok(!renderAnalysis.includes("agentResult.hidden=true"));
  assert.ok(company.includes("agentResult.hidden=false;agentResult.replaceChildren(main,facts)"));
});

test("company analysis keeps the first action and evidence controls next to the headline", async () => {
  const html = await read("company.html");
  const hero = html.split('<section class="hero company-hero"')[1]?.split('</section>')[0] || "";
  assert.match(hero, /id="company-analysis"/);
  assert.match(hero, /id="search"/);
  assert.match(hero, /id="run"/);
  assert.match(hero, /class="company-hero-more"/);
  assert.match(html, /id="summary-extra"/);
  const company = await read("company.js");
  assert.match(company, /company-agent-proof/);
  assert.match(company, /company-agent-basis/);
  assert.match(company, /DART 원문에서 확인하기/);
});
