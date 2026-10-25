import { type Mat, type MatrixInput } from "./matrix.js";
/** Options for {@link eigen}. */
export interface EigenOptions {
    /**
     * Treat the matrix as symmetric (only its lower triangle is then used). Default: detected automatically,
     * like R's `isSymmetric()` (relative difference between the matrix and its transpose at most `100 * eps`).
     */
    symmetric?: boolean;
    /** Compute only the eigenvalues. Default: `false`. R's `only.values`. */
    onlyValues?: boolean;
}
/** Result of {@link eigen}. */
export interface EigenResult {
    /**
     * The eigenvalues (their real parts if complex). Sorted in decreasing order for a symmetric matrix, and by
     * decreasing modulus otherwise (within a complex conjugate pair, the one with positive imaginary part comes first).
     */
    values: number[];
    /** The imaginary parts of the eigenvalues. Present only for a non-symmetric matrix with complex eigenvalues. */
    valuesIm?: number[];
    /** The eigenvectors as columns (array of rows; real parts if complex), each of unit length. Omitted with `onlyValues: true`. */
    vectors?: number[][];
    /** The imaginary parts of the eigenvectors. Present only when `valuesIm` is present (and vectors were computed). */
    vectorsIm?: number[][];
}
/**
 * Eigenvalues and eigenvectors of a square matrix. Equivalent to R's `eigen()`.
 *
 * Symmetric matrices use tridiagonalization and the implicit QL method; other matrices use Hessenberg reduction
 * and the Francis double-shift QR method (no balancing). R uses LAPACK, so eigenvalues agree up to rounding, but
 * eigenvector signs may differ from R (both are correct); for repeated eigenvalues the basis may differ.
 * Complex eigenvalues and eigenvectors are returned as separate real and imaginary parts (`valuesIm`,
 * `vectorsIm`). Each complex eigenvector is scaled to unit length with its largest component real and positive.
 * Throws on `NaN` or infinite values.
 *
 * @param x A square matrix (array of rows).
 * @param options See {@link EigenOptions}.
 * @returns The eigenvalues and eigenvectors. See {@link EigenResult}.
 *
 * @example
 * ```ts
 * eigen([[2, 1], [1, 2]]);
 * // values: [3, 1] (up to rounding)
 * // vectors: [[0.7071, 0.7071], [0.7071, -0.7071]] (signs may differ from R)
 *
 * eigen([[0, -1], [1, 0]]);
 * // values: [0, 0], valuesIm: [1, -1]
 * ```
 */
export declare function eigen(x: MatrixInput, options?: EigenOptions): EigenResult;
/** Same test as R's isSymmetric (all.equal(A, t(A), tolerance = 100 ε)) */
export declare function isSymmetric(a: Mat): boolean;
