import { type Alternative, type HTest } from "./types.js";
/** Options for {@link mantelhaenTest}. */
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
/** Result of {@link mantelhaenTest}. 2 x 2 x K tables add the common odds ratio and its interval. */
export interface MantelhaenTestResult extends Omit<HTest, "alternative"> {
    /** Present for 2 x 2 x K tables. */
    alternative?: Alternative;
}
/**
 * Cochran-Mantel-Haenszel chi-squared test of conditional independence in a set of contingency tables, one per
 * stratum. Equivalent to R's `mantelhaen.test()` with a three-dimensional array.
 *
 * @param strata The K strata, each an I x J table of counts as an array of rows (all of the same shape; I, J >= 2,
 *   K >= 2 for the asymptotic test).
 * @param options See {@link MantelhaenTestOptions}.
 */
export declare function mantelhaenTest(strata: readonly (readonly (readonly number[])[])[], options?: MantelhaenTestOptions): MantelhaenTestResult;
