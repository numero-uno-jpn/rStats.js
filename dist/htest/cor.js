// Correlation coefficient (R's cor for two vectors) and correlation test (R's cor.test).
//
// Sources and basis:
// - Pearson's t statistic, the Fisher z interval and Kendall's tie-corrected variance use the same
//   formulas as scipy.stats pearsonr (scipy/stats/_stats_py.py) and kendalltau
//   (scipy/stats/_mstats_basic.py; SciPy commit a087e61, BSD-3-Clause, see THIRD_PARTY_NOTICES.md)
// - Kendall's exact distribution (distribution of inversions in permutations) uses the same recurrence
//   as _kendall_p_exact in _mstats_basic.py
//   (Kendall, Rank Correlation Methods). It normalises to probabilities as it goes and only counts the smaller tail
// - Spearman's exact method was written from the formulas in Best & Roberts (1975), Algorithm AS 89:
//   small n enumerates all permutations, large n uses an Edgeworth series approximation. R's implementation was not read
// Matched to R (from observing R's output):
// - Pairs containing NaN are dropped (Inf is kept). Pearson needs at least 3 pairs, Kendall and Spearman at least 2
// - Kendall's exact method is the default when n < 50 and there are no ties. Even with exact = true, ties force the normal approximation
// - Spearman's exact method (AS 89) is the default when n <= 1290 and there are no ties (off by one from "n < 1290" in R's help).
//   Within AS 89, n <= 9 is enumerated exactly and n >= 10 uses the Edgeworth series (this n <= 9 switch follows
//   R's behaviour). With ties, the t approximation is used
// - continuity only affects the approximations. For Kendall it moves S one step towards 0. For Spearman it
//   replaces rho with (rho + 6 / (n^3 - n)) / (1 + 6 / (n^3 - n)) (regardless of sign or alternative; R's behaviour)
// - When the correlation is undefined (constant data), the statistic, p-value, estimate and interval are NaN. Kendall's
//   statistic is then always named "T"
// - confLevel is validated only for Pearson. The interval is only reported with 4 or more pairs
// More accurate than R: the correlation coefficient, 1 - r^2 and the continuity-corrected rho are computed in double-double.
// R's cor is off by about 1e-10 for data with a large mean (1e8 + small spread), and does not give 1 even for perfect correlation (1 - 2 ulp).
// Hence R's t statistic and p-value deviate strongly when r is near ±1 (judged against the oracle reference values)
import { pt1 } from "../distributions/t.js";
import { pnorm, qnorm } from "../distributions/normal.js";
import { ddAdd, ddDiv, ddMul, ddSub, twoProd, twoSum } from "../special/dd.js";
import { completePairs, meanDD, rank, tieCounts } from "../internal/summary.js";
import { checkConfLevel, matchAlternative } from "./types.js";
const METHODS = ["pearson", "kendall", "spearman"];
function matchMethod(m) {
    if (m === undefined)
        return "pearson";
    const hit = METHODS.filter((v) => v.startsWith(m));
    if (m.length === 0 || hit.length !== 1)
        throw new RangeError(`invalid method "${m}"`);
    return hit[0];
}
/**
 * Correlation coefficient of two vectors. Equivalent to R's `cor(x, y)`.
 *
 * Returns `NaN` if either vector contains `NaN` (R's default `use = "everything"`) or if
 * the correlation is undefined (constant data). The Pearson coefficient is computed in
 * double-double arithmetic, so it can be slightly more accurate than R's (for example,
 * exactly 1 for perfectly correlated data).
 *
 * @param x First vector.
 * @param y Second vector, of the same length as `x`.
 * @param options See {@link CorOptions}.
 * @returns The correlation coefficient.
 */
export function cor(x, y, options = {}) {
    const method = matchMethod(options.method);
    const xs = Array.from(x);
    const ys = Array.from(y);
    if (xs.length !== ys.length)
        throw new TypeError("x and y must have the same length");
    if (xs.some(Number.isNaN) || ys.some(Number.isNaN))
        return NaN;
    if (method === "pearson")
        return pearsonDD(xs, ys)[0];
    if (method === "kendall")
        return kendall(xs, ys).tau;
    return pearsonDD(rank(xs), rank(ys))[0];
}
// ---- Pearson ----
function ddSqrt(a) {
    if (!(a[0] > 0))
        return [Math.sqrt(a[0]), 0];
    const s = Math.sqrt(a[0]);
    const e = ddSub(a, twoProd(s, s));
    return twoSum(s, e[0] / (2 * s));
}
/** Deviations (mean subtracted in double-double, scaled by a power of 2 to be near 1). Correlation is scale-invariant */
function scaledDeviations(x) {
    const m = meanDD(x);
    if (!Number.isFinite(m[0]))
        return undefined;
    const d = x.map((v) => ddSub([v, 0], m));
    let mx = 0;
    for (const v of d)
        mx = Math.max(mx, Math.abs(v[0]));
    if (mx === 0)
        return d;
    const f = 2 ** -Math.max(-1022, Math.floor(Math.log2(mx)));
    return d.map((v) => [v[0] * f, v[1] * f]);
}
/** Pearson's correlation coefficient in double-double (so 1 - r is computed without cancellation near perfect correlation) */
export function pearsonDD(x, y) {
    const n = x.length;
    if (n < 2)
        return [NaN, 0];
    const dx = scaledDeviations(x);
    const dy = scaledDeviations(y);
    if (dx === undefined || dy === undefined)
        return [NaN, 0];
    let sxy = [0, 0];
    let sxx = [0, 0];
    let syy = [0, 0];
    for (let i = 0; i < n; i++) {
        sxy = ddAdd(sxy, ddMul(dx[i], dy[i]));
        sxx = ddAdd(sxx, ddMul(dx[i], dx[i]));
        syy = ddAdd(syy, ddMul(dy[i], dy[i]));
    }
    if (sxx[0] === 0 || syy[0] === 0)
        return [NaN, 0];
    const r = ddDiv(sxy, ddMul(ddSqrt(sxx), ddSqrt(syy)));
    if (r[0] >= 1)
        return [1, 0];
    if (r[0] <= -1)
        return [-1, 0];
    return r;
}
/** sqrt(df) r / sqrt(1 - r^2), with 1 - r^2 = (1 - r)(1 + r) in double-double */
function tFromR(r, df) {
    const q = ddMul(ddSub([1, 0], r), ddAdd([1, 0], r));
    return (Math.sqrt(df) * r[0]) / Math.sqrt(q[0]);
}
function atanhDD(r) {
    if (Math.abs(r[0]) < 0.5)
        return Math.atanh(r[0]);
    return 0.5 * Math.log(ddAdd([1, 0], r)[0] / ddSub([1, 0], r)[0]);
}
/** p-value from the t distribution */
function pFromT(t, df, alternative) {
    if (alternative === "less")
        return pt1(t, df, true, false);
    if (alternative === "greater")
        return pt1(t, df, false, false);
    return 2 * Math.min(pt1(t, df, true, false), pt1(t, df, false, false));
}
function pFromZ(z, alternative) {
    if (alternative === "less")
        return pnorm(z);
    if (alternative === "greater")
        return pnorm(z, { lowerTail: false });
    return 2 * Math.min(pnorm(z), pnorm(z, { lowerTail: false }));
}
/** Count concordant and discordant pairs (O(n^2)). Two Infs are tied */
export function kendall(x, y) {
    const n = x.length;
    let s = 0;
    for (let i = 0; i < n; i++) {
        const xi = x[i];
        const yi = y[i];
        for (let j = i + 1; j < n; j++) {
            const a = (x[j] > xi ? 1 : 0) - (x[j] < xi ? 1 : 0);
            const b = (y[j] > yi ? 1 : 0) - (y[j] < yi ? 1 : 0);
            s += a * b;
        }
    }
    const tx = tieCounts(x);
    const ty = tieCounts(y);
    const pairs = (n * (n - 1)) / 2;
    const px = tx.reduce((a, t) => a + (t * (t - 1)) / 2, 0);
    const py = ty.reduce((a, t) => a + (t * (t - 1)) / 2, 0);
    // With ties, tau-b
    const tau = n < 2 || px === pairs || py === pairs ? NaN : px === 0 && py === 0 ? s / pairs : s / Math.sqrt((pairs - px) * (pairs - py));
    return { s, tau, ties: tx.length > 0 || ty.length > 0, tx, ty };
}
/**
 * Probability that a permutation of n distinct elements has at most c inversions. The inversion
 * distribution is symmetric, so the upper tail P(T >= q) is computed as P(T <= N - q) (N = n(n-1)/2).
 * Same recurrence as scipy's _kendall_p_exact, normalised to probabilities and run only over 0..c
 */
function kendallCdf(n, c) {
    const total = (n * (n - 1)) / 2;
    if (c < 0)
        return 0;
    if (c >= total)
        return 1;
    let p = new Float64Array(c + 1);
    p[0] = 1;
    for (let j = 2; j <= n; j++) {
        // Inserting the next element increases the inversion count by 0..j-1 (uniformly)
        const cum = new Float64Array(c + 1);
        let acc = 0;
        for (let k = 0; k <= c; k++) {
            acc += p[k];
            cum[k] = acc;
        }
        const next = new Float64Array(c + 1);
        for (let k = 0; k <= c; k++)
            next[k] = (cum[k] - (k >= j ? cum[k - j] : 0)) / j;
        p = next;
    }
    let sum = 0;
    for (let k = c; k >= 0; k--)
        sum += p[k];
    return Math.min(1, sum);
}
// ---- Spearman (AS 89) ----
/** Frequencies of S = Σ d^2 for n <= 9 (enumerating all permutations by dynamic programming over subsets) */
const spearmanCountsCache = new Map();
function spearmanCounts(n) {
    const cached = spearmanCountsCache.get(n);
    if (cached !== undefined)
        return cached;
    const maxS = (n * (n * n - 1)) / 3;
    const size = 1 << n;
    // dp[mask] holds the frequencies of S "when the values in mask are placed in the first popcount(mask) positions"
    const dp = new Array(size);
    dp[0] = new Float64Array(maxS + 1);
    dp[0][0] = 1;
    const pop = (m) => {
        let c = 0;
        for (; m; m &= m - 1)
            c++;
        return c;
    };
    for (let mask = 0; mask < size; mask++) {
        const cur = dp[mask];
        if (cur === undefined)
            continue;
        const pos = pop(mask);
        for (let v = 0; v < n; v++) {
            if (mask & (1 << v))
                continue;
            const d2 = (v - pos) ** 2;
            const nm = mask | (1 << v);
            const dst = (dp[nm] ??= new Float64Array(maxS + 1));
            for (let s = 0; s + d2 <= maxS; s++)
                if (cur[s])
                    dst[s + d2] += cur[s];
        }
        if (mask !== size - 1)
            dp[mask] = undefined;
    }
    const out = dp[size - 1];
    spearmanCountsCache.set(n, out);
    return out;
}
// Coefficients of the AS 89 Edgeworth series
const C = [0.2274, 0.2531, 0.1745, 0.0758, 0.1033, 0.3932, 0.0879, 0.0151, 0.0072, 0.0831, 0.0131, 4.6e-4];
/**
 * P(S >= is) from the AS 89 Edgeworth series. With lower = true, returns 1 - P(S >= is)
 * without subtractive cancellation. is is rounded up to even, then the continuity correction (is - 1) is applied
 */
function spearmanEdgeworth(n, is, lower) {
    let js = is;
    if (js % 2 !== 0)
        js += 1;
    const b = 1 / n;
    const x = ((6 * (js - 1) * b) / (n * n - 1) - 1) * Math.sqrt(1 / b - 1);
    const y = x * x;
    const u = x *
        b *
        (C[0] +
            b * (C[1] + C[2] * b) +
            y * (-C[3] + b * (C[4] + C[5] * b) - y * b * (C[6] + C[7] * b - y * (C[8] - C[9] * b + y * b * (C[10] - C[11] * y)))));
    const e = u / Math.exp(y / 2);
    const p = lower ? pnorm(x) - e : e + pnorm(x, { lowerTail: false });
    return Math.min(1, Math.max(0, p));
}
/** P(S >= q) (lower = false) or P(S <= q) (lower = true). q is an integer */
function spearmanTail(n, q, lower) {
    const maxS = (n * (n * n - 1)) / 3;
    if (n <= 9) {
        const counts = spearmanCounts(n);
        let fact = 1;
        for (let k = 2; k <= n; k++)
            fact *= k;
        let c = 0;
        if (lower)
            for (let s = Math.min(q, maxS); s >= 0; s--)
                c += counts[s];
        else
            for (let s = maxS; s >= Math.max(q, 0); s--)
                c += counts[s];
        return c / fact;
    }
    if (lower) {
        // P(S <= q) = 1 - P(S >= q + 1)
        if (q + 1 > maxS)
            return 1;
        if (q + 1 <= 0)
            return 0;
        return spearmanEdgeworth(n, q + 1, true);
    }
    if (q <= 0)
        return 1;
    if (q > maxS)
        return 0;
    return spearmanEdgeworth(n, q, false);
}
// ---- cor.test ----
/**
 * Test for correlation between paired samples. Equivalent to R's `cor.test()`.
 *
 * Supports Pearson's product-moment correlation (t test, with a Fisher-z confidence
 * interval), Kendall's tau and Spearman's rho (exact or approximate p-values, chosen by
 * the same rules as R). Pairs containing `NaN` are dropped; Pearson needs at least 3
 * pairs and the others at least 2. If the correlation is undefined (constant data) the
 * statistic, p-value and estimate are `NaN`. Correlations are computed in double-double
 * arithmetic, so results can differ from R's when r is very close to ±1, where R's own
 * value is less accurate.
 *
 * @param x First sample.
 * @param y Second sample, of the same length as `x`.
 * @param options See {@link CorTestOptions}.
 * @returns The test result; see {@link CorTestResult}.
 *
 * @example
 * ```ts
 * const r = corTest([1, 2, 3, 4, 5, 6], [2, 1, 4, 3, 7, 8]);
 * r.estimate;  // 0.9014600868406593
 * r.statistic; // 4.165113148435108 (t, df = 4)
 * r.pValue;    // 0.01408675480909387
 *
 * corTest([1, 2, 3, 4, 5, 6], [2, 1, 4, 3, 7, 8], { method: "spearman" });
 * ```
 */
export function corTest(x, y, options = {}) {
    if (x.length !== y.length)
        throw new TypeError("x and y must have the same length");
    const alternative = matchAlternative(options.alternative);
    const method = matchMethod(options.method);
    const continuity = options.continuity ?? false;
    const [xs, ys] = completePairs(Array.from(x), Array.from(y));
    const n = xs.length;
    if (method === "pearson") {
        const confLevel = options.confLevel ?? 0.95;
        checkConfLevel(confLevel);
        if (n < 3)
            throw new Error("not enough finite observations");
        const r = pearsonDD(xs, ys);
        const df = n - 2;
        const t = Number.isNaN(r[0]) ? NaN : tFromR(r, df);
        const result = {
            method: "Pearson's product-moment correlation",
            alternative,
            statistic: t,
            statisticName: "t",
            parameter: df,
            parameterName: "df",
            pValue: pFromT(t, df, alternative),
            estimate: r[0],
            estimateNames: "cor",
            nullValue: 0,
            nullValueName: "correlation",
        };
        if (n > 3) {
            const z = atanhDD(r);
            const sigma = 1 / Math.sqrt(n - 3);
            // Interval endpoint tanh(z + d). With perfect correlation (z = ±Inf) and d infinite in the opposite direction
            // (confLevel 0 or 1), the result is NaN, as in R
            const end = (d) => Math.tanh(z + d);
            let ci;
            if (alternative === "less")
                ci = [-1, end(sigma * qnorm(confLevel))];
            else if (alternative === "greater")
                ci = [end(-sigma * qnorm(confLevel)), 1];
            else {
                const c = sigma * qnorm((1 + confLevel) / 2);
                ci = [end(-c), end(c)];
            }
            result.confInt = ci;
            result.confLevel = confLevel;
        }
        return result;
    }
    if (n < 2)
        throw new Error("not enough finite observations");
    if (method === "kendall") {
        const k = kendall(xs, ys);
        const base = {
            method: "Kendall's rank correlation tau",
            alternative,
            estimate: k.tau,
            estimateNames: "tau",
            nullValue: 0,
            nullValueName: "tau",
        };
        if (Number.isNaN(k.tau))
            return { ...base, statistic: NaN, statisticName: "T", pValue: NaN };
        const exact = options.exact ?? n < 50;
        if (exact && !k.ties) {
            const total = (n * (n - 1)) / 2;
            const q = (k.s + total) / 2;
            // P(T <= q) and P(T >= q) = P(T <= total - q)
            const lowerP = kendallCdf(n, q);
            const upperP = kendallCdf(n, total - q);
            const p = alternative === "less" ? lowerP : alternative === "greater" ? upperP : Math.min(1, 2 * Math.min(lowerP, upperP));
            return { ...base, statistic: q, statisticName: "T", pValue: p };
        }
        // Normal approximation (tie-corrected variance)
        const v = (f, ts) => ts.reduce((a, t) => a + f(t), 0);
        const a2 = (t) => t * (t - 1);
        const a3 = (t) => t * (t - 1) * (t - 2);
        const a5 = (t) => t * (t - 1) * (2 * t + 5);
        const varS = (n * (n - 1) * (2 * n + 5) - v(a5, k.tx) - v(a5, k.ty)) / 18 +
            (v(a3, k.tx) * v(a3, k.ty)) / (9 * n * (n - 1) * (n - 2)) +
            (v(a2, k.tx) * v(a2, k.ty)) / (2 * n * (n - 1));
        const s = continuity ? Math.sign(k.s) * (Math.abs(k.s) - 1) : k.s;
        const z = s / Math.sqrt(varS);
        return { ...base, statistic: z, statisticName: "z", pValue: pFromZ(z, alternative) };
    }
    // spearman
    const rx = rank(xs);
    const ry = rank(ys);
    const rho = pearsonDD(rx, ry);
    const n3 = n * n * n - n;
    const S = (n3 * (1 - rho[0])) / 6;
    const base = {
        method: "Spearman's rank correlation rho",
        alternative,
        statistic: S,
        statisticName: "S",
        estimate: rho[0],
        estimateNames: "rho",
        nullValue: 0,
        nullValueName: "rho",
    };
    if (Number.isNaN(rho[0]))
        return { ...base, pValue: NaN };
    const ties = tieCounts(xs).length > 0 || tieCounts(ys).length > 0;
    const exact = options.exact ?? n <= 1290;
    if (exact && !ties && n <= 1290) {
        const q = Math.round(S);
        const lowerP = spearmanTail(n, q, true);
        const upperP = spearmanTail(n, q, false);
        // Smaller S means positive correlation
        const p = alternative === "greater" ? lowerP : alternative === "less" ? upperP : Math.min(1, 2 * Math.min(lowerP, upperP));
        return { ...base, pValue: p };
    }
    // t approximation. The continuity-corrected rho is also in double-double (1 - rho^2 cancels when rho is near ±1)
    let r = rho;
    if (continuity) {
        const d = ddDiv([6, 0], [n3, 0]);
        r = ddDiv(ddAdd(rho, d), ddAdd([1, 0], d));
        if (Math.abs(r[0]) >= 1)
            r = [Math.sign(r[0]), 0];
    }
    const t = tFromR(r, n - 2);
    return { ...base, pValue: pFromT(t, n - 2, alternative) };
}
