import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const publicUrl = new URL("../public/", import.meta.url);
const source = (name) => readFile(new URL(name, publicUrl), "utf8");

test("completed comparison results hide the loading panel even when it is flex", async () => {
  const [html, css, app] = await Promise.all([source("index.html"), source("compare-mobile.css"), source("app.js")]);
  assert.match(html, /id="status-panel"[^>]*role="status"/);
  assert.match(css, /#status-panel\[hidden\]\s*,\s*#results\[hidden\]\s*\{display:none!important\}/);
  assert.match(app, /\$\("#status-panel"\)\.hidden\s*=\s*true/);
  assert.match(app, /\$\("#results"\)\.hidden\s*=\s*false/);
});

test("phone comparison has accessible menus and a table swipe hint", async () => {
  const [html, css, app] = await Promise.all([source("index.html"), source("compare-mobile.css"), source("app.js")]);
  assert.match(html, /id="compare-menu-toggle"[^>]*aria-controls="compare-global-nav"[^>]*aria-expanded="false"/);
  assert.match(html, /id="compare-sections-toggle"[^>]*aria-controls="compare-section-links"[^>]*aria-expanded="false"/);
  assert.match(html, /class="mobile-table-hint"/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /\.workflow-guide\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(app, /compareMenuButton\.setAttribute\("aria-expanded", String\(open\)\)/);
});

test("all main screens load the shared phone navigation before content interaction", async () => {
  const pages = ["home", "company", "correlation", "filings", "research", "backtest", "etf", "mission"];
  const [pwa, sharedCss, navigation, ...html] = await Promise.all([
    source("pwa.js"), source("workspace-unified.css"), source("mobile-navigation.js"),
    ...pages.map((name) => source(`${name}.html`)),
  ]);
  assert.match(pwa, /mobile-navigation\.js\?v=1/);
  assert.match(sharedCss, /body\.fs-mobile-nav-ready\.fs-top-menu-open/);
  assert.match(navigation, /aria-expanded/);
  for (const page of html) {
    assert.match(page, /workspace-unified\.css\?v=7/);
    assert.match(page, /pwa\.js\?v=7/);
  }
});
