import type { Sample } from "../htest/types.js";
/**
 * How equal `x` values are merged before interpolating (R's `ties`): `"mean"`, `"min"` or `"max"` of their `y`, or a
 * function of their `y` values.
 *
 * @category Numerical methods
 */
export type Ties = "mean" | "min" | "max" | ((v: number[]) => number);
/**
 * Options for {@link approx}.
 *
 * @category Numerical methods
 */
export interface ApproxOptions {
    /** Points to interpolate at. Default: `n` equally spaced points over the range of `x`. */
    xout?: Sample;
    /** `"linear"` (default) or `"constant"` (step function). */
    method?: "linear" | "constant";
    /** Number of points when `xout` is not given. Default `50`. */
    n?: number;
    /** Value left of the data. Default: NaN (rule 1) or the first y (rule 2). */
    yleft?: number;
    /** Value right of the data. Default: NaN (rule 1) or the last y (rule 2). */
    yright?: number;
    /** Extrapolation rule (1: NaN, 2: the end value), for both sides or `[left, right]`. Default `1`. */
    rule?: number | readonly [number, number];
    /** For `"constant"`: the step value is (1 - f) y_left + f y_right, with f in [0, 1] (else an error, as in R). Default `0`. */
    f?: number;
    /** How to merge equal x values. Default `"mean"`. */
    ties?: Ties;
}
/**
 * Linear or constant interpolation. Equivalent to R's `approx()`.
 *
 * @example
 * ```ts
 * approx([1, 2, 3], [10, 20, 40], { xout: [1.5, 2.5] }).y; // [15, 30]
 * ```
 *
 * @category Numerical methods
 */
export declare function approx(x: Sample, y: Sample, options?: ApproxOptions): {
    /** The points interpolated at (`xout`, or the equally spaced points). */
    x: number[];
    /** The interpolated values, one per point of `x`. */
    y: number[];
};
/**
 * Cubic spline method.
 *
 * @category Numerical methods
 */
export type SplineMethod = "fmm" | "natural" | "periodic" | "hyman";
/**
 * Options for {@link spline}.
 *
 * @category Numerical methods
 */
export interface SplineOptions {
    /** Number of equally spaced points from `xmin` to `xmax`. Default `3 * x.length`. */
    n?: number;
    /** `"fmm"` (default), `"natural"`, `"periodic"` or `"hyman"`. */
    method?: SplineMethod;
    /** Left end of the equally spaced points. Default: the smallest `x`. */
    xmin?: number;
    /** Right end of the equally spaced points. Default: the largest `x`. */
    xmax?: number;
    /** Points to interpolate at (then `n`, `xmin` and `xmax` are not used). */
    xout?: Sample;
    /** How to merge equal x values. Default `"mean"`. */
    ties?: Ties;
}
/**
 * Cubic spline interpolation at given or equally spaced points. Equivalent to R's `spline()`.
 *
 * @example
 * ```ts
 * spline([1, 2, 3, 4], [1, 4, 9, 16], { xout: [2.5] }).y; // [6.25]
 * ```
 *
 * @category Numerical methods
 */
export declare function spline(x: Sample, y: Sample, options?: SplineOptions): {
    /** The points interpolated at (`xout`, or the equally spaced points). */
    x: number[];
    /** The interpolated values, one per point of `x`. */
    y: number[];
};
/**
 * Options for {@link splinefun}.
 *
 * @category Numerical methods
 */
export interface SplinefunOptions {
    /** `"fmm"` (default), `"natural"`, `"periodic"`, `"monoH.FC"` or `"hyman"`. */
    method?: SplineMethod | "monoH.FC";
    /** How to merge equal x values. Default `"mean"`. */
    ties?: Ties;
}
/**
 * The cubic spline through the points, as a function of `x` and the order of derivative (0 to 3; a fraction is
 * truncated, as R does). Equivalent to R's `splinefun()`. Except that the third derivative of `"monoH.FC"` is the
 * exact one (see {@link splinefunH}).
 *
 * @example
 * ```ts
 * const s = splinefun([1, 2, 3, 4], [1, 4, 9, 16]);
 * s([2.5]);    // [6.25]
 * s([2.5], 1); // [5]
 * ```
 *
 * @category Numerical methods
 */
export declare function splinefun(x: Sample, y: Sample, options?: SplinefunOptions): (xq: Sample, deriv?: number) => number[];
/**
 * The cubic Hermite spline with values `y` and slopes `m` at the points `x`, as a function of `x` and the order of
 * derivative (0 to 3; a fraction is truncated, as R does); linear outside the data. Equivalent to R's `splinefunH()`.
 * Except for the third derivative: on [x_i, x_{i+1}] it is the exact (6 m_i + 6 m_{i+1} - 12 delta) / h^2, with
 * h = x_{i+1} - x_i and delta = (y_{i+1} - y_i) / h, where R divides by h only once (the two agree when h = 1).
 *
 * @example
 * ```ts
 * splinefunH([0, 2], [0, 0], [1, 1])([1], 3); // [3] (R: 6)
 * ```
 *
 * @category Numerical methods
 */
export declare function splinefunH(x: Sample, y: Sample, m: Sample): (xq: Sample, deriv?: number) => number[];
/**
 * Lagrange interpolation in barycentric form through the points (xi, yi). Equivalent to `pracma::barylag()` in R.
 * The points must lie within the range of the nodes.
 *
 * @example
 * ```ts
 * barylag([0, 1, 2], [1, 3, 7], [0.5, 1.5]); // [1.75, 4.75]
 * ```
 *
 * @category Numerical methods
 */
export declare function barylag(xi: Sample, yi: Sample, x: Sample): number[];
/**
 * The polynomial of degree 2n - 1 through n points with given values and derivatives (global Hermite
 * interpolation, jStat's hermite), evaluated at `x`. Not an R function. Neither base R nor the recommended packages
 * have it (for piecewise cubic Hermite interpolation, see {@link splinefunH}). Computed by divided differences on
 * the doubled nodes.
 *
 * @example
 * ```ts
 * hermiteInterp([0, 1], [0, 1], [0, 0], [0.25, 0.5]); // [0.15625, 0.5]
 * ```
 *
 * @category Numerical methods
 */
export declare function hermiteInterp(xi: Sample, yi: Sample, di: Sample, x: Sample): number[];
