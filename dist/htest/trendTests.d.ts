import type { GroupLabel } from "./groups.js";
import type { HTest, Sample } from "./types.js";
/**
 * Result of {@link propTrendTest}: no `alternative`, as R returns none.
 *
 * @category Hypothesis tests
 */
export interface PropTrendTestResult extends Omit<HTest, "alternative"> {
    /** Degrees of freedom (1). */
    parameter: number;
}
/**
 * Options for {@link propTrendTest}.
 *
 * @category Hypothesis tests
 */
export interface PropTrendTestOptions {
    /** Scores of the groups (as the third argument `score`). Default `1, 2, ..., k`. */
    score?: Sample;
}
/**
 * Chi-squared test for trend in proportions. Equivalent to R's `prop.trend.test(x, n, score)`. The scores are the
 * third argument or the option `score` (giving both is a RangeError).
 *
 * @param x Numbers of events.
 * @param n Numbers of trials.
 * @param score Scores of the groups. Default `1, 2, ..., k`. A group with a NaN score is left out of the regression
 *   (as R's `lm` omits it), but its counts stay in the pooled proportion and the weights, as in R. Other scores must
 *   be finite, with at least two distinct values. With no events or only events (all proportions 0, or all 1) the test is not defined (an error, as in R).
 *
 * @example
 * ```ts
 * propTrendTest([15, 10, 8, 4], [30, 30, 30, 30]).statistic; // 9.573428850537288
 * ```
 *
 * @category Hypothesis tests
 */
export declare function propTrendTest(x: Sample, n: Sample, score?: Sample): PropTrendTestResult;
/**
 * Chi-squared test for trend in proportions, with the scores in the options:
 * `propTrendTest(x, n, { score: [0, 1, 2, 4] })`.
 *
 * @example
 * ```ts
 * propTrendTest([15, 10, 8, 4], [30, 30, 30, 30], { score: [1, 2, 3, 4] }).statistic; // 9.573428850537288
 * ```
 */
export declare function propTrendTest(x: Sample, n: Sample, options: PropTrendTestOptions): PropTrendTestResult;
/**
 * Alternative of {@link jonckheereTest}.
 *
 * @category Hypothesis tests
 */
export type JonckheereAlternative = "two.sided" | "increasing" | "decreasing";
/**
 * Options for {@link jonckheereTest}.
 *
 * @category Hypothesis tests
 */
export interface JonckheereTestOptions {
    /** `"two.sided"` (default), `"increasing"` or `"decreasing"` (unambiguous abbreviations accepted). */
    alternative?: JonckheereAlternative | (string & {});
    /**
     * The exact p-value (`"DescTools"` only). Default: exact when there are no ties and at most 100 observations. With
     * ties the normal approximation is used anyway, with a warning. The exact distribution is the convolution of the
     * Mann-Whitney distributions; where it would have more than 2^24 values or take more than 2^32 multiply-adds
     * (three equal groups of 216, about 8 s), `exact: true` is a RangeError (R computes it however long it takes).
     */
    exact?: boolean;
    /** `"DescTools"` (default: `JonckheereTerpstraTest`) or `"clinfun"` (`jonckheere.test`). */
    variant?: "DescTools" | "clinfun";
    /** The order of the groups. Default: the labels sorted (numbers as numbers, strings by code point). */
    levels?: readonly GroupLabel[];
}
/**
 * Result of {@link jonckheereTest}.
 *
 * @category Hypothesis tests
 */
export interface JonckheereTestResult extends Omit<HTest, "alternative"> {
    /** Alternative hypothesis: `"two.sided"`, `"increasing"` or `"decreasing"`. */
    alternative: JonckheereAlternative;
    /** The packages' warnings (normal approximation). */
    warnings: string[];
}
/**
 * Jonckheere-Terpstra test of equal distributions against ordered alternatives. Equivalent to
 * `DescTools::JonckheereTerpstraTest()` in R. Computes `JonckheereTerpstraTest(x, g, alternative, exact)` (with `g`
 * an ordered factor) or, with `variant: "clinfun"`, clinfun's `jonckheere.test(x, g, alternative)` (whose
 * two-sided p-value is `2 min(p_increasing, p_decreasing, 0.5)`; DescTools caps it at 1 instead of 0.5). Pairs with a missing value are dropped (with `variant: "clinfun"`, also those with an infinite value, as clinfun does).
 *
 * @param x The values.
 * @param g Group labels, parallel to `x`, in the order of the alternative.
 *
 * @example
 * ```ts
 * jonckheereTest([1.1, 2.0, 2.4, 3.5, 3.1, 4.6], [1, 1, 2, 2, 3, 3], { alternative: "increasing" }).statistic; // 11
 * ```
 *
 * @category Hypothesis tests
 */
export declare function jonckheereTest(x: Sample, g: readonly GroupLabel[], options?: JonckheereTestOptions): JonckheereTestResult;
