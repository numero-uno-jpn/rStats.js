// Arcsine distribution darcsine / parcsine / qarcsine on (a, b): the beta(1/2, 1/2) distribution moved to (a, b).
//
// Written for rStats.js (no ported code). With z = (x - a) / (b - a): f(x) = dbeta(z, 1/2, 1/2) / (b - a)
// = 1 / (pi sqrt((x - a)(b - x))), P[X <= x] = pbeta(z, 1/2, 1/2) = (2/pi) asin(sqrt(z)), and
// q(p) = a + (b - a) qbeta(p, 1/2, 1/2).

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { dbeta1, pbeta1, qbeta1 } from "./beta.js";

/** Limits of the arcsine distribution. */
export interface ArcsineParams {
  /** Lower limit. Default `0`. */
  a?: number;
  /** Upper limit. Default `1`. */
  b?: number;
}

const valid = (a: number, b: number): boolean => Number.isFinite(a) && Number.isFinite(b) && a < b;

export function darcsine1(x: number, a: number, b: number, log: boolean): number {
  if (Number.isNaN(x) || !valid(a, b)) return NaN;
  if (x < a || x > b) return d0(log);
  const w = b - a;
  const d = dbeta1((x - a) / w, 0.5, 0.5, log);
  return log ? d - Math.log(w) : d / w;
}

export function parcsine1(q: number, a: number, b: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || !valid(a, b)) return NaN;
  if (q <= a) return dt0(lowerTail, logP);
  if (q >= b) return dt1(lowerTail, logP);
  return pbeta1((q - a) / (b - a), 0.5, 0.5, lowerTail, logP);
}

export function qarcsine1(p: number, a: number, b: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || !valid(a, b)) return NaN;
  const bd = quantileBoundaries(p, a, b, lowerTail, logP);
  if (bd !== undefined) return bd;
  return a + (b - a) * qbeta1(p, 0.5, 0.5, lowerTail, logP);
}

/**
 * Density of the arcsine distribution on (a, b), f(x) = 1 / (pi sqrt((x - a)(b - x))). R has no arcsine
 * distribution; this equals `dbeta((x - a) / (b - a), 0.5, 0.5) / (b - a)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `a` and `b` (see {@link ArcsineParams}) and `log` (see {@link DensityOptions}).
 */
export function darcsine<T extends Vectorizable>(x: T, options: ArcsineParams & DensityOptions = {}): VectorResult<T> {
  const { a = 0, b = 1, log = false } = options;
  return vectorize(x, (v) => darcsine1(v, a, b, log));
}

/** Distribution function of the arcsine distribution on (a, b): `pbeta((q - a) / (b - a), 0.5, 0.5)`. */
export function parcsine<T extends Vectorizable>(q: T, options: ArcsineParams & TailOptions = {}): VectorResult<T> {
  const { a = 0, b = 1, lowerTail = true, logP = false } = options;
  return vectorize(q, (v) => parcsine1(v, a, b, lowerTail, logP));
}

/** Quantile function of the arcsine distribution on (a, b): `a + (b - a) qbeta(p, 0.5, 0.5)`. */
export function qarcsine<T extends Vectorizable>(p: T, options: ArcsineParams & TailOptions = {}): VectorResult<T> {
  const { a = 0, b = 1, lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qarcsine1(v, a, b, lowerTail, logP));
}
