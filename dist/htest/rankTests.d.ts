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
 */
export declare function kruskalTest(x: Sample | readonly Sample[], g?: readonly GroupLabel[]): ChisqStatTestResult;
/**
 * Friedman rank sum test for an unreplicated complete block design. Equivalent to R's `friedman.test()` with a
 * matrix.
 *
 * @param y Blocks as rows, treatments as columns. Rows with a missing value are dropped.
 */
export declare function friedmanTest(y: readonly (readonly number[])[]): ChisqStatTestResult;
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
 */
export declare function quadeTest(y: readonly (readonly number[])[]): QuadeTestResult;
/**
 * Fligner-Killeen (median) test of homogeneity of variances. Equivalent to R's `fligner.test()`.
 *
 * @param x An array of samples (each with at least one non-missing value, as R requires), or one sample with group
 *   labels `g`.
 * @param g Group labels, parallel to `x`.
 */
export declare function flignerTest(x: Sample | readonly Sample[], g?: readonly GroupLabel[]): ChisqStatTestResult;
/** Options for {@link moodTest}. */
export interface MoodTestOptions {
    /** Alternative hypothesis (unambiguous abbreviations accepted). Default `"two.sided"`. */
    alternative?: Alternative | "two" | "l" | "g";
}
/**
 * Mood's two-sample test of scale. Equivalent to R's `mood.test()`. `NaN` values are dropped; ties get the average
 * of the scores of their positions.
 */
export declare function moodTest(x: Sample, y: Sample, options?: MoodTestOptions): HTest;
