import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
/**
 * Limits and mode of the triangular distribution.
 *
 * @category Distributions
 */
export interface TriangParams {
    /** Minimum. Default `-1`. */
    a?: number;
    /** Maximum. Default `1`. */
    b?: number;
    /** Mode. Default `(a + b) / 2`. */
    c?: number;
}
export declare function dtriang1(x: number, a: number, b: number, c: number, log: boolean): number;
export declare function ptriang1(q: number, a: number, b: number, c: number, lowerTail: boolean, logP: boolean): number;
export declare function qtriang1(p: number, a: number, b: number, c: number, lowerTail: boolean, logP: boolean): number;
/**
 * Density of the triangular distribution. Equivalent to `extraDistr::dtriang(x, a = -1, b = 1, c = (a + b)/2, log = FALSE)` in R.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `a`, `b` and `c` (see {@link TriangParams}) and `log` (see {@link DensityOptions}).
 *
 * @example
 * ```ts
 * dtriang(0);                            // 1
 * dtriang(1, { a: 0, b: 4, c: 1 });      // 0.5
 * ```
 *
 * @category Distributions
 */
export declare function dtriang<T extends Vectorizable>(x: T, options?: TriangParams & DensityOptions): VectorResult<T>;
/**
 * Distribution function of the triangular distribution. Equivalent to `extraDistr::ptriang(q, a, b, c, lower.tail, log.p)` in R.
 *
 * @example
 * ```ts
 * ptriang(0);                            // 0.5
 * ptriang(2, { a: 0, b: 4, c: 1 });      // 0.6666666666666667
 * ```
 *
 * @category Distributions
 */
export declare function ptriang<T extends Vectorizable>(q: T, options?: TriangParams & TailOptions): VectorResult<T>;
/**
 * Quantile function of the triangular distribution. Equivalent to `extraDistr::qtriang(p, a, b, c, lower.tail, log.p)` in R.
 *
 * @example
 * ```ts
 * qtriang(0.5);                          // 0
 * qtriang(0.9, { a: 0, b: 4, c: 1 });    // 2.904554884989668
 * ```
 *
 * @category Distributions
 */
export declare function qtriang<T extends Vectorizable>(p: T, options?: TriangParams & TailOptions): VectorResult<T>;
