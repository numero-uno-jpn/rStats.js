// (R'R)^-1 of a triangular factor whose columns may be far from 1 (review 64).

import { chol2inv } from "../linalg/chol.js";
import { ldexp } from "./summary.js";

/**
 * (R'R)^-1 of an upper triangular R as inv_jk 2^(-e_j - e_k): the columns of R divided by 2^e_j first (exact). The
 * inverse of R itself overflowed for columns of 1e-200 (and underflowed for 1e200), so standard errors were Infinity
 * or 0 though they scale with the column (R's too). e_j is the exponent of the largest |R_ij| of a column outside
 * [2^-400, 2^400], else 0, which leaves the computation as before
 */
export function chol2invColumns(R: readonly (readonly number[])[]): { inv: number[][]; e: number[] } {
  const p = R.length;
  const e = new Array<number>(p).fill(0);
  for (let j = 0; j < p; j++) {
    let top = 0;
    for (let i = 0; i <= j; i++) top = Math.max(top, Math.abs(R[i]![j]!));
    if (top > 0 && Number.isFinite(top) && (top < 2 ** -400 || top > 2 ** 400)) e[j] = Math.floor(Math.log2(top));
  }
  const Rs = e.every((v) => v === 0) ? R.map((r) => r.slice()) : R.map((r) => r.map((v, j) => ldexp(v, -e[j]!)));
  return { inv: chol2inv(Rs), e };
}
