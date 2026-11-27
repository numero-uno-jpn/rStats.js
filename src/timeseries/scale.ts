// Standardising a series by a power of two (1.20.0, experiments/tsmeta120-log.md 104): exact, so the fitting
// functions can work on a series of unit scale and map the results back. Written for rStats.js (no ported code).

/** 2^round(log2(max |y|)) over the finite values (1 when there is none or all are zero). */
export function powerOfTwoScale(y: readonly number[]): number {
  let mx = 0; for (const v of y) if (Number.isFinite(v) && Math.abs(v) > mx) mx = Math.abs(v);
  if (!(mx > 0)) return 1;
  const k = Math.round(Math.log2(mx));
  // clamped to the normal powers of two (max |y| near 2^1024 or below 2^-1022)
  return k > 1023 ? 2 ** 1023 : k < -1022 ? 2 ** -1022 : 2 ** k;
}

/**
 * The series divided by {@link powerOfTwoScale}: for statistics that do not depend on the scale, the same values bit
 * for bit wherever the squares (and fourth powers) stay in range, and right beyond.
 */
export function standardise(y: readonly number[]): number[] {
  const c = powerOfTwoScale(y);
  return c === 1 ? y.slice() : y.map((v) => v / c);
}
