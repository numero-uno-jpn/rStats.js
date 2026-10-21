// Wilcoxon tests (R's wilcox.test): the one-sample / paired signed rank test and the two-sample rank sum test
// (Mann-Whitney).
//
// The statistics and normal approximation (mean, tie-corrected variance, direction of the continuity correction) use
// the same formulas as scipy.stats wilcoxon (zero_method = "wilcox") and mannwhitneyu (scipy/stats/_wilcoxon.py, _mannwhitneyu.py;
// SciPy commit a087e61, BSD-3-Clause, see THIRD_PARTY_NOTICES.md). Intervals and estimates follow Hodges & Lehmann (1963)
// and Bauer (1972): the exact method uses order statistics of the Walsh averages (differences for two samples); the normal
// approximation finds where the standardised statistic crosses the quantile by root finding (src/internal/uniroot.ts).
// The switch between exact and normal approximation, handling of intervals that cannot be formed, and names follow observed R output.
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
 */
export function wilcoxTest(
  x: Sample,
  y?: Sample | WilcoxTestOptions,
  options: WilcoxTestOptions = {},
): WilcoxTestResult {
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

interface CIPart {
  confInt: [number, number];
  confLevel: number;
  estimate: number;
  estimateNames?: string;
}

/** Interval from order statistics of the Walsh averages (x_i + x_j) / 2 (i <= j) (Bauer 1972) and the Hodges-Lehmann estimate */
function signedRankExactCI(x: readonly number[], ctx: Context): CIPart {
  const n = x.length;
  const walsh: number[] = [];
  for (let i = 0; i < n; i++)
    for (let j = i; j < n; j++) walsh.push((x[i]! + x[j]!) / 2);
  walsh.sort(ascending);
  const total = walsh.length;
  const alpha = 1 - ctx.confLevel;
  let confInt: [number, number];
  let achieved: number;
  if (ctx.alternative === "two.sided") {
    const qu = Math.max(1, qsignrank1(alpha / 2, n, true, false));
    achieved = 2 * psignrank1(qu - 1, n, true, false);
    confInt = [walsh[qu - 1]!, walsh[total - qu]!];
  } else {
    const qu = Math.max(1, qsignrank1(alpha, n, true, false));
    achieved = psignrank1(qu - 1, n, true, false);
    confInt =
      ctx.alternative === "greater"
        ? [walsh[qu - 1]!, Infinity]
        : [-Infinity, walsh[total - qu]!];
  }
  // An unreachable confidence level is replaced by the achieved level (2 significant digits)
  const confLevel =
    achieved - alpha > alpha / 2 ? 1 - signif2(achieved) : ctx.confLevel;
  return {
    confInt,
    confLevel,
    estimate: sortedMedian(walsh),
    estimateNames: "(pseudo)median",
  };
}

/** When the interval cannot be formed (NaN endpoints, confidence level 0) */
function emptyInterval(alternative: Alternative): [number, number] {
  if (alternative === "less") return [-Infinity, NaN];
  if (alternative === "greater") return [NaN, Infinity];
  return [NaN, NaN];
}

/** Normal-approximation interval and estimate: root finding for where the standardised statistic crosses the quantile */
function signedRankNormalCI(x: readonly number[], ctx: Context): CIPart {
  const { alternative, tolRoot } = ctx;
  const n = x.length;
  if (n === 0)
    return { confInt: emptyInterval(alternative), confLevel: 0, estimate: NaN };
  let mumin = Infinity;
  let mumax = -Infinity;
  for (const v of x) {
    mumin = Math.min(mumin, v);
    mumax = Math.max(mumax, v);
  }
  // With infinite endpoints, or a single point / all values equal, no interval can be formed (the estimate is the midrange)
  if (
    !Number.isFinite(mumin) ||
    !Number.isFinite(mumax) ||
    n === 1 ||
    mumin === mumax
  ) {
    return {
      confInt: emptyInterval(alternative),
      confLevel: 0,
      estimate: (mumin + mumax) / 2,
      estimateNames: "midrange",
    };
  }
  // Standardised statistic of x - d minus zq (a decreasing step function of d)
  const wdiff = (d: number, zq: number, correct: boolean): number => {
    const xd = x.map((v) => v - d).filter((v) => v !== 0);
    const [, dz, sigma] = signedRankStat(xd);
    return (dz - correction(dz, alternative, correct)) / sigma - zq;
  };
  const root = (zq: number, correct: boolean): number => {
    const f = (d: number): number => wdiff(d, zq, correct);
    if (!(tolRoot > 0)) throw new RangeError("tolRoot must be positive");
    return uniroot(f, mumin, mumax, { tol: tolRoot });
  };

  let alpha = 1 - ctx.confLevel;
  let raised = false;
  // If an interval endpoint falls outside the range, double α
  for (;;) {
    let ok: boolean;
    if (alternative === "two.sided") {
      ok =
        !(
          wdiff(mumin, qnorm(alpha / 2, { lowerTail: false }), ctx.correct) < 0
        ) && !(wdiff(mumax, qnorm(alpha / 2), ctx.correct) > 0);
    } else if (alternative === "greater") {
      ok = !(wdiff(mumin, qnorm(alpha, { lowerTail: false }), ctx.correct) < 0);
    } else {
      // R uses the α/2 quantile for the "less" check as well
      ok = !(wdiff(mumax, qnorm(alpha / 2), ctx.correct) > 0);
    }
    if (ok || alpha >= 1) break;
    alpha *= 2;
    raised = true;
  }
  const confLevel = raised ? 1 - Math.min(1, alpha) : ctx.confLevel;
  let confInt: [number, number];
  if (alpha >= 1) {
    const m = sortedMedian([...x].sort(ascending));
    confInt =
      alternative === "less"
        ? [-Infinity, m]
        : alternative === "greater"
          ? [m, Infinity]
          : [m, m];
  } else if (alternative === "two.sided") {
    confInt = [
      root(qnorm(alpha / 2, { lowerTail: false }), ctx.correct),
      root(qnorm(alpha / 2), ctx.correct),
    ];
  } else if (alternative === "greater") {
    confInt = [root(qnorm(alpha, { lowerTail: false }), ctx.correct), Infinity];
  } else {
    confInt = [-Infinity, root(qnorm(alpha), ctx.correct)];
  }
  // The estimate has no continuity correction (its direction depends on alternative)
  const estimate = root(0, false);
  return { confInt, confLevel, estimate, estimateNames: "(pseudo)median" };
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

/** Interval from order statistics of the differences x_i - y_j, and the Hodges-Lehmann estimate */
function rankSumExactCI(
  x: readonly number[],
  y: readonly number[],
  ctx: Context,
): CIPart {
  const nx = x.length;
  const ny = y.length;
  const diffs: number[] = [];
  for (const a of x) for (const b of y) diffs.push(a - b);
  diffs.sort(ascending);
  const total = diffs.length;
  const alpha = 1 - ctx.confLevel;
  let confInt: [number, number];
  let achieved: number;
  if (ctx.alternative === "two.sided") {
    const qu = Math.max(1, qwilcox1(alpha / 2, nx, ny, true, false));
    achieved = 2 * pwilcox1(qu - 1, nx, ny, true, false);
    confInt = [diffs[qu - 1]!, diffs[total - qu]!];
  } else {
    const qu = Math.max(1, qwilcox1(alpha, nx, ny, true, false));
    achieved = pwilcox1(qu - 1, nx, ny, true, false);
    confInt =
      ctx.alternative === "greater"
        ? [diffs[qu - 1]!, Infinity]
        : [-Infinity, diffs[total - qu]!];
  }
  // An unreachable confidence level is replaced by the achieved level (unlike the signed rank case, not rounded)
  const confLevel = achieved - alpha > alpha / 2 ? 1 - achieved : ctx.confLevel;
  return {
    confInt,
    confLevel,
    estimate: sortedMedian(diffs),
    estimateNames: "difference in location",
  };
}

function rankSumNormalCI(
  x: readonly number[],
  y: readonly number[],
  ctx: Context,
): CIPart {
  const { alternative, tolRoot } = ctx;
  let mumin = Infinity;
  let mumax = -Infinity;
  for (const a of x) {
    for (const b of y) {
      mumin = Math.min(mumin, a - b);
      mumax = Math.max(mumax, a - b);
    }
  }
  if (!Number.isFinite(mumin) || !Number.isFinite(mumax)) {
    throw new Error("cannot compute the confidence interval because the differences are not finite");
  }
  const wdiff = (d: number, zq: number, correct: boolean): number => {
    const [, dz, sigma] = rankSumStat(
      x.map((v) => v - d),
      y,
    );
    return (dz - correction(dz, alternative, correct)) / sigma - zq;
  };
  // If the quantile is not reached at the ends, return the ends
  const root = (zq: number, correct: boolean): number => {
    const f = (d: number): number => wdiff(d, zq, correct);
    const fLower = f(mumin);
    const fUpper = f(mumax);
    if (Number.isNaN(fLower) || Number.isNaN(fUpper)) {
      throw new Error("cannot compute the confidence interval because all observations are tied");
    }
    if (fLower <= 0) return mumin;
    if (fUpper >= 0) return mumax;
    if (!(tolRoot > 0)) throw new RangeError("tolRoot must be positive");
    return uniroot(f, mumin, mumax, { tol: tolRoot, fLower, fUpper });
  };
  const alpha = 1 - ctx.confLevel;
  let confInt: [number, number];
  if (alternative === "two.sided") {
    confInt = [
      root(qnorm(alpha / 2, { lowerTail: false }), ctx.correct),
      root(qnorm(alpha / 2), ctx.correct),
    ];
  } else if (alternative === "greater") {
    confInt = [root(qnorm(alpha, { lowerTail: false }), ctx.correct), Infinity];
  } else {
    confInt = [-Infinity, root(qnorm(alpha), ctx.correct)];
  }
  return {
    confInt,
    confLevel: ctx.confLevel,
    estimate: root(0, false),
    estimateNames: "difference in location",
  };
}
