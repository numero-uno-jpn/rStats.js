import type { DataFrame } from "../models/modelFrame.js";
/** A vector: numbers (`NaN` missing), or strings, booleans or numbers with `null` for a missing value. */
export type MissingVector = readonly (number | string | boolean | null)[] | Float64Array;
/**
 * Which rows have no missing value. Equivalent to R's `complete.cases()`: one boolean per row, true when no column of
 * any argument is missing (`null`, or `NaN` in a numeric column) in that row.
 *
 * @param args Data frames (objects of equal-length columns) or arrays, all with the same number of rows.
 *
 * @example
 * ```ts
 * completeCases({ a: [1, NaN, 3], s: ["u", "v", null] }); // [true, false, false]
 * ```
 */
export declare function completeCases(...args: (MissingVector | DataFrame)[]): boolean[];
/**
 * The values that are not missing. Equivalent to R's `na.omit()` for a vector.
 *
 * @example
 * ```ts
 * naOmit([1, NaN, 3]); // [1, 3]
 * ```
 */
export declare function naOmit(x: readonly number[] | Float64Array): number[];
export declare function naOmit<T extends string | boolean | number>(x: readonly (T | null)[]): T[];
/**
 * The complete rows of a data frame. Equivalent to R's `na.omit()` for a data frame: the same columns, in order,
 * restricted to the rows where none is missing (`null`, or `NaN` in a numeric column); see {@link completeCases}.
 *
 * @example
 * ```ts
 * naOmit({ a: [1, NaN, 3], s: ["u", "v", null] }); // { a: [1], s: ["u"] }
 * ```
 */
export declare function naOmit<D extends DataFrame>(x: D): D;
