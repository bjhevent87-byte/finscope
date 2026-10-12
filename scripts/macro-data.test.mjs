import test from "node:test";
import assert from "node:assert/strict";
import { MACRO_SERIES, createMacroService, correlationInterpretation, macroSeriesCsv } from "../macro-data.mjs";

class TestCache extends Map {
  set(key, value) { return super.set(key, value); }
}

test("상관관계 문구는 짧고 수치와 일치한다", () => {
  const result = correlationInterpretation(-0.42, "20211001", "20261001");
  assert.equal(result.period, "2021-10~2026-10");
  assert.equal(result.text, "관계는 약합니다 · 상관계수 -0.42");
});

test("환율은 ECOS 일별 시계열, 미국 정책금리는 목표범위 상단을 사용한다", () => {
  const exchange = MACRO_SERIES.find((item) => item.id === "usd-krw");
  const policy = MACRO_SERIES.find((item) => item.id === "us-policy-rate");
  assert.deepEqual([exchange.source, exchange.providerCode, exchange.itemCodes, exchange.frequency], ["ECOS", "731Y001", ["0000001"], "D"]);
  assert.deepEqual([policy.name, policy.providerCode, policy.frequency], ["미국 기준금리 상단", "DFEDTARU", "D"]);
});

test("ECOS 월간·다단계 항목은 월 날짜와 전체 항목 경로를 사용한다", async () => {
  let requestedUrl = "";
  const fetchJson = async (url) => {
    requestedUrl = url;
    return { StatisticSearch: { list_total_count: 1, row: [{ TIME: "202609", DATA_VALUE: "120.43" }] } };
  };
  const service = createMacroService({ ecosKey: "ecos", fredKey: "fred", eximKey: "exim", fetchJson, cache: new TestCache() });
  const result = await service.getSeries("kr-industrial-production", "20211001", "20261007");
  assert.match(requestedUrl, /\/M\/202110\/202610\/A00\/2$/);
  assert.equal(result.observations[0].date, "2026-09");
});

test("미국 CPI는 BLS 비계절조정 지수를 사용한다", () => {
  const cpi = MACRO_SERIES.find((item) => item.id === "us-cpi");
  assert.deepEqual([cpi.source, cpi.providerCode, cpi.frequency, cpi.unit], ["FRED", "CPIAUCNS", "M", "지수"]);
});

test("CSV는 출처와 결측 사유를 포함한다", () => {
  const csv = macroSeriesCsv({
    id: "us-10y", name: "미국 국채 10년물", source: "FRED", unit: "%", collectedAt: "2026-10-06T00:00:00.000Z",
    observations: [
      { date: "2026-10-01", value: 5.2, status: "valid" },
      { date: "2026-10-02", value: null, status: "missing", missingReason: "not_published" },
    ],
  });
  assert.match(csv, /"출처"/);
  assert.match(csv, /"결측사유"/);
  assert.match(csv, /"not_published"/);
});

test("EXIM 단일 래퍼 객체와 중첩 목록을 표준화한다", async () => {
  const fetchJson = async (url) => {
    if (!url.includes("internationalJSON")) throw new Error("unexpected URL");
    return {
      result: 1,
      sofr_list: [{ result: 1, cur_fund: "USD", sfln_intrc_nm: "SOFR 익일물", int_r: "3.9" }],
      new_cirr_list: [{ result: 1, cur_fund: "USD", sfln_intrc_nm: null, int_r: "5.28" }],
    };
  };
  const service = createMacroService({ ecosKey: "ecos", fredKey: "fred", eximKey: "exim", fetchJson, cache: new TestCache() });
  const result = await service.internationalRates("20261002");
  assert.equal(result.items.length, 2);
  assert.equal(result.quality.usableRows, 1);
  assert.equal(result.items.find((item) => item.group === "NEW_CIRR").qualityFlag, "missing_maturity_label");
});

test("승인된 KRX 석유·배출권·선물·ESG 지표가 분석 카탈로그에 포함된다", () => {
  const service = createMacroService({ ecosKey: "ecos", fredKey: "fred", eximKey: "exim", krxKey: "krx", fetchJson: async () => ({}), cache: new TestCache() });
  const catalog = service.catalog();
  for (const id of ["krx-gasoline", "krx-emission-kau", "krx-future-usd", "krx-esg-leaders"]) {
    assert.equal(catalog.find((item) => item.id === id)?.configured, true);
  }
});

test("KRX 월말 표준화는 석유 유통가격과 정규시장 최근월 선물을 선택한다", async () => {
  const fetchJson = async (url) => {
    if (url.includes("gen/oil_bydd_trd")) return { OutBlock_1: [{ BAS_DD: "20261006", OIL_NM: "휘발유", WT_AVG_PRC: "0.00", WT_DIS_AVG_PRC: "1784.00" }] };
    if (url.includes("drv/fut_bydd_trd")) return { OutBlock_1: [
      { BAS_DD: "20261006", PROD_NM: "미국달러 선물", MKT_NM: "정규", ISU_NM: "미국달러 F 202612", TDD_CLSPRC: "1348.5", ACC_TRDVOL: "100" },
      { BAS_DD: "20261006", PROD_NM: "미국달러 선물", MKT_NM: "정규", ISU_NM: "미국달러 F 202703", TDD_CLSPRC: "1352.0", ACC_TRDVOL: "200" },
    ] };
    return { OutBlock_1: [] };
  };
  const service = createMacroService({ ecosKey: "ecos", fredKey: "fred", eximKey: "exim", krxKey: "krx", fetchJson, cache: new TestCache() });
  const oil = await service.getSeries("krx-gasoline", "20261001", "20261006");
  const future = await service.getSeries("krx-future-usd", "20261001", "20261006");
  assert.equal(oil.latest.value, 1784);
  assert.equal(oil.quality.samplingMethod, "각 월의 마지막 KRX 거래일 종가");
  assert.equal(future.latest.value, 1348.5);
  assert.equal(future.latest.instrument, "미국달러 F 202612");
});
