export const INTERIM_REPORTS = [
  { code: "11014", label: "3분기보고서" },
  { code: "11012", label: "반기보고서" },
  { code: "11013", label: "1분기보고서" },
];

export async function latestFiledInterim(afterYear, currentYear, getRows) {
  for (let year = currentYear; year > afterYear; year--) {
    for (const report of INTERIM_REPORTS) {
      let currentRows;
      try {
        currentRows = await getRows(year, report.code);
      } catch (error) {
        if (error?.code === "013") continue;
        throw error;
      }
      if (!currentRows?.length) continue;
      let priorRows = null;
      try {
        priorRows = await getRows(year - 1, report.code);
      } catch (error) {
        if (error?.code !== "013") throw error;
      }
      return { year, reportCode: report.code, reportLabel: report.label, currentRows, priorRows };
    }
  }
  return null;
}

export function filingSource(rows) {
  const receiptNo = rows?.find((row) => /^\d{14}$/.test(String(row.rcept_no || "")))?.rcept_no;
  return receiptNo ? {
    receiptNo,
    receiptDate: String(receiptNo).slice(0, 8),
    url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${receiptNo}`,
  } : null;
}
