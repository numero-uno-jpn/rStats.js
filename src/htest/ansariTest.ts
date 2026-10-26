// Ansari-Bradley two-sample test of scale (R's ansari.test), with the confidence interval for the ratio of scales.
//
// Written for rStats.js from the published test (Ansari and Bradley, Ann. Math. Stat. 31, 1960; no ported code).
// Scores min(r, N + 1 - r) of the pooled ranks r (average ranks for ties); the statistic is the sum over the first
// sample. Small samples without ties use the exact null distribution (src/htest/core/ansari.ts); the two-sided
// p-value doubles the tail on the statistic's side of the centre floor((m+1)^2/4) + floor(m n / 2)/2 (the centre
// follows R's ansari.test behaviour). Otherwise the statistic is standardised and compared with the normal, with Ansari
// and Bradley's mean and the variance of a linear rank statistic from the observed sum of squared scores (the form
// scipy.stats.ansari also uses).
//
// Interval and estimate (Bauer, JASA 67, 1972, section 5): with the locations taken as 0, AB(s) is the statistic of
// x / s against y, a step function of the ratio of scales s. Exact: AB(s) is evaluated between consecutive
// candidate ratios x_i / y_j >= 0 (and beyond the largest), and the limits are the candidate ratios where it crosses
// the exact quantiles; the estimate is the midpoint of the crossing of the median. Normal approximation: the limits and
// the estimate are where the standardised AB(s) (standardised as for the test: R 4.5.2's ansari.test) crosses the normal
// quantiles (and 0), found with R's uniroot conventions (tolerance 1e-4) in the range of the ratios of the positive
// values and of the negative values. The candidate sets, evaluation points, search range, tolerance and the cases
// returned as NaN (R's NA) follow R's documented and observed behaviour.

import { pnorm, qnorm } from "../distributions/normal.js";
import { rank } from "../internal/summary.js";
import { uniroot } from "../internal/uniroot.js";
import type { DataFrame } from "../models/modelFrame.js";
import { pansariExact, qansariR } from "./core/ansari.js";
import { twoGroupData } from "./testFormula.js";
import { checkConfLevelOpen, matchAlternative, type Alternative, type HTest, type Sample } from "./types.js";

/**
 * Options for {@link ansariTest}.
 *
 * @category Hypothesis tests
 */
export interface AnsariTestOptions {
  /** Alternative hypothesis (unambiguous abbreviations accepted). Default `"two.sided"`. */
  alternative?: Alternative | "two" | "l" | "g";
  /** Exact p-value. Default: exact when both samples have fewer than 50 values and there are no ties. */
  exact?: boolean;
  /** Compute a confidence interval for the ratio of scales and its estimate (R's `conf.int`). Default `false`. */
  confInt?: boolean;
  /** Confidence level of the interval. Default `0.95`. */
  confLevel?: number;
}

/**
 * Ansari-Bradley test that two samples differ in scale. Equivalent to R's `ansari.test()`.
 * `NaN` values are dropped.
 *
 * With `confInt: true`, `confInt` is the interval for the ratio of the scales of `x` and `y` and `estimate` its
 * estimate, both computed with the locations taken as 0 (exact without ties when both samples have fewer than 50
 * values, otherwise by the normal approximation, whose limits are roots found to a tolerance of 1e-4 as in R). Limits
 * that cannot be formed (the samples differ in location) are `NaN`. With ties and `exact` unset or `true`, R fails
 * ("object 'cint' not found"); rStats.js returns the normal-approximation interval, as with `exact: false`.
 *
 * @example
 * ```ts
 * const r = ansariTest([-2, -1, 1, 2], [-4, -3, 3, 4], { confInt: true });
 * r.confInt;  // [0.25, 0.6666666666666666]
 * r.estimate; // 0.41666666666666663
 * ```
 *
 * There is also a formula form, `ansariTest("y ~ g", data, options)` (next overload).
 *
 * @category Hypothesis tests
 */
export function ansariTest(x: Sample, y: Sample, options?: AnsariTestOptions): HTest;
/**
 * Ansari-Bradley test from a formula and a data frame. As R's `ansari.test(formula, data)`: `"y ~ g"`
 * compares the two levels of `g` (the first level is `x`). Only the variables of the formula count: the rows where
 * one of them is missing are dropped.
 *
 * @param formula `"y ~ g"`.
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 */
export function ansariTest(formula: string, data: DataFrame, options?: AnsariTestOptions): HTest;
export function ansariTest(x: Sample | string, y: Sample | DataFrame, options: AnsariTestOptions = {}): HTest {
  if (typeof x === "string") {
    const d = twoGroupData(x, y as DataFrame);
    return ansariTest(d.x, d.y, options);
  }
  const xs = Array.from(x).filter((v) => !Number.isNaN(v));
  const ys = Array.from(y as Sample).filter((v) => !Number.isNaN(v));
  const m = xs.length;
  const n = ys.length;
  if (m < 1) throw new RangeError("not enough 'x' observations");
  if (n < 1) throw new RangeError("not enough 'y' observations");
  const alternative = matchAlternative(options.alternative);
  const confInt = options.confInt ?? false;
  const confLevel = options.confLevel ?? 0.95;
  if (confInt) checkConfLevelOpen(confLevel);
  const N = m + n;
  const r = rank(xs.concat(ys));
  const a = r.map((v) => Math.min(v, N - v + 1));
  let statistic = 0;
  for (let i = 0; i < m; i++) statistic += a[i]!;
  const ties = new Set(r).size < N;
  const exact = options.exact ?? (m < 50 && n < 50 && !ties);

  let pValue: number;
  let ci: CIPart | undefined;
  if (exact && !ties) {
    const upperFrom = (q: number): number => pansariExact(q - 1, m, n, false); // P(AB >= q)
    const lowerTo = (q: number): number => pansariExact(q, m, n, true); // P(AB <= q)
    if (alternative === "two.sided") {
      // the smaller tail, judged by the position of the statistic against the centre of the distribution (the centre
      // follows R's ansari.test behaviour)
      const centre = Math.floor((m + 1) ** 2 / 4) + Math.floor((m * n) / 2) / 2;
      pValue = Math.min(1, 2 * (statistic > centre ? upperFrom(statistic) : lowerTo(statistic)));
    } else if (alternative === "less") pValue = upperFrom(statistic);
    else pValue = lowerTo(statistic);
    if (confInt) ci = exactInterval(xs, ys, alternative, confLevel);
  } else {
    // mean and variance with the sum of the scores at its value without ties (N (N + 2) / 4 for even N,
    // (N + 1)^2 / 4 for odd N), and the sum of their squares as observed
    let sq = 0;
    for (const v of a) sq += v * v;
    const even = N % 2 === 0;
    const mean = even ? (m * (N + 2)) / 4 : (m * (N + 1) ** 2) / (4 * N);
    const variance = even
      ? (m * n * (16 * sq - N * (N + 2) ** 2)) / (16 * N * (N - 1))
      : (m * n * (16 * N * sq - (N + 1) ** 4)) / (16 * N * N * (N - 1));
    const z = (statistic - mean) / Math.sqrt(variance);
    // large AB means the first sample is concentrated in the middle: smaller scale
    pValue =
      alternative === "two.sided"
        ? 2 * Math.min(pnorm(z), pnorm(z, { lowerTail: false }))
        : alternative === "less"
          ? pnorm(z, { lowerTail: false })
          : pnorm(z);
    if (confInt) ci = normalInterval(xs, ys, alternative, confLevel);
  }
  const result: HTest = {
    method: "Ansari-Bradley test",
    alternative,
    statistic,
    statisticName: "AB",
    pValue,
  };
  if (ci !== undefined) {
    result.confInt = ci.confInt;
    result.confLevel = confLevel;
    result.estimate = ci.estimate;
    result.estimateNames = "ratio of scales";
  }
  result.nullValue = 1;
  result.nullValueName = "ratio of scales";
  return result;
}

interface CIPart {
  confInt: [number, number];
  estimate: number;
}

/** AB statistic of x / s against y, with the scores of all observations and whether there are ties */
function scaledStatistic(xs: readonly number[], ys: readonly number[], s: number): { ab: number; a: number[]; ties: boolean } {
  const m = xs.length;
  const N = m + ys.length;
  const r = rankNaNLast(xs.map((v) => v / s).concat(ys));
  const a = r.map((v) => Math.min(v, N - v + 1));
  let ab = 0;
  for (let i = 0; i < m; i++) ab += a[i]!;
  return { ab, a, ties: new Set(r).size < N };
}

/** Average ranks with NaN (0 / 0 at s = 0) ranked last in order of appearance, as R's rank(na.last = TRUE) */
function rankNaNLast(v: number[]): number[] {
  const keep = v.filter((e) => !Number.isNaN(e));
  if (keep.length === v.length) return rank(v);
  const rk = rank(keep);
  let i = 0;
  let next = keep.length;
  return v.map((e) => (Number.isNaN(e) ? ++next : rk[i++]!));
}

/** One-sided limits at level 1 - 2a for "greater" (lower limit) and "less" (upper limit), two-sided otherwise */
function shapeInterval(alternative: Alternative, a: number, limits: (alpha: number) => [number, number]): [number, number] {
  if (alternative === "two.sided") return limits(a);
  if (alternative === "greater") return [limits(2 * a)[0], Infinity];
  return [0, limits(2 * a)[1]];
}

/** Exact interval and estimate from the candidate ratios x_i / y_j >= 0 */
function exactInterval(xs: readonly number[], ys: readonly number[], alternative: Alternative, confLevel: number): CIPart {
  const m = xs.length;
  const n = ys.length;
  const sigma: number[] = [];
  for (const x of xs) for (const y of ys) if (x / y >= 0) sigma.push(x / y);
  sigma.sort((p, q) => p - q);
  const L = sigma.length;
  if (L === 0) return { confInt: shapeInterval(alternative, 1 - confLevel, () => [NaN, NaN]), estimate: NaN };
  // AB between consecutive candidates, and at 2.01 times the largest
  const abs = sigma.map((v, k) => scaledStatistic(xs, ys, v + (k < L - 1 ? (sigma[k + 1]! - v) / 2 : v * 1.01)).ab);
  // the largest candidate with the smallest positive AB - q (or the smallest with the smallest AB - q >= 0)
  const crossing = (q: number, strict: boolean, largest: boolean): number => {
    let best = Infinity;
    for (const v of abs) if ((strict ? v - q > 0 : v - q >= 0) && v - q < best) best = v - q;
    let out = largest ? -Infinity : Infinity;
    abs.forEach((v, k) => {
      if (v - q === best) out = largest ? Math.max(out, sigma[k]!) : Math.min(out, sigma[k]!);
    });
    return out;
  };
  const limits = (alpha: number): [number, number] => {
    const qLow = qansariR(alpha / 2, m, n);
    const qHigh = qansariR(1 - alpha / 2, m, n);
    if (!abs.some((v) => v - qLow >= 0) || !abs.some((v) => v - qHigh > 0)) return [NaN, NaN];
    const lower = crossing(qLow, false, false);
    const upper = crossing(qHigh, true, true);
    // AB need not be monotone in s: if the limits come out in the wrong order, the quantiles are interchanged
    if (lower > upper) return [crossing(qHigh, false, false), crossing(qLow, true, true)];
    return [lower, upper];
  };
  const confInt = shapeInterval(alternative, 1 - confLevel, limits);
  const qMed = qansariR(0.5, m, n);
  let below = -Infinity;
  let above = Infinity;
  abs.forEach((v, k) => {
    if (v - qMed <= 0) below = Math.max(below, sigma[k]!);
    else above = Math.min(above, sigma[k]!);
  });
  const estimate = below === -Infinity || above === Infinity ? NaN : (above + below) / 2;
  return { confInt, estimate };
}

/** Normal-approximation interval and estimate (undefined when the search range is not finite) */
function normalInterval(
  xs: readonly number[],
  ys: readonly number[],
  alternative: Alternative,
  confLevel: number,
): CIPart | undefined {
  const m = xs.length;
  const n = ys.length;
  const N = m + n;
  const even = N % 2 === 0;
  const z = (s: number, zq: number): number => {
    const { ab, a, ties } = scaledStatistic(xs, ys, s);
    const centred = even ? ab - (m * (N + 2)) / 4 : ab - (m * (N + 1) ** 2) / (4 * N);
    let sd: number;
    if (!ties) {
      sd = even
        ? Math.sqrt((m * n * (N + 2) * (N - 2)) / (48 * (N - 1)))
        : Math.sqrt((m * n * (N + 1) * (3 + N * N)) / (48 * N * N));
    } else {
      let sq = 0;
      for (const v of a) sq += v * v;
      sd = even
        ? Math.sqrt((m * n * (16 * sq - N * (N + 2) ** 2)) / (16 * N * (N - 1)))
        : Math.sqrt((m * n * (16 * N * sq - (N + 1) ** 4)) / (16 * N * N * (N - 1)));
    }
    return centred / sd - zq;
  };
  // search range: the ratios of the positive values, and of the non-positive x to the negative y
  const ends: number[] = [];
  const range = (xp: number[], yp: number[]): void => {
    if (xp.length === 0 || yp.length === 0) return;
    ends.push(Math.min(...xp) / Math.max(...yp), Math.max(...xp) / Math.min(...yp));
  };
  range(
    xs.filter((v) => v > 0),
    ys.filter((v) => v > 0),
  );
  range(
    xs.filter((v) => v <= 0),
    ys.filter((v) => v < 0),
  );
  if (ends.some((v) => !Number.isFinite(v))) return undefined;
  const lo = Math.min(...ends);
  const hi = Math.max(...ends);
  const root = (zq: number): number => uniroot((s) => z(s, zq), lo, hi, { tol: 1e-4 });
  const limits = (alpha: number): [number, number] => {
    const zLow = qnorm(alpha / 2);
    const zHigh = qnorm(alpha / 2, { lowerTail: false });
    if (z(lo, zLow) > 0 || z(hi, zHigh) < 0) return [NaN, NaN];
    const u = root(zLow);
    const l = root(zHigh);
    return u <= l ? [u, l] : [l, u];
  };
  const confInt = shapeInterval(alternative, 1 - confLevel, limits);
  const estimate = z(lo, 0) > 0 || z(hi, 0) < 0 ? NaN : root(0);
  return { confInt, estimate };
}
