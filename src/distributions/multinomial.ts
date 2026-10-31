// Multinomial probability dmultinom.
//
// P[X = x] = N! / (x_1! ... x_K!) p_1^x_1 ... p_K^x_K is computed as a product of binomial probabilities,
//   P[X = x] = prod_k b(x_k; n_k, q_k),  n_k = x_k + ... + x_K,  q_k = p_k / (p_k + ... + p_K),
// each from Loader's dbinomRawDD with q_k and 1 - q_k = (p_(k+1) + ... + p_K) / (p_k + ... + p_K) formed separately.
// The sums of the weights are kept in double-double: q_k is raised to the power x_k, so a rounded sum would give an
// error of x_k ε (1e-9 at x_k = 1e7).
// Summing lgamma terms instead loses digits to cancellation for large counts.

import { dbinomRawDD } from "../special/loader.js";
import { ddAdd, ddDiv, type DD } from "../special/dd.js";
import { ldexp } from "../internal/summary.js";

/**
 * Options for {@link dmultinom}.
 *
 * @category Distributions
 */
export interface MultinomialOptions {
  /** Total number of objects; defaults to the sum of `x` (it must equal it, as in R). */
  size?: number;
  /** If `true`, return the log probability. Default `false`. */
  log?: boolean;
}

/**
 * Probability function of the multinomial distribution. Equivalent to R's
 * `dmultinom(x, size = NULL, prob, log = FALSE)`.
 *
 * @param x - Counts, a vector of K non-negative integers.
 * @param prob - Category weights, K finite non-negative numbers, not all 0 (divided by their sum).
 * @param options - `size` and `log` (see {@link MultinomialOptions}).
 * @returns The probability `N! / (x_1! ... x_K!) prod p_j^x_j` with `N = sum(x)`, or its log.
 * @throws RangeError if `x` and `prob` differ in length, `x` has a negative or non-integer value, `prob` has a
 *   negative or non-finite value or no positive value, or `size` differs from the sum of `x`.
 *
 * @example
 * ```ts
 * dmultinom([1, 2, 1], [0.2, 0.5, 0.3]);  // 0.18000000000000002
 * ```
 *
 * @category Distributions
 */
export function dmultinom(x: readonly number[], prob: readonly number[], options: MultinomialOptions = {}): number {
  const log = options.log ?? false;
  const K = prob.length;
  if (x.length !== K) throw new RangeError("x and prob must have the same length");
  if (prob.some((p) => !Number.isFinite(p) || p < 0)) throw new RangeError("probabilities must be finite and non-negative");
  if (!prob.some((p) => p > 0)) throw new RangeError("probabilities must not all be 0");
  if (x.some((v) => !(v >= 0) || !Number.isFinite(v) || v !== Math.round(v)))
    throw new RangeError("x must be non-negative integers");
  const N = x.reduce((a, b) => a + b, 0);
  if (options.size !== undefined && options.size !== N) throw new RangeError("size must equal the sum of x");
  // Suffix sums of the weights (double-double) and the counts
  let w = prob;
  let ps = suffixSums(w);
  if (ps[0]![0] === Infinity) {
    // Finite weights whose sum overflows: divided by 2^s >= K, which only the ratios matter for (exact unless a
    // weight becomes subnormal; one that becomes 0 is below 1e-600 of the largest); weights with a sum in range are
    // used as given
    const s = Math.ceil(Math.log2(K));
    w = prob.map((p) => ldexp(p, -s));
    ps = suffixSums(w);
  }
  const ns = new Array<number>(K + 1).fill(0);
  for (let k = K - 1; k >= 0; k--) ns[k] = ns[k + 1]! + x[k]!;
  // A category with probability 0 and a positive count makes the probability 0
  for (let k = 0; k < K; k++) if (w[k] === 0 && x[k]! > 0) return log ? -Infinity : 0;
  let logSum = 0;
  let prodLin = 1;
  for (let k = 0; k < K; k++) {
    if (w[k] === 0) continue;
    const rest = ps[k + 1]!;
    if (rest[0] === 0) break; // the remaining counts all fall here: probability 1
    const q: DD = ddDiv([w[k]!, 0], ps[k]!);
    const qc: DD = ddDiv(rest, ps[k]!);
    const xk = x[k]!;
    const nmx = ns[k + 1]!;
    if (log) logSum += dbinomRawDD(xk, nmx, q, qc, true);
    else prodLin *= dbinomRawDD(xk, nmx, q, qc, false);
  }
  return log ? logSum : prodLin;
}

/** Suffix sums w_k + ... + w_(K-1) in double-double, for k = 0..K (the last is 0) */
function suffixSums(w: readonly number[]): DD[] {
  const ps = new Array<DD>(w.length + 1).fill([0, 0]);
  for (let k = w.length - 1; k >= 0; k--) ps[k] = ddAdd(ps[k + 1]!, [w[k]!, 0]);
  return ps;
}
