import type { GroupLabel } from "./groups.js";
import type { HTest, Sample } from "./types.js";
/** Result of {@link propTrendTest}: no `alternative`, as R returns none. */
export interface PropTrendTestResult extends Omit<HTest, "alternative"> {
    /** Degrees of freedom (1). */
    parameter: number;
}
/**
 * Chi-squared test for trend in proportions. Equivalent to R's `prop.trend.test(x, n, score)`.
 *
 * @param x Numbers of events.
 * @param n Numbers of trials.
 * @param score Scores of the groups. Default `1, 2, ..., k`.
 *
 * @example
 * ```ts
 * propTrendTest([15, 10, 8, 4], [30, 30, 30, 30]).statistic; // 9.573428850537288
 * ```
 */
export declare function propTrendTest(x: Sample, n: Sample, score?: Sample): PropTrendTestResult;
/** Alternative of {@link jonckheereTest}. */
export type JonckheereAlternative = "two.sided" | "increasing" | "decreasing";
/** Options for {@link jonckheereTest}. */
export interface JonckheereTestOptions {
    /** `"two.sided"` (default), `"increasing"` or `"decreasing"` (unambiguous abbreviations accepted). */
    alternative?: JonckheereAlternative | (string & {});
    /**
     * The exact p-value (`"DescTools"` only). Default: exact when there are no ties and at most 100 observations. With
     * ties the normal approximation is used anyway, with a warning.
     */
    exact?: boolean;
    /** `"DescTools"` (default: `JonckheereTerpstraTest`) or `"clinfun"` (`jonckheere.test`). */
    variant?: "DescTools" | "clinfun";
    /** The order of the groups. Default: the labels sorted (numbers as numbers, strings by code point). */
    levels?: readonly GroupLabel[];
}
/** Result of {@link jonckheereTest}. */
export interface JonckheereTestResult extends Omit<HTest, "alternative"> {
    alternative: JonckheereAlternative;
    /** The packages' warnings (normal approximation). */
    warnings: string[];
}
/**
 * Jonckheere-Terpstra test of equal distributions against ordered alternatives. Equivalent to DescTools'
 * `JonckheereTerpstraTest(x, g, alternative, exact)` (with `g` an ordered factor) or, with `variant: "clinfun"`, to
 * clinfun's `jonckheere.test(x, g, alternative)` (whose two-sided p-value is `2 min(p_increasing, p_decreasing,
 * 0.5)`; DescTools caps it at 1 instead of 0.5). Pairs with a missing value are dropped.
 *
 * @param x The values.
 * @param g Group labels, parallel to `x`, in the order of the alternative.
 *
 * @example
 * ```ts
 * jonckheereTest([1.1, 2.0, 2.4, 3.5, 3.1, 4.6], [1, 1, 2, 2, 3, 3], { alternative: "increasing" }).statistic; // 11
 * ```
 */
export declare function jonckheereTest(x: Sample, g: readonly GroupLabel[], options?: JonckheereTestOptions): JonckheereTestResult;
