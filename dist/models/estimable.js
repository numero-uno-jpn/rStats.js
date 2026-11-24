// Estimability of predictions from a rank-deficient fit (R's predict.lm with rankdeficient = "warnif"). Written for
// rStats.js: a row x of the model matrix gives an estimable prediction when it is orthogonal to the null space of the
// fit's model matrix, whose basis follows from the pivoted QR decomposition: for each aliased column k (pivoted
// position >= rank), the vector with 1 at k and -R11^-1 R12[, k] on the first rank pivoted positions.
import { qr } from "../linalg/qr.js";
import { scaleToUnit } from "../internal/summary.js";
/** The warning R gives when some rows are not estimable */
export const NON_ESTIMABLE_WARNING = 'prediction from rank-deficient fit; attr(*, "non-estim") has doubtful cases';
/**
 * 0-based indices of the rows of X (full rows, one value per coefficient) whose prediction is not estimable: |x · n|
 * above sqrt(eps) |x| |n| for a null-space vector n. Empty for a full-rank fit.
 */
export function nonEstimableRows(qr, rank, X) {
    if (qr === undefined)
        return [];
    const p = qr.pivot.length;
    if (rank >= p)
        return [];
    const R = qr.qr;
    const piv = qr.pivot;
    const basis = [];
    for (let k = rank; k < p; k++) {
        // z = -R11^-1 R12[, k] by back substitution; the vector in coefficient order
        const z = new Array(rank).fill(0);
        for (let i = rank - 1; i >= 0; i--) {
            let s = -R[i][k];
            for (let j = i + 1; j < rank; j++)
                s -= R[i][j] * z[j];
            z[i] = s / R[i][i];
        }
        const v = new Array(p).fill(0);
        for (let i = 0; i < rank; i++)
            v[piv[i]] = z[i];
        v[piv[k]] = 1;
        basis.push(v);
    }
    const tol = Math.sqrt(Number.EPSILON);
    const norm = (v) => Math.hypot(...v);
    // the test does not depend on the units of x and v: each is divided by a power of 2 that brings its largest entry
    // into [1, 2), so that the dot product and the product of the norms cannot overflow (with x of 1e308, both were
    // Infinity and the row counted as estimable, #260). The division is exact, so where nothing overflowed or
    // underflowed the comparison is the same
    const unit = (v) => scaleToUnit([v]).groups[0];
    const units = basis.map((v) => {
        const u = unit(v);
        return { u, n: norm(u) };
    });
    const out = [];
    X.forEach((row, r) => {
        const x = unit(row);
        const nx = norm(x);
        if (units.some(({ u, n }) => Math.abs(x.reduce((s, xi, j) => s + xi * u[j], 0)) > tol * nx * n))
            out.push(r);
    });
    return out;
}
/**
 * Whether the columns of the model matrix `small` lie in the column space of `large` (the same rows): the smaller model
 * is then a special case of the larger one, and their comparison by an F or likelihood ratio test has its usual
 * meaning. Judged by the rank of [large, small] against that of large (LINPACK's tolerance 1e-7, relative to each
 * column's norm, so the units of the predictors do not matter)
 */
export function nestedColumns(small, large) {
    if (small.length === 0 || small[0].length === 0)
        return true;
    const rl = large.length === 0 || large[0].length === 0 ? 0 : qr(large).rank;
    return qr(large.map((r, i) => [...r, ...small[i]])).rank === rl;
}
