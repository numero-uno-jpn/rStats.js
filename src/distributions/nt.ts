// Density, distribution function and quantile of the noncentral t distribution (ncp = δ).
//
// T = (Z + δ) / S with Z ~ N(0, 1), S = sqrt(V / ν), V ~ χ²_ν (Z and V independent), so
//   P[T <= t] = E[Φ(t S - δ)],  P[T > t] = E[Φ(δ - t S)],  f(t) = E[S φ(t S - δ)]
// All integrands are positive, so both tails are computed without cancellation regardless of the signs
// of t and δ (in the series of Lenth (1989) the terms cancel when t and δ have opposite signs).
// The idea of computing the lower tail directly from this integral also appears in Boost.Math's
// include/boost/math/distributions/non_central_t.hpp (non_central_t_left_tail_integral)
// (BSL-1.0, see THIRD_PARTY_NOTICES.md; no code was ported). Here the integral is used everywhere.
//
// Integration variable: with a = ν/2 and U = a S² ~ Gamma(a), integrate over w = log(U / a) (S = e^(w/2)).
// The density of w is C_a exp(-a (e^w - 1 - w)), C_a = a^a e^-a / Gamma(a) = sqrt(a / (2 pi)) exp(-stirlerr(a)).
// Find the peak w* and width σ of the integrand by Newton's method, substitute w = w* + (σ/2)(z + 1 - e^-z),
// and integrate in z with the trapezoidal rule. The right tail decays doubly exponentially as e^(-a e^w), so it
// stays linear; the left tail (the density of w decays like e^(a w), very slowly for small ν) is stretched
// doubly exponentially by e^-z (the map is smooth, so the trapezoidal rule converges exponentially; stretching
// both sides with sinh would narrow the strip of analyticity on the right and slow convergence).
// The step is halved until the value stops changing.
//
// When |t| is large and Φ(t S - δ) becomes a steep step relative to the width of the density of w, switch to
// formula B, obtained by integrating by parts in v = t S - δ (a peak of φ × the incomplete gamma function; see
// the comment on integrate). The far tail with even larger |t| is extrapolated by the power law P ∝ |t|^(-ν)
// (farLimit). For a large ν (a > 1e5) the integral is taken by Laplace's method wherever its neglected terms are below
// the rounding (laplace); for a small ν (a < 1e-5) formula B is used at any t, and a t so near 0 that P is Φ(-δ) to
// the double is given that value (nearZero). The smaller tail is computed, the larger is 1 - (smaller).
//
// Far tails of a large δ (a log beyond about 1e9, or |δ| > 2^32), where the logs of the integrand in double precision
// no longer place its peak: Laplace's method with the derivatives scaled and t S - δ in double-double (laplaceWide),
// the trapezoidal sum with the logs in double-double where the expansion is not accurate enough, the integral of the
// ratio to Φ(-δ) where the peak is broad (integrateShifted), and for t >> sqrt(ν) an expansion over Z (zTail).
//
// For accuracy, the node w and, on top of it, e^(w/2), the exponent a (e^w - 1 - w) and the normal argument
// t S - δ are formed in double-double (rounding in each is amplified hundreds of times in the tails). Nodes
// where the rounding effect is estimated to be at most eps times the peak value are computed in double
// precision (the fast path).

import { quantileBoundaries, smallerTail } from "../internal/dpq.js";
import { invertContinuous } from "../internal/invert.js";
import { ddAdd, ddMul, ddMulNum, twoProd, twoSum, type DD } from "../special/dd.js";
import { erfcxNonNegative } from "../special/erf.js";
import { gammaInc } from "../special/igam.js";
import { dpoisRaw, stirlerr } from "../special/loader.js";
import { lgamma1p } from "../special/gamma.js";
import { qgammaStd } from "./gamma.js";
import { dnorm, pnorm, qnorm } from "./normal.js";

const LN_SQRT_2PI = 0.918938533204672741780329736406;
const SQRT_2_PI = 0.7978845608028654; // sqrt(2/pi)
const LN2_DD: DD = [0.6931471805599453, 2.3190468138462996e-17];

/** exp(x) in double-double (x is double-double, |x| < about 700) */
function ddExp(x: DD): DD {
  const k = Math.round(x[0] / LN2_DD[0]);
  // r = x - k log 2 (|r| <= 0.35); scale by 2^-8, apply Taylor series, then square 8 times
  const r = ddAdd(x, ddMulNum(LN2_DD, -k));
  const s: DD = [r[0] / 256, r[1] / 256];
  let term: DD = [1, 0];
  let sum: DD = [1, 0];
  for (let n = 1; n <= 12; n++) {
    term = ddMul(term, s);
    term = [term[0] / n, term[1] / n];
    sum = ddAdd(sum, term);
    if (Math.abs(term[0]) < 1e-34) break;
  }
  for (let i = 0; i < 8; i++) sum = ddMul(sum, sum);
  const f = 2 ** k;
  return [sum[0] * f, sum[1] * f];
}

/** e^w - 1 - w in double-double (w = node, ew = e^w, both double-double) */
function expm1mx(w: DD, ew: DD): DD {
  if (Math.abs(w[0]) < 1e-6) {
    // Series w^2/2 + w^3/6 + w^4/24 (no subtraction; e^w - 1 loses digits)
    const w2 = ddMul(w, w);
    const t3 = ddMulNum(ddMul(w2, w), 1 / 6);
    return ddAdd(ddAdd([w2[0] / 2, w2[1] / 2], t3), [(w2[0] * w2[0]) / 24, 0]);
  }
  // e^w has an error of about 1e-32, so for w >= 1e-6 subtraction is enough (1e-20 relative)
  return ddAdd(ddAdd(ew, [-1, 0]), [-w[0], -w[1]]);
}

/** e^w - 1 - w (double precision, relative error about eps; series for small |w|) */
function expm1mxNum(w: number): number {
  if (Math.abs(w) < 0.1) {
    let term = (w * w) / 2;
    let sum = term;
    for (let k = 3; k < 30; k++) {
      term *= w / k;
      sum += term;
      if (Math.abs(term) <= 1e-17 * sum) break;
    }
    return sum;
  }
  return Math.expm1(w) - w;
}

/** φ(z)/Φ(z) (inverse Mills ratio). Does not overflow for large negative z */
function millsInv(z: number): number {
  if (z < 0) return SQRT_2_PI / erfcxNonNegative(-z * Math.SQRT1_2);
  return Math.exp(-0.5 * z * z - LN_SQRT_2PI) / pnorm(z);
}

/**
 * cdf: E[Φ(t S - δ)] in w (formula A). pdf: E[S φ(t S - δ)].
 * cdfQ / cdfP: the formula-B integral ∫ φ(t S - δ) t S G(a, a S²) du (u = w/2, t > 0). G is the upper Q or the lower P
 */
type Kind = "cdf" | "pdf" | "cdfQ" | "cdfP";

interface Problem {
  /** Half the degrees of freedom */
  a: number;
  t: number;
  delta: number;
  kind: Kind;
  /** log C_a */
  logC: number;
  /**
   * kind cdf or pdf only: the log of the integrand is taken less log Φ(-δ) (cdf) or log φ(δ) (pdf), and the result is
   * returned with it added back (integrateShifted)
   */
  shift?: number;
  /**
   * With shift, kind cdf: the integrand is |ρ - 1| in place of the ratio ρ = Φ(t S - δ)/Φ(-δ) (integrateShifted, for a
   * tiny a)
   */
  complement?: boolean;
}

/** Below this x = a e^w, P(a, x) = x^a / Γ(1 + a) (1 + O(x)) is taken from log x = log a + w (x may underflow) */
const X_TINY = 1e-300;

/** a e^w, also where e^w overflows (a tiny a with |t| tiny takes formula B out to S = |δ|/|t|) */
function shapeTimesExp(a: number, w: number): number {
  return w < 700 ? a * Math.exp(w) : Math.exp(Math.log(a) + w);
}

/**
 * log G(a, x) at x = a e^w (G = P if lower, Q otherwise) and log(x^a e^-x / Γ(a + 1)) (the derivative of P in log x).
 * For a tiny a the integrals reach x far below the double range, where P(a, x) is still near 1 (x^a = e^(a log x))
 */
function gammaLog(a: number, w: number, lower: boolean): [number, number] {
  const x = shapeTimesExp(a, w);
  if (x > X_TINY) {
    // Q(a, x) = (a/A_SUB) Q(A_SUB, x) (1 + O(A_SUB log x)) for a < A_SUB: at a subnormal a the log of Q, itself near a,
    // lost digits (7e-5 at a = 1e-320)
    if (!lower && a < A_SUB) return [gammaInc(A_SUB, x, false, true) + Math.log(a / A_SUB), dpoisRaw(a, x, true)];
    return [gammaInc(a, x, lower, true), dpoisRaw(a, x, true)];
  }
  // log P = a m, m = log x - lgamma1p(a)/a; lgamma1p(a)/a is -γ (1 + O(a)) where lgamma1p(a) would be subnormal
  const m = Math.log(a) + w - (a < A_SUB ? -EULER : lgamma1p(a) / a);
  const lp = a * m;
  if (lower) return [lp, lp];
  // log Q = log(-expm1(a m)): log(a) + log(-m) + log1p(lp/2) where a m is so small (it may be subnormal)
  const lq = lp > -1e-10 ? Math.log(a) + Math.log(-m) + Math.log1p(lp / 2) : lp > -Math.LN2 ? Math.log(-Math.expm1(lp)) : Math.log1p(-Math.exp(lp));
  return [lq, lp];
}

/** Below this a the upper incomplete gamma function is scaled from Q(A_SUB, x) (gammaLog) */
const A_SUB = 1e-300;
const EULER = 0.5772156649015329;
/** Above this x/(a + 1) the second derivative of log Q(a, x) in w comes from the asymptotic series of Q (logIntegrand) */
const Q_ASYMPTOTIC = 1e8;

/** Log of the integrand (double precision, for locating the peak) and its first and second derivatives */
function logIntegrand(pr: Problem, w: number): [number, number, number] {
  const { a, t, delta } = pr;
  const ew = Math.exp(w);
  const S = Math.exp(w / 2);
  const tS = t * S;
  const z = tS - delta;
  const m = expm1mxNum(w);
  if (pr.kind === "cdfQ" || pr.kind === "cdfP") {
    // log(t S / 2) + log φ(z) + log G(a, x), x = a S^2 = a e^w
    const x = shapeTimesExp(a, w);
    const upperG = pr.kind === "cdfQ";
    const [lG, ld] = gammaLog(a, w, !upperG);
    // x f(x) / G (with log a inside the exp: for a subnormal a, f(x)/G alone can overflow)
    const xf = Math.exp(Math.log(a) + ld - lG);
    const sgn = upperG ? -1 : 1;
    const L = Math.log(t / 2) + w / 2 - 0.5 * z * z - LN_SQRT_2PI + lG;
    const d1 = 0.5 - (z * tS) / 2 + sgn * xf;
    // (for Q, the derivative of -xf is xf (x - a - xf), which cancels where x is large: xf = x/(1 + (a-1)/x + ...),
    // from logs near -x, is off by about eps x relative, the difference by eps x² against its value of about -1. From
    // the asymptotic series of Q, x - a - xf = -1 - (a-1)/x up to O(((a+1)/x)²); with the cancelled form the peak
    // search of formula B for a subnormal a and δ = 1e5 stopped short in steps of 1/x, and the log of pt was +Infinity)
    const d2G = upperG && x > Q_ASYMPTOTIC * (a + 1) ? -xf * (1 + (a - 1) / x) : sgn * xf * (a - x) - xf * xf;
    const d2 = -(tS * tS) / 4 - (z * tS) / 4 + d2G;
    return [L, d1, d2];
  }
  let L = pr.logC - a * m;
  let d1 = -a * Math.expm1(w);
  let d2 = -a * ew;
  if (pr.shift !== undefined && w > 700) {
    // (a e^w from its log, where e^w overflows: for a subnormal a the peak of integrateShifted is near w = 723)
    const aew = Math.exp(Math.log(a) + w);
    L = pr.logC - (aew - a * (1 + w));
    d1 = -(aew - a);
    d2 = -aew;
  }
  if (pr.kind === "cdf") {
    const r = millsInv(z);
    if (pr.complement) {
      // log |ρ - 1| and its derivative (the second is left to bracketedPeak)
      const lr = logPhiRatio(tS, delta);
      // (e^lr / (e^lr - 1) is 1 where both overflow)
      return [L + logAbsExpm1(lr), d1 + (tS / 2) * r * (lr > 40 ? 1 : Math.exp(lr) / Math.expm1(lr)), NaN];
    }
    L += pr.shift === undefined ? pnorm(z, { logP: true }) : logPhiRatio(tS, delta);
    d1 += (tS / 2) * r;
    d2 += (tS / 4) * r - (tS / 2) * (tS / 2) * r * (z + r);
  } else {
    L += pr.shift === undefined ? w / 2 - 0.5 * z * z - LN_SQRT_2PI : w / 2 + tS * (delta - tS / 2);
    d1 += 0.5 - (z * tS) / 2;
    d2 += -(tS * tS) / 4 - (z * tS) / 4;
  }
  return [L, d1, d2];
}

/** Peak w* (maximum of the log integrand) and width σ = 1/sqrt(-L'') */
function findPeak(pr: Problem): { w: number; sigma: number; L: number } {
  let w = 0;
  let [L, d1, d2] = logIntegrand(pr, w);
  // (where L is convex the step is the largest one; for a tiny a the peak of the density can be at w = 800, with L
  // convex most of the way from 0)
  for (let i = 0; i < 400; i++) {
    let step = d2 < 0 ? -d1 / d2 : 4 * Math.sign(d1);
    if (!Number.isFinite(step)) step = Math.sign(d1) || 0;
    step = Math.max(-4, Math.min(4, step));
    // Shrink the step if the value decreases (unimodal, so an ascent direction always exists)
    let wn = w + step;
    let res = logIntegrand(pr, wn);
    for (let k = 0; k < 60 && !(res[0] >= L); k++) {
      step /= 2;
      wn = w + step;
      res = logIntegrand(pr, wn);
    }
    if (!(res[0] >= L)) break;
    const done = Math.abs(step) < 1e-10 * Math.max(1, Math.abs(w));
    w = wn;
    [L, d1, d2] = res;
    if (done) break;
  }
  const sigma = d2 < 0 ? Math.min(1 / Math.sqrt(-d2), 10) : 1;
  return { w, sigma, L };
}

/**
 * log Φ(z + dz) in double-double. For large negative z, log Φ(z) is dominated by -z²/2 and double-precision
 * log Φ leaves an absolute error of eps z²/2, so split Φ(z) = erfcx(-z/√2) e^(-z²/2) / 2 and compute z² in
 * double-double
 */
function logPhiDD(zd: DD): DD {
  const z = zd[0];
  const corr = zd[1] * millsInv(z);
  if (z > -5) return twoSum(pnorm(z, { logP: true }), corr);
  // (z²/2 as z (z/2), the same to the bit: z² alone overflows from |z| = 1.34e154, z²/2 from 1.9e154)
  const zh = ddMul(zd, [zd[0] / 2, zd[1] / 2]);
  return ddAdd([-zh[0], -zh[1]], [Math.log(0.5 * erfcxNonNegative(-z * Math.SQRT1_2)), 0]);
}

/**
 * Value of the integrand at node w (double-double). If log, return the log in double-double
 * (even in deep tails where the exponent is in the hundreds, subtracting the peak value before exp keeps relative accuracy)
 */
function integrand(pr: Problem, w: DD, log: boolean, peak = Infinity): DD {
  const { a, t, delta } = pr;
  if (!log && (pr.kind === "cdf" || pr.kind === "pdf")) {
    // Fast path: if the rounding of a double-precision evaluation (about eps × (E + |z t S| + z²) relative)
    // is at most eps times the peak value, this suffices for the node
    const wv = w[0] + w[1];
    const Sd = Math.exp(wv / 2);
    const Ed = a * expm1mxNum(wv);
    const tS = t * Sd;
    const z = tS - delta;
    const base = Math.exp(pr.logC - Ed);
    // Relative error from the rounding eps |t S| of z: (φ/Φ)(z) |t S| times for Φ, |z t S| times for φ
    if (pr.kind === "cdf") {
      const v = base * pnorm(z);
      if ((Ed + millsInv(z) * Math.abs(tS)) * v <= 4 * peak) return [v, 0];
    } else {
      // (one exp where C_a e^-E underflows on its own: for a tiny a, C_a is about a, and S can be 1e100)
      const lv = pr.logC - Ed - 0.5 * z * z - LN_SQRT_2PI;
      const v = lv > -700 ? Math.exp(lv) * Sd : Math.exp(lv + wv / 2);
      if ((Ed + Math.abs(z * tS) + z * z + (lv > -700 ? 0 : -lv)) * v <= 4 * peak) return [v, 0];
    }
  }
  const S = ddExp([w[0] / 2, w[1] / 2]);
  const ew = ddMul(S, S);
  if (pr.kind === "cdfQ" || pr.kind === "cdfP") {
    // (t S / 2) φ(t S - δ) G(a, a S^2)
    const zd = ddAdd(ddMulNum(S, t), [-delta, 0]);
    const zz = ddMul(zd, zd);
    const x = w[0] < 700 ? a * ew[0] + a * ew[1] : shapeTimesExp(a, w[0] + w[1]);
    const lower = pr.kind === "cdfP";
    if (log) {
      const rest = Math.log(t / 2) + Math.log(S[0]) + S[1] / S[0] - LN_SQRT_2PI + gammaLog(a, w[0] + w[1], lower)[0];
      return ddAdd([-zz[0] / 2, -zz[1] / 2], [rest, 0]);
    }
    const g = x > X_TINY ? gammaInc(a, x, lower, false) : Math.exp(gammaLog(a, w[0] + w[1], lower)[0]);
    return [(t / 2) * (S[0] + S[1]) * Math.exp(-0.5 * zz[0] - LN_SQRT_2PI) * (1 - zz[1] / 2) * g, 0];
  }
  // a (e^w - 1 - w); (a tiny a reaches e^w near the overflow threshold, where the splitting in ddMulNum overflows;
  // in integrateShifted beyond it, from the log of a e^w)
  const m = expm1mx(w, ew);
  const E =
    pr.shift !== undefined && w[0] > 700
      ? twoSum(Math.exp(Math.log(a) + w[0] + w[1]), -a * (1 + w[0]))
      : m[0] < 1e290
        ? ddMulNum(m, a)
        : twoSum(a * m[0], a * m[1]);
  if (!(E[0] < Infinity)) return [log ? -Infinity : 0, 0];
  if (pr.shift !== undefined) {
    // (integrateShifted: the log less log Φ(-δ) or log φ(δ), of a moderate size)
    const y = ddMulNum(S, t)[0];
    const lr = pr.kind === "cdf" ? logPhiRatio(y, delta) : y * (delta - y / 2);
    const l = ddAdd([pr.logC - E[0], -E[1]], [pr.complement ? logAbsExpm1(lr) : lr, 0]);
    return pr.kind === "cdf" ? l : ddAdd(l, [w[0] / 2, w[1] / 2]);
  }
  const zd = ddAdd(ddMulNum(S, t), [-delta, 0]);
  const z = zd[0];
  if (pr.kind === "cdf") {
    if (log) return ddAdd([pr.logC - E[0], -E[1]], logPhiDD(zd));
    // Φ(z + dz) = Φ(z) (1 + dz φ(z)/Φ(z))
    const corr = zd[1] * millsInv(z);
    return [Math.exp(pr.logC - E[0]) * (1 - E[1]) * pnorm(z) * (1 + corr), 0];
  }
  // S φ(z), with z^2 also in double-double
  const zz = ddMul(zd, zd);
  if (log) {
    const l = ddAdd(ddAdd([pr.logC - E[0], -E[1]], [-zz[0] / 2, -zz[1] / 2]), [w[0] / 2 - LN_SQRT_2PI, w[1] / 2]);
    return l;
  }
  const lv = pr.logC - E[0] - 0.5 * zz[0] - LN_SQRT_2PI;
  if (lv < -700) return [Math.exp(lv + w[0] / 2) * (1 - E[1] - zz[1] / 2 + w[1] / 2), 0];
  return [Math.exp(lv) * (1 - E[1] - zz[1] / 2) * (S[0] + S[1]), 0];
}

/** Trapezoidal sum (step h in z, extending both ways until negligible) */
function trapezoid(
  pr: Problem,
  w0: number,
  sigma: number,
  h: number,
  log: boolean,
  offset: number,
  odd: boolean,
  peak: number,
  offsetLow?: number,
): number {
  // If odd, only the odd-indexed nodes (the points added by halving the step)
  let sum = 0;
  const node = (z: number): number => {
    // w = w* + (σ/2)(z + 1 - e^-z): nearly linear on the right, stretched doubly exponentially on the left
    const ez = Math.exp(-z);
    const d = (sigma / 2) * (z - Math.expm1(-z));
    const v = integrand(pr, twoSum(w0, d), log, peak);
    const jac = (sigma / 2) * (1 + ez);
    if (offsetLow !== undefined) return Math.exp(v[0] - offset + (v[1] - offsetLow)) * jac;
    return log ? Math.exp(v[0] - offset) * (1 + v[1]) * jac : v[0] * jac;
  };
  const start = odd ? 1 : 0;
  // Center
  if (!odd) sum += node(0);
  for (const dir of [1, -1]) {
    let small = 0;
    for (let i = odd ? start : 1; i < 100000; i += odd ? 2 : 1) {
      const z = dir * i * h;
      const v = node(z);
      sum += v;
      const ref = Math.abs(sum);
      // Stop after 3 consecutive negligible points (monotonically decreasing away from the peak)
      if (!(v > 1e-19 * ref)) {
        small++;
        if (small >= 3) break;
      } else small = 0;
      if (Math.abs(z) > 40) break;
    }
  }
  return sum;
}

/**
 * The integral (its log if log). For kind = "cdf", if the normal factor Φ(t S - δ) is a steep step relative to the
 * width of the density of w (large |t|), switch to formula B obtained by integration by parts:
 *   t > 0: E[Φ(t S - δ)] = Φ(-δ) + ∫ φ(t S - δ) t S Q(a, a S²) du
 *   t < 0: E[Φ(t S - δ)] = ∫ φ(|t| S + δ) |t| S P(a, a S²) du
 * (reintegrated in v = t S - δ; the integrand becomes a peak of width 1/(|t| S) and the trapezoidal rule converges well)
 */
interface Value {
  lin: number;
  log: number;
}

function integrate(pr: Problem, needLog: boolean): Value {
  // Far tails of a large δ (LOG_LARGE, D_LARGE): over z for a large t (zTail; the density is symmetric under
  // (t, δ) -> (-t, -δ), and for the distribution function a negative δ is the upper tail), otherwise laplaceWide below
  const large = farLogEstimate(pr) > LOG_LARGE || Math.abs(pr.delta) > D_LARGE;
  if (large && pr.t * pr.delta > 0 && Math.abs(pr.t) / Math.sqrt(2 * pr.a) >= T_Z) {
    return zTail(pr.a, Math.abs(pr.t), Math.abs(pr.delta), pr.kind === "pdf" ? "pdf" : pr.delta > 0 ? "lower" : "upper");
  }
  if (pr.a > A_LAPLACE) {
    const v = laplace(pr);
    if (v !== undefined) return v;
  }
  // (for the distribution function a negative δ here is the upper tail near 1, whose logs are of a moderate size)
  if (large && !(pr.kind === "cdf" && pr.delta < 0)) {
    const sharp = { w: NaN, sigma: NaN };
    const v = laplaceWide(pr, sharp);
    if (v !== undefined) return v;
    // A sharp peak (L'' <= -1e5) where the expansion is not accurate enough (u at the peak is of order -10: log Φ(u)
    // is not yet nearly quadratic): its log there is at most about 1e17 (beyond, the expansion's error is below the
    // rounding), so the trapezoidal sum with the logs of the nodes and of the peak in double-double resolves it. A
    // broad peak: integrateShifted
    if (!Number.isNaN(sharp.w)) return integrateCore(pr, true, { w: sharp.w, sigma: sharp.sigma, L: NaN }, true);
    return integrateShifted(pr);
  }
  if (pr.kind === "cdf") {
    // (for a tiny a the density of w is spread over w down to about -1/a, and the peak of formula A is not found;
    // formula B is used at any t)
    const pk = pr.a < A_TINY ? undefined : findPeak(pr);
    let formulaB = true;
    if (pk !== undefined) {
      const S = Math.exp(pk.w / 2);
      const widthW = Math.min(1 / Math.sqrt(pr.a * Math.exp(pk.w)), 10);
      formulaB = (Math.abs(pr.t) * S * widthW) / 2 > 2;
    }
    if (formulaB) {
      if (pr.t > 0) {
        const r = integrateCore({ ...pr, kind: "cdfQ" }, needLog);
        return {
          lin: pnorm(-pr.delta) + r.lin,
          log: needLog ? logAddExp(pnorm(-pr.delta, { logP: true }), r.log) : NaN,
        };
      }
      if (pr.a >= A_TINY) return integrateCore({ ...pr, t: -pr.t, delta: -pr.delta, kind: "cdfP" }, needLog);
      // E[Φ(t S - δ)] = Φ(-δ) - ∫ φ(|t| S + δ) |t| S Q(a, a S²) du: for a tiny a, Q is at most about a |log(a S²)|, and
      // the integral is a small correction (the integral with P(a, a S²), near Φ(-δ), would carry its error in full)
      const r = integrateCore({ ...pr, t: -pr.t, delta: -pr.delta, kind: "cdfQ" }, needLog);
      const l0 = pnorm(-pr.delta, { logP: true });
      return {
        lin: pnorm(-pr.delta) - r.lin,
        log: needLog ? l0 + Math.log1p(-Math.exp(r.log - l0)) : NaN,
      };
    }
    return integrateCore(pr, needLog, pk);
  }
  return integrateCore(pr, needLog);
}

/**
 * -log of the far tail (cdf, δ > 0 and t below it) or of the density far from the centre, roughly: the minimum over
 * S of (t S - δ)²/2 + a S², δ²/2 / (1 + t²/(2a)) for t δ > 0, and δ²/2 otherwise (within a factor of about 2 where
 * it is large). The peak of the integrand itself (findPeak) is no guide: where Φ(t S - δ) is a steep step, formula A's
 * peak is not found, and its value can be that of a node far in the left tail of Φ
 */
function farLogEstimate(pr: Problem): number {
  const { a, t, delta, kind } = pr;
  if (kind === "cdf" && !(delta > 0)) return 0;
  const d = Math.abs(delta);
  const h = t * delta > 0 ? d / Math.hypot(1, t / Math.sqrt(2 * a)) : d;
  return (h * h) / 2;
}

/**
 * Below this a, formula B is used at any t: the peak of formula A is not found for a below about 1e-15, and from
 * 1e-5 down its error reaches 5e-15 of P, where formula B, a correction of order a log(t²/a) to Φ(-δ), keeps 1e-16
 */
const A_TINY = 1e-5;

/**
 * Above this a (half the degrees of freedom) the integral is taken by Laplace's method where that is accurate (laplace:
 * the far tails from here on, everywhere from about a = 3e8). The width of the density of w is 1/sqrt(a): from about
 * a = 5e7 on the trapezoidal sum loses digits in the far tails (7e-9 of log P at a = 5e7, NaN or Infinity at 1e14), and
 * from 1e29 on it does not resolve the width even near the centre
 */
const A_LAPLACE = 1e5;

/**
 * log Φ(u) and its derivatives: [ℓ1, ℓ2, ℓ3, ℓ4] with ℓ1 = m = φ(u)/Φ(u), ℓ2 = -m (u + m), ℓ3 = -ℓ2 (u + m) - m (1 + ℓ2),
 * ℓ4 = -ℓ3 (u + 2m) - 2 ℓ2 (1 + ℓ2). For u = -z < -3, u + m and 1 + ℓ2 cancel (to 1/z and 1/z²); there they come from
 * the continued fraction m - z = K = 1/(z + K2), K2 = 2/(z + 3/(z + 4/(z + ...))) (the continued fraction of Mills'
 * ratio), as u + m = K and 1 + ℓ2 = 1 - (z + K) K = K (K2 - K) (since K (z + K2) = 1). ℓ3 and ℓ4 still cancel, but
 * they only enter the correction term of laplace
 */
function logPhiDerivs(u: number): [number, number, number, number] {
  let m: number;
  let r: number;
  let p2: number;
  if (u < -3) {
    const z = -u;
    // (to 1e-16 with these terms: the error falls as e^(-2 z sqrt(n)))
    let k2 = 0;
    for (let n = Math.ceil(20 + 600 / (z * z)); n >= 2; n--) k2 = n / (z + k2);
    r = 1 / (z + k2);
    m = z + r;
    p2 = r * (k2 - r);
  } else {
    m = millsInv(u);
    r = u + m;
    p2 = 1 - m * r;
  }
  const l2 = -m * r;
  if (u < -1e3) {
    // ℓ3 and ℓ4 from their asymptotic series (the derivatives of ℓ2 = -(1 - 1/z² + 6/z⁴ - 50/z⁶ + ...)): computed as
    // above they keep an error of eps/z², which v⁴ in laplace would turn into an overflow
    const s = 1 / (u * u);
    return [m, l2, -(2 - 24 * s + 300 * s * s) * s / u, (6 - 120 * s + 2100 * s * s) * s * s];
  }
  const l3 = -l2 * r - m * p2;
  const l4 = -l3 * (u + 2 * m) - 2 * l2 * p2;
  return [m, l2, l3, l4];
}

/**
 * The integral of integrate (kind "cdf" or "pdf") by Laplace's method in w, for a large a: with L the log of the
 * integrand, w* its maximum and L2 = -L''(w*), L3, L4 the next derivatives there,
 *   ∫ e^L dw = e^L(w*) sqrt(2 pi / L2) (1 + L4/(8 L2²) + 5 L3²/(24 L2³) + ...)
 * (the expansion in the moments of a normal variable of variance 1/L2). For the density of w alone (L2 = L3 = L4 = a)
 * the correction is 1/(12a), which cancels stirlerr(a) in C_a. The next terms are of order 1/L2² and q^6 with
 * q = (|v|/2) / (sqrt(L2) max(1, -u)) (v = t S, u = v - δ: the k-th derivative of log Φ(u(w)) is about (v/2)^k ℓk(u),
 * and ℓk(u) about |u|^-k for u << 0); relative to the value they are an error of as much in its log, so they are to be
 * below 1e-17 of |log value| or of 1: near the centre that takes L2 >= 3e8 and q <= 1e-3, far in a tail (log P of -1e6
 * and below) much less. Undefined elsewhere (also where |δ| is of order sqrt(a) with t near δ, where T = (Z + δ)/S is
 * not nearly normal). The derivatives in w follow from v' = v/2:
 *   cdf: L = log C_a - a (e^w - 1 - w) + log Φ(u)
 *   pdf: L = log C_a - a (e^w - 1 - w) + w/2 - u²/2 - log sqrt(2 pi)
 * The far tails, where w* is far from 0 (e^w* about 2a/t² for |t| >> sqrt(a)), are included: there log Φ(u) is nearly
 * quadratic in v and its derivatives are all of order v², as large as L2.
 */
function laplace(pr: Problem): Value | undefined {
  const { a, t, delta, kind } = pr;
  const cdf = kind === "cdf";
  const at = (w: number) => {
    const ew = Math.exp(w);
    const v = t * Math.exp(w / 2);
    const u = Math.abs(w) < 1 ? t - delta + t * Math.expm1(w / 2) : v - delta;
    let f: [number, number, number, number];
    if (cdf) {
      const [l1, l2, l3, l4] = logPhiDerivs(u);
      const v2 = v * v;
      // (ℓk falls as |u|^-k where v is huge: multiplied in this order the terms do not overflow)
      f = [
        (l1 * v) / 2,
        (l2 * v2 + l1 * v) / 4,
        (l3 * v * v2 + 3 * l2 * v2 + l1 * v) / 8,
        (l4 * v2 * v2 + 6 * l3 * v * v2 + 7 * l2 * v2 + l1 * v) / 16,
      ];
    } else {
      f = [0.5 - (u * v) / 2, -(v * v + u * v) / 4, -(3 * v * v + u * v) / 8, -(7 * v * v + u * v) / 16];
    }
    return { u, v, f, d1: -a * Math.expm1(w) + f[0], L2: a * ew - f[1] };
  };
  // w*: Newton's method on L' inside a bracket (L' > 0 at w = -1400, where v is 0 to the double, and < 0 at 50),
  // bisecting where a step leaves it. Below -1400 e^(w/2) is subnormal
  let lo = -1400;
  let hi = 50;
  let w = 0;
  let p = at(w);
  for (let i = 0; i < 300 && hi - lo > 4e-16 * Math.max(1, Math.abs(w)); i++) {
    // (a Newton step this small leaves an error of L2 step²/2 < 1e-18 in L(w*))
    const step = p.d1 / p.L2;
    if (Math.abs(step) * Math.sqrt(p.L2) < 1e-9) break;
    if (p.d1 > 0) lo = w;
    else if (p.d1 < 0) hi = w;
    else break;
    const next = w + step;
    w = next > lo && next < hi ? next : (lo + hi) / 2;
    p = at(w);
  }
  const { u, v, f, L2 } = p;
  const ew = Math.exp(w);
  if (!(w > -1390 && L2 >= 1e5)) return undefined;
  // (the peak beyond the bracket, for a large δ: pt(1e9, 1e6, ncp 1e20) was -3.9e38, its log is -5e27; laplaceWide)
  if (p.d1 > 0 && 50 - w < 1e-9) return undefined;
  const r3 = (-a * ew + f[2]) / L2;
  const r4 = (-a * ew + f[3]) / L2;
  const c1 = r4 / L2 / 8 + (5 * r3 * r3) / L2 / 24;
  // log(L2/a), without cancellation near w = 0
  const x = Math.expm1(w) - f[1] / a;
  const lr = Math.abs(x) < 0.5 ? Math.log1p(x) : Math.log(ew - f[1] / a);
  // log C_a + log sqrt(2 pi / L2) + log(1 + c1) - a (e^w - 1 - w); u in double-double where it is formed from t - δ
  const rest = -0.5 * lr - stirlerr(a) + Math.log1p(c1) - a * expm1mxNum(w);
  const ud = Math.abs(w) < 1 ? ddAdd(twoSum(t, -delta), twoProd(t, Math.expm1(w / 2))) : twoSum(v, -delta);
  let value: Value;
  if (cdf) {
    const l = logPhiDD(ud);
    const log = l[0] + (l[1] + rest);
    value = { lin: log < -745 ? 0 : pnorm(ud[0]) * (1 + ud[1] * millsInv(ud[0])) * Math.exp(rest), log };
  } else {
    const uu = ddMul(ud, ud);
    const rest2 = rest + w / 2 - LN_SQRT_2PI - uu[1] / 2;
    const hiPart = -uu[0] / 2;
    const log = hiPart + rest2;
    value = { lin: hiPart > -700 ? Math.exp(hiPart) * Math.exp(rest2) : Math.exp(log), log };
  }
  // The neglected terms (in the far tails, where only the log is representable, a smaller L2 is enough)
  const q = cdf ? Math.abs(v) / 2 / (Math.sqrt(L2) * Math.max(1, -u)) : 0;
  return 1 / (L2 * L2) + q ** 6 <= 1e-17 * Math.max(1, Math.abs(value.log)) ? value : undefined;
}

/**
 * laplace where the log of the integrand is beyond LOG_LARGE (a large δ, at any a): there the peak can lie beyond
 * w = 50 (S* is about t δ/(t² + 2a) for t > 0), and v = t S, v² and a e^w can overflow while the answer is finite. The
 * derivatives d1, L2 and f are formed in units of 2^(2k), with 2^k about max(|v|, sqrt(a e^w)) / 2^400, and u from v
 * in double-double (where t² >> a, u = v - δ is a small part of δ)
 */
function laplaceWide(pr: Problem, sharp: { w: number; sigma: number }): Value | undefined {
  const { a, t, delta, kind } = pr;
  const cdf = kind === "cdf";
  const la = Math.log(a);
  const at = (w: number) => {
    const lg2 = Math.max(Math.log2(Math.abs(t)) + w / 2 / Math.LN2, (la + w) / 2 / Math.LN2);
    const k = Math.max(0, Math.ceil(lg2) - 400);
    // (beyond the double range of v the derivatives are not formed: the peak is below there)
    if (lg2 > 1100) {
      const f: [number, number, number, number] = [NaN, NaN, NaN, NaN];
      return { u: NaN, v: NaN, vs: NaN, sk: 1, k, f, d1: NaN, L2: NaN, aew: NaN };
    }
    const sk = 2 ** -k;
    const vs = t * Math.exp(w / 2 - k * Math.LN2);
    const v = vs / sk;
    const u = Math.abs(w) < 1 ? t - delta + t * Math.expm1(w / 2) : v - delta;
    // a e^w 2^-2k (from its log where e^w overflows: a subnormal a puts the peak near w = 735)
    const direct = k === 0 && w < 700;
    const aew = direct ? a * Math.exp(w) : Math.exp(la + w - 2 * k * Math.LN2);
    const v2 = vs * vs;
    let f: [number, number, number, number];
    if (cdf) {
      const [l1, l2, l3, l4] = logPhiDerivs(u);
      const l1v = l1 * sk * vs;
      const l3v = (l3 / sk) * vs;
      const l4v2 = (((l4 / sk) * vs) / sk) * vs;
      f = [
        l1v / 2,
        (l2 * v2 + l1v) / 4,
        (l3v * v2 + 3 * l2 * v2 + l1v) / 8,
        (l4v2 * v2 + 6 * l3v * v2 + 7 * l2 * v2 + l1v) / 16,
      ];
    } else {
      const uv = u * sk * vs;
      f = [0.5 * sk * sk - uv / 2, -(v2 + uv) / 4, -(3 * v2 + uv) / 8, -(7 * v2 + uv) / 16];
    }
    const d1 = (direct ? -a * Math.expm1(w) : -(aew - a * sk * sk)) + f[0];
    return { u, v, vs, sk, k, f, d1, L2: aew - f[1], aew };
  };
  // w*: as in laplace, over w up to 1418 (e^(w/2) up to the overflow threshold), from the estimate of the peak; a d1
  // that is not formed (beyond the double range) moves the upper end down. Where L' is about -a e^w Newton's steps are
  // about 1 long, so a step that does not halve the one before last is replaced by bisection (as in rtsafe)
  let lo = -1400;
  let hi = 1418;
  let w = 0;
  if (t > 0 && delta > 0) {
    const w0 = 2 * Math.log(delta / (t + (2 * a) / t));
    if (w0 > lo && w0 < hi) w = w0;
  }
  let p = at(w);
  let dx = hi - lo;
  let dxOld = dx;
  for (let i = 0; i < 400 && hi - lo > 4e-16 * Math.max(1, Math.abs(w)); i++) {
    if (Number.isNaN(p.d1) || Number.isNaN(p.L2)) {
      hi = w;
      w = (lo + hi) / 2;
      p = at(w);
      continue;
    }
    const step = p.d1 / p.L2;
    if ((Math.abs(step) * Math.sqrt(p.L2)) / p.sk < 1e-9) break;
    if (p.d1 > 0) lo = w;
    else if (p.d1 < 0) hi = w;
    else break;
    const next = w + step;
    if (next > lo && next < hi && Math.abs(2 * step) <= Math.abs(dxOld)) {
      dxOld = dx;
      dx = step;
      w = next;
    } else {
      dxOld = dx;
      dx = (hi - lo) / 2;
      w = lo + dx;
    }
    p = at(w);
  }
  const { u, vs, sk, k, f, L2, aew } = p;
  if (!(w > -1390 && (k > 0 || L2 >= 1e5)) || !Number.isFinite(L2)) return undefined;
  // (the peak, for the trapezoidal sum where the expansion is not accurate enough)
  sharp.w = w;
  sharp.sigma = Math.min(sk / Math.sqrt(L2), 10);
  const r3 = (-aew + f[2]) / L2;
  const r4 = (-aew + f[3]) / L2;
  const c1 = ((r4 / L2 / 8 + (5 * r3 * r3) / L2 / 24) * sk) * sk;
  // log(L2/a) (L2 here in units of 2^(2k)), without cancellation near w = 0
  let lr: number;
  if (k === 0 && w < 700) {
    const x = Math.expm1(w) - f[1] / a;
    lr = Math.abs(x) < 0.5 ? Math.log1p(x) : Math.log(Math.exp(w) - f[1] / a);
  } else lr = Math.log(L2) + 2 * k * Math.LN2 - la;
  // a (e^w - 1 - w), with a e^w from its log beyond the overflow of e^w (it may still overflow: the log is then -Inf)
  const aE = w > 700 ? Math.exp(la + w) - a * (1 + w) : a * expm1mxNum(w);
  const rest = -0.5 * lr - stirlerr(a) + Math.log1p(c1) - aE;
  const ud =
    Math.abs(w) < 1
      ? ddAdd(twoSum(t, -delta), twoProd(t, Math.expm1(w / 2)))
      : ddAdd(ddMulNum(ddExp([w / 2, 0]), t), [-delta, 0]);
  let value: Value;
  if (cdf) {
    const l = logPhiDD(ud);
    const log = l[0] + (l[1] + rest);
    value = { lin: log < -745 ? 0 : pnorm(ud[0]) * (1 + ud[1] * millsInv(ud[0])) * Math.exp(rest), log };
  } else {
    // (u²/2 as u (u/2): u² alone overflows from |u| = 1.34e154, u²/2 from 1.9e154)
    const uh = ddMul(ud, [ud[0] / 2, ud[1] / 2]);
    const log = -uh[0] + (rest + w / 2 - LN_SQRT_2PI - uh[1]);
    value = { lin: log < -745 ? 0 : Math.exp(log), log };
  }
  const q = cdf ? Math.abs(vs) / 2 / (Math.sqrt(L2) * Math.max(1, -u)) : 0;
  const inv = (sk * sk) / L2;
  return inv * inv + q ** 6 <= 1e-17 * Math.max(1, Math.abs(value.log)) ? value : undefined;
}

/**
 * Beyond this far log estimate (farLogEstimate), the double-precision log of the integrand has an absolute error (eps
 * times it) that no longer locates the peak of the trapezoidal sum (the sum overflowed or vanished from an estimate of
 * about 5e11 on: pt(5, 3, ncp 1e7) gave a log of +Infinity, pt(1, 10, ncp 1e9) NaN). There the integral is taken by
 * zTail, laplaceWide or, where the peak is broad, with Φ(-δ) (φ(δ) for the density) taken out (integrateShifted)
 */
const LOG_LARGE = 2 ** 30;

/**
 * Beyond this |δ| the logs of the integrand reach δ²/2 at some nodes even where the answer is moderate (the old
 * integral gave pt(1.6e15, 0.5, ncp 1e20) a log of +Infinity and pt(7.9e17, 1e5, ncp 1e20) -δ²/2). There the far log
 * estimate is below LOG_LARGE only for t/sqrt(2a) above 2^16, where zTail applies
 */
const D_LARGE = 2 ** 32;

/**
 * From this t/sqrt(2a) on (t δ > 0, beyond LOG_LARGE) the integrals are taken over z = Z (zTail). In w the peak narrows
 * as t grows: placing it on the nearest double leaves an error of about L'' ulp(w)²/2, w² eps t²/(8a) relative to the
 * log (180 eps at t/sqrt(2a) = 2^26, w = 27, where pt(t, 3, ncp 1e14) stepped by 0.1 in 1e12); here it is below
 * eps/500 for any w. The terms zTail leaves out are about 64 a⁴/t⁶ in the log, far below eps |log| from here on
 */
const T_Z = 2 ** 12;

/**
 * The tails and the density for t/sqrt(2a) >= T_Z, t δ > 0 (here both positive), over z = Z (formula B):
 *   P[T <= t] = Φ(-δ) + ∫ φ(z) Q(a, x(z)) dz,  P[T > t] = ∫ φ(z) P(a, x(z)) dz,
 *   f(t) = 2/(t Γ(a)) ∫ φ(z) x(z)^a e^(-x(z)) dz,
 * x(z) = a ((δ + z)/t)² = x0 (1 + 2z/δ + z²/δ²), x0 = a (δ/t)² (the integrals over z > -δ). With g = log Q, log P or
 * a log x - x, and its derivatives in log x, g1 = x g', g2 = x² g'' (these do not overflow for a tiny a, where g' is
 * about 1/(x log(1/x))), the integral is e^g(x0) E[e^(b Z + k Z²/2)] = e^g(x0) exp(b²/(2(1 - k))) / sqrt(1 - k),
 * b = 2 g1/δ, k = (4 g2 + 2 g1)/δ² (g to second order in z). The terms left out are about 64 a⁴/t⁶ in the log, and
 * z below -δ (cut off) lies some δ beyond the peak at z = b (|b| is at most about 2a δ/t², below δ 2^-23)
 */
function zTail(a: number, t: number, delta: number, kind: "lower" | "upper" | "pdf"): Value {
  const y = delta / t;
  const x0 = a * y * y;
  if (!Number.isFinite(x0)) {
    // (x0 beyond the double range: Q and the density are 0 to the double, P is 1)
    const log = kind === "upper" ? 0 : kind === "lower" ? pnorm(-delta, { logP: true }) : -Infinity;
    return { lin: Math.exp(log), log };
  }
  let base: number;
  let g1: number;
  let g2: number;
  if (kind === "pdf") {
    base = Math.LN2 - lgamma1p(a) + Math.log(a) - Math.log(t) + a * Math.log(x0) - x0;
    g1 = a - x0;
    g2 = -a;
  } else {
    const upper = kind === "upper";
    base = gammaInc(a, x0, upper, true);
    if (!upper && x0 > 1e4 * (a + 1)) {
      // Q = h S, h = x^(a-1) e^-x / Γ(a), S = Σ (a-1)...(a-k)/x^k: x d log Q/dx = -x/S, and x² d²log Q/dx² = x² S'/S²
      // (from the logs of h and Q, which are both about -x, the derivative would keep an error of eps x)
      let term = 1;
      let sum = 1;
      let dsum = 0;
      for (let j = 1; j < 20; j++) {
        term *= (a - j) / x0;
        sum += term;
        dsum -= j * term;
        if (Math.abs(term) < 1e-20) break;
      }
      g1 = -x0 / sum;
      g2 = (dsum * x0) / (sum * sum);
    } else {
      // x d log G/dx = ∓x^a e^-x / (Γ(a) G) for G = Q, P, and x² d²log G/dx² = g1 (a - 1 - x - g1)
      const h = Math.exp(dpoisRaw(a, x0, true) + Math.log(a) - base);
      g1 = upper ? h : -h;
      g2 = g1 * (a - 1 - x0 - g1);
    }
  }
  const b = (2 * g1) / delta;
  const k = (4 * g2 + 2 * g1) / delta / delta;
  const logI = base + (b * b) / (2 * (1 - k)) - 0.5 * Math.log1p(-k);
  const log = kind === "lower" ? logAddExp(pnorm(-delta, { logP: true }), logI) : logI;
  return { lin: log < -745 ? 0 : Math.exp(log), log };
}

/** log |e^x - 1| (x beyond 40: x, to 1e-17) */
function logAbsExpm1(x: number): number {
  return x > 40 ? x : Math.log(Math.abs(Math.expm1(x)));
}

/** log Φ(y - δ) - log Φ(-δ), where both are far in the left tail as the difference of the exponents and erfcx */
function logPhiRatio(y: number, delta: number): number {
  const z1 = y - delta;
  if (z1 < -5 && delta > 5) {
    return y * (delta - y / 2) + Math.log(erfcxNonNegative(-z1 * Math.SQRT1_2) / erfcxNonNegative(delta * Math.SQRT1_2));
  }
  return pnorm(z1, { logP: true }) - pnorm(-delta, { logP: true });
}

/**
 * The integral beyond LOG_LARGE where Laplace's method does not apply (a broad peak: t S small beside δ), as Φ(-δ) times
 * E[Φ(t S - δ)/Φ(-δ)] (the density: φ(δ) times E[S φ(t S - δ)/φ(δ)]): the log of the ratio, log Φ(t S - δ) - log Φ(-δ)
 * or t S (δ - t S/2), is of a moderate size there, and the trapezoidal sum of formula A finds its peak
 */
function integrateShifted(pr: Problem): Value {
  const shift = pr.kind === "cdf" ? pnorm(-pr.delta, { logP: true }) : -(pr.delta * (pr.delta / 2)) - LN_SQRT_2PI;
  if (shift === -Infinity) return { lin: 0, log: -Infinity };
  const { a, t, delta } = pr;
  // log λ, λ = |t δ|: for t δ < 0 the ratio is about e^(-λ S) (with S for the density), and the peak, at S = (2a + m)/λ
  // (m = 0, 1 for the distribution function and the density), falls out of the range of w (S below e^-700) from
  // λ = e^690 on. There the integral is the Laplace transform of the density of S near 0, 2 a^a/Γ(a) S^(2a-1):
  // E[S^m e^(-λ S)] = 2 a^a Γ(2a + m) / (Γ(a) λ^(2a + m)), to relative order (2a + m)/λ (also beside 1/sqrt(a), the scale
  // on which the density of S departs from its power, and the departure of the ratio from e^(-λ S), of order m/δ²)
  const lLam = Math.log(Math.abs(t)) + Math.log(Math.abs(delta));
  if (t * delta < 0 && lLam > 690) {
    const p = pr.kind === "cdf" ? 2 * a : 2 * a + 1;
    const log = shift + Math.LN2 + a * Math.log(a) - (lgamma1p(a) - Math.log(a)) + (lgamma1p(p) - Math.log(p)) - p * lLam;
    return { lin: log < -745 ? 0 : Math.exp(log), log };
  }
  if (!(pr.kind === "cdf" && a < A_TINY)) {
    const sp = { ...pr, shift };
    return integrateCore(sp, true, bracketedPeak(sp));
  }
  // For a tiny a most of the probability of S lies near 0, spread over w down to about -1/a, where ρ is 1: the integral
  // is 1 ∓ E[|ρ - 1|] (t < 0, t > 0), whose integrand peaks where t S δ is of order 1
  const sp = { ...pr, shift, complement: true };
  const lc = integrateCore(sp, true, bracketedPeak(sp)).log;
  const log = shift + (t < 0 ? Math.log1p(-Math.exp(lc)) : logAddExp(0, lc));
  return { lin: log < -745 ? 0 : Math.exp(log), log };
}

/**
 * The peak of the log integrand by bisection on the sign of L' (the peak of integrateShifted is broad, so 1e-12 in w is
 * ample). findPeak's Newton steps stall where L falls steeply over the range: for a large negative t S, L' is about
 * t S δ / 2 at w = 0, and its steps of 1e-14 were taken for convergence
 */
function bracketedPeak(pr: Problem): { w: number; sigma: number; L: number } {
  let lo = -1400;
  let hi = 1418;
  for (let i = 0; i < 200 && hi - lo > 1e-12 * Math.max(1, Math.abs(lo)); i++) {
    const m = (lo + hi) / 2;
    const d1 = logIntegrand(pr, m)[1];
    // (a d1 that is not formed lies beyond the double range on that side)
    if (d1 > 0 || (Number.isNaN(d1) && m < 0)) lo = m;
    else hi = m;
  }
  const w = (lo + hi) / 2;
  let [L, , d2] = logIntegrand(pr, w);
  if (Number.isNaN(d2)) {
    // (L'' from the differences of L')
    const h = 1e-4;
    d2 = (logIntegrand(pr, w + h)[1] - logIntegrand(pr, w - h)[1]) / (2 * h);
  }
  return { w, sigma: d2 < 0 ? Math.min(1 / Math.sqrt(-d2), 10) : 1, L };
}

function logAddExp(x: number, y: number): number {
  if (x === -Infinity) return y;
  if (y === -Infinity) return x;
  return x > y ? x + Math.log1p(Math.exp(y - x)) : y + Math.log1p(Math.exp(x - y));
}

/** Linear value and log of the integral (the log may be NaN unless needLog) */
function integrateCore(
  pr: Problem,
  needLog: boolean,
  peak?: { w: number; sigma: number; L: number },
  ddOffset = false,
): Value {
  const { w, sigma, L } = peak ?? findPeak(pr);
  // With a peak value this small the linear answer underflows to 0 (even after multiplying by the width)
  if (!needLog && L < -800) return { lin: 0, log: NaN };
  // If summing linearly would overflow or underflow, subtract the peak value L before summing
  const useLog = L < -650 || L > 650 || pr.shift !== undefined || ddOffset;
  // (with ddOffset, the log of the peak in double-double: subtracted from the nodes' in double-double)
  const off: DD = ddOffset ? integrand(pr, [w, 0], true) : [useLog ? L : 0, 0];
  const offset = off[0];
  // Peak value (approximate) used by the fast-path test
  const peakVal = useLog ? 0 : Math.exp(L);
  // Convergence test: halving the step roughly squares the error, so if the difference is below this the finer
  // value is accurate enough. In deep tails (summed on the log scale) the node values themselves carry an error
  // of about eps |L|, so stop there
  const tol = useLog && !ddOffset ? Math.max(1e-15, 2e-16 * Math.abs(L)) : 1e-15;
  let h = 0.5;
  let s = trapezoid(pr, w, sigma, h, useLog, offset, false, peakVal, ddOffset ? off[1] : undefined) * h;
  for (let level = 0; level < 6; level++) {
    const odd = trapezoid(pr, w, sigma, h / 2, useLog, offset, true, peakVal, ddOffset ? off[1] : undefined) * (h / 2);
    const s2 = s / 2 + odd;
    h /= 2;
    const conv = Math.abs(s2 - s) <= tol * Math.abs(s2);
    s = s2;
    if (conv) break;
  }
  if (!useLog) return { lin: s, log: Math.log(s) };
  if (pr.shift !== undefined) {
    // (only beyond LOG_LARGE, where the linear value is 0; with complement, E|ρ - 1| itself, without the shift)
    const log = (pr.complement ? 0 : pr.shift) + offset + Math.log(s);
    return { lin: log < -745 ? 0 : Math.exp(log), log };
  }
  if (ddOffset) {
    const log = offset + (off[1] + Math.log(s));
    return { lin: log < -745 ? 0 : Math.exp(log), log };
  }
  // exp(offset) s: take exp of offset first and multiply (exp(offset + log s) would have an error |offset| times larger)
  const lin = offset > -700 ? Math.exp(offset) * s : Math.exp(offset + 700) * s * Math.exp(-700);
  return { lin, log: offset + Math.log(s) };
}

function problem(a: number, t: number, delta: number, kind: Kind): Problem {
  // log C_a = log(a)/2 - log(2 pi)/2 - stirlerr(a)
  return { a, t, delta, kind, logC: 0.5 * Math.log(a) - LN_SQRT_2PI - stirlerr(a) };
}

/** P[T <= t] (lower) / P[T > t]. df finite and positive, t and δ finite */
/**
 * Beyond this |t|, extrapolate by a power law. As t → ±∞ the far tail is
 *   P ≈ (a/t²)^a / Gamma(a+1) E[(Z ± δ)_+^(2a)] (1 + O(a (|δ| + 8)² / t²))
 * so for |t| > T0, P(t) = P(T0) (T0/|t|)^(2a) (the correction is below 1e-18 relative).
 * (Avoids the peak of the integral moving far out in w = log(a S²/a), where it is hard to handle numerically)
 */
function farLimit(a: number, delta: number): number {
  return 1e10 * (Math.abs(delta) + 10) * Math.sqrt(a + 1);
}

/** Log of the far tail (upper if t > 0, lower if t < 0). Extrapolated if |t| > farLimit */
function farTailLog(t: number, a: number, delta: number): number {
  return Math.abs(t) > farLimit(a, delta) ? farTails(t, a, delta, t < 0).log : pntBoth(t, 2 * a, delta, t < 0).log;
}

/**
 * P[T <= t] (lower) / P[T > t] for |t| > T0 = farLimit, from both tails at T0 (same sign): the far tail times
 * (T0/|t|)^(2a), and the near tail grown by what the far tail lost. The near tail is 1 - (far) unless the far tail
 * is still the larger (for a tiny a it falls only as |t|^(-2a), from about Φ(±δ))
 */
function farTails(t: number, a: number, delta: number, lower: boolean): Value {
  const T0 = farLimit(a, delta);
  const s = Math.sign(t);
  const farLower = s < 0;
  const f0 = pntBoth(s * T0, 2 * a, delta, farLower);
  const r = Math.log(Math.abs(t)) - Math.log(T0);
  const k = 2 * a * r;
  const far = { lin: f0.lin > 0 ? f0.lin * Math.exp(-k) : Math.exp(f0.log - k), log: f0.log - k };
  if (lower === farLower) return far;
  if (far.lin < 0.5) return { lin: 1 - far.lin, log: Math.log1p(-far.lin) };
  const n0 = pntBoth(s * T0, 2 * a, delta, !farLower);
  const gain = -Math.expm1(-k);
  // (log k from log 2a where k is so small that it may be subnormal: for a subnormal a it kept a few bits only)
  const logGain = k < 1e-10 ? Math.log(2 * a) + Math.log(r) - k / 2 : Math.log(gain);
  return { lin: n0.lin + f0.lin * gain, log: logAddExp(n0.log, f0.log + logGain) };
}

/**
 * Whether |t| is so small that P[T <= t] = Φ(-δ) and P[T > t] = Φ(δ), their values at t = 0, to double precision.
 * For t > 0, P[T <= t] - Φ(-δ) = P[0 < Z + δ <= t S] = ∫ φ(x - δ) Q(a, a x²/t²) dx over x > 0 (t < 0 likewise). Beyond
 * x1 = |t| sqrt(y1/a), y1 = 4a + 2δ² + 800, Q(a, y) < e^(-0.4 y) is far below Φ(∓δ); below x1 the integral is at most
 * x1 φ(δ) (x1 |δ| < 1), at most x1 (|δ| + 2) relative to Φ(∓δ). Formula B would otherwise need S out to |δ|/|t|, where
 * e^w overflows
 */
function nearZero(t: number, a: number, delta: number): boolean {
  // (|t|/sqrt(a) first, and sqrt(y1) as a hypot: y1/a overflowed for a below about 1e-300 with a large δ, and at t = 0
  // the test was NaN, false, so that the integral was taken at t = 0 and gave NaN to qt)
  const r = (Math.abs(t) / Math.sqrt(a)) * Math.hypot(Math.SQRT2 * delta, Math.sqrt(4 * a + 800)) * (Math.abs(delta) + 2);
  if (Number.isFinite(r)) return r <= 1e-17;
  // (a factor overflowed, or |t|/sqrt(a) underflowed against it, at δ near the overflow threshold: by logs)
  const l =
    Math.log(Math.abs(t)) -
    0.5 * Math.log(a) +
    0.5 * Math.LN2 +
    Math.log(Math.hypot(delta, Math.sqrt(2 * a + 400))) +
    Math.log(Math.abs(delta) + 2);
  return l <= Math.log(1e-17);
}

/** Linear value and log of P[T <= t] (lower) / P[T > t] (the log may be NaN unless needLog) */
function pntBoth(t: number, df: number, delta: number, lower: boolean, needLog = true): Value {
  const a = df / 2;
  if (nearZero(t, a, delta)) {
    const d = lower ? -delta : delta;
    return { lin: pnorm(d), log: pnorm(d, { logP: true }) };
  }
  if (Math.abs(t) > farLimit(a, delta)) return farTails(t, a, delta, lower);
  // The upper tail E[Φ(δ - t S)] is the lower tail with (t, δ) replaced by (-t, -δ). The smaller tail is integrated
  // and the larger is 1 - (smaller), with its log by log1p: integrated itself it can exceed 1 by a few ulps. The lower
  // tail is likely the smaller below the median, about δ (when the guess is wrong the other tail is integrated too)
  const tail = (l: boolean): Value =>
    integrate(l ? problem(a, t, delta, "cdf") : problem(a, -t, -delta, "cdf"), needLog && l === lower);
  let side = t < delta;
  let v = tail(side);
  if (v.lin > 0.5) {
    side = !side;
    v = tail(side);
  }
  if (side === lower) return v;
  return { lin: 1 - v.lin, log: Math.log1p(-v.lin) };
}

function pntRaw(t: number, df: number, delta: number, lower: boolean, log: boolean): number {
  const v = pntBoth(t, df, delta, lower, log);
  return log ? v.log : v.lin;
}

function dntRaw(x: number, df: number, delta: number, log: boolean): number {
  const a = df / 2;
  const T0 = farLimit(a, delta);
  if (Math.abs(x) > T0) {
    // The density likewise: f(t) = f(T0) (T0/|t|)^(2a+1)
    const x0 = Math.sign(x) * T0;
    const lv = integrate(problem(a, x0, delta, "pdf"), true).log + (2 * a + 1) * (Math.log(T0) - Math.log(Math.abs(x)));
    return log ? lv : Math.exp(lv);
  }
  const v = integrate(problem(a, x, delta, "pdf"), log);
  return log ? v.log : v.lin;
}

/**
 * Above this df the central and noncentral t are taken from their limits (hugeDf*; shared with t.ts). The t
 * differs from the normal by terms of relative order t²/ν and 1/ν: where y = t²/ν < 1e-17 it is the normal to the
 * double (the absolute error in the log, about t⁴/ν, is below 1e-180 wherever the linear value is above the
 * underflow), and beyond, |t| > 3e91, the log of the far tail and of the density is -(ν/2) log1p(y) up to terms
 * below 1e-179 of it. The general code fails from about 1.3e300 on (NaN where its intermediate terms overflow)
 */
export const HUGE_DF = 1e200;

/** y = t²/ν (t² may overflow on its own) */
export function hugeDfRatio(t: number, n: number): number {
  const u = t / Math.sqrt(n);
  return u * u;
}

/**
 * Log of the far tail beyond |t| and of the density at t (relative error about eps) for n > HUGE_DF and
 * hugeDfRatio(t, n) >= 1e-17: -(n/2) log1p(t²/n), formed without overflow
 */
export function hugeDfTailLog(t: number, n: number): number {
  const u = Math.abs(t) / Math.sqrt(n);
  // log1p(u²) = 2 log u + log1p(1/u²) where u² is huge (n log u may overflow: the log is then -Infinity, as it is)
  if (u > 1e8) return -n * (Math.log(u) + 0.5 * Math.log1p(1 / (u * u)));
  const y = u * u;
  // (n/2) log1p(y) = (t²/2) log1p(y)/y, the ratio by its series for a small y (error y⁴/5)
  const g = y < 1e-5 ? 1 - y * (1 / 2 - y * (1 / 3 - y / 4)) : Math.log1p(y) / y;
  return -0.5 * Math.abs(t) * (Math.abs(t) * g);
}

/**
 * |t| with hugeDfTailLog(t, n) = logTarget (logTarget < 0), Infinity beyond the largest double: t² = n expm1(-2 logTarget / n).
 * (sqrt(n) is taken apart: through exp(log t) its log, up to 354, would multiply the rounding error)
 */
export function hugeDfTailQuantile(logTarget: number, n: number): number {
  const r = 2 * (-logTarget / n);
  return r < 700 ? Math.sqrt(n) * Math.sqrt(Math.expm1(r)) : Math.sqrt(n) * Math.exp(r / 2);
}

/**
 * P[T <= t] (lower) / P[T > t] for n > HUGE_DF and hugeDfRatio(t, n) >= 1e-17 from hugeDfTailLog: the tail beyond |t|
 * is its exp (0), the other is 1
 */
export function hugeDfTail(t: number, n: number, lowerTail: boolean, logP: boolean): number {
  const l = hugeDfTailLog(t, n);
  if (t < 0 === lowerTail) return logP ? l : Math.exp(l);
  return logP ? Math.log1p(-Math.exp(l)) : 1 - Math.exp(l);
}

/**
 * Whether the noncentral t at n > HUGE_DF and hugeDfRatio(t, n) >= 1e-17 has the central far tail and density
 * (hugeDfTailLog): δ shifts their log by about δ min(|t|, sqrt(n)), below 1e-19 of it here
 */
function hugeDfCentral(t: number, n: number, delta: number): boolean {
  return Math.abs(delta) <= 1e-20 * Math.min(Math.abs(t), Math.sqrt(n));
}

/**
 * df with a nonzero half: the smallest subnormal, whose half rounds to 0, is taken as twice itself (a = 5e-324). Below
 * about 1e-308 a = df/2 is rounded to the subnormal grid anyway; only the terms of order a beside Φ(∓δ) feel that
 */
function halvable(df: number): number {
  return df === Number.MIN_VALUE ? 2 * df : df;
}

export function dnt1(x: number, df0: number, ncp: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(df0) || Number.isNaN(ncp)) return NaN;
  if (df0 <= 0) return NaN;
  const df = halvable(df0);
  if (!Number.isFinite(x) || !Number.isFinite(ncp)) return log ? -Infinity : 0;
  if (df === Infinity) {
    const z = x - ncp;
    const lv = -0.5 * z * z - LN_SQRT_2PI;
    return log ? lv : Math.exp(lv);
  }
  if (df > HUGE_DF) {
    if (hugeDfRatio(x, df) < 1e-17) return dnorm(x - ncp, { log });
    if (hugeDfCentral(x, df, ncp)) {
      const lv = hugeDfTailLog(x, df);
      return log ? lv : Math.exp(lv);
    }
  }
  return dntRaw(x, df, ncp, log);
}

export function pnt1(q: number, df0: number, ncp: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(df0) || Number.isNaN(ncp)) return NaN;
  if (df0 <= 0) return NaN;
  const df = halvable(df0);
  const zero = lowerTail ? (logP ? -Infinity : 0) : logP ? 0 : 1;
  const one = lowerTail ? (logP ? 0 : 1) : logP ? -Infinity : 0;
  if (q === Infinity) return one;
  if (q === -Infinity) return zero;
  // δ = ±Inf: the distribution is concentrated at ±∞
  if (ncp === Infinity) return zero;
  if (ncp === -Infinity) return one;
  if (df === Infinity) return pnorm(q - ncp, { lowerTail, logP });
  if (q === 0) return pnorm(-ncp, { lowerTail, logP });
  if (df > HUGE_DF) {
    if (hugeDfRatio(q, df) < 1e-17) return pnorm(q - ncp, { lowerTail, logP });
    // The far tail beyond |q| (R 4.5.2 gives 0.5 for pt(-4.05e269, 3.586e307, ncp = 1), far in the left tail of
    // what is N(1, 1) to the double; the lower tail is 0 here)
    if (hugeDfCentral(q, df, ncp)) return hugeDfTail(q, df, lowerTail, logP);
  }
  return pntRaw(q, df, ncp, lowerTail, logP);
}

export function qnt1(p: number, df0: number, ncp: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(df0) || Number.isNaN(ncp)) return NaN;
  if (df0 <= 0) return NaN;
  const df = halvable(df0);
  const b = quantileBoundaries(p, -Infinity, Infinity, lowerTail, logP);
  if (b !== undefined) return b;
  if (df === Infinity) return ncp + qnorm(p, { lowerTail, logP });
  // ncp = ±Inf puts all the probability at ±∞ (pt is 0 or 1 at every finite t, in R too), so every quantile inside
  // (0, 1) is ±∞, as already for df = Inf above (R gives NaN for a finite df)
  if (!Number.isFinite(ncp)) return ncp;
  const { lower, logTarget, linearTarget } = smallerTail(p, lowerTail, logP);
  if (df > HUGE_DF) {
    // The quantiles of the limits of pnt1
    const x = ncp + qnorm(p, { lowerTail, logP });
    if (hugeDfRatio(x, df) < 1e-17) return x;
    const y = hugeDfTailQuantile(logTarget, df);
    if (hugeDfCentral(y, df, ncp)) return lower ? -y : y;
  }
  // Starting value: normal approximation (mean δ; t spreads a little in the direction of δ)
  const z = qnorm(logTarget, { lowerTail: lower, logP: true });
  const x0 = ncp + z * Math.sqrt(1 + (ncp * ncp) / (2 * df));
  // Solve by sign: compare with P[T <= 0] = Φ(-δ) to fix the sign of the answer, then solve for |t| on the log scale
  const l0 = pnorm(-ncp, { lowerTail: lower, logP: true });
  const positive = lower ? logTarget > l0 : logTarget < l0;
  if (logTarget === l0) return 0;
  const s = positive ? 1 : -1;
  // In terms of y = |t|: for s = 1, P[T <= y] increases in y; for s = -1, P[T <= -y] decreases
  const lowerY = s > 0 ? lower : !lower;
  // Iterations ask for the linear value and the log at the same point in succession, so cache the last result
  let lastY = NaN;
  let lastL = true;
  let last: Value = { lin: NaN, log: NaN };
  const cdfY = (y: number, l: boolean, log: boolean): number => {
    if (y !== lastY || l !== lastL) {
      last = pntBoth(s * y, df, ncp, s > 0 ? l : !l);
      lastY = y;
      lastL = l;
    }
    return log ? last.log : last.lin;
  };
  // Where the normal start is beyond 1e300 or not finite (ncp near the largest double, or a huge ncp^2 / df), the
  // quantile can lie beyond the largest double for any df: if the target is not reached there, it is ±Infinity. (The
  // solver broke down outside the doubles and returned 1 for qt(0.9, 2, ncp = 1e308); issue #136)
  if (!(Math.abs(x0) <= 1e300)) {
    const lMax = cdfY(Number.MAX_VALUE, lowerY, true);
    if (lowerY ? lMax < logTarget : lMax > logTarget) return s * Infinity;
  }
  // In the far tail, if the target is smaller than the probability at |t| = T0, solve directly with the power law
  const T0 = farLimit(df / 2, ncp);
  let hi = Infinity;
  if (!lowerY) {
    const lT0 = farTailLog(s * T0, df / 2, ncp);
    if (logTarget < lT0) {
      const ly = Math.log(T0) + (lT0 - logTarget) / df;
      return s * Math.exp(ly); // (Infinity where the quantile is beyond the largest double)
    }
    hi = T0;
  } else if (df < 1e-3 && cdfY(Number.MAX_VALUE, true, true) < logTarget) {
    // The near tail grows only as 1 - c |t|^(-2a) (c about Φ(±δ)), so for a small a it can stay below the target up to
    // the largest double (that needs 2a log(1.8e308) < log(2c), a < 5e-4): the quantile is beyond it
    return s * Infinity;
  }
  // Where the normal start falls on the other side of 0 (a small ν with a large δ, for one): on the side of δ,
  // P[sT <= y] = P[s Z + |δ| <= y S] is about P[S >= |δ|/y] = Q(a, a δ²/y²) when Φ is a step on the scale of S, so y
  // from the gamma quantile. (The start was 1, far above the quantile, from where the first step went to y = 0 and
  // the solver bisected back in log y across the doubly exponential fall of P: 50 ms at df = 1e-200, ncp = 1e4)
  const sideStart = (): number => {
    if (s * ncp <= 0) return 1;
    const g = qgammaStd(logTarget, df / 2, !lowerY, true);
    const y0 = Math.abs(ncp) * Math.sqrt(df / 2 / g);
    return y0 > 0 && Number.isFinite(y0) ? y0 : 1;
  };
  const y = invertContinuous({
    logTarget,
    ...(linearTarget !== undefined && { linearTarget }),
    lower: lowerY,
    cdf: (y, l) => cdfY(y, l, false),
    cdfLog: (y, l) => cdfY(y, l, true),
    pdfLog: (y) => dntRaw(s * y, df, ncp, true),
    x0: Math.min(Math.abs(x0) > 0 && Number.isFinite(x0) && Math.sign(x0) === s ? Math.abs(x0) : sideStart(), hi / 2),
    lo: 0,
    hi,
    positive: true,
  });
  return s * y;
}
