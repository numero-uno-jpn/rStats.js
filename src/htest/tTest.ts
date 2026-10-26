// t-test (R's t.test): one-sample, two-sample (Welch / equal variance) and paired.
//
// The statistic and degrees-of-freedom formulas are the same as scipy.stats ttest_1samp, ttest_ind
// (equal_var = False is Welch) and ttest_rel (scipy/stats/_stats_py.py; SciPy commit a087e61,
// BSD-3-Clause, see THIRD_PARTY_NOTICES.md). Defaults, confidence intervals and result names follow R's output.
// - Welch is the default (scipy's default is equal variance)
// - If the standard error is below 10 eps times the absolute mean, the data are treated as constant and an error is raised (as in R)

import { pt1, qt1 } from "../distributions/t.js";
import { completePairs, dropNaN, mean, variance } from "../internal/summary.js";
import type { DataFrame } from "../models/modelFrame.js";
import { twoSampleData } from "./testFormula.js";
import { checkConfLevel, matchAlternative, type Alternative, type HTest, type Sample } from "./types.js";

/**
 * Options for {@link tTest}.
 *
 * @category Hypothesis tests
 */
export interface TTestOptions {
  /**
   * Alternative hypothesis: `"two.sided"`, `"less"` or `"greater"`. Default `"two.sided"`.
   * Unambiguous abbreviations such as `"two"`, `"l"` and `"g"` are accepted, as in R.
   */
  alternative?: Alternative | "two" | "l" | "g";
  /** True mean under the null hypothesis (difference in means for two samples). Default `0`. */
  mu?: number;
  /** Paired t-test on `x - y` (pairs with `NaN` are dropped). Requires `y`. Default `false`. */
  paired?: boolean;
  /** Assume equal variances and use the pooled variance. Default `false` (Welch's test). */
  varEqual?: boolean;
  /** Confidence level of the interval. Default `0.95`. */
  confLevel?: number;
}

/**
 * Result of {@link tTest}.
 *
 * @category Hypothesis tests
 */
export interface TTestResult extends HTest {
  /** Degrees of freedom of the t distribution (`parameterName` is `"df"`). */
  parameter: number;
  /** Confidence interval for the mean (or difference in means). */
  confInt: [number, number];
  /** Confidence level of `confInt`. */
  confLevel: number;
  /** Mean of `x` (or of the differences), or `[mean of x, mean of y]` for two samples. */
  estimate: number | number[];
  /** `mu`. */
  nullValue: number;
  /** Standard error of the mean (or difference), R's `stderr`. */
  stdErr: number;
}


/**
 * Student's t-test. Equivalent to R's `t.test()`.
 *
 * Performs a one-sample, two-sample (Welch's by default, or pooled-variance with
 * `varEqual: true`) or paired t-test. `NaN` values are dropped. As in R, an error is
 * thrown if the data are essentially constant.
 *
 * @param x Sample.
 * @param y Second sample for a two-sample or paired test. May be omitted, and the options
 *   passed in its place: `tTest(x, { mu: 1 })`.
 * @param options See {@link TTestOptions}.
 * @returns The test result, with `statisticName` `"t"`; see {@link TTestResult}.
 *
 * @example
 * ```ts
 * const r = tTest([5.1, 4.9, 5.6, 5.8, 6.0, 5.4], { mu: 5 });
 * r.statistic; // 2.7351263280759737
 * r.parameter; // 5
 * r.pValue;    // 0.04102919855187924
 * r.confInt;   // [5.028074545960439, 5.905258787372895]
 *
 * tTest([1, 2, 3, 4, 5], [3, 4, 5, 6, 8]).pValue; // 0.0849560662972433 (Welch)
 * ```
 *
 * There is also a formula form, `tTest("y ~ g", data, options)` (next overload).
 *
 * @category Hypothesis tests
 */
export function tTest(x: Sample, y?: Sample | TTestOptions, options?: TTestOptions): TTestResult;
/**
 * Student's t-test from a formula and a data frame. As R's `t.test(formula, data)`: `"y ~ g"` compares
 * the two levels of `g` (the first level is `x`; `estimateNames` and `nullValueName` name the levels, as in R),
 * `"y ~ 1"` is the one-sample test and `"Pair(a, b) ~ 1"` the paired test of `a` and `b` (the option `paired` is not
 * allowed). Only the variables of the formula count: the rows where one of them is missing are dropped.
 *
 * @param formula `"y ~ g"`, `"y ~ 1"` or `"Pair(a, b) ~ 1"`.
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 * @param options See {@link TTestOptions}.
 *
 * @example
 * ```ts
 * tTest("y ~ g", { y: [5.1, 4.9, 5.6, 5.8, 6.0, 5.4], g: ["a", "a", "a", "b", "b", "b"] }).estimateNames;
 * // ["mean in group a", "mean in group b"]
 * ```
 */
export function tTest(formula: string, data: DataFrame, options?: TTestOptions): TTestResult;
export function tTest(x: Sample | string, y?: Sample | TTestOptions | DataFrame, options: TTestOptions = {}): TTestResult {
  if (typeof x === "string") return tTestFormula(x, y as DataFrame, options);
  // Also accept the form tTest(x, { mu: 1 })
  let ys: Sample | undefined;
  if (y !== undefined && !ArrayBuffer.isView(y) && !Array.isArray(y)) options = y as TTestOptions;
  else ys = y as Sample | undefined;
  const alternative = matchAlternative(options.alternative);
  const mu = options.mu ?? 0;
  const paired = options.paired ?? false;
  const varEqual = options.varEqual ?? false;
  const confLevel = options.confLevel ?? 0.95;
  if (Number.isNaN(mu)) throw new RangeError("mu must be a number");
  checkConfLevel(confLevel);
  if (paired && ys === undefined) throw new TypeError("y is required when paired is true");

  let xs = Array.from(x);
  let yv = ys === undefined ? undefined : Array.from(ys);
  if (paired) {
    const [a, b] = completePairs(xs, yv!);
    xs = a.map((v, i) => v - b[i]!);
    yv = undefined;
  } else {
    xs = dropNaN(xs);
    if (yv !== undefined) yv = dropNaN(yv);
  }

  let tstat: number;
  let df: number;
  let stdErr: number;
  let estimate: number | number[];
  let estimateNames: string | string[];
  let method: string;
  let nullValueName: string;

  const nx = xs.length;
  if (nx < 2) throw new Error("not enough 'x' observations");
  const mx = mean(xs);
  const vx = variance(xs);
  if (yv === undefined) {
    df = nx - 1;
    stdErr = Math.sqrt(vx / nx);
    if (stdErr < 10 * Number.EPSILON * Math.abs(mx)) throw new Error("data are essentially constant");
    tstat = (mx - mu) / stdErr;
    method = paired ? "Paired t-test" : "One Sample t-test";
    estimate = mx;
    estimateNames = paired ? "mean difference" : "mean of x";
    nullValueName = paired ? "mean difference" : "mean";
  } else {
    const ny = yv.length;
    if (ny < 1 || (!varEqual && ny < 2)) throw new Error("not enough 'y' observations");
    if (varEqual && nx + ny < 3) throw new Error("not enough observations");
    const my = mean(yv);
    const vy = variance(yv);
    method = `${varEqual ? "" : "Welch"} Two Sample t-test`;
    estimate = [mx, my];
    estimateNames = ["mean of x", "mean of y"];
    nullValueName = "difference in means";
    if (varEqual) {
      df = nx + ny - 2;
      let v = 0;
      if (nx > 1) v += (nx - 1) * vx;
      if (ny > 1) v += (ny - 1) * vy;
      v /= df;
      stdErr = Math.sqrt(v * (1 / nx + 1 / ny));
    } else {
      const sx = vx / nx;
      const sy = vy / ny;
      stdErr = Math.sqrt(sx + sy);
      df = (stdErr * stdErr) ** 2 / ((sx * sx) / (nx - 1) + (sy * sy) / (ny - 1));
    }
    if (stdErr < 10 * Number.EPSILON * Math.max(Math.abs(mx), Math.abs(my))) {
      throw new Error("data are essentially constant");
    }
    tstat = (mx - my - mu) / stdErr;
  }

  let pValue: number;
  let confInt: [number, number];
  if (alternative === "less") {
    pValue = pt1(tstat, df, true, false);
    confInt = [-Infinity, tstat + qt1(confLevel, df, true, false)];
  } else if (alternative === "greater") {
    pValue = pt1(tstat, df, false, false);
    confInt = [tstat - qt1(confLevel, df, true, false), Infinity];
  } else {
    pValue = 2 * pt1(-Math.abs(tstat), df, true, false);
    const alpha = 1 - confLevel;
    const c = qt1(1 - alpha / 2, df, true, false);
    confInt = [tstat - c, tstat + c];
  }
  confInt = [mu + confInt[0] * stdErr, mu + confInt[1] * stdErr];

  return {
    method,
    alternative,
    statistic: tstat,
    statisticName: "t",
    parameter: df,
    parameterName: "df",
    pValue,
    confInt,
    confLevel,
    estimate,
    estimateNames,
    nullValue: mu,
    nullValueName,
    stdErr,
  };
}

/** t.test from a formula: the default form on the data the formula selects, with the estimates named after the levels */
function tTestFormula(formula: string, data: DataFrame, options: TTestOptions): TTestResult {
  if (options.paired !== undefined) throw new Error("cannot use 'paired' in formula method");
  const d = twoSampleData(formula, data, true);
  if (d.kind === "one") return tTest(d.x, options);
  if (d.kind === "paired") return tTest(d.x, d.y, { ...options, paired: true });
  const [first, second] = d.levels;
  return {
    ...tTest(d.x, d.y, options),
    estimateNames: [`mean in group ${first}`, `mean in group ${second}`],
    nullValueName: `difference in means between group ${first} and group ${second}`,
  };
}
