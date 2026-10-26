// Tests for a trend: the chi-squared test for trend in proportions (R's prop.trend.test) and the Jonckheere-Terpstra
// test for ordered alternatives (DescTools' JonckheereTerpstraTest and clinfun's jonckheere.test).
//
// Written for rStats.js from oracle/rm-tests-behaviour.md (no ported code; the source of R, DescTools and clinfun was
// not read):
// - prop.trend.test: the weighted regression sum of squares of the proportions on the scores, with weights
//   n_i / (p (1 - p)), chi-squared with 1 degree of freedom.
// - Jonckheere-Terpstra: JT is the sum over ordered pairs of groups of the Mann-Whitney counts (ties count 1/2). Its
//   exact null distribution is the convolution of the Mann-Whitney distributions of each group against all later
//   groups; the normal approximation uses mean sum n_i m_i / 2 and variance sum n_i m_i (n_i + m_i + 1) / 12 (m_i the
//   number of observations after group i; no tie correction).

import { pgamma1 } from "../distributions/gamma.js";
import { pnorm } from "../distributions/normal.js";
import { dwilcox1 } from "../distributions/wilcox.js";
import { compareCodePoints } from "../models/modelFrame.js";
import type { GroupLabel } from "./groups.js";
import { matchChoice } from "./power.js";
import type { HTest, Sample } from "./types.js";

/** Result of {@link propTrendTest}: no `alternative`, as R returns none. */
export interface PropTrendTestResult extends Omit<HTest, "alternative"> {
  /** Degrees of freedom (1). */
  parameter: number;
}

/**
 * Chi-squared test for trend in proportions. Equivalent to R's `prop.trend.test(x, n, score)`.
 *
 * @param x Numbers of events.
 * @param n Numbers of trials.
 * @param score Scores of the groups. Default `1, 2, ..., k`.
 *
 * @example
 * ```ts
 * propTrendTest([15, 10, 8, 4], [30, 30, 30, 30]).statistic; // 9.573428850537288
 * ```
 */
export function propTrendTest(x: Sample, n: Sample, score?: Sample): PropTrendTestResult {
  const xs = Array.from(x);
  const ns = Array.from(n);
  const k = xs.length;
  const s = score === undefined ? xs.map((_, i) => i + 1) : Array.from(score);
  if (ns.length !== k || s.length !== k) throw new RangeError("'x', 'n' and 'score' must have the same length");
  const p = xs.reduce((a, v) => a + v, 0) / ns.reduce((a, v) => a + v, 0);
  const w = ns.map((v) => v / (p * (1 - p)));
  const f = xs.map((v, i) => v / ns[i]!);
  const sw = w.reduce((a, v) => a + v, 0);
  const sBar = w.reduce((a, wi, i) => a + wi * s[i]!, 0) / sw;
  const fBar = w.reduce((a, wi, i) => a + wi * f[i]!, 0) / sw;
  let sxy = 0;
  let sxx = 0;
  w.forEach((wi, i) => {
    const ds = s[i]! - sBar;
    sxy += wi * ds * (f[i]! - fBar);
    sxx += wi * ds * ds;
  });
  const statistic = (sxy * sxy) / sxx;
  return {
    method: "Chi-squared Test for Trend in Proportions",
    statistic,
    statisticName: "X-squared",
    parameter: 1,
    parameterName: "df",
    pValue: pgamma1(statistic, 0.5, 2, false, false),
  };
}

/** Alternative of {@link jonckheereTest}. */
export type JonckheereAlternative = "two.sided" | "increasing" | "decreasing";

/** Options for {@link jonckheereTest}. */
export interface JonckheereTestOptions {
  /** `"two.sided"` (default), `"increasing"` or `"decreasing"` (unambiguous abbreviations accepted). */
  alternative?: JonckheereAlternative | (string & {});
  /**
   * The exact p-value (`"DescTools"` only). Default: exact when there are no ties and at most 100 observations. With
   * ties the normal approximation is used anyway, with a warning.
   */
  exact?: boolean;
  /** `"DescTools"` (default: `JonckheereTerpstraTest`) or `"clinfun"` (`jonckheere.test`). */
  variant?: "DescTools" | "clinfun";
  /** The order of the groups. Default: the labels sorted (numbers as numbers, strings by code point). */
  levels?: readonly GroupLabel[];
}

/** Result of {@link jonckheereTest}. */
export interface JonckheereTestResult extends Omit<HTest, "alternative"> {
  /** Alternative hypothesis: `"two.sided"`, `"increasing"` or `"decreasing"`. */
  alternative: JonckheereAlternative;
  /** The packages' warnings (normal approximation). */
  warnings: string[];
}

const NOT_EXACT = "Sample size > 100 or data with ties \n p-value based on normal approximation. Specify nperm for permutation p-value";
const TIES = "Sample data with ties \n p-value based on normal approximation. Specify nperm for permutation p-value.";

/** The groups in order: the labels sorted (numbers as numbers, strings by code point) or as `levels` */
function orderedGroups(x: Sample, g: readonly GroupLabel[], levels: readonly GroupLabel[] | undefined): number[][] {
  const xs = Array.from(x);
  if (xs.length !== g.length) throw new RangeError("'x' and 'g' must have the same length");
  const keep = xs.flatMap((v, i) => (Number.isNaN(v) || (typeof g[i] === "number" && Number.isNaN(g[i])) ? [] : [i]));
  let order: string[];
  if (levels !== undefined) order = levels.map(String);
  else {
    const distinct = [...new Set(keep.map((i) => g[i]!))];
    order = distinct.every((l) => typeof l === "number")
      ? (distinct as number[]).sort((a, b) => a - b).map(String)
      : [...new Set(distinct.map(String))].sort(compareCodePoints);
  }
  const groups = order.map((): number[] => []);
  const index = new Map(order.map((l, k) => [l, k]));
  for (const i of keep) {
    const k = index.get(String(g[i]!));
    if (k === undefined) throw new RangeError(`the group '${String(g[i])}' is not among 'levels'`);
    groups[k]!.push(xs[i]!);
  }
  return groups;
}

/**
 * Jonckheere-Terpstra test of equal distributions against ordered alternatives. Equivalent to
 * `DescTools::JonckheereTerpstraTest()` in R. Computes `JonckheereTerpstraTest(x, g, alternative, exact)` (with `g`
 * an ordered factor) or, with `variant: "clinfun"`, clinfun's `jonckheere.test(x, g, alternative)` (whose
 * two-sided p-value is `2 min(p_increasing, p_decreasing, 0.5)`; DescTools caps it at 1 instead of 0.5). Pairs with a missing value are dropped.
 *
 * @param x The values.
 * @param g Group labels, parallel to `x`, in the order of the alternative.
 *
 * @example
 * ```ts
 * jonckheereTest([1.1, 2.0, 2.4, 3.5, 3.1, 4.6], [1, 1, 2, 2, 3, 3], { alternative: "increasing" }).statistic; // 11
 * ```
 */
export function jonckheereTest(x: Sample, g: readonly GroupLabel[], options: JonckheereTestOptions = {}): JonckheereTestResult {
  const alternative = matchChoice(options.alternative, ["two.sided", "increasing", "decreasing"] as const);
  const variant = options.variant ?? "DescTools";
  if (variant !== "DescTools" && variant !== "clinfun") throw new RangeError(`invalid variant "${String(variant)}"`);
  if (variant === "clinfun" && options.exact !== undefined) throw new TypeError("clinfun's jonckheere.test has no option 'exact'");
  const groups = orderedGroups(x, g, options.levels);
  const all = groups.flat();
  const nTotal = all.length;
  const ties = new Set(all).size < nTotal;
  // JT, and the sizes n_i and m_i (observations after group i)
  let jt = 0;
  const sizes: [number, number][] = [];
  let after = nTotal;
  groups.forEach((gi, i) => {
    after -= gi.length;
    sizes.push([gi.length, after]);
    for (let j = i + 1; j < groups.length; j++) {
      for (const a of gi) for (const b of groups[j]!) jt += a < b ? 1 : a === b ? 0.5 : 0;
    }
  });
  const warnings: string[] = [];
  let exact = !ties && nTotal <= 100;
  if (variant === "DescTools" && options.exact !== undefined) {
    exact = options.exact;
    if (exact && ties) {
      exact = false;
      warnings.push(TIES);
    }
  } else if (!exact) warnings.push(NOT_EXACT);
  let lower: number;
  let upper: number;
  if (exact) {
    // the convolution of the Mann-Whitney distributions
    let dist = [1];
    for (const [ni, mi] of sizes) {
      if (ni === 0 || mi === 0) continue;
      const mw = Array.from({ length: ni * mi + 1 }, (_, v) => dwilcox1(v, ni, mi, false));
      const next = new Array<number>(dist.length + mw.length - 1).fill(0);
      dist.forEach((a, u) => mw.forEach((b, v) => (next[u + v]! += a * b)));
      dist = next;
    }
    lower = 0;
    upper = 0;
    dist.forEach((pr, v) => {
      if (v <= jt) lower += pr;
      if (v >= jt) upper += pr;
    });
  } else {
    const mean = sizes.reduce((a, [ni, mi]) => a + ni * mi, 0) / 2;
    const variance = sizes.reduce((a, [ni, mi]) => a + (ni * mi * (ni + mi + 1)) / 12, 0);
    const z = (jt - mean) / Math.sqrt(variance);
    lower = pnorm(z);
    upper = 1 - lower;
  }
  const cap = variant === "clinfun" ? 0.5 : 1;
  const pValue = alternative === "increasing" ? upper : alternative === "decreasing" ? lower : 2 * Math.min(upper, lower, cap);
  return { method: "Jonckheere-Terpstra test", alternative, statistic: jt, statisticName: "JT", pValue, warnings };
}
