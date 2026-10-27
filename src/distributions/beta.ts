// Beta distribution dbeta / pbeta / qbeta.
//
// The density uses the relation to the binomial probability (Loader 2000) (dbetaCore). The distribution function
// uses the incomplete beta function (src/special/incbet.ts), and quantiles use Newton's method in u = log x
// (src/internal/invert.ts). Upper-tail quantiles are computed as x = 1 - (lower quantile of Beta(b, a)) to avoid
// cancellation near 1. Passing ncp gives the noncentral beta (src/distributions/nbeta.ts).

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, smallerTail, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { invertContinuous } from "../internal/invert.js";
import { lbeta } from "../special/beta.js";
import { betaInc, betaIncBoth } from "../special/incbet.js";
import { dbinomExponent } from "../special/loader.js";
import { ddAdd, ddLog, ddMul, ddNeg, twoSum, type DD } from "../special/dd.js";
import type { NoncentralOption } from "../internal/noncentral.js";
import { dnbeta1, pnbeta1, qnbeta1 } from "./nbeta.js";
import { qnorm } from "./normal.js";
import { qgammaStd } from "./gamma.js";

/** Form x and 1 - x as a double-double pair based on the smaller of the two (no rounding of 1 - x brought in) */
function pair(x: number): [DD, DD] {
  return x <= 0.5 ? [[x, 0], twoSum(1, -x)] : [twoSum(1, -(1 - x)), [1 - x, 0]];
}

/**
 * Density (0 < x < 1, 0 < a, b < Inf).
 * From the relation to the binomial probability dbinom(a; a + b, x) = Gamma(a+b+1)/(Gamma(a+1) Gamma(b+1)) x^a (1-x)^b,
 *   f(x) = x^(a-1) (1-x)^(b-1) / B(a, b) = dbinom(a; a + b, x) * a b / ((a + b) x (1 - x))
 * (valid for any a, b > 0). x and 1 - x are passed as a double-double pair.
 */
function dbetaCore(x: number, a: number, b: number, log: boolean): number {
  const [xd, xcd] = pair(x);
  if ((a + b) * Math.min(xd[0], xcd[0]) < 2.2250738585072014e-308) {
    const l = dbetaDirectLog(xd, xcd, a, b);
    return log ? l : Math.exp(l);
  }
  const { e } = dbinomExponent(a, b, xd, xcd);
  // With m = ab/(a+b), log(denom)/2 = log(2 pi m)/2 and log(ab/(a+b)) - log(denom)/2 = log(m/(2 pi))/2
  const m = (a * b) / (a + b);
  if (!log && e[0] < 700 && x > 1e-290 && xcd[0] > 1e-290) {
    // f = exp(-E) sqrt(m/(2 pi)) / (x (1 - x)) on the linear scale: no logarithms are needed, and the factors after
    // exp(-E) cost a few roundings whatever the size of log x (in the log form, log x near -700 alone would carry
    // an absolute error of 0.5 ulp = 6e-14 in double precision)
    const v = Math.exp(-e[0]) * (1 - e[1]) * Math.sqrt(m / (2 * Math.PI));
    if (v > 1e-290 && v < 1e290) {
      const xx = ddMul(xd, xcd);
      return (v / xx[0]) * (1 - xx[1] / xx[0]);
    }
  }
  // log f = -E + log(m/(2 pi))/2 - log(x (1 - x)), with log(x (1 - x)) in double-double (from the double-double
  // product, one logarithm instead of two, unless x or 1 - x is so small that the product would lose its low part)
  const lxx = x > 1e-290 && xcd[0] > 1e-290 ? ddLog(ddMul(xd, xcd)) : ddAdd(ddLog(xd), ddLog(xcd));
  const lc =
    m > 1e-290 && m < 1e290
      ? 0.5 * Math.log(m / (2 * Math.PI))
      : 0.5 * (Math.log(a) + Math.log(b) - Math.log(a + b) - Math.log(2 * Math.PI));
  const t = ddAdd(ddNeg(ddAdd(e, lxx)), [lc, 0]);
  return log ? t[0] + t[1] : Math.exp(t[0]) * (1 + t[1]);
}

/**
 * Log density when one shape is 1 (0 < x < 1, 0 < a, b < Inf, not both 1). The density is elementary:
 *   log f = log(b) + (b - 1) log(1 - x)  for a = 1,   log f = log(a) + (a - 1) log(x)  for b = 1
 * (B(1, b) = 1/b). Evaluated in double-double, with 1 - x exact, so that the result is correctly rounded in practice
 * and exactly 0 where the two terms cancel, as R's (for example Beta(1, 2) at x = 1/2)
 */
function dbetaShape1Log(x: number, a: number, b: number): number {
  const [xd, xcd] = pair(x);
  const [s, l] = a === 1 ? [b, xcd] : [a, xd];
  const t = ddAdd(ddLog([s, 0]), ddMul(twoSum(s, -1), ddLog(l)));
  return t[0] + t[1];
}

/**
 * log f = (a - 1) log x + (b - 1) log(1 - x) - log B(a, b) directly, in double-double, for (a + b) x or (a + b)(1 - x)
 * below the normal range: the deviances of dbinomExponent take the log of that product, which has then lost its
 * digits or underflowed to 0 (dbeta(2.7e-289, 7.5e-126, 7.6e-180) threw a TypeError). Such products need tiny shapes
 * or x, where the terms are of moderate size and Loader's form brings nothing
 */
function dbetaDirectLog(xd: DD, xcd: DD, a: number, b: number): number {
  const t = ddAdd(ddMul(twoSum(a, -1), ddLog(xd)), ddMul(twoSum(b, -1), ddLog(xcd)));
  return t[0] + (t[1] - lbeta(a, b));
}

/** Log density (0 < a, b < Inf; also at x = 0 or 1, which a quantile search in log x reaches by underflow, as dbeta) */
export function dbetaLog(x: number, _xc: number, a: number, b: number): number {
  if (!(x > 0 && x < 1)) return dbeta1(x, a, b, true);
  return dbetaCore(x, a, b, true);
}

export function dbeta1(x: number, a: number, b: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(a) || Number.isNaN(b)) return NaN;
  if (a < 0 || b < 0) return NaN;
  if (x < 0 || x > 1) return d0(log);
  // Point masses when a parameter is 0 or infinite
  if (a === 0 || b === 0 || !Number.isFinite(a) || !Number.isFinite(b)) {
    if (a === 0 && b === 0) return x === 0 || x === 1 ? Infinity : d0(log);
    if (a === 0 || b / a === Infinity) return x === 0 ? Infinity : d0(log);
    if (b === 0 || a / b === Infinity) return x === 1 ? Infinity : d0(log);
    return x === 0.5 ? Infinity : d0(log);
  }
  if (x === 0) {
    if (a > 1) return d0(log);
    if (a < 1) return Infinity;
    return log ? Math.log(b) : b;
  }
  if (x === 1) {
    if (b > 1) return d0(log);
    if (b < 1) return Infinity;
    return log ? Math.log(a) : a;
  }
  // Beta(1, 1) is uniform: density exactly 1, log density exactly 0 (as in R)
  if (a === 1 && b === 1) return log ? 0 : 1;
  if (log && (a === 1 || b === 1)) return dbetaShape1Log(x, a, b);
  return dbetaCore(x, a, b, log);
}

export function pbeta1(q: number, a: number, b: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(a) || Number.isNaN(b)) return NaN;
  if (a < 0 || b < 0) return NaN;
  if (q >= 1) return dt1(lowerTail, logP);
  // Point masses when a parameter is 0 or infinite (R checks this after q >= 1 and before q <= 0)
  if (a === 0 || b === 0 || !Number.isFinite(a) || !Number.isFinite(b)) {
    if (a === 0 && b === 0) return logP ? -Math.LN2 : 0.5; // 1/2 each at 0 and 1
    if (a === 0 || b / a === Infinity) return dt1(lowerTail, logP); // concentrated at 0
    if (b === 0 || a / b === Infinity) return dt0(lowerTail, logP); // concentrated at 1
    return q < 0.5 ? dt0(lowerTail, logP) : dt1(lowerTail, logP); // concentrated at 1/2
  }
  if (q <= 0) return dt0(lowerTail, logP);
  return betaInc(a, b, q, 1 - q, lowerTail, logP);
}

/**
 * Starting value for quantiles (Abramowitz & Stegun 26.5.22). Approximates the x with I_x(a, b) = target if lower,
 * otherwise 1 - I_x(a, b) = target. Used only for a, b > 1; undefined otherwise.
 *   x ≈ a / (a + b e^(2w)),  w = y sqrt(h + λ)/h - (1/(2b-1) - 1/(2a-1)) (λ + 5/6 - 2/(3h)),
 *   h = 2 / (1/(2a-1) + 1/(2b-1)),  λ = (y^2 - 3)/6,  y is the normal point whose upper probability equals I_x
 */
export function betaQuantileGuess(a: number, b: number, lower: boolean, logTarget: number): number | undefined {
  if (!(a > 1 && b > 1)) return undefined;
  const z = qnorm(logTarget, { logP: true });
  const y = lower ? -z : z;
  const ra = 1 / (2 * a - 1);
  const rb = 1 / (2 * b - 1);
  const h = 2 / (ra + rb);
  const lam = (y * y - 3) / 6;
  if (!(h + lam > 0)) return undefined;
  const w = (y * Math.sqrt(h + lam)) / h - (rb - ra) * (lam + 5 / 6 - 2 / (3 * h));
  const x = a / (a + b * Math.exp(2 * w));
  return x > 0 && x < 1 ? x : undefined;
}

/**
 * Solve for the quantile in frame (a, b) when the answer lies in (0, 1/2].
 * I_x(a, b) = target if lower, otherwise 1 - I_x(a, b) = target.
 */
function solveLeftHalf(
  a: number,
  b: number,
  lower: boolean,
  logTarget: number,
  linearTarget: number | undefined,
): number {
  // If the distribution function at the smallest positive number already passes the target, the answer is too small to represent (0)
  const atMin = betaInc(a, b, Number.MIN_VALUE, 1, lower, true);
  if (lower ? atMin >= logTarget : atMin <= logTarget) return 0;
  // Starting value: near 0, the tail approximation I_x(a, b) ≈ x^a / (a B(a, b)); otherwise the A&S 26.5.22 approximation
  let x0 = 0.25;
  let tail = Infinity;
  if (lower) {
    const lguess = (logTarget + Math.log(a) + lbeta(a, b)) / a;
    tail = Math.exp(Math.max(lguess, -745));
    x0 = Math.min(tail, 0.25);
  }
  if (!(tail < 1e-3)) {
    const g = betaQuantileGuess(a, b, lower, logTarget);
    if (g !== undefined && g < 0.5) x0 = g;
  }
  if (b > 1e10 && b > 1e10 * a) {
    // b X tends to Gamma(a): start from the gamma quantile. From 0.25 the log probability (about b log(3/4)) and the
    // log density each round to 1e-16 of their size, and their difference, the Newton slope, was noise for b = 4e204
    // (qbeta(9.3e-85, 1, 4e204, { lowerTail: false }) returned 0)
    const g = qgammaStd(logTarget, a, lower, true) / b;
    if (g > 0 && g < 0.5) x0 = g;
  }
  return invertContinuous({
    logTarget,
    ...(linearTarget !== undefined && { linearTarget }),
    lower,
    cdf: (x, l) => betaInc(a, b, x, 1 - x, l, false),
    cdfLog: (x, l) => betaInc(a, b, x, 1 - x, l, true),
    cdfBoth: (x, l) => betaIncBoth(a, b, x, 1 - x, l),
    pdfLog: (x) => dbetaLog(x, 1 - x, a, b),
    dlogPdf: (x) => (a - 1) / x - (b - 1) / (1 - x),
    x0,
    lo: 0,
    hi: 0.5,
    positive: true,
  });
}

export function qbeta1(p: number, a: number, b: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(a) || Number.isNaN(b)) return NaN;
  if (a < 0 || b < 0) return NaN;
  const bd = quantileBoundaries(p, 0, 1, lowerTail, logP);
  if (bd !== undefined) return bd;
  // Point masses when a parameter is 0 or infinite
  if (a === 0 || b === 0 || !Number.isFinite(a) || !Number.isFinite(b)) {
    if (a === 0 && b === 0) {
      const lp = logP ? p : Math.log(p);
      const lower = lowerTail ? lp : Math.log1p(-Math.exp(lp));
      if (lower < -Math.LN2) return 0;
      if (lower > -Math.LN2) return 1;
      return 0.5;
    }
    if (a === 0 || b / a === Infinity) return 0;
    if (b === 0 || a / b === Infinity) return 1;
    return 0.5;
  }
  const { lower, logTarget, linearTarget } = smallerTail(p, lowerTail, logP);
  // Decide whether the answer lies left or right of 1/2 by comparing with the distribution function at x = 1/2
  // (for skewed distributions the answer can be near 0 even when the lower probability exceeds 1/2)
  const atHalf = betaInc(a, b, 0.5, 0.5, lower, true);
  const leftHalf = lower ? logTarget <= atHalf : logTarget >= atHalf;
  if (leftHalf) return solveLeftHalf(a, b, lower, logTarget, linearTarget);
  // Right half: y = 1 - x lies in (0, 1/2] in frame (b, a), with the tails swapped
  return 1 - solveLeftHalf(b, a, !lower, logTarget, linearTarget);
}

/**
 * Density of the beta distribution. Equivalent to R's `dbeta(x, shape1, shape2, ncp = 0, log = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral beta distribution.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape1 - First shape parameter (a).
 * @param shape2 - Second shape parameter (b).
 * @param options - `ncp` (see {@link NoncentralOption}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * dbeta(0.5, 2, 3);         // 1.5
 * dbeta([0.25, 0.75], 2, 3); // [1.6875, 0.5625]
 * ```
 *
 * @category Distributions
 */
export function dbeta<T extends Vectorizable>(
  x: T,
  shape1: number,
  shape2: number,
  options: DensityOptions & NoncentralOption = {},
): VectorResult<T> {
  const { log = false, ncp } = options;
  if (ncp !== undefined) return vectorize(x, (v) => dnbeta1(v, shape1, shape2, ncp, log));
  return vectorize(x, (v) => dbeta1(v, shape1, shape2, log));
}

/**
 * Distribution function of the beta distribution. Equivalent to R's `pbeta(q, shape1, shape2, ncp = 0, lower.tail = TRUE, log.p = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral beta distribution.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape1 - First shape parameter (a).
 * @param shape2 - Second shape parameter (b).
 * @param options - `ncp` (see {@link NoncentralOption}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pbeta(0.5, 2, 3); // 0.6875 (up to rounding)
 * ```
 *
 * @category Distributions
 */
export function pbeta<T extends Vectorizable>(
  q: T,
  shape1: number,
  shape2: number,
  options: TailOptions & NoncentralOption = {},
): VectorResult<T> {
  const { lowerTail = true, logP = false, ncp } = options;
  if (ncp !== undefined) return vectorize(q, (v) => pnbeta1(v, shape1, shape2, ncp, lowerTail, logP));
  return vectorize(q, (v) => pbeta1(v, shape1, shape2, lowerTail, logP));
}

/**
 * Quantile function of the beta distribution. Equivalent to R's `qbeta(p, shape1, shape2, ncp = 0, lower.tail = TRUE, log.p = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral beta distribution.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape1 - First shape parameter (a).
 * @param shape2 - Second shape parameter (b).
 * @param options - `ncp` (see {@link NoncentralOption}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qbeta(0.025, 3, 7);          // 0.07485463141969181
 * qbeta([0.025, 0.975], 3, 7); // [0.07485463141969181, 0.6000935737163121]
 * ```
 *
 * @category Distributions
 */
export function qbeta<T extends Vectorizable>(
  p: T,
  shape1: number,
  shape2: number,
  options: TailOptions & NoncentralOption = {},
): VectorResult<T> {
  const { lowerTail = true, logP = false, ncp } = options;
  if (ncp !== undefined) return vectorize(p, (v) => qnbeta1(v, shape1, shape2, ncp, lowerTail, logP));
  return vectorize(p, (v) => qbeta1(v, shape1, shape2, lowerTail, logP));
}
