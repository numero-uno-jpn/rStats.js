// Model frames: the variables of a formula taken from a data frame, with the rows that have a missing value dropped
// and string and boolean columns turned into factors (R's model.frame with na.omit).
//
// Written for rStats.js (no ported code) from oracle/anova-behaviour.md ("Data and missing values"). A string
// column is a factor formed from the rows kept (R's factor() after na.omit): its levels are the distinct values of
// those rows sorted by code point, unless `levels` gives them; a boolean column always has the levels FALSE and TRUE
// (R keeps it logical, and model.matrix codes a logical with both levels); numeric columns stay numeric.
// `dropUnusedLevels` removes the levels of the columns with `levels` given that have no row left (R's
// drop.unused.levels = TRUE, used by lm and aov); it does not apply to boolean columns. Functions that group rows by
// a variable use the levels present (`presentLevels`).

import type { Sample } from "../htest/types.js";

/**
 * A data frame: an object of columns of equal length. `null` (and `NaN` in a numeric column) is a missing value.
 *
 * @category Data frames
 */
export type DataFrame = Record<string, readonly (number | string | boolean | null)[] | Float64Array>;

/** A variable of a model frame: numeric values, or a factor (level index per row). */
export type FrameVariable =
  | { kind: "numeric"; values: number[] }
  | { kind: "factor"; levels: string[]; codes: number[] };

/** Result of {@link modelFrame}. */
export interface ModelFrame {
  /** 0-based indices of the rows of the data that were kept. */
  rows: number[];
  /** One entry per variable (in the order given), restricted to the rows kept. */
  variables: FrameVariable[];
  /** The weights of the rows kept (absent without weights). */
  weights?: number[];
}

/** Options for {@link modelFrame}. */
export interface ModelFrameOptions {
  /** The order of the levels of factors (`factor(x, levels = ...)`); values not among them are missing. */
  levels?: Record<string, readonly string[]>;
  /** Weights: an array parallel to the rows of the data, or the name of a numeric column. */
  weights?: Sample | string;
  /** Drop the levels of the columns with `levels` given that have no row left (not those of boolean columns). */
  dropUnusedLevels?: boolean;
}

/** Comparison of strings by code point (not by UTF-16 code unit) */
export function compareCodePoints(a: string, b: string): number {
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (;;) {
    const x = ia.next();
    const y = ib.next();
    if (x.done) return y.done ? 0 : -1;
    if (y.done) return 1;
    const d = x.value.codePointAt(0)! - y.value.codePointAt(0)!;
    if (d !== 0) return d;
  }
}

type Raw = readonly (number | string | boolean | null)[] | Float64Array;

/** How a factor's levels were set: given by `levels`, the values of a string column, or FALSE and TRUE */
type LevelSource = "given" | "values" | "logical";

/** A column as a variable over all rows, with a missing flag per row */
function convert(
  name: string,
  col: Raw,
  levels: readonly string[] | undefined,
): { v: FrameVariable; missing: boolean[]; source?: LevelSource } {
  if (col instanceof Float64Array && levels === undefined) {
    const values = Array.from(col);
    return { v: { kind: "numeric", values }, missing: values.map((x) => Number.isNaN(x)) };
  }
  const vals = Array.from(col as ArrayLike<number | string | boolean | null>);
  const kinds = new Set(vals.filter((x) => x !== null).map((x) => typeof x));
  if (kinds.size > 1) throw new TypeError(`column '${name}' mixes ${[...kinds].join(" and ")} values`);
  const kind = [...kinds][0] ?? "number";
  if (kind !== "number" && kind !== "string" && kind !== "boolean") throw new TypeError(`column '${name}' has values of an unsupported type`);
  if (kind === "number" && levels === undefined) {
    const values = vals.map((x) => (x === null ? NaN : (x as number)));
    return { v: { kind: "numeric", values }, missing: values.map((x) => Number.isNaN(x)) };
  }
  const str = (x: number | string | boolean | null): string | null =>
    x === null || (typeof x === "number" && Number.isNaN(x)) ? null : typeof x === "boolean" ? (x ? "TRUE" : "FALSE") : String(x);
  const labels = vals.map(str);
  let lev: string[];
  if (levels !== undefined) lev = Array.from(levels, String);
  else if (kind === "boolean") lev = ["FALSE", "TRUE"];
  else lev = [...new Set(labels.filter((x): x is string => x !== null))].sort(compareCodePoints);
  const pos = new Map(lev.map((l, i) => [l, i]));
  const codes = labels.map((l) => (l === null ? -1 : (pos.get(l) ?? -1)));
  const source: LevelSource = levels !== undefined ? "given" : kind === "boolean" ? "logical" : "values";
  return { v: { kind: "factor", levels: lev, codes }, missing: codes.map((c) => c < 0), source };
}

/** A factor restricted to its levels that occur in `codes` (their order kept) */
function dropUnused(levels: readonly string[], codes: readonly number[]): { levels: string[]; codes: number[] } {
  const used = levels.map(() => false);
  for (const c of codes) used[c] = true;
  const map = new Map<number, number>();
  const kept = levels.filter((_, k) => {
    if (used[k]) map.set(k, map.size);
    return used[k];
  });
  return { levels: kept, codes: codes.map((c) => map.get(c)!) };
}

/**
 * A factor variable of a model frame with only the levels that occur in its rows (in level order), for functions
 * that group the rows by it: a boolean column keeps both levels in the frame, but its groups are the values present.
 */
export function presentLevels(v: { levels: readonly string[]; codes: readonly number[] }): { levels: string[]; codes: number[] } {
  return dropUnused(v.levels, v.codes);
}

/**
 * The model frame of the given variables: each variable taken from the data, the rows with a missing value in any
 * of them (or in the weights) dropped.
 *
 * Errors as R: `object 'Q' not found` for a variable that is not a column, `variable lengths differ (found for 'x')`
 * for columns of different lengths.
 */
export function modelFrame(data: DataFrame, names: readonly string[], options: ModelFrameOptions = {}): ModelFrame {
  if (typeof data !== "object" || data === null) throw new TypeError("data must be an object of columns");
  const cols: Raw[] = names.map((v) => {
    const c = Object.prototype.hasOwnProperty.call(data, v) ? data[v] : undefined;
    if (c === undefined) throw new Error(`object '${v}' not found`);
    if (!Array.isArray(c) && !(c instanceof Float64Array)) throw new TypeError(`column '${v}' must be an array`);
    return c;
  });
  let w: Raw | undefined;
  if (typeof options.weights === "string") {
    const c = Object.prototype.hasOwnProperty.call(data, options.weights) ? data[options.weights] : undefined;
    if (c === undefined) throw new Error(`object '${options.weights}' not found`);
    w = c;
  } else if (options.weights !== undefined) w = Array.from(options.weights);
  const n = cols.length > 0 ? cols[0]!.length : (w?.length ?? Object.values(data)[0]?.length ?? 0);
  names.forEach((v, i) => {
    if (cols[i]!.length !== n) throw new RangeError(`variable lengths differ (found for '${v}')`);
  });
  if (w !== undefined && w.length !== n) throw new RangeError("variable lengths differ (found for '(weights)')");
  const conv = names.map((v, i) => convert(v, cols[i]!, options.levels?.[v]));
  let weights: number[] | undefined;
  if (w !== undefined) {
    weights = Array.from(w as ArrayLike<unknown>, (x) => {
      if (x === null) return NaN;
      if (typeof x !== "number") throw new TypeError("the weights must be numeric");
      return x;
    });
  }
  const rows: number[] = [];
  for (let i = 0; i < n; i++) {
    if (conv.some((c) => c.missing[i]) || (weights !== undefined && Number.isNaN(weights[i]!))) continue;
    rows.push(i);
  }
  const variables = conv.map(({ v, source }): FrameVariable => {
    if (v.kind === "numeric") return { kind: "numeric", values: rows.map((i) => v.values[i]!) };
    const codes = rows.map((i) => v.codes[i]!);
    // a string column's levels are the values of the rows kept; given levels are dropped only on request; a boolean
    // column keeps FALSE and TRUE
    if (source === "values" || (source === "given" && options.dropUnusedLevels)) return { kind: "factor", ...dropUnused(v.levels, codes) };
    return { kind: "factor", levels: v.levels, codes };
  });
  const out: ModelFrame = { rows, variables };
  if (weights !== undefined) {
    out.weights = rows.map((i) => weights[i]!);
    if (out.weights.some((x) => x < 0)) throw new RangeError("missing or negative weights not allowed");
  }
  return out;
}
