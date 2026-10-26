// Grouped summaries: R's tapply, split and aggregate.
//
// Written for rStats.js (no ported code) from oracle/grouping-behaviour.md. Group labels are turned into factors with
// the library's level rules: the sorted distinct non-missing values (numbers by value, strings by code point, FALSE
// before TRUE); numbers with the same 15-digit text are one level, as in R's factor() (src/internal/levels.ts). With several factors the groups are the cells of their cross classification in column-major order
// (the first factor varies fastest). A row whose label is missing (null, or NaN in a numeric column) belongs to no
// group. tapply keeps the empty cells (NaN or null), split keeps them unless `drop`, aggregate leaves them out.
// aggregate's grouping columns hold the labels of each group's first row, which for numbers may differ from the
// level's value.

import { formatR } from "../htest/core/simulate.js";
import { numberLevels } from "../internal/levels.js";
import { expandRhs, formulaVariables, parseFormula } from "../models/formula.js";
import { compareCodePoints, type DataFrame } from "../models/modelFrame.js";

/** A group label: a number, string or boolean; `null` (and `NaN`) is a missing label */
type Label = number | string | boolean | null;

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

/** The values of a vector to group: an array of any cells, or a Float64Array. */
type Cells<T> = readonly T[] | Float64Array;

/** A grouping factor: its levels and the 0-based level of each row (-1 for a missing label) */
interface GroupFactor {
  levels: GroupingLevel[];
  codes: number[];
}

/** Several grouping factors crossed: the levels of each, and the cell of each row (-1 when a label is missing) */
interface Grouping {
  factors: GroupFactor[];
  /** Number of cells (the product of the numbers of levels) */
  size: number;
  cells: number[];
}

const isMissing = (v: Label): boolean => v === null || (typeof v === "number" && Number.isNaN(v));

const levelOrder = (a: GroupingLevel, b: GroupingLevel): number =>
  typeof a === "number" ? a - (b as number) : typeof a === "string" ? compareCodePoints(a, b as string) : Number(a) - Number(b);

/** A level as R names it: numbers as as.character (15 significant digits), booleans as TRUE and FALSE */
const levelName = (v: GroupingLevel): string =>
  typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : typeof v === "string" ? v : Number.isFinite(v) ? formatR(v) : v > 0 ? "Inf" : "-Inf";

function factorOf(name: string, labels: GroupingLabels): GroupFactor {
  const vals = numberLevels(labels as ArrayLike<Label>); // numbers by their text; -0 is the label 0
  const kinds = new Set(vals.filter((v) => !isMissing(v)).map((v) => typeof v));
  if (kinds.size > 1) throw new TypeError(`${name} mixes ${[...kinds].join(" and ")} labels`);
  const kind = [...kinds][0];
  if (kind !== undefined && kind !== "number" && kind !== "string" && kind !== "boolean") {
    throw new TypeError(`${name} has labels of an unsupported type`);
  }
  const levels = [...new Set(vals.filter((v): v is GroupingLevel => !isMissing(v)))].sort(levelOrder);
  const pos = new Map<GroupingLevel, number>(levels.map((l, i) => [l, i]));
  return { levels, codes: vals.map((v) => (isMissing(v) ? -1 : pos.get(v as GroupingLevel)!)) };
}

const isLabelArray = (v: unknown): v is GroupingLabels => Array.isArray(v) || v instanceof Float64Array;

/** One array of labels, or an array of such arrays (one per factor), as a list of factors' labels */
function labelLists(index: GroupingLabels | readonly GroupingLabels[]): GroupingLabels[] {
  if (index instanceof Float64Array) return [index];
  if (!Array.isArray(index)) throw new TypeError("the group labels must be an array or an array of arrays");
  if (index.length > 0 && index.every(isLabelArray)) return [...(index as readonly GroupingLabels[])];
  if (index.some(isLabelArray)) throw new TypeError("the group labels must be an array or an array of arrays");
  return [index as GroupingLabels];
}

function groupingOf(lists: readonly GroupingLabels[], names: readonly string[], n: number): Grouping {
  lists.forEach((l, j) => {
    if (l.length !== n) throw new RangeError(`${names[j]} must have one label per row (${n}), not ${l.length}`);
  });
  const factors = lists.map((l, j) => factorOf(names[j]!, l));
  const size = factors.reduce((s, f) => s * f.levels.length, 1);
  const cells = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let cell = 0;
    let stride = 1;
    for (const f of factors) {
      const c = f.codes[i]!;
      if (c < 0) {
        cell = -1;
        break;
      }
      cell += c * stride;
      stride *= f.levels.length;
    }
    cells[i] = cell;
  }
  return { factors, size, cells };
}

/** The rows (0-based) of each cell, in row order; an empty array for an empty cell */
function rowsByCell(g: Grouping): number[][] {
  const rows = Array.from({ length: g.size }, (): number[] => []);
  g.cells.forEach((c, i) => {
    if (c >= 0) rows[c]!.push(i);
  });
  return rows;
}

/** The level of each factor in a cell */
function cellLevels(g: Grouping, cell: number): GroupingLevel[] {
  return g.factors.map((f) => {
    const k = f.levels.length;
    const level = f.levels[cell % k]!;
    cell = Math.floor(cell / k);
    return level;
  });
}

const factorNames = (count: number, what: string): string[] =>
  Array.from({ length: count }, (_, j) => (count === 1 ? what : `${what}[${j}]`));

// ---- tapply ----

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
export function tapply<T, R>(x: readonly T[] | Float64Array, index: GroupingLabels | readonly GroupingLabels[], fun: (values: T[]) => R): TapplyResult<R> {
  const xs = Array.from(x as ArrayLike<T>);
  const lists = labelLists(index);
  const g = groupingOf(lists, factorNames(lists.length, "index"), xs.length);
  const results = rowsByCell(g).map((rows) => (rows.length === 0 ? null : { value: fun(rows.map((i) => xs[i]!)) }));
  const scalar = results.every((r) => r === null || typeof r.value === "number");
  const values = scalar ? results.map((r) => (r === null ? NaN : (r.value as number))) : results.map((r) => (r === null ? null : r.value));
  return {
    dim: g.factors.map((f) => f.levels.length),
    dimnames: g.factors.map((f) => [...f.levels]),
    values: values as TapplyResult<R>["values"],
  };
}

// ---- split ----

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

/** The rows of a data frame, each column keeping its kind (array or Float64Array) */
function rowsOf(data: DataFrame, rows: readonly number[]): DataFrame {
  const out: DataFrame = {};
  for (const [name, col] of Object.entries(data)) {
    out[name] = col instanceof Float64Array ? Float64Array.from(rows, (i) => col[i]!) : rows.map((i) => col[i]!);
  }
  return out;
}

function rowCount(data: DataFrame): number {
  const cols = Object.values(data);
  const n = cols[0]?.length ?? 0;
  for (const [name, col] of Object.entries(data)) {
    if (!isLabelArray(col)) throw new TypeError(`column '${name}' must be an array`);
    if (col.length !== n) throw new RangeError(`the columns of the data frame have different lengths (found for '${name}')`);
  }
  return n;
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
export function split(x: DataFrame, f: GroupingLabels | readonly GroupingLabels[], options?: SplitOptions): Map<string, DataFrame>;
export function split(x: Float64Array, f: GroupingLabels | readonly GroupingLabels[], options?: SplitOptions): Map<string, number[]>;
export function split<T>(x: readonly T[], f: GroupingLabels | readonly GroupingLabels[], options?: SplitOptions): Map<string, T[]>;
export function split<T>(
  x: readonly T[] | Float64Array | DataFrame,
  f: GroupingLabels | readonly GroupingLabels[],
  options: SplitOptions = {},
): Map<string, T[] | number[] | DataFrame> {
  const sep = options.sep ?? ".";
  const lists = labelLists(f);
  const frame = !isLabelArray(x);
  if (frame && (typeof x !== "object" || x === null)) throw new TypeError("x must be an array or a data frame");
  const n = frame ? rowCount(x as DataFrame) : (x as Cells<T>).length;
  const g = groupingOf(lists, factorNames(lists.length, "f"), n);
  const xs = frame ? [] : Array.from(x as Cells<T> as ArrayLike<T>);
  const out = new Map<string, T[] | number[] | DataFrame>();
  rowsByCell(g).forEach((rows, cell) => {
    if (rows.length === 0 && (options.drop || g.factors.length === 1)) return;
    const name = cellLevels(g, cell).map(levelName).join(sep);
    out.set(name, frame ? rowsOf(x as DataFrame, rows) : rows.map((i) => xs[i]!));
  });
  return out;
}

// ---- aggregate ----

/**
 * What the function of {@link aggregate} returns for a group: a number, an array of numbers, or named numbers.
 *
 * @category Data frames
 */
export type AggregateValue = number | readonly number[] | Readonly<Record<string, number>>;

/** A summarised column as numbers (null is NaN) */
function numericColumn(name: string, col: DataFrame[string] | undefined): number[] {
  if (col === undefined) throw new Error(`object '${name}' not found`);
  if (!isLabelArray(col)) throw new TypeError(`column '${name}' must be an array`);
  return Array.from(col as ArrayLike<Label>, (v) => {
    if (v === null) return NaN;
    if (typeof v !== "number") throw new TypeError(`column '${name}' to summarise must be numeric`);
    return v;
  });
}

function labelColumn(data: DataFrame, name: string): GroupingLabels {
  const col = Object.prototype.hasOwnProperty.call(data, name) ? data[name] : undefined;
  if (col === undefined) throw new Error(`object '${name}' not found`);
  if (!isLabelArray(col)) throw new TypeError(`column '${name}' must be an array`);
  return col;
}

/**
 * The summarised and the grouping columns of a formula: the grouping columns are all the variables of the right-hand
 * side in order of first appearance, whatever its operators (`y ~ g:h`, `y ~ g*h` and `y ~ g + h - g` all group by g
 * and h; `y ~ 1` by nothing); `.` on the right stands for every column not summarised, on the left for every column
 * not on the right.
 */
function aggregateFormula(formula: string, columns: readonly string[]): { values: string[]; groups: string[] } {
  if (typeof formula !== "string") throw new TypeError("the formula must be a string");
  const tilde = formula.indexOf("~");
  if (tilde < 0) throw new SyntaxError("invalid formula: missing '~'");
  const lhs = formula.slice(0, tilde).trim();
  const { rhs } = parseFormula(`~ ${formula.slice(tilde + 1)}`);
  const name = /^[A-Za-z.][A-Za-z0-9._]*$/;
  let values: string[] | undefined;
  if (lhs !== ".") {
    const m = /^cbind\s*\((.*)\)$/s.exec(lhs);
    values = m === null ? [lhs] : m[1]!.split(",").map((s) => s.trim());
    if (values.some((v) => !name.test(v) || v === ".")) {
      throw new SyntaxError("invalid formula: the left-hand side must be a variable, cbind(...) of variables or '.'");
    }
  } else if (formulaVariables(rhs, []).length < formulaVariables(rhs, ["."]).length) {
    throw new SyntaxError("invalid formula: '.' cannot be on both sides");
  }
  const dot = values === undefined ? [] : columns.filter((c) => !values.includes(c));
  const groups = formulaVariables(rhs, dot);
  // (the expansion's errors, such as a number that is not a term or an invalid power, as R's terms())
  expandRhs(rhs, () => 0, dot);
  return { values: values ?? columns.filter((c) => !groups.includes(c)), groups };
}

function aggregateRows(
  valueNames: readonly string[],
  valueCols: readonly number[][],
  groupNames: readonly string[],
  groupCols: readonly GroupingLabels[],
  keep: (row: number) => boolean,
  fun: (values: number[]) => AggregateValue,
): DataFrame {
  // (y ~ 1: no grouping column, one group of all the rows)
  const n = groupCols[0]?.length ?? valueCols[0]?.length ?? 0;
  valueNames.forEach((v, j) => {
    if (valueCols[j]!.length !== n) throw new RangeError(`variable lengths differ (found for '${v}')`);
  });
  const g = groupingOf(groupCols, groupNames, n);
  const cells = rowsByCell(g).map((rows, cell) => ({ cell, rows: rows.filter(keep) })).filter((c) => c.rows.length > 0);
  const out: DataFrame = {};
  // The labels of each group's first row (-0 as 0), as R keeps them
  groupNames.forEach((name, j) => {
    const col = groupCols[j]!;
    out[name] = cells.map((c) => {
      const v = col[c.rows[0]!]!;
      return v === 0 ? 0 : v;
    });
  });
  valueNames.forEach((name, j) => {
    const col = valueCols[j]!;
    const results = cells.map((c) => fun(c.rows.map((i) => col[i]!)));
    const flat = results.map((r): { names: string[] | undefined; values: number[] } => {
      if (typeof r === "number") return { names: undefined, values: [r] };
      if (Array.isArray(r)) return { names: undefined, values: [...(r as readonly number[])] };
      const rec = r as Readonly<Record<string, number>>;
      return { names: Object.keys(rec), values: Object.values(rec) };
    });
    const k = flat[0]?.values.length ?? 1;
    if (flat.some((r) => r.values.length !== k)) throw new RangeError("fun must return values of the same length for every group");
    if (k === 1 && flat[0]?.names === undefined) {
      out[name] = flat.map((r) => r.values[0]!);
      return;
    }
    for (let m = 0; m < k; m++) {
      const suffix = flat[0]!.names?.[m] ?? String(m + 1);
      out[`${name}.${suffix}`] = flat.map((r) => r.values[m]!);
    }
  });
  return out;
}

/**
 * The function applied to the values of each group, as a data frame. Equivalent to R's `aggregate()`.
 *
 * Formula form, `aggregate(formula, data, fun)`: `"y ~ g"`, `"y ~ g + h"`, `"cbind(y, z) ~ g"` or `". ~ g"` (every
 * column not on the right). The grouping variables are all the variables of the right-hand side in order of first
 * appearance, whatever its operators (`"y ~ g:h"` and `"y ~ g * h"` group by g and h); `"y ~ ."` groups by every
 * column not summarised, and `"y ~ 1"` gives one row without a grouping column. The rows with a missing value in any
 * variable of the formula are dropped first. Data frame form, `aggregate(x, by, fun)`: the columns of `x` summarised
 * by the label columns of `by` (its keys name them); only the rows with a missing label are dropped, so `fun` sees the
 * missing values of `x`.
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
export function aggregate(formula: string, data: DataFrame, fun: (values: number[]) => AggregateValue): DataFrame;
export function aggregate(x: DataFrame, by: Readonly<Record<string, GroupingLabels>>, fun: (values: number[]) => AggregateValue): DataFrame;
export function aggregate(
  first: string | DataFrame,
  second: DataFrame | Readonly<Record<string, GroupingLabels>>,
  fun: (values: number[]) => AggregateValue,
): DataFrame {
  if (typeof second !== "object" || second === null) throw new TypeError("the data must be an object of columns");
  if (typeof first === "string") {
    const data = second as DataFrame;
    const { values, groups } = aggregateFormula(first, Object.keys(data));
    const has = (v: string) => Object.prototype.hasOwnProperty.call(data, v);
    const valueCols = values.map((v) => numericColumn(v, has(v) ? data[v] : undefined));
    const groupCols = groups.map((v) => labelColumn(data, v));
    const keep = (i: number) => valueCols.every((c) => !Number.isNaN(c[i]!)) && groupCols.every((c) => !isMissing(c[i]!));
    return aggregateRows(values, valueCols, groups, groupCols, keep, fun);
  }
  if (typeof first !== "object" || first === null) throw new TypeError("x must be a data frame");
  const values = Object.keys(first);
  const valueCols = values.map((v) => numericColumn(v, first[v]));
  const groups = Object.keys(second);
  if (groups.length === 0) throw new RangeError("'by' must name at least one grouping column");
  const groupCols = groups.map((v) => labelColumn(second as DataFrame, v));
  return aggregateRows(values, valueCols, groups, groupCols, () => true, fun);
}
