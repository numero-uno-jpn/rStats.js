// Score statistics of two independent binomial proportions x1/n1 and x2/n2 under a restriction (a given difference,
// ratio or odds ratio), and the roots that make their confidence limits. Shared by binomDiffCI, binomRatioCI and
// oddsRatio (src/htest/twoByTwo.ts); the statistics at a given difference are what a test of equivalence uses.
//
// Written for rStats.js from the papers:
// - Difference: the maximum likelihood estimate under p1 - p2 = delta in the closed (trigonometric) form of the cubic
//   of Farrington and Manning (Statistics in Medicine 9, 1990, 1447-1454), and the statistic
//   (p1 - p2 - delta)^2 / var(delta) with var = p1~(1 - p1~)/n1 + p2~(1 - p2~)/n2: Miettinen and Nurminen (Statistics
//   in Medicine 4, 1985, 213-226) multiply var by N/(N - 1); Mee (Biometrics 40, 1984) and Farrington-Manning do not.
// - Ratio: Koopman (Biometrics 40, 1984, 513-517): Pearson's statistic at the MLE under p1 = phi p2, whose p1~ is the
//   smaller root of a quadratic (Nam, Biometrics 51, 1995, gives the same limits in closed form).
// - Odds ratio: the score statistic at the MLE under (p1/(1 - p1)) / (p2/(1 - p2)) = theta (the root of a quadratic
//   in p2~; Miettinen and Nurminen 1985 without the factor N/(N - 1), i.e. Cornfield's uncorrected chi-squared).
// The limits are the roots of statistic = bound on either side of the estimate, found by Brent's method to the
// precision of the doubles (on the log scale for the ratio and the odds ratio); the statistic enters through
// T/(1 + T), which is finite also where T is infinite (a variance of 0 at the end of the range).

import { logScaleRoot, uniroot } from "../../internal/uniroot.js";

/** T / (1 + T) for T >= 0, 1 for T = Infinity: a bounded, increasing function of a statistic */
function bounded(t: number): number {
  return t === Infinity ? 1 : t / (1 + t);
}

/** a^2 / b where 0 / 0 is 0 (a term of a statistic whose cell is fitted exactly at the end of the range) */
function term(num: number, den: number): number {
  if (num === 0) return 0;
  return den > 0 ? (num * num) / den : Infinity;
}

// ---- difference ----

/**
 * The maximum likelihood estimate (p1~, p2~) of two proportions under p1 - p2 = delta (-1 <= delta <= 1), from the
 * trigonometric solution of Farrington and Manning's cubic, with t = n2 / n1:
 * a = 1 + t, b = -(1 + t + p1 + t p2 + delta (t + 2)), c = delta^2 + delta (2 p1 + t + 1) + p1 + t p2,
 * d = -p1 delta (1 + delta); v = (b/(3a))^3 - bc/(6a^2) + d/(2a), u = sign(v) sqrt((b/(3a))^2 - c/(3a)),
 * w = (pi + acos(v/u^3))/3, p1~ = 2u cos(w) - b/(3a), p2~ = p1~ - delta. Clamped to the range of the parameters
 */
export function restrictedMleDiff(x1: number, n1: number, x2: number, n2: number, delta: number): [number, number] {
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const t = n2 / n1;
  const a = 1 + t;
  const b = -(1 + t + p1 + t * p2 + delta * (t + 2));
  const c = delta * delta + delta * (2 * p1 + t + 1) + p1 + t * p2;
  const d = -p1 * delta * (1 + delta);
  const b3a = b / (3 * a);
  const v = b3a * b3a * b3a - (b * c) / (6 * a * a) + d / (2 * a);
  const u = Math.sign(v) * Math.sqrt(Math.max(0, b3a * b3a - c / (3 * a)));
  let q1: number;
  if (u === 0) q1 = -b3a;
  else {
    const w = (Math.PI + Math.acos(Math.max(-1, Math.min(1, v / (u * u * u))))) / 3;
    q1 = 2 * u * Math.cos(w) - b3a;
  }
  // p1~ in [max(0, delta), min(1, 1 + delta)] so that both are proportions
  const lo = Math.max(0, delta);
  const hi = Math.min(1, 1 + delta);
  q1 = Math.min(hi, Math.max(lo, q1));
  // The trigonometric form loses digits where acos is taken near +-1 (1e-12 relative for 2/3000 against 9/3000):
  // Newton steps on the score equation in p1~, which decreases over (lo, hi), while they reduce its residual
  const scoreAt = (p: number): [number, number] => {
    let f = 0;
    let df = 0;
    const add = (count: number, den: number, sign: number): void => {
      if (count === 0) return;
      f += (sign * count) / den;
      df -= count / (den * den);
    };
    add(x1, p, 1);
    add(n1 - x1, 1 - p, -1);
    add(x2, p - delta, 1);
    add(n2 - x2, 1 - p + delta, -1);
    return [f, df];
  };
  if (q1 > lo && q1 < hi) {
    let [f, df] = scoreAt(q1);
    for (let i = 0; i < 4 && Number.isFinite(f) && f !== 0 && df < 0; i++) {
      const next = q1 - f / df;
      if (!(next > lo && next < hi)) break;
      const [f2, df2] = scoreAt(next);
      if (!(Math.abs(f2) < Math.abs(f))) break;
      [q1, f, df] = [next, f2, df2];
    }
  }
  const q2 = Math.min(1, Math.max(0, q1 - delta));
  return [q1, q2];
}

/** How the variance of p1 - p2 is formed at a given difference */
export type DiffVariance = "mn" | "mee" | "wald";

/**
 * The variance of p1 - p2 used by the score statistic at the difference delta: at the restricted MLE times N/(N - 1)
 * (Miettinen-Nurminen, "mn"), at the restricted MLE ("mee", Farrington-Manning), or at the observed proportions
 * ("wald")
 */
export function diffVariance(x1: number, n1: number, x2: number, n2: number, delta: number, kind: DiffVariance): number {
  if (kind === "wald") {
    const p1 = x1 / n1;
    const p2 = x2 / n2;
    return (p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2;
  }
  const [q1, q2] = restrictedMleDiff(x1, n1, x2, n2, delta);
  const v = Math.max(0, (q1 * (1 - q1)) / n1 + (q2 * (1 - q2)) / n2);
  if (kind === "mee") return v;
  const N = n1 + n2;
  return (v * N) / (N - 1);
}

/** The squared score statistic (p1 - p2 - delta)^2 / var(delta); 0 at delta = p1 - p2, Infinity where var is 0 */
export function diffStatistic(x1: number, n1: number, x2: number, n2: number, delta: number, kind: DiffVariance): number {
  const dev = x1 / n1 - x2 / n2 - delta;
  return term(dev, diffVariance(x1, n1, x2, n2, delta, kind));
}

/**
 * The limits [lower, upper] of {delta in [-1, 1] : statistic(delta) <= bound} around est = p1 - p2: the roots of
 * statistic = bound below and above est (-1 or 1 where est is at the end)
 */
export function diffScoreLimits(x1: number, n1: number, x2: number, n2: number, bound: number, kind: DiffVariance): [number, number] {
  const est = x1 / n1 - x2 / n2;
  if (bound === 0) return [est, est];
  const target = bounded(bound);
  const g = (delta: number): number => (delta === est ? 0 : bounded(diffStatistic(x1, n1, x2, n2, delta, kind))) - target;
  const root = (lo: number, hi: number, gLo: number, gHi: number): number => {
    if (gLo === 0) return lo;
    if (gHi === 0) return hi;
    return uniroot(g, lo, hi, { tol: 1e-300, fLower: gLo, fUpper: gHi });
  };
  const gm = g(-1);
  const gp = g(1);
  const lower = est <= -1 || gm <= 0 ? -1 : root(-1, est, gm, -target);
  const upper = est >= 1 || gp <= 0 ? 1 : root(est, 1, -target, gp);
  return [lower, upper];
}

// ---- roots on the log scale ----

/**
 * The root of g(u) = h(exp(u)) - target, h increasing in |u - u0| from h(exp(u0)) <= target, on the side of u0 given by
 * dir: the bracket is widened from u0 by steps that double, and the root solved by Brent's method; 0 (dir -1) or
 * Infinity (dir 1) when no root lies within the doubles
 */
function logSideRoot(g: (u: number) => number, u0: number, dir: 1 | -1): number {
  let a = u0;
  let ga = g(u0);
  if (ga >= 0) return Math.exp(u0);
  let step = 1;
  for (;;) {
    const b = u0 + dir * step;
    if (Math.abs(b) > 745) return dir < 0 ? 0 : Infinity;
    const gb = g(b);
    if (gb >= 0) {
      if (gb === 0) return Math.exp(b);
      const r = dir > 0 ? uniroot(g, a, b, { tol: 2 ** -60, fLower: ga, fUpper: gb }) : uniroot(g, b, a, { tol: 2 ** -60, fLower: gb, fUpper: ga });
      return Math.exp(r);
    }
    a = b;
    ga = gb;
    step *= 2;
  }
}

// ---- ratio ----

/**
 * The MLE p1~ under p1 = phi p2 (Koopman 1984): the smaller root of
 * (n1 + n2) p^2 - (phi (n1 + x2) + x1 + n2) p + phi (x1 + x2) = 0, capped at min(1, phi); p2~ = p1~ / phi
 */
export function restrictedMleRatio(x1: number, n1: number, x2: number, n2: number, phi: number): [number, number] {
  const A = n1 + n2;
  const B = phi * (n1 + x2) + x1 + n2;
  const C = phi * (x1 + x2);
  // the smaller root (B - sqrt(B^2 - 4AC)) / (2A), in the form without cancellation
  const disc = Math.sqrt(Math.max(0, B * B - 4 * A * C));
  const q1 = Math.min(1, phi, C === 0 ? 0 : (2 * C) / (B + disc));
  return [q1, Math.min(1, q1 / phi)];
}

/** Koopman's statistic: Pearson's chi-squared of the two groups at the MLE under p1 = phi p2 (a 0/0 term counts 0) */
export function ratioStatistic(x1: number, n1: number, x2: number, n2: number, phi: number): number {
  const [q1, q2] = restrictedMleRatio(x1, n1, x2, n2, phi);
  return term(x1 - n1 * q1, n1 * q1 * (1 - q1)) + term(x2 - n2 * q2, n2 * q2 * (1 - q2));
}

/** Koopman's interval {phi : statistic(phi) <= bound} around est = p1 / p2 (not both counts 0) */
export function ratioScoreLimits(x1: number, n1: number, x2: number, n2: number, bound: number): [number, number] {
  const est = x1 / n1 / (x2 / n2);
  return logScoreLimits(est, bound, (phi) => ratioStatistic(x1, n1, x2, n2, phi));
}

// ---- odds ratio ----

/**
 * The MLE (p1~, p2~) under (p1/(1 - p1)) / (p2/(1 - p2)) = theta: p2~ is the root in [0, 1] of A p^2 + B p + C = 0 with
 * A = n2 (theta - 1), B = n1 theta + n2 - (x1 + x2)(theta - 1), C = -(x1 + x2), written 2(x1 + x2) / (B + sqrt(B^2 - 4AC))
 * (no cancellation, and (x1 + x2) / (n1 + n2) at theta = 1); p1~ = p2~ theta / (1 + p2~ (theta - 1))
 */
export function restrictedMleOddsRatio(x1: number, n1: number, x2: number, n2: number, theta: number): [number, number] {
  const m = x1 + x2;
  const A = n2 * (theta - 1);
  const B = n1 * theta + n2 - m * (theta - 1);
  const q2 = m === 0 ? 0 : Math.min(1, (2 * m) / (B + Math.sqrt(Math.max(0, B * B + 4 * A * m))));
  const q1 = theta === Infinity ? (q2 > 0 ? 1 : 0) : Math.min(1, (q2 * theta) / (1 + q2 * (theta - 1)));
  return [q1, q2];
}

/** The score statistic of the odds ratio at theta: (x1 - n1 p1~)^2 (1/(n1 p1~ q1~) + 1/(n2 p2~ q2~)) */
export function oddsRatioStatistic(x1: number, n1: number, x2: number, n2: number, theta: number): number {
  const [q1, q2] = restrictedMleOddsRatio(x1, n1, x2, n2, theta);
  const dev = x1 - n1 * q1;
  return term(dev, n1 * q1 * (1 - q1)) + term(dev, n2 * q2 * (1 - q2));
}

/** The score interval of the odds ratio around est = x1 (n2 - x2) / ((n1 - x1) x2) (est 0 or Infinity, not NaN) */
export function oddsRatioScoreLimits(x1: number, n1: number, x2: number, n2: number, bound: number): [number, number] {
  const est = (x1 * (n2 - x2)) / ((n1 - x1) * x2);
  return logScoreLimits(est, bound, (theta) => oddsRatioStatistic(x1, n1, x2, n2, theta));
}

/**
 * The roots of stat = bound on both sides of est (where stat is 0), solved on the log scale. Where est is 0 or
 * Infinity (a zero count), that limit is est and the other is solved from a bracket around 1 (logScaleRoot)
 */
function logScoreLimits(est: number, bound: number, stat: (v: number) => number): [number, number] {
  if (bound === 0) return [est, est];
  const target = bounded(bound);
  if (est === 0 || est === Infinity) {
    // stat increases in v from est = 0, and decreases in v towards est = Infinity
    const f = (v: number): number => bounded(stat(v)) - target;
    const f1 = f(1);
    const root = f1 === 0 ? 1 : logScaleRoot(f, est === 0 ? f1 > 0 : f1 < 0);
    return est === 0 ? [0, root] : [root, Infinity];
  }
  const u0 = Math.log(est);
  const g = (u: number): number => (u === u0 ? 0 : bounded(stat(Math.exp(u)))) - target;
  return [logSideRoot(g, u0, -1), logSideRoot(g, u0, 1)];
}
