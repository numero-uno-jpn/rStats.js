import type { DataFrame } from "../models/modelFrame.js";
import { type GroupLabel } from "./groups.js";
import type { HTest, Sample } from "./types.js";
/**
 * Options for {@link onewayTest}.
 *
 * @category Hypothesis tests
 */
export interface OnewayTestOptions {
    /** Assume equal variances (the classical F test). Default `false` (Welch's test). */
    varEqual?: boolean;
}
/**
 * Result of {@link onewayTest}: an F statistic with two degrees of freedom.
 *
 * @category Hypothesis tests
 */
export interface OnewayTestResult extends Omit<HTest, "alternative" | "parameter" | "parameterName"> {
    /** `[num df, denom df]`. */
    parameter: [number, number];
    /** Names of `parameter`: `["num df", "denom df"]`. */
    parameterName: [string, string];
}
/**
 * Test that several normal samples have equal means, without (default) or with the assumption of equal variances.
 * Equivalent to R's `oneway.test()`.
 *
 * @param x An array of samples, or one sample with group labels `g`.
 * @param g Group labels, parallel to `x` (or the options, when `x` is an array of samples).
 *
 * There is also a formula form, `onewayTest("y ~ A + B", data, options)` (next overload).
 *
 * @example
 * ```ts
 * const r = onewayTest([[2.9, 3.0, 2.5, 2.6, 3.2], [3.8, 2.7, 4.0, 2.4], [2.8, 3.4, 3.7, 2.2, 2.0]]);
 * r.statistic; // 0.39190547838578593 (Welch)
 * r.parameter; // [2, 5.518701575163452]
 * r.pValue;    // 0.693185476837351
 * ```
 *
 * @category Hypothesis tests
 */
export declare function onewayTest(x: Sample | readonly Sample[], g?: readonly GroupLabel[] | OnewayTestOptions, options?: OnewayTestOptions): OnewayTestResult;
/**
 * One-way analysis of means from a formula and a data frame. As R's `oneway.test(formula, data)`:
 * `"y ~ A"` has one group per level of `A`; with several factors, `"y ~ A + B"`, the groups are the combinations of
 * their levels present in the data (R's `interaction()`, the first factor varying fastest). Only the variables of
 * the formula count: the rows where one of them is missing are dropped.
 *
 * @param formula `"y ~ A"` or `"y ~ A + B + ..."`.
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 * @param options See {@link OnewayTestOptions}.
 */
export declare function onewayTest(formula: string, data: DataFrame, options?: OnewayTestOptions): OnewayTestResult;
/**
 * Shapiro-Wilk test of normality. Equivalent to R's `shapiro.test()`. `NaN` values are dropped; the sample size must
 * be between 3 and 5000.
 *
 * @example
 * ```ts
 * const x = [2.1, 3.4, 1.9, 5.6, 4.4, 3.3, 2.8, 4.1, 3.9, 6.2];
 * const r = shapiroTest(x);
 * r.statistic; // 0.9586525103840963
 * r.pValue;    // 0.7704047318146288
 * ```
 *
 * @category Hypothesis tests
 */
export declare function shapiroTest(x: Sample): Omit<HTest, "alternative">;
