import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
export declare function dkumar1(x: number, a: number, b: number, log: boolean): number;
export declare function pkumar1(q: number, a: number, b: number, lowerTail: boolean, logP: boolean): number;
export declare function qkumar1(p: number, a: number, b: number, lowerTail: boolean, logP: boolean): number;
/**
 * Density of the Kumaraswamy distribution. Equivalent to `extraDistr::dkumar(x, a, b, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param a - First shape parameter.
 * @param b - Second shape parameter.
 */
export declare function dkumar<T extends Vectorizable>(x: T, a: number, b: number, options?: DensityOptions): VectorResult<T>;
/** Distribution function of the Kumaraswamy distribution. Equivalent to `extraDistr::pkumar(q, a, b, lower.tail, log.p)`. */
export declare function pkumar<T extends Vectorizable>(q: T, a: number, b: number, options?: TailOptions): VectorResult<T>;
/** Quantile function of the Kumaraswamy distribution. Equivalent to `extraDistr::qkumar(p, a, b, lower.tail, log.p)`. */
export declare function qkumar<T extends Vectorizable>(p: T, a: number, b: number, options?: TailOptions): VectorResult<T>;
