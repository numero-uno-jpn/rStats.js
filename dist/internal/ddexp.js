// Double-double building blocks for location-scale distributions (logistic, Cauchy, Weibull, etc.).
//
// The relative error of exp(-t) equals the absolute error of t. At t = 700 the rounding of t (0.5 ulp ≈ 6e-14)
// becomes the relative error of the probability directly, so the parts that build t are computed in double-double.
// The method is the standard argument reduction (x = n log 2 + r, Taylor series on r scaled by 2^-10, then repeated squaring).
import { ddAdd, ddLog, ddMul, ddMulNum, ddSub, isDoubleDouble, twoProd, twoSum } from "../special/dd.js";
const LN2 = [0.6931471805599453, 2.3190468138462996e-17];
/** exp(x) as double-double. If the result is subnormal or overflows, only the double value */
export function ddExp(x) {
    const hi = x[0];
    if (!isDoubleDouble())
        return [Math.exp(hi), 0];
    if (Number.isNaN(hi))
        return [NaN, 0];
    if (hi > 709.8)
        return [Infinity, 0];
    if (hi < -708)
        return [Math.exp(hi) * (1 + x[1]), 0];
    const n = Math.round(hi / LN2[0]);
    // r = x - n log 2 (|r| <= 0.35)
    let r = ddSub(x, ddMulNum(LN2, n));
    const K = 1024;
    r = [r[0] / K, r[1] / K];
    // expm1(r) = r + r^2/2! + ... (|r| < 3.5e-4, so 10 terms get below 1e-40)
    let term = r;
    let sum = r;
    for (let k = 2; k < 20; k++) {
        term = ddMul(term, r);
        term = [term[0] / k, term[1] / k];
        sum = ddAdd(sum, term);
        if (Math.abs(term[0]) < 1e-36)
            break;
    }
    // (1 + e)^2 - 1 = e (2 + e), applied 10 times (K = 2^10)
    for (let i = 0; i < 10; i++)
        sum = ddMul(sum, ddAdd(sum, [2, 0]));
    const s = ddAdd(sum, [1, 0]);
    // Multiply by 2^n (n in -1022..1024; split into two steps to avoid overflow)
    const h = Math.trunc(n / 2);
    const f1 = 2 ** h;
    const f2 = 2 ** (n - h);
    return [s[0] * f1 * f2, s[1] * f1 * f2];
}
/**
 * (x - location) / scale as double-double,
 * without the rounding of the subtraction and division (it gets amplified in distributions that use the standardised value in an exponent).
 * If the result is not finite, only the double value.
 */
export function standardizeDD(x, location, scale) {
    const diff = x - location;
    if (!Number.isFinite(diff))
        return [diff / scale, 0];
    const d = location === 0 ? [x, 0] : twoSum(x, -location);
    if (scale === 1)
        return d;
    const q1 = d[0] / scale;
    if (!Number.isFinite(q1) || q1 === 0)
        return [q1, 0];
    return divideTail(d, scale, q1);
}
/** d / scale as double-double from its rounded value q1: the remainder d - q1 scale gives the second term */
function divideTail(d, scale, q1) {
    if (Math.abs(d[0]) < 2 ** -900) {
        // Near the subnormal range the error term of q1 scale underflows (the low part of x / scale was 4.8e-10 relative
        // off at x = 1.3e-314): everything times 2^600 (exact) and back
        const f = 2 ** 600;
        const r = divideTail([d[0] * f, d[1] * f], scale, q1 * f);
        return [r[0] / f, r[1] / f];
    }
    const st = mulDD(scale, q1);
    if (!Number.isFinite(st[0])) {
        // Near the largest double q1 scale can round up to Infinity (the remainder was then NaN): divide d 2^-40 instead
        // (exact, and small enough for mulDD's exact product) and scale back
        const f = 2 ** -40;
        const r = divideTail([d[0] * f, d[1] * f], scale, q1 * f);
        return [r[0] / f, r[1] / f];
    }
    const rem = ddSub(d, st);
    const q2 = (rem[0] + rem[1]) / scale;
    return twoSum(q1, q2);
}
/**
 * log(a / b) as double-double for positive finite a and b: log a - log b, which keeps its digits where a / b is
 * subnormal, 0 or overflows (the log of a subnormal ratio has lost them in the division)
 */
export function logRatioDD(a, b) {
    return ddSub(ddLog([a, 0]), ddLog([b, 0]));
}
/** a b as double-double. Only the double product when Veltkamp splitting would overflow (above 1e300) or for non-finite values */
export function mulDD(a, b) {
    const p = a * b;
    if (!Number.isFinite(p) || Math.abs(a) > 1e300 || Math.abs(b) > 1e300)
        return [p, 0];
    return twoProd(a, b);
}
/** exp(-t) (t is double-double). The low-order part of t enters to first order */
export function expNeg(t) {
    if (t[0] > 708) {
        // Near the subnormal range: do all rounding in one final step
        return Math.exp(700 - t[0]) * (1 - t[1]) * Math.exp(-700);
    }
    return Math.exp(-t[0]) * (1 - t[1]);
}
/** log(1 - exp(x)) (x <= 0). Switches method by the size of x to avoid cancellation */
export function log1mExp(x) {
    return x > -Math.LN2 ? Math.log(-Math.expm1(x)) : Math.log1p(-Math.exp(x));
}
/** Log of the lower probability 1 - exp(-t) (t double-double, t > 0). For large t, exp(-t) includes the low-order part of t */
export function logOneMinusExpNeg(t) {
    return t[0] > Math.LN2 ? Math.log1p(-expNeg(t)) : Math.log(-Math.expm1(-(t[0] + t[1])));
}
/** location + scale t with a single rounding (the rounding of scale t would show up in the subtraction with location) */
export function locationScale(location, scale, t) {
    const st = mulDD(scale, t);
    if (!Number.isFinite(st[0]) || !Number.isFinite(location))
        return location + st[0];
    const r = ddAdd(st, [location, 0]);
    return r[0] + r[1];
}
