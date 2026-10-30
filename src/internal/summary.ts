// Summary statistics used by the tests (mean, variance, covariance, ranks).
//
// R's mean and var accumulate sums in extended precision. Here sums are taken in double-double (src/special/dd.ts)
// and rounded to double at the end. The mean divides the first sum by n, then corrects it with the sum of deviations
// (so that rounding errors from adding double values do not remain).
//
// R's long double accumulator has a much wider exponent range than double, so a sum may pass the largest double on
// the way without overflowing; only the result is rounded to double (±Inf beyond the range). Here the double-double
// sum runs unscaled while it stays finite (so its results are unchanged), and once it would overflow it continues on
// the values scaled by a power of 2 (exact) and is scaled back at the end. A mean whose sum overflows a double is the
// mean of the scaled values, scaled back (R averages x[i] / n in that case, which gives the mean without overflow).

import { ddAdd, ddDivNum, ddMul, ddSub, type DD } from "../special/dd.js";

/**
 * Running sum of finite values in double-double that does not overflow: its value is (s[0] + s[1]) 2^shift. shift
 * is 0 until an addition would overflow; from then on the values are added scaled by 2^-shift
 */
export interface WideSum {
  s: DD;
  shift: number;
}

export function wideSum(): WideSum {
  return { s: [0, 0], shift: 0 };
}

/**
 * Power of 2 by which the sums of n finite values are scaled once they overflow: the scaled sum stays below 2^992,
 * so that it can also be divided in double-double (whose splitting overflows above about 2^996). Values below
 * 2^(shift - 1022) lose bits when scaled, which cannot matter next to a sum beyond the double range
 */
function overflowShift(n: number): number {
  return 32 + Math.ceil(Math.log2(Math.max(n, 1)));
}

/** Adds the finite value v to acc; n is the number of values the sum will have in all */
export function wideSumAdd(acc: WideSum, v: number, n: number): void {
  if (acc.shift === 0) {
    const t = ddAdd(acc.s, [v, 0]);
    if (Number.isFinite(t[0]) && Number.isFinite(t[1])) {
      acc.s = t;
      return;
    }
    acc.shift = overflowShift(n);
    const f = 2 ** -acc.shift;
    acc.s = [acc.s[0] * f, acc.s[1] * f];
  }
  acc.s = ddAdd(acc.s, [v * 2 ** -acc.shift, 0]);
}

/** The value of the sum rounded to double (±Infinity beyond the range) */
export function wideSumValue(acc: WideSum): number {
  return ldexp(acc.s[0] + acc.s[1], acc.shift);
}

/** v 2^k for an integer k, in two steps so that 2^k itself does not overflow or underflow */
export function ldexp(v: number, k: number): number {
  const a = Math.trunc(k / 2);
  return v * 2 ** a * 2 ** (k - a);
}

/** Sum of values that are not all finite, as in double arithmetic (NaN propagates, Inf and -Inf give NaN) */
function nonFiniteSum(x: readonly number[]): number {
  let s = 0;
  for (const v of x) if (!Number.isFinite(v)) s += v;
  return s;
}

/** Mean as double-double. x contains no NaN and has length >= 1 */
export function meanDD(x: readonly number[]): DD {
  const n = x.length;
  // With Inf present the double-double sum becomes NaN; the mean is the (infinite or NaN) sum divided by n
  if (!x.every(Number.isFinite)) return [nonFiniteSum(x) / n, 0];
  const acc = wideSum();
  for (const v of x) wideSumAdd(acc, v, n);
  if (acc.shift !== 0) {
    // The sum overflows a double: the mean of the values scaled by a power of 2, scaled back
    const k = overflowShift(n);
    const f = 2 ** -k;
    const m = meanDD(x.map((v) => v * f));
    return [ldexp(m[0], k), ldexp(m[1], k)];
  }
  const s = acc.s;
  const m = ddDivNum(s, n);
  if (!Number.isFinite(m[0])) return [s[0] / n, 0];
  let t: DD = [0, 0];
  for (const v of x) t = ddAdd(t, ddSub([v, 0], m));
  // A deviation v - m beyond the double range (values near both ends of it) leaves the correction infinite: m, the
  // double-double quotient of the exact sum, is kept
  if (!Number.isFinite(t[0])) return m;
  return ddAdd(m, ddDivNum(t, n));
}

export function mean(x: readonly number[]): number {
  return x.length === 0 ? NaN : meanDD(x)[0];
}

/** Unbiased variance. NaN for length below 2 (R's var gives NA) */
export function variance(x: readonly number[]): number {
  return covariance(x, x);
}

/** Unbiased covariance. x and y have the same length and contain no NaN */
export function covariance(x: readonly number[], y: readonly number[]): number {
  const n = x.length;
  if (n < 2) return NaN;
  const mx = meanDD(x);
  const my = x === y ? mx : meanDD(y);
  if (!Number.isFinite(mx[0]) || !Number.isFinite(my[0])) return NaN;
  // Scale the deviations by a power of 2 to be near 1 before multiplying (so products of values around 1e200 do not
  // overflow and products around 1e-200 do not underflow to 0; powers of 2 add no rounding error)
  const dx = x.map((v) => ddSub([v, 0], mx));
  const dy = x === y ? dx : y.map((v) => ddSub([v, 0], my));
  const kx = scaleExponent(dx);
  const ky = x === y ? kx : scaleExponent(dy);
  const fx = 2 ** -kx;
  const fy = 2 ** -ky;
  let s: DD = [0, 0];
  for (let i = 0; i < n; i++) {
    const a: DD = [dx[i]![0] * fx, dx[i]![1] * fx];
    const b: DD = [dy[i]![0] * fy, dy[i]![1] * fy];
    s = ddAdd(s, ddMul(a, b));
  }
  const v = ddDivNum(s, n - 1)[0];
  // Multiply by 2^(kx + ky) at once: multiplying by 2^kx first could overflow (or underflow) where 2^ky would bring
  // it back, and cov(x, y) would then differ from cov(y, x)
  return ldexp(v, kx + ky);
}

/**
 * Satterthwaite's degrees of freedom (sum w)^2 / sum(w^2 / df) of a sum of independent variance estimates w with
 * degrees of freedom df. The w are scaled by a power of 2 first (no rounding), so the squares neither overflow nor
 * underflow when the w do not; the ratio does not depend on the units of the data
 */
export function satterthwaiteDf(w: readonly number[], df: readonly number[]): number {
  let m = 0;
  for (const v of w) m = Math.max(m, Math.abs(v));
  const k = m === 0 || !Number.isFinite(m) ? 0 : Math.floor(Math.log2(m));
  let num = 0;
  let den = 0;
  for (let i = 0; i < w.length; i++) {
    const a = ldexp(w[i]!, -k);
    num += a;
    den += (a * a) / df[i]!;
  }
  return (num * num) / den;
}

/** Binary exponent of the largest absolute deviation (0 if it is 0) */
function scaleExponent(d: readonly DD[]): number {
  let m = 0;
  for (const v of d) m = Math.max(m, Math.abs(v[0]));
  return m === 0 || !Number.isFinite(m) ? 0 : Math.max(-1022, Math.floor(Math.log2(m)));
}

/**
 * Sum (accumulated in double-double without overflow, then rounded; ±Infinity beyond the double range). With
 * infinite or NaN values, as in double arithmetic
 */
export function sum(x: readonly number[]): number {
  if (!x.every(Number.isFinite)) return nonFiniteSum(x);
  const acc = wideSum();
  for (const v of x) wideSumAdd(acc, v, x.length);
  return wideSumValue(acc);
}

/**
 * Ranks (ties get the average rank, R's rank(ties.method = "average")). x contains no NaN.
 * Equality is decided by exact comparison
 */
export function rank(x: readonly number[]): number[] {
  const n = x.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => x[a]! - x[b]! || a - b);
  const r = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && x[idx[j + 1]!] === x[idx[i]!]) j++;
    const avg = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) r[idx[k]!] = avg;
    i = j + 1;
  }
  return r;
}

/** Size of each group of ties (only those of size 2 or more). x contains no NaN */
export function tieCounts(x: readonly number[]): number[] {
  const s = [...x].sort((a, b) => a - b);
  const out: number[] = [];
  let i = 0;
  while (i < s.length) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[i]) j++;
    if (j > i) out.push(j - i + 1);
    i = j + 1;
  }
  return out;
}

/** Array with NaN removed (R's x[!is.na(x)]) */
export function dropNaN(x: readonly number[]): number[] {
  return x.filter((v) => !Number.isNaN(v));
}

/** Keep only the pairs where neither x nor y is NaN (R's complete.cases) */
export function completePairs(x: readonly number[], y: readonly number[]): [number[], number[]] {
  if (x.length !== y.length) throw new TypeError("x and y must have the same length");
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < x.length; i++) {
    if (!Number.isNaN(x[i]!) && !Number.isNaN(y[i]!)) {
      a.push(x[i]!);
      b.push(y[i]!);
    }
  }
  return [a, b];
}

const MIN_NORMAL = 2 ** -1022;

/**
 * d^2 / e, as for a Pearson chi-squared term. When d^2 overflows (or loses precision below the normal range) although
 * the quotient is representable, it is formed as (d / sqrt(e))^2 instead
 */
export function squareOver(d: number, e: number): number {
  const d2 = d * d;
  if (d2 < Infinity && (d2 >= MIN_NORMAL || d === 0)) return d2 / e;
  const z = d / Math.sqrt(e);
  return z * z;
}

/** a b / n, as for an expected count from two margins; divides first when the product overflows or underflows */
export function productOver(a: number, b: number, n: number): number {
  const ab = a * b;
  return ab < Infinity && (ab >= MIN_NORMAL || ab === 0) ? ab / n : (a / n) * b;
}

/**
 * Data scaled by a power of 2, 2^-k, so that the largest finite absolute value is in [1, 2) (k = 0 when there is
 * none). The scaling adds no rounding error, so statistics that do not depend on the units (t, F, chi-squared,
 * ratios of variances, degrees of freedom) come out as from the original data, but their squares and variances
 * can no longer overflow or underflow. Quantities with units are multiplied back by 2^k (see ldexp)
 */
export function scaleToUnit(groups: readonly (readonly number[])[]): { groups: number[][]; k: number } {
  let m = 0;
  for (const g of groups) for (const v of g) if (Number.isFinite(v)) m = Math.max(m, Math.abs(v));
  const k = m === 0 ? 0 : Math.floor(Math.log2(m));
  return { groups: groups.map((g) => (k === 0 ? Array.from(g) : g.map((v) => ldexp(v, -k)))), k };
}
