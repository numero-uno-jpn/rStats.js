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

import { nonInt, roundHalfEven } from "../internal/integer.js";
import { lbeta, lbetaDD } from "./beta.js";
import { ddAdd, ddDiv, ddLog, ddMul, twoSum, type DD } from "./dd.js";
import { gamma, lgamma, lgamma1p, sinpi } from "./gamma.js";
import { digamma } from "./psigamma.js";
import type { RCompatibleOptions } from "./rCompatible.js";

/** Below this k, choose is the product n (n-1) ... (n-k+1) / k! */
const K_SMALL = 30;

function isInt(x: number): boolean {
  return x === Math.floor(x);
}

/**
 * The n that R uses in choose (k >= K_SMALL) and lchoose (k >= 2): R reflects n < 0 to k - 1 - n before
 * testing for an integer, so there the tolerance is relative to k - 1 - n. Returns n unchanged when R
 * keeps it; a snapped value of -0 stands for the reflected n rounding to k - 1 (choose is then ±0).
 */
function rSnap(n: number, k: number): number {
  if (isInt(n)) return n;
  if (n >= 0) return nonInt(n) ? n : roundHalfEven(n);
  const m = k - 1 - n;
  return nonInt(m) ? n : k - 1 - roundHalfEven(m) || -0;
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
  // 0 <= n < k - 1, n not an integer: (-1)^(k+1) sin(pi n) / pi * B(n + 1, k - n). n + 1 and k - n round when they
  // lie in a higher binade than n (1.4e-14 at n = 191.38, k = 503; 3.9e-14 at n = 255.9, k = 1001): put the roundings
  // back to first order, d/da log B(a, b) = psi(a) - psi(a + b)
  const s = sinpi(n);
  const [ah, al] = twoSum(n, 1);
  const [bh, bl] = twoSum(k, -n);
  const dab = al === 0 && bl === 0 ? 0 : digamma(ah + bh);
  const corr = (al === 0 ? 0 : al * (digamma(ah) - dab)) + (bl === 0 ? 0 : bl * (digamma(bh) - dab));
  const l = ddAdd(logBeta(ah, bh), [Math.log(Math.abs(s) / Math.PI) + corr, 0]);
  return { log: l, sign: (k % 2 === 0 ? -1 : 1) * Math.sign(s) };
}

/**
 * Binomial coefficient. Equivalent to R's `choose()`. Takes single numbers.
 *
 * `n` may be any real number. `k` is rounded to the nearest integer (as R does, which also warns
 * when `k` is not close to an integer); `choose(n, k)` is 0 for `k < 0` and 1 for `k = 0`.
 * For integer `n` the result is an integer (exact up to 2^53).
 *
 * Edge cases where R differs from the mathematical value, followed by default (`rCompatible: false`
 * returns the mathematical value instead):
 * - `n` within 1e-9 max(1, |n|) of an integer is treated as that integer, so `choose(1e-10, 2)` is 0
 *   (mathematically -5e-11); for `n < 0` and `k >= 30` the tolerance is relative to `k - 1 - n`;
 * - `choose(n, Infinity)` is 0 for `n >= 0` (otherwise `NaN`);
 * - `choose(±Infinity, k)` is `NaN` for `k >= 30` (`±Infinity` below).
 *
 * @param n - Number of items (any real number).
 * @param k - Number chosen (rounded to an integer).
 * @param options - `rCompatible` (default `true`).
 * @returns The binomial coefficient.
 *
 * @example
 * ```ts
 * choose(5, 2);    // 10
 * choose(0.5, 3);  // 0.0625
 * choose(-2, 3);   // -4
 * ```
 *
 * @category Special functions
 */
export function choose(n: number, k: number, options?: RCompatibleOptions): number {
  if (Number.isNaN(n) || Number.isNaN(k)) return NaN;
  const rc = options?.rCompatible ?? true;
  k = roundHalfEven(k);
  if (k < 0) return 0;
  if (k === 0) return 1;
  if (!Number.isFinite(k)) return rc && n >= 0 && n < Infinity ? 0 : NaN;
  if (!Number.isFinite(n)) return rc && k >= K_SMALL ? NaN : n > 0 || k % 2 === 0 ? Infinity : -Infinity;
  if (k < K_SMALL) {
    // R treats n within 1e-9 max(1, |n|) of an integer as an integer (src/internal/integer.ts)
    const snap = rc && !isInt(n) && !nonInt(n);
    // R keeps n in the product and rounds the result (choose(1e15 + 0.125, 2) is not choose(1e15, 2))
    if (snap && n >= 0 && roundHalfEven(n) < k) return 0;
    const r = fallingRatio(n, k);
    const v = r[0] + r[1];
    if (Number.isFinite(v)) return isInt(n) || snap ? Math.round(v) : v;
    // Overflow (the double-double steps then give NaN): the plain product overflows too
    let p = 1;
    for (let j = 0; j < k; j++) p = (p * (n - j)) / (j + 1);
    return p;
  }
  if (rc) {
    n = rSnap(n, k);
    // R reflects n < 0 that rounds to -0 into choose(k - 1, k) = 0, with the sign (-1)^k
    if (Object.is(n, -0)) return k % 2 === 0 ? 0 : -0;
  }
  const r = logChooseLarge(n, k);
  if (r === undefined) return 0;
  const v = r.sign * Math.exp(r.log[0]) * (1 + r.log[1]);
  return isInt(n) && Number.isFinite(v) ? Math.round(v) : v;
}

/**
 * Logarithm of the absolute value of the binomial coefficient. Equivalent to R's `lchoose()`.
 * Takes single numbers: `log(abs(choose(n, k)))`, computed without overflow.
 *
 * Edge cases where R differs from the mathematical value, followed by default (`rCompatible: false`
 * returns the mathematical value instead): `n` within 1e-9 max(1, |n|) of an integer is treated as that
 * integer (for `k >= 2`; for `n < 0` the tolerance is relative to `k - 1 - n`); `lchoose(n, Infinity)` is `-Infinity` for `n >= 0` (otherwise `NaN`); `lchoose(±Infinity, k)`
 * is `NaN` for `k >= 2` (`Infinity` for `k = 1`).
 *
 * @param n - Number of items (any real number).
 * @param k - Number chosen (rounded to an integer).
 * @param options - `rCompatible` (default `true`).
 * @returns log|choose(n, k)| (`-Infinity` where `choose(n, k)` is 0).
 *
 * @example
 * ```ts
 * lchoose(1000, 500);  // 689.4672615678512
 * ```
 *
 * @category Special functions
 */
export function lchoose(n: number, k: number, options?: RCompatibleOptions): number {
  if (Number.isNaN(n) || Number.isNaN(k)) return NaN;
  const rc = options?.rCompatible ?? true;
  k = roundHalfEven(k);
  if (k < 0) return -Infinity;
  if (k === 0) return 0;
  if (!Number.isFinite(k)) return rc && n >= 0 && n < Infinity ? -Infinity : NaN;
  if (!Number.isFinite(n)) return rc && k >= 2 ? NaN : Infinity;
  // R's lchoose(n, 1) is log|n| without rounding n; for k >= 2 it rounds n itself (unlike choose for k < 30)
  if (rc && k >= 2) n = rSnap(n, k);
  if (k < K_SMALL) {
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
  const r = logChooseLarge(n, k);
  if (r === undefined) return -Infinity;
  // For integer n the coefficient is an integer; below 2^53 take the log of the exact value (so that lchoose(n, n) is 0)
  if (isInt(n) && r.log[0] < 36) return Math.log(Math.round(Math.exp(r.log[0]) * (1 + r.log[1])));
  return r.log[0] + r.log[1];
}

/**
 * Factorial. Equivalent to R's `factorial()`. Takes a single number: `gamma(x + 1)`, defined for
 * any real `x` that is not a negative integer.
 *
 * @param x - Argument.
 * @returns x! = Gamma(x + 1) (`NaN` at negative integers, `Infinity` on overflow).
 *
 * @example
 * ```ts
 * factorial(5);    // 120
 * factorial(0.5);  // 0.8862269254527579
 * ```
 *
 * @category Special functions
 */
export function factorial(x: number): number {
  return gamma(x + 1);
}

/**
 * Logarithm of the factorial. Equivalent to R's `lfactorial()`. Takes a single number:
 * `lgamma(x + 1)`, computed without forming `x + 1` near 0 so that small `x` keep their accuracy.
 *
 * @param x - Argument.
 * @returns log|x!| = log|Gamma(x + 1)| (`Infinity` at negative integers).
 *
 * @example
 * ```ts
 * lfactorial(100);  // 363.73937555556347
 * ```
 *
 * @category Special functions
 */
export function lfactorial(x: number): number {
  if (Math.abs(x) <= 0.2) return lgamma1p(x);
  return lgamma(x + 1);
}
