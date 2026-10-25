// Least squares in double-double arithmetic for the fits from a formula and their analyses of variance.
//
// Written for rStats.js (no ported code): a textbook Householder QR decomposition (Golub and Van Loan, Matrix
// Computations, 5.2) of columns already known to be linearly independent (the columns kept, in pivoted order, by the
// double-precision decomposition of src/linalg/qr.ts, which decides the rank and the aliased columns exactly as lm
// does), carried out in double-double (src/special/dd.ts). The reflections use LINPACK's sign convention (the
// diagonal of R has the opposite sign of the column's leading element), so the effects Q'y have the signs of R's.
// Sums of squares that are small differences of large numbers (data with a large mean) are then accurate to about
// 1e-30 relative to the data's sum of squares instead of 1e-16.

import { ddAdd, ddDiv, ddMul, ddSub, twoProd, twoSum, type DD } from "../special/dd.js";

const ZERO: DD = [0, 0];

export function ddSqrt(a: DD): DD {
  if (!(a[0] > 0)) return [Math.sqrt(a[0]), 0];
  const s = Math.sqrt(a[0]);
  const e = ddSub(a, twoProd(s, s));
  return twoSum(s, e[0] / (2 * s));
}

/** Square roots of the weights in double-double (1 without weights) */
export function ddSqrtWeights(w: readonly number[] | undefined, n: number): DD[] {
  return Array.from({ length: n }, (_, i) => (w === undefined ? ([1, 0] as DD) : ddSqrt([w[i]!, 0])));
}

/** Result of {@link ddLeastSquares}. */
export interface DDLeastSquares {
  /** Q'y, one element per row: the effects of the columns, then the residual coordinates. */
  qty: DD[];
  /** Coefficients of the columns, in the order given. */
  coef: DD[];
}

/**
 * Least squares of y on the given columns (all assumed linearly independent; rows already scaled by the square roots
 * of the weights).
 *
 * @param cols The columns (each with one entry per row).
 * @param y The response.
 */
export function ddLeastSquares(cols: readonly (readonly DD[])[], y: readonly DD[]): DDLeastSquares {
  const n = y.length;
  const p = Math.min(cols.length, n);
  const a = cols.map((c) => c.slice());
  const b = y.slice();
  const diag: DD[] = [];
  for (let k = 0; k < p; k++) {
    const v = a[k]!;
    let s: DD = ZERO;
    for (let i = k; i < n; i++) s = ddAdd(s, ddMul(v[i]!, v[i]!));
    if (s[0] === 0) {
      diag.push(ZERO);
      continue;
    }
    const norm = ddSqrt(s);
    const alpha: DD = v[k]![0] < 0 ? [-norm[0], -norm[1]] : norm;
    // H = I - u u' / (alpha u_k) with u = v + alpha e_k; H v = -alpha e_k
    v[k] = ddAdd(v[k]!, alpha);
    const denom = ddMul(alpha, v[k]!);
    const reflect = (c: DD[]): void => {
      let t: DD = ZERO;
      for (let i = k; i < n; i++) t = ddAdd(t, ddMul(v[i]!, c[i]!));
      const f = ddDiv(t, denom);
      for (let i = k; i < n; i++) c[i] = ddSub(c[i]!, ddMul(f, v[i]!));
    };
    for (let j = k + 1; j < cols.length; j++) reflect(a[j]!);
    reflect(b);
    diag.push([-alpha[0], -alpha[1]]);
  }
  // back substitution with R (diagonal in diag, above it the transformed columns)
  const coef: DD[] = new Array<DD>(p).fill(ZERO);
  for (let j = p - 1; j >= 0; j--) {
    let s = b[j]!;
    for (let k = j + 1; k < p; k++) s = ddSub(s, ddMul(a[k]![j]!, coef[k]!));
    coef[j] = ddDiv(s, diag[j]!);
  }
  return { qty: b, coef };
}

/** Sum of squares of the elements from..to-1 */
export function ddSumSquares(v: readonly DD[], from = 0, to = v.length): DD {
  let s: DD = ZERO;
  for (let i = from; i < to; i++) s = ddAdd(s, ddMul(v[i]!, v[i]!));
  return s;
}
