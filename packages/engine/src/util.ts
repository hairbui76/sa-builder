// Deterministic numeric helpers: only + − × ÷ so results match on every JS engine.

/** x^w for x in [0,1] and w ≥ 0: exact for the integer part, linear for the fraction. */
export function powApprox(x: number, w: number): number {
  if (w <= 0) return 1;
  let result = 1;
  let whole = Math.floor(w);
  while (whole-- > 0) result *= x;
  const frac = w - Math.floor(w);
  if (frac > 0) result *= 1 - frac * (1 - x);
  return result;
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function round(x: number, digits = 2): number {
  const f = digits === 0 ? 1 : digits === 1 ? 10 : digits === 2 ? 100 : 1000;
  return Math.round(x * f) / f;
}

/** FNV-1a 32-bit hash of a string, hex encoded. */
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function formatUsd(x: number): string {
  const v = round(x, 2);
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function regionKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
