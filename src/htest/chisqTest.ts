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
// - simulate.p.value (Monte Carlo) and the two-factor-vector form are not implemented

import { pgamma1 } from "../distributions/gamma.js";
import { ddAdd, type DD } from "../special/dd.js";
import type { HTest, Counts } from "./types.js";

/** Options for {@link chisqTest}. */
export interface ChisqTestOptions {
  /** Apply Yates' continuity correction (2 x 2 tables only). Default `true`. */
  correct?: boolean;
  /** Expected probabilities for the goodness-of-fit test. Default: equal probabilities. Ignored for contingency tables. */
  p?: readonly number[];
  /** Rescale `p` to sum to 1. Default `false`, in which case `p` must sum to 1. */
  rescaleP?: boolean;
}

/**
 * Result of {@link chisqTest}. Has no `alternative`, because R's `chisq.test()` does not return one.
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
 * Not implemented: `simulate.p.value` (Monte Carlo p-values) and passing two factor vectors.
 * R's warning for expected counts below 5 is not issued.
 *
 * @param x Counts, or a contingency table as an array of rows.
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
 * ```
 */
export function chisqTest(x: Counts | readonly Counts[], options: ChisqTestOptions = {}): ChisqTestResult {
  const correct = options.correct ?? true;
  const isMatrix = x.length > 0 && typeof x[0] !== "number";
  if (isMatrix) {
    const rows = (x as readonly Counts[]).map((r) => Array.from(r));
    const nc = rows[0]!.length;
    if (rows.some((r) => r.length !== nc)) throw new TypeError("all rows of the matrix must have the same length");
    // A 1-row or 1-column matrix is treated as a vector
    if (rows.length === 1) return goodnessOfFit(rows[0]!, options);
    if (nc === 1) return goodnessOfFit(rows.map((r) => r[0]!), options);
    return contingency(rows, correct);
  }
  return goodnessOfFit(Array.from(x as Counts), options);
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
  const df = k - 1;
  return {
    method: "Chi-squared test for given probabilities",
    statistic: stat,
    statisticName: "X-squared",
    parameter: df,
    parameterName: "df",
    pValue: pValueOf(stat, df),
    observed: x,
    expected: E,
    residuals: x.map((v, i) => (v - E[i]!) / Math.sqrt(E[i]!)),
    stdres: x.map((v, i) => (v - E[i]!) / Math.sqrt(V[i]!)),
  };
}

function contingency(x: number[][], correct: boolean): ChisqTestResult {
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
  const yates = correct && nr === 2 && nc === 2 ? Math.min(0.5, ...diff.flat().map(Math.abs)) : 0;
  if (yates > 0) {
    method += " with Yates' continuity correction";
    stat = ddSum(diff.flatMap((r, i) => r.map((d, j) => (Math.abs(d) - yates) ** 2 / E[i]![j]!)));
  } else {
    stat = ddSum(diff.flatMap((r, i) => r.map((d, j) => (d * d) / E[i]![j]!)));
  }
  const df = (nr - 1) * (nc - 1);
  const V = E.map((r, i) => r.map((e, j) => e * (1 - sr[i]! / n) * (1 - sc[j]! / n)));
  return {
    method,
    statistic: stat,
    statisticName: "X-squared",
    parameter: df,
    parameterName: "df",
    pValue: pValueOf(stat, df),
    observed: x,
    expected: E,
    residuals: diff.map((r, i) => r.map((d, j) => d / Math.sqrt(E[i]![j]!))),
    stdres: diff.map((r, i) => r.map((d, j) => d / Math.sqrt(V[i]![j]!))),
  };
}
