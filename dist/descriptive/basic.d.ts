import type { Sample } from "../htest/types.js";
/** Options of the summaries that can drop missing values. */
export interface NaRmOptions {
    /** Drop `NaN` (R's `NA`) before computing. Default `false`: a `NaN` gives `NaN`. */
    naRm?: boolean;
}
/** The values as an array, NaN dropped when naRm; undefined when a NaN remains (the result is then NaN) */
export declare function values(x: Sample, naRm: boolean | undefined): number[] | undefined;
/**
 * Sum of the values. Equivalent to R's `sum()` for a numeric vector (0 for an empty one).
 *
 * @example
 * ```ts
 * sum([0.1, 0.2, 0.3]); // 0.6000000000000001 in plain JS addition, 0.6 here (correctly rounded)
 * ```
 */
export declare function sum(x: Sample, options?: NaRmOptions): number;
/**
 * Product of the values. Equivalent to R's `prod()` (1 for an empty vector).
 */
export declare function prod(x: Sample, options?: NaRmOptions): number;
/** Options for {@link mean}. */
export interface MeanOptions extends NaRmOptions {
    /** Fraction (0 to 0.5) of values trimmed from each end before the mean. Default `0`. */
    trim?: number;
}
/**
 * Arithmetic mean, optionally trimmed. Equivalent to R's `mean()`. Accurate to the last bit: the sum is taken in
 * double-double and corrected by the mean deviation, as R corrects its long double mean.
 */
export declare function mean(x: Sample, options?: MeanOptions): number;
/**
 * Weighted mean `sum(x w) / sum(w)`. Equivalent to R's `weighted.mean()`: values with weight 0 do not enter the
 * numerator (even if infinite or NaN), and `naRm` drops missing values of `x` with their weights.
 */
export declare function weightedMean(x: Sample, w: Sample, options?: NaRmOptions): number;
/**
 * Sample variance (denominator n - 1). Equivalent to R's `var()` for a vector (`NaN` for fewer than 2 values); named
 * `variance` because `var` cannot be a name in JavaScript. For matrices use `cov`.
 */
export declare function variance(x: Sample, options?: NaRmOptions): number;
/** Sample standard deviation (denominator n - 1). Equivalent to R's `sd()`. */
export declare function sd(x: Sample, options?: NaRmOptions): number;
/** Median of the values (the mean of the two middle ones for an even count). Equivalent to R's `median()`. */
export declare function median(x: Sample, options?: NaRmOptions): number;
/**
 * `[min, max]` of the values. Equivalent to R's `range()` (`[NaN, NaN]` with a missing value unless `naRm`;
 * `[Infinity, -Infinity]` for an empty vector).
 */
export declare function range(x: Sample, options?: NaRmOptions): [number, number];
/** Running sums. Equivalent to R's `cumsum()`: each partial sum is rounded from an exact accumulator; `NaN` from the first `NaN` on. */
export declare function cumsum(x: Sample): number[];
/**
 * Running products. Equivalent to R's `cumprod()`: products beyond the double range show as ±Infinity with the right
 * sign, as R's long double accumulator does.
 */
export declare function cumprod(x: Sample): number[];
/** Running maxima. Equivalent to R's `cummax()`: `NaN` from the first `NaN` on. */
export declare function cummax(x: Sample): number[];
/** Running minima. Equivalent to R's `cummin()`. */
export declare function cummin(x: Sample): number[];
/** Options for {@link diff}. */
export interface DiffOptions {
    /** Distance between the values subtracted. Default `1`. */
    lag?: number;
    /** Number of times differences are taken. Default `1`. */
    differences?: number;
}
/**
 * Lagged and iterated differences. Equivalent to R's `diff()` for a vector (empty when `lag * differences` is at
 * least the length).
 */
export declare function diff(x: Sample, options?: DiffOptions): number[];
