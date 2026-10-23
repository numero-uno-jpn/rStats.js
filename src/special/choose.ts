// Binomial coefficients and factorials: choose, lchoose, factorial, lfactorial.
//
// Written for rStats.js from the definitions (no ported code):
//   choose(n, k) = n (n - 1) ... (n - k + 1) / k!   for integer k >= 1, 1 for k = 0, 0 for k < 0,
// with n any real number. For small k the product is formed in double-double. For larger k it is
//   choose(n, k) = 1 / ((n + 1) B(n - k + 1, k + 1))                         (n >= k - 1)
//   choose(n, k) = (-1)^(k+1) sin(pi n) / pi * B(n + 1, k - n)              (0 <= n < k - 1, n not an integer)
//   choose(n, k) = (-1)^k / ((k - n) B(-n, k + 1))                         (n < 0)
// where the second line follows from the reflection formula Gamma(z) Gamma(1 - z) = pi / sin(pi z).
// log B is taken from lbetaDD (double-double), since its value can be in the hundreds and exp would turn the
// rounding of a double log into a relative error of 1e-13.

import { lbeta, lbetaDD } from "./beta.js";
import { ddAdd, ddDiv, ddLog, ddMul, twoSum, type DD } from "./dd.js";
import { gamma, lgamma, lgamma1p, sinpi } from "./gamma.js";

/** Below this k, choose is the product n (n-1) ... (n-k+1) / k! */
const K_SMALL = 30;

/** Round half to even, as C's nearbyint in the default rounding mode (used for k, as R rounds a non-integer k) */
function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return r - x === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

function isInt(x: number): boolean {
  return x === Math.floor(x);
}

/** n (n-1) ... (n-k+1) / k! in double-double (1 <= k < K_SMALL) */
function fallingRatio(n: number, k: number): DD {
  let r: DD = [1, 0];
  for (let j = 0; j < k; j++) r = ddDiv(ddMul(r, twoSum(n, -j)), [j + 1, 0]);
  return r;
}

/** log B(a, b) (a, b > 0): double-double where lbetaDD is accurate, else lbeta (whose value is then large) */
function logBeta(a: number, b: number): DD {
  return Math.min(a, b) >= 1 && Math.max(a, b) < 2 ** 52 ? lbetaDD(a, b) : [lbeta(a, b), 0];
}

/**
 * log|choose(n, k)| in double-double and the sign, for k >= K_SMALL and choose(n, k) != 0.
 * Returns undefined when choose(n, k) is 0 (integer n with 0 <= n < k)
 */
function logChooseLarge(n: number, k: number): { log: DD; sign: number } | undefined {
  if (n < 0) {
    // choose(n, k) = (-1)^k choose(k - n - 1, k) = (-1)^k / ((k - n) B(-n, k + 1)). Forming k - n - 1 would round
    // away the digits of a small n (4e-4 relative at n = -1e-10, k = 1000)
    const l = ddAdd(ddLog(twoSum(k, -n)), logBeta(-n, k + 1));
    return { log: [-l[0], -l[1]], sign: k % 2 === 0 ? 1 : -1 };
  }
  if (isInt(n) && n < k) return undefined;
  if (n >= k - 1) {
    // -log(n + 1) - log B(n - k + 1, k + 1); n - k + 1 is exact for n in [k - 1, 2 (k - 1)]
    const l = ddAdd(ddLog(twoSum(n, 1)), logBeta(n - k + 1, k + 1));
    return { log: [-l[0], -l[1]], sign: 1 };
  }
  // 0 <= n < k - 1, n not an integer: (-1)^(k+1) sin(pi n) / pi * B(n + 1, k - n)
  const s = sinpi(n);
  const l = ddAdd(logBeta(n + 1, k - n), [Math.log(Math.abs(s) / Math.PI), 0]);
  return { log: l, sign: (k % 2 === 0 ? -1 : 1) * Math.sign(s) };
}

/**
 * Binomial coefficient. Equivalent to R's `choose(n, k)` for single numbers.
 *
 * `n` may be any real number. `k` is rounded to the nearest integer (as R does, which also warns
 * when `k` is not close to an integer); `choose(n, k)` is 0 for `k < 0` and 1 for `k = 0`.
 * For integer `n` the result is an integer (exact up to 2^53).
 *
 * @param n - Number of items (any real number).
 * @param k - Number chosen (rounded to an integer).
 * @returns The binomial coefficient.
 *
 * @example
 * ```ts
 * choose(5, 2);    // 10
 * choose(0.5, 3);  // 0.0625
 * choose(-2, 3);   // -4
 * ```
 */
export function choose(n: number, k: number): number {
  if (Number.isNaN(n) || Number.isNaN(k)) return NaN;
  k = roundHalfEven(k);
  if (k < 0) return 0;
  if (k === 0) return 1;
  if (!Number.isFinite(k)) return NaN;
  if (!Number.isFinite(n)) return n > 0 || k % 2 === 0 ? Infinity : -Infinity;
  const nInt = isInt(n);
  if (k < K_SMALL) {
    const r = fallingRatio(n, k);
    const v = r[0] + r[1];
    if (Number.isFinite(v)) return nInt ? Math.round(v) : v;
    // Overflow (the double-double steps then give NaN): the plain product overflows too
    let p = 1;
    for (let j = 0; j < k; j++) p = (p * (n - j)) / (j + 1);
    return p;
  }
  const r = logChooseLarge(n, k);
  if (r === undefined) return 0;
  const v = r.sign * Math.exp(r.log[0]) * (1 + r.log[1]);
  return nInt && Number.isFinite(v) ? Math.round(v) : v;
}

/**
 * Logarithm of the absolute value of the binomial coefficient. Equivalent to R's `lchoose(n, k)`
 * for single numbers: `log(abs(choose(n, k)))`, computed without overflow.
 *
 * @param n - Number of items (any real number).
 * @param k - Number chosen (rounded to an integer).
 * @returns log|choose(n, k)| (`-Infinity` where `choose(n, k)` is 0).
 *
 * @example
 * ```ts
 * lchoose(1000, 500);  // 689.4672...
 * ```
 */
export function lchoose(n: number, k: number): number {
  if (Number.isNaN(n) || Number.isNaN(k)) return NaN;
  k = roundHalfEven(k);
  if (k < 0) return -Infinity;
  if (k === 0) return 0;
  if (!Number.isFinite(k)) return NaN;
  if (k < K_SMALL) {
    if (!Number.isFinite(n)) return Infinity;
    const r = fallingRatio(n, k);
    const v = Math.abs(r[0] + r[1]);
    if (v > 1e-300 && v < 1e300) {
      // log of a double-double value
      const l = ddLog(r[0] < 0 ? [-r[0], -r[1]] : r);
      return l[0] + l[1];
    }
    if (v === 0) return -Infinity;
    // Out of range: sum of logs (the result is large in magnitude, so its rounding is relatively small)
    let s = -lgamma(k + 1);
    for (let j = 0; j < k; j++) s += Math.log(Math.abs(n - j));
    return s;
  }
  if (!Number.isFinite(n)) return Infinity;
  const r = logChooseLarge(n, k);
  if (r === undefined) return -Infinity;
  // For integer n the coefficient is an integer; below 2^53 take the log of the exact value (so that lchoose(n, n) is 0)
  if (isInt(n) && r.log[0] < 36) return Math.log(Math.round(Math.exp(r.log[0]) * (1 + r.log[1])));
  return r.log[0] + r.log[1];
}

/**
 * Factorial. Equivalent to R's `factorial(x)` for a single number: `gamma(x + 1)`, defined for
 * any real `x` that is not a negative integer.
 *
 * @param x - Argument.
 * @returns x! = Gamma(x + 1) (`NaN` at negative integers, `Infinity` on overflow).
 *
 * @example
 * ```ts
 * factorial(5);    // 120
 * factorial(0.5);  // 0.886226925452758
 * ```
 */
export function factorial(x: number): number {
  return gamma(x + 1);
}

/**
 * Logarithm of the factorial. Equivalent to R's `lfactorial(x)` for a single number:
 * `lgamma(x + 1)`, computed without forming `x + 1` near 0 so that small `x` keep their accuracy.
 *
 * @param x - Argument.
 * @returns log|x!| = log|Gamma(x + 1)| (`Infinity` at negative integers).
 *
 * @example
 * ```ts
 * lfactorial(100);  // 363.73937555556347
 * ```
 */
export function lfactorial(x: number): number {
  if (Math.abs(x) <= 0.2) return lgamma1p(x);
  return lgamma(x + 1);
}
