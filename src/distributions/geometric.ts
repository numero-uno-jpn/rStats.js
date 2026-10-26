// Geometric distribution dgeom / pgeom / qgeom.
//
// P[X = x] = p q^x, P[X > x] = q^(x+1) (q = 1 - p). q^n is computed with Loader's (2000) building blocks
// (dbinomRawDD in src/special/loader.ts, as the binomial probability of 0 successes and n failures)
// (the exponent is kept in double-double so that the rounding of n log q is not amplified n times).
// Quantiles use a closed form.

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { log1mExp } from "../internal/ddexp.js";
import { nonInt } from "../internal/integer.js";
import { dbinomRawDD } from "../special/loader.js";
import { twoSum, type DD } from "../special/dd.js";

/** p and q = 1 - p in double-double (the smaller one is the exact base) */
export function probPair(prob: number): { pd: DD; qd: DD } {
  return prob <= 0.5
    ? { pd: [prob, 0], qd: twoSum(1, -prob) }
    : { pd: twoSum(1, -(1 - prob)), qd: [1 - prob, 0] };
}

function badProb(prob: number): boolean {
  return !(prob > 0) || prob > 1;
}

export function dgeom1(x: number, prob: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(prob)) return NaN;
  if (badProb(prob)) return NaN;
  if (nonInt(x) || x < 0 || !Number.isFinite(x)) return d0(log);
  const n = Math.round(x);
  const { pd, qd } = probPair(prob);
  // q^n
  const qn = dbinomRawDD(0, n, pd, qd, log);
  return log ? Math.log(prob) + qn : prob * qn;
}

/** P[X > x] = q^(x+1) (x a nonnegative integer) */
function upper(x: number, prob: number, log: boolean): number {
  const { pd, qd } = probPair(prob);
  return dbinomRawDD(0, x + 1, pd, qd, log);
}

function pgeomRaw(x: number, prob: number, lowerTail: boolean, logP: boolean): number {
  if (!lowerTail) return upper(x, prob, logP);
  const lu = upper(x, prob, true);
  if (!logP) return -Math.expm1(lu);
  // When the upper tail is small, use log1p of the linear value (whose exponent was computed in double-double)
  return lu < -Math.LN2 ? Math.log1p(-upper(x, prob, false)) : Math.log(-Math.expm1(lu));
}

export function pgeom1(q: number, prob: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(prob)) return NaN;
  if (badProb(prob)) return NaN;
  if (q < 0) return dt0(lowerTail, logP);
  if (!Number.isFinite(q) || prob === 1) return dt1(lowerTail, logP);
  return pgeomRaw(Math.floor(q + 1e-7), prob, lowerTail, logP);
}

export function qgeom1(p: number, prob: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(prob)) return NaN;
  if (badProb(prob)) return NaN;
  const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
  if (Number.isNaN(b)) return NaN;
  if (prob === 1) return 0;
  if (b !== undefined) return b;
  // Smallest integer y with P[X > y] = q^(y+1) <= (upper probability), solved in closed form
  // (matches R's output. The distribution function is flat, so in an integer search the probability slack would move the answer a lot)
  let lu: number;
  if (logP) lu = lowerTail ? log1mExp(p) : p;
  else lu = lowerTail ? Math.log1p(-p) : Math.log(p);
  return Math.max(0, Math.ceil(lu / Math.log1p(-prob) - 1 - 1e-12));
}

/**
 * Probability mass function of the geometric distribution (number of failures before the first success). Equivalent to R's `dgeom(x, prob, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param prob - Probability of success on each trial.
 * @param options - `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * dgeom(2, 0.3);         // 0.147
 * dgeom([0, 1, 2], 0.5); // [0.5, 0.25, 0.125]
 * ```
 */
export function dgeom<T extends Vectorizable>(x: T, prob: number, options: DensityOptions = {}): VectorResult<T> {
  const log = options.log ?? false;
  return vectorize(x, (v) => dgeom1(v, prob, log));
}

/**
 * Distribution function of the geometric distribution (number of failures before the first success). Equivalent to R's `pgeom(q, prob, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param prob - Probability of success on each trial.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pgeom(2, 0.3);                       // 0.657
 * pgeom(2, 0.3, { lowerTail: false }); // 0.343
 * ```
 */
export function pgeom<T extends Vectorizable>(q: T, prob: number, options: TailOptions = {}): VectorResult<T> {
  const { lowerTail = true, logP = false } = options;
  return vectorize(q, (v) => pgeom1(v, prob, lowerTail, logP));
}

/**
 * Quantile function of the geometric distribution (number of failures before the first success). Equivalent to R's `qgeom(p, prob, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param prob - Probability of success on each trial.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qgeom(0.5, 0.3);          // 1
 * qgeom([0.1, 0.9], 0.3);   // [0, 6]
 * ```
 */
export function qgeom<T extends Vectorizable>(p: T, prob: number, options: TailOptions = {}): VectorResult<T> {
  const { lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qgeom1(v, prob, lowerTail, logP));
}
