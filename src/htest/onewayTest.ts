// One-way analysis of means (R's oneway.test) and the Shapiro-Wilk normality test (R's shapiro.test).
//
// Written for rStats.js from the published formulas (no ported code). oneway.test: with equal variances the classical
// F = (sum n_i (m_i - m)^2 / (k - 1)) / (sum (n_i - 1) s_i^2 / (N - k)); otherwise Welch's (Biometrika 38, 1951)
// weighted statistic with w_i = n_i / s_i^2, F = sum w_i (m_i - m_w)^2 / ((k - 1)(1 + 2 (k - 2) c)),
// c = sum (1 - w_i / sum w)^2 / (n_i - 1) / (k^2 - 1), on (k - 1, 1 / (3 c)) degrees of freedom.
// shapiro.test: W and its p-value from src/htest/core/shapiro.ts (Royston's AS R94).

import { pf1 } from "../distributions/f.js";
import { mean, variance } from "../internal/summary.js";
import { swilkOneMinusW, swilkPValueFromOneMinusW } from "./core/shapiro.js";
import type { DataFrame } from "../models/modelFrame.js";
import { toGroups, type GroupLabel } from "./groups.js";
import { onewayData } from "./testFormula.js";
import type { HTest, Sample } from "./types.js";

/** Options for {@link onewayTest}. */
export interface OnewayTestOptions {
  /** Assume equal variances (the classical F test). Default `false` (Welch's test). */
  varEqual?: boolean;
}

/** Result of {@link onewayTest}: an F statistic with two degrees of freedom. */
export interface OnewayTestResult extends Omit<HTest, "alternative" | "parameter" | "parameterName"> {
  /** `[num df, denom df]`. */
  parameter: [number, number];
  parameterName: [string, string];
}

/**
 * Test that several normal samples have equal means, without (default) or with the assumption of equal variances.
 * Equivalent to R's `oneway.test()`.
 *
 * @param x An array of samples, or one sample with group labels `g`.
 * @param g Group labels, parallel to `x` (or the options, when `x` is an array of samples).
 *
 * There is also a formula form, `onewayTest("y ~ A + B", data, options)` (next overload).
 */
export function onewayTest(
  x: Sample | readonly Sample[],
  g?: readonly GroupLabel[] | OnewayTestOptions,
  options?: OnewayTestOptions,
): OnewayTestResult;
/**
 * One-way analysis of means from a formula and a data frame. Equivalent to R's `oneway.test(formula, data)`:
 * `"y ~ A"` has one group per level of `A`; with several factors, `"y ~ A + B"`, the groups are the combinations of
 * their levels present in the data (R's `interaction()`, the first factor varying fastest). Only the variables of
 * the formula count: the rows where one of them is missing are dropped.
 *
 * @param formula `"y ~ A"` or `"y ~ A + B + ..."`.
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 * @param options See {@link OnewayTestOptions}.
 */
export function onewayTest(formula: string, data: DataFrame, options?: OnewayTestOptions): OnewayTestResult;
export function onewayTest(
  x: Sample | readonly Sample[] | string,
  g?: readonly GroupLabel[] | OnewayTestOptions | DataFrame,
  options: OnewayTestOptions = {},
): OnewayTestResult {
  if (typeof x === "string") {
    const d = onewayData(x, g as DataFrame);
    return onewayTest(d.values, d.groups, options);
  }
  let labels: readonly GroupLabel[] | undefined;
  if (g !== undefined && !Array.isArray(g)) options = g as OnewayTestOptions;
  else labels = g as readonly GroupLabel[] | undefined;
  const groups = toGroups(x, labels);
  const varEqual = options.varEqual ?? false;
  const k = groups.length;
  if (k < 2) throw new RangeError("not enough groups");
  const ni = groups.map((s) => s.length);
  if (ni.some((n) => n < 2)) throw new RangeError("not enough observations");
  const mi = groups.map(mean);
  const vi = groups.map(variance);
  const N = ni.reduce((a, b) => a + b, 0);
  let statistic: number;
  let df2: number;
  if (varEqual) {
    const m = mean(groups.flat());
    let between = 0;
    let within = 0;
    for (let i = 0; i < k; i++) {
      between += ni[i]! * (mi[i]! - m) ** 2;
      within += (ni[i]! - 1) * vi[i]!;
    }
    df2 = N - k;
    statistic = between / (k - 1) / (within / df2);
  } else {
    const wi = ni.map((n, i) => n / vi[i]!);
    const sw = wi.reduce((a, b) => a + b, 0);
    let c = 0;
    let mw = 0;
    for (let i = 0; i < k; i++) {
      c += (1 - wi[i]! / sw) ** 2 / (ni[i]! - 1);
      mw += wi[i]! * mi[i]!;
    }
    c /= k * k - 1;
    mw /= sw;
    let num = 0;
    for (let i = 0; i < k; i++) num += wi[i]! * (mi[i]! - mw) ** 2;
    statistic = num / ((k - 1) * (1 + 2 * (k - 2) * c));
    df2 = 1 / (3 * c);
  }
  return {
    method: varEqual ? "One-way analysis of means" : "One-way analysis of means (not assuming equal variances)",
    statistic,
    statisticName: "F",
    parameter: [k - 1, df2],
    parameterName: ["num df", "denom df"],
    pValue: pf1(statistic, k - 1, df2, false, false),
  };
}

/**
 * Shapiro-Wilk test of normality. Equivalent to R's `shapiro.test()`. `NaN` values are dropped; the sample size must
 * be between 3 and 5000.
 */
export function shapiroTest(x: Sample): Omit<HTest, "alternative"> {
  const xs = Array.from(x)
    .filter((v) => !Number.isNaN(v))
    .sort((a, b) => a - b);
  const n = xs.length;
  if (n < 3 || n > 5000) throw new RangeError("sample size must be between 3 and 5000");
  if (!Number.isFinite(xs[0]!) || !Number.isFinite(xs[n - 1]!)) throw new RangeError("'x' must be finite");
  if (xs[n - 1]! === xs[0]!) throw new RangeError("all 'x' values are identical");
  const w1 = swilkOneMinusW(xs);
  return {
    method: "Shapiro-Wilk normality test",
    statistic: 1 - w1,
    statisticName: "W",
    pValue: swilkPValueFromOneMinusW(w1, n),
  };
}
