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

import { fromMat, newMat, requireSquare, toMat, toMatOrColumn, type Mat, type MatrixInput } from "./matrix.js";

/** Options for {@link chol}. */
export interface CholOptions {
  /** Use diagonal pivoting (largest remaining diagonal first), which also works for positive semi-definite matrices. Default: `false`. */
  pivot?: boolean;
  /** Stopping tolerance for the pivoted decomposition. A negative value means `n * eps * max(diag(x))`. Default: `-1`. Used only with `pivot: true`. */
  tol?: number;
}

/** Result of {@link chol} with `pivot: true`. */
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
 */
export function chol(x: MatrixInput, options?: CholOptions & { pivot?: false }): number[][];
/**
 * Pivoted Cholesky decomposition. Equivalent to R's `chol(x, pivot = TRUE)`.
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
export function chol(x: MatrixInput, options: CholOptions & { pivot: true }): CholPivotResult;
/**
 * Cholesky decomposition, with or without pivoting. Equivalent to R's `chol()`.
 *
 * @param x A square symmetric matrix (array of rows).
 * @param options See {@link CholOptions}.
 * @returns The factor `R`, or a {@link CholPivotResult} when `pivot` is `true`.
 */
export function chol(x: MatrixInput, options?: CholOptions): number[][] | CholPivotResult;
export function chol(x: MatrixInput, options: CholOptions = {}): number[][] | CholPivotResult {
  const a = toMat(x);
  requireSquare(a);
  if (a.nrow === 0) throw new RangeError("the matrix has zero dimension");
  if (options.pivot) {
    const { pivot, rank } = pstf2(a, options.tol ?? -1);
    zeroLower(a);
    return { r: fromMat(a), pivot: pivot.map((v) => v - 1), rank };
  }
  const info = potf2(a);
  if (info > 0) throw new Error(`the matrix is not positive definite: the leading minor of order ${info} is not positive`);
  zeroLower(a);
  return fromMat(a);
}

function zeroLower(a: Mat): void {
  const n = a.nrow;
  for (let j = 0; j < n; j++) for (let i = j + 1; i < n; i++) a.data[i + j * n] = 0;
}

/** Overwrite a with its upper-triangular Cholesky factor (dpotf2). Returns the failing column (1-based), or 0 on success */
export function potf2(A: Mat): number {
  const n = A.nrow;
  const a = A.data;
  for (let j = 0; j < n; j++) {
    const cj = j * n;
    let ajj = a[j + cj]!;
    for (let k = 0; k < j; k++) ajj -= a[k + cj]! * a[k + cj]!;
    if (ajj <= 0) {
      a[j + cj] = ajj;
      return j + 1;
    }
    ajj = Math.sqrt(ajj);
    a[j + cj] = ajj;
    // Rest of row j: a(j, j+1:n) = (a(j, j+1:n) - a(0:j-1, j)^T a(0:j-1, j+1:n)) / ajj
    for (let c = j + 1; c < n; c++) {
      const cc = c * n;
      let s = a[j + cc]!;
      for (let k = 0; k < j; k++) s -= a[k + cj]! * a[k + cc]!;
      a[j + cc] = s / ajj;
    }
  }
  return 0;
}

/** Pivoted upper-triangular Cholesky decomposition (dpstf2). Overwrites a */
function pstf2(A: Mat, tol: number): { pivot: number[]; rank: number } {
  const n = A.nrow;
  const a = A.data;
  const piv = Array.from({ length: n }, (_, i) => i + 1);
  const at = (i: number, j: number) => i + j * n;
  const swap = (p: number, q: number) => {
    const t = a[p]!;
    a[p] = a[q]!;
    a[q] = t;
  };
  // First pivot: largest diagonal element (NaN is never chosen; if the first is NaN it stays)
  let pvt = 0;
  for (let i = 1; i < n; i++) if (a[at(i, i)]! > a[at(pvt, pvt)]!) pvt = i;
  let ajj = a[at(pvt, pvt)]!;
  if (ajj <= 0 || Number.isNaN(ajj)) return { pivot: piv, rank: 0 };
  const dstop = tol < 0 ? n * Number.EPSILON * ajj : tol;
  const work = new Float64Array(2 * n);
  for (let j = 0; j < n; j++) {
    for (let i = j; i < n; i++) {
      if (j > 0) work[i]! += a[at(j - 1, i)]! ** 2;
      work[n + i] = a[at(i, i)]! - work[i]!;
    }
    if (j > 0) {
      pvt = j;
      for (let i = j + 1; i < n; i++) if (work[n + i]! > work[n + pvt]!) pvt = i;
      ajj = work[n + pvt]!;
      if (ajj <= dstop || Number.isNaN(ajj)) {
        a[at(j, j)] = ajj;
        return { pivot: piv, rank: j };
      }
    }
    if (j !== pvt) {
      a[at(pvt, pvt)] = a[at(j, j)]!;
      for (let k = 0; k < j; k++) swap(at(k, j), at(k, pvt));
      for (let k = pvt + 1; k < n; k++) swap(at(j, k), at(pvt, k));
      for (let k = j + 1; k < pvt; k++) swap(at(j, k), at(k, pvt));
      [work[j], work[pvt]] = [work[pvt]!, work[j]!];
      [piv[j], piv[pvt]] = [piv[pvt]!, piv[j]!];
    }
    ajj = Math.sqrt(ajj);
    a[at(j, j)] = ajj;
    for (let c = j + 1; c < n; c++) {
      let s = a[at(j, c)]!;
      for (let k = 0; k < j; k++) s -= a[at(k, j)]! * a[at(k, c)]!;
      a[at(j, c)] = s / ajj;
    }
  }
  return { pivot: piv, rank: n };
}

/** Options for {@link chol2inv}. */
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
 */
export function chol2inv(x: MatrixInput | readonly number[] | Float64Array, options: Chol2InvOptions = {}): number[][] {
  const m = toMatOrColumn(x);
  const size = options.size ?? m.ncol;
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`size must be a positive integer (got ${size})`);
  if (size > m.ncol) throw new RangeError(`size cannot exceed the number of columns (${m.ncol})`);
  if (size > m.nrow) throw new RangeError(`size cannot exceed the number of rows (${m.nrow})`);
  const a = newMat(size, size);
  for (let j = 0; j < size; j++) for (let i = 0; i <= j; i++) a.data[i + j * size] = m.data[i + j * m.nrow]!;
  potri(a);
  // Copy to the lower triangle
  for (let j = 0; j < size; j++) for (let i = j + 1; i < size; i++) a.data[i + j * size] = a.data[j + i * size]!;
  return fromMat(a);
}

/** From upper-triangular R, compute the upper triangle of (t(R) R)^-1 in place (dpotri = dtrti2 + dlauu2) */
export function potri(A: Mat): void {
  const n = A.nrow;
  const a = A.data;
  for (let i = 0; i < n; i++) {
    if (a[i + i * n] === 0) throw new Error(`element (${i + 1}, ${i + 1}) is zero, so the inverse cannot be computed`);
  }
  // dtrti2 (upper, non-unit diagonal): overwrite with the inverse of R
  for (let j = 0; j < n; j++) {
    const cj = j * n;
    a[j + cj] = 1 / a[j + cj]!;
    const ajj = -a[j + cj]!;
    // Multiply x = a(0:j-1, j) by the already-inverted upper-left triangle (dtrmv, upper, no transpose)
    for (let k = 0; k < j; k++) {
      const t = a[k + cj]!;
      if (t !== 0) {
        for (let i = 0; i < k; i++) a[i + cj]! += t * a[i + k * n]!;
        a[k + cj] = t * a[k + k * n]!;
      }
    }
    for (let i = 0; i < j; i++) a[i + cj]! *= ajj;
  }
  // dlauu2 (upper): overwrite with the upper triangle of U U^T
  for (let i = 0; i < n; i++) {
    const aii = a[i + i * n]!;
    if (i < n - 1) {
      let d = 0;
      for (let k = i; k < n; k++) d += a[i + k * n]! * a[i + k * n]!;
      a[i + i * n] = d;
      // a(0:i-1, i) = aii a(0:i-1, i) + A(0:i-1, i+1:n) a(i, i+1:n)^T (dgemv)
      for (let r = 0; r < i; r++) a[r + i * n]! *= aii;
      for (let k = i + 1; k < n; k++) {
        const t = a[i + k * n]!;
        if (t !== 0) for (let r = 0; r < i; r++) a[r + i * n]! += t * a[r + k * n]!;
      }
    } else {
      for (let r = 0; r <= i; r++) a[r + i * n]! *= aii;
    }
  }
}
