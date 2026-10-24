import { type Mat, type MatrixInput, type VectorOrMatrix } from "./matrix.js";
/**
 * Matrix cross-product `t(x) %*% y`, or `t(x) %*% x` when `y` is omitted. Equivalent to R's `crossprod()`.
 *
 * A vector argument is treated as a one-column matrix.
 *
 * @param x A matrix (array of rows) or a vector.
 * @param y A matrix or a vector with the same number of rows as `x`. Defaults to `x`.
 * @returns The product as an array of rows (`ncol(x)` x `ncol(y)`).
 */
export declare function crossprod(x: VectorOrMatrix, y?: VectorOrMatrix): number[][];
/**
 * Matrix cross-product `x %*% t(y)`, or `x %*% t(x)` when `y` is omitted. Equivalent to R's `tcrossprod()`.
 *
 * A vector argument is treated as a one-column matrix.
 *
 * @param x A matrix (array of rows) or a vector.
 * @param y A matrix or a vector with the same number of columns as `x`. Defaults to `x`.
 * @returns The product as an array of rows (`nrow(x)` x `nrow(y)`).
 */
export declare function tcrossprod(x: VectorOrMatrix, y?: VectorOrMatrix): number[][];
/** Options for {@link backsolve} and {@link forwardsolve}. */
export interface BacksolveOptions {
    /** Number of rows and columns of the triangular matrix to use (its top-left `k` x `k` block). Default: the number of columns of the matrix. */
    k?: number;
    /** Use the upper triangle of the matrix. Default: `true` for `backsolve`, `false` for `forwardsolve`. R's `upper.tri`. */
    upperTri?: boolean;
    /** Solve `t(r) y = x` instead of `r y = x`. Default: `false`. */
    transpose?: boolean;
}
/**
 * Solves the triangular system `r y = x` with a vector right-hand side. Equivalent to R's `backsolve()`.
 *
 * Only the top-left `k` x `k` triangle of `r` (upper by default) and the first `k` elements of `x` are used.
 * Throws if a diagonal element is exactly zero.
 *
 * @param r A triangular matrix (array of rows).
 * @param x The right-hand side vector.
 * @param options See {@link BacksolveOptions}.
 * @returns The solution `y`, a vector of length `k`.
 */
export declare function backsolve(r: MatrixInput, x: readonly number[] | Float64Array, options?: BacksolveOptions): number[];
/**
 * Solves the triangular system `r y = x` with a matrix right-hand side. Equivalent to R's `backsolve()`.
 *
 * @param r A triangular matrix (array of rows).
 * @param x The right-hand side matrix (array of rows); only its first `k` rows are used.
 * @param options See {@link BacksolveOptions}.
 * @returns The solution `y`, a matrix with `k` rows.
 */
export declare function backsolve(r: MatrixInput, x: MatrixInput, options?: BacksolveOptions): number[][];
/**
 * Solves the triangular system `r y = x`. Equivalent to R's `backsolve()`.
 *
 * @param r A triangular matrix (array of rows).
 * @param x The right-hand side, a vector or a matrix.
 * @param options See {@link BacksolveOptions}.
 * @returns A vector if `x` is a vector, otherwise a matrix with `k` rows.
 */
export declare function backsolve(r: MatrixInput, x: VectorOrMatrix, options?: BacksolveOptions): number[] | number[][];
/**
 * Solves the triangular system `l y = x` with a vector right-hand side. Equivalent to R's `forwardsolve()`.
 *
 * Only the top-left `k` x `k` triangle of `l` (lower by default) and the first `k` elements of `x` are used.
 * Throws if a diagonal element is exactly zero.
 *
 * @param l A triangular matrix (array of rows).
 * @param x The right-hand side vector.
 * @param options See {@link BacksolveOptions}.
 * @returns The solution `y`, a vector of length `k`.
 */
export declare function forwardsolve(l: MatrixInput, x: readonly number[] | Float64Array, options?: BacksolveOptions): number[];
/**
 * Solves the triangular system `l y = x` with a matrix right-hand side. Equivalent to R's `forwardsolve()`.
 *
 * @param l A triangular matrix (array of rows).
 * @param x The right-hand side matrix (array of rows); only its first `k` rows are used.
 * @param options See {@link BacksolveOptions}.
 * @returns The solution `y`, a matrix with `k` rows.
 */
export declare function forwardsolve(l: MatrixInput, x: MatrixInput, options?: BacksolveOptions): number[][];
/**
 * Solves the triangular system `l y = x`. Equivalent to R's `forwardsolve()`.
 *
 * @param l A triangular matrix (array of rows).
 * @param x The right-hand side, a vector or a matrix.
 * @param options See {@link BacksolveOptions}.
 * @returns A vector if `x` is a vector, otherwise a matrix with `k` rows.
 */
export declare function forwardsolve(l: MatrixInput, x: VectorOrMatrix, options?: BacksolveOptions): number[] | number[][];
/**
 * Solve op(A) X = B, overwriting B with X (dtrsm with SIDE = 'L', DIAG = 'N').
 * Only the upper-left n x n triangle of A is used. B has n rows
 */
export declare function trsm(A: Mat, n: number, B: Mat, upper: boolean, trans: boolean): void;
