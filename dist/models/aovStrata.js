// Analysis of variance with an Error() term (several error strata): R's aov(y ~ treatment + Error(e), data) and the
// tables of summary() for it.
//
// Written for rStats.js (no ported code) from oracle/anova-behaviour.md ("Error strata"). The error model y ~ e is
// coded with contr.helmert and decomposed by the pivoting QR of src/linalg/qr.ts (rank and aliased columns as lm);
// its orthonormal Q, computed in double-double (src/models/ddLeastSquares.ts), splits the space of the observations
// into strata: the columns of each term of the error model orthogonal to the earlier ones, and the rest ("Within").
// In the coordinates of a stratum (Q'v restricted to it, which keeps lengths and inner products of the projections),
// the treatment columns whose projection has a squared length greater than 1e-5 are kept, and the projected response
// is fitted on them in order with the same pivoting QR (tolerance 1e-7) as lm; the effects give the sums of squares.
import { pf1 } from "../distributions/f.js";
import { qr } from "../linalg/qr.js";
import { ddAdd, ddMul } from "../special/dd.js";
import { ddLeastSquares, ddLeastSquaresMulti, ddSumSquares } from "./ddLeastSquares.js";
import { termsOf } from "./formula.js";
import { design } from "./modelMatrix.js";
/** The table of a stratum: terms that have columns in it, then Residuals when its df is positive */
function stratumTable(name, zy, zcols, assign, labels) {
    const dim = zy.length;
    const kept = zcols.flatMap((c, j) => (ddSumSquares(c)[0] > 1e-5 ? [j] : []));
    let rank = 0;
    let order = [];
    let qty = zy.slice();
    if (kept.length > 0) {
        const q = qr(Array.from({ length: dim }, (_, i) => kept.map((j) => zcols[j][i][0])));
        rank = q.rank;
        order = q.pivot.slice(0, rank).map((k) => kept[k]);
        qty = ddLeastSquares(order.map((j) => zcols[j]), zy).qty;
    }
    const terms = [];
    order.forEach((j, k) => {
        const t = assign[j];
        let row = terms.find((r) => r.term === t);
        if (row === undefined)
            terms.push((row = { term: t, df: 0, ss: [0, 0] }));
        row.df++;
        row.ss = ddAdd(row.ss, ddMul(qty[k], qty[k]));
    });
    const rdf = dim - rank;
    const rss = ddSumSquares(qty, rank)[0];
    const rows = terms.filter((r) => r.term !== 0);
    const rowNames = rows.map((r) => labels[r.term - 1]);
    if (rdf > 0) {
        const rms = rss / rdf;
        const table = rows.map(({ df, ss }) => {
            const f = ss[0] / df / rms;
            return [df, ss[0], ss[0] / df, f, pf1(f, df, rdf, false, false)];
        });
        table.push([rdf, rss, rms, NaN, NaN]);
        return { stratum: `Error: ${name}`, colNames: ["Df", "Sum Sq", "Mean Sq", "F value", "Pr(>F)"], rowNames: [...rowNames, "Residuals"], table };
    }
    return {
        stratum: `Error: ${name}`,
        colNames: ["Df", "Sum Sq", "Mean Sq"],
        rowNames,
        table: rows.map(({ df, ss }) => [df, ss[0], ss[0] / df]),
    };
}
/**
 * The multistratum fit of `y ~ treatment + Error(e)`.
 *
 * @param treatment The right-hand side without the Error() term.
 * @param errorRhs The argument of Error().
 */
export function aovStrataFit(formula, parsed, treatment, errorRhs, data, options) {
    if (options.weights !== undefined)
        throw new Error("weights are not supported in a multistratum aov() fit");
    // y ~ Error(id): no treatment terms, the intercept only
    const treatmentRhs = treatment ?? { type: "num", value: 1, text: "1" };
    // (a contrast is for a variable of the formula without the Error() term: one only inside Error() is absent)
    const contrastVariables = termsOf({ response: parsed.response, rhs: treatmentRhs }, Object.keys(data)).variables;
    const dt = design(parsed, data, { ...options, dropUnusedLevels: true, contrastVariables }, treatmentRhs);
    const y = dt.y;
    if (y === undefined)
        throw new TypeError("the formula has no response");
    const de = design({ response: parsed.response, rhs: errorRhs }, data, {
        ...(options.levels === undefined ? {} : { levels: options.levels }),
        allContrasts: "contr.helmert",
        intercept: dt.terms.intercept,
        extraVariables: dt.terms.variables,
        dropUnusedLevels: true,
    });
    const n = y.length;
    const warnings = [...dt.warnings, ...de.warnings.filter((w) => !dt.warnings.includes(w))];
    const pe = de.colNames.length;
    const qe = pe > 0 ? qr(de.x) : undefined;
    const re = qe?.rank ?? 0;
    if (re < pe)
        warnings.push("Error() model is singular");
    const kept = qe?.pivot.slice(0, re) ?? [];
    const toDD = (v) => v.map((t) => [t, 0]);
    const tcols = dt.colNames.map((_, j) => toDD(dt.x.map((r) => r[j])));
    const { fit, qtv } = ddLeastSquaresMulti(kept.map((j) => toDD(de.x.map((r) => r[j]))), toDD(y), tcols);
    // the strata: positions of Q's columns by term of the error model, then the rest
    const groups = [];
    kept.forEach((j, k) => {
        const a = de.assign[j];
        const name = a === 0 ? "(Intercept)" : de.terms.termLabels[a - 1];
        let g = groups.find((x) => x.name === name);
        if (g === undefined)
            groups.push((g = { name, idx: [] }));
        g.idx.push(k);
    });
    if (n > re)
        groups.push({ name: "Within", idx: Array.from({ length: n - re }, (_, i) => re + i) });
    const strata = groups.map((g) => stratumTable(g.name, g.idx.map((i) => fit.qty[i]), qtv.map((c) => g.idx.map((i) => c[i])), dt.assign, dt.terms.termLabels));
    return { formula, multistratum: true, strata, rows: dt.frame.rows, warnings };
}
