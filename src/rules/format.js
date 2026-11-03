/* Kuralların kullandığı üç küçük yardımcı. */
export const sum = (arr, fn) => arr.reduce((s, x) => s + (fn ? fn(x) : x), 0);

export const pct = (v, digits = 1) => v == null ? '—' : `${(v * 100).toFixed(digits)}%`;

export const usd = v => {
  if (v == null || !isFinite(v)) return '—';
  const a = Math.abs(v), sign = v < 0 ? '−$' : '$';
  if (a >= 1e9) return `${sign}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}${(a / 1e3).toFixed(1)}K`;
  return `${sign}${a.toFixed(0)}`;
};
