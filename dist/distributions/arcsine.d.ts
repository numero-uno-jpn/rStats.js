import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
/**
 * Limits of the arcsine distribution.
 *
 * @category Distributions
 */
export interface ArcsineParams {
    /** Lower limit. Default `0`. */
    a?: number;
    /** Upper limit. Default `1`. */
    b?: number;
}
export declare function darcsine1(x: number, a: number, b: number, log: boolean): number;
export declare function parcsine1(q: number, a: number, b: number, lowerTail: boolean, logP: boolean): number;
export declare function qarcsine1(p: number, a: number, b: number, lowerTail: boolean, logP: boolean): number;
/**
 * Density of the arcsine distribution on (a, b), f(x) = 1 / (pi sqrt((x - a)(b - x))).
 * Not an R function. Neither base R nor extraDistr has the arcsine distribution; this equals
 * `dbeta((x - a) / (b - a), 0.5, 0.5) / (b - a)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `a` and `b` (see {@link ArcsineParams}) and `log` (see {@link DensityOptions}).
 *
 * @example
 * ```ts
 * darcsine(0.5);                   // 0.6366197723675813
 * darcsine(1, { a: 0, b: 4 });     // 0.1837762984739307
 * ```
 *
 * @category Distributions
 */
export declare function darcsine<T extends Vectorizable>(x: T, options?: ArcsineParams & DensityOptions): VectorResult<T>;
/**
 * Distribution function of the arcsine distribution on (a, b): `pbeta((q - a) / (b - a), 0.5, 0.5)`.
 * Not an R function. Neither base R nor extraDistr has the arcsine distribution.
 *
 * @example
 * ```ts
 * parcsine(0.25);                  // 0.3333333333333333
 * parcsine(1, { a: 0, b: 4 });     // 0.3333333333333333
 * ```
 *
 * @category Distributions
 */
export declare function parcsine<T extends Vectorizable>(q: T, options?: ArcsineParams & TailOptions): VectorResult<T>;
/**
 * Quantile function of the arcsine distribution on (a, b): `a + (b - a) qbeta(p, 0.5, 0.5)`.
 * Not an R function. Neither base R nor extraDistr has the arcsine distribution.
 *
 * @example
 * ```ts
 * qarcsine(0.5);                   // 0.5
 * qarcsine(0.25, { a: 0, b: 4 });  // 0.5857864376269049
 * ```
 *
 * @category Distributions
 */
export declare function qarcsine<T extends Vectorizable>(p: T, options?: ArcsineParams & TailOptions): VectorResult<T>;
