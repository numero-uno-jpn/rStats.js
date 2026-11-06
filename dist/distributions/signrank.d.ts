import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
export declare function dsignrank1(x: number, n: number, log: boolean): number;
export declare function psignrank1(q: number, n: number, lowerTail: boolean, logP: boolean): number;
export declare function qsignrank1(p: number, n: number, lowerTail: boolean, logP: boolean): number;
/**
 * Probability mass function of the distribution of the Wilcoxon signed rank statistic. Equivalent to R's `dsignrank(x, n, log = FALSE)`.
 *
 * @throws RangeError if `n` is so large that the required table cannot be allocated.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param n - Number of observations.
 * @param options - `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * dsignrank(5, 10);        // 0.0029296875
 * dsignrank([0, 1, 2], 4); // [0.0625, 0.0625, 0.0625]
 * ```
 *
 * @category Distributions
 */
export declare function dsignrank<T extends Vectorizable>(x: T, n: number, options?: DensityOptions): VectorResult<T>;
/**
 * Distribution function of the distribution of the Wilcoxon signed rank statistic. Equivalent to R's `psignrank(q, n, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @throws RangeError if `n` is so large that the required table cannot be allocated.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param n - Number of observations.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * psignrank(10, 10);                        // 0.0419921875
 * psignrank(40, 10, { lowerTail: false });  // 0.0966796875
 * ```
 *
 * @category Distributions
 */
export declare function psignrank<T extends Vectorizable>(q: T, n: number, options?: TailOptions): VectorResult<T>;
/**
 * Quantile function of the distribution of the Wilcoxon signed rank statistic. Equivalent to R's `qsignrank(p, n, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @throws RangeError if `n` is so large that the required table cannot be allocated.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param n - Number of observations.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qsignrank(0.025, 10);         // 9
 * qsignrank([0.25, 0.75], 10);  // [21, 34]
 * ```
 *
 * @category Distributions
 */
export declare function qsignrank<T extends Vectorizable>(p: T, n: number, options?: TailOptions): VectorResult<T>;
