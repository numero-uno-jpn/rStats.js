// Sample quantiles and robust summaries: R's quantile (types 1 to 9), IQR, fivenum and mad.
//
// Written for rStats.js from Hyndman and Fan, "Sample quantiles in statistical packages", The American Statistician
// 50, 1996 (the nine definitions R implements; no ported code), with R's conventions where it fixes details: type 7
// is 1 + (n - 1) p, interpolated only when the neighbouring order statistics differ (so that Inf does not become
// NaN); the other types index with floor(np (1 + 4 eps)), so that p = k/n is not missed by rounding, and treat
// |h| < 4 eps as 0. fivenum is Tukey's (the hinges of R's fivenum); mad scales by 1.4826 by default.

import { median, values, type NaRmOptions } from "./basic.js";
import type { Sample } from "../htest/types.js";

/** Options for {@link quantile}. */
export interface QuantileOptions extends NaRmOptions {
  /** Hyndman and Fan's definition, 1 to 9. Default `7`. */
  type?: number;
}

const EPS = Number.EPSILON;

/** Quantiles of an ascending array without NaN, for probabilities in [0, 1] (NaN for NaN) */
function quantileSorted(s: readonly number[], probs: readonly number[], type: number): number[] {
  const n = s.length;
  if (n === 0) return probs.map(() => NaN);
  const fuzz = type === 7 ? 0 : 4 * EPS;
  const floorF = (v: number): number => Math.floor(v * (1 + fuzz));
  // order statistic j (1-based), extended by x_0 = x_1 and x_(n+1) = x_n
  const at = (j: number): number => s[Math.min(Math.max(j, 1), n) - 1]!;
  return probs.map((p) => {
    if (Number.isNaN(p)) return p;
    if (type === 7) {
      const index = 1 + (n - 1) * p;
      const lo = Math.floor(index);
      const hi = Math.ceil(index);
      const q = s[lo - 1]!;
      if (index > lo && s[hi - 1] !== q) {
        const h = index - lo;
        return (1 - h) * q + h * s[hi - 1]!;
      }
      return q;
    }
    let j: number;
    let h: number;
    if (type <= 3) {
      const nppm = type === 3 ? n * p - 0.5 : n * p;
      j = floorF(nppm);
      if (type === 1) h = nppm > j ? 1 : 0;
      else if (type === 2) h = ((nppm > j ? 1 : 0) + 1) / 2;
      else h = nppm !== j || ((j % 2) + 2) % 2 === 1 ? 1 : 0; // j odd (j may be negative)
    } else {
      const [a, b] = [
        [0, 1],
        [0.5, 0.5],
        [0, 0],
        [1, 1],
        [1 / 3, 1 / 3],
        [3 / 8, 3 / 8],
      ][type - 4]!;
      const nppm = a! + p * (n + 1 - a! - b!);
      j = floorF(nppm);
      h = nppm - j;
      if (Math.abs(h) < fuzz) h = 0;
    }
    const lo = at(j);
    const hi = at(j + 1);
    if (h === 1) return hi;
    if (h > 0 && h < 1 && lo !== hi) return (1 - h) * lo + h * hi;
    return lo;
  });
}

/** Validate and clamp probabilities as R does (allowing an overshoot of 100 eps) */
function checkProbs(probs: readonly number[]): number[] {
  const eps = 100 * EPS;
  if (probs.some((p) => !Number.isNaN(p) && (p < -eps || p > 1 + eps))) throw new RangeError("'probs' outside [0,1]");
  return probs.map((p) => (Number.isNaN(p) ? p : Math.max(0, Math.min(1, p))));
}

function checkType(type: number): void {
  if (!(Number.isInteger(type) && type >= 1 && type <= 9)) throw new RangeError("'type' must be an integer in 1..9");
}

/** The values sorted, NaN dropped when naRm (an error when a NaN remains, as in R's quantile) */
function sortedValues(x: Sample, naRm: boolean | undefined): number[] {
  const xs = values(x, naRm);
  if (xs === undefined) throw new RangeError("missing values and NaN's not allowed if 'na.rm' is FALSE");
  return xs.sort((a, b) => a - b);
}

/**
 * Sample quantiles. Equivalent to R's `quantile()` (with `names = FALSE`).
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
 */
export function quantile(x: Sample, probs: number, options?: QuantileOptions): number;
export function quantile(x: Sample, probs?: readonly number[], options?: QuantileOptions): number[];
export function quantile(
  x: Sample,
  probs: number | readonly number[] = [0, 0.25, 0.5, 0.75, 1],
  options: QuantileOptions = {},
): number | number[] {
  const type = options.type ?? 7;
  checkType(type);
  const s = sortedValues(x, options.naRm);
  const ps = checkProbs(typeof probs === "number" ? [probs] : Array.from(probs));
  const q = quantileSorted(s, ps, type);
  return typeof probs === "number" ? q[0]! : q;
}

/** Interquartile range, the difference of the 0.75 and 0.25 quantiles. Equivalent to R's `IQR()`. */
export function IQR(x: Sample, options: QuantileOptions = {}): number {
  const [a, b] = quantile(x, [0.25, 0.75], options);
  return b! - a!;
}

/**
 * Tukey's five-number summary (minimum, lower hinge, median, upper hinge, maximum). Equivalent to R's `fivenum()`;
 * `NaN` values are dropped.
 */
export function fivenum(x: Sample): [number, number, number, number, number] {
  const s = Array.from(x)
    .filter((v) => !Number.isNaN(v))
    .sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return [NaN, NaN, NaN, NaN, NaN];
  const n4 = Math.floor((n + 3) / 2) / 2;
  const d = [1, n4, (n + 1) / 2, n + 1 - n4, n];
  return d.map((v) => 0.5 * (s[Math.floor(v) - 1]! + s[Math.ceil(v) - 1]!)) as [number, number, number, number, number];
}

/** Options for {@link mad}. */
export interface MadOptions extends NaRmOptions {
  /** Centre. Default: the median. */
  center?: number;
  /** Scale factor. Default `1.4826` (consistent for the normal standard deviation). */
  constant?: number;
  /** For an even count, take the lower of the two middle absolute deviations (the "lo-median"). */
  low?: boolean;
  /** For an even count, take the higher one (the "hi-median"). */
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
 */
export function mad(x: Sample, options: MadOptions = {}): number {
  const xs = values(x, options.naRm);
  if (xs === undefined) return NaN;
  const center = options.center ?? median(xs);
  const constant = options.constant ?? 1.4826;
  const low = options.low ?? false;
  const high = options.high ?? false;
  const dev = xs.map((v) => Math.abs(v - center));
  const n = dev.length;
  if ((low || high) && n % 2 === 0) {
    if (low && high) throw new RangeError("'low' and 'high' cannot be both TRUE");
    const k = n / 2 + (high ? 1 : 0);
    const s = dev.sort((a, b) => a - b);
    return constant * s[k - 1]!;
  }
  return constant * median(dev);
}
