// Handling of integer parameters and arguments (matched to observed R output).
//
// - "Not an integer" means |x - round(x)| > 1e-9 max(1, |x|)
//   (e.g. R's dhyper(2 + 2e-9, ...) is 0, while dhyper(2 + 1.1e-9, ...) is treated as an integer)
// - Parameters are rounded half to even (R's nearbyint: 4.5 -> 4, 5.5 -> 6)

/** Whether x is not an integer (relative slack 1e-9) */
export function nonInt(x: number): boolean {
  return Math.abs(x - roundHalfEven(x)) > 1e-9 * Math.max(1, Math.abs(x));
}

/**
 * The largest count k with k <= q, for the distribution functions of discrete distributions on the integers. A q within
 * the slack of {@link nonInt} of an integer is that integer (a computed 2.9999999999999996 counts as 3), as the
 * densities treat it; any other q gives floor(q). R adds 1e-7 before taking the floor (or, in psignrank, rounding to
 * the nearest integer), which counts q in [k - 1e-7, k) as k although P[X <= q] is P[X <= k - 1] there, and does not
 * agree with its densities (dpois(1 - 1e-8, 1) is 0 while ppois(1 - 1e-8, 1) is P[X <= 1]) (#145, #146).
 */
export function countAtMost(q: number): number {
  return nonInt(q) ? Math.floor(q) : roundHalfEven(q);
}

/** Round half to even (0.5 goes to the nearest even number) */
export function roundHalfEven(x: number): number {
  if (!Number.isFinite(x)) return x;
  const r = Math.round(x);
  // Math.round rounds 0.5 towards +∞. Only for exact halves, move back to the even side
  return r - x === 0.5 && r % 2 !== 0 ? r - 1 : r;
}
