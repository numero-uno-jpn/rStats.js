import type { Sample } from "../htest/types.js";
/**
 * Options of the summaries that can drop missing values.
 *
 * @category Descriptive statistics
 */
export interface NaRmOptions {
    /** Drop `NaN` (R's `NA`) before computing. Default `false`: a `NaN` gives `NaN`. */
    naRm?: boolean;
}
/** The values as an array, NaN dropped when naRm; undefined when a NaN remains (the result is then NaN) */
export declare function values(x: Sample, naRm: boolean | undefined): number[] | undefined;
/**
 * Sum of the values. Equivalent to R's `sum()`. For a numeric vector (0 for an empty one).
 *
 * @example
 * ```ts
 * sum([0.1, 0.2, 0.3]); // 0.6 (plain JS addition gives 0.6000000000000001)
 * ```
 *
 * @category Descriptive statistics
 */
export declare function sum(x: Sample, options?: NaRmOptions): number;
/**
 * Product of the values. Equivalent to R's `prod()`. 1 for an empty vector.
 *
 * @example
 * ```ts
 * prod([1, 2, 3, 4]); // 24
 * ```
 *
 * @category Descriptive statistics
 */
export declare function prod(x: Sample, options?: NaRmOptions): number;
/**
 * Options for {@link mean}.
 *
 * @category Descriptive statistics
 */
export interface MeanOptions extends NaRmOptions {
    /** Fraction (0 to 0.5) of values trimmed from each end before the mean. Default `0`. */
    trim?: number;
}
/**
 * Arithmetic mean, optionally trimmed. Equivalent to R's `mean()`. Accurate to the last bit: the sum is taken in
 * double-double and corrected by the mean deviation, as R corrects its long double mean.
 *
 * @example
 * ```ts
 * mean([1, 2, 3, 10]);                // 4
 * mean([1, 2, 3, 10], { trim: 0.25 }); // 2.5
 * ```
 *
 * @category Descriptive statistics
 */
export declare function mean(x: Sample, options?: MeanOptions): number;
/**
 * Weighted mean `sum(x w) / sum(w)`. Equivalent to R's `weighted.mean()`. Values with weight 0 do not enter the
 * numerator (even if infinite or NaN), and `naRm` drops missing values of `x` with their weights.
 *
 * @example
 * ```ts
 * weightedMean([1, 2, 3], [3, 1, 1]); // 1.6
 * ```
 *
 * @category Descriptive statistics
 */
export declare function weightedMean(x: Sample, w: Sample, options?: NaRmOptions): number;
/**
 * Sample variance (denominator n - 1). Equivalent to R's `var()`. For a vector (`NaN` for fewer than 2 values); named
 * `variance` because `var` cannot be a name in JavaScript. For matrices use `cov`.
 *
 * @example
 * ```ts
 * variance([1, 2, 3, 4]); // 1.6666666666666667
 * ```
 *
 * @category Descriptive statistics
 */
export declare function variance(x: Sample, options?: NaRmOptions): number;
/**
 * Sample standard deviation (denominator n - 1). Equivalent to R's `sd()`.
 *
 * @example
 * ```ts
 * sd([2, 4, 4, 4, 5, 5, 7, 9]); // 2.138
 * ```
 *
 * @category Descriptive statistics
 */
export declare function sd(x: Sample, options?: NaRmOptions): number;
/**
 * Median of the values (the mean of the two middle ones for an even count). Equivalent to R's `median()`.
 *
 * @example
 * ```ts
 * median([3, 1, 2]);    // 2
 * median([4, 1, 3, 2]); // 2.5
 * ```
 *
 * @category Descriptive statistics
 */
export declare function median(x: Sample, options?: NaRmOptions): number;
/**
 * `[min, max]` of the values. Equivalent to R's `range()`. `[NaN, NaN]` with a missing value unless `naRm`;
 * `[Infinity, -Infinity]` for an empty vector.
 *
 * @example
 * ```ts
 * range([3, 1, 4, 1, 5]);             // [1, 5]
 * range([3, NaN, 4], { naRm: true }); // [3, 4]
 * ```
 *
 * @category Descriptive statistics
 */
export declare function range(x: Sample, options?: NaRmOptions): [number, number];
/**
 * Running sums. Equivalent to R's `cumsum()`. Each partial sum is rounded from an exact accumulator; `NaN` from the
 * first `NaN` on.
 *
 * @example
 * ```ts
 * cumsum([1, 2, 3, 4]); // [1, 3, 6, 10]
 * ```
 *
 * @category Descriptive statistics
 */
export declare function cumsum(x: Sample): number[];
/**
 * Running products. Equivalent to R's `cumprod()`. Products beyond the double range show as ±Infinity with the right
 * sign, as R's long double accumulator does.
 *
 * @example
 * ```ts
 * cumprod([1, 2, 3, 4]); // [1, 2, 6, 24]
 * ```
 *
 * @category Descriptive statistics
 */
export declare function cumprod(x: Sample): number[];
/**
 * Running maxima. Equivalent to R's `cummax()`. `NaN` from the first `NaN` on.
 *
 * @example
 * ```ts
 * cummax([1, 3, 2, 5, 4]); // [1, 3, 3, 5, 5]
 * ```
 *
 * @category Descriptive statistics
 */
export declare function cummax(x: Sample): number[];
/**
 * Running minima. Equivalent to R's `cummin()`.
 *
 * @example
 * ```ts
 * cummin([5, 3, 4, 1, 2]); // [5, 3, 3, 1, 1]
 * ```
 *
 * @category Descriptive statistics
 */
export declare function cummin(x: Sample): number[];
/**
 * Options for {@link diff}.
 *
 * @category Descriptive statistics
 */
export interface DiffOptions {
    /** Distance between the values subtracted. Default `1`. */
    lag?: number;
    /** Number of times differences are taken. Default `1`. */
    differences?: number;
}
/**
 * Lagged and iterated differences. Equivalent to R's `diff()`. For a vector (empty when `lag * differences` is at
 * least the length).
 *
 * @example
 * ```ts
 * diff([1, 4, 9, 16]);                     // [3, 5, 7]
 * diff([1, 4, 9, 16], { differences: 2 }); // [2, 2]
 * ```
 *
 * @category Descriptive statistics
 */
export declare function diff(x: Sample, options?: DiffOptions): number[];
