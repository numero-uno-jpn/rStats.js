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
//
// Moments (deviations, variances, covariances, sums of squares) follow these rules, so that no statistic depends on
// the units of the data:
// 1. Scale first, centre afterwards: the data are divided by a power of 2, 2^-k, that brings the largest absolute
//    value into [1, 2) (exact), and the mean, deviations and cross-products are computed on the scaled values. A
//    deviation x - mean can then neither overflow (values near both ends of the range) nor underflow.
// 2. Quantities without units (t, F, chi-squared, correlations, effect sizes, ratios, degrees of freedom, p-values)
//    are computed in the scaled coordinates.
// 3. Quantities with units are scaled back only for output: means, differences, standard errors and intervals by
//    2^k, sums of squares and variances by 2^2k (ldexp). Nothing without units is computed from scaled-back values.
// 4. In the ordinary range the results are those of the unscaled formulas (scaling by a power of 2 changes no bit).
//    See centered, groupMoments, pairedDifferences, standardize and scaleToUnit.

import { ddAdd, ddDivNum, ddMul, ddSub, type DD } from "../special/dd.js";
import { isDoubleDouble } from "../special/dd.js";
import { roundScaled, splitDouble } from "../linalg/dot.js";

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
 * 2^(shift - 1022) lose bits when scaled, which matters only where the large values later cancel (sum() bounds such
 * losses and then sums exactly, #374)
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

/** v 2^k for any integer k (beyond the +-2046 of ldexp), in steps of at most 2^1000 */
export function ldexpWide(v: number, k: number): number {
  let x = v;
  let r = k;
  while (r > 1000) {
    x *= 2 ** 1000;
    r -= 1000;
  }
  while (r < -1000) {
    x *= 2 ** -1000;
    r += 1000;
  }
  return x * 2 ** r;
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

/**
 * Sample standard deviation from the scaled deviations: sqrt(sum d^2 / (n - 1)) in the coordinates 2^-k, times 2^k.
 * The same bits as sqrt(variance(x)) where the variance is a normal number (the square root of 4^k y is 2^k sqrt(y)),
 * and the right value where it overflows or underflows (sd of c(-1e308, -1e308, -1e308, -1e308, 1.5e308) is 1.118e308
 * while its variance is 1.25e616). x contains no NaN
 */
export function standardDeviation(x: readonly number[]): number {
  const n = x.length;
  if (n < 2) return NaN;
  const c = centered(x);
  if (c === undefined) return NaN;
  return ldexp(Math.sqrt(ddDivNum(crossSum(c.d, c.d), n - 1)[0]), c.k);
}

/** Unbiased covariance. x and y have the same length and contain no NaN */
export function covariance(x: readonly number[], y: readonly number[]): number {
  const n = x.length;
  if (n < 2) return NaN;
  const cx = centered(x);
  const cy = x === y ? cx : centered(y);
  if (cx === undefined || cy === undefined) return NaN;
  const s = crossSum(cx.d, cy.d);
  // Scaled back by 2^(kx + ky) at once: by 2^kx first could overflow (or underflow) where 2^ky would bring it back,
  // and cov(x, y) would then differ from cov(y, x)
  return ldexp(ddDivNum(s, n - 1)[0], cx.k + cy.k);
}

/** Binary exponent k that brings the largest finite absolute value into [1, 2) (0 when there is none) */
function unitExponent(groups: readonly (readonly number[])[]): number {
  let m = 0;
  for (const g of groups) for (const v of g) if (Number.isFinite(v)) m = Math.max(m, Math.abs(v));
  return m === 0 ? 0 : Math.floor(Math.log2(m));
}

/** sum a[i] b[i] in double-double */
function crossSum(a: readonly DD[], b: readonly DD[]): DD {
  let s: DD = [0, 0];
  for (let i = 0; i < a.length; i++) s = ddAdd(s, ddMul(a[i]!, b[i]!));
  return s;
}

/**
 * The deviations from the mean of x scaled by 2^-k (the scaling first, see the rules above), in double-double, with k
 * and the scaled mean. undefined when x has an infinite value (the mean is not finite)
 */
export function centered(x: readonly number[]): { d: DD[]; k: number; mean: DD } | undefined {
  if (!x.every(Number.isFinite)) return undefined;
  const k = unitExponent([x]);
  const xs = k === 0 ? x : x.map((v) => ldexp(v, -k));
  const mean = meanDD(xs);
  return { d: xs.map((v) => ddSub([v, 0], mean)), k, mean };
}

/**
 * (x - mean) / sd, from the scaled deviations (no overflow or underflow at any scale). NaN values when the standard
 * deviation is 0 or x has fewer than 2 values or an infinite one
 */
export function standardize(x: readonly number[]): number[] {
  const c = x.length < 2 ? undefined : centered(x);
  if (c === undefined) return x.map(() => NaN);
  const sd = Math.sqrt(ddDivNum(crossSum(c.d, c.d), x.length - 1)[0]);
  return c.d.map((v) => (sd > 0 ? v[0] / sd : NaN));
}

/**
 * Moments of groups on one common scale 2^-k (see the rules above): per group the size, mean, within sum of squares
 * and variance (NaN below 2 values), the grand mean, the between and pooled within sums of squares (accumulated in
 * double-double), and the scaled values. Means are scaled back by 2^k, sums of squares and variances by 2^2k
 */
export interface GroupMoments {
  k: number;
  groups: number[][];
  n: number[];
  mean: number[];
  ss: number[];
  variance: number[];
  grandMean: number;
  ssBetween: number;
  ssWithin: number;
}

export function groupMoments(groups: readonly (readonly number[])[]): GroupMoments {
  const { groups: scaled, k } = scaleToUnit(groups);
  const n = scaled.map((g) => g.length);
  const all = scaled.flat();
  const grand = all.length === 0 ? ([NaN, 0] as DD) : meanDD(all);
  const mean: number[] = [];
  const ss: number[] = [];
  const variance: number[] = [];
  let ssb: DD = [0, 0];
  let ssw: DD = [0, 0];
  for (const g of scaled) {
    if (g.length === 0) {
      mean.push(NaN);
      ss.push(NaN);
      variance.push(NaN);
      continue;
    }
    const m = meanDD(g);
    let s: DD = [0, 0];
    for (const v of g) {
      const e = ddSub([v, 0], m);
      s = ddAdd(s, ddMul(e, e));
    }
    const d = ddSub(m, grand);
    ssb = ddAdd(ssb, ddMul(ddMul(d, d), [g.length, 0]));
    ssw = ddAdd(ssw, s);
    mean.push(m[0]);
    ss.push(s[0]);
    // divided in double-double, as variance() does
    variance.push(g.length > 1 ? ddDivNum(s, g.length - 1)[0] : NaN);
  }
  return {
    k,
    groups: scaled,
    n,
    mean,
    ss,
    variance,
    grandMean: grand[0],
    ssBetween: ssb[0],
    ssWithin: ssw[0],
  };
}

/** x - y for paired values, both scaled by one 2^-k first (so the differences cannot overflow), with k */
export function pairedDifferences(x: readonly number[], y: readonly number[]): { d: number[]; k: number } {
  const { groups, k } = scaleToUnit([x, y]);
  const [a, b] = groups as [number[], number[]];
  return { d: a.map((v, i) => v - b[i]!), k };
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


/**
 * Sum (accumulated in double-double without overflow, then rounded; ±Infinity beyond the double range). With
 * infinite or NaN values, as in double arithmetic
 */
export function sum(x: readonly number[]): number {
  if (!x.every(Number.isFinite)) return nonFiniteSum(x);
  if (!isDoubleDouble()) {
    const acc = wideSum();
    for (const v of x) wideSumAdd(acc, v, x.length);
    return wideSumValue(acc);
  }
  // The steps of wideSumAdd (ddAdd of [v, 0]) written out, with a bound on what they lose (#374). The double-double
  // keeps two components, so a third band of magnitudes is rounded away when it is added to the low one: with the
  // bands later cancelling, sum([1e308, 1e100, 1, -1e308, -1e100]) was 0 and sum([1e20, 1e3, 1e-10, -1e20, -1e3])
  // 1.0004e-10. The value is that of wideSumAdd; only where the lost amount could move it across a rounding boundary
  // is the sum formed exactly instead (rare: the losses are zero or about 2^-106 of the partial sums)
  const n = x.length;
  let hi = 0;
  let lo = 0;
  let shift = 0;
  let f = 1;
  let lost = 0;
  for (const x0 of x) {
    let v = x0;
    if (shift !== 0) {
      v = x0 * f;
      // (a value below 2^(shift - 1022) is rounded onto the subnormals when scaled)
      if (v / f !== x0) lost += 2 ** -1074;
    }
    let s1 = hi + v;
    let bb2 = s1 - hi;
    let e3 = hi - (s1 - bb2) + (v - bb2);
    let u7 = e3 + (lo + 0);
    let s8 = s1 + u7;
    let e9 = u7 - (s8 - s1);
    let s11 = s8 + (e9 + 0);
    let e12 = e9 + 0 - (s11 - s8);
    if (shift === 0 && !(Number.isFinite(s1) && Number.isFinite(s11) && Number.isFinite(e12))) {
      // the sum would overflow: from here on, the values scaled by 2^-shift (as wideSumAdd)
      shift = overflowShift(n);
      f = 2 ** -shift;
      const h = hi * f;
      const l = lo * f;
      if (h / f !== hi) lost += 2 ** -1074;
      if (l / f !== lo) lost += 2 ** -1074;
      hi = h;
      lo = l;
      v = x0 * f;
      if (v / f !== x0) lost += 2 ** -1074;
      s1 = hi + v;
      bb2 = s1 - hi;
      e3 = hi - (s1 - bb2) + (v - bb2);
      u7 = e3 + (lo + 0);
      s8 = s1 + u7;
      e9 = u7 - (s8 - s1);
      s11 = s8 + (e9 + 0);
      e12 = e9 + 0 - (s11 - s8);
    }
    // the rounding of u7 = e3 + lo is the step that loses; the next two are exact where |s1| >= |u7| or s1 = 0
    const bb = u7 - e3;
    lost += Math.abs(e3 - (u7 - bb) + (lo - bb));
    if (Math.abs(u7) > Math.abs(s1) && s1 !== 0) lost += (Math.abs(u7) + Math.abs(s1)) * 2 ** -51;
    hi = s11;
    lo = e12;
  }
  const r = hi + lo;
  if (lost > 0 && mayRoundOtherwise(hi, lo, r, lost * (1 + n * 2 ** -52), shift)) return exactSum(x);
  return ldexp(r, shift);
}

/**
 * Whether a true sum within lost of hi + lo (in units of 2^shift) may round to another double than r = fl(hi + lo):
 * lost reaches the distance from hi + lo to the nearest rounding boundary of r (half the gap below a power of 2, as a
 * bound). With shift != 0 also where scaling back may round again (a result near the subnormals)
 */
function mayRoundOtherwise(hi: number, lo: number, r: number, lost: number, shift: number): boolean {
  if (!Number.isFinite(r)) return true;
  const a = Math.abs(r);
  if (shift !== 0 && a < 2 ** -1000) return true;
  const offset = Math.abs(hi - r + lo); // exact: r = fl(hi + lo) with |lo| at most half an ulp of hi
  let gap: number;
  if (a < 2 ** -1022) gap = 2 ** -1074;
  else {
    const [m, e] = splitDouble(a);
    gap = 2 ** e;
    if (m === 1n << 52n) gap /= 2;
  }
  return lost >= gap / 2 - offset;
}

/** The sum of finite values formed exactly (integers times 2^-1074 in BigInt) and rounded once */
function exactSum(x: readonly number[]): number {
  let low = Infinity;
  const parts: [bigint, number][] = [];
  for (const v of x) {
    if (v === 0) continue;
    const p = splitDouble(v);
    parts.push(p);
    if (p[1] < low) low = p[1];
  }
  let acc = 0n;
  for (const [m, e] of parts) acc += m << BigInt(e - low);
  return roundScaled(acc, low);
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

/**
 * a b / n, as for an expected count from two margins. When the product overflows, underflows or is subnormal (with a
 * and b not 0), the three are scaled to [1, 2) by powers of 2 and the exponents added back at the end
 */
export function productOver(a: number, b: number, n: number): number {
  const ab = a * b;
  if (a === 0 || b === 0 || !Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(n)) return ab / n;
  if (Math.abs(ab) >= MIN_NORMAL && Math.abs(ab) < Infinity) return ab / n;
  const ka = unitExponent([[a]]);
  const kb = unitExponent([[b]]);
  const kn = unitExponent([[n]]);
  return ldexp((ldexp(a, -ka) * ldexp(b, -kb)) / ldexp(n, -kn), ka + kb - kn);
}

/**
 * Data scaled by a power of 2, 2^-k, so that the largest finite absolute value is in [1, 2) (k = 0 when there is
 * none). The scaling adds no rounding error, so statistics that do not depend on the units (t, F, chi-squared,
 * ratios of variances, degrees of freedom) come out as from the original data, but their squares and variances
 * can no longer overflow or underflow. Quantities with units are multiplied back by 2^k (see ldexp)
 */
export function scaleToUnit(groups: readonly (readonly number[])[]): { groups: number[][]; k: number } {
  const k = unitExponent(groups);
  return { groups: groups.map((g) => (k === 0 ? Array.from(g) : g.map((v) => ldexp(v, -k)))), k };
}

/**
 * Euclidean norm sqrt(sum x_i^2): the plain sum where it is in range (so the value is unchanged there), otherwise from
 * the values divided by the largest |x_i| (as BLAS's dnrm2), so that squares of values around 1e200 or 1e-200 neither
 * overflow nor underflow
 */
export function norm2(x: readonly number[]): number {
  let s = 0;
  for (const v of x) s += v * v;
  if (s < Infinity && s >= MIN_NORMAL) return Math.sqrt(s);
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  // all 0, or an infinite value (NaN if there is also a NaN)
  if (!(m > 0 && m < Infinity)) return Number.isNaN(s) ? NaN : m;
  let t = 0;
  for (const v of x) t += (v / m) ** 2;
  return m * Math.sqrt(t);
}
