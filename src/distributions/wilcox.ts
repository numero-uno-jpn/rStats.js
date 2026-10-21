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

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { discreteQuantile } from "../internal/discrete.js";
import { nonInt, roundHalfEven } from "../internal/integer.js";
import { qnorm } from "./normal.js";

/** Scale 2^STORE_SCALE applied to the coefficients (small enough that the 2^27 factor of Veltkamp splitting does not overflow) */
const STORE_SCALE = 960;
/** Maximum table length (computations needing more throw RangeError; about 800 MB for the three arrays during construction) */
const MAX_LEN = 2 ** 25;

const SPLITTER = 134217729; // 2^27 + 1

interface ProbTable {
  m: number;
  n: number;
  len: number;
  /** P[W = s] × 2^STORE_SCALE */
  prob: Float64Array;
  /** P[W <= s] × 2^STORE_SCALE */
  cum: Float64Array;
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
    }
    // Multiply by (1 - q^{n+i}): in descending order P[j] -= P[j - n - i] (the right side still holds old values)
    const sh = n + i;
    for (let j = top; j >= sh; j--) ddAddInto(H, L, j, j - sh, -1);
    // Divide by (1 - q^i): in ascending order P[j] += P[j - i] (the right side already holds new values)
    for (let j = i; j <= top; j++) ddAddInto(H, L, j, j - i, 1);
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
  return { m, n, len: J + 1, prob: H, cum };
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

/** Table for (m, n) usable for s <= J */
function table(m: number, n: number, J: number): ProbTable {
  if (m > n) [m, n] = [n, m];
  const key = `${m},${n}`;
  const old = cache.get(key);
  if (old !== undefined && old.len > J) {
    cache.delete(key);
    cache.set(key, old);
    return old;
  }
  const half = Math.floor((m * n) / 2);
  // Growing a little at a time would cause repeated rebuilds, so double the size
  const want = Math.min(half, Math.max(J, old === undefined ? 0 : 2 * old.len));
  const t = buildTable(m, n, want);
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

function toProb(v: number, log: boolean): number {
  const p = v * 2 ** -(STORE_SCALE / 2) * 2 ** -(STORE_SCALE / 2);
  if (!log) return p;
  // log(v) - 960 log 2 loses digits since both terms are large, so use log(p) if the probability is a normal number
  return p >= 1e-300 ? Math.log(p) : Math.log(v) - STORE_SCALE * Math.LN2;
}

/** Check and round m, n. undefined if invalid */
function wilcoxParams(m: number, n: number): [number, number] | undefined {
  if (!Number.isFinite(m) || !Number.isFinite(n)) return undefined;
  m = roundHalfEven(m);
  n = roundHalfEven(n);
  return m <= 0 || n <= 0 ? undefined : [m, n];
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
  return toProb(table(m, n, s).prob[s]!, log);
}

/** P[W <= x] (lower) / P[W > x] (0 <= x < mn, x an integer) */
function pwilcoxRaw(x: number, m: number, n: number, lowerTail: boolean, logP: boolean): number {
  const total = m * n;
  // P[W > x] = P[W <= mn - x - 1] (symmetry). Read the smaller tail directly from the table
  const direct = lowerTail ? x : total - x - 1;
  const other = lowerTail ? total - x - 1 : x;
  if (direct <= other) return toProb(table(m, n, direct).cum[direct]!, logP);
  const v = toProb(table(m, n, other).cum[other]!, false);
  return logP ? Math.log1p(-v) : 1 - v;
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
 */
export function qwilcox<T extends Vectorizable>(p: T, m: number, n: number, options: TailOptions = {}): VectorResult<T> {
  const { lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qwilcox1(v, m, n, lowerTail, logP));
}
