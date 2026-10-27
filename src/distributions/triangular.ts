// Triangular distribution dtriang / ptriang / qtriang (extraDistr's names: minimum a, maximum b, mode c).
//
// Written for rStats.js (no ported code). With w = b - a:
//   f(x) = 2 (x - a) / (w (c - a)) left of c, 2 (b - x) / (w (b - c)) right of it;
//   P[X <= x] = (x - a)^2 / (w (c - a)) left of c,   P[X > x] = (b - x)^2 / (w (b - c)) right of it.
// Each tail is computed from its own end, and the quantile from the tail it falls in. Products are formed from ratios
// of lengths (each at most 1), so that wide and narrow intervals neither overflow nor underflow on the way.

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, type DensityOptions, type TailOptions } from "../internal/dpq.js";

/**
 * Limits and mode of the triangular distribution.
 *
 * @category Distributions
 */
export interface TriangParams {
  /** Minimum. Default `-1`. */
  a?: number;
  /** Maximum. Default `1`. */
  b?: number;
  /** Mode. Default `(a + b) / 2`. */
  c?: number;
}

const valid = (a: number, b: number, c: number): boolean => Number.isFinite(a) && Number.isFinite(b) && a < b && a <= c && c <= b;

/** 1/2 when b - a overflows (x, a, b and c are all halved then; the probabilities do not change), else 1 */
const halfIfOverflow = (a: number, b: number): number => (Number.isFinite(b - a) ? 1 : 0.5);

export function dtriang1(x: number, a: number, b: number, c: number, log: boolean): number {
  if (Number.isNaN(x) || !valid(a, b, c)) return NaN;
  if (x < a || x > b) return d0(log);
  const h = halfIfOverflow(a, b);
  if (h !== 1) {
    const d = dtriang1(x * h, a * h, b * h, c * h, log);
    return log ? d + Math.log(h) : d * h;
  }
  const w = b - a;
  // The density is (2 / w) s with s = (x - a) / (c - a) left of the mode, (b - x) / (b - c) right of it (s <= 1, so
  // nothing over- or underflows on the way unless the density itself does). Near the mode s = 1 - r with r the
  // fraction of the way from the mode to the end on x's side (x - c is exact there)
  const r = x === c ? 0 : x < c ? (c - x) / (c - a) : (x - c) / (b - c);
  if (r < 0.5) return log ? Math.LN2 - Math.log(w) + Math.log1p(-r) : (2 * (1 - r)) / w;
  const s = x < c ? (x - a) / (c - a) : (b - x) / (b - c);
  return log ? Math.LN2 - Math.log(w) + Math.log(s) : (2 * s) / w;
}

/**
 * The tails [lower, upper] at a < q < b (b - a finite), from ratios of lengths that are at most 1, and the log of the
 * near tail (the one from the end on q's side of the mode) as a sum of logs, which stays exact where the tail is subnormal
 */
function tails(q: number, a: number, b: number, c: number): [number, number, number] {
  const w = b - a;
  // the far tail as a sum of positive terms: 1 - (q - a)^2 / (w (c - a)) = (b - c) / w + (c - q)(q - a + c - a) / (w (c - a))
  if (q <= c) {
    const [s, t] = [(q - a) / (c - a), (q - a) / w];
    return [s * t, (b - c) / w + ((c - q) / (c - a)) * (t + (c - a) / w), Math.log(s) + Math.log(t)];
  }
  const [s, t] = [(b - q) / (b - c), (b - q) / w];
  return [(c - a) / w + ((q - c) / (b - c)) * (t + (b - c) / w), s * t, Math.log(s) + Math.log(t)];
}

export function ptriang1(q: number, a: number, b: number, c: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || !valid(a, b, c)) return NaN;
  if (q <= a) return dt0(lowerTail, logP);
  if (q >= b) return dt1(lowerTail, logP);
  const h = halfIfOverflow(a, b);
  const [lower, upper, lnear] = tails(q * h, a * h, b * h, c * h);
  // The sum of positive terms can round an ulp above 1
  const v = Math.min(lowerTail ? lower : upper, 1);
  if (!logP) return v;
  // the log of a probability above 1/2 from the other tail; a subnormal near tail from its factors
  if (v > 0.5) return Math.log1p(-(lowerTail ? upper : lower));
  return v < 2 ** -1022 && lowerTail === q <= c ? lnear : Math.log(v);
}

export function qtriang1(p: number, a: number, b: number, c: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || !valid(a, b, c)) return NaN;
  const bd = quantileBoundaries(p, a, b, lowerTail, logP);
  if (bd !== undefined) return bd;
  const h = halfIfOverflow(a, b);
  if (h !== 1) return qtriang1(p, a * h, b * h, c * h, lowerTail, logP) / h;
  const w = b - a;
  const pv = logP ? Math.exp(p) : p;
  // sqrt of the tail on the side of p; exp(p / 2) where exp(p) is subnormal
  const sqrtP = logP && pv < 2 ** -1022 ? Math.exp(p / 2) : Math.sqrt(pv);
  const lower = lowerTail ? pv : logP ? -Math.expm1(p) : 1 - p;
  const upper = lowerTail ? (logP ? -Math.expm1(p) : 1 - p) : pv;
  // Left of the mode x - a = (c - a) sqrt(t) with t = lower w / (c - a), the share of the left part's probability;
  // right of it b - x = (b - c) sqrt(t), t = upper w / (b - c). Near the mode (t > 1/2) the distance from it instead,
  // (1 - sqrt(t)) = (1 - t) / (1 + sqrt(t)) with 1 - t from the other tail (for c = a or c = b that tail itself, so
  // no cancellation near the end). The square roots are taken factor by factor so that no product over- or underflows
  const cl = (c - a) / w;
  const cr = (b - c) / w;
  let x: number;
  if (cl > 0 && lower <= cl) {
    const t = (lower / (c - a)) * w;
    x =
      t <= 0.5
        ? a + (lowerTail ? sqrtP : Math.sqrt(lower)) * Math.sqrt(w) * Math.sqrt(c - a)
        : c - ((c - a) * ((upper - cr) / cl)) / (1 + Math.sqrt(t));
  } else {
    const t = (upper / (b - c)) * w;
    x =
      t <= 0.5
        ? b - (lowerTail ? Math.sqrt(upper) : sqrtP) * Math.sqrt(w) * Math.sqrt(b - c)
        : c + ((b - c) * ((lower - cl) / cr)) / (1 + Math.sqrt(t));
  }
  // Rounding must not take x out of the support
  return Math.min(Math.max(x, a), b);
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
 *
 * @category Distributions
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
 *
 * @category Distributions
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
 *
 * @category Distributions
 */
export function qtriang<T extends Vectorizable>(p: T, options: TriangParams & TailOptions = {}): VectorResult<T> {
  const { a = -1, b = 1, lowerTail = true, logP = false } = options;
  const c = options.c ?? (a + b) / 2;
  return vectorize(p, (v) => qtriang1(v, a, b, c, lowerTail, logP));
}
