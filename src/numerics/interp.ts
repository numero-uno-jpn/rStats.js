// Interpolation: R's approx (linear and constant), spline and splinefun (cubic splines: "fmm", "natural",
// "periodic", "hyman", and "monoH.FC" for splinefun), splinefunH (cubic Hermite with given slopes), the barycentric
// Lagrange interpolation of pracma's barylag, and the global Hermite polynomial through values and derivatives.
//
// Written for rStats.js (no ported code). The cubic splines follow Forsythe, Malcolm and Moler, "Computer Methods for
// Mathematical Computations" (1977): "fmm" fixes the end third derivatives to those of the cubics through the first and
// last four points, "natural" sets the end second derivatives to 0, "periodic" solves the cyclic system. "hyman" limits
// the fmm slopes to keep monotone data monotone (Hyman, SIAM J. Sci. Stat. Comput. 4, 1983) and "monoH.FC" is Fritsch
// and Carlson's monotone Hermite spline (SIAM J. Numer. Anal. 17, 1980). Each piece is y + b dx + c dx^2 + d dx^3,
// evaluated in the interval found as R finds it (so derivatives at the knots take the same side).

import { mean } from "../internal/summary.js";
import type { Sample } from "../htest/types.js";
import { seqLength } from "../internal/seq.js";

type Ties = "mean" | "min" | "max" | ((v: number[]) => number);

/** Sort by x, drop pairs with NaN and merge equal x values with `ties` (R's regularize.values) */
function regularize(x: Sample, y: Sample, ties: Ties): { x: number[]; y: number[] } {
  const xs = Array.from(x);
  const ys = Array.from(y);
  if (xs.length !== ys.length) throw new RangeError("'x' and 'y' lengths differ");
  const pairs = xs.map((v, i) => [v, ys[i]!] as [number, number]).filter(([a, b]) => !Number.isNaN(a) && !Number.isNaN(b));
  pairs.sort((a, b) => a[0] - b[0]);
  const f = typeof ties === "function" ? ties : ties === "min" ? (v: number[]) => Math.min(...v) : ties === "max" ? (v: number[]) => Math.max(...v) : mean;
  const ox: number[] = [];
  const oy: number[] = [];
  let i = 0;
  while (i < pairs.length) {
    let j = i;
    while (j + 1 < pairs.length && pairs[j + 1]![0] === pairs[i]![0]) j++;
    ox.push(pairs[i]![0]);
    oy.push(j === i ? pairs[i]![1] : f(pairs.slice(i, j + 1).map((p) => p[1])));
    i = j + 1;
  }
  return { x: ox, y: oy };
}

/** Options for {@link approx}. */
export interface ApproxOptions {
  /** Points to interpolate at. Default: `n` equally spaced points over the range of `x`. */
  xout?: Sample;
  /** `"linear"` (default) or `"constant"` (step function). */
  method?: "linear" | "constant";
  /** Number of points when `xout` is not given. Default `50`. */
  n?: number;
  /** Value left of the data. Default: NaN (rule 1) or the first y (rule 2). */
  yleft?: number;
  /** Value right of the data. Default: NaN (rule 1) or the last y (rule 2). */
  yright?: number;
  /** Extrapolation rule (1: NaN, 2: the end value), for both sides or `[left, right]`. Default `1`. */
  rule?: number | readonly [number, number];
  /** For `"constant"`: the step value is (1 - f) y_left + f y_right. Default `0`. */
  f?: number;
  /** How to merge equal x values. Default `"mean"`. */
  ties?: Ties;
}

/**
 * Linear or constant interpolation. Equivalent to R's `approx()`.
 *
 * @example
 * ```ts
 * approx([1, 2, 3], [10, 20, 40], { xout: [1.5, 2.5] }).y; // [15, 30]
 * ```
 */
export function approx(x: Sample, y: Sample, options: ApproxOptions = {}): { x: number[]; y: number[] } {
  const method = options.method ?? "linear";
  const rule = typeof options.rule === "number" || options.rule === undefined ? [options.rule ?? 1, options.rule ?? 1] : options.rule;
  const r = regularize(x, y, options.ties ?? "mean");
  const nx = r.x.length;
  if (nx <= 1) {
    if (method === "linear") throw new RangeError("need at least two non-NA values to interpolate");
    if (nx === 0) throw new RangeError("zero non-NA points");
  }
  const yleft = options.yleft ?? (rule[0] === 1 ? NaN : r.y[0]!);
  const yright = options.yright ?? (rule[1] === 1 ? NaN : r.y[nx - 1]!);
  const f = options.f ?? 0;
  let xout: number[];
  if (options.xout === undefined) {
    const n = options.n ?? 50;
    if (n <= 0) throw new RangeError("'approx' requires n >= 1");
    xout = seqLength(r.x[0]!, r.x[nx - 1]!, n);
  } else xout = Array.from(options.xout);
  const X = r.x;
  const Y = r.y;
  const f1 = 1 - f;
  const yout = xout.map((v) => {
    if (Number.isNaN(v)) return v;
    if (v < X[0]!) return yleft;
    if (v > X[nx - 1]!) return yright;
    let i = 0;
    let j = nx - 1;
    while (i < j - 1) {
      const ij = (i + j) >> 1;
      if (v < X[ij]!) j = ij;
      else i = ij;
    }
    if (v === X[j]) return Y[j]!;
    if (v === X[i]) return Y[i]!;
    if (method === "linear") return Y[i]! + (Y[j]! - Y[i]!) * ((v - X[i]!) / (X[j]! - X[i]!));
    return (f1 !== 0 ? Y[i]! * f1 : 0) + (f !== 0 ? Y[j]! * f : 0);
  });
  return { x: xout, y: yout };
}

/** Cubic spline method. */
export type SplineMethod = "fmm" | "natural" | "periodic" | "hyman";

interface Coef {
  method: SplineMethod | "monoH.FC";
  x: number[];
  y: number[];
  b: number[];
  c: number[];
  d: number[];
}

/** Second-derivative based coefficients (b, c, d) of the cubic spline through (x, y) */
function splineCoef(method: SplineMethod, x: number[], y: number[]): Coef {
  const n = x.length;
  const b = new Array<number>(n).fill(0);
  const c = new Array<number>(n).fill(0);
  const d = new Array<number>(n).fill(0);
  const coef: Coef = { method, x, y, b, c, d };
  if (n < 2) return coef;
  if (method === "periodic") {
    periodic(x, y, b, c, d);
    return coef;
  }
  if (n < 3) {
    b[0] = b[1] = (y[1]! - y[0]!) / (x[1]! - x[0]!);
    return coef;
  }
  // tridiagonal system for the second derivatives (scaled): diagonal b, off-diagonal d, right-hand side c
  d[0] = x[1]! - x[0]!;
  c[1] = (y[1]! - y[0]!) / d[0];
  for (let i = 1; i < n - 1; i++) {
    d[i] = x[i + 1]! - x[i]!;
    b[i] = 2 * (d[i - 1]! + d[i]!);
    c[i + 1] = (y[i + 1]! - y[i]!) / d[i]!;
    c[i] = c[i + 1]! - c[i]!;
  }
  if (method === "natural") {
    for (let i = 2; i < n - 1; i++) {
      const t = d[i - 1]! / b[i - 1]!;
      b[i] = b[i]! - t * d[i - 1]!;
      c[i] = c[i]! - t * c[i - 1]!;
    }
    c[n - 2] = c[n - 2]! / b[n - 2]!;
    for (let i = n - 3; i > 0; i--) c[i] = (c[i]! - d[i]! * c[i + 1]!) / b[i]!;
    c[0] = c[n - 1] = 0;
    b[0] = (y[1]! - y[0]!) / d[0]! - d[0]! * c[1]!;
    d[0] = c[1]! / d[0]!;
    b[n - 1] = (y[n - 1]! - y[n - 2]!) / d[n - 2]! + d[n - 2]! * c[n - 2]!;
    for (let i = 1; i < n - 1; i++) {
      b[i] = (y[i + 1]! - y[i]!) / d[i]! - d[i]! * (c[i + 1]! + 2 * c[i]!);
      d[i] = (c[i + 1]! - c[i]!) / d[i]!;
      c[i] = 3 * c[i]!;
    }
    c[n - 1] = 0;
    d[n - 1] = 0;
    return coef;
  }
  // fmm: end third derivatives from the cubics through the first and last four points
  b[0] = -d[0]!;
  b[n - 1] = -d[n - 2]!;
  c[0] = c[n - 1] = 0;
  if (n > 3) {
    c[0] = c[2]! / (x[3]! - x[1]!) - c[1]! / (x[2]! - x[0]!);
    c[n - 1] = c[n - 2]! / (x[n - 1]! - x[n - 3]!) - c[n - 3]! / (x[n - 2]! - x[n - 4]!);
    c[0] = (c[0]! * d[0]! * d[0]!) / (x[3]! - x[0]!);
    c[n - 1] = (-c[n - 1]! * d[n - 2]! * d[n - 2]!) / (x[n - 1]! - x[n - 4]!);
  }
  for (let i = 1; i < n; i++) {
    const t = d[i - 1]! / b[i - 1]!;
    b[i] = b[i]! - t * d[i - 1]!;
    c[i] = c[i]! - t * c[i - 1]!;
  }
  c[n - 1] = c[n - 1]! / b[n - 1]!;
  for (let i = n - 2; i >= 0; i--) c[i] = (c[i]! - d[i]! * c[i + 1]!) / b[i]!;
  b[n - 1] = (y[n - 1]! - y[n - 2]!) / d[n - 2]! + d[n - 2]! * (c[n - 2]! + 2 * c[n - 1]!);
  for (let i = 0; i < n - 1; i++) {
    b[i] = (y[i + 1]! - y[i]!) / d[i]! - d[i]! * (c[i + 1]! + 2 * c[i]!);
    d[i] = (c[i + 1]! - c[i]!) / d[i]!;
    c[i] = 3 * c[i]!;
  }
  c[n - 1] = 3 * c[n - 1]!;
  d[n - 1] = d[n - 2]!;
  return coef;
}

/** Periodic spline: the cyclic tridiagonal system for the second derivatives, solved by Cholesky factorisation */
function periodic(x: number[], y: number[], b: number[], c: number[], d: number[]): void {
  const n = x.length;
  if (y[0] !== y[n - 1]) throw new RangeError("periodic spline needs y[1] == y[n]");
  if (n === 2) return;
  if (n === 3) {
    const h1 = x[1]! - x[0]!;
    const h2 = x[2]! - x[1]!;
    b[0] = b[1] = b[2] = (-(y[0]! - y[1]!) * (x[0]! - 2 * x[1]! + x[2]!)) / h2 / h1;
    c[0] = (-3 * (y[0]! - y[1]!)) / h2 / h1;
    c[1] = -c[0]!;
    c[2] = c[0]!;
    d[0] = (-2 * c[0]!) / 3 / h1;
    d[1] = (-d[0]! * h1) / h2;
    d[2] = d[0]!;
    return;
  }
  // unknowns sigma_0..sigma_(m-1), m = n - 1 (sigma_m = sigma_0)
  const m = n - 1;
  const h = Array.from({ length: m }, (_, i) => x[i + 1]! - x[i]!);
  const diag = Array.from({ length: m }, (_, i) => 2 * (h[i]! + h[(i + m - 1) % m]!));
  const rhs = Array.from({ length: m }, (_, i) => (y[i + 1]! - y[i]!) / h[i]! - (y[i]! - y[(i + m - 1) % m === m - 1 && i === 0 ? m - 1 : i - 1]!) / h[(i + m - 1) % m]!);
  rhs[0] = (y[1]! - y[0]!) / h[0]! - (y[n - 1]! - y[n - 2]!) / h[m - 1]!;
  // cyclic system: diag[i] s_i + h[i] s_(i+1) + h[i-1] s_(i-1) = rhs[i]; Cholesky L L^T with a last column E
  const L = new Array<number>(m).fill(0);
  const M = new Array<number>(m).fill(0);
  const E = new Array<number>(m).fill(0);
  L[0] = Math.sqrt(diag[0]!);
  E[0] = h[m - 1]! / L[0]!;
  let s = 0;
  for (let i = 0; i < m - 2; i++) {
    M[i] = h[i]! / L[i]!;
    if (i !== 0) E[i] = (-E[i - 1]! * M[i - 1]!) / L[i]!;
    L[i + 1] = Math.sqrt(diag[i + 1]! - M[i]! * M[i]!);
    s += E[i]! * E[i]!;
  }
  M[m - 2] = (h[m - 2]! - E[m - 3]! * M[m - 3]!) / L[m - 2]!;
  L[m - 1] = Math.sqrt(diag[m - 1]! - M[m - 2]! * M[m - 2]! - s);
  const z = new Array<number>(m).fill(0);
  z[0] = rhs[0]! / L[0]!;
  s = 0;
  for (let i = 1; i < m - 1; i++) {
    z[i] = (rhs[i]! - M[i - 1]! * z[i - 1]!) / L[i]!;
    s += E[i - 1]! * z[i - 1]!;
  }
  z[m - 1] = (rhs[m - 1]! - M[m - 2]! * z[m - 2]! - s) / L[m - 1]!;
  const sig = new Array<number>(n).fill(0);
  sig[m - 1] = z[m - 1]! / L[m - 1]!;
  sig[m - 2] = (z[m - 2]! - M[m - 2]! * sig[m - 1]!) / L[m - 2]!;
  for (let i = m - 3; i >= 0; i--) sig[i] = (z[i]! - M[i]! * sig[i + 1]! - E[i]! * sig[m - 1]!) / L[i]!;
  sig[n - 1] = sig[0]!;
  for (let i = 0; i < m; i++) {
    b[i] = (y[i + 1]! - y[i]!) / h[i]! - h[i]! * (sig[i + 1]! + 2 * sig[i]!);
    d[i] = (sig[i + 1]! - sig[i]!) / h[i]!;
    c[i] = 3 * sig[i]!;
  }
  b[n - 1] = b[0]!;
  c[n - 1] = c[0]!;
  d[n - 1] = d[0]!;
}

/** Limit the fmm slopes so that monotone data stay monotone (Hyman 1983), then rebuild c and d from the slopes */
function hyman(z: Coef): Coef {
  const { x, y, b } = z;
  const n = x.length;
  const ss = Array.from({ length: n - 1 }, (_, i) => (y[i + 1]! - y[i]!) / (x[i + 1]! - x[i]!));
  const S0 = [ss[0]!, ...ss];
  const S1 = [...ss, ss[n - 2]!];
  for (let i = 0; i < n; i++) {
    const t1 = Math.min(Math.abs(S0[i]!), Math.abs(S1[i]!));
    const sig = S0[i]! * S1[i]! > 0 ? S1[i]! : b[i]!;
    b[i] = sig >= 0 ? Math.min(Math.max(0, b[i]!), 3 * t1) : Math.max(Math.min(0, b[i]!), -3 * t1);
  }
  // cubic Hermite coefficients from the values and the slopes
  for (let i = 0; i < n - 1; i++) {
    const h = x[i + 1]! - x[i]!;
    const dy = -(y[i + 1]! - y[i]!);
    z.c[i] = -(3 * dy + (2 * b[i]! + b[i + 1]!) * h) / (h * h);
    z.d[i] = ((2 * dy) / h + b[i]! + b[i + 1]!) / (h * h);
  }
  const h = x[n - 1]! - x[n - 2]!;
  const dy = -(y[n - 1]! - y[n - 2]!);
  z.c[n - 1] = (3 * dy + (b[n - 2]! + 2 * b[n - 1]!) * h) / (h * h);
  z.d[n - 1] = z.d[n - 2]!;
  return z;
}

/** Evaluate the piecewise cubic (or its derivative) at u, finding intervals as R's spline_eval does */
function evaluate(z: Coef, u: readonly number[], deriv: number): number[] {
  const { x, method } = z;
  const n = x.length;
  let { y, b, c, d } = z;
  const zero = new Array<number>(n).fill(0);
  if (deriv === 1) [y, b, c, d] = [b, c.map((v) => 2 * v), d.map((v) => 3 * v), zero];
  else if (deriv === 2) [y, b, c, d] = [c.map((v) => 2 * v), d.map((v) => 6 * v), zero, zero];
  else if (deriv === 3) [y, b, c, d] = [d.map((v) => 6 * v), zero, zero, zero];
  const v = method === "periodic" && n > 1 ? u.map((t) => {
    const dx = x[n - 1]! - x[0]!;
    let r = (t - x[0]!) % dx;
    if (r < 0) r += dx;
    return r + x[0]!;
  }) : [...u];
  let i = 0;
  const out = v.map((ul) => {
    if (ul < x[i]! || (i < n - 1 && x[i + 1]! < ul)) {
      i = 0;
      let j = n;
      do {
        const k = (i + j) >> 1;
        if (ul < x[k]!) j = k;
        else i = k;
      } while (j > i + 1);
    }
    const dx = ul - x[i]!;
    const tmp = method === "natural" && ul < x[0]! ? 0 : d[i]!;
    return y[i]! + dx * (b[i]! + dx * (c[i]! + dx * tmp));
  });
  // natural splines are linear left of the data: first derivative constant, higher ones 0
  if (deriv > 0 && method === "natural") return out.map((r, k) => (v[k]! <= x[0]! ? (deriv === 1 ? y[0]! : 0) : r));
  return out;
}

function prepare(x: Sample, y: Sample, method: SplineMethod, ties: Ties): Coef {
  const r = regularize(x, y, ties);
  const n = r.x.length;
  if (n === 0) throw new RangeError("zero non-NA points");
  if (method === "periodic" && r.y[0] !== r.y[n - 1]) r.y[n - 1] = r.y[0]!;
  if (method === "hyman") {
    const dy = r.y.slice(1).map((v, i) => v - r.y[i]!);
    if (!(dy.every((t) => t >= 0) || dy.every((t) => t <= 0))) throw new RangeError("'y' must be increasing or decreasing");
  }
  const z = splineCoef(method === "hyman" ? "fmm" : method, r.x, r.y);
  return method === "hyman" ? hyman({ ...z, method: "hyman" }) : z;
}

/** Options for {@link spline}. */
export interface SplineOptions {
  /** Number of equally spaced points from `xmin` to `xmax`. Default `3 * x.length`. */
  n?: number;
  /** `"fmm"` (default), `"natural"`, `"periodic"` or `"hyman"`. */
  method?: SplineMethod;
  xmin?: number;
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
 */
export function spline(x: Sample, y: Sample, options: SplineOptions = {}): { x: number[]; y: number[] } {
  const method = options.method ?? "fmm";
  const z = prepare(x, y, method, options.ties ?? "mean");
  let xout: number[];
  if (options.xout !== undefined) xout = Array.from(options.xout);
  else {
    const n = options.n ?? 3 * Array.from(x).length;
    if (n <= 0) throw new RangeError("'spline' requires n >= 1");
    xout = seqLength(options.xmin ?? Math.min(...Array.from(x)), options.xmax ?? Math.max(...Array.from(x)), n);
  }
  return { x: xout, y: evaluate(z, xout, 0) };
}

/** Options for {@link splinefun}. */
export interface SplinefunOptions {
  /** `"fmm"` (default), `"natural"`, `"periodic"`, `"monoH.FC"` or `"hyman"`. */
  method?: SplineMethod | "monoH.FC";
  /** How to merge equal x values. Default `"mean"`. */
  ties?: Ties;
}

/**
 * The cubic spline through the points, as a function of `x` and the order of derivative (0 to 3). Equivalent to R's
 * `splinefun()`.
 *
 * @example
 * ```ts
 * const s = splinefun([1, 2, 3, 4], [1, 4, 9, 16]);
 * s([2.5]);    // [6.25]
 * s([2.5], 1); // [5]
 * ```
 */
export function splinefun(x: Sample, y: Sample, options: SplinefunOptions = {}): (xq: Sample, deriv?: number) => number[] {
  const method = options.method ?? "fmm";
  if (method === "monoH.FC") {
    const r = regularize(x, y, options.ties ?? "mean");
    const n = r.x.length;
    const dx = r.x.slice(1).map((v, i) => v - r.x[i]!);
    const S = r.y.slice(1).map((v, i) => (v - r.y[i]!) / dx[i]!);
    const m = [S[0]!, ...S.slice(1).map((s, i) => (s + S[i]!) / 2), S[n - 2]!];
    // Fritsch and Carlson: shrink the slopes of each interval into the monotonicity region
    for (let k = 0; k < n - 1; k++) {
      const Sk = S[k]!;
      if (Sk === 0) m[k] = m[k + 1] = 0;
      else {
        const alpha = m[k]! / Sk;
        const beta = m[k + 1]! / Sk;
        const a2b3 = 2 * alpha + beta - 3;
        const ab23 = alpha + 2 * beta - 3;
        if (a2b3 > 0 && ab23 > 0 && alpha * (a2b3 + ab23) < a2b3 * a2b3) {
          const tauS = (3 * Sk) / Math.sqrt(alpha * alpha + beta * beta);
          m[k] = tauS * alpha;
          m[k + 1] = tauS * beta;
        }
      }
    }
    return splinefunH(r.x, r.y, m);
  }
  const z = prepare(x, y, method, options.ties ?? "mean");
  return (xq: Sample, deriv = 0) => {
    if (!(Number.isInteger(deriv) && deriv >= 0 && deriv <= 3)) throw new RangeError("'deriv' must be between 0 and 3");
    return evaluate(z, Array.from(xq), deriv);
  };
}

/**
 * The cubic Hermite spline with values `y` and slopes `m` at the points `x`, as a function of `x` and the order of
 * derivative (0 to 3); linear outside the data. Equivalent to R's `splinefunH()`.
 */
export function splinefunH(x: Sample, y: Sample, m: Sample): (xq: Sample, deriv?: number) => number[] {
  let x0 = Array.from(x);
  let y0 = Array.from(y);
  let m0 = Array.from(m);
  const n = x0.length;
  if (y0.length !== n || m0.length !== n) throw new RangeError("'x', 'y' and 'm' must have the same length");
  const order = x0.map((_, i) => i).sort((a, b) => x0[a]! - x0[b]!);
  [x0, y0, m0] = [order.map((i) => x0[i]!), order.map((i) => y0[i]!), order.map((i) => m0[i]!)];
  const dx = x0.slice(1).map((v, i) => v - x0[i]!);
  if (dx.some((v) => !(v > 0))) throw new RangeError("'x' must be *strictly* increasing (non - NA)");
  return (xq: Sample, deriv = 0) => {
    if (!(Number.isInteger(deriv) && deriv >= 0 && deriv <= 3)) throw new RangeError("'deriv' must be between 0 and 3");
    return Array.from(xq, (v) => {
      // interval: number of knots <= v (0 left of the data, n right of it)
      let lo = 0;
      let hi = n;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (x0[mid]! <= v) lo = mid + 1;
        else hi = mid;
      }
      const i = lo;
      if (i === 0) return deriv === 0 ? y0[0]! + m0[0]! * (v - x0[0]!) : deriv === 1 ? m0[0]! : 0;
      if (i === n) return deriv === 0 ? y0[n - 1]! + m0[n - 1]! * (v - x0[n - 1]!) : deriv === 1 ? m0[n - 1]! : 0;
      const k = i - 1;
      const h = dx[k]!;
      const t = (v - x0[k]!) / h;
      const t1 = t - 1;
      const slope = (y0[k + 1]! - y0[k]!) / h;
      if (deriv === 0) {
        const h01 = t * t * (3 - 2 * t);
        const tt1 = t * t1;
        return y0[k]! * (1 - h01) + h * m0[k]! * tt1 * t1 + y0[k + 1]! * h01 + h * m0[k + 1]! * tt1 * t;
      }
      if (deriv === 1) return slope * (-6 * t * t1) + m0[k]! * (3 * t - 1) * t1 + m0[k + 1]! * (3 * t - 2) * t;
      if (deriv === 2) return (slope * 6 * (1 - 2 * t) + m0[k]! * 2 * (3 * t - 2) + m0[k + 1]! * 2 * (3 * t - 1)) / h;
      return (slope * -12 + m0[k]! * 6 + m0[k + 1]! * 6) / h;
    });
  };
}

/**
 * Lagrange interpolation in barycentric form through the points (xi, yi). Equivalent to `pracma::barylag()`; the
 * points must lie within the range of the nodes.
 */
export function barylag(xi: Sample, yi: Sample, x: Sample): number[] {
  const X = Array.from(xi);
  const Y = Array.from(yi);
  const n = X.length;
  if (Y.length !== n) throw new RangeError("'xi' and 'yi' must have the same length");
  const xs = Array.from(x);
  const lo = Math.min(...X);
  const hi = Math.max(...X);
  if (xs.some((v) => v < lo || v > hi)) throw new RangeError("Some interpolation points outside the nodes.");
  const w = X.map((a, j) => {
    let p = 1;
    for (let k = 0; k < n; k++) if (k !== j) p *= a - X[k]!;
    return 1 / p;
  });
  return xs.map((v) => {
    let num = 0;
    let den = 0;
    for (let j = 0; j < n; j++) {
      const diff = v - X[j]!;
      if (diff === 0) return Y[j]!;
      const t = w[j]! / diff;
      num += t * Y[j]!;
      den += t;
    }
    return num / den;
  });
}

/**
 * The polynomial of degree 2n - 1 through n points with given values and derivatives (global Hermite
 * interpolation, jStat's hermite), evaluated at `x`. Computed by divided differences on the doubled nodes.
 */
export function hermiteInterp(xi: Sample, yi: Sample, di: Sample, x: Sample): number[] {
  const X = Array.from(xi);
  const Y = Array.from(yi);
  const D = Array.from(di);
  const n = X.length;
  if (Y.length !== n || D.length !== n) throw new RangeError("'xi', 'yi' and 'di' must have the same length");
  const z = X.flatMap((v) => [v, v]);
  const m = 2 * n;
  // divided-difference table, column by column (in place)
  const q = Y.flatMap((v) => [v, v]);
  const coef = [q[0]!];
  let col = q.slice();
  for (let k = 1; k < m; k++) {
    const next: number[] = [];
    for (let i = 0; i < m - k; i++) {
      if (k === 1 && z[i + 1] === z[i]) next.push(D[i >> 1]!);
      else next.push((col[i + 1]! - col[i]!) / (z[i + k]! - z[i]!));
    }
    coef.push(next[0]!);
    col = next;
  }
  return Array.from(x, (v) => {
    let r = coef[m - 1]!;
    for (let k = m - 2; k >= 0; k--) r = r * (v - z[k]!) + coef[k]!;
    return r;
  });
}
