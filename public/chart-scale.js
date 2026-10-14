// Financial trend charts must retain every disclosed value, including outliers.
// "Change zoom" tightens the axis around the data; "full" also includes zero.
export function financialAxisRange(values, { includeZero = false } = {}) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;

  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) {
    const spread = Math.max(Math.abs(min) * .1, 1);
    min -= spread;
    max += spread;
  }
  const padding = (max - min) * .12;
  return { min: min - padding, max: max + padding };
}
