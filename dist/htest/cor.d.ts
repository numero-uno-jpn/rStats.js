import { type Alternative, type HTest, type Sample } from "./types.js";
/** Correlation coefficient: Pearson's r, Kendall's tau or Spearman's rho. */
export type CorMethod = "pearson" | "kendall" | "spearman";
/** Options for {@link cor}. */
export interface CorOptions {
    /** Correlation coefficient to compute. Default `"pearson"`. Unambiguous abbreviations are accepted. */
    method?: CorMethod | (string & {});
}
/** Options for {@link corTest}. */
export interface CorTestOptions extends CorOptions {
    /**
     * Alternative hypothesis: `"two.sided"`, `"less"` or `"greater"`. Default `"two.sided"`.
     * Unambiguous abbreviations such as `"two"`, `"l"` and `"g"` are accepted, as in R.
     */
    alternative?: Alternative | "two" | "l" | "g";
    /**
     * Compute an exact p-value (Kendall and Spearman). Default: as in R, exact when there are
     * no ties and n < 50 (Kendall) or n <= 1290 (Spearman). With ties the approximation is
     * always used.
     */
    exact?: boolean;
    /** Confidence level of the interval (Pearson only; the interval needs at least 4 pairs). Default `0.95`. */
    confLevel?: number;
    /** Apply a continuity correction when the approximation is used (Kendall and Spearman). Default `false`. */
    continuity?: boolean;
}
/**
 * Result of {@link corTest}. For Pearson, `statisticName` is `"t"` with `parameter` (df)
 * and `confInt`; for Kendall `"T"` (exact) or `"z"`; for Spearman `"S"`.
 */
export interface CorTestResult extends HTest {
    /** Sample correlation coefficient. */
    estimate: number;
    /** `"cor"`, `"tau"` or `"rho"`. */
    estimateNames: string;
    /** Correlation under the null hypothesis: always `0`. */
    nullValue: number;
    /** `"correlation"`, `"tau"` or `"rho"`. */
    nullValueName: string;
}
/**
 * Correlation coefficient of two vectors. Equivalent to R's `cor(x, y)`.
 *
 * Returns `NaN` if either vector contains `NaN` (R's default `use = "everything"`) or if
 * the correlation is undefined (constant data). The Pearson coefficient is computed in
 * double-double arithmetic, so it can be slightly more accurate than R's (for example,
 * exactly 1 for perfectly correlated data).
 *
 * @param x First vector.
 * @param y Second vector, of the same length as `x`.
 * @param options See {@link CorOptions}.
 * @returns The correlation coefficient.
 */
export declare function cor(x: Sample, y: Sample, options?: CorOptions): number;
/**
 * Test for correlation between paired samples. Equivalent to R's `cor.test()`.
 *
 * Supports Pearson's product-moment correlation (t test, with a Fisher-z confidence
 * interval), Kendall's tau and Spearman's rho (exact or approximate p-values, chosen by
 * the same rules as R). Pairs containing `NaN` are dropped; Pearson needs at least 3
 * pairs and the others at least 2. If the correlation is undefined (constant data) the
 * statistic, p-value and estimate are `NaN`. Correlations are computed in double-double
 * arithmetic, so results can differ from R's when r is very close to ±1, where R's own
 * value is less accurate.
 *
 * @param x First sample.
 * @param y Second sample, of the same length as `x`.
 * @param options See {@link CorTestOptions}.
 * @returns The test result; see {@link CorTestResult}.
 *
 * @example
 * ```ts
 * const r = corTest([1, 2, 3, 4, 5, 6], [2, 1, 4, 3, 7, 8]);
 * r.estimate;  // 0.9014600868406593
 * r.statistic; // 4.165113148435108 (t, df = 4)
 * r.pValue;    // 0.01408675480909387
 *
 * corTest([1, 2, 3, 4, 5, 6], [2, 1, 4, 3, 7, 8], { method: "spearman" });
 * ```
 */
export declare function corTest(x: Sample, y: Sample, options?: CorTestOptions): CorTestResult;
