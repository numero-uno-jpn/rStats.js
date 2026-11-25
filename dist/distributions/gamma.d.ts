import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { type DD } from "../special/dd.js";
/**
 * Parameters of the gamma distribution. Give either `rate` or `scale`; if both are given,
 * `scale` must equal `1 / rate`.
 *
 * @category Distributions
 */
export interface GammaParams {
    /** Rate (`rate = 1 / scale`). Default `1`. */
    rate?: number;
    /** Scale. Default `1`. Do not combine with a different `rate`. */
    scale?: number;
}
/** Determine scale from rate / scale (as in R, giving both is an error unless scale = 1/rate; also used by rgamma) */
export declare function gammaScale(params: GammaParams): number;
/** Log density of the standardized (scale = 1) gamma distribution. x > 0, shape > 0 */
export declare function dgammaStdLog(x: number, shape: number): number;
export declare function dgamma1(x: number, shape: number, scale: number, log: boolean): number;
export declare function pgamma1(q: number, shape: number, scale: number, lowerTail: boolean, logP: boolean): number;
/**
 * log of the standardized gamma quantile when it is below the smallest normal double (else undefined): there
 * P(shape, x) = x^shape / Gamma(shape + 1) to double precision, so log x = (log P + lgamma(shape + 1)) / shape.
 * lower, logTarget and linearTarget as from smallerTail. log P from the linear target in double-double where there is
 * one (log P rounded would lose eps |log P| / shape relative in x)
 */
export declare function logTinyGammaQuantile(logTarget: number, lower: boolean, shape: number, linearTarget: number | undefined): DD | undefined;
/**
 * Quantile of the standardized gamma distribution times scale (default 1). 0 < p < 1 (range checks are the caller's
 * job). Where the standardized quantile is below the smallest normal double the scaling is done in logs
 */
export declare function qgammaStd(p: number, shape: number, lowerTail: boolean, logP: boolean, scale?: number): number;
export declare function qgamma1(p: number, shape: number, scale: number, lowerTail: boolean, logP: boolean): number;
/**
 * Density of the gamma distribution. Equivalent to R's `dgamma(x, shape, rate = 1, scale = 1/rate, log = FALSE)`.
 *
 * @throws RangeError if both `rate` and `scale` are given and `scale` is not `1 / rate`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `rate` or `scale` (see {@link GammaParams}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * dgamma(1, 2);              // 0.36787944117144233
 * dgamma(1, 2, { rate: 3 }); // 0.44808361531077556
 * ```
 *
 * @category Distributions
 */
export declare function dgamma<T extends Vectorizable>(x: T, shape: number, options?: GammaParams & DensityOptions): VectorResult<T>;
/**
 * Distribution function of the gamma distribution. Equivalent to R's `pgamma(q, shape, rate = 1, scale = 1/rate, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @throws RangeError if both `rate` and `scale` are given and `scale` is not `1 / rate`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `rate` or `scale` (see {@link GammaParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pgamma(2, 2);              // 0.5939941502901619
 * pgamma(2, 2, { rate: 3 }); // 0.9826487347633355
 * pgamma(2, 2, { scale: 3 }); // 0.14430480161234657
 * ```
 *
 * @category Distributions
 */
export declare function pgamma<T extends Vectorizable>(q: T, shape: number, options?: GammaParams & TailOptions): VectorResult<T>;
/**
 * Quantile function of the gamma distribution. Equivalent to R's `qgamma(p, shape, rate = 1, scale = 1/rate, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @throws RangeError if both `rate` and `scale` are given and `scale` is not `1 / rate`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `rate` or `scale` (see {@link GammaParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qgamma(0.5, 2);                   // 1.6783469900166605
 * qgamma([0.05, 0.95], 2, { rate: 3 }); // [0.11845383689955402, 1.5812881727968588]
 * ```
 *
 * @category Distributions
 */
export declare function qgamma<T extends Vectorizable>(p: T, shape: number, options?: GammaParams & TailOptions): VectorResult<T>;
