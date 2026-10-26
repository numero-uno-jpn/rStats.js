// Missing values: R's complete.cases and na.omit for arrays and data frames.
//
// Written for rStats.js (no ported code) from oracle/formulatests-behaviour.md. A value is missing when it is `null`,
// or `NaN` (in a numeric column); a row is complete when no column of any argument is missing there.

import type { DataFrame } from "../models/modelFrame.js";

/** A vector: numbers (`NaN` missing), or strings, booleans or numbers with `null` for a missing value. */
export type MissingVector = readonly (number | string | boolean | null)[] | Float64Array;

const isMissing = (v: number | string | boolean | null): boolean => v === null || (typeof v === "number" && Number.isNaN(v));

const isVector = (x: MissingVector | DataFrame): x is MissingVector => Array.isArray(x) || ArrayBuffer.isView(x);

/** The columns of an argument (a vector is one column) and its number of rows */
function columnsOf(x: MissingVector | DataFrame): { columns: MissingVector[]; rows: number } {
  if (isVector(x)) return { columns: [x], rows: x.length };
  if (typeof x !== "object" || x === null) throw new TypeError("the arguments must be arrays or data frames");
  const columns = Object.values(x);
  const rows = columns[0]?.length ?? 0;
  if (columns.some((c) => c.length !== rows)) throw new RangeError("not all arguments have the same length");
  return { columns, rows };
}

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
export function completeCases(...args: (MissingVector | DataFrame)[]): boolean[] {
  if (args.length === 0) throw new RangeError("no input has determined the number of cases");
  const all = args.map(columnsOf);
  const rows = all[0]!.rows;
  if (all.some((a) => a.rows !== rows)) throw new RangeError("not all arguments have the same length");
  const columns = all.flatMap((a) => a.columns);
  return Array.from({ length: rows }, (_, i) => columns.every((c) => !isMissing(c[i]!)));
}

/**
 * The values that are not missing. Equivalent to R's `na.omit()` for a vector.
 *
 * @example
 * ```ts
 * naOmit([1, NaN, 3]); // [1, 3]
 * ```
 */
export function naOmit(x: readonly number[] | Float64Array): number[];
export function naOmit<T extends string | boolean | number>(x: readonly (T | null)[]): T[];
/**
 * The complete rows of a data frame. Equivalent to R's `na.omit()` for a data frame: the same columns, in order,
 * restricted to the rows where none is missing (`null`, or `NaN` in a numeric column); see {@link completeCases}.
 *
 * @example
 * ```ts
 * naOmit({ a: [1, NaN, 3], s: ["u", "v", null] }); // { a: [1], s: ["u"] }
 * ```
 */
export function naOmit<D extends DataFrame>(x: D): D;
export function naOmit(x: MissingVector | DataFrame): (number | string | boolean)[] | DataFrame {
  if (isVector(x)) return Array.from(x as ArrayLike<number | string | boolean | null>).filter((v): v is number | string | boolean => !isMissing(v));
  const keep = completeCases(x);
  const out: Record<string, readonly (number | string | boolean | null)[] | Float64Array> = {};
  for (const [name, column] of Object.entries(x)) {
    const kept = Array.from(column as ArrayLike<number | string | boolean | null>).filter((_, i) => keep[i]);
    out[name] = column instanceof Float64Array ? Float64Array.from(kept as number[]) : kept;
  }
  return out;
}
