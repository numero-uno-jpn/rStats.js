// Estimability of predictions from a rank-deficient fit (R's predict.lm with rankdeficient = "warnif"). Written for
// rStats.js: a row x of the model matrix gives an estimable prediction when it is orthogonal to the null space of the
// fit's model matrix, whose basis follows from the pivoted QR decomposition: for each aliased column k (pivoted
// position >= rank), the vector with 1 at k and -R11^-1 R12[, k] on the first rank pivoted positions.

import type { QR } from "../linalg/qr.js";

/** The warning R gives when some rows are not estimable */
export const NON_ESTIMABLE_WARNING = 'prediction from rank-deficient fit; attr(*, "non-estim") has doubtful cases';

/**
 * 0-based indices of the rows of X (full rows, one value per coefficient) whose prediction is not estimable: |x · n|
 * above sqrt(eps) |x| |n| for a null-space vector n. Empty for a full-rank fit.
 */
export function nonEstimableRows(qr: QR | undefined, rank: number, X: readonly (readonly number[])[]): number[] {
  if (qr === undefined) return [];
  const p = qr.pivot.length;
  if (rank >= p) return [];
  const R = qr.qr;
  const piv = qr.pivot;
  const basis: number[][] = [];
  for (let k = rank; k < p; k++) {
    // z = -R11^-1 R12[, k] by back substitution; the vector in coefficient order
    const z = new Array<number>(rank).fill(0);
    for (let i = rank - 1; i >= 0; i--) {
      let s = -R[i]![k]!;
      for (let j = i + 1; j < rank; j++) s -= R[i]![j]! * z[j]!;
      z[i] = s / R[i]![i]!;
    }
    const v = new Array<number>(p).fill(0);
    for (let i = 0; i < rank; i++) v[piv[i]!] = z[i]!;
    v[piv[k]!] = 1;
    basis.push(v);
  }
  const tol = Math.sqrt(Number.EPSILON);
  const norm = (v: readonly number[]): number => Math.hypot(...v);
  const out: number[] = [];
  X.forEach((x, r) => {
    const nx = norm(x);
    if (basis.some((v) => Math.abs(x.reduce((s, xi, j) => s + xi * v[j]!, 0)) > tol * nx * norm(v))) out.push(r);
  });
  return out;
}
