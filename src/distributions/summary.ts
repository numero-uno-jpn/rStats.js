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
import { gamma as gammaFn, lgamma } from "../special/gamma.js";
import { lbeta } from "../special/beta.js";
import { gammaScale, qgamma } from "./gamma.js";
import { qchisq } from "./chisq.js";
import { qbeta } from "./beta.js";
import { qf } from "./f.js";
import { dweibull1, qweibull } from "./weibull.js";
import { qbinom } from "./binomial.js";
import { qpois } from "./poisson.js";
import { qgeom } from "./geometric.js";
import { qnbinom } from "./negbinomial.js";
import { dhyper1, qhyper } from "./hypergeometric.js";
import { qinvgamma } from "./invgamma.js";
import { dkumar1, pkumar1, qkumar, qkumar1 } from "./kumaraswamy.js";
import { qtriang } from "./triangular.js";
import { ldexp } from "../internal/summary.js";
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

/**
 * sdDirect: the standard deviation formed without the variance, used where the variance overflowed or lost digits
 * below the smallest normal number (normal(sd = 1e200) has variance Inf and sd 1e200, normal(sd = 1e-200) variance 0)
 */
function make(
  mean: number,
  variance: number,
  median: number,
  mode: number,
  skewness: number,
  kurtosis: number,
  sdDirect?: number,
): DistSummary {
  const sd = sdDirect === undefined || (variance >= MIN_NORMAL && variance < Infinity) ? Math.sqrt(variance) : sdDirect;
  return { mean, variance, sd, median, mode, skewness, kurtosis };
}

const MIN_NORMAL = 2 ** -1022;

/**
 * Variance, skewness and excess kurtosis from the central moments E[(X - mean)^n], integrated numerically from the
 * density on each side of the mean (no cancellation inside either part): the textbook route through the raw moments
 * cancels badly when the spread is small against the mean (Weibull with a large shape loses 9 digits of the kurtosis
 * that way)
 */
function shape(f: (x: number) => number, mean: number, lower: number, upper: number): Shape {
  return central((t) => t, f, mean, mean, lower, upper);
}

/** Variance, skewness and excess kurtosis; ok is false when an integral did not converge (QUADPACK's ier) */
interface Shape {
  variance: number;
  skewness: number;
  kurtosis: number;
  ok: boolean;
}

/** Whether a QUADPACK result can be used: it converged, or its error estimate is still within 1e-8 of it */
function converged(r: { result: number; abserr: number; ier: number }): boolean {
  return r.ier === 0 || r.abserr <= 1e-8 * Math.abs(r.result);
}

/**
 * Variance, skewness and excess kurtosis from the logs l_r of the raw moments E[X^r], r = 1..4, through the ratios
 * rho_r = E[X^r] / E[X]^r taken in logs (so heavy tails, where the integrals of shape() do not converge, neither
 * overflow nor cancel: the leading terms dominate there)
 */
function fromLogRawMoments([l1, l2, l3, l4]: readonly [number, number, number, number]): Shape {
  const r2 = l2 - 2 * l1;
  const r3 = l3 - 3 * l1;
  const r4 = l4 - 4 * l1;
  const lv = r2 + Math.log(-Math.expm1(-r2)); // log(rho_2 - 1)
  return {
    variance: Math.exp(2 * l1 + lv),
    skewness: Math.exp(r3 - 1.5 * lv) * (1 - 3 * Math.exp(r2 - r3) + 2 * Math.exp(-r3)),
    kurtosis: Math.exp(r4 - 2 * lv) * (1 - 4 * Math.exp(r3 - r4) + 6 * Math.exp(r2 - r4) - 3 * Math.exp(-r4)) - 3,
    ok: true,
  };
}

/** shape() over t: x(t) with weight w(t), the integral split at t = split where x = mean */
function central(
  x: (t: number) => number,
  w: (t: number) => number,
  mean: number,
  split: number,
  lower: number,
  upper: number,
): Shape {
  const tol = 50 * Number.EPSILON;
  let ok = true;
  const c = [2, 3, 4].map((n) => {
    const g = (t: number): number => (x(t) - mean) ** n * w(t);
    const left = dqagse(g, lower, split, 0, tol, 200);
    const right = upper === Infinity ? dqagie(g, split, 1, 0, tol, 200) : dqagse(g, split, upper, 0, tol, 200);
    if (!converged(left) || !converged(right)) ok = false;
    return left.result + right.result;
  });
  const v = c[0]!;
  return { variance: v, skewness: c[1]! / v ** 1.5, kurtosis: c[2]! / (v * v) - 3, ok };
}

/** Shapes above this (Weibull's k, Kumaraswamy's a) go through expShape(); at 100 central() is still within 2e-14 */
const LARGE_SHAPE = 100;

/**
 * Moments of X = c exp(Z / s) for a large shape s, through T = s expm1(log(e) / s) = s (X / c - 1), e the base
 * variable with density w on (0, upper) (Weibull: e ~ Exp(1), c = 1; Kumaraswamy: e = b W with W ~ Beta(1, b),
 * c = b^(-1/a)). X lies within O(1/s) of c, too narrow for the quadrature in x (and the raw moments Gamma(1 + r/k)
 * round to 1): k = 1e4 gave the skewness -3.03 for -1.139, k = 1e308 sd 0 and NaN (issues #240, #249). T has a spread
 * of order 1 for every shape. Returns E[T], the variance of T and the skewness and kurtosis (those of X), or undefined
 * where an integral did not converge
 */
function expShape(s: number, w: (e: number) => number, upper: number): (Shape & { meanT: number }) | undefined {
  const tol = 50 * Number.EPSILON;
  const T = (e: number): number => s * Math.expm1(Math.log(e) / s);
  const f = (e: number): number => {
    const v = w(e);
    return v === 0 ? 0 : T(e) * v;
  };
  const m = Math.min(1, upper / 2);
  const left = dqagse(f, 0, m, 0, tol, 200);
  const right = upper === Infinity ? dqagie(f, m, 1, 0, tol, 200) : dqagse(f, m, upper, 0, tol, 200);
  if (!converged(left) || !converged(right)) return undefined;
  const meanT = left.result + right.result;
  if (!(meanT / s > -1)) return undefined;
  // e where T = E[T]
  const split = Math.min(Math.exp(s * Math.log1p(meanT / s)), upper);
  const sh = central(T, w, meanT, split, 0, upper);
  return sh.ok ? { ...sh, meanT } : undefined;
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
      return make(mean, sd * sd, mean, mean, 0, 0, sd);
    }
    case "lnorm": {
      const { meanlog = 0, sdlog = 1 } = P;
      if (!(Number.isFinite(meanlog) && sdlog > 0 && Number.isFinite(sdlog))) return NAN;
      const s2 = sdlog * sdlog;
      const em1 = Math.expm1(s2);
      const w = Math.exp(s2);
      // sqrt(em1): sdlog itself where s2 is below 1e-280 (em1 / s2 is 1 to double precision; s2 underflowed to 0 or onto
      // the subnormals and took the sd and skewness with it: 0 for sdlog = 1e-200; issue #120)
      const rootEm1 = s2 < 1e-280 ? sdlog : Math.sqrt(em1);
      return make(
        Math.exp(meanlog + s2 / 2),
        em1 * Math.exp(2 * meanlog + s2),
        Math.exp(meanlog),
        Math.exp(meanlog - s2),
        (w + 2) * rootEm1,
        // w^4 + 2 w^3 + 3 w^2 - 6 with w = 1 + em1, expanded in em1 (the w form cancels for small sdlog)
        em1 * (16 + em1 * (15 + em1 * (6 + em1))),
        rootEm1 * Math.exp(meanlog + s2 / 2),
      );
    }
    case "unif": {
      const { min = 0, max = 1 } = P;
      if (!(Number.isFinite(min) && Number.isFinite(max) && min < max)) return NAN;
      const m = Number.isFinite(max - min) ? min + (max - min) / 2 : midpoint(min, max);
      return make(m, (max - min) ** 2 / 12, m, NaN, 0, -1.2, (max / 2 - min / 2) * (2 / Math.sqrt(12)));
    }
    case "exp": {
      const { rate = 1 } = P;
      if (!(rate > 0 && Number.isFinite(rate))) return NAN;
      return make(1 / rate, 1 / (rate * rate), Math.LN2 / rate, 0, 2, 6, 1 / rate);
    }
    case "gamma": {
      const k = P.shape ?? NaN;
      // (rate and scale as dgamma: both only with scale = 1 / rate, otherwise invalid; the scale was taken and the rate
      // ignored; issue #245)
      let scale: number;
      try {
        scale = gammaScale({ ...(has(P, "rate") && { rate: P.rate! }), ...(has(P, "scale") && { scale: P.scale! }) });
      } catch {
        return NAN;
      }
      if (!(k > 0 && Number.isFinite(k) && scale > 0 && Number.isFinite(scale))) return NAN;
      return make(k * scale, k * scale * scale, qgamma(0.5, k, { scale }), k >= 1 ? (k - 1) * scale : 0, 2 / Math.sqrt(k), 6 / k, Math.sqrt(k) * scale);
    }
    case "chisq": {
      const df = P.df ?? NaN;
      if (!(df > 0 && Number.isFinite(df))) return NAN;
      return make(df, 2 * df, qchisq(0.5, df), Math.max(df - 2, 0), Math.sqrt(8 / df), 12 / df, Math.SQRT2 * Math.sqrt(df));
    }
    case "beta": {
      const a = P.shape1 ?? NaN;
      const b = P.shape2 ?? NaN;
      if (!(a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b))) return NAN;
      const s = a + b;
      let mode: number;
      if (a > 1 && b > 1) mode = Number.isFinite(s) ? (a - 1) / (s - 2) : (a - 1) / 2 / ((a - 1) / 2 + (b - 1) / 2);
      else if ((a === 1 && b === 1) || (a < 1 && b < 1)) mode = NaN;
      else mode = a <= 1 && b >= 1 ? 0 : 1;
      const median = qbeta(0.5, a, b);
      if (!Number.isFinite(s)) {
        // a + b overflows: from the halved shapes, p = a / (a + b), q = b / (a + b) and h = (a + b) / 2, with s + 1, s + 2
        // and s + 3 equal to s (beta(1e308, 1e308) had mean 0, mode 0 and variance 0)
        const h = a / 2 + b / 2;
        const pa = a / 2 / h;
        const pb = b / 2 / h;
        return make(
          pa,
          (pa * pb) / h / 2,
          median,
          mode,
          (2 * (pb - pa)) / (Math.sqrt(pa) * Math.sqrt(pb) * Math.SQRT2 * Math.sqrt(h)),
          (3 * ((pa - pb) ** 2 / (pa * pb) - 1)) / h,
          (Math.sqrt(pa) * Math.sqrt(pb)) / Math.sqrt(h) / Math.SQRT2,
        );
      }
      const ab = a * b;
      // Where a b overflows or underflows (shapes beyond 1e154 or below 1e-154), the moments in p = a / s and q = b / s
      // (numerators and denominators divided by s^2; beta(1e200, 1e200) had kurtosis NaN)
      const inRange = ab >= MIN_NORMAL && ab < Infinity;
      const pa = a / s;
      const pb = b / s;
      return make(
        pa,
        betaVariance(a, b, s),
        median,
        mode,
        inRange
          ? (2 * (b - a) * Math.sqrt(s + 1)) / ((s + 2) * Math.sqrt(ab))
          : (2 * (pb - pa) * Math.sqrt(s + 1)) / ((s + 2) * Math.sqrt(pa * pb)),
        inRange
          ? (6 * ((a - b) ** 2 * (s + 1) - ab * (s + 2))) / (ab * (s + 2) * (s + 3))
          : (6 * ((pa - pb) ** 2 * ((s + 1) / (s + 2)) - pa * pb)) / (pa * pb * (s + 3)),
        // (where a / s or b / s is below the normal range, the square roots taken before the ratios: beta(1e-308, 1e154)
        // had sd 0 for 1e-308; issue #241)
        pa >= MIN_NORMAL && pb >= MIN_NORMAL
          ? (Math.sqrt(pa) * Math.sqrt(pb)) / Math.sqrt(s + 1)
          : ((Math.sqrt(a) / Math.sqrt(s)) * (Math.sqrt(b) / Math.sqrt(s))) / Math.sqrt(s + 1),
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
      // Each closed form where its numerator and denominator are normal numbers (the same bits as before); otherwise
      // from ratios that stay in range, with t = d1 + d2 - 2 halved (df1 = df2 = 1e200 gave variance NaN, sd 0 and
      // skewness 0; 1e308 NaN throughout; issue #235)
      const inRange = (x: number): boolean => x >= MIN_NORMAL && x < Infinity;
      const t = d1 + d2 - 2;
      const th = d1 / 2 + d2 / 2 - 1; // t / 2
      const r = d2 / (d2 - 2);
      const u = (d2 - 2) / d1; // t / d1 - 1
      const w = (d2 - 2) / (d2 - 4);
      let variance = d2 > 4 ? NaN : d2 > 2 ? Infinity : NaN;
      let sd = variance;
      if (d2 > 4) {
        const num = 2 * d2 * d2 * t;
        const den = d1 * (d2 - 2) ** 2 * (d2 - 4);
        // 2 r^2 (t / d1) / (d2 - 4) with t / d1 = 1 + u; where u overflows, 2 r^2 (1 / (d2 - 4) + w / d1)
        variance = inRange(num) && inRange(den) ? num / den : Number.isFinite(u) ? (2 * r * r * (1 + u)) / (d2 - 4) : 2 * r * r * (1 / (d2 - 4) + w / d1);
        // (the standard deviation from the square roots of the factors, where the variance overflows)
        const sNum = Math.SQRT2 * d2 * Math.sqrt(t);
        const sDen = Math.sqrt(d1) * (d2 - 2) * Math.sqrt(d2 - 4);
        sd =
          inRange(sNum) && inRange(sDen)
            ? sNum / sDen
            : Number.isFinite(u)
              ? Math.SQRT2 * r * (Math.sqrt(1 + u) / Math.sqrt(d2 - 4))
              : Math.SQRT2 * r * (Math.sqrt(w) / Math.sqrt(d1));
      }
      let skewness = NaN;
      if (d2 > 6) {
        const num = (2 * d1 + d2 - 2) * Math.sqrt(8 * (d2 - 4));
        const den = (d2 - 6) * Math.sqrt(d1 * t);
        // (d1 + t) / sqrt(d1 t) = sqrt(d1 / t) + sqrt(t / d1)
        const sq1 = Math.sqrt(d1);
        const sqt = Math.sqrt(th) * Math.SQRT2;
        const x = (Math.sqrt(8) * Math.sqrt(d2 - 4)) / (d2 - 6);
        skewness = inRange(num) && inRange(den) ? num / den : (sq1 / sqt) * x + (sqt * x) / sq1;
      }
      let kurtosis = NaN;
      if (d2 > 8) {
        const num = 12 * (d1 * (5 * d2 - 22) * t + (d2 - 4) * (d2 - 2) ** 2);
        const den = d1 * (d2 - 6) * (d2 - 8) * t;
        // 12 ((5 d2 - 22) / ((d2 - 6)(d2 - 8)) + (d2 - 4)(d2 - 2)^2 / (d1 (d2 - 6)(d2 - 8) t))
        kurtosis =
          inRange(num) && inRange(den)
            ? num / den
            : 12 *
              (((5 - 22 / d2) * (d2 / (d2 - 6))) / (d2 - 8) +
                ((d2 - 4) / (d2 - 6)) * ((d2 - 2) / (d2 - 8)) * ((d2 / 2 - 1) / th / d1));
      }
      return make(mean, variance, qf(0.5, d1, d2), d1 > 2 ? ((d1 - 2) / d1) * (d2 / (d2 + 2)) : 0, skewness, kurtosis, sd);
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
      // X^k ~ Exp(1)
      const big = k > LARGE_SHAPE ? expShape(k, (e) => Math.exp(-e), Infinity) : undefined;
      if (big !== undefined) {
        const sd = lam * (Math.sqrt(big.variance) / k);
        const median = qweibull(0.5, k, { scale: lam });
        return make(lam * mean, sd * sd, median, lam * Math.pow((k - 1) / k, 1 / k), big.skewness, big.kurtosis, sd);
      }
      // E[X^r] = Gamma(1 + r/k) for scale 1: used when the integrals do not converge (small shapes, heavy tails)
      const si = shape((x) => dweibull1(x, k, 1, false), mean, 0, Infinity);
      const s = si.ok ? si : fromLogRawMoments([1, 2, 3, 4].map((r) => lgamma(1 + r / k)) as [number, number, number, number]);
      return make(
        lam * mean,
        lam * lam * s.variance,
        qweibull(0.5, k, { scale: lam }),
        k > 1 ? lam * Math.pow((k - 1) / k, 1 / k) : 0,
        s.skewness,
        s.kurtosis,
        lam * Math.sqrt(s.variance),
      );
    }
    case "logis": {
      const { location = 0, scale = 1 } = P;
      if (!(Number.isFinite(location) && scale > 0 && Number.isFinite(scale))) return NAN;
      return make(location, (scale * scale * Math.PI * Math.PI) / 3, location, location, 0, 1.2, (scale * Math.PI) / Math.sqrt(3));
    }
    case "binom": {
      const n = P.size ?? NaN;
      const p = P.prob ?? NaN;
      if (!(Number.isInteger(n) && n >= 0 && p >= 0 && p <= 1)) return NAN;
      const q = 1 - p;
      // (a point mass: no skewness or kurtosis)
      const point = n === 0 || p === 0 || p === 1;
      // P(x) >= P(x - 1) exactly when x <= (n + 1) p
      return make(
        n * p,
        n * p * q,
        qbinom(0.5, n, p),
        Math.min(n, floorProduct(n + 1, p)),
        point ? NaN : (q - p) / Math.sqrt(n * p * q),
        point ? NaN : (1 - 6 * p * q) / (n * p * q),
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
      // (p = 1 is a point mass at 0: no skewness or kurtosis)
      return make(
        q / p,
        q / (p * p),
        qgeom(0.5, p),
        0,
        p === 1 ? NaN : (2 - p) / Math.sqrt(q),
        p === 1 ? NaN : 6 + (p * p) / q,
        Math.sqrt(q) / p,
      );
    }
    case "nbinom": {
      const r = P.size ?? NaN;
      if (!(r > 0 && Number.isFinite(r))) return NAN;
      // (where size + mu overflows, from the halved parameters: size = mu = 1e308 gave p = 0 and NaN throughout; issue #236)
      const p = has(P, "mu") ? (Number.isFinite(r + P.mu!) ? r / (r + P.mu!) : r / 2 / (r / 2 + P.mu! / 2)) : (P.prob ?? NaN);
      if (!(p > 0 && p <= 1)) return NAN;
      const q = 1 - p;
      const opts = has(P, "mu") ? { mu: P.mu! } : { prob: p };
      // P(x) >= P(x - 1) exactly when x p <= (r - 1)(1 - p), i.e. (x + r - 1) p <= r - 1 (with mu: x r <= (r - 1) mu)
      const ok = (x: number): boolean =>
        has(P, "mu") ? productAtMost([x, 0], r, (r - 1) * P.mu!) : productAtMost(ddAdd([r - 1, 0], [x, 0]), p, r - 1);
      let mode = 0;
      if (r > 1) {
        const guess = Math.floor(((r - 1) * q) / p);
        // Beyond 2^53 the integers are not all doubles (mode + 1 = mode, and the search did not end): the rounded value
        if (!(guess < 2 ** 53)) mode = guess;
        else {
          mode = Math.max(0, guess - 1);
          while (ok(mode + 1)) mode++;
          while (mode > 0 && !ok(mode)) mode--;
        }
      }
      return make(
        (r * q) / p,
        (r * q) / (p * p),
        qnbinom(0.5, r, opts),
        mode,
        // (p = 1 is a point mass at 0: no skewness or kurtosis)
        p === 1 ? NaN : (2 - p) / Math.sqrt(r * q),
        p === 1 ? NaN : 6 / r + (p * p) / (r * q),
        (Math.sqrt(r) * Math.sqrt(q)) / p,
      );
    }
    case "hyper": {
      const m = P.m ?? NaN;
      const n = P.n ?? NaN;
      const k = P.k ?? NaN;
      if (!([m, n, k].every((v) => Number.isInteger(v) && v >= 0) && k <= m + n)) return NAN;
      const N = m + n;
      // Where (k + 1)(m + 1) overflows, the floor of the exact quotient in integers, rounded to a double (beyond 2^53,
      // as the nbinom mode); k m / N and the variance from the ratio m / N where the products overflow (m = n = k =
      // 1e200 gave mean, variance and mode Infinity; issue #237)
      const moProduct = (k + 1) * (m + 1);
      const mo = Number.isFinite(moProduct)
        ? Math.floor(moProduct / (N + 2))
        : Number(((BigInt(k) + 1n) * (BigInt(m) + 1n)) / (BigInt(m) + BigInt(n) + 2n));
      // a point mass (k = 0, m = 0, n = 0 or k = N) has variance 0 and the mean k m / N, 0 for N = 0 (the formulas gave
      // 0/0 for N = 0 and N = 1; issue #19)
      const point = k === 0 || m === 0 || n === 0 || k === N;
      const mean = N === 0 ? 0 : Number.isFinite(k * m) ? (k * m) / N : k * (m / N);
      const vPlain = ((mean * (n / N)) * (N - k)) / (N - 1);
      const variance = point ? 0 : Number.isFinite(vPlain) ? vPlain : mean * (n / N) * ((N - k) / (N - 1));
      let skewness: number;
      let kurt: number;
      if (k === 0 || m === 0 || n === 0 || k === N) {
        // a point mass: no skewness or kurtosis
        skewness = NaN;
        kurt = NaN;
      } else if (N <= 3) {
        // the closed forms divide by N - 2 and N - 3: the central moments over the (at most two-point) support
        const c = [2, 3, 4].map((r) => {
          let s = 0;
          for (let x = Math.max(0, k - n); x <= Math.min(k, m); x++) s += dhyper1(x, m, n, k, false) * (x - mean) ** r;
          return s;
        });
        skewness = c[1]! / c[0]! ** 1.5;
        kurt = c[2]! / (c[0]! * c[0]!) - 3;
      } else {
        skewness = ((N - 2 * m) * Math.sqrt(N - 1) * (N - 2 * k)) / (Math.sqrt(k * m * n * (N - k)) * (N - 2));
        const num = (N - 1) * N * N * (N * (N + 1) - 6 * m * n - 6 * k * (N - k)) + 6 * k * m * n * (N - k) * (5 * N - 6);
        const den = k * m * n * (N - k) * (N - 2) * (N - 3);
        if (Number.isFinite(num) && Number.isFinite(den)) kurt = num / den;
        else {
          // the products overflow: numerator and denominator divided by N^5, in p = m / N, q = n / N, f = k / N and
          // g = (N - k) / N (m = n = k = 1e150 gave NaN for about -1e-150; issue #244)
          const pq = (m / N) * (n / N);
          const fg = (k / N) * ((N - k) / N);
          const a = 1 + 1 / N - 6 * pq - 6 * fg;
          kurt = ((1 - 1 / N) * a + 6 * pq * fg * (5 - 6 / N)) / (k * pq * ((N - k) / N) * ((1 - 2 / N) * (1 - 3 / N)));
        }
      }
      return make(mean, variance, qhyper(0.5, m, n, k), mo, skewness, kurt);
    }
    case "invgamma": {
      const a = P.alpha ?? NaN;
      const b = P.beta ?? 1;
      if (!(a > 0 && Number.isFinite(a) && b > 0 && Number.isFinite(b))) return NAN;
      // Where b^2, (a - 1)^2 (a - 2), (a - 1) sqrt(a - 2) or (a - 3)(a - 4) leave the range, from r = b / (a - 1) and
      // ratios of a (alpha = beta = 1e308 gave variance NaN, sd 0 and kurtosis NaN; issue #238)
      const r = b / (a - 1);
      const b2 = b * b;
      const vDen = (a - 1) ** 2 * (a - 2);
      const sdDen = (a - 1) * Math.sqrt(a - 2);
      const kurt = (30 * a - 66) / ((a - 3) * (a - 4));
      return make(
        a > 1 ? r : Infinity,
        a > 2 ? (b2 >= MIN_NORMAL && b2 < Infinity && vDen < Infinity ? b2 / vDen : r * (r / (a - 2))) : a > 1 ? Infinity : NaN,
        qinvgamma(0.5, a, { beta: b }),
        b / (a + 1),
        a > 3 ? (4 * Math.sqrt(a - 2)) / (a - 3) : NaN,
        a > 4 ? (kurt > 0 && kurt < Infinity ? kurt : ((30 - 66 / a) / (a - 3)) * (a / (a - 4))) : NaN,
        a > 2 ? (sdDen < Infinity ? b / sdDen : r / Math.sqrt(a - 2)) : undefined,
      );
    }
    case "kumar": {
      const a = P.a ?? NaN;
      const b = P.b ?? NaN;
      if (!(a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b))) return NAN;
      // mean b B(1 + 1/a, b)
      const mean = b * Math.exp(lbeta(1 + 1 / a, b));
      // over the density, or over u = F(x) when the density diverges at 1 (b < 1: there the quantile is smooth)
      const si =
        b < 1
          ? central((u) => qkumar1(u, a, b, true, false), () => 1, mean, pkumar1(mean, a, b, true, false), 0, 1)
          : shape((x) => dkumar1(x, a, b, false), mean, 0, 1);
      // E[X^r] = b B(1 + r/a, b): used when the integrals do not converge
      const s = si.ok ? si : fromLogRawMoments([1, 2, 3, 4].map((r) => Math.log(b) + lbeta(1 + r / a, b)) as [number, number, number, number]);
      let mode: number;
      // ((a - 1) / (a b - 1))^(1/a); where a b overflows (a b - 1 is a b there), as ((a - 1) / a)^(1/a) b^(-1/a)
      // (a = b = 1e200 gave 0 for 1; issue #239)
      if (a >= 1 && b >= 1) {
        if (a === 1 && b === 1) mode = NaN;
        else mode = Number.isFinite(a * b) ? Math.pow((a - 1) / (a * b - 1), 1 / a) : Math.pow((a - 1) / a, 1 / a) * Math.pow(b, -1 / a);
      }
      else if (a < 1 && b < 1) mode = NaN;
      else mode = a < 1 ? 0 : 1;
      return make(mean, s.variance, qkumar(0.5, a, b), mode, s.skewness, s.kurtosis);
    }
    case "pareto": {
      const { a = 1, b = 1 } = P;
      if (!(a > 0 && Number.isFinite(a) && b > 0 && Number.isFinite(b))) return NAN;
      // Each moment from the closed form, or where an intermediate product overflows (a b, b² a, a³, 2 (1 + a), b √a:
      // a = b = 1e308 gave mean Inf, variance NaN, kurtosis NaN; issue #34) from ratios in which the powers cancel
      const orElse = (v: number, alt: () => number): number => (Number.isFinite(v) ? v : alt());
      const r = b / (a - 1);
      return make(
        a > 1 ? orElse((a * b) / (a - 1), () => b * (a / (a - 1))) : Infinity,
        a > 2 ? orElse((b * b * a) / ((a - 1) ** 2 * (a - 2)), () => r * r * (a / (a - 2))) : a > 1 ? Infinity : NaN,
        b * Math.pow(2, 1 / a),
        b,
        a > 3 ? orElse(((2 * (1 + a)) / (a - 3)) * Math.sqrt((a - 2) / a), () => 2 * ((1 + a) / (a - 3)) * Math.sqrt((a - 2) / a)) : NaN,
        a > 4
          ? orElse((6 * (a ** 3 + a * a - 6 * a - 2)) / (a * (a - 3) * (a - 4)), () => (6 * (1 + 1 / a - 6 / (a * a) - 2 / a ** 3)) / ((1 - 3 / a) * (1 - 4 / a)))
          : NaN,
        a > 2 ? orElse((b * Math.sqrt(a)) / ((a - 1) * Math.sqrt(a - 2)), () => r * Math.sqrt(a / (a - 2))) : undefined,
      );
    }
    case "triang": {
      const { a = -1, b = 1 } = P;
      const c = P.c ?? midpoint(a, b);
      if (!(Number.isFinite(a) && Number.isFinite(b) && a < b && a <= c && c <= b)) return NAN;
      // q = a² + b² + c² - ab - ac - bc as (b - a)(b - c) + (c - a)², whose terms are all non-negative: the
      // expanded form cancels when the location is large against the width ((1e10, 1e10 + 1, 1e10 + 0.25) gave the
      // variance 910 for 0.045) and overflows to Inf - Inf near the top of the range (issue #243). The skewness's
      // numerator (a + b - 2c)(2a - b - c)(a - 2b + c) is (w - v)(u + v)(u + w) in the same differences
      const e = Math.floor(Math.log2(Math.max(Math.abs(a), Math.abs(b), Math.abs(c))));
      // from the parameters divided by 2^e where b - a overflows, the powers of the parameters' scale could
      // overflow or underflow (the largest outside [2^-300, 2^300]) or those of the width could underflow (below
      // 2^-290: q^1.5 fell onto the subnormals); otherwise the products are in range
      const scaled = !Number.isFinite(b - a) || e < -300 || e >= 300 || b - a < 2 ** -290;
      const [x, y, z] = scaled ? ([a, b, c].map((v) => ldexp(v, -e)) as [number, number, number]) : [a, b, c];
      const u = y - x;
      const v = z - x;
      const w = y - z;
      const q = u * w + v * v;
      return make(
        Number.isFinite(a + b + c) ? (a + b + c) / 3 : a / 3 + b / 3 + c / 3,
        scaled ? ldexp(q / 18, 2 * e) : q / 18,
        qtriang(0.5, { a, b, c }),
        c,
        (Math.SQRT2 * (w - v) * (u + v) * (u + w)) / (5 * q ** 1.5),
        -0.6,
        scaled ? ldexp(Math.sqrt(q / 18), e) : Math.sqrt(q / 18),
      );
    }
    case "laplace": {
      const { mu = 0, sigma = 1 } = P;
      if (!(Number.isFinite(mu) && sigma > 0 && Number.isFinite(sigma))) return NAN;
      return make(mu, 2 * sigma * sigma, mu, mu, 0, 3, Math.SQRT2 * sigma);
    }
    case "arcsine": {
      const { a = 0, b = 1 } = P;
      if (!(Number.isFinite(a) && Number.isFinite(b) && a < b)) return NAN;
      // symmetric: the median is the mean (qarcsine(0.5) rounds to 1e-16 of the width); b - a may overflow
      const mean = Number.isFinite(b - a) ? a + (b - a) / 2 : midpoint(a, b);
      return make(mean, (b - a) ** 2 / 8, mean, NaN, 0, -1.5, (b / 2 - a / 2) / Math.SQRT2);
    }
  }
  throw new RangeError(`unknown distribution '${String(distribution)}'`);
}
