// Summary statistics used by the tests (mean, variance, covariance, ranks).
//
// R's mean and var accumulate sums in extended precision. Here sums are taken in double-double (src/special/dd.ts)
// and rounded to double at the end. The mean divides the first sum by n, then corrects it with the sum of deviations
// (so that rounding errors from adding double values do not remain).
import { ddAdd, ddDivNum, ddMul, ddSub } from "../special/dd.js";
/** Mean as double-double. x contains no NaN and has length >= 1 */
export function meanDD(x) {
    const n = x.length;
    // With Inf present the double-double sum becomes NaN, so add in double precision instead (result is ±Inf or NaN)
    if (!x.every(Number.isFinite))
        return [x.reduce((a, b) => a + b, 0) / n, 0];
    let s = [0, 0];
    for (const v of x)
        s = ddAdd(s, [v, 0]);
    const m = ddDivNum(s, n);
    if (!Number.isFinite(m[0]))
        return [s[0] / n, 0];
    let t = [0, 0];
    for (const v of x)
        t = ddAdd(t, ddSub([v, 0], m));
    return ddAdd(m, ddDivNum(t, n));
}
export function mean(x) {
    return x.length === 0 ? NaN : meanDD(x)[0];
}
/** Unbiased variance. NaN for length below 2 (R's var gives NA) */
export function variance(x) {
    return covariance(x, x);
}
/** Unbiased covariance. x and y have the same length and contain no NaN */
export function covariance(x, y) {
    const n = x.length;
    if (n < 2)
        return NaN;
    const mx = meanDD(x);
    const my = x === y ? mx : meanDD(y);
    if (!Number.isFinite(mx[0]) || !Number.isFinite(my[0]))
        return NaN;
    // Scale the deviations by a power of 2 to be near 1 before multiplying (so products of values around 1e200 do not
    // overflow and products around 1e-200 do not underflow to 0; powers of 2 add no rounding error)
    const dx = x.map((v) => ddSub([v, 0], mx));
    const dy = x === y ? dx : y.map((v) => ddSub([v, 0], my));
    const kx = scaleExponent(dx);
    const ky = x === y ? kx : scaleExponent(dy);
    const fx = 2 ** -kx;
    const fy = 2 ** -ky;
    let s = [0, 0];
    for (let i = 0; i < n; i++) {
        const a = [dx[i][0] * fx, dx[i][1] * fx];
        const b = [dy[i][0] * fy, dy[i][1] * fy];
        s = ddAdd(s, ddMul(a, b));
    }
    const v = ddDivNum(s, n - 1)[0];
    // Multiply by 2^(kx + ky) in two steps (a single step can overflow or underflow to 0)
    return v * 2 ** kx * 2 ** ky;
}
/** Binary exponent of the largest absolute deviation (0 if it is 0) */
function scaleExponent(d) {
    let m = 0;
    for (const v of d)
        m = Math.max(m, Math.abs(v[0]));
    return m === 0 || !Number.isFinite(m) ? 0 : Math.max(-1022, Math.floor(Math.log2(m)));
}
/** Sum (accumulated in double-double, then rounded) */
export function sum(x) {
    let s = [0, 0];
    for (const v of x)
        s = ddAdd(s, [v, 0]);
    return s[0];
}
/**
 * Ranks (ties get the average rank, R's rank(ties.method = "average")). x contains no NaN.
 * Equality is decided by exact comparison
 */
export function rank(x) {
    const n = x.length;
    const idx = Array.from({ length: n }, (_, i) => i);
    idx.sort((a, b) => x[a] - x[b] || a - b);
    const r = new Array(n);
    let i = 0;
    while (i < n) {
        let j = i;
        while (j + 1 < n && x[idx[j + 1]] === x[idx[i]])
            j++;
        const avg = (i + j + 2) / 2;
        for (let k = i; k <= j; k++)
            r[idx[k]] = avg;
        i = j + 1;
    }
    return r;
}
/** Size of each group of ties (only those of size 2 or more). x contains no NaN */
export function tieCounts(x) {
    const s = [...x].sort((a, b) => a - b);
    const out = [];
    let i = 0;
    while (i < s.length) {
        let j = i;
        while (j + 1 < s.length && s[j + 1] === s[i])
            j++;
        if (j > i)
            out.push(j - i + 1);
        i = j + 1;
    }
    return out;
}
/** Array with NaN removed (R's x[!is.na(x)]) */
export function dropNaN(x) {
    return x.filter((v) => !Number.isNaN(v));
}
/** Keep only the pairs where neither x nor y is NaN (R's complete.cases) */
export function completePairs(x, y) {
    if (x.length !== y.length)
        throw new TypeError("x and y must have the same length");
    const a = [];
    const b = [];
    for (let i = 0; i < x.length; i++) {
        if (!Number.isNaN(x[i]) && !Number.isNaN(y[i])) {
            a.push(x[i]);
            b.push(y[i]);
        }
    }
    return [a, b];
}
