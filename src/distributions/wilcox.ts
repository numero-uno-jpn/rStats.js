// Distribution of the Wilcoxon rank sum statistic (Mann-Whitney U): dwilcox / pwilcox / qwilcox.
//
// W = #{(i, j): y_j < x_i} (0..mn). Under the null hypothesis, P[W = s] is the coefficient of q^s in the
// q-binomial coefficient
//   [m + n, m]_q = Π_{i=1}^{m} (1 - q^{n+i}) / (1 - q^i)
// divided by C(m + n, m). Following Harding (1984) "An efficient, minimal-storage procedure for calculating
// the Mann-Whitney U, generalized U and similar distributions" (Applied Statistics 33, 1-6), for i = 1..m
// multiply by (1 - q^{n+i}) and divide by (1 - q^i) on the coefficient array. The division becomes a cumulative
// sum that adds the coefficient i positions earlier. Written from the formulas in the paper.
//
// R's method (building a 3-D table of counts recursively) needs memory of about m n × (mn/2) and fails at
// m = n = 500. Here memory is proportional to the range of s (at most mn/2) and the work is min(m, n) × (range of s).
//
// The method involves subtraction, so in double precision the relative error near the center reaches 1e-13 at
// m = n = 150. The coefficients are kept in double-double (within 2.2e-16 relative of exact BigInt values up to
// m = n = 300). Each step multiplies by i / (n + i) to stay on the probability scale (no division by
// C(m+n, m) needed), and everything is scaled by 2^960 (so tail probabilities below 1e-308 are less likely to underflow).
// Where the largest entry of a pass falls below 2^760 (tables of the lower tail only, for large m and n), the table is
// multiplied by 2^200 (exact) and its scale kept, as for signrank: P[W = 0] = 1 / C(2100, 1050), about 1e-630,
// underflowed at the fixed scale (dwilcox(0, 1050, 1050, log = TRUE) was -Inf).

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { discreteQuantile } from "../internal/discrete.js";
import { nonInt, roundHalfEven } from "../internal/integer.js";
import { qnorm } from "./normal.js";

/** Scale 2^STORE_SCALE applied to the coefficients (small enough that the 2^27 factor of Veltkamp splitting does not overflow) */
const STORE_SCALE = 960;
/** Maximum table length (computations needing more throw RangeError; about 800 MB for the three arrays during construction) */
const MAX_LEN = 2 ** 25;

/** Where the largest entry of a pass falls below RESCALE_BELOW, the table is multiplied by 2^RESCALE_STEP */
const RESCALE_BELOW = 2 ** 760;
const RESCALE_STEP = 200;
/** An entry below this has lost digits (its low part, 2^-53 of it, is below the smallest normal number) */
const LOST_BELOW = 2 ** -969;

const SPLITTER = 134217729; // 2^27 + 1

interface ProbTable {
  m: number;
  n: number;
  len: number;
  /** P[W = s] × 2^scale */
  prob: Float64Array;
  /** P[W <= s] × 2^scale */
  cum: Float64Array;
  scale: number;
  /**
   * Smallest table value of a probability at s that the entries which lost digits (below LOST_BELOW) in the passes
   * cannot have touched; for a cumulative probability the bound is (s + 1) times this. 0 if no entry lost digits
   */
  minTrusted: number;
}

/**
 * Tables are cached per (m, n). When the total number of entries exceeds CACHE_BUDGET, the oldest are evicted
 * (at most 32 MB in two Float64Arrays).
 */
const cache = new Map<string, ProbTable>();
const CACHE_BUDGET = 2 ** 21;
let cached = 0;

/** Table of probabilities for s = 0..J (m <= n, J <= floor(mn/2)) */
function buildTable(m: number, n: number, J: number): ProbTable {
  if (J + 1 > MAX_LEN) {
    throw new RangeError(`wilcox: m = ${m}, n = ${n} needs too large a table (${J + 1} entries)`);
  }
  const H = new Float64Array(J + 1);
  const L = new Float64Array(J + 1);
  H[0] = 2 ** STORE_SCALE;
  let scale = STORE_SCALE;
  // scale at the first pass where an entry lost digits
  let lossScale = NaN;
  for (let i = 1; i <= m; i++) {
    const top = Math.min(J, i * n);
    // Multiply by i / (n + i) (double-double; i is an integer, so the product splits exactly)
    const d = n + i;
    let t = SPLITTER * i;
    const ih = t - (t - i);
    const il = i - ih;
    t = SPLITTER * d;
    const dh = t - (t - d);
    const dl = d - dh;
    for (let j = 0; j <= top; j++) {
      const a = H[j]!;
      if (a === 0) continue;
      // (a + L[j]) × i
      const ph = a * i;
      t = SPLITTER * a;
      const ah = t - (t - a);
      const al = a - ah;
      const pl = ah * ih - ph + ah * il + al * ih + al * il + L[j]! * i;
      // / d
      const q1 = ph / d;
      const qd = q1 * d;
      t = SPLITTER * q1;
      const qh = t - (t - q1);
      const ql = q1 - qh;
      const qe = qh * dh - qd + qh * dl + ql * dh + ql * dl;
      const q2 = (ph - qd - qe + pl) / d;
      const s = q1 + q2;
      L[j] = q2 - (s - q1);
      H[j] = s;
      if (Math.abs(s) < LOST_BELOW && Number.isNaN(lossScale)) lossScale = scale;
    }
    // Multiply by (1 - q^{n+i}): in descending order P[j] -= P[j - n - i] (the right side still holds old values)
    const sh = n + i;
    for (let j = top; j >= sh; j--) ddAddInto(H, L, j, j - sh, -1);
    // Divide by (1 - q^i): in ascending order P[j] += P[j - i] (the right side already holds new values)
    for (let j = i; j <= top; j++) ddAddInto(H, L, j, j - i, 1);
    // The coefficients of a pass are unimodal: keep the largest within range (exact powers of 2)
    const center = Math.min(top, Math.floor((i * n) / 2));
    while (H[center]! > 0 && H[center]! < RESCALE_BELOW) {
      const f = 2 ** RESCALE_STEP;
      for (let j = 0; j <= top; j++) {
        H[j]! *= f;
        L[j]! *= f;
      }
      scale += RESCALE_STEP;
    }
  }
  const cum = new Float64Array(J + 1);
  let ch = 0;
  let cl = 0;
  for (let j = 0; j <= J; j++) {
    // (ch, cl) += (H[j], L[j])
    const a = H[j]!;
    const s = ch + a;
    const bb = s - ch;
    let e = ch - (s - bb) + (a - bb);
    e += cl + L[j]!;
    ch = s + e;
    cl = e - (ch - s);
    cum[j] = ch;
  }
  // The loss of an entry (below 2^-1022 absolute, at the scale of its pass) is propagated by the later passes, which
  // amplify relative errors by up to about 2^53 (the accuracy of the double-double table); 2^60 more for a margin
  const minTrusted = Number.isNaN(lossScale)
    ? 0
    : 2 ** Math.min(1023, -1022 + 113 + Math.ceil(Math.log2(m * (J + 1))) + scale - lossScale);
  return { m, n, len: J + 1, prob: H, cum, scale, minTrusted };
}

/** (H[j], L[j]) += sign × (H[k], L[k]) */
function ddAddInto(H: Float64Array, L: Float64Array, j: number, k: number, sign: number): void {
  const a = H[j]!;
  const b = sign * H[k]!;
  const s = a + b;
  const bb = s - a;
  let e = a - (s - bb) + (b - bb);
  e += L[j]! + sign * L[k]!;
  const r = s + e;
  L[j] = e - (r - s);
  H[j] = r;
}

/** Table for (m, n) (m <= n) usable for s <= J; with low, the low table (see tableValue) */
function table(m: number, n: number, J: number, low = false): ProbTable {
  const key = `${m},${n}${low ? ",low" : ""}`;
  const old = cache.get(key);
  if (old !== undefined && old.len > J) {
    cache.delete(key);
    cache.set(key, old);
    return old;
  }
  const half = Math.floor((m * n) / 2);
  // Growing a little at a time would cause repeated rebuilds, so double the size
  const want = Math.min(half, Math.max(J, old === undefined ? 0 : 2 * old.len));
  return store(key, buildTable(m, n, want), old);
}

/** Put t in the cache under key (replacing old) and evict the oldest tables beyond the budget */
function store(key: string, t: ProbTable, old: ProbTable | undefined): ProbTable {
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
 * The probability (cum false) or cumulative probability (cum true) at s for (m, n), as a table value with its table.
 * A table built far beyond s may have lost the digits of its low entries (it was rescaled for its large ones), so a
 * value outside the bound of buildTable is read from the low table of (m, n) instead, built only as far as needed,
 * and failing that from a table rebuilt up to s: its last entry is the largest of the last pass.
 */
function tableValue(m: number, n: number, s: number, cum: boolean): [number, ProbTable] {
  if (m > n) [m, n] = [n, m];
  const read = (t: ProbTable): number => (cum ? t.cum : t.prob)[s]!;
  const trusted = (t: ProbTable, v: number): boolean =>
    s === t.len - 1 || v >= (cum ? (s + 1) * t.minTrusted : t.minTrusted);
  let t = table(m, n, s);
  let v = read(t);
  if (trusted(t, v)) return [v, t];
  t = table(m, n, s, true);
  v = read(t);
  if (trusted(t, v)) return [v, t];
  const key = `${m},${n},low`;
  t = store(key, buildTable(m, n, s), cache.get(key));
  return [read(t), t];
}

/** ln 2 in two parts, the first with 32 trailing zero bits (k ln 2 exact in the first part for abs(k) < 2^20) */
const LN2_HI = 6.93147180369123816490e-1;
const LN2_LO = 1.90821492927058770002e-10;

/** The probability v 2^-scale of the table value v (underflow only at the final step) */
function toProb(v: number, t: ProbTable, log: boolean): number {
  const e = -t.scale;
  const e1 = Math.trunc(e / 2);
  const p = v * 2 ** e1 * 2 ** (e - e1);
  if (!log) return p;
  if (p >= 1e-300) return Math.log(p);
  // Otherwise from the significand m in [1, 2) and the exponent k of v: log m + (k + e) log 2, the last in two parts
  // (log(v) - scale log 2 lost digits to the cancellation of large terms), the same bits whatever the table's scale
  let k = Math.floor(Math.log2(v));
  const k1 = Math.trunc(k / 2);
  let mv = v * 2 ** -k1 * 2 ** -(k - k1);
  if (mv >= 2) {
    mv /= 2;
    k++;
  } else if (mv < 1) {
    mv *= 2;
    k--;
  }
  return (k + e) * LN2_HI + (Math.log(mv) + (k + e) * LN2_LO);
}

/** Check and round m, n. undefined if invalid */
function wilcoxParams(m: number, n: number): [number, number] | undefined {
  if (!Number.isFinite(m) || !Number.isFinite(n)) return undefined;
  m = roundHalfEven(m);
  n = roundHalfEven(n);
  // The statistic ranges over 0..mn: beyond 2^53 its values are not all doubles (NaN, as other integer supports past
  // 2^53). This also bounds the smaller of m and n by 2^26.5, the number of passes of the table (dwilcox(0, 1e12,
  // 1e12) ran 1e12 of them for a table of one entry)
  return m <= 0 || n <= 0 || m * n > 2 ** 53 ? undefined : [m, n];
}

export function dwilcox1(x: number, m: number, n: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(m) || Number.isNaN(n)) return NaN;
  const params = wilcoxParams(m, n);
  if (params === undefined) return NaN;
  [m, n] = params;
  if (nonInt(x)) return d0(log);
  x = roundHalfEven(x);
  const total = m * n;
  if (x < 0 || x > total) return d0(log);
  const s = Math.min(x, total - x);
  const [v, t] = tableValue(m, n, s, false);
  return toProb(v, t, log);
}

/** P[W <= x] (lower) / P[W > x] (0 <= x < mn, x an integer) */
function pwilcoxRaw(x: number, m: number, n: number, lowerTail: boolean, logP: boolean): number {
  const total = m * n;
  // P[W > x] = P[W <= mn - x - 1] (symmetry). Read the smaller tail directly from the table
  const direct = lowerTail ? x : total - x - 1;
  const other = lowerTail ? total - x - 1 : x;
  if (direct <= other) {
    const [v, t] = tableValue(m, n, direct, true);
    return toProb(v, t, logP);
  }
  const [v, t] = tableValue(m, n, other, true);
  const p = toProb(v, t, false);
  return logP ? Math.log1p(-p) : 1 - p;
}

export function pwilcox1(q: number, m: number, n: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(m) || Number.isNaN(n)) return NaN;
  const params = wilcoxParams(m, n);
  if (params === undefined) return NaN;
  [m, n] = params;
  const x = Math.floor(q + 1e-7);
  if (x < 0) return dt0(lowerTail, logP);
  if (x >= m * n) return dt1(lowerTail, logP);
  return pwilcoxRaw(x, m, n, lowerTail, logP);
}

export function qwilcox1(p: number, m: number, n: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(m) || Number.isNaN(n)) return NaN;
  const params = wilcoxParams(m, n);
  if (params === undefined) return NaN;
  [m, n] = params;
  const total = m * n;
  const b = quantileBoundaries(p, 0, total, lowerTail, logP);
  if (b !== undefined) return b;
  const mu = total / 2;
  const sigma = Math.sqrt((total * (m + n + 1)) / 12);
  const y0 = mu + sigma * qnorm(p, { lowerTail, logP });
  return discreteQuantile({
    p,
    lowerTail,
    logP,
    cdf: (y, l, lg) => (y < 0 ? dt0(l, lg) : y >= total ? dt1(l, lg) : pwilcoxRaw(y, m, n, l, lg)),
    y0: Number.isFinite(y0) ? y0 : mu,
    lo: 0,
    hi: total,
  });
}

/**
 * Probability mass function of the distribution of the Wilcoxon rank sum statistic (Mann-Whitney U). Equivalent to R's `dwilcox(x, m, n, log = FALSE)`.
 *
 * Unlike R, memory use grows only with the range of the statistic (at most `m * n / 2`), so large samples such as `m = n = 500` work.
 *
 * @throws RangeError if `m` and `n` are so large that the required table cannot be allocated.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param m - Size of the first sample.
 * @param n - Size of the second sample.
 * @param options - `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * dwilcox(5, 4, 6);        // 0.02857142857142857
 * dwilcox([0, 1, 2], 3, 4); // [0.02857142857142857, 0.02857142857142857, 0.05714285714285714]
 * ```
 *
 * @category Distributions
 */
export function dwilcox<T extends Vectorizable>(x: T, m: number, n: number, options: DensityOptions = {}): VectorResult<T> {
  const log = options.log ?? false;
  return vectorize(x, (v) => dwilcox1(v, m, n, log));
}

/**
 * Distribution function of the distribution of the Wilcoxon rank sum statistic (Mann-Whitney U). Equivalent to R's `pwilcox(q, m, n, lower.tail = TRUE, log.p = FALSE)`.
 *
 * Unlike R, memory use grows only with the range of the statistic (at most `m * n / 2`), so large samples such as `m = n = 500` work.
 *
 * @throws RangeError if `m` and `n` are so large that the required table cannot be allocated.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param m - Size of the first sample.
 * @param n - Size of the second sample.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pwilcox(5, 4, 6);                       // 0.08571428571428572
 * pwilcox(18, 4, 6, { lowerTail: false }); // 0.08571428571428572
 * ```
 *
 * @category Distributions
 */
export function pwilcox<T extends Vectorizable>(q: T, m: number, n: number, options: TailOptions = {}): VectorResult<T> {
  const { lowerTail = true, logP = false } = options;
  return vectorize(q, (v) => pwilcox1(v, m, n, lowerTail, logP));
}

/**
 * Quantile function of the distribution of the Wilcoxon rank sum statistic (Mann-Whitney U). Equivalent to R's `qwilcox(p, m, n, lower.tail = TRUE, log.p = FALSE)`.
 *
 * Unlike R, memory use grows only with the range of the statistic (at most `m * n / 2`), so large samples such as `m = n = 500` work.
 *
 * @throws RangeError if `m` and `n` are so large that the required table cannot be allocated.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param m - Size of the first sample.
 * @param n - Size of the second sample.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qwilcox(0.025, 4, 6);         // 3
 * qwilcox([0.25, 0.75], 4, 6);  // [9, 15]
 * ```
 *
 * @category Distributions
 */
export function qwilcox<T extends Vectorizable>(p: T, m: number, n: number, options: TailOptions = {}): VectorResult<T> {
  const { lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qwilcox1(v, m, n, lowerTail, logP));
}
