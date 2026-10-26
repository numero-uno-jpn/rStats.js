// Binomial distribution dbinom / pbinom / qbinom.
//
// Probabilities use Loader's (2000) dbinomRaw; the distribution function is
//   P[X <= x] = 1 - I_p(x + 1, n - x)   (regularized incomplete beta function)
// Quantiles use an integer search from a Cornish-Fisher starting value.
import { vectorize } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries } from "../internal/dpq.js";
import { discreteQuantile } from "../internal/discrete.js";
import { betaInc } from "../special/incbet.js";
import { dbinomRawDD } from "../special/loader.js";
import { twoSum } from "../special/dd.js";
import { qnorm } from "./normal.js";
import { nonInteger } from "./poisson.js";
function badParams(size, prob) {
    return nonInteger(size) || size < 0 || !Number.isFinite(size) || prob < 0 || prob > 1;
}
export function dbinom1(x, size, prob, log) {
    if (Number.isNaN(x) || Number.isNaN(size) || Number.isNaN(prob))
        return NaN;
    if (badParams(size, prob))
        return NaN;
    if (nonInteger(x) || x < 0 || !Number.isFinite(x))
        return d0(log);
    // q = 1 - prob is formed exactly in double-double (rounding in q would be amplified n - x times)
    const xr = Math.round(x);
    const n = Math.round(size);
    if (xr > n)
        return d0(log);
    const pd = prob <= 0.5 ? [prob, 0] : twoSum(1, -(1 - prob));
    const qd = prob <= 0.5 ? twoSum(1, -prob) : [1 - prob, 0];
    return dbinomRawDD(xr, n - xr, pd, qd, log);
}
/** P[X <= x] (lower) / P[X > x] (!lower). x an integer, 0 <= x < n */
function pbinomRaw(x, n, prob, lower, log) {
    // P[X <= x] = 1 - I_p(x + 1, n - x)
    return betaInc(x + 1, n - x, prob, 1 - prob, !lower, log);
}
export function pbinom1(q, size, prob, lowerTail, logP) {
    if (Number.isNaN(q) || Number.isNaN(size) || Number.isNaN(prob))
        return NaN;
    if (badParams(size, prob))
        return NaN;
    const n = Math.round(size);
    if (q < 0)
        return dt0(lowerTail, logP);
    const x = Math.floor(q + 1e-7);
    if (n <= x)
        return dt1(lowerTail, logP);
    if (prob === 0)
        return dt1(lowerTail, logP);
    if (prob === 1)
        return dt0(lowerTail, logP);
    return pbinomRaw(x, n, prob, lowerTail, logP);
}
export function qbinom1(p, size, prob, lowerTail, logP) {
    if (Number.isNaN(p) || Number.isNaN(size) || Number.isNaN(prob))
        return NaN;
    if (!Number.isFinite(size) || !Number.isFinite(prob) || prob < 0 || prob > 1 || size < 0)
        return NaN;
    // R returns the endpoints (p = 0, 1) first even for non-integer size. The upper end is size rounded half to even
    const b = quantileBoundaries(p, 0, roundHalfEven(size), lowerTail, logP);
    if (b !== undefined)
        return b;
    if (badParams(size, prob))
        return NaN;
    const n = Math.round(size);
    if (prob === 0 || n === 0)
        return 0;
    if (prob === 1)
        return n;
    const q = 1 - prob;
    const mu = n * prob;
    const sigma = Math.sqrt(n * prob * q);
    const gamma = (q - prob) / sigma;
    const z = qnorm(p, { lowerTail, logP });
    const y0 = mu + sigma * (z + (gamma * (z * z - 1)) / 6);
    return discreteQuantile({
        p,
        lowerTail,
        logP,
        cdf: (y, l, lg) => (y >= n ? dt1(l, lg) : pbinomRaw(y, n, prob, l, lg)),
        y0: Number.isFinite(y0) ? y0 : mu,
        lo: 0,
        hi: n,
    });
}
/**
 * Probability mass function of the binomial distribution. Equivalent to R's `dbinom(x, size, prob, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param size - Number of trials.
 * @param prob - Probability of success on each trial.
 * @param options - `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * dbinom(3, 10, 0.5);      // 0.1171875
 * dbinom([0, 5], 10, 0.5); // [0.0009765625, 0.24609375]
 * ```
 *
 * @category Distributions
 */
export function dbinom(x, size, prob, options = {}) {
    const log = options.log ?? false;
    return vectorize(x, (v) => dbinom1(v, size, prob, log));
}
/**
 * Distribution function of the binomial distribution. Equivalent to R's `pbinom(q, size, prob, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param size - Number of trials.
 * @param prob - Probability of success on each trial.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pbinom(3, 10, 0.5);      // 0.171875
 * pbinom([3, 5], 10, 0.5); // [0.171875, 0.623046875]
 * ```
 *
 * @category Distributions
 */
export function pbinom(q, size, prob, options = {}) {
    const { lowerTail = true, logP = false } = options;
    return vectorize(q, (v) => pbinom1(v, size, prob, lowerTail, logP));
}
/**
 * Quantile function of the binomial distribution. Equivalent to R's `qbinom(p, size, prob, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param size - Number of trials.
 * @param prob - Probability of success on each trial.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qbinom(0.5, 10, 0.3);          // 3
 * qbinom([0.025, 0.975], 10, 0.3); // [0, 6]
 * ```
 *
 * @category Distributions
 */
export function qbinom(p, size, prob, options = {}) {
    const { lowerTail = true, logP = false } = options;
    return vectorize(p, (v) => qbinom1(v, size, prob, lowerTail, logP));
}
/** Round half to even (0.5 goes to the nearest even number; same as R's nearbyint) */
function roundHalfEven(x) {
    const r = Math.round(x);
    return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}
