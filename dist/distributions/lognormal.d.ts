import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { type DD } from "../special/dd.js";
/**
 * Parameters of the log-normal distribution (mean and standard deviation on the log scale).
 *
 * @category Distributions
 */
export interface LognormalParams {
    /** Mean of the distribution on the log scale. Default `0`. */
    meanlog?: number;
    /** Standard deviation of the distribution on the log scale. Default `1`. */
    sdlog?: number;
}
/** P[Z <= t] of the standard normal. t is double-double (finite) */
export declare function pnormDD(t: DD, logP: boolean): number;
export declare function dlnorm1(x: number, meanlog: number, sdlog: number, log: boolean): number;
export declare function plnorm1(q: number, meanlog: number, sdlog: number, lowerTail: boolean, logP: boolean): number;
export declare function qlnorm1(p: number, meanlog: number, sdlog: number, lowerTail: boolean, logP: boolean): number;
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
 *
 * @category Distributions
 */
export declare function dlnorm<T extends Vectorizable>(x: T, options?: LognormalParams & DensityOptions): VectorResult<T>;
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
 *
 * @category Distributions
 */
export declare function plnorm<T extends Vectorizable>(q: T, options?: LognormalParams & TailOptions): VectorResult<T>;
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
 *
 * @category Distributions
 */
export declare function qlnorm<T extends Vectorizable>(p: T, options?: LognormalParams & TailOptions): VectorResult<T>;
