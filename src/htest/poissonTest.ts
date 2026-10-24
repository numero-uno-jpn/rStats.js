// Exact Poisson tests (R's poisson.test): a rate against a hypothesized value, or the ratio of two rates.
//
// Written for rStats.js from the textbook construction and R's documented behaviour. One sample: the two-sided p-value
// adds the probabilities of all counts no more likely than the observed one (relative slack 1e-7, as in binomTest), the
// tail on the far side of the mode being located by a search over integers, and the interval is the exact (Garwood
// 1936) one from gamma quantiles. Two samples: conditionally on the total, the first count is binomial with
// probability r T1 / (r T1 + T2), so the test is binomTest's and its interval for p maps to the rate ratio through
// p / (1 - p) T2 / T1.

import { dpois1, ppois1 } from "../distributions/poisson.js";
import { qgamma1 } from "../distributions/gamma.js";
import { binomTest } from "./binomTest.js";
import { checkConfLevelOpen, matchAlternative, type Alternative, type HTest } from "./types.js";

/** Options for {@link poissonTest}. */
export interface PoissonTestOptions {
  /** Time base(s): one per count, nonnegative. Default `1` (or `[1, 1]`). */
  T?: number | readonly number[];
  /** Hypothesized rate, or rate ratio for two samples (nonnegative). Default `1`. */
  r?: number;
  /** Alternative hypothesis (unambiguous abbreviations accepted). Default `"two.sided"`. */
  alternative?: Alternative | "two" | "l" | "g";
  /** Confidence level of the interval. Default `0.95`. */
  confLevel?: number;
}

/** Result of {@link poissonTest}. */
export interface PoissonTestResult extends HTest {
  /** Time base (one sample) or expected first count under the null hypothesis (two samples). */
  parameter: number;
  confInt: [number, number];
  confLevel: number;
  /** Event rate (one sample) or rate ratio (two samples). */
  estimate: number;
  nullValue: number;
}

const REL_ERR = 1 + 1e-7;

function isCount(v: number): boolean {
  return Number.isFinite(v) && v >= 0 && Math.abs(v - Math.round(v)) <= 1e-7 * Math.max(1, Math.abs(v));
}


/**
 * Two-sided p-value of the count x under Poisson(m): the total probability of the counts whose probability is at most
 * (1 + 1e-7) times that of x. The density is unimodal (increasing up to floor(m), decreasing after), so the observed
 * side contributes the tail through x and the other side the tail beyond the first qualifying count j past the mode,
 * located by doubling the step away from the mode (right side) and bisecting on integers.
 */
function twoSidedP(x: number, m: number): number {
  if (m === 0) return x === 0 ? 1 : 0;
  if (x === m) return 1;
  const cut = dpois1(x, m, false) * REL_ERR;
  const qualifies = (i: number): boolean => dpois1(i, m, false) <= cut;
  const mode = Math.floor(m);
  if (x < m) {
    // smallest j >= start with dpois(j) <= cut; densities decrease from the mode onwards (with m an integer, m - 1
    // and m are equally likely, so starting at x + 1 picks up m when x = m - 1)
    const start = Math.max(x + 1, mode);
    let j = start;
    if (!qualifies(start)) {
      let fails = start; // largest count known not to qualify
      let step = 1;
      j = start + 1;
      while (!qualifies(j)) {
        fails = j;
        step *= 2;
        j = start + step;
      }
      while (j - fails > 1) {
        const mid = fails + Math.floor((j - fails) / 2);
        if (qualifies(mid)) j = mid;
        else fails = mid;
      }
    }
    return Math.min(1, ppois1(x, m, true, false) + ppois1(j - 1, m, false, false));
  }
  // x > m: largest j <= end with dpois(j) <= cut; densities increase from 0 up to the mode (j = -1 when none does)
  const end = Math.min(x - 1, mode);
  let j: number;
  if (!qualifies(0)) j = -1;
  else if (qualifies(end)) j = end;
  else {
    j = 0;
    let fails = end; // smallest count known not to qualify
    while (fails - j > 1) {
      const mid = j + Math.floor((fails - j) / 2);
      if (qualifies(mid)) j = mid;
      else fails = mid;
    }
  }
  return Math.min(1, ppois1(j, m, true, false) + ppois1(x - 1, m, false, false));
}

/**
 * Exact test of a Poisson rate, or comparison of two Poisson rates. Equivalent to R's `poisson.test()`.
 *
 * @param x Number of events, or `[count1, count2]` to compare two rates.
 * @param options See {@link PoissonTestOptions}.
 *
 * @example
 * ```ts
 * poissonTest(137, { T: 24.19893 }).pValue; // < 2.2e-16 (rate 1 against 5.66)
 * poissonTest([11, 23], { T: [800, 3011] }).estimate; // rate ratio 1.80
 * ```
 */
export function poissonTest(x: number | readonly number[], options: PoissonTestOptions = {}): PoissonTestResult {
  const xs = typeof x === "number" ? [x] : Array.from(x);
  if (xs.length < 1 || xs.length > 2) throw new RangeError("incorrect length of 'x'");
  if (!xs.every(isCount)) throw new RangeError("'x' must be finite, nonnegative, and integer");
  const counts = xs.map(Math.round);
  const k = counts.length;
  const Traw = options.T ?? 1;
  const T = typeof Traw === "number" ? new Array<number>(k).fill(Traw) : Array.from(Traw);
  if (T.length !== k) throw new RangeError("'x' and 'T' have incompatible length");
  // as in R, a time base or rate of 0 is accepted (the counts then have mean 0 under the null hypothesis)
  if (!T.every((t) => Number.isFinite(t) && t >= 0)) throw new RangeError("'T' must be nonnegative");
  const r = options.r ?? 1;
  if (!(Number.isFinite(r) && r >= 0)) throw new RangeError("'r' must be a single positive number");
  const alternative = matchAlternative(options.alternative);
  const confLevel = options.confLevel ?? 0.95;
  checkConfLevelOpen(confLevel);

  if (k === 2) {
    const [x1, x2] = counts as [number, number];
    const [T1, T2] = T as [number, number];
    const n = x1 + x2;
    // NaN (rejected by binomTest, as in R) when both r T1 and T2 are 0. The [successes, failures] form also takes
    // a total of 0 (p-value 1, interval [0, 1]), where binomTest(0, 0) is an error as in R
    const p0 = (r * T1) / (r * T1 + T2);
    const b = binomTest([x1, x2], { p: p0, alternative, confLevel });
    const toRatio = (p: number): number => (p / (1 - p)) * (T2 / T1);
    return {
      method: "Comparison of Poisson rates",
      alternative,
      statistic: x1,
      statisticName: "count1",
      // R reports sum(x) r T1 / (T1 + r T2) here (r on the other time base than in the binomial probability)
      parameter: (n * r * T1) / (T1 + r * T2),
      parameterName: "expected count1",
      pValue: b.pValue,
      confInt: [toRatio(b.confInt[0]), toRatio(b.confInt[1])],
      confLevel,
      estimate: x1 / T1 / (x2 / T2),
      estimateNames: "rate ratio",
      nullValue: r,
      nullValueName: "rate ratio",
    };
  }

  const xv = counts[0]!;
  const Tv = T[0]!;
  const m = r * Tv;
  let pValue: number;
  if (alternative === "less") pValue = ppois1(xv, m, true, false);
  else if (alternative === "greater") pValue = ppois1(xv - 1, m, false, false);
  else pValue = twoSidedP(xv, m);

  const lower = (alpha: number): number => (xv === 0 ? 0 : qgamma1(alpha, xv, 1, true, false));
  const upper = (alpha: number): number => qgamma1(1 - alpha, xv + 1, 1, true, false);
  let ci: [number, number];
  if (alternative === "less") ci = [0, upper(1 - confLevel)];
  else if (alternative === "greater") ci = [lower(1 - confLevel), Infinity];
  else {
    const alpha = (1 - confLevel) / 2;
    ci = [lower(alpha), upper(alpha)];
  }

  return {
    method: "Exact Poisson test",
    alternative,
    statistic: xv,
    statisticName: "number of events",
    parameter: Tv,
    parameterName: "time base",
    pValue,
    confInt: [ci[0] / Tv, ci[1] / Tv],
    confLevel,
    estimate: xv / Tv,
    estimateNames: "event rate",
    nullValue: r,
    nullValueName: "event rate",
  };
}
