// Maximum-likelihood factor analysis, R's factanal(), with the varimax and promax rotations. Written for rStats.js
// from the specification oracle/factanal-behaviour.md (no R code was read or used): the uniquenesses minimise the
// likelihood criterion by L-BFGS-B (this library's optim), the loadings come from the eigendecomposition of the
// scaled correlation matrix, and the rotations are Kaiser's varimax (normalised) and Hendrickson and White's promax.
import { pchisq } from "../distributions/chisq.js";
import { eigen } from "../linalg/eigen.js";
import { qr, qrCoef } from "../linalg/qr.js";
import { solve } from "../linalg/solve.js";
import { svd } from "../linalg/svd.js";
import { optim } from "../optim/optim.js";
import { twoSum } from "../special/dd.js";
import { cov } from "./cov.js";
/** Sum rounded once (R's long double accumulation, here double-double); also used by omega */
export function sumOnce(xs) {
    let hi = 0;
    let lo = 0;
    for (const x of xs) {
        const [s, e] = twoSum(hi, x);
        hi = s;
        lo += e;
    }
    return hi + lo;
}
const colSumsOf = (m, f) => m[0].map((_, j) => sumOnce(m.map((r) => f(r[j]))));
/** The scaled matrix D S D with D = diag(1/sqrt(psi)) */
function scaled(S, psi) {
    const d = psi.map((v) => 1 / Math.sqrt(v));
    return S.map((row, i) => row.map((v, j) => d[i] * v * d[j]));
}
/** Loadings at psi: diag(sqrt(psi)) V diag(sqrt(max(e - 1, 0))) from the first q eigenvectors of D S D */
function loadingsAt(S, psi, q) {
    const E = eigen(scaled(S, psi), { symmetric: true });
    const w = E.values.slice(0, q).map((e) => Math.sqrt(Math.max(e - 1, 0)));
    return E.vectors.map((row, i) => row.slice(0, q).map((v, k) => Math.sqrt(psi[i]) * (v * w[k])));
}
/** Columns sorted by decreasing sum of squares, each made to have a positive sum; `rot` (if any) permuted and signed alike */
function orderAndSignColumns(L, rot) {
    const ssq = colSumsOf(L, (v) => v * v);
    const order = ssq.map((_, j) => j).sort((a, b) => ssq[b] - ssq[a] || a - b);
    let out = L.map((r) => order.map((j) => r[j]));
    let R = rot?.map((r) => order.map((j) => r[j]));
    const sign = colSumsOf(out, (v) => v).map((s) => (s < 0 ? -1 : 1));
    out = out.map((r) => r.map((v, j) => (sign[j] < 0 ? -v : v)));
    R = R?.map((r) => r.map((v, j) => (sign[j] < 0 ? -v : v)));
    return R === undefined ? { L: out } : { L: out, rot: R };
}
const matMul = (A, B) => A.map((row) => B[0].map((_, j) => {
    let s = 0;
    for (let k = 0; k < row.length; k++)
        s += row[k] * B[k][j];
    return s;
}));
const transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));
/** Varimax rotation (normalised, eps 1e-5, at most 1000 iterations); also used by omega */
export function varimax(L) {
    const k = L[0].length;
    const p = L.length;
    const len = L.map((r) => Math.sqrt(sumOnce(r.map((v) => v * v))));
    const X = L.map((r, i) => r.map((v) => v / len[i]));
    const Xt = transpose(X);
    let T = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? 1 : 0)));
    let total = 0;
    for (let it = 0; it < 1000; it++) {
        const Z = matMul(X, T);
        const css = Z[0].map((_, j) => {
            let s = 0;
            for (let i = 0; i < p; i++)
                s += Z[i][j] * Z[i][j];
            return s;
        });
        const W = Z.map((r) => r.map((z, j) => z ** 3 - (z * css[j]) / p));
        const B = matMul(Xt, W);
        const sv = svd(B);
        T = matMul(sv.u, transpose(sv.v));
        const previous = total;
        total = sumOnce(sv.d);
        if (total < previous * (1 + 1e-5))
            break;
    }
    const Z = matMul(X, T);
    return { loadings: Z.map((r, i) => r.map((v) => v * len[i])), rotmat: T };
}
/** Promax rotation (m = 4) */
function promax(L) {
    const v = varimax(L);
    const X = v.loadings;
    const Q = X.map((r) => r.map((x) => x * Math.abs(x) ** 3));
    const U0 = qrCoef(qr(X), Q);
    const d = solve(matMul(transpose(U0), U0)).map((r, i) => r[i]);
    const U = U0.map((r) => r.map((u, j) => u * Math.sqrt(d[j])));
    return { loadings: matMul(X, U), rotmat: matMul(v.rotmat, U) };
}
/**
 * Maximum-likelihood factor analysis of a data matrix (rows are observations) or, with `options.covmat`, of a
 * covariance matrix. Equivalent to R's `factanal()`. With `rotation` `"varimax"`, `"promax"` or `"none"`.
 *
 * @param x The data matrix (array of rows), or `null` with `options.covmat`.
 * @param factors The number of factors.
 *
 * @example
 * ```ts
 * const R = [[1, 0.72, 0.63], [0.72, 1, 0.56], [0.63, 0.56, 1]];
 * const fa = factanal(null, 1, { covmat: R });
 * fa.uniquenesses; // [0.19, 0.36, 0.51]
 * fa.loadings;     // [[0.9], [0.8], [0.7]]
 * // Factor scores need the data: factanal(x, 1, { scores: "regression" }).scores (one row per row of x)
 * ```
 *
 * @category Agreement, reliability and factor analysis
 */
export function factanal(x, factors, options = {}) {
    const scores = options.scores ?? "none";
    if (scores !== "none" && scores !== "regression" && scores !== "Bartlett") {
        throw new RangeError("'arg' should be one of “none”, “regression”, “Bartlett”");
    }
    let cv;
    let nObs;
    if (options.covmat !== undefined) {
        if (scores !== "none")
            throw new RangeError("requested scores without an 'x' matrix");
        cv = options.covmat.map((r) => r.slice());
        nObs = options.nObs ?? NaN;
    }
    else {
        if (x === null)
            throw new TypeError("neither 'x' nor 'covmat' supplied");
        cv = cov(x);
        nObs = x.length;
    }
    const p = cv.length;
    if (p < 3)
        throw new RangeError("factor analysis requires at least three variables");
    const q = factors;
    if (!Number.isInteger(q) || q < 1)
        throw new RangeError("'factors' must be a positive integer");
    const dof = ((p - q) ** 2 - p - q) / 2;
    if (dof < 0)
        throw new RangeError(`${q} ${q === 1 ? "factor is" : "factors are"} too many for ${p} variables`);
    const sds = cv.map((r, i) => Math.sqrt(r[i]));
    const S = cv.map((r, i) => r.map((v, j) => v / (sds[i] * sds[j])));
    const lower = options.control?.lower ?? 0.005;
    const start = options.control?.start?.slice() ?? solve(S).map((r, i) => (1 - q / (2 * p)) / r[i]);
    const objective = (psi) => {
        const e = eigen(scaled(S, psi), { symmetric: true, onlyValues: true }).values.slice(q);
        return -(sumOnce(e.map((v) => Math.log(v) - v)) - q + p);
    };
    const gradient = (psi) => {
        const L = loadingsAt(S, psi, q);
        return psi.map((v, i) => {
            let s = 0;
            for (let k = 0; k < q; k++)
                s += L[i][k] * L[i][k];
            return (s + v - S[i][i]) / (v * v);
        });
    };
    const fit = optim(start, objective, {
        gr: gradient,
        method: "L-BFGS-B",
        lower,
        upper: 1,
        control: { fnscale: 1, parscale: new Array(p).fill(0.01) },
    });
    if (fit.convergence !== 0)
        throw new Error("unable to optimize from this starting value");
    const psi = fit.par;
    let L = orderAndSignColumns(loadingsAt(S, psi, q)).L;
    let rotmat;
    const rotation = options.rotation ?? "varimax";
    if (rotation !== "none" && q >= 2) {
        const r = rotation === "varimax" ? varimax(L) : promax(L);
        const sorted = orderAndSignColumns(r.loadings, r.rotmat);
        L = sorted.L;
        rotmat = sorted.rot;
    }
    else if (rotation !== "varimax" && rotation !== "promax" && rotation !== "none") {
        throw new RangeError(`unknown rotation '${String(rotation)}'`);
    }
    let STATISTIC = NaN;
    let PVAL = NaN;
    if (!Number.isNaN(nObs) && dof > 0) {
        STATISTIC = (nObs - 1 - (2 * p + 5) / 6 - (2 * q) / 3) * fit.value;
        PVAL = pchisq(STATISTIC, dof, { lowerTail: false });
    }
    const out = {
        uniquenesses: psi,
        loadings: L,
        STATISTIC,
        dof,
        PVAL,
        converged: true,
        objective: fit.value,
        counts: fit.counts,
    };
    if (scores !== "none")
        out.scores = factorScores(x, S, psi, L, scores);
    if (rotmat !== undefined)
        out.rotmat = rotmat;
    return out;
}
/**
 * Factor scores from the data x standardised by column (z), the correlation matrix S, the uniquenesses psi and the
 * final loadings L: regression (Thomson) z S^-1 L, or Bartlett z W L (L' W L)^-1 with W = diag(1 / psi). No factor
 * covariance enters (none is defined for the varimax and promax rotations)
 */
function factorScores(x, S, psi, L, method) {
    const n = x.length;
    const means = x[0].map((_, j) => sumOnce(x.map((r) => r[j])) / n);
    const centred = x.map((r) => r.map((v, j) => v - means[j]));
    const sds = colSumsOf(centred, (v) => v * v).map((s) => Math.sqrt(s / (n - 1)));
    const z = centred.map((r) => r.map((v, j) => v / sds[j]));
    if (method === "regression")
        return matMul(z, solve(S, L));
    const WL = L.map((r, i) => r.map((v) => v / psi[i]));
    // (L' W L)^-1 is symmetric, so W L (L' W L)^-1 is the transpose of solve(L' W L, (W L)')
    return matMul(z, transpose(solve(matMul(transpose(L), WL), transpose(WL))));
}
