import { type GroupLabel } from "./groups.js";
import type { HTest, Sample } from "./types.js";
/** Options for {@link onewayTest}. */
export interface OnewayTestOptions {
    /** Assume equal variances (the classical F test). Default `false` (Welch's test). */
    varEqual?: boolean;
}
/** Result of {@link onewayTest}: an F statistic with two degrees of freedom. */
export interface OnewayTestResult extends Omit<HTest, "alternative" | "parameter" | "parameterName"> {
    /** `[num df, denom df]`. */
    parameter: [number, number];
    parameterName: [string, string];
}
/**
 * Test that several normal samples have equal means, without (default) or with the assumption of equal variances.
 * Equivalent to R's `oneway.test()`.
 *
 * @param x An array of samples, or one sample with group labels `g`.
 * @param g Group labels, parallel to `x` (or the options, when `x` is an array of samples).
 */
export declare function onewayTest(x: Sample | readonly Sample[], g?: readonly GroupLabel[] | OnewayTestOptions, options?: OnewayTestOptions): OnewayTestResult;
/**
 * Shapiro-Wilk test of normality. Equivalent to R's `shapiro.test()`. `NaN` values are dropped; the sample size must
 * be between 3 and 5000.
 */
export declare function shapiroTest(x: Sample): Omit<HTest, "alternative">;
