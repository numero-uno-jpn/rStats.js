import type { DataFrame } from "../models/modelFrame.js";
import { type Alternative, type HTest, type Sample } from "./types.js";
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
export declare function tTest(x: Sample, y?: Sample | TTestOptions, options?: TTestOptions): TTestResult;
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
export declare function tTest(formula: string, data: DataFrame, options?: TTestOptions): TTestResult;
