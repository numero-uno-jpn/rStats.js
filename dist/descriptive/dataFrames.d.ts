import { type DataFrame } from "../models/modelFrame.js";
/**
 * One value of a data frame column (`null`: missing).
 *
 * @category Data frames
 */
export type DataValue = number | string | boolean | null;
/**
 * A row of a data frame, as passed to the condition of {@link subset}: column name to value.
 *
 * @category Data frames
 */
export type DataRow = Record<string, DataValue>;
/** One column of a data frame. */
export type Column = DataFrame[string];
/** The number of rows of a data frame (0 without columns); all columns must have the same length */
export declare function rowCount(frame: DataFrame): number;
export declare const isMissing: (v: DataValue | undefined) => boolean;
/** A copy of a column restricted to the given rows */
export declare function pick(col: Column, rows: readonly number[]): Column;
/** Adds a column to a result under construction; names must be unique */
export declare function addColumn(out: DataFrame, name: string, col: Column): void;
/** Comparison of two values for sorting: numbers as numbers, text by code point, FALSE before TRUE, missing last */
export declare function compareValues(a: DataValue, b: DataValue): number;
/**
 * Options for {@link merge}.
 *
 * @category Data frames
 */
export interface MergeOptions {
    /** The key columns, in both frames. Default: the column names common to both, in x's order. */
    by?: string | readonly string[];
    /** The key columns of x. Default `by`. */
    byX?: string | readonly string[];
    /** The key columns of y (as many as `byX`, matched in order). Default `by`. */
    byY?: string | readonly string[];
    /** Keep the rows of both frames that have no match. Default `false`. */
    all?: boolean;
    /** Keep the rows of x that have no match in y (y's columns missing). Default `all`. */
    allX?: boolean;
    /** Keep the rows of y that have no match in x (x's columns missing). Default `all`. */
    allY?: boolean;
    /** Order the rows by the key. Default `true`. */
    sort?: boolean;
    /** Appended to the names of the non-key columns that occur in both frames. Default `[".x", ".y"]`. */
    suffixes?: readonly [string, string];
}
/**
 * Join two data frames on key columns. Equivalent to R's `merge()`. For data frames: every pair of rows of x and y
 * with equal keys (missing keys match each other), and with `allX` / `allY` the rows without a match. Columns: the keys
 * (named as in x), x's other columns, y's other columns; a non-key name present in both gets the suffixes. Rows are
 * ordered by the key unless `sort` is false (several keys: as text joined with "\r" unless `allX` or `allY`, as R
 * does); without key columns, the cross join (x varying fastest).
 *
 * @example
 * ```ts
 * const x = { id: [3, 1, 2], v: [10, 20, 30] };
 * const y = { id: [1, 2, 2, 4], w: [0.5, 1.5, 2.5, 3.5] };
 * merge(x, y);                  // { id: [1, 2, 2], v: [20, 30, 30], w: [0.5, 1.5, 2.5] }
 * merge(x, y, { all: true });   // also id 3 (w missing) and id 4 (v missing)
 * ```
 *
 * @category Data frames
 */
export declare function merge(x: DataFrame, y: DataFrame, options?: MergeOptions): DataFrame;
/**
 * Options for {@link subset}.
 *
 * @category Data frames
 */
export interface SubsetOptions {
    /** The columns to keep, in this order. Default: all, in their order. */
    select?: readonly string[];
}
/**
 * The rows of a data frame that meet a condition, and optionally some of its columns. Equivalent to R's `subset()`.
 * For a data frame: `keep` is a boolean per row or a function of the row; a missing (`null`) or non-boolean result
 * counts as false, as R drops the rows whose condition is NA.
 *
 * @example
 * ```ts
 * const d = { y: [5, NaN, 7, 2], g: ["a", "b", "a", "b"] };
 * subset(d, (row) => (row.y as number) > 4);         // { y: [5, 7], g: ["a", "a"] }
 * subset(d, [true, true, false, false], { select: ["g"] }); // { g: ["a", "b"] }
 * ```
 *
 * @category Data frames
 */
export declare function subset(data: DataFrame, keep: readonly (boolean | null)[] | ((row: DataRow) => boolean | null | undefined), options?: SubsetOptions): DataFrame;
/**
 * Stacks data frames with the same column names (matched by name, in the first frame's order). The data frame form
 * of R's `rbind()`; see {@link rbind}.
 */
export declare function rbindFrames(frames: readonly DataFrame[]): DataFrame;
/**
 * Puts data frames with the same number of rows side by side. The data frame form of R's `cbind()`; see
 * {@link cbind}. A column name that occurs twice is an error (an object cannot hold two columns of the same name).
 */
export declare function cbindFrames(frames: readonly DataFrame[]): DataFrame;
/**
 * Options of {@link fromRows}.
 *
 * @category Data frames
 */
export interface FromRowsOptions {
    /**
     * The columns to take, in this order. Default: every key that occurs in some row, in the order of first
     * appearance.
     */
    columns?: readonly string[];
}
/**
 * A data frame (an object of columns) from an array of row objects, the usual shape of JSON and of parsed CSV:
 * `[{ age: 30, score: 5 }, { age: 41, score: 7 }]` becomes `{ age: [30, 41], score: [5, 7] }`. A key that a row
 * lacks, and `undefined`, become `null` (a missing value). Values must be numbers, strings, booleans or `null`, and
 * one column may not mix numbers, strings and booleans. Not an R function. R reads data as data frames directly.
 *
 * @example
 * ```ts
 * fromRows([{ id: "a", score: 5 }, { id: "b" }]);   // { id: ["a", "b"], score: [5, null] }
 * ```
 *
 * @category Data frames
 */
export declare function fromRows(rows: readonly Readonly<Record<string, unknown>>[], options?: FromRowsOptions): DataFrame;
/**
 * The rows of a data frame as an array of objects, the inverse of {@link fromRows}: `{ age: [30, 41], score: [5, 7]
 * }` becomes `[{ age: 30, score: 5 }, { age: 41, score: 7 }]`. Missing values stay as they are (`null`, or `NaN` in a
 * numeric column). Not an R function. R keeps data in data frames and has no need for row objects.
 *
 * @example
 * ```ts
 * toRows({ id: ["a", "b"], score: [5, null] });   // [{ id: "a", score: 5 }, { id: "b", score: null }]
 * ```
 *
 * @category Data frames
 */
export declare function toRows(data: DataFrame): DataRow[];
