import { type NaRmOptions } from "./basic.js";
import type { Sample } from "../htest/types.js";
/** Options for {@link quantile}. */
export interface QuantileOptions extends NaRmOptions {
    /** Hyndman and Fan's definition, 1 to 9. Default `7`. */
    type?: number;
}
/**
 * Sample quantiles. Equivalent to R's `quantile()` (with `names = FALSE`).
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
 */
export declare function quantile(x: Sample, probs: number, options?: QuantileOptions): number;
export declare function quantile(x: Sample, probs?: readonly number[], options?: QuantileOptions): number[];
/** Interquartile range, the difference of the 0.75 and 0.25 quantiles. Equivalent to R's `IQR()`. */
export declare function IQR(x: Sample, options?: QuantileOptions): number;
/**
 * Tukey's five-number summary (minimum, lower hinge, median, upper hinge, maximum). Equivalent to R's `fivenum()`;
 * `NaN` values are dropped.
 */
export declare function fivenum(x: Sample): [number, number, number, number, number];
/** Options for {@link mad}. */
export interface MadOptions extends NaRmOptions {
    /** Centre. Default: the median. */
    center?: number;
    /** Scale factor. Default `1.4826` (consistent for the normal standard deviation). */
    constant?: number;
    /** For an even count, take the lower of the two middle absolute deviations (the "lo-median"). */
    low?: boolean;
    /** For an even count, take the higher one (the "hi-median"). */
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
 */
export declare function mad(x: Sample, options?: MadOptions): number;
