// Kolmogorov-Smirnov tests (R's ks.test): one sample against a continuous distribution function, or two samples.
//
// Written for rStats.js (no ported code); the distributions are in src/htest/core (kolmogorov.ts, smirnov.ts).
// One sample: D+ = max(i/n - F(x_(i))), D- = max(F(x_(i)) - (i - 1)/n); exact p-values (by default for n < 100
// without ties) from Marsaglia, Tsang and Wang (two-sided) and Birnbaum and Tingey (one-sided), asymptotic ones from
// Kolmogorov's limit and exp(-2 n D^2). Two samples: the largest differences of the empirical distribution functions,
// taken only where the pooled sorted values change; exact p-values (by default for m n < 10000, with or without ties)
// by counting lattice paths, asymptotic ones as for one sample with n replaced by m n / (m + n).

import { pkolmogorovExact, pkolmogorovLimit, pkolmogorovOneSidedUpper } from "./core/kolmogorov.js";
import type { DataFrame } from "../models/modelFrame.js";
import { psmirnovUpper } from "./core/smirnov.js";
import { twoGroupData } from "./testFormula.js";
import { matchAlternative, type Alternative, type HTest, type Sample } from "./types.js";

/** Options for {@link ksTest}. */
export interface KsTestOptions {
  /**
   * Alternative hypothesis (unambiguous abbreviations accepted). `"greater"`: the distribution function of `x` lies
   * above that of `y` (statistic D^+); `"less"`: below (D^-). Default `"two.sided"`.
   */
  alternative?: Alternative | "two" | "l" | "g";
  /**
   * Exact p-value. Default: exact for one sample of fewer than 100 values without ties, and for two samples with
   * m n < 10000.
   */
  exact?: boolean;
}

/**
 * Result of {@link ksTest}. As in R, `alternative` describes the hypothesis in words ("two-sided", "the CDF of x lies
 * above the null hypothesis", ...), and `exact` tells whether the p-value is exact.
 */
export interface KsTestResult extends Omit<HTest, "alternative"> {
  /** Description of the alternative hypothesis, as R prints it (e.g. `"two-sided"`). */
  alternative: string;
  /** Whether the p-value is exact. */
  exact: boolean;
}

function describe(alternative: Alternative, oneSample: boolean): string {
  if (alternative === "two.sided") return "two-sided";
  const where = alternative === "less" ? "below" : "above";
  return `the CDF of x lies ${where} ${oneSample ? "the null hypothesis" : "that of y"}`;
}

/**
 * Kolmogorov-Smirnov test. Equivalent to R's `ks.test()`. Takes a distribution function given as a function (for
 * example `(q) => pnorm(q)`) or a second sample. `NaN` values are dropped.
 *
 * @param x Sample.
 * @param y A continuous distribution function, or a second sample.
 * @param options See {@link KsTestOptions}.
 *
 * There is also a formula form for two samples, `ksTest("y ~ g", data, options)` (next overload).
 *
 * @example
 * ```ts
 * const x = [0.61, -1.2, 0.33, 1.57, -0.42, 0.08, -0.85, 1.1];
 * ksTest(x, (q) => pnorm(q)).pValue; // 0.9716870044206776
 * ksTest(x, [0.9, 2.1, 1.4, 2.8, 1.7, 0.4]).statistic; // 0.625
 * ```
 */
export function ksTest(x: Sample, y: Sample | ((q: number) => number), options?: KsTestOptions): KsTestResult;
/**
 * Two-sample Kolmogorov-Smirnov test from a formula and a data frame. As R's `ks.test(formula, data)`:
 * `"y ~ g"` compares the two levels of `g` (the first level is `x`). Only the variables of the formula count: the
 * rows where one of them is missing are dropped.
 *
 * @param formula `"y ~ g"`.
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 * @param options See {@link KsTestOptions}.
 */
export function ksTest(formula: string, data: DataFrame, options?: KsTestOptions): KsTestResult;
export function ksTest(
  x: Sample | string,
  y: Sample | ((q: number) => number) | DataFrame,
  options: KsTestOptions = {},
): KsTestResult {
  if (typeof x === "string") {
    const d = twoGroupData(x, y as DataFrame);
    return ksTest(d.x, d.y, options);
  }
  const xs = Array.from(x)
    .filter((v) => !Number.isNaN(v))
    .sort((a, b) => a - b);
  const n = xs.length;
  if (n < 1) throw new RangeError("not enough 'x' data");
  const alternative = matchAlternative(options.alternative);
  const statisticName = alternative === "two.sided" ? "D" : alternative === "greater" ? "D^+" : "D^-";

  if (typeof y === "function") {
    let dplus = -Infinity;
    let dminus = -Infinity;
    for (let i = 0; i < n; i++) {
      const f = y(xs[i]!);
      dplus = Math.max(dplus, (i + 1) / n - f);
      dminus = Math.max(dminus, f - i / n);
    }
    const statistic = alternative === "two.sided" ? Math.max(dplus, dminus) : alternative === "greater" ? dplus : dminus;
    const ties = new Set(xs).size < n;
    const exact = options.exact ?? (n < 100 && !ties);
    let pValue: number;
    if (alternative === "two.sided") {
      pValue = exact ? 1 - pkolmogorovExact(n, statistic) : pkolmogorovLimit(Math.sqrt(n) * statistic, false);
    } else {
      pValue = exact ? pkolmogorovOneSidedUpper(n, statistic) : Math.exp(-2 * n * statistic * statistic);
    }
    return {
      method: `${exact ? "Exact" : "Asymptotic"} one-sample Kolmogorov-Smirnov test`,
      alternative: describe(alternative, true),
      exact,
      statistic,
      statisticName,
      pValue: Math.min(1, Math.max(0, pValue)),
    };
  }

  const ys = Array.from(y as Sample).filter((v) => !Number.isNaN(v));
  const m = ys.length;
  if (m < 1) throw new RangeError("not enough 'y' data");
  // walk the pooled sorted values, recording F_x - F_y after each run of equal values
  const pooled = xs.map((v) => [v, 0] as [number, number]).concat(ys.map((v) => [v, 1] as [number, number]));
  pooled.sort((a, b) => a[0] - b[0]);
  let fx = 0;
  let fy = 0;
  let dplus = 0;
  let dminus = 0;
  for (let i = 0; i < pooled.length; i++) {
    if (pooled[i]![1] === 0) fx++;
    else fy++;
    if (i + 1 < pooled.length && pooled[i + 1]![0] === pooled[i]![0]) continue;
    const diff = fx / n - fy / m;
    dplus = Math.max(dplus, diff);
    dminus = Math.max(dminus, -diff);
  }
  const statistic = alternative === "two.sided" ? Math.max(dplus, dminus) : alternative === "greater" ? dplus : dminus;
  const ties = new Set(pooled.map((p) => p[0])).size < pooled.length;
  const exact = options.exact ?? n * m < 10000;
  let pValue: number;
  if (exact) {
    pValue = psmirnovUpper(statistic, n, m, ties ? { alternative, z: pooled.map((p) => p[0]) } : { alternative });
  } else {
    const en = (n * m) / (n + m);
    pValue =
      alternative === "two.sided"
        ? pkolmogorovLimit(Math.sqrt(en) * statistic, false)
        : Math.exp(-2 * en * statistic * statistic);
  }
  return {
    method: `${exact ? "Exact" : "Asymptotic"} two-sample Kolmogorov-Smirnov test`,
    alternative: describe(alternative, false),
    exact,
    statistic,
    statisticName,
    pValue: Math.min(1, Math.max(0, pValue)),
  };
}
