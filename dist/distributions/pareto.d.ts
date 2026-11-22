import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
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
export declare function dpareto1(x: number, a: number, b: number, log: boolean): number;
export declare function ppareto1(q: number, a: number, b: number, lowerTail: boolean, logP: boolean): number;
export declare function qpareto1(p: number, a: number, b: number, lowerTail: boolean, logP: boolean): number;
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
export declare function dpareto<T extends Vectorizable>(x: T, options?: ParetoParams & DensityOptions): VectorResult<T>;
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
export declare function ppareto<T extends Vectorizable>(q: T, options?: ParetoParams & TailOptions): VectorResult<T>;
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
export declare function qpareto<T extends Vectorizable>(p: T, options?: ParetoParams & TailOptions): VectorResult<T>;
