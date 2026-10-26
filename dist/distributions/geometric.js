// Geometric distribution dgeom / pgeom / qgeom.
//
// P[X = x] = p q^x, P[X > x] = q^(x+1) (q = 1 - p). q^n is computed with Loader's (2000) building blocks
// (dbinomRawDD in src/special/loader.ts, as the binomial probability of 0 successes and n failures)
// (the exponent is kept in double-double so that the rounding of n log q is not amplified n times).
// Quantiles use a closed form.
import { vectorize } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries } from "../internal/dpq.js";
import { log1mExp } from "../internal/ddexp.js";
import { nonInt } from "../internal/integer.js";
import { dbinomRawDD } from "../special/loader.js";
import { twoSum } from "../special/dd.js";
/** p and q = 1 - p in double-double (the smaller one is the exact base) */
export function probPair(prob) {
    return prob <= 0.5
        ? { pd: [prob, 0], qd: twoSum(1, -prob) }
        : { pd: twoSum(1, -(1 - prob)), qd: [1 - prob, 0] };
}
function badProb(prob) {
    return !(prob > 0) || prob > 1;
}
export function dgeom1(x, prob, log) {
    if (Number.isNaN(x) || Number.isNaN(prob))
        return NaN;
    if (badProb(prob))
        return NaN;
    if (nonInt(x) || x < 0 || !Number.isFinite(x))
        return d0(log);
    const n = Math.round(x);
    const { pd, qd } = probPair(prob);
    // q^n
    const qn = dbinomRawDD(0, n, pd, qd, log);
    return log ? Math.log(prob) + qn : prob * qn;
}
/** P[X > x] = q^(x+1) (x a nonnegative integer) */
function upper(x, prob, log) {
    const { pd, qd } = probPair(prob);
    return dbinomRawDD(0, x + 1, pd, qd, log);
}
function pgeomRaw(x, prob, lowerTail, logP) {
    if (!lowerTail)
        return upper(x, prob, logP);
    const lu = upper(x, prob, true);
    if (!logP)
        return -Math.expm1(lu);
    // When the upper tail is small, use log1p of the linear value (whose exponent was computed in double-double)
    return lu < -Math.LN2 ? Math.log1p(-upper(x, prob, false)) : Math.log(-Math.expm1(lu));
}
export function pgeom1(q, prob, lowerTail, logP) {
    if (Number.isNaN(q) || Number.isNaN(prob))
        return NaN;
    if (badProb(prob))
        return NaN;
    if (q < 0)
        return dt0(lowerTail, logP);
    if (!Number.isFinite(q) || prob === 1)
        return dt1(lowerTail, logP);
    return pgeomRaw(Math.floor(q + 1e-7), prob, lowerTail, logP);
}
export function qgeom1(p, prob, lowerTail, logP) {
    if (Number.isNaN(p) || Number.isNaN(prob))
        return NaN;
    if (badProb(prob))
        return NaN;
    const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
    if (Number.isNaN(b))
        return NaN;
    if (prob === 1)
        return 0;
    if (b !== undefined)
        return b;
    // Smallest integer y with P[X > y] = q^(y+1) <= (upper probability), solved in closed form
    // (matches R's output. The distribution function is flat, so in an integer search the probability slack would move the answer a lot)
    let lu;
    if (logP)
        lu = lowerTail ? log1mExp(p) : p;
    else
        lu = lowerTail ? Math.log1p(-p) : Math.log(p);
    return Math.max(0, Math.ceil(lu / Math.log1p(-prob) - 1 - 1e-12));
}
/**
 * Probability mass function of the geometric distribution (number of failures before the first success). Equivalent to R's `dgeom(x, prob, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param prob - Probability of success on each trial.
 * @param options - `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 */
export function dgeom(x, prob, options = {}) {
    const log = options.log ?? false;
    return vectorize(x, (v) => dgeom1(v, prob, log));
}
/**
 * Distribution function of the geometric distribution (number of failures before the first success). Equivalent to R's `pgeom(q, prob, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param prob - Probability of success on each trial.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 */
export function pgeom(q, prob, options = {}) {
    const { lowerTail = true, logP = false } = options;
    return vectorize(q, (v) => pgeom1(v, prob, lowerTail, logP));
}
/**
 * Quantile function of the geometric distribution (number of failures before the first success). Equivalent to R's `qgeom(p, prob, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param prob - Probability of success on each trial.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 */
export function qgeom(p, prob, options = {}) {
    const { lowerTail = true, logP = false } = options;
    return vectorize(p, (v) => qgeom1(v, prob, lowerTail, logP));
}
