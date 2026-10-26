// Brunner-Munzel test for the relative effect of two samples (lawstat's brunner.munzel.test).
//
// Written for rStats.js from the published test (E. Brunner and U. Munzel, "The nonparametric Behrens-Fisher problem:
// asymptotic theory and a small-sample approximation", Biometrical Journal 42 (2000) 17-25; no ported code).
// With R_k the pooled (mid)ranks, R^(i)_k the ranks within sample i and m_i the mean pooled rank of sample i, the
// relative effect p = P(X < Y) + P(X = Y)/2 is estimated by (m_2 - (n_2 + 1)/2) / n_1, the variances by
// S_i^2 = sum_k (R_k - R^(i)_k - m_i + (n_i + 1)/2)^2 / (n_i - 1), and the statistic
//   W = n_1 n_2 (m_2 - m_1) / ((n_1 + n_2) sqrt(n_1 S_1^2 + n_2 S_2^2))
// is compared with a t distribution with Satterthwaite's degrees of freedom
//   (n_1 S_1^2 + n_2 S_2^2)^2 / ((n_1 S_1^2)^2 / (n_1 - 1) + (n_2 S_2^2)^2 / (n_2 - 1)).
// The interval for p is two-sided, p ± t sqrt(S_1^2 / (n_1 n_2^2) + S_2^2 / (n_2 n_1^2)), whatever the alternative.
// The direction of the alternative, the interval, and NaN / ±Inf where a variance estimate is 0 follow lawstat's
// documented and observed behaviour; the p-values use the upper tail directly (lawstat's 1 - pt loses small ones).

import { pt1, qt1 } from "../distributions/t.js";
import { rank } from "../internal/summary.js";
import { checkConfLevel, matchAlternative, type Alternative, type HTest, type Sample } from "./types.js";

/** Options for {@link brunnerMunzelTest}. */
export interface BrunnerMunzelTestOptions {
  /**
   * Alternative hypothesis (unambiguous abbreviations accepted). Default `"two.sided"`. As in lawstat, `"greater"`
   * means that `x` tends to be larger than `y` (the relative effect is below 1/2) and `"less"` the opposite.
   */
  alternative?: Alternative | "two" | "l" | "g";
  /** Confidence level of the interval for the relative effect (lawstat's `1 - alpha`). Default `0.95`. */
  confLevel?: number;
}

/**
 * Brunner-Munzel test that two samples have the relative effect P(X < Y) + P(X = Y)/2 = 1/2, without assuming equal
 * variances or shapes. Equivalent to `lawstat::brunner.munzel.test()` in R. `NaN` values are dropped.
 *
 * `estimate` is the estimated relative effect and `confInt` its two-sided interval (not clipped to [0, 1]). When a
 * sample has one value, or when the variance estimates are 0 (for example completely separated samples), the
 * statistic, degrees of freedom and p-value are `NaN` or ±Infinity, as in lawstat.
 *
 * @example
 * ```ts
 * const r = brunnerMunzelTest([1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 4, 1, 1], [3, 3, 4, 3, 1, 2, 3, 1, 1, 5, 4]);
 * r.statistic; // 3.1374674823029509
 * r.pValue;    // 0.0057862086661514605
 * r.estimate;  // 0.78896103896103909
 * ```
 */
export function brunnerMunzelTest(x: Sample, y: Sample, options: BrunnerMunzelTestOptions = {}): HTest {
  const xs = Array.from(x).filter((v) => !Number.isNaN(v));
  const ys = Array.from(y).filter((v) => !Number.isNaN(v));
  const n1 = xs.length;
  const n2 = ys.length;
  if (n1 < 1) throw new RangeError("not enough 'x' observations");
  if (n2 < 1) throw new RangeError("not enough 'y' observations");
  const alternative = matchAlternative(options.alternative);
  const confLevel = options.confLevel ?? 0.95;
  checkConfLevel(confLevel);

  const pooled = rank(xs.concat(ys));
  const r1 = pooled.slice(0, n1);
  const r2 = pooled.slice(n1);
  const mean = (v: number[]): number => v.reduce((s, e) => s + e, 0) / v.length;
  const m1 = mean(r1);
  const m2 = mean(r2);
  // S_i^2 from the pooled ranks minus the ranks within the sample (the placements)
  const variance = (r: number[], within: number[], m: number): number => {
    const c = (r.length + 1) / 2;
    let s = 0;
    for (let k = 0; k < r.length; k++) s += (r[k]! - within[k]! - m + c) ** 2;
    return s / (r.length - 1);
  };
  const v1 = variance(r1, rank(xs), m1);
  const v2 = variance(r2, rank(ys), m2);

  const estimate = (m2 - (n2 + 1) / 2) / n1;
  const s = n1 * v1 + n2 * v2;
  const statistic = (n1 * n2 * (m2 - m1)) / (n1 + n2) / Math.sqrt(s);
  const df = s ** 2 / ((n1 * v1) ** 2 / (n1 - 1) + (n2 * v2) ** 2 / (n2 - 1));

  let pValue: number;
  if (alternative === "greater") pValue = pt1(statistic, df, true, false);
  else if (alternative === "less") pValue = pt1(statistic, df, false, false);
  else pValue = 2 * pt1(-Math.abs(statistic), df, true, false);

  const half = qt1((1 - confLevel) / 2, df, false, false) * Math.sqrt(v1 / (n1 * n2 ** 2) + v2 / (n2 * n1 ** 2));
  return {
    method: "Brunner-Munzel Test",
    alternative,
    statistic,
    statisticName: "Brunner-Munzel Test Statistic",
    parameter: df,
    parameterName: "df",
    pValue,
    confInt: [estimate - half, estimate + half],
    confLevel,
    estimate,
    estimateNames: "P(X<Y)+.5*P(X=Y)",
  };
}
