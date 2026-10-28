// Inverse gamma distribution dinvgamma / pinvgamma / qinvgamma, with extraDistr's parameters (alpha shape, beta scale).
//
// Written for rStats.js (no ported code). X = 1/Y with Y ~ Gamma(alpha, rate = beta), so with z = beta / x
//   f(x) = f_Gamma(z; alpha, 1) z / x,   P[X <= x] = P[Z >= z],   q(p) = beta / q_Gamma(1 - p; alpha, 1)
// which keeps the gamma functions' accuracy in both tails. z is formed in double-double and its low part enters to
// first order (the density and the tails are steep in z when alpha is large). Above alpha = 1e15 it is left out: near
// the centre the low part (up to eps z / 2, z about alpha) is no longer small against the width sqrt(alpha) over which
// the tails change, so a first-order term is not valid (it gave probabilities of 1e16); the functions are then those
// at the rounded z (relative errors of order eps sqrt(alpha), the condition of the problem itself).

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, smallerTail, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { ddExp, logRatioDD, standardizeDD } from "../internal/ddexp.js";
import { ddAdd, ddLog, ddMulNum, ddSub } from "../special/dd.js";
import { lgamma } from "../special/gamma.js";
import { dgamma1, logTinyGammaQuantile, pgamma1, qgamma1 } from "./gamma.js";

/**
 * Scale parameter of the inverse gamma distribution.
 *
 * @category Distributions
 */
export interface InvgammaParams {
  /** Scale (the rate of the gamma distribution of 1/X). Default `1`. */
  beta?: number;
}

const valid = (alpha: number, beta: number): boolean => alpha > 0 && beta > 0 && Number.isFinite(beta);
// alpha = Inf is taken as the limit (the distribution concentrates at 0), as extraDistr does

const MIN_NORMAL = 2 ** -1022;
/** Largest alpha for which the low part of z enters to first order (see the top of the file) */
const MAX_ALPHA_CORRECTED = 1e15;

export function dinvgamma1(x: number, alpha: number, beta: number, log: boolean): number {
  if (Number.isNaN(x) || !valid(alpha, beta)) return NaN;
  if (x <= 0 || x === Infinity) return d0(log);
  if (alpha === Infinity) return NaN;
  const [z, zl] = standardizeDD(beta, 0, x);
  if (z === Infinity) return d0(log);
  if (z < MIN_NORMAL) {
    // beta / x subnormal or 0: in logs, log f = alpha log(beta / x) - lgamma(alpha) - log x (e^-z is 1), with
    // log(beta / x) from log beta - log x
    const lr = logRatioDD(beta, x);
    // (where alpha log(beta / x) or lgamma(alpha) overflows the log is -Infinity, which the double-double sums made NaN:
    // dinvgamma(4.9e270, 1.3e306, beta 1.8e-118))
    if (!(Math.abs(lr[0] * alpha) < Infinity) || lgamma(alpha) === Infinity) return d0(log);
    const l = ddAdd(ddSub(alpha < 1e300 ? ddMulNum(lr, alpha) : [lr[0] * alpha, 0], ddLog([x, 0])), [-lgamma(alpha), 0]);
    return log ? l[0] + l[1] : l[0] < -746 ? 0 : ddExp(l)[0];
  }
  // d/dz log(f_Gamma(z) z) = alpha / z - 1
  const c = Number.isFinite(zl) && alpha <= MAX_ALPHA_CORRECTED ? alpha * (zl / z) - zl : 0;
  // f_Gamma(z) z / x from normal factors (undefined where f_Gamma(z) or f_Gamma(z) z is below the normal range, where z
  // or 1 / x can bring the density back)
  const linear = (): number | undefined => {
    const g = dgamma1(z, alpha, 1, false);
    const dz = g * z;
    return g >= MIN_NORMAL && dz >= MIN_NORMAL ? dz / x : undefined;
  };
  if (log) {
    const lg = dgamma1(z, alpha, 1, true);
    const ld = lg + Math.log(z) - Math.log(x) + c;
    if (!(Math.abs(ld) < 0.5 * Math.abs(lg))) return ld;
    // log f_Gamma and log(z / x) (hundreds near the ends of the range) cancelled to below half, so their roundings
    // would show: the log of the linear value instead (dinvgamma(9.7e-286, 91.7, beta 2.5e-287, log) was 1.2e-13 off)
    const v = linear();
    return v !== undefined && v >= MIN_NORMAL && v < Infinity ? Math.log(v) + c : ld;
  }
  const v = linear();
  if (v === undefined) return Math.exp(dgamma1(z, alpha, 1, true) + Math.log(z) - Math.log(x) + c);
  return v * (1 + c);
}

export function pinvgamma1(q: number, alpha: number, beta: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || !valid(alpha, beta)) return NaN;
  if (q <= 0) return dt0(lowerTail, logP);
  if (q === Infinity || alpha === Infinity) return dt1(lowerTail, logP);
  const [z, zl] = standardizeDD(beta, 0, q);
  if (z < MIN_NORMAL) {
    // beta / x subnormal or 0: P[Z >= z] is the upper tail at beta of the gamma distribution with scale x, which
    // pgamma takes in logs there
    return pgamma1(beta, alpha, q, !lowerTail, logP);
  }
  const v = pgamma1(z, alpha, 1, !lowerTail, logP);
  if (!(zl !== 0 && Number.isFinite(zl) && Number.isFinite(z) && alpha <= MAX_ALPHA_CORRECTED)) return v;
  // P[Z <= z] grows by f(z) zl, P[Z > z] falls by it
  const sign = lowerTail ? -1 : 1;
  if (!logP) return v + sign * dgamma1(z, alpha, 1, false) * zl;
  // log P + f(z) zl / P, with f / P from the logs (P may underflow). Beyond |log P| = 1e8 the difference of the logs
  // has lost its digits (eps |log P| absolute) and the correction is below the rounding of log P anyway
  if (!(Math.abs(v) < 1e8)) return v;
  const c = sign * Math.exp(dgamma1(z, alpha, 1, true) - v) * zl;
  return Number.isFinite(c) ? v + c : v;
}

export function qinvgamma1(p: number, alpha: number, beta: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || !valid(alpha, beta)) return NaN;
  const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
  if (b !== undefined) return b;
  if (alpha === Infinity) return 0;
  // A gamma quantile below the smallest normal double has lost digits (or is 0): beta / it from the log
  const { lower, logTarget, linearTarget } = smallerTail(p, !lowerTail, logP);
  const tiny = logTinyGammaQuantile(logTarget, lower, alpha, linearTarget);
  if (tiny !== undefined) return Math.log(beta) - tiny[0] > 710 ? Infinity : ddExp(ddSub(ddLog([beta, 0]), tiny))[0];
  return beta / qgamma1(p, alpha, 1, !lowerTail, logP);
}

/**
 * Density of the inverse gamma distribution. Equivalent to `extraDistr::dinvgamma(x, alpha, beta = 1, log = FALSE)` in R.
 * f(x) = beta^alpha x^(-alpha-1) exp(-beta/x) / Gamma(alpha).
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param alpha - Shape parameter.
 * @param options - `beta` (see {@link InvgammaParams}) and `log` (see {@link DensityOptions}).
 *
 * @example
 * ```ts
 * dinvgamma(1, 3);                // 0.18393972058572117
 * dinvgamma(0.5, 3, { beta: 2 }); // 1.1722008888789877
 * ```
 *
 * @category Distributions
 */
export function dinvgamma<T extends Vectorizable>(x: T, alpha: number, options: InvgammaParams & DensityOptions = {}): VectorResult<T> {
  const { beta = 1, log = false } = options;
  return vectorize(x, (v) => dinvgamma1(v, alpha, beta, log));
}

/**
 * Distribution function of the inverse gamma distribution. Equivalent to
 * `extraDistr::pinvgamma(q, alpha, beta = 1, lower.tail = TRUE, log.p = FALSE)` in R.
 *
 * @example
 * ```ts
 * pinvgamma(1, 3);                // 0.9196986029286058
 * pinvgamma(0.5, 3, { beta: 2 }); // 0.23810330555354436
 * ```
 *
 * @category Distributions
 */
export function pinvgamma<T extends Vectorizable>(q: T, alpha: number, options: InvgammaParams & TailOptions = {}): VectorResult<T> {
  const { beta = 1, lowerTail = true, logP = false } = options;
  return vectorize(q, (v) => pinvgamma1(v, alpha, beta, lowerTail, logP));
}

/**
 * Quantile function of the inverse gamma distribution. Equivalent to
 * `extraDistr::qinvgamma(p, alpha, beta = 1, lower.tail = TRUE, log.p = FALSE)` in R.
 *
 * @example
 * ```ts
 * qinvgamma(0.5, 3);              // 0.3739631431901122
 * qinvgamma(0.95, 3, { beta: 2 }); // 2.445910382133402
 * ```
 *
 * @category Distributions
 */
export function qinvgamma<T extends Vectorizable>(p: T, alpha: number, options: InvgammaParams & TailOptions = {}): VectorResult<T> {
  const { beta = 1, lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qinvgamma1(v, alpha, beta, lowerTail, logP));
}
