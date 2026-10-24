import { type GroupLabel } from "./groups.js";
import { type Alternative, type HTest, type Sample } from "./types.js";
/** Result of {@link aov}: the one-way ANOVA table, rows "between groups" and "residuals". */
export interface AovResult {
    /** Degrees of freedom `[k - 1, N - k]`. */
    df: [number, number];
    /** Sums of squares `[between, residual]`. */
    sumSq: [number, number];
    /** Mean squares `[between, residual]`. */
    meanSq: [number, number];
    /** F statistic. */
    fValue: number;
    /** p-value of the F test. */
    pValue: number;
}
/**
 * One-way analysis of variance. Equivalent to the table of R's `summary(aov(y ~ g))` for one factor.
 *
 * @param x An array of samples (groups), or one sample with group labels `g`.
 * @param g Group labels, parallel to `x`.
 *
 * @example
 * ```ts
 * const r = aov([[2.9, 3.0, 2.5, 2.6, 3.2], [3.8, 2.7, 4.0, 2.4], [2.8, 3.4, 3.7, 2.2, 2.0]]);
 * r.fValue; // 0.5600732600732597
 * r.pValue; // 0.586632991041738
 * ```
 */
export declare function aov(x: Sample | readonly Sample[], g?: readonly GroupLabel[]): AovResult;
/** Options for {@link TukeyHSD}. */
export interface TukeyHSDOptions {
    /** Family-wise confidence level. Default `0.95`. */
    confLevel?: number;
}
/** Result of {@link TukeyHSD}: one entry per pair of groups, in R's order (2-1, 3-1, ..., k-1, 3-2, ...). */
export interface TukeyHSDResult {
    /**
     * Labels of the comparisons, `"a-b"`: the group labels when given, otherwise the positions of the samples in the
     * list (from 1). Groups without data are left out, as in R.
     */
    names: string[];
    /** The group compared (1-based position among the groups compared, i > j). */
    i: number[];
    /** The group it is compared with (1-based index). */
    j: number[];
    /** Difference of means, group i minus group j. */
    diff: number[];
    /** Lower ends of the simultaneous intervals. */
    lwr: number[];
    /** Upper ends. */
    upr: number[];
    /** p-values adjusted for the multiple comparisons. */
    pAdj: number[];
}
/**
 * Tukey's honest significant differences between the group means of a one-way ANOVA (Tukey-Kramer for unequal
 * sizes). Equivalent to R's `TukeyHSD(aov(y ~ g))`.
 *
 * @param x An array of samples (groups), or one sample with group labels `g` (then `options` comes third).
 */
export declare function TukeyHSD(x: Sample | readonly Sample[], g?: readonly GroupLabel[] | TukeyHSDOptions, options?: TukeyHSDOptions): TukeyHSDResult;
/** Options for {@link zTest}. */
export interface ZTestOptions {
    /** Known standard deviation of the population of `x` (required). */
    sigmaX?: number;
    /** Known standard deviation of the population of `y` (required with `y`). */
    sigmaY?: number;
    /** Mean (or difference of means) under the null hypothesis. Default `0`. */
    mu?: number;
    /** Alternative hypothesis (unambiguous abbreviations accepted). Default `"two.sided"`. */
    alternative?: Alternative | "two" | "l" | "g";
    /** Confidence level of the interval. Default `0.95`. */
    confLevel?: number;
}
/**
 * z test for the mean of one sample, or the difference of the means of two, with known standard deviations.
 * Equivalent to `BSDA::z.test()` (the open end of a one-sided interval is ±Infinity here, NA in BSDA). `NaN` values
 * are dropped.
 *
 * @example
 * ```ts
 * zTest([5.1, 4.9, 5.6, 5.8, 6.0], { mu: 5, sigmaX: 0.5 }).pValue;
 * ```
 */
export declare function zTest(x: Sample, y?: Sample | ZTestOptions, options?: ZTestOptions): HTest;
