// Cochran-Mantel-Haenszel tests for stratified contingency tables (R's mantelhaen.test).
//
// Written for rStats.js from the published methods and R's behaviour:
// - 2 x 2 x K: the Mantel-Haenszel statistic (|sum a - sum E(a)| - c)^2 / sum Var(a) with E(a) = r1 c1 / t and
//   Var(a) = r1 r2 c1 c2 / (t^2 (t - 1)) per stratum (Mantel and Haenszel, JNCI 22, 1959), continuity correction
//   c = 1/2 unless |sum a - sum E(a)| < 1/2; the Mantel-Haenszel common odds ratio sum(a d / t) / sum(b c / t), with
//   the interval from the variance of its log by Robins, Breslow and Greenland (Biometrics 42, 1986).
// - 2 x 2 x K exact (exact = TRUE): the conditional distribution of S = sum a given all margins, a convolution of
//   noncentral hypergeometric distributions with the common odds ratio as noncentrality (src/htest/core/mantelhaen.ts;
//   Birch, JRSS B 26, 1964). One-sided p-values are tail probabilities under psi = 1; the two-sided p-value adds the
//   null probabilities no larger than the observed one (relative slack 1e-7), and the estimate and limits are the
//   conditional MLE and the noncentralities at which a one-sided probability equals alpha.
// - I x J x K: the generalized statistic (n - m)' V^-1 (n - m) on the first (I - 1)(J - 1) cells summed over strata,
//   with the hypergeometric covariance V = (t^2 (t - 1))^-1 (t diag(r) - r r') (x) (t diag(c) - c c') per stratum
//   (Landis, Heyman and Koch, Int. Stat. Review 46, 1978); chi-squared with (I - 1)(J - 1) degrees of freedom.

import { pgamma1 } from "../distributions/gamma.js";
import { pnorm, qnorm } from "../distributions/normal.js";
import { solve } from "../linalg/solve.js";
import { squareOver } from "../internal/summary.js";
import { ddAdd, type DD } from "../special/dd.js";
import { ConvolvedNoncentralHyper, conditionalMLE, lowerLimit, upperLimit, type Stratum } from "./core/mantelhaen.js";
import { checkConfLevelOpen, matchAlternative, type Alternative, type HTest } from "./types.js";

/**
 * Options for {@link mantelhaenTest}.
 *
 * @category Hypothesis tests
 */
export interface MantelhaenTestOptions {
  /** Alternative hypothesis (2 x 2 x K only). Default `"two.sided"`. */
  alternative?: Alternative | "two" | "l" | "g";
  /** Continuity correction (2 x 2 x K, asymptotic test). Default `true`. */
  correct?: boolean;
  /** Exact conditional test (2 x 2 x K). Default `false`. */
  exact?: boolean;
  /** Confidence level of the interval for the common odds ratio. Default `0.95`. */
  confLevel?: number;
}

/**
 * Result of {@link mantelhaenTest}. 2 x 2 x K tables add the common odds ratio and its interval.
 *
 * @category Hypothesis tests
 */
export interface MantelhaenTestResult extends Omit<HTest, "alternative"> {
  /** Present for 2 x 2 x K tables. */
  alternative?: Alternative;
}

/**
 * Cochran-Mantel-Haenszel chi-squared test of conditional independence in a set of contingency tables, one per
 * stratum. Equivalent to R's `mantelhaen.test()`. Takes the strata as R takes a three-dimensional array.
 *
 * @param strata The K strata, each an I x J table of counts as an array of rows (all of the same shape; I, J >= 2,
 *   K >= 2 for the asymptotic test).
 * @param options See {@link MantelhaenTestOptions}.
 *
 * @example
 * ```ts
 * const r = mantelhaenTest([
 *   [[10, 5], [4, 12]],
 *   [[8, 6], [5, 9]],
 *   [[12, 4], [6, 10]],
 * ]);
 * r.statistic; // 8.972595458903124
 * r.pValue;    // 0.002740590103473906
 * r.estimate;  // 4.13218122372723 (common odds ratio)
 * ```
 *
 * @category Hypothesis tests
 */
export function mantelhaenTest(
  strata: readonly (readonly (readonly number[])[])[],
  options: MantelhaenTestOptions = {},
): MantelhaenTestResult {
  const K = strata.length;
  if (K < 1) throw new RangeError("'x' must have at least one stratum");
  const I = strata[0]!.length;
  const J = strata[0]![0]?.length ?? 0;
  if (I < 2 || J < 2 || K < 2) throw new RangeError("each dimension in table must be >= 2");
  for (const t of strata) {
    if (t.length !== I || t.some((r) => r.length !== J)) throw new RangeError("all strata must have the same dimensions");
    if (t.some((r) => r.some((v) => !Number.isFinite(v) || v < 0))) throw new RangeError("all entries of 'x' must be nonnegative and finite");
  }
  const totals = strata.map((t) => t.reduce((a, r) => a + r.reduce((b, v) => b + v, 0), 0));
  if (totals.some((t) => t < 2)) throw new RangeError("sample size in each stratum must be > 1");
  const alternative = matchAlternative(options.alternative);
  const correct = options.correct ?? true;
  const exact = options.exact ?? false;
  const confLevel = options.confLevel ?? 0.95;
  checkConfLevelOpen(confLevel);

  if (I === 2 && J === 2) {
    const tables = strata.map((t) => [[t[0]![0]!, t[0]![1]!], [t[1]![0]!, t[1]![1]!]] as const);
    return exact ? exact2x2xK(tables, alternative, confLevel) : asymptotic2x2xK(tables, totals, alternative, correct, confLevel);
  }
  // as in R, exact applies to 2 x 2 x K tables only and is ignored otherwise
  return general(strata, totals, I, J);
}

function asymptotic2x2xK(
  tables: readonly Stratum[],
  totals: readonly number[],
  alternative: Alternative,
  correct: boolean,
  confLevel: number,
): MantelhaenTestResult {
  let sa = 0;
  let se = 0;
  let sv = 0;
  let sR = 0;
  let sS = 0;
  let sPR = 0;
  let sPSQR = 0;
  let sQS = 0;
  tables.forEach(([[a, b], [c, d]], k) => {
    const t = totals[k]!;
    const r1 = a + b;
    const r2 = c + d;
    const c1 = a + c;
    const c2 = b + d;
    sa += a;
    se += (r1 * c1) / t;
    sv += (r1 * r2 * c1 * c2) / (t * t * (t - 1));
    const P = (a + d) / t;
    const Q = (b + c) / t;
    const R = (a * d) / t;
    const S = (b * c) / t;
    sR += R;
    sS += S;
    sPR += P * R;
    sPSQR += P * S + Q * R;
    sQS += Q * S;
  });
  const delta = sa - se;
  const yates = correct && Math.abs(delta) >= 0.5 ? 0.5 : 0;
  const statistic = squareOver(Math.abs(delta) - yates, sv);
  const pValue =
    alternative === "two.sided"
      ? pgamma1(statistic, 0.5, 2, false, false)
      : pnorm(Math.sign(delta) * Math.sqrt(statistic), { lowerTail: alternative === "less" });
  const estimate = sR / sS;
  const sd = Math.sqrt(sPR / (2 * sR * sR) + sPSQR / (2 * sR * sS) + sQS / (2 * sS * sS));
  let confInt: [number, number];
  if (alternative === "less") confInt = [0, estimate * Math.exp(qnorm(confLevel) * sd)];
  else if (alternative === "greater") confInt = [estimate * Math.exp(qnorm(confLevel, { lowerTail: false }) * sd), Infinity];
  else {
    const z = qnorm((1 + confLevel) / 2);
    confInt = [estimate * Math.exp(-z * sd), estimate * Math.exp(z * sd)];
  }
  return {
    method: `Mantel-Haenszel chi-squared test ${yates !== 0 ? "with" : "without"} continuity correction`,
    alternative,
    statistic,
    statisticName: "Mantel-Haenszel X-squared",
    parameter: 1,
    parameterName: "df",
    pValue,
    confInt,
    confLevel,
    estimate,
    estimateNames: "common odds ratio",
    nullValue: 1,
    nullValueName: "common odds ratio",
  };
}


/** Exact conditional test on 2 x 2 x K tables: S = sum of the (1, 1) cells given all margins */
function exact2x2xK(tables: readonly Stratum[], alternative: Alternative, confLevel: number): MantelhaenTestResult {
  const h = new ConvolvedNoncentralHyper(tables);
  const s = tables.reduce((acc, t) => acc + t[0][0], 0);
  let pValue: number;
  if (alternative === "two.sided") {
    // add the null probabilities of the sums no more likely than the observed one (relative slack 1e-7)
    const d0 = h.density(1);
    const cut = d0[s - h.lo]! * (1 + 1e-7);
    let acc: DD = [0, 0];
    for (const v of d0) if (v <= cut) acc = ddAdd(acc, [v, 0]);
    pValue = Math.min(1, acc[0]);
  } else pValue = h.cdf(s, 1, alternative === "greater");
  let confInt: [number, number];
  if (alternative === "less") confInt = [0, upperLimit(h, s, 1 - confLevel)];
  else if (alternative === "greater") confInt = [lowerLimit(h, s, 1 - confLevel), Infinity];
  else {
    const alpha = (1 - confLevel) / 2;
    confInt = [lowerLimit(h, s, alpha), upperLimit(h, s, alpha)];
  }
  return {
    method: "Exact conditional test of independence in 2 x 2 x k tables",
    alternative,
    statistic: s,
    statisticName: "S",
    pValue,
    confInt,
    confLevel,
    estimate: conditionalMLE(h, s),
    estimateNames: "common odds ratio",
    nullValue: 1,
    nullValueName: "common odds ratio",
  };
}

function general(
  strata: readonly (readonly (readonly number[])[])[],
  totals: readonly number[],
  I: number,
  J: number,
): MantelhaenTestResult {
  const p = (I - 1) * (J - 1);
  const diff = new Array<number>(p).fill(0);
  const V = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  strata.forEach((tab, k) => {
    const t = totals[k]!;
    const r = tab.map((row) => row.reduce((a, b) => a + b, 0));
    const c = Array.from({ length: J }, (_, j) => tab.reduce((a, row) => a + row[j]!, 0));
    const f = 1 / (t * t * (t - 1));
    // cell (i, j) of the first I - 1 rows and J - 1 columns is element i + (I - 1) j (column-major, as in R)
    for (let j = 0; j < J - 1; j++) {
      for (let i = 0; i < I - 1; i++) {
        const u = i + (I - 1) * j;
        diff[u]! += tab[i]![j]! - (r[i]! * c[j]!) / t;
        for (let jj = 0; jj < J - 1; jj++) {
          for (let ii = 0; ii < I - 1; ii++) {
            const vr = (i === ii ? t * r[i]! : 0) - r[i]! * r[ii]!;
            const vc = (j === jj ? t * c[j]! : 0) - c[j]! * c[jj]!;
            V[u]![ii + (I - 1) * jj]! += f * vr * vc;
          }
        }
      }
    }
  });
  const sol = solve(V, diff);
  let statistic = 0;
  for (let u = 0; u < p; u++) statistic += diff[u]! * sol[u]!;
  return {
    method: "Cochran-Mantel-Haenszel test",
    statistic,
    statisticName: "Cochran-Mantel-Haenszel M^2",
    parameter: p,
    parameterName: "df",
    pValue: pgamma1(statistic, p / 2, 2, false, false),
  };
}
