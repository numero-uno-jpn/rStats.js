// Singular value decomposition (R's svd).
//
// Method of Golub & Reinsch (1970, Numer. Math. 14, 403-420): upper-bidiagonalise by Householder transformations,
// then diagonalise by the implicit QR method with Wilkinson shifts (same procedure as EISPACK's svd; EISPACK is public domain).
// R uses LAPACK's dgesdd (divide and conquer), so singular values agree to rounding error, while singular vectors
// may differ in sign (orientation for repeated singular values).
// Argument checks and result shapes follow observed R output.
// - nu and nv default to min(rows, cols). Requests above the row or column count are truncated
// - Singular values in decreasing order. NaN or Inf is an error
// - Singular vectors beyond min(rows, cols) (the remaining columns of U or V) are a basis of the orthogonal complement and do not match R

import { fromMat, newMat, toMat, transpose, type Mat, type MatrixInput } from "./matrix.js";
import { larfg, larfLeft } from "./qr.js";

/**
 * Options for {@link svd}.
 *
 * @category Linear algebra
 */
export interface SvdOptions {
  /** Number of left singular vectors to compute. Default: `min(nrow, ncol)`. Values above the number of rows are reduced to it. */
  nu?: number;
  /** Number of right singular vectors to compute. Default: `min(nrow, ncol)`. Values above the number of columns are reduced to it. */
  nv?: number;
}

/**
 * Result of {@link svd}: `x = u %*% diag(d) %*% t(v)`.
 *
 * @category Linear algebra
 */
export interface SvdResult {
  /** The singular values, in decreasing order. */
  d: number[];
  /** The left singular vectors as columns (`nrow` x `nu`, array of rows). Omitted when `nu` is 0. */
  u?: number[][];
  /** The right singular vectors as columns (`ncol` x `nv`, array of rows). Omitted when `nv` is 0. */
  v?: number[][];
}

/**
 * Singular value decomposition. Equivalent to R's `svd()`.
 *
 * Uses the Golub-Reinsch algorithm, while R uses LAPACK's `dgesdd`. Singular values agree with R up to
 * rounding, but the signs of singular vectors may differ from R (both are correct); for repeated singular
 * values the vectors may span the same subspace with a different basis. Singular vectors beyond
 * `min(nrow, ncol)` are a basis of the orthogonal complement and do not match R. Throws on `NaN` or infinite values.
 *
 * @param x A matrix (array of rows).
 * @param options See {@link SvdOptions}.
 * @returns The singular values and vectors. See {@link SvdResult}.
 *
 * @example
 * ```ts
 * svd([[3, 0], [0, 4]]);
 * // { d: [4, 3], u: [[0, 1], [1, 0]], v: [[0, 1], [1, 0]] }  (signs of u and v may differ from R)
 * ```
 *
 * @category Linear algebra
 */
export function svd(x: MatrixInput, options: SvdOptions = {}): SvdResult {
  const a = toMat(x);
  for (const v of a.data) if (!Number.isFinite(v)) throw new RangeError("the matrix contains NaN or infinite values");
  const k = Math.min(a.nrow, a.ncol);
  const nu = Math.min(options.nu ?? k, a.nrow);
  const nv = Math.min(options.nv ?? k, a.ncol);
  for (const [name, v] of [["nu", nu], ["nv", nv]] as const) {
    if (!Number.isInteger(v) || v < 0) throw new RangeError(`${name} must be a non-negative integer`);
  }
  // If wide, transpose and swap U and V
  const wide = a.nrow < a.ncol;
  const r = decompose(wide ? transpose(a) : a, wide ? nv : nu, wide ? nu : nv);
  const out: SvdResult = { d: Array.from(r.d) };
  const [U, V] = wide ? [r.v, r.u] : [r.u, r.v];
  if (nu > 0) out.u = fromMat(firstColumns(U!, nu));
  if (nv > 0) out.v = fromMat(firstColumns(V!, nv));
  return out;
}

/** Singular values only (decreasing) */
export function svdValues(a: Mat): Float64Array {
  return decompose(a.nrow < a.ncol ? transpose(a) : a, 0, 0).d;
}

function firstColumns(m: Mat, k: number): Mat {
  return { nrow: m.nrow, ncol: k, data: m.data.slice(0, m.nrow * k) };
}

/**
 * SVD of a tall (n >= p) matrix. Depending on nu (0, <= p, or > p) and nv (0 or <= p),
 * builds U (n x max(nu, p)) and V (p x p)
 */
function decompose(A: Mat, nu: number, nv: number): { d: Float64Array; u?: Mat; v?: Mat } {
  const n = A.nrow;
  const p = A.ncol;
  const d = new Float64Array(p);
  if (p === 0) return { d, u: newMat(n, n), v: newMat(0, 0) };
  const a = { nrow: n, ncol: p, data: A.data.slice() };
  const e = new Float64Array(p); // e[i] is the superdiagonal between d[i-1] and d[i] (e[0] = 0)
  const tauL = new Float64Array(p);
  const tauR = new Float64Array(p);
  // Upper bidiagonalisation: from the left zero out below column i, from the right zero out row i to the right of column i + 1
  for (let i = 0; i < p; i++) {
    const ci = i * n;
    tauL[i] = larfg(a.data, ci + i, n - i);
    d[i] = a.data[ci + i]!;
    if (i < p - 1) {
      a.data[ci + i] = 1;
      larfLeft(a.data, ci + i, n - i, tauL[i]!, a, i, i + 1, p - i - 1);
      a.data[ci + i] = d[i]!;
    }
    if (i < p - 1) {
      // Treat columns (i+1 .. p-1) of row i as one vector (stride n, since column-major)
      const row = new Float64Array(p - i - 1);
      for (let j = 0; j < row.length; j++) row[j] = a.data[i + (i + 1 + j) * n]!;
      tauR[i] = larfg(row, 0, row.length);
      e[i + 1] = row[0]!;
      row[0] = 1;
      // Apply the reflector from the right to rows (i+1 .. n-1): A := A (I - tau w w^T)
      const t = tauR[i]!;
      if (t !== 0) {
        for (let r = i + 1; r < n; r++) {
          let s = 0;
          for (let j = 0; j < row.length; j++) s += a.data[r + (i + 1 + j) * n]! * row[j]!;
          s *= t;
          for (let j = 0; j < row.length; j++) a.data[r + (i + 1 + j) * n]! -= s * row[j]!;
        }
      }
      row[0] = e[i + 1]!;
      for (let j = 0; j < row.length; j++) a.data[i + (i + 1 + j) * n] = row[j]!;
    }
  }
  // Build U = H_0 ... H_{p-1} by applying to the columns of the (n x ncu) identity
  const ncu = nu === 0 ? 0 : Math.max(nu, p);
  let u: Mat | undefined;
  if (ncu > 0) {
    u = newMat(n, ncu);
    for (let j = 0; j < ncu; j++) u.data[j + j * n] = 1;
    for (let i = p - 1; i >= 0; i--) {
      const ci = i * n;
      const di = a.data[ci + i]!;
      a.data[ci + i] = 1;
      larfLeft(a.data, ci + i, n - i, tauL[i]!, u, i, 0, ncu);
      a.data[ci + i] = di;
    }
  }
  let v: Mat | undefined;
  if (nv > 0) {
    v = newMat(p, p);
    for (let j = 0; j < p; j++) v.data[j + j * p] = 1;
    // V = G_0 ... G_{p-2}. The reflector vector of G_i is row i, columns (i+1 ..) (leading element 1)
    const w = new Float64Array(p);
    for (let i = p - 2; i >= 0; i--) {
      const len = p - i - 1;
      w[0] = 1;
      for (let j = 1; j < len; j++) w[j] = a.data[i + (i + 1 + j) * n]!;
      larfLeft(w, 0, len, tauR[i]!, v, i + 1, 0, p);
    }
  }
  diagonalize(d, e, u, v);
  // Sort in decreasing order (columns of U and V too)
  const order = Array.from({ length: p }, (_, i) => i).sort((i, j) => d[j]! - d[i]! || i - j);
  const ds = Float64Array.from(order, (i) => d[i]!);
  const permute = (m: Mat | undefined, cols: number) => {
    if (m === undefined) return undefined;
    const out = { nrow: m.nrow, ncol: m.ncol, data: m.data.slice() };
    for (let j = 0; j < cols; j++) out.data.set(m.data.subarray(order[j]! * m.nrow, (order[j]! + 1) * m.nrow), j * m.nrow);
    return out;
  };
  const out: { d: Float64Array; u?: Mat; v?: Mat } = { d: ds };
  if (u) out.u = permute(u, p)!;
  if (v) out.v = permute(v, p)!;
  return out;
}

/**
 * Diagonalise a bidiagonal matrix (diagonal d, superdiagonal e) by the implicit QR method (Golub & Reinsch).
 * Rotations are applied to the columns of u and v. Singular values are made non-negative
 */
function diagonalize(d: Float64Array, e: Float64Array, u: Mat | undefined, v: Mat | undefined): void {
  const p = d.length;
  const eps = Number.EPSILON;
  let anorm = 0;
  for (let i = 0; i < p; i++) anorm = Math.max(anorm, Math.abs(d[i]!) + Math.abs(e[i]!));
  const rotU = (i: number, j: number, c: number, s: number) => {
    if (!u) return;
    const n = u.nrow;
    for (let r = 0; r < n; r++) {
      const y = u.data[r + i * n]!;
      const z = u.data[r + j * n]!;
      u.data[r + i * n] = y * c + z * s;
      u.data[r + j * n] = z * c - y * s;
    }
  };
  const rotV = (i: number, j: number, c: number, s: number) => {
    if (!v) return;
    for (let r = 0; r < p; r++) {
      const x = v.data[r + i * p]!;
      const z = v.data[r + j * p]!;
      v.data[r + i * p] = x * c + z * s;
      v.data[r + j * p] = z * c - x * s;
    }
  };
  for (let k = p - 1; k >= 0; k--) {
    for (let its = 0; ; its++) {
      // Find a split position l (e[l] negligible, or d[l-1] negligible)
      let l = k;
      let cancel = true;
      for (; l >= 0; l--) {
        if (l === 0 || Math.abs(e[l]!) <= eps * anorm) {
          cancel = false;
          break;
        }
        if (Math.abs(d[l - 1]!) <= eps * anorm) break;
      }
      if (cancel) {
        // d[l-1] is near 0, so eliminate e[l] .. by rotations
        const nm = l - 1;
        let c = 0;
        let s = 1;
        for (let i = l; i <= k; i++) {
          const f = s * e[i]!;
          e[i] = c * e[i]!;
          if (Math.abs(f) <= eps * anorm) break;
          const g = d[i]!;
          const h = Math.hypot(f, g);
          d[i] = h;
          c = g / h;
          s = -f / h;
          rotU(nm, i, c, s);
        }
      }
      const z = d[k]!;
      if (l === k) {
        if (z < 0) {
          d[k] = -z;
          if (v) for (let r = 0; r < p; r++) v.data[r + k * p] = -v.data[r + k * p]!;
        }
        break;
      }
      if (its >= 75) throw new Error("the singular value decomposition did not converge");
      // Choose the Wilkinson shift from the lower-right 2 x 2
      let x = d[l]!;
      const nm = k - 1;
      let y = d[nm]!;
      let g = e[nm]!;
      let h = e[k]!;
      let f = ((y - z) * (y + z) + (g - h) * (g + h)) / (2 * h * y);
      g = Math.hypot(f, 1);
      f = ((x - z) * (x + z) + h * (y / (f + (f >= 0 ? Math.abs(g) : -Math.abs(g))) - h)) / x;
      // Chase the bulge with rotations
      let c = 1;
      let s = 1;
      for (let j = l; j <= nm; j++) {
        const i = j + 1;
        g = e[i]!;
        y = d[i]!;
        h = s * g;
        g = c * g;
        let zz = Math.hypot(f, h);
        e[j] = zz;
        c = f / zz;
        s = h / zz;
        f = x * c + g * s;
        g = g * c - x * s;
        h = y * s;
        y *= c;
        rotV(j, i, c, s);
        zz = Math.hypot(f, h);
        d[j] = zz;
        if (zz !== 0) {
          c = f / zz;
          s = h / zz;
        }
        f = c * g + s * y;
        x = c * y - s * g;
        rotU(j, i, c, s);
      }
      e[l] = 0;
      e[k] = f;
      d[k] = x;
    }
  }
}
