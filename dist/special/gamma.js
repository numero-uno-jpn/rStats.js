// Ported from xsf include/xsf/cephes/gamma.h and include/xsf/cephes/unity.h (lgam1p)
// (xsf commit c6a3afe).
// Cephes Math Library Release 2.8, Copyright 1984, 1995, 2000 by Stephen L. Moshier.
// xsf Copyright (c) 2024, SciPy. BSD-3-Clause. See THIRD_PARTY_NOTICES.md.
import { EULER, LOGPI, LS2PI, MACHEP, MAXGAM, SQRT2PI } from "./constants.js";
import { p1evl, polevl } from "./polevl.js";
import { ddAdd, ddLog, ddMulNum } from "./dd.js";
const GAMMA_P = [
    1.60119522476751861407e-4, 1.19135147006586384913e-3, 1.04213797561761569935e-2,
    4.76367800457137231464e-2, 2.07448227648435975150e-1, 4.94214826801497100753e-1,
    9.99999999999999996796e-1,
];
const GAMMA_Q = [
    -2.31581873324120129819e-5, 5.39605580493303397842e-4, -4.45641913851797240494e-3,
    1.18139785222060435552e-2, 3.58236398605498653373e-2, -2.34591795718243348568e-1,
    7.14304917030273074085e-2, 1.00000000000000000320e0,
];
/* Stirling's formula for the Gamma function, valid for 33 <= x <= 172 */
const GAMMA_STIR = [
    7.87311395793093628397e-4, -2.29549961613378126380e-4, -2.68132617805781232825e-3,
    3.47222221605458667310e-3, 8.33333333333482257126e-2,
];
const MAXSTIR = 143.01608;
/** sin(pi x). Does not lose accuracy to the rounding of pi x even for large x */
export function sinpi(x) {
    let s = 1;
    if (x < 0) {
        x = -x;
        s = -1;
    }
    const r = x % 2;
    if (r < 0.5)
        return s * Math.sin(Math.PI * r);
    if (r > 1.5)
        return s * Math.sin(Math.PI * (r - 2));
    return -s * Math.sin(Math.PI * (r - 1));
}
/**
 * Gamma function for x > 33. Gamma(x) = Gamma(n + 1) = sqrt(2 pi n) (n/e)^n exp(stirlerr(n)), n = x - 1.
 * The exponent of (n/e)^n = exp(n log n - n) is in the hundreds, so it is assembled in double-double.
 * Replaces xsf's Stirling approximation (polynomial STIR), which has a relative error of 7e-14 at x = 170.
 */
function stirf(x) {
    if (x >= MAXGAM)
        return Infinity;
    const n = x - 1;
    const e = ddAdd(ddMulNum(ddLog([n, 0]), n), [-n + stirlerrForGamma(n), 0]);
    return Math.sqrt(2 * Math.PI * n) * Math.exp(e[0]) * (1 + e[1]);
}
function stirfXsf(x) {
    if (x >= MAXGAM)
        return Infinity;
    let w = 1 / x;
    w = 1 + w * polevl(w, GAMMA_STIR);
    let y = Math.exp(x);
    if (x > MAXSTIR) {
        /* Avoid overflow in pow() */
        const v = Math.pow(x, 0.5 * x - 0.25);
        y = v * (v / y);
    }
    else {
        y = Math.pow(x, x - 0.5) / y;
    }
    return SQRT2PI * y * w;
}
/**
 * Gamma function. Equivalent to R's `gamma(x)` for a single number.
 *
 * @param x - Argument.
 * @returns Gamma(x). `NaN` at zero and negative integers; `Infinity` on overflow.
 */
export function gamma(x) {
    if (!Number.isFinite(x))
        return x > 0 ? x : NaN;
    if (x === 0)
        return NaN; // NaN at 0, as in R (xsf gives ±Inf)
    const q = Math.abs(x);
    if (q > 33) {
        if (x < 0) {
            let p = Math.floor(q);
            if (p === q)
                return NaN; // negative integers are poles
            const sgngam = p % 2 === 0 ? -1 : 1;
            let z = q - p;
            if (z > 0.5) {
                p += 1;
                z = q - p;
            }
            z = q * sinpi(z);
            if (z === 0)
                return sgngam * Infinity;
            return (sgngam * Math.PI) / (Math.abs(z) * stirf(q));
        }
        return stirf(x);
    }
    let z = 1;
    while (x >= 3) {
        x -= 1;
        z *= x;
    }
    while (x < 0) {
        if (x > -1e-9)
            return small(x, z);
        z /= x;
        x += 1;
    }
    while (x < 2) {
        if (x < 1e-9)
            return small(x, z);
        z /= x;
        x += 1;
    }
    if (x === 2)
        return z;
    x -= 2;
    return (z * polevl(x, GAMMA_P)) / polevl(x, GAMMA_Q);
}
function small(x, z) {
    if (x === 0)
        return NaN; // the original argument was a negative integer
    return z / ((1 + EULER * x) * x);
}
/* A: Stirling's formula expansion of log Gamma; B, C: log Gamma between 2 and 3 */
const GAMMA_A = [
    8.11614167470508450300e-4, -5.95061904284301438324e-4, 7.93650340457716943945e-4,
    -2.77777777730099687205e-3, 8.33333333333331927722e-2,
];
const GAMMA_B = [
    -1.37825152569120859100e3, -3.88016315134637840924e4, -3.31612992738871184744e5,
    -1.16237097492762307383e6, -1.72173700820839662146e6, -8.53555664245765465627e5,
];
const GAMMA_C = [
    -3.51815701436523470549e2, -1.70642106651881159223e4, -2.20528590553854454839e5,
    -1.13933444367982507207e6, -2.53252307177582951285e6, -2.01889141433532773231e6,
];
const MAXLGM = 2.556348e305;
function lgamLargeX(x) {
    const q = (x - 0.5) * Math.log(x) - x + LS2PI;
    if (x > 1.0e8)
        return q;
    const p = 1 / (x * x);
    return q + ((7.9365079365079365079365e-4 * p - 2.7777777777777777777778e-3) * p + 0.0833333333333333333333) / x;
}
/** log|Gamma(x)| and the sign of the gamma function. */
export function lgammaSign(x) {
    if (!Number.isFinite(x))
        return { value: x === -Infinity ? Infinity : x, sign: 1 };
    if (x < -34) {
        const q = -x;
        const w = lgammaSign(q).value;
        let p = Math.floor(q);
        if (p === q)
            return { value: Infinity, sign: 1 };
        const sign = p % 2 === 0 ? -1 : 1;
        let z = q - p;
        if (z > 0.5) {
            p += 1;
            z = p - q;
        }
        z = q * sinpi(z);
        if (z === 0)
            return { value: Infinity, sign: 1 };
        return { value: LOGPI - Math.log(z) - w, sign };
    }
    if (x < 13) {
        let z = 1;
        let p = 0;
        let u = x;
        while (u >= 3) {
            p -= 1;
            u = x + p;
            z *= u;
        }
        while (u < 2) {
            if (u === 0)
                return { value: Infinity, sign: 1 };
            z /= u;
            p += 1;
            u = x + p;
        }
        let sign = 1;
        if (z < 0) {
            sign = -1;
            z = -z;
        }
        if (u === 2)
            return { value: Math.log(z), sign };
        p -= 2;
        const xx = x + p;
        return { value: Math.log(z) + (xx * polevl(xx, GAMMA_B)) / p1evl(xx, GAMMA_C), sign };
    }
    if (x > MAXLGM)
        return { value: Infinity, sign: 1 };
    if (x >= 1000)
        return { value: lgamLargeX(x), sign: 1 };
    const q = (x - 0.5) * Math.log(x) - x + LS2PI;
    const p = 1 / (x * x);
    return { value: q + polevl(p, GAMMA_A) / x, sign: 1 };
}
/**
 * Natural logarithm of the absolute value of the gamma function, log|Gamma(x)|.
 * Equivalent to R's `lgamma(x)` for a single number.
 *
 * Near the zeros x = 1 and x = 2 the result keeps full relative accuracy
 * (computed as lgamma(1 + e) = lgamma1p(e) and lgamma(2 + e) = lgamma1p(e) + log1p(e)).
 *
 * @param x - Argument.
 * @returns log|Gamma(x)|.
 */
export function lgamma(x) {
    if (Math.abs(x - 1) <= 0.2)
        return lgamma1p(x - 1);
    if (Math.abs(x - 2) <= 0.2)
        return lgamma1p(x - 2) + Math.log1p(x - 2);
    return lgammaSign(x).value;
}
/* zeta(n) for n = 2..41 (coefficients of the Taylor expansion in lgam1p) */
const ZETA = [
    1.6449340668482264, 1.2020569031595942, 1.0823232337111381, 1.03692775514337,
    1.0173430619844492, 1.0083492773819229, 1.0040773561979444, 1.0020083928260821,
    1.000994575127818, 1.0004941886041194, 1.000246086553308, 1.0001227133475785,
    1.0000612481350588, 1.000030588236307, 1.0000152822594086, 1.0000076371976379,
    1.000003817293265, 1.0000019082127165, 1.0000009539620338, 1.0000004769329869,
    1.0000002384505027, 1.0000001192199259, 1.0000000596081891, 1.0000000298035034,
    1.0000000149015549, 1.0000000074507118, 1.000000003725334, 1.0000000018626598,
    1.0000000009313275, 1.0000000004656628, 1.0000000002328311, 1.0000000001164155,
    1.0000000000582077, 1.0000000000291038, 1.0000000000145519, 1.000000000007276,
    1.000000000003638, 1.000000000001819, 1.0000000000009095, 1.0000000000004547,
];
/** lgamma(1 + x) by the Taylor expansion around x = 0 */
function lgam1pTaylor(x) {
    if (x === 0)
        return 0;
    let res = -EULER * x;
    let xfac = -x;
    for (let n = 2; n < 42; n++) {
        xfac *= -x;
        const coeff = (ZETA[n - 2] * xfac) / n;
        res += coeff;
        if (Math.abs(coeff) < MACHEP * Math.abs(res))
            break;
    }
    return res;
}
/**
 * lgamma(1 + x). Keeps relative accuracy even near x = 0 and 1.
 * xsf uses the Taylor expansion for |x| <= 0.5, but the expansion is truncated at 42 terms and leaves an error of
 * about 1e-14 near |x| = 0.5 (measured at x = 0.5). Here the expansion is limited to |x| <= 0.2 and lgamma is used
 * outside (for 0.2 < |x|, lgamma(1 + x) is far enough from 0 that relative accuracy is not an issue).
 */
export function lgamma1p(x) {
    if (Math.abs(x) <= 0.2)
        return lgam1pTaylor(x);
    if (Math.abs(x - 1) <= 0.2)
        return Math.log(x) + lgam1pTaylor(x - 1);
    return lgamma(x + 1);
}
/* Stirling series coefficients (for stirlerr; same values as loader.ts, duplicated here to avoid a circular import) */
const SG = [1 / 12, -1 / 360, 1 / 1260, -1 / 1680, 1 / 1188, -691 / 360360, 1 / 156];
/** stirlerr(n) (used for n > 32; Stirling series) */
function stirlerrForGamma(n) {
    const nn = 1 / (n * n);
    let sum = 0;
    let pw = 1 / n;
    for (const c of SG) {
        sum += c * pw;
        pw *= nn;
    }
    return sum;
}
