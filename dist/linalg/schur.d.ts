import { type MatrixInput } from "./matrix.js";
/** Result of {@link schur}: `x = Q T Q'`. */
export interface SchurResult {
    /** The upper quasi-triangular factor (array of rows). */
    T: number[][];
    /** The orthogonal factor (array of rows). */
    Q: number[][];
    /** Real parts of the eigenvalues, in the order of T's diagonal blocks. */
    valuesRe: number[];
    /** Imaginary parts of the eigenvalues (0 for real ones; a complex pair has the positive one first). */
    valuesIm: number[];
}
/**
 * Real Schur decomposition of a square matrix. Equivalent to R's `Matrix::Schur(x)`.
 *
 * Returns an orthogonal `Q` and an upper quasi-triangular `T` with `x = Q T Q'`. `T` has 1 x 1 diagonal blocks for
 * real eigenvalues and standardised 2 x 2 blocks `[[a, b], [c, a]]` (`b c < 0`) for complex conjugate pairs
 * `a ± sqrt(-b c) i`. The decomposition is not unique: the order of the diagonal blocks and the signs of `Q`'s
 * columns may differ from R's (both are correct). Throws on `NaN` or infinite values.
 *
 * @param x A square matrix (array of rows).
 * @returns `T`, `Q` and the eigenvalues read off `T`. See {@link SchurResult}.
 *
 * @example
 * ```ts
 * schur([[0, -1], [1, 0]]);
 * // T: [[0, -1], [1, 0]], Q: [[1, 0], [0, 1]], valuesRe: [0, 0], valuesIm: [1, -1]
 * ```
 */
export declare function schur(x: MatrixInput): SchurResult;
/**
 * Schur factorisation of a real 2 x 2 matrix in standard form (dlanv2):
 * [[a, b], [c, d]] = [[cs, -sn], [sn, cs]] [[aa, bb], [cc, dd]] [[cs, sn], [-sn, cs]], where either cc = 0 (real
 * eigenvalues aa, dd) or aa = dd and bb cc < 0 (complex pair). Returns the standardised entries, the rotation and the
 * eigenvalues
 */
export declare function lanv2(a: number, b: number, c: number, d: number): {
    a: number;
    b: number;
    c: number;
    d: number;
    cs: number;
    sn: number;
    rt1r: number;
    rt1i: number;
    rt2r: number;
    rt2i: number;
};
