import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(root, "..", "stock", ".cache", "corp_codes.xml");
const target = path.join(root, "data", "companies.json");
const xml = await readFile(source, "utf8");
const value = (block, tag) => block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() || "";
const companies = [...xml.matchAll(/<list>([\s\S]*?)<\/list>/g)]
  .map((match) => ({
    corpCode: value(match[1], "corp_code"),
    name: value(match[1], "corp_name"),
    stockCode: value(match[1], "stock_code"),
    modifiedAt: value(match[1], "modify_date"),
  }))
  .filter((item) => /^\d{6}$/.test(item.stockCode));
await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(companies), "utf8");
console.log(`${companies.length}개 상장기업 저장: ${target}`);
