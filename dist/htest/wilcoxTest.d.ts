import type { DataFrame } from "../models/modelFrame.js";
import { type Alternative, type HTest, type Sample } from "./types.js";
/**
 * Options for {@link wilcoxTest}.
 *
 * @category Hypothesis tests
 */
export interface WilcoxTestOptions {
    /**
     * Alternative hypothesis: `"two.sided"`, `"less"` or `"greater"`. Default `"two.sided"`.
     * Unambiguous abbreviations such as `"two"`, `"l"` and `"g"` are accepted, as in R.
     */
    alternative?: Alternative | "two" | "l" | "g";
    /** Location under the null hypothesis (location shift for two samples). Default `0`. */
    mu?: number;
    /** Paired test (signed rank test on `x - y`). Requires `y`. Default `false`. */
    paired?: boolean;
    /**
     * Compute an exact p-value (and interval). Default `null`: exact when the sample size is below 50 (both samples,
     * for two samples; zero differences count). With ties or zero differences the exact test is the conditional
     * (permutation) test given the mid-ranks, as in R 4.6; the signed rank test then ranks the zeros with the other
     * differences and leaves them out of the permutation distribution (Pratt).
     *
     * The conditional distribution is built once for the p-value and again for each multiset of scores that the
     * interval's search meets. Where that would take more than about 8 seconds, a RangeError suggesting `exact: false`
     * is thrown before the computation. Measured on a Mac mini (Apple M1, Node 24) with data rounded to one or two
     * decimals: the p-value up to about n = 2400 (one sample) and m = n = 320 (two samples); the interval up to about
     * n = 150 to 300 (one sample; 4 s at n = 150 with 3 decimals, 4.6 s at n = 300 with 1) and m = n = 80 (two samples;
     * 49 x 49 takes 3 s). Ties in few places (or none) cost less.
     */
    exact?: boolean | null;
    /**
     * Continuity correction of the normal approximation. Default `true`. As in R 4.6, also `0` (the same as `true`) or
     * `1`, `2`, `3`: the continuity correction plus that many Edgeworth terms in the p-value (only without ties and zero
     * differences; with them, the continuity correction only). The interval and estimate use the continuity correction
     * alone. Any other number throws.
     */
    correct?: boolean | 0 | 1 | 2 | 3;
    /** Compute a confidence interval and the Hodges-Lehmann estimate. Default `false`. */
    confInt?: boolean;
    /** Confidence level of the interval. Default `0.95`. */
    confLevel?: number;
    /** Tolerance of the root search for the interval and estimate in the normal approximation (R's `tol.root`). Default `1e-4`. */
    tolRoot?: number;
}
/**
 * Result of {@link wilcoxTest}. `statisticName` is `"V"` for the signed rank test and `"W"`
 * for the rank sum test; `parameter` is not set. `estimate` and `confInt` are set only
 * with `confInt: true`.
 *
 * @category Hypothesis tests
 */
export interface WilcoxTestResult extends HTest {
    /** `mu`. */
    nullValue: number;
}
/**
 * Wilcoxon signed rank and rank sum (Mann-Whitney) tests. Equivalent to R's `wilcox.test()`.
 *
 * With one sample (or `paired: true`) performs the signed rank test; with two samples the
 * rank sum test. The choice between exact and normal-approximation p-values, the
 * Hodges-Lehmann estimates and the confidence intervals follow R 4.6: with ties or zeros the
 * exact test is the conditional test given the mid-ranks, and an exact interval reports the
 * confidence level it achieves. Only `NaN` is dropped; infinite values are kept and ranked (as
 * R actually does). Where R 4.6.2 is wrong, the one-sample conditional interval and small
 * two-sided normal p-values, see docs/differences-from-r.md.
 *
 * @param x Sample.
 * @param y Second sample for a two-sample or paired test. May be omitted, and the options
 *   passed in its place: `wilcoxTest(x, { mu: 1 })`.
 * @param options See {@link WilcoxTestOptions}.
 * @returns The test result; see {@link WilcoxTestResult}.
 *
 * @example
 * ```ts
 * const x = [1.83, 0.50, 1.62, 2.48, 1.68, 1.88, 1.55, 3.06, 1.30];
 * const y = [0.878, 0.647, 0.598, 2.05, 1.06, 1.29, 1.06, 3.14, 1.29];
 * const r = wilcoxTest(x, y, { paired: true, alternative: "greater" });
 * r.statistic; // 40 (V)
 * r.pValue;    // 0.01953125
 * ```
 *
 * There is also a formula form, `wilcoxTest("y ~ g", data, options)` (next overload).
 *
 * @category Hypothesis tests
 */
export declare function wilcoxTest(x: Sample, y?: Sample | WilcoxTestOptions, options?: WilcoxTestOptions): WilcoxTestResult;
/**
 * Wilcoxon tests from a formula and a data frame. As R's `wilcox.test(formula, data)`: `"y ~ g"` is the
 * rank sum test of the two levels of `g` (the first level is `x`), `"y ~ 1"` the signed rank test and
 * `"Pair(a, b) ~ 1"` the paired test of `a` and `b` (the option `paired` is not allowed). Only the variables of the
 * formula count: the rows where one of them is missing are dropped.
 *
 * @param formula `"y ~ g"`, `"y ~ 1"` or `"Pair(a, b) ~ 1"`.
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 * @param options See {@link WilcoxTestOptions}.
 */
export declare function wilcoxTest(formula: string, data: DataFrame, options?: WilcoxTestOptions): WilcoxTestResult;
