// Sample quantiles and robust summaries: R's quantile (types 1 to 9), IQR, fivenum and mad.
//
// Written for rStats.js. The nine quantile definitions are those of Hyndman and Fan, "Sample quantiles in
// statistical packages", The American Statistician 50, 1996, numbered as in that paper and in R's ?quantile. Details
// that the paper leaves open follow R's documented behaviour and observed output: type 7 interpolates at
// 1 + (n - 1) p only between order statistics that differ (so that equal infinite neighbours are not turned into
// NaN); the other types take the integer part of the position after enlarging it by a relative 4 eps, so that a
// position meant to be an integer is not lost to rounding, and treat a fractional part below 4 eps as 0. fivenum is
// Tukey's five-number summary; mad scales by 1.4826 by default.
import { median, values } from "./basic.js";
/** Relative fuzz for the positions of types 1 to 6, 8 and 9 */
const FUZZ = 4 * Number.EPSILON;
/** (a, b) of the continuous types 4 to 6, 8 and 9 (Hyndman and Fan's p(k) = (k - a) / (n + 1 - a - b)) */
const CONTINUOUS = {
    4: [0, 1],
    5: [0.5, 0.5],
    6: [0, 0],
    8: [1 / 3, 1 / 3],
    9: [3 / 8, 3 / 8],
};
/** Quantile of type `type` at probability `p` (in [0, 1]) of the ascending values `s` (non-empty) */
function quantileOfSorted(s, p, type) {
    const n = s.length;
    // order statistic j (1-based), extended by the end values outside 1..n
    const at = (j) => s[Math.min(Math.max(j, 1), n) - 1];
    if (type === 7) {
        const m = 1 + (n - 1) * p;
        const j = Math.floor(m);
        const lower = at(j);
        const upper = at(Math.ceil(m));
        if (m > j && upper !== lower) {
            const g = m - j;
            return (1 - g) * lower + g * upper;
        }
        return lower;
    }
    let j;
    let g;
    if (type <= 3) {
        const m = type === 3 ? n * p - 0.5 : n * p;
        j = Math.floor(m * (1 + FUZZ));
        if (type === 1)
            g = m > j ? 1 : 0;
        else if (type === 2)
            g = m > j ? 1 : 0.5;
        else
            g = m !== j || Math.abs(j % 2) === 1 ? 1 : 0;
    }
    else {
        const [a, b] = CONTINUOUS[type];
        const m = a + p * (n + 1 - a - b);
        j = Math.floor(m * (1 + FUZZ));
        g = m - j;
        if (Math.abs(g) < FUZZ)
            g = 0;
    }
    const lower = at(j);
    const upper = at(j + 1);
    if (g === 1)
        return upper;
    if (g > 0 && g < 1 && lower !== upper)
        return (1 - g) * lower + g * upper;
    return lower;
}
export function quantile(x, probs = [0, 0.25, 0.5, 0.75, 1], options = {}) {
    const type = options.type ?? 7;
    if (!(Number.isInteger(type) && type >= 1 && type <= 9))
        throw new RangeError("'type' must be an integer in 1..9");
    const xs = values(x, options.naRm);
    if (xs === undefined)
        throw new RangeError("missing values and NaN's not allowed if 'na.rm' is FALSE");
    const sorted = xs.sort((a, b) => a - b);
    const ps = typeof probs === "number" ? [probs] : Array.from(probs);
    const tol = 100 * Number.EPSILON;
    if (ps.some((p) => p < -tol || p > 1 + tol))
        throw new RangeError("'probs' outside [0,1]");
    const out = ps.map((p) => {
        if (Number.isNaN(p) || sorted.length === 0)
            return NaN;
        return quantileOfSorted(sorted, Math.min(Math.max(p, 0), 1), type);
    });
    return typeof probs === "number" ? out[0] : out;
}
/** Interquartile range, the difference of the 0.75 and 0.25 quantiles. Equivalent to R's `IQR()`. */
export function IQR(x, options = {}) {
    const [a, b] = quantile(x, [0.25, 0.75], options);
    return b - a;
}
/**
 * Tukey's five-number summary (minimum, lower hinge, median, upper hinge, maximum). Equivalent to R's `fivenum()`;
 * `NaN` values are dropped.
 */
export function fivenum(x) {
    const s = Array.from(x)
        .filter((v) => !Number.isNaN(v))
        .sort((a, b) => a - b);
    const n = s.length;
    if (n === 0)
        return [NaN, NaN, NaN, NaN, NaN];
    const n4 = Math.floor((n + 3) / 2) / 2;
    const d = [1, n4, (n + 1) / 2, n + 1 - n4, n];
    return d.map((v) => 0.5 * (s[Math.floor(v) - 1] + s[Math.ceil(v) - 1]));
}
/**
 * Median absolute deviation, scaled. Equivalent to R's `mad()`.
 *
 * @example
 * ```ts
 * mad([1, 2, 3, 4, 100]);                  // 1.4826
 * mad([1, 2, 3, 4, 100], { constant: 1 }); // 1 (jStat's meddev)
 * ```
 */
export function mad(x, options = {}) {
    const xs = values(x, options.naRm);
    if (xs === undefined)
        return NaN;
    const center = options.center ?? median(xs);
    const constant = options.constant ?? 1.4826;
    const low = options.low ?? false;
    const high = options.high ?? false;
    const dev = xs.map((v) => Math.abs(v - center));
    const n = dev.length;
    if ((low || high) && n % 2 === 0) {
        if (low && high)
            throw new RangeError("'low' and 'high' cannot be both TRUE");
        const k = n / 2 + (high ? 1 : 0);
        const s = dev.sort((a, b) => a - b);
        return constant * s[k - 1];
    }
    return constant * median(dev);
}
