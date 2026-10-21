// t distribution dt / pt / qt. Passing ncp gives the noncentral t (src/distributions/nt.ts).
//
// The density is assembled from Loader's (2000) building blocks. With h = n/2,
//   Gamma((n+1)/2) / Gamma(n/2) = sqrt(h) exp(stirlerr(h + 1/2) - stirlerr(h) - bd0(h, h + 1/2))
//   (1 + x^2/n)^(-n/2) = exp(bd0(h, (n + x^2)/2) - x^2/2)
// give f(x) = exp(T + bd0(h, (n + x^2)/2) - x^2/2) / sqrt(2 pi (1 + x^2/n)), with no cancellation even for
// large n. For large |x| (x^2 > 0.2 n), h log1p(x^2/n) is used directly. The exponent is assembled in double-double.
// The distribution function is P[|T| > |t|] = I_{n/(n+t^2)}(n/2, 1/2); quantiles use Newton's method on the log
// scale in |t| (the tail is a power |t|^-n, so it converges in a few steps).

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, smallerTail, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { invertContinuous } from "../internal/invert.js";
import { lbeta } from "../special/beta.js";
import { ddAdd, ddDiv, ddDivNum, ddLog, ddMul, ddMulNum, ddNeg, ddSub, twoProd, twoSum, type DD } from "../special/dd.js";
import { betaIncBothDD, betaIncDD } from "../special/incbet.js";
import { bd0, bd0dd, stirlerr } from "../special/loader.js";
import { pnorm, qnorm } from "./normal.js";
import type { NoncentralOption } from "../internal/noncentral.js";
import { dnt1, pnt1, qnt1 } from "./nt.js";

const LN_SQRT_2PI = 0.918938533204672741780329736406;
/** -log(sqrt(2 pi)) in double-double (computed with Rmpfr) */
const LN_SQRT_2PI_DD_NEG: DD = [-0.91893853320467278, 3.8782941580672414e-17];

/** Log density (n finite and positive, x finite) */
export function dtLog(x: number, n: number): number {
  return dtCore(x, n, true);
}

function dtCore(x: number, n: number, log: boolean): number {
  const h = n / 2;
  const T = stirlerr(h + 0.5) - stirlerr(h) - bd0(h, h + 0.5);
  const x2 = twoProd(x, x);
  const x2n = x2[0] / n;
  if (!(x2n < 1e30)) {
    // x^2/n is very large (may overflow): log1p(x^2/n) = log(x^2/n) + log1p(n/x^2)
    // f = exp(T) / sqrt(2 pi) * (1 + x^2/n)^(-(n+1)/2)
    // The exponent can be in the hundreds, so assemble it in double-double
    let l = ddAdd(ddMulNum(ddLog([Math.abs(x), 0]), 2), ddNeg(ddLog([n, 0])));
    if (Number.isFinite(x2n)) l = ddAdd(l, [Math.log1p(1 / x2n), 0]);
    // The coefficient (n + 1)/2 = h + 1/2 is also used unrounded (its rounding error is amplified by the log term, ~700)
    const e = ddAdd(ddAdd(ddNeg(ddMul(l, twoSum(h, 0.5))), [T, 0]), LN_SQRT_2PI_DD_NEG);
    return log ? e[0] + e[1] : Math.exp(e[0]) * (1 + e[1]);
  }
  // E = T + [exponent], where the exponent is -h log1p(x^2/n)
  let e: DD;
  if (x2[0] > 0.2 * n) {
    const l1p = ddLog(ddAdd([1, 0], ddDivNum(x2, n)));
    e = ddAdd([T, 0], ddMulNum(l1p, -h));
  } else {
    // -h log1p(x^2/n) = bd0(h, (n + x^2)/2) - x^2/2
    const M = ddMulNum(ddAdd([n, 0], x2), 0.5);
    e = ddAdd(ddAdd(bd0dd(h, M), ddMulNum(x2, -0.5)), [T, 0]);
  }
  // The remaining (1 + x^2/n)^(-1/2) / sqrt(2 pi)
  if (log) return e[0] + e[1] - LN_SQRT_2PI - 0.5 * Math.log1p(x2n);
  const v = Math.exp(e[0]) * (1 + e[1]);
  return v / Math.sqrt(2 * Math.PI * (1 + x2n));
}

export function dtDensity1(x: number, df: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(df)) return NaN;
  if (df <= 0) return NaN;
  if (!Number.isFinite(x)) return d0(log);
  if (!Number.isFinite(df)) {
    // Normal density
    const lv = -0.5 * x * x - LN_SQRT_2PI;
    return log ? lv : Math.exp(lv);
  }
  return dtCore(x, df, log);
}

/** Log or value of P[T > t] (t > 0): half of s = P[|T| > t] = I_{n/(n+t^2)}(n/2, 1/2) */
function upperTailPositive(t: number, n: number, log: boolean): number {
  const t2 = t * t;
  const x = n / (n + t2);
  if (!(x > 1e-250)) {
    // |t| is very large: for x = n/t^2 the first series term suffices (relative error about x);
    // use I_x(n/2, 1/2) ≈ x^(n/2) / ((n/2) B(n/2, 1/2)) on the log scale (x may underflow)
    // The exponent (n/2) log x is in the hundreds, so assemble it in double-double
    const lx = ddSub(ddLog([n, 0]), ddMulNum(ddLog([t, 0]), 2));
    const e = ddAdd(ddMulNum(lx, n / 2), [-Math.log(n / 2) - lbeta(n / 2, 0.5) - Math.LN2, 0]);
    return log ? e[0] + e[1] : Math.exp(e[0]) * (1 + e[1]);
  }
  // Form x = n/(n + t^2) and 1 - x = t^2/(n + t^2) in double-double
  const t2d = twoProd(t, t);
  const den = ddAdd(t2d, [n, 0]);
  const s = betaIncDD(n / 2, 0.5, ddDiv([n, 0], den), ddDiv(t2d, den), true, log);
  return log ? s - Math.LN2 : s / 2;
}

/** [log, linear] of upperTailPositive (each value identical to upperTailPositive) */
function upperTailPositiveBoth(t: number, n: number): [number, number] {
  const t2 = t * t;
  const x = n / (n + t2);
  if (!(x > 1e-250)) {
    const lx = ddSub(ddLog([n, 0]), ddMulNum(ddLog([t, 0]), 2));
    const e = ddAdd(ddMulNum(lx, n / 2), [-Math.log(n / 2) - lbeta(n / 2, 0.5) - Math.LN2, 0]);
    return [e[0] + e[1], Math.exp(e[0]) * (1 + e[1])];
  }
  const t2d = twoProd(t, t);
  const den = ddAdd(t2d, [n, 0]);
  const s = betaIncBothDD(n / 2, 0.5, ddDiv([n, 0], den), ddDiv(t2d, den), true);
  return [s[0] - Math.LN2, s[1] / 2];
}

export function pt1(q: number, df: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(df)) return NaN;
  if (df <= 0) return NaN;
  if (!Number.isFinite(q)) return q < 0 ? dt0(lowerTail, logP) : dt1(lowerTail, logP);
  if (!Number.isFinite(df)) return pnorm(q, { lowerTail, logP });
  if (q === 0) return logP ? -Math.LN2 : 0.5;
  // Lower tail for q < 0 = upper tail at |q|. If the requested side is the smaller tail compute it directly, otherwise 1 - (smaller tail)
  const small = q < 0 === lowerTail;
  const a = Math.abs(q);
  if (small) return upperTailPositive(a, df, logP);
  const v = upperTailPositive(a, df, false);
  return logP ? Math.log1p(-v) : 1 - v;
}

export function qt1(p: number, df: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(df)) return NaN;
  const b = quantileBoundaries(p, -Infinity, Infinity, lowerTail, logP);
  if (b !== undefined) return b;
  if (df <= 0) return NaN;
  if (!Number.isFinite(df)) return qnorm(p, { lowerTail, logP });
  const { lower, logTarget, linearTarget } = smallerTail(p, lowerTail, logP);
  if (logTarget === -Math.LN2 && linearTarget === 0.5) return 0;
  // Smaller tail: if lower, the answer is negative. Solve the upper tail in |t|
  // Starting value: in the deep tail P[T > t] ≈ n^(n/2) t^(-n) / (n B(n/2, 1/2))
  const n = df;
  let x0: number;
  // log t from the tail asymptotic P[T > t] ≈ n^(n/2) t^(-n) / (n B(n/2, 1/2))
  const lx0 = (0.5 * n * Math.log(n) - Math.log(n) - lbeta(n / 2, 0.5) - logTarget) / n;
  // ±Inf if the answer exceeds the largest double (t is large there and the asymptotic form is accurate)
  if (lx0 > 709.78) return lower ? -Infinity : Infinity;
  if (logTarget < -30) {
    x0 = Math.exp(lx0);
  } else {
    // Cornish-Fisher expansion from the normal point z (Abramowitz & Stegun 26.7.5). Poor for small n, so only for n >= 3
    const z = Math.abs(qnorm(logTarget, { logP: true }));
    x0 = z;
    if (n >= 3) {
      const z2 = z * z;
      const g1 = (z * (z2 + 1)) / 4;
      const g2 = (z * ((5 * z2 + 16) * z2 + 3)) / 96;
      const g3 = (z * (((3 * z2 + 19) * z2 + 17) * z2 - 15)) / 384;
      const g4 = (z * ((((79 * z2 + 776) * z2 + 1482) * z2 - 1920) * z2 - 945)) / 92160;
      x0 = z + (g1 + (g2 + (g3 + g4 / n) / n) / n) / n;
    }
  }
  if (!(x0 > 0) || !Number.isFinite(x0)) x0 = 1;
  const a = invertContinuous({
    logTarget,
    ...(linearTarget !== undefined && { linearTarget }),
    lower: false,
    cdf: (t) => upperTailPositive(t, n, false),
    cdfLog: (t) => upperTailPositive(t, n, true),
    cdfBoth: (t) => upperTailPositiveBoth(t, n),
    pdfLog: (t) => dtCore(t, n, true),
    dlogPdf: (t) => (-(n + 1) * t) / (n + t * t),
    x0,
    lo: 0,
    hi: Infinity,
    positive: true,
  });
  return lower ? -a : a;
}

/**
 * Density of the t distribution. Equivalent to R's `dt(x, df, ncp, log = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral t distribution.
 *
 * As in R, `ncp: 0` gives the same values as the central distribution.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param df - Degrees of freedom.
 * @param options - `ncp` (see {@link NoncentralOption}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 */
export function dt<T extends Vectorizable>(
  x: T,
  df: number,
  options: DensityOptions & NoncentralOption = {},
): VectorResult<T> {
  const { log = false, ncp } = options;
  if (ncp !== undefined && ncp !== 0) return vectorize(x, (v) => dnt1(v, df, ncp, log));
  return vectorize(x, (v) => dtDensity1(v, df, log));
}

/**
 * Distribution function of the t distribution. Equivalent to R's `pt(q, df, ncp, lower.tail = TRUE, log.p = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral t distribution.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param df - Degrees of freedom.
 * @param options - `ncp` (see {@link NoncentralOption}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pt(2.1, 10, { lowerTail: false }); // 0.031038622101109286
 * pt(1, 5, { ncp: 1 });              // 0.48092614124210525
 * ```
 */
export function pt<T extends Vectorizable>(
  q: T,
  df: number,
  options: TailOptions & NoncentralOption = {},
): VectorResult<T> {
  const { lowerTail = true, logP = false, ncp } = options;
  if (ncp !== undefined && ncp !== 0) return vectorize(q, (v) => pnt1(v, df, ncp, lowerTail, logP));
  return vectorize(q, (v) => pt1(v, df, lowerTail, logP));
}

/**
 * Quantile function of the t distribution. Equivalent to R's `qt(p, df, ncp, lower.tail = TRUE, log.p = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral t distribution.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param df - Degrees of freedom.
 * @param options - `ncp` (see {@link NoncentralOption}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 */
export function qt<T extends Vectorizable>(
  p: T,
  df: number,
  options: TailOptions & NoncentralOption = {},
): VectorResult<T> {
  const { lowerTail = true, logP = false, ncp } = options;
  if (ncp !== undefined && ncp !== 0) return vectorize(p, (v) => qnt1(v, df, ncp, lowerTail, logP));
  return vectorize(p, (v) => qt1(v, df, lowerTail, logP));
}
