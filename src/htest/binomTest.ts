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
import { checkConfLevelOpen, matchAlternative, type Alternative, type HTest } from "./types.js";

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

function isCount(v: number): boolean {
  return Number.isFinite(v) && v >= 0 && Math.abs(v - Math.round(v)) <= 1e-7 * Math.max(1, Math.abs(v));
}

/**
 * Two-sided p-value: the total probability of the outcomes no more likely than x (within the relative slack). The
 * observed side is one tail of the distribution function; on the opposite side the qualifying outcomes are counted,
 * and as they are the most extreme ones there, their mass is again a tail probability.
 */
function twoSidedP(x: number, n: number, p: number): number {
  if (p === 0) return x === 0 ? 1 : 0;
  if (p === 1) return x === n ? 1 : 0;
  const mean = n * p;
  if (x === mean) return 1;
  const cut = dbinom1(x, n, p, false) * SLACK;
  let count = 0;
  if (x < mean) {
    for (let i = Math.ceil(mean); i <= n; i++) if (dbinom1(i, n, p, false) <= cut) count++;
    const other = count === 0 ? 0 : pbinom1(n - count, n, p, false, false);
    return Math.min(1, pbinom1(x, n, p, true, false) + other);
  }
  for (let i = 0; i <= Math.floor(mean); i++) if (dbinom1(i, n, p, false) <= cut) count++;
  const other = count === 0 ? 0 : pbinom1(count - 1, n, p, true, false);
  return Math.min(1, pbinom1(x - 1, n, p, false, false) + other);
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
  } else {
    if (typeof n !== "number") throw new TypeError("'n' is required when 'x' is a single number");
    if (!isCount(x)) throw new RangeError("'x' must be nonnegative and integer");
    xs = Math.round(x);
    if (!(isCount(n) && Math.round(n) >= xs && n > 0)) throw new RangeError("'n' must be a positive integer >= 'x'");
    ns = Math.round(n);
  }
  const p = options.p ?? 0.5;
  if (!(p >= 0 && p <= 1)) throw new RangeError("'p' must be a single number between 0 and 1");
  const alternative = matchAlternative(options.alternative);
  const confLevel = options.confLevel ?? 0.95;
  checkConfLevelOpen(confLevel);

  let pValue: number;
  if (alternative === "less") pValue = pbinom1(xs, ns, p, true, false);
  else if (alternative === "greater") pValue = pbinom1(xs - 1, ns, p, false, false);
  else pValue = twoSidedP(xs, ns, p);

  const lower = (alpha: number): number => (xs === 0 ? 0 : qbeta1(alpha, xs, ns - xs + 1, true, false));
  const upper = (alpha: number): number => (xs === ns ? 1 : qbeta1(1 - alpha, xs + 1, ns - xs, true, false));
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
