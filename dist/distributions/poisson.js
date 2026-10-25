// Poisson distribution dpois / ppois / qpois.
//
// Probabilities use Loader's (2000) dpoisRaw; the distribution function is P[X <= x] = Q(x + 1, lambda)
// (regularized upper incomplete gamma function); quantiles use an integer search from a Cornish-Fisher starting value.
import { vectorize } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries } from "../internal/dpq.js";
import { discreteQuantile } from "../internal/discrete.js";
import { gammaInc } from "../special/igam.js";
import { dpoisRaw } from "../special/loader.js";
import { qnorm } from "./normal.js";
import { nonInt } from "../internal/integer.js";
/** Whether x is not an integer (relative tolerance 1e-9 as in R; see src/internal/integer.ts) */
export const nonInteger = nonInt;
export function dpois1(x, lambda, log) {
    if (Number.isNaN(x) || Number.isNaN(lambda))
        return NaN;
    if (lambda < 0)
        return NaN;
    if (nonInteger(x))
        return d0(log);
    if (x < 0 || !Number.isFinite(x))
        return d0(log);
    return dpoisRaw(Math.round(x), lambda, log);
}
export function ppois1(q, lambda, lowerTail, logP) {
    if (Number.isNaN(q) || Number.isNaN(lambda))
        return NaN;
    if (lambda < 0)
        return NaN;
    if (q < 0)
        return dt0(lowerTail, logP);
    if (lambda === 0)
        return dt1(lowerTail, logP);
    if (!Number.isFinite(q))
        return dt1(lowerTail, logP);
    const x = Math.floor(q + 1e-7);
    return gammaInc(x + 1, lambda, !lowerTail, logP);
}
export function qpois1(p, lambda, lowerTail, logP) {
    if (Number.isNaN(p) || Number.isNaN(lambda))
        return NaN;
    if (!Number.isFinite(lambda) || lambda < 0)
        return NaN;
    const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
    if (b !== undefined)
        return lambda === 0 && !Number.isNaN(b) ? 0 : b;
    if (lambda === 0)
        return 0;
    // Starting value from the Cornish-Fisher expansion
    const sigma = Math.sqrt(lambda);
    const z = qnorm(p, { lowerTail, logP });
    const y0 = lambda + sigma * (z + (z * z - 1) / (6 * sigma));
    return discreteQuantile({
        p,
        lowerTail,
        logP,
        cdf: (y, l, lg) => gammaInc(y + 1, lambda, !l, lg),
        y0: Number.isFinite(y0) ? y0 : lambda,
        lo: 0,
        hi: Infinity,
    });
}
/**
 * Probability mass function of the Poisson distribution. Equivalent to R's `dpois(x, lambda, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param lambda - Mean.
 * @param options - `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 */
export function dpois(x, lambda, options = {}) {
    const log = options.log ?? false;
    return vectorize(x, (v) => dpois1(v, lambda, log));
}
/**
 * Distribution function of the Poisson distribution. Equivalent to R's `ppois(q, lambda, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param lambda - Mean.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * ppois(2, 3);                       // 0.4231900811268436
 * ppois(5, 3, { lowerTail: false }); // P[X > 5] = 0.08391794203130346
 * ```
 */
export function ppois(q, lambda, options = {}) {
    const { lowerTail = true, logP = false } = options;
    return vectorize(q, (v) => ppois1(v, lambda, lowerTail, logP));
}
/**
 * Quantile function of the Poisson distribution. Equivalent to R's `qpois(p, lambda, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param lambda - Mean.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 */
export function qpois(p, lambda, options = {}) {
    const { lowerTail = true, logP = false } = options;
    return vectorize(p, (v) => qpois1(v, lambda, lowerTail, logP));
}
