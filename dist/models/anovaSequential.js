// Analysis of variance tables of linear models fitted from a formula: R's anova(fit) (sequential sums of squares),
// anova(fit1, fit2, ...) (comparison of models) and summary(aov(...)) for a fit without Error().
//
// Written for rStats.js (no ported code) from oracle/anova-behaviour.md. The sequential sum of squares of a term is
// the sum of the squared effects (Q'y of the pivoted QR decomposition) of its columns that are not aliased; the
// terms appear in the order of their first column among the columns kept.
import { pf1 } from "../distributions/f.js";
import { ldexp, scaleToUnit } from "../internal/summary.js";
import { nestedColumns } from "./estimable.js";
import { scaledTables } from "./scaledTables.js";
/**
 * The exponent k that brings the responses of the fits (fitted values and residuals) into [1, 2). Rows of weight 0
 * are not in the fit and are left out (#350: a residual of 1e308 there made the sums of squares of the other rows
 * underflow)
 */
export function responseScale(fits) {
    const used = (f, v) => f.weights === undefined ? Array.from(v) : v.filter((_, i) => f.weights[i] !== 0);
    return scaleToUnit(fits.flatMap((f) => [used(f, f.fittedValues), used(f, f.residuals)])).k;
}
/**
 * Residual sums of squares of fits in the scale of the response divided by 2^k (see src/internal/summary.ts): rss /
 * 2^2k when rss is in range, otherwise from the residuals scaled by 2^-k
 */
export function scaledRss(fits, k) {
    return fits.map((f) => {
        if (f.rss >= MIN_NORMAL && f.rss < Infinity)
            return ldexp(f.rss, -2 * k);
        let s = 0;
        f.residuals.forEach((r, i) => {
            // rows of weight 0 are not in the fit (their residual may even be infinite)
            const w = f.weights?.[i] ?? 1;
            if (w === 0)
                return;
            const v = ldexp(r, -k);
            s += w * v * v;
        });
        return s;
    });
}
const MIN_NORMAL = 2 ** -1022;
/**
 * Sequential sums of squares of the terms (intercept row included when the model has one) and the residuals, of the
 * response scaled by 2^-k (k returned): F and p-values come from these, the sums of squares are scaled back by 2^2k
 */
export function sequentialTerms(fit) {
    const k = responseScale([fit]);
    const { pivot } = fit.qr;
    const terms = [];
    const byTerm = new Map();
    for (let i = 0; i < fit.rank; i++) {
        const t = fit.assign[pivot[i]];
        let row = byTerm.get(t);
        if (row === undefined) {
            row = { term: t, df: 0, ss: 0 };
            byTerm.set(t, row);
            terms.push(row);
        }
        row.df++;
        row.ss += ldexp(fit.effects[i], -k) ** 2;
    }
    return { terms, rdf: fit.dfResidual, rss: scaledRss([fit], k)[0], k };
}
const upperF = (f, df1, df2) => pf1(f, df1, df2, false, false);
/** The rows of the sequential table without the intercept, and the warning on a perfect fit */
function sequentialRows(fit) {
    const s = sequentialTerms(fit);
    const kept = s.terms.filter((t) => t.term !== 0);
    let fss = 0;
    fit.fittedValues.forEach((f, i) => {
        const w = fit.weights?.[i] ?? 1;
        if (w !== 0)
            fss += w * ldexp(f, -s.k) ** 2;
    });
    return {
        names: kept.map((t) => fit.termLabels[t.term - 1]),
        rows: kept,
        rdf: s.rdf,
        rss: s.rss,
        k: s.k,
        perfect: s.rss < 1e-10 * fss,
    };
}
function sequentialTable(fit) {
    const { names, rows, rdf, rss, k, perfect } = sequentialRows(fit);
    const rms = rss / rdf;
    const back = (v) => ldexp(v, 2 * k);
    const table = rows.map(({ df, ss }) => {
        const f = ss / df / rms;
        return [df, back(ss), back(ss / df), f, upperF(f, df, rdf)];
    });
    table.push([rdf, back(rss), rdf === 0 ? NaN : back(rms), NaN, NaN]);
    const colNames = ["Df", "Sum Sq", "Mean Sq", "F value", "Pr(>F)"];
    const rowNames = [...names, "Residuals"];
    const result = { colNames, rowNames, table, warnings: perfect ? ["ANOVA F-tests on an essentially perfect fit are unreliable"] : [] };
    // the sums of squares as fitted, for the effect sizes (scaledTables.ts)
    const asFitted = rows.map(({ df, ss }) => [df, ss]);
    asFitted.push([rdf, rss]);
    scaledTables.set(result, { colNames: ["Df", "Sum Sq"], rowNames, table: asFitted });
    return result;
}
function comparisonTable(fits) {
    const rdf = fits.map((f) => f.dfResidual);
    // F from the residual sums of squares of the responses scaled by 2^-k; the sums of squares are scaled back
    const k = responseScale(fits);
    const rss = scaledRss(fits, k);
    const back = (v) => ldexp(v, 2 * k);
    // the scale: the residual mean square of the (first) model with the smallest residual df
    let big = 0;
    rdf.forEach((d, i) => {
        if (d < rdf[big])
            big = i;
    });
    const scale = rss[big] / rdf[big];
    // the warning of the sequential table on an essentially perfect fit of the model that gives the scale (R: none)
    let fss = 0;
    fits[big].fittedValues.forEach((f, i) => {
        const w = fits[big].weights?.[i] ?? 1;
        if (w !== 0)
            fss += w * ldexp(f, -k) ** 2;
    });
    const perfect = rss[big] < 1e-10 * fss;
    const table = fits.map((_, i) => {
        if (i === 0)
            return [rdf[0], back(rss[0]), NaN, NaN, NaN, NaN];
        const df = rdf[i - 1] - rdf[i];
        const ss = rss[i - 1] - rss[i];
        // An F test needs the model with fewer parameters to be a special case of the other (R tests any pair: y ~ x2
        // against y ~ x1 + x3 gave F 1110); otherwise no test, as lmerAnova
        const [small, large] = df > 0 ? [fits[i - 1], fits[i]] : [fits[i], fits[i - 1]];
        // on the rows of positive weight only (the fits share their weights): rows of weight 0 are not in the residual sums
        // of squares, and one of them made nested columns look otherwise, as in glmAnova (#509)
        const active = (x) => x.filter((_, r) => (small.weights?.[r] ?? 1) !== 0);
        let f = df === 0 || !nestedColumns(active(small.x), active(large.x)) ? NaN : ss / df / scale;
        if (f < 0)
            f = NaN;
        return [rdf[i], back(rss[i]), df, back(ss), f, Number.isNaN(f) ? NaN : upperF(f, Math.abs(df), rdf[big])];
    });
    return {
        colNames: ["Res.Df", "RSS", "Df", "Sum of Sq", "F", "Pr(>F)"],
        rowNames: fits.map((_, i) => String(i + 1)),
        table,
        warnings: perfect ? ["ANOVA F-tests on an essentially perfect fit are unreliable"] : [],
    };
}
/** Warning lists joined, each message once, in order of first appearance */
function mergeWarnings(...lists) {
    const out = [];
    for (const l of lists)
        for (const w of l ?? [])
            if (!out.includes(w))
                out.push(w);
    return out;
}
/**
 * Analysis of variance of linear models fitted from a formula. Equivalent to R's `anova()`. With one fit, the table of sequential (type I) sums
 * of squares, equivalent to R's `anova(fit)`: one row per term (the intercept left out), in the order of the model,
 * and `Residuals`. With several fits, the comparison of the models in the order given, equivalent to R's
 * `anova(fit1, fit2, ...)`: columns `Res.Df`, `RSS`, `Df`, `Sum of Sq`, `F`, `Pr(>F)`, the F tests scaled by the
 * residual mean square of the model with the fewest residual degrees of freedom.
 *
 * @param fit A fit from {@link lm} (or {@link aov} without `Error()`) with a formula.
 * @param fits More fits to compare with the first.
 *
 * @example
 * ```ts
 * const data = { y: [4.2, 5.1, 6.3, 5.8, 7.9, 8.4], g: ["a", "a", "b", "b", "c", "c"] };
 * const t = anova(lm("y ~ g", data));
 * t.rowNames; // ["g", "Residuals"]
 * ```
 *
 * @category Linear models and ANOVA
 */
export function anova(fit, ...fits) {
    const all = [fit, ...fits];
    for (const f of all) {
        if (typeof f !== "object" || f === null || !Array.isArray(f.effects)) {
            throw new TypeError("anova() needs fits from lm() or aov() with a formula");
        }
    }
    if (all.length === 1) {
        const t = sequentialTable(fit);
        // (a new object keeps the registered table of the sums of squares as fitted)
        const out = { ...t, warnings: mergeWarnings(fit.warnings, t.warnings) };
        const scaled = scaledTables.get(t);
        if (scaled !== undefined)
            scaledTables.set(out, scaled);
        return out;
    }
    if (all.some((f) => f.rows.length !== fit.rows.length))
        throw new Error("models were not all fitted to the same size of dataset");
    // F tests compare residual sums of squares of the same observations: the same rows, response values and weights (R
    // compares only the number of rows; lmerAnova checks the same)
    const sameValues = (a, b) => a === b || (a !== undefined && b !== undefined && a.length === b.length && a.every((v, i) => Object.is(v, b[i])));
    if (all.some((f) => !sameValues(f.rows, fit.rows)))
        throw new Error("models were not all fitted to the same rows of the data");
    const same = all.filter((f) => f.response === fit.response);
    if (same.some((f) => !sameValues(f.y, fit.y)))
        throw new Error("models were not all fitted to the same response values");
    if (same.some((f) => !sameValues(f.weights, fit.weights)))
        throw new Error("models were not all fitted with the same weights");
    const warnings = [];
    if (same.length < all.length) {
        const removed = [...new Set(all.filter((f) => f.response !== fit.response).map((f) => f.response))];
        warnings.push(`models with response ${removed.map((r) => `‘${r}’`).join(", ")} removed because response differs from model 1`);
    }
    const tab = same.length === 1 ? sequentialTable(fit) : comparisonTable(same);
    tab.warnings = mergeWarnings(...all.map((f) => f.warnings), warnings, tab.warnings);
    return tab;
}
export function aovSummary(fit) {
    if (typeof fit === "object" && fit !== null && fit.multistratum === true) {
        const f = fit;
        // (with the fit's warnings, such as "Error() model is singular": they were left out)
        const summary = { strata: f.strata.filter((s) => s.stratum !== "Error: (Intercept)").map((s) => ({ ...s })), warnings: [...f.warnings] };
        const scaled = scaledTables.get(f);
        if (Array.isArray(scaled))
            scaledTables.set(summary, scaled.filter((_, i) => f.strata[i].stratum !== "Error: (Intercept)"));
        return summary;
    }
    if (typeof fit !== "object" || fit === null || !Array.isArray(fit.effects)) {
        throw new TypeError("aovSummary() needs a fit from aov() with a formula");
    }
    const t = sequentialTable(fit);
    // the fit's warnings and those of the table, once each (as for aov with Error(); R gives them when fitting)
    const warnings = mergeWarnings(fit.warnings, t.warnings);
    if (fit.dfResidual > 0) {
        const out = { ...t, warnings };
        const scaled = scaledTables.get(t);
        if (scaled !== undefined)
            scaledTables.set(out, scaled);
        return out;
    }
    return {
        colNames: t.colNames.slice(0, 3),
        rowNames: t.rowNames.slice(0, -1),
        table: t.table.slice(0, -1).map((r) => r.slice(0, 3)),
        warnings,
    };
}
