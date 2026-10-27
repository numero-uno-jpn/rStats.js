import type { Sample } from "../htest/types.js";
/**
 * Counts of the integers 1..nbins in `bin` (values truncated towards 0; others and NaN are not counted).
 * Equivalent to R's `tabulate()`. `nbins` defaults to max(1, bin) and is truncated towards 0, as R does.
 *
 * @example
 * ```ts
 * tabulate([1, 2, 2, 5]);    // [1, 2, 0, 0, 1]
 * tabulate([1, 2, 2, 5], 3); // [1, 2, 0]
 * ```
 *
 * @category Descriptive statistics
 */
export declare function tabulate(bin: Sample, nbins?: number): number[];
/**
 * Options for {@link table}.
 *
 * @category Descriptive statistics
 */
export interface TableOptions {
    /** Count missing values: `"no"` (default), `"ifany"` (when there are some) or `"always"`. */
    useNA?: "no" | "ifany" | "always";
}
/**
 * Frequency table of the distinct values. Equivalent to R's `table()`. For one numeric vector: `values` in increasing
 * order (NaN last when counted) with their `counts`. As in R, values with the same text (15 significant digits, as
 * R's `as.character`) are counted as one, under the smallest of them.
 *
 * @example
 * ```ts
 * table([3, 1, 3, 2, 3]); // { values: [1, 2, 3], counts: [1, 1, 3] }
 * ```
 *
 * @category Descriptive statistics
 */
export declare function table(x: Sample, options?: TableOptions): {
    /** The distinct values, in increasing order (NaN last when missing values are counted); R's names. */
    values: number[];
    /** How often each value occurs. */
    counts: number[];
};
/**
 * Distinct values in order of first appearance (one NaN at most). Equivalent to R's `unique()`.
 *
 * @example
 * ```ts
 * unique([3, 1, 3, 2, 1]); // [3, 1, 2]
 * ```
 *
 * @category Descriptive statistics
 */
export declare function unique(x: Sample): number[];
/**
 * Options for {@link cut}.
 *
 * @category Descriptive statistics
 */
export interface CutOptions {
    /** Intervals closed on the right, (a, b] (default `true`); otherwise [a, b). */
    right?: boolean;
    /** Close the first interval on the left (or the last on the right when `right` is false). Default `false`. */
    includeLowest?: boolean;
}
/**
 * Interval numbers (1-based) of the values, or NaN outside the breaks. Equivalent to R's `cut(..., labels = FALSE)`.
 *
 * @param breaks The break points (NaN among them is dropped, as R does; fewer than 2 left give NaN codes), or a
 *   number of intervals (at least 2): then equal intervals over the range of `x`, widened by 1/1000 of the range at
 *   each end, as R does. That range must be finite.
 *
 * @example
 * ```ts
 * cut([1, 2.5, 4, 6], [0, 2, 4, 6]);                  // [1, 2, 2, 3]
 * cut([1, 2.5, 4, 6], [0, 2, 4, 6], { right: false }); // [1, 2, 3, NaN]
 * ```
 *
 * @category Descriptive statistics
 */
export declare function cut(x: Sample, breaks: number | readonly number[], options?: CutOptions): number[];
/**
 * Options for {@link findInterval}.
 *
 * @category Descriptive statistics
 */
export interface FindIntervalOptions {
    /** Treat the last interval as closed on the right (with `leftOpen`, the first as closed on the left). */
    rightmostClosed?: boolean;
    /** Give 1 instead of 0 left of the first point and N - 1 instead of N at or right of the last (N = `vec.length`). */
    allInside?: boolean;
    /** Intervals (v_i, v_(i+1)] instead of [v_i, v_(i+1)). */
    leftOpen?: boolean;
}
/**
 * For each value, the number of break points at or below it (the interval index). Equivalent to R's
 * `findInterval()`. `vec` must be non-decreasing.
 *
 * @example
 * ```ts
 * findInterval([0, 1.5, 3, 5], [1, 2, 3]); // [0, 1, 3, 3]
 * ```
 *
 * @category Descriptive statistics
 */
export declare function findInterval(x: Sample, vec: readonly number[], options?: FindIntervalOptions): number[];
