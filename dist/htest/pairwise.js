// Pairwise comparisons between groups with adjusted p-values (R's pairwise.t.test, pairwise.wilcox.test and
// pairwise.prop.test).
//
// Written for rStats.js (no ported code). Every pair of groups (i, j), i after j in the order of the sorted labels,
// is compared, and the p-values of the lower triangle are adjusted together with pAdjust. The pooled-SD t tests use
// the standard deviation pooled over all groups, s^2 = sum (n_i - 1) s_i^2 / sum (n_i - 1), with its degrees of
// freedom; the other comparisons are the two-sample tests themselves.
import { pt1 } from "../distributions/t.js";
import { levelText, numberLevels } from "../internal/levels.js";
import { mean, variance } from "../internal/summary.js";
import { pAdjust } from "./pAdjust.js";
import { propTest } from "./propTest.js";
import { tTest } from "./tTest.js";
import { matchAlternative } from "./types.js";
import { wilcoxTest } from "./wilcoxTest.js";
/** Group a sample by labels: levels sorted (numbers numerically, strings in code-unit order), values in input order */
function byLevel(x, g, dropNaN) {
    const xs = Array.from(x);
    if (xs.length !== g.length)
        throw new RangeError("'x' and 'g' must have the same length");
    const map = new Map();
    // numeric labels with the same 15-digit text are one level, as in R's factor()
    const gs = numberLevels(g);
    for (let i = 0; i < xs.length; i++) {
        const l = gs[i];
        if (typeof l === "number" && Number.isNaN(l))
            continue;
        if (dropNaN && Number.isNaN(xs[i]))
            continue;
        let arr = map.get(l);
        if (arr === undefined)
            map.set(l, (arr = []));
        arr.push(xs[i]);
    }
    const levels = Array.from(map.keys()).sort((a, b) => typeof a === "number" && typeof b === "number" ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
    return { levels, groups: levels.map((l) => map.get(l)) };
}
/** Lower-triangular table of compare(i, j) for i > j, adjusted together */
function table(k, compare, method) {
    const raw = [];
    const pos = [];
    for (let j = 0; j < k - 1; j++) {
        for (let i = j + 1; i < k; i++) {
            raw.push(compare(i, j));
            pos.push([i - 1, j]);
        }
    }
    const adj = pAdjust(raw, method);
    const out = Array.from({ length: k - 1 }, () => new Array(k - 1).fill(NaN));
    pos.forEach(([r, c], idx) => (out[r][c] = adj[idx]));
    return out;
}
function result(method, levels, pValue, adjust) {
    return {
        method,
        pValue,
        rowNames: levels.slice(1).map(levelText),
        colNames: levels.slice(0, -1).map(levelText),
        pAdjustMethod: adjust,
    };
}
/**
 * Pairwise t tests between groups, with adjusted p-values. Equivalent to R's `pairwise.t.test()`.
 *
 * @param x Response values.
 * @param g Group labels, parallel to `x`.
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * pairwiseTTest(x, g).pValue; // [[0.029519264601117815, NaN], [0.0018407330776394456, 0.029519264601117815]]
 * ```
 *
 * @category Multiple comparisons
 */
export function pairwiseTTest(x, g, options = {}) {
    const paired = options.paired ?? false;
    const poolSd = options.poolSd ?? !paired;
    if (paired && poolSd)
        throw new RangeError("pooling of SD is incompatible with paired tests");
    const alternative = matchAlternative(options.alternative);
    const adjust = options.pAdjustMethod ?? "holm";
    const { levels, groups } = byLevel(x, g, !paired);
    const k = levels.length;
    if (k < 2)
        throw new RangeError("there must be at least two groups");
    let compare;
    let method;
    if (poolSd) {
        method = "t tests with pooled SD";
        const n = groups.map((s) => s.length);
        const means = groups.map((s) => (s.length > 0 ? mean(s) : NaN));
        let ss = 0;
        let df = 0;
        groups.forEach((s) => {
            if (s.length > 1) {
                ss += variance(s) * (s.length - 1);
                df += s.length - 1;
            }
        });
        const sd = Math.sqrt(ss / df);
        compare = (i, j) => {
            const t = (means[i] - means[j]) / (sd * Math.sqrt(1 / n[i] + 1 / n[j]));
            if (alternative === "less")
                return pt1(t, df, true, false);
            if (alternative === "greater")
                return pt1(t, df, false, false);
            return 2 * pt1(-Math.abs(t), df, true, false);
        };
    }
    else {
        method = paired ? "paired t tests" : "t tests with non-pooled SD";
        compare = (i, j) => tTest(groups[i], groups[j], { paired, alternative }).pValue;
    }
    return result(method, levels, table(k, compare, adjust), adjust);
}
/**
 * Pairwise Wilcoxon rank sum (or signed rank, with `paired`) tests between groups, with adjusted p-values. Equivalent
 * to R's `pairwise.wilcox.test()`. `method` is that of the last comparison, as in R.
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * pairwiseWilcoxTest(x, g).pValue; // [[0.3, NaN], [0.3, 0.3]]
 * ```
 *
 * @category Multiple comparisons
 */
export function pairwiseWilcoxTest(x, g, options = {}) {
    const { pAdjustMethod, alternative, ...rest } = options;
    const adjust = pAdjustMethod ?? "holm";
    const { levels, groups } = byLevel(x, g, !(rest.paired ?? false));
    const k = levels.length;
    if (k < 2)
        throw new RangeError("there must be at least two groups");
    let method = "";
    const pv = table(k, (i, j) => {
        const r = wilcoxTest(groups[i], groups[j], { ...rest, ...(alternative === undefined ? {} : { alternative }) });
        method = r.method;
        return r.pValue;
    }, adjust);
    return result(method, levels, pv, adjust);
}
/**
 * Pairwise two-group tests of equal proportions, with adjusted p-values. Equivalent to R's `pairwise.prop.test()`.
 *
 * @param x Numbers of successes per group.
 * @param n Numbers of trials per group. Groups with `NaN` in `x` or `n` are dropped (the rows and columns are then
 *   numbered over the groups kept, as in R).
 *
 * @example
 * ```ts
 * pairwisePropTest([15, 25, 40], [50, 50, 50]).pValue; // [[0.06619257972219345, NaN], [0.000004217380554293543, 0.006666708050273146]]
 * ```
 *
 * @category Multiple comparisons
 */
export function pairwisePropTest(x, n, options = {}) {
    if (x.length !== n.length)
        throw new RangeError("'x' and 'n' must have the same length");
    // as in R, groups with a missing count are dropped and the rest numbered 1, 2, ... in their order
    const xs = [];
    const ns = [];
    x.forEach((v, i) => {
        if (Number.isNaN(v) || Number.isNaN(n[i]))
            return;
        xs.push(v);
        ns.push(n[i]);
    });
    const k = xs.length;
    if (k < 2)
        throw new RangeError("too few groups");
    const adjust = options.pAdjustMethod ?? "holm";
    const correct = options.correct ?? true;
    const pv = table(k, (i, j) => propTest([xs[i], xs[j]], [ns[i], ns[j]], { correct }).pValue, adjust);
    const levels = Array.from({ length: k }, (_, i) => i + 1);
    return result("Pairwise comparison of proportions", levels, pv, adjust);
}
