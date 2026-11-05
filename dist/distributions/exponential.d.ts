import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
/**
 * Parameters of the exponential distribution.
 *
 * @category Distributions
 */
export interface ExponentialParams {
    /** Rate. Default `1`. */
    rate?: number;
}
export declare function dexp1(x: number, rate: number, log: boolean): number;
export declare function pexp1(q: number, rate: number, lowerTail: boolean, logP: boolean): number;
export declare function qexp1(p: number, rate: number, lowerTail: boolean, logP: boolean): number;
/**
 * Density of the exponential distribution. Equivalent to R's `dexp(x, rate = 1, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `rate` (see {@link ExponentialParams}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * dexp(1);              // 0.36787944117144233
 * dexp(1, { rate: 2 }); // 0.2706705664732254
 * ```
 *
 * @category Distributions
 */
export declare function dexp<T extends Vectorizable>(x: T, options?: ExponentialParams & DensityOptions): VectorResult<T>;
/**
 * Distribution function of the exponential distribution. Equivalent to R's `pexp(q, rate = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `rate` (see {@link ExponentialParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pexp(1);                                  // 0.6321205588285577
 * pexp(1, { rate: 2, lowerTail: false });   // 0.1353352832366127
 * ```
 *
 * @category Distributions
 */
export declare function pexp<T extends Vectorizable>(q: T, options?: ExponentialParams & TailOptions): VectorResult<T>;
/**
 * Quantile function of the exponential distribution. Equivalent to R's `qexp(p, rate = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `rate` (see {@link ExponentialParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qexp(0.5, { rate: 2 });      // 0.34657359027997264
 * qexp([0.25, 0.75]);          // [0.2876820724517809, 1.3862943611198906]
 * ```
 *
 * @category Distributions
 */
export declare function qexp<T extends Vectorizable>(p: T, options?: ExponentialParams & TailOptions): VectorResult<T>;
