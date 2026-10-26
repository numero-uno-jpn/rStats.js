// Rank-based k-sample and two-sample tests: R's kruskal.test, friedman.test, quade.test, fligner.test and mood.test,
// and DescTools' CochranQTest (the Friedman test of a 0/1 matrix, from oracle/rm-tests-behaviour.md).
//
// Written for rStats.js from the published statistics (no ported code), with ties handled by average ranks:
// - Kruskal and Wallis (JASA 47, 1952): H = (12 / (N (N + 1)) sum R_i^2 / n_i - 3 (N + 1)) / (1 - sum (t^3 - t) /
//   (N^3 - N)), chi-squared with k - 1 degrees of freedom.
// - Friedman (JASA 32, 1937), ranks within blocks: 12 sum (R_j - n (k + 1) / 2)^2 / (n k (k + 1) - sum (t^3 - t) /
//   (k - 1)), chi-squared with k - 1 degrees of freedom.
// - Quade (JASA 74, 1979), as given by Conover (Practical Nonparametric Statistics, 1999, section 5.8): blocks ranked
//   by their range, Q_i, S_ij = Q_i (R_ij - (k + 1) / 2), A = sum S_ij^2, B = sum_j (sum_i S_ij)^2 / b,
//   F = (b - 1) B / (A - B) on (k - 1, (b - 1)(k - 1)) degrees of freedom; when A = B (all treatments tied within
//   every block's order) the p-value is (1 / k!)^(b - 1), as Conover suggests.
// - Fligner and Killeen (JASA 71, 1976), centred at the group medians: scores a = qnorm((1 + rank|x| / (N + 1)) / 2),
//   statistic sum n_i (mean a_i - mean a)^2 / var(a), chi-squared with k - 1 degrees of freedom (the median-centred
//   form of Conover, Johnson and Johnson, Technometrics 23, 1981).
// - Mood (Ann. Math. Stat. 25, 1954): scores (i - (N + 1) / 2)^2 by position, averaged over tied positions (Mielke,
//   Technometrics 9, 1967); the sum over the first sample is standardised with the exact mean and variance of a linear
//   rank statistic, E = m mean(a), V = m n / (N (N - 1)) sum (a_i - mean(a))^2, and compared with the normal.
import { pf1 } from "../distributions/f.js";
import { pgamma1 } from "../distributions/gamma.js";
import { pnorm, qnorm } from "../distributions/normal.js";
import { rank, tieCounts, variance } from "../internal/summary.js";
import { completeRows, median, toGroups } from "./groups.js";
import { matchAlternative } from "./types.js";
function chisqResult(method, name, statistic, df) {
    return {
        method,
        statistic,
        statisticName: name,
        parameter: df,
        parameterName: "df",
        pValue: pgamma1(statistic, df / 2, 2, false, false),
    };
}
function sumTies(x) {
    let s = 0;
    for (const t of tieCounts(x))
        s += t * t * t - t;
    return s;
}
/**
 * Kruskal-Wallis rank sum test. Equivalent to R's `kruskal.test()`.
 *
 * @param x An array of samples (each with at least one non-missing value, as R requires), or one sample with group
 *   labels `g`.
 * @param g Group labels, parallel to `x`.
 */
export function kruskalTest(x, g) {
    const groups = toGroups(x, g, "error");
    const k = groups.length;
    if (k < 2)
        throw new RangeError("all observations are in the same group");
    const all = groups.flat();
    const n = all.length;
    const r = rank(all);
    let stat = 0;
    let pos = 0;
    for (const grp of groups) {
        let s = 0;
        for (let i = 0; i < grp.length; i++)
            s += r[pos + i];
        pos += grp.length;
        stat += (s * s) / grp.length;
    }
    stat = ((12 * stat) / (n * (n + 1)) - 3 * (n + 1)) / (1 - sumTies(all) / (n * n * n - n));
    return chisqResult("Kruskal-Wallis rank sum test", "Kruskal-Wallis chi-squared", stat, k - 1);
}
/**
 * Friedman rank sum test for an unreplicated complete block design. Equivalent to R's `friedman.test()` with a
 * matrix.
 *
 * @param y Blocks as rows, treatments as columns. Rows with a missing value are dropped.
 */
export function friedmanTest(y) {
    const rows = completeRows(y);
    const n = rows.length;
    const k = y[0]?.length ?? 0;
    // R needs two complete blocks (with one, its matrix of ranks collapses to a vector)
    if (n < 2 || k < 2)
        throw new RangeError("'y' must have at least two complete rows and two columns");
    const colSums = new Array(k).fill(0);
    let ties = 0;
    for (const row of rows) {
        const r = rank(row);
        for (let j = 0; j < k; j++)
            colSums[j] += r[j];
        ties += sumTies(row);
    }
    let ss = 0;
    for (const s of colSums)
        ss += (s - (n * (k + 1)) / 2) ** 2;
    const stat = (12 * ss) / (n * k * (k + 1) - ties / (k - 1));
    return chisqResult("Friedman rank sum test", "Friedman chi-squared", stat, k - 1);
}
/**
 * Cochran's Q test for binary responses in an unreplicated complete block design. Equivalent to DescTools'
 * `CochranQTest()` with a matrix: the Friedman test of the 0/1 matrix (with ties), reported as Q.
 *
 * @param y Blocks as rows, treatments as columns, values 0 or 1. Rows with a missing value are dropped.
 */
export function cochranQTest(y) {
    return { ...friedmanTest(y), method: "Cochran's Q test", statisticName: "Q" };
}
/**
 * Quade test for an unreplicated complete block design. Equivalent to R's `quade.test()` with a matrix.
 *
 * @param y Blocks as rows, treatments as columns. Rows with a missing value are dropped.
 */
export function quadeTest(y) {
    const rows = completeRows(y);
    // as in R, b counts all blocks, including those dropped for a missing value
    const b = y.length;
    const k = y[0]?.length ?? 0;
    if (rows.length < 2 || k < 2)
        throw new RangeError("'y' must have at least two complete rows and two columns");
    const q = rank(rows.map((r) => Math.max(...r) - Math.min(...r)));
    const colS = new Array(k).fill(0);
    let A = 0;
    rows.forEach((row, i) => {
        const r = rank(row);
        for (let j = 0; j < k; j++) {
            const s = q[i] * (r[j] - (k + 1) / 2);
            A += s * s;
            colS[j] += s;
        }
    });
    let B = 0;
    for (const s of colS)
        B += s * s;
    B /= b;
    const df1 = k - 1;
    const df2 = (b - 1) * (k - 1);
    let statistic;
    let pValue;
    let parameter = [df1, df2];
    if (A === B) {
        statistic = NaN;
        parameter = [NaN, NaN];
        // log-gamma form of (k!)^(1 - b), which overflows directly for large b
        let lf = 0;
        for (let i = 2; i <= k; i++)
            lf += Math.log(i);
        pValue = Math.exp((1 - b) * lf);
    }
    else {
        statistic = ((b - 1) * B) / (A - B);
        pValue = pf1(statistic, df1, df2, false, false);
    }
    return {
        method: "Quade test",
        statistic,
        statisticName: "Quade F",
        parameter,
        parameterName: ["num df", "denom df"],
        pValue,
    };
}
/**
 * Fligner-Killeen (median) test of homogeneity of variances. Equivalent to R's `fligner.test()`.
 *
 * @param x An array of samples (each with at least one non-missing value, as R requires), or one sample with group
 *   labels `g`.
 * @param g Group labels, parallel to `x`.
 */
export function flignerTest(x, g) {
    const groups = toGroups(x, g, "error");
    const k = groups.length;
    if (k < 2)
        throw new RangeError("all observations are in the same group");
    const centred = groups.flatMap((grp) => {
        const m = median(grp);
        return grp.map((v) => Math.abs(v - m));
    });
    const n = centred.length;
    const r = rank(centred);
    const a = r.map((v) => qnorm((1 + v / (n + 1)) / 2));
    let total = 0;
    for (const v of a)
        total += v;
    const abar = total / n;
    // sum n_i (mean a_i - mean a)^2: the form sum S_i^2 / n_i - n mean(a)^2 cancels when the statistic is small
    let stat = 0;
    let pos = 0;
    for (const grp of groups) {
        let s = 0;
        for (let i = 0; i < grp.length; i++)
            s += a[pos + i];
        pos += grp.length;
        stat += grp.length * (s / grp.length - abar) ** 2;
    }
    stat /= variance(a);
    return chisqResult("Fligner-Killeen test of homogeneity of variances", "Fligner-Killeen:med chi-squared", stat, k - 1);
}
/**
 * Mood's two-sample test of scale. Equivalent to R's `mood.test()`. `NaN` values are dropped; ties get the average
 * of the scores of their positions.
 */
export function moodTest(x, y, options = {}) {
    // as in R, infinite values are dropped along with NaN
    const xs = Array.from(x).filter(Number.isFinite);
    const ys = Array.from(y).filter(Number.isFinite);
    const alternative = matchAlternative(options.alternative);
    const m = xs.length;
    const n = ys.length;
    const N = m + n;
    if (N < 3)
        throw new RangeError("not enough observations");
    const z = xs.concat(ys);
    // positions in sorted order; tied values share the mean of the scores of their positions
    const order = Array.from({ length: N }, (_, i) => i).sort((p, q) => z[p] - z[q]);
    const a = new Array(N);
    let i = 0;
    while (i < N) {
        let j = i;
        while (j + 1 < N && z[order[j + 1]] === z[order[i]])
            j++;
        let s = 0;
        for (let t = i; t <= j; t++)
            s += (t + 1 - (N + 1) / 2) ** 2;
        s /= j - i + 1;
        for (let t = i; t <= j; t++)
            a[order[t]] = s;
        i = j + 1;
    }
    let T = 0;
    for (let t = 0; t < m; t++)
        T += a[t];
    let abar = 0;
    for (const v of a)
        abar += v;
    abar /= N;
    let ss = 0;
    for (const v of a)
        ss += (v - abar) ** 2;
    const E = m * abar;
    const V = ((m * n) / (N * (N - 1))) * ss;
    const zstat = (T - E) / Math.sqrt(V);
    const pValue = alternative === "less"
        ? pnorm(zstat)
        : alternative === "greater"
            ? pnorm(zstat, { lowerTail: false })
            : 2 * pnorm(-Math.abs(zstat));
    return { method: "Mood two-sample test of scale", alternative, statistic: zstat, statisticName: "Z", pValue };
}
