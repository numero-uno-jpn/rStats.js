// Largest and smallest values of an array, as Math.max(...v) and Math.min(...v) (NaN if any value is NaN) but
// without spreading the array into arguments, which overflows the call stack for large arrays.

/** Math.max(...v) without spreading (-Infinity for an empty array) */
export function maxOf(v: ArrayLike<number>): number {
  let m = -Infinity;
  for (let i = 0; i < v.length; i++) m = Math.max(m, v[i]!);
  return m;
}

/**
 * (a + b) / 2, falling back to a / 2 + b / 2 only when a and b are finite and their sum overflows (so that the
 * value is the usual one otherwise)
 */
export function midpoint(a: number, b: number): number {
  const m = 0.5 * (a + b);
  return Number.isFinite(m) || !Number.isFinite(a) || !Number.isFinite(b) ? m : 0.5 * a + 0.5 * b;
}

/** Math.min(...v) without spreading (Infinity for an empty array) */
export function minOf(v: ArrayLike<number>): number {
  let m = Infinity;
  for (let i = 0; i < v.length; i++) m = Math.min(m, v[i]!);
  return m;
}
