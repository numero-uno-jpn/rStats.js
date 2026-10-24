import { type Alternative, type HTest, type Sample } from "./types.js";
/** Options for {@link wilcoxTest}. */
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
     * Compute an exact p-value. Default `null`: exact when the sample size is below 50 (both
     * samples, for two samples). Even with `true`, the normal approximation is used when
     * there are ties or zero differences, as in R.
     */
    exact?: boolean | null;
    /** Apply a continuity correction in the normal approximation. Default `true`. */
    correct?: boolean;
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
 * Hodges-Lehmann estimates and the confidence intervals follow R, including R's behavior
 * when the requested confidence level cannot be reached. Only `NaN` is dropped; infinite
 * values are kept and ranked (as R actually does).
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
 */
export declare function wilcoxTest(x: Sample, y?: Sample | WilcoxTestOptions, options?: WilcoxTestOptions): WilcoxTestResult;
