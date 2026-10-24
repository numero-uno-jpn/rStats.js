// Ported from xsf include/xsf/cephes/incbet.h (xsf commit c6a3afe).
// Cephes Math Library Release 2.8, Copyright 1984, 1995, 2000 by Stephen L. Moshier.
// xsf Copyright (c) 2024, SciPy. BSD-3-Clause. See THIRD_PARTY_NOTICES.md.
//
// Regularized incomplete beta function I_x(a, b) and 1 - I_x(a, b).
// Changes from xsf
// - x and 1 - x are taken separately (the caller can often form 1 - x accurately,
//   e.g. n/(n + t^2) and t^2/(n + t^2) for the t distribution)
// - For each tail, choose the frame in which it can be computed directly (I_x(a,b) or I_{1-x}(b,a)),
//   because forming it as 1 - (the other) loses digits in the smaller tail
// - The factor x^a (1-x)^b / B(a, b) in front of the series and continued fractions is computed with
//   Loader's dbinomRaw (avoids cancellation in the log for large a, b)
// - The log is formed directly from the result of each computation

import { MACHEP } from "./constants.js";
import { dbinomExponent, dbinomRawDD } from "./loader.js";
import { ddAdd, ddDiv, ddLog, ddMul, ddMulNum, ddSub, twoProd, twoSum, type DD } from "./dd.js";
import { lgamma1p } from "./gamma.js";
import { lgammaDiff } from "./lgammaDiff.js";
import { betaIncTemme, TEMME_MIN_M } from "./incbetTemme.js";

const BIG = 4.503599627370496e15;
const BIGINV = 2.22044604925031308085e-16;

/**
 * Log of x^a (1-x)^b / B(a, b).
 * Since dbinom(a; a + b, x) = Gamma(a+b+1)/(Gamma(a+1) Gamma(b+1)) x^a (1-x)^b
 * (a and b are passed separately; recovering them from a + b loses digits of the smaller one),
 * x^a (1-x)^b / B(a, b) = dbinom(a; a+b, x) * a b / (a + b).
 */
function logPrefactor(a: number, b: number, x: DD, xc: DD): number {
  return dbinomRawDD(a, b, x, xc, true) + Math.log(a) + Math.log(b) - Math.log(a + b);
}

/** Linear value of x^a (1-x)^b / B(a, b) (0 on underflow) */
function prefactor(a: number, b: number, x: DD, xc: DD): number {
  return dbinomRawDD(a, b, x, xc, false) * ((a * b) / (a + b));
}

/** Lower limit of normal numbers. If the prefactor is larger, multiply on the linear scale */
const NORMAL_MIN = 2.2250738585072014e-308 * 1e3;

/**
 * m x^a (1-x)^b / B(a, b) for a prefactor below NORMAL_MIN (m a moderate factor such as the series sum).
 * Going through the log would round an exponent near -708 to 0.5 ulp, which is 1e-13 relative after exp,
 * so the exponent of dbinom(a; a+b, x) is kept in double-double and exp is taken once at the end.
 * (multiplying by exp(-700) last rounds once, so a subnormal result is still correctly rounded).
 * Returns undefined when the result underflows to 0 (the caller then works on the log scale)
 */
function smallPrefactorTimes(a: number, b: number, x: DD, xc: DD, m: number): number | undefined {
  const { e } = dbinomExponent(a, b, x, xc);
  const c = (m * ((a * b) / (a + b))) / Math.sqrt(2 * Math.PI * a * (b / (a + b)));
  if (!(e[0] < 1400) || !Number.isFinite(c) || c === 0) return undefined;
  const v = Math.exp(700 - e[0]) * (1 - e[1]) * c * Math.exp(-700);
  return v > 0 ? v : undefined;
}

/**
 * Series sum S = Σ_{n>=1} (1-b)_n / n! x^n / (a + n) (the core of xsf's pseries).
 * xsf stops on the relative error of the sum including 1/a; here we stop on S itself
 * (for small a, 1/a is large and xsf's criterion leaves S insufficiently accurate).
 */
function pseriesSum(a: number, b: number, x: number): number {
  let u = (1 - b) * x;
  let v = u / (a + 1);
  const t1 = v;
  let t = u;
  let n = 2;
  let s = 0;
  while (Math.abs(v) > MACHEP * Math.abs(s + t1) || n < 4) {
    if (n > 1e7) break;
    u = ((n - b) * x) / n;
    t *= u;
    v = t / (a + n);
    s += v;
    n += 1;
  }
  return s + t1;
}

/**
 * Compute 1 - I_x(a, b) without subtraction in the series region (b x <= 1, x <= 0.95).
 * Since I_x(a, b) = E (1 + a S) with E = x^a Gamma(a+b) / (Gamma(a+1) Gamma(b)) = exp(L),
 *   1 - I = -expm1(L) - E a S,  L = a log x + [lgamma(b+a) - lgamma(b)] - lgamma1p(a)
 * For small a, I is close to 1 and forming 1 - I by subtraction loses digits (1e-7 relative at a = 1e-10).
 * (Derived from the definition of the series)
 */
function pseriesComplement(a: number, b: number, xd: DD, log: boolean): number {
  const x = xd[0];
  const L = a * (Math.log(x) + xd[1] / x) + lgammaDiff(a, b) - lgamma1p(a);
  const E = Math.exp(L);
  const v = -Math.expm1(L) - E * a * pseriesSum(a, b, x);
  return log ? Math.log(v) : v;
}

/** Series (when b x is small and x is not close to 1). Returns I_x(a, b) */
function pseries(a: number, b: number, xd: DD, xcd: DD, log: boolean): number {
  const x = xd[0];
  const ai = 1 / a;
  let u = (1 - b) * x;
  let v = u / (a + 1);
  const t1 = v;
  let t = u;
  let n = 2;
  let s = 0;
  const z = MACHEP * ai;
  while (Math.abs(v) > z) {
    u = ((n - b) * x) / n;
    t *= u;
    v = t / (a + n);
    s += v;
    n += 1;
  }
  s += t1;
  s += ai;
  // I = s x^a / B(a, b) = s * [x^a (1-x)^b / B(a,b)] * (1-x)^(-b)
  // (1-x)^b is formed as exp(b log1p(-x)) rather than a power of the rounded xc. The rounding error of xc
  // would be amplified b times (4e-12 relative at b = 1e5); in this region x <= 1/b is small and log1p is accurate
  const l1m = log1pNeg(xd);
  if (!log) {
    const pf = prefactor(a, b, xd, xcd);
    if (pf > NORMAL_MIN) return (s * pf) / Math.exp(b * l1m);
    const v = smallPrefactorTimes(a, b, xd, xcd, s / Math.exp(b * l1m));
    if (v !== undefined) return v;
  }
  const lv = Math.log(s) + logPrefactor(a, b, xd, xcd) - b * l1m;
  return log ? lv : Math.exp(lv);
}

/**
 * Evaluate continued fraction #1 / #2 in double-double.
 *
 * The coefficients are multiplied by x (or z = x/(1-x)), so the rounding error of x enters every coefficient in
 * the same direction. For large a with x near the mean the continued fraction is extremely sensitive to this:
 * the rounding of x = 0.999 (1e-19) alone shifts the result by 6e-13 relative (measured at a = 1e5, b = 100;
 * reference values checked with Rmpfr). So x is kept as an exact double-double and the recurrence also runs in
 * double-double.
 *
 * For the same reason a + b and b - 1 are kept in double-double: with a ≫ b, rounding a + b loses digits of b
 * (5e-11 relative at a = 1e8, b = 0.01, x = 1 - 1e-6; checked against mpmath). From 2^52 on, the steps k += 1 of
 * the other coefficients would be lost as well, so there every coefficient is a double-double (huge)
 */
function continuedFractionCore(a: number, b: number, xd: DD, xcd: DD, second: boolean): number {
  // #1: coefficients use x; #2: coefficients use z = x/(1-x)
  const z: DD = second ? ddDiv(xd, xcd) : xd;
  const huge = Math.max(a, b) >= 2 ** 52;
  // Partial numerators k1 x k2 / (k3 k4) and k5 x k6 / (k7 k8). k1, k3, k4, k7, k8 are doubles, with
  // double-double copies (h1, ...) that are used and advanced only when huge
  let k1 = a;
  let k2: DD = second ? twoSum(b, -1) : twoSum(a, b);
  let k3 = a;
  let k4 = a + 1;
  let k5 = 1;
  let k6: DD = second ? twoSum(a, b) : twoSum(b, -1);
  let k7 = a + 1;
  let k8 = a + 2;
  let h1: DD = [a, 0];
  let h3: DD = [a, 0];
  let h4: DD = twoSum(a, 1);
  let h7: DD = twoSum(a, 1);
  let h8: DD = twoSum(a, 2);
  const d1 = second ? -1 : 1;
  let pkm2: DD = [0, 0];
  let qkm2: DD = [1, 0];
  let pkm1: DD = [1, 0];
  let qkm1: DD = [1, 0];
  let ans: DD = [1, 0];
  for (let n = 0; n < 100000; n++) {
    let xk = huge
      ? ddDiv(ddMul(ddMul(z, h1), k2), ddMul(h3, h4))
      : ddDiv(ddMul(ddMulNum(z, k1), k2), twoProd(k3, k4));
    let pk = ddSub(pkm1, ddMul(pkm2, xk));
    let qk = ddSub(qkm1, ddMul(qkm2, xk));
    pkm2 = pkm1;
    pkm1 = pk;
    qkm2 = qkm1;
    qkm1 = qk;
    xk = ddDiv(ddMul(ddMulNum(z, k5), k6), huge ? ddMul(h7, h8) : twoProd(k7, k8));
    pk = ddAdd(pkm1, ddMul(pkm2, xk));
    qk = ddAdd(qkm1, ddMul(qkm2, xk));
    pkm2 = pkm1;
    pkm1 = pk;
    qkm2 = qkm1;
    qkm1 = qk;
    if (qk[0] !== 0) {
      const r = ddDiv(pk, qk);
      const t = r[0] !== 0 ? Math.abs((ans[0] - r[0]) / r[0]) : 1;
      ans = r;
      if (t < MACHEP && n > 1) break;
    }
    k2 = ddAdd(k2, [d1, 0]);
    k6 = ddAdd(k6, [-d1, 0]);
    k5 += 1;
    if (huge) {
      h1 = ddAdd(h1, [1, 0]);
      h3 = ddAdd(h3, [2, 0]);
      h4 = ddAdd(h4, [2, 0]);
      h7 = ddAdd(h7, [2, 0]);
      h8 = ddAdd(h8, [2, 0]);
    } else {
      k1 += 1;
      k3 += 2;
      k4 += 2;
      k7 += 2;
      k8 += 2;
    }
    const mag = Math.abs(qk[0]) + Math.abs(pk[0]);
    if (mag > BIG) {
      pkm2 = ddMulNum(pkm2, BIGINV);
      pkm1 = ddMulNum(pkm1, BIGINV);
      qkm2 = ddMulNum(qkm2, BIGINV);
      qkm1 = ddMulNum(qkm1, BIGINV);
    }
    if (Math.abs(qk[0]) < BIGINV || Math.abs(pk[0]) < BIGINV) {
      pkm2 = ddMulNum(pkm2, BIG);
      pkm1 = ddMulNum(pkm1, BIG);
      qkm2 = ddMulNum(qkm2, BIG);
      qkm1 = ddMulNum(qkm1, BIG);
    }
  }
  return ans[0] + ans[1];
}

/** Whether the series can be used in frame (a, b, x) */
function pseriesOk(a: number, b: number, x: number): boolean {
  return b * x <= 1 && x <= 0.95;
}

/** Whether to compute I_x(a, b) by continued fraction in frame (a, b, x) (below the mean, as in xsf) */
function cfOk(a: number, b: number, x: number): boolean {
  return x <= a / (a + b);
}

/** Compute I_x(a, b) by continued fraction */
function continuedFraction(a: number, b: number, xd: DD, xcd: DD, log: boolean): number {
  const x = xd[0];
  const xc = xcd[0];
  /* Choose expansion for better convergence */
  const y = x * (a + b - 2) - (a - 1);
  const w = y < 0 ? continuedFractionCore(a, b, xd, xcd, false) : continuedFractionCore(a, b, xd, xcd, true) / xc;
  // I = x^a (1-x)^b / (a B(a, b)) * w
  if (!log) {
    const pf = prefactor(a, b, xd, xcd);
    // w / a first: pf / a can fall into the subnormal range for huge a (1e-316 at a = 7e18) and lose digits
    if (pf > NORMAL_MIN) return pf * (w / a);
    const v = smallPrefactorTimes(a, b, xd, xcd, w / a);
    if (v !== undefined) return v;
  }
  const lv = logPrefactor(a, b, xd, xcd) - Math.log(a) + Math.log(w);
  return log ? lv : Math.exp(lv);
}

/**
 * Regularized incomplete beta function: I_x(a, b) if lower, otherwise 1 - I_x(a, b).
 * The caller passes xc = 1 - x accurately. Assumes a, b > 0 and 0 <= x <= 1.
 *
 * The requested tail is computed by the first applicable subtraction-free method in this order:
 * 1. series in that tail's frame  2. complement of the series in the opposite frame (pseriesComplement)
 * 3. continued fraction in that tail's frame  4. 1 - (other side) from the continued fraction in the opposite frame
 * (the lower frame is (a, b, x); the upper is (b, a, 1-x) via 1 - I_x(a,b) = I_{1-x}(b, a))
 */
export function betaInc(a: number, b: number, x: number, xc: number, lower: boolean, log: boolean): number {
  if (x <= 0) return lower ? (log ? -Infinity : 0) : log ? 0 : 1;
  if (xc <= 0) return lower ? (log ? 0 : 1) : log ? -Infinity : 0;
  // Take the smaller of x and 1 - x as the base and form the other exactly in double-double
  // (for pbeta(q), either q or 1 - q is exact, and then the other is free of rounding too)
  const xd: DD = x <= xc ? [x, 0] : twoSum(1, -xc);
  const xcd: DD = x <= xc ? twoSum(1, -x) : [xc, 0];
  return betaIncDD(a, b, xd, xcd, lower, log);
}

/**
 * Version of betaInc taking x and 1 - x in double-double.
 * When x is itself computed, as in n/(n + t^2) for the t distribution, its rounding (0.5 ulp) is amplified
 * a times (3e-14 at a = 500), so the caller builds it in double-double and passes it as is.
 */
export function betaIncDD(a: number, b: number, xd: DD, xcd: DD, lower: boolean, log: boolean): number {
  const r = betaIncCore(a, b, xd, xcd, lower, log);
  return log ? r[0] : r[1];
}

/**
 * Return both the log and the linear value of betaIncDD from a single core computation ([log, linear]).
 * Used by the Newton iteration for quantiles, which needs both the log and linear distribution function at the same x.
 * The values are bit-identical to betaIncDD(..., true) and betaIncDD(..., false) respectively
 */
export function betaIncBothDD(a: number, b: number, xd: DD, xcd: DD, lower: boolean): [number, number] {
  return betaIncCore(a, b, xd, xcd, lower, true);
}

/** Version of betaInc returning both (takes x and 1 - x in double precision, like betaInc) */
export function betaIncBoth(a: number, b: number, x: number, xc: number, lower: boolean): [number, number] {
  if (x <= 0) return lower ? [-Infinity, 0] : [0, 1];
  if (xc <= 0) return lower ? [0, 1] : [-Infinity, 0];
  const xd: DD = x <= xc ? [x, 0] : twoSum(1, -xc);
  const xcd: DD = x <= xc ? twoSum(1, -x) : [xc, 0];
  return betaIncCore(a, b, xd, xcd, lower, true);
}

/**
 * Core of betaIncDD. Returns [log, linear]. The linear value is always computed; the log only when wantLog
 * (otherwise the log slot is NaN). The log is log(v) of the linear value v; if v exceeds 1/2 the other side is
 * computed directly and log1p is used, and if v is close to subnormal it is recomputed on the spot
 */
function betaIncCore(a: number, b: number, xd: DD, xcd: DD, lower: boolean, wantLog: boolean): [number, number] {
  if (xd[0] <= 0) return lower ? [-Infinity, 0] : [0, 1];
  if (xcd[0] <= 0) return lower ? [0, 1] : [-Infinity, 0];

  // x (or 1 - x) is subnormal: the first series term I_x(a, b) ≈ x^a / (a B(a, b)) suffices (relative error about x).
  // The binomial-probability helpers break down on products of subnormals, so build this region directly in logs
  const DBL_MIN = 2.2250738585072014e-308;
  if (xd[0] < DBL_MIN || xcd[0] < DBL_MIN) {
    const small = xd[0] < DBL_MIN;
    const [sa, sb, sx] = small ? [a, b, xd] : [b, a, xcd];
    // log(1/(a B(a, b))) = lgamma(a+b) - lgamma(b) - lgamma(a+1), without subtraction
    const e = ddAdd(ddMulNum(ddLog(sx), sa), [lgammaDiff(sa, sb) - lgamma1p(sa), 0]);
    const lt = e[0] + e[1]; // log of the smaller tail (the lower tail if small)
    const own = small === lower;
    if (own) return [lt, Math.exp(e[0]) * (1 + e[1])];
    return [wantLog ? Math.log1p(-Math.exp(lt)) : NaN, -Math.expm1(lt)];
  }

  // Both parameters large and x near the mean: the uniform asymptotic expansion, whose cost does not grow with
  // the parameters (the continued fraction needs about sqrt(a + b) steps there)
  if (a >= TEMME_MIN_M && b >= TEMME_MIN_M) {
    const t = betaIncTemme(a, b, xd, xcd, lower, wantLog);
    if (t !== undefined) return t;
  }

  const [pa, pb, px, pxc] = lower ? [a, b, xd, xcd] : [b, a, xcd, xd];
  const [oa, ob, ox, oxc] = lower ? [b, a, xcd, xd] : [a, b, xd, xcd];

  // The log of a value near 1 is built with log1p from a direct computation of the other side
  const finish = (v: number, other: () => number | undefined): [number, number] => {
    if (!wantLog) return [NaN, v];
    if (v > 0.5) {
      const o = other();
      if (o !== undefined) return [Math.log1p(-o), v];
    }
    return [Math.log(v), v];
  };
  // The other tail, if it can be computed without subtraction
  const otherDirect = (): number | undefined => {
    if (pseriesOk(oa, ob, ox[0])) return pseries(oa, ob, ox, oxc, false);
    if (pseriesOk(pa, pb, px[0])) {
      const v = pseriesComplement(pa, pb, px, false);
      // Cancellation check as for the requested tail (see below)
      if (pa * Math.abs(Math.log(px[0])) > 32 * v && cfOk(oa, ob, ox[0])) return continuedFraction(oa, ob, ox, oxc, false);
      return v;
    }
    if (cfOk(oa, ob, ox[0])) return continuedFraction(oa, ob, ox, oxc, false);
    return undefined;
  };

  // A directly computed value close to subnormal has few significant digits, so recompute the log on the spot
  const TINY = 1e-290;
  if (pseriesOk(pa, pb, px[0])) {
    const v = pseries(pa, pb, px, pxc, false);
    if (wantLog && v < TINY) return [pseries(pa, pb, px, pxc, true), v];
    return finish(v, otherDirect);
  }
  if (pseriesOk(oa, ob, ox[0])) {
    const v = pseriesComplement(oa, ob, ox, false);
    // The exponent L of pseriesComplement is a sum of terms of size a |log x| that can cancel, and their rounding
    // (absolute, about ε a |log x|) is then large relative to a small result (1e-14 at a = 0.01, b = 1e4, x = 1e-4).
    // When a |log x| exceeds the result 32 times and the continued fraction applies in this tail's frame, use it
    // instead (a lower threshold would also send cases where the series is accurate, e.g. most of pt near 0, to the
    // slower continued fraction)
    if (oa * Math.abs(Math.log(ox[0])) > 32 * v && cfOk(pa, pb, px[0])) {
      const w = continuedFraction(pa, pb, px, pxc, false);
      if (wantLog && w < TINY) return [continuedFraction(pa, pb, px, pxc, true), w];
      return finish(w, otherDirect);
    }
    return finish(v, () => pseries(oa, ob, ox, oxc, false));
  }
  if (cfOk(pa, pb, px[0])) {
    const v = continuedFraction(pa, pb, px, pxc, false);
    if (wantLog && v < TINY) return [continuedFraction(pa, pb, px, pxc, true), v];
    return finish(v, otherDirect);
  }
  // 1 - (other side), from the other side (below the mean, hence small)
  const o = continuedFraction(oa, ob, ox, oxc, false);
  return [wantLog ? Math.log1p(-o) : NaN, 1 - o];
}

/** log(1 - x) from the double-double representation of x */
function log1pNeg(xd: DD): number {
  return Math.log1p(-xd[0]) - xd[1] / (1 - xd[0]);
}
