// Histogram counts and pretty break points: R's hist (with plot = FALSE), pretty and ecdf.
//
// Written for rStats.js to reproduce R's documented behaviour and output. pretty picks a unit of 1, 2, 5 or 10 times
// a power of ten close to range / n, preferring the larger units by the biases high.u.bias and u5.bias described in
// R's ?pretty, then extends to integer multiples of the unit that cover the data (with a 1e-10 relative rounding
// allowance) and keeps at least min.n cells; a range that is tiny relative to its magnitude gets a scale derived
// from the magnitude instead. hist chooses the number of cells by Sturges' (1926), Scott's (1979) or Freedman and
// Diaconis' (1981) rule, or as given, takes pretty break points over the data range, and counts after moving the
// breaks by 1e-7 times a typical cell width, so that values lying on a break up to rounding fall on the intended side.
// The order of floating-point operations follows R where the results are compared bit for bit.
import { median, range, sd } from "./basic.js";
import { IQR, quantile } from "./quantile.js";
import { seqLength } from "../internal/seq.js";
/**
 * About n + 1 equally spaced "round" values (1, 2 or 5 times a power of 10) covering the range of `x`. Equivalent to
 * R's `pretty()`.
 *
 * @example
 * ```ts
 * pretty([0.3, 9.6]); // [0, 2, 4, 6, 8, 10]
 * ```
 *
 * @category Descriptive statistics
 */
export function pretty(x, options = {}) {
    const finite = Array.from(x).filter(Number.isFinite);
    if (finite.length === 0)
        return [];
    // R converts n and minN to integers (truncating towards 0) and checks them in this order
    const nGiven = options.n ?? 5;
    if (Number.isNaN(nGiven) || Math.abs(nGiven) >= 2 ** 31 || Math.trunc(nGiven) < 0)
        throw new RangeError("invalid 'n' argument");
    const n = Math.trunc(nGiven);
    const minNGiven = options.minN ?? Math.floor(nGiven / 3);
    if (Number.isNaN(minNGiven) || Math.trunc(minNGiven) < 0 || Math.trunc(minNGiven) > n) {
        throw new RangeError("invalid 'min.n' argument");
    }
    const minN = Math.trunc(minNGiven);
    const shrink = options.shrinkSml ?? 0.75;
    const h = options.highUBias ?? 1.5;
    const h5 = options.u5Bias ?? 0.5 + 1.5 * h;
    let lo = Infinity;
    let up = -Infinity;
    for (const v of finite) {
        if (v < lo)
            lo = v;
        if (v > up)
            up = v;
    }
    const d = up - lo;
    // Step 1: the scale (target cell width)
    let c;
    let small;
    if (d === 0 && up === 0) {
        c = 1;
        small = true;
    }
    else {
        c = Math.max(Math.abs(lo), Math.abs(up));
        const t = h5 >= 1.5 * h + 0.5 ? 1 / (1 + h) : 1.5 / (1 + h5);
        const bound = (1 + t) * Math.max(1, n) * Number.EPSILON;
        small = d < c * bound * 3;
    }
    if (small) {
        if (c > 10)
            c = 9 + c / 10;
        c *= shrink;
        if (minN > 1)
            c /= minN;
    }
    else {
        c = n > 1 ? d / n : d;
        if (d === Infinity && n >= 2)
            c = up / n - lo / n;
    }
    const tiny = 2 ** -20 * DBL_MIN;
    if (c < tiny)
        c = tiny;
    else if (c > Number.MAX_VALUE / 1.25)
        c = Number.MAX_VALUE / 1.25;
    // Step 2: the unit, walking up b, 2b, 5b, 10b while the larger unit is close enough
    const b = 10 ** Math.floor(Math.log10(c));
    const steps = [
        [2 * b, h],
        [5 * b, h5],
        [10 * b, h],
    ];
    let u = b;
    for (const [next, w] of steps) {
        if (next - c < w * (c - u))
            u = next;
        else
            break;
    }
    // Step 3: integer multiples of the unit covering the data
    const rho = 1e-10;
    let s = Math.floor(lo / u + rho);
    while (s * u > lo + rho * u)
        s--;
    while (!Number.isFinite(s * u))
        s++;
    let t = Math.ceil(up / u - rho);
    while (t * u < up - rho * u)
        t++;
    while (!Number.isFinite(t * u))
        t--;
    // Step 4: at least minN cells
    let k = Math.trunc(0.5 + t - s);
    if (k < minN) {
        const e = minN - k;
        const half = Math.floor(e / 2);
        const odd = e % 2;
        if (lo === 0 && s === 0 && up !== 0)
            t += e;
        else if (up === 0 && t === 0 && lo !== 0)
            s -= e;
        else if (s >= 0) {
            t += half;
            s -= half + odd;
        }
        else {
            s -= half;
            t += half + odd;
        }
        k = minN;
    }
    // Step 5: end points (kept at the data ends when the multiples are within the rounding allowance)
    const L = s * u < lo ? s * u : lo;
    const U = t * u > up ? t * u : up;
    // Step 6: the sequence, with values that are zero up to rounding set to 0
    if (k <= 0)
        return [L];
    let out;
    if (Number.isFinite(U - L))
        out = seqLength(L, U, k + 1);
    else {
        // U - L overflows: step by U/k - L/k instead
        const step = U / k - L / k;
        out = Array.from({ length: k + 1 }, (_, i) => L + i * step);
        out[k] = U;
    }
    const delta = U / k - L / k;
    return out.map((v) => (Math.abs(v) < 1e-14 * delta ? 0 : v));
}
/** Smallest positive normal double */
const DBL_MIN = 2.2250738585072014e-308;
/** Rounding to 5 significant decimal digits (0 and non-finite values unchanged) */
function round5(v) {
    return v === 0 || !Number.isFinite(v) ? v : Number(v.toPrecision(5));
}
/** Suggested number of classes for the data `xs` (finite values) by the named rule */
function classCount(xs, rule) {
    const n = xs.length;
    const [lo, hi] = range(xs);
    const r = hi - lo;
    switch (rule.toLowerCase()) {
        case "sturges":
            return Math.ceil(Math.log2(n) + 1);
        case "scott": {
            const h = 3.5 * sd(xs) * n ** (-1 / 3);
            return h > 0 ? Math.max(1, Math.ceil(r / h)) : 1;
        }
        case "fd":
        case "freedman-diaconis": {
            const xr = xs.map(round5);
            let h = 2 * IQR(xr);
            for (let alpha = 1 / 8; h === 0 && alpha >= 1 / 512; alpha /= 2) {
                const [qa, qb] = quantile(xr, [alpha, 1 - alpha]);
                h = (qb - qa) / (1 - 2 * alpha);
            }
            if (h === 0)
                h = 3.5 * sd(xs);
            return h > 0 ? Math.ceil((r / h) * n ** (1 / 3)) : 1;
        }
        default:
            throw new RangeError("unknown 'breaks' algorithm");
    }
}
/** Reference cell size for the counting fuzz: median width (> 5 breaks), data range (<= 3), smallest positive width */
function fuzzScale(br, dataRange) {
    const widths = br.slice(1).map((v, i) => v - br[i]);
    if (br.length > 5)
        return median(widths);
    if (br.length <= 3)
        return dataRange;
    return Math.min(...widths.filter((w) => w > 0));
}
/**
 * Histogram counts. Equivalent to R's `hist(x, plot = FALSE)`. Break points (by default pretty points over the range
 * with about Sturges' number of cells), counts, densities and cell midpoints. Non-finite values are dropped.
 *
 * @example
 * ```ts
 * hist([1, 2, 2, 3, 3, 3, 4]).counts; // [3, 3, 1] (for breaks [1, 2, 3, 4])
 * ```
 *
 * @category Descriptive statistics
 */
export function hist(x, options = {}) {
    const xs = Array.from(x).filter(Number.isFinite);
    const n = xs.length;
    const right = options.right ?? true;
    let includeLowest = options.includeLowest ?? true;
    const spec = options.breaks ?? "Sturges";
    let br;
    if (typeof spec !== "string" && typeof spec !== "number" && spec.length > 1) {
        br = [...spec].sort((a, b) => a - b);
    }
    else {
        includeLowest = true;
        let k = typeof spec === "string" ? classCount(xs, spec) : typeof spec === "number" ? spec : spec[0];
        if (!Number.isFinite(k) || k < 1)
            throw new RangeError("invalid number of 'breaks'");
        k = Math.min(k, 1e6);
        const [lo, hi] = range(xs);
        br = pretty([lo, hi], { n: k, minN: 1 });
        for (let i = 1; i < br.length; i++) {
            if (!(br[i] - br[i - 1] > 0))
                throw new RangeError("'breaks' are not strictly increasing");
        }
    }
    const nb = br.length;
    // Breaks moved by a small tolerance so that values on a break up to rounding fall on the intended side
    const [dlo, dhi] = n > 0 ? range(xs) : [0, 0];
    const tau = 1e-7 * fuzzScale(br, dhi - dlo);
    const f = br.map((v, i) => {
        if (right)
            return i === 0 && includeLowest ? v - tau : v + tau;
        if (i < nb - 1)
            return v - tau;
        return includeLowest ? v + tau : v - tau;
    });
    const counts = new Array(Math.max(0, nb - 1)).fill(0);
    let total = 0;
    for (const v of xs) {
        const cell = cellOf(v, f, right, includeLowest);
        if (cell >= 0) {
            counts[cell]++;
            total++;
        }
    }
    if (total < n)
        throw new RangeError("some 'x' not counted; maybe 'breaks' do not span range of 'x'");
    const density = counts.map((c, i) => c / (n * (br[i + 1] - br[i])));
    const mids = counts.map((_, i) => 0.5 * (br[i + 1] + br[i]));
    return { breaks: br, counts, density, mids };
}
/** 0-based cell of `v` among the (shifted) breaks `f`, or -1 when it is in no cell */
function cellOf(v, f, right, includeLowest) {
    const last = f.length - 1;
    if (last < 1)
        return -1;
    if (right) {
        if (v === f[0] && includeLowest)
            return 0;
        if (!(v > f[0] && v <= f[last]))
            return -1;
        // smallest j with v <= f[j]; the cell is j - 1
        let a = 1;
        let b = last;
        while (a < b) {
            const m = (a + b) >> 1;
            if (v <= f[m])
                b = m;
            else
                a = m + 1;
        }
        return a - 1;
    }
    if (v === f[last] && includeLowest)
        return last - 1;
    if (!(v >= f[0] && v < f[last]))
        return -1;
    // largest j with f[j] <= v; the cell is j
    let a = 0;
    let b = last - 1;
    while (a < b) {
        const m = (a + b + 1) >> 1;
        if (f[m] <= v)
            a = m;
        else
            b = m - 1;
    }
    return a;
}
/**
 * Empirical distribution function of `x`: a function returning the fraction of values at or below its argument.
 * Equivalent to R's `ecdf()`. `NaN` values are dropped.
 *
 * @example
 * ```ts
 * ecdf([3, 1, 2])(2); // 0.6666666666666666
 * ```
 *
 * @category Descriptive statistics
 */
export function ecdf(x) {
    const s = Array.from(x)
        .filter((v) => !Number.isNaN(v))
        .sort((a, b) => a - b);
    const n = s.length;
    if (n < 1)
        throw new RangeError("'x' must have 1 or more non-missing values");
    return (q) => {
        if (Number.isNaN(q))
            return NaN;
        let lo = 0;
        let hi = n;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (s[mid] <= q)
                lo = mid + 1;
            else
                hi = mid;
        }
        return lo / n;
    };
}
