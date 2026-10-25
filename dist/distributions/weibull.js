// Weibull distribution dweibull / pweibull / qweibull.
//
// With u = x / scale and t = u^shape, P[X > x] = exp(-t) and
// f(x) = (shape / scale) exp((shape - 1) log u - t).
// t is formed in double-double (the relative error of exp(-t) equals the absolute error of t, and the rounding
// of t^shape is amplified shape times). For infinite parameters the defining formula is evaluated as is, to match
// R's output (where Inf and NaN appear).
import { vectorize } from "../internal/vectorize.js";
import { d0, dt0, quantileBoundaries } from "../internal/dpq.js";
import { ddExp, expNeg, log1mExp, logOneMinusExpNeg, standardizeDD } from "../internal/ddexp.js";
import { ddLog, ddMulNum, ddSub } from "../special/dd.js";
/** 1^y = 1, as with C's pow (JS Math.pow(1, Infinity) is NaN) */
function cpow(a, b) {
    return a === 1 ? 1 : Math.pow(a, b);
}
/** log u (u = x / scale) in double-double. x > 0, finite parameters */
function logU(x, scale) {
    return ddLog(scale === 1 ? [x, 0] : standardizeDD(x, 0, scale));
}
function allFinite(...v) {
    return v.every(Number.isFinite);
}
export function dweibull1(x, shape, scale, log) {
    if (Number.isNaN(x) || Number.isNaN(shape) || Number.isNaN(scale))
        return NaN;
    if (!(shape > 0) || !(scale > 0))
        return NaN;
    if (x < 0 || x === Infinity)
        return d0(log);
    if (x === 0 && shape < 1)
        return Infinity;
    if (!allFinite(shape, scale)) {
        // The defining formula as is
        const t1 = cpow(x / scale, shape - 1);
        const t2 = t1 * (x / scale);
        return log ? -t2 + Math.log((shape * t1) / scale) : (shape * t1 * Math.exp(-t2)) / scale;
    }
    if (x === 0) {
        if (shape > 1)
            return d0(log);
        return log ? -Math.log(scale) : 1 / scale;
    }
    const lu = logU(x, scale);
    const t = ddExp(ddMulNum(lu, shape));
    if (t[0] === Infinity)
        return d0(log);
    // E = (shape - 1) log u - t
    const e = ddSub(shape === 1 ? [0, 0] : ddMulNum(lu, shape - 1), t);
    if (log)
        return Math.log(shape / scale) + e[0] + e[1];
    return (shape / scale) * Math.exp(e[0]) * (1 + e[1]);
}
export function pweibull1(q, shape, scale, lowerTail, logP) {
    if (Number.isNaN(q) || Number.isNaN(shape) || Number.isNaN(scale))
        return NaN;
    if (!(shape > 0) || !(scale > 0))
        return NaN;
    if (q <= 0)
        return dt0(lowerTail, logP);
    let t;
    if (!allFinite(q, shape, scale)) {
        t = [cpow(q / scale, shape), 0];
        if (Number.isNaN(t[0]))
            return NaN;
    }
    else {
        t = ddExp(ddMulNum(logU(q, scale), shape));
    }
    if (!lowerTail)
        return logP ? -t[0] - t[1] : expNeg(t);
    const s = t[0] + t[1];
    return logP ? logOneMinusExpNeg(t) : -Math.expm1(-s);
}
export function qweibull1(p, shape, scale, lowerTail, logP) {
    if (Number.isNaN(p) || Number.isNaN(shape) || Number.isNaN(scale))
        return NaN;
    if (!(shape > 0) || !(scale > 0))
        return NaN;
    const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
    if (b !== undefined)
        return b;
    // -log P[X > x] = t
    let lu;
    if (logP)
        lu = lowerTail ? log1mExp(p) : p;
    else
        lu = lowerTail ? Math.log1p(-p) : Math.log(p);
    return scale * cpow(-lu, 1 / shape);
}
/**
 * Density of the Weibull distribution. Equivalent to R's `dweibull(x, shape, scale = 1, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `scale` (see {@link WeibullParams}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 */
export function dweibull(x, shape, options = {}) {
    const { scale = 1, log = false } = options;
    return vectorize(x, (v) => dweibull1(v, shape, scale, log));
}
/**
 * Distribution function of the Weibull distribution. Equivalent to R's `pweibull(q, shape, scale = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `scale` (see {@link WeibullParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 */
export function pweibull(q, shape, options = {}) {
    const { scale = 1, lowerTail = true, logP = false } = options;
    return vectorize(q, (v) => pweibull1(v, shape, scale, lowerTail, logP));
}
/**
 * Quantile function of the Weibull distribution. Equivalent to R's `qweibull(p, shape, scale = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `scale` (see {@link WeibullParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 */
export function qweibull(p, shape, options = {}) {
    const { scale = 1, lowerTail = true, logP = false } = options;
    return vectorize(p, (v) => qweibull1(v, shape, scale, lowerTail, logP));
}
