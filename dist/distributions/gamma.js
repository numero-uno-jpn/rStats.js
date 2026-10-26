// Gamma distribution dgamma / pgamma / qgamma.
//
// The density uses the relation to the Poisson probability (Loader 2000). With y = x/scale,
//   f(x) = dpois(shape - 1; y) / scale            (shape >= 1)
//        = dpois(shape; y) * shape / x            (shape < 1)
// The distribution function uses the incomplete gamma function (src/special/igam.ts); quantiles use Newton's
// method (src/internal/invert.ts) from the DiDonato & Morris starting value.
import { vectorize } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, smallerTail } from "../internal/dpq.js";
import { invertContinuous } from "../internal/invert.js";
import { gammaInc, gammaIncBoth } from "../special/igam.js";
import { findInverseGamma } from "../special/igami.js";
import { lgamma, lgamma1p } from "../special/gamma.js";
import { dpoisRaw } from "../special/loader.js";
import { qnorm } from "./normal.js";
/** Determine scale from rate / scale (as in R, giving both is an error unless scale = 1/rate; also used by rgamma) */
export function gammaScale(params) {
    const { rate, scale } = params;
    if (rate !== undefined && scale !== undefined) {
        if (Math.abs(rate * scale - 1) >= 1e-15) {
            throw new RangeError("rate and scale can both be given only when scale = 1 / rate");
        }
        return scale;
    }
    if (scale !== undefined)
        return scale;
    if (rate !== undefined)
        return 1 / rate;
    return 1;
}
/** Log density of the standardized (scale = 1) gamma distribution. x > 0, shape > 0 */
export function dgammaStdLog(x, shape) {
    if (shape < 1) {
        const pr = dpoisRaw(shape, x, true);
        const r = shape / x;
        return pr + (Number.isFinite(r) ? Math.log(r) : Math.log(shape) - Math.log(x));
    }
    return dpoisRaw(shape - 1, x, true);
}
export function dgamma1(x, shape, scale, log) {
    if (Number.isNaN(x) || Number.isNaN(shape) || Number.isNaN(scale))
        return NaN;
    if (shape < 0 || scale <= 0)
        return NaN;
    if (x < 0)
        return d0(log);
    if (shape === 0)
        return x === 0 ? Infinity : d0(log);
    if (x === 0) {
        if (shape < 1)
            return Infinity;
        if (shape > 1)
            return d0(log);
        return log ? -Math.log(scale) : 1 / scale;
    }
    if (shape < 1) {
        const pr = dpoisRaw(shape, x / scale, log);
        if (log) {
            const r = shape / x;
            return pr + (Number.isFinite(r) ? Math.log(r) : Math.log(shape) - Math.log(x));
        }
        return (pr * shape) / x;
    }
    const pr = dpoisRaw(shape - 1, x / scale, log);
    return log ? pr - Math.log(scale) : pr / scale;
}
export function pgamma1(q, shape, scale, lowerTail, logP) {
    if (Number.isNaN(q) || Number.isNaN(shape) || Number.isNaN(scale))
        return NaN;
    if (shape < 0 || scale <= 0)
        return NaN;
    const x = q / scale;
    if (Number.isNaN(x))
        return x;
    if (shape === 0)
        return x <= 0 ? dt0(lowerTail, logP) : dt1(lowerTail, logP);
    if (x <= 0)
        return dt0(lowerTail, logP);
    return gammaInc(shape, x, lowerTail, logP);
}
/** Quantile of the standardized gamma distribution. 0 < p < 1 (range checks are the caller's job) */
export function qgammaStd(p, shape, lowerTail, logP) {
    const { lower, logTarget, linearTarget } = smallerTail(p, lowerTail, logP);
    // If the distribution function at the smallest positive number already passes the target, the answer is too small to represent (0)
    const atMin = gammaInc(shape, Number.MIN_VALUE, lower, true);
    if (lower ? atMin >= logTarget : atMin <= logTarget)
        return 0;
    let x0;
    if (shape > 1 && logTarget <= -700) {
        // Deep tail: Wilson-Hilferty approximation x = a (1 - 1/(9a) + z / sqrt(9a))^3
        const z = qnorm(logTarget, { lowerTail: lower, logP: true });
        const w = 1 - 1 / (9 * shape) + z / Math.sqrt(9 * shape);
        x0 = w > 0 ? shape * w * w * w : shape * 1e-3;
    }
    else if (logTarget > -700) {
        const t = Math.exp(logTarget);
        const c = -Math.expm1(logTarget);
        x0 = lower ? findInverseGamma(shape, t, c) : findInverseGamma(shape, c, t);
    }
    else if (lower) {
        // P(a, x) ≈ x^a / Gamma(a + 1)
        x0 = Math.exp((logTarget + lgamma1p(shape)) / shape);
    }
    else {
        // Q(a, x) ≈ x^(a-1) e^-x / Gamma(a)
        x0 = -logTarget;
        for (let i = 0; i < 3; i++)
            x0 = -logTarget - lgamma(shape) + (shape - 1) * Math.log(x0);
    }
    return invertContinuous({
        logTarget,
        ...(linearTarget !== undefined && { linearTarget }),
        lower,
        cdf: (x, l) => gammaInc(shape, x, l, false),
        cdfLog: (x, l) => gammaInc(shape, x, l, true),
        cdfBoth: (x, l) => gammaIncBoth(shape, x, l),
        pdfLog: (x) => dgammaStdLog(x, shape),
        dlogPdf: (x) => (shape - 1) / x - 1,
        x0,
        lo: 0,
        hi: Infinity,
        positive: true,
    });
}
export function qgamma1(p, shape, scale, lowerTail, logP) {
    if (Number.isNaN(p) || Number.isNaN(shape) || Number.isNaN(scale))
        return NaN;
    const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
    if (b !== undefined)
        return b;
    if (shape < 0 || scale <= 0)
        return NaN;
    if (shape === 0)
        return 0;
    return qgammaStd(p, shape, lowerTail, logP) * scale;
}
/**
 * Density of the gamma distribution. Equivalent to R's `dgamma(x, shape, rate = 1, scale = 1/rate, log = FALSE)`.
 *
 * @throws RangeError if both `rate` and `scale` are given and `scale` is not `1 / rate`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `rate` or `scale` (see {@link GammaParams}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * dgamma(1, 2);              // 0.36787944117144233
 * dgamma(1, 2, { rate: 3 }); // 0.44808361531077556
 * ```
 *
 * @category Distributions
 */
export function dgamma(x, shape, options = {}) {
    const scale = gammaScale(options);
    const log = options.log ?? false;
    return vectorize(x, (v) => dgamma1(v, shape, scale, log));
}
/**
 * Distribution function of the gamma distribution. Equivalent to R's `pgamma(q, shape, rate = 1, scale = 1/rate, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @throws RangeError if both `rate` and `scale` are given and `scale` is not `1 / rate`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `rate` or `scale` (see {@link GammaParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pgamma(2, 2);              // 0.5939941502901619
 * pgamma(2, 2, { rate: 3 }); // 0.9826487347633355
 * pgamma(2, 2, { scale: 3 }); // 0.14430480161234657
 * ```
 *
 * @category Distributions
 */
export function pgamma(q, shape, options = {}) {
    const scale = gammaScale(options);
    const { lowerTail = true, logP = false } = options;
    return vectorize(q, (v) => pgamma1(v, shape, scale, lowerTail, logP));
}
/**
 * Quantile function of the gamma distribution. Equivalent to R's `qgamma(p, shape, rate = 1, scale = 1/rate, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @throws RangeError if both `rate` and `scale` are given and `scale` is not `1 / rate`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `rate` or `scale` (see {@link GammaParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qgamma(0.5, 2);                   // 1.6783469900166605
 * qgamma([0.05, 0.95], 2, { rate: 3 }); // [0.11845383689955402, 1.5812881727968588]
 * ```
 *
 * @category Distributions
 */
export function qgamma(p, shape, options = {}) {
    const scale = gammaScale(options);
    const { lowerTail = true, logP = false } = options;
    return vectorize(p, (v) => qgamma1(v, shape, scale, lowerTail, logP));
}
