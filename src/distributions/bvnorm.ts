// Rectangle probabilities of the standard bivariate normal distribution (what mvtnorm's pmvnorm gives in two
// dimensions).
//
// Written for rStats.js from oracle/polycor-behaviour.md and the method published by A. Genz, "Numerical computation
// of rectangular bivariate and trivariate normal and t probabilities", Statistics and Computing 14 (2004) 251-260
// (after Drezner and Wesolowsky); no code was ported. The upper orthant probability P(X > h, Y > k) is Sheppard's
// integral over θ in [0, asin ρ], by Gauss-Legendre quadrature with 6, 12 or 20 nodes, for |ρ| < 0.925; closer to
// |ρ| = 1 it is Φ(−max(h, k)) minus an integral in t = sqrt(1 − ρ²)-scale whose singular part is taken out by a
// Taylor expansion and integrated in closed form. A rectangle is the alternating sum of four orthants, after
// reflecting (X, Y) → (−X, −Y) when that puts the rectangle in the upper tail (smaller orthants, less cancellation);
// it is clipped at 0.

import { pnorm } from "./normal.js";

/** Nodes in (0, 1) and weights of the n-point Gauss-Legendre rule on [−1, 1] (the symmetric half), by Newton's method */
function gaussLegendre(n: number): { x: number[]; w: number[] } {
  const x: number[] = [];
  const w: number[] = [];
  for (let i = 1; i <= n / 2; i++) {
    let z = Math.cos((Math.PI * (i - 0.25)) / (n + 0.5));
    let dp = 0;
    for (let it = 0; it < 100; it++) {
      // Legendre P_n(z) and its derivative by the three-term recurrence
      let p0 = 1;
      let p1 = z;
      for (let k = 2; k <= n; k++) [p0, p1] = [p1, ((2 * k - 1) * z * p1 - (k - 1) * p0) / k];
      dp = (n * (z * p1 - p0)) / (z * z - 1);
      const dz = p1 / dp;
      z -= dz;
      if (Math.abs(dz) <= 1e-17) break;
    }
    x.push(z);
    w.push(2 / ((1 - z * z) * dp * dp));
  }
  return { x, w };
}

const RULES = [gaussLegendre(6), gaussLegendre(12), gaussLegendre(20)];
const TWO_PI = 2 * Math.PI;

const upperPhi = (x: number): number => pnorm(x, { lowerTail: false });

/** P(X > h, Y > k) for the standard bivariate normal with correlation r (h, k finite) */
function upperOrthant(h: number, k: number, r: number): number {
  if (r === 1) return upperPhi(Math.max(h, k));
  if (r === -1) return Math.max(0, upperPhi(h) - pnorm(-k));
  const { x, w } = RULES[Math.abs(r) < 0.3 ? 0 : Math.abs(r) < 0.75 ? 1 : 2]!;
  const hk = h * k;
  if (Math.abs(r) < 0.925) {
    // Sheppard: Φ(−h)Φ(−k) + (1/2π) ∫_0^{asin r} exp(−(h² − 2hk sin θ + k²)/(2 cos² θ)) dθ
    const hs = (h * h + k * k) / 2;
    const asr = Math.asin(r);
    let s = 0;
    for (let i = 0; i < x.length; i++) {
      for (const node of [1 - x[i]!, 1 + x[i]!]) {
        const sn = Math.sin((asr * node) / 2);
        s += w[i]! * Math.exp((sn * hk - hs) / (1 - sn * sn));
      }
    }
    return (s * asr) / (2 * TWO_PI) + upperPhi(h) * upperPhi(k);
  }
  // |r| near 1: for r < 0 use P(X > h, Y > k; r) = Φ(−h) − P(X > h, −Y > −k; −r)
  const kk = r < 0 ? -k : k;
  const hkk = r < 0 ? -hk : hk;
  const as = (1 - r) * (1 + r);
  const a = Math.sqrt(as);
  const bs = (h - kk) ** 2;
  const c = (4 - hkk) / 8;
  const d = (12 - hkk) / 16;
  // P(X > h, Y > k; |r|) − Φ(−max(h, k)) = −(1/2π) (closed-form part + quadrature of the remainder) over t in (0, a)
  let s = a * Math.exp(-(bs / as + hkk) / 2) * (1 - (c * (bs - as) * (1 - (d * bs) / 5)) / 3 + (c * d * as * as) / 5);
  if (hkk > -160) {
    const b = Math.sqrt(bs);
    s -= Math.exp(-hkk / 2) * Math.sqrt(TWO_PI) * pnorm(-b / a) * b * (1 - (c * bs * (1 - (d * bs) / 5)) / 3);
  }
  const half = a / 2;
  for (let i = 0; i < x.length; i++) {
    for (const node of [1 - x[i]!, 1 + x[i]!]) {
      const xs = (half * node) ** 2;
      const rs = Math.sqrt(1 - xs);
      s +=
        half *
        w[i]! *
        (Math.exp(-bs / (2 * xs) - hkk / (1 + rs)) / rs - Math.exp(-(bs / xs + hkk) / 2) * (1 + c * xs * (1 + d * xs)));
    }
  }
  const tail = -s / TWO_PI;
  if (r > 0) return tail + upperPhi(Math.max(h, kk));
  return -tail + (kk > h ? pnorm(kk) - pnorm(h) : 0);
}

/** P(X > h, Y > k) with infinite bounds allowed */
function orthant(h: number, k: number, r: number): number {
  if (h === Infinity || k === Infinity) return 0;
  if (h === -Infinity) return k === -Infinity ? 1 : upperPhi(k);
  if (k === -Infinity) return upperPhi(h);
  return upperOrthant(h, k, r);
}

/**
 * Probability that a standard bivariate normal pair (X, Y) with correlation `rho` lies in the rectangle
 * `lower ≤ (X, Y) ≤ upper`. Equivalent to `mvtnorm::pmvnorm()` in R. The same as
 * `pmvnorm(lower, upper, corr = matrix(c(1, rho, rho, 1), 2))`.
 * Bounds may be infinite. Accurate to about 1e-15 absolute.
 *
 * @param lower - Lower bounds `[a1, a2]`.
 * @param upper - Upper bounds `[b1, b2]`.
 * @param rho - Correlation, in [−1, 1].
 *
 * @example
 * ```ts
 * pbvnorm([-Infinity, -Infinity], [0, 0], 0.5); // 0.3333333333333333
 * ```
 *
 * @category Distributions
 */
export function pbvnorm(lower: readonly [number, number] | readonly number[], upper: readonly [number, number] | readonly number[], rho: number): number {
  if (lower.length !== 2 || upper.length !== 2) throw new TypeError("'lower' and 'upper' must have length 2");
  if (!(rho >= -1 && rho <= 1)) throw new RangeError("'rho' must be in [-1, 1]");
  let [a1, a2] = lower as [number, number];
  let [b1, b2] = upper as [number, number];
  if ([a1, a2, b1, b2].some(Number.isNaN)) return NaN;
  if (!(a1 < b1 && a2 < b2)) return 0;
  // reflect a rectangle in the lower half into the upper half
  if (a1 + b1 + a2 + b2 < 0) [a1, a2, b1, b2] = [-b1, -b2, -a1, -a2];
  const p = orthant(a1, a2, rho) - orthant(a1, b2, rho) - orthant(b1, a2, rho) + orthant(b1, b2, rho);
  return Math.max(0, p);
}
