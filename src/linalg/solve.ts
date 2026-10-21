// Linear systems and inverses (R's solve), determinants (R's det, determinant) and reciprocal condition number estimates (R's rcond).
//
// LU decomposition follows the LAPACK 3.12.0 reference SRC/dgetf2.f (partial pivoting), solving follows dgetrs.f,
// and condition estimation follows dgecon.f and dtrcon.f with their 1-norm estimator dlacn2.f (Higham's method).
// LAPACK is modified BSD; see THIRD_PARTY_NOTICES.md.
// Argument checks, errors and result shapes follow observed R output.
// - solve raises an error if the LU factor has a zero on the diagonal, or if the reciprocal condition number (1-norm) is below tol (default ε)
//   (matrices containing NaN or Inf are solved without checking the condition number)
// - The log of determinant is the sum of logs of |diagonal|. A zero on the diagonal gives -Inf (0 if logarithm: false)
// - For a non-square matrix, rcond estimates from the upper triangle of R of the QR decomposition (transposed first if wide)
// - Triangular solves use plain substitution rather than dlatrs (which rescales to avoid overflow),
//   so values may differ from R for matrices on the verge of overflow

import { fromMat, isMatrixInput, newMat, requireSquare, toMat, toMatOrColumn, transpose, type Mat, type MatrixInput, type VectorOrMatrix } from "./matrix.js";
import { infNorm, oneNorm } from "./norm.js";
import { qr, qrR } from "./qr.js";

/** LU decomposition (dgetf2). Overwrites a with L (unit lower triangular, diagonal not stored) and U. ipiv is 0-based */
export function getrf(A: Mat): { ipiv: Int32Array; info: number } {
  const m = A.nrow;
  const n = A.ncol;
  const a = A.data;
  const k = Math.min(m, n);
  const ipiv = new Int32Array(k);
  const sfmin = 2 ** -1022;
  let info = 0;
  for (let j = 0; j < k; j++) {
    const cj = j * m;
    let jp = j;
    let amax = Math.abs(a[cj + j]!);
    for (let i = j + 1; i < m; i++) {
      const v = Math.abs(a[cj + i]!);
      if (v > amax) {
        amax = v;
        jp = i;
      }
    }
    ipiv[j] = jp;
    if (a[cj + jp] !== 0) {
      if (jp !== j) {
        for (let c = 0; c < n; c++) {
          const t = a[j + c * m]!;
          a[j + c * m] = a[jp + c * m]!;
          a[jp + c * m] = t;
        }
      }
      const piv = a[cj + j]!;
      if (Math.abs(piv) >= sfmin) {
        const r = 1 / piv;
        for (let i = j + 1; i < m; i++) a[cj + i]! *= r;
      } else {
        for (let i = j + 1; i < m; i++) a[cj + i]! /= piv;
      }
    } else if (info === 0) {
      info = j + 1;
    }
    // Update the trailing submatrix (dger)
    for (let c = j + 1; c < n; c++) {
      const y = a[j + c * m]!;
      if (y === 0) continue;
      const t = -y;
      for (let i = j + 1; i < m; i++) a[i + c * m]! += a[cj + i]! * t;
    }
  }
  return { ipiv, info };
}

/** Solve A X = B from the LU decomposition, overwriting B with X (dgetrs, no transpose) */
function getrs(LU: Mat, ipiv: Int32Array, B: Mat): void {
  const n = LU.nrow;
  const a = LU.data;
  const b = B.data;
  for (let c = 0; c < B.ncol; c++) {
    const o = c * n;
    for (let k = 0; k < n; k++) {
      const p = ipiv[k]!;
      if (p !== k) {
        const t = b[o + k]!;
        b[o + k] = b[o + p]!;
        b[o + p] = t;
      }
    }
    // L (unit lower triangular)
    for (let k = 0; k < n; k++) {
      const bk = b[o + k]!;
      if (bk !== 0) for (let i = k + 1; i < n; i++) b[o + i]! -= bk * a[i + k * n]!;
    }
    // U (upper triangular)
    for (let k = n - 1; k >= 0; k--) {
      if (b[o + k] !== 0) {
        b[o + k]! /= a[k + k * n]!;
        const bk = b[o + k]!;
        for (let i = 0; i < k; i++) b[o + i]! -= bk * a[i + k * n]!;
      }
    }
  }
}

/**
 * Triangular system (dtrsv, in place of dlatrs). Overwrites x.
 * If unit, the diagonal is taken as 1
 */
function trsv(T: Mat, upper: boolean, trans: boolean, unit: boolean, x: Float64Array): void {
  const n = T.nrow;
  const a = T.data;
  if (!trans) {
    if (upper) {
      for (let j = n - 1; j >= 0; j--) {
        if (x[j] !== 0) {
          if (!unit) x[j]! /= a[j + j * n]!;
          const t = x[j]!;
          for (let i = j - 1; i >= 0; i--) x[i]! -= t * a[i + j * n]!;
        }
      }
    } else {
      for (let j = 0; j < n; j++) {
        if (x[j] !== 0) {
          if (!unit) x[j]! /= a[j + j * n]!;
          const t = x[j]!;
          for (let i = j + 1; i < n; i++) x[i]! -= t * a[i + j * n]!;
        }
      }
    }
  } else if (upper) {
    for (let j = 0; j < n; j++) {
      let t = x[j]!;
      for (let i = 0; i < j; i++) t -= a[i + j * n]! * x[i]!;
      if (!unit) t /= a[j + j * n]!;
      x[j] = t;
    }
  } else {
    for (let j = n - 1; j >= 0; j--) {
      let t = x[j]!;
      for (let i = n - 1; i > j; i--) t -= a[i + j * n]! * x[i]!;
      if (!unit) t /= a[j + j * n]!;
      x[j] = t;
    }
  }
}

/**
 * Estimate of the 1-norm of a matrix B (dlacn2). apply(kase, x) overwrites x with B x when kase = 1,
 * and with B^T x when kase = 2
 */
export function lacn2(n: number, apply: (kase: 1 | 2, x: Float64Array) => void): number {
  const x = new Float64Array(n);
  const isgn = new Int32Array(n);
  const sum = () => x.reduce((s, v) => s + Math.abs(v), 0);
  const imax = () => {
    let k = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x[i]!) > Math.abs(x[k]!)) k = i;
    return k;
  };
  const signs = () => {
    for (let i = 0; i < n; i++) {
      x[i] = x[i]! >= 0 ? 1 : -1;
      isgn[i] = x[i]!;
    }
  };
  x.fill(1 / n);
  apply(1, x);
  if (n === 1) return Math.abs(x[0]!);
  let est = sum();
  signs();
  apply(2, x);
  let j = imax();
  let iter = 2;
  const itmax = 5;
  // Iterate from the unit vector e_j
  for (;;) {
    x.fill(0);
    x[j] = 1;
    apply(1, x);
    const estold = est;
    est = sum();
    let changed = false;
    for (let i = 0; i < n; i++) {
      if ((x[i]! >= 0 ? 1 : -1) !== isgn[i]) {
        changed = true;
        break;
      }
    }
    // Stop if the sign vector repeats or the estimate does not increase
    if (!changed || est <= estold) break;
    signs();
    apply(2, x);
    const jlast = j;
    j = imax();
    if (x[jlast] !== Math.abs(x[j]!) && iter < itmax) {
      iter++;
      continue;
    }
    break;
  }
  // Finally try the vector of alternating signs
  let altsgn = 1;
  for (let i = 0; i < n; i++) {
    x[i] = altsgn * (1 + i / (n - 1));
    altsgn = -altsgn;
  }
  apply(1, x);
  const temp = 2 * (sum() / (3 * n));
  return temp > est ? temp : est;
}

/** Estimate the reciprocal condition number from the LU decomposition (dgecon). anorm is the norm of the original matrix */
export function gecon(LU: Mat, anorm: number, oneNormKind: boolean): number {
  const n = LU.nrow;
  if (n === 0) return 1;
  // LAPACK 3.12's dgecon raises an error (INFO = -5) for a NaN or Inf norm
  if (!Number.isFinite(anorm)) throw new RangeError("the matrix contains NaN or infinite values (LAPACK dgecon returned error -5)");
  if (anorm === 0) return 0;
  const kase1 = oneNormKind ? 1 : 2;
  const ainvnm = lacn2(n, (kase, x) => {
    if (kase === kase1) {
      trsv(LU, false, false, true, x);
      trsv(LU, true, false, false, x);
    } else {
      trsv(LU, true, true, false, x);
      trsv(LU, false, true, true, x);
    }
  });
  // Overflow during the factorisation is treated as singular
  if (!Number.isFinite(ainvnm)) return 0;
  return ainvnm === 0 ? 0 : 1 / ainvnm / anorm;
}

/** Norm of a triangular matrix (dlantr, non-unit diagonal) */
function triNorm(T: Mat, upper: boolean, oneNormKind: boolean): number {
  const n = T.nrow;
  const s = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const [lo, hi] = upper ? [0, j] : [j, n - 1];
    for (let i = lo; i <= hi; i++) s[oneNormKind ? j : i]! += Math.abs(T.data[i + j * n]!);
  }
  let r = 0;
  for (const v of s) r = Number.isNaN(r) || Number.isNaN(v) ? NaN : Math.max(r, v);
  return r;
}

/** Estimate of the reciprocal condition number of a triangular matrix (dtrcon, non-unit diagonal) */
export function trcon(T: Mat, upper: boolean, oneNormKind: boolean): number {
  const n = T.nrow;
  if (n === 0) return 1;
  const anorm = triNorm(T, upper, oneNormKind);
  // Return 0 even if the norm is NaN (same as dtrcon)
  if (!(anorm > 0)) return 0;
  const kase1 = oneNormKind ? 1 : 2;
  const ainvnm = lacn2(n, (kase, x) => trsv(T, upper, kase !== kase1, false, x));
  if (!Number.isFinite(ainvnm)) return 0;
  return ainvnm === 0 ? 0 : 1 / anorm / ainvnm;
}

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
export function solve(a: MatrixInput, b?: undefined, options?: SolveOptions): number[][];
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
export function solve(a: MatrixInput, b: readonly number[] | Float64Array, options?: SolveOptions): number[];
/**
 * Solves the linear system `a x = b` for a matrix `b`. Equivalent to R's `solve(a, b)`.
 *
 * @param a A square matrix (array of rows).
 * @param b The right-hand side matrix (array of rows), with as many rows as `a`.
 * @param options See {@link SolveOptions}.
 * @returns The solution `x` as an array of rows.
 */
export function solve(a: MatrixInput, b: MatrixInput, options?: SolveOptions): number[][];
/**
 * Solves the linear system `a x = b`, or inverts `a` when `b` is omitted. Equivalent to R's `solve()`.
 *
 * @param a A square matrix (array of rows).
 * @param b The right-hand side, a vector or a matrix. Omit to compute the inverse.
 * @param options See {@link SolveOptions}.
 * @returns A vector if `b` is a vector, otherwise an array of rows.
 */
export function solve(a: MatrixInput, b?: VectorOrMatrix, options?: SolveOptions): number[] | number[][];
export function solve(a: MatrixInput, b?: VectorOrMatrix, options: SolveOptions = {}): number[] | number[][] {
  const A = toMat(a);
  requireSquare(A);
  const n = A.nrow;
  let B: Mat;
  if (b === undefined) {
    B = newMat(n, n);
    for (let i = 0; i < n; i++) B.data[i + i * n] = 1;
  } else {
    B = toMatOrColumn(b);
    if (B.nrow !== n) throw new TypeError(`b (${B.nrow} x ${B.ncol}) is not compatible with a (${n} x ${n})`);
  }
  const anorm = oneNorm(A);
  const { ipiv, info } = getrf(A);
  if (info > 0) throw new Error(`the system is exactly singular: U[${info}, ${info}] = 0`);
  const tol = options.tol ?? Number.EPSILON;
  // Matrices containing NaN or Inf are not checked (dgecon returns an error, which R ignores and returns the solution)
  if (tol > 0 && Number.isFinite(anorm)) {
    const rc = gecon(A, anorm, true);
    if (rc < tol) throw new Error(`the system is computationally singular: reciprocal condition number = ${rc.toPrecision(6)}`);
  }
  getrs(A, ipiv, B);
  return b !== undefined && !isMatrixInput(b) ? Array.from(B.data) : fromMat(B);
}

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
export function determinant(x: MatrixInput, options: { logarithm?: boolean } = {}): Determinant {
  const logarithm = options.logarithm ?? true;
  const A = toMat(x);
  requireSquare(A);
  const n = A.nrow;
  const { ipiv, info } = getrf(A);
  if (info > 0) return { modulus: logarithm ? -Infinity : 0, logarithm, sign: 1 };
  let sign = 1;
  let modulus = logarithm ? 0 : 1;
  for (let i = 0; i < n; i++) {
    if (ipiv[i] !== i) sign = -sign;
    const d = A.data[i + i * n]!;
    if (d < 0) sign = -sign;
    if (logarithm) modulus += Math.log(Math.abs(d));
    else modulus *= Math.abs(d);
  }
  return { modulus, logarithm, sign };
}

/**
 * Determinant of a square matrix. Equivalent to R's `det()`.
 *
 * @param x A square matrix (array of rows).
 * @returns The determinant.
 */
export function det(x: MatrixInput): number {
  const { modulus, sign } = determinant(x);
  return sign * Math.exp(modulus);
}

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
export function rcond(x: MatrixInput, options: RcondOptions = {}): number {
  const norm = options.norm ?? "O";
  if (!["O", "1", "I"].includes(norm)) throw new RangeError(`norm must be "O", "I" or "1" (got "${norm}")`);
  const one = norm !== "I";
  let A = toMat(x);
  if (A.nrow !== A.ncol) {
    // If not square, use R of the QR decomposition (transposed first if wide)
    const t = A.nrow < A.ncol ? fromMat(transpose(A)) : x;
    return trcon(toMat(qrR(qr(t as MatrixInput))), true, one);
  }
  if (options.triangular) return trcon(A, (options.uplo ?? "U") === "U", one);
  const anorm = one ? oneNorm(A) : infNorm(A);
  A = { ...A, data: A.data.slice() };
  const { info } = getrf(A);
  if (info > 0) return 0;
  return gecon(A, anorm, one);
}
