import { type Alternative, type Counts, type HTest } from "./types.js";
/**
 * Two-sided method of {@link boschlooTest}: `"square"` (Boschloo's original: Fisher's two-sided p-value as the
 * statistic) or `"central"` (twice the one-sided p-value in the direction of the data).
 *
 * @category Hypothesis tests
 */
export type BoschlooTsMethod = "square" | "central";
/**
 * Options for {@link boschlooTest}.
 *
 * @category Hypothesis tests
 */
export interface BoschlooTestOptions {
    /**
     * Alternative hypothesis, in Exact's orientation: `"less"` means pi1 < pi2 (the proportion of row 1 below that of
     * row 2). Default `"two.sided"`. Unambiguous abbreviations are accepted.
     */
    alternative?: Alternative | "two" | "l" | "g";
    /** Two-sided method: `"square"` (the default, as Exact) or `"central"`. Ignored for one-sided tests. */
    tsmethod?: BoschlooTsMethod | (string & {});
}
/**
 * Result of {@link boschlooTest}.
 *
 * @category Hypothesis tests
 */
export interface BoschlooTestResult extends HTest {
    /** The common proportion pi under the null hypothesis at which the supremum (the p-value) is attained. */
    nuisanceParameter: number;
}
/**
 * Boschloo's exact unconditional test (`method = "boschloo"`) for a 2 x 2 table whose rows are two independent
 * binomial samples. Equivalent to `Exact::exact.test()` in R.
 *
 * The rows are the groups and column 1 counts the events: `[[x1, n1 - x1], [x2, n2 - x2]]`. The statistic is Fisher's
 * exact p-value of each possible table (one-sided, or two-sided for `tsmethod: "square"`), and the p-value is the
 * largest probability, over the common proportion pi under the null hypothesis, of the tables whose statistic is at
 * most the observed one (Boschloo 1970). `alternative: "less"` means pi1 < pi2 (Exact's orientation; exact2x2's
 * `boschloo()` uses the opposite one). `"central"` doubles the one-sided p-value in the direction of the data.
 *
 * The p-value is the true supremum, from a fine grid and a refinement of every candidate maximum; Exact maximises
 * over 100 points refined by `optimise` and rounds to 12 digits (about 1e-9 relative off), and its two-sided
 * `"square"` region can contain tables that do not belong there (docs/differences-from-r.md). `statistic` is the
 * observed Fisher p-value (one-sided in the direction tested, or two-sided for `"square"`), `estimate` the difference
 * of the proportions x1/n1 - x2/n2, and `nuisanceParameter` the pi at which the supremum is attained.
 *
 * A table with more than 2^24 possible outcomes ((n1 + 1)(n2 + 1)) is a RangeError, as is one whose grid would take
 * more than about 10 seconds.
 *
 * @param table A 2 x 2 table of counts: rows are the groups, column 1 the events.
 * @param options See {@link BoschlooTestOptions}.
 * @returns The test result; see {@link BoschlooTestResult}.
 *
 * @example
 * ```ts
 * const r = boschlooTest([[3, 7], [8, 2]], { alternative: "less" });
 * r.pValue;    // 0.020694732666015625 (Exact: 0.020694732666)
 * r.statistic; // 0.034889259347463675 (Fisher's one-sided p-value)
 * r.estimate;  // -0.5
 * ```
 *
 * @category Hypothesis tests
 */
export declare function boschlooTest(table: readonly Counts[], options?: BoschlooTestOptions): BoschlooTestResult;
