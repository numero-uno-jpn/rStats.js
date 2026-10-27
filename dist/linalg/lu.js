// LU decomposition with partial pivoting (Matrix::lu / LAPACK's dgetrf) and principal components (R's prcomp).
//
// Written for rStats.js (no ported code). lu: Gaussian elimination by columns; the pivot of each column is the first
// entry of largest absolute value at or below the diagonal (LAPACK's idamax rule), so the row exchanges are the same
// as dgetrf's, and the multipliers are formed as LAPACK does, a_ij * (1 / pivot); rectangular matrices are allowed
// (L is m x min(m, n), U is min(m, n) x n), and a zero pivot leaves a 0 on the diagonal of U. prcomp: centre and scale
// the columns as R's scale, then the singular value decomposition:
// sdev = d / sqrt(max(1, n - 1)), rotation = V, scores = X V.
import { scale as scaleColumns } from "../descriptive/moments.js";
import { svd } from "./svd.js";
import { matMul } from "./ops.js";
/** Smallest normal double (LAPACK's dlamch("S")): below it, 1 / pivot would overflow. */
const SFMIN = 2.2250738585072014e-308;
/**
 * LU decomposition with partial (row) pivoting, `x = P L U`. Equivalent to R's `Matrix::lu()`. The factors are those
 * of `Matrix::expand(Matrix::lu(x))` (LAPACK's dgetrf).
 *
 * @example
 * ```ts
 * lu([[1, 2], [3, 4]]);
 * // { P: [[0, 1], [1, 0]], L: [[1, 0], [0.3333333333333333, 1]], U: [[3, 4], [0, 0.6666666666666667]] }
 * ```
 *
 * @category Linear algebra
 */
export function lu(x) {
    const m = x.length;
    const n = m === 0 ? 0 : x[0].length;
    const a = x.map((r) => {
        if (r.length !== n)
            throw new TypeError("all rows of the matrix must have the same length");
        return Array.from(r);
    });
    const perm = Array.from({ length: m }, (_, i) => i);
    const k = Math.min(m, n);
    for (let j = 0; j < k; j++) {
        let p = j;
        let best = Math.abs(a[j][j]);
        for (let i = j + 1; i < m; i++) {
            const v = Math.abs(a[i][j]);
            if (v > best || Number.isNaN(best)) {
                best = v;
                p = i;
            }
        }
        if (p !== j) {
            [a[p], a[j]] = [a[j], a[p]];
            [perm[p], perm[j]] = [perm[j], perm[p]];
        }
        const piv = a[j][j];
        if (piv === 0)
            continue;
        // the multipliers as LAPACK forms them: times the reciprocal of the pivot, unless that would overflow
        const inv = Math.abs(piv) >= SFMIN ? 1 / piv : NaN;
        for (let i = j + 1; i < m; i++) {
            const f = Number.isNaN(inv) ? a[i][j] / piv : a[i][j] * inv;
            a[i][j] = f;
            for (let c = j + 1; c < n; c++)
                a[i][c] = a[i][c] - f * a[j][c];
        }
    }
    const L = Array.from({ length: m }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? 1 : i > j ? a[i][j] : 0)));
    const U = Array.from({ length: k }, (_, i) => Array.from({ length: n }, (_, j) => (j >= i ? a[i][j] : 0)));
    // row i of P L U is row perm[i] of x: P has a 1 at (perm[i], i)
    const P = Array.from({ length: m }, () => new Array(m).fill(0));
    perm.forEach((r, i) => (P[r][i] = 1));
    return { P, L, U };
}
/**
 * Principal components of the columns of `x` (observations as rows). Equivalent to R's `prcomp()`. The sign of each
 * component is arbitrary, as in R.
 *
 * @example
 * ```ts
 * const pc = prcomp([[1, 2], [2, 1], [3, 4], [4, 3]]);
 * pc.sdev; // [1.632993161855452, 0.816496580927726]
 * pc.x;    // [[-1.4142, 0.7071], [-1.4142, -0.7071], [1.4142, 0.7071], [1.4142, -0.7071]] (signs may differ from R)
 * prcomp([[1, 2], [2, 1], [3, 4], [4, 3]], { rank: 1 }).rotation.length; // 2 (variables; one column each)
 * ```
 *
 * @category Linear algebra
 */
export function prcomp(x, options = {}) {
    const { rank, tol } = options;
    if (rank !== undefined) {
        if (!Number.isFinite(rank))
            throw new RangeError("is.finite(rank.) is not TRUE");
        // (R converts rank. to an integer: a value of 2^31 or more has none, and fails the same check)
        if (!(Math.trunc(rank) > 0 && Math.abs(rank) < 2 ** 31))
            throw new RangeError("as.integer(rank.) > 0 is not TRUE");
    }
    const rows = x.map((r) => Array.from(r));
    const s = scaleColumns(rows, { center: options.center ?? true, scale: options.scale ?? false });
    if (s.scale?.some((v) => v === 0))
        throw new RangeError("cannot rescale a constant/zero column to unit variance");
    const dec = svd(s.scaled, { nu: 0 });
    const n = rows.length;
    const sdev = dec.d.map((d) => d / Math.sqrt(Math.max(1, n - 1)));
    // Components kept: at most rank, and with tol only those whose sdev is greater than tol times the first
    let k = rank === undefined ? sdev.length : Math.min(Math.trunc(rank), sdev.length);
    if (tol !== undefined)
        k = Math.min(k, sdev.filter((d) => d > sdev[0] * tol).length);
    const rotation = dec.v.map((r) => r.slice(0, k));
    const out = {
        sdev,
        rotation,
        x: matMul(s.scaled, dec.v).map((r) => r.slice(0, k)),
    };
    if (s.center !== undefined)
        out.center = s.center;
    if (s.scale !== undefined)
        out.scale = s.scale;
    return out;
}
