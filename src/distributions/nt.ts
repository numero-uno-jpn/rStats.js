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
// (farLimit).
//
// For accuracy, the node w and, on top of it, e^(w/2), the exponent a (e^w - 1 - w) and the normal argument
// t S - δ are formed in double-double (rounding in each is amplified hundreds of times in the tails). Nodes
// where the rounding effect is estimated to be at most eps times the peak value are computed in double
// precision (the fast path).

import { quantileBoundaries, smallerTail } from "../internal/dpq.js";
import { invertContinuous } from "../internal/invert.js";
import { ddAdd, ddMul, ddMulNum, twoSum, type DD } from "../special/dd.js";
import { erfcxNonNegative } from "../special/erf.js";
import { gammaInc } from "../special/igam.js";
import { dpoisRaw, stirlerr } from "../special/loader.js";
import { pnorm, qnorm } from "./normal.js";

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
}

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
    const x = a * ew;
    const upperG = pr.kind === "cdfQ";
    const lG = gammaInc(a, x, !upperG, true);
    const xf = a * Math.exp(dpoisRaw(a, x, true) - lG); // x f(x) / G
    const sgn = upperG ? -1 : 1;
    const L = Math.log(t / 2) + w / 2 - 0.5 * z * z - LN_SQRT_2PI + lG;
    const d1 = 0.5 - (z * tS) / 2 + sgn * xf;
    const d2 = -(tS * tS) / 4 - (z * tS) / 4 + sgn * xf * (a - x) - xf * xf;
    return [L, d1, d2];
  }
  let L = pr.logC - a * m;
  let d1 = -a * Math.expm1(w);
  let d2 = -a * ew;
  if (pr.kind === "cdf") {
    const r = millsInv(z);
    L += pnorm(z, { logP: true });
    d1 += (tS / 2) * r;
    d2 += (tS / 4) * r - (tS / 2) * (tS / 2) * r * (z + r);
  } else {
    L += w / 2 - 0.5 * z * z - LN_SQRT_2PI;
    d1 += 0.5 - (z * tS) / 2;
    d2 += -(tS * tS) / 4 - (z * tS) / 4;
  }
  return [L, d1, d2];
}

/** Peak w* (maximum of the log integrand) and width σ = 1/sqrt(-L'') */
function findPeak(pr: Problem): { w: number; sigma: number; L: number } {
  let w = 0;
  let [L, d1, d2] = logIntegrand(pr, w);
  for (let i = 0; i < 200; i++) {
    let step = d2 < 0 ? -d1 / d2 : Math.sign(d1);
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
  const zz = ddMul(zd, zd);
  return ddAdd([-zz[0] / 2, -zz[1] / 2], [Math.log(0.5 * erfcxNonNegative(-z * Math.SQRT1_2)), 0]);
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
      const v = base * Math.exp(-0.5 * z * z - LN_SQRT_2PI) * Sd;
      if ((Ed + Math.abs(z * tS) + z * z) * v <= 4 * peak) return [v, 0];
    }
  }
  const S = ddExp([w[0] / 2, w[1] / 2]);
  const ew = ddMul(S, S);
  if (pr.kind === "cdfQ" || pr.kind === "cdfP") {
    // (t S / 2) φ(t S - δ) G(a, a S^2)
    const zd = ddAdd(ddMulNum(S, t), [-delta, 0]);
    const zz = ddMul(zd, zd);
    const x = a * ew[0] + a * ew[1];
    const lower = pr.kind === "cdfP";
    if (log) {
      const rest = Math.log(t / 2) + Math.log(S[0]) + S[1] / S[0] - LN_SQRT_2PI + gammaInc(a, x, lower, true);
      return ddAdd([-zz[0] / 2, -zz[1] / 2], [rest, 0]);
    }
    const g = gammaInc(a, x, lower, false);
    return [(t / 2) * (S[0] + S[1]) * Math.exp(-0.5 * zz[0] - LN_SQRT_2PI) * (1 - zz[1] / 2) * g, 0];
  }
  const E = ddMulNum(expm1mx(w, ew), a); // a (e^w - 1 - w)
  if (!(E[0] < Infinity)) return [log ? -Infinity : 0, 0];
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
  return [Math.exp(pr.logC - E[0] - 0.5 * zz[0] - LN_SQRT_2PI) * (1 - E[1] - zz[1] / 2) * (S[0] + S[1]), 0];
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
): number {
  // If odd, only the odd-indexed nodes (the points added by halving the step)
  let sum = 0;
  const node = (z: number): number => {
    // w = w* + (σ/2)(z + 1 - e^-z): nearly linear on the right, stretched doubly exponentially on the left
    const ez = Math.exp(-z);
    const d = (sigma / 2) * (z - Math.expm1(-z));
    const v = integrand(pr, twoSum(w0, d), log, peak);
    const jac = (sigma / 2) * (1 + ez);
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
  if (pr.kind === "cdf") {
    const pk = findPeak(pr);
    const S = Math.exp(pk.w / 2);
    const widthW = Math.min(1 / Math.sqrt(pr.a * Math.exp(pk.w)), 10);
    if ((Math.abs(pr.t) * S * widthW) / 2 > 2) {
      if (pr.t > 0) {
        const r = integrateCore({ ...pr, kind: "cdfQ" }, needLog);
        return {
          lin: pnorm(-pr.delta) + r.lin,
          log: needLog ? logAddExp(pnorm(-pr.delta, { logP: true }), r.log) : NaN,
        };
      }
      return integrateCore({ ...pr, t: -pr.t, delta: -pr.delta, kind: "cdfP" }, needLog);
    }
    return integrateCore(pr, needLog, pk);
  }
  return integrateCore(pr, needLog);
}

function logAddExp(x: number, y: number): number {
  if (x === -Infinity) return y;
  if (y === -Infinity) return x;
  return x > y ? x + Math.log1p(Math.exp(y - x)) : y + Math.log1p(Math.exp(x - y));
}

/** Linear value and log of the integral (the log may be NaN unless needLog) */
function integrateCore(pr: Problem, needLog: boolean, peak?: { w: number; sigma: number; L: number }): Value {
  const { w, sigma, L } = peak ?? findPeak(pr);
  // With a peak value this small the linear answer underflows to 0 (even after multiplying by the width)
  if (!needLog && L < -800) return { lin: 0, log: NaN };
  // If summing linearly would overflow or underflow, subtract the peak value L before summing
  const useLog = L < -650 || L > 650;
  const offset = useLog ? L : 0;
  // Peak value (approximate) used by the fast-path test
  const peakVal = useLog ? 0 : Math.exp(L);
  // Convergence test: halving the step roughly squares the error, so if the difference is below this the finer
  // value is accurate enough. In deep tails (summed on the log scale) the node values themselves carry an error
  // of about eps |L|, so stop there
  const tol = useLog ? Math.max(1e-15, 2e-16 * Math.abs(L)) : 1e-15;
  let h = 0.5;
  let s = trapezoid(pr, w, sigma, h, useLog, offset, false, peakVal) * h;
  for (let level = 0; level < 6; level++) {
    const odd = trapezoid(pr, w, sigma, h / 2, useLog, offset, true, peakVal) * (h / 2);
    const s2 = s / 2 + odd;
    h /= 2;
    const conv = Math.abs(s2 - s) <= tol * Math.abs(s2);
    s = s2;
    if (conv) break;
  }
  if (!useLog) return { lin: s, log: Math.log(s) };
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
  const T0 = farLimit(a, delta);
  const s = Math.sign(t);
  const at = Math.min(Math.abs(t), T0);
  const pr = s > 0 ? problem(a, -at, -delta, "cdf") : problem(a, -at, delta, "cdf");
  const l0 = integrate(pr, true).log;
  return Math.abs(t) > T0 ? l0 + 2 * a * (Math.log(T0) - Math.log(Math.abs(t))) : l0;
}

/** Linear value and log of P[T <= t] (lower) / P[T > t] (the log of a value near 1 is built from the other side only when needed) */
function pntBoth(t: number, df: number, delta: number, lower: boolean): Value {
  const a = df / 2;
  if (Math.abs(t) > farLimit(a, delta)) {
    const lf = farTailLog(t, a, delta);
    const far = t > 0 ? !lower : lower;
    if (far) return { lin: Math.exp(lf), log: lf };
    return { lin: -Math.expm1(lf), log: Math.log1p(-Math.exp(lf)) };
  }
  // The upper tail E[Φ(δ - t S)] is the lower tail with (t, δ) replaced by (-t, -δ)
  const own = integrate(lower ? problem(a, t, delta, "cdf") : problem(a, -t, -delta, "cdf"), true);
  if (own.lin <= 0.5) return own;
  let lg: number | undefined;
  return {
    lin: own.lin,
    get log() {
      // The log of a value near 1 is built with log1p from the small value of the other side
      lg ??= Math.log1p(-integrate(lower ? problem(a, -t, -delta, "cdf") : problem(a, t, delta, "cdf"), false).lin);
      return lg;
    },
  };
}

function pntRaw(t: number, df: number, delta: number, lower: boolean, log: boolean): number {
  if (!log) {
    const a = df / 2;
    if (Math.abs(t) <= farLimit(a, delta)) {
      return integrate(lower ? problem(a, t, delta, "cdf") : problem(a, -t, -delta, "cdf"), false).lin;
    }
  }
  const v = pntBoth(t, df, delta, lower);
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

export function dnt1(x: number, df: number, ncp: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(df) || Number.isNaN(ncp)) return NaN;
  if (df <= 0) return NaN;
  if (!Number.isFinite(x) || !Number.isFinite(ncp)) return log ? -Infinity : 0;
  if (df === Infinity) {
    const z = x - ncp;
    const lv = -0.5 * z * z - LN_SQRT_2PI;
    return log ? lv : Math.exp(lv);
  }
  return dntRaw(x, df, ncp, log);
}

export function pnt1(q: number, df: number, ncp: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(df) || Number.isNaN(ncp)) return NaN;
  if (df <= 0) return NaN;
  const zero = lowerTail ? (logP ? -Infinity : 0) : logP ? 0 : 1;
  const one = lowerTail ? (logP ? 0 : 1) : logP ? -Infinity : 0;
  if (q === Infinity) return one;
  if (q === -Infinity) return zero;
  // δ = ±Inf: the distribution is concentrated at ±∞
  if (ncp === Infinity) return zero;
  if (ncp === -Infinity) return one;
  if (df === Infinity) return pnorm(q - ncp, { lowerTail, logP });
  if (q === 0) return pnorm(-ncp, { lowerTail, logP });
  return pntRaw(q, df, ncp, lowerTail, logP);
}

export function qnt1(p: number, df: number, ncp: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(df) || Number.isNaN(ncp)) return NaN;
  if (df <= 0) return NaN;
  const b = quantileBoundaries(p, -Infinity, Infinity, lowerTail, logP);
  if (b !== undefined) return b;
  if (df === Infinity) return ncp + qnorm(p, { lowerTail, logP });
  // ncp = ±Inf concentrates the distribution at ±∞ and the quantile is undefined, so NaN (R's answer mixes NaN and ±Inf depending on p)
  if (!Number.isFinite(ncp)) return NaN;
  const { lower, logTarget, linearTarget } = smallerTail(p, lowerTail, logP);
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
  // In the far tail, if the target is smaller than the probability at |t| = T0, solve directly with the power law
  const T0 = farLimit(df / 2, ncp);
  let hi = Infinity;
  if (!lowerY) {
    const lT0 = farTailLog(s * T0, df / 2, ncp);
    if (logTarget < lT0) {
      const ly = Math.log(T0) + (lT0 - logTarget) / df;
      return ly > 709.78 ? s * Infinity : s * Math.exp(ly);
    }
    hi = T0;
  }
  const y = invertContinuous({
    logTarget,
    ...(linearTarget !== undefined && { linearTarget }),
    lower: lowerY,
    cdf: (y, l) => cdfY(y, l, false),
    cdfLog: (y, l) => cdfY(y, l, true),
    pdfLog: (y) => dntRaw(s * y, df, ncp, true),
    x0: Math.min(Math.abs(x0) > 0 && Number.isFinite(x0) && Math.sign(x0) === s ? Math.abs(x0) : 1, hi / 2),
    lo: 0,
    hi,
    positive: true,
  });
  return s * y;
}
