// Keep DART's legal company name in the source data while using the exchange
// stock name for investor-facing labels and third-party report searches.
const STOCK_NAMES = Object.freeze({
  "005380": "현대차",
});

export function stockDisplayName(company) {
  const code = String(company?.stockCode || "");
  return STOCK_NAMES[code] || String(company?.name || "").trim();
}

export function hankyungReportSearchUrl(company, now = new Date()) {
  const name = stockDisplayName(company);
  if (!name) return "https://consensus.hankyung.com/analysis/list?skinType=business";
  const end = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const startDate = new Date(`${end}T00:00:00Z`);
  startDate.setUTCFullYear(startDate.getUTCFullYear() - 1);
  const params = new URLSearchParams({
    skinType: "business", sdate: startDate.toISOString().slice(0, 10),
    edate: end, search_value: "", search_text: name,
  });
  return `https://consensus.hankyung.com/analysis/list?${params}`;
}
