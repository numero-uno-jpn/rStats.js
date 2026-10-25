// Small dense matrices in double-double: products, traces, inverse and determinant (Gaussian elimination with
// partial pivoting), for the sums of squares and the sphericity statistics of the repeated-measures analyses.
//
// Written for rStats.js (no ported code), textbook algorithms (Golub and Van Loan, Matrix Computations, 3.2-3.4) on
// the arithmetic of src/special/dd.ts.

import { ddAdd, ddDiv, ddMul, ddSub, type DD } from "../special/dd.js";

export type DDMatrix = DD[][];

const ZERO: DD = [0, 0];

export const ddOf = (m: readonly (readonly number[])[]): DDMatrix => m.map((r) => r.map((v): DD => [v, 0]));

export const ddHi = (m: DDMatrix): number[][] => m.map((r) => r.map((v) => v[0]));

export function ddTranspose(a: DDMatrix): DDMatrix {
  const nc = a[0]?.length ?? 0;
  return Array.from({ length: nc }, (_, j) => a.map((r) => r[j]!));
}

export function ddMatMul(a: DDMatrix, b: DDMatrix): DDMatrix {
  const m = b[0]?.length ?? 0;
  return a.map((r) => {
    const out: DD[] = new Array<DD>(m).fill(ZERO);
    r.forEach((v, k) => {
      const bk = b[k]!;
      for (let j = 0; j < m; j++) out[j] = ddAdd(out[j]!, ddMul(v, bk[j]!));
    });
    return out;
  });
}

export function ddTrace(a: DDMatrix): DD {
  let s: DD = ZERO;
  a.forEach((r, i) => (s = ddAdd(s, r[i]!)));
  return s;
}

/** LU factorisation with partial pivoting; returns the factors in place, the permutation sign, and whether singular */
function lu(a0: DDMatrix): { a: DDMatrix; perm: number[]; sign: number; singular: boolean } {
  const n = a0.length;
  const a = a0.map((r) => r.slice());
  const perm = Array.from({ length: n }, (_, i) => i);
  let sign = 1;
  let singular = false;
  for (let k = 0; k < n; k++) {
    let piv = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(a[i]![k]![0]) > Math.abs(a[piv]![k]![0])) piv = i;
    if (a[piv]![k]![0] === 0) {
      singular = true;
      continue;
    }
    if (piv !== k) {
      [a[k], a[piv]] = [a[piv]!, a[k]!];
      [perm[k], perm[piv]] = [perm[piv]!, perm[k]!];
      sign = -sign;
    }
    for (let i = k + 1; i < n; i++) {
      const f = ddDiv(a[i]![k]!, a[k]![k]!);
      a[i]![k] = f;
      for (let j = k + 1; j < n; j++) a[i]![j] = ddSub(a[i]![j]!, ddMul(f, a[k]![j]!));
    }
  }
  return { a, perm, sign, singular };
}

export function ddDet(m: DDMatrix): DD {
  const { a, sign, singular } = lu(m);
  if (singular) return ZERO;
  let d: DD = [sign, 0];
  a.forEach((r, i) => (d = ddMul(d, r[i]!)));
  return d;
}

/** Inverse of a non-singular matrix */
export function ddInverse(m: DDMatrix): DDMatrix {
  const n = m.length;
  const { a, perm, singular } = lu(m);
  if (singular) throw new Error("singular matrix");
  const inv: DDMatrix = Array.from({ length: n }, () => new Array<DD>(n).fill(ZERO));
  for (let c = 0; c < n; c++) {
    // solve L U x = P e_c
    const x: DD[] = perm.map((p): DD => [p === c ? 1 : 0, 0]);
    for (let i = 0; i < n; i++) for (let k = 0; k < i; k++) x[i] = ddSub(x[i]!, ddMul(a[i]![k]!, x[k]!));
    for (let i = n - 1; i >= 0; i--) {
      for (let k = i + 1; k < n; k++) x[i] = ddSub(x[i]!, ddMul(a[i]![k]!, x[k]!));
      x[i] = ddDiv(x[i]!, a[i]![i]!);
    }
    for (let i = 0; i < n; i++) inv[i]![c] = x[i]!;
  }
  return inv;
}
