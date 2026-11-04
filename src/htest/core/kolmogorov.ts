// Distribution of the one-sample Kolmogorov-Smirnov statistic D_n = sup |F_n(x) - F(x)|, for ks.test.
//
// Written for rStats.js from the published methods (no ported code):
// - Exact distribution: Marsaglia, Tsang and Wang, "Evaluating Kolmogorov's distribution", Journal of Statistical
//   Software 8(18), 2003. P(D_n < d) = n! / n^n (H^n)_(k,k) with k = floor(n d) + 1 and an m x m matrix H, m = 2k - 1.
// - Limiting distribution of sqrt(n) D_n (Kolmogorov 1933):
//     K(x) = 1 - 2 sum_(j>=1) (-1)^(j-1) exp(-2 j^2 x^2)                           (large x)
//          = sqrt(2 pi) / x sum_(j>=1) exp(-(2j - 1)^2 pi^2 / (8 x^2))            (small x)
// - For d < 1/n the matrix is 1 x 1 and the closed form P(D_n < d) = n! / n^n (2 n d - 1)^n (Ruben and Gambino 1982)
//   is used, with 2 n d - 1 formed exactly (it cancels near d = 1/(2n)).
// - One-sided statistic D_n^+ = sup (F_n(x) - F(x)) (Birnbaum and Tingey, Annals of Mathematical Statistics 22, 1951):
//     P(D_n^+ >= d) = d sum_(j=0)^(floor(n (1 - d))) C(n, j) (1 - d - j/n)^(n-j) (d + j/n)^(j-1),
//   whose terms are b(j; n, a) / a with a = d + j/n: binomial probabilities from Loader's dbinomRawDD.
// - Upper tail P(D_n >= d) as a sum of positive terms (#483): the counting process of the sample is a Markov chain
//   with binomial steps between the breakpoints i/n - d and j/n + d, and the probability leaving it across either
//   boundary is added up (the first-passage form of the statistic, e.g. Durbin, "Distribution theory for tests based
//   on the sample distribution function", SIAM 1973).

import { ddAdd, ddDiv, twoProd, twoSum, type DD } from "../../special/dd.js";
import { dbinomRawDD } from "../../special/loader.js";
import { dbinom1 } from "../../distributions/binomial.js";

/** pi^2 / 8 as a double-double */
const PI2_8: DD = [1.2337005501361697, 7.831619385924639e-17];

/** H^n with the binary exponent kept apart: returns [matrix, e2] with the true power = matrix * 2^e2 */
function matPow(H: Float64Array, m: number, n: number): [Float64Array, number] {
  const mul = (A: Float64Array, B: Float64Array): Float64Array => {
    const C = new Float64Array(m * m);
    for (let i = 0; i < m; i++) {
      for (let l = 0; l < m; l++) {
        const a = A[i * m + l]!;
        if (a === 0) continue;
        for (let j = 0; j < m; j++) C[i * m + j]! += a * B[l * m + j]!;
      }
    }
    return C;
  };
  // Rescale by a power of two (exact) so that the entries stay in range
  const normalise = (A: Float64Array): number => {
    let mx = 0;
    for (const v of A) mx = Math.max(mx, Math.abs(v));
    if (mx === 0 || !Number.isFinite(mx)) return 0;
    const e = Math.floor(Math.log2(mx));
    if (Math.abs(e) < 500) return 0;
    const f = 2 ** -e;
    for (let i = 0; i < A.length; i++) A[i]! *= f;
    return e;
  };
  let result: Float64Array | undefined;
  let re = 0;
  let base: Float64Array = H.slice();
  let be = 0;
  let p = n;
  while (p > 0) {
    if (p & 1) {
      result = result === undefined ? base.slice() : mul(result, base);
      re += be;
      re += normalise(result);
    }
    p >>= 1;
    if (p > 0) {
      base = mul(base, base);
      be *= 2;
      be += normalise(base);
    }
  }
  return [result!, re];
}

/** Largest work m^3 (number of matrix products) of pkolmogorovExact that ksTest accepts: about 4 s (#307) */
const MAX_EXACT_WORK = 2 ** 33;

/**
 * Throws a RangeError when pkolmogorovExact(n, d) would need more than MAX_EXACT_WORK: the m x m matrix
 * (m = 2 floor(n d) + 1) is raised to the n-th power with floor(log2 n) squarings and popcount(n) - 1 products, each
 * m^3 multiply-adds (n 1e4 with d 0.4999 asked for an 800 MB matrix and hours of work). Checked before any allocation.
 *
 * @param n - Sample size.
 * @param d - Value of the statistic.
 */
export function checkKolmogorovExactSize(n: number, d: number): void {
  // the branches of pkolmogorovExact that use no matrix
  if (Number.isNaN(d) || !(n >= 1) || n !== Math.floor(n) || d <= 1 / (2 * n) || d >= 1 || n * d < 1) return;
  const m = 2 * Math.floor(n * d) + 1;
  const bits = n.toString(2);
  const products = Math.max(1, bits.length - 1 + (bits.split("1").length - 2));
  if (m ** 3 * products > MAX_EXACT_WORK) {
    throw new RangeError(
      `the exact distribution of D for n = ${n} needs powers of a ${m} x ${m} matrix, too much work: use exact: false`,
    );
  }
}

/**
 * P(D_n < d), the exact distribution of the two-sided one-sample Kolmogorov-Smirnov statistic for a continuous
 * distribution (Marsaglia, Tsang and Wang 2003). The matrix has size 2 floor(n d) + 1, so the cost grows like
 * (n d)^3 log n; ks.test uses it for small samples.
 *
 * @param n - Sample size, a positive integer.
 * @param d - Value of the statistic.
 */
export function pkolmogorovExact(n: number, d: number): number {
  if (Number.isNaN(d) || !(n >= 1) || n !== Math.floor(n)) return NaN;
  // D_n >= 1/(2n) always, and D_n <= 1
  if (d <= 1 / (2 * n)) return 0;
  if (d >= 1) return 1;
  if (n * d < 1) {
    // n! / n^n (2 n d - 1)^n, with n d = hi + lo exact so that 2 n d - 1 = (2 hi - 1) + 2 lo has no rounding error
    const [hi, lo] = twoProd(n, d);
    const t = 2 * hi - 1 + 2 * lo;
    let s = 1;
    let e = 0;
    for (let i = 1; i <= n; i++) {
      s *= (i / n) * t;
      if (s < 2 ** -500) {
        s *= 2 ** 500;
        e -= 500;
      }
    }
    while (e < -1000) {
      s *= 2 ** -1000;
      e += 1000;
    }
    return s * 2 ** e;
  }
  const k = Math.floor(n * d) + 1;
  const m = 2 * k - 1;
  const h = k - n * d;
  const H = new Float64Array(m * m);
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) H[i * m + j] = i - j + 1 >= 0 ? 1 : 0;
  for (let i = 0; i < m; i++) {
    H[i * m]! -= Math.pow(h, i + 1);
    H[(m - 1) * m + i]! -= Math.pow(h, m - i);
  }
  if (2 * h - 1 > 0) H[(m - 1) * m]! += Math.pow(2 * h - 1, m);
  // divide by (i - j + 1)!
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      const r = i - j + 1;
      if (r > 0) {
        let f = 1;
        for (let g = 2; g <= r; g++) f *= g;
        H[i * m + j]! /= f;
      }
    }
  }
  const [Q, e2] = matPow(H, m, n);
  // n! / n^n, multiplied in step by step with the binary exponent kept apart
  let s = Q[(k - 1) * m + k - 1]!;
  let e = e2;
  for (let i = 1; i <= n; i++) {
    s = (s * i) / n;
    if (Math.abs(s) < 2 ** -500) {
      s *= 2 ** 500;
      e -= 500;
    }
  }
  while (e > 1000) {
    s *= 2 ** 1000;
    e -= 1000;
  }
  while (e < -1000) {
    s *= 2 ** -1000;
    e += 1000;
  }
  return s * 2 ** e;
}

/**
 * The limiting distribution of sqrt(n) D_n (Kolmogorov's distribution), K(x) = P(sqrt(n) D_n <= x) as n -> infinity,
 * or 1 - K(x) for the upper tail. Each tail is summed directly with the series that converges fast for it.
 *
 * @param x - Value of sqrt(n) D_n.
 * @param lowerTail - `true` for K(x), `false` for 1 - K(x).
 */
export function pkolmogorovLimit(x: number, lowerTail = true): number {
  if (Number.isNaN(x)) return NaN;
  if (x <= 0) return lowerTail ? 0 : 1;
  if (x === Infinity) return lowerTail ? 1 : 0;
  if (x < 1) {
    // K(x) = sqrt(2 pi) / x sum exp(-(2j - 1)^2 pi^2 / (8 x^2)): terms fall off at least like exp(-pi^2 j / x^2)
    // The first term carries the value; its exponent pi^2 / (8 x^2) reaches the hundreds for small x, so it is formed
    // in double-double (its rounding alone is 1e-13 relative at x = 0.05)
    const wd = ddDiv(PI2_8, twoProd(x, x));
    const w = wd[0] + wd[1];
    const first = Math.exp(-wd[0]) * (1 - wd[1]);
    let s = 0;
    for (let j = 2; j < 100; j++) {
      const t = Math.exp(-(2 * j - 1) * (2 * j - 1) * w);
      s += t;
      if (t <= 1e-17 * (s + first)) break;
    }
    // the series underflows below x = 0.0407; there sqrt(2 pi) / x overflows for subnormal x (Inf * 0)
    if (first + s === 0) return lowerTail ? 0 : 1;
    const k = (Math.sqrt(2 * Math.PI) / x) * (first + s);
    return lowerTail ? k : 1 - k;
  }
  // 1 - K(x) = 2 sum (-1)^(j-1) exp(-2 j^2 x^2), alternating with terms below exp(-2) times the previous
  let s = 0;
  for (let j = 1; j < 100; j++) {
    const t = Math.exp(-2 * j * j * x * x);
    s += j % 2 === 1 ? t : -t;
    if (t <= 1e-17 * Math.abs(s)) break;
  }
  const q = 2 * s;
  return lowerTail ? 1 - q : q;
}

/**
 * P(D_n^+ >= d) for the one-sided one-sample statistic D_n^+ = sup (F_n(x) - F(x)) of a continuous distribution
 * (the same distribution holds for D_n^- = sup (F(x) - F_n(x))), exactly by the Birnbaum-Tingey formula. All terms are
 * positive, so small p-values keep their relative accuracy.
 *
 * @param n - Sample size, a positive integer.
 * @param d - Value of the statistic.
 */
export function pkolmogorovOneSidedUpper(n: number, d: number): number {
  if (Number.isNaN(d) || !(n >= 1) || n !== Math.floor(n)) return NaN;
  if (d <= 0) return 1;
  if (d > 1) return 0;
  // n (1 - d) = n - n d, with n d = hi + lo exact
  const [hi, lo] = twoProd(n, d);
  const jmax = Math.floor(n - hi - lo);
  let s = 0;
  for (let j = 0; j <= jmax; j++) {
    // a = d + j/n and b = 1 - a = (n - n d - j) / n, both from the exact n d
    const nb = ddAdd(twoSum(n - j, -hi), [-lo, 0]);
    if (nb[0] <= 0) break;
    const na = ddAdd(twoSum(j, hi), [lo, 0]);
    const a = ddDiv(na, [n, 0]);
    const b = ddDiv(nb, [n, 0]);
    s += dbinomRawDD(j, n - j, a, b, false) / (a[0] + a[1]);
  }
  return Math.min(d * s, 1);
}

/** Largest number of binomial terms of pkolmogorovExactUpper: about 4 s on the development machine (#483) */
const MAX_CHAIN_WORK = 2 ** 28;

/**
 * P(D_n >= d), the upper tail of the two-sided one-sample statistic, as a sum of positive terms (#483), or NaN where
 * that needs more than MAX_CHAIN_WORK terms. 1 - P(D_n < d) from pkolmogorovExact has absolute accuracy only (1e-22
 * came out as 3e-15 at n = 99).
 *
 * N(t), the number of points at or below t, is a Markov chain: given N(t_k) = s, the count in (t_k, t_(k+1)] is
 * Binomial(n - s, (t_(k+1) - t_k) / (1 - t_k)). D+ >= d when N(i/n - d) >= i for some i, D- >= d when
 * N(j/n + d) <= j for some j (N(t-) = N(t) almost surely). Between the at most 2n breakpoints i/n - d and j/n + d the
 * thresholds are constant, so the chain is stepped from one breakpoint to the next and the probability that leaves it
 * across a threshold is added up. Each binomial row starts from dbinom1 at its mode and follows the ratio recurrence
 * both ways until it underflows.
 *
 * @param n - Sample size, a positive integer.
 * @param d - Value of the statistic, in (0, 1).
 */
export function pkolmogorovExactUpper(n: number, d: number): number {
  const [hi, lo] = twoProd(n, d);
  // floor(n d) of the exact n d = hi + lo
  let nd = Math.floor(hi);
  if (nd === hi && lo < 0) nd -= 1;
  const pts: { t: number; up: boolean; i: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const u = (i - hi - lo) / n;
    if (u > 0 && u < 1) pts.push({ t: u, up: true, i });
    const l = (i + hi + lo) / n;
    if (l > 0 && l < 1) pts.push({ t: l, up: false, i });
  }
  // at most 2 nd + 1 live states per step, rows of about 100 terms before they underflow
  if (pts.length * (2 * nd + 1) * Math.min(n + 1, 100) > MAX_CHAIN_WORK) return NaN;
  pts.sort((a, b) => a.t - b.t);
  let upper = nd + 1; // N >= upper has crossed the upper threshold
  let alive = new Float64Array(n + 1);
  let next = new Float64Array(n + 1);
  alive[0] = 1;
  let sLo = 0; // the live states lie in [sLo, upper - 1]
  let t = 0;
  let p = 0;
  let work = 0;
  for (const pt of pts) {
    const q = (pt.t - t) / (1 - t);
    if (q > 0) {
      const odds = q / (1 - q);
      next.fill(0);
      for (let s = sLo; s < upper; s++) {
        const a = alive[s]!;
        if (a === 0) continue;
        const m = n - s;
        const c0 = Math.min(m, Math.floor((m + 1) * q));
        const cu = upper - s; // c >= cu crosses
        let v = dbinom1(c0, m, q, false);
        for (let c = c0; c <= m && v !== 0; c++) {
          if (c > c0) v = (v * (m - c + 1) * odds) / c;
          if (c >= cu) p += a * v;
          else next[s + c]! += a * v;
          work++;
        }
        v = c0 > 0 ? dbinom1(c0 - 1, m, q, false) : 0;
        for (let c = c0 - 1; c >= 0 && v !== 0; c--) {
          if (c < c0 - 1) v = (v * (c + 1)) / ((m - c) * odds);
          if (c >= cu) p += a * v;
          else next[s + c]! += a * v;
          work++;
        }
      }
      if (work > 2 * MAX_CHAIN_WORK) return NaN;
      [alive, next] = [next, alive];
    }
    t = pt.t;
    if (pt.up) upper = pt.i + 1;
    else {
      for (let s = sLo; s <= pt.i; s++) {
        p += alive[s]!;
        alive[s] = 0;
      }
      sLo = Math.max(sLo, pt.i + 1);
    }
  }
  return Math.min(p, 1);
}
