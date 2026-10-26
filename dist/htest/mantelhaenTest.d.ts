import { type Alternative, type HTest } from "./types.js";
/**
 * Options for {@link mantelhaenTest}.
 *
 * @category Hypothesis tests
 */
export interface MantelhaenTestOptions {
    /** Alternative hypothesis (2 x 2 x K only). Default `"two.sided"`. */
    alternative?: Alternative | "two" | "l" | "g";
    /** Continuity correction (2 x 2 x K, asymptotic test). Default `true`. */
    correct?: boolean;
    /** Exact conditional test (2 x 2 x K). Default `false`. */
    exact?: boolean;
    /** Confidence level of the interval for the common odds ratio. Default `0.95`. */
    confLevel?: number;
}
/**
 * Result of {@link mantelhaenTest}. 2 x 2 x K tables add the common odds ratio and its interval.
 *
 * @category Hypothesis tests
 */
export interface MantelhaenTestResult extends Omit<HTest, "alternative"> {
    /** Present for 2 x 2 x K tables. */
    alternative?: Alternative;
}
/**
 * Cochran-Mantel-Haenszel chi-squared test of conditional independence in a set of contingency tables, one per
 * stratum. Equivalent to R's `mantelhaen.test()`. Takes the strata as R takes a three-dimensional array.
 *
 * @param strata The K strata, each an I x J table of counts as an array of rows (all of the same shape; I, J >= 2,
 *   K >= 2 for the asymptotic test).
 * @param options See {@link MantelhaenTestOptions}.
 *
 * @example
 * ```ts
 * const r = mantelhaenTest([
 *   [[10, 5], [4, 12]],
 *   [[8, 6], [5, 9]],
 *   [[12, 4], [6, 10]],
 * ]);
 * r.statistic; // 8.972595458903124
 * r.pValue;    // 0.002740590103473906
 * r.estimate;  // 4.13218122372723 (common odds ratio)
 * ```
 *
 * @category Hypothesis tests
 */
export declare function mantelhaenTest(strata: readonly (readonly (readonly number[])[])[], options?: MantelhaenTestOptions): MantelhaenTestResult;
