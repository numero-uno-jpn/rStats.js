// Covariance and correlation of vectors and matrices: R's cov and cor with `method` and `use`.
//
// Written for rStats.js (no ported code). A matrix is an array of rows, its columns the variables. Pearson
// covariances and correlations are computed in double-double (src/internal/summary.ts, src/htest/cor.ts); Spearman's
// are Pearson's of the ranks (ranked after missing values are dropped as `use` says); Kendall's covariance is the
// sum of sign(x_i - x_j) sign(y_i - y_j) over all ordered pairs, as R reports it, and the correlation is tau-b.
// `use` follows R: "everything" (a missing value makes the entry NaN), "all.obs" (missing values are an error),
// "complete.obs" and "na.or.complete" (rows with any missing value are dropped) and "pairwise.complete.obs" (each
// pair of variables uses the rows where both are present).
import { kendall, pearsonDD } from "../htest/cor.js";
import { covariance } from "../internal/summary.js";
import { rank } from "./rank.js";
const METHODS = ["pearson", "kendall", "spearman"];
const USES = ["all.obs", "complete.obs", "pairwise.complete.obs", "everything", "na.or.complete"];
function match(v, all, dflt, what) {
    if (v === undefined)
        return dflt;
    if (all.includes(v))
        return v;
    const hit = all.filter((a) => a.startsWith(v));
    if (v.length === 0 || hit.length !== 1)
        throw new RangeError(`invalid '${what}' argument`);
    return hit[0];
}
function isMatrix(x) {
    return x.length > 0 && Array.isArray(x[0]);
}
/** Columns of a matrix (array of rows), or the vector as one column */
function columns(x) {
    if (!isMatrix(x))
        return [Array.from(x)];
    const ncol = x[0].length;
    return Array.from({ length: ncol }, (_, j) => x.map((r) => r[j]));
}
function compute(x, y, options, correlation) {
    const method = match(options.method, METHODS, "pearson", "method");
    const use = match(options.use, USES, "everything", "use");
    if (y === undefined && !isMatrix(x))
        throw new TypeError("supply both 'x' and 'y' or a matrix-like 'x'");
    const cx = columns(x);
    const cy = y === undefined ? cx : columns(y);
    const n = cx[0]?.length ?? 0;
    if (cy.some((c) => c.length !== n))
        throw new RangeError("incompatible dimensions");
    const all = [...cx, ...cy];
    if (use === "all.obs" && all.some((c) => c.some(Number.isNaN)))
        throw new RangeError("missing observations in cov/cor");
    if (!correlation && use === "pairwise.complete.obs" && method !== "pearson") {
        throw new RangeError("cannot handle 'pairwise.complete.obs'");
    }
    let keepRows;
    if (use === "complete.obs" || use === "na.or.complete") {
        keepRows = Array.from({ length: n }, (_, i) => all.every((c) => !Number.isNaN(c[i])));
        if (!keepRows.some(Boolean)) {
            if (use === "complete.obs")
                throw new RangeError("no complete element pairs");
            return y === undefined || isMatrix(x) || isMatrix(y) ? cx.map(() => cy.map(() => NaN)) : NaN;
        }
    }
    const prep = (c) => {
        const v = keepRows === undefined ? c : c.filter((_, i) => keepRows[i]);
        // ranks for Spearman, missing values kept in place (pairwise ranks are taken per pair below)
        return method === "spearman" && use !== "pairwise.complete.obs" ? rank(v, { naLast: "keep" }) : v;
    };
    const px = cx.map(prep);
    const py = y === undefined ? px : cy.map(prep);
    const entry = (a, b) => {
        let u = a;
        let v = b;
        if (use === "pairwise.complete.obs") {
            const ok = a.map((t, i) => !Number.isNaN(t) && !Number.isNaN(b[i]));
            u = a.filter((_, i) => ok[i]);
            v = b.filter((_, i) => ok[i]);
            if (method === "spearman") {
                u = rank(u);
                v = rank(v);
            }
        }
        else if (u.some(Number.isNaN) || v.some(Number.isNaN))
            return NaN;
        if (method === "kendall") {
            if (correlation)
                return kendall(u, v).tau;
            return 2 * kendall(u, v).s;
        }
        if (correlation)
            return pearsonDD(u, v)[0];
        return covariance(u, v);
    };
    const out = px.map((a) => py.map((b) => entry(a, b)));
    // as in R, the correlation matrix of x alone has 1 on the diagonal, whatever the column holds
    if (correlation && y === undefined && use !== "pairwise.complete.obs")
        out.forEach((r, i) => (r[i] = 1));
    return (y === undefined ? false : !isMatrix(x) && !isMatrix(y)) ? out[0][0] : out;
}
export function cov(x, y, options = {}) {
    if (y !== undefined && !Array.isArray(y) && !ArrayBuffer.isView(y))
        return compute(x, undefined, y, false);
    return compute(x, y, options, false);
}
export function cor(x, y, options = {}) {
    if (y !== undefined && !Array.isArray(y) && !ArrayBuffer.isView(y))
        return compute(x, undefined, y, true);
    return compute(x, y, options, true);
}
