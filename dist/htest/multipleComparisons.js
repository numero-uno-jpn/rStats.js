// Multiple comparisons after a one-way layout: PMCMRplus's dscfAllPairsTest, kwAllPairsDunnTest, kwManyOneDunnTest,
// dunnettTest, gamesHowellTest, tukeyTest, steelTest and manyOneUTest, dunn.test's dunn.test and multcomp's Dunnett contrasts
// (summary(glht(aov(y ~ g), mcp(g = "Dunnett")))).
//
// Written for rStats.js from the published statistics and the behaviour described in oracle/mcomp-behaviour.md (no
// ported code):
// - Dunn (Technometrics 6, 1964): z = (mean rank difference) / sqrt((N (N + 1) / 12 - C) (1/n_i + 1/n_j)) with the
//   tie term C = sum (t^3 - t) / (12 (N - 1)).
// - Dunnett (JASA 50, 1955): t = (m_j - m_1) / (s sqrt(1/n_j + 1/n_1)) with the pooled s; the simultaneous
//   probabilities are computed exactly by src/htest/dunnett.ts (R computes them by randomised integration).
// - Dwass (1960), Steel (1960), Critchlow and Fligner (1991): pairwise Mann-Whitney statistics standardised and
//   compared with the studentized range for k means and infinite degrees of freedom.
// - Steel (Biometrics 15, 1959): the Mann-Whitney statistic of each group against the control, standardised, with
//   simultaneous normal probabilities for the correlations of Dunnett's many-to-one comparisons.
// - Games and Howell (1976): Welch's standard error and degrees of freedom per pair, studentized range.
// - Tukey (1953), Tukey-Kramer: the pooled standard error, studentized range on N - k degrees of freedom.
import { pnorm } from "../distributions/normal.js";
import { ptukey } from "../distributions/tukey.js";
import { mean, rank, tieCounts, variance } from "../internal/summary.js";
import { pDunnettUpper } from "./dunnett.js";
import { labelledGroups } from "./groups.js";
import { pAdjust } from "./pAdjust.js";
import { kruskalTest } from "./rankTests.js";
import { matchAlternative } from "./types.js";
const TIES_WARNING = "Ties are present. z-quantiles were corrected for ties.";
function layout(x, g) {
    const { labels, groups } = labelledGroups(x, g);
    const k = groups.length;
    if (k < 2)
        throw new RangeError("there must be at least two groups");
    const n = groups.map((s) => s.length);
    return { labels, groups, n, N: n.reduce((a, b) => a + b, 0), k };
}
/** Mean ranks of the groups in the ranking of all observations, and the tie term C */
function meanRanks(d) {
    const all = d.groups.flat();
    const r = rank(all);
    const R = [];
    let pos = 0;
    for (const ni of d.n) {
        let s = 0;
        for (let i = 0; i < ni; i++)
            s += r[pos + i];
        pos += ni;
        R.push(s / ni);
    }
    let t3 = 0;
    for (const t of tieCounts(all))
        t3 += t * t * t - t;
    return { R, C: t3 / (12 * (d.N - 1)) };
}
/** Lower-triangular table of f(i, j), i > j (row i - 1, column j), NaN above the diagonal */
function lowerTable(k, f) {
    const out = Array.from({ length: k - 1 }, () => new Array(k - 1).fill(NaN));
    for (let j = 0; j < k - 1; j++)
        for (let i = j + 1; i < k; i++)
            out[i - 1][j] = f(i, j);
    return out;
}
/** p.adjust over the lower-triangle cells, column by column (as R's pairwise.table) */
function adjustLower(p, method) {
    const k = p.length + 1;
    const raw = [];
    for (let j = 0; j < k - 1; j++)
        for (let i = j + 1; i < k; i++)
            raw.push(p[i - 1][j]);
    const adj = pAdjust(raw, method);
    let idx = 0;
    const out = p.map((row) => row.slice());
    for (let j = 0; j < k - 1; j++)
        for (let i = j + 1; i < k; i++)
            out[i - 1][j] = adj[idx++];
    return out;
}
function allPairs(d, method, statistic, pValue, adjust, warnings = []) {
    return {
        method,
        statistic,
        pValue,
        rowNames: d.labels.slice(1),
        colNames: d.labels.slice(0, -1),
        pAdjustMethod: adjust,
        warnings,
    };
}
function manyOne(d, method, statistic, pValue, adjust, warnings = []) {
    return {
        method,
        statistic: statistic.map((v) => [v]),
        pValue: pValue.map((v) => [v]),
        rowNames: d.labels.slice(1),
        colNames: d.labels.slice(0, 1),
        pAdjustMethod: adjust,
        warnings,
    };
}
const upperNormal = (z) => pnorm(z, { lowerTail: false });
const upperRange = (q, k, df) => ptukey(Math.abs(q), k, df, { lowerTail: false });
/** Group means, and the pooled variance sum (n_i - 1) s_i^2 / sum (n_i - 1) with its degrees of freedom */
function pooled(d) {
    let ss = 0;
    let df = 0;
    for (const grp of d.groups) {
        if (grp.length < 2)
            continue;
        ss += (grp.length - 1) * variance(grp);
        df += grp.length - 1;
    }
    return { m: d.groups.map(mean), s2: ss / df, df: d.N - d.k };
}
/**
 * Dunn's all-pairs test of mean ranks with adjusted p-values. Equivalent to `PMCMRplus::kwAllPairsDunnTest()` in R.
 *
 * @param x Response values.
 * @param g Group labels, parallel to `x` (groups in the order of the sorted labels).
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * kwAllPairsDunnTest(x, g).pValue; // [[0.3594249897579995, NaN], [0.02187107427460692, 0.3594249897579995]]
 * ```
 *
 * @category Multiple comparisons
 */
export function kwAllPairsDunnTest(x, g, options = {}) {
    const adjust = options.pAdjustMethod ?? "holm";
    const d = layout(x, g);
    const { R, C } = meanRanks(d);
    const v = (d.N * (d.N + 1)) / 12 - C;
    const z = lowerTable(d.k, (i, j) => Math.abs(R[i] - R[j]) / Math.sqrt(v * (1 / d.n[i] + 1 / d.n[j])));
    const p = adjustLower(z.map((row) => row.map((s) => 2 * upperNormal(s))), adjust);
    return allPairs(d, "Dunn's all-pairs test", z, p, adjust, C !== 0 ? [TIES_WARNING] : []);
}
/**
 * Dunn's many-to-one test of mean ranks against the control (the first group). Equivalent to
 * `PMCMRplus::kwManyOneDunnTest()` in R. With `pAdjustMethod` `"single-step"` (the default) the p-values are the
 * exact simultaneous normal probabilities (R approximates them by randomised integration).
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * kwManyOneDunnTest(x, g).pValue; // [[0.30272579742071715], [0.013938744281312318]]
 * ```
 *
 * @category Multiple comparisons
 */
export function kwManyOneDunnTest(x, g, options = {}) {
    const alternative = matchAlternative(options.alternative);
    const adjust = options.pAdjustMethod ?? "single-step";
    const d = layout(x, g);
    const { R, C } = meanRanks(d);
    const v = (d.N * (d.N + 1)) / 12 - C;
    const idx = d.n.slice(1).map((_, i) => i + 1);
    const z = idx.map((j) => (R[j] - R[0]) / Math.sqrt(v * (1 / d.n[0] + 1 / d.n[j])));
    const lambda = idx.map((j) => d.n[j] / (d.n[j] + d.n[0]));
    const p = manyOneNormalP(z, lambda, alternative, adjust);
    return manyOne(d, "Dunn's many-to-one test", z, p, adjust, C !== 0 ? [TIES_WARNING] : []);
}
/**
 * Many-to-one p-values of normal statistics z (one per group against the control): `"single-step"`, the exact
 * simultaneous normal probabilities for the correlations sqrt(lambda_i lambda_j), or the marginal normal tails
 * adjusted by `pAdjust`.
 */
function manyOneNormalP(z, lambda, alternative, adjust) {
    if (adjust === "single-step") {
        return z.map((s) => alternative === "two.sided"
            ? pDunnettUpper(s, lambda, Infinity, true)
            : pDunnettUpper(alternative === "greater" ? s : -s, lambda, Infinity, false));
    }
    return pAdjust(z.map((s) => (alternative === "two.sided" ? 2 * upperNormal(Math.abs(s)) : upperNormal(alternative === "greater" ? s : -s))), adjust);
}
/**
 * Dunnett's many-to-one test of means against the control (the first group), with the pooled variance. Equivalent to
 * `PMCMRplus::dunnettTest()` in R. The p-values are the exact multivariate t probabilities (R approximates them by
 * randomised integration); two-sided, as in PMCMRplus, `min(1, 2 P(max T_i >= |t|))`.
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * dunnettTest(x, g).pValue; // [[0.026103399464872296], [0.0011111316275120736]]
 * ```
 *
 * @category Multiple comparisons
 */
export function dunnettTest(x, g, options = {}) {
    const alternative = matchAlternative(options.alternative);
    const d = layout(x, g);
    const { m, s2, df } = pooled(d);
    const s = Math.sqrt(s2);
    const idx = d.n.slice(1).map((_, i) => i + 1);
    const t = idx.map((j) => (m[j] - m[0]) / (s * Math.sqrt(1 / d.n[j] + 1 / d.n[0])));
    const lambda = idx.map((j) => d.n[j] / (d.n[j] + d.n[0]));
    const p = t.map((v) => alternative === "two.sided"
        ? Math.min(1, 2 * pDunnettUpper(Math.abs(v), lambda, df, false))
        : pDunnettUpper(alternative === "greater" ? v : -v, lambda, df, false));
    return manyOne(d, "Dunnett's-test for multiple\t\n                         comparisons with one control", t, p, "single-step");
}
/**
 * Steel's many-to-one rank test in its normal approximation: the Mann-Whitney statistic of each group against the
 * control (the first group), each pair ranked on its own (midranks), standardised with the tie-corrected variance.
 * Equivalent to `PMCMRplus::manyOneUTest()` in R. The statistic is positive when the group ranks higher than the
 * control. With `pAdjustMethod` `"single-step"` (the default; at least three groups) the p-values are the exact
 * simultaneous normal probabilities (R approximates them by randomised integration).
 *
 * @param x Response values.
 * @param g Group labels, parallel to `x` (groups in the order of the sorted labels).
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * manyOneUTest(x, g).pValue; // [[0.08993551204759488], [0.08993551204759488]]
 * ```
 *
 * @category Multiple comparisons
 */
export function manyOneUTest(x, g, options = {}) {
    const alternative = matchAlternative(options.alternative);
    const adjust = options.pAdjustMethod ?? "single-step";
    const d = layout(x, g);
    if (adjust === "single-step" && d.k < 3) {
        throw new RangeError("for 'p.adjust.method = single-step' at least\n\n                      k = 3 groups are required.");
    }
    const n1 = d.n[0];
    const idx = d.n.slice(1).map((_, i) => i + 1);
    const z = idx.map((j) => {
        const nj = d.n[j];
        const pair = [...d.groups[0], ...d.groups[j]];
        const r = rank(pair);
        let rankSumControl = 0;
        for (let a = 0; a < n1; a++)
            rankSumControl += r[a];
        const S = n1 + nj;
        const rankSumGroup = (S * (S + 1)) / 2 - rankSumControl;
        const uControl = n1 * nj + (n1 * (n1 + 1)) / 2 - rankSumControl;
        const uGroup = n1 * nj + (nj * (nj + 1)) / 2 - rankSumGroup;
        let t3 = 0;
        for (const t of tieCounts(pair))
            t3 += t * t * t - t;
        const v = ((n1 * nj) / (S * (S - 1))) * ((S * S * S - S) / 12 - t3 / 12);
        const stat = (Math.min(uControl, uGroup) - (n1 * nj) / 2) / Math.sqrt(v);
        return rankSumControl < rankSumGroup ? -stat : stat;
    });
    const lambda = idx.map((j) => d.n[j] / (d.n[j] + n1));
    const p = manyOneNormalP(z, lambda, alternative, adjust);
    return manyOne(d, "Wilcoxon, Mann, Whittney U-test\n\tfor multiple comparisons with one control", z, p, adjust);
}
/**
 * Dwass-Steel-Critchlow-Fligner all-pairs test of pairwise Mann-Whitney statistics. Equivalent to
 * `PMCMRplus::dscfAllPairsTest()` in R. The statistic, sqrt(2) (U - n_i n_j / 2) / sqrt(Var U) with the smaller U,
 * is never positive.
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * dscfAllPairsTest(x, g).pValue; // [[0.12122941216677251, NaN], [0.12122941216677251, 0.12122941216677251]]
 * ```
 *
 * @category Multiple comparisons
 */
export function dscfAllPairsTest(x, g) {
    const d = layout(x, g);
    const stat = lowerTable(d.k, (i, j) => {
        const ni = d.n[i];
        const nj = d.n[j];
        const both = [...d.groups[i], ...d.groups[j]];
        const r = rank(both);
        let ri = 0;
        for (let a = 0; a < ni; a++)
            ri += r[a];
        const ui = ri - (ni * (ni + 1)) / 2;
        const u = Math.min(ui, ni * nj - ui);
        const S = ni + nj;
        let t3 = 0;
        for (const t of tieCounts(both))
            t3 += t * t * t - t;
        const v = ((ni * nj) / (S * (S - 1))) * ((S * S * S - S) / 12 - t3 / 12);
        return (Math.SQRT2 * (u - (ni * nj) / 2)) / Math.sqrt(v);
    });
    const p = stat.map((row) => row.map((q) => (Number.isNaN(q) ? NaN : upperRange(q, d.k, Infinity))));
    return allPairs(d, "Dwass-Steele-Critchlow-Fligner all-pairs test", stat, p, "single-step");
}
/**
 * Games-Howell all-pairs test of means with Welch's standard errors and degrees of freedom. Equivalent to
 * `PMCMRplus::gamesHowellTest()` in R.
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * gamesHowellTest(x, g).pValue; // [[0.05271565998164183, NaN], [0.009781818487986175, 0.08494498877912128]]
 * ```
 *
 * @category Multiple comparisons
 */
export function gamesHowellTest(x, g) {
    const d = layout(x, g);
    const m = d.groups.map(mean);
    const w = d.groups.map((grp, i) => variance(grp) / d.n[i]);
    const q = lowerTable(d.k, (i, j) => ((m[i] - m[j]) / Math.sqrt(w[i] + w[j])) * Math.SQRT2);
    const p = lowerTable(d.k, (i, j) => {
        const df = (w[i] + w[j]) ** 2 / (w[i] ** 2 / (d.n[i] - 1) + w[j] ** 2 / (d.n[j] - 1));
        return upperRange(q[i - 1][j], d.k, df);
    });
    return allPairs(d, "Games-Howell test", q, p, "none");
}
/**
 * Tukey's all-pairs test of means (Tukey-Kramer for unequal sizes). Equivalent to `PMCMRplus::tukeyTest()` in R.
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * tukeyTest(x, g).pValue; // [[0.03403130149294014, NaN], [0.001492661804896774, 0.04527523376597547]]
 * ```
 *
 * @category Multiple comparisons
 */
export function tukeyTest(x, g) {
    const d = layout(x, g);
    const { m, s2, df } = pooled(d);
    const q = lowerTable(d.k, (i, j) => (m[i] - m[j]) / Math.sqrt((s2 * (1 / d.n[i] + 1 / d.n[j])) / 2));
    const p = q.map((row) => row.map((v) => (Number.isNaN(v) ? NaN : upperRange(v, d.k, df))));
    return allPairs(d, "Tukey's test", q, p, "single-step");
}
/**
 * Steel's many-to-one rank test. Equivalent to `PMCMRplus::steelTest()` in R. It behaves as `steelTest()` of
 * PMCMRplus 1.9.12 does: that fails on every input, so this reproduces its errors. A two-sided
 * alternative is rejected (`'arg' should be one of “greater”, “less”`), unequal group sizes give `Steel's test is
 * only valid for balanced designs.`, and balanced data the error PMCMRplus raises internally.
 *
 * @throws Always.
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * const message = (() => {
 *   try {
 *     steelTest(x, g, { alternative: "greater" });
 *   } catch (e) {
 *     return (e as Error).message;
 *   }
 * })();
 * message; // "'data' must be of a vector type, was 'NULL'"
 * ```
 *
 * @category Multiple comparisons
 */
export function steelTest(x, g, options = {}) {
    const alternative = options.alternative === undefined ? "greater" : matchAlternative(options.alternative);
    if (alternative === "two.sided")
        throw new RangeError("'arg' should be one of “greater”, “less”");
    const d = layout(x, g);
    if (d.n.some((v) => v !== d.n[0]))
        throw new RangeError("Steel's test is only valid for balanced designs.");
    throw new Error("'data' must be of a vector type, was 'NULL'");
}
/**
 * Dunn's test of all pairs of mean ranks. Equivalent to `dunn.test::dunn.test(x, g, method, altp)` in R. The step-wise
 * adjustments multiply (or transform) each p-value by the factor of its rank and cap it at 1, without enforcing
 * monotonicity, as dunn.test does (unlike `pAdjust`).
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * const r = dunnTest(x, g, { method: "bonferroni" });
 * r.comparisons; // ["a - b", "a - c", "b - c"]
 * r.PAdjusted;   // [0.26956874231849964, 0.01093553713730346, 0.26956874231849964]
 * ```
 *
 * @category Multiple comparisons
 */
export function dunnTest(x, g, options = {}) {
    const method = options.method ?? "none";
    const altp = options.altp ?? false;
    const d = layout(x, g);
    const chi2 = kruskalTest(x, g).statistic;
    const { R, C } = meanRanks(d);
    const v = (d.N * (d.N + 1)) / 12 - C;
    const Z = [];
    const comparisons = [];
    for (let i = 1; i < d.k; i++) {
        for (let j = 0; j < i; j++) {
            Z.push((R[j] - R[i]) / Math.sqrt(v * (1 / d.n[j] + 1 / d.n[i])));
            comparisons.push(`${d.labels[j]} - ${d.labels[i]}`);
        }
    }
    const P = Z.map((z) => (altp ? 2 : 1) * upperNormal(Math.abs(z)));
    return { chi2, Z, P, PAdjusted: dunnAdjust(P, method), comparisons };
}
/** dunn.test's adjustments: each value by the factor of its rank, capped at 1 */
function dunnAdjust(P, method) {
    const m = P.length;
    const sidakLike = (p, e) => Math.min(1, -Math.expm1(e * Math.log1p(-p)));
    // i = 1..m: rank among the increasing (or decreasing) values, ties in the order of the comparisons
    const ranks = (decreasing) => {
        const order = P.map((_, k) => k).sort((a, b) => (decreasing ? P[b] - P[a] : P[a] - P[b]) || a - b);
        const r = new Array(m);
        order.forEach((k, pos) => (r[k] = pos + 1));
        return r;
    };
    switch (method) {
        case "none":
            return P.slice();
        case "bonferroni":
            return P.map((p) => Math.min(1, m * p));
        case "sidak":
            return P.map((p) => sidakLike(p, m));
        case "holm": {
            const r = ranks(false);
            return P.map((p, k) => Math.min(1, (m + 1 - r[k]) * p));
        }
        case "hs": {
            const r = ranks(false);
            return P.map((p, k) => sidakLike(p, m + 1 - r[k]));
        }
        case "hochberg": {
            const r = ranks(true);
            return P.map((p, k) => Math.min(1, r[k] * p));
        }
        case "bh": {
            const r = ranks(true);
            return P.map((p, k) => Math.min(1, (m / (m + 1 - r[k])) * p));
        }
        case "by": {
            const r = ranks(true);
            let h = 0;
            for (let l = 1; l <= m; l++)
                h += 1 / l;
            return P.map((p, k) => Math.min(1, (m / (m + 1 - r[k])) * h * p));
        }
        default:
            throw new RangeError(`invalid method "${String(method)}"`);
    }
}
/**
 * Dunnett's many-to-one comparisons of a one-way ANOVA with simultaneous p-values. Equivalent to
 * `multcomp::glht()` in R. It gives `summary(glht(aov(y ~ g), linfct = mcp(g = "Dunnett"), alternative))`, with the
 * exact multivariate t probabilities (R approximates them by randomised integration): two-sided
 * `P(max |T_i| >= |t|)`, greater `P(max T_i >= t)`, less `P(min T_i <= t)`.
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * const r = glhtDunnett(x, g);
 * r.names; // ["b - a", "c - a"]
 * r.p;     // [0.02601829573165104, 0.0011091043143827048]
 * ```
 *
 * @category Multiple comparisons
 */
export function glhtDunnett(x, g, options = {}) {
    const alternative = matchAlternative(options.alternative);
    const d = layout(x, g);
    const { m, s2, df } = pooled(d);
    const s = Math.sqrt(s2);
    const idx = d.n.slice(1).map((_, i) => i + 1);
    const estimate = idx.map((j) => m[j] - m[0]);
    const se = idx.map((j) => s * Math.sqrt(1 / d.n[j] + 1 / d.n[0]));
    const t = estimate.map((e, i) => e / se[i]);
    const lambda = idx.map((j) => d.n[j] / (d.n[j] + d.n[0]));
    const p = t.map((v) => alternative === "two.sided"
        ? pDunnettUpper(v, lambda, df, true)
        : pDunnettUpper(alternative === "greater" ? v : -v, lambda, df, false));
    return { names: idx.map((j) => `${d.labels[j]} - ${d.labels[0]}`), estimate, se, t, p, df };
}
