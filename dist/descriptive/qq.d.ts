import type { Sample } from "../htest/types.js";
/**
 * Options for {@link ppoints}.
 *
 * @category Descriptive statistics
 */
export interface PpointsOptions {
    /** The offset, in [0, 1] in practice (R does not check it). Default `3/8` for n <= 10, else `1/2`. */
    a?: number;
}
/**
 * The probability points (i - a) / (n + 1 - 2a), i = 1, ..., n, for Q-Q plots. Equivalent to R's `ppoints()`. `n` is
 * the count, or an array whose length is the count (R's vector argument).
 *
 * @example
 * ```ts
 * ppoints(3); // [0.19230769230769232, 0.5, 0.8076923076923077]
 * ```
 *
 * @throws RangeError for a count that is negative or not finite.
 * @category Descriptive statistics
 */
export declare function ppoints(n: number | Sample, options?: PpointsOptions): number[];
/**
 * The coordinates of a normal Q-Q plot.
 *
 * @category Descriptive statistics
 */
export interface QqnormResult {
    /** The theoretical quantiles, one per value of `y` (NaN where `y` is missing). */
    x: number[];
    /** The values given. */
    y: number[];
}
/**
 * The coordinates of a normal quantile-quantile plot: for each value, the normal quantile of its plotting position.
 * Equivalent to R's `qqnorm(y, plot.it = FALSE)`. Missing values (NaN) keep their place with x = NaN and are not
 * counted; infinite values are ranked as the extremes.
 *
 * @example
 * ```ts
 * qqnorm([3.1, 1.2, 5.5]).x; // [0, -0.8694237732888861, 0.8694237732888861]
 * ```
 *
 * @throws RangeError when there is no value that is not missing.
 * @category Descriptive statistics
 */
export declare function qqnorm(y: Sample): QqnormResult;
/**
 * Options for {@link qqline}.
 *
 * @category Descriptive statistics
 */
export interface QqlineOptions {
    /** The two probabilities the line passes through. Default `[0.25, 0.75]`. */
    probs?: readonly [number, number];
    /** The quantile type of `y` (as {@link quantile}). Default `7`. */
    qtype?: number;
    /** The quantile function of the reference distribution. Default the standard normal's. */
    distribution?: (p: number) => number;
    /** Swap the axes: the line for a plot with the data on the x axis. Default `false`. */
    datax?: boolean;
}
/**
 * The line of a Q-Q plot through two quantiles (the quartiles by default) of the data and of the reference
 * distribution. Equivalent to R's `qqline()`. R draws the line and returns nothing; here its intercept and slope.
 * Missing values are ignored.
 *
 * @example
 * ```ts
 * const { intercept, slope } = qqline([3.1, 1.2, 5.5, 1.2, 9.0]);
 * ```
 *
 * @throws RangeError when there is no value that is not missing, or for probabilities outside [0, 1].
 * @category Descriptive statistics
 */
export declare function qqline(y: Sample, options?: QqlineOptions): {
    intercept: number;
    slope: number;
};
