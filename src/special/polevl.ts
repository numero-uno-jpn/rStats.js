// Ported from xsf include/xsf/cephes/polevl.h (xsf commit c6a3afe).
// Cephes Math Library Release 2.8, Copyright 1984, 1995, 2000 by Stephen L. Moshier.
// xsf Copyright (c) 2024, SciPy. BSD-3-Clause. See THIRD_PARTY_NOTICES.md.

/** Evaluate the polynomial coef[0] x^N + ... + coef[N] by Horner's method. */
export function polevl(x: number, coef: readonly number[]): number {
  let ans = coef[0]!;
  for (let i = 1; i < coef.length; i++) ans = ans * x + coef[i]!;
  return ans;
}

/** Evaluate the monic polynomial x^N + coef[0] x^(N-1) + ... + coef[N-1]. */
export function p1evl(x: number, coef: readonly number[]): number {
  let ans = x + coef[0]!;
  for (let i = 1; i < coef.length; i++) ans = ans * x + coef[i]!;
  return ans;
}
