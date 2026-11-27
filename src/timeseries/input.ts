// Checks of the series given to the time-series functions (1.20.0's edge-case review, experiments/tsmeta120-log.md
// 107): an infinite value is an error everywhere (R's functions fail with various messages or return NaN, and an
// infinite value cannot be a missing one); a missing value (NaN) is an error where the method has no rule for it
// (R's own functions fail there too); and the series must be long enough for the method. Written for rStats.js (no
// ported code).

/**
 * The series as numbers. Throws a RangeError naming the function when a value is infinite, when a value is missing
 * (NaN) and `missing` is "fail", or when fewer than `minLength` values are observed.
 */
export function tsInput(x: readonly number[], what: string, options: { missing?: "allow" | "fail"; minLength?: number } = {}): number[] {
  const y = x.map(Number);
  let observed = 0;
  for (const v of y) {
    if (v === Infinity || v === -Infinity) throw new RangeError(`${what}: the series contains infinite values`);
    if (Number.isNaN(v)) { if (options.missing !== "allow") throw new RangeError(`${what}: the series contains missing values`); } else observed++;
  }
  const min = options.minLength ?? 1;
  if (observed < min) throw new RangeError(`${what}: at least ${min} observation${min === 1 ? " is" : "s are"} needed (got ${observed})`);
  return y;
}
