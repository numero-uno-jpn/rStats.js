// Analysis of variance with an Error() term (several error strata): R's aov(y ~ treatment + Error(e), data) and the
// tables of summary() for it.
//
// Written for rStats.js (no ported code) from oracle/anova-behaviour.md ("Error strata"). The error model y ~ e is
// coded with contr.helmert and decomposed by the pivoting QR of src/linalg/qr.ts (rank and aliased columns as lm);
// its orthonormal Q, computed in double-double (src/models/ddLeastSquares.ts), splits the space of the observations
// into strata: the columns of each term of the error model orthogonal to the earlier ones, and the rest ("Within").
// In the coordinates of a stratum (Q'v restricted to it, which keeps lengths and inner products of the projections),
// the treatment columns whose projection has a squared length greater than 1e-14 times the column's own are kept, that
// is, those not orthogonal to the stratum up to rounding (R's aov compares the squared length with 1e-5 itself, which
// depends on the units: a covariate in small units lost its effect, and one in large units kept a projection that is
// rounding error; a threshold relative to the column's mean square instead dropped the small within-subject part of a
// covariate that varies mostly between subjects). Q is accurate to double-double, so the projection of a column
// lying in other strata is far below the threshold, and the projected response
// is fitted on them in order with the same pivoting QR (tolerance 1e-7) as lm; the effects give the sums of squares.
import { pf1 } from "../distributions/f.js";
import { ldexp, scaleToUnit } from "../internal/summary.js";
import { qr } from "../linalg/qr.js";
import { ddAdd, ddMul } from "../special/dd.js";
import { ddLeastSquares, ddLeastSquaresMulti, ddSumSquares } from "./ddLeastSquares.js";
import { termsOf } from "./formula.js";
import { design } from "./modelMatrix.js";
import { rssWithinRounding } from "./anovaSequential.js";
import { scaledTables } from "./scaledTables.js";
/** Squared length of a column's projection on a stratum, relative to its own, below which it is not in the stratum */
const STRATUM_TOL = 1e-14;
/** The table of a stratum: terms that have columns in it, then Residuals when its df is positive */
function stratumTable(name, zy, zcols, assign, labels, columnSS, k, wy) {
    // zy is the response scaled by 2^-k: F and p come from it, the sums of squares are scaled back by 2^2k (the second
    // table keeps them as fitted, for the effect sizes: see scaledTables.ts)
    const scaleBack = (v) => ldexp(v, 2 * k);
    const dim = zy.length;
    const kept = zcols.flatMap((c, j) => (ddSumSquares(c)[0] > STRATUM_TOL * columnSS[j] ? [j] : []));
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
    let rss = ddSumSquares(qty, rank)[0];
    let rows = terms.filter((r) => r.term !== 0);
    // A residual sum of squares at the level of rounding (below 1e-24 times the sum of squares of the response wy, as in
    // anova and Anova: rssWithinRounding) is the residue of an exact fit in the stratum: it is taken as 0 (F = Inf),
    // with the sums of squares of the terms at that level (0 / 0: F = NaN). R keeps the residue (F = 2.9e33). Other
    // strata keep their bits
    if (rdf > 0 && rssWithinRounding(wy, rss)) {
        rss = 0;
        rows = rows.map((r) => (rssWithinRounding(wy, r.ss[0]) ? { ...r, ss: [0, 0] } : r));
    }
    const rowNames = rows.map((r) => labels[r.term - 1]);
    const build = (back) => {
        if (rdf > 0) {
            const rms = rss / rdf;
            const table = rows.map(({ df, ss }) => {
                const f = ss[0] / df / rms;
                return [df, back(ss[0]), back(ss[0] / df), f, pf1(f, df, rdf, false, false)];
            });
            table.push([rdf, back(rss), back(rms), NaN, NaN]);
            return { stratum: `Error: ${name}`, colNames: ["Df", "Sum Sq", "Mean Sq", "F value", "Pr(>F)"], rowNames: [...rowNames, "Residuals"], table };
        }
        return {
            stratum: `Error: ${name}`,
            colNames: ["Df", "Sum Sq", "Mean Sq"],
            rowNames,
            table: rows.map(({ df, ss }) => [df, back(ss[0]), back(ss[0] / df)]),
        };
    };
    return [build(scaleBack), build((v) => v)];
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
    // as R and the fit without Error() (#299: an infinite response gave NaN tables)
    if (y.some((v) => !Number.isFinite(v)))
        throw new RangeError("NA/NaN/Inf in 'y'");
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
    // each column of the error model divided by its own power of 2 (exact): the strata depend only on the space the
    // columns span, but the double-double decomposition squares them (a covariate around 1e-200 in Error() underflowed
    // and gave other strata); columns of 0 and 1 are unchanged
    const ecols = de.colNames.map((_, j) => scaleToUnit([de.x.map((r) => r[j])]).groups[0]);
    const ex = de.x.map((_, i) => ecols.map((c) => c[i]));
    const qe = pe > 0 ? qr(ex) : undefined;
    const re = qe?.rank ?? 0;
    if (re < pe)
        warnings.push("Error() model is singular");
    const kept = qe?.pivot.slice(0, re) ?? [];
    const toDD = (v) => v.map((t) => [t, 0]);
    // each treatment column divided by its own power of 2 (exact): a stratum's sums of squares depend only on the space
    // the columns span, and the test of a column's projection is a ratio, but its squares overflowed for a covariate
    // around 1e200 and the term was dropped from every stratum
    const tcols = dt.colNames.map((_, j) => toDD(scaleToUnit([dt.x.map((r) => r[j])]).groups[0]));
    // the response scaled by 2^-k (exact, src/internal/summary.ts), so that its sums of squares stay in range
    const { groups: scaledY, k: yScale } = scaleToUnit([y]);
    const { fit, qtv } = ddLeastSquaresMulti(kept.map((j) => toDD(ecols[j])), toDD(scaledY[0]), tcols);
    // the scaled response with weights 1, for the check of a residual sum of squares at the level of rounding
    const wy = scaledY[0].map((v) => [1, v]);
    // the squared length of each treatment column (the scale of its threshold in stratumTable)
    const columnSS = tcols.map((c) => ddSumSquares(c)[0]);
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
    const both = groups.map((g) => stratumTable(g.name, g.idx.map((i) => fit.qty[i]), qtv.map((c) => g.idx.map((i) => c[i])), dt.assign, dt.terms.termLabels, columnSS, yScale, wy));
    const strata = both.map((b) => b[0]);
    const result = { formula, multistratum: true, strata, rows: dt.frame.rows, warnings };
    scaledTables.set(result, both.map((b) => b[1]));
    return result;
}
