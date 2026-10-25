import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
/** Parameters of the uniform distribution. */
export interface UniformParams {
    /** Lower limit. Default `0`. */
    min?: number;
    /** Upper limit. Default `1`. */
    max?: number;
}
export declare function dunif1(x: number, min: number, max: number, log: boolean): number;
export declare function punif1(q: number, min: number, max: number, lowerTail: boolean, logP: boolean): number;
export declare function qunif1(p: number, min: number, max: number, lowerTail: boolean, logP: boolean): number;
/**
 * Density of the uniform distribution. Equivalent to R's `dunif(x, min = 0, max = 1, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `min` and `max` (see {@link UniformParams}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 */
export declare function dunif<T extends Vectorizable>(x: T, options?: UniformParams & DensityOptions): VectorResult<T>;
/**
 * Distribution function of the uniform distribution. Equivalent to R's `punif(q, min = 0, max = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `min` and `max` (see {@link UniformParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 */
export declare function punif<T extends Vectorizable>(q: T, options?: UniformParams & TailOptions): VectorResult<T>;
/**
 * Quantile function of the uniform distribution. Equivalent to R's `qunif(p, min = 0, max = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `min` and `max` (see {@link UniformParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 */
export declare function qunif<T extends Vectorizable>(p: T, options?: UniformParams & TailOptions): VectorResult<T>;
