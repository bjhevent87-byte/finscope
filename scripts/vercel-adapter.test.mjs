import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import { after, before, test } from "node:test";
import handler from "../api/index.mjs";

let server;
let baseUrl;

before(async () => {
  server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test("Vercel root redirects to the home page before index.html is served", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.ok(config.redirects.some((rule) => rule.source === "/" && rule.destination === "/home.html"));
  assert.ok(!config.rewrites.some((rule) => rule.source === "/"));
});

test("Vercel rewrite reaches the existing health endpoint", async () => {
  const response = await fetch(`${baseUrl}/api/index?__path=health`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.companyData, true);
});

test("Vercel rewrite preserves the original query and nested API route", async () => {
  const response = await fetch(`${baseUrl}/api/index?__path=macro/catalog`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(Array.isArray(payload.series));
  assert.ok(payload.series.length > 0);
});

test("Vercel function can read the bundled company list", async () => {
  const response = await fetch(`${baseUrl}/api/index?__path=companies&q=${encodeURIComponent("삼성전자")}`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(payload.some((company) => company.name === "삼성전자"));
});

test("company deep link can resolve an exact DART corporation code", async () => {
  const response = await fetch(`${baseUrl}/api/index?__path=companies&q=00126380`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(payload.some((company) => company.corpCode === "00126380" && company.stockCode === "005930"));
});

test("company agent route exists and rejects untrusted requests before any paid call", async () => {
  const get = await fetch(`${baseUrl}/api/index?__path=company-agent`);
  assert.equal(get.status, 405);
  const crossOrigin = await fetch(`${baseUrl}/api/index?__path=company-agent`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "https://example.net" },
    body: JSON.stringify({ corpCode: "00126380", question: "영업이익률이 좋아졌어?" }),
  });
  assert.equal(crossOrigin.status, 403);
  const restricted = await fetch(`${baseUrl}/api/index?__path=company-agent`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ corpCode: "00126380", question: "목표주가 예측해 줘" }),
  });
  assert.equal(restricted.status, 400);
});
