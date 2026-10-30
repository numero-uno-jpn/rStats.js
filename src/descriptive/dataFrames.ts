// Data frame operations: R's merge (merge.data.frame), subset (subset.data.frame), and rbind and cbind of data frames;
// and fromRows / toRows, the conversion to and from arrays of row objects (not R functions).
//
// Written for rStats.js (no ported code) from oracle/dataframes-behaviour.md. A data frame is an object of columns
// (the library's DataFrame); `null`, and `NaN` in a numeric column, is a missing value. A Float64Array column stays a
// Float64Array (missing values filled in as NaN); any other column becomes an array (missing values filled in as
// null). merge reproduces R's row order exactly, including the order that R's (unstable) Shell sort of the row
// indices gives to rows that share a key.

import { compareCodePoints, type DataFrame } from "../models/modelFrame.js";

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
export function rowCount(frame: DataFrame): number {
  const cols = Object.values(frame);
  const n = cols[0]?.length ?? 0;
  if (cols.some((c) => c.length !== n)) throw new RangeError("the columns of a data frame must have the same length");
  return n;
}

export const isMissing = (v: DataValue | undefined): boolean => v === null || v === undefined || (typeof v === "number" && Number.isNaN(v));

const valueAt = (col: Column, i: number): DataValue => col[i]!;

/**
 * A new column of the values of the source columns at the given rows: `rows[k]` is [column, row] or `null` for a
 * missing value. A Float64Array if all sources are Float64Arrays, else an array.
 */
function gather(sources: readonly Column[], rows: readonly ([Column, number] | null)[]): Column {
  if (sources.length > 0 && sources.every((c) => c instanceof Float64Array)) {
    const out = new Float64Array(rows.length);
    rows.forEach((r, k) => (out[k] = r === null ? NaN : (r[0][r[1]] as number)));
    return out;
  }
  return rows.map((r) => (r === null ? null : valueAt(r[0], r[1])));
}

/** A copy of a column restricted to the given rows */
export function pick(col: Column, rows: readonly number[]): Column {
  return col instanceof Float64Array ? Float64Array.from(rows, (i) => col[i]!) : rows.map((i) => valueAt(col, i));
}

/** Adds a column to a result under construction; names must be unique */
export function addColumn(out: DataFrame, name: string, col: Column): void {
  if (Object.hasOwn(out, name)) throw new Error(`duplicate column name '${name}'`);
  // defineProperty, so that a column named "__proto__" is an own column rather than setting the prototype
  Object.defineProperty(out, name, { value: col, enumerable: true, writable: true, configurable: true });
}

/**
 * A number as R's as.character writes it: up to 15 significant digits, in fixed notation unless the scientific one
 * is narrower ("1e+05", "123456", "0.001", "1e-04").
 */
function numberText(x: number): string {
  if (Number.isNaN(x)) return "NA";
  if (!Number.isFinite(x)) return x > 0 ? "Inf" : "-Inf";
  if (x === 0) return "0";
  const [mant, expPart] = Number(x.toPrecision(15)).toExponential().split("e") as [string, string];
  const negative = mant.startsWith("-");
  const digits = mant.replace("-", "").replace(".", "");
  const exp = Number(expPart);
  const nd = digits.length;
  const expDigits = String(Math.abs(exp)).padStart(2, "0");
  const sciWidth = nd + (nd > 1 ? 1 : 0) + 2 + expDigits.length;
  const fixedWidth = exp >= 0 ? Math.max(exp + 1, nd) + (nd > exp + 1 ? 1 : 0) : 2 - exp - 1 + nd;
  const sign = negative ? "-" : "";
  if (fixedWidth > sciWidth) {
    return `${sign}${digits[0]}${nd > 1 ? `.${digits.slice(1)}` : ""}e${exp < 0 ? "-" : "+"}${expDigits}`;
  }
  if (exp < 0) return `${sign}0.${"0".repeat(-exp - 1)}${digits}`;
  if (nd <= exp + 1) return `${sign}${digits}${"0".repeat(exp + 1 - nd)}`;
  return `${sign}${digits.slice(0, exp + 1)}.${digits.slice(exp + 1)}`;
}

/** A value as text, as in R's paste of key columns ("NA" for a missing value) */
function valueText(v: DataValue): string {
  if (isMissing(v)) return "NA";
  if (typeof v === "number") return numberText(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return v as string;
}

const MISSING_KEY = Symbol("NA");
type Key = number | string | boolean | typeof MISSING_KEY;

/** The order of values of one type: numbers, then strings, then booleans (a column holds one type) */
const typeRank = (v: number | string | boolean): number => (typeof v === "number" ? 0 : typeof v === "string" ? 1 : 2);

/** Comparison of two values for sorting: numbers as numbers, text by code point, FALSE before TRUE, missing last */
export function compareValues(a: DataValue, b: DataValue): number {
  const ma = isMissing(a);
  const mb = isMissing(b);
  if (ma || mb) return ma === mb ? 0 : ma ? 1 : -1;
  const x = a as number | string | boolean;
  const y = b as number | string | boolean;
  if (typeof x !== typeof y) return typeRank(x) - typeRank(y);
  if (typeof x === "string") return compareCodePoints(x, y as string);
  return Number(x) - Number(y);
}

/**
 * The permutation that sorts `values` by R's Shell sort of row indices (Knuth's increments; not stable): 0-based
 * row numbers in sorted order.
 */
function shellOrder(values: readonly number[]): number[] {
  const n = values.length;
  const v = [...values];
  const rows = values.map((_, i) => i);
  let h = 1;
  while (h <= Math.trunc(n / 9)) h = 3 * h + 1;
  for (; h > 0; h = Math.trunc(h / 3)) {
    for (let i = h; i < n; i++) {
      const value = v[i]!;
      const row = rows[i]!;
      let j = i;
      while (j >= h && v[j - h]! > value) {
        v[j] = v[j - h]!;
        rows[j] = rows[j - h]!;
        j -= h;
      }
      v[j] = value;
      rows[j] = row;
    }
  }
  return rows;
}

/** The sorted rows split into the unmatched ones (value 0) and the groups of rows with the same positive value */
function groupSorted(values: readonly number[]): { alone: number[]; groups: Map<number, number[]> } {
  const alone: number[] = [];
  const groups = new Map<number, number[]>();
  for (const r of shellOrder(values)) {
    const v = values[r]!;
    if (v === 0) alone.push(r);
    else {
      const g = groups.get(v);
      if (g === undefined) groups.set(v, [r]);
      else g.push(r);
    }
  }
  return { alone, groups };
}

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

const nameList = (v: string | readonly string[]): string[] => (typeof v === "string" ? [v] : [...v]);

/** The key columns named, each a column of the frame */
function keyColumns(frame: DataFrame, names: readonly string[]): Column[] {
  return names.map((n) => {
    if (!Object.hasOwn(frame, n)) throw new Error("'by' must specify a uniquely valid column");
    return frame[n]!;
  });
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
export function merge(x: DataFrame, y: DataFrame, options: MergeOptions = {}): DataFrame {
  const xNames = Object.keys(x);
  const yNames = Object.keys(y);
  const nx = rowCount(x);
  const ny = rowCount(y);
  const byDefault = options.by === undefined ? xNames.filter((n) => yNames.includes(n)) : nameList(options.by);
  const byX = options.byX === undefined ? byDefault : nameList(options.byX);
  const byY = options.byY === undefined ? byDefault : nameList(options.byY);
  const keysX = keyColumns(x, byX);
  const keysY = keyColumns(y, byY);
  if (byX.length !== byY.length) throw new Error("'by.x' and 'by.y' specify different numbers of columns");
  const allX = options.allX ?? options.all ?? false;
  const allY = options.allY ?? options.all ?? false;
  const sort = options.sort ?? true;
  const [suffixX, suffixY] = options.suffixes ?? [".x", ".y"];

  const restX = xNames.filter((n) => !byX.includes(n));
  const restY = yNames.filter((n) => !byY.includes(n));
  const nameX = (n: string): string => (restY.includes(n) ? n + suffixX : n);
  const nameY = (n: string): string => (restX.includes(n) || byX.includes(n) ? n + suffixY : n);

  // Pairs of rows of the result: [x row, y row], -1 for a missing side
  const pairs: [number, number][] = [];
  if (byX.length === 0) {
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) pairs.push([i, j]);
  } else {
    const keyOf =
      byX.length === 1
        ? (cols: readonly Column[], i: number): Key => {
            const v = valueAt(cols[0]!, i);
            return isMissing(v) ? MISSING_KEY : (v as number | string | boolean);
          }
        : // Matched on the values' text, as R, but encoded unambiguously: R pastes them with "\r", so that a key
          // containing "\r", or "NA" against a missing value, matches a different key
          (cols: readonly Column[], i: number): Key =>
            JSON.stringify(cols.map((c) => (isMissing(valueAt(c, i)) ? null : valueText(valueAt(c, i)))));
    const kx = Array.from({ length: nx }, (_, i) => keyOf(keysX, i));
    const ky = Array.from({ length: ny }, (_, j) => keyOf(keysY, j));
    const inY = new Set(ky);
    // position (1-based) of each key's first occurrence among the x keys that occur in y (duplicates kept)
    const position = new Map<Key, number>();
    let p = 0;
    for (const k of kx) {
      if (!inY.has(k)) continue;
      p++;
      if (!position.has(k)) position.set(k, p);
    }
    const sx = groupSorted(kx.map((k) => position.get(k) ?? 0));
    const sy = groupSorted(ky.map((k) => position.get(k) ?? 0));
    for (const [value, rowsX] of sx.groups) {
      const rowsY = sy.groups.get(value) ?? [];
      for (const i of rowsX) for (const j of rowsY) pairs.push([i, j]);
    }
    if (allX) for (const i of sx.alone) pairs.push([i, -1]);
    if (allY) for (const j of sy.alone) pairs.push([-1, j]);
  }

  // Rows sorted stably by the key
  let order = pairs.map((_, r) => r);
  if (sort && byX.length > 0) {
    const keyValue = (r: number, k: number): DataValue => {
      const [i, j] = pairs[r]!;
      return i >= 0 ? valueAt(keysX[k]!, i) : valueAt(keysY[k]!, j);
    };
    if (byX.length > 1 && !allX && !allY) {
      const text = pairs.map((_, r) => byX.map((_, k) => valueText(keyValue(r, k))).join("\r"));
      order.sort((a, b) => compareCodePoints(text[a]!, text[b]!));
    } else {
      order.sort((a, b) => {
        for (let k = 0; k < byX.length; k++) {
          const d = compareValues(keyValue(a, k), keyValue(b, k));
          if (d !== 0) return d;
        }
        return 0;
      });
    }
  }
  const sorted = order.map((r) => pairs[r]!);

  const out: DataFrame = {};
  byX.forEach((n, k) => {
    const cx = keysX[k]!;
    const cy = keysY[k]!;
    addColumn(out, n, gather([cx, cy], sorted.map(([i, j]) => (i >= 0 ? [cx, i] : [cy, j]))));
  });
  for (const n of restX) {
    const c = x[n]!;
    addColumn(out, nameX(n), gather([c], sorted.map(([i]) => (i >= 0 ? [c, i] : null))));
  }
  for (const n of restY) {
    const c = y[n]!;
    addColumn(out, nameY(n), gather([c], sorted.map(([, j]) => (j >= 0 ? [c, j] : null))));
  }
  return out;
}

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
export function subset(
  data: DataFrame,
  keep: readonly (boolean | null)[] | ((row: DataRow) => boolean | null | undefined),
  options: SubsetOptions = {},
): DataFrame {
  const names = Object.keys(data);
  const n = rowCount(data);
  if (typeof keep !== "function" && keep.length !== n) {
    throw new RangeError(`'keep' has ${keep.length} values for ${n} rows`);
  }
  const rowAt = (i: number): DataRow => Object.fromEntries(names.map((c) => [c, valueAt(data[c]!, i)]));
  const rows: number[] = [];
  for (let i = 0; i < n; i++) if ((typeof keep === "function" ? keep(rowAt(i)) : keep[i]) === true) rows.push(i);
  const select = options.select ?? names;
  const out: DataFrame = {};
  for (const c of select) {
    if (!Object.hasOwn(data, c)) throw new Error("undefined columns selected");
    addColumn(out, c, pick(data[c]!, rows));
  }
  return out;
}

/**
 * Stacks data frames with the same column names (matched by name, in the first frame's order). The data frame form
 * of R's `rbind()`; see {@link rbind}.
 */
export function rbindFrames(frames: readonly DataFrame[]): DataFrame {
  if (frames.length === 0) return {};
  const names = Object.keys(frames[0]!);
  for (const f of frames) {
    rowCount(f);
    const other = Object.keys(f);
    if (other.length !== names.length || !names.every((n) => Object.hasOwn(f, n))) {
      throw new Error("names do not match previous names");
    }
  }
  const out: DataFrame = {};
  for (const n of names) {
    const cols = frames.map((f) => f[n]!);
    const rows = cols.flatMap((c) => Array.from({ length: c.length }, (_, i): [Column, number] => [c, i]));
    addColumn(out, n, commonType(gather(cols, rows)));
  }
  return out;
}

/**
 * A column of mixed value types converted to their common type, as R's rbind does: text if any value is text
 * (numbers as as.character writes them, logicals as "TRUE" / "FALSE"), otherwise numbers (TRUE as 1) when numbers
 * and logicals are mixed
 */
function commonType(col: Column): Column {
  if (col instanceof Float64Array) return col;
  const kinds = new Set(col.filter((v) => !isMissing(v)).map((v) => typeof v));
  if (kinds.size < 2) return col;
  if (kinds.has("string")) return col.map((v) => (isMissing(v) ? null : typeof v === "string" ? v : valueText(v)));
  return col.map((v) => (isMissing(v) ? null : typeof v === "boolean" ? (v ? 1 : 0) : v));
}

/**
 * Puts data frames with the same number of rows side by side. The data frame form of R's `cbind()`; see
 * {@link cbind}. A column name that occurs twice is an error (an object cannot hold two columns of the same name).
 */
export function cbindFrames(frames: readonly DataFrame[]): DataFrame {
  const out: DataFrame = {};
  const counts = frames.map(rowCount);
  const differing = counts.find((c) => c !== counts[0]);
  if (differing !== undefined) throw new RangeError(`arguments imply differing number of rows: ${counts[0]}, ${differing}`);
  for (const f of frames) {
    for (const [n, c] of Object.entries(f)) addColumn(out, n, c instanceof Float64Array ? Float64Array.from(c) : [...c]);
  }
  return out;
}

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
export function fromRows(rows: readonly Readonly<Record<string, unknown>>[], options: FromRowsOptions = {}): DataFrame {
  let names = options.columns;
  if (names === undefined) {
    const seen = new Set<string>();
    for (const row of rows) for (const k of Object.keys(row)) seen.add(k);
    names = [...seen];
  }
  const out: DataFrame = {};
  for (const name of names) {
    const kinds = new Set<string>();
    const col = rows.map((row, i): DataValue => {
      const v = Object.hasOwn(row, name) ? row[name] : undefined;
      if (v === undefined || v === null) return null;
      if (typeof v !== "number" && typeof v !== "string" && typeof v !== "boolean") {
        throw new TypeError(`row ${i}, column '${name}': values must be numbers, strings, booleans or null`);
      }
      kinds.add(typeof v);
      return v;
    });
    if (kinds.size > 1) throw new TypeError(`column '${name}' mixes ${[...kinds].join(" and ")} values`);
    addColumn(out, name, col);
  }
  return out;
}

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
export function toRows(data: DataFrame): DataRow[] {
  const names = Object.keys(data);
  const n = rowCount(data);
  return Array.from({ length: n }, (_, i) => Object.fromEntries(names.map((c) => [c, valueAt(data[c]!, i)])));
}
