// Arcsine distribution darcsine / parcsine / qarcsine on (a, b): the beta(1/2, 1/2) distribution moved to (a, b).
//
// Written for rStats.js (no ported code). With z = (x - a) / (b - a): f(x) = dbeta(z, 1/2, 1/2) / (b - a)
// = 1 / (pi sqrt((x - a)(b - x))), P[X <= x] = pbeta(z, 1/2, 1/2) = (2/pi) asin(sqrt(z)), and
// q(p) = a + (b - a) qbeta(p, 1/2, 1/2).
// Near b, 1 - z would cancel once z is rounded, so the density takes x - a and b - x directly, and in the upper half
// the distribution function and the quantile use the mirrored variable (b - x) / (b - a) with the tails swapped
// (the beta(1/2, 1/2) distribution is symmetric).
import { vectorize } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries } from "../internal/dpq.js";
import { ddAdd, ddLog, twoSum } from "../special/dd.js";
import { pbeta1, qbeta1 } from "./beta.js";
const valid = (a, b) => Number.isFinite(a) && Number.isFinite(b) && a < b;
export function darcsine1(x, a, b, log) {
    if (Number.isNaN(x) || !valid(a, b))
        return NaN;
    if (x < a || x > b)
        return d0(log);
    if (x === a || x === b)
        return Infinity;
    if (!log)
        return 1 / (Math.PI * Math.sqrt(x - a) * Math.sqrt(b - x)); // sqrt of each: the product can over- or underflow
    // -log(pi) - (log(x - a) + log(b - x)) / 2 in double-double from the exact differences (the log of a density near 1
    // would turn its rounding into a large relative error)
    const l = ddAdd(ddLog(twoSum(x, -a)), ddLog(twoSum(b, -x)));
    return -LOGPI_DD[0] - 0.5 * l[0] - (LOGPI_DD[1] + 0.5 * l[1]);
}
const LOGPI_DD = [1.1447298858494002, 1.0265951162707826e-17];
export function parcsine1(q, a, b, lowerTail, logP) {
    if (Number.isNaN(q) || !valid(a, b))
        return NaN;
    if (q <= a)
        return dt0(lowerTail, logP);
    if (q >= b)
        return dt1(lowerTail, logP);
    const w = b - a;
    if (q - a <= b - q)
        return pbeta1((q - a) / w, 0.5, 0.5, lowerTail, logP);
    return pbeta1((b - q) / w, 0.5, 0.5, !lowerTail, logP);
}
export function qarcsine1(p, a, b, lowerTail, logP) {
    if (Number.isNaN(p) || !valid(a, b))
        return NaN;
    const bd = quantileBoundaries(p, a, b, lowerTail, logP);
    if (bd !== undefined)
        return bd;
    const z = qbeta1(p, 0.5, 0.5, lowerTail, logP);
    if (z <= 0.5)
        return a + (b - a) * z;
    // upper half: from b, with the mirrored probability (z near 1 has lost the digits of 1 - z)
    return b - (b - a) * qbeta1(p, 0.5, 0.5, !lowerTail, logP);
}
/**
 * Density of the arcsine distribution on (a, b), f(x) = 1 / (pi sqrt((x - a)(b - x))). R has no arcsine
 * distribution; this equals `dbeta((x - a) / (b - a), 0.5, 0.5) / (b - a)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `a` and `b` (see {@link ArcsineParams}) and `log` (see {@link DensityOptions}).
 */
export function darcsine(x, options = {}) {
    const { a = 0, b = 1, log = false } = options;
    return vectorize(x, (v) => darcsine1(v, a, b, log));
}
/** Distribution function of the arcsine distribution on (a, b): `pbeta((q - a) / (b - a), 0.5, 0.5)`. */
export function parcsine(q, options = {}) {
    const { a = 0, b = 1, lowerTail = true, logP = false } = options;
    return vectorize(q, (v) => parcsine1(v, a, b, lowerTail, logP));
}
/** Quantile function of the arcsine distribution on (a, b): `a + (b - a) qbeta(p, 0.5, 0.5)`. */
export function qarcsine(p, options = {}) {
    const { a = 0, b = 1, lowerTail = true, logP = false } = options;
    return vectorize(p, (v) => qarcsine1(v, a, b, lowerTail, logP));
}
