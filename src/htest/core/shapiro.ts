// Shapiro-Wilk W statistic and its p-value, for shapiro.test.
//
// Written for rStats.js from the published approximations (no ported code): Royston, "Approximating the
// Shapiro-Wilk W-test for non-normality", Statistics and Computing 2, 1992, and Royston, "Remark AS R94: A remark on
// Algorithm AS 181: The W-test for normality", Applied Statistics 44, 1995.
//
// Coefficients: m_i = qnorm((i - 3/8) / (n + 1/4)) and, with u = 1/sqrt(n), polynomial corrections for the two
// largest coefficients; the others are m_i / sqrt(phi) so that sum a_i^2 = 1.
// p-value: n = 3 exactly; 4 <= n <= 11: -log(gamma - log(1 - W)) is normal; n >= 12: log(1 - W) is normal, with
// means and standard deviations given as polynomials in n or log(n).

import { pnorm, qnorm } from "../../distributions/normal.js";

/** Polynomial c[0] + c[1] x + c[2] x^2 + ... */
function poly(c: readonly number[], x: number): number {
  let s = 0;
  for (let i = c.length - 1; i >= 0; i--) s = s * x + c[i]!;
  return s;
}

const C1 = [0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056];
const C2 = [0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633];
const C3 = [0.544, -0.39978, 0.025054, -6.714e-4];
const C4 = [1.3822, -0.77857, 0.062767, -0.0020322];
const C5 = [-1.5861, -0.31082, -0.083751, 0.0038915];
const C6 = [-0.4803, -0.082676, 0.0030302];
const G = [-2.273, 0.459];

/**
 * The Shapiro-Wilk coefficients a_1..a_n for a sample of size n (3 <= n <= 5000), antisymmetric
 * (a_i = -a_(n+1-i)) with sum a_i^2 = 1.
 */
export function swilkCoefficients(n: number): Float64Array {
  if (!(n >= 3) || n !== Math.floor(n)) throw new RangeError("n must be an integer of at least 3");
  const a = new Float64Array(n);
  if (n === 3) {
    a[0] = -Math.SQRT1_2;
    a[2] = Math.SQRT1_2;
    return a;
  }
  const half = Math.floor(n / 2);
  const m = new Float64Array(half); // m for the upper half, m[0] the largest
  let summ2 = 0;
  for (let i = 0; i < half; i++) {
    // upper half: i-th largest expected normal order statistic
    m[i] = -qnorm((i + 1 - 0.375) / (n + 0.25));
    summ2 += m[i]! * m[i]!;
  }
  summ2 *= 2;
  const ssumm2 = Math.sqrt(summ2);
  const rsn = 1 / Math.sqrt(n);
  // the two largest coefficients a_n and a_(n-1), corrected by polynomials in u = 1/sqrt(n)
  const an = m[0]! / ssumm2 + poly(C1, rsn);
  const up = new Float64Array(half);
  up[0] = an;
  let first: number;
  let fac: number;
  if (n > 5) {
    const an1 = m[1]! / ssumm2 + poly(C2, rsn);
    up[1] = an1;
    first = 2;
    fac = Math.sqrt((summ2 - 2 * m[0]! * m[0]! - 2 * m[1]! * m[1]!) / (1 - 2 * an * an - 2 * an1 * an1));
  } else {
    first = 1;
    fac = Math.sqrt((summ2 - 2 * m[0]! * m[0]!) / (1 - 2 * an * an));
  }
  for (let i = first; i < half; i++) up[i] = m[i]! / fac;
  // a_n, a_(n-1), ... positive for the largest observations
  for (let i = 0; i < half; i++) {
    a[n - 1 - i] = up[i]!;
    a[i] = -up[i]!;
  }
  return a;
}

/**
 * The W statistic of a sample sorted in increasing order:
 * W = (sum a_i x_(i))^2 / sum (x_i - mean)^2.
 */
export function swilkW(sorted: readonly number[]): number {
  const n = sorted.length;
  const a = swilkCoefficients(n);
  let mean = 0;
  for (const v of sorted) mean += v;
  mean /= n;
  let ss = 0;
  let num = 0;
  for (let i = 0; i < n; i++) {
    const d = sorted[i]! - mean;
    ss += d * d;
    num += a[i]! * d;
  }
  return Math.min((num * num) / ss, 1);
}

/**
 * The p-value P(W' <= W) of the Shapiro-Wilk test for a sample of size n (Royston's approximations).
 */
export function swilkPValue(w: number, n: number): number {
  if (Number.isNaN(w) || !(n >= 3)) return NaN;
  if (w >= 1) return 1;
  if (n === 3) {
    // exact: 6/pi (asin(sqrt(W)) - asin(sqrt(3/4))), W >= 3/4
    const p = (6 / Math.PI) * (Math.asin(Math.sqrt(w)) - Math.asin(Math.sqrt(0.75)));
    return Math.max(p, 0);
  }
  const w1 = Math.log1p(-w);
  if (n <= 11) {
    const gamma = poly(G, n);
    if (w1 >= gamma) return 1e-99; // beyond the range of the approximation
    const y = -Math.log(gamma - w1);
    const mu = poly(C3, n);
    const sigma = Math.exp(poly(C4, n));
    return pnorm(y, { mean: mu, sd: sigma, lowerTail: false });
  }
  const xx = Math.log(n);
  const mu = poly(C5, xx);
  const sigma = Math.exp(poly(C6, xx));
  return pnorm(w1, { mean: mu, sd: sigma, lowerTail: false });
}
