// Bessel functions J and Y of real order: besselJ, besselY.
//
// Ported from Boost.Math include/boost/math/special_functions/detail/bessel_jy.hpp, detail/bessel_jy_series.hpp and
// detail/bessel_jy_asym.hpp (Boost.Math commit 0a0fb4e).
// Copyright (c) 2006 Xiaogang Zhang, (c) 2007 John Maddock. Boost Software License 1.0. See THIRD_PARTY_NOTICES.md.
//
// Changes from Boost
// - Integer orders go through the same algorithm (Boost dispatches them to bessel_jn / bessel_yn).
// - The series prefix (x/2)^v / Gamma(v + 1) uses Loader's Poisson term for large v, as in besselIK.ts.
// - Negative orders follow R's documentation (A&S 9.1.2):
//     J_-v = cos(pi v) J_v - sin(pi v) Y_v,   Y_-v = sin(pi v) J_v + cos(pi v) Y_v.

import { gamma, lgamma, lgamma1p, lgammaSign, sinpi } from "./gamma.js";
import { certainRange, LARGE_ORDER, logHalf, logISeriesBounds, powHalf, seriesTimesPrefix } from "./besselSeries.js";
import { ddDiv, ddMul, ddSub, twoSum, type DD } from "./dd.js";

const EPS = Number.EPSILON;

/** A value m * 2^e2 (Y can overflow on the way where the result does not) */
interface Pow2 {
  m: number;
  e2: number;
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

/** Forward recurrence Y_(u+k+1) = 2 (u + k) / x Y_(u+k) - Y_(u+k-1) for k = 1..n, rescaling by powers of 2 (exact) */
function yForward(u: number, x: number, n: number, y0: number, y1: number): { y: number; y1: number; e2: number } {
  let prev = y0;
  let current = y1;
  let e2 = 0;
  for (let k = 1; k <= n; k++) {
    const fact = (2 * (u + k)) / x;
    // the factor itself can be huge (2e300 at x = 1e-300), so look at the size of the product
    const lg = Math.log2(Math.abs(current)) + Math.log2(fact);
    if (lg > 900 && Number.isFinite(lg)) {
      const s = Math.ceil(lg - 800);
      prev = ldexp(prev, -s);
      current = ldexp(current, -s);
      e2 += s;
    }
    const next = fact * current - prev;
    prev = current;
    current = next;
  }
  return { y: prev, y1: current, e2 };
}
const MAX_ITER = 1_000_000;
const TINY = Math.sqrt(2.2250738585072014e-308);
const DBL_MAX = Number.MAX_VALUE;

function tgamma1pm1(v: number): number {
  return Math.expm1(lgamma1p(v));
}

/** cos(pi x), exact at half-integers */
function cospi(x: number): number {
  return sinpi(0.5 - Math.abs(x % 2));
}

/** J_v(x) by its power series (x small compared to v) */
function jSmallZ(v: number, x: number): number {
  const mult = -(x / 2) * (x / 2);
  let term = 1;
  let sum = 0;
  for (let n = 1; n < MAX_ITER; n++) {
    sum += term;
    term *= mult / (n * (n + v));
    if (Math.abs(term) <= EPS * Math.abs(sum)) break;
  }
  return seriesTimesPrefix(v, x, sum + term);
}

/**
 * Y_v(x) by its power series for x small compared to v (non-integer v), as m 2^e2 (the prefix can overflow while
 * the reflection formula still multiplies it by a small factor)
 */
function ySmallZ(v: number, x: number): Pow2 {
  let p = logHalf(x);
  let e2 = 0;
  const needLogs = v >= 170 || 709.78 / v < Math.abs(p);
  let prefix: number;
  if (!needLogs) {
    let gam = gamma(v);
    p = powHalf(x, v);
    if (DBL_MAX * p < gam) {
      gam *= 2 ** -1000;
      e2 = 1000;
    }
    prefix = -gam / (Math.PI * p);
  } else {
    const gam = lgamma(v);
    p = v * p;
    prefix = gam - Math.log(Math.PI) - p;
    if (709.78 < prefix) {
      const k = Math.ceil((prefix - 700) / Math.LN2);
      prefix -= k * Math.LN2;
      e2 = k;
    }
    prefix = -Math.exp(prefix);
  }
  const mult = -(x / 2) * (x / 2);
  let term = 1;
  let sum = 0;
  for (let n = 1; n < MAX_ITER; n++) {
    sum += term;
    term *= mult / (n * (n - v));
    if (Math.abs(term) <= EPS * Math.abs(sum)) break;
  }
  let result = (sum + term) * prefix;
  let prefix2: number;
  if (!needLogs) {
    prefix2 = (gamma(-v) * cospi(v) * p) / Math.PI;
  } else {
    const lg = lgammaSign(-v);
    prefix2 = (Math.exp(lg.value + p) * lg.sign) / Math.PI;
  }
  term = 1;
  let b = 0;
  for (let n = 1; n < MAX_ITER; n++) {
    b += term;
    term *= mult / (n * (n + v));
    if (Math.abs(term) <= EPS * Math.abs(b)) break;
  }
  b += term;
  result -= ldexp(prefix2 * b, -e2);
  return { m: result, e2 };
}

/** Hankel's asymptotic series P and Q (A&S 9.2.9, 9.2.10); false if it does not converge */
function hankelPQ(v: number, x: number): { p: number; q: number } | undefined {
  let p = 1;
  let q = 0;
  let k = 1;
  const z8 = 8 * x;
  let sq = 1;
  const mu = 4 * v * v;
  let term = 1;
  let ok = true;
  do {
    term *= (mu - sq * sq) / (k * z8);
    q += term;
    k += 1;
    sq += 2;
    const mult = (sq * sq - mu) / (k * z8);
    ok = Math.abs(mult) < 0.5;
    term *= mult;
    p += term;
    k += 1;
    sq += 2;
  } while (Math.abs(term) > 2 * EPS * p && ok);
  return ok ? { p, q } : undefined;
}

/** Y_u(x) and Y_(u+1)(x) by Temme's series (|u| <= 1/2, x <= 2) */
function temmeJY(u: number, x: number): [number, number] {
  const gp = tgamma1pm1(u);
  const gm = tgamma1pm1(-u);
  const spv = sinpi(u);
  const spv2 = sinpi(u / 2);
  const xp = powHalf(x, u);
  const a = logHalf(x);
  const sigma = -a * u;
  const d = Math.abs(sigma) < EPS ? 1 : Math.sinh(sigma) / sigma;
  const e = Math.abs(u) < EPS ? (u * Math.PI * Math.PI) / 2 : (2 * spv2 * spv2) / u;
  const g1 = u === 0 ? -0.5772156649015329 : (gp - gm) / ((1 + gp) * (1 + gm) * 2 * u);
  const g2 = (2 + gp + gm) / ((1 + gp) * (1 + gm) * 2);
  const vspv = Math.abs(u) < EPS ? 1 / Math.PI : u / spv;
  let f = (g1 * Math.cosh(sigma) - g2 * a * d) * 2 * vspv;
  let p = vspv / (xp * (1 + gm));
  let q = (vspv * xp) / (1 + gp);
  let g = f + e * q;
  let h = p;
  let coef = 1;
  let sum = coef * g;
  let sum1 = coef * h;
  const v2 = u * u;
  const coefMult = (-x * x) / 4;
  for (let k = 1; k < MAX_ITER; k++) {
    f = (k * f + p + q) / (k * k - v2);
    p /= k - u;
    q /= k + u;
    g = f + e * q;
    h = p - k * g;
    coef *= coefMult / k;
    sum += coef * g;
    sum1 += coef * h;
    if (Math.abs(coef * g) < Math.abs(sum) * EPS) break;
  }
  return [-sum, (-2 * sum1) / x];
}

/**
 * cf1JY in double-double, with b_k = 2 (v + k) / x formed from the exact v + k. For x ≫ v the continued fraction
 * needs about x terms in the region where it oscillates, and the rounding of v + k (which repeats with k) and of the
 * Lentz steps add up to 3e-13 relative at v = 575, x = 2211 even in double precision with exact b_k
 */
function cf1JYDD(v: number, x: number): { fv: number; sign: number } {
  let C: DD = [TINY, 0];
  let f: DD = [TINY, 0];
  let D: DD = [0, 0];
  let s = 1;
  const xd: DD = [x, 0];
  for (let k = 1; k < MAX_ITER * 100; k++) {
    const vk = twoSum(v, k);
    const b = ddDiv([2 * vk[0], 2 * vk[1]], xd);
    C = ddSub(b, ddDiv([1, 0], C));
    D = ddSub(b, D);
    if (C[0] === 0) C = [TINY, 0];
    if (D[0] === 0) D = [TINY, 0];
    D = ddDiv([1, 0], D);
    const delta = ddMul(C, D);
    f = ddMul(f, delta);
    if (D[0] < 0) s = -s;
    if (Math.abs(delta[0] - 1 + delta[1]) < EPS * EPS) break;
  }
  return { fv: -(f[0] + f[1]), sign: s };
}

/** fv = J_(v+1) / J_v by continued fraction (A&S 9.1.73, modified Lentz), and the sign of the denominator */
function cf1JY(v: number, x: number): { fv: number; sign: number } {
  if (x > 30) return cf1JYDD(v, x);
  // b_1 = Infinity (x below 1e-308) made every Lentz step Infinity * 0 = NaN, so the loop ran to its 1e8 limit; the
  // rest of the fraction is below (1/b_1)^2
  if (!Number.isFinite((2 * (v + 1)) / x)) return { fv: x / 2 / (v + 1), sign: 1 };
  let C = TINY;
  let f = TINY;
  let D = 0;
  let s = 1;
  for (let k = 1; k < MAX_ITER * 100; k++) {
    const b = (2 * (v + k)) / x;
    C = b - 1 / C;
    D = b - D;
    if (C === 0) C = TINY;
    if (D === 0) D = TINY;
    D = 1 / D;
    const delta = C * D;
    f *= delta;
    if (D < 0) s = -s;
    if (Math.abs(delta - 1) < 2 * EPS) break;
  }
  return { fv: -f, sign: s };
}

/** p + iq = (J' + iY') / (J + iY) by Steed's complex continued fraction, in real arithmetic (x > 1) */
function cf2JY(v: number, x: number): { p: number; q: number } {
  let fr = -0.5 / x;
  let fi = 1;
  let Cr = fr;
  let Ci = fi;
  const v2 = v * v;
  let a = (0.25 - v2) / x;
  const br = 2 * x;
  let bi = 2;
  let temp = Cr * Cr + 1;
  Ci = bi + (a * Cr) / temp;
  Cr = br + a / temp;
  let Dr = br;
  let Di = bi;
  if (Math.abs(Cr) + Math.abs(Ci) < TINY) Cr = TINY;
  if (Math.abs(Dr) + Math.abs(Di) < TINY) Dr = TINY;
  temp = Dr * Dr + Di * Di;
  Dr = Dr / temp;
  Di = -Di / temp;
  let dr = Cr * Dr - Ci * Di;
  let di = Ci * Dr + Cr * Di;
  temp = fr;
  fr = temp * dr - fi * di;
  fi = temp * di + fi * dr;
  for (let k = 2; k < MAX_ITER; k++) {
    a = k - 0.5;
    a *= a;
    a -= v2;
    bi += 2;
    temp = Cr * Cr + Ci * Ci;
    Cr = br + (a * Cr) / temp;
    Ci = bi - (a * Ci) / temp;
    Dr = br + a * Dr;
    Di = bi + a * Di;
    if (Math.abs(Cr) + Math.abs(Ci) < TINY) Cr = TINY;
    if (Math.abs(Dr) + Math.abs(Di) < TINY) Dr = TINY;
    temp = Dr * Dr + Di * Di;
    Dr = Dr / temp;
    Di = -Di / temp;
    dr = Cr * Dr - Ci * Di;
    di = Ci * Dr + Cr * Di;
    temp = fr;
    fr = temp * dr - fi * di;
    fi = temp * di + fi * dr;
    if (Math.abs(dr - 1) + Math.abs(di) < 2 * EPS) break;
  }
  return { p: fr, q: fi };
}

/** Amplitude of J and Y for large x (A&S 9.2.28) */
function asymAmplitude(v: number, x: number): number {
  let s = 1;
  const mu = 4 * v * v;
  let txq = 2 * x;
  txq *= txq;
  s += (mu - 1) / (2 * txq);
  s += (3 * (mu - 1) * (mu - 9)) / (txq * txq * 8);
  s += (15 * (mu - 1) * (mu - 9) * (mu - 25)) / (txq * txq * txq * 8 * 6);
  if (!Number.isFinite(s)) {
    // 4 v^2 or (2x)^6 overflows (besselJ(1e200, 1e50) was NaN): the terms as products of
    // (mu - c) / (2x)^2 = r^2 - c / (4 x^2), r = v / x
    const r = v / x;
    const c = (k: number) => r * r - k / (4 * x * x);
    const c1 = c(1);
    const c9 = c(9);
    s = 1 + c1 / 2 + (3 * c1 * c9) / 8 + (15 * c1 * c9 * c(25)) / 48;
  }
  // pi x overflows for x above 5.7e307 (besselJ(1e308, 0) was -0): the square roots apart
  return Number.isFinite(Math.PI * x) ? Math.sqrt((s * 2) / (Math.PI * x)) : Math.sqrt((s * 2) / Math.PI) / Math.sqrt(x);
}

/** Phase of J and Y for large x less (x - pi (v/2 + 1/4)) (A&S 9.2.29) */
function asymPhaseMx(v: number, x: number): number {
  const mu = 4 * v * v;
  let denom = 4 * x;
  const denomMult = denom * denom;
  let s = 0;
  s += (mu - 1) / (2 * denom);
  denom *= denomMult;
  s += ((mu - 1) * (mu - 25)) / (6 * denom);
  denom *= denomMult;
  s += ((mu - 1) * (mu * mu - 114 * mu + 1073)) / (5 * denom);
  denom *= denomMult;
  s += ((mu - 1) * (5 * mu * mu * mu - 1535 * mu * mu + 54703 * mu - 375733)) / (14 * denom);
  if (!Number.isFinite(s)) {
    // The powers overflow: (mu - 1) / (4x) = v r - 1 / (4x) times polynomials in rho = mu / (4x)^2 = r^2 / 4
    const r = v / x;
    const a1 = v * r - 1 / (4 * x);
    const rho = (r * r) / 4;
    const q = 1 / (16 * x * x); // 1 / (4x)^2, 0 where it underflows
    s = a1 / 2;
    s += (a1 * (rho - 25 * q)) / 6;
    s += (a1 * (rho * rho - 114 * rho * q + 1073 * q * q)) / 5;
    s += (a1 * (5 * rho * rho * rho - 1535 * rho * rho * q + 54703 * rho * q * q - 375733 * q * q * q)) / 14;
  }
  return s;
}

/**
 * v / 2 + 1/4 modulo 2 for the phase pi (v/2 + 1/4): for v >= 2^52 the 1/4 rounds away in v / 2 + 0.25 (besselJ(1e40,
 * 1e17) was 8.3 relative off), and v (an integer there) is reduced modulo 4 first, exactly. Below, v / 2 + 0.25 as
 * before (the bits of ordinary orders)
 */
function quarterPhase(v: number): number {
  return v >= 2 ** 52 ? (v % 4) / 2 + 0.25 : v / 2 + 0.25;
}

/**
 * Bound on the phase correction of the asymptotic expansion, about nu^2 / (2x): formed in double, its absolute error
 * is a few eps times itself, and the relative error of J and Y about 1e-16 times it (1.3e-9 at 5e7; no digit is left
 * beyond about 1e13)
 */
const MAX_ASYM_PHASE = 2 ** 26;

/** J_v and Y_v for large x (A&S 9.2.19), with the phase factored by addition formulas */
function asymJY(v: number, x: number, name: string, nu: number): { j: number; y: number } {
  const corr = (v * (v / x)) / 2;
  if (corr > MAX_ASYM_PHASE) {
    throw new RangeError(
      `${name}: x = ${x}, nu = ${nu} has a phase correction nu^2 / (2x) of about ${corr.toPrecision(3)}, ` +
        "which double precision does not resolve (at most 2^26)",
    );
  }
  const ampl = asymAmplitude(v, x);
  const phase = asymPhaseMx(v, x);
  const cx = Math.cos(x);
  const sx = Math.sin(x);
  const ci = cospi(quarterPhase(v));
  const si = sinpi(quarterPhase(v));
  const sp = Math.sin(phase);
  const cp = Math.cos(phase);
  const y = (sp * (cx * ci + sx * si) + cp * (sx * ci - cx * si)) * ampl;
  const j = (cp * (cx * ci + sx * si) - sp * (sx * ci - cx * si)) * ampl;
  return { j, y };
}

/**
 * Margin for the reflection formulas, which multiply Y_v by sin(pi v) or cos(pi v): for 1000 < v < 2^53 that is not
 * an integer (or a half-integer, for the cosine), the factor is at least sin(pi 2^-43) = 3.6e-13 = e^-28.7
 */
const REFLECT_MARGIN = 30;

/**
 * J and Y for v > LARGE_ORDER when the results are certainly out of range: J rounds to 0 by abs(J_v(x)) <=
 * (x/2)^v / Gamma(v + 1), and Y overflows by abs(Y_v(x)) >= Gamma(v) (2/x)^v / pi with Y_v(x) < 0, for x <= v - 1.
 * The latter holds as d/dx [x^v Y_v(x)] = x^v Y_(v-1)(x) < 0 below the first zero of Y_(v-1), which is beyond v - 1,
 * and x^v Y_v(x) tends to -Gamma(v) 2^v / pi as x -> 0. Undefined when the bounds do not decide (the recurrences then
 * take about v steps)
 */
function largeOrder(v: number, x: number, needY: boolean): { j: number; y: Pow2 } | undefined {
  const jB = logISeriesBounds(v, x);
  if (certainRange({ lo: -Infinity, hi: jB.lo, size: jB.size }) !== -1) return undefined;
  if (!needY) return { j: 0, y: { m: NaN, e2: 0 } };
  if (!(x <= v - 1)) return undefined;
  const a = v * (Math.LN2 - Math.log(x));
  const g = lgamma(v);
  const lo = g + a - Math.log(Math.PI) - REFLECT_MARGIN;
  if (certainRange({ lo, hi: Infinity, size: Math.abs(a) + Math.abs(g) + 2 }) !== 1) return undefined;
  return { j: 0, y: { m: -1, e2: Infinity } };
}

/**
 * Bounds on the time where the bounds of largeOrder do not decide (on the development machine): the continued fraction
 * cf1JY takes about x - v terms where it oscillates (x > v; about 0.16 to 0.4 us each in double-double), the backward
 * recurrence for J about v steps (about 5 ns each) and the forward recurrence for Y about v steps (about 45 ns each)
 */
const MAX_CF1_TERMS = 2 ** 25;
const MAX_J_STEPS = 2 ** 31;
const MAX_Y_STEPS = 2 ** 28;

/** RangeError before a continued fraction or a recurrence beyond the bounds above */
function checkTime(name: string, x: number, nu: number, cf1Terms: number, steps: number, maxSteps: number): void {
  if (cf1Terms > MAX_CF1_TERMS) {
    throw new RangeError(
      `${name}: x = ${x}, nu = ${nu} needs a continued fraction of about ${Math.round(cf1Terms)} terms (at most 2^25)`,
    );
  }
  if (steps > maxSteps) {
    const bound = maxSteps === MAX_J_STEPS ? "2^31" : "2^28";
    throw new RangeError(`${name}: x = ${x}, nu = ${nu} needs a recurrence of about ${steps} steps (at most ${bound})`);
  }
}

/**
 * J_v(x) and Y_v(x) for v >= 0, x > 0 (Boost's bessel_jy without the reflection). Y is returned as y / yScale.
 * needY: whether Y is wanted (J alone allows a cheaper series). name, nu: the caller and its order, for the bounds on
 * the time
 */
function besselJYPos(v: number, x: number, needY: boolean, name: string, nu: number): { j: number; y: Pow2 } {
  const n = Math.round(v);
  const u = v - n; // -1/2 < u <= 1/2
  const W = Number.isFinite(x * Math.PI) ? 2 / (x * Math.PI) : 2 / Math.PI / x; // Wronskian
  if (v > LARGE_ORDER) {
    const big = largeOrder(v, x, needY);
    if (big !== undefined) return big;
  }
  if (!needY && (x < 5 || v > (x * x) / 4)) return { j: jSmallZ(v, x), y: { m: NaN, e2: 0 } };
  if (x < 1 && u !== 0 && Math.log(EPS / 2) > v * Math.log(((x / 2) * (x / 2)) / v)) {
    return { j: jSmallZ(v, x), y: ySmallZ(v, x) };
  }
  if (Math.max(v, 1) < x * 0.011048543456039806) {
    // sqrt(forth root of epsilon)
    const a = asymJY(v, x, name, nu);
    return { j: a.j, y: { m: a.y, e2: 0 } };
  }
  if (x > 8) {
    const pq = hankelPQ(v, x);
    if (pq !== undefined) {
      const modV = quarterPhase(v) % 2;
      const sx = Math.sin(x);
      const cx = Math.cos(x);
      const sv = sinpi(modV);
      const cv = cospi(modV);
      const sc = sx * cv - sv * cx; // sin(chi)
      const cc = cx * cv + sx * sv; // cos(chi)
      const chi = Math.SQRT2 / (Math.sqrt(Math.PI) * Math.sqrt(x));
      return { j: chi * (pq.p * cc - pq.q * sc), y: { m: chi * (pq.p * sc + pq.q * cc), e2: 0 } };
    }
  }
  if (x <= 2) {
    checkTime(name, x, nu, 0, n, MAX_Y_STEPS);
    const [yu, yu1] = temmeJY(u, x);
    const r = yForward(u, x, n, yu, yu1);
    const { fv } = cf1JY(v, x);
    // Wronskian: J_v = W / (Y_v fv - Y_(v+1))
    const j = ldexp(W / (r.y * fv - r.y1), -r.e2);
    return { j, y: { m: r.y, e2: r.e2 } };
  }
  // x > 2: backward recurrence for J from CF1, then CF2 for the normalisation and Y_u
  const direct = x >= v && v > 2;
  checkTime(name, x, nu, x - v, direct ? 0 : n, needY ? MAX_Y_STEPS : MAX_J_STEPS);
  const { fv, sign: s } = cf1JY(v, x);
  if (direct) {
    // Beyond the turning point CF2 converges at order v itself, so Steed's method is applied there directly. Boost
    // goes down to u = v - round(v) and back up by recurrence, whose error grows with the number of steps
    // (1.2e-13 relative to the amplitude for Y at v = 575, x = 2211)
    const { p, q } = cf2JY(v, x);
    const t = v / x - fv; // J_v' / J_v
    let g = (p - t) / q;
    if (g === 0) g = (v * EPS) / x;
    const jv = s * Math.sqrt(W / (q + g * (p - t)));
    return { j: jv, y: { m: g * jv, e2: 0 } };
  }
  // Boost stops this recurrence when it would overflow (large v) and then guesses J_u' / J_u and the sign of J_u,
  // which gives Y the wrong sign (Y(5, 500) came out +Infinity); here it is rescaled by powers of 2 instead
  const init = TINY;
  let prev = fv * s * init;
  let current = s * init;
  let e2 = 0;
  for (let k = n; k > 0; k--) {
    const t = (2 * (u + k)) / x;
    if (Math.abs(current) > 2 ** 900) {
      prev *= 2 ** -900;
      current *= 2 ** -900;
      e2 += 900;
    }
    let next = t * current - prev;
    if (next === 0) next = (prev * EPS) / 2;
    prev = current;
    current = next;
  }
  const ratio = ldexp((s * init) / current, -e2); // J_v / J_u
  const fu = prev / current;
  const { p, q } = cf2JY(u, x);
  const t = u / x - fu; // J'/J
  let g = (p - t) / q;
  if (g === 0) g = (u * EPS) / x;
  const ju = Math.sign(current) * Math.sqrt(W / (q + g * (p - t)));
  const jv = ju * ratio;
  const yu = g * ju;
  const yu1 = yu * (u / x - p - q / g);
  if (!needY) return { j: jv, y: { m: NaN, e2: 0 } };
  const r = yForward(u, x, n, yu, yu1);
  return { j: jv, y: { m: r.y, e2: r.e2 } };
}

/**
 * Bessel function of the first kind. Equivalent to R's `besselJ(x, nu)`. Takes single numbers.
 *
 * @param x - Argument, `x >= 0` (`NaN` for negative `x`).
 * @param nu - Order, any real number. For `nu < 0`, `J(x, -nu) = cos(pi nu) J(x, nu) - sin(pi nu) Y(x, nu)`
 *   (A&S 9.1.2, as in R).
 * @returns J_nu(x).
 *
 * For `x` much larger than `nu` but below the range of the asymptotic expansion (`x < nu / 0.011`), the time grows
 * with `x` (a continued fraction of about `x - nu` terms): about 15 ms at `x = 5e4`, `nu = 1000`, 1.6 s at `x = 1e7`,
 * `nu = 2e5`. Near the turning point (`x` a little below `nu`) a recurrence takes about `nu` steps. Beyond 2^25 terms
 * of the continued fraction or 2^31 steps of the recurrence (2^28 for a negative non-integer order, which needs Y) a
 * RangeError is thrown before the computation. So it is in the asymptotic expansion (`x` above about `90 nu`) where
 * the phase correction `nu^2 / (2x)` exceeds 2^26, which double precision does not resolve.
 *
 * @example
 * ```ts
 * besselJ(1, 0);     // 0.7651976865579666
 * besselJ(10, 2.5);  // 0.1966584835818184
 * ```
 *
 * @category Special functions
 */
export function besselJ(x: number, nu: number): number {
  if (Number.isNaN(x) || Number.isNaN(nu) || x < 0 || !Number.isFinite(nu)) return NaN;
  const v = Math.abs(nu);
  const reflect = nu < 0 && nu !== Math.floor(nu);
  if (x === 0) {
    if (nu === 0) return 1;
    if (!reflect) return 0;
    // J_-v(0) = -sin(pi v) Y_v(0) with Y_v(0) = -Infinity
    return sinpi(v) > 0 ? Infinity : -Infinity;
  }
  if (x === Infinity) return 0;
  if (!reflect) {
    const j = besselJYPos(v, x, false, "besselJ", nu).j;
    return nu < 0 && v % 2 === 1 ? -j : j; // J_-n = (-1)^n J_n
  }
  const r = besselJYPos(v, x, true, "besselJ", nu);
  return cospi(v) * r.j - ldexp(sinpi(v) * r.y.m, r.y.e2);
}

/**
 * Bessel function of the second kind. Equivalent to R's `besselY(x, nu)`. Takes single numbers.
 *
 * @param x - Argument, `x >= 0` (`NaN` for negative `x`; `-Infinity` at 0).
 * @param nu - Order, any real number. For `nu < 0`, `Y(x, -nu) = sin(pi nu) J(x, nu) + cos(pi nu) Y(x, nu)`
 *   (A&S 9.1.2, as in R).
 * @returns Y_nu(x).
 *
 * For orders above 1000, results far out of the range of doubles are returned at once (`Infinity` or 0, decided by
 * bounds on their log); otherwise the time grows with the order (a recurrence of about `nu` steps): about 2.4 s for
 * `besselY(0.9e8, 1e8)`. Beyond 2^28 steps, or 2^25 terms of the continued fraction for `x` above `nu` (as for
 * {@link besselJ}), a RangeError is thrown before the computation, and likewise for a phase correction `nu^2 / (2x)`
 * beyond 2^26 in the asymptotic expansion for large `x`.
 *
 * @example
 * ```ts
 * besselY(1, 0);  // 0.08825696421567694
 * ```
 *
 * @category Special functions
 */
export function besselY(x: number, nu: number): number {
  if (Number.isNaN(x) || Number.isNaN(nu) || x < 0 || !Number.isFinite(nu)) return NaN;
  const v = Math.abs(nu);
  const reflect = nu < 0;
  if (x === 0) {
    if (!reflect) return -Infinity;
    // Y_-v(0) = sin(pi v) J_v(0) + cos(pi v) Y_v(0)
    const cp = cospi(v);
    if (cp === 0) return 0;
    return cp > 0 ? -Infinity : Infinity;
  }
  if (x === Infinity) return 0;
  const r = besselJYPos(v, x, true, "besselY", nu);
  if (!reflect) return ldexp(r.y.m, r.y.e2);
  const cp = cospi(v);
  const sp = sinpi(v);
  return (sp !== 0 ? sp * r.j : 0) + (cp === 0 ? 0 : ldexp(cp * r.y.m, r.y.e2));
}
