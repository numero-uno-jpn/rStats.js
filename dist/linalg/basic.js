// Matrix products (R's crossprod, tcrossprod) and triangular systems (R's backsolve, forwardsolve).
//
// Triangular solves follow the same procedure as the LAPACK 3.12.0 reference BLAS/SRC/dtrsm.f (eliminate column by column,
// skipping zero right-hand-side elements). LAPACK is modified BSD; see THIRD_PARTY_NOTICES.md.
// Argument checks and result shapes follow observed R output.
// - A vector right-hand side gives a vector of length k; a matrix gives a matrix with k rows
// - Only the upper-left k x k triangle of r is used. Only the first k rows of the right-hand side are used
// - A zero on the diagonal is an error (as in R, only when exactly 0)
import { fromMat, isMatrixInput, newMat, toMat, toMatOrColumn } from "./matrix.js";
/**
 * Matrix cross-product `t(x) %*% y`, or `t(x) %*% x` when `y` is omitted. Equivalent to R's `crossprod()`.
 *
 * A vector argument is treated as a one-column matrix.
 *
 * @param x A matrix (array of rows) or a vector.
 * @param y A matrix or a vector with the same number of rows as `x`. Defaults to `x`.
 * @returns The product as an array of rows (`ncol(x)` x `ncol(y)`).
 *
 * @example
 * ```ts
 * crossprod([[1, 2], [3, 4]]);         // [[10, 14], [14, 20]]
 * crossprod([[1, 2], [3, 4]], [1, 1]); // [[4], [6]]
 * ```
 *
 * @category Linear algebra
 */
export function crossprod(x, y) {
    const a = toMatOrColumn(x);
    const b = y === undefined ? a : toMatOrColumn(y);
    if (a.nrow !== b.nrow)
        throw new TypeError(`non-conformable arguments (${a.nrow} and ${b.nrow} rows)`);
    const n = a.nrow;
    const out = newMat(a.ncol, b.ncol);
    for (let j = 0; j < b.ncol; j++) {
        for (let i = 0; i < a.ncol; i++) {
            // When the result is symmetric (y omitted), compute only the upper triangle and copy it to the lower later
            if (y === undefined && i > j)
                continue;
            let s = 0;
            for (let k = 0; k < n; k++)
                s += a.data[k + i * n] * b.data[k + j * n];
            out.data[i + j * a.ncol] = s;
        }
    }
    if (y === undefined)
        mirrorUpper(out);
    return fromMat(out);
}
/**
 * Matrix cross-product `x %*% t(y)`, or `x %*% t(x)` when `y` is omitted. Equivalent to R's `tcrossprod()`.
 *
 * A vector argument is treated as a one-column matrix.
 *
 * @param x A matrix (array of rows) or a vector.
 * @param y A matrix or a vector with the same number of columns as `x`. Defaults to `x`.
 * @returns The product as an array of rows (`nrow(x)` x `nrow(y)`).
 *
 * @example
 * ```ts
 * tcrossprod([[1, 2], [3, 4]]); // [[5, 11], [11, 25]]
 * ```
 *
 * @category Linear algebra
 */
export function tcrossprod(x, y) {
    const a = toMatOrColumn(x);
    const b = y === undefined ? a : toMatOrColumn(y);
    if (a.ncol !== b.ncol)
        throw new TypeError(`non-conformable arguments (${a.ncol} and ${b.ncol} columns)`);
    const out = newMat(a.nrow, b.nrow);
    for (let j = 0; j < b.nrow; j++) {
        for (let i = 0; i < a.nrow; i++) {
            // When the result is symmetric (y omitted), compute only the upper triangle and copy it to the lower later
            if (y === undefined && i > j)
                continue;
            let s = 0;
            for (let k = 0; k < a.ncol; k++)
                s += a.data[i + k * a.nrow] * b.data[j + k * b.nrow];
            out.data[i + j * a.nrow] = s;
        }
    }
    if (y === undefined)
        mirrorUpper(out);
    return fromMat(out);
}
/** Copy the upper triangle of a square matrix to the lower triangle */
function mirrorUpper(m) {
    const n = m.nrow;
    for (let j = 0; j < n; j++)
        for (let i = j + 1; i < n; i++)
            m.data[i + j * n] = m.data[j + i * n];
}
export function backsolve(r, x, options = {}) {
    return triangularSolve(r, x, options.k, options.upperTri ?? true, options.transpose ?? false);
}
export function forwardsolve(l, x, options = {}) {
    return triangularSolve(l, x, options.k, options.upperTri ?? false, options.transpose ?? false);
}
function triangularSolve(r, x, k, upper, trans) {
    const a = toMat(r);
    const b0 = toMatOrColumn(x);
    const kk = k ?? a.ncol;
    if (!Number.isInteger(kk) || kk < 1 || kk > a.nrow || kk > a.ncol || kk > b0.nrow) {
        throw new RangeError(`invalid k (got ${kk})`);
    }
    for (let i = 0; i < kk; i++) {
        if (a.data[i + i * a.nrow] === 0)
            throw new Error(`singular matrix: diagonal element ${i + 1} is zero`);
    }
    // Copy the first k rows of the right-hand side
    const b = newMat(kk, b0.ncol);
    for (let j = 0; j < b0.ncol; j++) {
        for (let i = 0; i < kk; i++)
            b.data[i + j * kk] = b0.data[i + j * b0.nrow];
    }
    trsm(a, kk, b, upper, trans);
    return isMatrixInput(x) ? fromMat(b) : Array.from(b.data);
}
/**
 * Solve op(A) X = B, overwriting B with X (dtrsm with SIDE = 'L', DIAG = 'N').
 * Only the upper-left n x n triangle of A is used. B has n rows
 */
export function trsm(A, n, B, upper, trans) {
    const lda = A.nrow;
    const a = A.data;
    const ldb = B.nrow;
    const b = B.data;
    for (let j = 0; j < B.ncol; j++) {
        const o = j * ldb;
        if (!trans && upper) {
            for (let k = n - 1; k >= 0; k--) {
                if (b[o + k] !== 0) {
                    b[o + k] /= a[k + k * lda];
                    const bk = b[o + k];
                    for (let i = 0; i < k; i++)
                        b[o + i] -= bk * a[i + k * lda];
                }
            }
        }
        else if (!trans) {
            for (let k = 0; k < n; k++) {
                if (b[o + k] !== 0) {
                    b[o + k] /= a[k + k * lda];
                    const bk = b[o + k];
                    for (let i = k + 1; i < n; i++)
                        b[o + i] -= bk * a[i + k * lda];
                }
            }
        }
        else if (upper) {
            for (let i = 0; i < n; i++) {
                let t = b[o + i];
                for (let k = 0; k < i; k++)
                    t -= a[k + i * lda] * b[o + k];
                b[o + i] = t / a[i + i * lda];
            }
        }
        else {
            for (let i = n - 1; i >= 0; i--) {
                let t = b[o + i];
                for (let k = i + 1; k < n; k++)
                    t -= a[k + i * lda] * b[o + k];
                b[o + i] = t / a[i + i * lda];
            }
        }
    }
}
