import { type Alternative, type HTest } from "./types.js";
/** Options for {@link propTest}. */
export interface PropTestOptions {
    /** Hypothesized proportion(s), one per group, each strictly between 0 and 1. Default: `0.5` for one group, and
     *  equality of the proportions for several. */
    p?: number | readonly number[];
    /** Alternative hypothesis (one or two groups without `p`; otherwise only `"two.sided"`). Default `"two.sided"`. */
    alternative?: Alternative | "two" | "l" | "g";
    /** Confidence level of the interval. Default `0.95`. */
    confLevel?: number;
    /** Apply the continuity correction (one or two groups). Default `true`. */
    correct?: boolean;
}
/** Result of {@link propTest}. */
export interface PropTestResult extends Omit<HTest, "nullValue" | "nullValueName"> {
    /** Degrees of freedom (`parameterName` is `"df"`). */
    parameter: number;
    /** The observed proportion(s). */
    estimate: number | number[];
    /** Hypothesized proportion(s), when given or for one group. */
    nullValue?: number | number[];
    nullValueName?: string | string[];
}
/**
 * Test of equal or given proportions. Equivalent to R's `prop.test()`.
 *
 * @param x Numbers of successes, or a table of rows `[successes, failures]`.
 * @param n Numbers of trials (omitted, and the options passed in its place, when `x` is a table).
 * @param options See {@link PropTestOptions}.
 *
 * @example
 * ```ts
 * propTest([83, 90, 129, 70], [86, 93, 136, 82]).pValue; // equality of four proportions
 * propTest(15, 20, { p: 0.5 }).confInt;
 * ```
 */
export declare function propTest(x: number | readonly number[] | readonly (readonly number[])[], n?: number | readonly number[] | PropTestOptions, options?: PropTestOptions): PropTestResult;
