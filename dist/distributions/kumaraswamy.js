// Kumaraswamy distribution dkumar / pkumar / qkumar (extraDistr's names).
//
// Written for rStats.js (no ported code). On [0, 1] with shapes a, b > 0:
//   f(x) = a b x^(a-1) (1 - x^a)^(b-1),   P[X > x] = (1 - x^a)^b,   q(p) = (1 - (1 - p)^(1/b))^(1/a)
// 1 - x^a is formed as -expm1(a log x) when x^a is near 1, and the tails as exp / -expm1 of b log(1 - x^a).
import { vectorize } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries } from "../internal/dpq.js";
import { log1mExp } from "../internal/ddexp.js";
const valid = (a, b) => a > 0 && b > 0 && Number.isFinite(b);
// a = Inf is taken as the limit (the distribution concentrates at 1), as extraDistr does
/** log(1 - x^a) for 0 <= x <= 1 */
function log1mPow(x, a) {
    const xa = Math.pow(x, a);
    return xa < 0.5 ? Math.log1p(-xa) : Math.log(-Math.expm1(a * Math.log(x)));
}
/** (1 - x^a)^e for 0 < x < 1: pow of 1 - x^a with the rounding of the subtraction corrected to first order */
function powOneMinus(x, a, e) {
    const xa = Math.pow(x, a);
    if (xa >= 0.5)
        return Math.pow(-Math.expm1(a * Math.log(x)), e);
    const hi = 1 - xa;
    const lo = 1 - hi - xa; // exact remainder (Fast2Sum)
    return Math.pow(hi, e) * (1 + (e * lo) / hi);
}
/** c log(v), 0 when c is 0 */
const xlog = (c, v) => (c === 0 ? 0 : c * Math.log(v));
export function dkumar1(x, a, b, log) {
    if (Number.isNaN(x) || !valid(a, b))
        return NaN;
    if (x < 0 || x > 1)
        return d0(log);
    if (a === Infinity)
        return x === 1 ? Infinity : d0(log);
    const l1 = x === 1 ? -Infinity : log1mPow(x, a);
    const ld = Math.log(a) + Math.log(b) + xlog(a - 1, x) + (b === 1 ? 0 : (b - 1) * l1);
    if (log)
        return ld;
    // the product keeps the relative accuracy that exp(ld) loses for large |ld|; exp(ld) where it under- or overflows
    // x^(a-1) as x^a / x (a - 1 itself may round, which x^(a-1) magnifies by |log x|)
    const xa = Math.pow(x, a);
    const d = a * b * (a === 1 ? 1 : xa > 1e-290 ? xa / x : Math.pow(x, a - 1)) * (b === 1 || x === 0 ? 1 : powOneMinus(x, a, b - 1));
    return d > 2.2250738585072014e-308 && d < Infinity ? d : Math.exp(ld);
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
    const lu = b * log1mPow(q, a); // log P[X > q]
    if (!lowerTail)
        return logP ? lu : powOneMinus(q, a, b);
    if (!logP)
        return -Math.expm1(lu);
    // for tiny x^a, P[X <= q] = b x^a (1 + O(b x^a)) whose log survives where 1 - exp(lu) underflows
    const xa = Math.pow(q, a);
    if (xa < 1e-20)
        return Math.log(b) + a * Math.log(q) + Math.log1p((-(b - 1) * xa) / 2);
    return lu < -Math.LN2 ? Math.log1p(-powOneMinus(q, a, b)) : log1mExp(lu);
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
    return Math.pow(-Math.expm1(lu / b), 1 / a);
}
/**
 * Density of the Kumaraswamy distribution. Equivalent to `extraDistr::dkumar(x, a, b, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param a - First shape parameter.
 * @param b - Second shape parameter.
 */
export function dkumar(x, a, b, options = {}) {
    const { log = false } = options;
    return vectorize(x, (v) => dkumar1(v, a, b, log));
}
/** Distribution function of the Kumaraswamy distribution. Equivalent to `extraDistr::pkumar(q, a, b, lower.tail, log.p)`. */
export function pkumar(q, a, b, options = {}) {
    const { lowerTail = true, logP = false } = options;
    return vectorize(q, (v) => pkumar1(v, a, b, lowerTail, logP));
}
/** Quantile function of the Kumaraswamy distribution. Equivalent to `extraDistr::qkumar(p, a, b, lower.tail, log.p)`. */
export function qkumar(p, a, b, options = {}) {
    const { lowerTail = true, logP = false } = options;
    return vectorize(p, (v) => qkumar1(v, a, b, lowerTail, logP));
}
