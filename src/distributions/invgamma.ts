// Inverse gamma distribution dinvgamma / pinvgamma / qinvgamma, with extraDistr's parameters (alpha shape, beta scale).
//
// Written for rStats.js (no ported code). X = 1/Y with Y ~ Gamma(alpha, rate = beta), so with z = beta / x
//   f(x) = f_Gamma(z; alpha, 1) z / x,   P[X <= x] = P[Z >= z],   q(p) = beta / q_Gamma(1 - p; alpha, 1)
// which keeps the gamma functions' accuracy in both tails. z is formed in double-double and its low part enters to
// first order (the density and the tails are steep in z when alpha is large).

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { standardizeDD } from "../internal/ddexp.js";
import { dgamma1, pgamma1, qgamma1 } from "./gamma.js";

/** Scale parameter of the inverse gamma distribution. */
export interface InvgammaParams {
  /** Scale (the rate of the gamma distribution of 1/X). Default `1`. */
  beta?: number;
}

const valid = (alpha: number, beta: number): boolean => alpha > 0 && beta > 0 && Number.isFinite(beta);
// alpha = Inf is taken as the limit (the distribution concentrates at 0), as extraDistr does

export function dinvgamma1(x: number, alpha: number, beta: number, log: boolean): number {
  if (Number.isNaN(x) || !valid(alpha, beta)) return NaN;
  if (x <= 0 || x === Infinity) return d0(log);
  if (alpha === Infinity) return NaN;
  const [z, zl] = standardizeDD(beta, 0, x);
  if (z === Infinity) return d0(log);
  // d/dz log(f_Gamma(z) z) = alpha / z - 1
  const c = Number.isFinite(zl) ? (alpha / z - 1) * zl : 0;
  if (log) return dgamma1(z, alpha, 1, true) + Math.log(z) - Math.log(x) + c;
  return ((dgamma1(z, alpha, 1, false) * z) / x) * (1 + c);
}

export function pinvgamma1(q: number, alpha: number, beta: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || !valid(alpha, beta)) return NaN;
  if (q <= 0) return dt0(lowerTail, logP);
  if (q === Infinity || alpha === Infinity) return dt1(lowerTail, logP);
  const [z, zl] = standardizeDD(beta, 0, q);
  const v = pgamma1(z, alpha, 1, !lowerTail, logP);
  if (!(zl !== 0 && Number.isFinite(zl) && Number.isFinite(z))) return v;
  // P[Z <= z] grows by f(z) zl, P[Z > z] falls by it
  const sign = lowerTail ? -1 : 1;
  if (!logP) return v + sign * dgamma1(z, alpha, 1, false) * zl;
  // log P + f(z) zl / P, with f / P from the logs (P may underflow)
  const c = sign * Math.exp(dgamma1(z, alpha, 1, true) - v) * zl;
  return Number.isFinite(c) ? v + c : v;
}

export function qinvgamma1(p: number, alpha: number, beta: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || !valid(alpha, beta)) return NaN;
  const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
  if (b !== undefined) return b;
  if (alpha === Infinity) return 0;
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
 */
export function qinvgamma<T extends Vectorizable>(p: T, alpha: number, options: InvgammaParams & TailOptions = {}): VectorResult<T> {
  const { beta = 1, lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qinvgamma1(v, alpha, beta, lowerTail, logP));
}
