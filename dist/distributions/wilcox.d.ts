import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
export declare function dwilcox1(x: number, m: number, n: number, log: boolean): number;
export declare function pwilcox1(q: number, m: number, n: number, lowerTail: boolean, logP: boolean): number;
export declare function qwilcox1(p: number, m: number, n: number, lowerTail: boolean, logP: boolean): number;
/**
 * Probability mass function of the distribution of the Wilcoxon rank sum statistic (Mann-Whitney U). Equivalent to R's `dwilcox(x, m, n, log = FALSE)`.
 *
 * Unlike R, memory use grows only with the range of the statistic (at most `m * n / 2`), so large samples such as `m = n = 500` work.
 *
 * @throws RangeError if `m` and `n` are so large that the required table cannot be allocated.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param m - Size of the first sample.
 * @param n - Size of the second sample.
 * @param options - `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 */
export declare function dwilcox<T extends Vectorizable>(x: T, m: number, n: number, options?: DensityOptions): VectorResult<T>;
/**
 * Distribution function of the distribution of the Wilcoxon rank sum statistic (Mann-Whitney U). Equivalent to R's `pwilcox(q, m, n, lower.tail = TRUE, log.p = FALSE)`.
 *
 * Unlike R, memory use grows only with the range of the statistic (at most `m * n / 2`), so large samples such as `m = n = 500` work.
 *
 * @throws RangeError if `m` and `n` are so large that the required table cannot be allocated.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param m - Size of the first sample.
 * @param n - Size of the second sample.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 */
export declare function pwilcox<T extends Vectorizable>(q: T, m: number, n: number, options?: TailOptions): VectorResult<T>;
/**
 * Quantile function of the distribution of the Wilcoxon rank sum statistic (Mann-Whitney U). Equivalent to R's `qwilcox(p, m, n, lower.tail = TRUE, log.p = FALSE)`.
 *
 * Unlike R, memory use grows only with the range of the statistic (at most `m * n / 2`), so large samples such as `m = n = 500` work.
 *
 * @throws RangeError if `m` and `n` are so large that the required table cannot be allocated.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param m - Size of the first sample.
 * @param n - Size of the second sample.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 */
export declare function qwilcox<T extends Vectorizable>(p: T, m: number, n: number, options?: TailOptions): VectorResult<T>;
