// Shape and location summaries that R's base lacks, with the definitions of the packages they are checked against:
// skewness and kurtosis (e1071, types 1 to 3), geometricMean, modes, meanAD and cv (DescTools' Gmean, Mode, MeanAD
// and CoefVar). Also scale (R's base).
//
// Written for rStats.js from the published definitions (no ported code). With m_k the central moments (divisor n),
// g1 = m3 / m2^1.5 and g2 = m4 / m2^2 - 3; e1071's type 1 is (g1, g2), type 2 the adjusted estimators of SAS and SPSS
// (Joanes and Gill, The Statistician 47, 1998), type 3 (the default, as in MINITAB and BMDP) b1 = g1 ((n-1)/n)^1.5 and
// b2 = (g2 + 3) ((n-1)/n)^2 - 3. The central moments are summed after subtracting the double-double mean.
import { values } from "./basic.js";
import { meanDD, mean as meanOf, variance } from "../internal/summary.js";
import { median } from "./basic.js";
/** Central sums sum (x - mean)^2, ^3, ^4 of values without NaN */
function centralSums(xs) {
    const m = meanDD(xs);
    let s2 = 0;
    let s3 = 0;
    let s4 = 0;
    for (const v of xs) {
        const d = v - m[0] - m[1];
        const d2 = d * d;
        s2 += d2;
        s3 += d2 * d;
        s4 += d2 * d2;
    }
    return [s2, s3, s4];
}
function checkType(type) {
    if (![1, 2, 3].includes(type))
        throw new RangeError("Invalid 'type' argument.");
}
/**
 * Sample skewness. Equivalent to `e1071::skewness()` (missing values dropped); `{ type: 1 }` is jStat's skewness.
 */
export function skewness(x, options = {}) {
    const type = options.type ?? 3;
    checkType(type);
    const xs = values(x, true);
    const n = xs.length;
    const [s2, s3] = centralSums(xs);
    const g1 = (Math.sqrt(n) * s3) / s2 ** 1.5;
    if (type === 1)
        return g1;
    if (type === 2) {
        if (n < 3)
            throw new RangeError("Need at least 3 complete observations.");
        return (g1 * Math.sqrt(n * (n - 1))) / (n - 2);
    }
    return g1 * (1 - 1 / n) ** 1.5;
}
/**
 * Sample excess kurtosis. Equivalent to `e1071::kurtosis()` (missing values dropped); `{ type: 1 }` is jStat's
 * kurtosis.
 */
export function kurtosis(x, options = {}) {
    const type = options.type ?? 3;
    checkType(type);
    const xs = values(x, true);
    const n = xs.length;
    const [s2, , s4] = centralSums(xs);
    const r = (n * s4) / (s2 * s2);
    if (type === 1)
        return r - 3;
    if (type === 2) {
        if (n < 4)
            throw new RangeError("Need at least 4 complete observations.");
        return (((n + 1) * (r - 3) + 6) * (n - 1)) / ((n - 2) * (n - 3));
    }
    return r * (1 - 1 / n) ** 2 - 3;
}
/**
 * Geometric mean exp(mean(log x)). Equivalent to `DescTools::Gmean()`: NaN with a negative value, 0 with a zero.
 */
export function geometricMean(x, options = {}) {
    const xs = values(x, options.naRm);
    if (xs === undefined)
        return NaN;
    if (xs.some((v) => v < 0))
        return NaN;
    if (xs.includes(0))
        return 0;
    return Math.exp(meanOf(xs.map(Math.log)));
}
/**
 * The most frequent values (all of them, in increasing order) and their frequency. Equivalent to `DescTools::Mode()`
 * (missing values dropped): `value` is `[NaN]` and `frequency` NaN when every value occurs once.
 */
export function modes(x) {
    const xs = values(x, true);
    const counts = new Map();
    for (const v of xs)
        counts.set(v === 0 ? 0 : v, (counts.get(v === 0 ? 0 : v) ?? 0) + 1);
    let best = 0;
    for (const c of counts.values())
        best = Math.max(best, c);
    if (best <= 1)
        return { value: [NaN], frequency: NaN };
    const value = [...counts.entries()].filter(([, c]) => c === best).map(([v]) => v);
    return { value: value.sort((a, b) => a - b), frequency: best };
}
/** Mean absolute deviation from the centre. Equivalent to `DescTools::MeanAD()` (missing values dropped). */
export function meanAD(x, options = {}) {
    const xs = values(x, true);
    const c = options.center ?? "mean";
    const center = c === "mean" ? meanOf(xs) : c === "median" ? median(xs) : c;
    return meanOf(xs.map((v) => Math.abs(v - center)));
}
/**
 * Coefficient of variation sd / mean (sample standard deviation). Equivalent to `DescTools::CoefVar()`.
 */
export function cv(x, options = {}) {
    const xs = values(x, options.naRm);
    if (xs === undefined)
        return NaN;
    const n = xs.length;
    let res = Math.sqrt(variance(xs)) / meanOf(xs);
    if (options.unbiased)
        res *= 1 - 1 / (4 * (n - 1)) + (res * res) / n + 1 / (2 * (n - 1) ** 2);
    return res;
}
/**
 * Centre and scale the columns of a matrix (array of rows; a vector is one column). Equivalent to R's `scale()`:
 * `center` and `scale` report the values used (R's attributes), when any.
 */
export function scale(x, options = {}) {
    const rows = x.length > 0 && Array.isArray(x[0]) ? x.map((r) => [...r]) : Array.from(x, (v) => [v]);
    const nc = rows[0]?.length ?? 0;
    const col = (j) => rows.map((r) => r[j]);
    const result = { scaled: rows };
    const c = options.center ?? true;
    if (c !== false) {
        const center = c === true ? Array.from({ length: nc }, (_, j) => meanOf(col(j).filter((v) => !Number.isNaN(v)))) : [...c];
        if (center.length !== nc)
            throw new RangeError("length of 'center' must equal the number of columns of 'x'");
        for (const r of rows)
            for (let j = 0; j < nc; j++)
                r[j] = r[j] - center[j];
        result.center = center;
    }
    const s = options.scale ?? true;
    if (s !== false) {
        const sc = s === true
            ? Array.from({ length: nc }, (_, j) => {
                const v = col(j).filter((t) => !Number.isNaN(t));
                let ss = 0;
                for (const t of v)
                    ss += t * t;
                return Math.sqrt(ss / Math.max(1, v.length - 1));
            })
            : [...s];
        if (sc.length !== nc)
            throw new RangeError("length of 'scale' must equal the number of columns of 'x'");
        for (const r of rows)
            for (let j = 0; j < nc; j++)
                r[j] = r[j] / sc[j];
        result.scale = sc;
    }
    return result;
}
