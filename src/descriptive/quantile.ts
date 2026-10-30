// Sample quantiles and robust summaries: R's quantile (types 1 to 9), IQR, fivenum and mad.
//
// Written for rStats.js. The nine quantile definitions are those of Hyndman and Fan, "Sample quantiles in
// statistical packages", The American Statistician 50, 1996, numbered as in that paper and in R's ?quantile. Details
// that the paper leaves open follow R's documented behaviour and observed output: type 7 interpolates at
// 1 + (n - 1) p only between order statistics that differ (so that equal infinite neighbours are not turned into
// NaN); the other types take the integer part of the position after enlarging it by a relative 4 eps, so that a
// position meant to be an integer is not lost to rounding, and treat a fractional part below 4 eps as 0. fivenum is
// Tukey's five-number summary; mad scales by 1.4826 by default.

import { median, values, type NaRmOptions } from "./basic.js";
import type { Sample } from "../htest/types.js";
import { midpoint } from "../internal/extremes.js";

/**
 * Options for {@link quantile}.
 *
 * @category Descriptive statistics
 */
export interface QuantileOptions extends NaRmOptions {
  /** Hyndman and Fan's definition, 1 to 9. Default `7`. */
  type?: number;
}

/** Relative fuzz for the positions of types 1 to 6, 8 and 9 */
const FUZZ = 4 * Number.EPSILON;

/** (a, b) of the continuous types 4 to 6, 8 and 9 (Hyndman and Fan's p(k) = (k - a) / (n + 1 - a - b)) */
const CONTINUOUS: Record<number, [number, number]> = {
  4: [0, 1],
  5: [0.5, 0.5],
  6: [0, 0],
  8: [1 / 3, 1 / 3],
  9: [3 / 8, 3 / 8],
};

/** Quantile of type `type` at probability `p` (in [0, 1]) of the ascending values `s` (non-empty) */
function quantileOfSorted(s: readonly number[], p: number, type: number): number {
  const n = s.length;
  // order statistic j (1-based), extended by the end values outside 1..n
  const at = (j: number): number => s[Math.min(Math.max(j, 1), n) - 1]!;
  if (type === 7) {
    const m = 1 + (n - 1) * p;
    const j = Math.floor(m);
    const lower = at(j);
    const upper = at(Math.ceil(m));
    if (m > j && upper !== lower) {
      const g = m - j;
      return (1 - g) * lower + g * upper;
    }
    return lower;
  }
  let j: number;
  let g: number;
  if (type <= 3) {
    const m = type === 3 ? n * p - 0.5 : n * p;
    j = Math.floor(m * (1 + FUZZ));
    if (type === 1) g = m > j ? 1 : 0;
    else if (type === 2) g = m > j ? 1 : 0.5;
    else g = m !== j || Math.abs(j % 2) === 1 ? 1 : 0;
  } else {
    const [a, b] = CONTINUOUS[type]!;
    const m = a + p * (n + 1 - a - b);
    j = Math.floor(m * (1 + FUZZ));
    g = m - j;
    if (Math.abs(g) < FUZZ) g = 0;
  }
  const lower = at(j);
  const upper = at(j + 1);
  if (g === 1) return upper;
  if (g > 0 && g < 1 && lower !== upper) return (1 - g) * lower + g * upper;
  return lower;
}

/**
 * Sample quantiles. Equivalent to R's `quantile()`. Without names (R's `names = FALSE`).
 *
 * @param x The data.
 * @param probs Probabilities in [0, 1]. Default `[0, 0.25, 0.5, 0.75, 1]`. A single number gives a single number.
 * @param options `type` (1 to 9, default 7) and `naRm`.
 *
 * @example
 * ```ts
 * quantile([1, 2, 3, 4, 5, 6], 0.25);              // 2.25 (type 7)
 * quantile([1, 2, 3, 4, 5, 6], 0.25, { type: 9 }); // 1.9375 (jStat's quantiles)
 * ```
 *
 * @category Descriptive statistics
 */
export function quantile(x: Sample, probs: number, options?: QuantileOptions): number;
export function quantile(x: Sample, probs?: readonly number[], options?: QuantileOptions): number[];
export function quantile(
  x: Sample,
  probs: number | readonly number[] = [0, 0.25, 0.5, 0.75, 1],
  options: QuantileOptions = {},
): number | number[] {
  const type = options.type ?? 7;
  if (!(Number.isInteger(type) && type >= 1 && type <= 9)) throw new RangeError("'type' must be an integer in 1..9");
  const xs = values(x, options.naRm);
  if (xs === undefined) throw new RangeError("missing values and NaN's not allowed if 'na.rm' is FALSE");
  const sorted = xs.sort((a, b) => a - b);
  const ps = typeof probs === "number" ? [probs] : Array.from(probs);
  const tol = 100 * Number.EPSILON;
  if (ps.some((p) => p < -tol || p > 1 + tol)) throw new RangeError("'probs' outside [0,1]");
  const out = ps.map((p) => {
    if (Number.isNaN(p) || sorted.length === 0) return NaN;
    return quantileOfSorted(sorted, Math.min(Math.max(p, 0), 1), type);
  });
  return typeof probs === "number" ? out[0]! : out;
}

/**
 * Interquartile range, the difference of the 0.75 and 0.25 quantiles. Equivalent to R's `IQR()`.
 *
 * @example
 * ```ts
 * IQR([1, 2, 3, 4, 5, 6]); // 2.5
 * ```
 *
 * @category Descriptive statistics
 */
export function IQR(x: Sample, options: QuantileOptions = {}): number {
  const [a, b] = quantile(x, [0.25, 0.75], options);
  return b! - a!;
}

/**
 * Tukey's five-number summary (minimum, lower hinge, median, upper hinge, maximum). Equivalent to R's `fivenum()`.
 * `NaN` values are dropped.
 *
 * @example
 * ```ts
 * fivenum([1, 2, 3, 4, 5, 6]); // [1, 2, 3.5, 5, 6]
 * ```
 *
 * @category Descriptive statistics
 */
export function fivenum(x: Sample): [number, number, number, number, number] {
  const s = Array.from(x)
    .filter((v) => !Number.isNaN(v))
    .sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return [NaN, NaN, NaN, NaN, NaN];
  const n4 = Math.floor((n + 3) / 2) / 2;
  const d = [1, n4, (n + 1) / 2, n + 1 - n4, n];
  return d.map((v) => midpoint(s[Math.floor(v) - 1]!, s[Math.ceil(v) - 1]!)) as [number, number, number, number, number];
}

/**
 * Options for {@link mad}.
 *
 * @category Descriptive statistics
 */
export interface MadOptions extends NaRmOptions {
  /** Centre. Default: the median (`NaN` if `x` has a missing value and `naRm` is not set). */
  center?: number;
  /** Scale factor. Default `1.4826` (consistent for the normal standard deviation). */
  constant?: number;
  /**
   * For an even count n, take the lower of the two middle absolute deviations (the "lo-median"): the (n / 2)-th
   * smallest. As in R, n counts the missing values unless `naRm` removed them, the k-th smallest is taken among
   * the deviations that are not missing, and fewer than k of them (or k = 0) is an error. With an odd count the
   * ordinary median is used.
   */
  low?: boolean;
  /** For an even count n, take the higher one (the "hi-median"): the (n / 2 + 1)-th smallest, as for `low`. Both `low` and `high` is an error for an even count. */
  high?: boolean;
}

/**
 * Median absolute deviation, scaled. Equivalent to R's `mad()`.
 *
 * @example
 * ```ts
 * mad([1, 2, 3, 4, 100]);                  // 1.4826
 * mad([1, 2, 3, 4, 100], { constant: 1 }); // 1 (jStat's meddev)
 * ```
 *
 * @category Descriptive statistics
 */
export function mad(x: Sample, options: MadOptions = {}): number {
  // Missing values stay in (and count in n) unless naRm removes them, as in R
  const given = Array.from(x);
  const xs = given.filter((v) => !Number.isNaN(v));
  const all = options.naRm ? xs : given;
  const center = options.center ?? (all.length > xs.length ? NaN : median(xs));
  const constant = options.constant ?? 1.4826;
  const low = options.low ?? false;
  const high = options.high ?? false;
  const dev = all.map((v) => Math.abs(v - center));
  const n = dev.length;
  if ((low || high) && n % 2 === 0) {
    if (low && high) throw new RangeError("'low' and 'high' cannot be both TRUE");
    // The k-th smallest among the deviations that are not missing (R's partial sort drops the missing ones)
    const k = n / 2 + (high ? 1 : 0);
    const s = dev.filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
    if (k === 0 || s.length < k) throw new RangeError(`'partial' index ${k} outside bounds`);
    return constant * s[k - 1]!;
  }
  return constant * median(dev);
}
