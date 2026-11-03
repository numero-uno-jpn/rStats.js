// Interpolation: R's approx (linear and constant), spline and splinefun (cubic splines: "fmm", "natural",
// "periodic", "hyman", and "monoH.FC" for splinefun), splinefunH (cubic Hermite with given slopes), the barycentric
// Lagrange interpolation of pracma's barylag, and the global Hermite polynomial through values and derivatives.
//
// Sources. The "fmm" coefficients are a port of the public-domain netlib routine fmm/spline.f (Forsythe, Malcolm and
// Moler, "Computer Methods for Mathematical Computations", 1977, section 4.4): the end third derivatives are those of
// the cubics through the first and last four points. "natural" (end second derivatives 0) and "periodic" (the cyclic
// tridiagonal system, solved by Gaussian elimination with a bordered last row and column) use the same formulation of
// the book, written for rStats.js. "hyman" limits the fmm slopes to keep monotone data monotone (Hyman, SIAM J. Sci.
// Stat. Comput. 4, 1983) and "monoH.FC" is Fritsch and Carlson's monotone cubic Hermite spline (SIAM J. Numer. Anal.
// 17, 1980), both written from the papers. approx is plain linear (or step) interpolation between the merged knots,
// located with findInterval (src/descriptive/table.ts). The methods come from the sources cited here; the conventions
// (merging tied x values, extrapolation, the choice of the interval at a knot, defaults and error messages) follow
// R's documented and observed behaviour.
// Each spline piece is y + b h + c h^2 + d h^3 with h the distance from its left knot.

import { ldexp, mean } from "../internal/summary.js";
import type { Sample } from "../htest/types.js";
import { seqLength } from "../internal/seq.js";
import { findInterval } from "../descriptive/table.js";
import { maxOf, midpoint, minOf } from "../internal/extremes.js";

/**
 * How equal `x` values are merged before interpolating (R's `ties`): `"mean"`, `"min"` or `"max"` of their `y`, or a
 * function of their `y` values.
 *
 * @category Numerical methods
 */
export type Ties = "mean" | "min" | "max" | ((v: number[]) => number);

/**
 * The data as R uses it for interpolation: pairs with a NaN dropped, sorted by x, and each run of equal x merged into
 * one point whose y is `ties` of the run's y values (a single point keeps its y).
 */
function regularize(x: Sample, y: Sample, ties: Ties = "mean"): { x: number[]; y: number[] } {
  if (x.length !== y.length) throw new RangeError("'x' and 'y' lengths differ");
  const idx: number[] = [];
  for (let i = 0; i < x.length; i++) if (!Number.isNaN(x[i]!) && !Number.isNaN(y[i]!)) idx.push(i);
  idx.sort((a, b) => x[a]! - x[b]!); // stable
  const merge =
    typeof ties === "function" ? ties
    : ties === "min" ? (v: number[]) => minOf(v)
    : ties === "max" ? (v: number[]) => maxOf(v)
    : mean;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let k = 0; k < idx.length; ) {
    const xv = x[idx[k]!]!;
    let end = k + 1;
    while (end < idx.length && x[idx[end]!] === xv) end++;
    xs.push(xv);
    ys.push(end - k === 1 ? y[idx[k]!]! : merge(idx.slice(k, end).map((i) => y[i]!)));
    k = end;
  }
  return { x: xs, y: ys };
}

/** Linear interpolation at v strictly inside [X[i], X[i+1]], grouped as y_i + (y_{i+1} - y_i) ((v - x_i) / h_i). */
function linearAt(X: readonly number[], Y: readonly number[], i: number, v: number): number {
  let t = (v - X[i]!) / (X[i + 1]! - X[i]!);
  // differences of finite values that overflow are taken in half coordinates (approx(c(-1e308, 1e308), c(0, 1),
  // xout = 0) was 0, and approx(c(0, 1), c(-1e308, 1e308), xout = 0.5) Infinity; R too)
  if (!Number.isFinite(X[i + 1]! - X[i]!) || !Number.isFinite(v - X[i]!)) t = (v / 2 - X[i]! / 2) / (X[i + 1]! / 2 - X[i]! / 2);
  const dy = Y[i + 1]! - Y[i]!;
  if (!Number.isFinite(dy) && Number.isFinite(Y[i]!) && Number.isFinite(Y[i + 1]!)) return 2 * (Y[i]! / 2 + (Y[i + 1]! / 2 - Y[i]! / 2) * t);
  return Y[i]! + dy * t;
}

/**
 * (y1 - y0) / h; where the difference of finite y overflows, 2 ((y1 / 2 - y0 / 2) / h), the same quotient rounded
 * once (halving such large values is exact), so that a finite slope is not Infinity (#380)
 */
function secant(y0: number, y1: number, h: number): number {
  const dy = y1 - y0;
  if (!Number.isFinite(dy) && Number.isFinite(y0) && Number.isFinite(y1)) return 2 * ((y1 / 2 - y0 / 2) / h);
  return dy / h;
}

/** Step value (1 - f) y_i + f y_{i+1}; a term with weight 0 is dropped, so an infinite y there does not give NaN. */
function stepAt(Y: readonly number[], i: number, f: number): number {
  const term = (w: number, yv: number): number => (w === 0 ? 0 : w * yv);
  return term(1 - f, Y[i]!) + term(f, Y[i + 1]!);
}

/**
 * Options for {@link approx}.
 *
 * @category Numerical methods
 */
export interface ApproxOptions {
  /** Points to interpolate at. Default: `n` equally spaced points over the range of `x`. */
  xout?: Sample;
  /**
   * `"linear"` (default) or `"constant"` (step function). A unique prefix is accepted and anything else is an
   * error, as in R.
   */
  method?: "linear" | "constant";
  /** Number of points when `xout` is not given. Default `50`. */
  n?: number;
  /** Value left of the data. Default: NaN (rule 1) or the first y (rule 2). */
  yleft?: number;
  /** Value right of the data. Default: NaN (rule 1) or the last y (rule 2). */
  yright?: number;
  /**
   * Extrapolation rule (1: NaN, 2: the end value), for both sides or `[left, right]`. Default `1`. Any other value is
   * an error (R takes every value other than 1 as 2).
   */
  rule?: number | readonly [number, number];
  /** For `"constant"`: the step value is (1 - f) y_left + f y_right, with f in [0, 1] (else an error, as in R). Default `0`. */
  f?: number;
  /** How to merge equal x values. Default `"mean"`. */
  ties?: Ties;
}

/**
 * The interpolation method of approx, as R's pmatch(method, c("linear", "constant")): the full name or a unique
 * prefix; anything else is R's "invalid interpolation method" (it was taken as "constant", #221)
 */
function approxMethod(m: unknown): "linear" | "constant" {
  if (m === undefined) return "linear";
  if (typeof m === "string" && m.length > 0) {
    const hit = (["linear", "constant"] as const).filter((v) => v.startsWith(m));
    if (hit.length === 1) return hit[0]!;
  }
  throw new RangeError("invalid interpolation method");
}

/**
 * The extrapolation rules [left, right] of approx: 1 or 2, given once or as a pair. Any other value (R takes every
 * value other than 1 as rule 2, #221), NaN or more than two values (R's errors) is an error
 */
function approxRule(rule: unknown): [1 | 2, 1 | 2] {
  const r = typeof rule === "number" ? [rule] : Array.isArray(rule) ? (rule as unknown[]) : [];
  const ok = (v: unknown): v is 1 | 2 => v === 1 || v === 2;
  if (r.length < 1 || r.length > 2 || !r.every(ok)) throw new RangeError("'rule' must be 1 or 2, or a pair of them");
  return [r[0]!, r[r.length - 1]!] as [1 | 2, 1 | 2];
}

/**
 * Linear or constant interpolation. Equivalent to R's `approx()`.
 *
 * @example
 * ```ts
 * approx([1, 2, 3], [10, 20, 40], { xout: [1.5, 2.5] }).y; // [15, 30]
 * ```
 *
 * @category Numerical methods
 */
export function approx(
  x: Sample,
  y: Sample,
  options: ApproxOptions = {},
): {
  /** The points interpolated at (`xout`, or the equally spaced points). */
  x: number[];
  /** The interpolated values, one per point of `x`. */
  y: number[];
} {
  const { n = 50, f = 0, rule = 1, ties = "mean" } = options;
  const method = approxMethod(options.method);
  const [ruleLeft, ruleRight] = approxRule(rule);
  const pts = regularize(x, y, ties);
  const nx = pts.x.length;
  if (nx <= 1 && method === "linear") throw new RangeError("need at least two non-NA values to interpolate");
  if (nx === 0) throw new RangeError("zero non-NA points");
  // As in R, f is checked only for the constant method
  if (method === "constant" && !(f >= 0 && f <= 1)) throw new RangeError("approx(): invalid f value");
  const yleft = options.yleft ?? (ruleLeft === 1 ? NaN : pts.y[0]!);
  const yright = options.yright ?? (ruleRight === 1 ? NaN : pts.y[nx - 1]!);
  let xout: number[];
  if (options.xout !== undefined) xout = Array.from(options.xout);
  else {
    // (NaN and Infinity were an empty result and a JavaScript array error; issue #98)
    if (!Number.isFinite(n) && !Number.isNaN(n)) throw new RangeError("'length.out' must be a finite number");
    if (!(n > 0)) throw new RangeError("'approx' requires n >= 1");
    xout = seqLength(pts.x[0]!, pts.x[nx - 1]!, n);
  }
  const X = pts.x;
  const Y = pts.y;
  // k = number of knots <= v (NaN for NaN): 0 left of the data, nx at or right of the last knot. The regularized knots
  // are strictly increasing, so v is a knot exactly when it equals X[k - 1].
  const counts = findInterval(xout, X);
  const yout = xout.map((v, q) => {
    const k = counts[q]!;
    if (Number.isNaN(k)) return NaN;
    if (k === 0) return yleft;
    const left = k - 1;
    if (v === X[left]) return Y[left]!;
    if (k === nx) return yright;
    return method === "linear" ? linearAt(X, Y, left, v) : stepAt(Y, left, f);
  });
  return { x: xout, y: yout };
}

/**
 * Cubic spline method.
 *
 * @category Numerical methods
 */
export type SplineMethod = "fmm" | "natural" | "periodic" | "hyman";

/** A piecewise cubic: on [x_i, x_{i+1}], y_i + b_i h + c_i h^2 + d_i h^3 with h = u - x_i. */
interface Cubic {
  method: SplineMethod;
  x: number[];
  y: number[];
  b: number[];
  c: number[];
  d: number[];
}

/**
 * "fmm" coefficients: port of the public-domain netlib routine fmm/spline.f (Forsythe, Malcolm and Moler 1977). The
 * unknowns sigma_i = s''(x_i)/6 solve a tridiagonal system whose end rows match the third derivative of the cubic
 * through the first (last) four points; elimination without pivoting, then back substitution.
 */
function fmmCoef(x: readonly number[], y: readonly number[]): { b: number[]; c: number[]; d: number[] } {
  const n = x.length;
  const b = new Array<number>(n).fill(0);
  const c = new Array<number>(n).fill(0);
  const d = new Array<number>(n).fill(0);
  if (n < 2) return { b, c, d };
  if (n < 3) {
    b[0] = secant(y[0]!, y[1]!, x[1]! - x[0]!);
    b[1] = b[0];
    return { b, c, d };
  }
  const nm1 = n - 1;
  // b: diagonal, d: off-diagonal, c: right-hand side
  d[0] = x[1]! - x[0]!;
  c[1] = (y[1]! - y[0]!) / d[0];
  for (let i = 1; i < nm1; i++) {
    d[i] = x[i + 1]! - x[i]!;
    b[i] = 2 * (d[i - 1]! + d[i]!);
    c[i + 1] = (y[i + 1]! - y[i]!) / d[i]!;
    c[i] = c[i + 1]! - c[i]!;
  }
  // end conditions: third derivatives at the ends from divided differences
  b[0] = -d[0];
  b[nm1] = -d[n - 2]!;
  c[0] = 0;
  c[nm1] = 0;
  if (n > 3) {
    c[0] = c[2]! / (x[3]! - x[1]!) - c[1]! / (x[2]! - x[0]!);
    c[nm1] = c[n - 2]! / (x[nm1]! - x[n - 3]!) - c[n - 3]! / (x[n - 2]! - x[n - 4]!);
    c[0] = (c[0] * d[0] * d[0]) / (x[3]! - x[0]!);
    c[nm1] = (-c[nm1] * d[n - 2]! * d[n - 2]!) / (x[nm1]! - x[n - 4]!);
  }
  // forward elimination
  for (let i = 1; i < n; i++) {
    const t = d[i - 1]! / b[i - 1]!;
    b[i] = b[i]! - t * d[i - 1]!;
    c[i] = c[i]! - t * c[i - 1]!;
  }
  // back substitution: c becomes sigma
  c[nm1] = c[nm1]! / b[nm1]!;
  for (let i = n - 2; i >= 0; i--) c[i] = (c[i]! - d[i]! * c[i + 1]!) / b[i]!;
  // polynomial coefficients
  b[nm1] = (y[nm1]! - y[n - 2]!) / d[n - 2]! + d[n - 2]! * (c[n - 2]! + 2 * c[nm1]!);
  for (let i = 0; i < nm1; i++) {
    b[i] = (y[i + 1]! - y[i]!) / d[i]! - d[i]! * (c[i + 1]! + 2 * c[i]!);
    d[i] = (c[i + 1]! - c[i]!) / d[i]!;
    c[i] = 3 * c[i]!;
  }
  c[nm1] = 3 * c[nm1]!;
  d[nm1] = d[n - 2]!;
  return { b, c, d };
}

/** Coefficients b, c, d on each interval from sigma_i = s''(x_i)/6 (i = 0..n-1). */
function coefFromSigma(x: readonly number[], y: readonly number[], sigma: readonly number[]) {
  const n = x.length;
  const b = new Array<number>(n).fill(0);
  const c = new Array<number>(n).fill(0);
  const d = new Array<number>(n).fill(0);
  for (let i = 0; i < n - 1; i++) {
    const h = x[i + 1]! - x[i]!;
    b[i] = (y[i + 1]! - y[i]!) / h - h * (sigma[i + 1]! + 2 * sigma[i]!);
    c[i] = 3 * sigma[i]!;
    d[i] = (sigma[i + 1]! - sigma[i]!) / h;
  }
  return { b, c, d };
}

/** "natural" coefficients: sigma_1 = sigma_n = 0 and the interior tridiagonal system (FMM formulation). */
function naturalCoef(x: readonly number[], y: readonly number[]): { b: number[]; c: number[]; d: number[] } {
  const n = x.length;
  if (n < 3) return fmmCoef(x, y);
  const h = Array.from({ length: n - 1 }, (_, i) => x[i + 1]! - x[i]!);
  const slope = h.map((hi, i) => (y[i + 1]! - y[i]!) / hi);
  const diag = new Array<number>(n).fill(0);
  const rhs = new Array<number>(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    diag[i] = 2 * (h[i - 1]! + h[i]!);
    rhs[i] = slope[i]! - slope[i - 1]!;
  }
  for (let i = 2; i < n - 1; i++) {
    const t = h[i - 1]! / diag[i - 1]!;
    diag[i] = diag[i]! - t * h[i - 1]!;
    rhs[i] = rhs[i]! - t * rhs[i - 1]!;
  }
  const sigma = new Array<number>(n).fill(0);
  sigma[n - 2] = rhs[n - 2]! / diag[n - 2]!;
  for (let i = n - 3; i >= 1; i--) sigma[i] = (rhs[i]! - h[i]! * sigma[i + 1]!) / diag[i]!;
  const coef = coefFromSigma(x, y, sigma);
  // last knot: the slope of the last cubic at x_n; linear beyond
  coef.b[n - 1] = slope[n - 2]! + h[n - 2]! * sigma[n - 2]!;
  return coef;
}

/**
 * "periodic" coefficients: sigma_1..sigma_{n-1} (sigma_n = sigma_1) from the cyclic tridiagonal system, solved by
 * Gaussian elimination without pivoting (the system is symmetric positive definite) where the last row and column
 * carry the wrap-around entries.
 */
function periodicCoef(x: readonly number[], y: readonly number[]): { b: number[]; c: number[]; d: number[] } {
  const n = x.length;
  if (y[0] !== y[n - 1]) throw new RangeError("periodic spline needs y[1] == y[n]");
  if (n < 3) return { b: new Array<number>(n).fill(0), c: new Array<number>(n).fill(0), d: new Array<number>(n).fill(0) };
  const m = n - 1; // unknowns sigma_0..sigma_{m-1}
  const h = Array.from({ length: m }, (_, i) => x[i + 1]! - x[i]!);
  const slope = h.map((hi, i) => (y[i + 1]! - y[i]!) / hi);
  const prev = (i: number) => (i === 0 ? m - 1 : i - 1);
  // row i (i < m-1): diag[i] at column i, sup[i] at column i+1, last[i] at column m-1
  const diag = Array.from({ length: m }, (_, i) => 2 * (h[prev(i)]! + h[i]!));
  const rhs = Array.from({ length: m }, (_, i) => slope[i]! - slope[prev(i)]!);
  const sup = h.slice();
  const last = new Array<number>(m).fill(0);
  last[0] = h[m - 1]!; // wrap-around entry
  last[m - 2] = last[m - 2]! + h[m - 2]!; // the super-diagonal of row m-2 lies in the last column
  // the last row's entry in the column being eliminated
  let rowLast = last[0]!;
  let diagLast = diag[m - 1]!;
  let rhsLast = rhs[m - 1]!;
  for (let i = 0; i < m - 1; i++) {
    if (i + 1 < m - 1) {
      const t = h[i]! / diag[i]!;
      diag[i + 1] = diag[i + 1]! - t * sup[i]!;
      last[i + 1] = last[i + 1]! - t * last[i]!;
      rhs[i + 1] = rhs[i + 1]! - t * rhs[i]!;
    }
    const t = rowLast / diag[i]!;
    diagLast -= t * last[i]!;
    rhsLast -= t * rhs[i]!;
    if (i + 1 < m - 1) rowLast = (i + 1 === m - 2 ? h[m - 2]! : 0) - t * sup[i]!;
  }
  const sigma = new Array<number>(n).fill(0);
  sigma[m - 1] = rhsLast / diagLast;
  for (let i = m - 2; i >= 0; i--) {
    const s = rhs[i]! - last[i]! * sigma[m - 1]! - (i < m - 2 ? sup[i]! * sigma[i + 1]! : 0);
    sigma[i] = s / diag[i]!;
  }
  sigma[n - 1] = sigma[0]!;
  const coef = coefFromSigma(x, y, sigma);
  coef.b[n - 1] = coef.b[0]!;
  coef.c[n - 1] = coef.c[0]!;
  coef.d[n - 1] = coef.d[0]!;
  return coef;
}

/**
 * "hyman": the fmm slopes limited so that the spline through monotone data stays monotone (Hyman 1983), then c and d
 * rebuilt as the cubic Hermite pieces with those slopes.
 */
function hymanCoef(x: readonly number[], y: readonly number[]): { b: number[]; c: number[]; d: number[] } {
  const n = x.length;
  const { b, c, d } = fmmCoef(x, y);
  if (n < 2) return { b, c, d };
  const slope = Array.from({ length: n - 1 }, (_, i) => (y[i + 1]! - y[i]!) / (x[i + 1]! - x[i]!));
  for (let i = 0; i < n; i++) {
    const sm = slope[i === 0 ? 0 : i - 1]!;
    const sp = slope[i === n - 1 ? n - 2 : i]!;
    const t = Math.min(Math.abs(sm), Math.abs(sp));
    // the signs compared, not the product sm sp > 0 (the same where it is finite and nonzero): the product of two
    // small secants underflowed to 0 and the fmm slope chose the sign, negative for increasing data (issue #398)
    const nonneg = (sm > 0 && sp > 0) || (sm < 0 && sp < 0) ? sp > 0 : b[i]! >= 0;
    b[i] = nonneg ? Math.min(Math.max(0, b[i]!), 3 * t) : Math.max(Math.min(0, b[i]!), -3 * t);
  }
  for (let i = 0; i < n - 1; i++) {
    const h = x[i + 1]! - x[i]!;
    const s = (y[i + 1]! - y[i]!) / h;
    c[i] = (3 * s - 2 * b[i]! - b[i + 1]!) / h;
    d[i] = (b[i]! + b[i + 1]! - 2 * s) / (h * h);
  }
  const h = x[n - 1]! - x[n - 2]!;
  c[n - 1] = (b[n - 2]! + 2 * b[n - 1]! - (3 * (y[n - 1]! - y[n - 2]!)) / h) / h;
  d[n - 1] = d[n - 2]!;
  return { b, c, d };
}

/**
 * The exponent k by which the sorted knots are divided when their range overflows (all finite, x_max - x_min
 * infinite), else 0. The spline is then built in x / 2^k, where the spacings are finite, and evaluated at u / 2^k; a
 * derivative of order d is brought back by 2^(-d k) (both exact for normal numbers). R gives 0, NaN or wrong values
 * there (issue #125; spline, review 50).
 */
function knotScale(x: readonly number[]): number {
  const n = x.length;
  if (n < 2 || !x.every(Number.isFinite) || Number.isFinite(x[n - 1]! - x[0]!)) return 0;
  return Math.floor(Math.log2(maxOf(x.map(Math.abs))));
}

/** Regularized data and coefficients of a b/c/d spline. */
function cubicSpline(x: Sample, y: Sample, method: SplineMethod, ties: Ties): Cubic {
  const pts = regularize(x, y, ties);
  const n = pts.x.length;
  if (n === 0) throw new RangeError("zero non-NA points");
  if (method === "periodic" && pts.y[n - 1] !== pts.y[0]) pts.y[n - 1] = pts.y[0]!;
  if (method === "hyman") checkMonotone(pts.y);
  const coef =
    method === "fmm" ? fmmCoef(pts.x, pts.y)
    : method === "natural" ? naturalCoef(pts.x, pts.y)
    : method === "periodic" ? periodicCoef(pts.x, pts.y)
    : method === "hyman" ? hymanCoef(pts.x, pts.y)
    : (() => { throw new RangeError(`invalid spline method '${String(method)}'`); })();
  return { method, ...pts, ...coef };
}

function checkMonotone(y: readonly number[]): void {
  let up = true;
  let down = true;
  for (let i = 1; i < y.length; i++) {
    const dy = y[i]! - y[i - 1]!;
    if (!(dy >= 0)) up = false;
    if (!(dy <= 0)) down = false;
  }
  if (!up && !down) throw new RangeError("'y' must be increasing or decreasing");
}

/** The order of derivative as R takes it: truncated towards zero (as.integer), then checked to be 0 to 3. */
function checkDeriv(deriv: number): number {
  const d = Math.trunc(deriv);
  if (!(d >= 0 && d <= 3)) throw new RangeError("'deriv' must be between 0 and 3");
  return d;
}

/**
 * Evaluates a b/c/d spline (or a derivative). The interval is carried over from the previous query while it still
 * holds the point, and found again by bisection otherwise, so a query exactly at a knot can take either side, as in R.
 */
function evalCubic(sp: Cubic, xq: Sample, deriv0: number): number[] {
  const deriv = checkDeriv(deriv0);
  const { x, y, b, c, d, method } = sp;
  const n = x.length;
  const natural = method === "natural";
  const period = x[n - 1]! - x[0]!;
  let i = 0;
  return Array.from(xq, (u0) => {
    let u = u0;
    if (method === "periodic" && n > 1) {
      let r = (u - x[0]!) % period;
      if (r < 0) r += period;
      u = x[0]! + r;
    }
    if (natural && deriv > 0 && u <= x[0]!) return deriv === 1 ? b[0]! : 0;
    if (!(x[i]! <= u && (i === n - 1 || u <= x[i + 1]!))) {
      // largest index with x_i <= u, or 0 left of the data
      let lo = 0;
      let hi = n;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (x[mid]! <= u) lo = mid;
        else hi = mid;
      }
      i = lo;
    }
    const h = u - x[i]!;
    const di = natural && u < x[0]! ? 0 : d[i]!;
    switch (deriv) {
      case 0: return y[i]! + h * (b[i]! + h * (c[i]! + h * di));
      case 1: return b[i]! + h * (2 * c[i]! + h * (3 * di));
      case 2: return 2 * c[i]! + h * (6 * di);
      default: return 6 * di;
    }
  });
}

/**
 * Options for {@link spline}.
 *
 * @category Numerical methods
 */
export interface SplineOptions {
  /** Number of equally spaced points from `xmin` to `xmax`. Default `3 * x.length`. */
  n?: number;
  /** `"fmm"` (default), `"natural"`, `"periodic"` or `"hyman"`. */
  method?: SplineMethod;
  /** Left end of the equally spaced points. Default: the smallest `x`. */
  xmin?: number;
  /** Right end of the equally spaced points. Default: the largest `x`. */
  xmax?: number;
  /** Points to interpolate at (then `n`, `xmin` and `xmax` are not used). */
  xout?: Sample;
  /** How to merge equal x values. Default `"mean"`. */
  ties?: Ties;
}

/**
 * Cubic spline interpolation at given or equally spaced points. Equivalent to R's `spline()`.
 *
 * @example
 * ```ts
 * spline([1, 2, 3, 4], [1, 4, 9, 16], { xout: [2.5] }).y; // [6.25]
 * ```
 *
 * @category Numerical methods
 */
export function spline(
  x: Sample,
  y: Sample,
  options: SplineOptions = {},
): {
  /** The points interpolated at (`xout`, or the equally spaced points). */
  x: number[];
  /** The interpolated values, one per point of `x`. */
  y: number[];
} {
  const { method = "fmm", ties = "mean" } = options;
  let sp = cubicSpline(x, y, method, ties);
  // knots whose range overflows (x from -1e308 to 1e308; R gives NaN): the spline in x / 2^k, evaluated at xout / 2^k
  const k = knotScale(sp.x);
  if (k !== 0) sp = cubicSpline(Array.from(x, (v) => ldexp(v, -k)), y, method, ties);
  let xout: number[];
  if (options.xout !== undefined) xout = Array.from(options.xout);
  else {
    // n, xmin and xmax refer to the regularized data
    const nk = sp.x.length;
    const n = options.n ?? 3 * nk;
    // (NaN and Infinity were an empty result and a JavaScript array error, as in approx; issue #98)
    if (!Number.isFinite(n)) throw new RangeError("'length.out' must be a finite number");
    if (!(n > 0)) throw new RangeError("'spline' requires n >= 1");
    xout = seqLength(options.xmin ?? ldexp(sp.x[0]!, k), options.xmax ?? ldexp(sp.x[nk - 1]!, k), n);
  }
  return { x: xout, y: evalCubic(sp, k === 0 ? xout : xout.map((v) => ldexp(v, -k)), 0) };
}

/**
 * Options for {@link splinefun}.
 *
 * @category Numerical methods
 */
export interface SplinefunOptions {
  /** `"fmm"` (default), `"natural"`, `"periodic"`, `"monoH.FC"` or `"hyman"`. */
  method?: SplineMethod | "monoH.FC";
  /** How to merge equal x values. Default `"mean"`. */
  ties?: Ties;
}

/**
 * The cubic spline through the points, as a function of `x` and the order of derivative (0 to 3; a fraction is
 * truncated, as R does). Equivalent to R's `splinefun()`. Except that the third derivative of `"monoH.FC"` is the
 * exact one (see {@link splinefunH}).
 *
 * @example
 * ```ts
 * const s = splinefun([1, 2, 3, 4], [1, 4, 9, 16]);
 * s([2.5]);    // [6.25]
 * s([2.5], 1); // [5]
 * ```
 *
 * @category Numerical methods
 */
export function splinefun(x: Sample, y: Sample, options: SplinefunOptions = {}): (xq: Sample, deriv?: number) => number[] {
  const { method = "fmm", ties = "mean" } = options;
  // knots whose range overflows: built in x / 2^k (see knotScale), as spline
  if (method === "monoH.FC") {
    let pts = regularize(x, y, ties);
    if (pts.x.length === 0) throw new RangeError("zero non-NA points");
    const k = knotScale(pts.x);
    if (k !== 0) pts = regularize(Array.from(x, (v) => ldexp(v, -k)), y, ties);
    // the slopes in units of 1 / 2^k
    const m = fritschCarlsonSlopes(pts.x, pts.y);
    return (xq, deriv = 0) => evalHermite(pts.x, pts.y, m, k, k, xq, deriv);
  }
  let sp = cubicSpline(x, y, method, ties);
  const k = knotScale(sp.x);
  if (k === 0) return (xq, deriv = 0) => evalCubic(sp, xq, deriv);
  sp = cubicSpline(Array.from(x, (v) => ldexp(v, -k)), y, method, ties);
  return (xq, deriv = 0) => {
    const d = checkDeriv(deriv);
    return evalCubic(sp, Array.from(xq, (v) => ldexp(v, -k)), d).map((v) => ldexp(v, -d * k));
  };
}

/**
 * Fritsch and Carlson's (1980) slopes: averages of the neighbouring secants, then, interval by interval from the left,
 * pulled back onto the circle of radius 3 when (alpha, beta) leaves their monotonicity region.
 */
function fritschCarlsonSlopes(x: readonly number[], y: readonly number[]): number[] {
  const n = x.length;
  if (n < 2) throw new RangeError("length(m) must be at least two");
  const S = Array.from({ length: n - 1 }, (_, k) => (y[k + 1]! - y[k]!) / (x[k + 1]! - x[k]!));
  const m = Array.from({ length: n }, (_, k) => (k === 0 ? S[0]! : k === n - 1 ? S[n - 2]! : midpoint(S[k - 1]!, S[k]!)));
  for (let k = 0; k < n - 1; k++) {
    const Sk = S[k]!;
    if (Sk === 0) {
      m[k] = 0;
      m[k + 1] = 0;
      continue;
    }
    const alpha = m[k]! / Sk;
    const beta = m[k + 1]! / Sk;
    const a = 2 * alpha + beta - 3;
    const b = alpha + 2 * beta - 3;
    if (a > 0 && b > 0 && alpha * (a + b) < a * a) {
      const tau = (3 * Sk) / Math.sqrt(alpha * alpha + beta * beta);
      m[k] = tau * alpha;
      m[k + 1] = tau * beta;
    }
  }
  return m;
}

/**
 * Evaluates the cubic Hermite spline (or a derivative) with values y and slopes at x; linear outside the data. The
 * knots x are those divided by 2^k and the slopes are m 2^-e (k = e = 0 in the ordinary range, where this is the plain
 * formula): splinefunH keeps the given slopes (e = 0), monoH.FC its slopes in the divided coordinate (e = k), so that
 * neither is rescaled where it could overflow or lose bits.
 */
function evalHermite(
  x: readonly number[],
  y: readonly number[],
  m: readonly number[],
  k: number,
  e: number,
  xq: Sample,
  deriv0: number,
): number[] {
  const deriv = checkDeriv(deriv0);
  const n = x.length;
  return Array.from(xq, (u0) => {
    if (Number.isNaN(u0)) return NaN;
    const u = k === 0 ? u0 : ldexp(u0, -k);
    // i = number of knots <= u
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (x[mid]! <= u) lo = mid + 1;
      else hi = mid;
    }
    const i = lo;
    if (i === 0 || i === n) {
      const j = i === 0 ? 0 : n - 1;
      return deriv === 0 ? y[j]! + ldexp(m[j]! * (u - x[j]!), k - e) : deriv === 1 ? ldexp(m[j]!, -e) : 0;
    }
    const x0 = x[i - 1]!;
    const h = x[i]! - x0;
    const t = (u - x0) / h;
    const t1 = t - 1;
    const y0 = y[i - 1]!;
    const y1 = y[i]!;
    const m0 = m[i - 1]!;
    const m1 = m[i]!;
    // the secant in the units of the slopes
    const delta = ldexp(secant(y0, y1, h), e - k);
    switch (deriv) {
      case 0: {
        // h m_i in the original units
        const h01 = t * t * (3 - 2 * t);
        return y0 * (1 - h01) + ldexp(h * m0, k - e) * (t * t1 * t1) + y1 * h01 + ldexp(h * m1, k - e) * (t * t * t1);
      }
      case 1: return ldexp(delta * (-6 * t * t1) + m0 * (t1 * (3 * t - 1)) + m1 * (t * (3 * t - 2)), -e);
      case 2: return ldexp((delta * (6 - 12 * t) + m0 * (6 * t - 4) + m1 * (6 * t - 2)) / h, -e - k);
      default: {
        const num = -12 * delta + 6 * m0 + 6 * m1;
        const hh = h * h;
        // h^2 outside the normal range (h = 1e200: num / Inf was 0 for 1.2e-199; issue #399): divided by h twice
        if (!(hh >= 2 ** -1022 && hh < Infinity)) return ldexp(num / h / h, -e - 2 * k);
        return ldexp(num / hh, -e - 2 * k);
      }
    }
  });
}

/**
 * The cubic Hermite spline with values `y` and slopes `m` at the points `x`, as a function of `x` and the order of
 * derivative (0 to 3; a fraction is truncated, as R does); linear outside the data. Equivalent to R's `splinefunH()`.
 * Except for the third derivative: on [x_i, x_{i+1}] it is the exact (6 m_i + 6 m_{i+1} - 12 delta) / h^2, with
 * h = x_{i+1} - x_i and delta = (y_{i+1} - y_i) / h, where R divides by h only once (the two agree when h = 1).
 *
 * @example
 * ```ts
 * splinefunH([0, 2], [0, 0], [1, 1])([1], 3); // [3] (R: 6)
 * ```
 *
 * @category Numerical methods
 */
export function splinefunH(x: Sample, y: Sample, m: Sample): (xq: Sample, deriv?: number) => number[] {
  const n = x.length;
  if (y.length !== n || m.length !== n) throw new RangeError("'x', 'y' and 'm' must have the same length");
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => x[a]! - x[b]!);
  const X = order.map((i) => x[i]!);
  const Y = order.map((i) => y[i]!);
  const M = order.map((i) => m[i]!);
  for (let i = 1; i < n; i++)
    if (!(X[i]! - X[i - 1]! > 0)) throw new RangeError("'x' must be *strictly* increasing (non - NA)");
  // knots whose range overflows: x / 2^k (see knotScale), the slopes as given
  const k = knotScale(X);
  const Xs = k === 0 ? X : X.map((v) => ldexp(v, -k));
  return (xq, deriv = 0) => evalHermite(Xs, Y, M, k, 0, xq, deriv);
}

/**
 * Lagrange interpolation in barycentric form through the points (xi, yi). Equivalent to `pracma::barylag()` in R.
 * The points must lie within the range of the nodes.
 *
 * @example
 * ```ts
 * barylag([0, 1, 2], [1, 3, 7], [0.5, 1.5]); // [1.75, 4.75]
 * ```
 *
 * @category Numerical methods
 */
export function barylag(xi: Sample, yi: Sample, x: Sample): number[] {
  const X = Array.from(xi);
  const Y = Array.from(yi);
  const n = X.length;
  if (Y.length !== n) throw new RangeError("'xi' and 'yi' must have the same length");
  const xs = Array.from(x);
  const lo = minOf(X);
  const hi = maxOf(X);
  if (xs.some((v) => v < lo || v > hi)) throw new RangeError("Some interpolation points outside the nodes.");
  // finite nodes whose range overflows: the weights and differences in x / 2, where every difference is finite (the
  // barycentric ratio does not change with the scale of x). barylag([-1e308, 1e308], [-1, 1], [0]) was NaN (issue #215)
  const half = Number.isFinite(lo) && Number.isFinite(hi) && !Number.isFinite(hi - lo);
  const Xc = half ? X.map((a) => a / 2) : X;
  // The weights 1 / prod (x_j - x_k), each product kept as m 2^e (renormalised beyond 2^±500), then all of them by one
  // common power of 2 (which leaves the interpolant unchanged): the products of nodes of 1e200 overflowed and every
  // weight was 0, the result NaN (pracma's too; issue #14). Without renormalisation the weights are as before
  const parts = Xc.map((a, j) => {
    let p = 1;
    let e = 0;
    for (let k = 0; k < n; k++) {
      if (k === j) continue;
      const d = a - Xc[k]!;
      const q = p * d;
      if (p !== 0 && d !== 0 && Number.isFinite(d) && !(Math.abs(q) >= 2 ** -1022 && Math.abs(q) < Infinity)) {
        // only where the product leaves the normal range (it underflowed to 0 before the check below: nodes 0,
        // 2^-250, 2^-249, 2^-600 gave the weight 1/0 and NaN; issue #402): both factors as m 2^f, multiplied exactly
        const fp = Math.floor(Math.log2(Math.abs(p)));
        const fd = Math.floor(Math.log2(Math.abs(d)));
        p = ldexp(p, -fp) * ldexp(d, -fd);
        e += fp + fd;
        continue;
      }
      p = q;
      const m = Math.abs(p);
      if (m > 2 ** 500 || (m < 2 ** -500 && m > 0)) {
        const f = Math.floor(Math.log2(m));
        p = ldexp(p, -f);
        e += f;
      }
    }
    return { p, e };
  });
  const shift = parts.reduce((s, q) => Math.max(s, -q.e), -Infinity);
  const w = parts.map((q) => ldexp(1 / q.p, -q.e - shift));
  const finiteData = X.every(Number.isFinite) && Y.every(Number.isFinite);
  return xs.map((v) => {
    let num = 0;
    let den = 0;
    // at a node, its value; with repeated nodes, that of the last one (as pracma)
    const at = X.lastIndexOf(v);
    if (at >= 0) return Y[at]!;
    for (let j = 0; j < n; j++) {
      const diff = (half ? v / 2 : v) - Xc[j]!;
      const t = w[j]! / diff;
      num += t * Y[j]!;
      den += t;
    }
    const r = num / den;
    if (Number.isFinite(r) || !finiteData) return r;
    // only where the plain quotient is not finite for finite data: w_j / (x - x_j) overflowed (the nodes 0, 2^-250,
    // 2^-249, 2^-600 at 2^-1074 gave Inf / Inf; issue #402). The terms from the products m 2^e and the differences as
    // m 2^f, divided by the power of 2 of the largest term (which leaves the quotient unchanged)
    const terms = parts.map((q, j) => {
      const diff = (half ? v / 2 : v) - Xc[j]!;
      const f = Math.floor(Math.log2(Math.abs(diff)));
      return { r: 1 / q.p / ldexp(diff, -f), x: -q.e - f };
    });
    if (!terms.every((q) => Number.isFinite(q.r) && Number.isFinite(q.x))) return r;
    const top = terms.reduce((s, q) => Math.max(s, q.x), -Infinity);
    let num2 = 0;
    let den2 = 0;
    for (let j = 0; j < n; j++) {
      const t = ldexp(terms[j]!.r, terms[j]!.x - top);
      num2 += t * Y[j]!;
      den2 += t;
    }
    return num2 / den2;
  });
}

/**
 * The polynomial of degree 2n - 1 through n points with given values and derivatives (global Hermite
 * interpolation, jStat's hermite), evaluated at `x`. Not an R function. Neither base R nor the recommended packages
 * have it (for piecewise cubic Hermite interpolation, see {@link splinefunH}). Computed by divided differences on
 * the doubled nodes.
 *
 * @example
 * ```ts
 * hermiteInterp([0, 1], [0, 1], [0, 0], [0.25, 0.5]); // [0.15625, 0.5]
 * ```
 *
 * @category Numerical methods
 */
export function hermiteInterp(xi: Sample, yi: Sample, di: Sample, x: Sample): number[] {
  const X = Array.from(xi);
  const Y = Array.from(yi);
  const D = Array.from(di);
  const n = X.length;
  if (Y.length !== n || D.length !== n) throw new RangeError("'xi', 'yi' and 'di' must have the same length");
  // the divided differences of order j scale as 1 / x^j: for large nodes they underflow (hermiteInterp([-1e200, 1e200],
  // [-1, 1], [0, 0], [0.5e200]) was -1 for 0.6875, issue #216 follow-up), for tiny ones they overflow, and where the
  // range of finite nodes overflows the separations are infinite and the quotients 0 (hermiteInterp([-1e308, 1e308],
  // [-1, 1], [0, 0], [0]) was -1, issue #216). Only then (a quotient of finite, nonzero numbers that is not finite or
  // below the normal range, or a range that overflows), the polynomial in x / 2^k with 2^k near the largest node
  // (derivatives times 2^k, exact), where the nodes are of order 1. Otherwise the same bits as the unscaled table.
  let k0 = knotScale([...X].sort((a, b) => a - b));
  let table = k0 === 0 ? hermiteTable(X, Y, D) : undefined;
  if (table?.lost && [X, Y, D].every((v) => v.every(Number.isFinite))) {
    const k = Math.floor(Math.log2(maxOf(X.map(Math.abs))));
    if (k !== 0) [k0, table] = [k, undefined];
  }
  if (table === undefined) table = hermiteTable(X.map((v) => ldexp(v, -k0)), Y, D.map((v) => ldexp(v, k0)));
  const { z, coef } = table;
  const m = 2 * n;
  return Array.from(x, (v) => {
    let r = coef[m - 1]!;
    const u = k0 === 0 ? v : ldexp(v, -k0);
    for (let k = m - 2; k >= 0; k--) r = r * (u - z[k]!) + coef[k]!;
    return r;
  });
}

/**
 * The divided-difference table of hermiteInterp on the doubled nodes; `lost` where a quotient of finite, nonzero
 * numbers is not finite or falls below the normal range.
 */
function hermiteTable(
  X: readonly number[],
  Y: readonly number[],
  D: readonly number[],
): { z: number[]; coef: number[]; lost: boolean } {
  const z = X.flatMap((v) => [v, v]);
  const m = z.length;
  let lost = false;
  // divided-difference table, column by column
  const q = Y.flatMap((v) => [v, v]);
  const coef = [q[0]!];
  let col = q.slice();
  for (let k = 1; k < m; k++) {
    const next: number[] = [];
    for (let i = 0; i < m - k; i++) {
      if (k === 1 && z[i + 1] === z[i]) next.push(D[i >> 1]!);
      else {
        const num = col[i + 1]! - col[i]!;
        const den = z[i + k]! - z[i]!;
        const r = secant(col[i]!, col[i + 1]!, den);
        const finite = Number.isFinite(col[i + 1]!) && Number.isFinite(col[i]!);
        if (finite && num !== 0 && den !== 0 && !(Math.abs(r) >= 2 ** -1022 && Math.abs(r) < Infinity)) lost = true;
        next.push(r);
      }
    }
    coef.push(next[0]!);
    col = next;
  }
  return { z, coef, lost };
}
