// Basic summaries of a numeric vector: R's sum, prod, mean (with trim), weighted.mean, var, sd, median, range,
// cumsum, cumprod, cummax, cummin and diff.
//
// Written for rStats.js (no ported code). R accumulates sums and products in long double (64-bit mantissa) and
// rounds once at the end; here they are accumulated in double-double (106 bits) and rounded once, which gives the
// correctly rounded result in the same cases and more. Products keep a separate power-of-two exponent, so that
// intermediate values beyond the double range do not overflow (as long double's wider exponent avoids in R).
// As everywhere in rStats.js, NaN stands for R's NA: with `naRm` it is dropped, otherwise it propagates.
import { mean as meanOf, meanDD, variance as varianceOf } from "../internal/summary.js";
import { ddAdd, ddMul } from "../special/dd.js";
/** The values as an array, NaN dropped when naRm; undefined when a NaN remains (the result is then NaN) */
export function values(x, naRm) {
    const xs = Array.from(x);
    if (naRm)
        return xs.filter((v) => !Number.isNaN(v));
    return xs.some(Number.isNaN) ? undefined : xs;
}
/** Sum of finite values in double-double; with infinities the plain sum (Inf, -Inf or NaN) */
function sumOf(xs) {
    if (!xs.every(Number.isFinite))
        return xs.reduce((a, b) => a + b, 0);
    let s = [0, 0];
    for (const v of xs)
        s = ddAdd(s, [v, 0]);
    return s[0] + s[1];
}
/**
 * Sum of the values. Equivalent to R's `sum()` for a numeric vector (0 for an empty one).
 *
 * @example
 * ```ts
 * sum([0.1, 0.2, 0.3]); // 0.6000000000000001 in plain JS addition, 0.6 here (correctly rounded)
 * ```
 */
export function sum(x, options = {}) {
    const xs = values(x, options.naRm);
    return xs === undefined ? NaN : sumOf(xs);
}
/**
 * Product of the values. Equivalent to R's `prod()` (1 for an empty vector).
 */
export function prod(x, options = {}) {
    const xs = values(x, options.naRm);
    if (xs === undefined)
        return NaN;
    if (!xs.every(Number.isFinite) || xs.includes(0))
        return xs.reduce((a, b) => a * b, 1);
    // mantissa in double-double, exponent apart: value = (h + l) 2^e
    let p = [1, 0];
    let e = 0;
    for (const v of xs) {
        p = ddMul(p, [v, 0]);
        const k = Math.floor(Math.log2(Math.abs(p[0])));
        if (k > 500 || k < -500) {
            const f = 2 ** -k;
            p = [p[0] * f, p[1] * f];
            e += k;
        }
    }
    return scaled(p, e);
}
/**
 * Arithmetic mean, optionally trimmed. Equivalent to R's `mean()`. Accurate to the last bit: the sum is taken in
 * double-double and corrected by the mean deviation, as R corrects its long double mean.
 */
export function mean(x, options = {}) {
    const xs = values(x, options.naRm);
    if (xs === undefined)
        return NaN;
    const n = xs.length;
    if (n === 0)
        return NaN;
    let trim = options.trim ?? 0;
    if (Number.isNaN(trim))
        throw new RangeError("'trim' must be numeric of length one");
    if (trim > 0 && n > 0) {
        if (trim >= 0.5)
            return median(xs);
        trim = Math.max(trim, 0);
        const lo = Math.floor(n * trim);
        const s = [...xs].sort((a, b) => a - b);
        return meanOf(s.slice(lo, n - lo));
    }
    return meanOf(xs);
}
/**
 * Weighted mean `sum(x w) / sum(w)`. Equivalent to R's `weighted.mean()`: values with weight 0 do not enter the
 * numerator (even if infinite or NaN), and `naRm` drops missing values of `x` with their weights.
 */
export function weightedMean(x, w, options = {}) {
    let xs = Array.from(x);
    let ws = Array.from(w);
    if (xs.length !== ws.length)
        throw new RangeError("'x' and 'w' must have the same length");
    if (options.naRm) {
        const keep = xs.map((v) => !Number.isNaN(v));
        xs = xs.filter((_, i) => keep[i]);
        ws = ws.filter((_, i) => keep[i]);
    }
    const prods = [];
    for (let i = 0; i < xs.length; i++)
        if (ws[i] !== 0)
            prods.push(xs[i] * ws[i]);
    return sumOf(prods) / sumOf(ws);
}
/**
 * Sample variance (denominator n - 1). Equivalent to R's `var()` for a vector (`NaN` for fewer than 2 values); named
 * `variance` because `var` cannot be a name in JavaScript. For matrices use `cov`.
 */
export function variance(x, options = {}) {
    const xs = values(x, options.naRm);
    if (xs === undefined)
        return NaN;
    return varianceOf(xs);
}
/** Sample standard deviation (denominator n - 1). Equivalent to R's `sd()`. */
export function sd(x, options = {}) {
    return Math.sqrt(variance(x, options));
}
/** Median of the values (the mean of the two middle ones for an even count). Equivalent to R's `median()`. */
export function median(x, options = {}) {
    const xs = values(x, options.naRm);
    if (xs === undefined)
        return NaN;
    const n = xs.length;
    if (n === 0)
        return NaN;
    const s = [...xs].sort((a, b) => a - b);
    const h = Math.floor(n / 2);
    return n % 2 === 1 ? s[h] : meanDD([s[h - 1], s[h]])[0];
}
/**
 * `[min, max]` of the values. Equivalent to R's `range()` (`[NaN, NaN]` with a missing value unless `naRm`;
 * `[Infinity, -Infinity]` for an empty vector).
 */
export function range(x, options = {}) {
    const xs = values(x, options.naRm);
    if (xs === undefined)
        return [NaN, NaN];
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of xs) {
        if (v < lo)
            lo = v;
        if (v > hi)
            hi = v;
    }
    return [lo, hi];
}
/** Running sums. Equivalent to R's `cumsum()`: each partial sum is rounded from an exact accumulator; `NaN` from the first `NaN` on. */
export function cumsum(x) {
    const out = [];
    let s = [0, 0];
    let plain = 0;
    let exact = true;
    for (const v of Array.from(x)) {
        plain += v;
        if (exact && Number.isFinite(v)) {
            s = ddAdd(s, [v, 0]);
            out.push(s[0] + s[1]);
        }
        else {
            exact = false;
            out.push(Number.isNaN(v) || Number.isNaN(plain) ? NaN : plain);
        }
    }
    return out;
}
/**
 * Running products. Equivalent to R's `cumprod()`: products beyond the double range show as ±Infinity with the right
 * sign, as R's long double accumulator does.
 */
export function cumprod(x) {
    const out = [];
    // exact while the factors are finite and non-zero: double-double mantissa times 2^e
    let p = [1, 0];
    let e = 0;
    let plain;
    for (const v of Array.from(x)) {
        if (plain === undefined && (!Number.isFinite(v) || v === 0))
            plain = scaled(p, e);
        if (plain !== undefined) {
            plain *= v;
            out.push(plain);
            continue;
        }
        p = ddMul(p, [v, 0]);
        const k = Math.floor(Math.log2(Math.abs(p[0])));
        if (k > 500 || k < -500) {
            p = [p[0] * 2 ** -k, p[1] * 2 ** -k];
            e += k;
        }
        out.push(scaled(p, e));
    }
    return out;
}
/** (h + l) 2^e rounded to double (±Infinity or 0 beyond the range) */
function scaled(p, e) {
    let r = p[0] + p[1];
    while (e > 0 && Number.isFinite(r)) {
        const s = Math.min(e, 1000);
        r *= 2 ** s;
        e -= s;
    }
    while (e < 0 && r !== 0) {
        const s = Math.max(e, -1000);
        r *= 2 ** s;
        e -= s;
    }
    return r;
}
function cumExtreme(x, better) {
    const out = [];
    let m = NaN;
    let seenNaN = false;
    for (const v of Array.from(x)) {
        if (seenNaN || Number.isNaN(v)) {
            seenNaN = true;
            out.push(NaN);
            continue;
        }
        if (out.length === 0 || better(v, m))
            m = v;
        out.push(m);
    }
    return out;
}
/** Running maxima. Equivalent to R's `cummax()`: `NaN` from the first `NaN` on. */
export function cummax(x) {
    return cumExtreme(x, (a, b) => a > b);
}
/** Running minima. Equivalent to R's `cummin()`. */
export function cummin(x) {
    return cumExtreme(x, (a, b) => a < b);
}
/**
 * Lagged and iterated differences. Equivalent to R's `diff()` for a vector (empty when `lag * differences` is at
 * least the length).
 */
export function diff(x, options = {}) {
    const lag = options.lag ?? 1;
    const differences = options.differences ?? 1;
    if (!(Number.isInteger(lag) && lag >= 1 && Number.isInteger(differences) && differences >= 1)) {
        throw new RangeError("'lag' and 'differences' must be integers >= 1");
    }
    let r = Array.from(x);
    if (lag * differences >= r.length)
        return [];
    for (let d = 0; d < differences; d++) {
        const next = [];
        for (let i = lag; i < r.length; i++)
            next.push(r[i] - r[i - lag]);
        r = next;
    }
    return r;
}
