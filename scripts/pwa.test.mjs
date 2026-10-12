import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");

test("모든 서비스 화면이 설치형 앱 정보를 포함한다", async () => {
  const files = (await readdir(PUBLIC)).filter((name) => name.endsWith(".html") && name !== "offline.html");
  assert.ok(files.length >= 9);
  for (const file of files) {
    const html = await readFile(path.join(PUBLIC, file), "utf8");
    assert.match(html, /rel=["']manifest["'][^>]+app\.webmanifest/, `${file}: manifest 누락`);
    assert.match(html, /pwa\.js/, `${file}: PWA 등록 스크립트 누락`);
    assert.match(html, /theme-color/, `${file}: theme-color 누락`);
  }
});

test("웹앱 매니페스트와 필수 아이콘이 유효하다", async () => {
  const manifest = JSON.parse(await readFile(path.join(PUBLIC, "app.webmanifest"), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
  await Promise.all(manifest.icons.map((icon) => access(path.join(PUBLIC, icon.src.replace(/^\//, "")))));
});

test("서비스 워커는 API 응답을 오프라인 캐시에 저장하지 않는다", async () => {
  const worker = await readFile(path.join(PUBLIC, "sw.js"), "utf8");
  assert.match(worker, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /offline\.html/);
});
