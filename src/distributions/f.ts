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
import { SMALL_SHAPE, smallShapeG } from "../special/incbetPrefactor.js";
import { betaInc, betaIncBoth, betaIncBothDD, betaIncDD, betaIncTinyX } from "../special/incbet.js";
import { dbinomRawDD } from "../special/loader.js";
import { ddAdd, ddDiv, ddLog, ddMul, ddNeg, ddSub, twoProd, twoSum, type DD } from "../special/dd.js";
import { dgamma1, pgamma1, qgamma1 } from "./gamma.js";
import type { NoncentralOption } from "../internal/noncentral.js";
import { dnf1, pnf1, qnf1 } from "./nbeta.js";
import { betaQuantileGuess } from "./beta.js";

const LOG_DBL_MIN = Math.log(2.2250738585072014e-308);

/**
 * Log density in double-double from log p and log q (p = m x/(n + m x), q = 1 - p = n/(n + m x)), with a = m/2, b = n/2:
 *   f(x) = (m/n) p^(a-1) q^(b+1) / B(a, b)   (the beta density of p times dp/dx = (m/n) q^2)
 * log(1/B(a, b)) for a small shape from 1/B(a, b) = ab/(a + b) Γ(1+a+b)/(Γ(1+a) Γ(1+b)) (incbetPrefactor.ts)
 */
function fLogDensity(m: number, n: number, lp: DD, lq: DD): DD {
  const a = m / 2;
  const b = n / 2;
  const s = Math.min(a, b);
  const lib: DD =
    s < SMALL_SHAPE ? ddAdd([Math.log(s) - Math.log1p(s / Math.max(a, b)), 0], smallShapeG(a, b)) : [-lbeta(a, b), 0];
  // (a - 1 and b + 1 exactly, in double-double: their rounding times log p of -700 was 3e-14 of the density)
  return ddAdd(ddAdd(ddAdd(ddSub(ddLog([m, 0]), ddLog([n, 0])), ddMul(lp, twoSum(a, -1))), ddMul(lq, twoSum(b, 1))), lib);
}

function fromLog(e: DD, log: boolean): number {
  return log ? e[0] + e[1] : Math.exp(e[0]) * (1 + e[1]);
}

/**
 * p = m x/(n + m x) and q = n/(n + m x) in double-double, or undefined where m x is huge (from 1e290; the callers then
 * form q ≈ n/(m x) directly). Rounding in p and q would be amplified m/2 and n/2 times respectively (5e-13 relative at
 * df1 = 1e6). Where m x is below 1e-290 the double-double product loses its low part or underflows (pf(1.29e-232,
 * 1.78e-123, 2.18e-48) was 0 although pf at 2.6e-269 was 1), so m x and n are first scaled by 2^600 (exactly; the
 * smaller of m and x is below 1e-145 there, and n below 1e127, so that n 2^600 stays finite; for a larger n, p is below
 * DBL_MIN and the callers work from its log)
 */
function fRatios(x: number, m: number, n: number): [DD, DD] | undefined {
  // A factor above 1e290 is scaled down by 2^600 and the other up (exactly), as its splitting in twoProd overflows: at a
  // subnormal df1 and x from 1e301, m x is moderate but was taken for huge, and n/m overflowed in the callers' q ≈ n/(m x)
  // (pf(1e301, 1.4e-312, 6.72, { lowerTail: false }) was 1, 1.77e-311 expected; qf there did not return)
  const S = 2 ** 600;
  let mx = x > 1e290 ? twoProd(m * S, x / S) : m > 1e290 ? twoProd(m / S, x * S) : twoProd(m, x);
  if (!(Number.isFinite(mx[0]) && Number.isFinite(mx[1]) && Math.abs(mx[0]) < 1e290)) return undefined;
  let nn = n;
  if (x > 0 && mx[0] < 1e-290 && n < 1e127) {
    mx = m < x ? twoProd(m * S, x) : twoProd(m, x * S);
    nn = n * S;
  }
  const d = ddAdd(mx, [nn, 0]);
  return [ddDiv(mx, d), ddDiv([nn, 0], d)];
}

function fDensity(x: number, m: number, n: number, log: boolean): number {
  // p or q below DBL_MIN (m x/n beyond e^±708): the ratios themselves would be subnormal or underflow (the density was
  // NaN, as R's is: df(1.33e-322, 1.04, 206159)). The tiny one is r/(1 + r) or 1/(1 + r), r = m x/n, whose log is
  // -|log r| to within DBL_MIN; the other is 1 to within DBL_MIN
  if (x > 0 && x < Infinity && Math.abs(Math.log(m) + Math.log(x) - Math.log(n)) > 700) {
    const lr = ddAdd(ddSub(ddLog([m, 0]), ddLog([n, 0])), ddLog([x, 0]));
    if (lr[0] < LOG_DBL_MIN) return fromLog(fLogDensity(m, n, lr, [-Math.exp(lr[0]), 0]), log);
    if (-lr[0] < LOG_DBL_MIN) return fromLog(fLogDensity(m, n, [-Math.exp(-lr[0]), 0], ddNeg(lr)), log);
  }
  const r = fRatios(x, m, n);
  let pd: DD;
  let qd: DD;
  if (r !== undefined) {
    [pd, qd] = r;
  } else {
    // m x is huge (the double-double product overflows): p ≈ 1, q ≈ n/(m x) in double precision
    qd = [n / m / x, 0];
    pd = [1, -qd[0]];
  }
  // A small df: Loader's form loses about ε |log(df/2)| / 2 in its exponent (incbetPrefactor.ts), and the factor m^2 n
  // below underflowed (df(6.6e-112, 3.2e-173, 1868) was -Infinity on the log scale, NaN at x = 4.6e-157)
  if (Math.min(m, n) / 2 < SMALL_SHAPE) return fromLog(fLogDensity(m, n, ddLog(pd), ddLog(qd)), log);
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
    // At tiny x this is 0 / 0 = NaN (x^2 underflows), as R gives (df(1e-300, Inf, 5) is NaN); the log is finite
    const dens = dgamma1(1 / x, n / 2, 2 / n, log);
    return log ? dens - 2 * Math.log(x) : dens / (x * x);
  }
  if (!Number.isFinite(x)) return m < 2 ? NaN : d0(log); // R gives NaN at x = Inf when df1 < 2
  return fDensity(x, m, n, log);
}

/**
 * [log, linear] of P[F <= x] (lower) / P[F > x] where m x/(n + m x) or n/(n + m x) is below DBL_MIN, from the log of
 * that ratio (betaIncTinyX); undefined elsewhere. With r = m x/n the ratios are r/(1 + r) and 1/(1 + r), so the log of
 * the smaller one is -|log r| to within DBL_MIN. Forming the ratio itself would round it in the subnormal range
 * (pf(5.43e-319, 1.04, 206159) was off by 4.5e-14) or underflow it to 0 (pf(1e300, 0.169, 1.18e-86, { lowerTail: false })
 * was 0, about 1 expected)
 */
function pfTiny(x: number, m: number, n: number, lower: boolean, wantLog: boolean): [number, number] | undefined {
  // (a cheap filter first: the double-double logarithms are only needed out there)
  // (x = 0 and Infinity, which the quantile search reaches, are left to the ratios below)
  if (!(x > 0 && x < Infinity) || Math.abs(Math.log(m) + Math.log(x) - Math.log(n)) < 700) return undefined;
  const lr = ddSub(ddAdd(ddLog([m, 0]), ddLog([x, 0])), ddLog([n, 0]));
  if (lr[0] < LOG_DBL_MIN) return betaIncTinyX(m / 2, n / 2, Math.exp(lr[0]), lr, lower, wantLog);
  if (-lr[0] < LOG_DBL_MIN) return betaIncTinyX(n / 2, m / 2, Math.exp(-lr[0]), ddNeg(lr), !lower, wantLog);
  return undefined;
}

/** P[F <= x] (lower) / P[F > x] (!lower). x positive, m, n finite */
function pfRaw(x: number, m: number, n: number, lower: boolean, log: boolean): number {
  if (x === Infinity) return lower === log ? 0 : lower ? 1 : -Infinity;
  const t = pfTiny(x, m, n, lower, log);
  if (t !== undefined) return log ? t[0] : t[1];
  // Form m x/(n + m x) and n/(n + m x) in double-double (rounding would be amplified m/2 and n/2 times)
  const r = fRatios(x, m, n);
  if (r !== undefined) return betaIncDD(m / 2, n / 2, r[0], r[1], lower, log);
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
  // (x = Infinity, which the quantile search reaches from a far step, was NaN, and the search spent its iterations on it
  // at 25 ms each: qf(-735.2, 1.25e-305, 3.3e5, { lowerTail: false, logP: true }) returned 1 after 5 s)
  if (x === Infinity) return lower ? [0, 1] : [-Infinity, 0];
  const t = pfTiny(x, m, n, lower, true);
  if (t !== undefined) return t;
  const r = fRatios(x, m, n);
  if (r !== undefined) return betaIncBothDD(m / 2, n / 2, r[0], r[1], lower);
  const zc = n / m / x;
  return betaIncBoth(m / 2, n / 2, 1 - zc, zc, lower);
}

const MIN_NORMAL = 2.2250738585072014e-308;

/**
 * P[χ²_m / m <= q] (lower), the F distribution with df2 = Inf: pgamma at q m, or with scale 2/m where q m is below the
 * normal range (the product had lost its digits or underflowed to 0: pf(2e-323, 0.012, Inf) was 0, as R 4.5.2 gives,
 * where it is 0.011; so the quantile 0 of qf(7.8e-37, 0.012, Inf) did not round-trip). Not for a subnormal m, where 2/m
 * overflows
 */
function pChisqLimit(q: number, m: number, lowerTail: boolean, logP: boolean): number {
  const t = q * m;
  if (t < MIN_NORMAL && m > MIN_NORMAL) return pgamma1(q, m / 2, 2 / m, lowerTail, logP);
  return pgamma1(t, m / 2, 2, lowerTail, logP);
}

/** The quantile of χ²_m / m, likewise with scale 2/m where the quantile or that of χ²_m is below the normal range */
function qChisqLimit(p: number, m: number, lowerTail: boolean, logP: boolean): number {
  const t = qgamma1(p, m / 2, 2, lowerTail, logP);
  if ((t < MIN_NORMAL || t / m < MIN_NORMAL) && m > MIN_NORMAL) return qgamma1(p, m / 2, 2 / m, lowerTail, logP);
  return t / m;
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
  if (!Number.isFinite(n)) return pChisqLimit(q, m, lowerTail, logP); // χ²_m
  if (!Number.isFinite(m)) return pgamma1(n / q, n / 2, 2, !lowerTail, logP); // n / χ²_n
  return pfRaw(q, m, n, lowerTail, logP);
}

export function qf1(p: number, m: number, n: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(m) || Number.isNaN(n)) return NaN;
  if (m <= 0 || n <= 0) return NaN;
  const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
  if (b !== undefined) return b;
  if (!Number.isFinite(m) && !Number.isFinite(n)) return 1;
  if (!Number.isFinite(n)) return qChisqLimit(p, m, lowerTail, logP);
  if (!Number.isFinite(m)) return n / qgamma1(p, n / 2, 2, !lowerTail, logP);
  const { lower, logTarget, linearTarget } = smallerTail(p, lowerTail, logP);
  // A df2 so large that χ²_n/n is 1 on the scale of the quantile: the χ² limit, as for n = Inf. With W = χ²_n/n and G
  // the distribution function of χ²_m, P[F <= x] = E G(m x W) moves from G(m x) by Var W (m x)² G''/2 = (m x)² G''/n,
  // and (m x)² G''/G is of the order of (d log G/d log t)², at most (m + 2 |log p| + 1e3)² (p the smaller tail): the
  // quantile moves by less than 1e-20 relative. (The incomplete beta function, out of its range at such a df (see the
  // known violations), was NaN in the bulk, and the search took seconds: qf(1.9e-13, 0.0885, 6e302) did not return)
  if (n > 1e20 * (m - 2 * logTarget + 1e3) ** 2) return qChisqLimit(p, m, lowerTail, logP);
  // Near 0, P[F <= x] ≈ (m x / n)^(m/2) / ((m/2) B(m/2, n/2)). The answer is 0 if it underflows
  if (lower && (logTarget + Math.log(m / 2) + lbeta(m / 2, n / 2)) / (m / 2) + Math.log(n / m) < -746) return 0;
  // Near infinity, P[F > x] ≈ (n / (m x))^(n/2) / ((n/2) B(m/2, n/2)). Inf if it overflows, as confirmed by the upper
  // tail at the largest double (the leading term alone sent qf(5.95e-155, 2875.5, 1, { lowerTail: false }) to Infinity,
  // where pf(1.797e308, ...) is 5.9503e-155, below p)
  if (
    !lower &&
    -(logTarget + Math.log(n / 2) + lbeta(m / 2, n / 2)) / (n / 2) + Math.log(n / m) > 709.78 &&
    pfRaw(Number.MAX_VALUE, m, n, false, true) > logTarget
  ) {
    return Infinity;
  }
  // The other way round, a tiny df2 leaves the lower tail below the target up to the largest double (nearly all the
  // mass lies beyond it: qf(8.8e-131, 0.754, 4.6e-152) returned 1.8e308, where pf is 2.4e-149), and a tiny df1 the
  // upper tail below the target from the smallest positive number on
  if (lower && n < 1 && pfRaw(Number.MAX_VALUE, m, n, true, true) < logTarget) return Infinity;
  if (!lower && m < 1 && pfRaw(Number.MIN_VALUE, m, n, false, true) < logTarget) return 0;
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
 *
 * @category Distributions
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
 *
 * @category Distributions
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
 *
 * @category Distributions
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
