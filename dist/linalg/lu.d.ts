import type { MatrixInput } from "./matrix.js";
/**
 * Result of {@link lu}: `x = P L U`.
 *
 * @category Linear algebra
 */
export interface LuResult {
    /** Permutation matrix (m x m). */
    P: number[][];
    /** Unit lower triangular (m x min(m, n)). */
    L: number[][];
    /** Upper triangular (min(m, n) x n). */
    U: number[][];
}
/**
 * LU decomposition with partial (row) pivoting, `x = P L U`. Equivalent to R's `Matrix::lu()`. The factors are those
 * of `Matrix::expand(Matrix::lu(x))` (LAPACK's dgetrf).
 *
 * @example
 * ```ts
 * lu([[1, 2], [3, 4]]);
 * // { P: [[0, 1], [1, 0]], L: [[1, 0], [0.3333333333333333, 1]], U: [[3, 4], [0, 0.6666666666666667]] }
 * ```
 *
 * @category Linear algebra
 */
export declare function lu(x: MatrixInput): LuResult;
/**
 * Options for {@link prcomp}.
 *
 * @category Linear algebra
 */
export interface PrcompOptions {
    /** Centre the columns (default `true`), or subtract the given values. */
    center?: boolean | readonly number[];
    /** Scale the columns to unit variance (default `false`), or divide by the given values. */
    scale?: boolean | readonly number[];
    /**
     * The number k of components to keep in `rotation` and `x` (R's `rank.`): `min(trunc(rank), nrow, ncol)`. It must
     * be finite with a positive integer part. Default: all `min(nrow, ncol)`. `sdev` always has all of them, as in R.
     */
    rank?: number;
    /**
     * Drop the components whose standard deviation is at most `tol` times that of the first: `rotation` and `x` keep
     * the components with `sdev > sdev[0] * tol` if they are fewer than k. Default: none are dropped.
     */
    tol?: number;
}
/**
 * Result of {@link prcomp}.
 *
 * @category Linear algebra
 */
export interface PrcompResult {
    /** Standard deviations of the principal components. */
    sdev: number[];
    /** Loadings: the eigenvectors as columns (variables x components kept). */
    rotation: number[][];
    /** Scores: the data in the coordinates of the components (observations x components kept). */
    x: number[][];
    /** The centring used, when any. */
    center?: number[];
    /** The scaling used, when any. */
    scale?: number[];
}
/**
 * Principal components of the columns of `x` (observations as rows). Equivalent to R's `prcomp()`. The sign of each
 * component is arbitrary, as in R.
 *
 * @example
 * ```ts
 * const pc = prcomp([[1, 2], [2, 1], [3, 4], [4, 3]]);
 * pc.sdev; // [1.632993161855452, 0.816496580927726]
 * pc.x;    // [[-1.4142, 0.7071], [-1.4142, -0.7071], [1.4142, 0.7071], [1.4142, -0.7071]] (signs may differ from R)
 * prcomp([[1, 2], [2, 1], [3, 4], [4, 3]], { rank: 1 }).rotation.length; // 2 (variables; one column each)
 * ```
 *
 * @category Linear algebra
 */
export declare function prcomp(x: MatrixInput, options?: PrcompOptions): PrcompResult;
