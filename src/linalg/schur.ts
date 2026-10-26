// Real Schur decomposition (Matrix's Schur, which calls LAPACK's dgees without sorting). Written for rStats.js.
//
// Sources: the specification oracle/matfn-behaviour.md; the Hessenberg reduction and Francis double-shift QR iteration
// of src/linalg/eigen.ts (EISPACK's orthes and hqr2 via JAMA, public domain), stopped at the real Schur form; the
// standardisation of the 2 x 2 diagonal blocks is a port of LAPACK 3.12.0's SRC/dlanv2.f (modified BSD; see
// THIRD_PARTY_NOTICES.md).
// - x = Q T Q' with Q orthogonal and T upper quasi-triangular: 1 x 1 blocks for real eigenvalues, 2 x 2 blocks
//   [[a, b], [c, a]] with b c < 0 for complex pairs. Entries below the block diagonal are exactly 0
// - The eigenvalues are read off T's diagonal blocks in order (a complex pair as a ± sqrt(|b|) sqrt(|c|) i, positive
//   imaginary part first)
// - The decomposition is not unique; the order of the blocks and the signs of Q's columns may differ from LAPACK's
//   (no balancing, a different QR iteration)
// - NaN or Inf is an error, as in eigen

import { orthes, hqr2 } from "./eigen.js";
import { fromMat, newMat, requireSquare, toMat, type MatrixInput } from "./matrix.js";

/**
 * Result of {@link schur}: `x = Q T Q'`.
 *
 * @category Linear algebra
 */
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
 * // { T: [[0, -1], [1, 0]], Q: [[1, 0], [0, 1]], valuesRe: [0, 0], valuesIm: [1, -1] }
 * ```
 *
 * @category Linear algebra
 */
export function schur(x: MatrixInput): SchurResult {
  const A = toMat(x);
  requireSquare(A);
  const n = A.nrow;
  if (n === 0) throw new RangeError("the matrix has zero dimension");
  for (const v of A.data) if (!Number.isFinite(v)) throw new RangeError("the matrix contains NaN or infinite values");
  const H = { nrow: n, ncol: n, data: A.data.slice() };
  const V = newMat(n, n);
  const d = new Float64Array(n);
  const e = new Float64Array(n);
  orthes(H, V);
  hqr2(H, V, d, e, true);
  const h = H.data;
  const v = V.data;
  const at = (i: number, j: number) => i + j * n;
  // The 2 x 2 blocks are where hqr2 found complex pairs (e > 0 at the first position); everything else below the
  // diagonal is negligible (deflated subdiagonal elements) or left over from the reduction, and is set to 0
  const block = new Uint8Array(n);
  for (let j = 0; j + 1 < n; j++) if (e[j]! > 0 && e[j + 1]! < 0) block[j++] = 1;
  for (let j = 0; j < n; j++) for (let i = j + 1; i < n; i++) if (!(i === j + 1 && block[j])) h[at(i, j)] = 0;
  const valuesRe = new Array<number>(n);
  const valuesIm = new Array<number>(n);
  for (let j = 0; j < n; j++) {
    if (!block[j]) {
      valuesRe[j] = h[at(j, j)]!;
      valuesIm[j] = 0;
      continue;
    }
    const s = lanv2(h[at(j, j)]!, h[at(j, j + 1)]!, h[at(j + 1, j)]!, h[at(j + 1, j + 1)]!);
    h[at(j, j)] = s.a;
    h[at(j, j + 1)] = s.b;
    h[at(j + 1, j)] = s.c;
    h[at(j + 1, j + 1)] = s.d;
    // T <- R' T R and Q <- Q R with R = [[cs, -sn], [sn, cs]] acting on positions j, j + 1
    const { cs, sn } = s;
    for (let k = j + 2; k < n; k++) {
      const p = h[at(j, k)]!;
      const q = h[at(j + 1, k)]!;
      h[at(j, k)] = cs * p + sn * q;
      h[at(j + 1, k)] = cs * q - sn * p;
    }
    for (let k = 0; k < j; k++) {
      const p = h[at(k, j)]!;
      const q = h[at(k, j + 1)]!;
      h[at(k, j)] = cs * p + sn * q;
      h[at(k, j + 1)] = cs * q - sn * p;
    }
    for (let k = 0; k < n; k++) {
      const p = v[at(k, j)]!;
      const q = v[at(k, j + 1)]!;
      v[at(k, j)] = cs * p + sn * q;
      v[at(k, j + 1)] = cs * q - sn * p;
    }
    valuesRe[j] = s.rt1r;
    valuesIm[j] = s.rt1i;
    valuesRe[j + 1] = s.rt2r;
    valuesIm[j + 1] = s.rt2i;
    j++;
  }
  return { T: fromMat(H), Q: fromMat(V), valuesRe, valuesIm };
}

const sign = (a: number, b: number) => (b >= 0 && !Object.is(b, -0) ? Math.abs(a) : -Math.abs(a));

/**
 * Schur factorisation of a real 2 x 2 matrix in standard form (dlanv2):
 * [[a, b], [c, d]] = [[cs, -sn], [sn, cs]] [[aa, bb], [cc, dd]] [[cs, sn], [-sn, cs]], where either cc = 0 (real
 * eigenvalues aa, dd) or aa = dd and bb cc < 0 (complex pair). Returns the standardised entries, the rotation and the
 * eigenvalues
 */
export function lanv2(a: number, b: number, c: number, d: number) {
  const SAFMIN = 2 ** -1022;
  const EPS = Number.EPSILON; // DLAMCH('P')
  const MULTPL = 4;
  // DLAMCH('B')**INT(LOG(SAFMIN / EPS) / LOG(2) / 2)
  const SAFMN2 = 2 ** Math.trunc(Math.log(SAFMIN / EPS) / Math.log(2) / 2);
  const SAFMX2 = 1 / SAFMN2;
  let cs: number;
  let sn: number;
  if (c === 0) {
    cs = 1;
    sn = 0;
  } else if (b === 0) {
    // Swap rows and columns
    cs = 0;
    sn = 1;
    const temp = d;
    d = a;
    a = temp;
    b = -c;
    c = 0;
  } else if (a - d === 0 && sign(1, b) !== sign(1, c)) {
    cs = 1;
    sn = 0;
  } else {
    let temp = a - d;
    let p = 0.5 * temp;
    const bcmax = Math.max(Math.abs(b), Math.abs(c));
    const bcmis = Math.min(Math.abs(b), Math.abs(c)) * sign(1, b) * sign(1, c);
    let scale = Math.max(Math.abs(p), bcmax);
    let z = (p / scale) * p + (bcmax / scale) * bcmis;
    // If z is of the order of the machine accuracy, postpone the decision on the nature of the eigenvalues
    if (z >= MULTPL * EPS) {
      // Real eigenvalues: compute a and d
      z = p + sign(Math.sqrt(scale) * Math.sqrt(z), p);
      a = d + z;
      d = d - (bcmax / z) * bcmis;
      // Compute b and the rotation
      const tau = Math.hypot(c, z);
      cs = z / tau;
      sn = c / tau;
      b = b - c;
      c = 0;
    } else {
      // Complex eigenvalues, or real (almost) equal eigenvalues: make the diagonal elements equal
      let count = 0;
      let sigma = b + c;
      for (;;) {
        count++;
        scale = Math.max(Math.abs(temp), Math.abs(sigma));
        if (scale >= SAFMX2) {
          sigma *= SAFMN2;
          temp *= SAFMN2;
          if (count <= 20) continue;
        }
        if (scale <= SAFMN2) {
          sigma *= SAFMX2;
          temp *= SAFMX2;
          if (count <= 20) continue;
        }
        break;
      }
      p = 0.5 * temp;
      let tau = Math.hypot(sigma, temp);
      cs = Math.sqrt(0.5 * (1 + Math.abs(sigma) / tau));
      sn = -(p / (tau * cs)) * sign(1, sigma);
      // [aa bb; cc dd] = [a b; c d] [cs -sn; sn cs]
      const aa = a * cs + b * sn;
      const bb = -a * sn + b * cs;
      const cc = c * cs + d * sn;
      const dd = -c * sn + d * cs;
      // [a b; c d] = [cs sn; -sn cs] [aa bb; cc dd]
      a = aa * cs + cc * sn;
      b = bb * cs + dd * sn;
      c = -aa * sn + cc * cs;
      d = -bb * sn + dd * cs;
      temp = 0.5 * (a + d);
      a = temp;
      d = temp;
      if (c !== 0) {
        if (b !== 0) {
          if (sign(1, b) === sign(1, c)) {
            // Real eigenvalues: reduce to upper triangular form
            const sab = Math.sqrt(Math.abs(b));
            const sac = Math.sqrt(Math.abs(c));
            p = sign(sab * sac, c);
            tau = 1 / Math.sqrt(Math.abs(b + c));
            a = temp + p;
            d = temp - p;
            b = b - c;
            c = 0;
            const cs1 = sab * tau;
            const sn1 = sac * tau;
            temp = cs * cs1 - sn * sn1;
            sn = cs * sn1 + sn * cs1;
            cs = temp;
          }
        } else {
          b = -c;
          c = 0;
          temp = cs;
          cs = -sn;
          sn = temp;
        }
      }
    }
  }
  const rt1i = c === 0 ? 0 : Math.sqrt(Math.abs(b)) * Math.sqrt(Math.abs(c));
  return { a, b, c, d, cs, sn, rt1r: a, rt1i, rt2r: d, rt2i: -rt1i };
}
