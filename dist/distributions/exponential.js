// Exponential distribution dexp / pexp / qexp.
//
// f(x) = rate exp(-rate x), P[X > x] = exp(-rate x). rate x is formed in double-double
// (the relative error of exp(-t) equals the absolute error of t, and at t = 700 the rounding of the product alone gives 6e-14).
// Argument handling (rate = 0, Inf) is matched to R's output.
import { vectorize } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries } from "../internal/dpq.js";
import { ddExp, expNeg, log1mExp, logOneMinusExpNeg, mulDD } from "../internal/ddexp.js";
import { ddLog, ddSub } from "../special/dd.js";
const MIN_NORMAL = 2 ** -1022;
export function dexp1(x, rate, log) {
    if (Number.isNaN(x) || Number.isNaN(rate))
        return NaN;
    if (rate < 0 || rate === Infinity)
        return NaN;
    if (x < 0)
        return d0(log);
    const t = mulDD(rate, x);
    if (Number.isNaN(t[0]))
        return NaN;
    if (log)
        return Math.log(rate) - t[0] - t[1];
    const e = expNeg(t);
    // exp(-rate x) subnormal while a large rate brings the density back: from the log in double-double (it had lost
    // digits: dexp(2.5e-294, 3e296) was 8e-8 off)
    if (e < MIN_NORMAL && rate > 1 && t[0] < 1500) {
        const l = ddSub(ddLog([rate, 0]), t);
        return l[0] < -746 ? 0 : ddExp(l)[0];
    }
    return rate * e;
}
/** Log or linear value of P[X > x], according to the tail direction */
function expTail(t, lowerTail, logP) {
    if (!lowerTail)
        return logP ? -t[0] - t[1] : expNeg(t);
    // Lower tail 1 - exp(-t)
    const s = t[0] + t[1];
    return logP ? logOneMinusExpNeg(t) : -Math.expm1(-s);
}
export function pexp1(q, rate, lowerTail, logP) {
    if (Number.isNaN(q) || Number.isNaN(rate))
        return NaN;
    if (rate < 0)
        return NaN;
    if (q <= 0)
        return dt0(lowerTail, logP);
    const t = mulDD(rate, q);
    if (Number.isNaN(t[0]))
        return NaN;
    if (t[0] === Infinity)
        return dt1(lowerTail, logP);
    return expTail(t, lowerTail, logP);
}
export function qexp1(p, rate, lowerTail, logP) {
    if (Number.isNaN(p) || Number.isNaN(rate))
        return NaN;
    if (rate < 0)
        return NaN;
    const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
    if (Number.isNaN(b) || b === 0)
        return b;
    // Log of the upper probability, log P[X > x] = -rate x
    let lu;
    if (logP)
        lu = lowerTail ? log1mExp(p) : p;
    else
        lu = lowerTail ? Math.log1p(-p) : Math.log(p);
    return -lu / rate;
}
/**
 * Density of the exponential distribution. Equivalent to R's `dexp(x, rate = 1, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `rate` (see {@link ExponentialParams}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * dexp(1);              // 0.36787944117144233
 * dexp(1, { rate: 2 }); // 0.2706705664732254
 * ```
 *
 * @category Distributions
 */
export function dexp(x, options = {}) {
    const { rate = 1, log = false } = options;
    return vectorize(x, (v) => dexp1(v, rate, log));
}
/**
 * Distribution function of the exponential distribution. Equivalent to R's `pexp(q, rate = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `rate` (see {@link ExponentialParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pexp(1);                                  // 0.6321205588285577
 * pexp(1, { rate: 2, lowerTail: false });   // 0.1353352832366127
 * ```
 *
 * @category Distributions
 */
export function pexp(q, options = {}) {
    const { rate = 1, lowerTail = true, logP = false } = options;
    return vectorize(q, (v) => pexp1(v, rate, lowerTail, logP));
}
/**
 * Quantile function of the exponential distribution. Equivalent to R's `qexp(p, rate = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `rate` (see {@link ExponentialParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qexp(0.5, { rate: 2 });      // 0.34657359027997264
 * qexp([0.25, 0.75]);          // [0.2876820724517809, 1.3862943611198906]
 * ```
 *
 * @category Distributions
 */
export function qexp(p, options = {}) {
    const { rate = 1, lowerTail = true, logP = false } = options;
    return vectorize(p, (v) => qexp1(v, rate, lowerTail, logP));
}
