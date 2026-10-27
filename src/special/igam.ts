// Ported from xsf include/xsf/cephes/igam.h (xsf commit c6a3afe).
// Cephes Math Library Release 2.8, Copyright 1984, 1995, 2000 by Stephen L. Moshier.
// xsf Copyright (c) 2024, SciPy. BSD-3-Clause. See THIRD_PARTY_NOTICES.md.
//
// Regularized incomplete gamma functions P(a, x) and Q(a, x) = 1 - P(a, x).
// Changes from xsf
// - Both tails and the log are returned by one function. The log is formed directly from the result of each
//   series or continued fraction, never by taking the log of a value that over/underflowed in exp
// - The prefactor x^a e^-x / Gamma(a) is computed with Loader's dpoisRaw (= x^a e^-x / Gamma(a+1)),
//   to avoid cancellation in the log for large a and x

import { erfc, erfcxNonNegative } from "./erf.js";
import { SPLITTER } from "./dd.js";
import { MACHEP } from "./constants.js";
import { lgamma, lgamma1p } from "./gamma.js";
import { IGAM_ASYMP_COEFF_D, IGAM_ASYMP_COEFF_K, IGAM_ASYMP_COEFF_N } from "./igamAsympCoeff.js";
import { bd0dd, dpoisRaw, dpoisRawBoth } from "./loader.js";
import { log1pmx } from "./log1pmx.js";

// xsf uses 2000. For a around 1e6 with x close to a, the series and continued fraction take thousands of iterations, so raise it
const MAXITER = 10_000_000;
const SMALL = 20;
const LARGE = 200;
const SMALLRATIO = 0.3;
const LARGERATIO = 4.5;
const BIG = 4.503599627370496e15;
const BIGINV = 2.22044604925031308085e-16;

/** Series for P(a, x) (DLMF 8.11.4) */
function igamSeries(a: number, x: number, log: boolean): number {
  const ans = igamSeriesSum(a, x);
  // x^a e^-x / Gamma(a) * ans / a = dpoisRaw(a, x) * ans
  return log ? dpoisRaw(a, x, true) + Math.log(ans) : dpoisRaw(a, x, false) * ans;
}

/** [log, linear] of igamSeries */
function igamSeriesBoth(a: number, x: number): [number, number] {
  const ans = igamSeriesSum(a, x);
  const d = dpoisRawBoth(a, x);
  return [d[0] + Math.log(ans), d[1] * ans];
}

/** sum_n x^n / ((a + 1) ... (a + n)): P(a, x) = x^a e^-x / Gamma(a + 1) times this */
export function igamSeriesSum(a: number, x: number): number {
  if (a > 1000 && x > 0.97 * a) return igamSeriesSumDD(a, x);
  let r = a;
  let c = 1;
  let ans = 1;
  for (let i = 0; i < MAXITER; i++) {
    r += 1;
    c *= x / r;
    ans += c;
    if (c <= MACHEP * ans) break;
  }
  return ans;
}

/**
 * igamSeriesSum in double-double, for large a with x above 0.97 a (the mpmath audit needs it from about there; below,
 * the series is short enough for double). The terms then shrink slowly (ratio x / (a + n) close to 1, thousands
 * of terms), and in double precision the roundings of the ratios, correlated between neighbouring terms, add up to
 * 2e-14 relative; stopping at c <= eps ans also leaves out a tail of up to c (a + n) / (a + n - x). Written out on
 * scalars (no arrays), as the loop is long
 */
const TAIL = 2 ** -64;

export function igamSeriesSumDD(a: number, x: number): number {
  let ch = 1;
  let cl = 0;
  let ah = 1;
  let al = 0;
  for (let i = 1; i < MAXITER; i++) {
    // d = a + i exactly (dh + dl)
    const dh = a + i;
    const bb = dh - a;
    const dl = a - (dh - bb) + (i - bb);
    // q = x / d: q1 + q2
    const q1 = x / dh;
    let t = SPLITTER * q1;
    const q1h = t - (t - q1);
    const q1l = q1 - q1h;
    t = SPLITTER * dh;
    const dhh = t - (t - dh);
    const dhl = dh - dhh;
    const p = q1 * dh;
    const pe = q1h * dhh - p + q1h * dhl + q1l * dhh + q1l * dhl;
    const q2 = (x - p - pe - q1 * dl) / dh;
    // c = c q
    t = SPLITTER * ch;
    const chh = t - (t - ch);
    const chl = ch - chh;
    const m = ch * q1;
    const me = chh * q1h - m + chh * q1l + chl * q1h + chl * q1l + (ch * q2 + cl * q1);
    ch = m + me;
    cl = me - (ch - m);
    // ans += c
    const s = ah + ch;
    const sb = s - ah;
    const e = ah - (s - sb) + (ch - sb) + (al + cl);
    ah = s + e;
    al = e - (ah - s);
    // the rest is at most c q / (1 - q) (q decreasing); stop once that is below 2^-64 ans, well under the
    // rounding of the double result
    if (ch * q1 <= TAIL * ah * (1 - q1)) break;
  }
  return ah + al;
}

/** Continued fraction for Q(a, x) (DLMF 8.9.2) */
function igamcContinuedFraction(a: number, x: number, log: boolean): number {
  const ans = igamcContinuedFractionValue(a, x);
  // x^a e^-x / Gamma(a) * ans = a * dpoisRaw(a, x) * ans
  return log
    ? Math.log(a) + dpoisRaw(a, x, true) + Math.log(ans)
    : a * dpoisRaw(a, x, false) * ans;
}

/** [log, linear] of igamcContinuedFraction */
function igamcContinuedFractionBoth(a: number, x: number): [number, number] {
  const ans = igamcContinuedFractionValue(a, x);
  const d = dpoisRawBoth(a, x);
  return [Math.log(a) + d[0] + Math.log(ans), a * d[1] * ans];
}

/** The continued fraction of DLMF 8.9.2: Q(a, x) = x^a e^-x / Gamma(a) times this */
export function igamcContinuedFractionValue(a: number, x: number): number {
  if (x > 1e20) return igamcContinuedFractionLentz(a, x);
  let y = 1 - a;
  let z = x + y + 1;
  let c = 0;
  let pkm2 = 1;
  let qkm2 = x;
  let pkm1 = x + 1;
  let qkm1 = z * x;
  let ans = pkm1 / qkm1;
  for (let i = 0; i < MAXITER; i++) {
    c += 1;
    y += 1;
    z += 2;
    const yc = y * c;
    const pk = pkm1 * z - pkm2 * yc;
    const qk = qkm1 * z - qkm2 * yc;
    let t: number;
    if (qk !== 0) {
      const r = pk / qk;
      t = Math.abs((ans - r) / r);
      ans = r;
    } else {
      t = 1;
    }
    pkm2 = pkm1;
    pkm1 = pk;
    qkm2 = qkm1;
    qkm1 = qk;
    if (Math.abs(pk) > BIG) {
      pkm2 *= BIGINV;
      pkm1 *= BIGINV;
      qkm2 *= BIGINV;
      qkm1 *= BIGINV;
    }
    if (t <= MACHEP) break;
  }
  return ans;
}

/**
 * The same continued fraction by the modified Lentz method (only ratios are kept, so nothing grows). For large x
 * the convergents above overflow: the first denominator is already (x + 2 - a) x, and each step multiplies by about x
 * while the rescaling divides by only 2^52 (pgamma(7.2e60, 6.1e55), ppois(3.66e124, 8.1e125) and ppois(3.4e240,
 * 5.5e241) were NaN). Used above 1e20, where overflow takes about 70 steps or fewer
 */
function igamcContinuedFractionLentz(a: number, x: number): number {
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < MAXITER; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) <= MACHEP) break;
  }
  return h;
}

/** Q(a, x) by DLMF 8.7.3. For small x (the value does not approach 0) */
function igamcSeries(a: number, x: number): number {
  let fac = 1;
  let sum = 0;
  for (let n = 1; n < MAXITER; n++) {
    fac *= -x / n;
    const term = fac / (a + n);
    sum += term;
    if (Math.abs(term) <= MACHEP * Math.abs(sum)) break;
  }
  const logx = Math.log(x);
  const L = a * logx - lgamma1p(a);
  const term = -Math.expm1(L);
  // x^a / Gamma(a) = a x^a / Gamma(a + 1). lgamma(a) is large for small a (23 at a = 1e-10) and its rounding
  // would remain, so rewrite with lgamma1p (a change from xsf)
  return term - a * Math.exp(L) * sum;
}

/** Temme's uniform asymptotic expansion for a close to x (DLMF 8.12.3/8.12.4) */
function asymptoticSeries(a: number, x: number, lower: boolean): number {
  const sgn = lower ? -1 : 1;
  const eta = temmeEta(a, x);
  let res = 0.5 * erfc(sgn * eta * Math.sqrt(a / 2));
  res += (sgn * Math.exp(-0.5 * a * eta * eta) * temmeSum(a, eta)) / Math.sqrt(2 * Math.PI * a);
  return res;
}

/** η of Temme's expansion: η^2 / 2 = λ - 1 - log λ (λ = x / a), with the sign of λ - 1 */
function temmeEta(a: number, x: number): number {
  const lambda = x / a;
  const sigma = (x - a) / a;
  if (lambda > 1) return Math.sqrt(-2 * log1pmx(sigma));
  if (lambda < 1) return -Math.sqrt(-2 * log1pmx(sigma));
  return 0;
}

/** Σ_k c_k(η) a^-k of Temme's expansion */
function temmeSum(a: number, eta: number): number {
  const etapow = new Array<number>(IGAM_ASYMP_COEFF_N).fill(0);
  etapow[0] = 1;
  let maxpow = 0;
  let sum = 0;
  let afac = 1;
  let absoldterm = Infinity;
  for (let k = 0; k < IGAM_ASYMP_COEFF_K; k++) {
    const dk = IGAM_ASYMP_COEFF_D[k]!;
    let ck = dk[0]!;
    for (let n = 1; n < IGAM_ASYMP_COEFF_N; n++) {
      if (n > maxpow) {
        etapow[n] = eta * etapow[n - 1]!;
        maxpow += 1;
      }
      const ckterm = dk[n]! * etapow[n]!;
      ck += ckterm;
      if (Math.abs(ckterm) < MACHEP * Math.abs(ck)) break;
    }
    const term = ck * afac;
    const absterm = Math.abs(term);
    if (absterm > absoldterm) break;
    sum += term;
    if (absterm < MACHEP * Math.abs(sum)) break;
    absoldterm = absterm;
    afac /= a;
  }
  return sum;
}

/** xsf's region for Temme's expansion: |x - a| / a below 0.3 for 20 < a < 200, within 4.5 standard deviations for larger a */
function xsfAsymptotic(a: number, absxmaA: number): boolean {
  return (a > SMALL && a < LARGE && absxmaA < SMALLRATIO) || (a > LARGE && absxmaA < LARGERATIO / Math.sqrt(a));
}

/**
 * Above this a, Temme's expansion is used at every x (below 1e15 a): the double-double series of P overflows in its
 * products of terms around a (pgamma(0.99 * 2^1000, 2^1000) was NaN after 0.1 s), and only the leading term of the
 * expansion is left
 */
const HUGE_A = 1e299;

/**
 * Beyond xsf's region, Temme's expansion is also used for a > 200 with |x - a| / a below 1e-3. There the series and
 * the continued fraction need about 40 a / |x - a| terms (beyond 10^7 for a above 1e14: ppois(3.28e19 + 1e11, 3.28e19)
 * took 0.15 s per call and stopped short of convergence), while η is below 1e-3 and the expansion converges in a few
 * terms; and at every x above HUGE_A. See temmeTail for the form used.
 */
const farAsymptotic = (a: number, absxmaA: number): boolean => a > LARGE && (absxmaA < 1e-3 || a > HUGE_A);

/**
 * [log, linear] of the smaller tail (the upper if x > a) by Temme's expansion, in the form
 *   e^(-a η^2 / 2) (erfcx(y) / 2 ± S / sqrt(2π a)),   y = |η| sqrt(a / 2),
 * with a η^2 / 2 = a log(a / x) + x - a computed as Loader's bd0 in double-double. Forming erfc(y) and
 * e^(-a η^2 / 2) from η directly carries the rounding of η times a η^2 (1e-14 relative at 11 standard deviations)
 */
function temmeTail(a: number, x: number): [number, number] {
  const e = bd0dd(a, [x, 0]);
  const sgn = x > a ? 1 : -1;
  const eta = temmeEta(a, x);
  // Beyond a = 1e299 the sum is c_0(η) alone (the next term is c_1 / a), used for any x there (see farAsymptotic):
  // in closed form c_0 = 1/(λ - 1) - 1/η away from η = 0, where the power series in η no longer converges
  const s = a > HUGE_A && Math.abs(eta) > 0.1 ? 1 / ((x - a) / a) - 1 / eta : temmeSum(a, eta);
  const b = 0.5 * erfcxNonNegative(Math.sqrt(e[0] + e[1])) + (sgn * s) / Math.sqrt(2 * Math.PI * a);
  // (far below the subnormals e[1], half an ulp of E, can exceed 1)
  return [-e[0] - e[1] + Math.log(b), e[0] > 2000 ? 0 : Math.exp(-e[0]) * (1 - e[1]) * b];
}

/** [log, linear] of P(a, x) (Q if !lower) in the region of farAsymptotic */
function farTail(a: number, x: number, lower: boolean): [number, number] {
  const [log, lin] = temmeTail(a, x);
  return (x > a) !== lower ? [log, lin] : [Math.log1p(-lin), 1 - lin];
}

/**
 * Decide which tail to compute directly and return its value. Same case split as xsf's igamc.
 * The directly computed side is the smaller tail (roughly at most 1/2).
 */
function directTail(a: number, x: number, log: boolean): { lower: boolean; value: number } {
  if (x > 1.1) {
    return x < a
      ? { lower: true, value: igamSeries(a, x, log) }
      : { lower: false, value: igamcContinuedFraction(a, x, log) };
  }
  const useSeries = x <= 0.5 ? -0.4 / Math.log(x) < a : x * 1.1 < a;
  if (useSeries) return { lower: true, value: igamSeries(a, x, log) };
  const q = igamcSeries(a, x);
  return { lower: false, value: log ? Math.log(q) : q };
}

/** Both the log and linear value of directTail (same values as directTail(.., true) and directTail(.., false)) */
function directTailBoth(a: number, x: number): { lower: boolean; log: number; lin: number } {
  if (x > 1.1) {
    const [log, lin] = x < a ? igamSeriesBoth(a, x) : igamcContinuedFractionBoth(a, x);
    return { lower: x < a, log, lin };
  }
  const useSeries = x <= 0.5 ? -0.4 / Math.log(x) < a : x * 1.1 < a;
  if (useSeries) {
    const [log, lin] = igamSeriesBoth(a, x);
    return { lower: true, log, lin };
  }
  const q = igamcSeries(a, x);
  return { lower: false, log: Math.log(q), lin: q };
}

/**
 * Return [log, linear] of gammaInc from a single series/continued-fraction computation.
 * The values are bit-identical to gammaInc(.., true) and gammaInc(.., false) respectively
 * (used by the Newton iteration for quantiles, which needs both at the same x)
 */
export function gammaIncBoth(a: number, x: number, lower: boolean): [number, number] {
  if (Number.isNaN(a) || Number.isNaN(x)) return [NaN, NaN];
  if (x < 0 || a < 0) return [NaN, NaN];
  if (a === 0) {
    if (x > 0) return lower ? [0, 1] : [-Infinity, 0];
    return [NaN, NaN];
  }
  if (x === 0) return lower ? [-Infinity, 0] : [0, 1];
  if (a === Infinity) {
    if (x === Infinity) return [NaN, NaN];
    return lower ? [-Infinity, 0] : [0, 1];
  }
  if (x === Infinity) return lower ? [0, 1] : [-Infinity, 0];
  if (x > 1e15 * Math.max(a, 1)) {
    const lq = (a - 1) * Math.log(x) - x - lgamma(a) + Math.log1p((a - 1) / x);
    if (lower) return [Math.log1p(-Math.exp(lq)), -Math.expm1(lq)];
    return [lq, Math.exp(lq)];
  }
  const absxmaA = Math.abs(x - a) / a;
  if (xsfAsymptotic(a, absxmaA)) {
    const v = asymptoticSeries(a, x, lower);
    return [v > 0.5 ? Math.log1p(-asymptoticSeries(a, x, !lower)) : Math.log(v), v];
  }
  if (farAsymptotic(a, absxmaA)) return farTail(a, x, lower);
  const d = directTailBoth(a, x);
  if (d.lower === lower) return [d.log, d.lin];
  return [d.lin > 0 ? Math.log1p(-d.lin) : -Math.exp(d.log), 1 - d.lin];
}

/**
 * Regularized incomplete gamma function: P(a, x) if lower, otherwise Q(a, x).
 * Returns the natural log if log.
 */
export function gammaInc(a: number, x: number, lower: boolean, log: boolean): number {
  if (Number.isNaN(a) || Number.isNaN(x)) return NaN;
  if (x < 0 || a < 0) return NaN;
  const zero = log ? -Infinity : 0;
  const one = log ? 0 : 1;
  if (a === 0) {
    if (x > 0) return lower ? one : zero;
    return NaN;
  }
  if (x === 0) return lower ? zero : one;
  if (a === Infinity) {
    if (x === Infinity) return NaN;
    return lower ? zero : one;
  }
  if (x === Infinity) return lower ? one : zero;

  // x ≫ a: Q(a, x) ≈ x^(a-1) e^-x / Gamma(a) (1 + (a-1)/x). The next term is about ((a-1)/x)^2 and negligible.
  // (For x above 1e154 the first term z x of the continued fraction overflows, so switch before that)
  if (x > 1e15 * Math.max(a, 1)) {
    const lq = (a - 1) * Math.log(x) - x - lgamma(a) + Math.log1p((a - 1) / x);
    if (lower) return log ? Math.log1p(-Math.exp(lq)) : -Math.expm1(lq);
    return log ? lq : Math.exp(lq);
  }

  /* Asymptotic regime where a ~ x: both tails can be computed directly */
  const absxmaA = Math.abs(x - a) / a;
  if (xsfAsymptotic(a, absxmaA)) {
    const v = asymptoticSeries(a, x, lower);
    if (!log) return v;
    // The log of a value near 1 is built with log1p from the small value of the other side
    return v > 0.5 ? Math.log1p(-asymptoticSeries(a, x, !lower)) : Math.log(v);
  }
  if (farAsymptotic(a, absxmaA)) return farTail(a, x, lower)[log ? 0 : 1];

  if (log) {
    const d = directTail(a, x, true);
    if (d.lower === lower) return d.value;
    // The log of the other side, log(1 - v), is built with log1p from v computed directly, not via its log
    const v = directTail(a, x, false).value;
    return v > 0 ? Math.log1p(-v) : -Math.exp(d.value);
  }
  const d = directTail(a, x, false);
  return d.lower === lower ? d.value : 1 - d.value;
}
