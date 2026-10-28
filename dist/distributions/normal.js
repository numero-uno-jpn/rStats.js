// Normal distribution function pnorm and quantile function qnorm.
//
// The building blocks are ports of xsf (Cephes) erf / erfc / ndtri / ndtri_exp
// (src/special/). Argument handling (NaN, ±Inf, sd <= 0, lowerTail, logP) is matched to
// R's output (test/fixtures/). R's source code was not consulted.
import { erf, erfcxNonNegative } from "../special/erf.js";
import { ndtri, ndtriExp } from "../special/ndtri.js";
import { vectorize } from "../internal/vectorize.js";
const SQRT1_2 = Math.SQRT1_2;
/**
 * exp(-a^2 / 2) (a >= 0) multiplied by scale.
 *
 * Computing a^2 directly lets its rounding error be amplified by the exponential, reaching a relative error of
 * 1e-13 around a = 38. Split a = hi + lo (hi on a 1/16 grid so hi^2 is exact) and compute
 * exp(-hi^2/2) * exp(-lo (a + hi) / 2).
 * Where the result is subnormal, rounding happens only in the final multiplication.
 */
function scaledExpNegHalfSq(a, scale) {
    // exp(-a^2 / 2) underflows for any finite scale (and a * 16 would overflow near the largest double)
    if (a > 1e10)
        return 0;
    const hi = Math.floor(a * 16) / 16;
    const lo = a - hi;
    const halfHiSq = (hi * hi) / 2;
    const m = scale * Math.exp((-lo * (a + hi)) / 2);
    if (halfHiSq <= 700)
        return m * Math.exp(-halfHiSq);
    return m * Math.exp(700 - halfHiSq) * Math.exp(-700);
}
/** Lower probability P[Z <= t] of the standard normal (t <= 0) */
function lowerTailProb(t) {
    const a = -t;
    if (a < Math.SQRT2)
        return 0.5 - 0.5 * erf(a * SQRT1_2);
    return scaledExpNegHalfSq(a, 0.5 * erfcxNonNegative(a * SQRT1_2));
}
/** P[Z <= t] of the standard normal (log if logP). t is not NaN */
function pnormStd(t, logP) {
    if (!logP)
        return t <= 0 ? lowerTailProb(t) : 1 - lowerTailProb(-t);
    if (t > -1)
        return Math.log1p(-lowerTailProb(-t));
    const a = -t;
    return Math.log(0.5 * erfcxNonNegative(a * SQRT1_2)) - (a * a) / 2;
}
function pnorm1(q, mean, sd, lowerTail, logP) {
    if (Number.isNaN(q) || Number.isNaN(mean) || Number.isNaN(sd))
        return NaN;
    if (!Number.isFinite(q) && mean === q)
        return NaN; // Inf - Inf
    const p0 = lowerTail ? (logP ? -Infinity : 0) : logP ? 0 : 1;
    const p1 = lowerTail ? (logP ? 0 : 1) : logP ? -Infinity : 0;
    if (sd < 0)
        return NaN;
    if (sd === 0)
        return q < mean ? p0 : p1;
    const x = (q - mean) / sd;
    if (!Number.isFinite(x))
        return q < mean ? p0 : p1;
    return pnormStd(lowerTail ? x : -x, logP);
}
function qnorm1(p, mean, sd, lowerTail, logP) {
    if (Number.isNaN(p) || Number.isNaN(mean) || Number.isNaN(sd))
        return NaN;
    // Endpoints corresponding to probabilities 0 and 1
    const left = lowerTail ? -Infinity : Infinity;
    if (logP) {
        if (p > 0)
            return NaN;
        if (p === 0)
            return -left;
        if (p === -Infinity)
            return left;
    }
    else {
        if (p < 0 || p > 1)
            return NaN;
        if (p === 0)
            return left;
        if (p === 1)
            return -left;
    }
    if (sd < 0)
        return NaN;
    if (sd === 0)
        return mean;
    const z = logP ? ndtriLogRefined(p) : ndtri(p);
    return mean + sd * (lowerTail ? z : -z);
}
const SQRT_2_OVER_PI = 0.797884560802865355879892119869;
/**
 * ndtriExp with one Newton correction applied only outside the design range of the Cephes approximation.
 *
 * The tail approximation of Cephes' ndtri assumes z = sqrt(-2 log p) up to 64 (log p >= -2048). Beyond that
 * the relative error grows to about 5e-13 (measured at log p = -1e5). So log Φ(x) = y is re-solved using the
 * logP of pnormStd, which is accurate in the tails as well. The derivative φ(x)/Φ(x) is √(2/π) / erfcx(a/√2),
 * since Φ(x) = erfcx(a/√2) φ(x) √(π/2) for x = -a < 0. This avoids dividing exp(-a²/2) by itself.
 */
function ndtriLogRefined(y) {
    const x = ndtriExp(y);
    if (!(y < -2048) || !Number.isFinite(x))
        return x;
    const slope = SQRT_2_OVER_PI / erfcxNonNegative(-x * SQRT1_2);
    const step = (pnormStd(x, true) - y) / slope;
    // For |x| > 1.3e154, a² in pnormStd overflows; return without correction there
    return Number.isFinite(step) ? x - step : x;
}
const LN_SQRT_2PI = 0.918938533204672741780329736406;
const INV_SQRT_2PI = 0.398942280401432677939946059934;
function dnorm1(x, mean, sd, log) {
    if (Number.isNaN(x) || Number.isNaN(mean) || Number.isNaN(sd))
        return NaN;
    if (sd < 0)
        return NaN;
    if (!Number.isFinite(sd))
        return log ? -Infinity : 0;
    if (!Number.isFinite(x) && mean === x)
        return NaN; // Inf - Inf
    if (sd === 0)
        return x === mean ? Infinity : log ? -Infinity : 0;
    const z = (x - mean) / sd;
    if (!Number.isFinite(z))
        return log ? -Infinity : 0;
    if (log)
        return -(LN_SQRT_2PI + 0.5 * z * z + Math.log(sd));
    // Rounding of z^2 is amplified by the exponential in exp(-z^2/2), so split it as in pnorm
    return scaledExpNegHalfSq(Math.abs(z), INV_SQRT_2PI / sd);
}
/**
 * Density of the normal distribution. Equivalent to R's `dnorm(x, mean = 0, sd = 1, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - Distribution parameters and output scale.
 * @param options.mean - Mean. Default `0`.
 * @param options.sd - Standard deviation. Default `1`.
 * @param options.log - If `true`, return the log density. Default `false`.
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * dnorm(0);                                  // 0.3989422804014327
 * dnorm([-1, 0, 1]);                         // [0.24197072451914337, 0.3989422804014327, 0.24197072451914337]
 * dnorm(1, { mean: 1, sd: 2, log: true });   // -1.612085713764618
 * ```
 *
 * @category Distributions
 */
export function dnorm(x, options = {}) {
    const { mean = 0, sd = 1, log = false } = options;
    return vectorize(x, (v) => dnorm1(v, mean, sd, log));
}
/**
 * Distribution function of the normal distribution.
 * Equivalent to R's `pnorm(q, mean = 0, sd = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `mean`, `sd`, `lowerTail` and `logP` (see {@link NormalOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pnorm(1.96);                          // 0.9750021048517795
 * pnorm(1.96, { lowerTail: false });    // 0.024997895148220435
 * pnorm(new Float64Array([-1, 0, 1]));  // Float64Array [0.15865525393145707, 0.5, 0.8413447460685429]
 * pnorm(-40, { logP: true });           // -804.6084420137538
 * ```
 *
 * @category Distributions
 */
export function pnorm(q, options = {}) {
    const { mean = 0, sd = 1, lowerTail = true, logP = false } = options;
    return vectorize(q, (v) => pnorm1(v, mean, sd, lowerTail, logP));
}
/**
 * Quantile function of the normal distribution.
 * Equivalent to R's `qnorm(p, mean = 0, sd = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `mean`, `sd`, `lowerTail` and `logP` (see {@link NormalOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qnorm(0.975);                         // 1.959963984540054
 * qnorm(0.05, { mean: 100, sd: 15 });   // 75.32719559572791
 * ```
 *
 * @category Distributions
 */
export function qnorm(p, options = {}) {
    const { mean = 0, sd = 1, lowerTail = true, logP = false } = options;
    return vectorize(p, (v) => qnorm1(v, mean, sd, lowerTail, logP));
}
