// One-way analysis of variance (the table of R's summary(aov(y ~ g))), aov from a model formula (the fit of
// src/models/lm.ts; its table is aovSummary in src/models/anovaSequential.ts), Tukey's honest significant differences (R's
// TukeyHSD) and the z test with known standard deviations (as BSDA's z.test).
//
// Written for rStats.js from the textbook formulas. The sums of squares are accumulated in
// double-double: between groups sum n_i (m_i - m)^2, within groups sum (x - m_i)^2, so a within sum that is exactly
// 0 stays 0 (F = Inf; R's QR leaves rounding residue there). TukeyHSD uses the Tukey-Kramer standard error
// sqrt(MSE / 2 (1/n_i + 1/n_j)) with the studentized range distribution for the interval and the adjusted p-value.
// zTest is the textbook z test (standard error sigma / sqrt(n), or sqrt(sigma_x^2/n_x + sigma_y^2/n_y) for two
// samples, normal quantiles for the interval around the estimate); its input checks (at least 3 observations,
// confLevel allowed in the closed [0, 1]) follow BSDA's documented/observed behaviour, with messages of our own.

import { pf1 } from "../distributions/f.js";
import { pnorm, qnorm } from "../distributions/normal.js";
import { ptukey, qtukey } from "../distributions/tukey.js";
import { meanDD } from "../internal/summary.js";
import { ddAdd, ddMul, ddSub, type DD } from "../special/dd.js";
import { parseFormula, splitErrorTerms } from "../models/formula.js";
import { aovStrataFit, type AovStrataFit } from "../models/aovStrata.js";
import { lmFormulaFit, type LmFormulaOptions, type LmFormulaResult } from "../models/lm.js";
import type { DataFrame } from "../models/modelFrame.js";
import { design } from "../models/modelMatrix.js";
import { labelledGroups, toGroups, type GroupLabel } from "./groups.js";
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
 * One-way analysis of variance. Equivalent to R's `aov()`. Gives the table of R's `summary(aov(y ~ g))` for one
 * factor.
 *
 * @param x An array of samples (groups), or one sample with group labels `g`.
 * @param g Group labels, parallel to `x`.
 *
 * @example
 * ```ts
 * const r = aov([[2.9, 3.0, 2.5, 2.6, 3.2], [3.8, 2.7, 4.0, 2.4], [2.8, 3.4, 3.7, 2.2, 2.0]]);
 * r.fValue; // 0.56007326007326
 * r.pValue; // 0.586632991041738
 * ```
 */
export function aov(x: Sample | readonly Sample[], g?: readonly GroupLabel[]): AovResult;
/**
 * Analysis of variance from a model formula, as R's `aov(formula, data)` (with `weights` and
 * `contrasts`): the same fit as {@link lm} with a formula; {@link aovSummary} gives the table of R's
 * `summary(aov(...))`. With one `Error()` term (`y ~ W + Error(id/W)`) the fit has error strata: the result is an
 * {@link AovStrataFit} whose tables {@link aovSummary} returns, one per stratum.
 *
 * @param formula A formula such as `"y ~ A * B"`.
 * @param data The data frame: an object of columns.
 *
 * @example
 * ```ts
 * const fit = aov("y ~ g", { y: [4.2, 5.1, 6.3, 5.8, 7.9, 8.4], g: ["a", "a", "b", "b", "c", "c"] });
 * aovSummary(fit).rowNames; // ["g", "Residuals"]
 * ```
 */
export function aov(formula: string, data: DataFrame, options?: LmFormulaOptions): LmFormulaResult | AovStrataFit;
export function aov(
  x: string | Sample | readonly Sample[],
  g?: readonly GroupLabel[] | DataFrame,
  options: LmFormulaOptions = {},
): AovResult | LmFormulaResult | AovStrataFit {
  if (typeof x === "string") return aovFormula(x, g as DataFrame, options);
  return aovOneway(x, g as readonly GroupLabel[] | undefined);
}

/** aov from a formula (without Error() strata) */
function aovFormula(formula: string, data: DataFrame, options: LmFormulaOptions): LmFormulaResult | AovStrataFit {
  const parsed = parseFormula(formula, true);
  const { treatment, errors } = splitErrorTerms(parsed.rhs);
  if (errors.length > 1) throw new Error(`there are ${errors.length} Error terms: only 1 is allowed`);
  if (errors.length === 1) return aovStrataFit(formula, parsed, treatment, errors[0]!, data, options);
  return lmFormulaFit(formula, design(parsed, data, { ...options, dropUnusedLevels: true }, treatment), true);
}

function aovOneway(x: Sample | readonly Sample[], g?: readonly GroupLabel[]): AovResult {
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
  /**
   * Labels of the comparisons, `"a-b"`: the group labels when given, otherwise the positions of the samples in the
   * list (from 1). Groups without data are left out, as in R.
   */
  names: string[];
  /** The group compared (1-based position among the groups compared, i > j). */
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
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * const r = TukeyHSD(x, g);
 * r.names; // ["b-a", "c-a", "c-b"]
 * r.diff;  // [1.4333333333333336, 2.7666666666666666, 1.333333333333333]
 * r.pAdj;  // [0.03403130149294014, 0.001492661804896774, 0.04527523376597547]
 * ```
 */
export function TukeyHSD(
  x: Sample | readonly Sample[],
  g?: readonly GroupLabel[] | TukeyHSDOptions,
  options: TukeyHSDOptions = {},
): TukeyHSDResult {
  let labels: readonly GroupLabel[] | undefined;
  if (g !== undefined && !Array.isArray(g)) options = g as TukeyHSDOptions;
  else labels = g as readonly GroupLabel[] | undefined;
  // names follow the groups: a label (or list position) whose values are all missing has no group, as R drops the
  // unused factor level
  const { labels: names, groups } = labelledGroups(x, labels);
  const k = groups.length;
  if (k < 2) throw new RangeError("contrasts can be applied only to factors with 2 or more levels");
  const confLevel = options.confLevel ?? 0.95;
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
 * Equivalent to `BSDA::z.test()` in R. The open end of a one-sided interval is ±Infinity here (NA in BSDA). `NaN`
 * values are dropped.
 *
 * @example
 * ```ts
 * zTest([5.1, 4.9, 5.6, 5.8, 6.0], { mu: 5, sigmaX: 0.5 }).pValue; // 0.031823127386490346
 * ```
 */
export function zTest(x: Sample, y?: Sample | ZTestOptions, options: ZTestOptions = {}): HTest {
  let ys: Sample | undefined;
  if (y !== undefined && !ArrayBuffer.isView(y) && !Array.isArray(y)) options = y as ZTestOptions;
  else ys = y as Sample | undefined;
  const { sigmaX, sigmaY } = options;
  const mu = options.mu ?? 0;
  if (sigmaX === undefined && ys === undefined) throw new RangeError("sigmaX (the known standard deviation of x) is required");
  if (sigmaX === undefined || (ys !== undefined && sigmaY === undefined)) {
    throw new RangeError("sigmaX and sigmaY are both required for two samples");
  }
  if (Number.isNaN(mu)) throw new RangeError("mu must be a number");
  const alternative = matchAlternative(options.alternative);
  const confLevel = options.confLevel ?? 0.95;
  if (!(confLevel >= 0 && confLevel <= 1)) throw new RangeError("confLevel must be between 0 and 1");
  const xs = Array.from(x).filter((v) => !Number.isNaN(v));
  const yv = ys === undefined ? undefined : Array.from(ys).filter((v) => !Number.isNaN(v));
  if (xs.length < 3) throw new RangeError("x needs at least 3 non-missing values");
  if (yv !== undefined && yv.length < 3) throw new RangeError("y needs at least 3 non-missing values");

  const meanX = meanDD(xs)[0];
  const meanY = yv === undefined ? NaN : meanDD(yv)[0];
  const se =
    yv === undefined ? sigmaX / Math.sqrt(xs.length) : Math.sqrt(sigmaX ** 2 / xs.length + sigmaY! ** 2 / yv.length);
  const target = yv === undefined ? meanX : meanX - meanY;
  const z = (target - mu) / se;

  let pValue: number;
  let confInt: [number, number];
  if (alternative === "less") {
    pValue = pnorm(z);
    confInt = [-Infinity, target + qnorm(confLevel) * se];
  } else if (alternative === "greater") {
    pValue = pnorm(z, { lowerTail: false });
    confInt = [target - qnorm(confLevel) * se, Infinity];
  } else {
    pValue = 2 * pnorm(-Math.abs(z));
    const half = qnorm(1 - (1 - confLevel) / 2) * se;
    confInt = [target - half, target + half];
  }
  const twoSample = yv !== undefined;
  return {
    method: twoSample ? "Two-sample z-Test" : "One-sample z-Test",
    alternative,
    statistic: z,
    statisticName: "z",
    pValue,
    confInt,
    confLevel,
    estimate: twoSample ? [meanX, meanY] : meanX,
    estimateNames: twoSample ? ["mean of x", "mean of y"] : "mean of x",
    nullValue: mu,
    nullValueName: twoSample ? "difference in means" : "mean",
  };
}
