// F distribution df / pf / qf. Passing ncp gives the noncentral F (src/distributions/nbeta.ts).
//
// The density uses the relation to the binomial probability. With p = m x/(n + m x) and q = n/(n + m x),
//   m >= 2: f(x) = m q / 2 * dbinom((m-2)/2; (m+n-2)/2, p)
//   m <  2: f(x) = m/(n + m x) * m n / (2 (m + n) p) * dbinom(m/2; (m+n)/2, p)
// (both derived by rewriting the F density in terms of Gamma functions).
// The distribution function is P[F <= x] = I_p(m/2, n/2); quantiles use Newton's method in u = log x.

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, smallerTail, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { invertContinuous } from "../internal/invert.js";
import { lbeta } from "../special/beta.js";
import { betaInc, betaIncBoth, betaIncBothDD, betaIncDD } from "../special/incbet.js";
import { dbinomRawDD } from "../special/loader.js";
import { ddAdd, ddDiv, twoProd, type DD } from "../special/dd.js";
import { dgamma1, pgamma1, qgamma1 } from "./gamma.js";
import type { NoncentralOption } from "../internal/noncentral.js";
import { dnf1, pnf1, qnf1 } from "./nbeta.js";
import { betaQuantileGuess } from "./beta.js";

function fDensity(x: number, m: number, n: number, log: boolean): number {
  // p = m x/(n + m x) and q = n/(n + m x) are formed in double-double. Rounding in p and q would be
  // amplified m/2 and n/2 times respectively (5e-13 relative at df1 = 1e6)
  const mx = twoProd(m, x);
  let pd: DD;
  let qd: DD;
  if (Number.isFinite(mx[0]) && Number.isFinite(mx[1]) && Math.abs(mx[0]) < 1e290) {
    const d = ddAdd(mx, [n, 0]);
    pd = ddDiv(mx, d);
    qd = ddDiv([n, 0], d);
  } else {
    // m x is huge (the double-double product overflows): p ≈ 1, q ≈ n/(m x) in double precision
    qd = [n / m / x, 0];
    pd = [1, -qd[0]];
  }
  const p = pd[0];
  const q = qd[0];
  if (m >= 2) {
    const c = (m * q) / 2;
    const v = dbinomRawDD((m - 2) / 2, n / 2, pd, qd, log);
    return log ? Math.log(c) + v : c * v;
  }
  const c = ((m / (n + m * x)) * m * n) / (2 * (m + n) * p);
  const v = dbinomRawDD(m / 2, n / 2, pd, qd, log);
  return log ? Math.log(c) + v : c * v;
}

export function dfDensity1(x: number, m: number, n: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(m) || Number.isNaN(n)) return NaN;
  if (m <= 0 || n <= 0) return NaN;
  if (x < 0) return d0(log);
  if (x === 0) {
    if (m > 2) return d0(log);
    if (m === 2) return log ? 0 : 1;
    return Infinity;
  }
  if (!Number.isFinite(m) && !Number.isFinite(n)) return x === 1 ? Infinity : d0(log);
  if (!Number.isFinite(n)) return dgamma1(x, m / 2, 2 / m, log); // χ²_m / m
  if (!Number.isFinite(m)) {
    // n / χ²_n: 1/x follows a gamma distribution with shape n/2, scale 2/n
    const dens = dgamma1(1 / x, n / 2, 2 / n, log);
    return log ? dens - 2 * Math.log(x) : dens / (x * x);
  }
  if (!Number.isFinite(x)) return m < 2 ? NaN : d0(log); // R gives NaN at x = Inf when df1 < 2
  return fDensity(x, m, n, log);
}

/** P[F <= x] (lower) / P[F > x] (!lower). x finite and positive, m, n finite */
function pfRaw(x: number, m: number, n: number, lower: boolean, log: boolean): number {
  // Form m x/(n + m x) and n/(n + m x) in double-double (rounding would be amplified m/2 and n/2 times)
  const mx = twoProd(m, x);
  if (Number.isFinite(mx[0]) && Number.isFinite(mx[1]) && Math.abs(mx[0]) < 1e290) {
    const d = ddAdd(mx, [n, 0]);
    return betaIncDD(m / 2, n / 2, ddDiv(mx, d), ddDiv([n, 0], d), lower, log);
  }
  // m x is huge: form 1 - z = n/(n + m x) ≈ (n/m)/x directly
  const zc = n / m / x;
  return betaInc(m / 2, n / 2, 1 - zc, zc, lower, log);
}

/** Starting value for quantiles, from F = (n/m) Y/(1 - Y), Y ~ Beta(m/2, n/2), with the A&S 26.5.22 approximation (1 if unusable) */
function fQuantileGuess(m: number, n: number, lower: boolean, logTarget: number): number {
  const y = betaQuantileGuess(m / 2, n / 2, lower, logTarget);
  if (y === undefined) return 1;
  const f = (n * y) / (m * (1 - y));
  return f > 0 && Number.isFinite(f) ? f : 1;
}

/** [log, linear] of pfRaw (each value identical to pfRaw) */
function pfRawBoth(x: number, m: number, n: number, lower: boolean): [number, number] {
  const mx = twoProd(m, x);
  if (Number.isFinite(mx[0]) && Number.isFinite(mx[1]) && Math.abs(mx[0]) < 1e290) {
    const d = ddAdd(mx, [n, 0]);
    return betaIncBothDD(m / 2, n / 2, ddDiv(mx, d), ddDiv([n, 0], d), lower);
  }
  const zc = n / m / x;
  return betaIncBoth(m / 2, n / 2, 1 - zc, zc, lower);
}

export function pf1(q: number, m: number, n: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(m) || Number.isNaN(n)) return NaN;
  if (m <= 0 || n <= 0) return NaN;
  if (q <= 0) return dt0(lowerTail, logP);
  if (q === Infinity) return dt1(lowerTail, logP);
  if (!Number.isFinite(m) && !Number.isFinite(n)) {
    // Distribution concentrated at 1. R returns 1/2 at q = 1
    if (q === 1) return logP ? -Math.LN2 : 0.5;
    return q < 1 ? dt0(lowerTail, logP) : dt1(lowerTail, logP);
  }
  if (!Number.isFinite(n)) return pgamma1(q * m, m / 2, 2, lowerTail, logP); // χ²_m
  if (!Number.isFinite(m)) return pgamma1(n / q, n / 2, 2, !lowerTail, logP); // n / χ²_n
  return pfRaw(q, m, n, lowerTail, logP);
}

export function qf1(p: number, m: number, n: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(m) || Number.isNaN(n)) return NaN;
  if (m <= 0 || n <= 0) return NaN;
  const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
  if (b !== undefined) return b;
  if (!Number.isFinite(m) && !Number.isFinite(n)) return 1;
  if (!Number.isFinite(n)) return qgamma1(p, m / 2, 2, lowerTail, logP) / m;
  if (!Number.isFinite(m)) return n / qgamma1(p, n / 2, 2, !lowerTail, logP);
  const { lower, logTarget, linearTarget } = smallerTail(p, lowerTail, logP);
  // Near 0, P[F <= x] ≈ (m x / n)^(m/2) / ((m/2) B(m/2, n/2)). The answer is 0 if it underflows
  if (lower && (logTarget + Math.log(m / 2) + lbeta(m / 2, n / 2)) / (m / 2) + Math.log(n / m) < -746) return 0;
  // Near infinity, P[F > x] ≈ (n / (m x))^(n/2) / ((n/2) B(m/2, n/2)). Inf if it overflows
  if (!lower && -(logTarget + Math.log(n / 2) + lbeta(m / 2, n / 2)) / (n / 2) + Math.log(n / m) > 709.78) return Infinity;
  return invertContinuous({
    logTarget,
    ...(linearTarget !== undefined && { linearTarget }),
    lower,
    cdf: (x, l) => pfRaw(x, m, n, l, false),
    cdfLog: (x, l) => pfRaw(x, m, n, l, true),
    cdfBoth: (x, l) => pfRawBoth(x, m, n, l),
    pdfLog: (x) => fDensity(x, m, n, true),
    dlogPdf: (x) => (m / 2 - 1) / x - ((m + n) / 2) * (m / (n + m * x)),
    x0: fQuantileGuess(m, n, lower, logTarget),
    lo: 0,
    hi: Infinity,
    positive: true,
  });
}

/**
 * Density of the F distribution. Equivalent to R's `df(x, df1, df2, ncp, log = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral F distribution.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param df1 - Numerator degrees of freedom.
 * @param df2 - Denominator degrees of freedom.
 * @param options - `ncp` (see {@link NoncentralOption}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * df(1, 3, 10); // 0.40412281148856277
 * df(1, 3, 10, { log: true }); // -0.9060364583831545
 * ```
 */
export function df<T extends Vectorizable>(
  x: T,
  df1: number,
  df2: number,
  options: DensityOptions & NoncentralOption = {},
): VectorResult<T> {
  const { log = false, ncp } = options;
  if (ncp !== undefined) return vectorize(x, (v) => dnf1(v, df1, df2, ncp, log));
  return vectorize(x, (v) => dfDensity1(v, df1, df2, log));
}

/**
 * Distribution function of the F distribution. Equivalent to R's `pf(q, df1, df2, ncp, lower.tail = TRUE, log.p = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral F distribution.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param df1 - Numerator degrees of freedom.
 * @param df2 - Denominator degrees of freedom.
 * @param options - `ncp` (see {@link NoncentralOption}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pf(4.1, 2, 20, { lowerTail: false }); // 0.03219651558603902
 * ```
 */
export function pf<T extends Vectorizable>(
  q: T,
  df1: number,
  df2: number,
  options: TailOptions & NoncentralOption = {},
): VectorResult<T> {
  const { lowerTail = true, logP = false, ncp } = options;
  if (ncp !== undefined) return vectorize(q, (v) => pnf1(v, df1, df2, ncp, lowerTail, logP));
  return vectorize(q, (v) => pf1(v, df1, df2, lowerTail, logP));
}

/**
 * Quantile function of the F distribution. Equivalent to R's `qf(p, df1, df2, ncp, lower.tail = TRUE, log.p = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral F distribution.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param df1 - Numerator degrees of freedom.
 * @param df2 - Denominator degrees of freedom.
 * @param options - `ncp` (see {@link NoncentralOption}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qf(0.95, 3, 10); // 3.708264819046843
 * qf(0.05, 2, 20, { lowerTail: false }); // 3.4928284767356335
 * ```
 */
export function qf<T extends Vectorizable>(
  p: T,
  df1: number,
  df2: number,
  options: TailOptions & NoncentralOption = {},
): VectorResult<T> {
  const { lowerTail = true, logP = false, ncp } = options;
  if (ncp !== undefined) return vectorize(p, (v) => qnf1(v, df1, df2, ncp, lowerTail, logP));
  return vectorize(p, (v) => qf1(v, df1, df2, lowerTail, logP));
}
