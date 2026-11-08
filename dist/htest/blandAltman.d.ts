import { type Sample } from "./types.js";
/**
 * Interval of the limits of agreement in {@link blandAltman}.
 *
 * @category Agreement, reliability and factor analysis
 */
export type BlandAltmanCiMethod = "package" | "exact";
/**
 * Options for {@link blandAltman}.
 *
 * @category Agreement, reliability and factor analysis
 */
export interface BlandAltmanOptions {
    /** The multiple of the standard deviation of the differences in the limits of agreement, positive. Default `1.96`. */
    two?: number;
    /** `1` for the differences `x - y` (the default), `2` for `y - x`. */
    mode?: 1 | 2;
    /** Level of the confidence intervals, in [0, 1] (two-sided). Default `0.95`. */
    confLevel?: number;
    /**
     * Interval of the two limits of agreement: `"package"` (the default), BlandAltmanLeh's `limit ± t sqrt(3 s²/n)` with
     * t quantiles on n - 1 degrees of freedom (Bland and Altman 1986's approximation), or `"exact"`, the exact interval
     * from the noncentral t distribution (Carkeet 2015), wider for small n. Unambiguous abbreviations are accepted.
     */
    ciMethod?: BlandAltmanCiMethod | (string & {});
}
/**
 * Result of {@link blandAltman}.
 *
 * @category Agreement, reliability and factor analysis
 */
export interface BlandAltmanResult {
    /** The mean of each complete pair, `(x + y)/2` (R's `means`). */
    means: number[];
    /** The difference of each complete pair, `x - y` (mode 1) or `y - x` (mode 2) (R's `diffs`). */
    diffs: number[];
    /** Number of complete pairs (R's `based.on`). */
    n: number;
    /** Mean of the differences d̄ (R's `mean.diffs`). */
    meanDiff: number;
    /** Lower limit of agreement `d̄ - two s` (R's `lower.limit`). */
    lowerLimit: number;
    /** Upper limit of agreement `d̄ + two s` (R's `upper.limit`). */
    upperLimit: number;
    /** `two s`, s the standard deviation of the differences (R's `critical.diff`). */
    criticalDiff: number;
    /** t interval of the mean difference, `d̄ ± t s/sqrt(n)` (R's `mean.diff.ci.lower`, `.upper`). */
    meanDiffConfInt: [number, number];
    /** Interval of the lower limit of agreement (R's `lower.limit.ci.lower`, `.upper` for `ciMethod: "package"`). */
    lowerLimitConfInt: [number, number];
    /** Interval of the upper limit of agreement (R's `upper.limit.ci.lower`, `.upper` for `ciMethod: "package"`). */
    upperLimitConfInt: [number, number];
    /** The level of the intervals. */
    confLevel: number;
    /** The multiple of the standard deviation in the limits (R's `two`). */
    two: number;
    /** The direction of the differences, 1 or 2. */
    mode: 1 | 2;
    /** The interval of the limits, in full. */
    ciMethod: BlandAltmanCiMethod;
    /** Warnings (none: input without a defined result is an error). */
    warnings: string[];
}
/**
 * Bland-Altman analysis of two methods of measurement: the mean difference, the limits of agreement and their
 * confidence intervals. Equivalent to `BlandAltmanLeh::bland.altman.stats()` in R.
 *
 * With d the differences of the complete pairs (pairs with `NaN` in either sample are dropped), d̄ their mean and s
 * their standard deviation, the limits of agreement are `d̄ ± two s`. The mean difference has the t interval `d̄ ± t
 * s/sqrt(n)` with t quantiles on n - 1 degrees of freedom. The interval of each limit is, by default, BlandAltmanLeh's
 * `limit ± t sqrt(3 s²/n)` (Bland and Altman 1986); `ciMethod: "exact"` gives the exact interval (Carkeet 2015):
 * `d̄ + s q/sqrt(n)` for the upper limit with q the quantiles (1 ∓ confLevel)/2 of the noncentral t distribution with
 * n - 1 degrees of freedom and noncentrality `two sqrt(n)`, and its mirror image for the lower limit.
 *
 * Unlike R, fewer than 2 complete pairs, infinite values and a level outside [0, 1] are errors (R gives NA or NaN
 * limits); `confLevel` 0 gives intervals of width 0 and 1 infinite ones, as R. Identical methods (s = 0) give every
 * limit and interval equal to d̄.
 *
 * @param x Measurements by the first method.
 * @param y Measurements by the second method, paired with `x`.
 * @param options See {@link BlandAltmanOptions}.
 * @returns See {@link BlandAltmanResult}.
 * @throws TypeError if `x` and `y` differ in length; RangeError for fewer than 2 complete pairs, infinite values, a
 *   `two` that is not positive and finite, a `mode` other than 1 or 2, a level outside [0, 1] or an unknown
 *   `ciMethod`.
 *
 * @example
 * ```ts
 * const x = [10.1, 12.3, 9.8, 15.2, 11.1, 13.4, 14.8, 9.9, 12.0, 16.3];
 * const y = [10.6, 12.0, 10.4, 15.9, 11.0, 14.1, 15.3, 10.3, 12.9, 16.8];
 * const r = blandAltman(x, y);
 * r.meanDiff;          // -0.44000000000000006
 * [r.lowerLimit, r.upperLimit]; // [-1.1628122854517629, 0.28281228545176262]
 * r.upperLimitConfInt; // [-0.17412106328886995, 0.73974563419239514]
 * blandAltman(x, y, { ciMethod: "exact" }).upperLimitConfInt; // [-0.011029811389107025, 0.961726537758047]
 * ```
 *
 * @category Agreement, reliability and factor analysis
 */
export declare function blandAltman(x: Sample, y: Sample, options?: BlandAltmanOptions): BlandAltmanResult;
