// Density, distribution function and quantile of the noncentral χ² distribution (ncp = λ).
//
// The noncentral χ² with k degrees of freedom and noncentrality λ is a mixture of central χ²_{k+2j} with
// weights Pois(j; λ/2) (Johnson, Kotz & Balakrishnan 1995, ch. 29). With y = x/2 and a = k/2,
//   P[X <= x] = Σ_j w_j P(a + j, y),  P[X > x] = Σ_j w_j Q(a + j, y)
//   f(x) = Σ_j w_j y^(a+j-1) e^-y / Gamma(a + j) / 2
// Consecutive components are linked by P(a+j, y) - P(a+j+1, y) = y^(a+j) e^-y / Gamma(a+j+1) = dpois(a + j; y)
// (src/internal/poissonMixture.ts). The density components can be written dpois(a + j; y) (a + j) / y.
// Quantiles use Newton's method starting from Patnaik's (1949) approximation (c χ²_ν, c = (k + 2λ)/(k + λ),
// ν = (k + λ)^2/(k + 2λ)).
// With a huge λ the mixture is slow and inaccurate far from the centre; there a Chernoff bound decides first whether
// the far tail is below the double range (then it is 0 and the near tail 1). For x λ > 4e18 the density comes from the
// large-argument expansion of the Bessel function and the distribution function from integrating it numerically.

import { dt0, dt1, quantileBoundaries, smallerTail } from "../internal/dpq.js";
import { invertContinuous } from "../internal/invert.js";
import { dpoisLogDD, mixtureCdf, mixtureCdfBoth, mixtureDensity, type MixtureKernel } from "../internal/poissonMixture.js";
import { gammaInc } from "../special/igam.js";
import { dpoisRaw } from "../special/loader.js";
import { ddAdd, ddDiv, twoProd, twoSum } from "../special/dd.js";
import { digamma } from "../special/psigamma.js";
import { dgamma1, qgamma1 } from "./gamma.js";

function gammaKernel(a: number, y: number): MixtureKernel {
  // For very small y the ratio y/(a+j) underflows, so keep it scaled by 2^500
  const tiny = y < 1e-250;
  const ys = tiny ? y * 2 ** 500 : y;
  return {
    ratioK: tiny ? -1 : 0,
    cdf: (j, lower, log) => gammaInc(a + j, y, lower, log),
    inc: (j, log) => {
      const [s, corr] = incCorrection(a, j, y);
      return log ? dpoisRaw(s, y, true) + corr : dpoisRaw(s, y, false) * (1 + corr);
    },
    // d_j / d_{j-1} = y / (a + j)
    ratio: (j) => ddDiv([ys, 0], twoSum(a, j)),
    incLogDD: (j) => {
      const [s, corr] = incCorrection(a, j, y);
      return ddAdd(dpoisLogDD(s, y), [corr, 0]);
    },
  };
}

/**
 * The shape a + j rounded to double, s, and the first-order change in log d_j from s to the exact a + j:
 * δ ∂log d/∂s with δ the rounding and ∂log dpois(s; y)/∂s = log y - ψ(s + 1). Far in a tail |log y - ψ(s + 1)| is
 * large (above 1 at s = 1130, y = 331), and since the recurrences carry d_j to every other term, the rounding of
 * s (1e-13 there) would otherwise reach the result in full
 */
function incCorrection(a: number, j: number, y: number): [number, number] {
  const [s, delta] = twoSum(a, j);
  return [s, delta === 0 ? 0 : delta * (Math.log(y) - digamma(s + 1))];
}

/** Whether the parameters are valid for the noncentral χ² (R gives NaN for df = Inf or ncp = Inf) */
function validParams(df: number, ncp: number): boolean {
  return df >= 0 && ncp >= 0 && Number.isFinite(df) && Number.isFinite(ncp);
}

/**
 * Linear value and log of P[X <= x] (lower) / P[X > x] (x > 0 finite, ncp > 0).
 * The log of a value near 1 is built with log1p from the small value of the other side
 */
function pnchisqBoth(x: number, df: number, ncp: number, lower: boolean): { lin: number; log: number } {
  const mu = ncp / 2;
  // x λ is very large: the peak of the series is too far away, so integrate the density (besselAsymptotic)
  if (mu * (x / 2) > 1e18) return besselTails(x, df, ncp, lower);
  // x so small that x/2 underflows to 0 (the smallest subnormal) is approximated by the smallest positive number
  const kernel = gammaKernel(df / 2, Math.max(x / 2, Number.MIN_VALUE));
  const own = mixtureCdfBoth(mu, kernel, lower);
  if (own.lin > 0.5) {
    // The log of a value near 1 is built with log1p from the small value of the other side (computed only when the log is needed)
    let lg: number | undefined;
    return {
      lin: own.lin,
      get log() {
        lg ??= Math.log1p(-mixtureCdf(mu, kernel, !lower, false));
        return lg;
      },
    };
  }
  return own;
}

function pnchisqRaw(x: number, df: number, ncp: number, lower: boolean, log: boolean): number {
  const v = pnchisqBoth(x, df, ncp, lower);
  return log ? v.log : v.lin;
}

/** Quantile iterations ask for the linear value and the log at the same x in succession, so cache the last result */
function memoCdf(df: number, ncp: number): (x: number, lower: boolean) => { lin: number; log: number } {
  let lastX = NaN;
  let lastLower = true;
  let last = { lin: NaN, log: NaN };
  return (x, lower) => {
    if (x !== lastX || lower !== lastLower) {
      last = pnchisqBoth(x, df, ncp, lower);
      lastX = x;
      lastLower = lower;
    }
    return last;
  };
}

/** Core of the log density (x > 0 finite, ncp > 0) */
function dnchisqRaw(x: number, df: number, ncp: number, log: boolean): number {
  const a = df / 2;
  const y = x / 2;
  const mu = ncp / 2;
  // The ratio of terms w_j g_j is mu y / (j (a + j - 1)); the peak is at the j where it equals 1
  const jStar = (-(a - 1) + Math.sqrt((a - 1) * (a - 1) + 4 * mu * y)) / 2;
  if (mu * y > 1e18) return besselAsymptotic(x, df, ncp, log);
  // Component density y^(a+j-1) e^-y / Gamma(a+j) = d_j (a + j) / y
  return mixtureDensity(mu, gammaKernel(a, y), (j) => a + j, jStar, x, log);
}

/**
 * Density for very large x λ. Apply to f(x) = exp(-(x+λ)/2) (x/λ)^(ν/2) I_ν(sqrt(λ x)) / 2 (ν = k/2 - 1) the
 * large-z asymptotic expansion of I_ν(z), e^z / sqrt(2 pi z) Σ_m (-1)^m a_m(ν) / z^m.
 * (The series cannot be summed because its peak j ≈ sqrt(λ x / 4) is too far out. z > 1e9, so the expansion converges in a few terms)
 */
function besselAsymptotic(x: number, df: number, ncp: number, log: boolean): number {
  const nu = df / 2 - 1;
  const z = Math.sqrt(ncp * x);
  const s = besselSeries(nu, z);
  // -(x + λ)/2 + z = -(sqrt(x) - sqrt(λ))^2 / 2, with sqrt(x) - sqrt(λ) written without cancellation (the difference
  // of the rounded roots carries an error of ulp(sqrt(λ))) and its square in double-double, as in besselTails
  const rl = Math.sqrt(ncp);
  const d = (x - ncp) / (Math.sqrt(x) + rl);
  const [p, pe] = twoProd(d, d);
  const hi = -p / 2;
  // (ν/2) log(x/λ) = ν log(sqrt(x)/sqrt(λ))
  const rest = -Math.LN2 - pe / 2 + nu * Math.log1p(d / rl) - 0.5 * Math.log(2 * Math.PI * z) + Math.log(s);
  if (log) return hi + rest;
  return hi > -700 ? Math.exp(hi) * Math.exp(rest) : Math.exp(hi + rest);
}

/** Σ_m (-1)^m a_m(ν) / z^m of besselAsymptotic */
function besselSeries(nu: number, z: number): number {
  const mu4 = 4 * nu * nu;
  let term = 1;
  let s = 1;
  for (let m = 1; m < 30; m++) {
    term *= -(mu4 - (2 * m - 1) * (2 * m - 1)) / (8 * m * z);
    s += term;
    if (Math.abs(term) < 1e-17 * Math.abs(s)) break;
  }
  return s;
}

/** log(sqrt(2 pi)) */
const LN_SQRT_2PI = 0.918938533204672741780329736406;

/**
 * Linear value and log of P[X <= x] (lower) / P[X > x] for very large x λ, by integrating the density of
 * besselAsymptotic. In t = sqrt(x) the density is g(t) = f(t²) 2t, with
 *   log g(t) = -(t - sqrt(λ))²/2 + (ν + 1/2) log(t / sqrt(λ)) - log sqrt(2 pi) + log S(t sqrt(λ))
 * (S the series of besselSeries, 1 + O(1/(t sqrt(λ)))): close to a unit normal density whatever λ is (for k = 1 it
 * is φ(t - sqrt(λ)), the term φ(t + sqrt(λ)) of the exact density being negligible). log g is concave (its second
 * derivative is -1 - (ν + 1/2)/t² up to O(1/(t sqrt(λ)))), so g falls on both sides of its mode, the root of
 * t² - sqrt(λ) t - (ν + 1/2) = 0. The tail beyond t0 = sqrt(x) away from the mode is the smaller one, at most about
 * 1/2 (g is symmetric up to O(1/sqrt(λ))); it is integrated from t0 outwards and the other tail is 1 - (that).
 * The integrand is g(t)/g(t0), which starts at 1 and decays monotonically, so the integral has full relative accuracy
 * even far in a tail; log g(t0) is added in log space, with (t0 - sqrt(λ))² in double-double since in a deep tail its
 * rounding would otherwise become the relative error of the probability.
 */
function besselTails(x: number, df: number, ncp: number, lower: boolean): { lin: number; log: number } {
  const nu = df / 2 - 1;
  const c = nu + 0.5;
  const rl = Math.sqrt(ncp);
  const t0 = Math.sqrt(x);
  // t0 - sqrt(λ) without cancellation
  const d0 = (x - ncp) / (t0 + rl);
  const mode = (rl + Math.sqrt(Math.max(ncp + 4 * c, 0))) / 2;
  const up = t0 >= mode;
  const dir = up ? 1 : -1;
  const ls0 = Math.log(besselSeries(nu, t0 * rl));
  // log(g(t0 + dir u) / g(t0)), written with the offset h so that it has no cancellation near u = 0
  const integrand = (u: number): number => {
    const h = dir * u;
    return Math.exp((-h * (2 * d0 + h)) / 2 + c * Math.log1p(h / t0) + Math.log(besselSeries(nu, (t0 + h) * rl)) - ls0);
  };
  // Rate at which log g falls at distance u from t0 (the derivative of log g, without the O(1/(t sqrt(λ))) part of S)
  const rate = (u: number): number => -dir * (c / (t0 + dir * u) - (d0 + dir * u));
  // Integrate over intervals of doubling width, starting from about the length over which g falls by e^-1. Since log g
  // is concave, the rest beyond u is at most g(u)/rate(u); stop when that is negligible
  const end = up ? Infinity : t0;
  let w = 1 / (1 + Math.abs(rate(0)));
  let a = 0;
  let sum = 0;
  for (let i = 0; i < 200 && a < end; i++) {
    const b = Math.min(a + w, end);
    sum += kronrodAdaptive(integrand, a, b, sum, 0);
    const r = rate(b);
    if (r > 0 && integrand(b) <= 1e-17 * r * sum) break;
    a = b;
    w *= 2;
  }
  const [p, pe] = twoProd(d0, d0);
  const hi = -p / 2;
  const rest = -pe / 2 + c * Math.log1p(d0 / rl) - LN_SQRT_2PI + ls0 + Math.log(sum);
  const tail = hi > -700 ? Math.exp(hi) * Math.exp(rest) : Math.exp(hi + rest);
  if (up !== lower) return { lin: tail, log: hi + rest };
  return { lin: 1 - tail, log: Math.log1p(-tail) };
}

// Gauss-Kronrod 7-15 rule (QUADPACK, public domain; as in src/integrate/quadpack.ts): Kronrod nodes, from the end of
// [-1, 1] to the centre, their weights, and the Gauss weights of the odd-numbered nodes
const GK15_X = [
  0.991455371120812639206854697526329, 0.949107912342758524526189684047851, 0.864864423359769072789712788640926,
  0.741531185599394439863864773280788, 0.58608723546769113029414483825873, 0.405845151377397166906606412076961,
  0.207784955007898467600689403773245, 0,
];
const GK15_WK = [
  0.02293532201052922496373200805897, 0.063092092629978553290700663189204, 0.104790010322250183839876322541518,
  0.140653259715525918745189590510238, 0.16900472663926790282658342659855, 0.190350578064785409913256402421014,
  0.204432940075298892414161999234649, 0.209482141084727828012999174891714,
];
const GK15_WG = [
  0.129484966168869693270611432679082, 0.27970539148927666790146777142378, 0.381830050505118944950369775488975,
  0.417959183673469387755102040816327,
];

/**
 * Integral of f over [a, b] by the 15-point Kronrod rule, bisecting while it differs from the 7-point Gauss rule by
 * more than 1e-15 of the total (`total`, the integral accumulated so far, or this part's own value). The difference
 * overestimates the error of the Kronrod value by far, so the result is good to about the rounding of the sum
 */
function kronrodAdaptive(f: (u: number) => number, a: number, b: number, total: number, depth: number): number {
  const m = (a + b) / 2;
  const h = (b - a) / 2;
  const fc = f(m);
  let k = GK15_WK[7]! * fc;
  let g = GK15_WG[3]! * fc;
  for (let j = 0; j < 7; j++) {
    const fs = f(m - h * GK15_X[j]!) + f(m + h * GK15_X[j]!);
    k += GK15_WK[j]! * fs;
    if (j % 2 === 1) g += GK15_WG[(j - 1) / 2]! * fs;
  }
  k *= h;
  g *= h;
  if (Math.abs(k - g) <= 1e-15 * Math.max(Math.abs(k), total) || depth >= 40) return k;
  return kronrodAdaptive(f, a, m, total, depth + 1) + kronrodAdaptive(f, m, b, total, depth + 1);
}

export function dnchisq1(x: number, df: number, ncp: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(df) || Number.isNaN(ncp)) return NaN;
  if (!validParams(df, ncp)) return NaN;
  if (ncp === 0) return dgamma1(x, df / 2, 2, log);
  if (x < 0 || x === Infinity) return log ? -Infinity : 0;
  if (x === 0) {
    // Diverges for df < 2; exp(-λ/2)/2 for df = 2; 0 for larger df
    if (df < 2) return Infinity;
    if (df === 2) return log ? -ncp / 2 - Math.LN2 : Math.exp(-ncp / 2) / 2;
    return log ? -Infinity : 0;
  }
  return dnchisqRaw(x, df, ncp, log);
}

export function pnchisq1(q: number, df: number, ncp: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(df) || Number.isNaN(ncp)) return NaN;
  if (!validParams(df, ncp)) return NaN;
  if (q < 0) return dt0(lowerTail, logP);
  if (q === 0) {
    // With 0 degrees of freedom there is a point mass exp(-λ/2) at 0
    if (df > 0) return dt0(lowerTail, logP);
    const lm = -ncp / 2;
    if (lowerTail) return logP ? lm : Math.exp(lm);
    return logP ? (lm < -Math.LN2 ? Math.log1p(-Math.exp(lm)) : Math.log(-Math.expm1(lm))) : -Math.expm1(lm);
  }
  if (ncp === 0) {
    // Central distribution. q so small that q/2 underflows to 0 is approximated by the smallest positive number
    return q === Infinity ? dt1(lowerTail, logP) : gammaInc(df / 2, Math.max(q / 2, Number.MIN_VALUE), lowerTail, logP);
  }
  if (q === Infinity) return dt1(lowerTail, logP);
  const neg = negligibleTail(chisqTailBound(q, df, ncp), lowerTail, logP);
  if (neg !== undefined) return neg;
  return pnchisqRaw(q, df, ncp, lowerTail, logP);
}

/**
 * Below this log a probability rounds to 0 in double precision (half the smallest subnormal is e^-745.13; the margin
 * covers the rounding of the bound itself)
 */
const LOG_NEGLIGIBLE = -746;

/**
 * A tail that a rigorous bound places below the smallest positive double: `far` is "lower" when P[X <= q] is
 * negligible, "upper" when P[X > q] is, undefined when neither bound decides it
 */
export type FarTail = "lower" | "upper" | undefined;

/**
 * The value of the requested tail when the far tail is negligible: the far tail is exactly 0, the near tail exactly 1
 * (log 0). The log of the far tail is left to the full computation (undefined).
 */
export function negligibleTail(far: FarTail, lowerTail: boolean, logP: boolean): number | undefined {
  if (far === undefined) return undefined;
  const wantFar = (far === "lower") === lowerTail;
  if (wantFar) return logP ? undefined : 0;
  return logP ? 0 : 1;
}

/**
 * Chernoff bounds of the noncentral χ²(k, λ), whose moment generating function is (1 - 2s)^(-k/2) e^(λs/(1 - 2s)):
 *   P[X <= q] <= e^(sq) (1 + 2s)^(-k/2) e^(-λs/(1 + 2s))   (s > 0),
 *   P[X >= q] <= e^(-sq) (1 - 2s)^(-k/2) e^(λs/(1 - 2s))   (0 < s < 1/2).
 * Both exponents are convex in s and are smallest at u = 1 ± 2s = (k + sqrt(k² + 4qλ)) / (2q), the positive root of
 * q u² - k u - λ = 0: u > 1 (q below the mean k + λ) for the lower tail, u < 1 for the upper. Returns the tail whose
 * bound is below the double range.
 */
function chisqTailBound(q: number, df: number, ncp: number): FarTail {
  const u = (df + Math.sqrt(df * df + 4 * q * ncp)) / (2 * q);
  if (!Number.isFinite(u)) return undefined;
  if (u > 1) {
    const s = (u - 1) / 2;
    const lb = s * q - (df / 2) * Math.log(u) - (ncp * s) / u;
    return lb < LOG_NEGLIGIBLE ? "lower" : undefined;
  }
  if (u < 1 && u > 0) {
    const s = (1 - u) / 2;
    const lb = -s * q - (df / 2) * Math.log(u) + (ncp * s) / u;
    return lb < LOG_NEGLIGIBLE ? "upper" : undefined;
  }
  return undefined;
}

export function qnchisq1(p: number, df: number, ncp: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(df) || Number.isNaN(ncp)) return NaN;
  // R returns an answer for ncp = Inf at the endpoints (p = 0, 1) only
  if (!(df >= 0 && ncp >= 0 && Number.isFinite(df))) return NaN;
  const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
  if (b !== undefined) return b;
  if (!Number.isFinite(ncp)) {
    // For ncp = Inf, R returns the endpoint value only when log p rounds to 1 (exp(p) == 1)
    if (logP && Math.exp(p) === 1) return lowerTail ? Infinity : 0;
    return NaN;
  }
  if (ncp === 0) return qgamma1(p, df / 2, 2, lowerTail, logP);
  const { lower, logTarget, linearTarget } = smallerTail(p, lowerTail, logP);
  const cdf = memoCdf(df, ncp);
  // If the distribution function at the smallest positive number already passes the target, the answer is 0 (includes the point mass for df = 0)
  // (the upper tail there is built from the lower one: the series for the upper tail itself takes seconds for λ = 1e12)
  const atMin = pnchisqRaw(Number.MIN_VALUE, df, ncp, true, lower);
  if (lower ? atMin >= logTarget : Math.log1p(-atMin) <= logTarget) return 0;
  // Patnaik's approximation as the starting value
  const c = (df + 2 * ncp) / (df + ncp);
  const nu = ((df + ncp) * (df + ncp)) / (df + 2 * ncp);
  let x0 = c * qgamma1(logTarget, nu / 2, 2, lower, true);
  if (!(x0 > 0) || !Number.isFinite(x0)) x0 = df + ncp;
  // Bracket by doubling the upper end (the distribution function is expensive for very large x)
  let hi = Math.max(x0, df + ncp, 1);
  for (let i = 0; i < 2000; i++) {
    const v = pnchisqRaw(hi, df, ncp, lower, true);
    if (lower ? v >= logTarget : v <= logTarget) break;
    hi *= 2;
  }
  return invertContinuous({
    logTarget,
    ...(linearTarget !== undefined && { linearTarget }),
    lower,
    cdf: (x, l) => cdf(x, l).lin,
    cdfLog: (x, l) => cdf(x, l).log,
    pdfLog: (x) => dnchisqRaw(x, df, ncp, true),
    // Start just inside the bracket when the first upper end already passes the target: a start at the end itself
    // falls back to bisection towards 0, through x where the series is slow (seconds for λ = 1e12)
    x0: x0 < hi ? x0 : hi * (1 - 2 ** -26),
    lo: 0,
    hi,
    positive: true,
  });
}
