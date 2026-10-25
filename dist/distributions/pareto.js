// Pareto distribution dpareto / ppareto / qpareto, with extraDistr's parameters (a shape, b scale).
//
// Written for rStats.js (no ported code). For x >= b:
//   f(x) = (a / b) (b / x)^(a+1),   P[X > x] = (b / x)^a,   q(p) = b (1 - p)^(-1/a)
// r = x / b is formed in double-double and the powers taken with pow, whose rounding does not grow with a (the low
// part of r enters to first order).
import { vectorize } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries } from "../internal/dpq.js";
import { log1mExp, standardizeDD } from "../internal/ddexp.js";
const valid = (a, b) => a > 0 && b > 0 && Number.isFinite(b);
// a = Inf is taken as the limit (the distribution concentrates at b), as extraDistr does
export function dpareto1(x, a, b, log) {
    if (Number.isNaN(x) || !valid(a, b))
        return NaN;
    if (x < b || x === Infinity)
        return d0(log);
    if (a === Infinity)
        return x === b ? Infinity : d0(log);
    const [r, rl] = standardizeDD(x, 0, b);
    const e = Number.isFinite(rl) ? rl / r : 0;
    if (log)
        return Math.log(a / b) - (a + 1) * (Math.log(r) + e);
    const d = ((a / b) * Math.pow(r, -a)) / r;
    return d > 0 && d < Infinity ? d * (1 - (a + 1) * e) : Math.exp(Math.log(a / b) - (a + 1) * (Math.log(r) + e));
}
export function ppareto1(q, a, b, lowerTail, logP) {
    if (Number.isNaN(q) || !valid(a, b))
        return NaN;
    if (q <= b)
        return dt0(lowerTail, logP);
    if (q === Infinity || a === Infinity)
        return dt1(lowerTail, logP);
    const [r, rl] = standardizeDD(q, 0, b);
    const e = Number.isFinite(rl) ? rl / r : 0;
    const lu = -a * (Math.log(r) + e); // log P[X > q]
    if (!lowerTail) {
        if (logP)
            return lu;
        const u = Math.pow(r, -a);
        return u > 0 ? u * (1 - a * e) : Math.exp(lu);
    }
    if (!logP)
        return -Math.expm1(lu);
    return lu < -Math.LN2 ? Math.log1p(-Math.pow(r, -a) * (1 - a * e)) : log1mExp(lu);
}
export function qpareto1(p, a, b, lowerTail, logP) {
    if (Number.isNaN(p) || !valid(a, b))
        return NaN;
    const bd = quantileBoundaries(p, b, Infinity, lowerTail, logP);
    if (bd !== undefined)
        return bd;
    if (a === Infinity)
        return b;
    const lu = lowerTail ? (logP ? log1mExp(p) : Math.log1p(-p)) : logP ? p : Math.log(p);
    return b * Math.exp(-lu / a);
}
/**
 * Density of the Pareto distribution. Equivalent to `extraDistr::dpareto(x, a = 1, b = 1, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `a` and `b` (see {@link ParetoParams}) and `log` (see {@link DensityOptions}).
 */
export function dpareto(x, options = {}) {
    const { a = 1, b = 1, log = false } = options;
    return vectorize(x, (v) => dpareto1(v, a, b, log));
}
/** Distribution function of the Pareto distribution. Equivalent to `extraDistr::ppareto(q, a = 1, b = 1, lower.tail, log.p)`. */
export function ppareto(q, options = {}) {
    const { a = 1, b = 1, lowerTail = true, logP = false } = options;
    return vectorize(q, (v) => ppareto1(v, a, b, lowerTail, logP));
}
/** Quantile function of the Pareto distribution. Equivalent to `extraDistr::qpareto(p, a = 1, b = 1, lower.tail, log.p)`. */
export function qpareto(p, options = {}) {
    const { a = 1, b = 1, lowerTail = true, logP = false } = options;
    return vectorize(p, (v) => qpareto1(v, a, b, lowerTail, logP));
}
