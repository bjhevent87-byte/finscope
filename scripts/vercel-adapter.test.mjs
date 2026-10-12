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
