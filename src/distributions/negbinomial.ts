// Negative binomial distribution dnbinom / pnbinom / qnbinom (size and prob, or size and mu).
//
// Probabilities use the relation to the binomial probability (Loader 2000)
//   P[X = x] = Γ(x + n) / (Γ(n) x!) p^n q^x = n / (n + x) · b(n; n + x, p)
// where b is dbinomRawDD from src/special/loader.ts (n need not be an integer).
// The distribution function is P[X <= x] = I_p(n, x + 1) (regularized incomplete beta function).
// When mu is given, p = n / (n + mu) and q = mu / (n + mu) are formed in double-double
// (for n ≫ mu, rounding 1 - p gives q a large relative error). size = Inf is the Poisson distribution.
// Quantiles use an integer search from a Cornish-Fisher starting value.

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { discreteQuantile } from "../internal/discrete.js";
import { nonInt } from "../internal/integer.js";
import { betaIncDD } from "../special/incbet.js";
import { dbinomRawDD, dpoisRaw } from "../special/loader.js";
import { ddAdd, ddDiv, ddMul, twoSum, type DD } from "../special/dd.js";
import { qnorm } from "./normal.js";
import { qgamma1 } from "./gamma.js";
import { ppois1, qpois1 } from "./poisson.js";
import { probPair } from "./geometric.js";

/**
 * Parameters of the negative binomial distribution. Give exactly one of `prob` and `mu`.
 *
 * @category Distributions
 */
export interface NegBinomialParams {
  /** Probability of success on each trial (`0 < prob <= 1`). Do not combine with `mu`. */
  prob?: number;
  /** Mean (`mu = size * (1 - prob) / prob`). Do not combine with `prob`. */
  mu?: number;
}

/** Parameter set (n, p, q). p and q are double-double */
interface Params {
  size: number;
  pd: DD;
  qd: DD;
}

function fromMu(size: number, mu: number): Params {
  const s = twoSum(size, mu);
  return { size, pd: ddDiv([size, 0], s), qd: ddDiv([mu, 0], s) };
}

function fromProb(size: number, prob: number): Params {
  return { size, ...probPair(prob) };
}

/** P[X = x] (x a nonnegative integer, 0 < size < ∞, 0 < p < 1) */
function dnbinomRaw(x: number, par: Params, log: boolean): number {
  const { size, pd, qd } = par;
  const b = dbinomRawDD(size, x, pd, qd, log);
  if (x === 0) return b;
  const r = size / (size + x);
  return log ? b + Math.log(r) : b * r;
}

/** P[X <= x] (lower) / P[X > x] (!lower) (x a nonnegative integer) */
function pnbinomRaw(x: number, par: Params, lower: boolean, log: boolean): number {
  const up = upperSeries(x, par);
  if (up !== undefined) {
    // The upper tail (the smaller side) was computed directly by the series
    if (!lower) return log ? Math.log(up) : up;
    return log ? Math.log1p(-up) : 1 - up;
  }
  return betaIncDD(par.size, x + 1, par.pd, par.qd, lower, log);
}

/**
 * For size <= 1 with q close to 1, compute the upper probability P[X > x] = I_q(x + 1, size) directly by the
 * positive-term series
 *   I_z(A, B) = z^A (1 - z)^B / (A B(A, B)) [1 + Σ_{k>=1} Π_{j<k} (A + B + j) / (A + 1 + j) z^k]
 * (z = q, A = x + 1, B = size). In this region the incomplete beta continued fraction is off by about 3e-14
 * relative near the mean. All terms are positive, so there is no cancellation. The number of terms is about
 * -log(1e-17) / -log z. Returns undefined when not usable (too many terms, or the value exceeds 1/2)
 */
function upperSeries(x: number, par: Params): number | undefined {
  const { size, pd, qd } = par;
  const z = qd[0] + qd[1];
  const p = pd[0] + pd[1];
  if (!(size <= 1) || !(z >= 0.95) || p < 1e-4) return undefined;
  const A = x + 1;
  const B = size;
  // Prefactor z^A (1 - z)^B / (A B(A, B)) = b(A; A + B, z) B / (A + B)
  const pre = (dbinomRawDD(A, B, qd, pd, false) * B) / (A + B);
  if (!(pre > 1e-290)) return undefined;
  // Rounding of the term ratios accumulates with the number of terms (1e-12 over tens of thousands), so keep terms and sum in double-double
  const ab = twoSum(A, B);
  let term: DD = [1, 0];
  let sum: DD = [1, 0];
  for (let k = 0; k < 1e6; k++) {
    const ratio = ddDiv(ddAdd(ab, [k, 0]), [A + 1 + k, 0]);
    term = ddMul(ddMul(term, ratio), qd);
    sum = ddAdd(sum, term);
    if (term[0] < 1e-18 * sum[0]) {
      const v = pre * (sum[0] + sum[1]);
      return v <= 0.5 ? v : undefined;
    }
  }
  return undefined;
}

function quantileRaw(p: number, par: Params, lowerTail: boolean, logP: boolean): number {
  // Starting value from the Cornish-Fisher expansion
  const prob = par.pd[0] + par.pd[1];
  const Q = 1 / prob;
  const P = (par.qd[0] + par.qd[1]) * Q;
  const mu = par.size * P;
  const sigma = Math.sqrt(par.size * P * Q);
  const gamma = (Q + P) / sigma;
  let y0: number;
  if (prob < 0.05) {
    // For small p, X (-log q) is nearly gamma (shape = size). Even for highly skewed distributions (small size)
    // this is a much closer starting value than Cornish-Fisher, reducing distribution-function evaluations
    // -log q = log(1 + p/q) (taking log of a rounded q loses digits for small p)
    const g = qgamma1(p, par.size, 1, lowerTail, logP);
    y0 = g / Math.log1p(prob / (par.qd[0] + par.qd[1]));
    // A finite gamma quantile divided by a tiny -log q beyond the doubles: so is the quantile (the distribution
    // function cannot be evaluated out there; qnbinom(2.2e-284, 2.7e37, { prob: 1.9e-279 }) threw a TypeError)
    if (y0 === Infinity && g > 0 && Number.isFinite(g)) return Infinity;
  } else {
    const z = qnorm(p, { lowerTail, logP });
    y0 = mu + sigma * (z + (gamma * (z * z - 1)) / 6);
  }
  let start = Number.isFinite(y0) ? Math.max(y0, 0) : Number.isFinite(mu) ? mu : 0;
  if (start > 1e4) start = refineContinuous(start, p, par, lowerTail, logP);
  return discreteQuantile({
    p,
    lowerTail,
    logP,
    cdf: (y, l, lg) => pnbinomRaw(y, par, l, lg),
    y0: start,
    lo: 0,
    hi: Infinity,
  });
}

/**
 * Before the integer search, refine the starting value by Newton's method treating y as real.
 * The discrete search widens from step 1 by doubling, so a starting value off by 1e15 units would need more than
 * 100 distribution-function evaluations. Solves for the log probability of the smaller tail. The final integer
 * search determines the answer, so this only needs to be close
 */
function refineContinuous(y0: number, p: number, par: Params, lowerTail: boolean, logP: boolean): number {
  // Use the same slack-adjusted target as the integer search (src/internal/discrete.ts)
  // (when p is close to 1, the slack changes the opposite-tail probability considerably)
  const E = Number.EPSILON;
  let t = p;
  if (logP) t = lowerTail ? p * (1 + 2 * E) : p * (1 - 2 * E);
  else if (lowerTail) t = p * (1 - 8 * E);
  else if (1 - p > 32 * E) t = p * (1 + 8 * E);
  const lp = logP ? t : Math.log(t);
  // Switch to the smaller tail
  const useLower = lp <= -Math.LN2 ? lowerTail : !lowerTail;
  const target = lp <= -Math.LN2 ? lp : logP ? Math.log(-Math.expm1(t)) : Math.log1p(-t);
  // First step: Newton's method with the slope approximated by the probability mass function; then the secant method
  let y = y0;
  let r = pnbinomRaw(y, par, useLower, true) - target;
  let yPrev = NaN;
  let rPrev = NaN;
  for (let i = 0; i < 8 && r !== 0; i++) {
    let next: number;
    if (Number.isNaN(yPrev) || r === rPrev) {
      const slope = (useLower ? 1 : -1) * Math.exp(dnbinomRaw(y, par, true) - (r + target));
      next = y - r / slope;
    } else {
      next = y - (r * (y - yPrev)) / (r - rPrev);
    }
    if (!Number.isFinite(next) || next <= 0) break;
    if (Math.abs(next - y) < 0.5) return next;
    yPrev = y;
    rPrev = r;
    y = next;
    r = pnbinomRaw(y, par, useLower, true) - target;
  }
  return y;
}

// ---- Parameterized by prob ----

export function dnbinom1(x: number, size: number, prob: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(size) || Number.isNaN(prob)) return NaN;
  if (size < 0 || !(prob > 0) || prob > 1) return NaN;
  if (nonInt(x) || x < 0 || !Number.isFinite(x)) return d0(log);
  const n = Math.round(x);
  if (size === 0 || prob === 1) return n === 0 ? (log ? 0 : 1) : d0(log);
  if (size === Infinity) return d0(log);
  return dnbinomRaw(n, fromProb(size, prob), log);
}

export function pnbinom1(q: number, size: number, prob: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(size) || Number.isNaN(prob)) return NaN;
  if (size < 0 || !(prob > 0) || prob > 1 || size === Infinity) return NaN;
  if (q < 0) return dt0(lowerTail, logP);
  if (size === 0 || prob === 1 || !Number.isFinite(q)) return dt1(lowerTail, logP);
  return pnbinomRaw(Math.floor(q + 1e-7), fromProb(size, prob), lowerTail, logP);
}

export function qnbinom1(p: number, size: number, prob: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(size) || Number.isNaN(prob)) return NaN;
  // Same order as R: parameter range → point mass (prob = 1 or size = 0 gives 0 regardless of p) → prob = 0 → range of p
  if (size < 0 || prob < 0 || prob > 1) return NaN;
  if (prob === 1 || size === 0) return 0;
  if (prob === 0) return NaN;
  const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
  if (b !== undefined) return b;
  // size = Inf (prob < 1) has its mass at X = ∞ (R gives Inf or NaN depending on p)
  if (size === Infinity) return Infinity;
  return quantileRaw(p, fromProb(size, prob), lowerTail, logP);
}

// ---- Parameterized by mu ----

export function dnbinomMu1(x: number, size: number, mu: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(size) || Number.isNaN(mu)) return NaN;
  if (size < 0 || mu < 0) return NaN;
  if (nonInt(x) || x < 0 || !Number.isFinite(x)) return d0(log);
  const n = Math.round(x);
  if (size === 0) {
    if (n === 0) return log ? 0 : 1;
    // NaN at mu = 0 to match R (dnbinom(1, 0, mu = 0) is NaN there), although size = 0 and mu = 0 is the point mass at 0
    return mu === 0 ? NaN : d0(log);
  }
  if (mu === Infinity) return d0(log);
  if (size === Infinity) return dpoisRaw(n, mu, log);
  if (mu === 0) return n === 0 ? (log ? 0 : 1) : d0(log);
  return dnbinomRaw(n, fromMu(size, mu), log);
}

export function pnbinomMu1(q: number, size: number, mu: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(size) || Number.isNaN(mu)) return NaN;
  if (size < 0 || mu < 0 || mu === Infinity) return NaN;
  if (q < 0) return dt0(lowerTail, logP);
  if (size === 0 || mu === 0 || !Number.isFinite(q)) return dt1(lowerTail, logP);
  if (size === Infinity) return ppois1(q, mu, lowerTail, logP);
  return pnbinomRaw(Math.floor(q + 1e-7), fromMu(size, mu), lowerTail, logP);
}

export function qnbinomMu1(p: number, size: number, mu: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(size) || Number.isNaN(mu)) return NaN;
  // As in R, size = Inf is the Poisson distribution, and size = 0 or mu = 0 gives 0 regardless of the other parameter or p
  if (size === Infinity) return qpois1(p, mu, lowerTail, logP);
  if (size === 0 || mu === 0) return 0;
  if (size < 0 || mu < 0) return NaN;
  // mu = Inf answers only at the ends (p = 0, 1) and is NaN otherwise (as in R)
  if (mu === Infinity) return quantileBoundaries(p, 0, Infinity, lowerTail, logP) ?? NaN;
  const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
  if (b !== undefined) return b;
  return quantileRaw(p, fromMu(size, mu), lowerTail, logP);
}

/** Accept exactly one of prob and mu (as in R, giving both or neither is an error) */
function which(options: NegBinomialParams): { kind: "prob"; v: number } | { kind: "mu"; v: number } {
  const { prob, mu } = options;
  if (prob !== undefined && mu !== undefined) throw new TypeError("specify exactly one of prob and mu");
  if (prob !== undefined) return { kind: "prob", v: prob };
  if (mu !== undefined) return { kind: "mu", v: mu };
  throw new TypeError("specify exactly one of prob and mu");
}

/**
 * Probability mass function of the negative binomial distribution (number of failures before the `size`-th success). Equivalent to R's `dnbinom(x, size, prob, mu, log = FALSE)`.
 *
 * The distribution is parameterized by `size` and exactly one of `prob` or `mu`. With `mu`, `size = Infinity` gives the Poisson distribution.
 *
 * @throws TypeError unless exactly one of `prob` and `mu` is given.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param size - Target number of successes (need not be an integer).
 * @param options - `prob` or `mu` (see {@link NegBinomialParams}; exactly one is required) and `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * dnbinom(3, 5, { prob: 0.5 }); // 0.13671875
 * dnbinom(3, 5, { mu: 4 });     // 0.16261401187793145
 * ```
 *
 * @category Distributions
 */
export function dnbinom<T extends Vectorizable>(
  x: T,
  size: number,
  options: NegBinomialParams & DensityOptions,
): VectorResult<T> {
  const log = options.log ?? false;
  const w = which(options);
  return w.kind === "prob"
    ? vectorize(x, (v) => dnbinom1(v, size, w.v, log))
    : vectorize(x, (v) => dnbinomMu1(v, size, w.v, log));
}

/**
 * Distribution function of the negative binomial distribution (number of failures before the `size`-th success). Equivalent to R's `pnbinom(q, size, prob, mu, lower.tail = TRUE, log.p = FALSE)`.
 *
 * The distribution is parameterized by `size` and exactly one of `prob` or `mu`. With `mu`, `size = Infinity` gives the Poisson distribution.
 *
 * @throws TypeError unless exactly one of `prob` and `mu` is given.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param size - Target number of successes (need not be an integer).
 * @param options - `prob` or `mu` (see {@link NegBinomialParams}; exactly one is required), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pnbinom(3, 5, { prob: 0.5 }); // 0.36328125
 * pnbinom(3, 5, { mu: 4 });     // 0.4899473063232853
 * ```
 *
 * @category Distributions
 */
export function pnbinom<T extends Vectorizable>(
  q: T,
  size: number,
  options: NegBinomialParams & TailOptions,
): VectorResult<T> {
  const { lowerTail = true, logP = false } = options;
  const w = which(options);
  return w.kind === "prob"
    ? vectorize(q, (v) => pnbinom1(v, size, w.v, lowerTail, logP))
    : vectorize(q, (v) => pnbinomMu1(v, size, w.v, lowerTail, logP));
}

/**
 * Quantile function of the negative binomial distribution (number of failures before the `size`-th success). Equivalent to R's `qnbinom(p, size, prob, mu, lower.tail = TRUE, log.p = FALSE)`.
 *
 * The distribution is parameterized by `size` and exactly one of `prob` or `mu`. With `mu`, `size = Infinity` gives the Poisson distribution.
 *
 * @throws TypeError unless exactly one of `prob` and `mu` is given.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param size - Target number of successes (need not be an integer).
 * @param options - `prob` or `mu` (see {@link NegBinomialParams}; exactly one is required), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qnbinom(0.5, 5, { prob: 0.5 });  // 4
 * qnbinom([0.05, 0.95], 5, { mu: 4 }); // [0, 9]
 * ```
 *
 * @category Distributions
 */
export function qnbinom<T extends Vectorizable>(
  p: T,
  size: number,
  options: NegBinomialParams & TailOptions,
): VectorResult<T> {
  const { lowerTail = true, logP = false } = options;
  const w = which(options);
  return w.kind === "prob"
    ? vectorize(p, (v) => qnbinom1(v, size, w.v, lowerTail, logP))
    : vectorize(p, (v) => qnbinomMu1(v, size, w.v, lowerTail, logP));
}
