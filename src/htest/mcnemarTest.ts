// McNemar's test of symmetry for a square contingency table (R's mcnemar.test).
//
// Written for rStats.js from the textbook construction (McNemar, Psychometrika 12, 1947; no ported code):
// sum over i < j of (n_ij - n_ji)^2 / (n_ij + n_ji), chi-squared with r (r - 1) / 2 degrees of freedom. For a 2 x 2
// table the continuity correction replaces |n_12 - n_21| by |n_12 - n_21| - 1.

import { pgamma1 } from "../distributions/gamma.js";
import type { HTest } from "./types.js";

/** Options for {@link mcnemarTest}. */
export interface McnemarTestOptions {
  /** Apply the continuity correction (2 x 2 tables only). Default `true`. */
  correct?: boolean;
}

/** Result of {@link mcnemarTest}. Has no `alternative`, as R's `mcnemar.test()` returns none. */
export interface McnemarTestResult extends Omit<HTest, "alternative"> {
  /** Degrees of freedom (`parameterName` is `"df"`). */
  parameter: number;
}

/**
 * McNemar's chi-squared test for symmetry of rows and columns in a square table of counts. Equivalent to R's
 * `mcnemar.test()` with a matrix, or with two factors given as paired category codes.
 *
 * @param x Square table of counts as an array of rows, or the first of two paired samples of category codes.
 * @param y Second paired sample of category codes, when `x` is a sample. May be omitted (and the options passed in
 *   its place) when `x` is a table.
 * @param options See {@link McnemarTestOptions}.
 *
 * @example
 * ```ts
 * mcnemarTest([[794, 86], [150, 570]]).statistic; // 34.71186
 * ```
 */
export function mcnemarTest(
  x: readonly (readonly number[])[] | readonly (number | string)[],
  y?: readonly (number | string)[] | McnemarTestOptions,
  options: McnemarTestOptions = {},
): McnemarTestResult {
  let table: number[][];
  if (x.length > 0 && Array.isArray(x[0])) {
    if (y !== undefined && !Array.isArray(y)) options = y as McnemarTestOptions;
    table = (x as readonly (readonly number[])[]).map((row) => Array.from(row));
    const r = table.length;
    if (r < 2 || table.some((row) => row.length !== r)) throw new RangeError("'x' must be square with at least two rows and columns");
    if (table.some((row) => row.some((v) => !Number.isFinite(v) || v < 0))) throw new RangeError("all entries of 'x' must be nonnegative and finite");
  } else {
    if (!Array.isArray(y)) throw new TypeError("'y' is required when 'x' is not a table");
    table = crossTable(x as readonly (number | string)[], y as readonly (number | string)[]);
  }
  const correct = options.correct ?? true;
  const r = table.length;
  let statistic: number;
  // as in R, a symmetric 2 x 2 table gets no correction (it would make the statistic positive)
  const useCorrection = correct && r === 2 && table[0]![1] !== table[1]![0];
  if (useCorrection) {
    const b = table[0]![1]!;
    const c = table[1]![0]!;
    statistic = (Math.abs(b - c) - 1) ** 2 / (b + c);
  } else {
    statistic = 0;
    for (let i = 0; i < r; i++) {
      for (let j = i + 1; j < r; j++) {
        const a = table[i]![j]!;
        const b = table[j]![i]!;
        statistic += (a - b) ** 2 / (a + b);
      }
    }
  }
  const df = (r * (r - 1)) / 2;
  return {
    method: useCorrection ? "McNemar's Chi-squared test with continuity correction" : "McNemar's Chi-squared test",
    statistic,
    statisticName: "McNemar's chi-squared",
    parameter: df,
    parameterName: "df",
    pValue: pgamma1(statistic, df / 2, 2, false, false),
  };
}

/**
 * Cross-tabulation of two paired samples of category codes (pairs with a missing value dropped), as R tabulates two
 * factors: the rows are the levels of x and the columns those of y, each sorted (numbers numerically, strings as R
 * sorts factor levels in the C locale). As in R, both must have the same number of levels, at least 2; the levels
 * are matched by position, not by value.
 */
function crossTable(x: readonly (number | string)[], y: readonly (number | string)[]): number[][] {
  if (x.length !== y.length) throw new RangeError("'x' and 'y' must have the same length");
  const keep: [number | string, number | string][] = [];
  for (let i = 0; i < x.length; i++) {
    const a = x[i]!;
    const b = y[i]!;
    if (typeof a === "number" && Number.isNaN(a)) continue;
    if (typeof b === "number" && Number.isNaN(b)) continue;
    keep.push([a, b]);
  }
  const levelsOf = (v: (number | string)[]): (number | string)[] =>
    Array.from(new Set(v)).sort((a, b) =>
      typeof a === "number" && typeof b === "number" ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0,
    );
  const lx = levelsOf(keep.map((p) => p[0]));
  const ly = levelsOf(keep.map((p) => p[1]));
  if (lx.length < 2 || lx.length !== ly.length) {
    throw new RangeError("'x' and 'y' must have the same number of levels (minimum 2)");
  }
  const ix = new Map(lx.map((v, i) => [v, i]));
  const iy = new Map(ly.map((v, i) => [v, i]));
  const t = lx.map(() => new Array<number>(lx.length).fill(0));
  for (const [a, b] of keep) t[ix.get(a)!]![iy.get(b)!]!++;
  return t;
}
