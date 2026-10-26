// Log-normal distribution dlnorm / plnorm / qlnorm.
//
// log X ~ N(meanlog, sdlog^2). z = (log x - meanlog) / sdlog is formed in double-double, and z^2 in
// exp(-z^2/2) is also computed in double-double (for large |log x|, the rounding of log x becomes an absolute
// error in z^2/2 and hence a relative error in the density and tail probabilities).
// Tail probabilities use Φ(-a) = erfcx(a/√2) exp(-a^2/2) / 2 (xsf's erfcx, src/special/erf.ts).

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { expNeg, mulDD } from "../internal/ddexp.js";
import { ddAdd, ddDiv, ddLog, ddMul, ddSub, twoSum, type DD } from "../special/dd.js";
import { erfcxNonNegative } from "../special/erf.js";
import { pnorm, qnorm } from "./normal.js";

/** Parameters of the log-normal distribution (mean and standard deviation on the log scale). */
export interface LognormalParams {
  /** Mean of the distribution on the log scale. Default `0`. */
  meanlog?: number;
  /** Standard deviation of the distribution on the log scale. Default `1`. */
  sdlog?: number;
}

const LN_SQRT_2PI = 0.918938533204672741780329736406;
const INV_SQRT_2PI = 0.398942280401432677939946059934;

/** z = (log x - meanlog) / sdlog (x > 0, finite parameters, sdlog > 0) */
function zOf(x: number, meanlog: number, sdlog: number): DD {
  const d = ddSub(ddLog([x, 0]), [meanlog, 0]);
  if (sdlog === 1) return d;
  const hi = d[0] / sdlog;
  return Number.isFinite(hi) && Math.abs(hi) < 1e300 ? ddDiv(d, [sdlog, 0]) : [hi, 0];
}

/** z^2 / 2 in double-double */
function halfSquare(z: DD): DD {
  if (Math.abs(z[0]) > 1e150) return [(z[0] * z[0]) / 2, 0];
  const s = ddMul(z, z);
  return [s[0] / 2, s[1] / 2];
}

/** P[Z <= t] of the standard normal. t is double-double (finite) */
export function pnormDD(t: DD, logP: boolean): number {
  if (t[0] > -Math.SQRT2) {
    if (t[0] < Math.SQRT2) return pnorm(t[0] + t[1], { logP });
    // Side close to 1: 1 - Φ(-t)
    const other = smallTail(t[0], [t[0], t[1]], false);
    return logP ? Math.log1p(-other) : 1 - other;
  }
  return smallTail(-t[0], [-t[0], -t[1]], logP);
}

/** Φ(-a) (a >= √2) */
function smallTail(a: number, ad: DD, logP: boolean): number {
  const c = 0.5 * erfcxNonNegative(a * Math.SQRT1_2);
  const h = halfSquare(ad);
  if (logP) return Math.log(c) - h[0] - h[1];
  return c * expNeg(h);
}

const SQRT_2PI = 2.506628274631000502415765284811;

/**
 * Attach a double-double low-order term to the standard normal quantile z0 (the double value from qnorm).
 * In exp(meanlog + sdlog z) the rounding of z (1e-16 relative) is amplified sdlog |z| times, so compute one
 * Newton correction δ from the residual of the distribution function and set z = z0 + δ.
 * In the tails use φ(s) / Φ(s) = 1 / (√(2π) c) (c = erfcx(|s|/√2) / 2) to avoid dividing probabilities.
 */
function refineStdQuantile(z0: number, p: number, lowerTail: boolean, logP: boolean): DD {
  // s is the point corresponding to the probability p on that side (P[Z <= s] = p)
  const s = lowerTail ? z0 : -z0;
  let delta: number;
  // Residual r = log(Φ(-a) / target) = log c - a^2/2 - log target. Subtract the large terms from each other first
  const residual = (c: number, h: DD, lt: DD): number => -h[0] - lt[0] + (-h[1] - lt[1]) + Math.log(c);
  if (s <= -Math.SQRT2) {
    const c = 0.5 * erfcxNonNegative(-s * Math.SQRT1_2);
    const lt: DD = logP ? [p, 0] : ddLog([p, 0]);
    delta = -residual(c, halfSquare([-s, 0]), lt) * SQRT_2PI * c;
  } else if (s >= Math.SQRT2) {
    // Measure the residual with the other side G = P[Z > s] (1 - p is exact for p >= 1/2)
    const c = 0.5 * erfcxNonNegative(s * Math.SQRT1_2);
    const target = logP ? -Math.expm1(p) : 1 - p;
    delta = residual(c, halfSquare([s, 0]), ddLog([target, 0])) * SQRT_2PI * c;
  } else {
    const F = pnorm(s);
    const phi = Math.exp((-s * s) / 2) / SQRT_2PI;
    delta = ((logP ? Math.exp(p) : p) - F) / phi;
  }
  if (!Number.isFinite(delta)) return [z0, 0];
  return twoSum(z0, lowerTail ? delta : -delta);
}

export function dlnorm1(x: number, meanlog: number, sdlog: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(meanlog) || Number.isNaN(sdlog)) return NaN;
  if (sdlog < 0) return NaN;
  if (x <= 0) return d0(log);
  if (sdlog === 0) return Math.log(x) === meanlog ? Infinity : d0(log);
  if (!Number.isFinite(x) || !Number.isFinite(meanlog) || !Number.isFinite(sdlog)) {
    const y = (Math.log(x) - meanlog) / sdlog;
    return Number.isNaN(y) ? NaN : d0(log);
  }
  const z = zOf(x, meanlog, sdlog);
  const h = halfSquare(z);
  if (log) return -(LN_SQRT_2PI + h[0] + h[1] + Math.log(sdlog) + Math.log(x));
  return (INV_SQRT_2PI * expNeg(h)) / sdlog / x;
}

export function plnorm1(q: number, meanlog: number, sdlog: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(meanlog) || Number.isNaN(sdlog)) return NaN;
  if (sdlog < 0) return NaN;
  if (q <= 0) return dt0(lowerTail, logP);
  if (sdlog === 0 || !Number.isFinite(q) || !Number.isFinite(meanlog) || !Number.isFinite(sdlog)) {
    return pnorm(Math.log(q), { mean: meanlog, sd: sdlog, lowerTail, logP });
  }
  const z = zOf(q, meanlog, sdlog);
  return pnormDD(lowerTail ? z : [-z[0], -z[1]], logP);
}

export function qlnorm1(p: number, meanlog: number, sdlog: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(meanlog) || Number.isNaN(sdlog)) return NaN;
  const z = qnorm(p, { lowerTail, logP });
  if (!Number.isFinite(z) || !(sdlog > 0) || !Number.isFinite(sdlog) || !Number.isFinite(meanlog)) {
    return Math.exp(qnorm(p, { mean: meanlog, sd: sdlog, lowerTail, logP }));
  }
  // exp(meanlog + sdlog z). Form the exponent in double-double and apply the low-order term to first order
  const zd = refineStdQuantile(z, p, lowerTail, logP);
  const e = ddAdd(ddAdd(mulDD(sdlog, zd[0]), [sdlog * zd[1], 0]), [meanlog, 0]);
  return Math.exp(e[0]) * (1 + e[1]);
}

/**
 * Density of the log-normal distribution. Equivalent to R's `dlnorm(x, meanlog = 0, sdlog = 1, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `meanlog` and `sdlog` (see {@link LognormalParams}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * dlnorm(1);                             // 0.3989422804014327
 * dlnorm(2, { meanlog: 0.5, sdlog: 0.8 }); // 0.24217677488483338
 * ```
 */
export function dlnorm<T extends Vectorizable>(x: T, options: LognormalParams & DensityOptions = {}): VectorResult<T> {
  const { meanlog = 0, sdlog = 1, log = false } = options;
  return vectorize(x, (v) => dlnorm1(v, meanlog, sdlog, log));
}

/**
 * Distribution function of the log-normal distribution. Equivalent to R's `plnorm(q, meanlog = 0, sdlog = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `meanlog` and `sdlog` (see {@link LognormalParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * plnorm(2);                             // 0.7558914042144173
 * plnorm(2, { meanlog: 0.5, sdlog: 0.8 }); // 0.595390608679215
 * ```
 */
export function plnorm<T extends Vectorizable>(q: T, options: LognormalParams & TailOptions = {}): VectorResult<T> {
  const { meanlog = 0, sdlog = 1, lowerTail = true, logP = false } = options;
  return vectorize(q, (v) => plnorm1(v, meanlog, sdlog, lowerTail, logP));
}

/**
 * Quantile function of the log-normal distribution. Equivalent to R's `qlnorm(p, meanlog = 0, sdlog = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `meanlog` and `sdlog` (see {@link LognormalParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qlnorm(0.5, { meanlog: 1 });  // 2.718281828459045
 * qlnorm([0.05, 0.95]);         // [0.19304081669873657, 5.180251602233015]
 * ```
 */
export function qlnorm<T extends Vectorizable>(p: T, options: LognormalParams & TailOptions = {}): VectorResult<T> {
  const { meanlog = 0, sdlog = 1, lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qlnorm1(v, meanlog, sdlog, lowerTail, logP));
}
