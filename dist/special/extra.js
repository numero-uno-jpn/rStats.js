// The non-regularized incomplete gamma functions, the inverse error functions and the number of permutations:
// gammainc, erfinv, erfcinv, perm.
//
// Written for rStats.js from the definitions (no ported code).
// - gammainc: gamma(a) times the regularized P(a, x) and Q(a, x) of src/special/igam.ts. Where the product over- or
//   underflows but the value does not (a above 171.6), the smaller tail is x^a e^-x times the series (x < a) or the
//   continued fraction (x > a) of igam.ts, with the exponent a log x - x in double-double (exp(lgamma(a) + log P)
//   turned the rounding of its terms, up to 1e5 in size, into a relative error of 1e-12).
// - erfcinv(z) = -qnorm(z / 2) / sqrt(2) (exact halving; qnorm is accurate in both tails); erfinv(y) = erfcinv(1 - y)
//   for |y| >= 1/2 (1 - |y| is exact there), and for smaller |y| that value refined by Newton steps on erf (the
//   form through qnorm((1 + y) / 2) loses the relative accuracy of a small y).
// - perm(n, k) = n (n - 1) ... (n - k + 1) = Gamma(n + 1) / Gamma(n - k + 1): the product formed in double-double
//   for integer k up to 1000 (+-Infinity once it overflows), otherwise the ratio of gamma functions with its log in
//   double-double: for n - k >= 15 from Stirling's formula through Loader's stirlerr and bd0 (src/special/loader.ts),
//   which does not cancel as lgamma(n + 1) - lgamma(n - k + 1) does, and for n - k + 1 <= 0 by the reflection formula.
import { qnorm } from "../distributions/normal.js";
import { ddAdd, ddLog, ddMul, ddMulNum, ddSub, twoSum } from "./dd.js";
import { erf } from "./erf.js";
import { gamma, lgamma, lgammaSign, sinpi } from "./gamma.js";
import { gammaInc, igamcContinuedFractionValue, igamSeriesSum } from "./igam.js";
import { bd0dd, stirlerr } from "./loader.js";
import { digamma } from "./psigamma.js";
/**
 * The non-regularized incomplete gamma functions gamma(a, x) and Gamma(a, x) and their logs.
 * Equivalent to `pracma::gammainc()` in R. `pracma::gammainc(x, a)` returns them as `lowinc` and `uppinc`;
 * in base R they are `pgamma(x, a) * gamma(a)` and `pgamma(x, a, lower.tail = FALSE) * gamma(a)`.
 *
 * @example
 * ```ts
 * gammainc(2, 3).lower; // 0.6466471676338731 (2 - 10 e^-2)
 * ```
 *
 * @category Special functions
 */
export function gammainc(x, a) {
    if (Number.isNaN(x) || Number.isNaN(a) || x < 0 || !(a > 0))
        return { lower: NaN, upper: NaN, logLower: NaN, logUpper: NaN };
    const lg = lgamma(a);
    const g = gamma(a);
    const tail = (lower) => {
        const p = gammaInc(a, x, lower, false);
        const v = g * p;
        // the product where it is a normal number (then also its log: lgamma(a) + log P can cancel)
        if (Number.isFinite(g) && p > DBL_MIN && Number.isFinite(v) && v > DBL_MIN)
            return [v, Math.log(v)];
        const log = lg + gammaInc(a, x, lower, true);
        // the smaller tail, unless the value over- or underflows anyway (its log is then large, and lg + log P is accurate
        // relative to it)
        if (log < 710 && log > -746 && x > 0 && (lower ? x < a : x > a))
            return smallTail(x, a, lower);
        return [Math.exp(log), log];
    };
    const [lower, logLower] = tail(true);
    const [upper, logUpper] = tail(false);
    return { lower, upper, logLower, logUpper };
}
const DBL_MIN = 2.2250738585072014e-308;
/**
 * [value, log] of gamma(a, x) for x < a (lower) or Gamma(a, x) for x > a: x^a e^-x / a times the series
 * sum_n x^n / ((a + 1) ... (a + n)), or x^a e^-x times the continued fraction. The exponent is formed in
 * double-double together with the logs of the other factors, and exp is taken once
 */
function smallTail(x, a, lower) {
    let e = ddAdd(ddMulNum(ddLog([x, 0]), a), [-x, 0]);
    if (lower)
        e = ddAdd(e, ddLog([igamSeriesSum(a, x) / a, 0]));
    else
        e = ddAdd(e, ddLog([igamcContinuedFractionValue(a, x), 0]));
    const log = e[0] + e[1];
    // exp(e0 + e1) = exp(e0) (1 + e1); in the subnormal range the last digits are lost anyway
    const v = e[0] > -708 ? Math.exp(e[0]) * (1 + e[1]) : Math.exp(log);
    return [v, log];
}
/**
 * Inverse of the complementary error function: the x with erfc(x) = z, for 0 <= z <= 2 (NaN outside).
 * Equivalent to `pracma::erfcinv()` in R.
 *
 * @example
 * ```ts
 * erfcinv(0.5);    // 0.4769362762044699
 * erfcinv(1e-20);  // 6.601580622355143
 * ```
 *
 * @category Special functions
 */
export function erfcinv(z) {
    if (Number.isNaN(z) || z < 0 || z > 2)
        return NaN;
    return -qnorm(z / 2) * Math.SQRT1_2;
}
/**
 * Inverse of the error function: the x with erf(x) = y, for -1 <= y <= 1 (NaN outside).
 * Equivalent to `pracma::erfinv()` in R. Unlike pracma, it is accurate for small |y| (pracma's
 * `qnorm((1 + y) / 2)` loses it: `erfinv(1e-300)` is -0 there).
 *
 * @example
 * ```ts
 * erfinv(0.5); // 0.4769362762044699
 * ```
 *
 * @category Special functions
 */
export function erfinv(y) {
    if (Number.isNaN(y) || y < -1 || y > 1)
        return NaN;
    const s = y < 0 ? -1 : 1;
    const a = Math.abs(y);
    if (a >= 0.5)
        return s * erfcinv(1 - a);
    if (a < 1e-8)
        return y * 0.886226925452758 * (1 + (Math.PI / 12) * y * y); // sqrt(pi)/2 (y + pi y^3 / 12)
    let x = erfcinv(1 - a);
    for (let i = 0; i < 3; i++) {
        const d = (erf(x) - a) / (1.1283791670955126 * Math.exp(-x * x)); // erf' = 2/sqrt(pi) e^(-x^2)
        x -= d;
        if (Math.abs(d) <= 1e-17 * x)
            break;
    }
    return s * x;
}
/**
 * Number of ordered selections of k items from n: n! / (n - k)!, defined for real n >= 0 as
 * Gamma(n + 1) / Gamma(n - k + 1) (0 for an integer n < k). Negative arguments give NaN.
 * Not an R function. It is jStat's `permutation`; R has only `choose()` (unordered selections).
 *
 * @example
 * ```ts
 * perm(5, 2); // 20
 * ```
 *
 * @category Special functions
 */
export function perm(n, k) {
    if (Number.isNaN(n) || Number.isNaN(k) || n < 0 || k < 0)
        return NaN;
    const intK = k === Math.floor(k);
    if (n === Math.floor(n) && intK && k > n)
        return 0;
    if (!Number.isFinite(n) || !Number.isFinite(k))
        return permLgamma(n, k);
    if (intK && k <= 1000)
        return fallingFactorial(n, k);
    return gammaRatio(n, k);
}
/** n (n - 1) ... (n - k + 1) in double-double (integer k; no factor is 0), +-Infinity once it overflows */
function fallingFactorial(n, k) {
    let p = [1, 0];
    for (let i = 0; i < k; i++) {
        const f = twoSum(n, -i); // n - i exactly
        const hi = p[0] * f[0];
        if (!Number.isFinite(hi)) {
            // the sign of the rest of the product decides the sign of the infinity
            let sign = Math.sign(hi);
            for (let j = i + 1; j < k; j++)
                if (n - j < 0)
                    sign = -sign;
            return sign * Infinity;
        }
        // Veltkamp splitting overflows above about 1e300: the last steps before overflow in double precision
        p = Math.abs(p[0]) > 1e290 || Math.abs(f[0]) > 1e290 ? [(p[0] + p[1]) * (f[0] + f[1]), 0] : ddMul(p, f);
    }
    return p[0] + p[1];
}
/**
 * Gamma(n + 1) / Gamma(m + 1), m = n - k (as mh + ml exactly). For n > 170 Stirling's formula
 * Gamma(z + 1) = sqrt(2 pi z) (z / e)^z exp(stirlerr(z)) gives, with n = mh + kk,
 *   log ratio = kk log n - bd0(mh, n) + stirlerr(n) - stirlerr(mh),  bd0(mh, n) = mh log(mh / n) + n - mh,
 * formed in double-double without the cancellation of lgamma(n + 1) - lgamma(m + 1) (1e-9 relative at
 * perm(1e6, 2.5)). The rounding ml of n - k is put back to first order, Gamma(m + 1) = Gamma(mh + 1) e^(ml psi(mh + 1));
 * for m + 1 < 0 the reflection formula takes over (m + 1 can lie next to a pole of Gamma)
 */
function gammaRatio(n, k) {
    const [mh, ml] = twoSum(n, -k);
    if (mh + 1 <= 0)
        return gammaRatioReflected(n, mh, ml);
    // n^k (1 + O(k^2 / n)); a k large enough for the correction to matter overflows n^k
    if (n > 1e280)
        return k * k < 1e-17 * n ? Math.pow(n, k) : Infinity;
    let r;
    if (mh >= 15) {
        // the ratio is at least (m + 1)^k: overflow before the terms get large
        if (k * Math.log(mh + 1) > 720)
            return Infinity;
        const kk = twoSum(n, -mh);
        let e = ddSub(ddMul(kk, ddLog([n, 0])), bd0dd(mh, [n, 0]));
        e = ddAdd(e, [stirlerr(n) - stirlerr(mh), 0]);
        r = Math.sqrt(n / mh) * Math.exp(e[0]) * (1 + e[1]);
    }
    else if (n < 30) {
        r = gamma(n + 1) / gamma(mh + 1);
    }
    else {
        if (lgamma(n + 1) - lgamma(mh + 1) > 720)
            return Infinity;
        const e = ddSub(lgammaDD(n + 1), ddLog([gamma(mh + 1), 0]));
        r = Math.exp(e[0]) * (1 + e[1]);
    }
    if (ml !== 0 && Number.isFinite(r) && r !== 0)
        r *= Math.exp(-ml * digamma(mh + 1));
    return r;
}
/**
 * Gamma(n + 1) / Gamma(m + 1) for m + 1 = z <= 0: 1 / Gamma(z) = Gamma(1 - z) sin(pi z) / pi with 1 - z = -m.
 * sin(pi z) takes the low part of z to first order (exact 0 at a pole, (-1)^j pi zl next to it)
 */
function gammaRatioReflected(n, mh, ml) {
    const z = ddAdd(twoSum(mh, 1), [ml, 0]);
    const s = sinpi(z[0]) + sinpi(z[0] + 0.5) * Math.PI * z[1];
    if (s === 0)
        return 0;
    const sign = Math.sign(s);
    // log(|s| / pi) in double-double too: next to a pole it is about -33, whose rounding would be 3e-15 relative
    const ls = ddAdd(ddSub(ddLog([Math.abs(s), 0]), LOGPI_DD), [-ml * digamma(-mh), 0]);
    if (lgamma(n + 1) + lgamma(-mh) + ls[0] > 720)
        return sign * Infinity;
    const e = ddAdd(ddAdd(lgammaDD(n + 1), lgammaDD(-mh)), ls);
    return sign * Math.exp(e[0]) * (1 + e[1]);
}
const LS2PI_DD = [0.91893853320467278, -3.8782941580672414e-17];
const LOGPI_DD = [1.1447298858494002, 1.0265951162707826e-17];
/**
 * lgamma(z) in double-double for 0 < z < 1e280: the log of gamma(z) below 15, above it
 * (z - 1/2) log z - z + log sqrt(2 pi) + stirlerr(z) (stirlerr(z) = lgamma(z + 1) - (z + 1/2) log z + z - log sqrt(2 pi))
 */
function lgammaDD(z) {
    if (z < 15)
        return ddLog([gamma(z), 0]);
    const e = ddSub(ddMul(twoSum(z, -0.5), ddLog([z, 0])), [z, 0]);
    return ddAdd(ddAdd(e, LS2PI_DD), [stirlerr(z), 0]);
}
/** Gamma(n + 1) / Gamma(n - k + 1) from lgamma (infinite n or k) */
function permLgamma(n, k) {
    const num = lgammaSign(n + 1);
    const den = lgammaSign(n - k + 1);
    return num.sign * den.sign * Math.exp(num.value - den.value);
}
