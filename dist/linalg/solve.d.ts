import { type Mat, type MatrixInput, type VectorOrMatrix } from "./matrix.js";
/** LU decomposition (dgetf2). Overwrites a with L (unit lower triangular, diagonal not stored) and U. ipiv is 0-based */
export declare function getrf(A: Mat): {
    ipiv: Int32Array;
    info: number;
};
/**
 * Estimate of the 1-norm of a matrix B (dlacn2). apply(kase, x) overwrites x with B x when kase = 1,
 * and with B^T x when kase = 2
 */
export declare function lacn2(n: number, apply: (kase: 1 | 2, x: Float64Array) => void): number;
/** Estimate the reciprocal condition number from the LU decomposition (dgecon). anorm is the norm of the original matrix */
export declare function gecon(LU: Mat, anorm: number, oneNormKind: boolean): number;
/** Estimate of the reciprocal condition number of a triangular matrix (dtrcon, non-unit diagonal) */
export declare function trcon(T: Mat, upper: boolean, oneNormKind: boolean): number;
/** Options for {@link solve}. */
export interface SolveOptions {
    /**
     * Tolerance for detecting singularity: throws if the estimated reciprocal condition number (one norm) is
     * smaller than this. A value of 0 or less disables the check. Default: `Number.EPSILON`.
     */
    tol?: number;
}
/**
 * Inverse of a square matrix. Equivalent to R's `solve(a)`.
 *
 * Uses an LU decomposition with partial pivoting. Throws if the matrix is exactly singular or if its estimated
 * reciprocal condition number is below `tol` (the check is skipped for matrices with `NaN` or infinite values).
 *
 * @param a A square matrix (array of rows).
 * @param b Omit (or pass `undefined`) to compute the inverse.
 * @param options See {@link SolveOptions}.
 * @returns The inverse of `a` as an array of rows.
 *
 * @example
 * ```ts
 * solve([[2, 1], [1, 3]]); // [[0.6, -0.2], [-0.2, 0.4]]
 * ```
 */
export declare function solve(a: MatrixInput, b?: undefined, options?: SolveOptions): number[][];
/**
 * Solves the linear system `a x = b` for a vector `b`. Equivalent to R's `solve(a, b)`.
 *
 * Throws if `a` is exactly singular or its estimated reciprocal condition number is below `tol`.
 *
 * @param a A square matrix (array of rows).
 * @param b The right-hand side vector, with as many elements as `a` has rows.
 * @param options See {@link SolveOptions}.
 * @returns The solution `x` as a vector.
 *
 * @example
 * ```ts
 * solve([[2, 1], [1, 3]], [3, 5]); // [0.8, 1.4]
 * ```
 */
export declare function solve(a: MatrixInput, b: readonly number[] | Float64Array, options?: SolveOptions): number[];
/**
 * Solves the linear system `a x = b` for a matrix `b`. Equivalent to R's `solve(a, b)`.
 *
 * @param a A square matrix (array of rows).
 * @param b The right-hand side matrix (array of rows), with as many rows as `a`.
 * @param options See {@link SolveOptions}.
 * @returns The solution `x` as an array of rows.
 */
export declare function solve(a: MatrixInput, b: MatrixInput, options?: SolveOptions): number[][];
/**
 * Solves the linear system `a x = b`, or inverts `a` when `b` is omitted. Equivalent to R's `solve()`.
 *
 * @param a A square matrix (array of rows).
 * @param b The right-hand side, a vector or a matrix. Omit to compute the inverse.
 * @param options See {@link SolveOptions}.
 * @returns A vector if `b` is a vector, otherwise an array of rows.
 */
export declare function solve(a: MatrixInput, b?: VectorOrMatrix, options?: SolveOptions): number[] | number[][];
/** Result of {@link determinant}: the determinant equals `sign * modulus` (or `sign * exp(modulus)` when `logarithm` is `true`). */
export interface Determinant {
    /** The absolute value of the determinant, or its natural logarithm when `logarithm` is `true`. `-Infinity` (or 0) for an exactly singular matrix. */
    modulus: number;
    /** Whether `modulus` is on the log scale. */
    logarithm: boolean;
    /** The sign of the determinant (`1` or `-1`). */
    sign: number;
}
/**
 * Determinant as modulus and sign. Equivalent to R's `determinant()`.
 *
 * Computed from an LU decomposition; the log modulus is the sum of the logs of the absolute diagonal elements.
 *
 * @param x A square matrix (array of rows).
 * @param options `logarithm`: return the natural logarithm of the modulus. Default: `true`.
 * @returns The modulus and sign. See {@link Determinant}.
 */
export declare function determinant(x: MatrixInput, options?: {
    logarithm?: boolean;
}): Determinant;
/**
 * Determinant of a square matrix. Equivalent to R's `det()`.
 *
 * @param x A square matrix (array of rows).
 * @returns The determinant.
 */
export declare function det(x: MatrixInput): number;
/** Options for {@link rcond}. */
export interface RcondOptions {
    /** The norm: `"O"` or `"1"` (one norm) or `"I"` (infinity norm). Default: `"O"`. */
    norm?: "O" | "1" | "I";
    /** Treat `x` as triangular and use only its triangle given by `uplo`. Default: `false`. */
    triangular?: boolean;
    /** With `triangular: true`, use the upper (`"U"`) or lower (`"L"`) triangle. Default: `"U"`. */
    uplo?: "U" | "L";
}
/**
 * Estimate of the reciprocal condition number of a matrix. Equivalent to R's `rcond()`.
 *
 * Uses LAPACK's estimators (`dgecon` on the LU decomposition, or `dtrcon` for triangular matrices). For a
 * non-square matrix, the estimate is computed on the triangular factor `R` of its QR decomposition
 * (of the transpose if the matrix is wide). Returns 0 for an exactly singular matrix.
 *
 * @param x A matrix (array of rows).
 * @param options See {@link RcondOptions}.
 * @returns The estimated reciprocal condition number, between 0 and 1.
 */
export declare function rcond(x: MatrixInput, options?: RcondOptions): number;
