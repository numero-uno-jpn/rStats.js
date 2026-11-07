import type { DataFrame } from "../models/modelFrame.js";
import { type DataValue } from "./dataFrames.js";
/**
 * Options for {@link pivotLonger} (tidyr's arguments in camelCase).
 *
 * @category Data frames
 */
export interface PivotLongerOptions {
    /** The columns to pivot: their names, in this order, or a test of the name (selecting in the data's order). */
    cols: readonly string[] | ((name: string) => boolean);
    /**
     * The columns to make from the names, one per part of the names. `".value"` marks the part that names the value
     * columns. With `[]`, no columns are made from the names (namesSep and namesPattern are not used). Default `"name"`.
     */
    namesTo?: string | readonly string[];
    /** A regular expression whose match at the start of the names is removed. */
    namesPrefix?: string;
    /** A regular expression at whose matches the names are split into the parts. */
    namesSep?: string;
    /** A regular expression whose capture groups are the parts of the names. */
    namesPattern?: string;
    /**
     * Functions applied to the parts, by `namesTo` column (the part as a string; missing parts stay missing). Own
     * properties only: a `namesTo` column named toString has no transform unless one is given. The transform of
     * `".value"` gives the names of the value columns, and must return strings.
     */
    namesTransform?: Readonly<Record<string, (part: string) => DataValue>>;
    /** The name of the value column (without `".value"` in `namesTo`). Default `"value"`. */
    valuesTo?: string;
    /** Drop the rows where every value column is missing. Default `false`. */
    valuesDropNa?: boolean;
    /**
     * `"fastest"` (default): the pivoted columns vary within each input row; `"slowest"`: all rows for each column in
     * turn. Any other value is an error, as in tidyr.
     */
    colsVary?: "fastest" | "slowest";
    /**
     * Called with each of tidyr's warnings, once per distinct warning, in order. Default: the warnings go to the handler
     * of {@link setWarningHandler} (none by default).
     */
    onWarning?: (message: string) => void;
}
/**
 * A summary of the values of one cell (in data order), for `valuesFn` of {@link pivotWider}.
 *
 * @category Data frames
 */
export type PivotSummary = (values: DataValue[]) => DataValue;
/**
 * Options for {@link pivotWider} (tidyr's arguments in camelCase).
 *
 * @category Data frames
 */
export interface PivotWiderOptions {
    /** The column (or columns) whose values name the new columns (at least one). Default `"name"`. */
    namesFrom?: string | readonly string[];
    /** The column (or columns) whose values fill the new columns (at least one). Default `"value"`. */
    valuesFrom?: string | readonly string[];
    /**
     * The columns that identify a row of the result. Default: every column not in `namesFrom` or `valuesFrom`, in the
     * data's order; when given, the other columns are dropped (a column of `namesFrom` or `valuesFrom` is an error).
     */
    idCols?: string | readonly string[];
    /** Put before each new name. Default `""`. */
    namesPrefix?: string;
    /** Joins the values of several `namesFrom` columns, and a value column's name to the name. Default `"_"`. */
    namesSep?: string;
    /** Sort the names (by the first `namesFrom` column, then the next) instead of taking them in order of appearance. */
    namesSort?: boolean;
    /**
     * With several `valuesFrom`: `"fastest"` (default) all names for each value column; `"slowest"` each value column
     * for each name. Any other value is an error, as in tidyr.
     */
    namesVary?: "fastest" | "slowest";
    /**
     * The value of a cell that no row fills, or such values by value column. Default: missing. As in tidyr, it is cast
     * to the type of the value column: a boolean becomes 0 or 1 in a numeric column, 0 and 1 become false and true in a
     * boolean column (NaN missing); any other mix (a string with a number or a boolean) is an error.
     */
    valuesFill?: DataValue | Readonly<Record<string, DataValue>>;
    /**
     * Summarises the values of each filled cell, or such functions by value column. As in tidyr, the results for one
     * value column take one common type: booleans become 0 and 1 if any result is a number; strings mixed with numbers
     * or booleans are an error.
     */
    valuesFn?: PivotSummary | Readonly<Record<string, PivotSummary>>;
}
/**
 * Reshapes a data frame from wide to long: the selected columns become rows. Equivalent to `tidyr::pivot_longer()` in
 * R. The result has the columns not selected, a column per part of the selected names (`namesTo`), and the value
 * column (`valuesTo`), or with `".value"` in `namesTo` one value column per value of that part. The values of the
 * selected columns are combined into one type: numbers with booleans give numbers; strings with either are an error.
 *
 * @example
 * ```ts
 * const wide = { id: ["s1", "s2"], t1: [5.1, 4.8], t2: [6.3, 7.2] };
 * pivotLonger(wide, { cols: ["t1", "t2"], namesTo: "time", valuesTo: "score" });
 * // { id: ["s1", "s1", "s2", "s2"], time: ["t1", "t2", "t1", "t2"], score: [5.1, 6.3, 4.8, 7.2] }
 * ```
 *
 * @category Data frames
 */
export declare function pivotLonger(data: DataFrame, options: PivotLongerOptions): DataFrame;
/**
 * Reshapes a data frame from long to wide: the values of `namesFrom` become columns, filled from `valuesFrom`.
 * Equivalent to `tidyr::pivot_wider()` in R. One row per combination of the id columns (in order of first appearance),
 * the new columns in order of first appearance of their names (unless `namesSort`). A cell that no row fills is
 * `valuesFill` (default missing). A cell that several rows fill is an error unless `valuesFn` summarises the values
 * (tidyr makes a list column there, which a data frame here cannot hold).
 *
 * @example
 * ```ts
 * const long = { id: ["s1", "s1", "s2"], time: ["t1", "t2", "t1"], score: [5.1, 6.3, 4.8] };
 * pivotWider(long, { namesFrom: "time", valuesFrom: "score" });
 * // { id: ["s1", "s2"], t1: [5.1, 4.8], t2: [6.3, null] }
 * ```
 *
 * @category Data frames
 */
export declare function pivotWider(data: DataFrame, options?: PivotWiderOptions): DataFrame;
