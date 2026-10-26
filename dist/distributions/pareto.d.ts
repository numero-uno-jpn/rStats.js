import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
/** Shape and scale of the Pareto distribution. */
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
 * Density of the Pareto distribution. Equivalent to `extraDistr::dpareto(x, a = 1, b = 1, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `a` and `b` (see {@link ParetoParams}) and `log` (see {@link DensityOptions}).
 */
export declare function dpareto<T extends Vectorizable>(x: T, options?: ParetoParams & DensityOptions): VectorResult<T>;
/** Distribution function of the Pareto distribution. Equivalent to `extraDistr::ppareto(q, a = 1, b = 1, lower.tail, log.p)`. */
export declare function ppareto<T extends Vectorizable>(q: T, options?: ParetoParams & TailOptions): VectorResult<T>;
/** Quantile function of the Pareto distribution. Equivalent to `extraDistr::qpareto(p, a = 1, b = 1, lower.tail, log.p)`. */
export declare function qpareto<T extends Vectorizable>(p: T, options?: ParetoParams & TailOptions): VectorResult<T>;
