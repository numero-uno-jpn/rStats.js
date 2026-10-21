// Hypergeometric distribution dhyper / phyper / qhyper (same arguments as R: k balls drawn from m white and n black).
//
// Probabilities use Loader's (2000) decomposition into binomial probabilities:
//   p(x) = b(x; m, p) b(k - x; n, p) / b(k; m + n, p),   p = k / (m + n)
// The exponents of the three binomial probabilities are added and subtracted in double-double before taking exp.
// The distribution function sums the tail far from the mean directly as p(x) × Σ (products of ratios of adjacent
// probabilities) (products and sums in double-double). Quantiles use an integer search on the distribution function.
import { vectorize } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries } from "../internal/dpq.js";
import { discreteQuantile } from "../internal/discrete.js";
import { nonInt, roundHalfEven } from "../internal/integer.js";
import { bd0dd, dbinomExponent } from "../special/loader.js";
import { ddAdd, ddDiv, ddLog, ddMul, ddNeg, ddSub, twoProd } from "../special/dd.js";
import { qnorm } from "./normal.js";
/**
 * Binomial probability b(x; x + nmx, p) as an ExpForm (0 <= x, 0 <= nmx, 0 < p < 1).
 * At the ends (x = 0 or nmx = 0), q^n / p^n is represented by the exponent alone.
 */
function binomForm(x, nmx, p, q) {
    if (x === 0 && nmx === 0)
        return { e: [0, 0], logDenom: 0 };
    if (x === 0 || nmx === 0) {
        // q^n (x = 0) or p^n (nmx = 0)
        const n = x + nmx;
        const [a, b] = x === 0 ? [q, p] : [p, q];
        // When the base is close to 1 (the other side b is small), avoid cancellation with n log a = -bd0(n, n a) - n b
        const e = b[0] < 0.1 ? ddAdd(bd0dd(n, ddMul([n, 0], a)), ddMul([n, 0], b)) : ddNeg(ddMul([n, 0], ddLog(a)));
        return { e, logDenom: 0 };
    }
    return dbinomExponent(x, nmx, p, q);
}
/** ExpForm of p(x) (x an integer in the support, 0 < k < m + n) */
function hyperForm(x, m, n, k) {
    const N = m + n;
    const p = ddDiv([k, 0], [N, 0]);
    const q = ddDiv([N - k, 0], [N, 0]);
    const f1 = binomForm(x, m - x, p, q);
    const f2 = binomForm(k - x, n - k + x, p, q);
    const f3 = binomForm(k, N - k, p, q);
    return {
        e: ddSub(ddAdd(f1.e, f2.e), f3.e),
        logDenom: f1.logDenom + f2.logDenom - f3.logDenom,
    };
}
/** exp(-e) / sqrt(exp(logDenom)) × s. Rounding happens once at the end even for results near subnormal */
function evalForm(f, s) {
    const [eh, el] = f.e;
    const scale = s * Math.exp(-0.5 * f.logDenom);
    if (eh < 700)
        return Math.exp(-eh) * (1 - el) * scale;
    return Math.exp(700 - eh) * (1 - el) * scale * Math.exp(-700);
}
function logForm(f) {
    return -f.e[0] - f.e[1] - 0.5 * f.logDenom;
}
/** Support [lo, hi] */
function support(m, n, k) {
    return [Math.max(0, k - n), Math.min(k, m)];
}
export function dhyper1(x, m, n, k, log) {
    if ([x, m, n, k].some(Number.isNaN))
        return NaN;
    if (![m, n, k].every(Number.isFinite) || nonInt(m) || nonInt(n) || nonInt(k))
        return NaN;
    m = roundHalfEven(m);
    n = roundHalfEven(n);
    k = roundHalfEven(k);
    if (m < 0 || n < 0 || k < 0 || k > m + n)
        return NaN;
    if (nonInt(x))
        return d0(log);
    x = roundHalfEven(x);
    const [lo, hi] = support(m, n, k);
    if (x < lo || x > hi)
        return d0(log);
    if (k === 0 || k === m + n)
        return log ? 0 : 1;
    const f = hyperForm(x, m, n, k);
    return log ? logForm(f) : evalForm(f, 1);
}
/** a b / (c d) in double-double (a..d integers) */
function ratio(a, b, c, d) {
    return ddDiv(twoProd(a, b), twoProd(c, d));
}
/**
 * Sum of the tail far from the mean. If lower, P[X <= x] = p(x) Σ_{j>=0} p(x-j)/p(x);
 * otherwise P[X >= x] = p(x) Σ p(x+j)/p(x). Returns the sum S = Σ p(x∓j)/p(x).
 */
function tailSum(x, m, n, k, lower, lo, hi) {
    let t = [1, 0];
    let s = [1, 0];
    let y = x;
    for (;;) {
        if (lower ? y <= lo : y >= hi)
            break;
        // Ratio p(y-1)/p(y) = y (n - k + y) / ((m - y + 1)(k - y + 1))
        //    p(y+1)/p(y) = (m - y)(k - y) / ((y + 1)(n - k + y + 1))
        const r = lower ? ratio(y, n - k + y, m - y + 1, k - y + 1) : ratio(m - y, k - y, y + 1, n - k + y + 1);
        t = ddMul(t, r);
        s = ddAdd(s, t);
        y += lower ? -1 : 1;
        // Moving away from the mean, the ratio decreases monotonically. The remaining sum is bounded by t r / (1 - r)
        const rr = r[0];
        if (rr < 1 && (t[0] * rr) / (1 - rr) < s[0] * 2 ** -60)
            break;
    }
    return s[0] + s[1];
}
/** P[X <= x] (lowerTail) / P[X > x] at an integer x inside the support (lo <= x < hi) */
function phyperRaw(x, m, n, k, lowerTail, logP) {
    const [lo, hi] = support(m, n, k);
    const N = m + n;
    // Below the mean k m / N sum the lower tail directly; otherwise the upper tail P[X >= x + 1]
    let lowerSide = x * N < k * m;
    let tail = directTail(x, m, n, k, lowerSide, lo, hi);
    if (tail.value > 0.5) {
        // When the mean is near an end of the support, even the side far from the mean can exceed 1/2. Sum the other
        // side directly too and use the smaller (so that the log of a value near 1 is formed from 1 - (other side))
        const other = directTail(x, m, n, k, !lowerSide, lo, hi);
        if (other.value < tail.value) {
            tail = other;
            lowerSide = !lowerSide;
        }
    }
    if (lowerSide === lowerTail) {
        if (!logP)
            return tail.value;
        return tail.value > 1e-300 ? Math.log(tail.value) : logForm(tail.form) + Math.log(tail.sum);
    }
    return logP ? Math.log1p(-tail.value) : 1 - tail.value;
}
/** P[X <= x] (lowerSide) or P[X >= x + 1], computed directly as the probability at the tail's end × the sum of ratios */
function directTail(x, m, n, k, lowerSide, lo, hi) {
    const start = lowerSide ? x : x + 1;
    const form = hyperForm(start, m, n, k);
    const sum = tailSum(start, m, n, k, lowerSide, lo, hi);
    return { form, sum, value: evalForm(form, sum) };
}
/** Check and round the parameters of phyper / qhyper. undefined if invalid */
function hyperParams(m, n, k) {
    if (![m, n, k].every(Number.isFinite))
        return undefined;
    m = roundHalfEven(m);
    n = roundHalfEven(n);
    k = roundHalfEven(k);
    if (m < 0 || n < 0 || k < 0 || k > m + n)
        return undefined;
    return [m, n, k];
}
export function phyper1(q, m, n, k, lowerTail, logP) {
    if ([q, m, n, k].some(Number.isNaN))
        return NaN;
    const params = hyperParams(m, n, k);
    if (params === undefined)
        return NaN;
    [m, n, k] = params;
    const x = Math.floor(q + 1e-7);
    const [lo, hi] = support(m, n, k);
    if (x < lo)
        return dt0(lowerTail, logP);
    if (x >= hi)
        return dt1(lowerTail, logP);
    return phyperRaw(x, m, n, k, lowerTail, logP);
}
export function qhyper1(p, m, n, k, lowerTail, logP) {
    if ([p, m, n, k].some(Number.isNaN))
        return NaN;
    const params = hyperParams(m, n, k);
    if (params === undefined)
        return NaN;
    [m, n, k] = params;
    const [lo, hi] = support(m, n, k);
    const b = quantileBoundaries(p, lo, hi, lowerTail, logP);
    if (b !== undefined)
        return b;
    if (lo === hi)
        return lo;
    const N = m + n;
    const mu = (k * m) / N;
    const sigma = Math.sqrt((((k * m) / N) * (n / N) * (N - k)) / Math.max(N - 1, 1));
    const z = qnorm(p, { lowerTail, logP });
    const y0 = mu + sigma * z;
    return discreteQuantile({
        p,
        lowerTail,
        logP,
        cdf: (y, l, lg) => (y < lo ? dt0(l, lg) : y >= hi ? dt1(l, lg) : phyperRaw(y, m, n, k, l, lg)),
        y0: Number.isFinite(y0) ? y0 : mu,
        lo,
        hi,
    });
}
/**
 * Probability mass function of the hypergeometric distribution (number of white balls among `k` drawn without replacement from an urn of `m` white and `n` black balls). Equivalent to R's `dhyper(x, m, n, k, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param m - Number of white balls in the urn.
 * @param n - Number of black balls in the urn.
 * @param k - Number of balls drawn.
 * @param options - `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 */
export function dhyper(x, m, n, k, options = {}) {
    const log = options.log ?? false;
    return vectorize(x, (v) => dhyper1(v, m, n, k, log));
}
/**
 * Distribution function of the hypergeometric distribution (number of white balls among `k` drawn without replacement from an urn of `m` white and `n` black balls). Equivalent to R's `phyper(q, m, n, k, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param m - Number of white balls in the urn.
 * @param n - Number of black balls in the urn.
 * @param k - Number of balls drawn.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 */
export function phyper(q, m, n, k, options = {}) {
    const { lowerTail = true, logP = false } = options;
    return vectorize(q, (v) => phyper1(v, m, n, k, lowerTail, logP));
}
/**
 * Quantile function of the hypergeometric distribution (number of white balls among `k` drawn without replacement from an urn of `m` white and `n` black balls). Equivalent to R's `qhyper(p, m, n, k, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param m - Number of white balls in the urn.
 * @param n - Number of black balls in the urn.
 * @param k - Number of balls drawn.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 */
export function qhyper(p, m, n, k, options = {}) {
    const { lowerTail = true, logP = false } = options;
    return vectorize(p, (v) => qhyper1(v, m, n, k, lowerTail, logP));
}
