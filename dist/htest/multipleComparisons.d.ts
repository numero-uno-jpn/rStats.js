import { type GroupLabel } from "./groups.js";
import { type PAdjustMethod } from "./pAdjust.js";
import { type Alternative, type Sample } from "./types.js";
/** Result of the PMCMRplus tests (R's `PMCMR` objects). */
export interface PMCMRResult {
    /** Description of the test (R's `method`). */
    method: string;
    /**
     * Statistics as a table: for the all-pairs tests row `r` compares group `rowNames[r]` with each group
     * `colNames[c]` (lower triangle; `NaN` above the diagonal), for the many-to-one tests each group with the control
     * (one column).
     */
    statistic: number[][];
    /** p-values, in the same layout as `statistic`. */
    pValue: number[][];
    /** Labels of the rows (groups 2..k). */
    rowNames: string[];
    /** Labels of the columns (groups 1..k-1, or the control). */
    colNames: string[];
    /** How the p-values were adjusted (`"single-step"` for the simultaneous probabilities). */
    pAdjustMethod: string;
    /** R's warnings. */
    warnings: string[];
}
/** Options of the all-pairs Dunn test. */
export interface KwAllPairsDunnTestOptions {
    /** p-value adjustment (see `pAdjust`). Default `"holm"`. */
    pAdjustMethod?: PAdjustMethod | (string & {});
}
/** Options of the many-to-one tests. */
export interface ManyOneTestOptions {
    /** Alternative hypothesis for each group against the control. Default `"two.sided"`. */
    alternative?: Alternative | "two" | "l" | "g";
}
/** Options of the many-to-one Dunn test. */
export interface KwManyOneDunnTestOptions extends ManyOneTestOptions {
    /** `"single-step"` (simultaneous normal probabilities, the default) or a `pAdjust` method. */
    pAdjustMethod?: "single-step" | PAdjustMethod | (string & {});
}
/** Options of Steel's many-to-one rank test (`manyOneUTest`). */
export type ManyOneUTestOptions = KwManyOneDunnTestOptions;
/**
 * Dunn's all-pairs test of mean ranks with adjusted p-values. Equivalent to PMCMRplus's `kwAllPairsDunnTest()`.
 *
 * @param x Response values.
 * @param g Group labels, parallel to `x` (groups in the order of the sorted labels).
 */
export declare function kwAllPairsDunnTest(x: Sample, g: readonly GroupLabel[], options?: KwAllPairsDunnTestOptions): PMCMRResult;
/**
 * Dunn's many-to-one test of mean ranks against the control (the first group). Equivalent to PMCMRplus's
 * `kwManyOneDunnTest()`. With `pAdjustMethod` `"single-step"` (the default) the p-values are the exact simultaneous
 * normal probabilities (R approximates them by randomised integration).
 */
export declare function kwManyOneDunnTest(x: Sample, g: readonly GroupLabel[], options?: KwManyOneDunnTestOptions): PMCMRResult;
/**
 * Dunnett's many-to-one test of means against the control (the first group), with the pooled variance. Equivalent to
 * PMCMRplus's `dunnettTest()`. The p-values are the exact multivariate t probabilities (R approximates them by
 * randomised integration); two-sided, as in PMCMRplus, `min(1, 2 P(max T_i >= |t|))`.
 */
export declare function dunnettTest(x: Sample, g: readonly GroupLabel[], options?: ManyOneTestOptions): PMCMRResult;
/**
 * Steel's many-to-one rank test in its normal approximation: the Mann-Whitney statistic of each group against the
 * control (the first group), each pair ranked on its own (midranks), standardised with the tie-corrected variance.
 * Equivalent to PMCMRplus's `manyOneUTest()`. The statistic is positive when the group ranks higher than the
 * control. With `pAdjustMethod` `"single-step"` (the default; at least three groups) the p-values are the exact
 * simultaneous normal probabilities (R approximates them by randomised integration).
 *
 * @param x Response values.
 * @param g Group labels, parallel to `x` (groups in the order of the sorted labels).
 */
export declare function manyOneUTest(x: Sample, g: readonly GroupLabel[], options?: ManyOneUTestOptions): PMCMRResult;
/**
 * Dwass-Steel-Critchlow-Fligner all-pairs test of pairwise Mann-Whitney statistics. Equivalent to PMCMRplus's
 * `dscfAllPairsTest()`. The statistic, sqrt(2) (U - n_i n_j / 2) / sqrt(Var U) with the smaller U, is never positive.
 */
export declare function dscfAllPairsTest(x: Sample, g: readonly GroupLabel[]): PMCMRResult;
/**
 * Games-Howell all-pairs test of means with Welch's standard errors and degrees of freedom. Equivalent to
 * PMCMRplus's `gamesHowellTest()`.
 */
export declare function gamesHowellTest(x: Sample, g: readonly GroupLabel[]): PMCMRResult;
/** Tukey's all-pairs test of means (Tukey-Kramer for unequal sizes). Equivalent to PMCMRplus's `tukeyTest()`. */
export declare function tukeyTest(x: Sample, g: readonly GroupLabel[]): PMCMRResult;
/**
 * Steel's many-to-one rank test, as PMCMRplus 1.9.12's `steelTest()` behaves: it fails on every input, so this
 * reproduces its errors. A two-sided alternative is rejected (`'arg' should be one of “greater”, “less”`), unequal
 * group sizes give `Steel's test is only valid for balanced designs.`, and balanced data the error PMCMRplus raises
 * internally.
 *
 * @throws Always.
 */
export declare function steelTest(x: Sample, g: readonly GroupLabel[], options?: ManyOneTestOptions): never;
/** Adjustment method of {@link dunnTest} (dunn.test's `method`). */
export type DunnTestMethod = "none" | "bonferroni" | "sidak" | "holm" | "hs" | "hochberg" | "bh" | "by";
/** Options of {@link dunnTest}. */
export interface DunnTestOptions {
    /** Adjustment of the p-values. Default `"none"`. */
    method?: DunnTestMethod;
    /** Report two-sided p-values (twice the upper tail of |Z|) instead of one-sided ones. Default `false`. */
    altp?: boolean;
}
/** Result of {@link dunnTest} (dunn.test's list). */
export interface DunnTestResult {
    /** Kruskal-Wallis chi-squared statistic (with the tie correction). */
    chi2: number;
    /** Dunn's z for each comparison. */
    Z: number[];
    /** p-values: the upper tail of |Z|, or twice that with `altp`. */
    P: number[];
    /** Adjusted p-values (no monotonicity step). */
    PAdjusted: number[];
    /** Labels of the comparisons, `"<label j> - <label i>"`, in the order (2,1), (3,1), (3,2), (4,1), ... */
    comparisons: string[];
}
/**
 * Dunn's test of all pairs of mean ranks. Equivalent to dunn.test's `dunn.test(x, g, method, altp)`. The step-wise
 * adjustments multiply (or transform) each p-value by the factor of its rank and cap it at 1, without enforcing
 * monotonicity, as dunn.test does (unlike `pAdjust`).
 */
export declare function dunnTest(x: Sample, g: readonly GroupLabel[], options?: DunnTestOptions): DunnTestResult;
/** Options of {@link glhtDunnett}. */
export interface GlhtDunnettOptions {
    /** Alternative hypothesis for each group against the control. Default `"two.sided"`. */
    alternative?: Alternative | "two" | "l" | "g";
}
/** Result of {@link glhtDunnett}. */
export interface GlhtDunnettResult {
    /** Labels of the contrasts, `"<level> - <level 1>"`. */
    names: string[];
    /** Differences of the group means from the control's. */
    estimate: number[];
    /** Their standard errors (pooled). */
    se: number[];
    /** t statistics. */
    t: number[];
    /** Simultaneous (single-step) p-values. */
    p: number[];
    /** Residual degrees of freedom, N - k. */
    df: number;
}
/**
 * Dunnett's many-to-one comparisons of a one-way ANOVA with simultaneous p-values. Equivalent to multcomp's
 * `summary(glht(aov(y ~ g), linfct = mcp(g = "Dunnett"), alternative))`, with the exact multivariate t probabilities
 * (R approximates them by randomised integration): two-sided `P(max |T_i| >= |t|)`, greater `P(max T_i >= t)`, less
 * `P(min T_i <= t)`.
 */
export declare function glhtDunnett(x: Sample, g: readonly GroupLabel[], options?: GlhtDunnettOptions): GlhtDunnettResult;
