// Laplace (double exponential) distribution dlaplace / plaplace / qlaplace (extraDistr's names mu, sigma).
//
// Written for rStats.js (no ported code). With z = (x - mu) / sigma formed in double-double and a = |z|:
//   f(x) = exp(-a) / (2 sigma),   probability of the smaller side exp(-a) / 2,   q(p) = mu + sigma log(2p) for p <= 1/2
// (and the mirror image above 1/2).

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { quantileBoundaries, smallerTail, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { expNeg, locationScale, standardizeDD } from "../internal/ddexp.js";

/** Location and scale of the Laplace distribution. */
export interface LaplaceParams {
  /** Location. Default `0`. */
  mu?: number;
  /** Scale. Default `1`. */
  sigma?: number;
}

const valid = (mu: number, sigma: number): boolean => !Number.isNaN(mu) && sigma > 0 && Number.isFinite(sigma);
// an infinite mu is taken as the limit (the distribution moves out to that infinity), as extraDistr does

export function dlaplace1(x: number, mu: number, sigma: number, log: boolean): number {
  if (Number.isNaN(x) || !valid(mu, sigma)) return NaN;
  if (!Number.isFinite(mu)) return log ? -Infinity : 0;
  const z = standardizeDD(x, mu, sigma);
  const a: [number, number] = z[0] < 0 ? [-z[0], -z[1]] : [z[0], z[1]];
  if (log) return -a[0] - a[1] - Math.log(2 * sigma);
  return expNeg(a) / (2 * sigma);
}

export function plaplace1(q: number, mu: number, sigma: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || !valid(mu, sigma)) return NaN;
  if (!Number.isFinite(mu)) {
    const lower = mu === Infinity ? 0 : 1;
    const v = lowerTail ? lower : 1 - lower;
    return logP ? Math.log(v) : v;
  }
  const z = standardizeDD(q, mu, sigma);
  const a: [number, number] = z[0] < 0 ? [-z[0], -z[1]] : [z[0], z[1]];
  const half = expNeg(a) / 2; // probability of the smaller side
  if (lowerTail === z[0] < 0) return logP ? -a[0] - a[1] - Math.LN2 : half;
  return logP ? Math.log1p(-half) : 1 - half;
}

export function qlaplace1(p: number, mu: number, sigma: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || !valid(mu, sigma)) return NaN;
  const bd = quantileBoundaries(p, -Infinity, Infinity, lowerTail, logP);
  if (bd !== undefined) return bd;
  if (!Number.isFinite(mu)) return mu;
  const { lower, logTarget, linearTarget } = smallerTail(p, lowerTail, logP);
  // log(2 t) of the smaller tail t (<= 1/2)
  const l = linearTarget !== undefined ? Math.log(2 * linearTarget) : Math.LN2 + logTarget;
  return locationScale(mu, sigma, lower ? l : -l);
}

/**
 * Density of the Laplace distribution. Equivalent to `extraDistr::dlaplace(x, mu = 0, sigma = 1, log = FALSE)` in R.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `mu` and `sigma` (see {@link LaplaceParams}) and `log` (see {@link DensityOptions}).
 *
 * @example
 * ```ts
 * dlaplace(0);                         // 0.5
 * dlaplace(1, { mu: 1, sigma: 2 });    // 0.25
 * ```
 */
export function dlaplace<T extends Vectorizable>(x: T, options: LaplaceParams & DensityOptions = {}): VectorResult<T> {
  const { mu = 0, sigma = 1, log = false } = options;
  return vectorize(x, (v) => dlaplace1(v, mu, sigma, log));
}

/**
 * Distribution function of the Laplace distribution. Equivalent to `extraDistr::plaplace(q, mu = 0, sigma = 1, lower.tail, log.p)` in R.
 *
 * @example
 * ```ts
 * plaplace(1);                         // 0.8160602794142788
 * plaplace(-1, { mu: 1, sigma: 2 });   // 0.18393972058572117
 * ```
 */
export function plaplace<T extends Vectorizable>(q: T, options: LaplaceParams & TailOptions = {}): VectorResult<T> {
  const { mu = 0, sigma = 1, lowerTail = true, logP = false } = options;
  return vectorize(q, (v) => plaplace1(v, mu, sigma, lowerTail, logP));
}

/**
 * Quantile function of the Laplace distribution. Equivalent to `extraDistr::qlaplace(p, mu = 0, sigma = 1, lower.tail, log.p)` in R.
 *
 * @example
 * ```ts
 * qlaplace(0.75);                      // 0.6931471805599453
 * qlaplace(0.9, { mu: 1, sigma: 2 });  // 4.218875824868201
 * ```
 */
export function qlaplace<T extends Vectorizable>(p: T, options: LaplaceParams & TailOptions = {}): VectorResult<T> {
  const { mu = 0, sigma = 1, lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qlaplace1(v, mu, sigma, lowerTail, logP));
}
