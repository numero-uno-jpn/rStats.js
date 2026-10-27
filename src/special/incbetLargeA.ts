// Asymptotic expansion of the incomplete beta function I_x(a, b) for large a and small b.
//
// Written from A. R. DiDonato and A. H. Morris, "Algorithm 708: Significant digit computation of the incomplete beta
// function ratios", ACM TOMS 18 (1992) 360-373, eq. 9 to 9.6 (the published formulas; no code was taken from TOMS 708
// or R), and N. M. Temme, "Special Functions" (Wiley, 1996), section 11.3.3.1 (DLMF 8.18.3-8.18.7). The organisation
// of the sum (the coefficients p_n and the upward recursion of J_n) follows Boost.Math's beta_small_b_large_a_series
// (boost/math/special_functions/beta.hpp, Copyright John Maddock 2006, BSL-1.0; see THIRD_PARTY_NOTICES.md).
//
// With T = a + (b - 1)/2, l = -log x and u = T l, the substitution t = e^-v in the integral of I_x(a, b) gives
//   t^(a-1) (1-t)^(b-1) dt = v^(b-1) e^(-T v) f(v) dv,   f(v) = (sinh(v/2) / (v/2))^(b-1) = Σ_n p_n (v/2)^(2n),
// and integrating term by term
//   I_x(a, b)     = M Σ_n p_n J_n,  J_n = Γ(b + 2n, u) / (u^b e^-u (2T)^(2n))   (v from l to ∞; asymptotic in 1/T²)
//   1 - I_x(a, b) = M Σ_n p_n H_n,  H_n = γ(b + 2n, u) / (u^b e^-u (2T)^(2n))   (v from 0 to l; convergent for l < 2π)
// with M = l^b x^T / B(a, b). The leading terms are Q(b, u) and P(b, u). The p_n are the coefficients of a power of
// the series sinh(w)/w = Σ w^(2k)/(2k+1)! (J. C. P. Miller's recurrence, DiDonato and Morris eq. 9.4):
//   p_0 = 1,  p_n = (1/n) Σ_(k=1..n) (k b - n) p_(n-k) / (2k+1)!.
// Both J_n and H_n follow from Γ(s + 2, u) = s (s + 1) Γ(s, u) + u^s e^-u (u + s + 1) (and the same with a minus
// sign for γ): J_n upwards from J_0 = e^u u^-b Γ(b, u), H_n downwards from H_N = (l/2)^(2N) S(b + 2N, u)/(b + 2N),
// S the series of the lower incomplete gamma function. Every term of both recursions is positive.
//
// Changes from Boost
// - Only the smaller tail is computed from the expansion (the J side when u is above the median of Gamma(b, 1), the
//   H side below it); the other tail is 1 - (that one), which is at least 1/2. Boost computes only the J side.
// - M is formed as [x^a (1-x)^b / B(a, b)] x^((b-1)/2) (l/y)^b, y = 1 - x, with the first factor from Loader's
//   binomial density (dbinomExponent, the deviances in double-double), instead of Γ(a + b) / (Γ(a) T^b) times
//   u^b e^-u / Γ(b), whose parts cancel for large a.
// - l = -log x and u are formed in double-double from x in double-double: the result is about as sensitive to the
//   absolute error of u as to a relative one, and u is of order b.
// - J_0 comes from a continued fraction evaluated backwards (below), not from the incomplete gamma function of
//   igam.ts, and H_N from the series in double-double: both to about an ulp.

import { dbinomExponent } from "./loader.js";
import { ddAdd, ddDiv, ddLog, ddMul, ddMulNum, ddNeg, ddSub, twoProd, twoSum, type DD } from "./dd.js";
import { erfcxNonNegative } from "./erf.js";
import { igamSeriesSumDD } from "./igam.js";
import { halfErfc } from "./incbetTemme.js";

/**
 * Region where the expansion is used (the caller tries it where it would otherwise use the continued fraction):
 * a >= LARGE_A_MIN, b <= SMALL_B_MAX, y = 1 - x <= Y_MAX, u <= U_MAX, and on the J side u >= U_MIN_J (below,
 * J_0 would need more than 1000 terms of its continued fraction). Chosen by measurement against mpmath
 * (scripts/mpmath/smallb.py) and against the time of the continued fraction (docs/performance.md)
 */
export const LARGE_A_MIN = 15;
export const SMALL_B_MAX = 40;
const Y_MAX = 0.3;
const U_MIN_J = 0.1;
const U_MAX = 500;

/** Largest number of terms (the series in 1/T² converges like ((b + 2n)/(2πT))^(2n) in the bulk) */
const NMAX = 30;
/** Relative size of the last term kept */
const EPS = 2 ** -56;

// 1/(2k+1)! for k = 0..NMAX, and the work array of p_n
const INV_ODD_FACT = new Float64Array(NMAX + 1);
{
  let f = 1;
  INV_ODD_FACT[0] = 1;
  for (let k = 1; k <= NMAX; k++) {
    f *= 2 * k * (2 * k + 1);
    INV_ODD_FACT[k] = 1 / f;
  }
}
const pn = new Float64Array(NMAX + 1);

const SQRT_PI = 1.7724538509055160273;
/** 1/(2 pi) in double-double */
const INV_2PI: DD = [0.15915494309189535, -9.839338337591243e-18];

/**
 * J_0 = e^u u^-b Γ(b, u) for u above the median of Gamma(b, 1), by the continued fraction (DLMF 8.9.2, even part)
 *   J_0 = 1/(u + 1 - b - 1 (1 - b)/(u + 3 - b - 2 (2 - b)/(u + 5 - b - ...)))
 * evaluated backwards with a number of terms fixed in advance: its error after n terms is about exp(-4 sqrt(n u))
 * for small u, so n = 100/u + b/2 + 10. It depends on u only through u - b, which is formed first, with the low part
 * of u (u + 1 - b would round at the size of u before the cancellation). The last two steps and the final division
 * are in double-double, which leaves J_0 about correctly rounded for u >= 0.3 and within 5e-16 for u >= 0.1
 * (against mpmath, b from 0.1 to 45 and u up to 4 times the median + 10). The forward evaluation in igam.ts stops
 * when two approximants agree, which is too early where they approach the value slowly (2e-14 at u = 0.3,
 * 1e-10 at u = 1e-3, 4e-15 at u = 3).
 * For b = 1/2, J_0 = sqrt(pi/u) erfcx(sqrt(u)) in closed form, corrected by uLow d(log J_0)/du with
 * d(log J_0)/du = 1 - b/u - 1/(u J_0)
 */
function upperGammaScaled(b: number, u: number, uLow: number): number {
  if (b === 0.5) {
    const r = Math.sqrt(u);
    const j = (SQRT_PI / r) * (r >= 1 ? erfcxNonNegative(r) : 2 * Math.exp(u) * halfErfc(r));
    return j * (1 + uLow * (1 - b / u - 1 / (u * j)));
  }
  const ubd = ddAdd(twoSum(u, -b), [uLow, 0]);
  const ub = ubd[0];
  let t = 0;
  for (let k = Math.ceil(100 / u + b / 2) + 10; k > 2; k--) t = (-k * (k - b)) / (ub + (2 * k + 1) + t);
  let td: DD = [t, 0];
  for (let k = 2; k >= 1; k--) td = ddDiv(ddMulNum(twoSum(k, -b), -k), ddAdd(ddAdd(ubd, [2 * k + 1, 0]), td));
  const r = ddDiv([1, 0], ddAdd(ddAdd(ubd, [1, 0]), td));
  return r[0] + r[1];
}

/** p_n from p_0..p_(n-1) (stored in pn) */
function nextP(b: number, n: number): number {
  let s = 0;
  for (let k = 1; k <= n; k++) s += (k * b - n) * pn[n - k]! * INV_ODD_FACT[k]!;
  return (pn[n] = s / n);
}

/**
 * I_x(a, b) (lower) or 1 - I_x(a, b) by the expansion for large a, as [log, linear] (log NaN unless wantLog).
 * x and y = 1 - x are given in double-double. Returns undefined outside the region above (assumes a >= LARGE_A_MIN
 * and b <= SMALL_B_MAX)
 */
export function betaIncLargeA(
  a: number,
  b: number,
  xd: DD,
  yd: DD,
  lower: boolean,
  wantLog: boolean,
): [number, number] | undefined {
  // Cheap filter on y and u (in double)
  const y = yd[0];
  if (!(y <= Y_MAX)) return undefined;
  const u0 = -(a + (b - 1) / 2) * Math.log1p(-y);
  // The median of Gamma(b, 1) is about b - 1/3 for b >= 1 and below 2^(-1/b) for small b
  const med = b >= 1 ? b - 1 / 3 : Math.pow(0.5, 1 / b);
  const jSide = u0 >= med;
  // (Where x rounds to 1 nothing else in incbet.ts applies, so U_MAX is not imposed there)
  if ((u0 > U_MAX && xd[0] < 1) || (jSide && u0 < U_MIN_J)) return undefined;
  // T = a + (b - 1)/2, l = -log x and u = T l in double-double
  const bm1 = twoSum(b, -1);
  const td = ddAdd([a, 0], [bm1[0] / 2, bm1[1] / 2]);
  // For y below 1e-15, l = y + y^2/2 (+ y^3/3, below 1e-30 relative) from y: the logarithm of x is accurate to about
  // 1e-32 absolute, which is all of l when y is tiny (l came out 0 for y = 6e-79 and the continued fraction for J_0,
  // with 100/u steps, did not end)
  const lx = y < 1e-15 ? ddNeg(ddAdd(yd, [(y * y) / 2, 0])) : ddLog(xd);
  const ld: DD = [-lx[0], -lx[1]];
  const ud = ddMul(td, ld);
  const u = ud[0] + ud[1];
  if (!(u > 0 && u < Infinity)) return undefined;
  // (the low part of u, which the incomplete gamma functions below take into account)
  const uLow = ud[1] - (u - ud[0]);
  const l = ld[0];
  const T = td[0];
  // M = [x^a y^b / B(a, b)] exp(b log(l/y) - (b - 1) l/2), with l - y in double-double (l/y = 1 + O(y)), and
  // x^a y^b / B(a, b) = e^-E sqrt(m/(2 pi)), m = ab/(a + b), from the exponent E of Loader's binomial density.
  // M = e^-E_hi sh (1 + δ): sqrt(m/(2 pi)) = sh + sl from m in double-double, and the small factors in δ, applied
  // last, so that each rounds once
  const dl = ddSub(ld, yd);
  const em = b * Math.log1p((dl[0] + dl[1]) / y) - ((b - 1) / 2) * l;
  const { e } = dbinomExponent(a, b, xd, yd);
  const md = ddMul(ddDiv(twoProd(a, b), twoSum(a, b)), INV_2PI);
  const sh = Math.sqrt(md[0]);
  const sq = twoProd(sh, sh);
  const delta = Math.expm1(em - e[1]) + (md[0] - sq[0] - sq[1] + md[1]) / (2 * md[0]);
  const l2 = (l / 2) * (l / 2);
  const t4 = 4 * T * T;
  let sum: number;
  pn[0] = 1;
  if (jSide) {
    // J_0 = e^u u^-b Γ(b, u), then J_n = (s (s + 1) J_(n-1) + (l/2)^(2n-2) (u + s + 1)) / (4T²), s = b + 2n - 2
    let j = upperGammaScaled(b, u, uLow);
    sum = j;
    let lp = 1;
    let s = b;
    let prev = Infinity;
    for (let n = 1; n <= NMAX; n++) {
      j = (s * (s + 1) * j + lp * (u + s + 1)) / t4;
      lp *= l2;
      s += 2;
      const term = nextP(b, n) * j;
      const at = Math.abs(term);
      // (an asymptotic series: stop before the terms grow)
      if (at > prev) break;
      sum += term;
      if (at <= EPS * sum) break;
      prev = at;
    }
  } else {
    // Number of terms: H_n / H_0 <= (l/2)^(2n), so stop where |p_n| (l/2)^(2n) is negligible (lp = (l/2)^(2N))
    let N = 0;
    let lp = 1;
    for (let n = 1; n <= NMAX; n++) {
      if (Math.abs(nextP(b, n)) * lp * l2 <= EPS) break;
      lp *= l2;
      N = n;
    }
    // H_N from the series, then H_(n-1) = (4T² H_n + (l/2)^(2n-2) (u + s + 1)) / (s (s + 1)), s = b + 2n - 2,
    // summing the small terms first
    let s = b + 2 * N;
    let h = (lp * igamSeriesSumDD(s, u)) / s;
    sum = pn[N]! * h;
    for (let n = N; n >= 1; n--) {
      lp /= l2;
      s -= 2;
      h = (t4 * h + lp * (u + s + 1)) / (s * (s + 1));
      sum += pn[n - 1]! * h;
    }
    // The leading term H_0 has d(log H_0)/du = 1 - b/u + 1/(u H_0) (the rest is smaller by 1/T²); correct for the
    // rounding of u to a double, which would cost up to ε u times that
    sum *= 1 + uLow * (1 - b / u + 1 / (u * h));
  }
  const mSum = Math.exp(-e[0]) * (sh * sum);
  const small = mSum + mSum * delta;
  // (far in the lower tails e^-E underflows; the series of incbet.ts handles them)
  if (!(small >= 1e-290)) {
    // ... except where x rounds to 1 (y below ε), where neither the series nor the continued fraction of incbet.ts
    // applies (pnbinom(1.6e258, 2.8e-255, { mu: 53.6, lowerTail: false }) was NaN): the log from the factors
    // (δ is not formed: e[1], half an ulp of E, is no longer small when E is huge)
    if (xd[0] < 1 || !(sum > 0)) return undefined;
    const ls = -e[0] + (em - e[1]) + Math.log(sh * sum) + Math.log1p((md[0] - sq[0] - sq[1] + md[1]) / (2 * md[0]));
    const v = Math.exp(ls);
    return lower === jSide ? [wantLog ? ls : NaN, v] : [wantLog ? -v : NaN, 1 - v];
  }
  // The J side is I_x(a, b)
  if (lower === jSide) return [wantLog ? Math.log(small) : NaN, small];
  return [wantLog ? Math.log1p(-small) : NaN, 1 - small];
}
