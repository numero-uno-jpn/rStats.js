// One-way analysis of variance (the table of R's summary(aov(y ~ g))), Tukey's honest significant differences (R's
// TukeyHSD) and the z test with known standard deviations (BSDA's z.test).
//
// Written for rStats.js from the textbook formulas (no ported code). The sums of squares are accumulated in
// double-double: between groups sum n_i (m_i - m)^2, within groups sum (x - m_i)^2, so a within sum that is exactly
// 0 stays 0 (F = Inf; R's QR leaves rounding residue there). TukeyHSD uses the Tukey-Kramer standard error
// sqrt(MSE / 2 (1/n_i + 1/n_j)) with the studentized range distribution for the interval and the adjusted p-value.

import { pf1 } from "../distributions/f.js";
import { pnorm, qnorm } from "../distributions/normal.js";
import { ptukey, qtukey } from "../distributions/tukey.js";
import { meanDD } from "../internal/summary.js";
import { ddAdd, ddMul, ddSub, type DD } from "../special/dd.js";
import { toGroups, type GroupLabel } from "./groups.js";
import { matchAlternative, type Alternative, type HTest, type Sample } from "./types.js";

/** Result of {@link aov}: the one-way ANOVA table, rows "between groups" and "residuals". */
export interface AovResult {
  /** Degrees of freedom `[k - 1, N - k]`. */
  df: [number, number];
  /** Sums of squares `[between, residual]`. */
  sumSq: [number, number];
  /** Mean squares `[between, residual]`. */
  meanSq: [number, number];
  /** F statistic. */
  fValue: number;
  /** p-value of the F test. */
  pValue: number;
}

function sums(groups: readonly number[][]): { ssb: number; ssw: number; means: number[] } {
  const all = groups.flat();
  const m = meanDD(all);
  let ssb: DD = [0, 0];
  let ssw: DD = [0, 0];
  const means: number[] = [];
  for (const g of groups) {
    const mi = meanDD(g);
    means.push(mi[0]);
    const d = ddSub(mi, m);
    ssb = ddAdd(ssb, ddMul(ddMul(d, d), [g.length, 0]));
    for (const v of g) {
      const e = ddSub([v, 0], mi);
      ssw = ddAdd(ssw, ddMul(e, e));
    }
  }
  return { ssb: ssb[0], ssw: ssw[0], means };
}

/**
 * One-way analysis of variance. Equivalent to the table of R's `summary(aov(y ~ g))` for one factor.
 *
 * @param x An array of samples (groups), or one sample with group labels `g`.
 * @param g Group labels, parallel to `x`.
 *
 * @example
 * ```ts
 * const r = aov([[2.9, 3.0, 2.5, 2.6, 3.2], [3.8, 2.7, 4.0, 2.4], [2.8, 3.4, 3.7, 2.2, 2.0]]);
 * r.fValue; // 0.5600732600732597
 * r.pValue; // 0.586632991041738
 * ```
 */
export function aov(x: Sample | readonly Sample[], g?: readonly GroupLabel[]): AovResult {
  const groups = toGroups(x, g);
  const k = groups.length;
  if (k < 2) throw new RangeError("contrasts can be applied only to factors with 2 or more levels");
  const N = groups.reduce((a, s) => a + s.length, 0);
  const { ssb, ssw } = sums(groups);
  const df1 = k - 1;
  const df2 = N - k;
  const msb = ssb / df1;
  const msw = ssw / df2;
  const fValue = msb / msw;
  return {
    df: [df1, df2],
    sumSq: [ssb, ssw],
    meanSq: [msb, msw],
    fValue,
    pValue: df2 > 0 ? pf1(fValue, df1, df2, false, false) : NaN,
  };
}

/** Options for {@link TukeyHSD}. */
export interface TukeyHSDOptions {
  /** Family-wise confidence level. Default `0.95`. */
  confLevel?: number;
}

/** Result of {@link TukeyHSD}: one entry per pair of groups, in R's order (2-1, 3-1, ..., k-1, 3-2, ...). */
export interface TukeyHSDResult {
  /** Labels of the comparisons, `"i-j"` (group numbers from 1, or the labels when given). */
  names: string[];
  /** The group compared (1-based index, i > j). */
  i: number[];
  /** The group it is compared with (1-based index). */
  j: number[];
  /** Difference of means, group i minus group j. */
  diff: number[];
  /** Lower ends of the simultaneous intervals. */
  lwr: number[];
  /** Upper ends. */
  upr: number[];
  /** p-values adjusted for the multiple comparisons. */
  pAdj: number[];
}

/**
 * Tukey's honest significant differences between the group means of a one-way ANOVA (Tukey-Kramer for unequal
 * sizes). Equivalent to R's `TukeyHSD(aov(y ~ g))`.
 *
 * @param x An array of samples (groups), or one sample with group labels `g` (then `options` comes third).
 */
export function TukeyHSD(
  x: Sample | readonly Sample[],
  g?: readonly GroupLabel[] | TukeyHSDOptions,
  options: TukeyHSDOptions = {},
): TukeyHSDResult {
  let labels: readonly GroupLabel[] | undefined;
  if (g !== undefined && !Array.isArray(g)) options = g as TukeyHSDOptions;
  else labels = g as readonly GroupLabel[] | undefined;
  const groups = toGroups(x, labels);
  const k = groups.length;
  if (k < 2) throw new RangeError("contrasts can be applied only to factors with 2 or more levels");
  const confLevel = options.confLevel ?? 0.95;
  const names = labels === undefined ? groups.map((_, i) => String(i + 1)) : [...new Set(labels)].sort().map(String);
  const N = groups.reduce((a, s) => a + s.length, 0);
  const df = N - k;
  const { ssw, means } = sums(groups);
  const mse = ssw / df;
  const q = qtukey(confLevel, k, df);
  const out: TukeyHSDResult = { names: [], i: [], j: [], diff: [], lwr: [], upr: [], pAdj: [] };
  for (let b = 0; b < k - 1; b++) {
    for (let a = b + 1; a < k; a++) {
      const diff = means[a]! - means[b]!;
      const se = Math.sqrt((mse / 2) * (1 / groups[a]!.length + 1 / groups[b]!.length));
      out.names.push(`${names[a]}-${names[b]}`);
      out.i.push(a + 1);
      out.j.push(b + 1);
      out.diff.push(diff);
      out.lwr.push(diff - q * se);
      out.upr.push(diff + q * se);
      out.pAdj.push(ptukey(Math.abs(diff) / se, k, df, { lowerTail: false }));
    }
  }
  return out;
}

/** Options for {@link zTest}. */
export interface ZTestOptions {
  /** Known standard deviation of the population of `x` (required). */
  sigmaX?: number;
  /** Known standard deviation of the population of `y` (required with `y`). */
  sigmaY?: number;
  /** Mean (or difference of means) under the null hypothesis. Default `0`. */
  mu?: number;
  /** Alternative hypothesis (unambiguous abbreviations accepted). Default `"two.sided"`. */
  alternative?: Alternative | "two" | "l" | "g";
  /** Confidence level of the interval. Default `0.95`. */
  confLevel?: number;
}

/**
 * z test for the mean of one sample, or the difference of the means of two, with known standard deviations.
 * Equivalent to `BSDA::z.test()` (the open end of a one-sided interval is ±Infinity here, NA in BSDA). `NaN` values
 * are dropped.
 *
 * @example
 * ```ts
 * zTest([5.1, 4.9, 5.6, 5.8, 6.0], { mu: 5, sigmaX: 0.5 }).pValue;
 * ```
 */
export function zTest(x: Sample, y?: Sample | ZTestOptions, options: ZTestOptions = {}): HTest {
  let ys: number[] | undefined;
  if (y !== undefined && !Array.isArray(y) && !ArrayBuffer.isView(y)) options = y as ZTestOptions;
  else if (y !== undefined) ys = Array.from(y as Sample).filter((v) => !Number.isNaN(v));
  const { sigmaX, sigmaY } = options;
  if (sigmaX === undefined && ys === undefined) throw new RangeError("You must enter the value for sigma.x");
  if (sigmaX === undefined || (ys !== undefined && sigmaY === undefined)) {
    throw new RangeError("You must enter values for both sigma.x and sigma.y");
  }
  const mu = options.mu ?? 0;
  if (Number.isNaN(mu)) throw new RangeError("mu must be a single number");
  const alternative = matchAlternative(options.alternative);
  const confLevel = options.confLevel ?? 0.95;
  if (!(confLevel >= 0 && confLevel <= 1)) throw new RangeError("conf.level must be a number between 0 and 1");
  const xs = Array.from(x).filter((v) => !Number.isNaN(v));
  if (xs.length <= 2) throw new RangeError("not enough x observations");
  const mx = meanDD(xs)[0];
  let stderr: number;
  let z: number;
  let estimate: number | number[];
  let estimateNames: string | string[];
  if (ys === undefined) {
    stderr = sigmaX / Math.sqrt(xs.length);
    z = (mx - mu) / stderr;
    estimate = mx;
    estimateNames = "mean of x";
  } else {
    if (ys.length <= 2) throw new RangeError("not enough y observations");
    const my = meanDD(ys)[0];
    stderr = Math.sqrt(sigmaX ** 2 / xs.length + sigmaY! ** 2 / ys.length);
    z = (mx - my - mu) / stderr;
    estimate = [mx, my];
    estimateNames = ["mean of x", "mean of y"];
  }
  let pValue: number;
  let confInt: [number, number];
  if (alternative === "less") {
    pValue = pnorm(z);
    confInt = [-Infinity, z * stderr + qnorm(confLevel) * stderr + mu];
  } else if (alternative === "greater") {
    pValue = pnorm(z, { lowerTail: false });
    confInt = [z * stderr - qnorm(confLevel) * stderr + mu, Infinity];
  } else {
    pValue = 2 * pnorm(-Math.abs(z));
    const c = qnorm(1 - (1 - confLevel) / 2);
    confInt = [z * stderr - c * stderr + mu, z * stderr + c * stderr + mu];
  }
  return {
    method: ys === undefined ? "One-sample z-Test" : "Two-sample z-Test",
    alternative,
    statistic: z,
    statisticName: "z",
    pValue,
    confInt,
    confLevel,
    estimate,
    estimateNames,
    nullValue: mu,
    nullValueName: ys === undefined ? "mean" : "difference in means",
  };
}
