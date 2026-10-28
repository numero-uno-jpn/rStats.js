// Studentized range distribution ptukey / qtukey (used by Tukey's HSD).
//
// Q = R / s, where R is the range of nmeans samples from the standard normal (the maximum of nranges such
// ranges when nranges > 1), and df s^2 follows χ² with df degrees of freedom, independent of R. The
// distribution function is the double integral
//   P[Q <= q] = ∫_0^∞ f_S(s) W(q s)^r ds,   W(w) = k ∫ φ(z) {Φ(z) - Φ(z - w)}^(k-1) dz
// (k = nmeans, r = nranges) (Copenhaver & Holland 1988). Written from the formulas in the paper.
// R applies a 16-point Gauss-Legendre rule on fixed intervals, so it is accurate to only about 8 digits
// (R's ?ptukey). Here we aim at about 1e-15 relative as follows.
// - Integrals use an adaptive Clenshaw-Curtis rule (convergence judged from the trailing Chebyshev coefficients)
// - The upper probability is not 1 - (lower); instead the subtraction-free integrand
//     1 - W(w) = k ∫ φ(z) {Φ(z)^(k-1) - (Φ(z) - Φ(z - w))^(k-1)} dz
//   is integrated directly (avoids cancellation for small upper probabilities). The larger tail is 1 - (smaller)
// - Φ(z) - Φ(z - w) is computed by integrating φ with Gauss-Legendre when the window is narrow; otherwise
//   the rounding of z - w is removed by a first-order correction
// - The inner integrals log W(w) and log(1 - W(w)) are cached per nmeans as piecewise Chebyshev
//   interpolants in log w (speeds up the outer integral, the quantile search, and repeated calls with the same nmeans)
// - The outer integral is over v = log(t/a), t = df s^2 / 2 ~ Gamma(a = df/2), with the density in Loader's form
//   (stirlerr and bd0 = a (e^v - 1 - v)). When the result is below 1e-290, it is recomputed with a version that
//   keeps the integrand on the log scale
// Quantiles solve for the log probability of the smaller tail in log q with Brent's method.

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { dt0, dt1, quantileBoundaries, smallerTail, type TailOptions } from "../internal/dpq.js";
import { stirlerr } from "../special/loader.js";
import { pnorm } from "./normal.js";

/**
 * Options for {@link ptukey} and {@link qtukey}.
 *
 * @category Distributions
 */
export interface TukeyOptions extends TailOptions {
  /** Number of groups whose ranges are compared; the statistic is the maximum of that many ranges. Default `1`. */
  nranges?: number;
}

// ---- Clenshaw-Curtis rule (convergence judged from the Chebyshev coefficients) ----
//
// Evaluate f on [a, b] at the Chebyshev points x_j = cos(jπ/N) (j = 0..N), compute the Chebyshev
// coefficients, and integrate. N doubles through 16, 32, 64, 128 (the points are nested, so earlier
// evaluations are reused). Converged once the trailing coefficients are small enough; if 128 points are
// not enough, bisect. The integrands are analytic and smooth, so the coefficients decay exponentially and
// this test is reliable.

const CC_MAX = 128;
const EPS = Number.EPSILON;
/** Upper bound on the number of intervals of one integral (smooth integrands need a few dozen) */
const MAX_PIECES = 256;

/** Table of cos(π m / CC_MAX) (m = 0..2 CC_MAX) */
const COS_TABLE = Float64Array.from({ length: 2 * CC_MAX + 1 }, (_, m) => Math.cos((Math.PI * m) / CC_MAX));

/** Weights of the N-point Clenshaw-Curtis rule (interval [-1, 1], nodes cos(jπ/N)) */
function ccWeights(N: number): Float64Array {
  const w = new Float64Array(N + 1);
  for (let j = 0; j <= N; j++) {
    let s = 0;
    for (let m = 0; m <= N; m += 2) {
      const f = m === 0 || m === N ? 0.5 : 1;
      // cos(m j π / N) is looked up from the table with the argument reduced mod 2N (avoids rounding of large arguments)
      s += (f * COS_TABLE[((m * j) % (2 * N)) * (CC_MAX / N)]! * 2) / (1 - m * m);
    }
    w[j] = ((j === 0 || j === N ? 0.5 : 1) * 2 * s) / N;
  }
  return w;
}
const CC_WEIGHTS = new Map<number, Float64Array>([16, 32, 64, 128].map((N) => [N, ccWeights(N)]));

/**
 * From the N-point values v[j] = f(cos(jπ/N)) (j = 0..N), return the integral (over [-1, 1]) and the size of
 * the trailing Chebyshev coefficients (m = N-7..N; 8 of them so that a zero coefficient from an even or odd
 * function is not mistaken for convergence). scale is Σ |weight × value| (a measure of rounding error).
 */
function chebyshev(v: Float64Array, N: number): { integral: number; tail: number; scale: number } {
  const w = CC_WEIGHTS.get(N)!;
  const step = CC_MAX / N;
  let integral = 0;
  let scale = 0;
  for (let j = 0; j <= N; j++) {
    integral += w[j]! * v[j]!;
    scale += Math.abs(w[j]! * v[j]!);
  }
  let tail = 0;
  for (let m = N - 7; m <= N; m++) {
    // c_m = (2/N) Σ'' v_j cos(m j π / N)
    let c = 0.5 * (v[0]! + (m % 2 === 0 ? v[N]! : -v[N]!));
    for (let j = 1; j < N; j++) c += v[j]! * COS_TABLE[((m * j) % (2 * N)) * step]!;
    c *= 2 / N;
    if (m === N) c *= 0.5;
    tail = Math.max(tail, Math.abs(c));
  }
  return { integral, tail, scale };
}

/** Clenshaw-Curtis rule on [a, b]. Evaluated values are kept and reused when the number of points doubles */
class CCPiece {
  readonly c: number;
  readonly h: number;
  private readonly values = new Float64Array(CC_MAX + 1);
  private readonly have = new Uint8Array(CC_MAX + 1);
  N = 0;
  integral = 0;
  error = Infinity;

  constructor(
    private readonly f: (x: number) => number,
    readonly a: number,
    readonly b: number,
    /** Relative noise of the values of f (the error estimate does not go below it) */
    private readonly noise: number,
  ) {
    this.c = 0.5 * (a + b);
    this.h = 0.5 * (b - a);
  }

  /** Raise to N points and update the integral and error estimate */
  advance(N: number): void {
    const step = CC_MAX / N;
    const v = new Float64Array(N + 1);
    for (let j = 0; j <= N; j++) {
      const idx = j * step;
      if (!this.have[idx]) {
        this.values[idx] = this.f(this.c + this.h * COS_TABLE[idx]!);
        this.have[idx] = 1;
      }
      v[j] = this.values[idx]!;
    }
    const res = chebyshev(v, N);
    this.N = N;
    this.integral = res.integral * this.h;
    // Truncation error is about trailing coefficient × Σ 2/m^2 ≈ trailing × 4/N. Do not go below the noise of the values
    this.error = Math.max((res.tail * 4) / N, this.noise * res.scale) * Math.abs(this.h);
  }
}

/**
 * Integrate f over the sequence of intervals edges (ascending). First compute each interval with 16 points to
 * estimate the magnitude of the integral, then double the points until each interval's error estimate is at most
 * relTol × |total| / (number of intervals) (bisecting if 128 points are not enough). noise is the relative error of
 * the values of f: an interval whose error estimate is at that level is accepted, since refining it cannot make the
 * estimate smaller (the noise shows up in the trailing coefficients at any width). Without it, an integrand computed
 * as exp(lf - M) with |lf| in the thousands (noise ε |lf|) was bisected down to the round limit at every call. The
 * number of intervals is bounded as well, so that the work stays bounded whatever the integrand.
 */
function integrate(f: (x: number) => number, edges: readonly number[], relTol: number, noise = 4 * EPS): number {
  let pieces: CCPiece[] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const p = new CCPiece(f, edges[i]!, edges[i + 1]!, noise);
    p.advance(16);
    pieces.push(p);
  }
  for (let round = 0; round < 40; round++) {
    let total = 0;
    for (const p of pieces) total += p.integral;
    const tol = (relTol * Math.abs(total)) / pieces.length;
    let done = true;
    let count = pieces.length;
    const next: CCPiece[] = [];
    for (const p of pieces) {
      if (p.error <= tol || p.error <= noise * Math.abs(p.integral)) {
        next.push(p);
        continue;
      }
      done = false;
      if (p.N < CC_MAX) {
        p.advance(2 * p.N);
        next.push(p);
      } else if (count >= MAX_PIECES) {
        next.push(p);
      } else {
        count++;
        const l = new CCPiece(f, p.a, p.c, noise);
        const r = new CCPiece(f, p.c, p.b, noise);
        l.advance(16);
        r.advance(16);
        next.push(l, r);
      }
    }
    pieces = next;
    if (done) break;
  }
  let s = 0;
  for (const p of pieces) s += p.integral;
  return s;
}

/** Endpoints splitting [lo, hi] into intervals of width about h */
function grid(lo: number, hi: number, h: number): number[] {
  const n = Math.max(1, Math.ceil((hi - lo) / h));
  return Array.from({ length: n + 1 }, (_, i) => (i === n ? hi : lo + ((hi - lo) * i) / n));
}

/** Target relative error of the outer integral */
const REL_TOL = 2e-15;
/** Target of the inner integral (down to rounding level so it does not add noise to the interpolation) */
const INNER_TOL = 1e-16;

// ---- Normal distribution helpers ----

const UPPER = { lowerTail: false } as const;
const LOG = { logP: true } as const;
const LOG_UPPER = { lowerTail: false, logP: true } as const;
const LN_SQRT_2PI = 0.918938533204672741780329736406;

const Phi = (x: number): number => pnorm(x);
const PhiC = (x: number): number => pnorm(x, UPPER);
const logPhi = (x: number): number => pnorm(x, LOG);
const logPhiC = (x: number): number => pnorm(x, LOG_UPPER);
const INV_SQRT_2PI = 0.398942280401432677939946059934;
/**
 * φ(x). Rounding of x^2 is amplified by the exponential (relative 5e-16 at x = 3), so split x = hi + lo (hi on a
 * 1/16 grid so hi^2 is exact) and use exp(-hi^2/2) exp(-lo (x + hi)/2)
 */
function phi(x: number): number {
  const hi = Math.round(x * 16) / 16;
  const lo = x - hi;
  return INV_SQRT_2PI * Math.exp(-0.5 * hi * hi) * Math.exp(-0.5 * lo * (x + hi));
}

// 8-point Gauss-Legendre rule (for Φ(b) - Φ(a) over narrow intervals)
const GL8_X = [0.18343464249564980494, 0.52553240991632898582, 0.79666647741362673959, 0.96028985649753623168];
const GL8_W = [0.36268378337836198297, 0.31370664587788728734, 0.22238103445337447054, 0.10122853629037625915];

/** ∫_{z-w}^{z} φ with the 8-point Gauss-Legendre rule (for narrow intervals). Uses w directly as the width */
function phiWindow(z: number, w: number): number {
  const c = z - 0.5 * w;
  const h = 0.5 * w;
  let s = 0;
  for (let i = 0; i < 4; i++) s += GL8_W[i]! * (phi(c - h * GL8_X[i]!) + phi(c + h * GL8_X[i]!));
  return s * h;
}

/** log ∫_{z-w}^{z} φ (also where φ underflows) */
function logPhiWindow(z: number, w: number): number {
  const c = z - 0.5 * w;
  const h = 0.5 * w;
  // φ(c + d) = φ(c) exp(-c d - d^2 / 2)
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const d = h * GL8_X[i]!;
    s += GL8_W[i]! * (Math.exp(c * d - (d * d) / 2) + Math.exp(-c * d - (d * d) / 2));
  }
  return -LN_SQRT_2PI - (c * c) / 2 + Math.log(s * h);
}

/** Whether the window [z - w, z] is narrow enough that forming Φ(z) - Φ(z - w) by subtraction loses digits */
const narrow = (z: number, w: number): boolean => w * Math.max(1, Math.abs(z), Math.abs(z - w)) < 0.5;

/**
 * Form z - w as a double-double (ah + al) and return Φ(z - w) and Φc(z - w) with a first-order correction.
 * The rounding of z - w (about ulp(z)) would otherwise give Φ(z) - Φ(z - w) a relative error of ulp(z)/w
 * when w is small, so it is corrected.
 */
function shifted(z: number, w: number): { ah: number; al: number } {
  const ah = z - w;
  const bb = ah - z;
  const al = z - (ah - bb) + (-w - bb);
  return { ah, al };
}
function phiAt(ah: number, al: number): number {
  return Phi(ah) + phi(ah) * al;
}
function phiCAt(ah: number, al: number): number {
  return PhiC(ah) - phi(ah) * al;
}

/** D = Φ(z) - Φ(z - w) (w >= 0) */
function rangeWindow(z: number, w: number): number {
  if (narrow(z, w)) return phiWindow(z, w);
  const { ah, al } = shifted(z, w);
  if (ah >= 0) return phiCAt(ah, al) - PhiC(z);
  if (z <= 0) return Phi(z) - phiAt(ah, al);
  return 1 - phiAt(ah, al) - PhiC(z);
}

/** D^e. When D is close to 1 (z - w < 0 < z), build it with log1p from 1 - D = Φ(z - w) + Φc(z) */
function rangeWindowPow(z: number, w: number, e: number): number {
  if (z > 0 && z - w < 0 && !narrow(z, w)) {
    const { ah, al } = shifted(z, w);
    return Math.exp(e * Math.log1p(-(phiAt(ah, al) + PhiC(z))));
  }
  const d = rangeWindow(z, w);
  return d > 0 ? d ** e : 0;
}

/** Φ(z)^e (for z > 0, avoids the rounding of 1 - Φc(z)) */
function phiPow(z: number, e: number): number {
  return z > 0 ? Math.exp(e * Math.log1p(-PhiC(z))) : Phi(z) ** e;
}

/** log Φ(z - w) (rounding of z - w corrected to first order; d/dx log Φ(x) = φ(x)/Φ(x)) */
function logPhiShift(z: number, w: number): number {
  const { ah, al } = shifted(z, w);
  const l = logPhi(ah);
  return l + al * Math.exp(-LN_SQRT_2PI - (ah * ah) / 2 - l);
}
function logPhiCShift(z: number, w: number): number {
  const { ah, al } = shifted(z, w);
  const l = logPhiC(ah);
  return l - al * Math.exp(-LN_SQRT_2PI - (ah * ah) / 2 - l);
}

function logRangeWindow(z: number, w: number): number {
  if (narrow(z, w)) return logPhiWindow(z, w);
  const a = z - w;
  if (a >= 0) {
    const la = logPhiCShift(z, w);
    return la + Math.log(-Math.expm1(logPhiC(z) - la));
  }
  if (z <= 0) {
    const lz = logPhi(z);
    return lz + Math.log(-Math.expm1(logPhiShift(z, w) - lz));
  }
  const { ah, al } = shifted(z, w);
  return Math.log1p(-phiAt(ah, al) - PhiC(z));
}

// ---- Locate the peak, then integrate ----

/** Grid spacing used to search for the peak of the integrand */
const PEAK_STEP = 2;
/** Regions where the integrand is below this fraction of the peak are dropped from the range */
const NEGLIGIBLE = 1e-18;

/**
 * Integrate a nonnegative function f on [lo, hi]. Sample f on a grid with spacing PEAK_STEP and apply the
 * adaptive rule only to the intervals exceeding NEGLIGIBLE times the maximum (plus the neighbours of the maximum).
 * The integrands are unimodal (log-concave), so dropping the outlying grid intervals changes the result by only
 * about 1e-22 relative.
 */
function peakIntegrate(f: (x: number) => number, lo: number, hi: number): number {
  const edges = grid(lo, hi, PEAK_STEP);
  const v = edges.map(f);
  let im = 0;
  for (let i = 1; i < v.length; i++) if (v[i]! > v[im]!) im = i;
  const vmax = v[im]!;
  if (!(vmax > 0)) return 0;
  let i0 = Math.max(im - 1, 0);
  let i1 = Math.min(im + 1, v.length - 1);
  while (i0 > 0 && v[i0]! > vmax * NEGLIGIBLE) i0--;
  while (i1 < v.length - 1 && v[i1]! > vmax * NEGLIGIBLE) i1++;
  // Tighten the ends by bisection (to 1/4 of the grid spacing). Shorter intervals converge with fewer points
  const cut = vmax * NEGLIGIBLE;
  let left = edges[i0]!;
  let right = edges[i1]!;
  if (v[i0]! <= cut) {
    let inner = edges[i0 + 1]!;
    for (let it = 0; it < 2; it++) {
      const mid = 0.5 * (left + inner);
      if (f(mid) <= cut) left = mid;
      else inner = mid;
    }
  }
  if (v[i1]! <= cut) {
    let inner = edges[i1 - 1]!;
    for (let it = 0; it < 2; it++) {
      const mid = 0.5 * (right + inner);
      if (f(mid) <= cut) right = mid;
      else inner = mid;
    }
  }
  return integrate(f, [left, right], INNER_TOL);
}

/**
 * log ∫ exp(lf) (for regions where exp(lf) underflows). lf is assumed unimodal (log-concave).
 * Find the maximum on a grid with spacing PEAK_STEP, then refine the peak M between its neighbours by golden-section
 * search (for large nmeans the peak is much sharper than the grid spacing). From the peak, step outward with doubling
 * steps to find where lf drops below M - 46 (1e-20 relative), and integrate exp(lf - M) over that range.
 */
function logPeakIntegrate(lf: (x: number) => number, lo: number, hi: number): number {
  const edges = grid(lo, hi, PEAK_STEP);
  const v = edges.map(lf);
  let im = 0;
  for (let i = 1; i < v.length; i++) if (v[i]! > v[im]!) im = i;
  if (!(v[im]! > -Infinity)) return -Infinity;
  // Golden-section search for the peak
  let a = edges[Math.max(im - 1, 0)]!;
  let b = edges[Math.min(im + 1, edges.length - 1)]!;
  const g = (Math.sqrt(5) - 1) / 2;
  let x1 = b - g * (b - a);
  let x2 = a + g * (b - a);
  let f1 = lf(x1);
  let f2 = lf(x2);
  for (let it = 0; it < 80 && b - a > 1e-12 * Math.max(1, Math.abs(a)); it++) {
    if (f1 < f2) {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = a + g * (b - a);
      f2 = lf(x2);
    } else {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = b - g * (b - a);
      f1 = lf(x1);
    }
  }
  let top = f1 > f2 ? x1 : x2;
  let M = Math.max(f1, f2);
  if (v[im]! > M) {
    top = edges[im]!;
    M = v[im]!;
  }
  // Outer ends: where lf drops below M - 46
  const end = (dir: number): number => {
    const limit = dir < 0 ? lo : hi;
    let d = Math.max(1e-6, 1e-3 * (edges[1]! - edges[0]!));
    let inner = top;
    for (;;) {
      const x = top + dir * d;
      if (dir < 0 ? x <= limit : x >= limit) return limit;
      if (lf(x) < M - 46) {
        // Bisect between inner and x
        let out = x;
        for (let it = 0; it < 6; it++) {
          const mid = 0.5 * (inner + out);
          if (lf(mid) < M - 46) out = mid;
          else inner = mid;
        }
        return out;
      }
      inner = x;
      d *= 2;
    }
  };
  const left = end(-1);
  const right = end(1);
  const pts = [...new Set([left, top, right])].sort((x, y) => x - y);
  // lf is a sum of terms of its own size, so its values carry an absolute error of a few ε |M|
  return M + Math.log(integrate((x) => Math.exp(lf(x) - M), pts, INNER_TOL, 4 * EPS * Math.max(1, Math.abs(M))));
}

// ---- Inner integral: the range distribution function W(w) and its complement ----
// The integrand vanishes as φ(z) outside z. W uses [-10, 10]; 1 - W uses [-10, w + 10], which contains the peak at z ≈ w/2

const Z_LO = -10;
const Z_HI = 10;

/** W(w) = P[range <= w] (k standard normals) */
function rangeCdf(w: number, k: number): number {
  if (w <= 0) return 0;
  return k * peakIntegrate((z) => phi(z) * rangeWindowPow(z, w, k - 1), Z_LO, Z_HI);
}

/** 1 - W(w) = k ∫ φ(z) {Φ(z)^(k-1) - D^(k-1)} dz */
function rangeCdfC(w: number, k: number): number {
  if (w <= 0) return 1;
  const f = (z: number): number => {
    const P = Phi(z);
    if (P === 0) return 0;
    const { ah, al } = shifted(z, w);
    const a = phiAt(ah, al);
    // 1 - (D/P)^(k-1). If a/P is small, compute it as 1 - (1 - a/P)^(k-1)
    const g =
      a < 0.5 * P
        ? -Math.expm1((k - 1) * Math.log1p(-a / P))
        : -Math.expm1((k - 1) * Math.log(rangeWindow(z, w) / P));
    return phi(z) * phiPow(z, k - 1) * g;
  };
  if (w > 60) return 0; // 1 - W < k^2 Φc(w/√2) < 1e-300 (underflow)
  const [lo, hi] = complementRange(w);
  return k * peakIntegrate(f, lo, hi);
}

/**
 * Range of the integrand of 1 - W(w). For large w the peak is at z ≈ w/2 and Gaussian with width 1/√2
 * (φ(z) Φ(z - w) ∝ exp(-(z - w/2)^2 - w^2/4)), so ±15 around it suffices
 */
function complementRange(w: number): [number, number] {
  return w > 40 ? [w / 2 - 15, w / 2 + 15] : [Z_LO, w + Z_HI];
}

/** log W(w) (for regions where W underflows) */
function logRangeCdf(w: number, k: number): number {
  if (w > 100) return -Math.exp(logRangeCdfC(w, k));
  const lf = (z: number): number => -LN_SQRT_2PI - (z * z) / 2 + (k - 1) * logRangeWindow(z, w);
  return Math.log(k) + logPeakIntegrate(lf, Z_LO, Z_HI);
}

/**
 * log(1 - W(w)). For w > 100 use 1 - W(w) = k (k-1) Φc(w/√2) (1 + O(e^(-w^2/12)))
 * (the range exceeds w essentially only when a single pair differs by more than w; the correction is below e^-833)
 */
function logRangeCdfC(w: number, k: number): number {
  if (w > 100) return Math.log(k * (k - 1)) + logPhiC(w / Math.SQRT2);
  const lf = (z: number): number => {
    const lP = logPhi(z);
    const lt = logPhiShift(z, w) - lP; // log(a / P)
    let lg: number;
    if (lt < -40) lg = Math.log(k - 1) + lt;
    else if (lt < -Math.LN2) lg = Math.log(-Math.expm1((k - 1) * Math.log1p(-Math.exp(lt))));
    else lg = Math.log(-Math.expm1((k - 1) * (logRangeWindow(z, w) - lP)));
    return -LN_SQRT_2PI - (z * z) / 2 + (k - 1) * lP + lg;
  };
  const [lo, hi] = complementRange(w);
  return Math.log(k) + logPeakIntegrate(lf, lo, hi);
}

/** log ∫ exp(lf) over a sequence of intervals (log version of the outer integral) */
function logIntegrate(lf: (x: number) => number, edges: readonly number[]): number {
  let M = -Infinity;
  for (const x of edges) M = Math.max(M, lf(x));
  for (let i = 0; i + 1 < edges.length; i++) M = Math.max(M, lf(0.5 * (edges[i]! + edges[i + 1]!)));
  if (M === -Infinity) return -Infinity;
  // When the rounding of lf (ε |M|) exceeds 1, exp(lf - M) is noise, and the log of the integral (the log of the peak
  // width, a few dozen at most) is below the rounding of M anyway (huge df with large q: ptukey(2.3e11, 2, 4.8e27,
  // { lowerTail: false, logP: true }) is about -1.3e22)
  if (EPS * Math.abs(M) > 1) return M;
  for (let it = 0; it < 4; it++) {
    let seen = M;
    const v = integrate(
      (x) => {
        const l = lf(x);
        if (l > seen) seen = l;
        return Math.exp(l - M);
      },
      edges,
      REL_TOL,
      // The absolute error of lf (the inner log integral included) is a few ε |M|
      8 * EPS * Math.max(1, Math.abs(M)),
    );
    if (Number.isFinite(v) && seen - M < 300) return M + Math.log(v);
    M = seen;
  }
  return NaN;
}

// ---- Interpolation of the inner integrals (built and cached per nmeans) ----
//
// The outer integral needs W(w) and 1 - W(w) at hundreds of w, and quantiles and Tukey's HSD call it many times
// with the same nmeans. So log W and log(1 - W) as functions of x = log w are represented and cached as piecewise
// Chebyshev interpolants (33 points). Intervals are bisected until the trailing coefficients are at most
// 1e-15 × max(1, |value|) (an absolute error of 1e-15 in the log is a relative error of 1e-15 in W). w outside
// the range is integrated directly.

const CHEB_N = 32;
const CHEB_TOL = 1e-15;
/** Interpolated range (log w). W exceeds 1 - 1e-17 at w = 20 (k <= 1000). 1 - W is about 1e-170 at w = 40 */
const X_LO = Math.log(0.01);
const X_HI_W = Math.log(20);
const X_HI_WC = Math.log(40);

interface ChebSegment {
  a: number;
  b: number;
  coef: Float64Array;
}

/** cos(π i / CHEB_N) (i = 0..2 CHEB_N). Large arguments to cos(π m j / N) add rounding noise to the coefficients, so tabulate */
const CHEB_COS = Float64Array.from({ length: 2 * CHEB_N + 1 }, (_, i) => Math.cos((Math.PI * i) / CHEB_N));

/** Coefficients from the values at the N + 1 Chebyshev points of [a, b] */
function chebCoefficients(v: Float64Array, N: number): Float64Array {
  const c = new Float64Array(N + 1);
  for (let m = 0; m <= N; m++) {
    let s = 0.5 * (v[0]! + (m % 2 === 0 ? v[N]! : -v[N]!));
    for (let j = 1; j < N; j++) s += v[j]! * CHEB_COS[(m * j) % (2 * N)]!;
    s *= 2 / N;
    if (m === 0 || m === N) s *= 0.5;
    c[m] = s;
  }
  return c;
}

/** Piecewise Chebyshev interpolant of f on [lo, hi] */
function buildCurve(f: (x: number) => number, lo: number, hi: number): ChebSegment[] {
  const out: ChebSegment[] = [];
  const todo: [number, number, number][] = [[lo, hi, 0]];
  while (todo.length > 0) {
    const [a, b, depth] = todo.pop()!;
    const c = 0.5 * (a + b);
    const h = 0.5 * (b - a);
    const v = new Float64Array(CHEB_N + 1);
    // The tolerance is relative to the smallest max(1, |value|) in the interval (where log W is near 0 an
    // absolute error of 1e-15 is needed; intervals with a wide range of values get split by this)
    let vref = Infinity;
    for (let j = 0; j <= CHEB_N; j++) {
      v[j] = f(c + h * CHEB_COS[j]!);
      vref = Math.min(vref, Math.max(1, Math.abs(v[j]!)));
    }
    const coef = chebCoefficients(v, CHEB_N);
    let tail = 0;
    for (let m = CHEB_N - 3; m <= CHEB_N; m++) tail = Math.max(tail, Math.abs(coef[m]!));
    if (tail <= CHEB_TOL * vref || depth >= 14 || !v.every(Number.isFinite)) out.push({ a, b, coef });
    else todo.push([c, b, depth + 1], [a, c, depth + 1]);
  }
  return out.sort((s1, s2) => s1.a - s2.a);
}

function evalCurve(segs: readonly ChebSegment[], x: number): number {
  // Binary search for the interval
  let lo = 0;
  let hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segs[mid]!.a <= x) lo = mid;
    else hi = mid - 1;
  }
  const { a, b, coef } = segs[lo]!;
  const t = (2 * x - a - b) / (b - a);
  // Clenshaw recurrence
  let b1 = 0;
  let b2 = 0;
  for (let m = CHEB_N; m >= 1; m--) {
    const b0 = 2 * t * b1 - b2 + coef[m]!;
    b2 = b1;
    b1 = b0;
  }
  return t * b1 - b2 + coef[0]!;
}

interface RangeCurves {
  logW: ChebSegment[];
  /** (1 - W(w)) exp(w^2/4) */
  scaledWc: ChebSegment[];
  /** h(x) = log W(e^x) - (k-1) x for w < 0.01 (tends to a constant as w → 0) */
  smallW: ChebSegment[];
}

const curveCache = new Map<number, RangeCurves>();
/** One nmeans takes a few dozen intervals × 33 coefficients (a few KB), so keep plenty */
const CURVE_CACHE_SIZE = 64;
/** Lower end (log w) of the small-w interpolant. Below it h(x) is taken as constant (the correction is about w^2) */
const X_TINY = Math.log(1e-10);

function rangeCurves(k: number): RangeCurves {
  let c = curveCache.get(k);
  if (c !== undefined) return c;
  const logWDirect = (w: number): number => {
    const W = rangeCdf(w, k);
    return W > 1e-290 ? Math.log(W) : logRangeCdf(w, k);
  };
  // 1 - W decays like exp(-w^2/4) for large w. On the log scale the rounding of the value (around -400) becomes
  // a relative error of 1e-14, so interpolate R(w) = (1 - W(w)) exp(w^2/4) linearly (a slowly varying function)
  const scaledWc = (x: number): number => {
    const w = Math.exp(x);
    return rangeCdfC(w, k) * expQuarterSq(w);
  };
  c = {
    logW: buildCurve((x) => logWDirect(Math.exp(x)), X_LO, X_HI_W),
    scaledWc: buildCurve(scaledWc, X_LO, X_HI_WC),
    smallW: buildCurve((x) => logWDirect(Math.exp(x)) - (k - 1) * x, X_TINY, X_LO),
  };
  if (curveCache.size >= CURVE_CACHE_SIZE) curveCache.delete(curveCache.keys().next().value!);
  curveCache.set(k, c);
  return c;
}

/** exp(w^2/4). Split w^2 exactly into hi + lo and use exp(hi/4) (1 + lo/4) (hi/4 is exact) */
function expQuarterSq(w: number): number {
  const p = w * w;
  const t = 134217729 * w;
  const wh = t - (t - w);
  const wl = w - wh;
  const e = wh * wh - p + 2 * wh * wl + wl * wl;
  return Math.exp(p / 4) * (1 + e / 4);
}

/** log W(w) from the interpolant (W ∝ w^(k-1) for very small w) */
function logRangeCdfFast(w: number, k: number): number {
  const x = Math.log(w);
  if (x >= X_HI_W) return 0;
  const c = rangeCurves(k);
  if (x >= X_LO) return evalCurve(c.logW, x);
  return evalCurve(c.smallW, Math.max(x, X_TINY)) + (k - 1) * x;
}

/** W(w) (from the interpolant) */
function rangeCdfFast(w: number, k: number): number {
  return Math.log(w) >= X_HI_W ? 1 : Math.exp(logRangeCdfFast(w, k));
}

/** 1 - W(w). For w < 0.01 W is small, so 1 - W is adequate */
function rangeCdfCFast(w: number, k: number): number {
  const x = Math.log(w);
  if (x >= X_LO && x <= X_HI_WC) return evalCurve(rangeCurves(k).scaledWc, x) / expQuarterSq(w);
  if (x < X_LO) return 1 - rangeCdfFast(w, k);
  return rangeCdfC(w, k);
}

// ---- Maximum of nranges ranges ----

/**
 * G(w) = W(w)^r (1 - G(w) if upper). The lower tail uses W directly (relative accuracy is kept even near 1).
 * The upper tail uses 1 - W, building 1 - W^r from W only when 1 - W exceeds 1/2.
 */
function rangeMaxCdf(w: number, k: number, r: number, upper: boolean): number {
  if (!upper) {
    // Rounding can push it slightly above 1, so clamp
    const W = Math.min(rangeCdfFast(w, k), 1);
    return r === 1 ? W : W ** r;
  }
  const Wc = Math.min(rangeCdfCFast(w, k), 1);
  if (Wc <= 0.5) return r === 1 ? Wc : -Math.expm1(r * Math.log1p(-Wc));
  return 1 - Math.min(rangeCdfFast(w, k), 1) ** r;
}

/**
 * log G(w) (log(1 - G(w)) if upper). From the interpolants where they apply, and integrating directly only where 1 - W
 * underflows: the outer log integral evaluates this at a few hundred w, and a direct inner integral at each made
 * ptukey(1e-20, 200, 5) and ptukey(2.5e118, 4, 3, { nranges: 2 }) take minutes.
 */
function logRangeMaxCdf(w: number, k: number, r: number, upper: boolean): number {
  if (!upper) return r * (Math.log(w) < X_HI_W ? logRangeCdfFast(w, k) : Math.log1p(-Math.min(rangeCdfCFast(w, k), 1)));
  const Wc = Math.min(rangeCdfCFast(w, k), 1);
  const lWc = Wc > 1e-290 ? Math.log(Wc) : logRangeCdfC(w, k);
  if (r === 1) return lWc;
  // 1 - (1 - Wc)^r = r Wc (1 - (r - 1) Wc/2 + ...): log r + log Wc where Wc is below e^-700 (the form below was
  // -Infinity once Wc underflowed, from q = 54.5 at k = 3, r = 2, and the outer integral over that edge was bisected to
  // its limit at seconds per call: qtukey(1.5e-287, 3, 4.7e10, { nranges: 2, lowerTail: false }))
  if (lWc < -700) return Math.log(r) + lWc;
  // 1 - (1 - Wc)^r
  return Math.log(-Math.expm1(r * Math.log1p(-Math.exp(lWc))));
}

// ---- Outer integral ----

/**
 * P[Q <= q] (P[Q > q] if upper). For df = ∞ this is just G(q).
 * Integrate over u, the log of t = df s^2 / 2 ~ Gamma(a = df/2): ∫ a dpois(a; e^u) G(q sqrt(e^u / a)) du
 */
function tukeyIntegral(q: number, k: number, df: number, r: number, upper: boolean): number {
  if (df === Infinity || dfIsInfinite(q, k, df, r)) return rangeMaxCdf(q, k, r, upper);
  const a = df / 2;
  const logDens = logGammaDensityAt(a);
  // Integrate over v = u - log a. For large df the peak width 1/√a is small relative to |u|, and rounding of the
  // u nodes (ulp(log a)) becomes noise in the integrand (1e-14 relative at df = 1e5). v is near 0, so rounding is small
  const f = (v: number): number => {
    const d = Math.exp(logDens(v));
    return d === 0 ? 0 : d * rangeMaxCdf(q * Math.exp(0.5 * v), k, r, upper);
  };
  return integrate(f, outerEdges(q, k, df, r, upper), REL_TOL);
}

/**
 * log density of Gamma(a) at v = log(t/a), i.e. log(t f(t)) = log(a dpois(a; t)); then s = sqrt(t/a) = e^(v/2).
 * Loader's form a exp(-stirlerr(a) - bd0(a, t)) / sqrt(2π a), with bd0(a, t) = a (e^v - 1 - v) computed directly
 * from v (e^v - 1 - v by series for |v| < 1/2). Rounding t = a e^v before forming the density would, for large df
 * where the slope of the density in t (a - t) is large, turn the rounding into noise in the integrand and disturb
 * convergence (1e-14 relative at df = 1e5; for df above about 1e30 the whole peak lies within one ulp of log a).
 * The absolute error of the exponent is about ε × bd0.
 */
function logGammaDensityAt(a: number): (v: number) => number {
  const c = 0.5 * Math.log(a / (2 * Math.PI)) - stirlerr(a);
  return (v: number) => {
    let phi: number;
    if (Math.abs(v) < 0.5) {
      let term = (v * v) / 2;
      phi = term;
      for (let n = 3; n < 60; n++) {
        term *= v / n;
        phi += term;
        if (Math.abs(term) < 1e-17 * phi) break;
      }
    } else {
      phi = Math.expm1(v) - v;
    }
    return c - a * phi;
  };
}

/**
 * Whether df is large enough that P equals its df = ∞ value to double precision. With log s ~ N(0, 1/(2a)) the
 * relative change of E[G(q s)] from G(q) is about L^2 / (8a), L = d log G / d log q, which is at most about
 * (k-1) r in the lower tail and q^2 in the upper
 */
function dfIsInfinite(q: number, k: number, df: number, r: number): boolean {
  const L = Math.max((k - 1) * r, q * q, 1);
  return L * L < 1e-17 * df;
}

function logTukeyIntegral(q: number, k: number, df: number, r: number, upper: boolean): number {
  if (df === Infinity || dfIsInfinite(q, k, df, r)) return logRangeMaxCdf(q, k, r, upper);
  const logDens = logGammaDensityAt(df / 2);
  const lq = Math.log(q);
  // Stay on the log scale so that the deep upper tail (extremely large q), where t = e^u underflows, can be computed
  const lf = (v: number): number => logDens(v) + logRangeMaxCdf(Math.exp(lq + 0.5 * v), k, r, upper);
  return logIntegrate(lf, outerEdges(q, k, df, r, upper, true));
}

/**
 * Endpoints of the intervals for the outer integral, in v = log(t / a).
 * The Gamma(a) density concentrates around v = 0 with width 1/√a; the left tail decays like t^a and the right
 * like e^-t. Multiplying by G(q s) moves the peak: in the lower tail G ≈ (q s)^((k-1) r) as q s → 0, which moves it
 * toward larger t (equivalent to the exponent growing from a to a + (k-1) r / 2); in the upper tail
 * 1 - G ≈ exp(-(q s)^2 / 4), equivalent to the rate growing to 1 + q^2 / (4a), so the peak moves to
 * t* = a / (1 + q^2 / (4a)). Spacing is 1/√a near the peak and doubles in the tails (fine detail is left to
 * the adaptive subdivision).
 */
function outerEdges(q: number, k: number, df: number, r: number, upper: boolean, deep = false): number[] {
  const a = df / 2;
  // Peak of Gamma(a) before multiplying by G, and the peak it moves to when G matters in the tail (shape, center)
  let shape = a;
  let center: number;
  if (upper) {
    const lq2 = 2 * Math.log(q) - Math.log(4 * a);
    center = -(lq2 > 30 ? lq2 : Math.log1p(Math.exp(lq2)));
  } else {
    shape = a + ((k - 1) * r) / 2;
    center = Math.log1p(((k - 1) * r) / (2 * a));
  }
  // Where the density is about 1e-18 of the peak (decaying like t^shape on the left and e^-t on the right)
  const range = (c: number, sh: number): [number, number] => [
    c - 9 / Math.sqrt(sh) - 41 / sh,
    c + 9 / Math.sqrt(sh) + Math.log1p(41 / sh),
  ];
  const [lo1, hi1] = range(0, a);
  const [lo2, hi2] = range(center, shape);
  // The linear version is limited to where t = e^u does not underflow (beyond that the result is below 1e-290 and is
  // recomputed with the log version)
  const lo = deep ? Math.min(lo1, lo2) : Math.max(Math.min(lo1, lo2), -740 - Math.log(a));
  const hi = Math.max(hi1, hi2);
  // Split into a central interval containing both peaks (±4 sd) and left and right tail intervals
  const sd1 = 1 / Math.sqrt(a);
  const sd2 = 1 / Math.sqrt(shape);
  const edges = [lo, Math.min(-4 * sd1, center - 4 * sd2), Math.max(4 * sd1, center + 4 * sd2), hi];
  return [...new Set(edges.map((x) => Math.min(Math.max(x, lo), hi)))].sort((x, y) => x - y);
}

// ---- Public functions ----

/** Parameter check. false if invalid (R gives NaN for nmeans < 2, df < 2, nranges < 1) */
function validParams(k: number, df: number, r: number): boolean {
  return k >= 2 && df >= 2 && r >= 1 && Number.isFinite(k) && Number.isFinite(r) && !Number.isNaN(df);
}

/** Value of the smaller tail (P[Q > q] if upper). log is used only when the linear value underflows */
interface SmallTail {
  upper: boolean;
  value: number;
  log: number;
}

/**
 * P[Q <= q] (lowerTail) / P[Q > q]. Integrate the smaller tail directly; the larger one is 1 - (smaller).
 * Calls with the same (q, nmeans, df, nranges) differing only in tail or log use the same integral, so the last result is cached.
 */
function ptukeyRaw(q: number, k: number, df: number, r: number, lowerTail: boolean, logP: boolean): number {
  if (q < TINY_Q) {
    // The lower tail is c q^((k-1) r) (1 + O(q²)) there (W(w) is of the order of w^(k-1) near 0): scaled in logs from
    // q = 2^-1000. The integrals at a subnormal q took 20 to 50 ms a call (the subdivision chasing the rounding of the
    // subnormal arguments), so that qtukey(-726.9, 2, 486.9, { logP: true }), whose answer is 3.5e-316, took 1.2 s
    const lv = ptukeyRaw(TINY_Q, k, df, r, true, true) + (k - 1) * r * Math.log(q * 2 ** 1000);
    if (lowerTail) return logP ? lv : Math.exp(lv);
    return logP ? -Math.exp(lv) : -Math.expm1(lv);
  }
  let t: SmallTail;
  if (memo !== undefined && memo.q === q && memo.k === k && memo.df === df && memo.r === r) t = memo.tail;
  else {
    t = smallTail(q, k, df, r, !lowerTail);
    memo = { q, k, df, r, tail: t };
  }
  if (t.upper === !lowerTail) return logP ? t.log : t.value;
  return logP ? Math.log1p(-t.value) : 1 - t.value;
}

let memo: { q: number; k: number; df: number; r: number; tail: SmallTail } | undefined;

/** Below this (2^-1000) the lower tail of ptukeyRaw is scaled from its value here */
const TINY_Q = 2 ** -1000;

/**
 * The smaller tail. Which tail is smaller is guessed from the df = ∞ value (one inner integral); if the guess is
 * wrong and the value exceeds 1/2, the other side is computed. preferUpper is the side to compute when there is no
 * guess (df = ∞).
 */
function smallTail(q: number, k: number, df: number, r: number, preferUpper: boolean): SmallTail {
  let upper = preferUpper;
  if (df !== Infinity && rangeMaxCdf(q, k, r, upper) > 0.5) upper = !upper;
  let v = tukeyIntegral(q, k, df, r, upper);
  if (v > 0.5) {
    const other = tukeyIntegral(q, k, df, r, !upper);
    if (other < v) {
      v = other;
      upper = !upper;
    }
  }
  if (v < 1e-290) {
    const lv = logTukeyIntegral(q, k, df, r, upper);
    return { upper, value: Math.exp(lv), log: lv };
  }
  return { upper, value: v, log: Math.log(v) };
}

export function ptukey1(q: number, k: number, df: number, r: number, lowerTail: boolean, logP: boolean): number {
  if ([q, k, df, r].some(Number.isNaN)) return NaN;
  if (!validParams(k, df, r)) return NaN;
  if (q <= 0) return dt0(lowerTail, logP);
  if (q === Infinity) return dt1(lowerTail, logP);
  return ptukeyRaw(q, k, df, r, lowerTail, logP);
}

/**
 * Quantile: solve log P(e^y) = target for the smaller tail in y = log q with Brent's method.
 * The starting value solves the same equation for the df = ∞ distribution (computable from the inner integral alone).
 */
export function qtukey1(p: number, k: number, df: number, r: number, lowerTail: boolean, logP: boolean): number {
  if ([p, k, df, r].some(Number.isNaN)) return NaN;
  if (!validParams(k, df, r)) return NaN;
  const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
  if (b !== undefined) return b;
  const { lower, logTarget, linearTarget } = smallerTail(p, lowerTail, logP);
  const residual = (d: number) => (y: number): number => {
    const x = Math.exp(y);
    if (linearTarget !== undefined && linearTarget > 1e-290) {
      const v = d === Infinity ? tukeyIntegral(x, k, d, r, !lower) : ptukeyRaw(x, k, d, r, lower, false);
      if (v > 0) return Math.log(v / linearTarget);
    }
    const lv = d === Infinity ? logTail(x, k, r, lower) : ptukeyRaw(x, k, d, r, lower, true);
    return lv - logTarget;
  };
  const y0 = solveMonotone(residual(Infinity), Math.log(3), lower);
  if (df === Infinity) return Math.exp(y0);
  return Math.exp(solveMonotone(residual(df), y0, lower));
}

/** log P for df = ∞ (lower tail if lower) */
function logTail(x: number, k: number, r: number, lower: boolean): number {
  const v = rangeMaxCdf(x, k, r, !lower);
  return v > 1e-290 ? Math.log(v) : logRangeMaxCdf(x, k, r, !lower);
}

/**
 * Zero of a monotone function g (increasing if increasing, else decreasing), bracketed from y0 and refined by Brent's method.
 * The bracket is found by stepping from y0 with doubling steps until the sign changes.
 */
function solveMonotone(g: (y: number) => number, y0: number, increasing: boolean): number {
  let a = y0;
  let fa = g(a);
  if (fa === 0) return a;
  // Direction of the zero: to the left if g > 0 for an increasing function
  const dir = (fa > 0) === increasing ? -1 : 1;
  let step = 0.05;
  let b = a + dir * step;
  let fb = g(b);
  // A point past the range of doubles (e^y underflows to 0 or overflows), where g is not finite. Once one is found,
  // steps go halfway to it instead of past it; a zero beyond the doubles ends at the last finite point
  let bad = NaN;
  for (let i = 0; i < 200 && Math.sign(fb) === Math.sign(fa) && fb !== 0; i++) {
    if (Math.abs(bad - b) < 1e-3) return b;
    a = b;
    fa = fb;
    step *= 2;
    b = (a + dir * step - bad) * dir >= 0 ? 0.5 * (a + bad) : a + dir * step;
    fb = g(b);
    while (!Number.isFinite(fb)) {
      bad = b;
      if (Math.abs(bad - a) < 1e-3) return a;
      b = 0.5 * (a + bad);
      fb = g(b);
    }
  }
  if (fb === 0) return b;
  if (!Number.isFinite(fb) || Math.sign(fb) === Math.sign(fa)) return Number.isFinite(fb) ? b : a;
  return brent(g, a, b, fa, fb);
}

/**
 * Brent's method (combining bisection, the secant method and inverse quadratic interpolation; R. P. Brent (1973)
 * "Algorithms for Minimization without Derivatives", ch. 4). f(a) and f(b) must differ in sign on [a, b]
 */
function brent(f: (y: number) => number, a: number, b: number, fa: number, fb: number): number {
  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;
  for (let iter = 0; iter < 100; iter++) {
    if (Math.sign(fb) === Math.sign(fc)) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }
    const tol = 2 * EPS * Math.abs(b) + 1e-300;
    const m = 0.5 * (c - b);
    if (Math.abs(m) <= tol || fb === 0) return b;
    if (Math.abs(e) >= tol && Math.abs(fa) > Math.abs(fb)) {
      // Secant step or inverse quadratic interpolation
      const s = fb / fa;
      let pp: number;
      let qq: number;
      if (a === c) {
        pp = 2 * m * s;
        qq = 1 - s;
      } else {
        const t = fa / fc;
        const u = fb / fc;
        pp = s * (2 * m * t * (t - u) - (b - a) * (u - 1));
        qq = (t - 1) * (u - 1) * (s - 1);
      }
      if (pp > 0) qq = -qq;
      else pp = -pp;
      if (2 * pp < Math.min(3 * m * qq - Math.abs(tol * qq), Math.abs(e * qq))) {
        e = d;
        d = pp / qq;
      } else {
        d = m;
        e = m;
      }
    } else {
      d = m;
      e = m;
    }
    a = b;
    fa = fb;
    b += Math.abs(d) > tol ? d : m > 0 ? tol : -tol;
    fb = f(b);
  }
  return b;
}

/**
 * Distribution function of the studentized range distribution (used by Tukey's HSD). Equivalent to R's `ptukey(q, nmeans, df, nranges = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * Results aim at a relative accuracy of about 1e-15. R's `ptukey` is accurate to only about 8 digits, so values can differ from R's beyond that.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param nmeans - Number of means (sample size of each range).
 * @param df - Degrees of freedom of the standard deviation estimate.
 * @param options - `nranges`, `lowerTail` and `logP` (see {@link TukeyOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * ptukey(3.5, 3, 12);                       // 0.9300045147248135
 * ptukey(3.5, 3, 12, { lowerTail: false }); // 0.06999548527518648
 * ```
 *
 * @category Distributions
 */
export function ptukey<T extends Vectorizable>(
  q: T,
  nmeans: number,
  df: number,
  options: TukeyOptions = {},
): VectorResult<T> {
  const { nranges = 1, lowerTail = true, logP = false } = options;
  return vectorize(q, (v) => ptukey1(v, nmeans, df, nranges, lowerTail, logP));
}

/**
 * Quantile function of the studentized range distribution (used by Tukey's HSD). Equivalent to R's `qtukey(p, nmeans, df, nranges = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * Results aim at a relative accuracy of about 1e-15. R's `ptukey` is accurate to only about 8 digits, so values can differ from R's beyond that.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param nmeans - Number of means (sample size of each range).
 * @param df - Degrees of freedom of the standard deviation estimate.
 * @param options - `nranges`, `lowerTail` and `logP` (see {@link TukeyOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qtukey(0.95, 3, 12); // 3.7729289657270084
 * qtukey(0.95, 4, 20); // 3.958293560945357
 * ```
 *
 * @category Distributions
 */
export function qtukey<T extends Vectorizable>(
  p: T,
  nmeans: number,
  df: number,
  options: TukeyOptions = {},
): VectorResult<T> {
  const { nranges = 1, lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qtukey1(v, nmeans, df, nranges, lowerTail, logP));
}
