// Mauchly's test of sphericity: R's mauchly.test(lm(y ~ 1 or y ~ group), X, M, idata), and the statistic and p-value
// shared with the repeated-measures analysis of aovEz.
//
// Written for rStats.js (no ported code) from oracle/anova-behaviour.md ("mauchlyTest") and Mauchly (1940), "Significance
// test for sphericity of a normal n-variate distribution", Annals of Mathematical Statistics 11, 204-209. The contrasts
// tested are an orthonormal basis of the part of the column space of M's model matrix orthogonal to that of X's
// (Householder QR in double-double); the residual cross-products, U and its determinant are computed in double-double
// (src/models/ddMatrix.ts).
import { pgamma1 } from "../distributions/gamma.js";
import { qr } from "../linalg/qr.js";
import { ddAdd, ddDiv, ddDivNum, ddMul, ddSub } from "../special/dd.js";
import { ddLeastSquaresMulti } from "./ddLeastSquares.js";
import { ddDet, ddTrace } from "./ddMatrix.js";
import { compareCodePoints } from "./modelFrame.js";
import { modelMatrix } from "./modelMatrix.js";
const upperChisq = (q, df) => pgamma1(q, df / 2, 2, false, false);
/** W = det(U) / (trace(U)/p)^p of a p x p matrix U */
export function sphericityW(U) {
    const p = U.length;
    let m = ddDivNum(ddTrace(U), p);
    let pow = [1, 0];
    for (let i = 0; i < p; i++)
        pow = ddMul(pow, m);
    m = ddDiv(ddDet(U), pow);
    return m[0];
}
/**
 * The p-value of Mauchly's W by the asymptotic expansion: pp the dimension tested, n the degrees of freedom of the
 * cross-products, k the number of measurements per subject.
 */
export function mauchlyPValue(W, pp, n, k) {
    const rho = 1 - (2 * pp * pp + pp + 2) / (6 * pp * n);
    const w2 = ((pp + 2) * (pp - 1) * (pp - 2) * (2 * pp ** 3 + 6 * pp * pp + 3 * k + 2)) / (288 * (n * pp * rho) ** 2);
    const z = -n * rho * Math.log(W);
    const f = (pp * (pp + 1)) / 2 - 1;
    const p1 = upperChisq(z, f);
    const p2 = upperChisq(z, f + 4);
    return p1 + w2 * (p2 - p1);
}
/** Columns of a matrix given as rows */
const columnsOf = (rows, nc) => Array.from({ length: nc }, (_, j) => rows.map((r) => r[j]));
/**
 * The matrix T S T' for an orthonormal basis T (rows) of the part of span(Mcols) orthogonal to span(Xcols), S a
 * symmetric k x k matrix. Throws if span(X) is not inside span(M).
 */
export function contrastCrossprod(S, mcols, xcols) {
    const k = S.length;
    const rank = (cols) => (cols.length === 0 ? 0 : qr(Array.from({ length: k }, (_, i) => cols.map((c) => c[i]))).rank);
    const qx = xcols.length === 0 ? undefined : qr(Array.from({ length: k }, (_, i) => xcols.map((c) => c[i])));
    const xkept = qx === undefined ? [] : qx.pivot.slice(0, qx.rank).map((j) => xcols[j]);
    const rx = xkept.length;
    const all = [...xkept, ...mcols];
    const q = qr(Array.from({ length: k }, (_, i) => all.map((c) => c[i])));
    if (q.rank > rank(mcols))
        throw new Error("X does not define a subspace of M");
    const order = q.pivot.slice(0, q.rank).map((j) => all[j]);
    const toDD = (v) => v.map((t) => [t, 0]);
    const zero = new Array(k).fill([0, 0]);
    // A = Q'S, then B = Q'SQ from Q' applied to the rows of A
    const a = ddLeastSquaresMulti(order.map(toDD), zero, S.map((_, j) => S.map((r) => r[j]))).qtv; // a[j] = Q' S[, j]
    const rowsA = Array.from({ length: k }, (_, i) => a.map((col) => col[i]));
    const b = ddLeastSquaresMulti(order.map(toDD), zero, rowsA).qtv; // b[i][j] = (Q'SQ)[i][j]
    const idx = Array.from({ length: q.rank - rx }, (_, i) => rx + i);
    return idx.map((i) => idx.map((j) => b[i][j]));
}
/**
 * Mauchly's test of sphericity of the measurements of each subject (a row of `y`), on the contrasts spanned by `M`
 * and orthogonal to `X` (both formulas over `idata`). Equivalent to R's `mauchly.test(lm(y ~ 1), X = ~1)` and its
 * variants (`group` for `lm(y ~ group)`, `M`, `X`, `idata`).
 *
 * @param y One row per subject, one column per measurement.
 *
 * @example
 * ```ts
 * const y = [[10.5, 9.8, 8.8], [11.2, 10.1, 9.9], [9.7, 9.5, 9.0], [10.9, 10.6, 9.1], [10.1, 9.2, 9.4]];
 * mauchlyTest(y, { X: "~1" }).statistic; // W
 * ```
 */
export function mauchlyTest(y, options = {}) {
    const rows = y.map((r) => Array.from(r));
    const nsub = rows.length;
    const k = rows[0]?.length ?? 0;
    if (k === 0 || rows.some((r) => r.length !== k))
        throw new TypeError("y must be a matrix with at least one column");
    const group = options.group;
    if (group !== undefined && group.length !== nsub)
        throw new RangeError("'group' must have one label per row of y");
    const labels = group?.map(String) ?? rows.map(() => "");
    const levels = [...new Set(labels)].sort(compareCodePoints);
    // residuals from the group means (double-double), and their cross-products
    const res = rows.map((r) => r.map(() => [0, 0]));
    for (const l of levels) {
        const members = labels.flatMap((g, i) => (g === l ? [i] : []));
        for (let j = 0; j < k; j++) {
            let s = [0, 0];
            for (const i of members)
                s = ddAdd(s, [rows[i][j], 0]);
            const m = ddDivNum(s, members.length);
            for (const i of members)
                res[i][j] = ddSub([rows[i][j], 0], m);
        }
    }
    const n = nsub - levels.length;
    const S = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, b) => {
        let s = [0, 0];
        for (const r of res)
            s = ddAdd(s, ddMul(r[a], r[b]));
        return s;
    }));
    const idata = options.idata ?? { index: Array.from({ length: k }, (_, i) => i + 1) };
    const design = (f) => {
        const m = modelMatrix(f, idata);
        if (m.x.length !== k)
            throw new RangeError("idata must have one row per column of y");
        return columnsOf(m.x, m.colNames.length);
    };
    const mcols = options.M === undefined ? Array.from({ length: k }, (_, j) => Array.from({ length: k }, (_, i) => (i === j ? 1 : 0))) : design(options.M);
    const xcols = design(options.X ?? "~0");
    const U = contrastCrossprod(S, mcols, xcols);
    const pp = U.length;
    const W = sphericityW(U);
    return { statistic: W, statisticName: "W", pValue: mauchlyPValue(W, pp, n, k), method: "Mauchly's test of sphericity" };
}
