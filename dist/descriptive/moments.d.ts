import { type NaRmOptions } from "./basic.js";
import type { Sample } from "../htest/types.js";
/**
 * Options for {@link skewness} and {@link kurtosis}.
 *
 * @category Descriptive statistics
 */
export interface MomentOptions {
    /** e1071's type: 1, 2 or 3. Default `3`. */
    type?: 1 | 2 | 3;
}
/**
 * Sample skewness. Equivalent to `e1071::skewness()` in R. Missing values are dropped; `{ type: 1 }` is jStat's
 * skewness.
 *
 * @example
 * ```ts
 * skewness([1, 2, 3, 10]);              // 0.6614
 * skewness([1, 2, 3, 10], { type: 2 }); // 1.7636
 * ```
 *
 * @category Descriptive statistics
 */
export declare function skewness(x: Sample, options?: MomentOptions): number;
/**
 * Sample excess kurtosis. Equivalent to `e1071::kurtosis()` in R. Missing values are dropped; `{ type: 1 }` is
 * jStat's kurtosis.
 *
 * @example
 * ```ts
 * kurtosis([1, 2, 3, 10]);              // -1.7454
 * kurtosis([1, 2, 3, 10], { type: 1 }); // -0.7696
 * ```
 *
 * @category Descriptive statistics
 */
export declare function kurtosis(x: Sample, options?: MomentOptions): number;
/**
 * Geometric mean exp(mean(log x)). Equivalent to `DescTools::Gmean()` in R. NaN with a negative value, 0 with a
 * zero.
 *
 * @example
 * ```ts
 * geometricMean([1, 2, 4, 8]); // 2.82842712474619
 * ```
 *
 * @category Descriptive statistics
 */
export declare function geometricMean(x: Sample, options?: NaRmOptions): number;
/**
 * The most frequent values (all of them, in increasing order) and their frequency. Equivalent to
 * `DescTools::Mode()` in R. Missing values are dropped; `value` is `[NaN]` and `frequency` NaN when every value
 * occurs once.
 *
 * @example
 * ```ts
 * modes([1, 2, 2, 3, 3, 4]); // { value: [2, 3], frequency: 2 }
 * ```
 *
 * @category Descriptive statistics
 */
export declare function modes(x: Sample): {
    /** The most frequent values, in increasing order (`[NaN]` when every value occurs once). */
    value: number[];
    /** How often each of them occurs (NaN when every value occurs once). */
    frequency: number;
};
/**
 * Options for {@link meanAD}.
 *
 * @category Descriptive statistics
 */
export interface MeanADOptions {
    /** Centre: the mean (default) or `"median"`, or a number. */
    center?: "mean" | "median" | number;
}
/**
 * Mean absolute deviation from the centre. Equivalent to `DescTools::MeanAD()` in R. Missing values are dropped.
 *
 * @example
 * ```ts
 * meanAD([1, 2, 3, 10]);                       // 3
 * meanAD([1, 2, 3, 10], { center: "median" }); // 2.5
 * ```
 *
 * @category Descriptive statistics
 */
export declare function meanAD(x: Sample, options?: MeanADOptions): number;
/**
 * Options for {@link cv}.
 *
 * @category Descriptive statistics
 */
export interface CvOptions extends NaRmOptions {
    /** Small-sample correction. Default `false`. */
    unbiased?: boolean;
}
/**
 * Coefficient of variation sd / mean (sample standard deviation). Equivalent to `DescTools::CoefVar()` in R.
 *
 * @example
 * ```ts
 * cv([2, 4, 4, 4, 5, 5, 7, 9]); // 0.4276
 * ```
 *
 * @category Descriptive statistics
 */
export declare function cv(x: Sample, options?: CvOptions): number;
/**
 * Options for {@link scale}.
 *
 * @category Descriptive statistics
 */
export interface ScaleOptions {
    /** Subtract the column means (`true`, default), nothing (`false`) or the given values. */
    center?: boolean | readonly number[];
    /**
     * Divide by the root mean square of each (centred) column, sqrt(sum v^2 / (n - 1)) (`true`, default: the standard
     * deviation when centred), by nothing (`false`) or by the given values.
     */
    scale?: boolean | readonly number[];
}
/**
 * Centre and scale the columns of a matrix (array of rows; a vector is one column). Equivalent to R's `scale()`.
 * `center` and `scale` report the values used (R's attributes), when any.
 *
 * @example
 * ```ts
 * scale([1, 2, 3]); // { scaled: [[-1], [0], [1]], center: [2], scale: [1] }
 * ```
 *
 * @category Descriptive statistics
 */
export declare function scale(x: Sample | readonly (readonly number[])[], options?: ScaleOptions): {
    /** The centred and scaled matrix, as an array of rows (R's returned matrix). */
    scaled: number[][];
    /** The values subtracted from each column (R's `scaled:center` attribute); absent with `center: false`. */
    center?: number[];
    /** The values each column was divided by (R's `scaled:scale` attribute); absent with `scale: false`. */
    scale?: number[];
};
