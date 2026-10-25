import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
export declare function dhyper1(x: number, m: number, n: number, k: number, log: boolean): number;
export declare function phyper1(q: number, m: number, n: number, k: number, lowerTail: boolean, logP: boolean): number;
export declare function qhyper1(p: number, m: number, n: number, k: number, lowerTail: boolean, logP: boolean): number;
/**
 * Probability mass function of the hypergeometric distribution (number of white balls among `k` drawn without replacement from an urn of `m` white and `n` black balls). Equivalent to R's `dhyper(x, m, n, k, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param m - Number of white balls in the urn.
 * @param n - Number of black balls in the urn.
 * @param k - Number of balls drawn.
 * @param options - `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 */
export declare function dhyper<T extends Vectorizable>(x: T, m: number, n: number, k: number, options?: DensityOptions): VectorResult<T>;
/**
 * Distribution function of the hypergeometric distribution (number of white balls among `k` drawn without replacement from an urn of `m` white and `n` black balls). Equivalent to R's `phyper(q, m, n, k, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param m - Number of white balls in the urn.
 * @param n - Number of black balls in the urn.
 * @param k - Number of balls drawn.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 */
export declare function phyper<T extends Vectorizable>(q: T, m: number, n: number, k: number, options?: TailOptions): VectorResult<T>;
/**
 * Quantile function of the hypergeometric distribution (number of white balls among `k` drawn without replacement from an urn of `m` white and `n` black balls). Equivalent to R's `qhyper(p, m, n, k, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param m - Number of white balls in the urn.
 * @param n - Number of black balls in the urn.
 * @param k - Number of balls drawn.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 */
export declare function qhyper<T extends Vectorizable>(p: T, m: number, n: number, k: number, options?: TailOptions): VectorResult<T>;
