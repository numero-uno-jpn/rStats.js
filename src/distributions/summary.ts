// Summaries of a distribution: mean, variance, standard deviation, median, mode, skewness and excess kurtosis.
//
// Written for rStats.js from the textbook closed forms (no ported code). Conventions: a moment that does not exist
// is NaN (the Cauchy mean; the variance when the mean is infinite), an infinite one is Infinity (the variance of t
// with 1 < df <= 2, the mean of a Pareto with a <= 1); the skewness and kurtosis of the heavy-tailed invgamma,
// pareto and F distributions are NaN where they are undefined. The median is q(0.5) (for a discrete distribution
// the smallest x with F(x) >= 1/2). The mode is the maximum of the density: NaN when it is not unique (uniform,
// beta(1, 1), beta with both shapes below 1, arcsine), the larger of two adjacent maxima of a discrete
// distribution, and the end point where the density diverges (gamma with shape < 1).

import { dqagie, dqagse } from "../integrate/quadpack.js";
import { ddAdd, ddMul, ddSub, type DD } from "../special/dd.js";
import { gamma as gammaFn } from "../special/gamma.js";
import { lbeta } from "../special/beta.js";
import { qgamma } from "./gamma.js";
import { qchisq } from "./chisq.js";
import { qbeta } from "./beta.js";
import { qf } from "./f.js";
import { dweibull1, qweibull } from "./weibull.js";
import { qbinom } from "./binomial.js";
import { qpois } from "./poisson.js";
import { qgeom } from "./geometric.js";
import { qnbinom } from "./negbinomial.js";
import { qhyper } from "./hypergeometric.js";
import { qinvgamma } from "./invgamma.js";
import { dkumar1, pkumar1, qkumar, qkumar1 } from "./kumaraswamy.js";
import { qtriang } from "./triangular.js";
import { qarcsine } from "./arcsine.js";
import { midpoint } from "../internal/extremes.js";

/**
 * Result of {@link distSummary}.
 *
 * @category Distributions
 */
export interface DistSummary {
  /** Mean (NaN when it does not exist, `Infinity` when it is infinite). */
  mean: number;
  /** Variance (NaN when it does not exist, `Infinity` when it is infinite). */
  variance: number;
  /** Standard deviation, the square root of the variance. */
  sd: number;
  /** Median: the q function at 0.5 (for discrete distributions the smallest x with F(x) >= 0.5). */
  median: number;
  /** Mode: the maximum of the density (NaN when it is not unique; the larger of two adjacent modes). */
  mode: number;
  /** Skewness, E[(X - mean)^3] / sd^3. */
  skewness: number;
  /** Excess kurtosis (0 for the normal distribution). */
  kurtosis: number;
}

/**
 * Distributions known to {@link distSummary} (the names of their d/p/q/r functions).
 *
 * @category Distributions
 */
export type DistName =
  | "norm" | "lnorm" | "unif" | "exp" | "gamma" | "chisq" | "beta" | "t" | "f" | "cauchy" | "weibull" | "logis"
  | "binom" | "pois" | "geom" | "nbinom" | "hyper" | "invgamma" | "kumar" | "pareto" | "triang" | "laplace" | "arcsine";

const NAN: DistSummary = { mean: NaN, variance: NaN, sd: NaN, median: NaN, mode: NaN, skewness: NaN, kurtosis: NaN };

function make(mean: number, variance: number, median: number, mode: number, skewness: number, kurtosis: number): DistSummary {
  return { mean, variance, sd: Math.sqrt(variance), median, mode, skewness, kurtosis };
}

/**
 * Variance, skewness and excess kurtosis from the central moments E[(X - mean)^n], integrated numerically from the
 * density on each side of the mean (no cancellation inside either part): the textbook route through the raw moments
 * cancels badly when the spread is small against the mean (Weibull with a large shape loses 9 digits of the kurtosis
 * that way)
 */
function shape(f: (x: number) => number, mean: number, lower: number, upper: number): { variance: number; skewness: number; kurtosis: number } {
  return central((t) => t, f, mean, mean, lower, upper);
}

/** shape() over t: x(t) with weight w(t), the integral split at t = split where x = mean */
function central(
  x: (t: number) => number,
  w: (t: number) => number,
  mean: number,
  split: number,
  lower: number,
  upper: number,
): { variance: number; skewness: number; kurtosis: number } {
  const tol = 50 * Number.EPSILON;
  const c = [2, 3, 4].map((n) => {
    const g = (t: number): number => (x(t) - mean) ** n * w(t);
    const left = dqagse(g, lower, split, 0, tol, 200).result;
    const right = upper === Infinity ? dqagie(g, split, 1, 0, tol, 200).result : dqagse(g, split, upper, 0, tol, 200).result;
    return left + right;
  });
  const v = c[0]!;
  return { variance: v, skewness: c[1]! / v ** 1.5, kurtosis: c[2]! / (v * v) - 3 };
}

/** floor(a b) of the exact product (a b rounded to double may cross an integer) */
function floorProduct(a: number, b: number): number {
  const [h, l] = ddMul([a, 0], [b, 0]);
  const f = Math.floor(h);
  return h === f && l < 0 ? f - 1 : f;
}

/** Whether a b <= c exactly (a, b, c doubles) */
function productAtMost(a: DD, b: number, c: number): boolean {
  const d = ddSub(ddMul(a, [b, 0]), [c, 0]);
  return d[0] + d[1] <= 0;
}

const has = (o: Record<string, number | undefined>, k: string): boolean => o[k] !== undefined;

/** ab / (s^2 (s + 1)), from the ratios a / s and b / s when the products overflow or underflow (huge shapes) */
function betaVariance(a: number, b: number, s: number): number {
  const v = (a * b) / (s * s * (s + 1));
  return v > 0 && v < Infinity ? v : ((a / s) * (b / s)) / (s + 1);
}

/**
 * Mean, variance, standard deviation, median, mode, skewness and excess kurtosis of a distribution, given by the
 * name of its d/p/q/r functions and their parameters (with the same names and defaults; `gamma` takes `rate` or
 * `scale`, `nbinom` takes `prob` or `mu`). Invalid parameters give NaN throughout.
 * Not an R function. R has no function for these summaries; the R references are closed forms checked against
 * numerical moments.
 *
 * @example
 * ```ts
 * distSummary("gamma", { shape: 2.5, rate: 2 }); // { mean: 1.25, variance: 0.625, ..., mode: 0.75, kurtosis: 2.4 }
 * distSummary("binom", { size: 9, prob: 0.5 }).mode; // 5 (4 and 5 are equally likely: the larger)
 * ```
 *
 * @category Distributions
 */

export function distSummary(distribution: DistName, params: Record<string, number | undefined> = {}): DistSummary {
  const P = params;
  switch (distribution) {
    case "norm": {
      const { mean = 0, sd = 1 } = P;
      if (!(Number.isFinite(mean) && sd > 0 && Number.isFinite(sd))) return NAN;
      return make(mean, sd * sd, mean, mean, 0, 0);
    }
    case "lnorm": {
      const { meanlog = 0, sdlog = 1 } = P;
      if (!(Number.isFinite(meanlog) && sdlog > 0 && Number.isFinite(sdlog))) return NAN;
      const s2 = sdlog * sdlog;
      const em1 = Math.expm1(s2);
      const w = Math.exp(s2);
      return make(
        Math.exp(meanlog + s2 / 2),
        em1 * Math.exp(2 * meanlog + s2),
        Math.exp(meanlog),
        Math.exp(meanlog - s2),
        (w + 2) * Math.sqrt(em1),
        // w^4 + 2 w^3 + 3 w^2 - 6 with w = 1 + em1, expanded in em1 (the w form cancels for small sdlog)
        em1 * (16 + em1 * (15 + em1 * (6 + em1))),
      );
    }
    case "unif": {
      const { min = 0, max = 1 } = P;
      if (!(Number.isFinite(min) && Number.isFinite(max) && min < max)) return NAN;
      const m = Number.isFinite(max - min) ? min + (max - min) / 2 : midpoint(min, max);
      return make(m, (max - min) ** 2 / 12, m, NaN, 0, -1.2);
    }
    case "exp": {
      const { rate = 1 } = P;
      if (!(rate > 0 && Number.isFinite(rate))) return NAN;
      return make(1 / rate, 1 / (rate * rate), Math.LN2 / rate, 0, 2, 6);
    }
    case "gamma": {
      const k = P.shape ?? NaN;
      const scale = has(P, "scale") ? P.scale! : 1 / (P.rate ?? 1);
      if (!(k > 0 && Number.isFinite(k) && scale > 0 && Number.isFinite(scale))) return NAN;
      return make(k * scale, k * scale * scale, qgamma(0.5, k, { scale }), k >= 1 ? (k - 1) * scale : 0, 2 / Math.sqrt(k), 6 / k);
    }
    case "chisq": {
      const df = P.df ?? NaN;
      if (!(df > 0 && Number.isFinite(df))) return NAN;
      return make(df, 2 * df, qchisq(0.5, df), Math.max(df - 2, 0), Math.sqrt(8 / df), 12 / df);
    }
    case "beta": {
      const a = P.shape1 ?? NaN;
      const b = P.shape2 ?? NaN;
      if (!(a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b))) return NAN;
      const s = a + b;
      let mode: number;
      if (a > 1 && b > 1) mode = (a - 1) / (s - 2);
      else if ((a === 1 && b === 1) || (a < 1 && b < 1)) mode = NaN;
      else mode = a <= 1 && b >= 1 ? 0 : 1;
      return make(
        a / s,
        betaVariance(a, b, s),
        qbeta(0.5, a, b),
        mode,
        (2 * (b - a) * Math.sqrt(s + 1)) / ((s + 2) * Math.sqrt(a * b)),
        (6 * ((a - b) ** 2 * (s + 1) - a * b * (s + 2))) / (a * b * (s + 2) * (s + 3)),
      );
    }
    case "t": {
      const df = P.df ?? NaN;
      if (!(df > 0)) return NAN;
      const variance = df > 2 ? (df === Infinity ? 1 : df / (df - 2)) : df > 1 ? Infinity : NaN;
      const kurtosis = df > 4 ? (df === Infinity ? 0 : 6 / (df - 4)) : df > 2 ? Infinity : NaN;
      return make(df > 1 ? 0 : NaN, variance, 0, 0, df > 3 ? 0 : NaN, kurtosis);
    }
    case "f": {
      const d1 = P.df1 ?? NaN;
      const d2 = P.df2 ?? NaN;
      if (!(d1 > 0 && d2 > 0 && Number.isFinite(d1) && Number.isFinite(d2))) return NAN;
      const mean = d2 > 2 ? d2 / (d2 - 2) : NaN;
      const variance = d2 > 4 ? (2 * d2 * d2 * (d1 + d2 - 2)) / (d1 * (d2 - 2) ** 2 * (d2 - 4)) : d2 > 2 ? Infinity : NaN;
      const skewness = d2 > 6 ? ((2 * d1 + d2 - 2) * Math.sqrt(8 * (d2 - 4))) / ((d2 - 6) * Math.sqrt(d1 * (d1 + d2 - 2))) : NaN;
      const kurtosis =
        d2 > 8
          ? (12 * (d1 * (5 * d2 - 22) * (d1 + d2 - 2) + (d2 - 4) * (d2 - 2) ** 2)) / (d1 * (d2 - 6) * (d2 - 8) * (d1 + d2 - 2))
          : NaN;
      return make(mean, variance, qf(0.5, d1, d2), d1 > 2 ? ((d1 - 2) / d1) * (d2 / (d2 + 2)) : 0, skewness, kurtosis);
    }
    case "cauchy": {
      const { location = 0, scale = 1 } = P;
      if (!(Number.isFinite(location) && scale > 0 && Number.isFinite(scale))) return NAN;
      return make(NaN, NaN, location, location, NaN, NaN);
    }
    case "weibull": {
      const k = P.shape ?? NaN;
      const lam = P.scale ?? 1;
      if (!(k > 0 && Number.isFinite(k) && lam > 0 && Number.isFinite(lam))) return NAN;
      const mean = gammaFn(1 + 1 / k);
      const s = shape((x) => dweibull1(x, k, 1, false), mean, 0, Infinity);
      return make(
        lam * mean,
        lam * lam * s.variance,
        qweibull(0.5, k, { scale: lam }),
        k > 1 ? lam * Math.pow((k - 1) / k, 1 / k) : 0,
        s.skewness,
        s.kurtosis,
      );
    }
    case "logis": {
      const { location = 0, scale = 1 } = P;
      if (!(Number.isFinite(location) && scale > 0 && Number.isFinite(scale))) return NAN;
      return make(location, (scale * scale * Math.PI * Math.PI) / 3, location, location, 0, 1.2);
    }
    case "binom": {
      const n = P.size ?? NaN;
      const p = P.prob ?? NaN;
      if (!(Number.isInteger(n) && n >= 0 && p >= 0 && p <= 1)) return NAN;
      const q = 1 - p;
      // P(x) >= P(x - 1) exactly when x <= (n + 1) p
      return make(
        n * p,
        n * p * q,
        qbinom(0.5, n, p),
        Math.min(n, floorProduct(n + 1, p)),
        (q - p) / Math.sqrt(n * p * q),
        (1 - 6 * p * q) / (n * p * q),
      );
    }
    case "pois": {
      const lambda = P.lambda ?? NaN;
      if (!(lambda > 0 && Number.isFinite(lambda))) return NAN;
      return make(lambda, lambda, qpois(0.5, lambda), Math.floor(lambda), 1 / Math.sqrt(lambda), 1 / lambda);
    }
    case "geom": {
      const p = P.prob ?? NaN;
      if (!(p > 0 && p <= 1)) return NAN;
      const q = 1 - p;
      return make(q / p, q / (p * p), qgeom(0.5, p), 0, (2 - p) / Math.sqrt(q), 6 + (p * p) / q);
    }
    case "nbinom": {
      const r = P.size ?? NaN;
      if (!(r > 0 && Number.isFinite(r))) return NAN;
      const p = has(P, "mu") ? r / (r + P.mu!) : (P.prob ?? NaN);
      if (!(p > 0 && p <= 1)) return NAN;
      const q = 1 - p;
      const opts = has(P, "mu") ? { mu: P.mu! } : { prob: p };
      // P(x) >= P(x - 1) exactly when x p <= (r - 1)(1 - p), i.e. (x + r - 1) p <= r - 1 (with mu: x r <= (r - 1) mu)
      const ok = (x: number): boolean =>
        has(P, "mu") ? productAtMost([x, 0], r, (r - 1) * P.mu!) : productAtMost(ddAdd([r - 1, 0], [x, 0]), p, r - 1);
      let mode = 0;
      if (r > 1) {
        mode = Math.max(0, Math.floor(((r - 1) * q) / p) - 1);
        while (ok(mode + 1)) mode++;
        while (mode > 0 && !ok(mode)) mode--;
      }
      return make(
        (r * q) / p,
        (r * q) / (p * p),
        qnbinom(0.5, r, opts),
        mode,
        (2 - p) / Math.sqrt(r * q),
        6 / r + (p * p) / (r * q),
      );
    }
    case "hyper": {
      const m = P.m ?? NaN;
      const n = P.n ?? NaN;
      const k = P.k ?? NaN;
      if (!([m, n, k].every((v) => Number.isInteger(v) && v >= 0) && k <= m + n)) return NAN;
      const N = m + n;
      const mo = Math.floor(((k + 1) * (m + 1)) / (N + 2));
      const kurt =
        ((N - 1) * N * N * (N * (N + 1) - 6 * m * n - 6 * k * (N - k)) + 6 * k * m * n * (N - k) * (5 * N - 6)) /
        (k * m * n * (N - k) * (N - 2) * (N - 3));
      return make(
        (k * m) / N,
        (((k * m) / N) * (n / N) * (N - k)) / (N - 1),
        qhyper(0.5, m, n, k),
        mo,
        ((N - 2 * m) * Math.sqrt(N - 1) * (N - 2 * k)) / (Math.sqrt(k * m * n * (N - k)) * (N - 2)),
        kurt,
      );
    }
    case "invgamma": {
      const a = P.alpha ?? NaN;
      const b = P.beta ?? 1;
      if (!(a > 0 && Number.isFinite(a) && b > 0 && Number.isFinite(b))) return NAN;
      return make(
        a > 1 ? b / (a - 1) : Infinity,
        a > 2 ? (b * b) / ((a - 1) ** 2 * (a - 2)) : a > 1 ? Infinity : NaN,
        qinvgamma(0.5, a, { beta: b }),
        b / (a + 1),
        a > 3 ? (4 * Math.sqrt(a - 2)) / (a - 3) : NaN,
        a > 4 ? (30 * a - 66) / ((a - 3) * (a - 4)) : NaN,
      );
    }
    case "kumar": {
      const a = P.a ?? NaN;
      const b = P.b ?? NaN;
      if (!(a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b))) return NAN;
      // mean b B(1 + 1/a, b)
      const mean = b * Math.exp(lbeta(1 + 1 / a, b));
      // over the density, or over u = F(x) when the density diverges at 1 (b < 1: there the quantile is smooth)
      const s =
        b < 1
          ? central((u) => qkumar1(u, a, b, true, false), () => 1, mean, pkumar1(mean, a, b, true, false), 0, 1)
          : shape((x) => dkumar1(x, a, b, false), mean, 0, 1);
      let mode: number;
      if (a >= 1 && b >= 1) mode = a === 1 && b === 1 ? NaN : Math.pow((a - 1) / (a * b - 1), 1 / a);
      else if (a < 1 && b < 1) mode = NaN;
      else mode = a < 1 ? 0 : 1;
      return make(mean, s.variance, qkumar(0.5, a, b), mode, s.skewness, s.kurtosis);
    }
    case "pareto": {
      const { a = 1, b = 1 } = P;
      if (!(a > 0 && Number.isFinite(a) && b > 0 && Number.isFinite(b))) return NAN;
      return make(
        a > 1 ? (a * b) / (a - 1) : Infinity,
        a > 2 ? (b * b * a) / ((a - 1) ** 2 * (a - 2)) : a > 1 ? Infinity : NaN,
        b * Math.pow(2, 1 / a),
        b,
        a > 3 ? ((2 * (1 + a)) / (a - 3)) * Math.sqrt((a - 2) / a) : NaN,
        a > 4 ? (6 * (a ** 3 + a * a - 6 * a - 2)) / (a * (a - 3) * (a - 4)) : NaN,
      );
    }
    case "triang": {
      const { a = -1, b = 1 } = P;
      const c = P.c ?? midpoint(a, b);
      if (!(Number.isFinite(a) && Number.isFinite(b) && a < b && a <= c && c <= b)) return NAN;
      const q = a * a + b * b + c * c - a * b - a * c - b * c;
      return make(
        Number.isFinite(a + b + c) ? (a + b + c) / 3 : a / 3 + b / 3 + c / 3,
        q / 18,
        qtriang(0.5, { a, b, c }),
        c,
        (Math.SQRT2 * (a + b - 2 * c) * (2 * a - b - c) * (a - 2 * b + c)) / (5 * q ** 1.5),
        -0.6,
      );
    }
    case "laplace": {
      const { mu = 0, sigma = 1 } = P;
      if (!(Number.isFinite(mu) && sigma > 0 && Number.isFinite(sigma))) return NAN;
      return make(mu, 2 * sigma * sigma, mu, mu, 0, 3);
    }
    case "arcsine": {
      const { a = 0, b = 1 } = P;
      if (!(Number.isFinite(a) && Number.isFinite(b) && a < b)) return NAN;
      return make(a + (b - a) / 2, (b - a) ** 2 / 8, qarcsine(0.5, { a, b }), NaN, 0, -1.5);
    }
  }
  throw new RangeError(`unknown distribution '${String(distribution)}'`);
}
