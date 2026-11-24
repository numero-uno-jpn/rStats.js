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
    /**
     * The mid-p version of the test of a 2 x 2 table (as `exact2x2::fisher.exact(x, midp = TRUE)`): the p-value and the
     * confidence limits from the mid-p tails P(X < x) + P(X = x)/2 and P(X > x) + P(X = x)/2 of the (1, 1) cell; the
     * two-sided p-value is twice the smaller tail (the central test) and the estimate stays the conditional MLE. An error
     * for larger tables. Default `false`.
     */
    midp?: boolean;
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
 * (ties to even), with R's warning ("'x' has been rounded to integer: Mean relative difference: 0.0625", the text of
 * R's `all.equal` of the counts and the rounded counts; none where they differ by less than about 1.5e-8).
 *
 * With `simulatePValue: true`, the p-value of a table larger than 2 x 2 is computed from `B` random tables with the
 * observed margins, drawn from the random stream of {@link setSeed} exactly as in R.
 *
 * With `midp: true` (2 x 2 only), the mid-p version of exact2x2's `fisher.exact()`: the p-value and the interval come
 * from the mid-p tails (two-sided: the central test, twice the smaller tail, at most 1), the limits are the roots of
 * the mid-p tails to the precision of the doubles (exact2x2's search stops up to 1% from them), and `method` is
 * `"Central Fisher's Exact Test (mid-p version)"` or `"One-sided Fisher's Exact Test (mid-p version)"`.
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
 * r.estimate; // 6.408319658199675 (conditional MLE of the odds ratio; R: 6.408309)
 * r.confInt;  // [0.2117355954465785, 626.2435305888127] (R: 0.2117329, 621.93)
 * const m = fisherTest([[3, 1], [1, 3]], { midp: true });
 * m.pValue;   // 0.2571428571428571
 * m.confInt;  // [0.31005488171907974, 308.5567715811547] (exact2x2: 0.3100451, 311.4363)
 * ```
 *
 * @category Hypothesis tests
 */
export declare function fisherTest(x: readonly Counts[], options?: FisherTestOptions): FisherTestResult;
/**
 * Fisher's noncentral hypergeometric distribution of the (1, 1) cell of a 2 x 2 table with margins fixed:
 * P(X = i; psi) proportional to dhyper(i; m, n, k) psi^i on lo..hi
 */
export declare class OddsRatioDistribution {
    private readonly m;
    private readonly n;
    private readonly k;
    readonly lo: number;
    readonly hi: number;
    /** log dhyper(i; m, n, k) for i = lo..hi */
    private readonly logCentral;
    constructor(m: number, n: number, k: number);
    /** Normalised density on lo..hi for 0 < psi < Infinity */
    density(psi: number): Float64Array;
    /** E[X; psi] */
    mean(psi: number): number;
    /** P(X <= q; psi), or P(X >= q; psi) when upper */
    tail(q: number, psi: number, upper: boolean): number;
    /** The mid-p tail P(X < q; psi) + P(X = q; psi)/2, or P(X > q; psi) + P(X = q; psi)/2 when upper (lo <= q <= hi) */
    midTail(q: number, psi: number, upper: boolean): number;
}
/**
 * The two-sided p-value of the count x at the odds ratio psi (0 < psi < Infinity): the sum of the probabilities at
 * most P(X = x) (1 + 1e-7), as R
 */
export declare function twoSidedPValue(dist: OddsRatioDistribution, x: number, psi: number): number;
/**
 * Fisher's two-sided p-value of the 2 x 2 table with the (1, 1) cell x and the margins m (column 1), n (column 2) and
 * k (row 1), at the odds ratio 1, without the array of the support: the hypergeometric density is unimodal, so the
 * values at most P(X = x) (1 + 1e-7) are the two tails below and above two cut points, found by bisection and summed
 * by phyper. For supports beyond what twoSidedPValue allocates (oddsRatio's p-value of tables with counts of 1e9)
 */
export declare function twoSidedPValueUnimodal(x: number, m: number, n: number, k: number): number;
