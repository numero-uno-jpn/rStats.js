// Modified Bessel functions I and K of real order: besselI, besselK.
//
// Ported from Boost.Math include/boost/math/special_functions/detail/bessel_ik.hpp, bessel.hpp and
// detail/bessel_jy_asym.hpp (Boost.Math commit 0a0fb4e).
// Copyright (c) 2006 Xiaogang Zhang, (c) 2007 John Maddock, (c) 2024 Matt Borland.
// Boost Software License 1.0. See THIRD_PARTY_NOTICES.md.
//
// Changes from Boost
// - Everything is computed scaled, e^-x I_v(x) and e^x K_v(x) (R's expon.scaled), and unscaled values are formed at
//   the end. The forward recurrence for K keeps a separate binary exponent, so neither overflows on the way.
// - Negative orders follow R's documentation: I_-v = I_v + (2/pi) sin(pi v) K_v (A&S 9.6.2) and K_-v = K_v.

import { lgamma1p, sinpi } from "./gamma.js";
import { seriesTimesPrefix } from "./besselSeries.js";

const EPS = Number.EPSILON;
const MAX_ITER = 1_000_000;

/** Gamma(1 + v) - 1 for |v| <= 1/2 */
function tgamma1pm1(v: number): number {
  return Math.expm1(lgamma1p(v));
}

/**
 * K_u(x) and K_(u+1)(x) by Temme's series (|u| <= 1/2, 0 < x <= 2).
 * Temme, Journal of Computational Physics, vol 21, 343 (1976)
 */
function temmeIK(u: number, x: number): [number, number] {
  const gp = tgamma1pm1(u);
  const gm = tgamma1pm1(-u);
  const a = Math.log(x / 2);
  const b = Math.exp(u * a);
  const sigma = -a * u;
  const c = Math.abs(u) < EPS ? 1 : sinpi(u) / (u * Math.PI);
  const d = Math.abs(sigma) < EPS ? 1 : Math.sinh(sigma) / sigma;
  const gamma1 = Math.abs(u) < EPS ? -0.5772156649015329 : (0.5 / u) * (gp - gm) * c;
  const gamma2 = ((2 + gp + gm) * c) / 2;
  let p = (gp + 1) / (2 * b);
  let q = ((1 + gm) * b) / 2;
  let f = (Math.cosh(sigma) * gamma1 + d * -a * gamma2) / c;
  let h = p;
  let coef = 1;
  let sum = coef * f;
  let sum1 = coef * h;
  for (let k = 1; k < MAX_ITER; k++) {
    f = (k * f + p + q) / (k * k - u * u);
    p /= k - u;
    q /= k + u;
    h = p - k * f;
    coef *= (x * x) / (4 * k);
    sum += coef * f;
    sum1 += coef * h;
    if (Math.abs(coef * f) < Math.abs(sum) * EPS) break;
  }
  return [sum, (2 * sum1) / x];
}

/** fv = I_(v+1) / I_v by continued fraction (A&S 9.1.73, modified Lentz) */
function cf1IK(v: number, x: number): number {
  const tiny = Math.sqrt(Number.MIN_VALUE * 2 ** 52); // sqrt(DBL_MIN)
  let C = tiny;
  let f = tiny;
  let D = 0;
  for (let k = 1; k < MAX_ITER; k++) {
    const b = (2 * (v + k)) / x;
    C = b + 1 / C;
    D = b + D;
    if (C === 0) C = tiny;
    if (D === 0) D = tiny;
    D = 1 / D;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) <= 2 * EPS) break;
  }
  return f;
}

/**
 * e^x K_u(x) and e^x K_(u+1)(x) for x > 2 by Steed's continued fraction (Thompson and Barnett, Computer Physics
 * Communications, vol 47, 245 (1987)). Boost multiplies by e^-x at the end; here the scaled values are returned
 */
function cf2IKScaled(u: number, x: number): [number, number] {
  let a = u * u - 0.25;
  let b = 2 * (x + 1);
  let D = 1 / b;
  let f = D;
  let delta = D;
  let prev = 0;
  let current = 1;
  let C = -a;
  let Q = C;
  let S = 1 + Q * delta;
  for (let k = 2; k < MAX_ITER; k++) {
    a -= 2 * (k - 1);
    b += 2;
    D = 1 / (b + a * D);
    delta *= b * D - 1;
    f += delta;
    const q = (prev - (b - 2) * current) / a;
    prev = current;
    current = q;
    C *= -a / k;
    Q += C * q;
    S += Q * delta;
    if (q < EPS) {
      C *= q;
      prev /= q;
      current /= q;
    }
    if (Math.abs(Q * delta) < Math.abs(S) * EPS) break;
  }
  const ratio = (0.5 + u + x + (u * u - 0.25) * f) / x;
  const ku = Math.sqrt(Math.PI / (2 * x)) / S;
  return [ku, ku * ratio];
}

/** Multiply by 2^e without overflow in the intermediate power */
function ldexp(m: number, e: number): number {
  if (!Number.isFinite(e)) return e > 0 ? m * Infinity : m * 0;
  while (e > 1000) {
    m *= 2 ** 1000;
    e -= 1000;
  }
  while (e < -1000) {
    m *= 2 ** -1000;
    e += 1000;
  }
  return m * 2 ** e;
}

/**
 * e^x K_v(x) as mantissa * 2^exp (v >= 0, x > 0), together with K_(v+1) for the Wronskian.
 * Forward recurrence K_(u+k+1) = 2 (u + k) / x K_(u+k) + K_(u+k-1) from u = v - round(v)
 */
function kScaled(v: number, x: number): { k: number; k1: number; exp2: number } {
  const n = Math.round(v);
  const u = v - n;
  let prev: number;
  let current: number;
  if (u === -0.5) {
    // K_-1/2 = K_1/2 = sqrt(pi / (2x)) e^-x exactly (Temme's series is off by 2e-14 at x = 1e-300)
    prev = current = Math.sqrt(Math.PI / (2 * x));
  } else if (x <= 2) {
    const [ku, ku1] = temmeIK(u, x);
    const ex = Math.exp(x);
    prev = ku * ex;
    current = ku1 * ex;
  } else {
    [prev, current] = cf2IKScaled(u, x);
  }
  let exp2 = 0;
  for (let k = 1; k <= n; k++) {
    const fact = (2 * (u + k)) / x;
    // rescale by a power of two (exact); the factor itself can be huge for tiny x, so look at the product
    const lg = Math.log2(Math.abs(current)) + Math.log2(fact);
    if (lg > 900 && Number.isFinite(lg)) {
      const s = Math.ceil(lg - 800);
      prev = ldexp(prev, -s);
      current = ldexp(current, -s);
      exp2 += s;
    }
    const next = fact * current + prev;
    prev = current;
    current = next;
  }
  return { k: prev, k1: current, exp2 };
}

/** I_v(x) by its power series for x small compared to v: (x/2)^v / Gamma(v + 1) * sum (x^2/4)^k / (k! (v+1)_k) */
function iSmallZ(v: number, x: number): number {
  const mult = (x * x) / 4;
  let term = 1;
  let sum = 0;
  for (let k = 1; k < MAX_ITER; k++) {
    sum += term;
    term *= mult / k;
    term /= k + v;
    if (Math.abs(term) <= EPS * Math.abs(sum)) break;
  }
  return seriesTimesPrefix(v, x, sum + term);
}

/**
 * A value m * 2^e2 * e^(ex x): the computations below return I or K scaled by e^-x or e^x as a mantissa and a binary
 * exponent, and the caller applies the exponential only for the variant (scaled or not) that was requested, so that
 * neither variant overflows or underflows before the result does (I(100, 500) = 3.6e-283 but e^-100 I(100, 500)
 * underflows)
 */
interface Scaled {
  m: number;
  e2: number;
  /** -1, 0 or 1: the power of e^x still to be applied to get the unscaled value */
  ex: -1 | 0 | 1;
}

/** m * 2^e2 * e^y, with y split into exact steps of 700 (e^(x/k) would turn the rounding of x/k into an error of x ε) */
function mulExp(m: number, e2: number, y: number): number {
  if (m === 0 || !Number.isFinite(m)) return m;
  let v = m;
  let e = e2;
  const step = y > 0 ? 700 : -700;
  const estep = Math.exp(step);
  while (Math.abs(y) > 700) {
    y -= step; // exact
    v *= estep;
    const k = Math.floor(Math.log2(Math.abs(v)));
    v = ldexp(v, -k);
    e += k;
  }
  return ldexp(v * Math.exp(y), e);
}

/** The value e^(want x) * (unscaled value): want = 0 for the unscaled value, -1 for e^-x I, 1 for e^x K */
function resolve(r: Scaled, x: number, want: -1 | 0 | 1): number {
  const ex = r.ex + want;
  return ex === 0 ? ldexp(r.m, r.e2) : mulExp(r.m, r.e2, ex * x);
}

/** I_v(x) for v >= 0, x > 0, as I_v = m 2^e2 e^(ex x) */
function iPos(v: number, x: number): Scaled {
  if (v === 0.5) return { m: Math.sqrt(2 / (x * Math.PI)) * (-Math.expm1(-2 * x) / 2), e2: 0, ex: 1 };
  if (v > 0 && x / v < 0.25) return { m: iSmallZ(v, x), e2: 0, ex: 0 };
  let lim = (4 * v * v + 10) / (8 * x);
  lim *= lim;
  lim *= lim;
  lim /= 24;
  if (lim < EPS * 10 && x > 100) {
    // A&S 9.7.1, three terms (Boost's asymptotic_bessel_i_large_x)
    const mu = 4 * v * v;
    const ez = 8 * x;
    let num = mu - 1;
    let denom = ez;
    let s = 1 - num / denom;
    num *= mu - 9;
    denom *= ez * 2;
    s += num / denom;
    num *= mu - 25;
    denom *= ez * 3;
    s -= num / denom;
    return { m: s / Math.sqrt(2 * x * Math.PI), e2: 0, ex: 1 };
  }
  // Wronskian I_v K_(v+1) + I_(v+1) K_v = 1/x with fv = I_(v+1) / I_v; K is scaled by e^x, so I comes out scaled by e^-x
  const { k, k1, exp2 } = kScaled(v, x);
  const fv = cf1IK(v, x);
  return { m: 1 / (x * (k * fv + k1)), e2: -exp2, ex: 1 };
}

/** K_v(x) for v >= 0, x > 0, as K_v = m 2^e2 e^(ex x) */
function kPos(v: number, x: number): Scaled {
  // A&S 9.7.2, four terms, where the first omitted term is below eps times the sum (as Boost limits the expansion
  // of I, but measured on the term itself). For v <= 4.5 the remainder is bounded by the first omitted term
  // (DLMF 10.40(ii), l >= v - 1/2); beyond, a small t4 needs x well above v^2, where the terms fall off fast.
  // Testing only mu - 25 used to enter the expansion for v near 2.5 at any x
  const mu = 4 * v * v;
  const ez = 8 * x;
  const t1 = (mu - 1) / ez;
  const t2 = (t1 * (mu - 9)) / (2 * ez);
  const t3 = (t2 * (mu - 25)) / (3 * ez);
  const t4 = (t3 * (mu - 49)) / (4 * ez);
  const s = 1 + t1 + t2 + t3;
  if (Math.abs(t4) < EPS * Math.abs(s)) {
    return { m: (s * Math.sqrt(Math.PI)) / Math.sqrt(2 * x), e2: 0, ex: -1 };
  }
  const { k, exp2 } = kScaled(v, x);
  return { m: k, e2: exp2, ex: -1 };
}

/** Options for {@link besselI} and {@link besselK}. */
export interface BesselOptions {
  /** If `true`, return `exp(-x) I(x, nu)` (for `besselI`) or `exp(x) K(x, nu)` (for `besselK`). Default `false`. */
  exponScaled?: boolean;
}

/**
 * Modified Bessel function of the first kind. Equivalent to R's
 * `besselI(x, nu, expon.scaled = FALSE)` for single numbers.
 *
 * @param x - Argument, `x >= 0` (`NaN` for negative `x`).
 * @param nu - Order, any real number. For `nu < 0`, `I(x, -nu) = I(x, nu) + 2/pi sin(pi nu) K(x, nu)`
 *   (A&S 9.6.2, as in R).
 * @param options - `exponScaled` (see {@link BesselOptions}).
 * @returns I_nu(x), or `exp(-x) I_nu(x)` when `exponScaled`.
 *
 * @example
 * ```ts
 * besselI(1, 0);                             // 1.2660658777520086
 * besselI(1000, 2, { exponScaled: true });   // 0.012592018595377398
 * ```
 */
export function besselI(x: number, nu: number, options: BesselOptions = {}): number {
  const scaled = options.exponScaled ?? false;
  if (Number.isNaN(x) || Number.isNaN(nu) || x < 0 || !Number.isFinite(nu)) return NaN;
  const v = Math.abs(nu);
  const negNonInt = nu < 0 && nu !== Math.floor(nu);
  if (x === 0) {
    if (negNonInt) return sinpi(v) > 0 ? Infinity : -Infinity;
    return nu === 0 ? 1 : 0;
  }
  if (x === Infinity) return scaled ? 0 : Infinity;
  const want = scaled ? -1 : 0;
  const i = resolve(iPos(v, x), x, want);
  if (!negNonInt) return i;
  // A&S 9.6.2: I_-v = I_v + (2/pi) sin(pi v) K_v, each term in the requested scaling
  const k = kPos(v, x);
  return i + resolve({ ...k, m: (2 / Math.PI) * sinpi(v) * k.m }, x, want);
}

/**
 * Modified Bessel function of the second kind. Equivalent to R's
 * `besselK(x, nu, expon.scaled = FALSE)` for single numbers.
 *
 * @param x - Argument, `x >= 0` (`NaN` for negative `x`).
 * @param nu - Order, any real number (`K(x, -nu) = K(x, nu)`).
 * @param options - `exponScaled` (see {@link BesselOptions}).
 * @returns K_nu(x), or `exp(x) K_nu(x)` when `exponScaled`.
 *
 * @example
 * ```ts
 * besselK(1, 0);                              // 0.4210244382407083
 * besselK(1000, 2, { exponScaled: true });    // 0.03970761786238014
 * ```
 */
export function besselK(x: number, nu: number, options: BesselOptions = {}): number {
  const scaled = options.exponScaled ?? false;
  if (Number.isNaN(x) || Number.isNaN(nu) || x < 0 || !Number.isFinite(nu)) return NaN;
  const v = Math.abs(nu);
  if (x === 0) return Infinity;
  if (x === Infinity) return 0;
  return resolve(kPos(v, x), x, scaled ? 1 : 0);
}
