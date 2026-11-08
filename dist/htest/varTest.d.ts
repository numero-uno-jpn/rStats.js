import type { DataFrame } from "../models/modelFrame.js";
import { type Alternative, type HTest, type Sample } from "./types.js";
/**
 * Options for {@link varTest}.
 *
 * @category Hypothesis tests
 */
export interface VarTestOptions {
    /** Hypothesized ratio of the variances of `x` and `y`. Default `1`. */
    ratio?: number;
    /** Alternative hypothesis (unambiguous abbreviations accepted). Default `"two.sided"`. */
    alternative?: Alternative | "two" | "l" | "g";
    /** Confidence level of the interval. Default `0.95`. */
    confLevel?: number;
}
/**
 * Result of {@link varTest}. The F distribution has two degrees of freedom, so `parameter` is a pair.
 *
 * @category Hypothesis tests
 */
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
 *
 * @category Hypothesis tests
 */
export declare function varTest(x: Sample, y: Sample, options?: VarTestOptions): VarTestResult;
/**
 * F test of two variances from a formula and a data frame. As R's `var.test(formula, data)`: `"y ~ g"`
 * compares the two levels of `g` (the first level is `x`). Only the variables of the formula count: the rows where
 * one of them is missing are dropped.
 *
 * @param formula `"y ~ g"`.
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 */
export declare function varTest(formula: string, data: DataFrame, options?: VarTestOptions): VarTestResult;
/**
 * Result of {@link bartlettTest}. Has no `alternative`, as R's `bartlett.test()` returns none.
 *
 * @category Hypothesis tests
 */
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
 *
 * @category Hypothesis tests
 */
export declare function bartlettTest(groups: readonly Sample[]): BartlettTestResult;
/**
 * Bartlett's test from a formula and a data frame. As R's `bartlett.test(formula, data)`: `"y ~ g"`, one
 * group per level of `g`, in the order of the levels. Only the variables of the formula count: the rows where one of
 * them is missing are dropped.
 *
 * @param formula `"y ~ g"` (one variable on each side).
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 */
export declare function bartlettTest(formula: string, data: DataFrame): BartlettTestResult;
