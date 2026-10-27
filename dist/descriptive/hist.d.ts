import type { Sample } from "../htest/types.js";
/**
 * Options for {@link pretty}.
 *
 * @category Descriptive statistics
 */
export interface PrettyOptions {
    /**
     * Desired number of intervals. Default `5`. Truncated towards 0 to an integer (as in R); `NaN`, a negative value
     * or one of 2^31 or more in absolute value is an error (unless `x` has no finite values).
     */
    n?: number;
    /**
     * Minimal number of intervals. Default `n / 3` rounded down (computed from `n` before it is truncated). Truncated
     * towards 0 to an integer (as in R); `NaN`, a negative value or one greater than `n` is an error.
     */
    minN?: number;
    /** Factor applied to the cell when the range is very small. Default `0.75`. */
    shrinkSml?: number;
    /** Bias towards larger units. Default `1.5`. */
    highUBias?: number;
    /** Bias towards 5 over 2 times a power of 10. Default `0.5 + 1.5 * highUBias`. */
    u5Bias?: number;
}
/**
 * About n + 1 equally spaced "round" values (1, 2 or 5 times a power of 10) covering the range of `x`. Equivalent to
 * R's `pretty()`.
 *
 * @example
 * ```ts
 * pretty([0.3, 9.6]); // [0, 2, 4, 6, 8, 10]
 * ```
 *
 * @category Descriptive statistics
 */
export declare function pretty(x: Sample, options?: PrettyOptions): number[];
/**
 * Options for {@link hist}.
 *
 * @category Descriptive statistics
 */
export interface HistOptions {
    /**
     * Break points, a number of cells (a suggestion for pretty), or a rule: `"Sturges"` (default), `"Scott"` or
     * `"FD"` (Freedman-Diaconis).
     */
    breaks?: readonly number[] | number | "Sturges" | "Scott" | "FD" | "Freedman-Diaconis";
    /** Cells closed on the right, (a, b] (default `true`). */
    right?: boolean;
    /** Close the first cell on the left (the last on the right when `right` is false). Default `true`. */
    includeLowest?: boolean;
}
/**
 * Result of {@link hist}.
 *
 * @category Descriptive statistics
 */
export interface HistResult {
    /** The cell boundaries, one more than the cells. */
    breaks: number[];
    /** Number of values in each cell. */
    counts: number[];
    /** counts / (n * cell width) */
    density: number[];
    /** Cell midpoints. */
    mids: number[];
}
/**
 * Histogram counts. Equivalent to R's `hist(x, plot = FALSE)`. Break points (by default pretty points over the range
 * with about Sturges' number of cells), counts, densities and cell midpoints. Non-finite values are dropped.
 *
 * @example
 * ```ts
 * hist([1, 2, 2, 3, 3, 3, 4]).counts; // [3, 3, 1] (for breaks [1, 2, 3, 4])
 * ```
 *
 * @category Descriptive statistics
 */
export declare function hist(x: Sample, options?: HistOptions): HistResult;
/**
 * Empirical distribution function of `x`: a function returning the fraction of values at or below its argument.
 * Equivalent to R's `ecdf()`. `NaN` values are dropped.
 *
 * @example
 * ```ts
 * ecdf([3, 1, 2])(2); // 0.6666666666666666
 * ```
 *
 * @category Descriptive statistics
 */
export declare function ecdf(x: Sample): (q: number) => number;
