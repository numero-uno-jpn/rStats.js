import { type DataFrame } from "../models/modelFrame.js";
/**
 * A level of a grouping factor (a label that is not missing).
 *
 * @category Data frames
 */
export type GroupingLevel = number | string | boolean;
/**
 * The group labels of the rows: one per row.
 *
 * @category Data frames
 */
export type GroupingLabels = readonly (number | string | boolean | null)[] | Float64Array;
/**
 * Result of {@link tapply}.
 *
 * @category Data frames
 */
export interface TapplyResult<R> {
    /** The number of levels of each factor. */
    dim: number[];
    /** The levels of each factor (numbers as numbers). */
    dimnames: GroupingLevel[][];
    /**
     * The cells in column-major order (the first factor varies fastest). When the function gave a single number for
     * every non-empty cell, numbers with NaN for the empty cells; otherwise the function's results, `null` for the
     * empty cells.
     */
    values: [R] extends [number] ? number[] : (R | null)[];
}
/**
 * The function applied to the values of each group. Equivalent to R's `tapply(x, index, fun)`.
 *
 * `index` is one array of group labels (one per value of `x`) or an array of such arrays, one per factor. The
 * function is called only for the non-empty cells; a value of `x` whose label is missing is left out.
 *
 * @example
 * ```ts
 * tapply([1, 2, 3, 4], ["b", "a", "b", "a"], (v) => v.length); // { dim: [2], dimnames: [["a", "b"]], values: [2, 2] }
 * ```
 *
 * @category Data frames
 */
export declare function tapply<T, R>(x: readonly T[] | Float64Array, index: GroupingLabels | readonly GroupingLabels[], fun: (values: T[]) => R): TapplyResult<R>;
/**
 * Options for {@link split}.
 *
 * @category Data frames
 */
export interface SplitOptions {
    /** With several factors, leave out the combinations without a row. Default `false`. */
    drop?: boolean;
    /** The separator of the levels in the names of combinations. Default `"."`. */
    sep?: string;
}
/**
 * The values of `x` (or the rows of a data frame) divided into groups. Equivalent to R's `split(x, f, drop, sep)`.
 *
 * `f` is one array of group labels or an array of such arrays, one per factor. The result is a `Map` from the group's
 * name to its values, in R's order: with one factor its levels; with several every combination of their levels (the
 * first factor varying fastest), named by joining the levels with `sep`, the empty ones included unless `drop`.
 * Values whose label is missing are left out.
 *
 * @example
 * ```ts
 * split([1, 2, 3], ["b", "a", "b"]); // Map { "a" => [2], "b" => [1, 3] }
 * ```
 *
 * @category Data frames
 */
export declare function split(x: DataFrame, f: GroupingLabels | readonly GroupingLabels[], options?: SplitOptions): Map<string, DataFrame>;
export declare function split(x: Float64Array, f: GroupingLabels | readonly GroupingLabels[], options?: SplitOptions): Map<string, number[]>;
export declare function split<T>(x: readonly T[], f: GroupingLabels | readonly GroupingLabels[], options?: SplitOptions): Map<string, T[]>;
/**
 * What the function of {@link aggregate} returns for a group: a number, an array of numbers, or named numbers.
 *
 * @category Data frames
 */
export type AggregateValue = number | readonly number[] | Readonly<Record<string, number>>;
/**
 * The function applied to the values of each group, as a data frame. Equivalent to R's `aggregate()`.
 *
 * Formula form, `aggregate(formula, data, fun)`: `"y ~ g"`, `"y ~ g + h"`, `"cbind(y, z) ~ g"` or `". ~ g"` (every
 * column not on the right); the rows with a missing value in any variable of the formula are dropped first. Data
 * frame form, `aggregate(x, by, fun)`: the columns of `x` summarised by the label columns of `by` (its keys name
 * them); only the rows with a missing label are dropped, so `fun` sees the missing values of `x`.
 *
 * The result has the grouping columns first (with the labels as in the data), then one column per summarised column,
 * and one row per non-empty combination of the groups (the first factor varying fastest). When `fun` returns k > 1
 * values, a summarised column `y` becomes `y.1`, ..., `y.k` (an array) or `y.<name>` (an object of numbers).
 *
 * @example
 * ```ts
 * aggregate("y ~ g", { y: [1, 2, 3, 4], g: ["b", "a", "b", "a"] }, mean); // { g: ["a", "b"], y: [3, 2] }
 * ```
 *
 * @category Data frames
 */
export declare function aggregate(formula: string, data: DataFrame, fun: (values: number[]) => AggregateValue): DataFrame;
export declare function aggregate(x: DataFrame, by: Readonly<Record<string, GroupingLabels>>, fun: (values: number[]) => AggregateValue): DataFrame;
