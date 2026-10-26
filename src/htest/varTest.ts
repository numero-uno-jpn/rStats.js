// F test comparing two variances (R's var.test) and Bartlett's test of homogeneity of variances (R's bartlett.test).
//
// Written for rStats.js from the textbook formulas (no ported code). var.test: F = (s_x^2 / s_y^2) / ratio with
// (n_x - 1, n_y - 1) degrees of freedom, and the interval for the ratio from F quantiles. Both tails of the p-value
// are computed directly (not as 1 - P), so small p-values keep their relative accuracy. bartlett.test (Bartlett,
// Proc. R. Soc. A 160, 1937): K^2 = (N log s_p^2 - sum n_i log s_i^2) / (1 + (sum 1/n_i - 1/N) / (3 (k - 1))), with
// n_i = size - 1, N = sum n_i and s_p^2 the pooled variance; chi-squared with k - 1 degrees of freedom.

import { pf1, qf1 } from "../distributions/f.js";
import { pgamma1 } from "../distributions/gamma.js";
import { variance } from "../internal/summary.js";
import type { DataFrame } from "../models/modelFrame.js";
import { kSampleData, samplesByLevel, twoGroupData } from "./testFormula.js";
import { checkConfLevelOpen, matchAlternative, type Alternative, type HTest, type Sample } from "./types.js";

/** Options for {@link varTest}. */
export interface VarTestOptions {
  /** Hypothesized ratio of the variances of `x` and `y`. Default `1`. */
  ratio?: number;
  /** Alternative hypothesis (unambiguous abbreviations accepted). Default `"two.sided"`. */
  alternative?: Alternative | "two" | "l" | "g";
  /** Confidence level of the interval. Default `0.95`. */
  confLevel?: number;
}

/** Result of {@link varTest}. The F distribution has two degrees of freedom, so `parameter` is a pair. */
export interface VarTestResult extends Omit<HTest, "parameter" | "parameterName"> {
  /** `[num df, denom df]`. */
  parameter: [number, number];
  /** Names of `parameter`: `["num df", "denom df"]`. */
  parameterName: [string, string];
  confInt: [number, number];
  confLevel: number;
  /** Ratio of the sample variances. */
  estimate: number;
  nullValue: number;
}

/**
 * F test that the variances of two normal samples have a given ratio. Equivalent to R's `var.test()`. `NaN` values
 * are dropped.
 *
 * @example
 * ```ts
 * varTest([1, 3, 2, 5, 4], [2, 9, 4, 12, 7, 1]).statistic; // 0.13761467889908255
 * ```
 *
 * There is also a formula form, `varTest("y ~ g", data, options)` (next overload).
 */
export function varTest(x: Sample, y: Sample, options?: VarTestOptions): VarTestResult;
/**
 * F test of two variances from a formula and a data frame. As R's `var.test(formula, data)`: `"y ~ g"`
 * compares the two levels of `g` (the first level is `x`). Only the variables of the formula count: the rows where
 * one of them is missing are dropped.
 *
 * @param formula `"y ~ g"`.
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 */
export function varTest(formula: string, data: DataFrame, options?: VarTestOptions): VarTestResult;
export function varTest(x: Sample | string, y: Sample | DataFrame, options: VarTestOptions = {}): VarTestResult {
  if (typeof x === "string") {
    const d = twoGroupData(x, y as DataFrame);
    return varTest(d.x, d.y, options);
  }
  // as in R, infinite values are dropped along with NaN
  const xs = Array.from(x).filter(Number.isFinite);
  const ys = Array.from(y as Sample).filter(Number.isFinite);
  const ratio = options.ratio ?? 1;
  if (!(Number.isFinite(ratio) && ratio > 0)) throw new RangeError("'ratio' must be a single positive number");
  const alternative = matchAlternative(options.alternative);
  const confLevel = options.confLevel ?? 0.95;
  checkConfLevelOpen(confLevel);
  const dfx = xs.length - 1;
  const dfy = ys.length - 1;
  if (dfx < 1) throw new Error("not enough 'x' observations");
  if (dfy < 1) throw new Error("not enough 'y' observations");
  const estimate = variance(xs) / variance(ys);
  const statistic = estimate / ratio;
  const lower = pf1(statistic, dfx, dfy, true, false);
  const upper = pf1(statistic, dfx, dfy, false, false);
  let pValue: number;
  let confInt: [number, number];
  if (alternative === "less") {
    pValue = lower;
    confInt = [0, estimate / qf1(1 - confLevel, dfx, dfy, true, false)];
  } else if (alternative === "greater") {
    pValue = upper;
    confInt = [estimate / qf1(confLevel, dfx, dfy, true, false), Infinity];
  } else {
    pValue = Math.min(1, 2 * Math.min(lower, upper));
    const beta = (1 - confLevel) / 2;
    confInt = [estimate / qf1(1 - beta, dfx, dfy, true, false), estimate / qf1(beta, dfx, dfy, true, false)];
  }
  return {
    method: "F test to compare two variances",
    alternative,
    statistic,
    statisticName: "F",
    parameter: [dfx, dfy],
    parameterName: ["num df", "denom df"],
    pValue,
    confInt,
    confLevel,
    estimate,
    estimateNames: "ratio of variances",
    nullValue: ratio,
    nullValueName: "ratio of variances",
  };
}

/** Result of {@link bartlettTest}. Has no `alternative`, as R's `bartlett.test()` returns none. */
export interface BartlettTestResult extends Omit<HTest, "alternative"> {
  /** Degrees of freedom (`parameterName` is `"df"`). */
  parameter: number;
}

/**
 * Bartlett's test that the variances of several normal samples are equal. Equivalent to R's `bartlett.test()`.
 * Takes a list of samples. `NaN` and infinite values are dropped, as in R.
 *
 * @param groups The samples (at least two), each with at least two finite values.
 *
 * @example
 * ```ts
 * bartlettTest([[1, 3, 2, 5], [2, 9, 4, 12, 7], [3, 3.5, 4, 2]]).statistic;
 * ```
 *
 * There is also a formula form, `bartlettTest("y ~ g", data)` (next overload).
 */
export function bartlettTest(groups: readonly Sample[]): BartlettTestResult;
/**
 * Bartlett's test from a formula and a data frame. As R's `bartlett.test(formula, data)`: `"y ~ g"`, one
 * group per level of `g`, in the order of the levels. Only the variables of the formula count: the rows where one of
 * them is missing are dropped.
 *
 * @param formula `"y ~ g"` (one variable on each side).
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 */
export function bartlettTest(formula: string, data: DataFrame): BartlettTestResult;
export function bartlettTest(x: readonly Sample[] | string, data?: DataFrame): BartlettTestResult {
  if (typeof x === "string") {
    const d = kSampleData(x, data!);
    return bartlettTest(samplesByLevel(d.values, d.group));
  }
  const groups = x;
  const k = groups.length;
  if (k < 2) throw new RangeError("'x' must be a list with at least 2 elements");
  const n: number[] = [];
  const v: number[] = [];
  for (const g of groups) {
    // as in R, infinite values are dropped along with NaN
    const s = Array.from(g).filter(Number.isFinite);
    if (s.length < 2) throw new RangeError("there must be at least 2 observations in each group");
    n.push(s.length - 1);
    v.push(variance(s));
  }
  let N = 0;
  let pooled = 0;
  let sumLog = 0;
  let sumInv = 0;
  for (let i = 0; i < k; i++) {
    N += n[i]!;
    pooled += n[i]! * v[i]!;
    sumLog += n[i]! * Math.log(v[i]!);
    sumInv += 1 / n[i]!;
  }
  pooled /= N;
  const statistic = (N * Math.log(pooled) - sumLog) / (1 + (sumInv - 1 / N) / (3 * (k - 1)));
  const df = k - 1;
  return {
    method: "Bartlett test of homogeneity of variances",
    statistic,
    statisticName: "Bartlett's K-squared",
    parameter: df,
    parameterName: "df",
    pValue: pgamma1(statistic, df / 2, 2, false, false),
  };
}
