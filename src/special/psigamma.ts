// Digamma and polygamma functions: digamma, trigamma, psigamma.
//
// digamma is ported from xsf include/xsf/cephes/psi.h and include/xsf/digamma.h (xsf commit c6a3afe; the
// rational approximation on [1, 2] in psi.h is from Boost.Math, (C) John Maddock 2006, BSL-1.0).
// Cephes Math Library Release 2.8, Copyright 1984, 1987, 1992, 2000 by Stephen L. Moshier.
// xsf Copyright (c) 2024, SciPy. BSD-3-Clause. See THIRD_PARTY_NOTICES.md.
//
// The derivatives (deriv >= 1) are written for rStats.js:
//   psi^(n)(x) = (-1)^(n+1) n! zeta(n + 1, x)                                  (x > 0)
// with the Hurwitz zeta function summed by Euler-Maclaurin as in xsf include/xsf/cephes/zeta.h, but scaled by
// x^(n+1) so that n! / x^(n+1) and the sum can be combined without overflow, and with direct terms up to
// a >= n + 1 so that the Bernoulli corrections converge for large n. For x < 0 the reflection formula
//   psi^(n)(x) = (-1)^n psi^(n)(1 - x) - pi^(n+1) P_n(cot(pi x))
// is used, where d^n/dx^n cot(pi x) = pi^n P_n(cot(pi x)), P_0(t) = t, P_(k+1)(t) = -(1 + t^2) P_k'(t)
// (P_n has terms of one parity only, all of the same sign, so it is evaluated without cancellation).

import { roundHalfEven } from "../internal/integer.js";
import { EULER, MACHEP } from "./constants.js";
import { polevl } from "./polevl.js";
import type { RCompatibleOptions } from "./rCompatible.js";

const PSI_A = [
  8.33333333333333333333e-2, -2.10927960927960927961e-2, 7.57575757575757575758e-3, -4.16666666666666666667e-3,
  3.96825396825396825397e-3, -8.33333333333333333333e-3, 8.33333333333333333333e-2,
];
const PSI_Y = 0.99558162689208984; // a float constant in Boost
const PSI_ROOT1 = 1569415565.0 / 1073741824.0;
const PSI_ROOT2 = 381566830.0 / 1073741824.0 / 1073741824.0;
const PSI_ROOT3 = 0.9016312093258695918615325266959189453125e-19;
const PSI_P = [
  -0.0020713321167745952, -0.045251321448739056, -0.28919126444774784, -0.65031853770896507, -0.32555031186804491,
  0.25479851061131551,
];
const PSI_Q = [
  -0.55789841321675513e-6, 0.0021284987017821144, 0.054151797245674225, 0.43593529692665969, 1.4606242909763515,
  2.0767117023730469, 1.0,
];

/** Rational approximation on [1, 2]: digamma(x) = (x - root) (Y + R(x - 1)) */
function digammaImp12(x: number): number {
  let g = x - PSI_ROOT1;
  g -= PSI_ROOT2;
  g -= PSI_ROOT3;
  const r = polevl(x - 1, PSI_P) / polevl(x - 1, PSI_Q);
  return g * PSI_Y + g * r;
}

function psiAsy(x: number): number {
  let y = 0;
  if (x < 1e17) {
    const z = 1 / (x * x);
    y = z * polevl(z, PSI_A);
  }
  return Math.log(x) - 0.5 / x - y;
}

/** Cephes psi */
function psi(x: number): number {
  let y = 0;
  if (Number.isNaN(x) || x === Infinity) return x;
  if (x === -Infinity) return NaN;
  if (x === 0) return NaN;
  if (x < 0) {
    // argument reduction before evaluating tan(pi x)
    const r = x - Math.trunc(x);
    if (r === 0) return NaN;
    y = -Math.PI / Math.tan(Math.PI * r);
    x = 1 - x;
  }
  // positive integers up to 10
  if (x <= 10 && x === Math.floor(x)) {
    const n = x;
    for (let i = 1; i < n; i++) y += 1 / i;
    return y - EULER;
  }
  // use the recurrence to move x into [1, 2]
  if (x < 1) {
    y -= 1 / x;
    x += 1;
  } else if (x < 10) {
    while (x > 2) {
      x -= 1;
      y += 1 / x;
    }
  }
  if (x >= 1 && x <= 2) return y + digammaImp12(x);
  return y + psiAsy(x);
}

// Series around the negative root closest to 0 (xsf digamma.h; values computed with mpmath there)
const NEGROOT = -0.504083008264455409;
const NEGROOTVAL = 7.2897639029768949e-17;
/** zeta(n + 1, NEGROOT) for n = 1, 2, ... (the series coefficients), computed on first use */
let negrootZeta: number[] | undefined;

function digammaNearNegroot(x: number): number {
  negrootZeta ??= Array.from({ length: 100 }, (_, i) => hurwitzZeta(i + 2, NEGROOT));
  let res = NEGROOTVAL;
  let coeff = -1;
  const z = x - NEGROOT;
  for (let n = 1; n < 100; n++) {
    coeff *= -z;
    const term = coeff * negrootZeta[n - 1]!;
    res += term;
    if (Math.abs(term) < Number.EPSILON * Math.abs(res)) break;
  }
  return res;
}

/** Expansion coefficients (2k)! / B_2k for the Euler-Maclaurin formula (xsf cephes/zeta.h) */
const ZETA_A = [
  12.0, -720.0, 30240.0, -1209600.0, 47900160.0, -1.8924375803183791606e9, 7.47242496e10, -2.950130727918164224e12,
  1.1646782814350067249e14, -4.5979787224074726105e15, 1.8152105401943546773e17, -7.1661652561756670113e18,
];

/**
 * Hurwitz zeta function zeta(s, q) times q^s, for s > 1 and q > 0 (Euler-Maclaurin summation as in Cephes, with
 * every term scaled by q^s). Direct terms are added until the term is negligible or a = q + i exceeds both 9 and s,
 * so that the Bernoulli corrections, whose ratio is about ((s + 2i) / (2 pi a))^2, converge
 */
function hurwitzZetaScaled(s: number, q: number): number {
  let sum = 1;
  let a = q;
  let b = 1;
  let i = 0;
  // Above 1e8 no direct terms: the expansion at a = q itself, q / (s - 1) + 1/2 + s / (12 q) - ... (cutting it after
  // the 1/2 left out s / (12 q), 1e-14 relative at q = 1e8, s = 39)
  while (q <= 1e8 && (i < 9 || a <= 9 || a < s)) {
    i += 1;
    a += 1;
    b = Math.exp(-s * Math.log1p(i / q)); // (q / a)^s
    sum += b;
    if (Math.abs(b / sum) < MACHEP) return sum;
  }
  const w = a;
  sum += (b * w) / (s - 1);
  sum -= 0.5 * b;
  let fac = 1;
  let k = 0;
  for (let j = 0; j < 12; j++) {
    fac *= s + k;
    b /= w;
    const t = (fac * b) / ZETA_A[j]!;
    sum += t;
    if (Math.abs(t / sum) < MACHEP) break;
    k += 1;
    fac *= s + k;
    b /= w;
    k += 1;
  }
  return sum;
}

/**
 * Hurwitz zeta function zeta(s, q) for integer s > 1 and any q that is not a non-positive integer, unscaled as in
 * Cephes (negative q are allowed for integer s: the direct sum runs until q + i > 9). Used for the series
 * coefficients around the negative root of digamma
 */
function hurwitzZeta(s: number, q: number): number {
  let sum = Math.pow(q, -s);
  let a = q;
  let b = 0;
  let i = 0;
  while (i < 9 || a <= 9 || a < s) {
    i += 1;
    a += 1;
    b = Math.pow(a, -s);
    sum += b;
    if (Math.abs(b / sum) < MACHEP) return sum;
  }
  const w = a;
  sum += (b * w) / (s - 1);
  sum -= 0.5 * b;
  let fac = 1;
  let k = 0;
  for (let j = 0; j < 12; j++) {
    fac *= s + k;
    b /= w;
    const t = (fac * b) / ZETA_A[j]!;
    sum += t;
    if (Math.abs(t / sum) < MACHEP) break;
    k += 1;
    fac *= s + k;
    b /= w;
    k += 1;
  }
  return sum;
}

/** psi^(n)(x) for x > 0, n >= 1: (-1)^(n+1) n! / x^(n+1) * [x^(n+1) zeta(n + 1, x)] */
function polygammaPositive(n: number, x: number): number {
  if (x === Infinity) return n % 2 === 0 ? -0 : 0;
  // n! / x^n as a running product (no overflow before the result does), then the sum divided by x
  let p = 1;
  for (let k = 1; k <= n; k++) p *= k / x;
  const v = p * (hurwitzZetaScaled(n + 1, x) / x);
  return n % 2 === 0 ? -v : v;
}

/** Coefficients of P_n in t^2: P_n(t) = t^(n+1 mod 2) * sum_j c_j t^(2j), computed on first use */
const cotDerivCache: number[][] = [];

function cotDerivPoly(n: number): number[] {
  // Dense coefficients of P_k(t) by recurrence, then keep those of the parity of n + 1
  if (cotDerivCache[n] !== undefined) return cotDerivCache[n]!;
  let p = [0, 1]; // P_0 = t
  for (let k = 0; k < n; k++) {
    // P' then -(1 + t^2) P'
    const d = p.slice(1).map((c, i) => c * (i + 1));
    const next = new Array<number>(d.length + 2).fill(0);
    d.forEach((c, i) => {
      next[i] = next[i]! - c;
      next[i + 2] = next[i + 2]! - c;
    });
    p = next;
  }
  const parity = (n + 1) % 2;
  const coef: number[] = [];
  for (let i = parity; i < p.length; i += 2) coef.push(p[i]!);
  cotDerivCache[n] = coef;
  return coef;
}

/** P_n(t) (all coefficients of one sign, so no cancellation) */
function cotDeriv(n: number, t: number): number {
  const c = cotDerivPoly(n);
  const t2 = t * t;
  // Horner from the leading coefficient (starting from 0 would give 0 * Infinity = NaN when t^2 overflows)
  let s = c[c.length - 1]!;
  for (let j = c.length - 2; j >= 0; j--) s = s * t2 + c[j]!;
  return (n + 1) % 2 === 1 ? s * t : s;
}

/**
 * cot(pi x), with x reduced exactly to r in [-1/2, 1/2]. The cosine is taken as sin(pi (1/2 - |r|)), where 1/2 - |r|
 * is exact near 1/2, so that cot is exactly 0 at half-integers and keeps its relative accuracy near them (P_n
 * multiplies the error of a cot that should be 0 by its huge linear coefficient: 1e174 instead of -6e117 for
 * psigamma(-1.5, 100))
 */
function cotpi(x: number): number {
  const r = x - Math.round(x);
  const c = Math.sin(Math.PI * (0.5 - Math.abs(r)));
  return c / Math.sin(Math.PI * r);
}

function polygamma(n: number, x: number, rCompatible: boolean): number {
  if (Number.isNaN(x)) return NaN;
  // R treats -Infinity like the poles (it equals its own rounding)
  if (x === -Infinity) return rCompatible && n % 2 === 1 ? Infinity : NaN;
  if (x <= 0 && x === Math.floor(x)) return n % 2 === 1 ? Infinity : NaN;
  if (x > 0) return polygammaPositive(n, x);
  const refl = polygammaPositive(n, 1 - x);
  return (n % 2 === 0 ? refl : -refl) - Math.pow(Math.PI, n + 1) * cotDeriv(n, cotpi(x));
}

/**
 * Digamma function, the derivative of `lgamma`. Equivalent to R's `digamma(x)` for a single number.
 *
 * @param x - Argument.
 * @returns psi(x) (`NaN` at zero and the negative integers).
 *
 * @example
 * ```ts
 * digamma(1);  // -0.5772156649015329 (minus Euler's constant)
 * ```
 */
export function digamma(x: number): number {
  if (Math.abs(x - NEGROOT) < 0.3) return digammaNearNegroot(x);
  return psi(x);
}

/**
 * Trigamma function, the second derivative of `lgamma`. Equivalent to R's `trigamma(x)` for a single number.
 *
 * `trigamma(-Infinity)` is `Infinity` as in R (`NaN` with `rCompatible: false`).
 *
 * @param x - Argument.
 * @param options - `rCompatible` (default `true`).
 * @returns psi'(x) (`Infinity` at zero and the negative integers).
 *
 * @example
 * ```ts
 * trigamma(1);  // 1.6449340668482264 (pi^2 / 6)
 * ```
 */
export function trigamma(x: number, options?: RCompatibleOptions): number {
  return polygamma(1, x, options?.rCompatible ?? true);
}

/**
 * Polygamma function, the derivative of order `deriv` of `digamma`. Equivalent to R's
 * `psigamma(x, deriv)` for a single number.
 *
 * `psigamma(-Infinity, deriv)` is `Infinity` for odd `deriv` as in R, which treats it like the poles
 * (`NaN` with `rCompatible: false`). Unlike R, which returns `NaN` for `x < 0` with `deriv >= 6` and
 * where the result overflows, the value is computed there.
 *
 * @param x - Argument.
 * @param deriv - Order of the derivative, an integer from 0 to 100 (rounded half to even; default 0, digamma).
 * @param options - `rCompatible` (default `true`).
 * @returns psi^(deriv)(x). At zero and the negative integers, `Infinity` for odd `deriv` and `NaN` for even.
 *   `NaN` if `deriv` is outside 0 to 100.
 *
 * @example
 * ```ts
 * psigamma(2, 2);  // -0.40411380631918853 (-2 (zeta(3) - 1))
 * ```
 */
export function psigamma(x: number, deriv = 0, options?: RCompatibleOptions): number {
  const n = roundHalfEven(deriv);
  if (Number.isNaN(n) || n < 0 || n > 100) return NaN;
  if (n === 0) return digamma(x);
  return polygamma(n, x, options?.rCompatible ?? true);
}
