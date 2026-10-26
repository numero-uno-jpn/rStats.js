// Balancing of a general real matrix: a port of LAPACK 3.12.0's SRC/dgebal.f and SRC/dgebak.f (modified BSD; see
// THIRD_PARTY_NOTICES.md). Used by expm (jobs "P" then "S", as two calls) and by the nonsymmetric eigen (job "B",
// as dgeev does).
// - dgebal's DNRM2 is computed with the classic scaled sum of squares rather than reference BLAS 3.12's algorithm
//   (it only decides between powers of 2 in the scaling; the results may differ in rare borderline cases)

import type { Mat } from "./matrix.js";

/** 2-norm of n values a[o], a[o + stride], ... (scaled sum of squares) */
function nrm2(a: Float64Array, o: number, count: number, stride: number): number {
  let sc = 0;
  let ssq = 1;
  for (let k = 0; k < count; k++) {
    const v = a[o + k * stride]!;
    if (v === 0) continue;
    const av = Math.abs(v);
    if (sc < av) {
      ssq = 1 + ssq * (sc / av) ** 2;
      sc = av;
    } else ssq += (av / sc) ** 2;
  }
  return sc * Math.sqrt(ssq);
}

/**
 * Balancing (dgebal) with job "P" (permute only), "S" (scale only) or "B" (permute, then scale rows and columns
 * ilo..ihi); A is overwritten. Indices are 0-based: scale[i] holds the index of the row and column interchanged
 * with i for i < ilo and i > ihi, and the scaling factor for ilo <= i <= ihi
 */
export function gebal(job: "P" | "S" | "B", A: Mat): { ilo: number; ihi: number; scale: Float64Array } {
  const n = A.nrow;
  const a = A.data;
  const at = (i: number, j: number) => i + j * n;
  const scale = new Float64Array(n);
  const swapCols = (i: number, j: number, rows: number) => {
    for (let r = 0; r < rows; r++) [a[at(r, i)], a[at(r, j)]] = [a[at(r, j)]!, a[at(r, i)]!];
  };
  const swapRows = (i: number, j: number, from: number) => {
    for (let c = from; c < n; c++) [a[at(i, c)], a[at(j, c)]] = [a[at(j, c)]!, a[at(i, c)]!];
  };
  // Permutation to isolate eigenvalues if possible
  let k = 0;
  let l = n - 1;
  if (job !== "S") {
    // Search for rows isolating an eigenvalue and push them down (the loop bounds are fixed at entry, as in Fortran)
    let noconv = true;
    while (noconv) {
      noconv = false;
      for (let i = l; i >= 0; i--) {
        let canswap = true;
        for (let j = 0; j <= l; j++) {
          if (i !== j && a[at(i, j)] !== 0) {
            canswap = false;
            break;
          }
        }
        if (canswap) {
          scale[l] = i;
          if (i !== l) {
            swapCols(i, l, l + 1);
            swapRows(i, l, k);
          }
          noconv = true;
          if (l === 0) return { ilo: 0, ihi: 0, scale };
          l--;
        }
      }
    }
    // Search for columns isolating an eigenvalue and push them left
    noconv = true;
    while (noconv) {
      noconv = false;
      for (let j = k, last = l; j <= last; j++) {
        let canswap = true;
        for (let i = k; i <= l; i++) {
          if (i !== j && a[at(i, j)] !== 0) {
            canswap = false;
            break;
          }
        }
        if (canswap) {
          scale[k] = j;
          if (j !== k) {
            swapCols(j, k, l + 1);
            swapRows(j, k, k);
          }
          noconv = true;
          k++;
        }
      }
    }
  }
  for (let i = k; i <= l; i++) scale[i] = 1;
  if (job === "P") return { ilo: k, ihi: l, scale };
  // Balance the submatrix in rows k to l by powers of 2 (iterative loop for norm reduction)
  const SCLFAC = 2;
  const FACTOR = 0.95;
  const sfmin1 = 2 ** -1022 / Number.EPSILON;
  const sfmax1 = 1 / sfmin1;
  const sfmin2 = sfmin1 * SCLFAC;
  const sfmax2 = 1 / sfmin2;
  let noconv = true;
  while (noconv) {
    noconv = false;
    for (let i = k; i <= l; i++) {
      let c = nrm2(a, at(k, i), l - k + 1, 1);
      let r = nrm2(a, at(i, k), l - k + 1, n);
      let ca = 0;
      for (let q = 0; q <= l; q++) ca = Math.max(ca, Math.abs(a[at(q, i)]!));
      let ra = 0;
      for (let q = k; q < n; q++) ra = Math.max(ra, Math.abs(a[at(i, q)]!));
      // Guard against zero c or r due to underflow
      if (c === 0 || r === 0) continue;
      if (Number.isNaN(c + ca + r + ra)) throw new RangeError("the matrix contains NaN or infinite values");
      let g = r / SCLFAC;
      let f = 1;
      const s = c + r;
      while (c < g && Math.max(f, c, ca) < sfmax2 && Math.min(r, g, ra) > sfmin2) {
        f *= SCLFAC;
        c *= SCLFAC;
        ca *= SCLFAC;
        r /= SCLFAC;
        g /= SCLFAC;
        ra /= SCLFAC;
      }
      g = c / SCLFAC;
      while (g >= r && Math.max(r, ra) < sfmax2 && Math.min(f, c, g, ca) > sfmin2) {
        f /= SCLFAC;
        c /= SCLFAC;
        g /= SCLFAC;
        ca /= SCLFAC;
        r *= SCLFAC;
        ra *= SCLFAC;
      }
      // Now balance
      if (c + r >= FACTOR * s) continue;
      if (f < 1 && scale[i]! < 1 && f * scale[i]! <= sfmin1) continue;
      if (f > 1 && scale[i]! > 1 && scale[i]! >= sfmax1 / f) continue;
      g = 1 / f;
      scale[i] = scale[i]! * f;
      noconv = true;
      for (let q = k; q < n; q++) a[at(i, q)] = a[at(i, q)]! * g;
      for (let q = 0; q <= l; q++) a[at(q, i)] = a[at(q, i)]! * f;
    }
  }
  return { ilo: k, ihi: l, scale };
}

/**
 * Back transformation of right eigenvectors (dgebak with job "B", side "R"): V holds the eigenvectors of the
 * balanced matrix as columns and is overwritten with those of the original matrix. Row i in ilo..ihi is multiplied
 * by its scaling factor, then the interchanges are undone in reverse order
 */
export function gebak(bal: { ilo: number; ihi: number; scale: Float64Array }, V: Mat): void {
  const { ilo, ihi, scale } = bal;
  const n = V.nrow;
  const m = V.ncol;
  const v = V.data;
  if (n === 0 || m === 0) return;
  if (ilo !== ihi) {
    for (let i = ilo; i <= ihi; i++) {
      const s = scale[i]!;
      for (let j = 0; j < m; j++) v[i + j * n] = v[i + j * n]! * s;
    }
  }
  const swap = (i: number) => {
    const k = scale[i]!;
    if (k === i) return;
    for (let j = 0; j < m; j++) [v[i + j * n], v[k + j * n]] = [v[k + j * n]!, v[i + j * n]!];
  };
  for (let i = ilo - 1; i >= 0; i--) swap(i);
  for (let i = ihi + 1; i < n; i++) swap(i);
}
