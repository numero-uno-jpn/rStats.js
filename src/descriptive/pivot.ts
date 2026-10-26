// Wide and long formats: tidyr's pivot_longer and pivot_wider.
//
// Written for rStats.js (no ported code) from oracle/pivot-behaviour.md. A data frame is the library's DataFrame (see
// dataFrames.ts): `null`, and `NaN` in a numeric column, is a missing value. Columns that are copied through (the
// columns not pivoted, the id columns) keep their kind (a Float64Array stays a Float64Array); a value column is a
// Float64Array when its sources are, else an array. Where tidyr would make a list column (a cell that several rows
// fill), pivotWider throws instead, since a data frame here cannot hold one. pivotLonger passes tidyr's warnings to
// its `onWarning` option.

import { formatR } from "../htest/core/simulate.js";
import type { DataFrame } from "../models/modelFrame.js";
import { addColumn, compareValues, isMissing, pick, rowCount, type Column, type DataValue } from "./dataFrames.js";

/** Options for {@link pivotLonger} (tidyr's arguments in camelCase). */
export interface PivotLongerOptions {
  /** The columns to pivot: their names, in this order, or a test of the name (selecting in the data's order). */
  cols: readonly string[] | ((name: string) => boolean);
  /**
   * The columns to make from the names, one per part of the names. `".value"` marks the part that names the value
   * columns. Default `"name"`.
   */
  namesTo?: string | readonly string[];
  /** A regular expression whose match at the start of the names is removed. */
  namesPrefix?: string;
  /** A regular expression at whose matches the names are split into the parts. */
  namesSep?: string;
  /** A regular expression whose capture groups are the parts of the names. */
  namesPattern?: string;
  /** Functions applied to the parts, by `namesTo` column (the part as a string; missing parts stay missing). */
  namesTransform?: Readonly<Record<string, (part: string) => DataValue>>;
  /** The name of the value column (without `".value"` in `namesTo`). Default `"value"`. */
  valuesTo?: string;
  /** Drop the rows where every value column is missing. Default `false`. */
  valuesDropNa?: boolean;
  /**
   * `"fastest"` (default): the pivoted columns vary within each input row; `"slowest"`: all rows for each column in
   * turn.
   */
  colsVary?: "fastest" | "slowest";
  /** Called with each of tidyr's warnings, once per distinct warning, in order. Default: the warnings are dropped. */
  onWarning?: (message: string) => void;
}

/** A summary of the values of one cell (in data order), for `valuesFn` of {@link pivotWider}. */
export type PivotSummary = (values: DataValue[]) => DataValue;

/** Options for {@link pivotWider} (tidyr's arguments in camelCase). */
export interface PivotWiderOptions {
  /** The column (or columns) whose values name the new columns. Default `"name"`. */
  namesFrom?: string | readonly string[];
  /** The column (or columns) whose values fill the new columns. Default `"value"`. */
  valuesFrom?: string | readonly string[];
  /**
   * The columns that identify a row of the result. Default: every column not in `namesFrom` or `valuesFrom`, in the
   * data's order; when given, the other columns are dropped.
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
   * for each name.
   */
  namesVary?: "fastest" | "slowest";
  /** The value of a cell that no row fills, or such values by value column. Default: missing. */
  valuesFill?: DataValue | Readonly<Record<string, DataValue>>;
  /** Summarises the values of each filled cell, or such functions by value column. */
  valuesFn?: PivotSummary | Readonly<Record<string, PivotSummary>>;
}

const nameList = (v: string | readonly string[]): string[] => (typeof v === "string" ? [v] : [...v]);

function requireColumns(data: DataFrame, names: readonly string[]): void {
  for (const n of names) if (!Object.hasOwn(data, n)) throw new Error(`Column \`${n}\` doesn't exist.`);
}

// ---- pivotLonger ----

/** The type of a value column, as tidyr names it */
type ValueType = "double" | "character" | "logical";

/** The type of a column; `null` for an array of missing values only (which combines with any type) */
function columnType(name: string, col: Column): ValueType | null {
  if (col instanceof Float64Array) return "double";
  let type: ValueType | null = null;
  for (const v of col) {
    if (v === null) continue;
    const t: ValueType = typeof v === "number" ? "double" : typeof v === "string" ? "character" : "logical";
    if (type !== null && t !== type) throw new TypeError(`column '${name}' mixes ${type} and ${t} values`);
    type = t;
  }
  return type;
}

/** The common type of the source columns of a value column: numbers absorb booleans, strings combine with neither */
function commonType(data: DataFrame, sources: readonly string[]): ValueType | null {
  let common: { type: ValueType; column: string } | null = null;
  for (const s of sources) {
    const t = columnType(s, data[s]!);
    if (t === null) continue;
    if (common === null) common = { type: t, column: s };
    else if (common.type !== t) {
      if (common.type === "character" || t === "character") {
        throw new TypeError(`Can't combine \`${common.column}\` <${common.type}> and \`${s}\` <${t}>.`);
      }
      if (t === "double") common = { type: t, column: s };
    }
  }
  return common?.type ?? null;
}

/** The matches of a regular expression (as a string) in each name: its capture groups, `null` if it does not match */
function captures(names: readonly string[], pattern: string, count: number): (string | null)[][] {
  const groups = new RegExp(`${pattern}|`).exec("")!.length - 1;
  if (groups !== count) throw new Error(`\`regex\` should define ${count} groups; ${groups} found.`);
  const re = new RegExp(pattern);
  return names.map((name) => {
    const m = re.exec(name);
    return Array.from({ length: count }, (_, j) => (m === null ? null : (m[j + 1] ?? null)));
  });
}

/** The names split at the separator into `count` parts, and tidyr's warnings for names with more or fewer pieces */
function separated(names: readonly string[], sep: string, count: number, warnings: string[]): (string | null)[][] {
  const re = new RegExp(sep, "g");
  const extra: number[] = [];
  const short: number[] = [];
  const parts = names.map((name, i) => {
    const pieces: string[] = [];
    let start = 0;
    for (const m of name.matchAll(re)) {
      if (m[0].length === 0) continue;
      pieces.push(name.slice(start, m.index));
      start = m.index + m[0].length;
    }
    pieces.push(name.slice(start));
    if (pieces.length > count) extra.push(i + 1);
    if (pieces.length < count) short.push(i + 1);
    return Array.from({ length: count }, (_, j) => pieces[j] ?? null);
  });
  const rows = (r: readonly number[]): string => `${r.length} rows [${r.join(", ")}]`;
  if (extra.length > 0) warnings.push(`Expected ${count} pieces. Additional pieces discarded in ${rows(extra)}.`);
  if (short.length > 0) warnings.push(`Expected ${count} pieces. Missing pieces filled with \`NA\` in ${rows(short)}.`);
  return parts;
}

/** The parts of each name, one per element of `namesTo` */
function nameParts(
  names: readonly string[],
  namesTo: readonly string[],
  options: PivotLongerOptions,
  warnings: string[],
): (string | null)[][] {
  const { namesSep, namesPattern } = options;
  if (namesTo.length === 1) {
    if (namesSep !== undefined) throw new Error("`names_sep` can't be used with a length 1 `names_to`.");
    if (namesPattern === undefined) return names.map((n) => [n]);
    const re = new RegExp(namesPattern);
    return names.map((n) => [re.exec(n)?.[1] ?? null]);
  }
  if ((namesSep === undefined) === (namesPattern === undefined)) {
    throw new Error(
      "If you supply multiple names in `names_to` you must also supply one of `names_sep` or `names_pattern`.",
    );
  }
  return namesSep !== undefined
    ? separated(names, namesSep, namesTo.length, warnings)
    : captures(names, namesPattern!, namesTo.length);
}

/** A value column of the long result: its name and, for each key, the column it takes its values from */
interface LongValue {
  name: string;
  sources: (string | null)[];
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
 */
export function pivotLonger(data: DataFrame, options: PivotLongerOptions): DataFrame {
  const n = rowCount(data);
  const allNames = Object.keys(data);
  const cols = typeof options.cols === "function" ? allNames.filter(options.cols) : [...new Set(options.cols)];
  requireColumns(data, cols);
  if (cols.length === 0) throw new Error("`cols` must select at least one column.");
  const namesTo = nameList(options.namesTo ?? "name");
  const valuePosition = namesTo.indexOf(".value");
  if (namesTo.lastIndexOf(".value") !== valuePosition) throw new Error('`names_to` may contain ".value" only once');
  const warnings: string[] = [];

  const prefix = options.namesPrefix === undefined ? null : new RegExp(`^(?:${options.namesPrefix})`);
  const stripped = cols.map((c) => (prefix === null ? c : c.replace(prefix, "")));
  const parts = nameParts(stripped, namesTo, options, warnings);

  // The keys (the parts other than ".value") and the value columns with their sources
  const keys: (string | null)[][] = [];
  const values: LongValue[] = [];
  if (valuePosition < 0) {
    keys.push(...parts);
    values.push({ name: options.valuesTo ?? "value", sources: [...cols] });
  } else {
    const keyIndex = new Map<string, number>();
    const valueIndex = new Map<string, LongValue>();
    parts.forEach((p, c) => {
      const key = p.filter((_, j) => j !== valuePosition);
      const id = JSON.stringify(key);
      let k = keyIndex.get(id);
      if (k === undefined) {
        k = keys.length;
        keyIndex.set(id, k);
        keys.push(key);
        for (const v of values) v.sources.push(null);
      }
      const name = p[valuePosition] ?? "NA";
      let value = valueIndex.get(name);
      if (value === undefined) {
        value = { name, sources: keys.map(() => null) };
        valueIndex.set(name, value);
        values.push(value);
      }
      if (value.sources[k] !== null) throw new Error(`the names give the value column '${name}' twice for one key`);
      value.sources[k] = cols[c]!;
    });
  }
  const types = values.map((v) => commonType(data, v.sources.filter((s): s is string => s !== null)));

  // Rows of the result: [input row, key]
  let rows: [number, number][] = [];
  if (options.colsVary === "slowest") {
    for (let k = 0; k < keys.length; k++) for (let i = 0; i < n; i++) rows.push([i, k]);
  } else {
    for (let i = 0; i < n; i++) for (let k = 0; k < keys.length; k++) rows.push([i, k]);
  }
  const cellOf = (v: LongValue, i: number, k: number): DataValue => {
    const s = v.sources[k];
    return s === null || s === undefined ? null : data[s]![i]!;
  };
  if (options.valuesDropNa === true) {
    rows = rows.filter(([i, k]) => values.some((v) => !isMissing(cellOf(v, i, k))));
  }

  const out: DataFrame = {};
  const inputRows = rows.map(([i]) => i);
  for (const name of allNames) if (!cols.includes(name)) addColumn(out, name, pick(data[name]!, inputRows));
  namesTo.forEach((to, j) => {
    if (j === valuePosition) return;
    const transform = options.namesTransform?.[to];
    const part = (k: number): DataValue => {
      const p = keys[k]![j < valuePosition || valuePosition < 0 ? j : j - 1]!;
      return p === null || transform === undefined ? p : transform(p);
    };
    addColumn(out, to, rows.map(([, k]) => part(k)));
  });
  values.forEach((v, m) => {
    const double = types[m] === "double";
    if (double && v.sources.every((s) => s !== null && data[s] instanceof Float64Array)) {
      addColumn(out, v.name, Float64Array.from(rows, ([i, k]) => cellOf(v, i, k) as number));
    } else {
      const cells = rows.map(([i, k]): DataValue => {
        const x = cellOf(v, i, k);
        return double && typeof x === "boolean" ? Number(x) : x;
      });
      addColumn(out, v.name, cells);
    }
  });
  if (options.onWarning !== undefined) for (const w of new Set(warnings)) options.onWarning(w);
  return out;
}

// ---- pivotWider ----

/** A value as an exact key (missing values are all one key) */
const keyOf = (v: DataValue): string =>
  isMissing(v) ? "NA" : typeof v === "number" ? `n${v}` : typeof v === "string" ? `s${v}` : `b${String(v)}`;

/**
 * The distinct combinations of the values of the columns, in order of first appearance: the combination of each row,
 * and the first row of each combination
 */
function combinations(cols: readonly Column[], n: number): { codes: number[]; firsts: number[] } {
  const index = new Map<string, number>();
  const firsts: number[] = [];
  const codes = Array.from({ length: n }, (_, i) => {
    const id = JSON.stringify(cols.map((c) => keyOf(c[i]!)));
    let code = index.get(id);
    if (code === undefined) {
      code = firsts.length;
      index.set(id, code);
      firsts.push(i);
    }
    return code;
  });
  return { codes, firsts };
}

/** A value as part of a column name: numbers as R's as.character, booleans as TRUE and FALSE, missing as NA */
function labelText(v: DataValue): string {
  if (isMissing(v)) return "NA";
  if (typeof v === "number") return Number.isFinite(v) ? formatR(v) : v > 0 ? "Inf" : "-Inf";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return v as string;
}

/** An option given once for all value columns or by value column */
function perColumn<T>(
  option: T | Readonly<Record<string, T>> | undefined,
  isSingle: (o: T | Readonly<Record<string, T>>) => o is T,
  name: string,
): T | undefined {
  if (option === undefined) return undefined;
  return isSingle(option) ? option : option[name];
}

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
 */
export function pivotWider(data: DataFrame, options: PivotWiderOptions = {}): DataFrame {
  const n = rowCount(data);
  const namesFrom = nameList(options.namesFrom ?? "name");
  const valuesFrom = nameList(options.valuesFrom ?? "value");
  const idCols =
    options.idCols === undefined
      ? Object.keys(data).filter((c) => !namesFrom.includes(c) && !valuesFrom.includes(c))
      : nameList(options.idCols);
  requireColumns(data, [...idCols, ...namesFrom, ...valuesFrom]);
  const prefix = options.namesPrefix ?? "";
  const sep = options.namesSep ?? "_";

  const ids = combinations(idCols.map((c) => data[c]!), n);
  const labels = combinations(namesFrom.map((c) => data[c]!), n);
  // The name combinations in output order (positions in labels.firsts)
  const nameOrder = labels.firsts.map((_, m) => m);
  if (options.namesSort === true) {
    nameOrder.sort((a, b) => {
      for (const c of namesFrom) {
        const d = compareValues(data[c]![labels.firsts[a]!]!, data[c]![labels.firsts[b]!]!);
        if (d !== 0) return d;
      }
      return 0;
    });
  }
  const nameText = labels.firsts.map((r) => prefix + namesFrom.map((c) => labelText(data[c]![r]!)).join(sep));

  // The rows of each cell (id combination, name combination), in data order
  const nNames = labels.firsts.length;
  const cellRows = Array.from({ length: ids.firsts.length * nNames }, (): number[] => []);
  for (let i = 0; i < n; i++) cellRows[ids.codes[i]! * nNames + labels.codes[i]!]!.push(i);

  const isSummary = (o: PivotSummary | Readonly<Record<string, PivotSummary>>): o is PivotSummary =>
    typeof o === "function";
  const isFill = (o: DataValue | Readonly<Record<string, DataValue>>): o is DataValue =>
    typeof o !== "object" || o === null;
  const columnOf = (value: string, m: number): Column => {
    const source = data[value]!;
    const summary = perColumn(options.valuesFn, isSummary, value);
    const fill = perColumn(options.valuesFill, isFill, value) ?? null;
    const cells = ids.firsts.map((_, r): DataValue => {
      const rows = cellRows[r * nNames + m]!;
      if (rows.length === 0) return fill;
      if (summary !== undefined) return summary(rows.map((i) => source[i]!));
      return source[rows[0]!]!;
    });
    if (source instanceof Float64Array && cells.every((x) => x === null || typeof x === "number")) {
      return Float64Array.from(cells, (x) => (x === null ? NaN : (x as number)));
    }
    return cells;
  };
  for (const value of valuesFrom) {
    if (perColumn(options.valuesFn, isSummary, value) === undefined && cellRows.some((rows) => rows.length > 1)) {
      throw new Error(`values from '${value}' are not uniquely identified; use valuesFn to summarise them`);
    }
  }

  const out: DataFrame = {};
  for (const c of idCols) addColumn(out, c, pick(data[c]!, ids.firsts));
  const columnName = (value: string, m: number): string =>
    valuesFrom.length === 1 ? nameText[m]! : `${value}${sep}${nameText[m]!}`;
  if (options.namesVary === "slowest") {
    for (const m of nameOrder) for (const v of valuesFrom) addColumn(out, columnName(v, m), columnOf(v, m));
  } else {
    for (const v of valuesFrom) for (const m of nameOrder) addColumn(out, columnName(v, m), columnOf(v, m));
  }
  return out;
}
