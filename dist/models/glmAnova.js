// Analysis of deviance for generalized linear models: R's anova for one glm fit (terms added in order) and for a
// comparison of several fits, with the chi-squared (likelihood ratio), F, Rao score and Cp columns.
//
// Written for rStats.js (no ported code) from oracle/glm-behaviour.md and R's help pages (?anova.glm,
// ?stat.anova) and McCullagh and Nelder (1989). Each column of x is one term (x1, x2, ...). The score statistic of a
// smaller model against a larger one is computed from the working residuals and working weights of the smaller
// model's fit, regressed by weighted least squares on the larger model's matrix.
import { pf1 } from "../distributions/f.js";
import { pgamma1 } from "../distributions/gamma.js";
import { ldexp, ldexpWide } from "../internal/summary.js";
import { nestedColumns } from "./estimable.js";
import { glmDispersion, refit, scaledDispersion, scaledView } from "./glm.js";
import { makeFamily, Warnings } from "./glmFamily.js";
import { scoreStatistic } from "./glmConfint.js";
/** Upper tail of chi-squared with df degrees of freedom */
const pchisqUpper = (q, df) => pgamma1(q, df / 2, 2, false, false);
/**
 * The working residuals and weights of the fit of the model with the given columns. Without the fit's start: R's
 * anova.glm passes object$start, which glm does not keep (NULL), and the fit's start has the length of all its columns
 * (#178)
 */
function rowOf(model, cols, warnings) {
    const { fit, w } = refit(model, cols, warnings, { start: undefined });
    const nOk = w.filter((v) => v > 0).length;
    return { dfRes: nOk - fit.rank, dev: fit.deviance, fit, x: model.x.map((r) => cols.map((j) => r[j])), intercept: model.intercept };
}
/** Score statistic of the smaller model's fit against the larger model's matrix */
// (the intercept of the smaller model, as R's anova.glmlist: with the larger one's, the residuals of a model without
// intercept were centred, removing what the added intercept explains; review 64)
const rao = (small, large) => scoreStatistic(large.x, small.fit.workingResiduals, small.fit.workingWeights, small.intercept);
/**
 * Analysis of deviance, for one `glm` fit (the sequential table, each column of `x` added in order) or for several
 * fits of the same data (`anova(fit1, fit2, ...)`). Equivalent to R's `anova()`.
 *
 * @param fits One fit, or an array of fits to compare.
 *
 * @example
 * ```ts
 * const y = [0, 0, 1, 0, 1, 1];
 * const fit0 = glm([[], [], [], [], [], []], y, { family: "binomial" });
 * const fit1 = glm([1, 2, 3, 4, 5, 6], y, { family: "binomial" });
 * const a = glmAnova(fit1);
 * a.colNames; // ["Df", "Deviance", "Resid. Df", "Resid. Dev", "Pr(>Chi)"]
 * a.table[1];  // [1, 3.3618, 4, 4.956, 0.066725]
 * glmAnova([fit0, fit1], { test: "LRT" }).table[1]; // [4, 4.956, 1, 3.3618, 0.066725]
 * ```
 *
 * @category Generalized linear models
 */
export function glmAnova(fits, options = {}) {
    const given = Array.isArray(fits) ? fits : [fits];
    if (given.length === 0)
        throw new RangeError("no fits to compare");
    // on the scaled fits (scaledView) when they share one scale: deviances, scores and Cp scaled back by 2^2k
    const views = given.map(scaledView);
    const k = views.every((v) => v.k === views[0].k) ? views[0].k : 0;
    const list = k === 0 ? given : views.map((v) => v.fit);
    // (a given dispersion is m 4^s; s != 0 only where its scaled value is out of range, #349: the statistics divided by
    // it are then brought back by 4^-s, and Cp is formed in the original units below)
    const user = options.dispersion === undefined ? undefined : scaledDispersion(options.dispersion, k);
    const shift = user?.s ?? 0;
    const table = glmAnovaScaled(list, Array.isArray(fits) && list.length > 1, { ...options, ...(user === undefined ? {} : { dispersion: user.m }) }, shift);
    if (k === 0 && shift === 0)
        return table;
    const squared = new Set(["Deviance", "Resid. Dev", "Rao", "Cp"]);
    const cols = table.colNames.map((c) => squared.has(c));
    const scaledBack = table.table.map((r) => r.map((v, j) => (cols[j] ? ldexp(v, 2 * k) : v)));
    if (shift !== 0 && table.colNames.includes("Cp")) {
        // R's residual deviance + 2 dispersion (n - residual df), from the deviance scaled back and the given dispersion
        const cp = table.colNames.indexOf("Cp");
        const dev = table.colNames.indexOf("Resid. Dev");
        const dfRes = table.colNames.indexOf("Resid. Df");
        const n = list[0].model.x.length;
        for (const r of scaledBack)
            r[cp] = r[dev] + 2 * (n - r[dfRes]) * options.dispersion;
    }
    return { ...table, table: scaledBack };
}
function glmAnovaScaled(list, compare, options, shift = 0) {
    const warnings = new Warnings();
    const first = list[0];
    const fam = makeFamily(first.model.familySpec);
    // deviances of different families (or links) are not on one likelihood: no test compares them (R uses the first
    // fit's family for all)
    if (list.some((f) => { const g = makeFamily(f.model.familySpec); return g.family !== fam.family || g.name !== fam.name || g.varianceName !== fam.varianceName; })) {
        throw new RangeError("models were not all fitted with the same family and link");
    }
    const fixed = fam.fixedDispersion;
    const test = options.test === undefined ? (options.dispersion !== undefined || fixed ? "Chisq" : "F") : options.test;
    if (test !== false && !["Rao", "LRT", "Chisq", "F", "Cp"].includes(test))
        throw new RangeError(`invalid 'test': ${String(test)}`);
    const rows = [];
    let df;
    let devDiff;
    let score = [];
    // rows (of a comparison) whose model with fewer parameters is not a special case of the other: no test (R tests any
    // pair), as lmerAnova and anova of lm fits
    const untested = new Set();
    let ref;
    if (!compare) {
        const fit = first;
        const model = fit.model;
        const nTerms = model.x.length > 0 ? model.x[0].length - (model.intercept ? 1 : 0) : 0;
        const base = model.intercept ? [0] : [];
        const colsOf = (k) => [...base, ...Array.from({ length: k }, (_, j) => j + base.length)];
        const fitRows = [];
        // the refits with the first k terms; the last is the fit itself
        for (let k = 0; k <= nTerms; k++) {
            if (k === nTerms) {
                fitRows.push({ dfRes: fit.dfResidual, dev: fit.deviance, fit: asIrls(fit), x: model.x, intercept: model.intercept });
            }
            else if (k > 0 || test === "Rao")
                fitRows.push(rowOf(model, colsOf(k), warnings));
            else
                fitRows.push(undefined);
        }
        rows.push({ name: "NULL", dfRes: fit.dfNull, dev: fit.nullDeviance });
        for (let k = 1; k <= nTerms; k++)
            rows.push({ name: `x${k}`, dfRes: fitRows[k].dfRes, dev: fitRows[k].dev });
        df = rows.map((r, i) => (i === 0 ? NaN : rows[i - 1].dfRes - r.dfRes));
        devDiff = rows.map((r, i) => (i === 0 ? NaN : Math.max(rows[i - 1].dev - r.dev, 0)));
        if (test === "Rao")
            score = rows.map((_, i) => (i === 0 ? NaN : rao(fitRows[i - 1], fitRows[i])));
        ref = fit;
    }
    else {
        const n = list[0].model.x.length;
        if (list.some((f) => f.model.x.length !== n))
            throw new RangeError("models were not all fitted to the same size of dataset");
        // deviances compare likelihoods of the same observations: the same response and prior weights (R's anova.glmlist
        // drops fits whose formula has another response, with a warning, and compares only the number of rows otherwise)
        const same = (a, b) => a.length === b.length && a.every((v, i) => JSON.stringify(v) === JSON.stringify(b[i]));
        if (list.some((f) => !same(f.model.yGiven, list[0].model.yGiven)))
            throw new RangeError("models were not all fitted to the same response");
        if (list.some((f) => !same(f.model.priorGiven, list[0].model.priorGiven)))
            throw new RangeError("models were not all fitted with the same prior weights");
        list.forEach((f, i) => rows.push({ name: String(i + 1), dfRes: f.dfResidual, dev: f.deviance }));
        df = rows.map((r, i) => (i === 0 ? NaN : rows[i - 1].dfRes - r.dfRes));
        devDiff = rows.map((r, i) => (i === 0 ? NaN : rows[i - 1].dev - r.dev));
        list.forEach((f, i) => {
            if (i === 0 || df[i] === 0)
                return;
            const [small, large] = df[i] > 0 ? [list[i - 1], f] : [f, list[i - 1]];
            // nested as affine models: the columns of the smaller model and the difference of the offsets both in the column
            // space of the larger one (two fits with other offsets are not nested even when their columns are)
            // on the rows of positive weight only: rows of weight 0 are not in the likelihoods (one of them made the columns
            // of nested models look otherwise; review 64)
            const active = (rows) => rows.filter((_, r) => small.priorWeights[r] > 0 && large.priorWeights[r] > 0);
            const d = small.model.offset.map((o, r) => o - large.model.offset[r]);
            const smallX = d.some((v, r) => v !== 0 && small.priorWeights[r] > 0) ? small.model.x.map((row, r) => [...row, d[r]]) : small.model.x;
            if (!nestedColumns(active(smallX), active(large.model.x)))
                untested.add(i);
        });
        if (test === "Rao") {
            const fr = list.map((f) => ({ dfRes: f.dfResidual, dev: f.deviance, fit: asIrls(f), x: f.model.x, intercept: f.model.intercept }));
            score = rows.map((_, i) => {
                if (i === 0)
                    return NaN;
                // the smaller model is the one with more residual degrees of freedom
                return df[i] < 0 ? -rao(fr[i], fr[i - 1]) : rao(fr[i - 1], fr[i]);
            });
        }
        ref = list.reduce((a, b) => (b.dfResidual < a.dfResidual ? b : a));
    }
    // (R tests fits that have not converged without a word in the table; review 66)
    list.forEach((f, i) => {
        if (!f.converged)
            warnings.add(`model ${i + 1} has not converged: its deviance is not that of the maximum likelihood fit`);
    });
    const summaryWarnings = new Warnings();
    const dispersion = options.dispersion ?? glmDispersion(ref, summaryWarnings);
    summaryWarnings.list.forEach((m) => warnings.add(m));
    const dfDispersion = fixed ? Infinity : ref.dfResidual;
    const head = compare ? ["Resid. Df", "Resid. Dev", "Df", "Deviance"] : ["Df", "Deviance", "Resid. Df", "Resid. Dev"];
    const cells = rows.map((r, i) => (compare ? [r.dfRes, r.dev, df[i], devDiff[i]] : [df[i], devDiff[i], r.dfRes, r.dev]));
    const colNames = [...head];
    const chisqP = (stat) => rows.map((_, i) => {
        if (i === 0 || df[i] === 0 || untested.has(i))
            return NaN;
        const v = ldexpWide((stat[i] / dispersion) * Math.sign(df[i]), -2 * shift);
        return v < 0 || Number.isNaN(v) ? NaN : pchisqUpper(v, Math.abs(df[i]));
    });
    let extra = [];
    if (test === "Chisq" || test === "LRT") {
        colNames.push("Pr(>Chi)");
        extra = [chisqP(devDiff)];
    }
    else if (test === "Rao") {
        colNames.push("Rao", "Pr(>Chi)");
        extra = [score.map((v, i) => (untested.has(i) ? NaN : v)), chisqP(score)];
    }
    else if (test === "F") {
        if (fixed)
            warnings.add(`using F test with a '${fam.family}' family is inappropriate`);
        if (dfDispersion !== 0) {
            const F = rows.map((_, i) => {
                const v = ldexpWide(devDiff[i] / df[i] / dispersion, -2 * shift);
                return i === 0 || df[i] === 0 || untested.has(i) || v < 0 ? NaN : v;
            });
            colNames.push("F", "Pr(>F)");
            extra = [F, F.map((v, i) => (Number.isNaN(v) ? NaN : pf1(v, Math.abs(df[i]), dfDispersion, false, false)))];
        }
    }
    else if (test === "Cp") {
        const n = ref.model.x.length;
        colNames.push("Cp");
        // R's 2 * dispersion * (n - df) reordered: the products by 2 are exact, so the bits are the same where 2 * dispersion
        // does not overflow, and a penalty of 0 parameters is 0 instead of Inf * 0 = NaN (#188)
        extra = [rows.map((r) => r.dev + 2 * (n - r.dfRes) * dispersion)];
    }
    const table = cells.map((r, i) => [...r, ...extra.map((col) => col[i])]);
    return { colNames, rowNames: rows.map((r) => r.name), table, warnings: warnings.list };
}
/** The parts of a fit that the score statistic uses */
function asIrls(fit) {
    return {
        coefficients: fit.coefficients,
        eta: fit.linearPredictors,
        mu: fit.fittedValues,
        deviance: fit.deviance,
        iter: fit.iter,
        converged: fit.converged,
        boundary: fit.boundary,
        rank: fit.rank,
        qr: fit.qr,
        used: fit.weights.map((v) => v > 0),
        workingWeights: fit.weights,
        workingResiduals: fit.residuals,
    };
}
