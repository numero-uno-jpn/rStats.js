// Distribution of the Wilcoxon signed rank statistic: dsignrank / psignrank / qsignrank.
//
// V = (sum of the ranks with positive sign). Under the null hypothesis each rank 1..n is included independently
// with probability 1/2, so P[V = s] = c_n(s) / 2^n, where c_n(s) is the number of subsets of {1, ..., n} summing
// to s. The coefficients of the generating function Π_{k=1}^{n} (1 + z^k) are obtained by dynamic programming,
// multiplying in one k at a time (only additions of positive numbers, so no cancellation). The distribution is
// symmetric under s ↔ n(n+1)/2 - s, so only the lower half (as far as needed) is computed, and results are cached per n.

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { discreteQuantile } from "../internal/discrete.js";
import { nonInt, roundHalfEven } from "../internal/integer.js";
import { qnorm } from "./normal.js";

/** Threshold at which counts are multiplied by 2^-SCALE_STEP to keep them from growing too large */
const SCALE_LIMIT = 2 ** 900;
const SCALE_STEP = -900;

/**
 * Table of counts for n (s = 0..len-1). Values are c_n(s) × 2^-scale; the cumulative values are Σ_{t<=s},
 * summed with Kahan compensation (same scale).
 */
interface CountTable {
  n: number;
  len: number;
  count: Float64Array;
  cum: Float64Array;
  /** count / cum are the true counts multiplied by 2^-scale */
  scale: number;
  /**
   * Smallest table value of a count at s whose digits the rescaling cannot have touched (see buildTable); for a
   * cumulative count at s the bound is (s + 1) times this. 0 if the table was never rescaled
   */
  minTrusted: number;
}

/**
 * Tables are cached per n (so that quantile searches, or alternating calls with different n, do not rebuild them).
 * When the total number of entries exceeds CACHE_BUDGET, the oldest are evicted (at most 32 MB in two Float64Arrays).
 * The key is n for the main table and -n for the low table of n (tableValue), so both share the budget.
 */
const cache = new Map<number, CountTable>();
const CACHE_BUDGET = 2 ** 21;
let cached = 0;

/** Maximum table length (computations needing more throw RangeError; about 512 MB in two Float64Arrays) */
const MAX_LEN = 2 ** 25;

/**
 * Build the table of counts for s = 0..J (J at most the end of the lower half, floor(n(n+1)/4)).
 *
 * Rescaling by 2^-900 makes the low entries subnormal or 0: each loses up to 2^-1075 (in units of the new scale).
 * What an entry s' holds after element k reaches the final w[s] through the elements k+1..kmax, as many times as
 * there are subsets of them summing to s - s', so the loss reaches w[s] at most 2^(kmax - k) times over. A count at
 * s therefore keeps relative accuracy 2^-60 if c_n(s) >= 2^(S - 1075 + kmax - k + 60) for every rescaling (to scale
 * S after element k); that bound is minTrusted. Being below the smallest normal number is not enough: for n = 2000
 * the entries around s = 95000 lost digits (relative 1e-7) through the entries below them that were lost.
 */
function buildTable(n: number, J: number): CountTable {
  if (J + 1 > MAX_LEN) {
    throw new RangeError(`signrank: n = ${n} needs too large a table (${J + 1} entries)`);
  }
  const w = new Float64Array(J + 1);
  w[0] = 1;
  let scale = 0;
  // log2 of the smallest trusted true count (see above)
  let trustLog2 = -Infinity;
  // Elements k > J do not contribute to sums s <= J
  const kmax = Math.min(n, J);
  for (let k = 1; k <= kmax; k++) {
    // Adding in descending order, w[s - k] still holds the value before k was used
    for (let s = J; s >= k; s--) w[s]! += w[s - k]!;
    // The number of subset sums of {1..k} increases up to the center k(k+1)/4, so the maximum is w[min(J, center)]
    if (w[Math.min(J, Math.floor((k * (k + 1)) / 4))]! > SCALE_LIMIT) {
      const f = 2 ** SCALE_STEP;
      for (let s = 0; s <= J; s++) w[s]! *= f;
      scale -= SCALE_STEP;
      trustLog2 = Math.max(trustLog2, scale - 1015 + kmax - k);
    }
  }
  // Cumulative sum (with Kahan compensation)
  const cum = new Float64Array(J + 1);
  let hi = 0;
  let lo = 0;
  for (let s = 0; s <= J; s++) {
    const y = w[s]! - lo;
    const t = hi + y;
    lo = t - hi - y;
    hi = t;
    cum[s] = hi;
  }
  return { n, len: J + 1, count: w, cum, scale, minTrusted: 2 ** (trustLog2 - scale) };
}

/** Return a table for n usable for s <= J (with low, the low table of n; see lowValue) */
function table(n: number, J: number, low = false): CountTable {
  const key = low ? -n : n;
  const old = cache.get(key);
  if (old !== undefined && old.len > J) {
    // Move to the end as most recently used
    cache.delete(key);
    cache.set(key, old);
    return old;
  }
  const half = Math.floor((n * (n + 1)) / 4);
  // Growing a little at a time would cause repeated rebuilds, so double the size
  const want = Math.min(half, Math.max(J, old === undefined ? 0 : 2 * old.len));
  return store(key, buildTable(n, want), old);
}

/** Put t in the cache under key (replacing old) and evict the oldest tables beyond the budget */
function store(key: number, t: CountTable, old: CountTable | undefined): CountTable {
  if (old !== undefined) {
    cache.delete(key);
    cached -= old.len;
  }
  cache.set(key, t);
  cached += t.len;
  for (const [k, v] of cache) {
    if (cached <= CACHE_BUDGET || k === key) break;
    cache.delete(k);
    cached -= v.len;
  }
  return t;
}

/**
 * The value at s of the count (cum false) or cumulative count (cum true) for n, with the table it is scaled by.
 * A table built far beyond s has been rescaled for its large entries, and its low entries have lost digits (c_n(0) = 1
 * becomes 2^-1800 for n = 2000 and underflows), so a value the bound of buildTable does not cover is read from the
 * low table of n instead, built only as far as needed. A table built up to J = s is exact at s: s is its largest
 * entry, and rescaling keeps the largest entry at least 1 (every count c_n(s) for 0 <= s <= n(n+1)/2 is at least 1).
 */
function tableValue(n: number, s: number, cum: boolean): [number, CountTable] {
  const trusted = (t: CountTable, v: number): boolean =>
    s === t.len - 1 || v >= (cum ? (s + 1) * t.minTrusted : t.minTrusted);
  let t = table(n, s);
  let v = (cum ? t.cum : t.count)[s]!;
  if (trusted(t, v)) return [v, t];
  t = table(n, s, true);
  v = (cum ? t.cum : t.count)[s]!;
  if (trusted(t, v)) return [v, t];
  // The low table (grown by doubling) was rescaled too far for s: rebuild it exactly up to s
  t = store(-n, buildTable(n, s), cache.get(-n));
  return [(cum ? t.cum : t.count)[s]!, t];
}

/** Convert the table value v (scale 2^-scale) to the probability v 2^(scale - n) (underflow only at the final step) */
function toProb(v: number, t: CountTable, log: boolean): number {
  const e = t.scale - t.n;
  const e1 = Math.trunc(e / 2);
  const p = v * 2 ** e1 * 2 ** (e - e1);
  if (!log) return p;
  // log(v) + e log 2 loses digits since both terms are large, so use log(p) if the probability is a normal number
  if (p >= 1e-300) return Math.log(p);
  // Otherwise split v into its significand m in [1, 2) and exponent, so that the result does not depend on the
  // scale of the table (the same count read from tables of different scale gives the same bits)
  let k = Math.floor(Math.log2(v));
  const k1 = Math.trunc(k / 2);
  let m = v * 2 ** -k1 * 2 ** -(k - k1);
  if (m >= 2) {
    m /= 2;
    k++;
  } else if (m < 1) {
    m *= 2;
    k--;
  }
  return Math.log(m) + (k + e) * Math.LN2;
}

/** Check and round n. NaN if invalid */
function signrankN(n: number): number {
  if (!Number.isFinite(n)) return NaN;
  n = roundHalfEven(n);
  return n <= 0 ? NaN : n;
}

export function dsignrank1(x: number, n: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(n)) return NaN;
  n = signrankN(n);
  if (Number.isNaN(n)) return NaN;
  if (nonInt(x)) return d0(log);
  x = roundHalfEven(x);
  const total = (n * (n + 1)) / 2;
  if (x < 0 || x > total) return d0(log);
  const s = Math.min(x, total - x);
  const [v, t] = tableValue(n, s, false);
  return toProb(v, t, log);
}

/** P[V <= x] (lower) / P[V > x] (0 <= x < total, x an integer) */
function psignrankRaw(x: number, n: number, lowerTail: boolean, logP: boolean): number {
  const total = (n * (n + 1)) / 2;
  // P[V > x] = P[V >= x + 1] = P[V <= total - x - 1] (symmetry)
  const lowerIdx = x;
  const upperIdx = total - x - 1;
  // Read the smaller tail directly from the table; the other is 1 - (that)
  const direct = lowerTail ? lowerIdx : upperIdx;
  const other = lowerTail ? upperIdx : lowerIdx;
  if (direct <= other) {
    const [c, t] = tableValue(n, direct, true);
    return toProb(c, t, logP);
  }
  const [c, t] = tableValue(n, other, true);
  const v = toProb(c, t, false);
  return logP ? Math.log1p(-v) : 1 - v;
}

export function psignrank1(q: number, n: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(n)) return NaN;
  n = signrankN(n);
  if (Number.isNaN(n)) return NaN;
  // R rounds q + 1e-7 to the nearest integer (psignrank(3.6, 5) is P[V <= 4])
  const x = roundHalfEven(q + 1e-7);
  const total = (n * (n + 1)) / 2;
  if (x < 0) return dt0(lowerTail, logP);
  if (x >= total) return dt1(lowerTail, logP);
  return psignrankRaw(x, n, lowerTail, logP);
}

export function qsignrank1(p: number, n: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(n)) return NaN;
  n = signrankN(n);
  if (Number.isNaN(n)) return NaN;
  const total = (n * (n + 1)) / 2;
  const b = quantileBoundaries(p, 0, total, lowerTail, logP);
  if (b !== undefined) return b;
  const mu = total / 2;
  const sigma = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24);
  const y0 = mu + sigma * qnorm(p, { lowerTail, logP });
  return discreteQuantile({
    p,
    lowerTail,
    logP,
    cdf: (y, l, lg) => (y < 0 ? dt0(l, lg) : y >= total ? dt1(l, lg) : psignrankRaw(y, n, l, lg)),
    y0: Number.isFinite(y0) ? y0 : mu,
    lo: 0,
    hi: total,
  });
}

/**
 * Probability mass function of the distribution of the Wilcoxon signed rank statistic. Equivalent to R's `dsignrank(x, n, log = FALSE)`.
 *
 * @throws RangeError if `n` is so large that the required table cannot be allocated.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param n - Number of observations.
 * @param options - `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * dsignrank(5, 10);        // 0.0029296875
 * dsignrank([0, 1, 2], 4); // [0.0625, 0.0625, 0.0625]
 * ```
 *
 * @category Distributions
 */
export function dsignrank<T extends Vectorizable>(x: T, n: number, options: DensityOptions = {}): VectorResult<T> {
  const log = options.log ?? false;
  return vectorize(x, (v) => dsignrank1(v, n, log));
}

/**
 * Distribution function of the distribution of the Wilcoxon signed rank statistic. Equivalent to R's `psignrank(q, n, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @throws RangeError if `n` is so large that the required table cannot be allocated.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param n - Number of observations.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * psignrank(10, 10);                        // 0.0419921875
 * psignrank(40, 10, { lowerTail: false });  // 0.0966796875
 * ```
 *
 * @category Distributions
 */
export function psignrank<T extends Vectorizable>(q: T, n: number, options: TailOptions = {}): VectorResult<T> {
  const { lowerTail = true, logP = false } = options;
  return vectorize(q, (v) => psignrank1(v, n, lowerTail, logP));
}

/**
 * Quantile function of the distribution of the Wilcoxon signed rank statistic. Equivalent to R's `qsignrank(p, n, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @throws RangeError if `n` is so large that the required table cannot be allocated.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param n - Number of observations.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qsignrank(0.025, 10);         // 9
 * qsignrank([0.25, 0.75], 10);  // [21, 34]
 * ```
 *
 * @category Distributions
 */
export function qsignrank<T extends Vectorizable>(p: T, n: number, options: TailOptions = {}): VectorResult<T> {
  const { lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qsignrank1(v, n, lowerTail, logP));
}
