import { type Mat, type MatrixInput } from "./matrix.js";
/**
 * Options for {@link chol}.
 *
 * @category Linear algebra
 */
export interface CholOptions {
    /** Use diagonal pivoting (largest remaining diagonal first), which also works for positive semi-definite matrices. Default: `false`. */
    pivot?: boolean;
    /** Stopping tolerance for the pivoted decomposition. A negative value means `n * eps * max(diag(x))`. Default: `-1`. Used only with `pivot: true`. */
    tol?: number;
}
/**
 * Result of {@link chol} with `pivot: true`.
 *
 * @category Linear algebra
 */
export interface CholPivotResult {
    /** The upper triangular factor `R`, such that `x[pivot, pivot] = t(R) R` (within the first `rank` rows). */
    r: number[][];
    /** The column permutation, 0-based (R's `attr(, "pivot")` minus 1). */
    pivot: number[];
    /** The number of columns factored before the decomposition stopped (R's `attr(, "rank")`). */
    rank: number;
}
/**
 * Cholesky decomposition. Equivalent to R's `chol()`.
 *
 * Returns the upper triangular `R` with `x = t(R) R`. Only the upper triangle of `x` is used (symmetry is
 * not checked), and the lower triangle of the result is zero. Throws if `x` is not positive definite.
 *
 * @param x A square symmetric positive definite matrix (array of rows).
 * @param options See {@link CholOptions}.
 * @returns The upper triangular factor `R` as an array of rows.
 *
 * @example
 * ```ts
 * chol([[4, 2], [2, 3]]);
 * // [[2, 1], [0, 1.4142135623730951]]
 * ```
 *
 * @category Linear algebra
 */
export declare function chol(x: MatrixInput, options?: CholOptions & {
    pivot?: false;
}): number[][];
/**
 * Pivoted Cholesky decomposition, as R's `chol(x, pivot = TRUE)`.
 *
 * Does not throw for rank-deficient (positive semi-definite) matrices; check `rank` instead (R gives a
 * warning). Rows of `r` after `rank` are not meaningful: the diagonal element at the stopping position holds
 * the remaining value, and later rows keep the (permuted) input values.
 *
 * @param x A square symmetric matrix (array of rows). Only the upper triangle is used.
 * @param options See {@link CholOptions}; `pivot` must be `true`.
 * @returns The factor, the 0-based pivot and the rank. See {@link CholPivotResult}.
 *
 * @example
 * ```ts
 * chol([[1, 1], [1, 1]], { pivot: true });
 * // { r: [[1, 1], [0, 0]], pivot: [0, 1], rank: 1 }
 * ```
 */
export declare function chol(x: MatrixInput, options: CholOptions & {
    pivot: true;
}): CholPivotResult;
/**
 * Cholesky decomposition, with or without pivoting.
 *
 * @param x A square symmetric matrix (array of rows).
 * @param options See {@link CholOptions}.
 * @returns The factor `R`, or a {@link CholPivotResult} when `pivot` is `true`.
 */
export declare function chol(x: MatrixInput, options?: CholOptions): number[][] | CholPivotResult;
/** Overwrite a with its upper-triangular Cholesky factor (dpotf2). Returns the failing column (1-based), or 0 on success */
export declare function potf2(A: Mat): number;
/**
 * Options for {@link chol2inv}.
 *
 * @category Linear algebra
 */
export interface Chol2InvOptions {
    /** Number of rows and columns of `x` to use (its top-left `size` x `size` upper triangle). Default: the number of columns of `x`. */
    size?: number;
}
/**
 * Inverse of a matrix from its Cholesky factor: computes `(t(R) R)^-1`. Equivalent to R's `chol2inv()`.
 *
 * Only the upper triangle of the top-left `size` x `size` block of `x` is used. Throws if a diagonal element is zero.
 *
 * @param x The upper triangular Cholesky factor `R` (array of rows), e.g. from {@link chol}. A vector is treated as a one-column matrix.
 * @param options See {@link Chol2InvOptions}.
 * @returns The symmetric inverse matrix (`size` x `size`) as an array of rows.
 *
 * @example
 * ```ts
 * chol2inv([[2, 1], [0, 1]]); // [[0.5, -0.5], [-0.5, 1]]
 * ```
 *
 * @category Linear algebra
 */
export declare function chol2inv(x: MatrixInput | readonly number[] | Float64Array, options?: Chol2InvOptions): number[][];
/** From upper-triangular R, compute the upper triangle of (t(R) R)^-1 in place (dpotri = dtrti2 + dlauu2) */
export declare function potri(A: Mat): void;
