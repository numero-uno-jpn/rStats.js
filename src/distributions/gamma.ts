// Gamma distribution dgamma / pgamma / qgamma.
//
// The density uses the relation to the Poisson probability (Loader 2000). With y = x/scale,
//   f(x) = dpois(shape - 1; y) / scale            (shape >= 1)
//        = dpois(shape; y) * shape / x            (shape < 1)
// The distribution function uses the incomplete gamma function (src/special/igam.ts); quantiles use Newton's
// method (src/internal/invert.ts) from the DiDonato & Morris starting value.
// Where y = x/scale is below the smallest normal double (subnormal, or 0 although x > 0), the leading terms
//   f(x) = y^shape / (Gamma(shape) x),   P[X <= x] = y^shape / Gamma(shape + 1)
// are exact to double precision (the next terms are O(y) relative), and are taken in logs with log y = log x - log scale.

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, smallerTail, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { invertContinuous } from "../internal/invert.js";
import { gammaInc, gammaIncBoth } from "../special/igam.js";
import { findInverseGamma } from "../special/igami.js";
import { lgamma, lgamma1p } from "../special/gamma.js";
import { dpoisRaw } from "../special/loader.js";
import { ddAdd, ddDivNum, ddLog, ddMulNum, ddSub, type DD } from "../special/dd.js";
import { ddExp, log1mExp, logRatioDD } from "../internal/ddexp.js";
import { qnorm } from "./normal.js";

/**
 * Parameters of the gamma distribution. Give either `rate` or `scale`; if both are given,
 * `scale` must equal `1 / rate`.
 *
 * @category Distributions
 */
export interface GammaParams {
  /** Rate (`rate = 1 / scale`). Default `1`. */
  rate?: number;
  /** Scale. Default `1`. Do not combine with a different `rate`. */
  scale?: number;
}

/** Determine scale from rate / scale (as in R, giving both is an error unless scale = 1/rate; also used by rgamma) */
export function gammaScale(params: GammaParams): number {
  const { rate, scale } = params;
  if (rate !== undefined && scale !== undefined) {
    if (Math.abs(rate * scale - 1) >= 1e-15) {
      throw new RangeError("rate and scale can both be given only when scale = 1 / rate");
    }
    return scale;
  }
  if (scale !== undefined) return scale;
  if (rate !== undefined) return 1 / rate;
  return 1;
}

const MIN_NORMAL = 2 ** -1022;
const LOG_MIN_NORMAL = -1022 * Math.LN2;

/** c t in double-double; only the double product where c is beyond the range of Veltkamp splitting */
const mulBig = (t: DD, c: number): DD => (c < 1e300 ? ddMulNum(t, c) : [t[0] * c, 0]);

/** exp of a double-double; 0 below the subnormal range (where the low part could carry -0 or NaN into ddExp's result) */
const expOf = (l: DD): number => (l[0] < -746 ? 0 : ddExp(l)[0]);

/**
 * log P[X <= x] where y = x / scale is below the smallest normal double (x > 0, finite scale): shape log y -
 * lgamma(shape + 1), with log y from log x - log scale (y itself has lost digits in the division, or is 0)
 */
function logLowerTiny(x: number, shape: number, scale: number): DD {
  return ddAdd(mulBig(logRatioDD(x, scale), shape), [-lgamma1p(shape), 0]);
}

/**
 * Whether the log density l = lp + (log of a divisor) has cancelled to below half of |lp|: the roundings of the two
 * logs (eps times hundreds near the ends of the range) are then large against l (dgamma(1.2e-289, 40.4,
 * scale 1.5e-292, log) was 1e-13 off at -0.38)
 */
const cancels = (l: number, lp: number): boolean => Math.abs(l) < 0.5 * Math.abs(lp);

/** log(f / d) from the linear factor f where f and the quotient are normal (relative accuracy kept), else l */
function logOfLinear(f: number, d: number, l: number): number {
  if (!(f >= MIN_NORMAL && f < Infinity)) return l;
  const v = f / d;
  return v >= MIN_NORMAL && v < Infinity ? Math.log(v) : l;
}

/** Log density of the standardized (scale = 1) gamma distribution. x > 0, shape > 0 */
export function dgammaStdLog(x: number, shape: number): number {
  if (shape < 1) {
    const pr = dpoisRaw(shape, x, true);
    const r = shape / x;
    return pr + (r >= MIN_NORMAL && r < Infinity ? Math.log(r) : Math.log(shape) - Math.log(x));
  }
  return dpoisRaw(shape - 1, x, true);
}

export function dgamma1(x: number, shape: number, scale: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(shape) || Number.isNaN(scale)) return NaN;
  if (shape < 0 || scale <= 0) return NaN;
  if (x < 0) return d0(log);
  if (shape === 0) return x === 0 ? Infinity : d0(log);
  if (x === 0) {
    if (shape < 1) return Infinity;
    if (shape > 1) return d0(log);
    return log ? -Math.log(scale) : 1 / scale;
  }
  if (x / scale < MIN_NORMAL && scale < Infinity && shape < Infinity) {
    // log f = shape log y + log(shape) - lgamma(shape + 1) - log x (e^-y is 1)
    const l = ddAdd(ddSub(logLowerTiny(x, shape, scale), ddLog([x, 0])), ddLog([shape, 0]));
    return log ? l[0] + l[1] : expOf(l);
  }
  if (shape < 1) {
    const pr = dpoisRaw(shape, x / scale, log);
    if (log) {
      // log(shape / x), from the logs where the quotient over- or underflows or is subnormal (it has lost digits:
      // dgamma(8.8e214, 7.4e-105, rate 6.3e-268, log) was off by 4e-6)
      const r = shape / x;
      const l = pr + (r >= MIN_NORMAL && r < Infinity ? Math.log(r) : Math.log(shape) - Math.log(x));
      return cancels(l, pr) ? logOfLinear(dpoisRaw(shape, x / scale, false) * shape, x, l) : l;
    }
    const ps = pr * shape;
    return ps >= MIN_NORMAL || x >= 1 ? ps / x : Math.exp(dgamma1(x, shape, scale, true));
  }
  const pr = dpoisRaw(shape - 1, x / scale, log);
  if (log) {
    const l = pr - Math.log(scale);
    return cancels(l, pr) ? logOfLinear(dpoisRaw(shape - 1, x / scale, false), scale, l) : l;
  }
  // Where the Poisson factor (or its product with shape above) is below the normal range, a small scale or x can
  // bring the density back into it with the factor's lost digits (dgamma(6.8e-291, 6.37, scale 1.6e-231) was 0.4%
  // off): exp of the log density instead
  return pr >= MIN_NORMAL || scale >= 1 ? pr / scale : Math.exp(dgamma1(x, shape, scale, true));
}

export function pgamma1(q: number, shape: number, scale: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(shape) || Number.isNaN(scale)) return NaN;
  if (shape < 0 || scale <= 0) return NaN;
  const x = q / scale;
  if (Number.isNaN(x)) return x;
  if (shape === 0) return x <= 0 ? dt0(lowerTail, logP) : dt1(lowerTail, logP);
  // Shape Inf puts all the mass at +Inf. R gives NaN for 0 < x < 1 and these limits elsewhere; the limits are
  // returned for every finite x (docs/differences-from-r.md)
  if (shape === Infinity) return x === Infinity ? dt1(lowerTail, logP) : dt0(lowerTail, logP);
  if (q <= 0) return dt0(lowerTail, logP);
  if (x < MIN_NORMAL && scale < Infinity) {
    const l = logLowerTiny(q, shape, scale);
    const lp = l[0] + l[1];
    if (lowerTail) return logP ? lp : expOf(l);
    // 1 - P with P from the double-double log where P < 1/2 (exp of the rounded log loses eps |log P| relative)
    if (lp > -Math.LN2) return logP ? Math.log(-Math.expm1(lp)) : -Math.expm1(lp);
    const e = expOf(l);
    return logP ? Math.log1p(-e) : 1 - e;
  }
  if (x <= 0) return dt0(lowerTail, logP);
  return gammaInc(shape, x, lowerTail, logP);
}

/**
 * log of the standardized gamma quantile when it is below the smallest normal double (else undefined): there
 * P(shape, x) = x^shape / Gamma(shape + 1) to double precision, so log x = (log P + lgamma(shape + 1)) / shape.
 * lower, logTarget and linearTarget as from smallerTail. log P from the linear target in double-double where there is
 * one (log P rounded would lose eps |log P| / shape relative in x)
 */
export function logTinyGammaQuantile(
  logTarget: number,
  lower: boolean,
  shape: number,
  linearTarget: number | undefined,
): DD | undefined {
  const lp = lower ? logTarget : linearTarget !== undefined ? Math.log1p(-linearTarget) : log1mExp(logTarget);
  const lg = lgamma1p(shape);
  if (!(lp < shape * LOG_MIN_NORMAL - lg)) return undefined;
  const s = ddAdd(lower && linearTarget !== undefined ? ddLog([linearTarget, 0]) : [lp, 0], [lg, 0]);
  // (in double where the shape or the quotient is beyond the range of Veltkamp splitting; exp of it is 0 or 1 then)
  const q = s[0] / shape;
  return shape < 1e300 && Math.abs(q) < 1e300 ? ddDivNum(s, shape) : [q, 0];
}

/**
 * Quantile of the standardized gamma distribution times scale (default 1). 0 < p < 1 (range checks are the caller's
 * job). Where the standardized quantile is below the smallest normal double the scaling is done in logs
 */
export function qgammaStd(p: number, shape: number, lowerTail: boolean, logP: boolean, scale = 1): number {
  const { lower, logTarget, linearTarget } = smallerTail(p, lowerTail, logP);
  const tiny = logTinyGammaQuantile(logTarget, lower, shape, linearTarget);
  if (tiny !== undefined) return expOf(scale === 1 ? tiny : ddAdd(tiny, ddLog([scale, 0])));
  let x0: number;
  if (shape > 1 && logTarget <= -700) {
    // Deep tail: Wilson-Hilferty approximation x = a (1 - 1/(9a) + z / sqrt(9a))^3
    const z = qnorm(logTarget, { lowerTail: lower, logP: true });
    const w = 1 - 1 / (9 * shape) + z / Math.sqrt(9 * shape);
    x0 = w > 0 ? shape * w * w * w : shape * 1e-3;
  } else if (logTarget > -700) {
    const t = Math.exp(logTarget);
    const c = -Math.expm1(logTarget);
    x0 = lower ? findInverseGamma(shape, t, c) : findInverseGamma(shape, c, t);
  } else if (lower) {
    // P(a, x) ≈ x^a / Gamma(a + 1)
    x0 = Math.exp((logTarget + lgamma1p(shape)) / shape);
  } else {
    // Q(a, x) ≈ x^(a-1) e^-x / Gamma(a)
    x0 = -logTarget;
    for (let i = 0; i < 3; i++) x0 = -logTarget - lgamma(shape) + (shape - 1) * Math.log(x0);
  }
  const x = invertContinuous({
    logTarget,
    ...(linearTarget !== undefined && { linearTarget }),
    lower,
    cdf: (x, l) => gammaInc(shape, x, l, false),
    cdfLog: (x, l) => gammaInc(shape, x, l, true),
    cdfBoth: (x, l) => gammaIncBoth(shape, x, l),
    pdfLog: (x) => dgammaStdLog(x, shape),
    dlogPdf: (x) => (shape - 1) / x - 1,
    x0,
    lo: 0,
    hi: Infinity,
    positive: true,
  });
  return x * scale;
}

export function qgamma1(p: number, shape: number, scale: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(shape) || Number.isNaN(scale)) return NaN;
  const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
  if (b !== undefined) return b;
  if (shape < 0 || scale <= 0) return NaN;
  if (shape === 0) return 0;
  // Shape Inf: all the mass at +Inf, so every probability strictly between 0 and 1 maps to Inf
  if (shape === Infinity) return Infinity;
  return qgammaStd(p, shape, lowerTail, logP, scale);
}

/**
 * Density of the gamma distribution. Equivalent to R's `dgamma(x, shape, rate = 1, scale = 1/rate, log = FALSE)`.
 *
 * @throws RangeError if both `rate` and `scale` are given and `scale` is not `1 / rate`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `rate` or `scale` (see {@link GammaParams}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * dgamma(1, 2);              // 0.36787944117144233
 * dgamma(1, 2, { rate: 3 }); // 0.44808361531077556
 * ```
 *
 * @category Distributions
 */
export function dgamma<T extends Vectorizable>(
  x: T,
  shape: number,
  options: GammaParams & DensityOptions = {},
): VectorResult<T> {
  const scale = gammaScale(options);
  const log = options.log ?? false;
  return vectorize(x, (v) => dgamma1(v, shape, scale, log));
}

/**
 * Distribution function of the gamma distribution. Equivalent to R's `pgamma(q, shape, rate = 1, scale = 1/rate, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @throws RangeError if both `rate` and `scale` are given and `scale` is not `1 / rate`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `rate` or `scale` (see {@link GammaParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pgamma(2, 2);              // 0.5939941502901619
 * pgamma(2, 2, { rate: 3 }); // 0.9826487347633355
 * pgamma(2, 2, { scale: 3 }); // 0.14430480161234657
 * ```
 *
 * @category Distributions
 */
export function pgamma<T extends Vectorizable>(
  q: T,
  shape: number,
  options: GammaParams & TailOptions = {},
): VectorResult<T> {
  const scale = gammaScale(options);
  const { lowerTail = true, logP = false } = options;
  return vectorize(q, (v) => pgamma1(v, shape, scale, lowerTail, logP));
}

/**
 * Quantile function of the gamma distribution. Equivalent to R's `qgamma(p, shape, rate = 1, scale = 1/rate, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @throws RangeError if both `rate` and `scale` are given and `scale` is not `1 / rate`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `rate` or `scale` (see {@link GammaParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qgamma(0.5, 2);                   // 1.6783469900166605
 * qgamma([0.05, 0.95], 2, { rate: 3 }); // [0.11845383689955402, 1.5812881727968588]
 * ```
 *
 * @category Distributions
 */
export function qgamma<T extends Vectorizable>(
  p: T,
  shape: number,
  options: GammaParams & TailOptions = {},
): VectorResult<T> {
  const scale = gammaScale(options);
  const { lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qgamma1(v, shape, scale, lowerTail, logP));
}
