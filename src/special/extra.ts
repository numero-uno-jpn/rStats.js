// The non-regularized incomplete gamma functions, the inverse error functions and the number of permutations:
// gammainc, erfinv, erfcinv, perm.
//
// Written for rStats.js from the definitions (no ported code).
// - gammainc: gamma(a) times the regularized P(a, x) and Q(a, x) of src/special/igam.ts, or exp of their logs
//   lgamma(a) + log P where the product over- or underflows.
// - erfcinv(z) = -qnorm(z / 2) / sqrt(2) (exact halving; qnorm is accurate in both tails); erfinv(y) = erfcinv(1 - y)
//   for |y| >= 1/2 (1 - |y| is exact there), and for smaller |y| that value refined by Newton steps on erf (the
//   form through qnorm((1 + y) / 2) loses the relative accuracy of a small y).
// - perm(n, k) = n (n - 1) ... (n - k + 1) = Gamma(n + 1) / Gamma(n - k + 1), the product formed in double-double.

import { qnorm } from "../distributions/normal.js";
import { ddMul, type DD } from "./dd.js";
import { erf } from "./erf.js";
import { gamma, lgamma, lgammaSign } from "./gamma.js";
import { gammaInc } from "./igam.js";

/** Result of {@link gammainc}. */
export interface GammaincResult {
  /** Lower incomplete gamma function gamma(a, x) = integral from 0 to x of t^(a-1) e^-t dt. */
  lower: number;
  /** Upper incomplete gamma function Gamma(a, x) = integral from x to Inf of t^(a-1) e^-t dt. */
  upper: number;
  /** log of `lower` (finite where `lower` overflows). */
  logLower: number;
  /** log of `upper`. */
  logUpper: number;
}

/**
 * The non-regularized incomplete gamma functions gamma(a, x) and Gamma(a, x) and their logs. As
 * `pracma::gammainc(x, a)` (`lowinc`, `uppinc`), or R's `pgamma(x, a) * gamma(a)` and
 * `pgamma(x, a, lower.tail = FALSE) * gamma(a)`.
 *
 * @example
 * ```ts
 * gammainc(2, 3).lower; // 0.6466471676338731 = 2 - 10 e^-2
 * ```
 */
export function gammainc(x: number, a: number): GammaincResult {
  if (Number.isNaN(x) || Number.isNaN(a) || x < 0 || !(a > 0)) return { lower: NaN, upper: NaN, logLower: NaN, logUpper: NaN };
  const lg = lgamma(a);
  const g = gamma(a);
  const tail = (lower: boolean): [number, number] => {
    if (lower && x < a && !(x === 0)) {
      const r = lowerSeries(x, a, g);
      if (r !== undefined) return r;
    }
    const lp = gammaInc(a, x, lower, true);
    const log = lg + lp;
    const p = gammaInc(a, x, lower, false);
    const v = g * p;
    // the product where it is a normal number (then also its log: lgamma(a) + log P can cancel), else the logs
    if (Number.isFinite(g) && p > 2.2250738585072014e-308 && Number.isFinite(v) && v > 2.2250738585072014e-308) return [v, Math.log(v)];
    return [Math.exp(log), log];
  };
  const [lower, logLower] = tail(true);
  const [upper, logUpper] = tail(false);
  return { lower, upper, logLower, logUpper };
}

/**
 * gamma(a, x) for x < a where gamma(a) P(a, x) over- or underflows (or its log would cancel): x^a e^-x / a times
 * sum_n x^n / ((a + 1) ... (a + n)), with x^a e^-x from pow and exp (exp of a log would turn its rounding into a
 * relative error of |a log x| ulp)
 */
function lowerSeries(x: number, a: number, g: number): [number, number] | undefined {
  const p = gammaInc(a, x, true, false);
  const v = g * p;
  if (Number.isFinite(g) && p > 2.2250738585072014e-308 && Number.isFinite(v) && v > 2.2250738585072014e-308) return undefined;
  let s = 1;
  let t = 1;
  for (let n = 1; n < 100000; n++) {
    t *= x / (a + n);
    s += t;
    if (t <= s * 1e-17) break;
  }
  const log = a * Math.log(x) - x + Math.log(s / a);
  const pw = Math.pow(x, a) * Math.exp(-x);
  const lin = pw > 2.2250738585072014e-308 && Number.isFinite(pw) ? (pw * s) / a : Math.exp(log);
  return [lin, Number.isFinite(lin) && lin > 2.2250738585072014e-308 ? Math.log(lin) : log];
}

/**
 * Inverse of the complementary error function: the x with erfc(x) = z, for 0 <= z <= 2 (NaN outside). As
 * `pracma::erfcinv`.
 */
export function erfcinv(z: number): number {
  if (Number.isNaN(z) || z < 0 || z > 2) return NaN;
  return -qnorm(z / 2) * Math.SQRT1_2;
}

/**
 * Inverse of the error function: the x with erf(x) = y, for -1 <= y <= 1 (NaN outside). As `pracma::erfinv`, but
 * accurate for small |y| (pracma's `qnorm((1 + y) / 2)` loses it: `erfinv(1e-300)` is -0 there).
 *
 * @example
 * ```ts
 * erfinv(0.5); // 0.4769362762044699
 * ```
 */
export function erfinv(y: number): number {
  if (Number.isNaN(y) || y < -1 || y > 1) return NaN;
  const s = y < 0 ? -1 : 1;
  const a = Math.abs(y);
  if (a >= 0.5) return s * erfcinv(1 - a);
  if (a < 1e-8) return y * 0.886226925452758 * (1 + (Math.PI / 12) * y * y); // sqrt(pi)/2 (y + pi y^3 / 12)
  let x = erfcinv(1 - a);
  for (let i = 0; i < 3; i++) {
    const d = (erf(x) - a) / (1.1283791670955126 * Math.exp(-x * x)); // erf' = 2/sqrt(pi) e^(-x^2)
    x -= d;
    if (Math.abs(d) <= 1e-17 * x) break;
  }
  return s * x;
}

/**
 * Number of ordered selections of k items from n: n! / (n - k)!, defined for real n >= 0 as
 * Gamma(n + 1) / Gamma(n - k + 1) (0 for an integer n < k). jStat's `permutation`. Negative arguments give NaN.
 *
 * @example
 * ```ts
 * perm(5, 2); // 20
 * ```
 */
export function perm(n: number, k: number): number {
  if (Number.isNaN(n) || Number.isNaN(k) || n < 0 || k < 0) return NaN;
  if (k === Math.floor(k) && k <= 1000) {
    // the falling factorial n (n - 1) ... (n - k + 1); reaches 0 for an integer n < k
    let p: DD = [1, 0];
    for (let i = 0; i < k; i++) {
      p = ddMul(p, [n - i, 0]);
      if (p[0] === 0 || !Number.isFinite(p[0])) break;
    }
    return p[0] + p[1];
  }
  if (n === Math.floor(n) && k > n && k === Math.floor(k)) return 0;
  const num = lgammaSign(n + 1);
  const den = lgammaSign(n - k + 1);
  return num.sign * den.sign * Math.exp(num.value - den.value);
}
