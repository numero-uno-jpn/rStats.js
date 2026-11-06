// Score statistics of two independent binomial proportions x1/n1 and x2/n2 under a restriction (a given difference,
// ratio or odds ratio), and the roots that make their confidence limits. Shared by binomDiffCI, binomRatioCI and
// oddsRatio (src/htest/twoByTwo.ts); the statistics at a given difference are what a test of equivalence uses.
//
// Written for rStats.js from the papers:
// - Difference: the maximum likelihood estimate under p1 - p2 = delta, the root of the score equation of Farrington
//   and Manning (Statistics in Medicine 9, 1990, 1447-1454) started from the closed (trigonometric) form of their
//   cubic, and the statistic
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
import { ddAdd, ddDivNum, ddMul, ddMulNum, ddSub, twoProd } from "../../special/dd.js";

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
 * Whether the counts are taken as failures (x -> n - x, delta -> -delta, each proportion -> 1 - p): where
 * p1 + p2 > 1, so that the proportions worked with are the smaller ones. The statistics are the same in either
 * orientation, but x / n near 1 holds only the absolute precision eps (1 - (1e15 - 1)/1e15 is 1e-15 off by 5%), and so
 * does 1 - p~ formed from a p~ near 1
 */
function failures(x1: number, n1: number, x2: number, n2: number): boolean {
  return x1 / n1 + x2 / n2 > 1;
}

/** p1 - p2, rounded once (diffDeviation at 0) */
export function diffEstimate(x1: number, n1: number, x2: number, n2: number): number {
  return diffDeviation(x1, n1, x2, n2, 0);
}

/**
 * The maximum likelihood estimate of two proportions under p1 - p2 = delta (-1 <= delta <= 1) with the complements:
 * [p1~, 1 - p1~, p2~, 1 - p2~], each to nearly the precision of the doubles.
 *
 * The estimate is the root of the score equation (Farrington and Manning 1990). With s the smaller of p1~ and p2~
 * (group s, xs of ns) and D = |delta|, the other is s + D (group l) and
 *   f(s) = xs/s - (ns - xs)/(1 - s) + xl/(s + D) - (nl - xl)/(1 - D - s) = 0,  0 <= s <= 1 - D,
 * f decreasing; s = 0 where f(0) <= 0 and s = 1 - D where f(1 - D) >= 0. Solved by Newton's method kept inside the
 * bracket by bisection (geometric where the bracket spans more than a factor 2), from the trigonometric solution of
 * Farrington and Manning's cubic. That closed form alone has only the absolute precision eps: 4.337e-9 for 2.713e-9
 * at 5/1e9 against 2/1e9 and delta = -1e-8, and the upper limit of 1/1e8 against 0/1e8 was 4e-3 relative off. Working
 * with s and D (not p1~ - delta, nor 1 - p near 1: see `failures`) keeps the relative precision of small proportions
 */
function restrictedMleDiffFull(x1: number, n1: number, x2: number, n2: number, delta: number): [number, number, number, number] {
  if (failures(x1, n1, x2, n2)) {
    const [q1, r1, q2, r2] = restrictedMleDiffFull(n1 - x1, n1, n2 - x2, n2, -delta);
    return [r1, q1, r2, q2];
  }
  // group s has the smaller restricted proportion: group 1 where delta <= 0 (p1~ = p2~ + delta)
  const oneSmaller = delta <= 0;
  const [xs, ns, xl, nl] = oneSmaller ? [x1, n1, x2, n2] : [x2, n2, x1, n1];
  const D = Math.abs(delta);
  // 1 - D: exact for D >= 1/2, within half an ulp of a value above 1/2 otherwise
  const top = 1 - D;
  let s = 0;
  if (top > 0) {
    const f = (v: number): number => {
      let r = 0;
      if (xs > 0) r += xs / v;
      if (xs < ns) r -= (ns - xs) / (1 - v);
      if (xl > 0) r += xl / (v + D);
      if (xl < nl) r -= (nl - xl) / (top - v);
      return r;
    };
    const df = (v: number): number => {
      let r = 0;
      if (xs > 0) r -= xs / (v * v);
      if (xs < ns) r -= (ns - xs) / ((1 - v) * (1 - v));
      if (xl > 0) r -= xl / ((v + D) * (v + D));
      if (xl < nl) r -= (nl - xl) / ((top - v) * (top - v));
      return r;
    };
    // at the ends f is finite or +Infinity at 0 and -Infinity at 1 - D (only positive terms divide by 0 at 0, and only
    // negative ones at 1 - D)
    const f0 = f(0);
    if (f0 <= 0) s = 0;
    else if (f(top) >= 0) s = top;
    else {
      let a = 0;
      let b = top;
      const guess = closedFormMleDiff(x1, n1, x2, n2, delta);
      s = oneSmaller ? guess : guess - delta;
      if (!(s > a && s < b)) s = b / 2;
      for (let i = 0; i < 2000; i++) {
        const fs = f(s);
        if (fs === 0) break;
        if (fs > 0) a = s;
        else b = s;
        let next = s - fs / df(s);
        if (!(next > a && next < b)) next = a === 0 ? b / 2 : b > 2 * a ? Math.sqrt(a * b) : a + (b - a) / 2;
        if (!(next > a && next < b)) break;
        const step = Math.abs(next - s);
        s = next;
        if (step <= 2 ** -53 * s) break;
      }
    }
  }
  const sl: [number, number, number, number] = [s, 1 - s, Math.min(1, s + D), Math.max(0, top - s)];
  return oneSmaller ? sl : [sl[2], sl[3], sl[0], sl[1]];
}

/**
 * The trigonometric solution of Farrington and Manning's cubic for p1~ under p1 - p2 = delta, with t = n2 / n1:
 * a = 1 + t, b = -(1 + t + p1 + t p2 + delta (t + 2)), c = delta^2 + delta (2 p1 + t + 1) + p1 + t p2,
 * d = -p1 delta (1 + delta); v = (b/(3a))^3 - bc/(6a^2) + d/(2a), u = sign(v) sqrt((b/(3a))^2 - c/(3a)),
 * w = (pi + acos(v/u^3))/3, p1~ = 2u cos(w) - b/(3a). Accurate to about eps absolute: the start of the iteration
 */
function closedFormMleDiff(x1: number, n1: number, x2: number, n2: number, delta: number): number {
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
  if (u === 0) return -b3a;
  const w = (Math.PI + Math.acos(Math.max(-1, Math.min(1, v / (u * u * u))))) / 3;
  return 2 * u * Math.cos(w) - b3a;
}

/** The maximum likelihood estimate (p1~, p2~) of two proportions under p1 - p2 = delta (see restrictedMleDiffFull) */
export function restrictedMleDiff(x1: number, n1: number, x2: number, n2: number, delta: number): [number, number] {
  const [q1, , q2] = restrictedMleDiffFull(x1, n1, x2, n2, delta);
  return [q1, q2];
}

/** How the variance of p1 - p2 is formed at a given difference */
export type DiffVariance = "mn" | "mee" | "wald";

/**
 * The variance of p1 - p2 used by the score statistic at the difference delta: at the restricted MLE times N/(N - 1)
 * (Miettinen-Nurminen, "mn"), at the restricted MLE ("mee", Farrington-Manning), or at the observed proportions
 * ("wald"); each 1 - p without cancellation
 */
export function diffVariance(x1: number, n1: number, x2: number, n2: number, delta: number, kind: DiffVariance): number {
  if (kind === "wald") return ((x1 / n1) * ((n1 - x1) / n1)) / n1 + ((x2 / n2) * ((n2 - x2) / n2)) / n2;
  const [q1, r1, q2, r2] = restrictedMleDiffFull(x1, n1, x2, n2, delta);
  const v = (q1 * r1) / n1 + (q2 * r2) / n2;
  if (kind === "mee") return v;
  const N = n1 + n2;
  return (v * N) / (N - 1);
}

/**
 * (p1 - p2 - delta)^2 - bound var(delta) in double-double (the score methods): its sign tells statistic > bound
 * without the roundings of the statistic (a few ulps of it, each moving a limit by about an ulp)
 */
function diffExcess(x1: number, n1: number, x2: number, n2: number, delta: number, kind: "mn" | "mee", bound: number): number {
  const dev = ddSub(ddSub(ddDivNum([x1, 0], n1), ddDivNum([x2, 0], n2)), [delta, 0]);
  const [q1, r1, q2, r2] = restrictedMleDiffFull(x1, n1, x2, n2, delta);
  let v = ddAdd(ddDivNum(twoProd(q1, r1), n1), ddDivNum(twoProd(q2, r2), n2));
  if (kind === "mn") v = ddDivNum(ddMulNum(v, n1 + n2), n1 + n2 - 1);
  return ddSub(ddMul(dev, dev), ddMulNum(v, bound))[0];
}

/**
 * p1 - p2 - delta from the counts in double-double, rounded once: x1/n1 - x2/n2 in double cancels where the
 * proportions are close (each holds only its absolute precision: 1 - (1e15 - 1)/1e15 is 1e-15 off by 5%, and
 * 0.22 - 0.2 is 1e-17 off, an ulp of the limit 0.1155 of 80/100 against 78/100 at 90%)
 */
export function diffDeviation(x1: number, n1: number, x2: number, n2: number, delta: number): number {
  return ddSub(ddSub(ddDivNum([x1, 0], n1), ddDivNum([x2, 0], n2)), [delta, 0])[0];
}

/** The squared score statistic (p1 - p2 - delta)^2 / var(delta); 0 at delta = p1 - p2, Infinity where var is 0 */
export function diffStatistic(x1: number, n1: number, x2: number, n2: number, delta: number, kind: DiffVariance): number {
  return term(diffDeviation(x1, n1, x2, n2, delta), diffVariance(x1, n1, x2, n2, delta, kind));
}

const f64 = new Float64Array(1);
const i64 = new BigInt64Array(f64.buffer);

/** The neighbouring double of a finite x above (up) or below it */
function nextDouble(x: number, up: boolean): number {
  if (x === 0) return up ? Number.MIN_VALUE : -Number.MIN_VALUE;
  f64[0] = x;
  i64[0]! += (x > 0) === up ? 1n : -1n;
  return f64[0];
}

/**
 * The double next to the sign change of g (increasing where `increasing`) within [lo, hi], from Brent's root r: Brent
 * stops once its bracket is within 4 eps |r|, which left limits up to 4 ulps from the sign change (0.11553638647686573
 * for 0.11553638647686568). Walks from r towards the change by single ulps (a few steps) and returns the double of the
 * two at the change with the smaller |g|
 */
function polishRoot(g: (x: number) => number, r: number, lo: number, hi: number, increasing: boolean): number {
  let x = r;
  let gx = g(x);
  if (gx === 0) return x;
  // g(x) > 0 on the increasing side means the change lies below x
  const up = (gx < 0) === increasing;
  for (let i = 0; i < 64; i++) {
    const y = nextDouble(x, up);
    if (!(y >= lo && y <= hi)) return x;
    const gy = g(y);
    if (gy === 0) return y;
    if (gy < 0 !== gx < 0) return Math.abs(gy) < Math.abs(gx) ? y : x;
    x = y;
    gx = gy;
  }
  return x;
}

/**
 * The limits [lower, upper] of {delta in [-1, 1] : statistic(delta) <= bound} around est = p1 - p2: the roots of
 * statistic = bound below and above est (-1 or 1 where est is at the end)
 */
export function diffScoreLimits(x1: number, n1: number, x2: number, n2: number, bound: number, kind: DiffVariance): [number, number] {
  const est = diffEstimate(x1, n1, x2, n2);
  if (bound === 0) return [est, est];
  const target = bounded(bound);
  const g = (delta: number): number => (delta === est ? 0 : bounded(diffStatistic(x1, n1, x2, n2, delta, kind))) - target;
  const root = (lo: number, hi: number, gLo: number, gHi: number): number => {
    if (gLo === 0) return lo;
    if (gHi === 0) return hi;
    const r = uniroot(g, lo, hi, { tol: 1e-300, fLower: gLo, fUpper: gHi });
    return kind === "wald" ? r : polishRoot((d) => diffExcess(x1, n1, x2, n2, d, kind, bound), r, lo, hi, gLo < 0);
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
