// Condition number (R's kappa) and generalised inverse (MASS's ginv).
//
// How kappa is computed follows R's documentation (?kappa) and observed output.
// - exact: true with norm "2" (the default): largest singular value / smallest positive singular value
// - exact: true with another norm: norm(z) × norm(solve(z))
// - Singular (smallest singular value is 0): Inf
// - exact: false, method: "direct": 1 / rcond(z) (LAPACK's estimate). If triangular, LINPACK's dtrco estimate
//   on the triangular part of z
// - exact: false, method: "qr" (the default): dtrco's estimate on R of the QR decomposition (transposed first if wide).
//   dtrco follows the dtrco of the LINPACK Users' Guide (Dongarra et al. 1979) (LINPACK is public domain)
// - For dtrco with norm: "I", the same-side triangle of the transposed matrix is used, matching R's output
//   (this looks at the opposite triangle of the original matrix; for R from a QR decomposition, only the diagonal)
// - triangular only has an effect with method: "direct" (from R's output)
// - Norms of the estimates (R's documented and observed behaviour): through a triangular factor (method "qr", or
//   "direct" with triangular), only the norm written exactly "I" gives the infinity-norm estimate and every other
//   norm ("2", "F", "M", "E", lower-case "i", ...) the 1-norm estimate (R warns for "2" and for norms other than
//   "1", "O" and "I"; the library does not report warnings). rcond (method "direct") accepts "1", "O" and "I" in
//   either case and rejects any other with R's message
// ginv is the Moore-Penrose generalised inverse via the SVD; singular values at most largest singular value × tol are treated as 0.

import { fromMat, newMat, toMat, transpose, type Mat, type MatrixInput } from "./matrix.js";
import { norm, type NormType } from "./norm.js";
import { qr, qrR } from "./qr.js";
import { rcond, solve } from "./solve.js";
import { svd } from "./svd.js";
import { maxOf, minOf } from "../internal/extremes.js";

/**
 * Options for {@link kappa}.
 *
 * @category Linear algebra
 */
export interface KappaOptions {
  /** Compute the condition number exactly instead of estimating it. Default: `false`. */
  exact?: boolean;
  /**
   * The norm. Default: `"2"` when `exact` is `true`, otherwise `"1"`. With `exact: true`, `"2"` uses the singular
   * values and other norms use `norm(z) * norm(solve(z))`. With `exact: false`, as in R: the estimates through a
   * triangular factor (`method: "qr"`, or `"direct"` with `triangular: true`) use the infinity norm only for `"I"`
   * written exactly so and the 1-norm for any other norm (R warns for norms other than `"1"`, `"O"` and `"I"`, and
   * for `"2"`); `method: "direct"` without `triangular` accepts `"1"`, `"O"` and `"I"` in either case and throws for
   * any other.
   */
  norm?: NormType;
  /**
   * Estimation method when `exact` is `false`: `"qr"` applies LINPACK's `dtrco` estimate to the `R` factor of
   * the QR decomposition (of the transpose if `z` is wide); `"direct"` uses `1 / rcond(z)`. Default: `"qr"`.
   */
  method?: "qr" | "direct";
  /** Treat `z` as triangular and use only its triangle given by `uplo`. Default: `false`. Has an effect only with `method: "direct"` (as in R). */
  triangular?: boolean;
  /** With `triangular: true`, use the upper (`"U"`) or lower (`"L"`) triangle. Default: `"U"`. */
  uplo?: "U" | "L";
}

/**
 * Condition number of a matrix, estimated or exact. Equivalent to R's `kappa()`.
 *
 * By default (as in R) this is the LINPACK estimate of the one-norm condition number, computed on the
 * triangular factor `R` of the QR decomposition. With `exact: true` and the default `norm: "2"`, it is the ratio
 * of the largest to the smallest singular value (computed with {@link svd}); `Infinity` if the matrix is singular.
 *
 * @param z A matrix (array of rows).
 * @param options See {@link KappaOptions}.
 * @returns The (estimated) condition number.
 *
 * @example
 * ```ts
 * kappa([[1, 2], [3, 4]]);                  // 17.85 (LINPACK estimate)
 * kappa([[1, 2], [3, 4]], { exact: true }); // 14.933034373659272
 * ```
 *
 * @category Linear algebra
 */
export function kappa(z: MatrixInput, options: KappaOptions = {}): number {
  if (options.exact) {
    // The default norm is "2" if exact, "1" if estimated
    const nrm = options.norm === undefined ? "2" : normalize(options.norm);
    if (nrm === "2") {
      const d = svd(z, { nu: 0, nv: 0 }).d;
      const min = minOf(d);
      return min === 0 ? Infinity : maxOf(d) / min;
    }
    return norm(z, { type: nrm }) * norm(solve(z), { type: nrm });
  }
  // Through a triangular factor, only "I" itself is the infinity norm; any other norm becomes the 1-norm (as in R)
  const triNorm = options.norm === "I" ? "I" : "O";
  if ((options.method ?? "qr") === "direct") {
    if (options.triangular) return 1 / triangularEstimate(toMat(z), (options.uplo ?? "U") === "U", triNorm);
    const t = options.norm ?? "O";
    const u = t.toUpperCase();
    if (u !== "1" && u !== "O" && u !== "I") throw new RangeError(`argument type[1]='${t}' must be one of '1','O', or 'I'`);
    return 1 / rcond(z, { norm: u === "I" ? "I" : "O" });
  }
  // If wide, transpose before the QR decomposition (from R's output)
  const zm = toMat(z);
  const zz = zm.nrow < zm.ncol ? fromMat(transpose(zm)) : z;
  return 1 / triangularEstimate(toMat(qrR(qr(zz))), true, triNorm);
}

/**
 * Reciprocal condition number of a triangular matrix by LINPACK's dtrco. With norm: "I", matching R's output,
 * the same-side (upper) triangle of the transposed matrix is used (i.e. the opposite triangle of the original matrix)
 */
function triangularEstimate(t: Mat, upper: boolean, nrm: "O" | "I"): number {
  return trco(nrm === "I" ? transpose(t) : t, upper);
}

function normalize(t: string): "O" | "I" | "F" | "M" | "2" {
  const u = t.toUpperCase();
  if (u === "1" || u === "O") return "O";
  if (u === "E") return "F";
  if (u === "I" || u === "F" || u === "M" || u === "2") return u;
  throw new RangeError(`invalid norm "${t}"`);
}

/**
 * Estimate of the reciprocal condition number (1-norm) of a triangular matrix (LINPACK's dtrco). Uses the upper triangle if upper, else the lower.
 * If the matrix is not square, the upper-left min(rows, cols) part is used
 */
export function trco(T: Mat, upper: boolean): number {
  const n = Math.min(T.nrow, T.ncol);
  const ld = T.nrow;
  const t = (i: number, j: number) => T.data[i + j * ld]!;
  const lower = !upper;
  // 1-norm of the triangular part
  let tnorm = 0;
  for (let j = 0; j < n; j++) {
    const [i1, len] = lower ? [j, n - j] : [0, j + 1];
    let s = 0;
    for (let i = i1; i < i1 + len; i++) s += Math.abs(t(i, j));
    tnorm = Math.max(tnorm, s);
  }
  // Solve trans(T) y = e (the ±1 entries of e are chosen to make y large)
  let ek = 1;
  const z = new Float64Array(n);
  const scal = (s: number) => {
    for (let i = 0; i < n; i++) z[i]! *= s;
  };
  for (let kk = 0; kk < n; kk++) {
    const k = lower ? n - 1 - kk : kk;
    const tkk = t(k, k);
    if (z[k] !== 0) ek = z[k]! > 0 ? -Math.abs(ek) : Math.abs(ek);
    if (Math.abs(ek - z[k]!) > Math.abs(tkk)) {
      const s = Math.abs(tkk) / Math.abs(ek - z[k]!);
      scal(s);
      ek *= s;
    }
    let wk = ek - z[k]!;
    let wkm = -ek - z[k]!;
    let s = Math.abs(wk);
    let sm = Math.abs(wkm);
    if (tkk !== 0) {
      wk /= tkk;
      wkm /= tkk;
    } else {
      wk = 1;
      wkm = 1;
    }
    if (kk !== n - 1) {
      const [j1, j2] = lower ? [0, k - 1] : [k + 1, n - 1];
      for (let j = j1; j <= j2; j++) {
        sm += Math.abs(z[j]! + wkm * t(k, j));
        z[j]! += wk * t(k, j);
        s += Math.abs(z[j]!);
      }
      if (s < sm) {
        const w = wkm - wk;
        wk = wkm;
        for (let j = j1; j <= j2; j++) z[j]! += w * t(k, j);
      }
    }
    z[k] = wk;
  }
  scal(1 / asum(z));
  let ynorm = 1;
  // Solve T z = y
  for (let kk = 0; kk < n; kk++) {
    const k = lower ? kk : n - 1 - kk;
    const tkk = t(k, k);
    if (Math.abs(z[k]!) > Math.abs(tkk)) {
      const s = Math.abs(tkk) / Math.abs(z[k]!);
      scal(s);
      ynorm *= s;
    }
    if (tkk !== 0) z[k]! /= tkk;
    else z[k] = 1;
    if (kk < n - 1) {
      const w = -z[k]!;
      if (lower) for (let i = k + 1; i < n; i++) z[i]! += w * t(i, k);
      else for (let i = 0; i < k; i++) z[i]! += w * t(i, k);
    }
  }
  const s = 1 / asum(z);
  scal(s);
  ynorm *= s;
  return tnorm !== 0 ? ynorm / tnorm : 0;
}

function asum(z: Float64Array): number {
  let s = 0;
  for (const v of z) s += Math.abs(v);
  return s;
}

/**
 * Moore-Penrose generalized inverse. Equivalent to `MASS::ginv()` in R.
 *
 * Computed from the singular value decomposition; singular values not greater than `tol` times the largest
 * singular value are treated as zero.
 *
 * @param x A matrix (array of rows).
 * @param options `tol`: relative tolerance for treating singular values as zero. Default: `sqrt(Number.EPSILON)`.
 * @returns The generalized inverse (`ncol` x `nrow`) as an array of rows.
 *
 * @example
 * ```ts
 * ginv([[1, 2], [3, 4]]); // [[-2, 1], [1.5, -0.5]]
 * ginv([[1, 1], [1, 1]]); // [[0.25, 0.25], [0.25, 0.25]]
 * ```
 *
 * @category Linear algebra
 */
export function ginv(x: MatrixInput, options: { tol?: number } = {}): number[][] {
  const tol = options.tol ?? Math.sqrt(Number.EPSILON);
  const a = toMat(x);
  const { d, u, v } = svd(x);
  const n = a.nrow;
  const p = a.ncol;
  const out: Mat = newMat(p, n);
  const cut = Math.max(tol * (d[0] ?? 0), 0);
  for (let k = 0; k < d.length; k++) {
    if (!(d[k]! > cut)) continue;
    const inv = 1 / d[k]!;
    for (let j = 0; j < n; j++) {
      const ujk = u![j]![k]! * inv;
      for (let i = 0; i < p; i++) out.data[i + j * p]! += v![i]![k]! * ujk;
    }
  }
  return fromMat(out);
}
