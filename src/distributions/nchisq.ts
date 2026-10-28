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
// the far tail is below the double range (then it is 0 and the near tail 1). Where the mixture's terms spread over
// too many indices (the Bessel argument z = sqrt(λ x) large, or ν = k/2 - 1 large) the density f(x) =
// exp(-(x+λ)/2) (x/λ)^(ν/2) I_ν(z) / 2 comes from an asymptotic expansion of the Bessel function (the large-argument
// one where ν² <= z/100, the uniform one in ν otherwise) and the distribution function from integrating it numerically
// (asymptoticMethod). Quantiles whose distribution function steps within a few doubles end in a search over the doubles.

import { dt0, dt1, quantileBoundaries, smallerTail } from "../internal/dpq.js";
import { invertContinuous } from "../internal/invert.js";
import { kronrodAdaptive, narrowQuantile, negligibleNcp, quadratureControl, searchDoubles } from "../internal/noncentral.js";
import { dpoisLogDD, mixtureCdf, mixtureDensity, mixtureTail, type MixtureKernel } from "../internal/poissonMixture.js";
import { gammaInc } from "../special/igam.js";
import { dpoisRaw } from "../special/loader.js";
import { ddAdd, ddDiv, twoProd, twoSum, type DD } from "../special/dd.js";
import { digamma } from "../special/psigamma.js";
import { lgamma1p } from "../special/gamma.js";
import { log1pmx } from "../special/log1pmx.js";
import { dgamma1, qgamma1 } from "./gamma.js";
import { qnorm } from "./normal.js";

function gammaKernel(a: number, y: number): MixtureKernel {
  // For very small y the ratio y/(a+j) underflows, so keep it scaled by 2^500
  const tiny = y < 1e-250;
  const ys = tiny ? y * 2 ** 500 : y;
  return {
    ratioK: tiny ? -1 : 0,
    cdf: (j, lower, log) => gammaInc(a + j, y, lower, log),
    inc: (j, log) => {
      const [s, corr] = incCorrection(a, j, y);
      if (s < 1e-8) {
        const l = tinyShapeLog(s, y);
        return log ? l : Math.exp(l);
      }
      return log ? dpoisRaw(s, y, true) + corr : dpoisRaw(s, y, false) * (1 + corr);
    },
    // d_j / d_{j-1} = y / (a + j)
    ratio: (j) => ddDiv([ys, 0], twoSum(a, j)),
    incLogDD: (j) => {
      const [s, corr] = incCorrection(a, j, y);
      if (s < 1e-8) return ddAdd([-y, 0], [s * Math.log(y) - lgamma1p(s), 0]);
      return ddAdd(dpoisLogDD(s, y), [corr, 0]);
    },
  };
}

/**
 * log d_0 = s log y - y - log Γ(1 + s) for a tiny shape s (df < 2e-8): dpoisRaw's Stirling form cancels there (its terms
 * are of order log s, 255 at s = 1e-222, and lose that many ulps)
 */
function tinyShapeLog(s: number, y: number): number {
  return s * Math.log(y) - y - lgamma1p(s);
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
 * A value near 1, and its log, are built from the small value of the other side
 */
function pnchisqBoth(x: number, df: number, ncp: number, lower: boolean): { lin: number; log: number } {
  const mu = ncp / 2;
  // The series has too many terms (or gammaInc is slow for its huge shapes): integrate an asymptotic form of the density
  const method = asymptoticMethod(df, besselArg(x, ncp));
  if (method !== undefined) return method === "hankel" ? besselTails(x, df, ncp, lower) : debyeTails(x, df, ncp, lower);
  // x so small that x/2 underflows to 0 (the smallest subnormal) is approximated by the smallest positive number
  const kernel = gammaKernel(df / 2, Math.max(x / 2, Number.MIN_VALUE));
  if (mu > 1e8 && !lower) {
    // With a large λ (here x is far below the mean k + λ, as z is small) the upper sum would start about 10 sqrt(λ/2)
    // terms below λ/2 and take as many steps; the lower tail is the small one, so build the upper from it
    const p = mixtureCdf(mu, kernel, true, false);
    let lg: number | undefined;
    return {
      lin: 1 - p,
      get log() {
        lg ??= Math.log1p(-p);
        return lg;
      },
    };
  }
  // (the lower tail is likely the smaller below the mean k + λ)
  return mixtureTail(mu, kernel, lower, x < df + ncp);
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
  // (x so small that x/2 underflows to 0 is approximated by the smallest positive number, as in pnchisqBoth)
  const y = Math.max(x / 2, Number.MIN_VALUE);
  const mu = ncp / 2;
  const z = besselArg(x, ncp);
  const method = asymptoticMethod(df, z);
  if (method === "hankel") return besselAsymptotic(x, df, ncp, log);
  if (method === "debye") {
    const l = debyeAt(x, df, ncp).logf;
    return log ? l : Math.exp(l);
  }
  // The ratio of terms w_j g_j is mu y / (j (a + j - 1)) = (z/2)² / (j (a + j - 1)); the peak is at the j where it
  // equals 1, the positive root of j² + (a - 1) j - (z/2)² (written without cancellation for a > 1)
  const jStar = a > 1 ? (z * z) / 2 / (a - 1 + Math.hypot(a - 1, z)) : (-(a - 1) + Math.hypot(a - 1, z)) / 2;
  // Component density y^(a+j-1) e^-y / Gamma(a+j) = d_j (a + j) / y
  return mixtureDensity(mu, gammaKernel(a, y), (j) => a + j, jStar, x, log);
}

/** sqrt(λ x), the argument of the Bessel function in the density (without overflow) */
function besselArg(x: number, ncp: number): number {
  return Math.sqrt(ncp) * Math.sqrt(x);
}

/**
 * Above these Bessel arguments z the asymptotic expansions of I_ν(z) replace the mixture, whose terms spread over
 * about sqrt(z) indices (min(sqrt(z), z / sqrt(ν)) for large ν): the large-argument expansion where it applies, and
 * the uniform expansion in ν for the other ν (then ν > 100)
 */
const Z_HANKEL = 1e4;
const Z_ASYMPTOTIC = 1e6;

/**
 * Above this ν the uniform expansion replaces the mixture at any z (it holds uniformly in z; the incomplete gamma
 * function of the mixture's components can take 0.1 s for shapes of 1e37)
 */
const NU_UNIFORM = 1e4;

/**
 * The asymptotic expansion of I_ν(z) used, if any: the large-argument expansion (besselAsymptotic) where ν² <= z/100,
 * so that its terms fall by a factor 200 or more from the first, otherwise the uniform expansion in ν (debyeAt; then
 * ν > 100, where the large-argument expansion diverges for ν² >> z). Undefined: sum the mixture
 */
function asymptoticMethod(df: number, z: number): "hankel" | "debye" | undefined {
  const nu = df / 2 - 1;
  if (z > Z_HANKEL && nu * nu <= z / 100) return "hankel";
  return z > Z_ASYMPTOTIC || nu > NU_UNIFORM ? "debye" : undefined;
}

/**
 * sqrt(x) - sqrt(λ) in double-double, as (x - λ)/(sqrt(x) + sqrt(λ)) with the roots in double-double: the rounding of
 * a root would put a relative error of 1e-16 into d, and so an error of 1e-16 d² into the exponent -d²/2 (2e-14 of the
 * density at d = 14)
 */
function rootDiff(x: number, ncp: number): DD {
  return ddDiv(twoSum(x, -ncp), ddAdd(sqrtDD(x), sqrtDD(ncp)));
}

/** sqrt(x) in double-double (one Newton correction of the rounded root) */
function sqrtDD(x: number): DD {
  const s = Math.sqrt(x);
  const [p, pe] = twoProd(s, s);
  return [s, (x - p - pe) / (2 * s)];
}

/** The square of a double-double, as the pair [p, e] of twoProd with the cross term added to e */
function squareDD(d: DD): DD {
  const [p, pe] = twoProd(d[0], d[0]);
  return [p, pe + 2 * d[0] * d[1]];
}

/**
 * log(sqrt(x)/sqrt(λ)) = log(1 + d/sqrt(λ)) for d = sqrt(x) - sqrt(λ) (computed without cancellation by the caller).
 * Far below sqrt(λ) the ratio d/sqrt(λ) rounds to -1, so the log is taken of x and λ themselves
 */
function logRootRatio(d: number, rl: number, x: number): number {
  return d / rl > -0.5 ? Math.log1p(d / rl) : 0.5 * Math.log(x) - Math.log(rl);
}

/**
 * Density for very large x λ. Apply to f(x) = exp(-(x+λ)/2) (x/λ)^(ν/2) I_ν(sqrt(λ x)) / 2 (ν = k/2 - 1) the
 * large-z asymptotic expansion of I_ν(z), e^z / sqrt(2 pi z) Σ_m (-1)^m a_m(ν) / z^m.
 * (The series cannot be summed because its peak j ≈ sqrt(λ x / 4) is too far out. z > 1e4 and ν² <= z/100, so the
 * expansion converges in a few terms)
 */
function besselAsymptotic(x: number, df: number, ncp: number, log: boolean, dGiven?: DD): number {
  const nu = df / 2 - 1;
  const z = besselArg(x, ncp);
  const s = besselSeries(nu, z);
  // -(x + λ)/2 + z = -(sqrt(x) - sqrt(λ))^2 / 2, with sqrt(x) - sqrt(λ) in double-double (rootDiff) and its square
  // too, as in besselTails (dGiven: that difference from the caller, for an x known more precisely than its double)
  const rl = Math.sqrt(ncp);
  const dd = dGiven ?? rootDiff(x, ncp);
  const d = dd[0] + dd[1];
  const [p, pe] = squareDD(dd);
  const hi = -p / 2;
  // (ν/2) log(x/λ) = ν log(sqrt(x)/sqrt(λ))
  const rest = -Math.LN2 - pe / 2 + nu * logRootRatio(d, rl, x) - 0.5 * Math.log(2 * Math.PI * z) + Math.log(s);
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
  const d0dd = rootDiff(x, ncp);
  const d0 = d0dd[0] + d0dd[1];
  // Side of the mode (rl + sqrt(λ + 4c))/2, compared through its offset from sqrt(λ): t0 itself rounds to sqrt(λ) for x
  // within an ulp or two of a huge λ, where d0 can still be far from 0
  const modeOffset = ncp + 4 * c >= 0 ? (2 * c) / (Math.sqrt(ncp + 4 * c) + rl) : -rl / 2;
  const up = d0 >= modeOffset;
  const dir = up ? 1 : -1;
  const ls0 = Math.log(besselSeries(nu, t0 * rl));
  // log(g(t0 + dir u) / g(t0)), written with the offset h so that it has no cancellation near u = 0
  const integrand = (u: number): number => {
    const h = dir * u;
    const v = Math.exp((-h * (2 * d0 + h)) / 2 + c * Math.log1p(h / t0) + Math.log(besselSeries(nu, (t0 + h) * rl)) - ls0);
    // Below the mode the integral runs down to t = 0, where the expansion of S fails (z = t sqrt(λ) small); g is
    // negligible there (a factor e^-(z0 - z) or less), so a non-finite value is taken as 0
    return Number.isFinite(v) ? v : 0;
  };
  // Rate at which log g falls at distance u from t0 (the derivative of log g, without the O(1/(t sqrt(λ))) part of S)
  const rate = (u: number): number => -dir * (c / (t0 + dir * u) - (d0 + dir * u));
  // Integrate over intervals of doubling width, starting from about the length over which g falls by e^-1. Since log g
  // is concave, the rest beyond u is at most g(u)/rate(u); stop when that is negligible
  const end = up ? Infinity : t0;
  let w = 1 / (1 + Math.abs(rate(0)));
  let a = 0;
  let sum = 0;
  const control = quadratureControl();
  for (let i = 0; i < 200 && a < end; i++) {
    const b = Math.min(a + w, end);
    sum += kronrodAdaptive(integrand, a, b, sum, 0, control);
    const r = rate(b);
    if (r > 0 && integrand(b) <= 1e-17 * r * sum) break;
    a = b;
    w *= 2;
  }
  const [p, pe] = squareDD(d0dd);
  const hi = -p / 2;
  const rest = -pe / 2 + c * logRootRatio(d0, rl, x) - LN_SQRT_2PI + ls0 + Math.log(sum);
  const tail = hi > -700 ? Math.exp(hi) * Math.exp(rest) : Math.exp(hi + rest);
  if (up !== lower) return { lin: tail, log: hi + rest };
  return { lin: 1 - tail, log: Math.log1p(-tail) };
}

/**
 * Polynomials U_k(p) of the uniform asymptotic expansion of I_ν(ν w) (DLMF 10.41.3, 10.41.10), as coefficients of
 * p^0, p^1, ..., built with the recurrence U_(k+1)(p) = p²(1 - p²) U_k'(p) / 2 + ∫_0^p (1 - 5t²) U_k(t) dt / 8
 * (DLMF 10.41.11). |U_k(p)| <= 1.1 on [0, 1] for k <= 10 (11 at k = 12).
 */
const DEBYE_U: number[][] = (() => {
  const us: number[][] = [[1]];
  for (let k = 1; k <= 12; k++) {
    const u = us[k - 1]!;
    const v = new Array<number>(u.length + 3).fill(0);
    u.forEach((c, i) => {
      if (c === 0) return;
      v[i + 1] = v[i + 1]! + (i * c) / 2 + c / (8 * (i + 1));
      v[i + 3] = v[i + 3]! - (i * c) / 2 - (5 * c) / (8 * (i + 3));
    });
    us.push(v);
  }
  return us;
})();

/** Σ_k U_k(p) / ν^k of the uniform expansion (ν > 100: the terms left out are below 1e-19) */
function debyeSeries(nu: number, p: number): number {
  let s = 1;
  let scale = 1;
  for (let k = 1; k < DEBYE_U.length; k++) {
    scale /= nu;
    if (scale < 1e-20) break;
    const c = DEBYE_U[k]!;
    let v = 0;
    for (let i = c.length - 1; i >= 0; i--) v = v * p + c[i]!;
    s += v * scale;
  }
  return s;
}

/**
 * The uniform expansion at x (debyeAt) in the variable r = x / (ν + R), R = sqrt(ν² + z²): with it x = r (λ r + 2ν)
 * and R = λ r + ν exactly (R² - ν² = λ x)
 */
interface DebyeState {
  r: number;
  /** e = r - 1, without cancellation (the mode is near e = 0) */
  e: number;
  R: number;
  /** log of the series Σ_k U_k(ν/R) / ν^k */
  ls: number;
  /** log f(x) */
  logf: number;
}

/**
 * Density for large ν (asymptoticMethod), from the uniform expansion of I_ν(ν w), w = z/ν
 * (DLMF 10.41.3: e^(νη) / (sqrt(2 pi ν) (1 + w²)^(1/4)) Σ_k U_k(p) / ν^k, p = (1 + w²)^(-1/2),
 * νη = R + ν log(z / (ν + R)), R = sqrt(ν² + z²)):
 *   log f(x) = -log 2 + E - log sqrt(2 pi) - log(R)/2 + log Σ_k U_k(ν/R) / ν^k,
 *   E = -(x + λ)/2 + R + ν log(x / (ν + R)).
 * The terms of E are of order x (1e6 or more here) where E can be of order 1. In r = x/(ν + R) (so that
 * x = r (λ r + 2ν), R = λ r + ν) the exponent is the sum of two terms that are never positive,
 *   E = -(λ/2) e² + ν (log(1 + e) - e),  e = r - 1,
 * and e = (x - ν - R)/(ν + R) = -x N / (D (ν + R)), N = λ + 2ν - x (in double-double),
 * D = x - ν + R = x + z²/(R + ν), has no cancellation either.
 */
function debyeAt(x: number, df: number, ncp: number, nGiven?: number): DebyeState {
  const nu = df / 2 - 1;
  const z = besselArg(x, ncp);
  const R = Math.hypot(nu, z);
  const rn = R + nu;
  // (nGiven: N from the caller, for an x known more precisely than its double)
  const N = nGiven ?? ddSum(ddAdd(ddAdd(twoSum(ncp, df), [-2, 0]), [-x, 0]));
  const D = x + z * (z / rn);
  const e = -(x / D) * (N / rn);
  const ls = Math.log(debyeSeries(nu, nu / R));
  // log(1 + e) - e; far below the mode e rounds to -1, and log(1 + e) = log r is taken from x and ν + R
  const lm = e > -0.5 ? log1pmx(e) : Math.log(x) - Math.log(rn) - e;
  const logf = -Math.LN2 - (ncp / 2) * e * e + nu * lm - LN_SQRT_2PI - 0.5 * Math.log(R) + ls;
  return { r: x / rn, e, R, ls, logf };
}

/**
 * Linear value and log of P[X <= x] (lower) / P[X > x] for large ν (asymptoticMethod), by integrating the density
 * of debyeAt, as besselTails does in sqrt(x), here in r: dx = 2R dr, so the density in r is
 *   g(r) = exp(E) sqrt(R) S / sqrt(2 pi),  log g = -(λ/2) e² + ν (log(1 + e) - e) + log(R)/2 - log sqrt(2 pi) + log S,
 * which reduces to that of besselTails for ν = 0 (r = t/sqrt(λ)). log g is concave (its second derivative is
 * -λ - ν/r² up to O(1/R)), with its mode near e = 0. With r = r0 + h,
 *   log(g(r)/g(r0)) = -(λ/2) h (h + 2 e0) - ν h e0 / r0 + ν (log(1 + h/r0) - h/r0) + log(1 + λ h / R0)/2 + log(S/S0),
 * whose terms all have the sign of the result away from the mode.
 */
function debyeTails(x: number, df: number, ncp: number, lower: boolean, nGiven?: number): { lin: number; log: number } {
  const nu = df / 2 - 1;
  const { r: r0, e: e0, R: R0, ls: ls0, logf } = debyeAt(x, df, ncp, nGiven);
  // Derivative of log g at r = r0 + h (without the O(1/R²) part of S)
  const slope = (h: number): number => -(e0 + h) * (ncp + nu / (r0 + h)) + ncp / (2 * (R0 + ncp * h));
  const up = slope(0) <= 0;
  const dir = up ? 1 : -1;
  const integrand = (u: number): number => {
    const h = dir * u;
    const R = R0 + ncp * h;
    const v = Math.exp(
      -(ncp / 2) * h * (h + 2 * e0) - (nu * h * e0) / r0 + nu * log1pmx(h / r0) + 0.5 * Math.log1p((ncp * h) / R0) +
        Math.log(debyeSeries(nu, nu / R)) - ls0,
    );
    return Number.isNaN(v) ? 0 : v;
  };
  const rate = (u: number): number => -dir * slope(dir * u);
  // Integrate over intervals of doubling width from about the width over which g falls by e^-1; the rest beyond u is
  // at most g(u)/rate(u) (log-concavity)
  const end = up ? Infinity : r0;
  let w = 1 / (Math.abs(rate(0)) + Math.hypot(Math.sqrt(ncp), Math.sqrt(nu) / r0));
  let a = 0;
  let sum = 0;
  const control = quadratureControl();
  for (let i = 0; i < 200 && a < end; i++) {
    const b = Math.min(a + w, end);
    sum += kronrodAdaptive(integrand, a, b, sum, 0, control);
    const rb = rate(b);
    if (rb > 0 && integrand(b) <= 1e-17 * rb * sum) break;
    a = b;
    w *= 2;
  }
  // g(r0) = f(x0) 2 R0
  const lt = logf + Math.log(2 * R0) + Math.log(sum);
  const tail = Math.exp(lt);
  if (up !== lower) return { lin: tail, log: lt };
  return { lin: 1 - tail, log: Math.log1p(-tail) };
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
  if (negligibleNcp(ncp / 2, x / df)) return dgamma1(x, df / 2, 2, log);
  return dnchisqRaw(x, df, ncp, log);
}

/** The value of a double-double */
function ddSum(v: DD): number {
  return v[0] + v[1];
}

/**
 * log f(x) at x = x0 e^v, with the offset v taken exactly where the density varies faster than the rounding of x can
 * follow: in the asymptotic forms the exponent depends on x through sqrt(x) - sqrt(λ) or λ + 2ν - x, which are formed
 * from x0 and v (by expm1) instead of from the double x. Used by integrals over log x (src/distributions/nbeta.ts),
 * where x0 e^v rounded would put an error of eps |d log f / d log x| (eps sqrt(λ) near the mode) into each node.
 */
export function dnchisqLogNear(x0: number, v: number, df: number, ncp: number): number {
  const x = Math.abs(v) < 700 ? x0 * Math.exp(v) : Math.exp(Math.log(x0) + v);
  if (!(x > 0 && x < Infinity) || !validParams(df, ncp) || ncp === 0) return dnchisq1(x, df, ncp, true);
  const method = asymptoticMethod(df, besselArg(x, ncp));
  if (method === "hankel") {
    return besselAsymptotic(x, df, ncp, true, ddAdd(rootDiff(x0, ncp), [Math.sqrt(x0) * Math.expm1(v / 2), 0]));
  }
  if (method === "debye") {
    const n0 = ddAdd(ddAdd(twoSum(ncp, df), [-2, 0]), [-x0, 0]);
    return debyeAt(x, df, ncp, ddSum(ddAdd(n0, [-x0 * Math.expm1(v), 0]))).logf;
  }
  return dnchisqRaw(x, df, ncp, true);
}

/**
 * P(s, t) (lower) or Q(s, t) of the central gamma distribution (its log if log) for a large shape (s > 1e4), as the
 * central χ² with 2s degrees of freedom through debyeTails (λ = 0; the uniform expansion then reduces to Stirling's
 * series), at t = t0 e^v with the offset v exact: N = 2s - 2 - 2t is formed from t0 and v (src/distributions/nbeta.ts
 * integrates over log t, where the rounding of t0 e^v would carry an error of eps sqrt(s) into the log). The
 * incomplete gamma function can take 40 ms for such shapes (s = 1e12, t < s; 0.1 s at s = 1e37)
 */
export function gammaTailNear(s: number, t0: number, v: number, lower: boolean, log: boolean): number {
  const t = Math.abs(v) < 700 ? t0 * Math.exp(v) : Math.exp(Math.log(t0) + v);
  if (!(t > 0)) return lower ? (log ? -Infinity : 0) : log ? 0 : 1;
  if (t === Infinity) return lower ? (log ? 0 : 1) : log ? -Infinity : 0;
  const n = ddAdd(ddAdd(twoSum(2 * s, -2), [-2 * t0, 0]), [-2 * t0 * Math.expm1(v), 0]);
  const r = debyeTails(2 * t, 2 * s, 0, lower, ddSum(n));
  return log ? r.log : r.lin;
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
 * Near the mean the terms of the exponents (of order q s) cancel; with the root they reduce to
 *   -2q s² - (k/2) (log(1 ± 2s) ∓ 2s),  s = |λ + k - q| / (2q + 4qλ / (sqrt(k² + 4qλ) + k)),
 * whose terms are both of order s² (q s² and k s²) instead of q s (λ + k - q in double-double).
 */
function chisqTailBound(q: number, df: number, ncp: number): FarTail {
  const [h, l] = ddAdd(twoSum(ncp, df), [-q, 0]);
  const diff = h + l;
  const root = Math.hypot(df, 2 * Math.sqrt(q) * Math.sqrt(ncp));
  const s = Math.abs(diff) / (2 * q + 4 * q * (ncp / (root + df)));
  if (!(s > 0) || !Number.isFinite(s)) return undefined;
  const sign = diff > 0 ? 1 : -1;
  // The reduced form cancels in turn for large s, where q is far below the mean: there the direct form, with
  // u = 1 ± 2s (s can be near the overflow threshold for a tiny q, so log u and λs/u are formed without u)
  const lb =
    s <= 0.25
      ? -2 * q * s * s - (df / 2) * log1pmx(2 * sign * s)
      : sign > 0
        ? s * q - (df / 2) * (Math.LN2 + Math.log(s + 0.5)) - ncp / (2 + 1 / s)
        : -s * q - (df / 2) * Math.log1p(-2 * s) + (ncp * s) / (1 - 2 * s);
  if (!(lb < LOG_NEGLIGIBLE)) return undefined;
  return diff > 0 ? "lower" : "upper";
}

/**
 * The quantile x found by the Newton iteration if its log probability lp is within 1e-15 of the target, or within 1e-9
 * and x is the quantile to 1e-14 (x reaches the target and x (1 - 1e-14) does not: where the distribution function is
 * nearly flat in log x the iteration can stall 1e-8 away in log p, and where it is steep in log x, 1e-12 in log p can
 * be 4e-13 in x), otherwise that of `search`. The iteration fails where the distribution function is too steep to be
 * resolved by the doubles (for a huge df or ncp the spread can be below the spacing of x, so that the function steps
 * from 0 to 1/2 at one double); a search over the doubles (searchDoubles) then gives the smallest x that reaches the
 * target
 */
export function confirmQuantile(
  x: number,
  lp: number,
  logTarget: number,
  search: () => number,
  passes: (x: number) => boolean,
): number {
  const r = Math.abs(lp - logTarget) / Math.max(1, Math.abs(logTarget));
  if (r <= 1e-15 || (r <= 1e-9 && passes(x) && !passes(x * (1 - 1e-14)))) return x;
  return search();
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
  // If the distribution function at the smallest positive number already passes the target, the answer is 0 (includes
  // the point mass for df = 0). (For a large λ the upper tail there is built from the lower one: pnchisqBoth)
  const atMin = pnchisqRaw(Number.MIN_VALUE, df, ncp, lower, true);
  if (lower ? atMin >= logTarget : atMin <= logTarget) return 0;
  // Patnaik's approximation as the starting value (for a huge ν its quantile by Wilson and Hilferty's cube root)
  const c = (df + 2 * ncp) / (df + ncp);
  const nu = (df + ncp) * ((df + ncp) / (df + 2 * ncp));
  let x0: number;
  if (nu > 1e5) {
    const h = 2 / (9 * nu);
    x0 = c * nu * (1 - h + qnorm(logTarget, { lowerTail: lower, logP: true }) * Math.sqrt(h)) ** 3;
  } else x0 = c * qgamma1(logTarget, nu / 2, 2, lower, true);
  if (!(x0 > 0) || !Number.isFinite(x0)) x0 = df + ncp;
  const passes = (x: number): boolean => (lower ? cdf(x, true).log >= logTarget : cdf(x, false).log <= logTarget);
  const narrowSpread = Math.sqrt(2 * (df + 2 * ncp)) < 1e-10 * (df + ncp);
  const narrow = narrowSpread ? narrowQuantile(x0, Number.MAX_VALUE, passes) : undefined;
  if (narrow !== undefined) return narrow;
  // Bracket by doubling the upper end (the distribution function is expensive for very large x)
  let lo = 0;
  let hi = Math.max(x0, df + ncp, 1);
  for (let i = 0; i < 2000 && !passes(hi); i++) {
    lo = hi;
    hi *= 2;
  }
  const x = invertContinuous({
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
    maxIter: 60,
  });
  return confirmQuantile(x, cdf(x, lower).log, logTarget, () => searchDoubles(x, lo, hi, passes), passes);
}
