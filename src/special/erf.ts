// Ported from xsf include/xsf/cephes/ndtr.h (xsf commit c6a3afe).
// Cephes Math Library Release 2.8, Copyright 1984, 1995, 2000 by Stephen L. Moshier.
// xsf Copyright (c) 2024, SciPy. BSD-3-Clause. See THIRD_PARTY_NOTICES.md.
//
// Cephes' erfc has the form exp(-x^2) * P(x)/Q(x). P/Q (1 <= x < 8) and R/S (x >= 8) are the part without
// exp(-x^2), i.e. an approximation of erfcx(x) = exp(x^2) erfc(x) itself, so erfcx uses these rational
// approximations directly. This gives the tail value before multiplying by exp(-x^2), usable for computations
// that take the log (logP in pnorm) or that recompute exp(-x^2) accurately.

import { p1evl, polevl } from "./polevl.js";
import { twoProd } from "./dd.js";

const P = [
  2.46196981473530512524e-10, 5.64189564831068821977e-1, 7.46321056442269912687e0,
  4.86371970985681366614e1, 1.96520832956077098242e2, 5.26445194995477358631e2,
  9.34528527171957607540e2, 1.02755188689515710272e3, 5.57535335369399327526e2,
];
const Q = [
  1.32281951154744992508e1, 8.67072140885989742329e1, 3.54937778887819891062e2,
  9.75708501743205489753e2, 1.82390916687909736289e3, 2.24633760818710981792e3,
  1.65666309194161350182e3, 5.57535340817727675546e2,
];
const R = [
  5.64189583547755073984e-1, 1.27536670759978104416e0, 5.01905042251180477414e0,
  6.16021097993053585195e0, 7.40974269950448939160e0, 2.97886665372100240670e0,
];
const S = [
  2.26052863220117276590e0, 9.39603524938001434673e0, 1.20489539808096656605e1,
  1.70814450747565897222e1, 9.60896809063285878198e0, 3.36907645100081516050e0,
];
const T = [
  9.60497373987051638749e0, 9.00260197203842689217e1, 2.23200534594684319226e3,
  7.00332514112805075473e3, 5.55923013010394962768e4,
];
const U = [
  3.35617141647503099647e1, 5.21357949780152679795e2, 4.59432382970980127987e3,
  2.26290000613890934246e4, 4.92673942608635921086e4,
];

/** log(DBL_MAX) */
const MAXLOG = 7.097827128933839730962063185871e2;
/** 1/sqrt(pi) */
const INV_SQRT_PI = 0.5641895835477562869;

/**
 * Error function, erf(x) = 2 / sqrt(pi) * integral from 0 to x of exp(-t^2) dt. Not part of R (where it is written
 * `2 * pnorm(x * sqrt(2)) - 1`, which loses the relative accuracy of small x).
 *
 * @param x - Argument.
 * @returns erf(x).
 *
 * @example
 * ```ts
 * erf(0.5);    // 0.5204998778130465
 * erf(1e-10);  // 1.1283791670955126e-10
 * ```
 */
export function erf(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x < 0) return -erf(-x);
  if (x > 1) return 1 - erfc(x);
  const z = x * x;
  return (x * polevl(z, T)) / p1evl(z, U);
}

/**
 * Complementary error function, erfc(x) = 1 - erf(x), accurate in the upper tail (down to the subnormal range near
 * x = 27). Not part of R (where it is written `2 * pnorm(x * sqrt(2), lower.tail = FALSE)`).
 *
 * @param a - Argument.
 * @returns erfc(a).
 *
 * @example
 * ```ts
 * erfc(5);  // 1.537459794428035e-12
 * ```
 *
 * Changes from xsf: exp(-x^2) is formed from x^2 = hi + lo exact (the rounding of x^2 is 33 ε relative at x = 5.7),
 * and below the normal range exp(-700) is applied last so that subnormal results (x up to 27.2) are not flushed to 0.
 */
export function erfc(a: number): number {
  if (Number.isNaN(a)) return NaN;
  const x = Math.abs(a);
  if (x < 1) return 1 - erf(a);
  if (a < 0) return 2 - erfc(x);
  const [hi, lo] = twoProd(x, x);
  if (hi > MAXLOG + 40) return 0;
  const r = erfcxRational(x) * (1 - lo);
  if (hi < 700) return Math.exp(-hi) * r;
  return Math.exp(700 - hi) * r * Math.exp(-700);
}

/**
 * Scaled complementary error function erfcx(x) = exp(x^2) erfc(x) (x >= 0).
 * Negative x is handled by the caller (this library uses only x >= 0 internally).
 */
export function erfcxNonNegative(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x < 1) return Math.exp(x * x) * (1 - erf(x));
  // Region where the correction terms of the asymptotic form 1/(sqrt(pi) x) (1 - 1/(2x^2) + ...) vanish in double
  // precision. The rational approximation would overflow in x^6, so cut off here
  if (x > 1e8) return INV_SQRT_PI / x;
  return erfcxRational(x);
}

function erfcxRational(x: number): number {
  return x < 8 ? polevl(x, P) / p1evl(x, Q) : polevl(x, R) / p1evl(x, S);
}
