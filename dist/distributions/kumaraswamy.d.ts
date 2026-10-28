import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
export declare function dkumar1(x: number, a: number, b: number, log: boolean): number;
export declare function pkumar1(q: number, a: number, b: number, lowerTail: boolean, logP: boolean): number;
export declare function qkumar1(p: number, a: number, b: number, lowerTail: boolean, logP: boolean): number;
/**
 * Density of the Kumaraswamy distribution. Equivalent to `extraDistr::dkumar(x, a, b, log = FALSE)` in R.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param a - First shape parameter.
 * @param b - Second shape parameter.
 *
 * @example
 * ```ts
 * dkumar(0.5, 2, 3);        // 1.6875
 * dkumar([0.25, 0.75], 2, 3); // [1.318359375, 0.861328125]
 * ```
 *
 * @category Distributions
 */
export declare function dkumar<T extends Vectorizable>(x: T, a: number, b: number, options?: DensityOptions): VectorResult<T>;
/**
 * Distribution function of the Kumaraswamy distribution. Equivalent to `extraDistr::pkumar(q, a, b, lower.tail, log.p)` in R.
 *
 * @example
 * ```ts
 * pkumar(0.5, 2, 3);        // 0.578125
 * pkumar(0.5, 2, 3, { lowerTail: false }); // 0.421875
 * ```
 *
 * @category Distributions
 */
export declare function pkumar<T extends Vectorizable>(q: T, a: number, b: number, options?: TailOptions): VectorResult<T>;
/**
 * Quantile function of the Kumaraswamy distribution. Equivalent to `extraDistr::qkumar(p, a, b, lower.tail, log.p)` in R.
 *
 * @example
 * ```ts
 * qkumar(0.5, 2, 3);        // 0.4542020189474066
 * qkumar([0.1, 0.9], 2, 3); // [0.18577032969333462, 0.7320116915997463]
 * ```
 *
 * @category Distributions
 */
export declare function qkumar<T extends Vectorizable>(p: T, a: number, b: number, options?: TailOptions): VectorResult<T>;
