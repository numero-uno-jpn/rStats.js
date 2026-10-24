import type { Sample } from "../htest/types.js";
type Ties = "mean" | "min" | "max" | ((v: number[]) => number);
/** Options for {@link approx}. */
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
    /** For `"constant"`: the step value is (1 - f) y_left + f y_right. Default `0`. */
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
 */
export declare function approx(x: Sample, y: Sample, options?: ApproxOptions): {
    x: number[];
    y: number[];
};
/** Cubic spline method. */
export type SplineMethod = "fmm" | "natural" | "periodic" | "hyman";
/** Options for {@link spline}. */
export interface SplineOptions {
    /** Number of equally spaced points from `xmin` to `xmax`. Default `3 * x.length`. */
    n?: number;
    /** `"fmm"` (default), `"natural"`, `"periodic"` or `"hyman"`. */
    method?: SplineMethod;
    xmin?: number;
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
 */
export declare function spline(x: Sample, y: Sample, options?: SplineOptions): {
    x: number[];
    y: number[];
};
/** Options for {@link splinefun}. */
export interface SplinefunOptions {
    /** `"fmm"` (default), `"natural"`, `"periodic"`, `"monoH.FC"` or `"hyman"`. */
    method?: SplineMethod | "monoH.FC";
    /** How to merge equal x values. Default `"mean"`. */
    ties?: Ties;
}
/**
 * The cubic spline through the points, as a function of `x` and the order of derivative (0 to 3; a fraction is
 * truncated, as R does). Equivalent to R's `splinefun()`, except that the third derivative of `"monoH.FC"` is the
 * exact one (see {@link splinefunH}).
 *
 * @example
 * ```ts
 * const s = splinefun([1, 2, 3, 4], [1, 4, 9, 16]);
 * s([2.5]);    // [6.25]
 * s([2.5], 1); // [5]
 * ```
 */
export declare function splinefun(x: Sample, y: Sample, options?: SplinefunOptions): (xq: Sample, deriv?: number) => number[];
/**
 * The cubic Hermite spline with values `y` and slopes `m` at the points `x`, as a function of `x` and the order of
 * derivative (0 to 3; a fraction is truncated, as R does); linear outside the data. Equivalent to R's `splinefunH()`,
 * except for the third derivative: on [x_i, x_{i+1}] it is the exact (6 m_i + 6 m_{i+1} - 12 delta) / h^2, with
 * h = x_{i+1} - x_i and delta = (y_{i+1} - y_i) / h, where R divides by h only once (the two agree when h = 1).
 *
 * @example
 * ```ts
 * splinefunH([0, 2], [0, 0], [1, 1])([1], 3); // [3] (R: 6)
 * ```
 */
export declare function splinefunH(x: Sample, y: Sample, m: Sample): (xq: Sample, deriv?: number) => number[];
/**
 * Lagrange interpolation in barycentric form through the points (xi, yi). Equivalent to `pracma::barylag()`; the
 * points must lie within the range of the nodes.
 */
export declare function barylag(xi: Sample, yi: Sample, x: Sample): number[];
/**
 * The polynomial of degree 2n - 1 through n points with given values and derivatives (global Hermite
 * interpolation, jStat's hermite), evaluated at `x`. Computed by divided differences on the doubled nodes.
 */
export declare function hermiteInterp(xi: Sample, yi: Sample, di: Sample, x: Sample): number[];
export {};
