import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
/** Parameters of the Weibull distribution (besides the positional `shape`). */
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
 */
export declare function dweibull<T extends Vectorizable>(x: T, shape: number, options?: WeibullParams & DensityOptions): VectorResult<T>;
/**
 * Distribution function of the Weibull distribution. Equivalent to R's `pweibull(q, shape, scale = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `scale` (see {@link WeibullParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 */
export declare function pweibull<T extends Vectorizable>(q: T, shape: number, options?: WeibullParams & TailOptions): VectorResult<T>;
/**
 * Quantile function of the Weibull distribution. Equivalent to R's `qweibull(p, shape, scale = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `scale` (see {@link WeibullParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 */
export declare function qweibull<T extends Vectorizable>(p: T, shape: number, options?: WeibullParams & TailOptions): VectorResult<T>;
