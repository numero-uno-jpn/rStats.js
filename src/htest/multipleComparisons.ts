// Multiple comparisons after a one-way layout: PMCMRplus's dscfAllPairsTest, kwAllPairsDunnTest, kwManyOneDunnTest,
// dunnettTest, gamesHowellTest, tukeyTest and steelTest, dunn.test's dunn.test and multcomp's Dunnett contrasts
// (summary(glht(aov(y ~ g), mcp(g = "Dunnett")))).
//
// Written for rStats.js from the published statistics and the behaviour described in oracle/mcomp-behaviour.md (no
// ported code):
// - Dunn (Technometrics 6, 1964): z = (mean rank difference) / sqrt((N (N + 1) / 12 - C) (1/n_i + 1/n_j)) with the
//   tie term C = sum (t^3 - t) / (12 (N - 1)).
// - Dunnett (JASA 50, 1955): t = (m_j - m_1) / (s sqrt(1/n_j + 1/n_1)) with the pooled s; the simultaneous
//   probabilities are computed exactly by src/htest/dunnett.ts (R computes them by randomised integration).
// - Dwass (1960), Steel (1960), Critchlow and Fligner (1991): pairwise Mann-Whitney statistics standardised and
//   compared with the studentized range for k means and infinite degrees of freedom.
// - Games and Howell (1976): Welch's standard error and degrees of freedom per pair, studentized range.
// - Tukey (1953), Tukey-Kramer: the pooled standard error, studentized range on N - k degrees of freedom.

import { pnorm } from "../distributions/normal.js";
import { ptukey } from "../distributions/tukey.js";
import { mean, rank, tieCounts, variance } from "../internal/summary.js";
import { pDunnettUpper } from "./dunnett.js";
import { labelledGroups, type GroupLabel } from "./groups.js";
import { pAdjust, type PAdjustMethod } from "./pAdjust.js";
import { kruskalTest } from "./rankTests.js";
import { matchAlternative, type Alternative, type Sample } from "./types.js";

/** Result of the PMCMRplus tests (R's `PMCMR` objects). */
export interface PMCMRResult {
  /** Description of the test (R's `method`). */
  method: string;
  /**
   * Statistics as a table: for the all-pairs tests row `r` compares group `rowNames[r]` with each group
   * `colNames[c]` (lower triangle; `NaN` above the diagonal), for the many-to-one tests each group with the control
   * (one column).
   */
  statistic: number[][];
  /** p-values, in the same layout as `statistic`. */
  pValue: number[][];
  /** Labels of the rows (groups 2..k). */
  rowNames: string[];
  /** Labels of the columns (groups 1..k-1, or the control). */
  colNames: string[];
  /** How the p-values were adjusted (`"single-step"` for the simultaneous probabilities). */
  pAdjustMethod: string;
  /** R's warnings. */
  warnings: string[];
}

/** Options of the all-pairs Dunn test. */
export interface KwAllPairsDunnTestOptions {
  /** p-value adjustment (see `pAdjust`). Default `"holm"`. */
  pAdjustMethod?: PAdjustMethod | (string & {});
}

/** Options of the many-to-one tests. */
export interface ManyOneTestOptions {
  /** Alternative hypothesis for each group against the control. Default `"two.sided"`. */
  alternative?: Alternative | "two" | "l" | "g";
}

/** Options of the many-to-one Dunn test. */
export interface KwManyOneDunnTestOptions extends ManyOneTestOptions {
  /** `"single-step"` (simultaneous normal probabilities, the default) or a `pAdjust` method. */
  pAdjustMethod?: "single-step" | PAdjustMethod | (string & {});
}

const TIES_WARNING = "Ties are present. z-quantiles were corrected for ties.";

interface Layout {
  labels: string[];
  groups: number[][];
  n: number[];
  N: number;
  k: number;
}

function layout(x: Sample, g: readonly GroupLabel[]): Layout {
  const { labels, groups } = labelledGroups(x, g);
  const k = groups.length;
  if (k < 2) throw new RangeError("there must be at least two groups");
  const n = groups.map((s) => s.length);
  return { labels, groups, n, N: n.reduce((a, b) => a + b, 0), k };
}

/** Mean ranks of the groups in the ranking of all observations, and the tie term C */
function meanRanks(d: Layout): { R: number[]; C: number } {
  const all = d.groups.flat();
  const r = rank(all);
  const R: number[] = [];
  let pos = 0;
  for (const ni of d.n) {
    let s = 0;
    for (let i = 0; i < ni; i++) s += r[pos + i]!;
    pos += ni;
    R.push(s / ni);
  }
  let t3 = 0;
  for (const t of tieCounts(all)) t3 += t * t * t - t;
  return { R, C: t3 / (12 * (d.N - 1)) };
}

/** Lower-triangular table of f(i, j), i > j (row i - 1, column j), NaN above the diagonal */
function lowerTable(k: number, f: (i: number, j: number) => number): number[][] {
  const out = Array.from({ length: k - 1 }, () => new Array<number>(k - 1).fill(NaN));
  for (let j = 0; j < k - 1; j++) for (let i = j + 1; i < k; i++) out[i - 1]![j] = f(i, j);
  return out;
}

/** p.adjust over the lower-triangle cells, column by column (as R's pairwise.table) */
function adjustLower(p: number[][], method: string): number[][] {
  const k = p.length + 1;
  const raw: number[] = [];
  for (let j = 0; j < k - 1; j++) for (let i = j + 1; i < k; i++) raw.push(p[i - 1]![j]!);
  const adj = pAdjust(raw, method);
  let idx = 0;
  const out = p.map((row) => row.slice());
  for (let j = 0; j < k - 1; j++) for (let i = j + 1; i < k; i++) out[i - 1]![j] = adj[idx++]!;
  return out;
}

function allPairs(d: Layout, method: string, statistic: number[][], pValue: number[][], adjust: string, warnings: string[] = []): PMCMRResult {
  return {
    method,
    statistic,
    pValue,
    rowNames: d.labels.slice(1),
    colNames: d.labels.slice(0, -1),
    pAdjustMethod: adjust,
    warnings,
  };
}

function manyOne(d: Layout, method: string, statistic: number[], pValue: number[], adjust: string, warnings: string[] = []): PMCMRResult {
  return {
    method,
    statistic: statistic.map((v) => [v]),
    pValue: pValue.map((v) => [v]),
    rowNames: d.labels.slice(1),
    colNames: d.labels.slice(0, 1),
    pAdjustMethod: adjust,
    warnings,
  };
}

const upperNormal = (z: number): number => pnorm(z, { lowerTail: false });
const upperRange = (q: number, k: number, df: number): number => ptukey(Math.abs(q), k, df, { lowerTail: false });

/** Group means, and the pooled variance sum (n_i - 1) s_i^2 / sum (n_i - 1) with its degrees of freedom */
function pooled(d: Layout): { m: number[]; s2: number; df: number } {
  let ss = 0;
  let df = 0;
  for (const grp of d.groups) {
    if (grp.length < 2) continue;
    ss += (grp.length - 1) * variance(grp);
    df += grp.length - 1;
  }
  return { m: d.groups.map(mean), s2: ss / df, df: d.N - d.k };
}

/**
 * Dunn's all-pairs test of mean ranks with adjusted p-values. Equivalent to PMCMRplus's `kwAllPairsDunnTest()`.
 *
 * @param x Response values.
 * @param g Group labels, parallel to `x` (groups in the order of the sorted labels).
 */
export function kwAllPairsDunnTest(x: Sample, g: readonly GroupLabel[], options: KwAllPairsDunnTestOptions = {}): PMCMRResult {
  const adjust = options.pAdjustMethod ?? "holm";
  const d = layout(x, g);
  const { R, C } = meanRanks(d);
  const v = (d.N * (d.N + 1)) / 12 - C;
  const z = lowerTable(d.k, (i, j) => Math.abs(R[i]! - R[j]!) / Math.sqrt(v * (1 / d.n[i]! + 1 / d.n[j]!)));
  const p = adjustLower(z.map((row) => row.map((s) => 2 * upperNormal(s))), adjust);
  return allPairs(d, "Dunn's all-pairs test", z, p, adjust, C !== 0 ? [TIES_WARNING] : []);
}

/**
 * Dunn's many-to-one test of mean ranks against the control (the first group). Equivalent to PMCMRplus's
 * `kwManyOneDunnTest()`. With `pAdjustMethod` `"single-step"` (the default) the p-values are the exact simultaneous
 * normal probabilities (R approximates them by randomised integration).
 */
export function kwManyOneDunnTest(x: Sample, g: readonly GroupLabel[], options: KwManyOneDunnTestOptions = {}): PMCMRResult {
  const alternative = matchAlternative(options.alternative);
  const adjust = options.pAdjustMethod ?? "single-step";
  const d = layout(x, g);
  const { R, C } = meanRanks(d);
  const v = (d.N * (d.N + 1)) / 12 - C;
  const idx = d.n.slice(1).map((_, i) => i + 1);
  const z = idx.map((j) => (R[j]! - R[0]!) / Math.sqrt(v * (1 / d.n[0]! + 1 / d.n[j]!)));
  let p: number[];
  if (adjust === "single-step") {
    const lambda = idx.map((j) => d.n[j]! / (d.n[j]! + d.n[0]!));
    p = z.map((s) =>
      alternative === "two.sided"
        ? pDunnettUpper(s, lambda, Infinity, true)
        : pDunnettUpper(alternative === "greater" ? s : -s, lambda, Infinity, false),
    );
  } else {
    p = pAdjust(
      z.map((s) => (alternative === "two.sided" ? 2 * upperNormal(Math.abs(s)) : upperNormal(alternative === "greater" ? s : -s))),
      adjust,
    );
  }
  return manyOne(d, "Dunn's many-to-one test", z, p, adjust, C !== 0 ? [TIES_WARNING] : []);
}

/**
 * Dunnett's many-to-one test of means against the control (the first group), with the pooled variance. Equivalent to
 * PMCMRplus's `dunnettTest()`. The p-values are the exact multivariate t probabilities (R approximates them by
 * randomised integration); two-sided, as in PMCMRplus, `min(1, 2 P(max T_i >= |t|))`.
 */
export function dunnettTest(x: Sample, g: readonly GroupLabel[], options: ManyOneTestOptions = {}): PMCMRResult {
  const alternative = matchAlternative(options.alternative);
  const d = layout(x, g);
  const { m, s2, df } = pooled(d);
  const s = Math.sqrt(s2);
  const idx = d.n.slice(1).map((_, i) => i + 1);
  const t = idx.map((j) => (m[j]! - m[0]!) / (s * Math.sqrt(1 / d.n[j]! + 1 / d.n[0]!)));
  const lambda = idx.map((j) => d.n[j]! / (d.n[j]! + d.n[0]!));
  const p = t.map((v) =>
    alternative === "two.sided"
      ? Math.min(1, 2 * pDunnettUpper(Math.abs(v), lambda, df, false))
      : pDunnettUpper(alternative === "greater" ? v : -v, lambda, df, false),
  );
  return manyOne(d, "Dunnett's-test for multiple\t\n                         comparisons with one control", t, p, "single-step");
}

/**
 * Dwass-Steel-Critchlow-Fligner all-pairs test of pairwise Mann-Whitney statistics. Equivalent to PMCMRplus's
 * `dscfAllPairsTest()`. The statistic, sqrt(2) (U - n_i n_j / 2) / sqrt(Var U) with the smaller U, is never positive.
 */
export function dscfAllPairsTest(x: Sample, g: readonly GroupLabel[]): PMCMRResult {
  const d = layout(x, g);
  const stat = lowerTable(d.k, (i, j) => {
    const ni = d.n[i]!;
    const nj = d.n[j]!;
    const both = [...d.groups[i]!, ...d.groups[j]!];
    const r = rank(both);
    let ri = 0;
    for (let a = 0; a < ni; a++) ri += r[a]!;
    const ui = ri - (ni * (ni + 1)) / 2;
    const u = Math.min(ui, ni * nj - ui);
    const S = ni + nj;
    let t3 = 0;
    for (const t of tieCounts(both)) t3 += t * t * t - t;
    const v = ((ni * nj) / (S * (S - 1))) * ((S * S * S - S) / 12 - t3 / 12);
    return (Math.SQRT2 * (u - (ni * nj) / 2)) / Math.sqrt(v);
  });
  const p = stat.map((row) => row.map((q) => (Number.isNaN(q) ? NaN : upperRange(q, d.k, Infinity))));
  return allPairs(d, "Dwass-Steele-Critchlow-Fligner all-pairs test", stat, p, "single-step");
}

/**
 * Games-Howell all-pairs test of means with Welch's standard errors and degrees of freedom. Equivalent to
 * PMCMRplus's `gamesHowellTest()`.
 */
export function gamesHowellTest(x: Sample, g: readonly GroupLabel[]): PMCMRResult {
  const d = layout(x, g);
  const m = d.groups.map(mean);
  const w = d.groups.map((grp, i) => variance(grp) / d.n[i]!);
  const q = lowerTable(d.k, (i, j) => ((m[i]! - m[j]!) / Math.sqrt(w[i]! + w[j]!)) * Math.SQRT2);
  const p = lowerTable(d.k, (i, j) => {
    const df = (w[i]! + w[j]!) ** 2 / (w[i]! ** 2 / (d.n[i]! - 1) + w[j]! ** 2 / (d.n[j]! - 1));
    return upperRange(q[i - 1]![j]!, d.k, df);
  });
  return allPairs(d, "Games-Howell test", q, p, "none");
}

/** Tukey's all-pairs test of means (Tukey-Kramer for unequal sizes). Equivalent to PMCMRplus's `tukeyTest()`. */
export function tukeyTest(x: Sample, g: readonly GroupLabel[]): PMCMRResult {
  const d = layout(x, g);
  const { m, s2, df } = pooled(d);
  const q = lowerTable(d.k, (i, j) => (m[i]! - m[j]!) / Math.sqrt((s2 * (1 / d.n[i]! + 1 / d.n[j]!)) / 2));
  const p = q.map((row) => row.map((v) => (Number.isNaN(v) ? NaN : upperRange(v, d.k, df))));
  return allPairs(d, "Tukey's test", q, p, "single-step");
}

/**
 * Steel's many-to-one rank test, as PMCMRplus 1.9.12's `steelTest()` behaves: it fails on every input, so this
 * reproduces its errors. A two-sided alternative is rejected (`'arg' should be one of “greater”, “less”`), unequal
 * group sizes give `Steel's test is only valid for balanced designs.`, and balanced data the error PMCMRplus raises
 * internally.
 *
 * @throws Always.
 */
export function steelTest(x: Sample, g: readonly GroupLabel[], options: ManyOneTestOptions = {}): never {
  const alternative = options.alternative === undefined ? "greater" : matchAlternative(options.alternative);
  if (alternative === "two.sided") throw new RangeError("'arg' should be one of “greater”, “less”");
  const d = layout(x, g);
  if (d.n.some((v) => v !== d.n[0])) throw new RangeError("Steel's test is only valid for balanced designs.");
  throw new Error("'data' must be of a vector type, was 'NULL'");
}

/** Adjustment method of {@link dunnTest} (dunn.test's `method`). */
export type DunnTestMethod = "none" | "bonferroni" | "sidak" | "holm" | "hs" | "hochberg" | "bh" | "by";

/** Options of {@link dunnTest}. */
export interface DunnTestOptions {
  /** Adjustment of the p-values. Default `"none"`. */
  method?: DunnTestMethod;
  /** Report two-sided p-values (twice the upper tail of |Z|) instead of one-sided ones. Default `false`. */
  altp?: boolean;
}

/** Result of {@link dunnTest} (dunn.test's list). */
export interface DunnTestResult {
  /** Kruskal-Wallis chi-squared statistic (with the tie correction). */
  chi2: number;
  /** Dunn's z for each comparison. */
  Z: number[];
  /** p-values: the upper tail of |Z|, or twice that with `altp`. */
  P: number[];
  /** Adjusted p-values (no monotonicity step). */
  PAdjusted: number[];
  /** Labels of the comparisons, `"<label j> - <label i>"`, in the order (2,1), (3,1), (3,2), (4,1), ... */
  comparisons: string[];
}

/**
 * Dunn's test of all pairs of mean ranks. Equivalent to dunn.test's `dunn.test(x, g, method, altp)`. The step-wise
 * adjustments multiply (or transform) each p-value by the factor of its rank and cap it at 1, without enforcing
 * monotonicity, as dunn.test does (unlike `pAdjust`).
 */
export function dunnTest(x: Sample, g: readonly GroupLabel[], options: DunnTestOptions = {}): DunnTestResult {
  const method = options.method ?? "none";
  const altp = options.altp ?? false;
  const d = layout(x, g);
  const chi2 = kruskalTest(x, g).statistic;
  const { R, C } = meanRanks(d);
  const v = (d.N * (d.N + 1)) / 12 - C;
  const Z: number[] = [];
  const comparisons: string[] = [];
  for (let i = 1; i < d.k; i++) {
    for (let j = 0; j < i; j++) {
      Z.push((R[j]! - R[i]!) / Math.sqrt(v * (1 / d.n[j]! + 1 / d.n[i]!)));
      comparisons.push(`${d.labels[j]} - ${d.labels[i]}`);
    }
  }
  const P = Z.map((z) => (altp ? 2 : 1) * upperNormal(Math.abs(z)));
  return { chi2, Z, P, PAdjusted: dunnAdjust(P, method), comparisons };
}

/** dunn.test's adjustments: each value by the factor of its rank, capped at 1 (exported for the tests) */
export function dunnAdjust(P: readonly number[], method: DunnTestMethod): number[] {
  const m = P.length;
  const sidakLike = (p: number, e: number): number => Math.min(1, -Math.expm1(e * Math.log1p(-p)));
  // i = 1..m: rank among the increasing (or decreasing) values, ties in the order of the comparisons
  const ranks = (decreasing: boolean): number[] => {
    const order = P.map((_, k) => k).sort((a, b) => (decreasing ? P[b]! - P[a]! : P[a]! - P[b]!) || a - b);
    const r = new Array<number>(m);
    order.forEach((k, pos) => (r[k] = pos + 1));
    return r;
  };
  switch (method) {
    case "none":
      return P.slice();
    case "bonferroni":
      return P.map((p) => Math.min(1, m * p));
    case "sidak":
      return P.map((p) => sidakLike(p, m));
    case "holm": {
      const r = ranks(false);
      return P.map((p, k) => Math.min(1, (m + 1 - r[k]!) * p));
    }
    case "hs": {
      const r = ranks(false);
      return P.map((p, k) => sidakLike(p, m + 1 - r[k]!));
    }
    case "hochberg": {
      const r = ranks(true);
      return P.map((p, k) => Math.min(1, r[k]! * p));
    }
    case "bh": {
      const r = ranks(true);
      return P.map((p, k) => Math.min(1, (m / (m + 1 - r[k]!)) * p));
    }
    case "by": {
      const r = ranks(true);
      let h = 0;
      for (let l = 1; l <= m; l++) h += 1 / l;
      return P.map((p, k) => Math.min(1, (m / (m + 1 - r[k]!)) * h * p));
    }
    default:
      throw new RangeError(`invalid method "${String(method)}"`);
  }
}

/** Options of {@link glhtDunnett}. */
export interface GlhtDunnettOptions {
  /** Alternative hypothesis for each group against the control. Default `"two.sided"`. */
  alternative?: Alternative | "two" | "l" | "g";
}

/** Result of {@link glhtDunnett}. */
export interface GlhtDunnettResult {
  /** Labels of the contrasts, `"<level> - <level 1>"`. */
  names: string[];
  /** Differences of the group means from the control's. */
  estimate: number[];
  /** Their standard errors (pooled). */
  se: number[];
  /** t statistics. */
  t: number[];
  /** Simultaneous (single-step) p-values. */
  p: number[];
  /** Residual degrees of freedom, N - k. */
  df: number;
}

/**
 * Dunnett's many-to-one comparisons of a one-way ANOVA with simultaneous p-values. Equivalent to multcomp's
 * `summary(glht(aov(y ~ g), linfct = mcp(g = "Dunnett"), alternative))`, with the exact multivariate t probabilities
 * (R approximates them by randomised integration): two-sided `P(max |T_i| >= |t|)`, greater `P(max T_i >= t)`, less
 * `P(min T_i <= t)`.
 */
export function glhtDunnett(x: Sample, g: readonly GroupLabel[], options: GlhtDunnettOptions = {}): GlhtDunnettResult {
  const alternative = matchAlternative(options.alternative);
  const d = layout(x, g);
  const { m, s2, df } = pooled(d);
  const s = Math.sqrt(s2);
  const idx = d.n.slice(1).map((_, i) => i + 1);
  const estimate = idx.map((j) => m[j]! - m[0]!);
  const se = idx.map((j) => s * Math.sqrt(1 / d.n[j]! + 1 / d.n[0]!));
  const t = estimate.map((e, i) => e / se[i]!);
  const lambda = idx.map((j) => d.n[j]! / (d.n[j]! + d.n[0]!));
  const p = t.map((v) =>
    alternative === "two.sided"
      ? pDunnettUpper(v, lambda, df, true)
      : pDunnettUpper(alternative === "greater" ? v : -v, lambda, df, false),
  );
  return { names: idx.map((j) => `${d.labels[j]} - ${d.labels[0]}`), estimate, se, t, p, df };
}
