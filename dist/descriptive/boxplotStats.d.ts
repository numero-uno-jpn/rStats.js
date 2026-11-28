import type { Sample } from "../htest/types.js";
/**
 * Options for {@link boxplotStats}.
 *
 * @category Descriptive statistics
 */
export interface BoxplotStatsOptions {
    /** How far the whiskers reach, in hinge spreads. Default `1.5`; `0` puts them at the extremes (no outliers). */
    coef?: number;
    /** Compute the notch interval `conf`. Default `true`. */
    doConf?: boolean;
    /** Return the outliers `out`. Default `true`. */
    doOut?: boolean;
}
/**
 * The result of {@link boxplotStats}.
 *
 * @category Descriptive statistics
 */
export interface BoxplotStatsResult {
    /** The lower whisker, the lower hinge, the median, the upper hinge and the upper whisker (NaN for no values). */
    stats: [number, number, number, number, number];
    /** The number of values that are not missing. */
    n: number;
    /** The notch: median -+ 1.58 times the hinge spread over sqrt(n) (empty with `doConf: false`). */
    conf: number[];
    /** The values beyond the whiskers, in the order given (empty with `doOut: false` or `coef: 0`). */
    out: number[];
}
/**
 * The statistics a box plot draws. Equivalent to R's `boxplot.stats()`. Missing values (NaN) are dropped; infinite
 * values are values like any other (so they are outliers).
 *
 * @example
 * ```ts
 * boxplotStats([1, 2, 3, 4, 5, 40]);
 * // { stats: [1, 2, 3.5, 5, 5], n: 6, conf: [1.564903103201289, 5.435096896798711], out: [40] }
 * ```
 *
 * @throws RangeError for a negative `coef`.
 * @category Descriptive statistics
 */
export declare function boxplotStats(x: Sample, options?: BoxplotStatsOptions): BoxplotStatsResult;
