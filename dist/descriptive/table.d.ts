import type { Sample } from "../htest/types.js";
/**
 * Counts of the integers 1..nbins in `bin` (values truncated towards 0; others and NaN are not counted).
 * Equivalent to R's `tabulate()`; `nbins` defaults to max(1, bin).
 */
export declare function tabulate(bin: Sample, nbins?: number): number[];
/** Options for {@link table}. */
export interface TableOptions {
    /** Count missing values: `"no"` (default), `"ifany"` (when there are some) or `"always"`. */
    useNA?: "no" | "ifany" | "always";
}
/**
 * Frequency table of the distinct values. Equivalent to R's `table()` for one numeric vector: `values` in increasing
 * order (NaN last when counted) with their `counts`.
 *
 * @example
 * ```ts
 * table([3, 1, 3, 2, 3]); // { values: [1, 2, 3], counts: [1, 1, 3] }
 * ```
 */
export declare function table(x: Sample, options?: TableOptions): {
    values: number[];
    counts: number[];
};
/** Distinct values in order of first appearance (one NaN at most). Equivalent to R's `unique()`. */
export declare function unique(x: Sample): number[];
/** Options for {@link cut}. */
export interface CutOptions {
    /** Intervals closed on the right, (a, b] (default `true`); otherwise [a, b). */
    right?: boolean;
    /** Close the first interval on the left (or the last on the right when `right` is false). Default `false`. */
    includeLowest?: boolean;
}
/**
 * Interval numbers (1-based) of the values, or NaN outside the breaks. Equivalent to R's `cut(..., labels = FALSE)`.
 *
 * @param breaks The break points, or a number of intervals (at least 2): then equal intervals over the range of `x`,
 *   widened by 1/1000 of the range at each end, as R does.
 */
export declare function cut(x: Sample, breaks: number | readonly number[], options?: CutOptions): number[];
/** Options for {@link findInterval}. */
export interface FindIntervalOptions {
    /** Treat the last interval as closed on the right (with `leftOpen`, the first as closed on the left). */
    rightmostClosed?: boolean;
    /** Map results below 1 to 1 and above N - 1 to N - 1. */
    allInside?: boolean;
    /** Intervals (v_i, v_(i+1)] instead of [v_i, v_(i+1)). */
    leftOpen?: boolean;
}
/**
 * For each value, the number of break points at or below it (the interval index). Equivalent to R's
 * `findInterval()`; `vec` must be non-decreasing.
 */
export declare function findInterval(x: Sample, vec: readonly number[], options?: FindIntervalOptions): number[];
