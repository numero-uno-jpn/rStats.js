import type { Sample } from "../htest/types.js";
/**
 * Options for {@link lowess}.
 *
 * @category Descriptive statistics
 */
export interface LowessOptions {
    /** The smoother span: the fraction of the points that influence each fit. Default `2/3`; must be positive. */
    f?: number;
    /** The number of robustifying iterations. Default `3`; truncated to an integer (as R). */
    iter?: number;
    /**
     * Points closer than `delta` to the last fitted one are interpolated instead of fitted. Default 1% of the range
     * of `x`; must be finite and non-negative.
     */
    delta?: number;
}
/**
 * The lowess smoother. Equivalent to R's `lowess()`. It returns the points sorted by `x` with the smoothed `y`.
 *
 * Unlike R, a missing value (NaN) in `y` is an error: R returns the data unsmoothed in that case.
 *
 * @example
 * ```ts
 * lowess([1, 2, 3, 4, 5, 6, 7], [2, 1, 4, 3, 7, 5, 9]).y;
 * ```
 *
 * @throws RangeError for arrays of different lengths, no points, a missing value, a span that is not positive, a
 *   negative `iter` or `delta`.
 * @category Descriptive statistics
 */
export declare function lowess(x: Sample, y: Sample, options?: LowessOptions): {
    x: number[];
    y: number[];
};
