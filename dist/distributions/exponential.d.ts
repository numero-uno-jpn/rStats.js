import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
/** Parameters of the exponential distribution. */
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
 */
export declare function dexp<T extends Vectorizable>(x: T, options?: ExponentialParams & DensityOptions): VectorResult<T>;
/**
 * Distribution function of the exponential distribution. Equivalent to R's `pexp(q, rate = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `rate` (see {@link ExponentialParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 */
export declare function pexp<T extends Vectorizable>(q: T, options?: ExponentialParams & TailOptions): VectorResult<T>;
/**
 * Quantile function of the exponential distribution. Equivalent to R's `qexp(p, rate = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `rate` (see {@link ExponentialParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 */
export declare function qexp<T extends Vectorizable>(p: T, options?: ExponentialParams & TailOptions): VectorResult<T>;
