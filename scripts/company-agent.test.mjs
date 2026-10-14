import test from "node:test";
import assert from "node:assert/strict";
import { AGENT_METRICS, buildTrendEvidence, runCompanyAgent } from "../company-agent.mjs";

const source = (year) => ({
  year, title: `사업보고서 (${year}.12)`, receiptDate: `${year + 1}0331`,
  url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${year}1234567890`,
});
const base = {
  company: { name: "테스트전자", isFinancial: false }, metric: "operatingMargin",
  previous: { year: 2024, statementBasis: "CFS", operatingMargin: 8.1 },
  current: { year: 2025, statementBasis: "CFS", operatingMargin: 10.6 },
  sources: [source(2024), source(2025)],
};

test("code computes a comparable annual margin change and keeps two official links", () => {
  const result = buildTrendEvidence(base);
  assert.equal(result.status, "ready");
  assert.equal(result.difference, 2.5);
  assert.equal(result.unit, "%p");
  assert.equal(result.sources.length, 2);
  assert.deepEqual(Object.keys(AGENT_METRICS), ["operatingMargin", "revenue", "roe", "debtRatio", "operatingCashFlow"]);
});

test("mixed bases, missing values, unsupported financial metrics, and missing links pause the conclusion", () => {
  assert.equal(buildTrendEvidence({ ...base, current: { ...base.current, statementBasis: "OFS" } }).status, "insufficient");
  assert.equal(buildTrendEvidence({ ...base, current: { ...base.current, operatingMargin: null } }).status, "insufficient");
  assert.equal(buildTrendEvidence({ ...base, company: { name: "테스트은행", isFinancial: true } }).status, "unsupported");
  assert.equal(buildTrendEvidence({ ...base, sources: [source(2025)] }).status, "insufficient");
  assert.equal(buildTrendEvidence({ ...base, metric: "madeUp" }).status, "unsupported");
});

function fakeResponses(toolName, args, finalAnswer, seen) {
  let call = 0;
  return async (_url, init) => {
    const request = JSON.parse(init.body);
    seen.push(request);
    const payload = call++ === 0
      ? { status: "completed", output: [{ type: "function_call", name: toolName, call_id: "call_1", arguments: JSON.stringify(args) }], usage: { input_tokens: 90, output_tokens: 20 } }
      : { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(finalAnswer) }] }], usage: { input_tokens: 120, output_tokens: 40 } };
    return { ok: true, json: async () => payload };
  };
}

test("agent chooses trend tool and supplies only code-calculated evidence", async () => {
  const seen = [];
  const result = await runCompanyAgent({
    question: "영업이익률이 좋아졌어?", company: { name: "테스트전자" }, apiKey: "fake",
    getTrend: async () => buildTrendEvidence(base), getFilings: async () => { throw new Error("wrong tool"); },
    fetcher: fakeResponses("get_financial_trend", { metric: "operatingMargin" },
      { explanation: "본업 이익이 매출에서 차지하는 몫이 커졌습니다.", nextCheck: "매출과 영업현금흐름도 함께 확인하세요." }, seen),
  });
  assert.equal(result.tool, "get_financial_trend");
  assert.equal(result.evidence.difference, 2.5);
  assert.equal(result.trace.inputTokens, 210);
  assert.equal(seen.length, 2);
  assert.equal(seen[0].store, false);
  assert.equal(seen[0].tool_choice, "required");
  assert.ok(seen[1].input.some((item) => item.type === "function_call_output"));
});

test("agent can choose disclosures instead of a numerical comparison", async () => {
  const seen = [];
  const result = await runCompanyAgent({
    question: "최근 공시는?", company: { name: "테스트전자" }, apiKey: "fake",
    getTrend: async () => { throw new Error("wrong tool"); },
    getFilings: async () => ({ status: "ready", sources: [source(2025)] }),
    fetcher: fakeResponses("get_recent_filings", {},
      { explanation: "최근 접수된 공시 제목을 확인했습니다.", nextCheck: "공시 원문에서 사업 변화와 위험요인을 읽어 보세요." }, seen),
  });
  assert.equal(result.tool, "get_recent_filings");
  assert.equal(result.evidence.sources.length, 1);
});

test("unverified numbers or trade recommendations in model prose are discarded", async () => {
  const seen = [];
  const result = await runCompanyAgent({
    question: "영업이익률이 좋아졌어?", company: { name: "테스트전자" }, apiKey: "fake",
    getTrend: async () => buildTrendEvidence(base), getFilings: async () => null,
    fetcher: fakeResponses("get_financial_trend", { metric: "operatingMargin" },
      { explanation: "목표주가 999원으로 매수하세요.", nextCheck: "반드시 오를 겁니다." }, seen),
  });
  assert.match(result.explanation, /공시에서 확인한/);
  assert.doesNotMatch(result.explanation, /999|매수/);
});

test("missing data or a mismatched tool returns a cautious result without a second model call", async () => {
  const seen = [];
  const result = await runCompanyAgent({
    question: "영업이익률이 좋아졌어?", company: { name: "테스트전자" }, apiKey: "fake",
    getTrend: async () => { throw new Error("wrong tool"); },
    getFilings: async () => ({ status: "ready", sources: [source(2025)] }),
    fetcher: fakeResponses("get_recent_filings", {},
      { explanation: "근거 없는 주장입니다.", nextCheck: "확인하지 마세요." }, seen),
  });
  assert.equal(result.status, "insufficient");
  assert.equal(seen.length, 1);
});
