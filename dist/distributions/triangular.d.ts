import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
/** Limits and mode of the triangular distribution. */
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
 * Density of the triangular distribution. Equivalent to `extraDistr::dtriang(x, a = -1, b = 1, c = (a + b)/2, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `a`, `b` and `c` (see {@link TriangParams}) and `log` (see {@link DensityOptions}).
 */
export declare function dtriang<T extends Vectorizable>(x: T, options?: TriangParams & DensityOptions): VectorResult<T>;
/** Distribution function of the triangular distribution. Equivalent to `extraDistr::ptriang(q, a, b, c, lower.tail, log.p)`. */
export declare function ptriang<T extends Vectorizable>(q: T, options?: TriangParams & TailOptions): VectorResult<T>;
/** Quantile function of the triangular distribution. Equivalent to `extraDistr::qtriang(p, a, b, c, lower.tail, log.p)`. */
export declare function qtriang<T extends Vectorizable>(p: T, options?: TriangParams & TailOptions): VectorResult<T>;
