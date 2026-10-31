// The power-series prefix shared by the Bessel functions I and J (besselIK.ts, besselJY.ts).

import { gamma, lgamma } from "./gamma.js";
import { dpoisRaw } from "./loader.js";

const DBL_MIN = 2.2250738585072014e-308;
const EPS = Number.EPSILON;

/** Below this x, x / 2 is not exact (Number.MIN_VALUE / 2 is 0) */
const HALF_EXACT = 2 ** -1021;

/** log(x/2), also for subnormal x (log(Number.MIN_VALUE / 2) was -Infinity) */
export function logHalf(x: number): number {
  return x >= HALF_EXACT ? Math.log(x / 2) : Math.log(x) - Math.LN2;
}

/** (x/2)^v, also for subnormal x */
export function powHalf(x: number, v: number): number {
  return x >= HALF_EXACT ? Math.pow(x / 2, v) : Math.pow(x, v) * Math.pow(2, -v);
}

/**
 * (x/2)^v / Gamma(v + 1) * sum, the leading factor of the power series of I_v and J_v times the series sum.
 * For v >= 10 the factor is Loader's Poisson term dpois(v; x/2) e^(x/2), which is accurate where pow / gamma loses
 * 1e-14 (v = 32) and exp(v log(x/2) - lgamma(v + 1)) loses 7e-14 (v = 500). When the factor or the result is
 * subnormal the logs are combined and exp taken once, so that a subnormal result is not built from a subnormal
 * factor (the log of a value near 1e-308 carries an absolute error of 700 ε, which a subnormal result can afford)
 */
export function seriesTimesPrefix(v: number, x: number, sum: number): number {
  if (v < 10) return (powHalf(x, v) / gamma(v + 1)) * sum;
  const lambda = x / 2;
  const d = dpoisRaw(v, lambda, false);
  if (d >= DBL_MIN && lambda < 700) {
    const r = d * Math.exp(lambda) * sum;
    if (Math.abs(r) >= DBL_MIN) return r;
  }
  const ld = dpoisRaw(v, lambda, true) + lambda + Math.log(Math.abs(sum));
  return Math.sign(sum) * Math.exp(ld);
}

/**
 * Large orders. The recurrences in besselIK.ts and besselJY.ts take about v steps, which does not end for v = 1e12
 * (besselK(1, 1e12)), while the result is far beyond the range of doubles. Above this order, bounds on the log of the
 * result decide such cases first
 */
export const LARGE_ORDER = 1000;

const LOG_MAX = Math.log(Number.MAX_VALUE);
/** Values below Number.MIN_VALUE / 2 round to 0 */
const LOG_MIN = Math.log(Number.MIN_VALUE) - Math.LN2;

/** Bounds lo <= log y <= hi, with the sum of the sizes of the terms they were formed from (for the rounding margin) */
export interface LogBounds {
  lo: number;
  hi: number;
  size: number;
}

/**
 * Bounds on log I_v(x) (v >= 0) from its power series (x/2)^v / Gamma(v + 1) sum (x^2/4)^k / (k! (v+1)_k): the terms
 * are positive, and the sum is at most exp(x^2 / (4 (v + 1))). The lower bound is also the upper bound of
 * log abs(J_v(x)) (DLMF 10.14.4)
 */
export function logISeriesBounds(v: number, x: number): LogBounds {
  const a = v * logHalf(x);
  const g = lgamma(v + 1);
  const t = (x * x) / (4 * (v + 1));
  return { lo: a - g, hi: a - g + t, size: Math.abs(a) + Math.abs(g) + t };
}

/**
 * 1 if a value whose log lies in [lo, hi] certainly overflows, -1 if it certainly rounds to 0, 0 otherwise. The bounds
 * must clear the limits by a margin above the rounding of their terms
 */
export function certainRange(b: LogBounds): 1 | -1 | 0 {
  const m = 1 + 64 * EPS * b.size;
  if (b.lo - m > LOG_MAX) return 1;
  if (b.hi + m < LOG_MIN) return -1;
  return 0;
}
