// Inverse gamma distribution dinvgamma / pinvgamma / qinvgamma, with extraDistr's parameters (alpha shape, beta scale).
//
// Written for rStats.js (no ported code). X = 1/Y with Y ~ Gamma(alpha, rate = beta), so with z = beta / x
//   f(x) = f_Gamma(z; alpha, 1) z / x,   P[X <= x] = P[Z >= z],   q(p) = beta / q_Gamma(1 - p; alpha, 1)
// which keeps the gamma functions' accuracy in both tails. z is formed in double-double and its low part enters to
// first order (the density and the tails are steep in z when alpha is large).
import { vectorize } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries } from "../internal/dpq.js";
import { standardizeDD } from "../internal/ddexp.js";
import { dgamma1, pgamma1, qgamma1 } from "./gamma.js";
const valid = (alpha, beta) => alpha > 0 && beta > 0 && Number.isFinite(beta);
// alpha = Inf is taken as the limit (the distribution concentrates at 0), as extraDistr does
export function dinvgamma1(x, alpha, beta, log) {
    if (Number.isNaN(x) || !valid(alpha, beta))
        return NaN;
    if (x <= 0 || x === Infinity)
        return d0(log);
    if (alpha === Infinity)
        return NaN;
    const [z, zl] = standardizeDD(beta, 0, x);
    if (z === Infinity)
        return d0(log);
    // d/dz log(f_Gamma(z) z) = alpha / z - 1
    const c = Number.isFinite(zl) ? (alpha / z - 1) * zl : 0;
    if (log)
        return dgamma1(z, alpha, 1, true) + Math.log(z) - Math.log(x) + c;
    return ((dgamma1(z, alpha, 1, false) * z) / x) * (1 + c);
}
export function pinvgamma1(q, alpha, beta, lowerTail, logP) {
    if (Number.isNaN(q) || !valid(alpha, beta))
        return NaN;
    if (q <= 0)
        return dt0(lowerTail, logP);
    if (q === Infinity || alpha === Infinity)
        return dt1(lowerTail, logP);
    const [z, zl] = standardizeDD(beta, 0, q);
    const v = pgamma1(z, alpha, 1, !lowerTail, logP);
    if (!(zl !== 0 && Number.isFinite(zl) && Number.isFinite(z)))
        return v;
    // P[Z <= z] grows by f(z) zl, P[Z > z] falls by it
    const sign = lowerTail ? -1 : 1;
    if (!logP)
        return v + sign * dgamma1(z, alpha, 1, false) * zl;
    // log P + f(z) zl / P, with f / P from the logs (P may underflow)
    const c = sign * Math.exp(dgamma1(z, alpha, 1, true) - v) * zl;
    return Number.isFinite(c) ? v + c : v;
}
export function qinvgamma1(p, alpha, beta, lowerTail, logP) {
    if (Number.isNaN(p) || !valid(alpha, beta))
        return NaN;
    const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
    if (b !== undefined)
        return b;
    if (alpha === Infinity)
        return 0;
    return beta / qgamma1(p, alpha, 1, !lowerTail, logP);
}
/**
 * Density of the inverse gamma distribution. Equivalent to `extraDistr::dinvgamma(x, alpha, beta = 1, log = FALSE)`:
 * f(x) = beta^alpha x^(-alpha-1) exp(-beta/x) / Gamma(alpha).
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param alpha - Shape parameter.
 * @param options - `beta` (see {@link InvgammaParams}) and `log` (see {@link DensityOptions}).
 */
export function dinvgamma(x, alpha, options = {}) {
    const { beta = 1, log = false } = options;
    return vectorize(x, (v) => dinvgamma1(v, alpha, beta, log));
}
/**
 * Distribution function of the inverse gamma distribution. Equivalent to
 * `extraDistr::pinvgamma(q, alpha, beta = 1, lower.tail = TRUE, log.p = FALSE)`.
 */
export function pinvgamma(q, alpha, options = {}) {
    const { beta = 1, lowerTail = true, logP = false } = options;
    return vectorize(q, (v) => pinvgamma1(v, alpha, beta, lowerTail, logP));
}
/**
 * Quantile function of the inverse gamma distribution. Equivalent to
 * `extraDistr::qinvgamma(p, alpha, beta = 1, lower.tail = TRUE, log.p = FALSE)`.
 */
export function qinvgamma(p, alpha, options = {}) {
    const { beta = 1, lowerTail = true, logP = false } = options;
    return vectorize(p, (v) => qinvgamma1(v, alpha, beta, lowerTail, logP));
}
