// The profiled deviance of a linear mixed model (lme4's lmer) at a given θ: the penalised least-squares solution
// (β̂, û), the random effects b = Λ_θ û, the residual and penalty sums of squares, the log determinants of L_θ and
// R_X, and the REML criterion or the ML deviance. Nothing is optimised here.
//
// Written for rStats.js (no ported code) from oracle/lmer-behaviour.md (stage 1b, "The profiled deviance") and the
// penalised least squares (equations (13)-(19)) of D. Bates, M. Mächler, B. Bolker, S. Walker (2015), "Fitting
// Linear Mixed-Effects Models Using lme4", Journal of Statistical Software 67(1). Dense implementation: the
// cross-products Z'Z, Z'X, X'X, Z'y, X'y (which do not depend on θ) are formed once per structure; at each θ,
//   A = Λ_θ' Z'Z Λ_θ + I = L L'                     (Cholesky, L lower triangular, dense q × q)
//   C_X = L⁻¹ Λ_θ' Z'X,  W = L'⁻¹ C_X = A⁻¹ Λ_θ' Z'X  (triangular solves)
//   R_X' R_X = X'X − C_X' C_X = E'E + W'W          (Cholesky, p × p), with E = X − ZΛ_θ W
//   (û, β̂) from the normal equations of the penalised least squares, solved with L, C_X and R_X.
// Forming the normal equations squares the condition number, and X'X − C_X'C_X loses digits by cancellation, so the
// solutions are refined once with residuals computed from the data and the sparse Z (y − Xβ̂ − ZΛ_θ û, and E), which
// recovers the accuracy of an orthogonal decomposition (the corrected semi-normal equations), and R_X' R_X is formed
// as the sum of squares E'E + W'W. The fill-reducing permutation of the paper only affects sparsity, so it is not
// used.
//
// On request, the gradient of the criterion with respect to θ (for the fit, stage 1c), derived here from the
// formulas above. With ∂Λ the derivative of Λ_θ with respect to one element of θ (the entries (r, c) of Λ_θ that
// hold it), K = Λ_θ'Z'Z and the residual res = y − Xβ̂ − ZΛ_θ û:
//   ∂ prss = −2 res'Z ∂Λ û   (prss is a minimum over (β, u), so only its explicit dependence on θ counts),
//   ∂ log det A = 2 tr(A⁻¹ K ∂Λ) = 2 Σ_(r,c) (A⁻¹K)[c, r],
//   ∂ (log det A + log det R_X'R_X) = ∂ log det M, M = [A, Λ'Z'X; X'ZΛ, X'X], which adds −2 Σ_(r,c) (W S⁻¹ E'Z)[c, r]
//   (S = R_X'R_X; the blocks of M⁻¹ are A⁻¹ + W S⁻¹ W' and −W S⁻¹, and X'Z − W'K = E'Z).
// The criterion's derivative is then the log-determinant terms plus (n or n − p) ∂ prss / prss. A⁻¹ is formed densely
// from the Cholesky factor.

import { potf2, potri } from "../linalg/chol.js";
import type { Mat } from "../linalg/matrix.js";
import type { MixedModelStructure } from "./mixedStructure.js";

/** The penalised least-squares solution and the profiled deviance at a given θ. */
export interface ProfiledDeviance {
  /** The REML criterion (`reml` true) or the ML deviance −2 log L (`reml` false), profiled over β and σ. */
  deviance: number;
  /** The fixed effects β̂ that minimise the penalised residual sum of squares (one per column of X). */
  beta: number[];
  /** The spherical random effects û (one per column of Z). */
  u: number[];
  /** The random effects b = Λ_θ û. */
  b: number[];
  /** The residual sum of squares ‖y − Xβ̂ − ZΛ_θ û‖². */
  rss: number;
  /** The penalty ‖û‖². */
  ussq: number;
  /** The penalised residual sum of squares rss + ussq. */
  prss: number;
  /** log det(Λ_θ' Z'Z Λ_θ + I): twice the log determinant of its Cholesky factor L_θ. */
  logDetL: number;
  /** log det(X'X − X'ZΛ_θ (Λ_θ'Z'ZΛ_θ + I)⁻¹ Λ_θ'Z'X): twice the log determinant of R_X. */
  logDetRX: number;
  /** The derivative of `deviance` with respect to each element of θ (with `options.gradient`). */
  gradient?: number[];
  /** (R_X' R_X)⁻¹, p × p, array of rows (with `options.rxInverse`): the covariance of β̂ divided by σ². */
  rxInverse?: number[][];
}

/** What {@link profiledDeviance} computes beyond the deviance and the penalised least-squares solution. */
export interface ProfiledDevianceOptions {
  /** Also the gradient of the criterion with respect to θ (dense: O(q³)). */
  gradient?: boolean;
  /** Also (R_X' R_X)⁻¹. */
  rxInverse?: boolean;
}

/** The cross-products of a structure, which do not depend on θ */
interface CrossProducts {
  n: number;
  p: number;
  q: number;
  /** Z'Z, q × q, column-major (both triangles) */
  zz: Float64Array;
  /** Z'X, q × p, column-major */
  zx: Float64Array;
  /** X'X, p × p, column-major (both triangles) */
  xx: Float64Array;
  /** Z'y */
  zy: Float64Array;
  /** X'y */
  xy: Float64Array;
  /** The nonzero entries of Z by rows: the columns and the values of row i are at rowStart[i] .. rowStart[i + 1] − 1 */
  rowStart: Int32Array;
  rowCols: Int32Array;
  rowValues: Float64Array;
}

/** Steps of iterative refinement of the penalised least-squares solution */
const REFINEMENT_STEPS = 1;

const crossProductCache = new WeakMap<MixedModelStructure, CrossProducts>();

function crossProductsOf(s: MixedModelStructure): CrossProducts {
  const cached = crossProductCache.get(s);
  if (cached !== undefined) return cached;
  const n = s.y.length;
  const p = s.xColNames.length;
  const q = s.q;

  // Z by rows
  const counts = new Int32Array(n + 1);
  for (const col of s.z) for (const i of col.rows) counts[i + 1]!++;
  for (let i = 0; i < n; i++) counts[i + 1]! += counts[i]!;
  const rowStart = counts.slice();
  const fill = counts.slice(0, n);
  const nnz = rowStart[n]!;
  const rowCols = new Int32Array(nnz);
  const rowValues = new Float64Array(nnz);
  s.z.forEach((col, j) => {
    col.rows.forEach((i, k) => {
      const at = fill[i]!++;
      rowCols[at] = j;
      rowValues[at] = col.values[k]!;
    });
  });

  const zz = new Float64Array(q * q);
  const zx = new Float64Array(q * p);
  const xx = new Float64Array(p * p);
  const zy = new Float64Array(q);
  const xy = new Float64Array(p);
  for (let i = 0; i < n; i++) {
    const xi = s.x[i]!;
    const yi = s.y[i]!;
    for (let a = rowStart[i]!; a < rowStart[i + 1]!; a++) {
      const ja = rowCols[a]!;
      const va = rowValues[a]!;
      for (let c = rowStart[i]!; c < rowStart[i + 1]!; c++) zz[ja + rowCols[c]! * q]! += va * rowValues[c]!;
      for (let k = 0; k < p; k++) zx[ja + k * q]! += va * xi[k]!;
      zy[ja]! += va * yi;
    }
    for (let k = 0; k < p; k++) {
      for (let l = 0; l < p; l++) xx[k + l * p]! += xi[k]! * xi[l]!;
      xy[k]! += xi[k]! * yi;
    }
  }
  const result: CrossProducts = { n, p, q, zz, zx, xx, zy, xy, rowStart, rowCols, rowValues };
  crossProductCache.set(s, result);
  return result;
}

/** Λ_θ' M for a q × m column-major M (Λ_θ from the layout of the structure) */
function lambdaTransposeTimes(s: MixedModelStructure, theta: readonly number[], m: Float64Array, ncol: number): Float64Array {
  const q = s.q;
  const out = new Float64Array(q * ncol);
  // (Λ' M)[c, k] = Σ over the entries (r, c) of Λ: θ · M[r, k]
  for (const { row, col, theta: t } of s.lambda) {
    const v = theta[t]!;
    if (v === 0) continue;
    for (let k = 0; k < ncol; k++) out[col + k * q]! += v * m[row + k * q]!;
  }
  return out;
}

/** Solves L x = v in place, with L = R' and R the upper-triangular factor (column-major, k × k) */
function forwardSolve(r: Float64Array, k: number, v: Float64Array, offset = 0): void {
  for (let i = 0; i < k; i++) {
    const ci = i * k;
    let sum = v[offset + i]!;
    for (let j = 0; j < i; j++) sum -= r[j + ci]! * v[offset + j]!;
    v[offset + i] = sum / r[i + ci]!;
  }
}

/** Solves R x = v in place, R upper triangular (column-major, k × k) */
function backSolve(r: Float64Array, k: number, v: Float64Array): void {
  for (let i = k - 1; i >= 0; i--) {
    const xi = (v[i]! /= r[i + i * k]!);
    const ci = i * k;
    for (let j = 0; j < i; j++) v[j]! -= r[j + ci]! * xi;
  }
}

/** The full symmetric inverse of R'R from an upper-triangular factor R (column-major, k × k; R is not changed) */
function inverseFromFactor(r: Float64Array, k: number): Float64Array {
  const inv = r.slice();
  for (let j = 0; j < k; j++) for (let i = j + 1; i < k; i++) inv[i + j * k] = 0;
  potri({ nrow: k, ncol: k, data: inv });
  for (let j = 0; j < k; j++) for (let i = j + 1; i < k; i++) inv[i + j * k] = inv[j + i * k]!;
  return inv;
}

/** Twice the sum of the logs of the diagonal of a k × k factor */
function logDetOfFactor(r: Float64Array, k: number): number {
  let sum = 0;
  for (let i = 0; i < k; i++) sum += Math.log(r[i + i * k]!);
  return 2 * sum;
}

/**
 * The profiled deviance of a linear mixed model at `theta`, with the penalised least-squares solution
 * (oracle/lmer-behaviour.md, stage 1b). Internal: not exported from the package.
 *
 * @param structure The structure from {@link mixedModelStructure}.
 * @param theta The covariance parameters (finite, of the length of `structure.theta`; values below the lower bounds
 *   are accepted).
 * @param reml Whether to return the REML criterion (true) or the ML deviance (false).
 * @param options What to compute besides: the gradient with respect to θ, (R_X' R_X)⁻¹.
 */
export function profiledDeviance(
  structure: MixedModelStructure,
  theta: readonly number[],
  reml: boolean,
  options: ProfiledDevianceOptions = {},
): ProfiledDeviance {
  if (theta.length !== structure.theta.length) {
    throw new RangeError(`theta must have length ${structure.theta.length}, not ${theta.length}`);
  }
  if (theta.some((t) => !Number.isFinite(t))) throw new RangeError("theta must be finite");
  const cp = crossProductsOf(structure);
  const { n, p, q } = cp;

  // A = Λ' (Z'Z Λ) + I, formed as Λ' (Λ' Z'Z)' since Z'Z is symmetric
  const lzz = lambdaTransposeTimes(structure, theta, cp.zz, q);
  const lzzT = new Float64Array(q * q);
  for (let j = 0; j < q; j++) for (let i = 0; i < q; i++) lzzT[i + j * q] = lzz[j + i * q]!;
  const a = lambdaTransposeTimes(structure, theta, lzzT, q);
  for (let i = 0; i < q; i++) a[i + i * q]! += 1;
  const factorL: Mat = { nrow: q, ncol: q, data: a };
  if (potf2(factorL) > 0) throw new Error("the penalised least-squares matrix is not positive definite");
  const r = factorL.data; // upper triangle: R with A = R'R, so L = R'

  // Λ w, Z v (from the sparse Z) and Λ'Z' v
  const lambdaTimes = (w: Float64Array): Float64Array => {
    const out = new Float64Array(q);
    for (const { row, col, theta: t } of structure.lambda) out[row]! += theta[t]! * w[col]!;
    return out;
  };
  const zTimes = (v: Float64Array): Float64Array => {
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let c = cp.rowStart[i]!; c < cp.rowStart[i + 1]!; c++) sum += cp.rowValues[c]! * v[cp.rowCols[c]!]!;
      out[i] = sum;
    }
    return out;
  };
  const lambdaTransposeZTransposeTimes = (v: Float64Array): Float64Array => {
    const zv = new Float64Array(q);
    for (let i = 0; i < n; i++) {
      const vi = v[i]!;
      for (let c = cp.rowStart[i]!; c < cp.rowStart[i + 1]!; c++) zv[cp.rowCols[c]!]! += cp.rowValues[c]! * vi;
    }
    return lambdaTransposeTimes(structure, theta, zv, 1);
  };
  /** Solves A w = v in place */
  const solveA = (v: Float64Array): void => {
    forwardSolve(r, q, v);
    backSolve(r, q, v);
  };

  // C_X = L⁻¹ Λ' Z'X
  const cx = lambdaTransposeTimes(structure, theta, cp.zx, p);
  for (let k = 0; k < p; k++) forwardSolve(r, q, cx, k * q);

  // R_X' R_X = X'X − C_X' C_X, computed without the cancellation of that difference: with W = A⁻¹ Λ'Z'X (= L'⁻¹ C_X)
  // and the residual E = X − ZΛW, it is E'E + W'W (as Λ'Z'E = W). W is refined once with E computed from the data.
  const xResiduals: Float64Array[] = [];
  const ws: Float64Array[] = [];
  for (let k = 0; k < p; k++) {
    const w = cx.slice(k * q, (k + 1) * q);
    backSolve(r, q, w);
    const xk = Float64Array.from(structure.x, (row) => row[k]!);
    const residualOf = (): Float64Array => {
      const fitted = zTimes(lambdaTimes(w));
      return xk.map((v, i) => v - fitted[i]!);
    };
    let e = residualOf();
    for (let step = 0; step < REFINEMENT_STEPS; step++) {
      const g = lambdaTransposeZTransposeTimes(e);
      for (let i = 0; i < q; i++) g[i]! -= w[i]!;
      solveA(g);
      for (let i = 0; i < q; i++) w[i]! += g[i]!;
      e = residualOf();
    }
    xResiduals.push(e);
    ws.push(w);
  }
  const rx = new Float64Array(p * p);
  for (let k = 0; k < p; k++) {
    for (let l = k; l < p; l++) {
      let sum = 0;
      const ek = xResiduals[k]!;
      const el = xResiduals[l]!;
      for (let i = 0; i < n; i++) sum += ek[i]! * el[i]!;
      const wk = ws[k]!;
      const wl = ws[l]!;
      for (let i = 0; i < q; i++) sum += wk[i]! * wl[i]!;
      rx[k + l * p] = sum;
      rx[l + k * p] = sum;
    }
  }
  const factorRX: Mat = { nrow: p, ncol: p, data: rx };
  if (p > 0 && potf2(factorRX) > 0) throw new Error("the fixed-effects matrix of the penalised least squares is not positive definite");

  // The normal equations of the penalised least squares, [A, Λ'Z'X; X'ZΛ, X'X] (u, β) = (gu, gβ), solved with the
  // two factors: c = L⁻¹ gu, R_X' R_X β = gβ − C_X' c, L' u = c − C_X β. Overwrites gu with u and gβ with β.
  const solveNormal = (gu: Float64Array, gb: Float64Array): void => {
    forwardSolve(r, q, gu);
    for (let k = 0; k < p; k++) {
      let sum = gb[k]!;
      for (let i = 0; i < q; i++) sum -= cx[i + k * q]! * gu[i]!;
      gb[k] = sum;
    }
    forwardSolve(rx, p, gb);
    backSolve(rx, p, gb);
    for (let k = 0; k < p; k++) {
      const bk = gb[k]!;
      for (let i = 0; i < q; i++) gu[i]! -= cx[i + k * q]! * bk;
    }
    backSolve(r, q, gu);
  };

  // the residual y − Xβ − ZΛu, from X and the sparse Z (not from the cross-products)
  const residual = (beta: Float64Array, bv: Float64Array): Float64Array => {
    const zb = zTimes(bv);
    const res = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const xi = structure.x[i]!;
      let fitted = zb[i]!;
      for (let k = 0; k < p; k++) fitted += xi[k]! * beta[k]!;
      res[i] = structure.y[i]! - fitted;
    }
    return res;
  };

  // the solution from the cross-products, then refined with the residual computed from the data (the corrected
  // semi-normal equations): the normal equations squared the condition number, the refinement recovers the accuracy
  // of an orthogonal decomposition
  const uv = lambdaTransposeTimes(structure, theta, cp.zy, 1);
  const betav = Float64Array.from(cp.xy);
  solveNormal(uv, betav);
  let bv = lambdaTimes(uv);
  let res = residual(betav, bv);
  for (let step = 0; step < REFINEMENT_STEPS; step++) {
    // the gradient of the penalised residual sum of squares: (Λ'Z'res − u, X'res)
    const du = lambdaTransposeZTransposeTimes(res);
    for (let i = 0; i < q; i++) du[i]! -= uv[i]!;
    const db = new Float64Array(p);
    for (let i = 0; i < n; i++) {
      const xi = structure.x[i]!;
      const ri = res[i]!;
      for (let k = 0; k < p; k++) db[k]! += xi[k]! * ri;
    }
    solveNormal(du, db);
    for (let i = 0; i < q; i++) uv[i]! += du[i]!;
    for (let k = 0; k < p; k++) betav[k]! += db[k]!;
    bv = lambdaTimes(uv);
    res = residual(betav, bv);
  }
  const beta = Array.from(betav);
  const u = Array.from(uv);
  const b = Array.from(bv);

  let rss = 0;
  for (const e of res) rss += e * e;
  let ussq = 0;
  for (const v of u) ussq += v * v;
  const prss = rss + ussq;

  const logDetL = logDetOfFactor(r, q);
  const logDetRX = logDetOfFactor(rx, p);
  const df = reml ? n - p : n;
  const deviance = (reml ? logDetL + logDetRX : logDetL) + df * (1 + Math.log((2 * Math.PI * prss) / df));
  const out: ProfiledDeviance = { deviance, beta, u, b, rss, ussq, prss, logDetL, logDetRX };

  const sInverse = options.gradient === true || options.rxInverse === true ? inverseFromFactor(rx, p) : undefined;
  if (options.rxInverse === true) {
    out.rxInverse = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => sInverse![i + j * p]!));
  }
  if (options.gradient === true) {
    const aInverse = inverseFromFactor(r, q);
    // Z' res
    const zRes = new Float64Array(q);
    for (let i = 0; i < n; i++) {
      const ri = res[i]!;
      for (let c = cp.rowStart[i]!; c < cp.rowStart[i + 1]!; c++) zRes[cp.rowCols[c]!]! += cp.rowValues[c]! * ri;
    }
    // REML: V = W S⁻¹ (q × p) and E'Z (p × q), both column-major
    let v: Float64Array | undefined;
    let ez: Float64Array | undefined;
    if (reml && p > 0) {
      v = new Float64Array(q * p);
      for (let l = 0; l < p; l++) {
        for (let k = 0; k < p; k++) {
          const skl = sInverse![k + l * p]!;
          const wk = ws[k]!;
          for (let c = 0; c < q; c++) v[c + l * q]! += wk[c]! * skl;
        }
      }
      ez = new Float64Array(p * q);
      for (let i = 0; i < n; i++) {
        for (let c = cp.rowStart[i]!; c < cp.rowStart[i + 1]!; c++) {
          const zr = cp.rowCols[c]!;
          const val = cp.rowValues[c]!;
          for (let l = 0; l < p; l++) ez[l + zr * p]! += xResiduals[l]![i]! * val;
        }
      }
    }
    // lzz holds K = Λ'Z'Z (column-major): K[k, r] = lzz[k + r q]
    const prssFactor = (2 * df) / prss;
    const gradient = new Array<number>(theta.length).fill(0);
    for (const { row: rr, col: c, theta: t } of structure.lambda) {
      let tr = 0;
      const ac = c * q;
      const kr = rr * q;
      for (let k = 0; k < q; k++) tr += aInverse[k + ac]! * lzz[k + kr]!;
      if (v !== undefined && ez !== undefined) for (let l = 0; l < p; l++) tr -= v[c + l * q]! * ez[l + rr * p]!;
      gradient[t]! += 2 * tr - prssFactor * zRes[rr]! * uv[c]!;
    }
    out.gradient = gradient;
  }
  return out;
}
