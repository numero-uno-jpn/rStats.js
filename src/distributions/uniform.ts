// Uniform distribution dunif / punif / qunif.
//
// Formulas follow the definition. Argument handling (min = max, infinite ends, out of range) is matched to R's output.

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, type DensityOptions, type TailOptions } from "../internal/dpq.js";

/**
 * Parameters of the uniform distribution.
 *
 * @category Distributions
 */
export interface UniformParams {
  /** Lower limit. Default `0`. */
  min?: number;
  /** Upper limit. Default `1`. */
  max?: number;
}

/** When max - min overflows (e.g. min = -1e308, max = 1e308), both ends are halved before computing. This is that factor */
function halfIfOverflow(min: number, max: number): number {
  return Number.isFinite(max - min) ? 1 : 0.5;
}

export function dunif1(x: number, min: number, max: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(min) || Number.isNaN(max)) return NaN;
  if (!(max > min)) return NaN;
  if (x < min || x > max) return d0(log);
  const h = halfIfOverflow(min, max);
  const w = max * h - min * h;
  return log ? -Math.log(w) + Math.log(h) : h / w;
}

export function punif1(q: number, min: number, max: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(min) || Number.isNaN(max)) return NaN;
  if (max < min || !Number.isFinite(min) || !Number.isFinite(max)) return NaN;
  if (q >= max) return dt1(lowerTail, logP);
  if (q <= min) return dt0(lowerTail, logP);
  // Divide the length on that side directly (avoids cancellation in 1 - (other side))
  const h = halfIfOverflow(min, max);
  const w = max * h - min * h;
  const v = lowerTail ? (q * h - min * h) / w : (max * h - q * h) / w;
  return logP ? Math.log(v) : v;
}

export function qunif1(p: number, min: number, max: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(min) || Number.isNaN(max)) return NaN;
  if (max < min || !Number.isFinite(min) || !Number.isFinite(max)) return NaN;
  const b = quantileBoundaries(p, min, max, lowerTail, logP);
  if (Number.isNaN(b)) return NaN;
  if (max === min) return min;
  if (b !== undefined) return b;
  // Convert to a lower probability, then min + q (max - min)
  let q: number;
  if (logP) q = lowerTail ? Math.exp(p) : -Math.expm1(p);
  else q = lowerTail ? p : 0.5 - p + 0.5;
  if (halfIfOverflow(min, max) !== 1) return (1 - q) * min + q * max;
  return min + q * (max - min);
}

/**
 * Density of the uniform distribution. Equivalent to R's `dunif(x, min = 0, max = 1, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `min` and `max` (see {@link UniformParams}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * dunif(0.5);                        // 1
 * dunif([1, 3], { min: 0, max: 2 }); // [0.5, 0]
 * ```
 *
 * @category Distributions
 */
export function dunif<T extends Vectorizable>(x: T, options: UniformParams & DensityOptions = {}): VectorResult<T> {
  const { min = 0, max = 1, log = false } = options;
  return vectorize(x, (v) => dunif1(v, min, max, log));
}

/**
 * Distribution function of the uniform distribution. Equivalent to R's `punif(q, min = 0, max = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `min` and `max` (see {@link UniformParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * punif(0.3);                        // 0.3
 * punif(1.5, { min: 1, max: 3 });    // 0.25
 * ```
 *
 * @category Distributions
 */
export function punif<T extends Vectorizable>(q: T, options: UniformParams & TailOptions = {}): VectorResult<T> {
  const { min = 0, max = 1, lowerTail = true, logP = false } = options;
  return vectorize(q, (v) => punif1(v, min, max, lowerTail, logP));
}

/**
 * Quantile function of the uniform distribution. Equivalent to R's `qunif(p, min = 0, max = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `min` and `max` (see {@link UniformParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qunif(0.25);                       // 0.25
 * qunif([0.1, 0.9], { min: -1, max: 1 }); // [-0.8, 0.8]
 * ```
 *
 * @category Distributions
 */
export function qunif<T extends Vectorizable>(p: T, options: UniformParams & TailOptions = {}): VectorResult<T> {
  const { min = 0, max = 1, lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qunif1(v, min, max, lowerTail, logP));
}
