// Distribution of the Wilcoxon signed rank statistic: dsignrank / psignrank / qsignrank.
//
// V = (sum of the ranks with positive sign). Under the null hypothesis each rank 1..n is included independently
// with probability 1/2, so P[V = s] = c_n(s) / 2^n, where c_n(s) is the number of subsets of {1, ..., n} summing
// to s. The coefficients of the generating function Π_{k=1}^{n} (1 + z^k) are obtained by dynamic programming,
// multiplying in one k at a time (only additions of positive numbers, so no cancellation). The distribution is
// symmetric under s ↔ n(n+1)/2 - s, so only the lower half (as far as needed) is computed, and results are cached per n.
import { vectorize } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries } from "../internal/dpq.js";
import { discreteQuantile } from "../internal/discrete.js";
import { nonInt, roundHalfEven } from "../internal/integer.js";
import { qnorm } from "./normal.js";
/** Threshold at which counts are multiplied by 2^-SCALE_STEP to keep them from growing too large */
const SCALE_LIMIT = 2 ** 900;
const SCALE_STEP = -900;
/**
 * Tables are cached per n (so that quantile searches, or alternating calls with different n, do not rebuild them).
 * When the total number of entries exceeds CACHE_BUDGET, the oldest are evicted (at most 32 MB in two Float64Arrays).
 */
const cache = new Map();
const CACHE_BUDGET = 2 ** 21;
let cached = 0;
/** Maximum table length (computations needing more throw RangeError; about 512 MB in two Float64Arrays) */
const MAX_LEN = 2 ** 25;
/** Build the table of counts for s = 0..J (J at most the end of the lower half, floor(n(n+1)/4)) */
function buildTable(n, J) {
    if (J + 1 > MAX_LEN) {
        throw new RangeError(`signrank: n = ${n} needs too large a table (${J + 1} entries)`);
    }
    const w = new Float64Array(J + 1);
    w[0] = 1;
    let scale = 0;
    // Elements k > J do not contribute to sums s <= J
    const kmax = Math.min(n, J);
    for (let k = 1; k <= kmax; k++) {
        // Adding in descending order, w[s - k] still holds the value before k was used
        for (let s = J; s >= k; s--)
            w[s] += w[s - k];
        // The number of subset sums of {1..k} increases up to the center k(k+1)/4, so the maximum is w[min(J, center)]
        if (w[Math.min(J, Math.floor((k * (k + 1)) / 4))] > SCALE_LIMIT) {
            const f = 2 ** SCALE_STEP;
            for (let s = 0; s <= J; s++)
                w[s] *= f;
            scale -= SCALE_STEP;
        }
    }
    // Cumulative sum (with Kahan compensation)
    const cum = new Float64Array(J + 1);
    let hi = 0;
    let lo = 0;
    for (let s = 0; s <= J; s++) {
        const y = w[s] - lo;
        const t = hi + y;
        lo = t - hi - y;
        hi = t;
        cum[s] = hi;
    }
    return { n, len: J + 1, count: w, cum, scale };
}
/** Return a table for n usable for s <= J */
function table(n, J) {
    const old = cache.get(n);
    if (old !== undefined && old.len > J) {
        // Move to the end as most recently used
        cache.delete(n);
        cache.set(n, old);
        return old;
    }
    const half = Math.floor((n * (n + 1)) / 4);
    // Growing a little at a time would cause repeated rebuilds, so double the size
    const want = Math.min(half, Math.max(J, old === undefined ? 0 : 2 * old.len));
    const t = buildTable(n, want);
    if (old !== undefined) {
        cache.delete(n);
        cached -= old.len;
    }
    cache.set(n, t);
    cached += t.len;
    for (const [key, v] of cache) {
        if (cached <= CACHE_BUDGET || key === n)
            break;
        cache.delete(key);
        cached -= v.len;
    }
    return t;
}
/** Convert the table value v (scale 2^-scale) to the probability v 2^(scale - n) (underflow only at the final step) */
function toProb(v, t, log) {
    const e = t.scale - t.n;
    const e1 = Math.trunc(e / 2);
    const p = v * 2 ** e1 * 2 ** (e - e1);
    if (!log)
        return p;
    // log(v) + e log 2 loses digits since both terms are large, so use log(p) if the probability is a normal number
    return p >= 1e-300 ? Math.log(p) : Math.log(v) + e * Math.LN2;
}
/** Check and round n. NaN if invalid */
function signrankN(n) {
    if (!Number.isFinite(n))
        return NaN;
    n = roundHalfEven(n);
    return n <= 0 ? NaN : n;
}
export function dsignrank1(x, n, log) {
    if (Number.isNaN(x) || Number.isNaN(n))
        return NaN;
    n = signrankN(n);
    if (Number.isNaN(n))
        return NaN;
    if (nonInt(x))
        return d0(log);
    x = roundHalfEven(x);
    const total = (n * (n + 1)) / 2;
    if (x < 0 || x > total)
        return d0(log);
    const s = Math.min(x, total - x);
    const t = table(n, s);
    return toProb(t.count[s], t, log);
}
/** P[V <= x] (lower) / P[V > x] (0 <= x < total, x an integer) */
function psignrankRaw(x, n, lowerTail, logP) {
    const total = (n * (n + 1)) / 2;
    // P[V > x] = P[V >= x + 1] = P[V <= total - x - 1] (symmetry)
    const lowerIdx = x;
    const upperIdx = total - x - 1;
    // Read the smaller tail directly from the table; the other is 1 - (that)
    const direct = lowerTail ? lowerIdx : upperIdx;
    const other = lowerTail ? upperIdx : lowerIdx;
    if (direct <= other) {
        const t = table(n, direct);
        return toProb(t.cum[direct], t, logP);
    }
    const t = table(n, other);
    const v = toProb(t.cum[other], t, false);
    return logP ? Math.log1p(-v) : 1 - v;
}
export function psignrank1(q, n, lowerTail, logP) {
    if (Number.isNaN(q) || Number.isNaN(n))
        return NaN;
    n = signrankN(n);
    if (Number.isNaN(n))
        return NaN;
    // R rounds q + 1e-7 to the nearest integer (psignrank(3.6, 5) is P[V <= 4])
    const x = roundHalfEven(q + 1e-7);
    const total = (n * (n + 1)) / 2;
    if (x < 0)
        return dt0(lowerTail, logP);
    if (x >= total)
        return dt1(lowerTail, logP);
    return psignrankRaw(x, n, lowerTail, logP);
}
export function qsignrank1(p, n, lowerTail, logP) {
    if (Number.isNaN(p) || Number.isNaN(n))
        return NaN;
    n = signrankN(n);
    if (Number.isNaN(n))
        return NaN;
    const total = (n * (n + 1)) / 2;
    const b = quantileBoundaries(p, 0, total, lowerTail, logP);
    if (b !== undefined)
        return b;
    const mu = total / 2;
    const sigma = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24);
    const y0 = mu + sigma * qnorm(p, { lowerTail, logP });
    return discreteQuantile({
        p,
        lowerTail,
        logP,
        cdf: (y, l, lg) => (y < 0 ? dt0(l, lg) : y >= total ? dt1(l, lg) : psignrankRaw(y, n, l, lg)),
        y0: Number.isFinite(y0) ? y0 : mu,
        lo: 0,
        hi: total,
    });
}
/**
 * Probability mass function of the distribution of the Wilcoxon signed rank statistic. Equivalent to R's `dsignrank(x, n, log = FALSE)`.
 *
 * @throws RangeError if `n` is so large that the required table cannot be allocated.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param n - Number of observations.
 * @param options - `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 */
export function dsignrank(x, n, options = {}) {
    const log = options.log ?? false;
    return vectorize(x, (v) => dsignrank1(v, n, log));
}
/**
 * Distribution function of the distribution of the Wilcoxon signed rank statistic. Equivalent to R's `psignrank(q, n, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @throws RangeError if `n` is so large that the required table cannot be allocated.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param n - Number of observations.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 */
export function psignrank(q, n, options = {}) {
    const { lowerTail = true, logP = false } = options;
    return vectorize(q, (v) => psignrank1(v, n, lowerTail, logP));
}
/**
 * Quantile function of the distribution of the Wilcoxon signed rank statistic. Equivalent to R's `qsignrank(p, n, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @throws RangeError if `n` is so large that the required table cannot be allocated.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param n - Number of observations.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 */
export function qsignrank(p, n, options = {}) {
    const { lowerTail = true, logP = false } = options;
    return vectorize(p, (v) => qsignrank1(v, n, lowerTail, logP));
}
