import { type Mat, type MatrixInput, type VectorOrMatrix } from "./matrix.js";
/** Options for {@link qr}. */
export interface QROptions {
    /**
     * Tolerance for detecting linear dependence: a column whose remaining norm falls below `tol` times its
     * original norm is moved to the right end and reduces the rank. Default: `1e-7`. Used only when `lapack` is `false`.
     */
    tol?: number;
    /**
     * Use LAPACK-style full column pivoting (R's `LAPACK = TRUE`). The rank is then always `min(nrow, ncol)`
     * and is not detected. Default: `false` (R's LINPACK-style limited pivoting with `tol`).
     */
    lapack?: boolean;
}
/**
 * A QR decomposition returned by {@link qr}, in R's compact form. Pass it to {@link qrQ}, {@link qrR},
 * {@link qrCoef} and the other `qr*` functions.
 */
export interface QR {
    /** Compact form: the upper triangle holds `R`; the part below the diagonal holds the Householder vectors that represent `Q`. */
    qr: number[][];
    /** The computed rank of the matrix. Always `min(nrow, ncol)` for `lapack: true`. */
    rank: number;
    /** Auxiliary information about `Q` (the leading elements of the Householder vectors for the LINPACK method, `tau` for the LAPACK method). */
    qraux: number[];
    /** The column permutation, 0-based (R's `pivot` minus 1). */
    pivot: number[];
    /** Whether the decomposition was computed with `lapack: true` (R's `attr(, "useLAPACK")`). */
    useLapack: boolean;
}
/**
 * QR decomposition. Equivalent to R's `qr()`.
 *
 * By default this uses Householder transformations with R's LINPACK-style limited column pivoting: columns that
 * are (nearly) linearly dependent on earlier ones, as judged by `tol`, are moved to the right end and the rank is
 * reduced. With `lapack: true` it uses LAPACK-style column pivoting (R's `LAPACK = TRUE`).
 *
 * The default method throws on `NaN` or infinite values. With `lapack: true`, such input does not throw and the
 * result may differ from R's (which is not meaningful either).
 *
 * @param x A matrix (array of rows).
 * @param options See {@link QROptions}.
 * @returns The decomposition in compact form. See {@link QR}.
 *
 * @example
 * ```ts
 * // Least-squares fit of y on an intercept and x
 * const q = qr([[1, 1], [1, 2], [1, 3], [1, 4]]);
 * q.rank; // 2
 * qrCoef(q, [2.1, 3.9, 6.2, 7.8]); // [0.15, 1.94] (up to rounding)
 * ```
 */
export declare function qr(x: MatrixInput, options?: QROptions): QR;
/**
 * Build a Householder reflector H = I - tau v v^T (dlarfg). The first element of x = d[s .. s+len-1] is alpha.
 * Overwrites x with (beta, elements 2.. of v) and returns tau
 */
export declare function larfg(d: Float64Array, s: number, len: number): number;
/**
 * Apply the reflector H = I - tau v v^T from the left to C (len rows from row r0, nc columns from column c0) (dlarf with SIDE = 'L').
 * v = d[vs .. vs+len-1]
 */
export declare function larfLeft(d: Float64Array, vs: number, len: number, tau: number, C: Mat, r0: number, c0: number, nc: number): void;
/**
 * Computes `t(Q) %*% y` for a vector `y`. Equivalent to R's `qr.qty()`.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y A vector with as many elements as the decomposed matrix has rows.
 * @returns `t(Q) %*% y` as a vector.
 */
export declare function qrQty(q: QR, y: readonly number[] | Float64Array): number[];
/**
 * Computes `t(Q) %*% y` for a matrix `y`. Equivalent to R's `qr.qty()`.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y A matrix (array of rows) with as many rows as the decomposed matrix.
 * @returns `t(Q) %*% y` as an array of rows.
 */
export declare function qrQty(q: QR, y: MatrixInput): number[][];
/**
 * Computes `t(Q) %*% y`. Equivalent to R's `qr.qty()`.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y A vector or a matrix with as many rows as the decomposed matrix.
 * @returns A vector if `y` is a vector, otherwise an array of rows.
 */
export declare function qrQty(q: QR, y: VectorOrMatrix): number[] | number[][];
/**
 * Computes `Q %*% y` for a vector `y`. Equivalent to R's `qr.qy()`.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y A vector with as many elements as the decomposed matrix has rows.
 * @returns `Q %*% y` as a vector.
 */
export declare function qrQy(q: QR, y: readonly number[] | Float64Array): number[];
/**
 * Computes `Q %*% y` for a matrix `y`. Equivalent to R's `qr.qy()`.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y A matrix (array of rows) with as many rows as the decomposed matrix.
 * @returns `Q %*% y` as an array of rows.
 */
export declare function qrQy(q: QR, y: MatrixInput): number[][];
/**
 * Computes `Q %*% y`. Equivalent to R's `qr.qy()`.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y A vector or a matrix with as many rows as the decomposed matrix.
 * @returns A vector if `y` is a vector, otherwise an array of rows.
 */
export declare function qrQy(q: QR, y: VectorOrMatrix): number[] | number[][];
/**
 * Least-squares coefficients for a vector response. Equivalent to R's `qr.coef()`.
 *
 * Coefficients are returned in the original column order. Coefficients of columns that were not used
 * (those after position `rank` in `pivot`) are `NaN` (R's `NA`). For a decomposition computed with
 * `lapack: true`, the first `min(nrow, ncol)` pivoted columns are used.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y The response vector, with as many elements as the decomposed matrix has rows.
 * @returns The coefficient vector (one element per column of the decomposed matrix).
 *
 * @example
 * ```ts
 * const q = qr([[1, 1], [1, 2], [1, 3], [1, 4]]);
 * qrCoef(q, [2.1, 3.9, 6.2, 7.8]); // [0.15, 1.94] (up to rounding)
 * ```
 */
export declare function qrCoef(q: QR, y: readonly number[] | Float64Array): number[];
/**
 * Least-squares coefficients for each column of a matrix response. Equivalent to R's `qr.coef()`.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y The response matrix (array of rows), with as many rows as the decomposed matrix.
 * @returns The coefficients as an array of rows (one row per column of the decomposed matrix, one column per column of `y`).
 */
export declare function qrCoef(q: QR, y: MatrixInput): number[][];
/**
 * Least-squares coefficients. Equivalent to R's `qr.coef()`.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y The response, a vector or a matrix.
 * @returns A vector if `y` is a vector, otherwise an array of rows.
 */
export declare function qrCoef(q: QR, y: VectorOrMatrix): number[] | number[][];
/**
 * Least-squares residuals for a vector response: `y` minus its projection onto the space spanned by the
 * first `rank` pivoted columns. Equivalent to R's `qr.resid()`.
 *
 * Not supported for a decomposition computed with `lapack: true` (throws).
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y The response vector, with as many elements as the decomposed matrix has rows.
 * @returns The residual vector.
 */
export declare function qrResid(q: QR, y: readonly number[] | Float64Array): number[];
/**
 * Least-squares residuals for each column of a matrix response. Equivalent to R's `qr.resid()`.
 *
 * @param q A QR decomposition from {@link qr} (not `lapack: true`).
 * @param y The response matrix (array of rows), with as many rows as the decomposed matrix.
 * @returns The residuals as an array of rows.
 */
export declare function qrResid(q: QR, y: MatrixInput): number[][];
/**
 * Least-squares residuals. Equivalent to R's `qr.resid()`.
 *
 * @param q A QR decomposition from {@link qr} (not `lapack: true`).
 * @param y The response, a vector or a matrix.
 * @returns A vector if `y` is a vector, otherwise an array of rows.
 */
export declare function qrResid(q: QR, y: VectorOrMatrix): number[] | number[][];
/**
 * Least-squares fitted values for a vector response: the projection of `y` onto the space spanned by the
 * first `k` pivoted columns. Equivalent to R's `qr.fitted()`.
 *
 * Not supported for a decomposition computed with `lapack: true` (throws).
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y The response vector, with as many elements as the decomposed matrix has rows.
 * @param options `k`: the number of pivoted columns to project onto (an integer from 0 to `rank`). Default: `q.rank`.
 * @returns The fitted values as a vector.
 */
export declare function qrFitted(q: QR, y: readonly number[] | Float64Array, options?: {
    k?: number;
}): number[];
/**
 * Least-squares fitted values for each column of a matrix response. Equivalent to R's `qr.fitted()`.
 *
 * @param q A QR decomposition from {@link qr} (not `lapack: true`).
 * @param y The response matrix (array of rows), with as many rows as the decomposed matrix.
 * @param options `k`: the number of pivoted columns to project onto (an integer from 0 to `rank`). Default: `q.rank`.
 * @returns The fitted values as an array of rows.
 */
export declare function qrFitted(q: QR, y: MatrixInput, options?: {
    k?: number;
}): number[][];
/**
 * Least-squares fitted values. Equivalent to R's `qr.fitted()`.
 *
 * @param q A QR decomposition from {@link qr} (not `lapack: true`).
 * @param y The response, a vector or a matrix.
 * @param options `k`: the number of pivoted columns to project onto (an integer from 0 to `rank`). Default: `q.rank`.
 * @returns A vector if `y` is a vector, otherwise an array of rows.
 */
export declare function qrFitted(q: QR, y: VectorOrMatrix, options?: {
    k?: number;
}): number[] | number[][];
/** Options for {@link qrQ}. */
export interface QRQOptions {
    /** Return the full `n` x `n` matrix `Q`. Default: `false`, which returns the first `min(n, p)` columns (`n` x `min(n, p)`). */
    complete?: boolean;
    /** Diagonal of a diagonal matrix that `Q` is multiplied by on the right. Its length must equal the number of returned columns. Default: all ones. */
    dvec?: readonly number[];
}
/**
 * Recovers the orthogonal matrix `Q` from a QR decomposition. Equivalent to R's `qr.Q()`.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param options See {@link QRQOptions}.
 * @returns `Q` as an array of rows.
 */
export declare function qrQ(q: QR, options?: QRQOptions): number[][];
/**
 * Recovers the upper triangular matrix `R` from a QR decomposition. Equivalent to R's `qr.R()`.
 *
 * The columns stay in pivoted order (as in R); use `q.pivot` to map them back.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param options `complete`: return all `n` rows instead of the first `min(n, p)`. Default: `false`.
 * @returns `R` as an array of rows.
 */
export declare function qrR(q: QR, options?: {
    complete?: boolean;
}): number[][];
/**
 * Reconstructs the original matrix from a QR decomposition, with columns back in their original order.
 * Equivalent to R's `qr.X()`.
 *
 * If the decomposition was pivoted, `ncol` smaller than the number of columns is an error (as in R).
 *
 * @param q A QR decomposition from {@link qr}.
 * @param options `complete`: whether the default `ncol` is the number of rows (`true`) or `min(nrow, ncol)` (`false`, the default).
 *   `ncol`: the number of columns to return; columns beyond the original ones are taken from `Q` (as in R).
 * @returns The reconstructed matrix as an array of rows.
 */
export declare function qrX(q: QR, options?: {
    complete?: boolean;
    ncol?: number;
}): number[][];
/**
 * Solves `a x = b` in the least-squares sense using a QR decomposition. Equivalent to R's `qr.solve()`.
 *
 * Throws if the rank is less than `min(nrow, ncol)`. When `b` is omitted, returns the inverse of `a` (square
 * matrices only). For a wide matrix, coefficients of unused columns are set to 0 (as in R).
 *
 * @param a A matrix (array of rows) or a QR decomposition from {@link qr}.
 * @param b The right-hand side, a vector or a matrix. Default: the identity matrix.
 * @param options `tol`: the tolerance passed to {@link qr} when `a` is a matrix. Default: `1e-7`.
 * @returns A vector if `b` is a vector, otherwise an array of rows.
 */
export declare function qrSolve(a: MatrixInput | QR, b?: VectorOrMatrix, options?: {
    tol?: number;
}): number[] | number[][];
