// Kumaraswamy distribution dkumar / pkumar / qkumar (extraDistr's names).
//
// Written for rStats.js (no ported code). On [0, 1] with shapes a, b > 0:
//   f(x) = a b x^(a-1) (1 - x^a)^(b-1),   P[X > x] = (1 - x^a)^b,   q(p) = (1 - (1 - p)^(1/b))^(1/a)
// 1 - x^a is formed as -expm1(a log x) when x^a is near 1, and the tails as exp / -expm1 of b log(1 - x^a).
import { vectorize } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries } from "../internal/dpq.js";
import { ddExp, log1mExp } from "../internal/ddexp.js";
import { ddAdd, ddLog, ddMul, ddSub, twoProd, twoSum } from "../special/dd.js";
const valid = (a, b) => a > 0 && b > 0 && Number.isFinite(b);
// a = Inf is taken as the limit (the distribution concentrates at 1), as extraDistr does
const MIN_NORMAL = 2.2250738585072014e-308;
/**
 * c log(1 - x^a) for 0 < x < 1 where x^a is subnormal: -c x^a (to double precision) from logs, since x^a itself has
 * lost digits
 */
const scaledTinyPow = (x, a, c) => -Math.sign(c) * Math.exp(Math.log(Math.abs(c)) + a * Math.log(x));
/**
 * Whether a log x (x near 1, a tiny) is subnormal or 0 although 1 - x^a > 0: -expm1 of it has lost digits
 * (dkumar(1 - 1.1e-16, 2.6e-300, 0.29) was 6e-8 off). 1 - x^a = -a log x to double precision there, taken from the
 * factors
 */
const subnormalALogX = (x, a) => x < 1 && -(a * Math.log(x)) < MIN_NORMAL;
/** log(1 - x^a) for 0 <= x <= 1 */
function log1mPow(x, a) {
    const xa = Math.pow(x, a);
    if (xa < 0.5)
        return Math.log1p(-xa);
    return subnormalALogX(x, a) ? Math.log(a) + Math.log(-Math.log(x)) : Math.log(-Math.expm1(a * Math.log(x)));
}
/**
 * (1 - x^a)^e for 0 < x < 1: pow of 1 - x^a with the rounding of the subtraction corrected to first order. Where the
 * correction is not small (e above about 1e8 magnifies the rounding of 1 - x^a), exp(e log1p(-x^a)) instead
 */
function powOneMinus(x, a, e) {
    const xa = Math.pow(x, a);
    if (xa >= 0.5) {
        if (!subnormalALogX(x, a))
            return Math.pow(-Math.expm1(a * Math.log(x)), e);
        // (-a log x)^e = ((a 2^600) (-log x))^e 2^(-600 e), the base made normal by an exact scaling; from the logs where a
        // factor leaves the range
        const v = Math.pow(a * 2 ** 600 * -Math.log(x), e) * Math.pow(2, -600 * e);
        return v >= MIN_NORMAL && v < Infinity ? v : Math.exp(e * (Math.log(a) + Math.log(-Math.log(x))));
    }
    const hi = 1 - xa;
    const lo = 1 - hi - xa; // exact remainder (Fast2Sum)
    const c = (e * lo) / hi;
    return Math.abs(c) < 1e-8 ? Math.pow(hi, e) * (1 + c) : Math.exp(e * Math.log1p(-xa));
}
/** c log(v), 0 when c is 0 */
const xlog = (c, v) => (c === 0 ? 0 : c * Math.log(v));
/**
 * log a + log b + (a - 1) log x + (b - 1) log(1 - x^a), given lb = the last term in double. The terms can be hundreds
 * that cancel to a log density near 0, where their roundings would show (1.6e-13 at dkumar(0.305, 486, 3.8e247)), so
 * they are summed in double-double, with a - 1 and b - 1 exact and log(1 - x^a) from x^a = exp(a log x) in
 * double-double where x^a > 1e-10 (below, log1p(-x^a) in double is accurate to its last bit). lb is used as is for
 * x = 0 or 1, a subnormal x^a, and shapes beyond the range of Veltkamp splitting
 */
function logDensity(x, a, b, lb, xa) {
    if (x === 0 || !(a < 1e300) || !(b < 1e300))
        return Math.log(a) + Math.log(b) + xlog(a - 1, x) + lb;
    const lx = ddLog([x, 0]);
    let s = ddAdd(ddLog([a, 0]), ddLog([b, 0]));
    if (a !== 1)
        s = ddAdd(s, ddMul(lx, twoSum(a, -1)));
    if (b === 1 || x === 1 || xa < MIN_NORMAL) {
        if (!Number.isFinite(lb))
            return s[0] + lb;
        const t = ddAdd(s, [lb, 0]);
        return t[0] + t[1];
    }
    // (log a + log(-log x) where a log x is subnormal, see subnormalALogX)
    const l1 = xa <= 1e-10
        ? [Math.log1p(-xa), 0]
        : subnormalALogX(x, a)
            ? ddAdd(ddLog([a, 0]), ddLog([-lx[0], -lx[1]]))
            : ddLog(ddSub([1, 0], ddExp(ddMul(lx, [a, 0]))));
    const t = ddAdd(s, ddMul(l1, twoSum(b, -1)));
    return t[0] + t[1];
}
export function dkumar1(x, a, b, log) {
    if (Number.isNaN(x) || !valid(a, b))
        return NaN;
    if (x < 0 || x > 1)
        return d0(log);
    if (a === Infinity)
        return x === 1 ? Infinity : d0(log);
    const xa = Math.pow(x, a);
    const tiny = x > 0 && xa < MIN_NORMAL;
    const l1 = x === 1 ? -Infinity : log1mPow(x, a);
    // (b - 1) log(1 - x^a)
    const lb = b === 1 ? 0 : tiny ? scaledTinyPow(x, a, b - 1) : (b - 1) * l1;
    const ld = logDensity(x, a, b, lb, xa);
    if (log)
        return ld;
    // the product keeps the relative accuracy that exp(ld) loses for large |ld|; exp(ld) where it under- or overflows
    // or where x^(a-1) is subnormal (a large b can bring the density back into the normal range)
    // x^(a-1) as x^a / x (a - 1 itself may round, which x^(a-1) magnifies by |log x|)
    const xm = a === 1 ? 1 : xa > 1e-290 ? xa / x : Math.pow(x, a - 1);
    if (x > 0 && xm < MIN_NORMAL)
        return Math.exp(ld);
    // (also where a factor or partial product is below the normal range: a b = 3.3e-315 for tiny shapes, which xm and
    // the power brought back to 1e99 with 6e-10 relative error; the power (1 - x^a)^(b-1) subnormal)
    const ab = a * b;
    const abx = ab * xm;
    const pw = b === 1 || x === 0 ? 1 : tiny ? Math.exp(lb) : powOneMinus(x, a, b - 1);
    const d = abx * pw;
    return ab >= MIN_NORMAL && abx >= MIN_NORMAL && pw >= MIN_NORMAL && d > MIN_NORMAL && d < Infinity ? d : Math.exp(ld);
}
export function pkumar1(q, a, b, lowerTail, logP) {
    if (Number.isNaN(q) || !valid(a, b))
        return NaN;
    if (q <= 0)
        return dt0(lowerTail, logP);
    if (q >= 1)
        return dt1(lowerTail, logP);
    if (a === Infinity)
        return dt0(lowerTail, logP);
    const xa = Math.pow(q, a);
    const tiny = xa < MIN_NORMAL;
    const lu = tiny ? scaledTinyPow(q, a, b) : b * log1mPow(q, a); // log P[X > q]
    if (!lowerTail)
        return logP ? lu : tiny ? Math.exp(lu) : powOneMinus(q, a, b);
    if (!logP)
        return -Math.expm1(lu);
    // for small x^a and b x^a, P[X <= q] = b x^a (1 - (b - 1) x^a / 2 + O(max(1, b)^2 x^2a)) whose log survives where
    // x^a or 1 - exp(lu) underflows; elsewhere the forms below are accurate
    if (Math.max(b, 1) * xa < 1e-10)
        return Math.log(b) + a * Math.log(q) + Math.log1p((-(b - 1) * xa) / 2);
    return lu < -Math.LN2 && !tiny ? Math.log1p(-powOneMinus(q, a, b)) : log1mExp(lu);
}
export function qkumar1(p, a, b, lowerTail, logP) {
    if (Number.isNaN(p) || !valid(a, b))
        return NaN;
    const bd = quantileBoundaries(p, 0, 1, lowerTail, logP);
    if (bd !== undefined)
        return bd;
    if (a === Infinity)
        return 1;
    // log of the upper probability
    const lu = lowerTail ? (logP ? log1mExp(p) : Math.log1p(-p)) : logP ? p : Math.log(p);
    // w^(1 / a) with w = 1 - exp(lu / b). Where lu / b is subnormal or underflows, w = -lu / b, in logs; for w > 1/2
    // log w = log1p(-exp(lu / b)) keeps the digits of 1 - w
    const t = lu / b;
    if (!(t <= -MIN_NORMAL))
        return Math.exp((Math.log(-lu) - Math.log(b)) / a);
    if (t < -Math.LN2)
        return Math.exp(Math.log1p(-Math.exp(t)) / a);
    const w = -Math.expm1(t);
    const r = 1 / a;
    if (!(a < 1e300))
        return Math.pow(w, r);
    // w^r corrected for the rounding of r = 1 / a (exactly 1 / a - r = (1 - a r) / a), which log w magnifies
    const [ar, e] = twoProd(a, r);
    return Math.pow(w, r) * (1 + (Math.log(w) * (1 - ar - e)) / a);
}
/**
 * Density of the Kumaraswamy distribution. Equivalent to `extraDistr::dkumar(x, a, b, log = FALSE)` in R.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param a - First shape parameter.
 * @param b - Second shape parameter.
 *
 * @example
 * ```ts
 * dkumar(0.5, 2, 3);        // 1.6875
 * dkumar([0.25, 0.75], 2, 3); // [1.318359375, 0.861328125]
 * ```
 *
 * @category Distributions
 */
export function dkumar(x, a, b, options = {}) {
    const { log = false } = options;
    return vectorize(x, (v) => dkumar1(v, a, b, log));
}
/**
 * Distribution function of the Kumaraswamy distribution. Equivalent to `extraDistr::pkumar(q, a, b, lower.tail, log.p)` in R.
 *
 * @example
 * ```ts
 * pkumar(0.5, 2, 3);        // 0.578125
 * pkumar(0.5, 2, 3, { lowerTail: false }); // 0.421875
 * ```
 *
 * @category Distributions
 */
export function pkumar(q, a, b, options = {}) {
    const { lowerTail = true, logP = false } = options;
    return vectorize(q, (v) => pkumar1(v, a, b, lowerTail, logP));
}
/**
 * Quantile function of the Kumaraswamy distribution. Equivalent to `extraDistr::qkumar(p, a, b, lower.tail, log.p)` in R.
 *
 * @example
 * ```ts
 * qkumar(0.5, 2, 3);        // 0.4542020189474066
 * qkumar([0.1, 0.9], 2, 3); // [0.18577032969333462, 0.7320116915997463]
 * ```
 *
 * @category Distributions
 */
export function qkumar(p, a, b, options = {}) {
    const { lowerTail = true, logP = false } = options;
    return vectorize(p, (v) => qkumar1(v, a, b, lowerTail, logP));
}
