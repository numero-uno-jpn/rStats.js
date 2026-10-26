import type { DataFrame } from "../models/modelFrame.js";
import { type Alternative, type HTest, type Sample } from "./types.js";
/** Options for {@link ksTest}. */
export interface KsTestOptions {
    /**
     * Alternative hypothesis (unambiguous abbreviations accepted). `"greater"`: the distribution function of `x` lies
     * above that of `y` (statistic D^+); `"less"`: below (D^-). Default `"two.sided"`.
     */
    alternative?: Alternative | "two" | "l" | "g";
    /**
     * Exact p-value. Default: exact for one sample of fewer than 100 values without ties, and for two samples with
     * m n < 10000.
     */
    exact?: boolean;
}
/**
 * Result of {@link ksTest}. As in R, `alternative` describes the hypothesis in words ("two-sided", "the CDF of x lies
 * above the null hypothesis", ...), and `exact` tells whether the p-value is exact.
 */
export interface KsTestResult extends Omit<HTest, "alternative"> {
    alternative: string;
    exact: boolean;
}
/**
 * Kolmogorov-Smirnov test. Equivalent to R's `ks.test()`, with a distribution function given as a function (for
 * example `(q) => pnorm(q)`) or a second sample. `NaN` values are dropped.
 *
 * @param x Sample.
 * @param y A continuous distribution function, or a second sample.
 * @param options See {@link KsTestOptions}.
 *
 * There is also a formula form for two samples, `ksTest("y ~ g", data, options)` (next overload).
 */
export declare function ksTest(x: Sample, y: Sample | ((q: number) => number), options?: KsTestOptions): KsTestResult;
/**
 * Two-sample Kolmogorov-Smirnov test from a formula and a data frame. Equivalent to R's `ks.test(formula, data)`:
 * `"y ~ g"` compares the two levels of `g` (the first level is `x`). Only the variables of the formula count: the
 * rows where one of them is missing are dropped.
 *
 * @param formula `"y ~ g"`.
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 * @param options See {@link KsTestOptions}.
 */
export declare function ksTest(formula: string, data: DataFrame, options?: KsTestOptions): KsTestResult;
