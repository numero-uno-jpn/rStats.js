import { type Alternative, type HTest, type Counts } from "./types.js";
/**
 * Options for {@link fisherTest}.
 *
 * @category Hypothesis tests
 */
export interface FisherTestOptions {
    /**
     * Alternative hypothesis: `"two.sided"`, `"less"` or `"greater"`. Default `"two.sided"`.
     * Unambiguous abbreviations are accepted. Used for 2 x 2 tables only.
     */
    alternative?: Alternative | "two" | "l" | "g";
    /** Compute a confidence interval for the odds ratio (2 x 2 tables only). Default `true`. */
    confInt?: boolean;
    /** Confidence level of the interval (2 x 2 tables only). Default `0.95`. */
    confLevel?: number;
    /** Odds ratio under the null hypothesis (2 x 2 tables only). Default `1`. */
    or?: number;
    /**
     * Compute the p-value of an r x c table (larger than 2 x 2) by Monte Carlo simulation with `B` replicates (R's
     * `simulate.p.value`), using the random stream of {@link setSeed} as R does. Ignored for 2 x 2 tables. Default
     * `false`.
     */
    simulatePValue?: boolean;
    /** Number of replicates for `simulatePValue`. Default `2000`. */
    B?: number;
}
/**
 * Result of {@link fisherTest}. Has no `statistic` or `statisticName`, because R's
 * `fisher.test()` does not return a statistic. For 2 x 2 tables, `estimate` is the
 * conditional maximum likelihood estimate of the odds ratio and `confInt` its interval;
 * for larger tables only `method`, `alternative` and `pValue` are set.
 *
 * @category Hypothesis tests
 */
export interface FisherTestResult extends Omit<HTest, "statistic" | "statisticName"> {
}
/**
 * Fisher's exact test for count data. Equivalent to R's `fisher.test()`.
 *
 * Tests independence in an r x c contingency table with fixed margins. For 2 x 2 tables
 * it also returns the conditional MLE of the odds ratio and its confidence interval,
 * reproducing R's numbers (including R's root-finding tolerance). The two-sided p-value
 * sums the probabilities of tables no more likely than the observed one (relative
 * tolerance `1e-7`, as in R). Non-integer counts are rounded to the nearest integer
 * (ties to even), where R warns and rounds.
 *
 * With `simulatePValue: true`, the p-value of a table larger than 2 x 2 is computed from `B` random tables with the
 * observed margins, drawn from the random stream of {@link setSeed} exactly as in R.
 *
 * Not implemented: R's `hybrid` option.
 *
 * @param x Contingency table as an array of rows (at least 2 x 2).
 * @param options See {@link FisherTestOptions}.
 * @returns The test result; see {@link FisherTestResult}.
 *
 * @example
 * ```ts
 * const r = fisherTest([[3, 1], [1, 3]]);
 * r.pValue;   // 0.4857142857142857
 * r.estimate; // 6.408308867005792 (conditional MLE of the odds ratio)
 * r.confInt;  // [0.2117329153055031, 621.9337505454175]
 * ```
 *
 * @category Hypothesis tests
 */
export declare function fisherTest(x: readonly Counts[], options?: FisherTestOptions): FisherTestResult;
