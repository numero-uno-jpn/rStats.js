// Logistic distribution dlogis / plogis / qlogis.
//
// With z = (x - location) / scale, a = |z|, e = exp(-a),
//   f(x) = e / (scale (1 + e)^2), probability of the larger side 1 / (1 + e), of the smaller side e / (1 + e)
// z is formed in double-double (the relative error of exp(-a) equals the absolute error of a).
// Quantiles compute logit(p) = log(p / (1 - p)) in a cancellation-free form.
import { vectorize } from "../internal/vectorize.js";
import { quantileBoundaries } from "../internal/dpq.js";
import { expNeg, locationScale, log1mExp, standardizeDD } from "../internal/ddexp.js";
export function dlogis1(x, location, scale, log) {
    if (Number.isNaN(x) || Number.isNaN(location) || Number.isNaN(scale))
        return NaN;
    if (!(scale > 0))
        return NaN;
    const z = standardizeDD(x, location, scale);
    if (Number.isNaN(z[0]))
        return NaN;
    const a = z[0] < 0 ? [-z[0], -z[1]] : [z[0], z[1]];
    const e = expNeg(a);
    if (log)
        return -a[0] - a[1] - Math.log(scale) - 2 * Math.log1p(e);
    return e / (scale * (1 + e) * (1 + e));
}
export function plogis1(q, location, scale, lowerTail, logP) {
    if (Number.isNaN(q) || Number.isNaN(location) || Number.isNaN(scale))
        return NaN;
    if (!(scale > 0))
        return NaN;
    const z = standardizeDD(q, location, scale);
    if (Number.isNaN(z[0]))
        return NaN;
    const a = z[0] < 0 ? [-z[0], -z[1]] : [z[0], z[1]];
    const e = expNeg(a);
    // The lower probability is the larger side when z >= 0
    const big = lowerTail === z[0] >= 0;
    if (big)
        return logP ? -Math.log1p(e) : 1 / (1 + e);
    return logP ? -a[0] - a[1] - Math.log1p(e) : e / (1 + e);
}
/** logit(p) = log(p / (1 - p)). p is a log if logP */
function logit(p, logP) {
    if (logP)
        return p - log1mExp(p);
    if (p < 0.25)
        return Math.log(p / (1 - p));
    // 2p - 1 is exact. Avoids cancellation in log near 1/2
    return Math.log1p((2 * p - 1) / (1 - p));
}
export function qlogis1(p, location, scale, lowerTail, logP) {
    if (Number.isNaN(p) || Number.isNaN(location) || Number.isNaN(scale))
        return NaN;
    const b = quantileBoundaries(p, -Infinity, Infinity, lowerTail, logP);
    if (b !== undefined)
        return b;
    if (scale < 0)
        return NaN;
    if (scale === 0)
        return location;
    const l = logit(p, logP);
    return locationScale(location, scale, lowerTail ? l : -l);
}
/**
 * Density of the logistic distribution. Equivalent to R's `dlogis(x, location = 0, scale = 1, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `location` and `scale` (see {@link LocationScaleParams}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 */
export function dlogis(x, options = {}) {
    const { location = 0, scale = 1, log = false } = options;
    return vectorize(x, (v) => dlogis1(v, location, scale, log));
}
/**
 * Distribution function of the logistic distribution. Equivalent to R's `plogis(q, location = 0, scale = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `location` and `scale` (see {@link LocationScaleParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 */
export function plogis(q, options = {}) {
    const { location = 0, scale = 1, lowerTail = true, logP = false } = options;
    return vectorize(q, (v) => plogis1(v, location, scale, lowerTail, logP));
}
/**
 * Quantile function of the logistic distribution. Equivalent to R's `qlogis(p, location = 0, scale = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `location` and `scale` (see {@link LocationScaleParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 */
export function qlogis(p, options = {}) {
    const { location = 0, scale = 1, lowerTail = true, logP = false } = options;
    return vectorize(p, (v) => qlogis1(v, location, scale, lowerTail, logP));
}
