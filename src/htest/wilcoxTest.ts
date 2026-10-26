// Wilcoxon tests (R's wilcox.test): the one-sample / paired signed rank test and the two-sample rank sum test
// (Mann-Whitney).
//
// The statistics and normal approximation (mean, tie-corrected variance, direction of the continuity correction) use
// the same formulas as scipy.stats wilcoxon (zero_method = "wilcox") and mannwhitneyu (scipy/stats/_wilcoxon.py, _mannwhitneyu.py;
// SciPy commit a087e61, BSD-3-Clause, see THIRD_PARTY_NOTICES.md).
// Intervals and estimates were written for rStats.js from Hodges & Lehmann (Ann. Math. Stat. 34, 1963) and Bauer
// (JASA 67, 1972) and R's documented behaviour: the exact interval takes order statistics of the Walsh averages
// (of the differences x_i - y_j for two samples) at ranks from the signed rank (rank sum) quantile, and the estimate is
// their median; the normal-approximation interval is where the standardised statistic of the shifted data, a step
// function of the shift, crosses the normal quantiles, found with R's uniroot conventions (src/internal/uniroot.ts,
// tolerance tolRoot), and the estimate is where it crosses 0 without continuity correction. The switch between exact
// and normal approximation, the reported confidence level when the requested one is not attainable, intervals that
// cannot be formed, and names follow R's documented and observed behaviour.
// - The exact method is used when exact = null and n < 50 (both < 50 for two samples). With ties or zero differences,
//   the normal approximation is used even when exact = true
// - Only NaN is removed (R's documentation says non-finite values are removed, but in fact Inf is kept and ranked)
// - For the one-sample normal-approximation interval, α is doubled repeatedly until the requested confidence level is reached
//   (only for alternative = "less" is reachability judged with the α/2 quantile; R's behaviour kept as is).
//   The two-sample interval is clamped at the ends and the confidence level is kept

import { psignrank1, qsignrank1 } from "../distributions/signrank.js";
import { pwilcox1, qwilcox1 } from "../distributions/wilcox.js";
import { pnorm, qnorm } from "../distributions/normal.js";
import {
  completePairs,
  dropNaN,
  mean,
  rank,
  tieCounts,
} from "../internal/summary.js";
import { uniroot } from "../internal/uniroot.js";
import type { DataFrame } from "../models/modelFrame.js";
import { twoSampleData } from "./testFormula.js";
import { matchAlternative, type Alternative, type HTest, type Sample } from "./types.js";

/** Options for {@link wilcoxTest}. */
export interface WilcoxTestOptions {
  /**
   * Alternative hypothesis: `"two.sided"`, `"less"` or `"greater"`. Default `"two.sided"`.
   * Unambiguous abbreviations such as `"two"`, `"l"` and `"g"` are accepted, as in R.
   */
  alternative?: Alternative | "two" | "l" | "g";
  /** Location under the null hypothesis (location shift for two samples). Default `0`. */
  mu?: number;
  /** Paired test (signed rank test on `x - y`). Requires `y`. Default `false`. */
  paired?: boolean;
  /**
   * Compute an exact p-value. Default `null`: exact when the sample size is below 50 (both
   * samples, for two samples). Even with `true`, the normal approximation is used when
   * there are ties or zero differences, as in R.
   */
  exact?: boolean | null;
  /** Apply a continuity correction in the normal approximation. Default `true`. */
  correct?: boolean;
  /** Compute a confidence interval and the Hodges-Lehmann estimate. Default `false`. */
  confInt?: boolean;
  /** Confidence level of the interval. Default `0.95`. */
  confLevel?: number;
  /** Tolerance of the root search for the interval and estimate in the normal approximation (R's `tol.root`). Default `1e-4`. */
  tolRoot?: number;
}

/**
 * Result of {@link wilcoxTest}. `statisticName` is `"V"` for the signed rank test and `"W"`
 * for the rank sum test; `parameter` is not set. `estimate` and `confInt` are set only
 * with `confInt: true`.
 */
export interface WilcoxTestResult extends HTest {
  /** `mu`. */
  nullValue: number;
}


/**
 * Wilcoxon signed rank and rank sum (Mann-Whitney) tests. Equivalent to R's `wilcox.test()`.
 *
 * With one sample (or `paired: true`) performs the signed rank test; with two samples the
 * rank sum test. The choice between exact and normal-approximation p-values, the
 * Hodges-Lehmann estimates and the confidence intervals follow R, including R's behavior
 * when the requested confidence level cannot be reached. Only `NaN` is dropped; infinite
 * values are kept and ranked (as R actually does).
 *
 * @param x Sample.
 * @param y Second sample for a two-sample or paired test. May be omitted, and the options
 *   passed in its place: `wilcoxTest(x, { mu: 1 })`.
 * @param options See {@link WilcoxTestOptions}.
 * @returns The test result; see {@link WilcoxTestResult}.
 *
 * @example
 * ```ts
 * const x = [1.83, 0.50, 1.62, 2.48, 1.68, 1.88, 1.55, 3.06, 1.30];
 * const y = [0.878, 0.647, 0.598, 2.05, 1.06, 1.29, 1.06, 3.14, 1.29];
 * const r = wilcoxTest(x, y, { paired: true, alternative: "greater" });
 * r.statistic; // 40 (V)
 * r.pValue;    // 0.01953125
 * ```
 *
 * There is also a formula form, `wilcoxTest("y ~ g", data, options)` (next overload).
 */
export function wilcoxTest(x: Sample, y?: Sample | WilcoxTestOptions, options?: WilcoxTestOptions): WilcoxTestResult;
/**
 * Wilcoxon tests from a formula and a data frame. As R's `wilcox.test(formula, data)`: `"y ~ g"` is the
 * rank sum test of the two levels of `g` (the first level is `x`), `"y ~ 1"` the signed rank test and
 * `"Pair(a, b) ~ 1"` the paired test of `a` and `b` (the option `paired` is not allowed). Only the variables of the
 * formula count: the rows where one of them is missing are dropped.
 *
 * @param formula `"y ~ g"`, `"y ~ 1"` or `"Pair(a, b) ~ 1"`.
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 * @param options See {@link WilcoxTestOptions}.
 */
export function wilcoxTest(formula: string, data: DataFrame, options?: WilcoxTestOptions): WilcoxTestResult;
export function wilcoxTest(
  x: Sample | string,
  y?: Sample | WilcoxTestOptions | DataFrame,
  options: WilcoxTestOptions = {},
): WilcoxTestResult {
  if (typeof x === "string") {
    if (options.paired !== undefined) throw new Error("cannot use 'paired' in formula method");
    const d = twoSampleData(x, y as DataFrame, true);
    if (d.kind === "one") return wilcoxTest(d.x, options);
    return wilcoxTest(d.x, d.y, d.kind === "paired" ? { ...options, paired: true } : options);
  }
  // Also accept the form wilcoxTest(x, { mu: 1 })
  let ys: Sample | undefined;
  if (y !== undefined && !ArrayBuffer.isView(y) && !Array.isArray(y))
    options = y as WilcoxTestOptions;
  else ys = y as Sample | undefined;
  const alternative = matchAlternative(options.alternative);
  const mu = options.mu ?? 0;
  const paired = options.paired ?? false;
  const exact = options.exact ?? null;
  const correct = options.correct ?? true;
  const confInt = options.confInt ?? false;
  const confLevel = options.confLevel ?? 0.95;
  const tolRoot = options.tolRoot ?? 1e-4;
  if (!Number.isFinite(mu))
    throw new RangeError("mu must be a single finite number");
  if (confInt && !(confLevel > 0 && confLevel < 1)) {
    throw new RangeError(
      "confLevel must be a number strictly between 0 and 1",
    );
  }
  if (paired && ys === undefined)
    throw new TypeError("y is required when paired is true");

  let xs: number[];
  let yv: number[] | undefined;
  if (paired) {
    const [a, b] = completePairs(Array.from(x), Array.from(ys!));
    // Also drop the NaN from Inf - Inf
    xs = dropNaN(a.map((v, i) => v - b[i]!));
  } else {
    xs = dropNaN(Array.from(x));
    if (ys !== undefined) yv = dropNaN(Array.from(ys));
  }
  if (xs.length < 1) throw new Error("not enough (non-missing) 'x' observations");
  if (yv !== undefined && yv.length < 1)
    throw new Error("not enough (non-missing) 'y' observations");

  const ctx: Context = {
    alternative,
    mu,
    correct,
    confInt,
    confLevel,
    tolRoot,
  };
  return yv === undefined
    ? signedRank(xs, exact, paired, ctx)
    : rankSum(xs, yv, exact, ctx);
}

interface Context {
  alternative: Alternative;
  mu: number;
  correct: boolean;
  confInt: boolean;
  confLevel: number;
  tolRoot: number;
}

/** Continuity correction amount (two-sided: 0.5 in the direction of the statistic's sign) */
function correction(
  z: number,
  alternative: Alternative,
  correct: boolean,
): number {
  if (!correct) return 0;
  if (alternative === "two.sided") return Math.sign(z) * 0.5;
  return alternative === "greater" ? 0.5 : -0.5;
}

/** p-value from the standardised statistic */
function normalP(z: number, alternative: Alternative): number {
  if (alternative === "less") return pnorm(z);
  if (alternative === "greater") return pnorm(z, { lowerTail: false });
  return 2 * Math.min(pnorm(z), pnorm(z, { lowerTail: false }));
}

/** Round to 2 significant digits (exact halves to even). 0 < v */
function signif2(v: number): number {
  if (!(v > 0) || !Number.isFinite(v)) return v;
  const e = Math.floor(Math.log10(v));
  const k = 1 - e;
  const s = k >= 0 ? v * 10 ** k : v / 10 ** -k;
  let r = Math.round(s);
  if (r - s === 0.5 && r % 2 !== 0) r -= 1;
  return k >= 0 ? r / 10 ** k : r * 10 ** -k;
}

/** Median of an ascending array */
function sortedMedian(s: readonly number[]): number {
  const n = s.length;
  if (n === 0) return NaN;
  const h = Math.floor(n / 2);
  return n % 2 === 1 ? s[h]! : mean([s[h - 1]!, s[h]!]);
}

const ascending = (a: number, b: number): number => a - b;

// ---- One-sample / paired (signed rank test) ----

/** Signed rank statistic of x - d (zeros removed): [V - expectation, standard deviation] */
function signedRankStat(x: readonly number[]): [number, number, number] {
  const n = x.length;
  const r = rank(x.map(Math.abs));
  let v = 0;
  for (let i = 0; i < n; i++) if (x[i]! > 0) v += r[i]!;
  let ties = 0;
  for (const t of tieCounts(r)) ties += t * t * t - t;
  const sigma = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - ties / 48);
  return [v, v - (n * (n + 1)) / 4, sigma];
}

function signedRank(
  x0: number[],
  exactOpt: boolean | null,
  paired: boolean,
  ctx: Context,
): WilcoxTestResult {
  const { alternative, mu, correct } = ctx;
  let x = x0.map((v) => v - mu);
  const zeroes = x.some((v) => v === 0);
  if (zeroes) x = x.filter((v) => v !== 0);
  const n = x.length;
  const exact = exactOpt ?? n < 50;
  const r = rank(x.map(Math.abs));
  const ties = tieCounts(r).length > 0;
  const [V, dz, sigma] = signedRankStat(x);

  let pValue: number;
  let method: string;
  const useExact = exact && !ties && !zeroes;
  if (useExact) {
    method = "Wilcoxon signed rank exact test";
    const total = (n * (n + 1)) / 2;
    if (alternative === "less") pValue = psignrank1(V, n, true, false);
    else if (alternative === "greater")
      pValue = psignrank1(V - 1, n, false, false);
    else {
      const p =
        V > total / 2
          ? psignrank1(V - 1, n, false, false)
          : psignrank1(V, n, true, false);
      pValue = Math.min(1, 2 * p);
    }
  } else {
    method = `Wilcoxon signed rank test${correct ? " with continuity correction" : ""}`;
    pValue = normalP(
      (dz - correction(dz, alternative, correct)) / sigma,
      alternative,
    );
  }

  const result: WilcoxTestResult = {
    method,
    alternative,
    statistic: V,
    statisticName: "V",
    pValue,
    nullValue: mu,
    nullValueName: paired ? "location shift" : "location",
  };
  if (!ctx.confInt) return result;
  // The interval is on the original scale (add mu back to the data with zero differences removed)
  const xo = x.map((v) => v + mu);
  const ci = useExact
    ? signedRankExactCI(xo, ctx)
    : signedRankNormalCI(xo, ctx);
  return { ...result, ...ci };
}

/** The interval part of the result */
interface CIPart {
  confInt: [number, number];
  confLevel: number;
  estimate?: number;
  estimateNames?: string;
}

/** Interval with the given finite ends, the other end(s) open according to the alternative */
function shape(alternative: Alternative, lower: number, upper: number): [number, number] {
  if (alternative === "less") return [-Infinity, upper];
  if (alternative === "greater") return [lower, Infinity];
  return [lower, upper];
}

/** Interval when no interval can be formed: the bounded end(s) are NaN and the confidence level 0 */
function noInterval(alternative: Alternative, estimate: number, estimateNames?: string): CIPart {
  const out: CIPart = { confInt: shape(alternative, NaN, NaN), confLevel: 0, estimate };
  if (estimateNames !== undefined) out.estimateNames = estimateNames;
  return out;
}

/** Order-statistic ranks of an exact distribution-free interval: q from the lower-tail quantile (0 replaced by 1) */
function exactRank(quantile: (p: number) => number, alternative: Alternative, a: number): number {
  const q = quantile(alternative === "two.sided" ? a / 2 : a);
  return q === 0 ? 1 : q;
}

function checkTolRoot(tol: number): void {
  if (!(tol > 0)) throw new RangeError("tolRoot must be positive");
}

/**
 * Exact interval from the order statistics of the Walsh averages (Bauer 1972) and the Hodges-Lehmann estimate, their
 * median
 */
function signedRankExactCI(x: readonly number[], ctx: Context): CIPart {
  const { alternative, confLevel } = ctx;
  const n = x.length;
  const walsh: number[] = [];
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) walsh.push((x[i]! + x[j]!) / 2);
  walsh.sort(ascending);
  const N = walsh.length;
  const a = 1 - confLevel;
  const q = exactRank((p) => qsignrank1(p, n, true, false), alternative, a);
  const tail = psignrank1(q - 1, n, true, false);
  const achieved = alternative === "two.sided" ? 2 * tail : tail;
  return {
    confInt: shape(alternative, walsh[q - 1]!, walsh[N - q]!),
    confLevel: achieved - a > a / 2 ? 1 - signif2(achieved) : confLevel,
    estimate: sortedMedian(walsh),
    estimateNames: "(pseudo)median",
  };
}

/**
 * Normal-approximation interval: the shifts d at which the standardised signed rank statistic of x - d crosses the
 * normal quantiles, and the estimate where it crosses 0 (found with uniroot, tolerance tolRoot)
 */
function signedRankNormalCI(x: readonly number[], ctx: Context): CIPart {
  const { alternative, correct, confLevel, tolRoot } = ctx;
  const n = x.length;
  if (n === 0) return noInterval(alternative, NaN);
  const lo = Math.min(...x);
  const hi = Math.max(...x);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || n === 1 || lo === hi) {
    return noInterval(alternative, (lo + hi) / 2, "midrange");
  }
  const stat = (d: number, corr: boolean): number => {
    const [, centre, sigma] = signedRankStat(x.map((v) => v - d).filter((v) => v !== 0));
    return (centre - correction(centre, alternative, corr)) / sigma;
  };
  const sLo = stat(lo, correct);
  const sHi = stat(hi, correct);
  const zUpper = (p: number): number => -qnorm(p);
  const reachable = (a: number): boolean => {
    if (alternative === "greater") return !(sLo < zUpper(a));
    if (alternative === "less") return !(sHi > qnorm(a / 2));
    return !(sLo < zUpper(a / 2)) && !(sHi > qnorm(a / 2));
  };
  let a = 1 - confLevel;
  let enlarged = false;
  while (!reachable(a) && a < 1) {
    a *= 2;
    enlarged = true;
  }
  checkTolRoot(tolRoot);
  const crossing = (z: number): number =>
    uniroot((d) => stat(d, correct) - z, lo, hi, { tol: tolRoot, fLower: sLo - z, fUpper: sHi - z });
  let confInt: [number, number];
  if (a >= 1) {
    const med = sortedMedian([...x].sort(ascending));
    confInt = shape(alternative, med, med);
  } else if (alternative === "greater") confInt = [crossing(zUpper(a)), Infinity];
  else if (alternative === "less") confInt = [-Infinity, crossing(qnorm(a))];
  else confInt = [crossing(zUpper(a / 2)), crossing(qnorm(a / 2))];
  const estimate = uniroot((d) => stat(d, false), lo, hi, {
    tol: tolRoot,
    fLower: stat(lo, false),
    fUpper: stat(hi, false),
  });
  return {
    confInt,
    confLevel: enlarged ? 1 - Math.min(1, a) : confLevel,
    estimate,
    estimateNames: "(pseudo)median",
  };
}

// ---- Two-sample (rank sum test) ----

/** Rank sum statistic of x - d and y: [W, W - expectation, standard deviation] */
function rankSumStat(
  x: readonly number[],
  y: readonly number[],
): [number, number, number] {
  const nx = x.length;
  const ny = y.length;
  const r = rank([...x, ...y]);
  let s = 0;
  for (let i = 0; i < nx; i++) s += r[i]!;
  const W = s - (nx * (nx + 1)) / 2;
  let ties = 0;
  for (const t of tieCounts(r)) ties += t * t * t - t;
  const N = nx + ny;
  const sigma = Math.sqrt(((nx * ny) / 12) * (N + 1 - ties / (N * (N - 1))));
  return [W, W - (nx * ny) / 2, sigma];
}

function rankSum(
  x: number[],
  y: number[],
  exactOpt: boolean | null,
  ctx: Context,
): WilcoxTestResult {
  const { alternative, mu, correct } = ctx;
  const nx = x.length;
  const ny = y.length;
  const xs = x.map((v) => v - mu);
  const exact = exactOpt ?? (nx < 50 && ny < 50);
  const ties = tieCounts([...xs, ...y]).length > 0;
  const [W, dz, sigma] = rankSumStat(xs, y);

  let pValue: number;
  let method: string;
  const useExact = exact && !ties;
  if (useExact) {
    method = "Wilcoxon rank sum exact test";
    if (alternative === "less") pValue = pwilcox1(W, nx, ny, true, false);
    else if (alternative === "greater")
      pValue = pwilcox1(W - 1, nx, ny, false, false);
    else {
      const p =
        W > (nx * ny) / 2
          ? pwilcox1(W - 1, nx, ny, false, false)
          : pwilcox1(W, nx, ny, true, false);
      pValue = Math.min(1, 2 * p);
    }
  } else {
    method = `Wilcoxon rank sum test${correct ? " with continuity correction" : ""}`;
    pValue = normalP(
      (dz - correction(dz, alternative, correct)) / sigma,
      alternative,
    );
  }

  const result: WilcoxTestResult = {
    method,
    alternative,
    statistic: W,
    statisticName: "W",
    pValue,
    nullValue: mu,
    nullValueName: "location shift",
  };
  if (!ctx.confInt) return result;
  const ci = useExact ? rankSumExactCI(x, y, ctx) : rankSumNormalCI(x, y, ctx);
  return { ...result, ...ci };
}

/** Exact interval from the order statistics of the differences x_i - y_j and their median as the estimate */
function rankSumExactCI(x: readonly number[], y: readonly number[], ctx: Context): CIPart {
  const { alternative, confLevel } = ctx;
  const nx = x.length;
  const ny = y.length;
  const diffs: number[] = [];
  for (const xi of x) for (const yj of y) diffs.push(xi - yj);
  diffs.sort(ascending);
  const M = diffs.length;
  const a = 1 - confLevel;
  const q = exactRank((p) => qwilcox1(p, nx, ny, true, false), alternative, a);
  const tail = pwilcox1(q - 1, nx, ny, true, false);
  const achieved = alternative === "two.sided" ? 2 * tail : tail;
  return {
    confInt: shape(alternative, diffs[q - 1]!, diffs[M - q]!),
    confLevel: achieved - a > a / 2 ? 1 - achieved : confLevel,
    estimate: sortedMedian(diffs),
    estimateNames: "difference in location",
  };
}

/**
 * Normal-approximation interval: the shifts d at which the standardised rank sum statistic of (x - d, y) crosses the
 * normal quantiles (clamped to the range of the differences), and the estimate where it crosses 0
 */
function rankSumNormalCI(x: readonly number[], y: readonly number[], ctx: Context): CIPart {
  const { alternative, correct, confLevel, tolRoot } = ctx;
  const lo = Math.min(...x) - Math.max(...y);
  const hi = Math.max(...x) - Math.min(...y);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    throw new Error("cannot compute the confidence interval because the differences are not finite");
  }
  const stat = (d: number, corr: boolean): number => {
    const [, centre, sigma] = rankSumStat(
      x.map((v) => v - d),
      y,
    );
    return (centre - correction(centre, alternative, corr)) / sigma;
  };
  const crossing = (z: number, corr: boolean): number => {
    const fLo = stat(lo, corr) - z;
    const fHi = stat(hi, corr) - z;
    if (Number.isNaN(fLo) || Number.isNaN(fHi)) {
      throw new Error("cannot compute the confidence interval because all observations are tied");
    }
    if (fLo <= 0) return lo;
    if (fHi >= 0) return hi;
    checkTolRoot(tolRoot);
    return uniroot((d) => stat(d, corr) - z, lo, hi, { tol: tolRoot, fLower: fLo, fUpper: fHi });
  };
  const a = 1 - confLevel;
  let confInt: [number, number];
  if (alternative === "greater") confInt = [crossing(-qnorm(a), correct), Infinity];
  else if (alternative === "less") confInt = [-Infinity, crossing(qnorm(a), correct)];
  else confInt = [crossing(-qnorm(a / 2), correct), crossing(qnorm(a / 2), correct)];
  return {
    confInt,
    confLevel,
    estimate: crossing(0, false),
    estimateNames: "difference in location",
  };
}
