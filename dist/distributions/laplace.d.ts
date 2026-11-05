import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
/**
 * Location and scale of the Laplace distribution.
 *
 * @category Distributions
 */
export interface LaplaceParams {
    /** Location. Default `0`. */
    mu?: number;
    /** Scale. Default `1`. */
    sigma?: number;
}
export declare function dlaplace1(x: number, mu: number, sigma: number, log: boolean): number;
export declare function plaplace1(q: number, mu: number, sigma: number, lowerTail: boolean, logP: boolean): number;
export declare function qlaplace1(p: number, mu: number, sigma: number, lowerTail: boolean, logP: boolean): number;
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
 *
 * @category Distributions
 */
export declare function dlaplace<T extends Vectorizable>(x: T, options?: LaplaceParams & DensityOptions): VectorResult<T>;
/**
 * Distribution function of the Laplace distribution. Equivalent to `extraDistr::plaplace(q, mu = 0, sigma = 1, lower.tail, log.p)` in R.
 *
 * @example
 * ```ts
 * plaplace(1);                         // 0.8160602794142788
 * plaplace(-1, { mu: 1, sigma: 2 });   // 0.18393972058572117
 * ```
 *
 * @category Distributions
 */
export declare function plaplace<T extends Vectorizable>(q: T, options?: LaplaceParams & TailOptions): VectorResult<T>;
/**
 * Quantile function of the Laplace distribution. Equivalent to `extraDistr::qlaplace(p, mu = 0, sigma = 1, lower.tail, log.p)` in R.
 *
 * @example
 * ```ts
 * qlaplace(0.75);                      // 0.6931471805599453
 * qlaplace(0.9, { mu: 1, sigma: 2 });  // 4.218875824868201
 * ```
 *
 * @category Distributions
 */
export declare function qlaplace<T extends Vectorizable>(p: T, options?: LaplaceParams & TailOptions): VectorResult<T>;
