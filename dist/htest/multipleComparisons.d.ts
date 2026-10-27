import { type GroupLabel } from "./groups.js";
import { type PAdjustMethod } from "./pAdjust.js";
import { type Alternative, type Sample } from "./types.js";
/**
 * Result of the PMCMRplus tests (R's `PMCMR` objects).
 *
 * @category Multiple comparisons
 */
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
/**
 * Options of the all-pairs Dunn test.
 *
 * @category Multiple comparisons
 */
export interface KwAllPairsDunnTestOptions {
    /** p-value adjustment (see `pAdjust`). Default `"holm"`. */
    pAdjustMethod?: PAdjustMethod | (string & {});
}
/**
 * Options of the many-to-one tests.
 *
 * @category Multiple comparisons
 */
export interface ManyOneTestOptions {
    /** Alternative hypothesis for each group against the control. Default `"two.sided"`. */
    alternative?: Alternative | "two" | "l" | "g";
}
/**
 * Options of the many-to-one Dunn test.
 *
 * @category Multiple comparisons
 */
export interface KwManyOneDunnTestOptions extends ManyOneTestOptions {
    /** `"single-step"` (simultaneous normal probabilities, the default) or a `pAdjust` method. */
    pAdjustMethod?: "single-step" | PAdjustMethod | (string & {});
}
/**
 * Options of Steel's many-to-one rank test (`manyOneUTest`).
 *
 * @category Multiple comparisons
 */
export type ManyOneUTestOptions = KwManyOneDunnTestOptions;
/**
 * Dunn's all-pairs test of mean ranks with adjusted p-values. Equivalent to `PMCMRplus::kwAllPairsDunnTest()` in R.
 *
 * @param x Response values.
 * @param g Group labels, parallel to `x` (groups in the order of the sorted labels).
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * kwAllPairsDunnTest(x, g).pValue; // [[0.3594249897579995, NaN], [0.02187107427460692, 0.3594249897579995]]
 * ```
 *
 * @category Multiple comparisons
 */
export declare function kwAllPairsDunnTest(x: Sample, g: readonly GroupLabel[], options?: KwAllPairsDunnTestOptions): PMCMRResult;
/**
 * Dunn's many-to-one test of mean ranks against the control (the first group). Equivalent to
 * `PMCMRplus::kwManyOneDunnTest()` in R. With `pAdjustMethod` `"single-step"` (the default) the p-values are the
 * exact simultaneous normal probabilities (R approximates them by randomised integration).
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * kwManyOneDunnTest(x, g).pValue; // [[0.30272579742071715], [0.013938744281312318]]
 * ```
 *
 * @category Multiple comparisons
 */
export declare function kwManyOneDunnTest(x: Sample, g: readonly GroupLabel[], options?: KwManyOneDunnTestOptions): PMCMRResult;
/**
 * Dunnett's many-to-one test of means against the control (the first group), with the pooled variance. Equivalent to
 * `PMCMRplus::dunnettTest()` in R. The p-values are the exact multivariate t probabilities (R approximates them by
 * randomised integration); two-sided, as in PMCMRplus, `min(1, 2 P(max T_i >= |t|))`.
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * dunnettTest(x, g).pValue; // [[0.026103399464872296], [0.0011111316275120736]]
 * ```
 *
 * @category Multiple comparisons
 */
export declare function dunnettTest(x: Sample, g: readonly GroupLabel[], options?: ManyOneTestOptions): PMCMRResult;
/**
 * Steel's many-to-one rank test in its normal approximation: the Mann-Whitney statistic of each group against the
 * control (the first group), each pair ranked on its own (midranks), standardised with the tie-corrected variance.
 * Equivalent to `PMCMRplus::manyOneUTest()` in R. The statistic is positive when the group ranks higher than the
 * control. With `pAdjustMethod` `"single-step"` (the default; at least three groups) the p-values are the exact
 * simultaneous normal probabilities (R approximates them by randomised integration).
 *
 * @param x Response values.
 * @param g Group labels, parallel to `x` (groups in the order of the sorted labels).
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * manyOneUTest(x, g).pValue; // [[0.08993551204759488], [0.08993551204759488]]
 * ```
 *
 * @category Multiple comparisons
 */
export declare function manyOneUTest(x: Sample, g: readonly GroupLabel[], options?: ManyOneUTestOptions): PMCMRResult;
/**
 * Dwass-Steel-Critchlow-Fligner all-pairs test of pairwise Mann-Whitney statistics. Equivalent to
 * `PMCMRplus::dscfAllPairsTest()` in R. The statistic, sqrt(2) (U - n_i n_j / 2) / sqrt(Var U) with the smaller U,
 * is never positive.
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * dscfAllPairsTest(x, g).pValue; // [[0.12122941216677251, NaN], [0.12122941216677251, 0.12122941216677251]]
 * ```
 *
 * @category Multiple comparisons
 */
export declare function dscfAllPairsTest(x: Sample, g: readonly GroupLabel[]): PMCMRResult;
/**
 * Games-Howell all-pairs test of means with Welch's standard errors and degrees of freedom. Equivalent to
 * `PMCMRplus::gamesHowellTest()` in R.
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * gamesHowellTest(x, g).pValue; // [[0.05271565998164183, NaN], [0.009781818487986175, 0.08494498877912128]]
 * ```
 *
 * @category Multiple comparisons
 */
export declare function gamesHowellTest(x: Sample, g: readonly GroupLabel[]): PMCMRResult;
/**
 * Tukey's all-pairs test of means (Tukey-Kramer for unequal sizes). Equivalent to `PMCMRplus::tukeyTest()` in R.
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * tukeyTest(x, g).pValue; // [[0.03403130149294014, NaN], [0.001492661804896774, 0.04527523376597547]]
 * ```
 *
 * @category Multiple comparisons
 */
export declare function tukeyTest(x: Sample, g: readonly GroupLabel[]): PMCMRResult;
/**
 * Steel's many-to-one rank test. Equivalent to `PMCMRplus::steelTest()` in R. It behaves as `steelTest()` of
 * PMCMRplus 1.9.12 does: that fails on every input, so this reproduces its errors. A two-sided
 * alternative is rejected (`'arg' should be one of “greater”, “less”`), unequal group sizes give `Steel's test is
 * only valid for balanced designs.`, and balanced data the error PMCMRplus raises internally.
 *
 * @throws Always.
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * const message = (() => {
 *   try {
 *     steelTest(x, g, { alternative: "greater" });
 *   } catch (e) {
 *     return (e as Error).message;
 *   }
 * })();
 * message; // "'data' must be of a vector type, was 'NULL'"
 * ```
 *
 * @category Multiple comparisons
 */
export declare function steelTest(x: Sample, g: readonly GroupLabel[], options?: ManyOneTestOptions): never;
/**
 * Adjustment method of {@link dunnTest} (dunn.test's `method`).
 *
 * @category Multiple comparisons
 */
export type DunnTestMethod = "none" | "bonferroni" | "sidak" | "holm" | "hs" | "hochberg" | "bh" | "by";
/**
 * Options of {@link dunnTest}.
 *
 * @category Multiple comparisons
 */
export interface DunnTestOptions {
    /** Adjustment of the p-values. Default `"none"`. */
    method?: DunnTestMethod;
    /** Report two-sided p-values (twice the upper tail of |Z|) instead of one-sided ones. Default `false`. */
    altp?: boolean;
}
/**
 * Result of {@link dunnTest} (dunn.test's list).
 *
 * @category Multiple comparisons
 */
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
 * Dunn's test of all pairs of mean ranks. Equivalent to `dunn.test::dunn.test(x, g, method, altp)` in R. The step-wise
 * adjustments multiply (or transform) each p-value by the factor of its rank and cap it at 1, without enforcing
 * monotonicity, as dunn.test does (unlike `pAdjust`).
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * const r = dunnTest(x, g, { method: "bonferroni" });
 * r.comparisons; // ["a - b", "a - c", "b - c"]
 * r.PAdjusted;   // [0.26956874231849964, 0.01093553713730346, 0.26956874231849964]
 * ```
 *
 * @category Multiple comparisons
 */
export declare function dunnTest(x: Sample, g: readonly GroupLabel[], options?: DunnTestOptions): DunnTestResult;
/**
 * Options of {@link glhtDunnett}.
 *
 * @category Multiple comparisons
 */
export interface GlhtDunnettOptions {
    /** Alternative hypothesis for each group against the control. Default `"two.sided"`. */
    alternative?: Alternative | "two" | "l" | "g";
}
/**
 * Result of {@link glhtDunnett}.
 *
 * @category Multiple comparisons
 */
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
 * Dunnett's many-to-one comparisons of a one-way ANOVA with simultaneous p-values. Equivalent to
 * `multcomp::glht()` in R. It gives `summary(glht(aov(y ~ g), linfct = mcp(g = "Dunnett"), alternative))`, with the
 * exact multivariate t probabilities (R approximates them by randomised integration): two-sided
 * `P(max |T_i| >= |t|)`, greater `P(max T_i >= t)`, less `P(min T_i <= t)`.
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * const r = glhtDunnett(x, g);
 * r.names; // ["b - a", "c - a"]
 * r.p;     // [0.02601829573165104, 0.0011091043143827048]
 * ```
 *
 * @category Multiple comparisons
 */
export declare function glhtDunnett(x: Sample, g: readonly GroupLabel[], options?: GlhtDunnettOptions): GlhtDunnettResult;
