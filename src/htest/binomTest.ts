// Exact binomial test (R's binom.test).
//
// Written for rStats.js from the textbook construction and R's documented behaviour. The two-sided p-value adds the
// probabilities of all outcomes no more likely than the observed one, with a relative slack of 1e-7 on that
// comparison so that outcomes of equal probability are not split by rounding (R's convention). The observed side is
// taken as a tail of the distribution function and the opposite side as the tail made of the outcomes that pass the
// comparison (counted one by one). The confidence interval is Clopper and Pearson's (Biometrika 26, 1934), from beta
// quantiles.

import { dbinom1, pbinom1 } from "../distributions/binomial.js";
import { qbeta1 } from "../distributions/beta.js";
import { firstTrue, lastTrue } from "../internal/discrete.js";
import { twoSum } from "../special/dd.js";
import { checkConfLevelOpen, isCount, matchAlternative, type Alternative, type HTest } from "./types.js";

/**
 * Options for {@link binomTest}.
 *
 * @category Hypothesis tests
 */
export interface BinomTestOptions {
  /** Hypothesized probability of success. Default `0.5`. */
  p?: number;
  /** Alternative hypothesis (unambiguous abbreviations accepted). Default `"two.sided"`. */
  alternative?: Alternative | "two" | "l" | "g";
  /** Confidence level of the interval. Default `0.95`. */
  confLevel?: number;
}

/**
 * Result of {@link binomTest}.
 *
 * @category Hypothesis tests
 */
export interface BinomTestResult extends HTest {
  /** Number of trials (`parameterName` is `"number of trials"`). */
  parameter: number;
  /** Clopper-Pearson interval for the probability of success. */
  confInt: [number, number];
  confLevel: number;
  /** Observed proportion of successes. */
  estimate: number;
  nullValue: number;
}

/** Relative slack when comparing outcome probabilities with the observed one */
const SLACK = 1 + 1e-7;

/**
 * P[X >= x] under Binomial(n, p). Where x - 1 or n - (x - 1) is not exact (beyond 2^53), P[X > x] + dbinom(x):
 * pbinom(x - 1, upper) took a rounded x - 1 or n - (x - 1) (x = 2^53, n = 2^54, p = 1/2 gave 0.5, true
 * 0.5000000029724; issue #324)
 */
function atLeast(x: number, n: number, p: number): number {
  const xm = x - 1;
  if (x === 0 || (x - xm === 1 && twoSum(n, -xm)[1] === 0)) return pbinom1(xm, n, p, false, false);
  return pbinom1(x, n, p, false, false) + dbinom1(x, n, p, false);
}

/**
 * Two-sided p-value: the total probability of the outcomes no more likely than x (within the relative slack). The
 * observed side is one tail of the distribution function; on the opposite side the qualifying outcomes are the most
 * extreme ones there, so their mass is again a tail probability. The density decreases from ceil(np) upwards and
 * increases up to floor(np) (the ratio f(i + 1) / f(i) = (n - i) p / ((i + 1)(1 - p)) is below 1 exactly for
 * i > (n + 1) p - 1), so the boundary of the qualifying outcomes is found by search in O(log n) evaluations instead of
 * testing each of the outcomes on that side (which took seconds for n around 1e8).
 */
function twoSidedP(x: number, n: number, p: number): number {
  if (p === 0) return x === 0 ? 1 : 0;
  if (p === 1) return x === n ? 1 : 0;
  const mean = n * p;
  if (x === mean) return 1;
  const cut = dbinom1(x, n, p, false) * SLACK;
  const qualifies = (i: number): boolean => dbinom1(i, n, p, false) <= cut;
  if (x < mean) {
    // the first qualifying outcome above the mean; those from it to n qualify
    const j = firstTrue(qualifies, Math.ceil(mean), n);
    const other = j > n ? 0 : atLeast(j, n, p);
    return Math.min(1, pbinom1(x, n, p, true, false) + other);
  }
  // the last qualifying outcome below the mean; those from 0 to it qualify
  const j = lastTrue(qualifies, 0, Math.floor(mean));
  const other = j < 0 ? 0 : pbinom1(j, n, p, true, false);
  return Math.min(1, atLeast(x, n, p) + other);
}

/**
 * Exact test of a simple null hypothesis about the probability of success in Bernoulli trials. Equivalent to R's
 * `binom.test()`.
 *
 * @param x Number of successes, or `[successes, failures]`.
 * @param n Number of trials (ignored when `x` has two elements; may then be omitted and the options passed in its
 *   place).
 * @param options See {@link BinomTestOptions}.
 *
 * @example
 * ```ts
 * binomTest(682, 925, { p: 0.75 }).pValue; // 0.3824916
 * ```
 *
 * @category Hypothesis tests
 */
export function binomTest(
  x: number | readonly [number, number],
  n?: number | BinomTestOptions,
  options: BinomTestOptions = {},
): BinomTestResult {
  let xs: number;
  let ns: number;
  if (typeof x !== "number") {
    if (x.length !== 2) throw new RangeError("incorrect length of 'x'");
    if (n !== undefined && typeof n !== "number") options = n;
    if (!isCount(x[0]) || !isCount(x[1])) throw new RangeError("'x' must be nonnegative and integer");
    xs = Math.round(x[0]);
    ns = Math.round(x[0]) + Math.round(x[1]);
    // no trials: neither the estimate nor the test is defined (R returns a p-value of 1), as for binomTest(0, 0)
    // no trials, or a total that overflows (binomTest([1e308, 1e308]) gave NaN; a scalar n = Infinity is rejected too)
    if (ns === 0 || ns === Infinity) throw new RangeError("'n' must be a positive integer >= 'x'");
  } else {
    if (typeof n !== "number") throw new TypeError("'n' is required when 'x' is a single number");
    if (!isCount(x)) throw new RangeError("'x' must be nonnegative and integer");
    xs = Math.round(x);
    if (!(isCount(n) && Math.round(n) >= xs && n > 0)) throw new RangeError("'n' must be a positive integer >= 'x'");
    ns = Math.round(n);
  }
  return binomTestCounts(xs, ns, options);
}

/**
 * The exact binomial test of xs successes in ns trials, without the check of ns > 0 (poissonTest compares two counts
 * of 0 as R does: p-value 1, interval [0, 1])
 */
export function binomTestCounts(xs: number, ns: number, options: BinomTestOptions = {}): BinomTestResult {
  const p = options.p ?? 0.5;
  if (!(p >= 0 && p <= 1)) throw new RangeError("'p' must be a single number between 0 and 1");
  const alternative = matchAlternative(options.alternative);
  const confLevel = options.confLevel ?? 0.95;
  checkConfLevelOpen(confLevel);

  let pValue: number;
  if (alternative === "less") pValue = pbinom1(xs, ns, p, true, false);
  else if (alternative === "greater") pValue = atLeast(xs, ns, p);
  else pValue = twoSidedP(xs, ns, p);

  const lower = (alpha: number): number => (xs === 0 ? 0 : qbeta1(alpha, xs, ns - xs + 1, true, false));
  // (for alpha below 1e-8 the upper probability itself: 1 - alpha loses its digits, and is 1 below 1.1e-16, which gave
  // the limit 1 at confLevel = 0.9999999999999999)
  const upper = (alpha: number): number =>
    xs === ns ? 1 : alpha < 1e-8 ? qbeta1(alpha, xs + 1, ns - xs, false, false) : qbeta1(1 - alpha, xs + 1, ns - xs, true, false);
  let confInt: [number, number];
  if (alternative === "less") confInt = [0, upper(1 - confLevel)];
  else if (alternative === "greater") confInt = [lower(1 - confLevel), 1];
  else {
    const alpha = (1 - confLevel) / 2;
    confInt = [lower(alpha), upper(alpha)];
  }

  return {
    method: "Exact binomial test",
    alternative,
    statistic: xs,
    statisticName: "number of successes",
    parameter: ns,
    parameterName: "number of trials",
    pValue,
    confInt,
    confLevel,
    estimate: xs / ns,
    estimateNames: "probability of success",
    nullValue: p,
    nullValueName: "probability of success",
  };
}
