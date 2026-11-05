import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
/**
 * Location and scale parameters, used by the logistic and Cauchy distributions.
 *
 * @category Distributions
 */
export interface LocationScaleParams {
    /** Location. Default `0`. */
    location?: number;
    /** Scale. Default `1`. */
    scale?: number;
}
export declare function dlogis1(x: number, location: number, scale: number, log: boolean): number;
export declare function plogis1(q: number, location: number, scale: number, lowerTail: boolean, logP: boolean): number;
export declare function qlogis1(p: number, location: number, scale: number, lowerTail: boolean, logP: boolean): number;
/**
 * Density of the logistic distribution. Equivalent to R's `dlogis(x, location = 0, scale = 1, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `location` and `scale` (see {@link LocationScaleParams}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * dlogis(0);                               // 0.25
 * dlogis(1, { location: 1, scale: 2 });    // 0.125
 * ```
 *
 * @category Distributions
 */
export declare function dlogis<T extends Vectorizable>(x: T, options?: LocationScaleParams & DensityOptions): VectorResult<T>;
/**
 * Distribution function of the logistic distribution. Equivalent to R's `plogis(q, location = 0, scale = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `location` and `scale` (see {@link LocationScaleParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * plogis(1);                               // 0.7310585786300049
 * plogis([-2, 0, 2], { scale: 2 });        // [0.2689414213699951, 0.5, 0.7310585786300049]
 * ```
 *
 * @category Distributions
 */
export declare function plogis<T extends Vectorizable>(q: T, options?: LocationScaleParams & TailOptions): VectorResult<T>;
/**
 * Quantile function of the logistic distribution. Equivalent to R's `qlogis(p, location = 0, scale = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `location` and `scale` (see {@link LocationScaleParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qlogis(0.75);                            // 1.0986122886681096
 * qlogis(0.9, { location: 1, scale: 2 });  // 5.394449154672439
 * ```
 *
 * @category Distributions
 */
export declare function qlogis<T extends Vectorizable>(p: T, options?: LocationScaleParams & TailOptions): VectorResult<T>;
