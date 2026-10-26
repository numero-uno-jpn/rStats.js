// Cholesky decomposition (R's chol) and the inverse from that decomposition (R's chol2inv).
//
// Same procedures as the LAPACK 3.12.0 reference implementation: unpivoted is SRC/dpotf2.f (UPLO = 'U'),
// pivoted is SRC/dpstf2.f, chol2inv is SRC/dpotri.f (dtrti2.f and dlauu2.f).
// LAPACK is modified BSD; see THIRD_PARTY_NOTICES.md.
// Argument checks and result shapes follow observed R output.
// - Only the upper triangle is used (symmetry is not checked). The lower triangle of the result is 0
// - Without pivoting, a non-positive diagonal is an error. A NaN diagonal is not an error; the NaN propagates
//   (same as the R build tested, whose LAPACK is OpenBLAS; the reference dpotf2 stops on NaN too)
// - With pivoting, rank deficiency is not an error and rank is returned (R warns). The diagonal at the
//   stopping point holds the remaining value at that time, and later rows keep their original (permuted) values
// - pivot is 0-based to suit JS (R's pivot minus 1)
// - chol2inv uses only the upper-left size x size upper triangle of x. A zero on the diagonal is an error
import { fromMat, newMat, requireSquare, toMat, toMatOrColumn } from "./matrix.js";
export function chol(x, options = {}) {
    const a = toMat(x);
    requireSquare(a);
    if (a.nrow === 0)
        throw new RangeError("the matrix has zero dimension");
    if (options.pivot) {
        const { pivot, rank } = pstf2(a, options.tol ?? -1);
        zeroLower(a);
        return { r: fromMat(a), pivot: pivot.map((v) => v - 1), rank };
    }
    const info = potf2(a);
    if (info > 0)
        throw new Error(`the matrix is not positive definite: the leading minor of order ${info} is not positive`);
    zeroLower(a);
    return fromMat(a);
}
function zeroLower(a) {
    const n = a.nrow;
    for (let j = 0; j < n; j++)
        for (let i = j + 1; i < n; i++)
            a.data[i + j * n] = 0;
}
/** Overwrite a with its upper-triangular Cholesky factor (dpotf2). Returns the failing column (1-based), or 0 on success */
export function potf2(A) {
    const n = A.nrow;
    const a = A.data;
    for (let j = 0; j < n; j++) {
        const cj = j * n;
        let ajj = a[j + cj];
        for (let k = 0; k < j; k++)
            ajj -= a[k + cj] * a[k + cj];
        if (ajj <= 0) {
            a[j + cj] = ajj;
            return j + 1;
        }
        ajj = Math.sqrt(ajj);
        a[j + cj] = ajj;
        // Rest of row j: a(j, j+1:n) = (a(j, j+1:n) - a(0:j-1, j)^T a(0:j-1, j+1:n)) / ajj
        for (let c = j + 1; c < n; c++) {
            const cc = c * n;
            let s = a[j + cc];
            for (let k = 0; k < j; k++)
                s -= a[k + cj] * a[k + cc];
            a[j + cc] = s / ajj;
        }
    }
    return 0;
}
/** Pivoted upper-triangular Cholesky decomposition (dpstf2). Overwrites a */
function pstf2(A, tol) {
    const n = A.nrow;
    const a = A.data;
    const piv = Array.from({ length: n }, (_, i) => i + 1);
    const at = (i, j) => i + j * n;
    const swap = (p, q) => {
        const t = a[p];
        a[p] = a[q];
        a[q] = t;
    };
    // First pivot: largest diagonal element (NaN is never chosen; if the first is NaN it stays)
    let pvt = 0;
    for (let i = 1; i < n; i++)
        if (a[at(i, i)] > a[at(pvt, pvt)])
            pvt = i;
    let ajj = a[at(pvt, pvt)];
    if (ajj <= 0 || Number.isNaN(ajj))
        return { pivot: piv, rank: 0 };
    const dstop = tol < 0 ? n * Number.EPSILON * ajj : tol;
    const work = new Float64Array(2 * n);
    for (let j = 0; j < n; j++) {
        for (let i = j; i < n; i++) {
            if (j > 0)
                work[i] += a[at(j - 1, i)] ** 2;
            work[n + i] = a[at(i, i)] - work[i];
        }
        if (j > 0) {
            pvt = j;
            for (let i = j + 1; i < n; i++)
                if (work[n + i] > work[n + pvt])
                    pvt = i;
            ajj = work[n + pvt];
            if (ajj <= dstop || Number.isNaN(ajj)) {
                a[at(j, j)] = ajj;
                return { pivot: piv, rank: j };
            }
        }
        if (j !== pvt) {
            a[at(pvt, pvt)] = a[at(j, j)];
            for (let k = 0; k < j; k++)
                swap(at(k, j), at(k, pvt));
            for (let k = pvt + 1; k < n; k++)
                swap(at(j, k), at(pvt, k));
            for (let k = j + 1; k < pvt; k++)
                swap(at(j, k), at(k, pvt));
            [work[j], work[pvt]] = [work[pvt], work[j]];
            [piv[j], piv[pvt]] = [piv[pvt], piv[j]];
        }
        ajj = Math.sqrt(ajj);
        a[at(j, j)] = ajj;
        for (let c = j + 1; c < n; c++) {
            let s = a[at(j, c)];
            for (let k = 0; k < j; k++)
                s -= a[at(k, j)] * a[at(k, c)];
            a[at(j, c)] = s / ajj;
        }
    }
    return { pivot: piv, rank: n };
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
export function chol2inv(x, options = {}) {
    const m = toMatOrColumn(x);
    const size = options.size ?? m.ncol;
    if (!Number.isInteger(size) || size < 1)
        throw new RangeError(`size must be a positive integer (got ${size})`);
    if (size > m.ncol)
        throw new RangeError(`size cannot exceed the number of columns (${m.ncol})`);
    if (size > m.nrow)
        throw new RangeError(`size cannot exceed the number of rows (${m.nrow})`);
    const a = newMat(size, size);
    for (let j = 0; j < size; j++)
        for (let i = 0; i <= j; i++)
            a.data[i + j * size] = m.data[i + j * m.nrow];
    potri(a);
    // Copy to the lower triangle
    for (let j = 0; j < size; j++)
        for (let i = j + 1; i < size; i++)
            a.data[i + j * size] = a.data[j + i * size];
    return fromMat(a);
}
/** From upper-triangular R, compute the upper triangle of (t(R) R)^-1 in place (dpotri = dtrti2 + dlauu2) */
export function potri(A) {
    const n = A.nrow;
    const a = A.data;
    for (let i = 0; i < n; i++) {
        if (a[i + i * n] === 0)
            throw new Error(`element (${i + 1}, ${i + 1}) is zero, so the inverse cannot be computed`);
    }
    // dtrti2 (upper, non-unit diagonal): overwrite with the inverse of R
    for (let j = 0; j < n; j++) {
        const cj = j * n;
        a[j + cj] = 1 / a[j + cj];
        const ajj = -a[j + cj];
        // Multiply x = a(0:j-1, j) by the already-inverted upper-left triangle (dtrmv, upper, no transpose)
        for (let k = 0; k < j; k++) {
            const t = a[k + cj];
            if (t !== 0) {
                for (let i = 0; i < k; i++)
                    a[i + cj] += t * a[i + k * n];
                a[k + cj] = t * a[k + k * n];
            }
        }
        for (let i = 0; i < j; i++)
            a[i + cj] *= ajj;
    }
    // dlauu2 (upper): overwrite with the upper triangle of U U^T
    for (let i = 0; i < n; i++) {
        const aii = a[i + i * n];
        if (i < n - 1) {
            let d = 0;
            for (let k = i; k < n; k++)
                d += a[i + k * n] * a[i + k * n];
            a[i + i * n] = d;
            // a(0:i-1, i) = aii a(0:i-1, i) + A(0:i-1, i+1:n) a(i, i+1:n)^T (dgemv)
            for (let r = 0; r < i; r++)
                a[r + i * n] *= aii;
            for (let k = i + 1; k < n; k++) {
                const t = a[i + k * n];
                if (t !== 0)
                    for (let r = 0; r < i; r++)
                        a[r + i * n] += t * a[r + k * n];
            }
        }
        else {
            for (let r = 0; r <= i; r++)
                a[r + i * n] *= aii;
        }
    }
}
