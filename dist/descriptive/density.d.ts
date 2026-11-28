import type { Sample } from "../htest/types.js";
/**
 * The kernels of {@link density}.
 *
 * @category Descriptive statistics
 */
export type DensityKernel = "gaussian" | "epanechnikov" | "rectangular" | "triangular" | "biweight" | "cosine" | "optcosine";
/**
 * Options for {@link density}.
 *
 * @category Descriptive statistics
 */
export interface KernelDensityOptions {
    /**
     * The bandwidth (the kernel's standard deviation): a positive number, or the rule `"nrd0"` (default, {@link bwNrd0})
     * or `"nrd"` ({@link bwNrd}), in any case (as R). R's `"ucv"`, `"bcv"` and `"SJ"` are not offered (an error).
     */
    bw?: number | string;
    /** The bandwidth is `adjust * bw`. Default `1`. */
    adjust?: number;
    /** The kernel; a unique prefix is accepted (as R). Default `"gaussian"`. */
    kernel?: DensityKernel | string;
    /**
     * Weights of the observations, non-negative and finite, one per value of `x` (before missing values are removed).
     * Default: 1 / n each. As in R, weights that do not sum to 1 are used as given (with a warning), and the automatic
     * bandwidth ignores the weights (with a warning, unless they are all equal). With `naRm`, the weights of the missing
     * values are dropped and, when the weights summed to 1, the others are rescaled to sum 1 (as R).
     */
    weights?: Sample;
    /** The number of equally spaced output points. Default `512`. */
    n?: number;
    /** The first output point. Default: the smallest value minus `cut * bw`. */
    from?: number;
    /** The last output point. Default: the largest value plus `cut * bw`. */
    to?: number;
    /** How many bandwidths beyond the data the default `from` and `to` reach. Default `3`. */
    cut?: number;
    /** Remove missing values (NaN) first. Default `false`: a missing value is an error (as R). */
    naRm?: boolean;
}
/**
 * The result of {@link density}.
 *
 * @category Descriptive statistics
 */
export interface KernelDensityResult {
    /** The output points, equally spaced from `from` to `to`. */
    x: number[];
    /** The estimated density at `x`. */
    y: number[];
    /** The bandwidth used (after `adjust`). */
    bw: number;
    /** The number of observations (after missing values are removed; infinite values count, as in R). */
    n: number;
    /** The kernel used. */
    kernel: DensityKernel;
    /** R's warnings, each once, in R's order (an empty array when there are none). */
    warnings: string[];
}
/**
 * Silverman's rule-of-thumb bandwidth for a Gaussian kernel: 0.9 times the smaller of the standard deviation and the
 * interquartile range divided by 1.34, times n^(-1/5). Equivalent to R's `bw.nrd0()`. When that spread is 0, the
 * standard deviation is used, then |x[0]|, then 1 (so that the bandwidth is positive, as R).
 *
 * @example
 * ```ts
 * bwNrd0([1, 2, 3, 4, 10]); // 0.9735846228506357 (0.9 times IQR / 1.34, smaller than the sd, times 5^(-1/5))
 * ```
 *
 * @throws RangeError for fewer than 2 values, a missing value or an infinite value.
 * @category Descriptive statistics
 */
export declare function bwNrd0(x: Sample): number;
/**
 * Scott's variation of the normal-reference bandwidth: 1.06 times the smaller of the standard deviation and the
 * interquartile range divided by 1.34, times n^(-1/5). Equivalent to R's `bw.nrd()`. It is 0 for data whose quartiles
 * coincide and whose standard deviation is 0 (as R).
 *
 * @example
 * ```ts
 * bwNrd([1, 2, 3, 4, 10]); // 1.1466663335796377
 * ```
 *
 * @throws RangeError for fewer than 2 values, a missing value or an infinite value.
 * @category Descriptive statistics
 */
export declare function bwNrd(x: Sample): number;
/**
 * Kernel density estimate at equally spaced points. Equivalent to R's `density()`. The same
 * binned approximation (linear binning on a grid, convolution by FFT, linear interpolation), so the values are R's to
 * rounding, not the exact kernel sums (those differ by up to about 1e-3 of the peak, more for the rectangular kernel).
 *
 * @example
 * ```ts
 * const d = density([1.2, 2.3, 2.9, 3.1, 4.8]);
 * d.x.length; // 512
 * d.bw;       // bwNrd0 of the data
 * ```
 *
 * @throws RangeError for a missing value without `naRm`, fewer than 2 values with an automatic bandwidth, a bandwidth
 *   that is not positive, invalid weights or an unknown kernel.
 * @category Descriptive statistics
 */
export declare function density(x: Sample, options?: KernelDensityOptions): KernelDensityResult;
