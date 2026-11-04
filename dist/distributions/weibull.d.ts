import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
/**
 * Parameters of the Weibull distribution (besides the positional `shape`).
 *
 * @category Distributions
 */
export interface WeibullParams {
    /** Scale. Default `1`. */
    scale?: number;
}
export declare function dweibull1(x: number, shape: number, scale: number, log: boolean): number;
export declare function pweibull1(q: number, shape: number, scale: number, lowerTail: boolean, logP: boolean): number;
export declare function qweibull1(p: number, shape: number, scale: number, lowerTail: boolean, logP: boolean): number;
/**
 * Density of the Weibull distribution. Equivalent to R's `dweibull(x, shape, scale = 1, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `scale` (see {@link WeibullParams}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * dweibull(1, 2);               // 0.7357588823428847
 * dweibull(1, 2, { scale: 3 }); // 0.1988531815143044
 * ```
 *
 * @category Distributions
 */
export declare function dweibull<T extends Vectorizable>(x: T, shape: number, options?: WeibullParams & DensityOptions): VectorResult<T>;
/**
 * Distribution function of the Weibull distribution. Equivalent to R's `pweibull(q, shape, scale = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `scale` (see {@link WeibullParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pweibull(1, 2);               // 0.6321205588285577
 * pweibull(2, 1.5, { scale: 3 }); // 0.41977020402532716
 * ```
 *
 * @category Distributions
 */
export declare function pweibull<T extends Vectorizable>(q: T, shape: number, options?: WeibullParams & TailOptions): VectorResult<T>;
/**
 * Quantile function of the Weibull distribution. Equivalent to R's `qweibull(p, shape, scale = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `scale` (see {@link WeibullParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qweibull(0.5, 2);               // 0.8325546111576977
 * qweibull(0.9, 1.5, { scale: 3 }); // 5.231164540789235
 * ```
 *
 * @category Distributions
 */
export declare function qweibull<T extends Vectorizable>(p: T, shape: number, options?: WeibullParams & TailOptions): VectorResult<T>;
