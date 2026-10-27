import { type Alternative, type HTest } from "./types.js";
/**
 * Options for {@link poissonTest}.
 *
 * @category Hypothesis tests
 */
export interface PoissonTestOptions {
    /** Time base(s): one per count, nonnegative. Default `1` (or `[1, 1]`). */
    T?: number | readonly number[];
    /** Hypothesized rate, or rate ratio for two samples (nonnegative). Default `1`. */
    r?: number;
    /** Alternative hypothesis (unambiguous abbreviations accepted). Default `"two.sided"`. */
    alternative?: Alternative | "two" | "l" | "g";
    /** Confidence level of the interval. Default `0.95`. */
    confLevel?: number;
}
/**
 * Result of {@link poissonTest}.
 *
 * @category Hypothesis tests
 */
export interface PoissonTestResult extends HTest {
    /** Time base (one sample) or expected first count under the null hypothesis (two samples). */
    parameter: number;
    confInt: [number, number];
    confLevel: number;
    /** Event rate (one sample) or rate ratio (two samples). */
    estimate: number;
    nullValue: number;
}
/**
 * Exact test of a Poisson rate, or comparison of two Poisson rates. Equivalent to R's `poisson.test()`.
 *
 * @param x Number of events, or `[count1, count2]` to compare two rates.
 * @param options See {@link PoissonTestOptions}.
 *
 * @example
 * ```ts
 * poissonTest(137, { T: 24.19893 }).pValue; // < 2.2e-16 (rate 1 against 5.66)
 * poissonTest([11, 23], { T: [800, 3011] }).estimate; // rate ratio 1.80
 * ```
 *
 * @category Hypothesis tests
 */
export declare function poissonTest(x: number | readonly number[], options?: PoissonTestOptions): PoissonTestResult;
