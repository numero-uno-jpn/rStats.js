import type { HTest } from "./types.js";
/** Options for {@link mcnemarTest}. */
export interface McnemarTestOptions {
    /** Apply the continuity correction (2 x 2 tables only). Default `true`. */
    correct?: boolean;
}
/** Result of {@link mcnemarTest}. Has no `alternative`, as R's `mcnemar.test()` returns none. */
export interface McnemarTestResult extends Omit<HTest, "alternative"> {
    /** Degrees of freedom (`parameterName` is `"df"`). */
    parameter: number;
}
/**
 * McNemar's chi-squared test for symmetry of rows and columns in a square table of counts. Equivalent to R's
 * `mcnemar.test()` with a matrix, or with two factors given as paired category codes.
 *
 * @param x Square table of counts as an array of rows, or the first of two paired samples of category codes.
 * @param y Second paired sample of category codes, when `x` is a sample. May be omitted (and the options passed in
 *   its place) when `x` is a table.
 * @param options See {@link McnemarTestOptions}.
 *
 * @example
 * ```ts
 * mcnemarTest([[794, 86], [150, 570]]).statistic; // 34.71186
 * ```
 */
export declare function mcnemarTest(x: readonly (readonly number[])[] | readonly (number | string)[], y?: readonly (number | string)[] | McnemarTestOptions, options?: McnemarTestOptions): McnemarTestResult;
