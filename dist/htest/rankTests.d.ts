import type { DataFrame } from "../models/modelFrame.js";
import { type GroupLabel } from "./groups.js";
import { type Alternative, type HTest, type Sample } from "./types.js";
/** Result of a k-sample test with a chi-squared statistic. Has no `alternative`, as R returns none. */
export interface ChisqStatTestResult extends Omit<HTest, "alternative"> {
    /** Degrees of freedom (`parameterName` is `"df"`). */
    parameter: number;
}
/**
 * Kruskal-Wallis rank sum test. Equivalent to R's `kruskal.test()`.
 *
 * @param x An array of samples (each with at least one non-missing value, as R requires), or one sample with group
 *   labels `g`.
 * @param g Group labels, parallel to `x`.
 *
 * There is also a formula form, `kruskalTest("y ~ g", data)` (next overload).
 */
export declare function kruskalTest(x: Sample | readonly Sample[], g?: readonly GroupLabel[]): ChisqStatTestResult;
/**
 * Kruskal-Wallis test from a formula and a data frame. Equivalent to R's `kruskal.test(formula, data)`: `"y ~ g"`,
 * one group per level of `g`. Only the variables of the formula count: the rows where one of them is missing are
 * dropped.
 *
 * @param formula `"y ~ g"` (one variable on each side).
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 */
export declare function kruskalTest(formula: string, data: DataFrame): ChisqStatTestResult;
/**
 * Friedman rank sum test for an unreplicated complete block design. Equivalent to R's `friedman.test()` with a
 * matrix.
 *
 * @param y Blocks as rows, treatments as columns. Rows with a missing value are dropped.
 *
 * There is also a formula form, `friedmanTest("y ~ w | b", data)` (next overload).
 */
export declare function friedmanTest(y: readonly (readonly number[])[]): ChisqStatTestResult;
/**
 * Friedman test from a formula and a data frame. Equivalent to R's `friedman.test(formula, data)`: `"y ~ w | b"`
 * with the groups `w` and the blocks `b`. The rows where `y`, `w` or `b` is missing are dropped first; then every
 * combination of group and block must occur exactly once (else the error `not an unreplicated complete block
 * design`, so that one missing value fails, unlike the matrix form, which drops its block).
 *
 * @param formula `"y ~ w | b"` (one variable on each side of `|`).
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 */
export declare function friedmanTest(formula: string, data: DataFrame): ChisqStatTestResult;
/**
 * Cochran's Q test for binary responses in an unreplicated complete block design. Equivalent to DescTools'
 * `CochranQTest()` with a matrix: the Friedman test of the 0/1 matrix (with ties), reported as Q.
 *
 * @param y Blocks as rows, treatments as columns, values 0 or 1. Rows with a missing value are dropped.
 */
export declare function cochranQTest(y: readonly (readonly number[])[]): ChisqStatTestResult;
/** Result of {@link quadeTest}: an F statistic with two degrees of freedom. */
export interface QuadeTestResult extends Omit<HTest, "alternative" | "parameter" | "parameterName"> {
    /** `[num df, denom df]`. */
    parameter: [number, number];
    parameterName: [string, string];
}
/**
 * Quade test for an unreplicated complete block design. Equivalent to R's `quade.test()` with a matrix.
 *
 * @param y Blocks as rows, treatments as columns. Rows with a missing value are dropped.
 *
 * There is also a formula form, `quadeTest("y ~ w | b", data)` (next overload).
 */
export declare function quadeTest(y: readonly (readonly number[])[]): QuadeTestResult;
/**
 * Quade test from a formula and a data frame. Equivalent to R's `quade.test(formula, data)`: `"y ~ w | b"` with the
 * groups `w` and the blocks `b`. The rows where `y`, `w` or `b` is missing are dropped first; then every combination
 * of group and block must occur exactly once (else the error `not an unreplicated complete block design`).
 *
 * @param formula `"y ~ w | b"` (one variable on each side of `|`).
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 */
export declare function quadeTest(formula: string, data: DataFrame): QuadeTestResult;
/**
 * Fligner-Killeen (median) test of homogeneity of variances. Equivalent to R's `fligner.test()`.
 *
 * @param x An array of samples (each with at least one non-missing value, as R requires), or one sample with group
 *   labels `g`.
 * @param g Group labels, parallel to `x`.
 *
 * There is also a formula form, `flignerTest("y ~ g", data)` (next overload).
 */
export declare function flignerTest(x: Sample | readonly Sample[], g?: readonly GroupLabel[]): ChisqStatTestResult;
/**
 * Fligner-Killeen test from a formula and a data frame. Equivalent to R's `fligner.test(formula, data)`: `"y ~ g"`,
 * one group per level of `g`. Only the variables of the formula count: the rows where one of them is missing are
 * dropped.
 *
 * @param formula `"y ~ g"` (one variable on each side).
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 */
export declare function flignerTest(formula: string, data: DataFrame): ChisqStatTestResult;
/** Options for {@link moodTest}. */
export interface MoodTestOptions {
    /** Alternative hypothesis (unambiguous abbreviations accepted). Default `"two.sided"`. */
    alternative?: Alternative | "two" | "l" | "g";
}
/**
 * Mood's two-sample test of scale. Equivalent to R's `mood.test()`. `NaN` values are dropped; ties get the average
 * of the scores of their positions.
 *
 * There is also a formula form, `moodTest("y ~ g", data, options)` (next overload).
 */
export declare function moodTest(x: Sample, y: Sample, options?: MoodTestOptions): HTest;
/**
 * Mood's test from a formula and a data frame. Equivalent to R's `mood.test(formula, data)`: `"y ~ g"` compares the
 * two levels of `g` (the first level is `x`). Only the variables of the formula count: the rows where one of them is
 * missing are dropped.
 *
 * @param formula `"y ~ g"`.
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 */
export declare function moodTest(formula: string, data: DataFrame, options?: MoodTestOptions): HTest;
