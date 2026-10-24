import type { MatrixInput } from "./matrix.js";
/** Result of {@link lu}: `x = P L U`. */
export interface LuResult {
    /** Permutation matrix (m x m). */
    P: number[][];
    /** Unit lower triangular (m x min(m, n)). */
    L: number[][];
    /** Upper triangular (min(m, n) x n). */
    U: number[][];
}
/**
 * LU decomposition with partial (row) pivoting, `x = P L U`. Equivalent to `Matrix::expand(Matrix::lu(x))`
 * (LAPACK's dgetrf).
 *
 * @example
 * ```ts
 * const { P, L, U } = lu([[1, 2], [3, 4]]); // P = [[0, 1], [1, 0]], L = [[1, 0], [1/3, 1]], U = [[3, 4], [0, 2/3]]
 * ```
 */
export declare function lu(x: MatrixInput): LuResult;
/** Options for {@link prcomp}. */
export interface PrcompOptions {
    /** Centre the columns (default `true`), or subtract the given values. */
    center?: boolean | readonly number[];
    /** Scale the columns to unit variance (default `false`), or divide by the given values. */
    scale?: boolean | readonly number[];
}
/** Result of {@link prcomp}. */
export interface PrcompResult {
    /** Standard deviations of the principal components. */
    sdev: number[];
    /** Loadings: the eigenvectors as columns (variables x components). */
    rotation: number[][];
    /** Scores: the data in the coordinates of the components (observations x components). */
    x: number[][];
    /** The centring used, when any. */
    center?: number[];
    /** The scaling used, when any. */
    scale?: number[];
}
/**
 * Principal components of the columns of `x` (observations as rows). Equivalent to R's `prcomp()`. The sign of each
 * component is arbitrary, as in R.
 */
export declare function prcomp(x: MatrixInput, options?: PrcompOptions): PrcompResult;
