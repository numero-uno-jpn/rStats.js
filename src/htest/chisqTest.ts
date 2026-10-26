// Chi-squared test (R's chisq.test): goodness of fit and independence in contingency tables.
//
// The formulas for expected counts, degrees of freedom and the Yates continuity correction are the
// same as scipy.stats chisquare, chi2_contingency and contingency.expected_freq
// (scipy/stats/_stats_py.py, scipy/stats/contingency.py; SciPy commit a087e61, BSD-3-Clause, see
// THIRD_PARTY_NOTICES.md). Defaults, input checks and result names follow observed R output.
// - The continuity correction applies to 2x2 tables only. The amount subtracted is a single value
//   for all cells, min(0.5, min |O - E|) (from R's output; scipy uses min(0.5, |O - E|) per cell).
//   If that amount is 0, the result is labelled as uncorrected
// - A matrix with a single row or column becomes a goodness-of-fit test
// - Count checks depend on the shape: a matrix rejects negative, NaN and Inf; a vector (and a
//   1-row or 1-column matrix) rejects only negative and NaN (Inf just makes the statistic NaN).
//   Fractional counts are accepted in both cases
// - Sums are taken in double-double (R's sum accumulates in extended precision)
// - Simulated p-values (Hope 1968; R's documented behaviour): (1 + #{simulated statistics >= (1 - 64 eps) times the
//   observed one}) / (B + 1). Goodness of fit draws the B samples of size n = sum(x) at once with sampleInt (R's
//   sample.int with prob) and counts them n at a time; contingency tables are drawn with Patefield's algorithm
//   (src/random/r2dtable.ts). The statistic is then the uncorrected one, and the parameter is NaN (R's NA). Tables
//   with a zero margin are not simulated (ordinary test), as in R
// - Two factor vectors: the table of the complete pairs, with the distinct values sorted by code point (C locale)

import { pgamma1 } from "../distributions/gamma.js";
import { logFactorialTable, rcont2 } from "../random/r2dtable.js";
import { sampleInt } from "../random/sample.js";
import { ddAdd, type DD } from "../special/dd.js";
import { simulatedMethod } from "./core/simulate.js";
import type { HTest, Counts } from "./types.js";

/**
 * Options for {@link chisqTest}.
 *
 * @category Hypothesis tests
 */
export interface ChisqTestOptions {
  /** Apply Yates' continuity correction (2 x 2 tables only). Default `true`. */
  correct?: boolean;
  /** Expected probabilities for the goodness-of-fit test. Default: equal probabilities. Ignored for contingency tables. */
  p?: readonly number[];
  /** Rescale `p` to sum to 1. Default `false`, in which case `p` must sum to 1. */
  rescaleP?: boolean;
  /**
   * Compute the p-value by Monte Carlo simulation with `B` replicates (R's `simulate.p.value`), using the random
   * stream of {@link setSeed} as R does. Default `false`.
   */
  simulatePValue?: boolean;
  /** Number of replicates for `simulatePValue`. Default `2000`. */
  B?: number;
}

/**
 * Result of {@link chisqTest}. Has no `alternative`, because R's `chisq.test()` does not return one.
 *
 * @category Hypothesis tests
 */
export interface ChisqTestResult extends Omit<HTest, "alternative"> {
  /** Degrees of freedom (`parameterName` is `"df"`). */
  parameter: number;
  /** Observed counts (an array of rows for a contingency table). */
  observed: number[] | number[][];
  /** Expected counts under the null hypothesis. */
  expected: number[] | number[][];
  /** Pearson residuals `(O - E) / sqrt(E)`. */
  residuals: number[] | number[][];
  /**
   * Standardized residuals `(O - E) / sqrt(V)`, where `V` is
   * `E (1 - row proportion) (1 - column proportion)` for a contingency table and
   * `n p (1 - p)` for goodness of fit.
   */
  stdres: number[] | number[][];
}

/**
 * Result of {@link chisqTest} with two factor vectors: also the levels that label the rows and columns.
 *
 * @category Hypothesis tests
 */
export interface ChisqTestFactorsResult extends ChisqTestResult {
  observed: number[][];
  expected: number[][];
  residuals: number[][];
  stdres: number[][];
  /** Levels of `x` (rows of the table), sorted by code point. */
  rowLevels: string[];
  /** Levels of `y` (columns of the table), sorted by code point. */
  colLevels: string[];
}

/**
 * A factor: category labels, with `null` or `undefined` for missing values (R's NA).
 *
 * @category Hypothesis tests
 */
export type Factor = readonly (string | null | undefined)[];


/** Sum (accumulated in double-double, then rounded; with Inf present, the double sum = ±Inf or NaN) */
function ddSum(x: readonly number[]): number {
  let s: DD = [0, 0];
  let plain = 0;
  for (const v of x) {
    s = ddAdd(s, [v, 0]);
    plain += v;
  }
  return Number.isFinite(plain) ? s[0] : plain;
}

/**
 * Pearson's chi-squared test. Equivalent to R's `chisq.test()`.
 *
 * Given an array of counts, tests goodness of fit to `options.p`. Given a matrix (an array
 * of rows), tests independence in the contingency table; a matrix with a single row or
 * column is treated as a goodness-of-fit test, as in R. Yates' correction is applied to
 * 2 x 2 tables by default; as in R, the amount subtracted is `min(0.5, min |O - E|)` over
 * all cells. Sums are computed in extended precision, like R.
 *
 * With `simulatePValue: true` the p-value is computed from `B` simulated samples (multinomial for goodness of fit,
 * random tables with the observed margins otherwise), drawn from the random stream of {@link setSeed} exactly as in
 * R, so `setSeed(s)` before the call gives R's p-value after `set.seed(s)`.
 *
 * Given two factor vectors (arrays of labels of the same length), tests independence in their contingency table, as
 * R's `chisq.test(x, y)`; pairs with a missing label are dropped and the levels are sorted by code point.
 *
 * R's warning for expected counts below 5 is not issued.
 *
 * @param x Counts, or a contingency table as an array of rows (or a factor, with `y`).
 * @param options See {@link ChisqTestOptions}.
 * @returns The test result, with `statisticName` `"X-squared"`; see {@link ChisqTestResult}.
 *
 * @example
 * ```ts
 * const r = chisqTest([[12, 5], [7, 15]]);
 * r.statistic; // 4.322120391218687 (with Yates' continuity correction)
 * r.pValue;    // 0.03762001663483994
 *
 * chisqTest([20, 30, 50]).pValue; // 0.0009118819655545154 (goodness of fit, equal p)
 *
 * setSeed(1);
 * chisqTest([20, 15, 25], { simulatePValue: true }).pValue; // 0.296351824087956 (R: set.seed(1); chisq.test(...))
 *
 * chisqTest(["a", "b", "a", "b"], ["u", "u", "v", "v"]).rowLevels; // ["a", "b"]
 * ```
 *
 * @category Hypothesis tests
 */
export function chisqTest(x: Counts | readonly Counts[], options?: ChisqTestOptions): ChisqTestResult;
export function chisqTest(x: Factor, y: Factor, options?: ChisqTestOptions): ChisqTestFactorsResult;
export function chisqTest(
  x: Counts | readonly Counts[] | Factor,
  yOrOptions?: Factor | ChisqTestOptions,
  maybeOptions?: ChisqTestOptions,
): ChisqTestResult {
  if (Array.isArray(yOrOptions)) return chisqFactors(x as Factor, yOrOptions as Factor, maybeOptions ?? {});
  return chisqCounts(x as Counts | readonly Counts[], (yOrOptions as ChisqTestOptions | undefined) ?? {});
}

/** Code-point order (the C locale) */
const byCodePoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function chisqFactors(x: Factor, y: Factor, options: ChisqTestOptions): ChisqTestFactorsResult {
  if (x.length !== y.length) throw new RangeError("'x' and 'y' must have the same length");
  const missing = (v: unknown): boolean => v === null || v === undefined;
  for (const v of [...x, ...y]) {
    if (!missing(v) && typeof v !== "string") throw new TypeError("factor values must be strings (or null for missing values)");
  }
  const xs: string[] = [];
  const ys: string[] = [];
  x.forEach((v, i) => {
    const w = y[i];
    if (!missing(v) && !missing(w)) {
      xs.push(v!);
      ys.push(w!);
    }
  });
  const rowLevels = [...new Set(xs)].sort(byCodePoint);
  const colLevels = [...new Set(ys)].sort(byCodePoint);
  if (rowLevels.length < 2 || colLevels.length < 2) throw new RangeError("'x' and 'y' must have at least 2 levels");
  const ri = new Map(rowLevels.map((v, i) => [v, i]));
  const ci = new Map(colLevels.map((v, i) => [v, i]));
  const table = rowLevels.map(() => colLevels.map(() => 0));
  xs.forEach((v, k) => table[ri.get(v)!]![ci.get(ys[k]!)!]!++);
  const r = contingency(table, options);
  return { ...(r as ChisqTestFactorsResult), rowLevels, colLevels };
}

function chisqCounts(x: Counts | readonly Counts[], options: ChisqTestOptions): ChisqTestResult {
  const isMatrix = x.length > 0 && typeof x[0] !== "number";
  if (isMatrix) {
    const rows = (x as readonly Counts[]).map((r) => Array.from(r));
    const nc = rows[0]!.length;
    if (rows.some((r) => r.length !== nc)) throw new TypeError("all rows of the matrix must have the same length");
    // A 1-row or 1-column matrix is treated as a vector
    if (rows.length === 1) return goodnessOfFit(rows[0]!, options);
    if (nc === 1) return goodnessOfFit(rows.map((r) => r[0]!), options);
    return contingency(rows, options);
  }
  return goodnessOfFit(Array.from(x as Counts), options);
}

/** Number of replicates, checked when a simulation is run */
function replicates(options: ChisqTestOptions): number {
  const B = options.B ?? 2000;
  if (!(B >= 0 && B < 2 ** 31)) throw new RangeError("'B' must be a non-negative number");
  return B;
}

/** (1 + #{sims >= (1 - 64 eps) stat}) / (B + 1) */
function monteCarloP(sims: ArrayLike<number>, stat: number, B: number): number {
  const threshold = (1 - 64 * Number.EPSILON) * stat;
  let count = 0;
  for (let i = 0; i < sims.length; i++) if (sims[i]! >= threshold) count++;
  return (1 + count) / (B + 1);
}

function pValueOf(stat: number, df: number): number {
  return Number.isNaN(stat) ? NaN : pgamma1(stat, df / 2, 2, false, false);
}

/**
 * R warns when any expected count is below 5. When that check is undecidable because of NaN (no
 * count below 5 but some NaN), R raises an error (e.g. p renormalised by a zero sum, Inf counts with zero probability)
 */
function checkExpected(E: readonly number[]): void {
  if (!E.some((e) => e < 5) && E.some(Number.isNaN)) throw new RangeError("missing value where TRUE/FALSE needed (the expected counts contain NaN)");
}

function goodnessOfFit(x: number[], options: ChisqTestOptions): ChisqTestResult {
  const k = x.length;
  if (x.some((v) => Number.isNaN(v) || v < 0)) throw new RangeError("all entries of 'x' must be non-negative and finite");
  if (k < 2) throw new TypeError("'x' must have at least 2 elements");
  const n = ddSum(x);
  if (!(n > 0)) throw new RangeError("at least one entry of 'x' must be positive");
  let p = options.p === undefined ? x.map(() => 1 / k) : Array.from(options.p);
  if (p.length !== k) throw new TypeError("'x' and 'p' must have the same number of elements");
  if (p.some(Number.isNaN)) throw new RangeError("p contains missing values");
  if (p.some((v) => v < 0)) throw new RangeError("probabilities must be non-negative");
  if (options.rescaleP ?? false) {
    const s = ddSum(p);
    p = p.map((v) => v / s);
  } else if (Math.abs(ddSum(p) - 1) > Math.sqrt(Number.EPSILON)) {
    throw new RangeError("probabilities must sum to 1");
  }
  const E = p.map((v) => n * v);
  checkExpected(E);
  const V = p.map((v, i) => E[i]! * (1 - v));
  const stat = ddSum(x.map((v, i) => (v - E[i]!) ** 2 / E[i]!));
  let method = "Chi-squared test for given probabilities";
  let df = k - 1;
  let pValue: number;
  if (options.simulatePValue ?? false) {
    const B = replicates(options);
    method += simulatedMethod(B);
    df = NaN;
    pValue = monteCarloP(simulateGoodnessOfFit(n, p, E, B), stat, B);
  } else pValue = pValueOf(stat, df);
  return {
    method,
    statistic: stat,
    statisticName: "X-squared",
    parameter: df,
    parameterName: "df",
    pValue,
    observed: x,
    expected: E,
    residuals: x.map((v, i) => (v - E[i]!) / Math.sqrt(E[i]!)),
    stdres: x.map((v, i) => (v - E[i]!) / Math.sqrt(V[i]!)),
  };
}

/**
 * Statistics of B multinomial samples: B n categories drawn at once with probabilities p (sampleInt, R's
 * sample.int(k, B n, TRUE, prob = p)), laid out column by column in a matrix of floor(n) rows (recycled to fill the
 * last column, as R's matrix() does when n is not an integer) and counted per column
 */
function simulateGoodnessOfFit(n: number, p: readonly number[], E: readonly number[], B: number): Float64Array {
  const k = p.length;
  const draws = sampleInt(k, { size: Math.trunc(B * n), replace: true, prob: p });
  const rows = Math.trunc(n);
  if (draws.length === 0) return new Float64Array(0);
  if (rows === 0) throw new RangeError("invalid 'nrow' value (too large or NA)");
  const cols = Math.ceil(draws.length / rows);
  const out = new Float64Array(cols);
  const counts = new Float64Array(k);
  for (let j = 0; j < cols; j++) {
    counts.fill(0);
    for (let i = 0; i < rows; i++) counts[draws[(j * rows + i) % draws.length]!]!++;
    let s = 0;
    for (let c = 0; c < k; c++) s += (counts[c]! - E[c]!) ** 2 / E[c]!;
    out[j] = s;
  }
  return out;
}

/** Statistics of B random tables with the margins sr, sc (Patefield's algorithm), summed column by column */
function simulateTables(sr: readonly number[], sc: readonly number[], E: readonly number[][], B: number): Float64Array {
  const nr = sr.length;
  const nc = sc.length;
  const total = sr.reduce((a, b) => a + b, 0);
  const fact = logFactorialTable(total);
  const table = new Int32Array(nr * nc);
  const out = new Float64Array(Math.trunc(B));
  for (let b = 0; b < out.length; b++) {
    rcont2(sr, sc, fact, table);
    let s = 0;
    for (let j = 0; j < nc; j++) {
      for (let i = 0; i < nr; i++) {
        const e = E[i]![j]!;
        s += (table[i + j * nr]! - e) ** 2 / e;
      }
    }
    out[b] = s;
  }
  return out;
}

function contingency(x: number[][], options: ChisqTestOptions): ChisqTestResult {
  const correct = options.correct ?? true;
  const nr = x.length;
  const nc = x[0]!.length;
  const all = x.flat();
  if (all.some((v) => !(v >= 0 && v < Infinity))) throw new RangeError("all entries of 'x' must be non-negative and finite");
  const n = ddSum(all);
  if (!(n > 0)) throw new RangeError("at least one entry of 'x' must be positive");
  const sr = x.map((r) => ddSum(r));
  const sc = x[0]!.map((_, j) => ddSum(x.map((r) => r[j]!)));
  const E = sr.map((a) => sc.map((b) => (a * b) / n));
  checkExpected(E.flat());
  const diff = x.map((r, i) => r.map((v, j) => v - E[i]![j]!));
  let method = "Pearson's Chi-squared test";
  let stat: number;
  let df = (nr - 1) * (nc - 1);
  let pValue: number | undefined;
  const simulate = (options.simulatePValue ?? false) && sr.every((v) => v > 0) && sc.every((v) => v > 0);
  const yates = !simulate && correct && nr === 2 && nc === 2 ? Math.min(0.5, ...diff.flat().map(Math.abs)) : 0;
  if (simulate) {
    // counts are integers for the simulation (R's C code takes the margins as integers)
    const B = replicates(options);
    method += simulatedMethod(B);
    stat = ddSum(diff.flatMap((r, i) => r.map((d, j) => (d * d) / E[i]![j]!)));
    df = NaN;
    const sims = simulateTables(
      sr.map((v) => Math.trunc(v)),
      sc.map((v) => Math.trunc(v)),
      E,
      B,
    );
    pValue = monteCarloP(sims, stat, B);
  } else if (yates > 0) {
    method += " with Yates' continuity correction";
    stat = ddSum(diff.flatMap((r, i) => r.map((d, j) => (Math.abs(d) - yates) ** 2 / E[i]![j]!)));
  } else {
    stat = ddSum(diff.flatMap((r, i) => r.map((d, j) => (d * d) / E[i]![j]!)));
  }
  const V = E.map((r, i) => r.map((e, j) => e * (1 - sr[i]! / n) * (1 - sc[j]! / n)));
  return {
    method,
    statistic: stat,
    statisticName: "X-squared",
    parameter: df,
    parameterName: "df",
    pValue: pValue ?? pValueOf(stat, df),
    observed: x,
    expected: E,
    residuals: diff.map((r, i) => r.map((d, j) => d / Math.sqrt(E[i]![j]!))),
    stdres: diff.map((r, i) => r.map((d, j) => d / Math.sqrt(V[i]![j]!))),
  };
}
