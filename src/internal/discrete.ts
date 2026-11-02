// Quantile search for discrete distributions (integer support).
//
// The quantile is "the smallest integer y with P[X <= y] >= p" (upper tail: "the smallest y with P[X > y] <= p").
// So that floating-point rounding does not miss the boundary integer, the probability gets a relative slack of 64 ε,
// e.g. so that qpois(ppois(3, λ), λ) returns 3.
// The slack is applied to p on the scale the user supplied (lowerTail, logP). Its size is 8 ε on the linear scale
// and 2 ε on the log scale, both chosen by comparison with R's answers (for p ≈ 1, converting to the smaller tail
// before testing gives answers off by 1; the slack must be larger than 1.8 ε and smaller than 49 ε).

export const FUZZ_LINEAR = 8 * Number.EPSILON;
export const FUZZ_LOG = 2 * Number.EPSILON;
/** Probabilities below this are near subnormal with few significant digits, so compare on the log scale */
const TINY = 1e-290;

export interface DiscreteQuantileProblem {
  /** Probability supplied by the user (0 < p < 1; log if logP) */
  p: number;
  lowerTail: boolean;
  logP: boolean;
  /** P[X <= y] (lowerTail) / P[X > y] (!lowerTail); log if logP */
  cdf: (y: number, lowerTail: boolean, logP: boolean) => number;
  /** Starting value (need not be an integer) */
  y0: number;
  /** Lower and upper ends of the support */
  lo: number;
  hi: number;
}

export function discreteQuantile(problem: DiscreteQuantileProblem): number {
  const { p, lowerTail, logP, lo, hi } = problem;
  // A NaN from the distribution function (at extreme parameters) ends the search with NaN; the comparisons would
  // otherwise read it as "not reached" and walk on to Infinity
  let nan = false;
  const cdf = (y: number, l: boolean, lg: boolean): number => {
    const v = problem.cdf(y, l, lg);
    if (Number.isNaN(v)) nan = true;
    return v;
  };
  let ok: (y: number) => boolean;
  if (logP || p < TINY) {
    let t: number;
    if (logP) t = lowerTail ? p * (1 + FUZZ_LOG) : p * (1 - FUZZ_LOG);
    else t = Math.log(p) + Math.log1p(lowerTail ? -FUZZ_LINEAR : FUZZ_LINEAR);
    ok = lowerTail ? (y) => cdf(y, true, true) >= t : (y) => cdf(y, false, true) <= t;
  } else {
    let t: number;
    if (lowerTail) t = p * (1 - FUZZ_LINEAR);
    else t = 1 - p > 4 * FUZZ_LINEAR ? p * (1 + FUZZ_LINEAR) : p;
    if (t > 0.5) {
      // Comparing probabilities close to 1 shifts the decision by a few units through the rounding of 1 - (small value).
      // Compare the small complementary probabilities instead: F >= t ⇔ 1 - F <= 1 - t (1 - t is exact)
      const c = 1 - t;
      ok = lowerTail ? (y) => cdf(y, false, false) <= c : (y) => cdf(y, true, false) >= c;
    } else {
      ok = lowerTail ? (y) => cdf(y, true, false) >= t : (y) => cdf(y, false, false) <= t;
    }
  }

  let y = Math.round(problem.y0);
  if (!Number.isFinite(y)) y = lo;
  y = Math.min(Math.max(y, lo), hi);

  // The first step is at least the spacing of the doubles at y (beyond 2^53 a step of 1 would not move y, and doubling
  // up to the spacing at 1e258 took 800 evaluations)
  const step0 = Math.max(1, Math.abs(y) * Number.EPSILON);
  if (ok(y)) {
    // y satisfies the condition. Find a lower point that does not, then bisect
    let step = step0;
    let bad = y - step;
    while (bad >= lo && ok(bad)) {
      y = bad;
      step *= 2;
      bad = y - step;
    }
    if (nan) return NaN;
    if (bad < lo) {
      if (y === lo) return lo;
      bad = lo - 1;
    }
    const r = bisect(bad, y, ok, () => nan);
    return nan ? NaN : r;
  }
  if (nan) return NaN;
  // y does not satisfy it. Find an upper point that does, then bisect
  let step = step0;
  let good = y + step;
  while (good <= hi && !ok(good)) {
    if (nan) return NaN;
    y = good;
    step *= 2;
    good = y + step;
    if (good === Infinity && hi === Infinity) {
      // The step overflowed: the quantile may still lie below the largest double (a threshold at 1.7e308 searched from
      // 1 gave Infinity), so test that before concluding it lies beyond the doubles. (With a finite hi, the loop ends
      // and the search below runs up to hi)
      const top = Number.MAX_VALUE;
      const atTop = ok(top);
      if (nan) return NaN;
      if (!atTop) return hi;
      good = top;
      break;
    }
  }
  if (good > hi) good = hi;
  const r = bisect(y, good, ok, () => nan);
  return nan ? NaN : r;
}

/** bad does not satisfy the condition, good does (bad < good). Returns the smallest integer that satisfies it */
function bisect(bad: number, good: number, ok: (y: number) => boolean, stop: () => boolean): number {
  while (good - bad > 1 && !stop()) {
    const mid = Math.floor(bad + (good - bad) / 2);
    // Beyond 2^53 neighbouring integers are not representable and the midpoint equals an end (stop there)
    if (mid === bad || mid === good) break;
    if (ok(mid)) good = mid;
    else bad = mid;
  }
  return good;
}

/**
 * For a predicate on the integers from lo on that is false up to some integer and true from there on: the first
 * integer >= lo where it holds, at most hi + 1 (hi + 1 when none up to hi; hi may be Infinity). Found by doubling the
 * step from lo and then bisecting, so in O(log) evaluations: the two-sided exact tests use it on the tail beyond the
 * mode of a unimodal distribution, where "probability at most that of the observation" switches once
 */
export function firstTrue(pred: (i: number) => boolean, lo: number, hi: number): number {
  if (lo > hi || pred(lo)) return lo;
  let fails = lo; // largest integer known not to hold
  let step = 1;
  let j = lo + 1; // an integer known to hold, or hi + 1 (taken as holding, never evaluated)
  for (;;) {
    if (j > hi) {
      j = hi + 1;
      break;
    }
    if (pred(j)) break;
    fails = j;
    if (j === Number.MAX_VALUE) return hi + 1;
    step *= 2;
    j = lo + step;
    // past the largest double (hi = Infinity): try it once; Infinity was taken as the bound (a finite threshold gave
    // Infinity, and a predicate false everywhere never stopped)
    if (j === Infinity) j = Number.MAX_VALUE;
  }
  while (j - fails > 1) {
    const mid = fails + Math.floor((j - fails) / 2);
    // beyond 2^53 the midpoint can round to an end, which then never moved (binomTest(0, 1e20) did not return)
    if (mid === fails || mid === j) break;
    if (pred(mid)) j = mid;
    else fails = mid;
  }
  return j;
}

/**
 * For a predicate on lo..hi that is true up to some integer and false from there on: the last integer <= hi where it
 * holds (lo - 1 when none). By bisection (the mirror image of firstTrue, on a finite range)
 */
export function lastTrue(pred: (i: number) => boolean, lo: number, hi: number): number {
  if (lo > hi || !pred(lo)) return lo - 1;
  if (pred(hi)) return hi;
  let j = lo;
  let fails = hi; // smallest integer known not to hold
  while (fails - j > 1) {
    const mid = j + Math.floor((fails - j) / 2);
    if (mid === fails || mid === j) break; // (as in firstTrue)
    if (pred(mid)) j = mid;
    else fails = mid;
  }
  return j;
}
