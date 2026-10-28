// Pareto distribution dpareto / ppareto / qpareto, with extraDistr's parameters (a shape, b scale).
//
// Written for rStats.js (no ported code). For x >= b:
//   f(x) = (a / b) (b / x)^(a+1),   P[X > x] = (b / x)^a,   q(p) = b (1 - p)^(-1/a)
// r = x / b is formed in double-double and the powers taken with pow, whose rounding does not grow with a (the low
// part of r enters to first order). Where a power leaves the normal range, or a is so large that the low part of r no
// longer enters to first order, the powers are taken from logs instead.

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { log1mExp, logRatioDD, standardizeDD } from "../internal/ddexp.js";

/**
 * Shape and scale of the Pareto distribution.
 *
 * @category Distributions
 */
export interface ParetoParams {
  /** Shape. Default `1`. */
  a?: number;
  /** Scale (the lower limit of the support). Default `1`. */
  b?: number;
}

const valid = (a: number, b: number): boolean => a > 0 && b > 0 && Number.isFinite(b);
// a = Inf is taken as the limit (the distribution concentrates at b), as extraDistr does

const MIN_NORMAL = 2 ** -1022;

/**
 * r = x / b (x > b) as [r, e, log r] with e the relative low part of r (r (1 + e) is x / b to double-double accuracy).
 * When r overflows (or x is above 1e308, where the remainder in standardizeDD can overflow) r is Infinity,
 * e is 0 and log r = log x - log b
 */
function ratio(x: number, b: number): [number, number, number] {
  if (x < 1e308) {
    const [r, rl] = standardizeDD(x, 0, b);
    if (r < Infinity) {
      const e = rl / r;
      return [r, e, Math.log(r) + e];
    }
  }
  // log x - log b in double-double (the roundings of the two logs near 709 were 1e-12 of the tail at a = 25)
  const lr = logRatioDD(x, b);
  return [Infinity, 0, lr[0] + lr[1]];
}

/**
 * (x / b)^-a from ratio(x, b) = [r, e, lr]. pow is used where its result is a normal double and the low part of r
 * enters to first order (|a e| small); where r overflows, x^-a b^a if both factors are normal; otherwise exp(-a lr)
 * (a power below the normal range, or a so large that a e is not small)
 */
function powNeg(x: number, b: number, [r, e, lr]: [number, number, number], a: number): number {
  const ae = a * e;
  if (Math.abs(ae) < 1e-8) {
    const u = r < Infinity ? Math.pow(r, -a) : Math.pow(x, -a);
    const v = r < Infinity ? 1 : Math.pow(b, a);
    if (u >= MIN_NORMAL && v >= MIN_NORMAL && v < Infinity && u * v >= MIN_NORMAL) return u * v * (1 - ae);
  }
  return Math.exp(-a * lr);
}

export function dpareto1(x: number, a: number, b: number, log: boolean): number {
  if (Number.isNaN(x) || !valid(a, b)) return NaN;
  if (x < b || x === Infinity) return d0(log);
  if (a === Infinity) return x === b ? Infinity : d0(log);
  const [r, e, lr] = ratio(x, b);
  const ab = a / b;
  const lab = ab >= MIN_NORMAL && ab < Infinity ? Math.log(ab) : Math.log(a) - Math.log(b);
  const ld = lab - (a + 1) * lr;
  // (a / b) r^-(a+1), unless a / b or the power leaves the normal range (or a e is not small): then in logs. Where
  // r^-a is subnormal but a large a / b brings the density back, r^-a = h^2 with h = r^(-a/2) (exact halving)
  const product = (): number => {
    if (!(ab < Infinity && Math.abs(a * e) < 1e-8)) return 0;
    const u = Math.pow(r, -a);
    const h = u >= MIN_NORMAL ? 0 : Math.pow(r, -a / 2);
    return u >= MIN_NORMAL ? (ab * u) / r : h >= MIN_NORMAL ? ((ab * h) / r) * h : 0;
  };
  if (log) {
    // Where log(a / b) and (a + 1) log r (hundreds near the ends of the range) cancel to below half, their roundings
    // would show: the log of the product instead (dpareto(1.1e-263, 1640, 7.8e-264, log) was 1.7e-13 off at -0.88)
    if (!(Math.abs(ld) < 0.5 * Math.abs(lab))) return ld;
    const d = product();
    return d >= MIN_NORMAL && d < Infinity ? Math.log(d) + Math.log1p(-(a + 1) * e) : ld;
  }
  const d = product();
  return d >= MIN_NORMAL && d < Infinity ? d * (1 - (a + 1) * e) : Math.exp(ld);
}

export function ppareto1(q: number, a: number, b: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || !valid(a, b)) return NaN;
  if (q <= b) return dt0(lowerTail, logP);
  if (q === Infinity || a === Infinity) return dt1(lowerTail, logP);
  const rt = ratio(q, b);
  const lu = -a * rt[2]; // log P[X > q]
  if (!lowerTail) return logP ? lu : powNeg(q, b, rt, a);
  if (!logP) return -Math.expm1(lu);
  // Where a log r is subnormal (a subnormal shape), it has lost digits, and so would the log of the probability -lu
  // taken from it: log a + log log r instead (ppareto(318.7, { a: 1.04e-317, logP: true }) was 3e-11 off; extraDistr
  // gives -Inf there, taking the log after the probability underflowed)
  if (-lu < MIN_NORMAL) return Math.log(a) + Math.log(rt[2]);
  return lu < -Math.LN2 ? Math.log1p(-powNeg(q, b, rt, a)) : log1mExp(lu);
}

export function qpareto1(p: number, a: number, b: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || !valid(a, b)) return NaN;
  const bd = quantileBoundaries(p, b, Infinity, lowerTail, logP);
  if (bd !== undefined) return bd;
  if (a === Infinity) return b;
  const lu = lowerTail ? (logP ? log1mExp(p) : Math.log1p(-p)) : logP ? p : Math.log(p);
  // b exp(-lu / a); where the exponential overflows but b is small the product may not: then in logs
  const t = -lu / a;
  const v = Math.exp(t);
  return v < Infinity ? b * v : Math.exp(Math.log(b) + t);
}

/**
 * Density of the Pareto distribution. Equivalent to `extraDistr::dpareto(x, a = 1, b = 1, log = FALSE)` in R.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `a` and `b` (see {@link ParetoParams}) and `log` (see {@link DensityOptions}).
 *
 * @example
 * ```ts
 * dpareto(2);                    // 0.25
 * dpareto(3, { a: 2, b: 1.5 });  // 0.16666666666666666
 * ```
 *
 * @category Distributions
 */
export function dpareto<T extends Vectorizable>(x: T, options: ParetoParams & DensityOptions = {}): VectorResult<T> {
  const { a = 1, b = 1, log = false } = options;
  return vectorize(x, (v) => dpareto1(v, a, b, log));
}

/**
 * Distribution function of the Pareto distribution. Equivalent to `extraDistr::ppareto(q, a = 1, b = 1, lower.tail, log.p)` in R.
 *
 * @example
 * ```ts
 * ppareto(2);                    // 0.5
 * ppareto(3, { a: 2, b: 1.5 });  // 0.75
 * ```
 *
 * @category Distributions
 */
export function ppareto<T extends Vectorizable>(q: T, options: ParetoParams & TailOptions = {}): VectorResult<T> {
  const { a = 1, b = 1, lowerTail = true, logP = false } = options;
  return vectorize(q, (v) => ppareto1(v, a, b, lowerTail, logP));
}

/**
 * Quantile function of the Pareto distribution. Equivalent to `extraDistr::qpareto(p, a = 1, b = 1, lower.tail, log.p)` in R.
 *
 * @example
 * ```ts
 * qpareto(0.5);                  // 2
 * qpareto(0.9, { a: 2, b: 1.5 }); // 4.74341649025257
 * ```
 *
 * @category Distributions
 */
export function qpareto<T extends Vectorizable>(p: T, options: ParetoParams & TailOptions = {}): VectorResult<T> {
  const { a = 1, b = 1, lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qpareto1(v, a, b, lowerTail, logP));
}
