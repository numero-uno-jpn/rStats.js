// The fallback for an inner product whose plain sum is not finite, shared by matMul (ops.ts) and crossprod and
// tcrossprod (basic.ts).
//
// Written for rStats.js (no ported code).

import { maxOf } from "../internal/extremes.js";
import { ldexp } from "../internal/summary.js";

/**
 * The inner product of u and v when the plain sum s is not finite: with finite factors, the products may have
 * overflowed while the sum is in range (1e308 * 1e308 + 1e308 * -1e308 gave NaN, R too). Each factor is divided by
 * 2^(the exponent of the largest in its vector) (exact), and the sum scaled back. Terms below 2^-1074 times the
 * largest product are lost in the division. With a factor that is not finite, s is returned as it is
 */
export function rescaledDot(u: readonly number[], v: readonly number[], s: number): number {
  if (!u.every(Number.isFinite) || !v.every(Number.isFinite)) return s;
  const exponent = (w: readonly number[]): number => {
    const m = maxOf(w.map(Math.abs));
    return m === 0 ? 0 : Math.floor(Math.log2(m));
  };
  const ea = exponent(u);
  const eb = exponent(v);
  let t = 0;
  for (let k = 0; k < u.length; k++) t += ldexp(u[k]!, -ea) * ldexp(v[k]!, -eb);
  return ldexp(t, ea + eb);
}
