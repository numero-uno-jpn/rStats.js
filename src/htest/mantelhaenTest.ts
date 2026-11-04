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
import { ldexp, productOver, squareOver } from "../internal/summary.js";
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
  const totals = strata.map(stratumTotal);
  if (totals.some((t) => t < 2)) throw new RangeError("sample size in each stratum must be > 1");
  const alternative = matchAlternative(options.alternative);
  const correct = options.correct ?? true;
  const exact = options.exact ?? false;
  const confLevel = options.confLevel ?? 0.95;
  checkConfLevelOpen(confLevel);

  if (I === 2 && J === 2) {
    // the exact conditional distribution is over integer tables (R takes fractional counts and returns a result)
    if (exact && strata.some((t) => t.some((r) => r.some((v) => !Number.isInteger(v))))) {
      throw new RangeError("the exact test needs integer counts");
    }
    // from 2^53 on the counts are not exact integers and the loop over a stratum's support does not advance (x + 1
    // rounds to x; #494); the total bounds every cell, margin and sum over the strata
    if (exact && totals.reduce((a, t) => a + t, 0) > Number.MAX_SAFE_INTEGER) {
      throw new RangeError("the exact test needs counts with a total below 2^53: use exact: false");
    }
    const tables = strata.map((t) => [[t[0]![0]!, t[0]![1]!], [t[1]![0]!, t[1]![1]!]] as const);
    return exact ? exact2x2xK(tables, alternative, confLevel) : asymptotic2x2xK(tables, totals, alternative, correct, confLevel);
  }
  // as in R, exact applies to 2 x 2 x K tables only and is ignored otherwise
  return general(strata, totals, I, J);
}

/** Sum of the counts of one stratum */
function stratumTotal(t: readonly (readonly number[])[]): number {
  return t.reduce((a, r) => a + r.reduce((b, v) => b + v, 0), 0);
}

/**
 * The even power of 2 to divide all counts by where the totals or sums over the strata overflow: the largest count
 * then below 2^1020 / (8 I J K), so that the totals and the sums over the strata are finite (#224, #226). The
 * statistics are homogeneous in the counts (the count 1 in t - 1 becomes 2^-s), so they are scaled back exactly
 */
function countExponent(strata: readonly (readonly (readonly number[])[])[]): number {
  let m = 0;
  let cells = 0;
  for (const t of strata) {
    for (const r of t) {
      for (const v of r) {
        m = Math.max(m, v);
        cells++;
      }
    }
  }
  const s = Math.floor(Math.log2(m)) + 1 + Math.ceil(Math.log2(8 * cells)) - 1020;
  return s <= 0 ? 0 : s + (s % 2);
}

/** The strata with every count divided by 2^s */
function scaledStrata<T extends readonly (readonly number[])[]>(strata: readonly T[], s: number): T[] {
  return strata.map((t) => t.map((r) => r.map((v) => ldexp(v, -s))) as unknown as T);
}

/** Sums over the strata of the 2 x 2 x K test, in units of 2^s counts (one = 2^-s is the count 1 in those units) */
function sums2x2xK(tables: readonly Stratum[], totals: readonly number[], one: number) {
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
    // products of counts near 1e150 overflow (the variance was Infinity / Infinity = NaN; R too): the ratios first there
    const e = (r1 * c1) / t;
    se += Number.isFinite(e) ? e : (r1 / t) * c1;
    const v = (r1 * r2 * c1 * c2) / (t * t * (t - one));
    sv += Number.isFinite(v) ? v : (r1 / t) * (r2 / t) * (c1 / (t - one)) * c2;
    const P = (a + d) / t;
    const Q = (b + c) / t;
    const ad = (a * d) / t;
    const bc = (b * c) / t;
    const R = Number.isFinite(ad) ? ad : (a / t) * d;
    const S = Number.isFinite(bc) ? bc : (b / t) * c;
    sR += R;
    sS += S;
    sPR += P * R;
    sPSQR += P * S + Q * R;
    sQS += Q * S;
  });
  return { sa, se, sv, sR, sS, sPR, sPSQR, sQS };
}

function asymptotic2x2xK(
  tables: readonly Stratum[],
  totals: readonly number[],
  alternative: Alternative,
  correct: boolean,
  confLevel: number,
): MantelhaenTestResult {
  let sums = sums2x2xK(tables, totals, 1);
  // a total or a sum over the strata overflows (finite counts near 1e308; NaN before, R fails, #226): all counts
  // divided by an even power of 2, 2^s. The differences, variances and odds ratio terms are of degree 1 in the
  // counts, so the statistic is 2^s times the scaled one, the estimate unchanged, and the sd of its log 2^(-s/2) times
  let s = 0;
  if (!totals.every(Number.isFinite) || !Object.values(sums).every(Number.isFinite)) {
    s = countExponent(tables);
    const scaled = scaledStrata(tables, s);
    sums = sums2x2xK(scaled, scaled.map(stratumTotal), ldexp(1, -s));
  }
  const { sa, se, sv, sR, sS, sPR, sPSQR, sQS } = sums;
  const delta = sa - se;
  // the correction 1/2 in the units of the sums
  const half = ldexp(0.5, -s);
  const yates = correct && Math.abs(delta) >= half ? half : 0;
  const statistic = ldexp(squareOver(Math.abs(delta) - yates, sv), s);
  const pValue =
    alternative === "two.sided"
      ? pgamma1(statistic, 0.5, 2, false, false)
      : pnorm(Math.sign(delta) * Math.sqrt(statistic), { lowerTail: alternative === "less" });
  const estimate = sR / sS;
  const sd = ldexp(Math.sqrt(sPR / (2 * sR * sR) + sPSQR / (2 * sR * sS) + sQS / (2 * sS * sS)), -s / 2);
  let confInt: [number, number];
  if (alternative === "less") confInt = [0, estimate * Math.exp(qnorm(confLevel) * sd)];
  else if (alternative === "greater") confInt = [estimate * Math.exp(qnorm(confLevel, { lowerTail: false }) * sd), Infinity];
  else {
    // (for alpha below 1e-8 the upper probability itself: 1 - alpha loses its digits and rounds to 1 below 1.1e-16; review 58)
    const a2 = (1 - confLevel) / 2;
    const z = a2 < 1e-8 ? qnorm(a2, { lowerTail: false }) : qnorm((1 + confLevel) / 2);
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

/**
 * Largest support (number of values of S) of the exact test: 2^24 values take a few hundred MB (one large stratum
 * near 2^24 takes about 40 s; several large strata take longer, as the convolution grows with the product of their
 * spreads); R allocates every stratum's support whatever its size (counts of 1e9 would take 16 GB per stratum)
 */
const MAX_SUPPORT = 2 ** 24;

/** Exact conditional test on 2 x 2 x K tables: S = sum of the (1, 1) cells given all margins */
function exact2x2xK(tables: readonly Stratum[], alternative: Alternative, confLevel: number): MantelhaenTestResult {
  // the support of S has 1 + sum (min(a, d) + min(b, c)) values (each stratum's support and every partial
  // convolution are no longer); checked before any of them is allocated
  const size = tables.reduce((acc, [[a, b], [c, d]]) => acc + Math.min(a, d) + Math.min(b, c), 1);
  if (size > MAX_SUPPORT) {
    throw new RangeError(`the exact distribution of S has ${size} values, more than 2^24: use exact: false`);
  }
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
  let { diff, V } = generalSums(strata, totals, I, J, 1);
  // a total or a sum over the strata overflows: all counts divided by 2^s (see countExponent); the differences and
  // the covariance are of degree 1 in the counts, so the statistic is 2^s times the scaled one
  let s = 0;
  if (!totals.every(Number.isFinite) || !diff.every(Number.isFinite) || !V.every((row) => row.every(Number.isFinite))) {
    s = countExponent(strata);
    const scaled = scaledStrata(strata, s);
    ({ diff, V } = generalSums(scaled, scaled.map(stratumTotal), I, J, ldexp(1, -s)));
  }
  const p = diff.length;
  const sol = solve(V, diff);
  let statistic = 0;
  for (let u = 0; u < p; u++) statistic += diff[u]! * sol[u]!;
  statistic = ldexp(statistic, s);
  return {
    method: "Cochran-Mantel-Haenszel test",
    statistic,
    statisticName: "Cochran-Mantel-Haenszel M^2",
    parameter: p,
    parameterName: "df",
    pValue: pgamma1(statistic, p / 2, 2, false, false),
  };
}

const MIN_NORMAL = 2 ** -1022;

/**
 * The differences n - m and the covariance V of the generalized statistic, summed over the strata, in units of 2^s
 * counts (one = 2^-s is the count 1 in those units)
 */
function generalSums(
  strata: readonly (readonly (readonly number[])[])[],
  totals: readonly number[],
  I: number,
  J: number,
  one: number,
): { diff: number[]; V: number[][] } {
  const p = (I - 1) * (J - 1);
  const diff = new Array<number>(p).fill(0);
  const V = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  strata.forEach((tab, k) => {
    const t = totals[k]!;
    const r = tab.map((row) => row.reduce((a, b) => a + b, 0));
    const c = Array.from({ length: J }, (_, j) => tab.reduce((a, row) => a + row[j]!, 0));
    const f = 1 / (t * t * (t - one));
    // cell (i, j) of the first I - 1 rows and J - 1 columns is element i + (I - 1) j (column-major, as in R)
    for (let j = 0; j < J - 1; j++) {
      for (let i = 0; i < I - 1; i++) {
        const u = i + (I - 1) * j;
        // a product of margins near 1e154 overflows: formed from the margins scaled to [1, 2) there
        const e = (r[i]! * c[j]!) / t;
        diff[u]! += tab[i]![j]! - (Number.isFinite(e) ? e : productOver(r[i]!, c[j]!, t));
        for (let jj = 0; jj < J - 1; jj++) {
          for (let ii = 0; ii < I - 1; ii++) {
            const vr = (i === ii ? t * r[i]! : 0) - r[i]! * r[ii]!;
            const vc = (j === jj ? t * c[j]! : 0) - c[j]! * c[jj]!;
            const v = f * vr * vc;
            // t^2 (t - 1) or the product overflows from counts near 1e103 (0 times Infinity was NaN; R fails, #224):
            // r_i (d_ii - r_ii / t) (d_jj - c_jj / t) c_j / (t - 1) there, each factor in range
            V[u]![ii + (I - 1) * jj]! +=
              Number.isFinite(v) && f >= MIN_NORMAL
                ? v
                : r[i]! * ((i === ii ? 1 : 0) - r[ii]! / t) * (((j === jj ? 1 : 0) - c[jj]! / t) * (c[j]! / (t - one)));
          }
        }
      }
    }
  });
  return { diff, V };
}
