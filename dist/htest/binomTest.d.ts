import { type Alternative, type HTest } from "./types.js";
/**
 * Options for {@link binomTest}.
 *
 * @category Hypothesis tests
 */
export interface BinomTestOptions {
    /** Hypothesized probability of success. Default `0.5`. */
    p?: number;
    /** Alternative hypothesis (unambiguous abbreviations accepted). Default `"two.sided"`. */
    alternative?: Alternative | "two" | "l" | "g";
    /** Confidence level of the interval. Default `0.95`. */
    confLevel?: number;
}
/**
 * Result of {@link binomTest}.
 *
 * @category Hypothesis tests
 */
export interface BinomTestResult extends HTest {
    /** Number of trials (`parameterName` is `"number of trials"`). */
    parameter: number;
    /** Clopper-Pearson interval for the probability of success. */
    confInt: [number, number];
    confLevel: number;
    /** Observed proportion of successes. */
    estimate: number;
    nullValue: number;
}
/**
 * Exact test of a simple null hypothesis about the probability of success in Bernoulli trials. Equivalent to R's
 * `binom.test()`.
 *
 * @param x Number of successes, or `[successes, failures]`.
 * @param n Number of trials (ignored when `x` has two elements; may then be omitted and the options passed in its
 *   place).
 * @param options See {@link BinomTestOptions}.
 *
 * @example
 * ```ts
 * binomTest(682, 925, { p: 0.75 }).pValue; // 0.3824916
 * ```
 *
 * @category Hypothesis tests
 */
export declare function binomTest(x: number | readonly [number, number], n?: number | BinomTestOptions, options?: BinomTestOptions): BinomTestResult;
/**
 * The exact binomial test of xs successes in ns trials, without the check of ns > 0 (poissonTest compares two counts
 * of 0 as R does: p-value 1, interval [0, 1])
 */
export declare function binomTestCounts(xs: number, ns: number, options?: BinomTestOptions): BinomTestResult;
