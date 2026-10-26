import { type Alternative, type HTest, type Sample } from "./types.js";
/**
 * Options for {@link brunnerMunzelTest}.
 *
 * @category Hypothesis tests
 */
export interface BrunnerMunzelTestOptions {
    /**
     * Alternative hypothesis (unambiguous abbreviations accepted). Default `"two.sided"`. As in lawstat, `"greater"`
     * means that `x` tends to be larger than `y` (the relative effect is below 1/2) and `"less"` the opposite.
     */
    alternative?: Alternative | "two" | "l" | "g";
    /** Confidence level of the interval for the relative effect (lawstat's `1 - alpha`). Default `0.95`. */
    confLevel?: number;
}
/**
 * Brunner-Munzel test that two samples have the relative effect P(X < Y) + P(X = Y)/2 = 1/2, without assuming equal
 * variances or shapes. Equivalent to `lawstat::brunner.munzel.test()` in R. `NaN` values are dropped.
 *
 * `estimate` is the estimated relative effect and `confInt` its two-sided interval (not clipped to [0, 1]). When a
 * sample has one value, or when the variance estimates are 0 (for example completely separated samples), the
 * statistic, degrees of freedom and p-value are `NaN` or ±Infinity, as in lawstat.
 *
 * @example
 * ```ts
 * const r = brunnerMunzelTest([1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 4, 1, 1], [3, 3, 4, 3, 1, 2, 3, 1, 1, 5, 4]);
 * r.statistic; // 3.1374674823029509
 * r.pValue;    // 0.0057862086661514605
 * r.estimate;  // 0.78896103896103909
 * ```
 *
 * @category Hypothesis tests
 */
export declare function brunnerMunzelTest(x: Sample, y: Sample, options?: BrunnerMunzelTestOptions): HTest;
