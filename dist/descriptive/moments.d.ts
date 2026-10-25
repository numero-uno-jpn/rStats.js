import { type NaRmOptions } from "./basic.js";
import type { Sample } from "../htest/types.js";
/** Options for {@link skewness} and {@link kurtosis}. */
export interface MomentOptions {
    /** e1071's type: 1, 2 or 3. Default `3`. */
    type?: 1 | 2 | 3;
}
/**
 * Sample skewness. Equivalent to `e1071::skewness()` (missing values dropped); `{ type: 1 }` is jStat's skewness.
 */
export declare function skewness(x: Sample, options?: MomentOptions): number;
/**
 * Sample excess kurtosis. Equivalent to `e1071::kurtosis()` (missing values dropped); `{ type: 1 }` is jStat's
 * kurtosis.
 */
export declare function kurtosis(x: Sample, options?: MomentOptions): number;
/**
 * Geometric mean exp(mean(log x)). Equivalent to `DescTools::Gmean()`: NaN with a negative value, 0 with a zero.
 */
export declare function geometricMean(x: Sample, options?: NaRmOptions): number;
/**
 * The most frequent values (all of them, in increasing order) and their frequency. Equivalent to `DescTools::Mode()`
 * (missing values dropped): `value` is `[NaN]` and `frequency` NaN when every value occurs once.
 */
export declare function modes(x: Sample): {
    value: number[];
    frequency: number;
};
/** Options for {@link meanAD}. */
export interface MeanADOptions {
    /** Centre: the mean (default) or `"median"`, or a number. */
    center?: "mean" | "median" | number;
}
/** Mean absolute deviation from the centre. Equivalent to `DescTools::MeanAD()` (missing values dropped). */
export declare function meanAD(x: Sample, options?: MeanADOptions): number;
/** Options for {@link cv}. */
export interface CvOptions extends NaRmOptions {
    /** Small-sample correction. Default `false`. */
    unbiased?: boolean;
}
/**
 * Coefficient of variation sd / mean (sample standard deviation). Equivalent to `DescTools::CoefVar()`.
 */
export declare function cv(x: Sample, options?: CvOptions): number;
/** Options for {@link scale}. */
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
 * Centre and scale the columns of a matrix (array of rows; a vector is one column). Equivalent to R's `scale()`:
 * `center` and `scale` report the values used (R's attributes), when any.
 */
export declare function scale(x: Sample | readonly (readonly number[])[], options?: ScaleOptions): {
    scaled: number[][];
    center?: number[];
    scale?: number[];
};
