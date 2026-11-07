import { type AovStrataFit } from "../models/aovStrata.js";
import { type LmFormulaOptions, type LmFormulaResult } from "../models/lm.js";
import type { DataFrame } from "../models/modelFrame.js";
import { type GroupLabel } from "./groups.js";
import { type Alternative, type HTest, type Sample } from "./types.js";
/**
 * Analysis of variance. Equivalent to R's `aov()`. From samples, one way: the fit of the model `y ~ g` (as
 * `aov("y ~ g", data)`), with the values in a column `y` and the groups as a factor `g`; {@link aovSummary} gives the
 * table of R's `summary(aov(y ~ g))`.
 *
 * The levels of `g` are the group labels (sorted as R orders factor levels), or the positions of the samples in the
 * list (from 1) for an array of samples, as in {@link TukeyHSD}. Missing values are left out, and a sample left empty
 * has no level.
 *
 * @param x An array of samples (groups), or one sample with group labels `g`.
 * @param g Group labels, parallel to `x`.
 *
 * @example
 * ```ts
 * const fit = aov([[2.9, 3.0, 2.5, 2.6, 3.2], [3.8, 2.7, 4.0, 2.4], [2.8, 3.4, 3.7, 2.2, 2.0]]);
 * const t = aovSummary(fit);
 * t.rowNames; // ["g", "Residuals"]
 * t.table[0]; // [2, 0.44678571428571, 0.22339285714286, 0.56007326007326, 0.58663299104174]
 * ```
 *
 * @category Linear models and ANOVA
 */
export declare function aov(x: Sample | readonly Sample[], g?: readonly GroupLabel[]): LmFormulaResult;
/**
 * Analysis of variance from a model formula, as R's `aov(formula, data)` (with `weights` and
 * `contrasts`): the same fit as {@link lm} with a formula; {@link aovSummary} gives the table of R's
 * `summary(aov(...))`. With one `Error()` term (`y ~ W + Error(id/W)`) the fit has error strata: the result is an
 * {@link AovStrataFit} whose tables {@link aovSummary} returns, one per stratum.
 *
 * @param formula A formula such as `"y ~ A * B"`.
 * @param data The data frame: an object of columns.
 *
 * @example
 * ```ts
 * const fit = aov("y ~ g", { y: [4.2, 5.1, 6.3, 5.8, 7.9, 8.4], g: ["a", "a", "b", "b", "c", "c"] });
 * aovSummary(fit).rowNames; // ["g", "Residuals"]
 * ```
 */
export declare function aov(formula: string, data: DataFrame, options?: LmFormulaOptions): LmFormulaResult | AovStrataFit;
/** The one-way ANOVA table from groups (for leveneTest) */
export interface OnewayTable {
    df: [number, number];
    sumSq: [number, number];
    meanSq: [number, number];
    fValue: number;
    pValue: number;
}
/**
 * The one-way ANOVA table of groups: the sums of squares of groupMoments (double-double, on the data scaled by a
 * power of 2), so that a within sum that is exactly 0 stays 0
 */
export declare function onewayTable(groups: readonly (readonly number[])[]): OnewayTable;
/**
 * Options for {@link TukeyHSD}.
 *
 * @category Multiple comparisons
 */
export interface TukeyHSDOptions {
    /** Family-wise confidence level in [0, 1] (a RangeError otherwise). Default `0.95`. */
    confLevel?: number;
}
/**
 * Result of {@link TukeyHSD}: one entry per pair of groups, in R's order (2-1, 3-1, ..., k-1, 3-2, ...).
 *
 * @category Multiple comparisons
 */
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
    /** Alias of `pAdj`: the same array. */
    pAdjusted: number[];
    /** R's warnings, each once, in R's order (an empty array when there are none). */
    warnings: string[];
}
/**
 * Tukey's honest significant differences between the group means of a one-way ANOVA (Tukey-Kramer for unequal
 * sizes). Equivalent to R's `TukeyHSD(aov(y ~ g))`.
 *
 * @param x An array of samples (groups), or one sample with group labels `g` (then `options` comes third).
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * const r = TukeyHSD(x, g);
 * r.names; // ["b-a", "c-a", "c-b"]
 * r.diff;  // [1.4333333333333336, 2.7666666666666666, 1.333333333333333]
 * r.pAdj;  // [0.03403130149294014, 0.001492661804896774, 0.04527523376597547]
 * ```
 *
 * @category Multiple comparisons
 */
export declare function TukeyHSD(x: Sample | readonly Sample[], g?: readonly GroupLabel[] | TukeyHSDOptions, options?: TukeyHSDOptions): TukeyHSDResult;
/**
 * Options for {@link zTest}.
 *
 * @category Hypothesis tests
 */
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
 * Equivalent to `BSDA::z.test()` in R. The open end of a one-sided interval is ±Infinity here (NA in BSDA). `NaN`
 * values are dropped.
 *
 * @example
 * ```ts
 * zTest([5.1, 4.9, 5.6, 5.8, 6.0], { mu: 5, sigmaX: 0.5 }).pValue; // 0.031823127386490346
 * ```
 *
 * @category Hypothesis tests
 */
export declare function zTest(x: Sample, y?: Sample | ZTestOptions, options?: ZTestOptions): HTest;
