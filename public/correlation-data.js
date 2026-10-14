// Missing observations must never become zero-valued market moves.
export function isNumericObservation(value) {
  if (typeof value !== "number" && typeof value !== "string") return false;
  if (typeof value === "string" && !value.trim()) return false;
  return Number.isFinite(Number(value));
}

const monthSerial = (month) => Number(month.slice(0, 4)) * 12 + Number(month.slice(4, 6)) - 1;

export function lastCompletedMonthEnd(now = new Date()) {
  const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(koreaTime.getUTCFullYear(), koreaTime.getUTCMonth(), 0, 12));
}

export function hasConsecutiveMonthlyRows(rows) {
  return rows.length > 0 && rows.every((row, index) => index === 0
    || monthSerial(row.month) - monthSerial(rows[index - 1].month) === 1);
}

export function monthlyLast(rows, field) {
  const result = new Map();
  rows.forEach((row) => {
    const date = String(row?.date || "").replace(/\D/g, "");
    const rawValue = row?.[field];
    if (date.length < 6 || row?.status === "missing" || !isNumericObservation(rawValue)) return;
    result.set(date.slice(0, 6), Number(rawValue));
  });
  return result;
}

export function monthlyChanges(levels, mode) {
  const months = [...levels.keys()].sort();
  const result = new Map();
  months.forEach((month, index) => {
    const interval = mode === "yoy" ? 12 : 1;
    if (index < interval) return;
    const previousMonth = months[index - interval];
    if (monthSerial(month) - monthSerial(previousMonth) !== interval) return;
    const current = levels.get(month), previous = levels.get(previousMonth);
    if (!isNumericObservation(current) || !isNumericObservation(previous) || (!Number(previous) && mode !== "point")) return;
    result.set(month, mode === "point" ? Number(current) - Number(previous) : ((Number(current) / Number(previous)) - 1) * 100);
  });
  return result;
}
