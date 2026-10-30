// QR decomposition (R's qr) and the functions that use it (R's qr.Q, qr.R, qr.X, qr.coef, qr.qy, qr.qty,
// qr.resid, qr.fitted, qr.solve).
//
// The default (lapack: false) is a LINPACK-style Householder decomposition (dqrdc, LINPACK Users' Guide chapter 9;
// compact form: transformation vectors below the diagonal, their leading elements in qraux) combined with R's
// "limited pivoting". The pivoting rules follow observed R output (R's source was not read).
// - Columns are processed left to right. Before processing a column, if its remaining norm is below its original norm × tol
//   (always, for a column whose original norm is 0), it is moved to the right end and the rest shift left. rank drops by the number moved
// - Columns moved to the right end are still transformed when their turn comes (only the column at the last row is left unprocessed)
// - Remaining norms are updated after each transformation by the LINPACK method, and recomputed when cancellation occurs
// - rank = min(number of columns - number moved, number of rows). The public pivot is 0-based to suit JS (internally 1-based)
// lapack: true is the same column-pivoted decomposition as the LAPACK 3.12.0 reference SRC/dgeqp3.f
// (dlaqp2.f, dlarfg.f, dlarf.f). rank is always min(rows, cols) (as in R; rank is not determined).
// Applying Q follows SRC/dorm2r.f. LAPACK is modified BSD; see THIRD_PARTY_NOTICES.md.
//
// Difference from R: with lapack: true, results for matrices containing NaN or Inf are not necessarily the same as R
// (R does not raise an error either and returns meaningless values).

import { fromMat, isMatrixInput, newMat, toMat, toMatOrColumn, type Mat, type MatrixInput, type VectorOrMatrix } from "./matrix.js";

/**
 * Options for {@link qr}.
 *
 * @category Linear algebra
 */
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
 *
 * @category Linear algebra
 */
export interface QR {
  /** Compact form: the upper triangle holds `R`; the part below the diagonal holds the Householder vectors that represent `Q`. */
  qr: number[][];
  /** The computed rank of the matrix. Always `min(nrow, ncol)` for `lapack: true`. */
  rank: number;
  /**
   * Auxiliary information about `Q`: the leading elements of the Householder vectors for the LINPACK method (`ncol`
   * elements), `tau` for the LAPACK method (one per reflection, `min(nrow, ncol)` elements).
   */
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
 *
 * @category Linear algebra
 */
export function qr(x: MatrixInput, options: QROptions = {}): QR {
  const a = toMat(x);
  if (options.lapack) {
    const { tau, pivot } = geqp3(a);
    // One Householder scalar per reflection: min(nrow, ncol) elements, as in R
    const qraux = Array.from(tau);
    return { qr: fromMat(a), rank: Math.min(a.nrow, a.ncol), qraux, pivot: pivot.map((v) => v - 1), useLapack: true };
  }
  for (const v of a.data) if (!Number.isFinite(v)) throw new RangeError("the matrix contains NaN or infinite values");
  const tol = options.tol ?? 1e-7;
  if (Number.isNaN(tol)) throw new RangeError("'tol' must not be NaN");
  const { qraux, pivot, rank } = linpackQR(a, tol);
  return { qr: fromMat(a), rank, qraux: Array.from(qraux), pivot: pivot.map((v) => v - 1), useLapack: false };
}

/** 2-norm (divide by the largest absolute value before squaring and summing, to avoid overflow and underflow) */
function nrm2(d: Float64Array, start: number, n: number): number {
  let scale = 0;
  for (let i = 0; i < n; i++) scale = Math.max(scale, Math.abs(d[start + i]!));
  if (scale === 0 || !Number.isFinite(scale)) return scale;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const u = d[start + i]! / scale;
    s += u * u;
  }
  return scale * Math.sqrt(s);
}

/** LINPACK-style Householder transformations with R's limited pivoting. Overwrites a in compact form */
function linpackQR(A: Mat, tol: number): { qraux: Float64Array; pivot: number[]; rank: number } {
  const n = A.nrow;
  const p = A.ncol;
  const a = A.data;
  const qraux = new Float64Array(p);
  const work = new Float64Array(p); // norms used for updating (replaced when recomputed)
  const orig = new Float64Array(p); // original norms (used for the test; 1 if 0)
  const pivot = Array.from({ length: p }, (_, j) => j + 1);
  for (let j = 0; j < p; j++) {
    qraux[j] = nrm2(a, j * n, n);
    work[j] = qraux[j]!;
    orig[j] = qraux[j] === 0 ? 1 : qraux[j]!;
  }
  const col = new Float64Array(n);
  const lup = Math.min(n, p);
  let k = p; // number of columns not moved to the right end
  for (let l = 0; l < lup; l++) {
    // Move columns whose norm has become small to the right end (shifting the rest left)
    while (l < k && qraux[l]! < orig[l]! * tol) {
      col.set(a.subarray(l * n, (l + 1) * n));
      const [q0, w0, o0, p0] = [qraux[l]!, work[l]!, orig[l]!, pivot[l]!];
      a.copyWithin(l * n, (l + 1) * n, p * n);
      a.set(col, (p - 1) * n);
      qraux.copyWithin(l, l + 1);
      work.copyWithin(l, l + 1);
      orig.copyWithin(l, l + 1);
      pivot.copyWithin(l, l + 1);
      qraux[p - 1] = q0;
      work[p - 1] = w0;
      orig[p - 1] = o0;
      pivot[p - 1] = p0;
      k--;
    }
    // The column at the last row is not transformed (qraux keeps the norm)
    if (l === n - 1) break;
    const cl = l * n;
    let nrmxl = nrm2(a, cl + l, n - l);
    if (nrmxl === 0) continue;
    if (a[cl + l] !== 0) nrmxl = Math.sign(a[cl + l]!) * Math.abs(nrmxl);
    for (let i = l; i < n; i++) a[cl + i]! /= nrmxl;
    a[cl + l] = 1 + a[cl + l]!;
    // Apply the transformation to the remaining columns and update their norms
    for (let j = l + 1; j < p; j++) {
      const cj = j * n;
      let t = 0;
      for (let i = l; i < n; i++) t -= a[cl + i]! * a[cj + i]!;
      t /= a[cl + l]!;
      for (let i = l; i < n; i++) a[cj + i]! += t * a[cl + i]!;
      if (qraux[j] === 0) continue;
      let tt = 1 - (Math.abs(a[cj + l]!) / qraux[j]!) ** 2;
      tt = Math.max(tt, 0);
      const t2 = tt;
      tt = 1 + 0.05 * tt * (qraux[j]! / work[j]!) ** 2;
      if (tt !== 1) {
        qraux[j]! *= Math.sqrt(t2);
      } else {
        qraux[j] = nrm2(a, cj + l + 1, n - l - 1);
        work[j] = qraux[j]!;
      }
    }
    qraux[l] = a[cl + l]!;
    a[cl + l] = -nrmxl;
  }
  return { qraux, pivot, rank: Math.min(k, n) };
}

/** Column-pivoted Householder QR (dlaqp2, the unblocked version of dgeqp3). Returns tau and pivot */
function geqp3(A: Mat): { tau: Float64Array; pivot: number[] } {
  const m = A.nrow;
  const n = A.ncol;
  const a = A.data;
  const k = Math.min(m, n);
  const tau = new Float64Array(k);
  const pivot = Array.from({ length: n }, (_, j) => j + 1);
  const vn1 = new Float64Array(n);
  const vn2 = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    vn1[j] = nrm2(a, j * m, m);
    vn2[j] = vn1[j]!;
  }
  // LAPACK's dlamch('Epsilon') is 2^-53
  const tol3z = Math.sqrt(2 ** -53);
  for (let i = 0; i < k; i++) {
    let pvt = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(vn1[j]!) > Math.abs(vn1[pvt]!)) pvt = j;
    if (pvt !== i) {
      for (let r = 0; r < m; r++) {
        const t = a[r + pvt * m]!;
        a[r + pvt * m] = a[r + i * m]!;
        a[r + i * m] = t;
      }
      [pivot[pvt], pivot[i]] = [pivot[i]!, pivot[pvt]!];
      vn1[pvt] = vn1[i]!;
      vn2[pvt] = vn2[i]!;
    }
    const ci = i * m;
    tau[i] = larfg(a, ci + i, m - i);
    if (i < n - 1) {
      const aii = a[ci + i]!;
      a[ci + i] = 1;
      larfLeft(a, ci + i, m - i, tau[i]!, A, i, i + 1, n - i - 1);
      a[ci + i] = aii;
    }
    // Update the norms of the remaining columns
    for (let j = i + 1; j < n; j++) {
      if (vn1[j] === 0) continue;
      let temp = 1 - (Math.abs(a[i + j * m]!) / vn1[j]!) ** 2;
      temp = Math.max(temp, 0);
      const temp2 = temp * (vn1[j]! / vn2[j]!) ** 2;
      if (temp2 <= tol3z) {
        if (i < m - 1) {
          vn1[j] = nrm2(a, j * m + i + 1, m - i - 1);
          vn2[j] = vn1[j]!;
        } else {
          vn1[j] = 0;
          vn2[j] = 0;
        }
      } else {
        vn1[j]! *= Math.sqrt(temp);
      }
    }
  }
  return { tau, pivot };
}

/**
 * Build a Householder reflector H = I - tau v v^T (dlarfg). The first element of x = d[s .. s+len-1] is alpha.
 * Overwrites x with (beta, elements 2.. of v) and returns tau
 */
export function larfg(d: Float64Array, s: number, len: number): number {
  if (len <= 1) return 0;
  let xnorm = nrm2(d, s + 1, len - 1);
  if (xnorm === 0) return 0;
  let alpha = d[s]!;
  let beta = -Math.sign(alpha || 1) * Math.hypot(alpha, xnorm);
  // When very small, rescale and recompute (as in dlarfg)
  const safmin = 2 ** -1022 / 2 ** -53;
  let knt = 0;
  if (Math.abs(beta) < safmin) {
    const rsafmn = 1 / safmin;
    do {
      knt++;
      for (let i = 1; i < len; i++) d[s + i]! *= rsafmn;
      beta *= rsafmn;
      alpha *= rsafmn;
    } while (Math.abs(beta) < safmin && knt < 20);
    xnorm = nrm2(d, s + 1, len - 1);
    beta = -Math.sign(alpha || 1) * Math.hypot(alpha, xnorm);
  }
  const tau = (beta - alpha) / beta;
  const scal = 1 / (alpha - beta);
  for (let i = 1; i < len; i++) d[s + i]! *= scal;
  for (let j = 0; j < knt; j++) beta *= safmin;
  d[s] = beta;
  return tau;
}

/**
 * Apply the reflector H = I - tau v v^T from the left to C (len rows from row r0, nc columns from column c0) (dlarf with SIDE = 'L').
 * v = d[vs .. vs+len-1]
 */
export function larfLeft(d: Float64Array, vs: number, len: number, tau: number, C: Mat, r0: number, c0: number, nc: number): void {
  if (tau === 0) return;
  const ldc = C.nrow;
  const c = C.data;
  for (let j = c0; j < c0 + nc; j++) {
    const o = r0 + j * ldc;
    let w = 0;
    for (let i = 0; i < len; i++) w += c[o + i]! * d[vs + i]!;
    w *= tau;
    for (let i = 0; i < len; i++) c[o + i]! -= d[vs + i]! * w;
  }
}

// ---- Functions using the decomposition ----

interface Decomp {
  a: Mat;
  qraux: number[];
  rank: number;
  pivot: number[];
  lapack: boolean;
}

function decomp(q: QR): Decomp {
  // Internally pivot is 1-based, as in R
  return { a: toMat(q.qr), qraux: q.qraux, rank: q.rank, pivot: q.pivot.map((v) => v + 1), lapack: q.useLapack };
}

/** Turn the right-hand side into a column-major matrix. Error if the row count does not match */
function rhs(d: Decomp, y: VectorOrMatrix): Mat {
  const b = toMatOrColumn(y);
  if (b.nrow !== d.a.nrow) throw new TypeError(`qr and y must have the same number of rows (${d.a.nrow} and ${b.nrow})`);
  return b;
}

function shapeLike(y: VectorOrMatrix, m: Mat): number[] | number[][] {
  return isMatrixInput(y) ? fromMat(m) : Array.from(m.data);
}

/**
 * Multiply b by Q^T (trans = true) or Q. The LINPACK style uses the first k transformations (k defaults to rank),
 * the LAPACK style uses min(rows, cols) transformations
 */
function applyQ(d: Decomp, b: Mat, trans: boolean, k = d.rank): void {
  const { a, qraux } = d;
  const n = a.nrow;
  if (d.lapack) {
    const kk = Math.min(n, a.ncol);
    const order = trans ? range(0, kk) : range(0, kk).reverse();
    for (const i of order) {
      const aii = a.data[i + i * n]!;
      a.data[i + i * n] = 1;
      larfLeft(a.data, i + i * n, n - i, qraux[i]!, b, i, 0, b.ncol);
      a.data[i + i * n] = aii;
    }
    return;
  }
  const ju = Math.min(k, n - 1);
  const order = trans ? range(0, ju) : range(0, ju).reverse();
  for (const j of order) {
    if (qraux[j] === 0) continue;
    const cj = j * n;
    const diag = a.data[cj + j]!;
    a.data[cj + j] = qraux[j]!;
    for (let c = 0; c < b.ncol; c++) {
      const o = c * n;
      let t = 0;
      for (let i = j; i < n; i++) t -= a.data[cj + i]! * b.data[o + i]!;
      t /= a.data[cj + j]!;
      for (let i = j; i < n; i++) b.data[o + i]! += t * a.data[cj + i]!;
    }
    a.data[cj + j] = diag;
  }
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);
}

/**
 * Computes `t(Q) %*% y` for a vector `y`. Equivalent to R's `qr.qty()`.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y A vector with as many elements as the decomposed matrix has rows.
 * @returns `t(Q) %*% y` as a vector.
 *
 * @example
 * ```ts
 * const q = qr([[3, 0], [4, 5]]);
 * qrQty(q, [3, 4]); // [-5, 0]
 * ```
 *
 * @category Linear algebra
 */
export function qrQty(q: QR, y: readonly number[] | Float64Array): number[];
/**
 * Computes `t(Q) %*% y` for a matrix `y`.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y A matrix (array of rows) with as many rows as the decomposed matrix.
 * @returns `t(Q) %*% y` as an array of rows.
 */
export function qrQty(q: QR, y: MatrixInput): number[][];
/**
 * Computes `t(Q) %*% y`.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y A vector or a matrix with as many rows as the decomposed matrix.
 * @returns A vector if `y` is a vector, otherwise an array of rows.
 */
export function qrQty(q: QR, y: VectorOrMatrix): number[] | number[][];
export function qrQty(q: QR, y: VectorOrMatrix): number[] | number[][] {
  const d = decomp(q);
  const b = rhs(d, y);
  applyQ(d, b, true);
  return shapeLike(y, b);
}

/**
 * Computes `Q %*% y` for a vector `y`. Equivalent to R's `qr.qy()`.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y A vector with as many elements as the decomposed matrix has rows.
 * @returns `Q %*% y` as a vector.
 *
 * @example
 * ```ts
 * const q = qr([[3, 0], [4, 5]]);
 * qrQy(q, [-5, 0]); // [3, 4]
 * ```
 *
 * @category Linear algebra
 */
export function qrQy(q: QR, y: readonly number[] | Float64Array): number[];
/**
 * Computes `Q %*% y` for a matrix `y`.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y A matrix (array of rows) with as many rows as the decomposed matrix.
 * @returns `Q %*% y` as an array of rows.
 */
export function qrQy(q: QR, y: MatrixInput): number[][];
/**
 * Computes `Q %*% y`.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y A vector or a matrix with as many rows as the decomposed matrix.
 * @returns A vector if `y` is a vector, otherwise an array of rows.
 */
export function qrQy(q: QR, y: VectorOrMatrix): number[] | number[][];
export function qrQy(q: QR, y: VectorOrMatrix): number[] | number[][] {
  const d = decomp(q);
  const b = rhs(d, y);
  applyQ(d, b, false);
  return shapeLike(y, b);
}

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
 *
 * @category Linear algebra
 */
export function qrCoef(q: QR, y: readonly number[] | Float64Array): number[];
/**
 * Least-squares coefficients for each column of a matrix response.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y The response matrix (array of rows), with as many rows as the decomposed matrix.
 * @returns The coefficients as an array of rows (one row per column of the decomposed matrix, one column per column of `y`).
 */
export function qrCoef(q: QR, y: MatrixInput): number[][];
/**
 * Least-squares coefficients.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y The response, a vector or a matrix.
 * @returns A vector if `y` is a vector, otherwise an array of rows.
 */
export function qrCoef(q: QR, y: VectorOrMatrix): number[] | number[][];
export function qrCoef(q: QR, y: VectorOrMatrix): number[] | number[][] {
  const d = decomp(q);
  const b = rhs(d, y);
  const p = d.a.ncol;
  const n = d.a.nrow;
  const k = d.lapack ? Math.min(n, p) : d.rank;
  applyQ(d, b, true);
  // Back substitution with the upper-left k x k of R (eliminating column by column, as LINPACK's dqrsl)
  for (let c = 0; c < b.ncol; c++) {
    const o = c * n;
    for (let j = k - 1; j >= 0; j--) {
      const rjj = d.a.data[j + j * n]!;
      if (rjj === 0) throw new Error("exact singularity in qrCoef");
      b.data[o + j]! /= rjj;
      const t = -b.data[o + j]!;
      for (let i = 0; i < j; i++) b.data[o + i]! += t * d.a.data[i + j * n]!;
    }
  }
  const coef = newMat(p, b.ncol);
  coef.data.fill(NaN);
  for (let c = 0; c < b.ncol; c++) {
    for (let j = 0; j < k; j++) coef.data[d.pivot[j]! - 1 + c * p] = b.data[j + c * n]!;
  }
  return shapeLike(y, coef);
}

function residOrFitted(q: QR, y: VectorOrMatrix, fitted: boolean, k?: number): number[] | number[][] {
  const d = decomp(q);
  if (d.lapack) throw new TypeError("not supported for a QR decomposition computed with lapack: true");
  const kk = k ?? d.rank;
  if (!Number.isInteger(kk) || kk < 0 || kk > d.rank) throw new RangeError(`invalid k (got ${kk})`);
  const b = rhs(d, y);
  const n = d.a.nrow;
  // When no transformation is used, match R's output (observed): with k = 0 the residuals and fitted values are y unchanged.
  // For a one-row matrix (rank 1) the residuals are 0 and the fitted values are y
  if (kk === 0) return shapeLike(y, b);
  if (n === 1) {
    if (!fitted) b.data.fill(0);
    return shapeLike(y, b);
  }
  applyQ(d, b, true, kk);
  for (let c = 0; c < b.ncol; c++) {
    if (fitted) b.data.fill(0, c * n + kk, (c + 1) * n);
    else b.data.fill(0, c * n, c * n + kk);
  }
  applyQ(d, b, false, kk);
  return shapeLike(y, b);
}

/**
 * Least-squares residuals for a vector response: `y` minus its projection onto the space spanned by the
 * first `rank` pivoted columns. Equivalent to R's `qr.resid()`.
 *
 * Not supported for a decomposition computed with `lapack: true` (throws).
 *
 * @param q A QR decomposition from {@link qr}.
 * @param y The response vector, with as many elements as the decomposed matrix has rows.
 * @returns The residual vector.
 *
 * @example
 * ```ts
 * const q = qr([[1, 1], [1, 2], [1, 3], [1, 4]]);
 * qrResid(q, [2.1, 3.9, 6.2, 7.8]); // [0.01, -0.13, 0.23, -0.11]
 * ```
 *
 * @category Linear algebra
 */
export function qrResid(q: QR, y: readonly number[] | Float64Array): number[];
/**
 * Least-squares residuals for each column of a matrix response.
 *
 * @param q A QR decomposition from {@link qr} (not `lapack: true`).
 * @param y The response matrix (array of rows), with as many rows as the decomposed matrix.
 * @returns The residuals as an array of rows.
 */
export function qrResid(q: QR, y: MatrixInput): number[][];
/**
 * Least-squares residuals.
 *
 * @param q A QR decomposition from {@link qr} (not `lapack: true`).
 * @param y The response, a vector or a matrix.
 * @returns A vector if `y` is a vector, otherwise an array of rows.
 */
export function qrResid(q: QR, y: VectorOrMatrix): number[] | number[][];
export function qrResid(q: QR, y: VectorOrMatrix): number[] | number[][] {
  return residOrFitted(q, y, false);
}

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
 *
 * @example
 * ```ts
 * const q = qr([[1, 1], [1, 2], [1, 3], [1, 4]]);
 * qrFitted(q, [2.1, 3.9, 6.2, 7.8]); // [2.09, 4.03, 5.97, 7.91]
 * ```
 *
 * @category Linear algebra
 */
export function qrFitted(q: QR, y: readonly number[] | Float64Array, options?: { k?: number }): number[];
/**
 * Least-squares fitted values for each column of a matrix response.
 *
 * @param q A QR decomposition from {@link qr} (not `lapack: true`).
 * @param y The response matrix (array of rows), with as many rows as the decomposed matrix.
 * @param options `k`: the number of pivoted columns to project onto (an integer from 0 to `rank`). Default: `q.rank`.
 * @returns The fitted values as an array of rows.
 */
export function qrFitted(q: QR, y: MatrixInput, options?: { k?: number }): number[][];
/**
 * Least-squares fitted values.
 *
 * @param q A QR decomposition from {@link qr} (not `lapack: true`).
 * @param y The response, a vector or a matrix.
 * @param options `k`: the number of pivoted columns to project onto (an integer from 0 to `rank`). Default: `q.rank`.
 * @returns A vector if `y` is a vector, otherwise an array of rows.
 */
export function qrFitted(q: QR, y: VectorOrMatrix, options?: { k?: number }): number[] | number[][];
export function qrFitted(q: QR, y: VectorOrMatrix, options: { k?: number } = {}): number[] | number[][] {
  return residOrFitted(q, y, true, options.k);
}

/**
 * Options for {@link qrQ}.
 *
 * @category Linear algebra
 */
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
 *
 * @example
 * ```ts
 * qrQ(qr([[3, 0], [4, 5]])); // [[-0.6, -0.8], [-0.8, 0.6]]
 * ```
 *
 * @category Linear algebra
 */
export function qrQ(q: QR, options: QRQOptions = {}): number[][] {
  const d = decomp(q);
  const n = d.a.nrow;
  const nc = options.complete ? n : Math.min(n, d.a.ncol);
  const dvec = options.dvec ?? new Array<number>(nc).fill(1);
  if (dvec.length !== nc) throw new RangeError(`dvec must have length ${nc}`);
  const b = newMat(n, nc);
  for (let j = 0; j < nc; j++) b.data[j + j * n] = dvec[j]!;
  applyQ(d, b, false);
  return fromMat(b);
}

/**
 * Recovers the upper triangular matrix `R` from a QR decomposition. Equivalent to R's `qr.R()`.
 *
 * The columns stay in pivoted order (as in R); use `q.pivot` to map them back.
 *
 * @param q A QR decomposition from {@link qr}.
 * @param options `complete`: return all `n` rows instead of the first `min(n, p)`. Default: `false`.
 * @returns `R` as an array of rows.
 *
 * @example
 * ```ts
 * qrR(qr([[3, 0], [4, 5]])); // [[-5, -4], [0, 3]]
 * ```
 *
 * @category Linear algebra
 */
export function qrR(q: QR, options: { complete?: boolean } = {}): number[][] {
  const a = toMat(q.qr);
  const nr = options.complete ? a.nrow : Math.min(a.nrow, a.ncol);
  const r = newMat(nr, a.ncol);
  for (let j = 0; j < a.ncol; j++) for (let i = 0; i <= Math.min(j, nr - 1); i++) r.data[i + j * nr] = a.data[i + j * a.nrow]!;
  return fromMat(r);
}

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
 *
 * @example
 * ```ts
 * qrX(qr([[3, 0], [4, 5]])); // [[3, 0], [4, 5]]
 * ```
 *
 * @category Linear algebra
 */
export function qrX(q: QR, options: { complete?: boolean; ncol?: number } = {}): number[][] {
  const d = decomp(q);
  const n = d.a.nrow;
  const p = d.a.ncol;
  const complete = options.complete ?? false;
  const ncol = options.ncol ?? (complete ? n : Math.min(n, p));
  if (!Number.isInteger(ncol) || ncol < 0) throw new RangeError(`invalid ncol (got ${ncol})`);
  const pivoted = d.pivot.some((v, j) => v !== j + 1);
  if (pivoted && ncol < p) throw new RangeError("ncol must be at least the number of columns because the decomposition is pivoted");
  // Multiply R (n x ncol; columns beyond p are identity columns) by Q
  const r = newMat(n, ncol);
  for (let j = 0; j < ncol; j++) {
    if (j < p) for (let i = 0; i <= Math.min(j, n - 1); i++) r.data[i + j * n] = d.a.data[i + j * n]!;
    else if (j < n) r.data[j + j * n] = 1;
  }
  applyQ(d, r, false);
  // Restore the original column order (only within the range of pivot)
  const m = Math.min(ncol, p);
  const out = newMat(n, ncol);
  out.data.set(r.data);
  for (let j = 0; j < m; j++) {
    const dest = d.pivot[j]! - 1;
    if (dest < m) out.data.set(r.data.subarray(j * n, (j + 1) * n), dest * n);
  }
  return fromMat(out);
}

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
 *
 * @example
 * ```ts
 * qrSolve([[2, 1], [1, 3]], [3, 5]); // [0.8, 1.4]
 * qrSolve([[1, 1], [1, 2], [1, 3]], [1, 2, 4]); // [-0.6667, 1.5]
 * ```
 *
 * @category Linear algebra
 */
export function qrSolve(a: MatrixInput | QR, b?: VectorOrMatrix, options: { tol?: number } = {}): number[] | number[][] {
  const q = Array.isArray(a) ? qr(a as MatrixInput, { tol: options.tol ?? 1e-7 }) : (a as QR);
  const n = q.qr.length;
  const p = n === 0 ? 0 : q.qr[0]!.length;
  if (q.rank !== Math.min(n, p)) throw new Error("singular matrix in qrSolve");
  if (b === undefined && n !== p) throw new TypeError("only square matrices can be inverted");
  const y = b ?? Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const res = qrCoef(q, y);
  const zero = (v: number) => (Number.isNaN(v) ? 0 : v);
  return isMatrixInput(y) ? (res as number[][]).map((r) => r.map(zero)) : (res as number[]).map(zero);
}
