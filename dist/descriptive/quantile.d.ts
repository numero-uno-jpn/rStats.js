import { type NaRmOptions } from "./basic.js";
import type { Sample } from "../htest/types.js";
/**
 * Options for {@link quantile}.
 *
 * @category Descriptive statistics
 */
export interface QuantileOptions extends NaRmOptions {
    /** Hyndman and Fan's definition, 1 to 9. Default `7`. */
    type?: number;
}
/**
 * Sample quantiles. Equivalent to R's `quantile()`. Without names (R's `names = FALSE`).
 *
 * @param x The data.
 * @param probs Probabilities in [0, 1]. Default `[0, 0.25, 0.5, 0.75, 1]`. A single number gives a single number.
 * @param options `type` (1 to 9, default 7) and `naRm`.
 *
 * @example
 * ```ts
 * quantile([1, 2, 3, 4, 5, 6], 0.25);              // 2.25 (type 7)
 * quantile([1, 2, 3, 4, 5, 6], 0.25, { type: 9 }); // 1.9375 (jStat's quantiles)
 * ```
 *
 * @category Descriptive statistics
 */
export declare function quantile(x: Sample, probs: number, options?: QuantileOptions): number;
export declare function quantile(x: Sample, probs?: readonly number[], options?: QuantileOptions): number[];
/**
 * Interquartile range, the difference of the 0.75 and 0.25 quantiles. Equivalent to R's `IQR()`.
 *
 * @example
 * ```ts
 * IQR([1, 2, 3, 4, 5, 6]); // 2.5
 * ```
 *
 * @category Descriptive statistics
 */
export declare function IQR(x: Sample, options?: QuantileOptions): number;
/**
 * Tukey's five-number summary (minimum, lower hinge, median, upper hinge, maximum). Equivalent to R's `fivenum()`.
 * `NaN` values are dropped.
 *
 * @example
 * ```ts
 * fivenum([1, 2, 3, 4, 5, 6]); // [1, 2, 3.5, 5, 6]
 * ```
 *
 * @category Descriptive statistics
 */
export declare function fivenum(x: Sample): [number, number, number, number, number];
/**
 * Options for {@link mad}.
 *
 * @category Descriptive statistics
 */
export interface MadOptions extends NaRmOptions {
    /** Centre. Default: the median (`NaN` if `x` has a missing value and `naRm` is not set). */
    center?: number;
    /** Scale factor. Default `1.4826` (consistent for the normal standard deviation). */
    constant?: number;
    /**
     * For an even count n, take the lower of the two middle absolute deviations (the "lo-median"): the (n / 2)-th
     * smallest. As in R, n counts the missing values unless `naRm` removed them, the k-th smallest is taken among
     * the deviations that are not missing, and fewer than k of them (or k = 0) is an error. With an odd count the
     * ordinary median is used.
     */
    low?: boolean;
    /** For an even count n, take the higher one (the "hi-median"): the (n / 2 + 1)-th smallest, as for `low`. Both `low` and `high` is an error for an even count. */
    high?: boolean;
}
/**
 * Median absolute deviation, scaled. Equivalent to R's `mad()`.
 *
 * @example
 * ```ts
 * mad([1, 2, 3, 4, 100]);                  // 1.4826
 * mad([1, 2, 3, 4, 100], { constant: 1 }); // 1 (jStat's meddev)
 * ```
 *
 * @category Descriptive statistics
 */
export declare function mad(x: Sample, options?: MadOptions): number;
