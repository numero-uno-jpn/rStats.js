// Tests of normality as the nortest package computes them: Anderson-Darling (ad.test), Cramer-von Mises (cvm.test),
// Lilliefors' Kolmogorov-Smirnov (lillie.test), Shapiro-Francia (sf.test) and the Pearson chi-square test
// (pearson.test), each with the composite hypothesis (mean and standard deviation estimated).
//
// Written for rStats.js from oracle/rm-tests-behaviour.md (no ported code; nortest's source was not read): the
// statistics from the standardised order statistics, the p-values from the closed-form approximations given there
// (piecewise exponentials of A and W, Dallal and Wilkinson's formula for D, a normal approximation of log(1 - W) for
// the Shapiro-Francia W), and the chi-square test on classes of equal probability.

import { pgamma1 } from "../distributions/gamma.js";
import { pnorm, qnorm } from "../distributions/normal.js";
import { covariance, dropNaN, mean, variance } from "../internal/summary.js";
import type { HTest, Sample } from "./types.js";

/**
 * Result of a normality test: no `alternative`, as nortest returns none.
 *
 * @category Hypothesis tests
 */
export type NormalityTestResult = Omit<HTest, "alternative">;

/**
 * Result of {@link cvmTest}, with nortest's warning for a p-value below the approximation's range.
 *
 * @category Hypothesis tests
 */
export interface CvmTestResult extends NormalityTestResult {
  /** Warnings, as nortest gives them (empty when there are none). */
  warnings: string[];
}

/** The sorted values without NaN */
function sorted(x: Sample): number[] {
  return dropNaN(Array.from(x)).sort((a, b) => a - b);
}

/** The sorted values standardised by their mean and standard deviation */
function standardized(xs: readonly number[]): number[] {
  const m = mean(xs);
  const s = Math.sqrt(variance(xs));
  if (!(s > 0)) throw new RangeError("all 'x' values are identical");
  return xs.map((v) => (v - m) / s);
}

/**
 * Anderson-Darling test for normality. Equivalent to `nortest::ad.test()` in R. `NaN` values are dropped; at least 8
 * values are needed.
 *
 * @example
 * ```ts
 * adTest([2.1, 3.4, 1.9, 5.6, 4.4, 3.8, 2.9, 4.1, 3.3, 2.6]).statistic; // 0.15414195923525043
 * ```
 *
 * @category Hypothesis tests
 */
export function adTest(x: Sample): NormalityTestResult {
  const xs = sorted(x);
  const n = xs.length;
  if (n < 8) throw new RangeError("sample size must be greater than 7");
  const z = standardized(xs);
  let s = 0;
  for (let i = 1; i <= n; i++) {
    s += (2 * i - 1) * (pnorm(z[i - 1]!, { logP: true }) + pnorm(z[n - i]!, { lowerTail: false, logP: true }));
  }
  const a = -n - s / n;
  const aa = (1 + 0.75 / n + 2.25 / n ** 2) * a;
  let pValue: number;
  if (aa < 0.2) pValue = 1 - Math.exp(-13.436 + 101.14 * aa - 223.73 * aa ** 2);
  else if (aa < 0.34) pValue = 1 - Math.exp(-8.318 + 42.796 * aa - 59.938 * aa ** 2);
  else if (aa < 0.6) pValue = Math.exp(0.9177 - 4.279 * aa - 1.38 * aa ** 2);
  else if (aa < 10) pValue = Math.exp(1.2937 - 5.709 * aa + 0.0186 * aa ** 2);
  else pValue = 3.7e-24;
  return { method: "Anderson-Darling normality test", statistic: a, statisticName: "A", pValue };
}

/**
 * Cramer-von Mises test for normality. Equivalent to `nortest::cvm.test()` in R. `NaN` values are dropped; at least 8
 * values are needed.
 *
 * @example
 * ```ts
 * const x = [2.1, 3.4, 1.9, 5.6, 4.4, 3.3, 2.8, 4.1, 3.9, 6.2];
 * cvmTest(x).pValue; // 0.8725514730213816
 * ```
 *
 * @category Hypothesis tests
 */
export function cvmTest(x: Sample): CvmTestResult {
  const xs = sorted(x);
  const n = xs.length;
  if (n < 8) throw new RangeError("sample size must be greater than 7");
  const z = standardized(xs);
  let w = 1 / (12 * n);
  z.forEach((zi, k) => {
    w += (pnorm(zi) - (2 * (k + 1) - 1) / (2 * n)) ** 2;
  });
  const ww = (1 + 0.5 / n) * w;
  const warnings: string[] = [];
  let pValue: number;
  if (ww < 0.0275) pValue = 1 - Math.exp(-13.953 + 775.5 * ww - 12542.61 * ww ** 2);
  else if (ww < 0.051) pValue = 1 - Math.exp(-5.903 + 179.546 * ww - 1515.29 * ww ** 2);
  else if (ww < 0.092) pValue = Math.exp(0.886 - 31.62 * ww + 10.897 * ww ** 2);
  else if (ww < 1.1) pValue = Math.exp(1.111 - 34.242 * ww + 12.832 * ww ** 2);
  else {
    pValue = 7.37e-10;
    warnings.push("p-value is smaller than 7.37e-10, cannot be computed more accurately");
  }
  return { method: "Cramer-von Mises normality test", statistic: w, statisticName: "W", pValue, warnings };
}

/**
 * Lilliefors (Kolmogorov-Smirnov) test for normality. Equivalent to `nortest::lillie.test()` in R. `NaN` values are
 * dropped; at least 5 values are needed.
 *
 * @example
 * ```ts
 * const x = [2.1, 3.4, 1.9, 5.6, 4.4, 3.3, 2.8, 4.1, 3.9, 6.2];
 * lillieTest(x).pValue; // 0.9287268902599117
 * ```
 *
 * @category Hypothesis tests
 */
export function lillieTest(x: Sample): NormalityTestResult {
  const xs = sorted(x);
  const n = xs.length;
  if (n < 5) throw new RangeError("sample size must be greater than 4");
  const p = standardized(xs).map((v) => pnorm(v));
  let dPlus = -Infinity;
  let dMinus = -Infinity;
  p.forEach((pi, k) => {
    dPlus = Math.max(dPlus, (k + 1) / n - pi);
    dMinus = Math.max(dMinus, pi - k / n);
  });
  const d = Math.max(dPlus, dMinus);
  const kd = n <= 100 ? d : d * (n / 100) ** 0.49;
  const nd = n <= 100 ? n : 100;
  let pValue = Math.exp(
    -7.01256 * kd ** 2 * (nd + 2.78019) + 2.99587 * kd * Math.sqrt(nd + 2.78019) - 0.122119 + 0.974598 / Math.sqrt(nd) + 1.67997 / nd,
  );
  if (pValue > 0.1) {
    const kk = (Math.sqrt(n) - 0.01 + 0.85 / Math.sqrt(n)) * d;
    if (kk <= 0.302) pValue = 1;
    else if (kk <= 0.5) pValue = 2.76773 - 19.828315 * kk + 80.709644 * kk ** 2 - 138.55152 * kk ** 3 + 81.218052 * kk ** 4;
    else if (kk <= 0.9) pValue = -4.901232 + 40.662806 * kk - 97.490286 * kk ** 2 + 94.029866 * kk ** 3 - 32.355711 * kk ** 4;
    else if (kk <= 1.31) pValue = 6.198765 - 19.558097 * kk + 23.186922 * kk ** 2 - 12.234627 * kk ** 3 + 2.423045 * kk ** 4;
    else pValue = 0;
  }
  return { method: "Lilliefors (Kolmogorov-Smirnov) normality test", statistic: d, statisticName: "D", pValue };
}

/**
 * Shapiro-Francia test for normality. Equivalent to `nortest::sf.test()` in R. `NaN` values are dropped; the sample
 * size must be between 5 and 5000.
 *
 * @example
 * ```ts
 * const x = [2.1, 3.4, 1.9, 5.6, 4.4, 3.3, 2.8, 4.1, 3.9, 6.2];
 * sfTest(x).pValue; // 0.8583583366365347
 * ```
 *
 * @category Hypothesis tests
 */
export function sfTest(x: Sample): NormalityTestResult {
  const xs = sorted(x);
  const n = xs.length;
  if (n < 5 || n > 5000) throw new RangeError("sample size must be between 5 and 5000");
  if (xs[0] === xs[n - 1]) throw new RangeError("all 'x' values are identical");
  const q = xs.map((_, k) => qnorm((k + 1 - 3 / 8) / (n + 1 / 4)));
  const w = covariance(xs, q) ** 2 / (variance(xs) * variance(q));
  const u = Math.log(n);
  const v = Math.log(u);
  const mu = -1.2725 + 1.0521 * (v - u);
  const sig = 1.0308 - 0.26758 * (v + 2 / u);
  const pValue = pnorm((Math.log(1 - w) - mu) / sig, { lowerTail: false });
  return { method: "Shapiro-Francia normality test", statistic: w, statisticName: "W", pValue };
}

/**
 * Options for {@link pearsonTest}.
 *
 * @category Hypothesis tests
 */
export interface PearsonTestOptions {
  /** Number of classes. Default `ceil(2 n^(2/5))`. */
  nClasses?: number;
  /** Subtract the 2 estimated parameters from the degrees of freedom. Default `true`. */
  adjust?: boolean;
}

/**
 * Pearson chi-square test for normality, with classes of equal probability under the fitted normal distribution.
 * Equivalent to `nortest::pearson.test()` in R. `NaN` values are dropped.
 *
 * @example
 * ```ts
 * const x = [2.1, 3.4, 1.9, 5.6, 4.4, 3.3, 2.8, 4.1, 3.9, 6.2];
 * pearsonTest(x).pValue; // 0.8494670333918255
 * ```
 *
 * @category Hypothesis tests
 */
export function pearsonTest(x: Sample, options: PearsonTestOptions = {}): NormalityTestResult {
  const xs = sorted(x);
  const n = xs.length;
  const k = options.nClasses ?? Math.ceil(2 * n ** (2 / 5));
  const adjust = options.adjust ?? true;
  if (!(Number.isInteger(k) && k - 1 - (adjust ? 2 : 0) > 0)) throw new RangeError("'nClasses' must be an integer leaving positive degrees of freedom");
  const counts = new Array<number>(k).fill(0);
  for (const z of standardized(xs)) {
    const c = Math.floor(1 + k * pnorm(z));
    if (c >= 1 && c <= k) counts[c - 1]!++;
  }
  const e = n / k;
  const statistic = counts.reduce((a, c) => a + (c - e) ** 2 / e, 0);
  const df = k - 1 - (adjust ? 2 : 0);
  return {
    method: "Pearson chi-square normality test",
    statistic,
    statisticName: "P",
    pValue: pgamma1(statistic, df / 2, 2, false, false),
  };
}
