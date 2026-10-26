// Triangular distribution dtriang / ptriang / qtriang (extraDistr's names: minimum a, maximum b, mode c).
//
// Written for rStats.js (no ported code). With w = b - a:
//   f(x) = 2 (x - a) / (w (c - a)) left of c, 2 (b - x) / (w (b - c)) right of it;
//   P[X <= x] = (x - a)^2 / (w (c - a)) left of c,   P[X > x] = (b - x)^2 / (w (b - c)) right of it.
// Each tail is computed from its own end, and the quantile from the tail it falls in.

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, type DensityOptions, type TailOptions } from "../internal/dpq.js";

/** Limits and mode of the triangular distribution. */
export interface TriangParams {
  /** Minimum. Default `-1`. */
  a?: number;
  /** Maximum. Default `1`. */
  b?: number;
  /** Mode. Default `(a + b) / 2`. */
  c?: number;
}

const valid = (a: number, b: number, c: number): boolean => Number.isFinite(a) && Number.isFinite(b) && a < b && a <= c && c <= b;

export function dtriang1(x: number, a: number, b: number, c: number, log: boolean): number {
  if (Number.isNaN(x) || !valid(a, b, c)) return NaN;
  if (x < a || x > b) return d0(log);
  const w = b - a;
  if (x === c) return log ? Math.log(2 / w) : 2 / w;
  // the density is (2 / w) (1 - r), r the fraction of the way from the mode to the end on x's side; near the mode
  // 1 - r from r (x - c is exact there), elsewhere from the distance to the end
  const r = x < c ? (c - x) / (c - a) : (x - c) / (b - c);
  if (r < 0.5) return log ? Math.log(2 / w) + Math.log1p(-r) : (2 / w) * (1 - r);
  const d = x < c ? (2 * (x - a)) / (w * (c - a)) : (2 * (b - x)) / (w * (b - c));
  return log ? Math.log(d) : d;
}

export function ptriang1(q: number, a: number, b: number, c: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || !valid(a, b, c)) return NaN;
  if (q <= a) return dt0(lowerTail, logP);
  if (q >= b) return dt1(lowerTail, logP);
  const w = b - a;
  // the far tail as a sum of positive terms: 1 - (q - a)^2 / (w (c - a)) = (b - c) / w + (c - q)(q + c - 2a) / (w (c - a))
  let lower: number;
  let upper: number;
  if (q <= c) {
    lower = ((q - a) * (q - a)) / (w * (c - a));
    upper = (b - c) / w + ((c - q) * (q - a + (c - a))) / (w * (c - a));
  } else {
    upper = ((b - q) * (b - q)) / (w * (b - c));
    lower = (c - a) / w + ((q - c) * (b - q + (b - c))) / (w * (b - c));
  }
  const v = lowerTail ? lower : upper;
  if (!logP) return v;
  // the log of a probability above 1/2 from the other tail
  return v > 0.5 ? Math.log1p(-(lowerTail ? upper : lower)) : Math.log(v);
}

export function qtriang1(p: number, a: number, b: number, c: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || !valid(a, b, c)) return NaN;
  const bd = quantileBoundaries(p, a, b, lowerTail, logP);
  if (bd !== undefined) return bd;
  const w = b - a;
  const pv = logP ? Math.exp(p) : p;
  const lower = lowerTail ? pv : logP ? -Math.expm1(p) : 1 - p;
  const upper = lowerTail ? (logP ? -Math.expm1(p) : 1 - p) : pv;
  if (lower <= (c - a) / w) return a + Math.sqrt(lower * w * (c - a));
  return b - Math.sqrt(upper * w * (b - c));
}

/**
 * Density of the triangular distribution. Equivalent to `extraDistr::dtriang(x, a = -1, b = 1, c = (a + b)/2, log = FALSE)` in R.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `a`, `b` and `c` (see {@link TriangParams}) and `log` (see {@link DensityOptions}).
 *
 * @example
 * ```ts
 * dtriang(0);                            // 1
 * dtriang(1, { a: 0, b: 4, c: 1 });      // 0.5
 * ```
 */
export function dtriang<T extends Vectorizable>(x: T, options: TriangParams & DensityOptions = {}): VectorResult<T> {
  const { a = -1, b = 1, log = false } = options;
  const c = options.c ?? (a + b) / 2;
  return vectorize(x, (v) => dtriang1(v, a, b, c, log));
}

/**
 * Distribution function of the triangular distribution. Equivalent to `extraDistr::ptriang(q, a, b, c, lower.tail, log.p)` in R.
 *
 * @example
 * ```ts
 * ptriang(0);                            // 0.5
 * ptriang(2, { a: 0, b: 4, c: 1 });      // 0.6666666666666667
 * ```
 */
export function ptriang<T extends Vectorizable>(q: T, options: TriangParams & TailOptions = {}): VectorResult<T> {
  const { a = -1, b = 1, lowerTail = true, logP = false } = options;
  const c = options.c ?? (a + b) / 2;
  return vectorize(q, (v) => ptriang1(v, a, b, c, lowerTail, logP));
}

/**
 * Quantile function of the triangular distribution. Equivalent to `extraDistr::qtriang(p, a, b, c, lower.tail, log.p)` in R.
 *
 * @example
 * ```ts
 * qtriang(0.5);                          // 0
 * qtriang(0.9, { a: 0, b: 4, c: 1 });    // 2.904554884989668
 * ```
 */
export function qtriang<T extends Vectorizable>(p: T, options: TriangParams & TailOptions = {}): VectorResult<T> {
  const { a = -1, b = 1, lowerTail = true, logP = false } = options;
  const c = options.c ?? (a + b) / 2;
  return vectorize(p, (v) => qtriang1(v, a, b, c, lowerTail, logP));
}
