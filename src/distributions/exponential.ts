// Exponential distribution dexp / pexp / qexp.
//
// f(x) = rate exp(-rate x), P[X > x] = exp(-rate x). rate x is formed in double-double
// (the relative error of exp(-t) equals the absolute error of t, and at t = 700 the rounding of the product alone gives 6e-14).
// Argument handling (rate = 0, Inf) is matched to R's output.

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { expNeg, log1mExp, logOneMinusExpNeg, mulDD } from "../internal/ddexp.js";

/** Parameters of the exponential distribution. */
export interface ExponentialParams {
  /** Rate. Default `1`. */
  rate?: number;
}

export function dexp1(x: number, rate: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(rate)) return NaN;
  if (rate < 0 || rate === Infinity) return NaN;
  if (x < 0) return d0(log);
  const t = mulDD(rate, x);
  if (Number.isNaN(t[0])) return NaN;
  if (log) return Math.log(rate) - t[0] - t[1];
  return rate * expNeg(t);
}

/** Log or linear value of P[X > x], according to the tail direction */
function expTail(t: readonly [number, number], lowerTail: boolean, logP: boolean): number {
  if (!lowerTail) return logP ? -t[0] - t[1] : expNeg(t);
  // Lower tail 1 - exp(-t)
  const s = t[0] + t[1];
  return logP ? logOneMinusExpNeg(t) : -Math.expm1(-s);
}

export function pexp1(q: number, rate: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(rate)) return NaN;
  if (rate < 0) return NaN;
  if (q <= 0) return dt0(lowerTail, logP);
  const t = mulDD(rate, q);
  if (Number.isNaN(t[0])) return NaN;
  if (t[0] === Infinity) return dt1(lowerTail, logP);
  return expTail(t, lowerTail, logP);
}

export function qexp1(p: number, rate: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(rate)) return NaN;
  if (rate < 0) return NaN;
  const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
  if (Number.isNaN(b) || b === 0) return b!;
  // Log of the upper probability, log P[X > x] = -rate x
  let lu: number;
  if (logP) lu = lowerTail ? log1mExp(p) : p;
  else lu = lowerTail ? Math.log1p(-p) : Math.log(p);
  return -lu / rate;
}

/**
 * Density of the exponential distribution. Equivalent to R's `dexp(x, rate = 1, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `rate` (see {@link ExponentialParams}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 */
export function dexp<T extends Vectorizable>(x: T, options: ExponentialParams & DensityOptions = {}): VectorResult<T> {
  const { rate = 1, log = false } = options;
  return vectorize(x, (v) => dexp1(v, rate, log));
}

/**
 * Distribution function of the exponential distribution. Equivalent to R's `pexp(q, rate = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `rate` (see {@link ExponentialParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 */
export function pexp<T extends Vectorizable>(q: T, options: ExponentialParams & TailOptions = {}): VectorResult<T> {
  const { rate = 1, lowerTail = true, logP = false } = options;
  return vectorize(q, (v) => pexp1(v, rate, lowerTail, logP));
}

/**
 * Quantile function of the exponential distribution. Equivalent to R's `qexp(p, rate = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `rate` (see {@link ExponentialParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 */
export function qexp<T extends Vectorizable>(p: T, options: ExponentialParams & TailOptions = {}): VectorResult<T> {
  const { rate = 1, lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qexp1(v, rate, lowerTail, logP));
}
