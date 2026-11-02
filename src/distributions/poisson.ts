// Poisson distribution dpois / ppois / qpois.
//
// Probabilities use Loader's (2000) dpoisRaw; the distribution function is P[X <= x] = Q(x + 1, lambda)
// (regularized upper incomplete gamma function); quantiles use an integer search from a Cornish-Fisher starting value.

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { discreteQuantile } from "../internal/discrete.js";
import { gammaInc } from "../special/igam.js";
import { dpoisRaw } from "../special/loader.js";
import { logAddExp, logSubExp } from "../internal/ddexp.js";
import { qnorm } from "./normal.js";
import { countAtMost, nonInt } from "../internal/integer.js";

/** Whether x is not an integer (relative tolerance 1e-9 as in R; see src/internal/integer.ts) */
export const nonInteger = nonInt;

export function dpois1(x: number, lambda: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(lambda)) return NaN;
  if (lambda < 0) return NaN;
  if (nonInteger(x)) return d0(log);
  if (x < 0 || !Number.isFinite(x)) return d0(log);
  return dpoisRaw(Math.round(x), lambda, log);
}

export function ppois1(q: number, lambda: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(lambda)) return NaN;
  if (lambda < 0) return NaN;
  if (q < 0) return dt0(lowerTail, logP);
  if (lambda === 0) return dt1(lowerTail, logP);
  if (!Number.isFinite(q)) return dt1(lowerTail, logP);
  const x = countAtMost(q);
  if (x + 1 - x === 1) return gammaInc(x + 1, lambda, !lowerTail, logP);
  // Beyond 2^53, x + 1 rounds (to x, or up to x + 2) and Q(x + 1, lambda) became Q(x, lambda): ppois(1e16, 1e16) was 0.4999999987, below
  // 1/2 (R: 0.5000000027), and qpois(0.5, 1e16) 2 above the median 1e16. Without x + 1:
  // P[X <= x] = Q(x, lambda) + dpois(x, lambda), P[X > x] = P(x, lambda) - dpois(x, lambda)
  let v: number;
  let term: number;
  if (!logP) {
    const t = gammaInc(x, lambda, !lowerTail, false);
    term = dpoisRaw(x, lambda, false);
    v = lowerTail ? t + term : t - term;
  } else {
    const lt = gammaInc(x, lambda, !lowerTail, true);
    term = dpoisRaw(x, lambda, true);
    v = lowerTail ? logAddExp(lt, term) : logSubExp(lt, term);
  }
  if (Number.isNaN(term)) return NaN;
  // The upper tail as a difference: where dpois is not resolved against it (deep tails, where both logs round to the
  // same value), one unit of x is below the resolution of the result, and the rounded x + 1 serves (round 55)
  if (lowerTail || (logP ? Number.isFinite(v) : v > 0)) return v;
  return gammaInc(x + 1, lambda, !lowerTail, logP);
}

export function qpois1(p: number, lambda: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(lambda)) return NaN;
  if (!Number.isFinite(lambda) || lambda < 0) return NaN;
  const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
  if (b !== undefined) return lambda === 0 && !Number.isNaN(b) ? 0 : b;
  if (lambda === 0) return 0;
  // Starting value from the Cornish-Fisher expansion
  const sigma = Math.sqrt(lambda);
  const z = qnorm(p, { lowerTail, logP });
  const y0 = lambda + sigma * (z + (z * z - 1) / (6 * sigma));
  return discreteQuantile({
    p,
    lowerTail,
    logP,
    // (through ppois1, which also holds beyond 2^53 where y + 1 rounds to y)
    cdf: (y, l, lg) => ppois1(y, lambda, l, lg),
    y0: Number.isFinite(y0) ? y0 : lambda,
    lo: 0,
    hi: Infinity,
  });
}

/**
 * Probability mass function of the Poisson distribution. Equivalent to R's `dpois(x, lambda, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param lambda - Mean.
 * @param options - `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * dpois(2, 3);         // 0.22404180765538775
 * dpois([0, 1, 2], 3); // [0.049787068367863944, 0.14936120510359185, 0.22404180765538775]
 * ```
 *
 * @category Distributions
 */
export function dpois<T extends Vectorizable>(x: T, lambda: number, options: DensityOptions = {}): VectorResult<T> {
  const log = options.log ?? false;
  return vectorize(x, (v) => dpois1(v, lambda, log));
}

/**
 * Distribution function of the Poisson distribution. Equivalent to R's `ppois(q, lambda, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param lambda - Mean.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * ppois(2, 3);                       // 0.4231900811268436
 * ppois(5, 3, { lowerTail: false }); // P[X > 5] = 0.08391794203130346
 * ```
 *
 * @category Distributions
 */
export function ppois<T extends Vectorizable>(q: T, lambda: number, options: TailOptions = {}): VectorResult<T> {
  const { lowerTail = true, logP = false } = options;
  return vectorize(q, (v) => ppois1(v, lambda, lowerTail, logP));
}

/**
 * Quantile function of the Poisson distribution. Equivalent to R's `qpois(p, lambda, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param lambda - Mean.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qpois(0.5, 3);           // 3
 * qpois([0.05, 0.95], 3);  // [1, 6]
 * ```
 *
 * @category Distributions
 */
export function qpois<T extends Vectorizable>(p: T, lambda: number, options: TailOptions = {}): VectorResult<T> {
  const { lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qpois1(v, lambda, lowerTail, logP));
}
