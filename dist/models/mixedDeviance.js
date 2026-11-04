// The profiled deviance of a linear mixed model (lme4's lmer) at a given θ: the penalised least-squares solution
// (β̂, û), the random effects b = Λ_θ û, the residual and penalty sums of squares, the log determinants of L_θ and
// R_X, and the REML criterion or the ML deviance. Nothing is optimised here.
//
// Written for rStats.js (no ported code) from oracle/lmer-behaviour.md (stage 1b, "The profiled deviance", and
// "Sparse computation (stages S1 and S2)") and the penalised least squares (equations (13)-(19)) of D. Bates,
// M. Mächler, B. Bolker, S. Walker (2015), "Fitting Linear Mixed-Effects Models Using lme4", Journal of Statistical
// Software 67(1). The sparse Cholesky factorisation follows the textbook description (elimination tree, symbolic
// factorisation by merging the patterns of the children, left-looking numeric factorisation), as in J. W. H. Liu
// (1990), "The role of elimination trees in sparse factorization", SIAM J. Matrix Anal. Appl. 11(1).
//
// Sparse implementation. The columns of Z come in groups: one group of nc_k contiguous columns per level of each term
// k (level-major, as in Z), and Λ_θ is block diagonal with the block T_k on each group of term k. So
//   A = Λ_θ' Z'Z Λ_θ + I
// is made of dense blocks A(g, h) = T' Z'Z(g, h) T between groups g and h that share rows, and it is stored by blocks.
// Z'Z by blocks, Z'X (q × p), Z'y and X'y do not depend on θ and are formed once per structure, together with
// the pattern of the Cholesky factor L (A = L L'). Nothing of size q × q or n × q is stored.
//
// Ordering: the columns are factorised in their own order (the permutation P of the paper is the identity). The terms
// are ordered by decreasing number of levels, so the first term is the one with the most groups, and its block of A
// is block diagonal (a row has one level per term): eliminating its groups first creates no fill among them, only
// among the groups of later terms that share rows with one of its levels. Models with one grouping factor, or with
// nested factors, have no fill-in at all; crossed factors fill in the blocks of the later terms (dense for a fully
// crossed design, whatever the ordering).
//
// Symbolic factorisation (once per structure), on the groups: the elimination tree of the group graph, and the
// pattern of each group's columns below its diagonal block (the groups adjacent to it in A after it, merged with the
// patterns of its children in the tree). A group's columns share that pattern, so L is stored by columns (compressed
// sparse columns, rows increasing, the diagonal first) with each column holding the rest of its diagonal block and
// the columns of the groups of its pattern. Numeric factorisation (at each θ), left-looking by columns: column j of A
// is scattered into a work vector, the columns k < j with L[j, k] ≠ 0 (row lists formed with the pattern) are
// subtracted, and column j of L is the result divided by the square root of its diagonal element.
//
// With L, the computation is that of the dense implementation (the reference in test/helpers/mixedDense.ts), with
// triangular solves by L instead of dense ones:
//   C_X = L⁻¹ Λ_θ' Z'X,  W = L'⁻¹ C_X = A⁻¹ Λ_θ' Z'X  (q × p)
//   R_X' R_X = E'E + W'W, with E = X − ZΛ_θ W         (n × p, as X; Cholesky, p × p)
//   (û, β̂) from the normal equations of the penalised least squares, solved with L, C_X and R_X.
// Forming the normal equations squares the condition number, and X'X − C_X'C_X loses digits by cancellation, so W and
// the solution are refined once with residuals computed from the data and the sparse Z (E, and y − Xβ̂ − ZΛ_θ û),
// which recovers the accuracy of an orthogonal decomposition (the corrected semi-normal equations), and R_X' R_X is
// formed as the sum of squares E'E + W'W.
//
// On request, the gradient of the criterion with respect to θ (for the fit, stage 1c), derived from the formulas
// above. With ∂Λ the derivative of Λ_θ with respect to one element of θ (the entries (r, c) of Λ_θ that hold it),
// K = Λ_θ'Z'Z and the residual res = y − Xβ̂ − ZΛ_θ û:
//   ∂ prss = −2 res'Z ∂Λ û   (prss is a minimum over (β, u), so only its explicit dependence on θ counts),
//   ∂ log det A = 2 tr(A⁻¹ K ∂Λ) = 2 Σ_(r,c) (A⁻¹K)[c, r],
//   ∂ (log det A + log det R_X'R_X) = ∂ log det M, M = [A, Λ'Z'X; X'ZΛ, X'X], which adds −2 Σ_(r,c) (W S⁻¹ E'Z)[c, r]
//   (S = R_X'R_X; the blocks of M⁻¹ are A⁻¹ + W S⁻¹ W' and −W S⁻¹, and X'Z − W'K = E'Z).
// The criterion's derivative is then the log-determinant terms plus (n or n − p) ∂ prss / prss. The trace term needs
// A⁻¹ only on the blocks of Z'Z, which lie on the pattern of L: the selected inverse (A⁻¹ on the pattern of L, by
// Takahashi's recurrences; K by blocks of Z'Z, never formed), so the gradient costs about one more factorisation, and
// memory of the order of the nonzeros of L, Z and Z'X.
//
// The second derivatives that lmerTest's tests need (src/models/mixedDerivatives.ts) are computed from the same state
// (plsState): the selected inverse, the sums of levelTraceSums, and the derivatives of the factor and of the selected
// inverse along an element of θ (factoriseSystemTangent, selectedInverseTangent).
import { potf2, potri } from "../linalg/chol.js";
/** Steps of iterative refinement of the penalised least-squares solution */
const REFINEMENT_STEPS = 1;
const systemCache = new WeakMap();
/** The groups of columns, the cross-products and the pattern of the factor of a structure (cached) */
function sparseSystemOf(s) {
    const cached = systemCache.get(s);
    if (cached !== undefined)
        return cached;
    const n = s.y.length;
    const p = s.xColNames.length;
    const q = s.q;
    const nTerms = s.terms.length;
    // the groups of columns, in the order of the columns
    const nGroups = s.terms.reduce((sum, t) => sum + t.nLevels, 0);
    const groupStart = new Int32Array(nGroups + 1);
    const groupTerm = new Int32Array(nGroups);
    const termFirstGroup = [];
    const termNc = [];
    let g = 0;
    s.terms.forEach((t, k) => {
        const nc = t.columns.length;
        termFirstGroup.push(g);
        termNc.push(nc);
        for (let l = 0; l < t.nLevels; l++, g++) {
            groupStart[g] = t.zOffset + l * nc;
            groupTerm[g] = k;
        }
    });
    groupStart[nGroups] = q;
    // the elements of each T_k, from the entries of Λ_θ in the first level of the term
    const termTheta = s.terms.map((t, k) => {
        const nc = termNc[k];
        const idx = new Int32Array(nc * nc).fill(-1);
        for (const { row, col, theta } of s.lambda) {
            if (col >= t.zOffset && col < t.zOffset + nc)
                idx[row - t.zOffset + (col - t.zOffset) * nc] = theta;
        }
        return idx;
    });
    // for each row: its group in each term and the term's left-hand side values; Z by rows (nonzero entries)
    const codesOf = s.terms.map((t) => s.groups[t.group].codes);
    const counts = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) {
        let c = 0;
        for (const t of s.terms)
            for (const v of t.matrix[i])
                if (v !== 0)
                    c++;
        counts[i + 1] = counts[i] + c;
    }
    const rowStart = counts;
    const nnz = rowStart[n];
    const rowCols = new Int32Array(nnz);
    const rowValues = new Float64Array(nnz);
    {
        let at = 0;
        for (let i = 0; i < n; i++) {
            s.terms.forEach((t, k) => {
                const base = t.zOffset + codesOf[k][i] * termNc[k];
                t.matrix[i].forEach((v, j) => {
                    if (v === 0)
                        return;
                    rowCols[at] = base + j;
                    rowValues[at++] = v;
                });
            });
        }
    }
    // Z'Z by blocks: the blocks (g, h), g ≥ h, of groups that share a row (all diagonal blocks)
    const blockKeys = new Map();
    const pairRow = [];
    const pairCol = [];
    const addPair = (gr, gc) => {
        const key = gc * nGroups + gr;
        let b = blockKeys.get(key);
        if (b === undefined) {
            b = pairRow.length;
            blockKeys.set(key, b);
            pairRow.push(gr);
            pairCol.push(gc);
        }
        return b;
    };
    for (let h = 0; h < nGroups; h++)
        addPair(h, h);
    const rowGroups = new Int32Array(nTerms);
    // for each row, the block of each pair of its terms k ≥ l, at i nPairs + k (k + 1) / 2 + l (the groups of later
    // terms come later in the columns)
    const nPairs = (nTerms * (nTerms + 1)) / 2;
    const rowPairs = new Int32Array(n * nPairs);
    for (let i = 0; i < n; i++) {
        for (let k = 0; k < nTerms; k++)
            rowGroups[k] = termFirstGroup[k] + codesOf[k][i];
        for (let k = 0; k < nTerms; k++) {
            for (let l = 0; l <= k; l++)
                rowPairs[i * nPairs + (k * (k + 1)) / 2 + l] = addPair(rowGroups[k], rowGroups[l]);
        }
    }
    // sorted by column group, then row group (the diagonal block first)
    const nBlocks = pairRow.length;
    const order = Array.from({ length: nBlocks }, (_, b) => b).sort((a, b) => pairCol[a] - pairCol[b] || pairRow[a] - pairRow[b]);
    const position = new Int32Array(nBlocks);
    order.forEach((b, at) => (position[b] = at));
    const blockStart = new Int32Array(nGroups + 1);
    const blockRow = new Int32Array(nBlocks);
    const blockValueStart = new Int32Array(nBlocks + 1);
    order.forEach((b, at) => {
        blockRow[at] = pairRow[b];
        blockStart[pairCol[b] + 1]++;
        const size = termNc[groupTerm[pairRow[b]]] * termNc[groupTerm[pairCol[b]]];
        blockValueStart[at + 1] = blockValueStart[at] + size;
    });
    for (let h = 0; h < nGroups; h++)
        blockStart[h + 1] += blockStart[h];
    const zz = new Float64Array(blockValueStart[nBlocks]);
    const zx = new Float64Array(q * p);
    const zy = new Float64Array(q);
    const xy = new Float64Array(p);
    for (let i = 0; i < n; i++) {
        const xi = s.x[i];
        const yi = s.y[i];
        for (let k = 0; k < nTerms; k++) {
            const mk = s.terms[k].matrix[i];
            const nck = termNc[k];
            for (let l = 0; l <= k; l++) {
                const ml = s.terms[l].matrix[i];
                const ncl = termNc[l];
                const at = position[rowPairs[i * nPairs + (k * (k + 1)) / 2 + l]];
                const base = blockValueStart[at];
                // block (group of k, group of l): nck × ncl, column-major
                for (let c = 0; c < ncl; c++) {
                    const v = ml[c];
                    if (v === 0)
                        continue;
                    for (let r = 0; r < nck; r++)
                        zz[base + r + c * nck] += mk[r] * v;
                }
            }
        }
        for (let a = rowStart[i]; a < rowStart[i + 1]; a++) {
            const ja = rowCols[a];
            const va = rowValues[a];
            for (let k = 0; k < p; k++)
                zx[ja + k * q] += va * xi[k];
            zy[ja] += va * yi;
        }
        for (let k = 0; k < p; k++)
            xy[k] += xi[k] * yi;
    }
    // symbolic factorisation on the groups: the pattern of each group below its diagonal block (groups, increasing)
    const groupPattern = new Array(nGroups);
    const children = Array.from({ length: nGroups }, () => []);
    const mark = new Int32Array(nGroups).fill(-1);
    for (let h = 0; h < nGroups; h++) {
        const members = [];
        const add = (r) => {
            if (r !== h && mark[r] !== h) {
                mark[r] = h;
                members.push(r);
            }
        };
        for (let b = blockStart[h] + 1; b < blockStart[h + 1]; b++)
            add(blockRow[b]);
        for (const c of children[h])
            for (const r of groupPattern[c])
                add(r);
        const pattern = Int32Array.from(members).sort();
        groupPattern[h] = pattern;
        if (pattern.length > 0)
            children[pattern[0]].push(h);
    }
    // the position of each off-diagonal block of Z'Z in the pattern of its column group
    const blockPatternOffset = new Int32Array(nBlocks);
    {
        const offsetOf = new Int32Array(nGroups);
        for (let h = 0; h < nGroups; h++) {
            let at = 0;
            for (const r of groupPattern[h]) {
                offsetOf[r] = at;
                at += groupStart[r + 1] - groupStart[r];
            }
            for (let b = blockStart[h] + 1; b < blockStart[h + 1]; b++)
                blockPatternOffset[b] = offsetOf[blockRow[b]];
        }
    }
    // the pattern of L by columns
    const colStart = new Int32Array(q + 1);
    for (let h = 0; h < nGroups; h++) {
        let below = 0;
        for (const r of groupPattern[h])
            below += groupStart[r + 1] - groupStart[r];
        for (let j = groupStart[h]; j < groupStart[h + 1]; j++)
            colStart[j + 1] = colStart[j] + (groupStart[h + 1] - j) + below;
    }
    const colRows = new Int32Array(colStart[q]);
    const rowCounts = new Int32Array(q + 1);
    for (let h = 0; h < nGroups; h++) {
        for (let j = groupStart[h]; j < groupStart[h + 1]; j++) {
            let at = colStart[j];
            for (let r = j; r < groupStart[h + 1]; r++)
                colRows[at++] = r;
            for (const rg of groupPattern[h])
                for (let r = groupStart[rg]; r < groupStart[rg + 1]; r++)
                    colRows[at++] = r;
        }
    }
    for (let j = 0; j < q; j++)
        for (let t = colStart[j] + 1; t < colStart[j + 1]; t++)
            rowCounts[colRows[t] + 1]++;
    for (let j = 0; j < q; j++)
        rowCounts[j + 1] += rowCounts[j];
    const rowListStart = rowCounts.slice();
    const fillAt = rowCounts.slice(0, q);
    const rowListCol = new Int32Array(rowListStart[q]);
    const rowListPos = new Int32Array(rowListStart[q]);
    for (let k = 0; k < q; k++) {
        for (let t = colStart[k] + 1; t < colStart[k + 1]; t++) {
            const at = fillAt[colRows[t]]++;
            rowListCol[at] = k;
            rowListPos[at] = t;
        }
    }
    const result = {
        n,
        p,
        q,
        nGroups,
        groupStart,
        groupTerm,
        termNc,
        termTheta,
        blockStart,
        blockRow,
        blockValueStart,
        zz,
        zx,
        zy,
        xy,
        rowStart,
        rowCols,
        rowValues,
        colStart,
        colRows,
        rowListStart,
        rowListCol,
        rowListPos,
        blockPatternOffset,
    };
    systemCache.set(s, result);
    return result;
}
/** The blocks T_k at θ (nc × nc, column-major, lower triangular) */
function blocksOf(sys, theta) {
    return sys.termTheta.map((idx) => Float64Array.from(idx, (t) => (t < 0 ? 0 : theta[t])));
}
/** Λ_θ w (q-vector) */
export function lambdaTimes(sys, t, w) {
    const out = new Float64Array(sys.q);
    for (let g = 0; g < sys.nGroups; g++) {
        const k = sys.groupTerm[g];
        const nc = sys.termNc[k];
        const tk = t[k];
        const base = sys.groupStart[g];
        for (let c = 0; c < nc; c++) {
            const wc = w[base + c];
            if (wc === 0)
                continue;
            for (let r = c; r < nc; r++)
                out[base + r] += tk[r + c * nc] * wc;
        }
    }
    return out;
}
/** Λ_θ' M for a q × ncol column-major M */
export function lambdaTransposeTimes(sys, t, m, ncol = 1) {
    const q = sys.q;
    const out = new Float64Array(q * ncol);
    for (let g = 0; g < sys.nGroups; g++) {
        const k = sys.groupTerm[g];
        const nc = sys.termNc[k];
        const tk = t[k];
        const base = sys.groupStart[g];
        for (let col = 0; col < ncol; col++) {
            const off = base + col * q;
            for (let c = 0; c < nc; c++) {
                let sum = 0;
                for (let r = c; r < nc; r++)
                    sum += tk[r + c * nc] * m[off + r];
                out[off + c] = sum;
            }
        }
    }
    return out;
}
/** The blocks of A = Λ_θ' Z'Z Λ_θ + I (the layout of Z'Z), each T_g' Z'Z(g, h) T_h, the identity added on the diagonal */
function blocksOfA(sys, t) {
    const a = new Float64Array(sys.zz.length);
    const tmp = new Float64Array(64);
    for (let h = 0; h < sys.nGroups; h++) {
        const kc = sys.groupTerm[h];
        const ncc = sys.termNc[kc];
        const tc = t[kc];
        for (let b = sys.blockStart[h]; b < sys.blockStart[h + 1]; b++) {
            const kr = sys.groupTerm[sys.blockRow[b]];
            const ncr = sys.termNc[kr];
            const tr = t[kr];
            const base = sys.blockValueStart[b];
            if (ncr === 1 && ncc === 1) {
                a[base] = tr[0] * sys.zz[base] * tc[0];
            }
            else {
                // tmp = Z'Z(g, h) T_h (ncr × ncc), then T_g' tmp
                const work = tmp.length >= ncr * ncc ? tmp : new Float64Array(ncr * ncc);
                for (let c = 0; c < ncc; c++) {
                    for (let r = 0; r < ncr; r++) {
                        let sum = 0;
                        for (let m = c; m < ncc; m++)
                            sum += sys.zz[base + r + m * ncr] * tc[m + c * ncc];
                        work[r + c * ncr] = sum;
                    }
                }
                for (let c = 0; c < ncc; c++) {
                    for (let r = 0; r < ncr; r++) {
                        let sum = 0;
                        for (let m = r; m < ncr; m++)
                            sum += tr[m + r * ncr] * work[m + c * ncr];
                        a[base + r + c * ncr] = sum;
                    }
                }
            }
            if (b === sys.blockStart[h])
                for (let c = 0; c < ncc; c++)
                    a[base + c + c * ncc] += 1;
        }
    }
    return a;
}
/** The values of the Cholesky factor L of A (A = L L', the pattern of the system), from the blocks of A */
function factorise(sys, a) {
    const { q, colStart, colRows, rowListStart, rowListCol, rowListPos } = sys;
    const l = new Float64Array(colRows.length);
    const work = new Float64Array(q);
    for (let h = 0; h < sys.nGroups; h++) {
        const ncc = sys.termNc[sys.groupTerm[h]];
        const first = sys.groupStart[h];
        for (let c = 0; c < ncc; c++) {
            const j = first + c;
            // column j of A, on and below the diagonal
            for (let b = sys.blockStart[h]; b < sys.blockStart[h + 1]; b++) {
                const g = sys.blockRow[b];
                const ncr = sys.termNc[sys.groupTerm[g]];
                const base = sys.blockValueStart[b] + c * ncr;
                const r0 = sys.groupStart[g];
                for (let r = g === h ? c : 0; r < ncr; r++)
                    work[r0 + r] = a[base + r];
            }
            // minus the columns k < j with L[j, k] ≠ 0
            for (let e = rowListStart[j]; e < rowListStart[j + 1]; e++) {
                const k = rowListCol[e];
                const pos = rowListPos[e];
                const ljk = l[pos];
                if (ljk === 0)
                    continue;
                const end = colStart[k + 1];
                for (let t = pos; t < end; t++)
                    work[colRows[t]] -= l[t] * ljk;
            }
            const d = work[j];
            if (!(d > 0))
                throw new Error("the penalised least-squares matrix is not positive definite");
            const ljj = Math.sqrt(d);
            const start = colStart[j];
            l[start] = ljj;
            work[j] = 0;
            for (let t = start + 1; t < colStart[j + 1]; t++) {
                const r = colRows[t];
                l[t] = work[r] / ljj;
                work[r] = 0;
            }
        }
    }
    return l;
}
/** Solves L x = v in place (v of length q, at an offset) */
export function solveL(sys, l, v, offset = 0) {
    const { q, colStart, colRows } = sys;
    for (let j = 0; j < q; j++) {
        const start = colStart[j];
        const xj = (v[offset + j] /= l[start]);
        if (xj === 0)
            continue;
        for (let t = start + 1; t < colStart[j + 1]; t++)
            v[offset + colRows[t]] -= l[t] * xj;
    }
}
/** Solves L' x = v in place */
export function solveLt(sys, l, v, offset = 0) {
    const { q, colStart, colRows } = sys;
    for (let j = q - 1; j >= 0; j--) {
        const start = colStart[j];
        let sum = v[offset + j];
        for (let t = start + 1; t < colStart[j + 1]; t++)
            sum -= l[t] * v[offset + colRows[t]];
        v[offset + j] = sum / l[start];
    }
}
/** Solves L x = v in place, with L = R' and R the upper-triangular factor (column-major, k × k) */
function forwardSolve(r, k, v) {
    for (let i = 0; i < k; i++) {
        const ci = i * k;
        let sum = v[i];
        for (let j = 0; j < i; j++)
            sum -= r[j + ci] * v[j];
        v[i] = sum / r[i + ci];
    }
}
/** Solves R x = v in place, R upper triangular (column-major, k × k) */
function backSolve(r, k, v) {
    for (let i = k - 1; i >= 0; i--) {
        const xi = (v[i] /= r[i + i * k]);
        const ci = i * k;
        for (let j = 0; j < i; j++)
            v[j] -= r[j + ci] * xi;
    }
}
/** The full symmetric inverse of R'R from an upper-triangular factor R (column-major, k × k; R is not changed) */
export function inverseFromFactor(r, k) {
    const inv = r.slice();
    for (let j = 0; j < k; j++)
        for (let i = j + 1; i < k; i++)
            inv[i + j * k] = 0;
    potri({ nrow: k, ncol: k, data: inv });
    for (let j = 0; j < k; j++)
        for (let i = j + 1; i < k; i++)
            inv[i + j * k] = inv[j + i * k];
    return inv;
}
/**
 * The profiled deviance of a linear mixed model at `theta`, with the penalised least-squares solution
 * (oracle/lmer-behaviour.md, stage 1b; computed sparsely). Internal: not exported from the package.
 *
 * @param structure The structure from {@link mixedModelStructure}.
 * @param theta The covariance parameters (finite, of the length of `structure.theta`; values below the lower bounds
 *   are accepted).
 * @param reml Whether to return the REML criterion (true) or the ML deviance (false).
 * @param options What to compute besides: the gradient with respect to θ, (R_X' R_X)⁻¹.
 */
export function profiledDeviance(structure, theta, reml, options = {}) {
    const state = plsState(structure, theta);
    const { sys, t, l, rx, ws, xResiduals, res, uv } = state;
    const { n, p, q } = sys;
    const beta = Array.from(state.beta);
    const u = Array.from(uv);
    const b = Array.from(state.b);
    let rss = 0;
    for (const e of res)
        rss += e * e;
    let ussq = 0;
    for (const v of u)
        ussq += v * v;
    const prss = rss + ussq;
    let logDetL = 0;
    for (let j = 0; j < q; j++)
        logDetL += Math.log(l[sys.colStart[j]]);
    logDetL *= 2;
    let logDetRX = 0;
    for (let k = 0; k < p; k++)
        logDetRX += Math.log(rx[k + k * p]);
    logDetRX *= 2;
    const df = reml ? n - p : n;
    const deviance = (reml ? logDetL + logDetRX : logDetL) + df * (1 + Math.log((2 * Math.PI * prss) / df));
    const out = { deviance, beta, u, b, rss, ussq, prss, logDetL, logDetRX };
    const sInverse = options.gradient === true || options.rxInverse === true ? inverseFromFactor(rx, p) : undefined;
    if (options.rxInverse === true) {
        out.rxInverse = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => sInverse[i + j * p]));
    }
    if (options.gradient === true) {
        out.gradient = sparseGradient(structure, sys, t, l, theta, reml, { res, uv, prss, ws, xResiduals, sInverse: sInverse });
    }
    return out;
}
/** The penalised least-squares solution at θ and the factors it was computed with (see {@link PlsState}) */
export function plsState(structure, theta) {
    if (theta.length !== structure.theta.length) {
        throw new RangeError(`theta must have length ${structure.theta.length}, not ${theta.length}`);
    }
    if (theta.some((t) => !Number.isFinite(t)))
        throw new RangeError("theta must be finite");
    const sys = sparseSystemOf(structure);
    const { n, p, q } = sys;
    const t = blocksOf(sys, theta);
    const l = factorise(sys, blocksOfA(sys, t));
    // Z v (from the sparse Z) and Λ'Z' v
    const zTimes = (v) => {
        const out = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            let sum = 0;
            for (let c = sys.rowStart[i]; c < sys.rowStart[i + 1]; c++)
                sum += sys.rowValues[c] * v[sys.rowCols[c]];
            out[i] = sum;
        }
        return out;
    };
    const zTransposeTimes = (v) => {
        const zv = new Float64Array(q);
        for (let i = 0; i < n; i++) {
            const vi = v[i];
            for (let c = sys.rowStart[i]; c < sys.rowStart[i + 1]; c++)
                zv[sys.rowCols[c]] += sys.rowValues[c] * vi;
        }
        return zv;
    };
    /** Solves A w = v in place */
    const solveA = (v) => {
        solveL(sys, l, v);
        solveLt(sys, l, v);
    };
    // C_X = L⁻¹ Λ' Z'X
    const cx = lambdaTransposeTimes(sys, t, sys.zx, p);
    for (let k = 0; k < p; k++)
        solveL(sys, l, cx, k * q);
    // R_X' R_X = X'X − C_X' C_X, computed without the cancellation of that difference: with W = A⁻¹ Λ'Z'X (= L'⁻¹ C_X)
    // and the residual E = X − ZΛW, it is E'E + W'W (as Λ'Z'E = W). W is refined once with E computed from the data.
    const xResiduals = [];
    const ws = [];
    for (let k = 0; k < p; k++) {
        const w = cx.slice(k * q, (k + 1) * q);
        solveLt(sys, l, w);
        const xk = Float64Array.from(structure.x, (row) => row[k]);
        const residualOf = () => {
            const fitted = zTimes(lambdaTimes(sys, t, w));
            return xk.map((v, i) => v - fitted[i]);
        };
        let e = residualOf();
        for (let step = 0; step < REFINEMENT_STEPS; step++) {
            const g = lambdaTransposeTimes(sys, t, zTransposeTimes(e));
            for (let i = 0; i < q; i++)
                g[i] -= w[i];
            solveA(g);
            for (let i = 0; i < q; i++)
                w[i] += g[i];
            e = residualOf();
        }
        xResiduals.push(e);
        ws.push(w);
    }
    const rx = new Float64Array(p * p);
    for (let k = 0; k < p; k++) {
        for (let m = k; m < p; m++) {
            let sum = 0;
            const ek = xResiduals[k];
            const em = xResiduals[m];
            for (let i = 0; i < n; i++)
                sum += ek[i] * em[i];
            const wk = ws[k];
            const wm = ws[m];
            for (let i = 0; i < q; i++)
                sum += wk[i] * wm[i];
            rx[k + m * p] = sum;
            rx[m + k * p] = sum;
        }
    }
    const factorRX = { nrow: p, ncol: p, data: rx };
    if (p > 0 && potf2(factorRX) > 0)
        throw new Error("the fixed-effects matrix of the penalised least squares is not positive definite");
    // The normal equations of the penalised least squares, [A, Λ'Z'X; X'ZΛ, X'X] (u, β) = (gu, gβ), solved with the
    // two factors: c = L⁻¹ gu, R_X' R_X β = gβ − C_X' c, L' u = c − C_X β. Overwrites gu with u and gβ with β.
    const solveNormal = (gu, gb) => {
        solveL(sys, l, gu);
        for (let k = 0; k < p; k++) {
            let sum = gb[k];
            for (let i = 0; i < q; i++)
                sum -= cx[i + k * q] * gu[i];
            gb[k] = sum;
        }
        forwardSolve(rx, p, gb);
        backSolve(rx, p, gb);
        for (let k = 0; k < p; k++) {
            const bk = gb[k];
            for (let i = 0; i < q; i++)
                gu[i] -= cx[i + k * q] * bk;
        }
        solveLt(sys, l, gu);
    };
    // the residual y − Xβ − ZΛu, from X and the sparse Z (not from the cross-products)
    const residual = (beta, bv) => {
        const zb = zTimes(bv);
        const res = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const xi = structure.x[i];
            let fitted = zb[i];
            for (let k = 0; k < p; k++)
                fitted += xi[k] * beta[k];
            res[i] = structure.y[i] - fitted;
        }
        return res;
    };
    // the solution from the cross-products, then refined with the residual computed from the data (the corrected
    // semi-normal equations): the normal equations squared the condition number, the refinement recovers the accuracy
    // of an orthogonal decomposition
    const uv = lambdaTransposeTimes(sys, t, sys.zy);
    const betav = Float64Array.from(sys.xy);
    solveNormal(uv, betav);
    let bv = lambdaTimes(sys, t, uv);
    let res = residual(betav, bv);
    for (let step = 0; step < REFINEMENT_STEPS; step++) {
        // the gradient of the penalised residual sum of squares: (Λ'Z'res − u, X'res)
        const du = lambdaTransposeTimes(sys, t, zTransposeTimes(res));
        for (let i = 0; i < q; i++)
            du[i] -= uv[i];
        const db = new Float64Array(p);
        for (let i = 0; i < n; i++) {
            const xi = structure.x[i];
            const ri = res[i];
            for (let k = 0; k < p; k++)
                db[k] += xi[k] * ri;
        }
        solveNormal(du, db);
        for (let i = 0; i < q; i++)
            uv[i] += du[i];
        for (let k = 0; k < p; k++)
            betav[k] += db[k];
        bv = lambdaTimes(sys, t, uv);
        res = residual(betav, bv);
    }
    return { sys, t, l, cx, rx, ws, xResiduals, res, uv, beta: betav, b: bv, solveNormal };
}
/**
 * The selected inverse of A = L L': the entries of A⁻¹ on the pattern of L (lower part, the layout of L's values), by
 * the recurrences of Takahashi, Fagan and Chin (1973). Since L' A⁻¹ = L⁻¹ is lower triangular with diagonal 1 / L_jj,
 * row j of it gives, for i > j in the pattern of column j,
 *   A⁻¹[i, j] = −(1 / L_jj) Σ_k L[k, j] A⁻¹[k, i],   A⁻¹[j, j] = 1 / L_jj² − (1 / L_jj) Σ_k L[k, j] A⁻¹[k, j],
 * the sums over the rows k > j of column j. The rows of column j form a clique in the pattern of L (the closure of a
 * Cholesky pattern), so every A⁻¹[k, i] needed is on the pattern, in column min(k, i), already computed when the
 * columns are taken from the last to the first. The cost is that of the factorisation.
 */
export function selectedInverse(sys, l) {
    const { q, colStart, colRows } = sys;
    const inv = new Float64Array(l.length);
    const inColumn = new Int32Array(q).fill(-1);
    const lj = new Float64Array(q);
    const acc = new Float64Array(q);
    for (let j = q - 1; j >= 0; j--) {
        const start = colStart[j];
        const end = colStart[j + 1];
        for (let t = start + 1; t < end; t++) {
            const r = colRows[t];
            inColumn[r] = j;
            lj[r] = l[t];
            acc[r] = 0;
        }
        // acc[i] = Σ_k L[k, j] A⁻¹[k, i] for the rows i of column j: column k of the selected inverse holds A⁻¹[r, k],
        // r ≥ k, which counts once for A⁻¹[k, r] (i = r) and once for A⁻¹[r, k] (i = k)
        for (let t = start + 1; t < end; t++) {
            const k = colRows[t];
            const lkj = l[t];
            const kStart = colStart[k];
            let sum = inv[kStart] * lkj;
            for (let e = kStart + 1; e < colStart[k + 1]; e++) {
                const r = colRows[e];
                if (inColumn[r] !== j)
                    continue;
                const v = inv[e];
                acc[r] += v * lkj;
                sum += v * lj[r];
            }
            acc[k] += sum;
        }
        const d = l[start];
        let diagonal = 1 / d;
        for (let t = start + 1; t < end; t++) {
            const v = -acc[colRows[t]] / d;
            inv[t] = v;
            diagonal -= l[t] * v;
        }
        inv[start] = diagonal / d;
    }
    return inv;
}
/**
 * The derivative ∂L of the Cholesky factor L of A along a direction in which A changes by ∂A (`da`, the layout of the
 * blocks of A, both triangles of the diagonal blocks): {@link factorise} differentiated step by step (forward mode).
 * In column j, after the columns k < j are subtracted, the work vector holds L_jj L[r, j] (L_jj² at r = j), so with
 * ∂ of the same subtractions (∂L[r, k] L[j, k] + L[r, k] ∂L[j, k]),
 *   ∂L_jj = ∂work[j] / (2 L_jj),  ∂L[r, j] = (∂work[r] − L[r, j] ∂L_jj) / L_jj.
 * An entry L[j, k] that is 0 (a column of Λ_θ that is 0) is not skipped: its derivative need not be 0.
 */
export function factoriseSystemTangent(sys, l, da) {
    const { q, colStart, colRows, rowListStart, rowListCol, rowListPos } = sys;
    const dl = new Float64Array(l.length);
    const work = new Float64Array(q);
    for (let h = 0; h < sys.nGroups; h++) {
        const ncc = sys.termNc[sys.groupTerm[h]];
        const first = sys.groupStart[h];
        for (let c = 0; c < ncc; c++) {
            const j = first + c;
            for (let b = sys.blockStart[h]; b < sys.blockStart[h + 1]; b++) {
                const g = sys.blockRow[b];
                const ncr = sys.termNc[sys.groupTerm[g]];
                const base = sys.blockValueStart[b] + c * ncr;
                const r0 = sys.groupStart[g];
                for (let r = g === h ? c : 0; r < ncr; r++)
                    work[r0 + r] = da[base + r];
            }
            for (let e = rowListStart[j]; e < rowListStart[j + 1]; e++) {
                const k = rowListCol[e];
                const pos = rowListPos[e];
                const ljk = l[pos];
                const dljk = dl[pos];
                if (ljk === 0 && dljk === 0)
                    continue;
                const end = colStart[k + 1];
                for (let t = pos; t < end; t++)
                    work[colRows[t]] -= dl[t] * ljk + l[t] * dljk;
            }
            const start = colStart[j];
            const ljj = l[start];
            const dljj = work[j] / (2 * ljj);
            dl[start] = dljj;
            work[j] = 0;
            for (let t = start + 1; t < colStart[j + 1]; t++) {
                const r = colRows[t];
                dl[t] = (work[r] - l[t] * dljj) / ljj;
                work[r] = 0;
            }
        }
    }
    return dl;
}
/**
 * The derivative of the selected inverse `inv` of A = L L' given the derivative ∂L of L (`dl`): the recurrences of
 * {@link selectedInverse} differentiated step by step (forward mode). It is ∂(A⁻¹) = −A⁻¹ ∂A A⁻¹ on the pattern of L.
 */
export function selectedInverseTangent(sys, l, dl, inv) {
    const { q, colStart, colRows } = sys;
    const dinv = new Float64Array(l.length);
    const inColumn = new Int32Array(q).fill(-1);
    const lj = new Float64Array(q);
    const dlj = new Float64Array(q);
    const acc = new Float64Array(q);
    const dacc = new Float64Array(q);
    for (let j = q - 1; j >= 0; j--) {
        const start = colStart[j];
        const end = colStart[j + 1];
        for (let t = start + 1; t < end; t++) {
            const r = colRows[t];
            inColumn[r] = j;
            lj[r] = l[t];
            dlj[r] = dl[t];
            acc[r] = 0;
            dacc[r] = 0;
        }
        for (let t = start + 1; t < end; t++) {
            const k = colRows[t];
            const lkj = l[t];
            const dlkj = dl[t];
            const kStart = colStart[k];
            let sum = inv[kStart] * lkj;
            let dsum = dinv[kStart] * lkj + inv[kStart] * dlkj;
            for (let e = kStart + 1; e < colStart[k + 1]; e++) {
                const r = colRows[e];
                if (inColumn[r] !== j)
                    continue;
                const v = inv[e];
                const dv = dinv[e];
                acc[r] += v * lkj;
                dacc[r] += dv * lkj + v * dlkj;
                sum += v * lj[r];
                dsum += dv * lj[r] + v * dlj[r];
            }
            acc[k] += sum;
            dacc[k] += dsum;
        }
        const d = l[start];
        const dd = dl[start];
        let diagonal = 1 / d;
        let ddiagonal = -dd / (d * d);
        for (let t = start + 1; t < end; t++) {
            const r = colRows[t];
            const v = inv[t];
            const dv = -dacc[r] / d + (acc[r] * dd) / (d * d);
            dinv[t] = dv;
            diagonal -= l[t] * v;
            ddiagonal -= dl[t] * v + l[t] * dv;
        }
        dinv[start] = ddiagonal / d - (diagonal * dd) / (d * d);
    }
    return dinv;
}
/**
 * The gradient of the criterion with respect to θ (see the header), sparse. The log-determinant term
 * 2 Σ_(r,c) (A⁻¹ K)[c, r] (K = Λ'Z'Z) involves, for the entries (r, c) of Λ_θ in group G,
 *   (A⁻¹ K)[c, r] = Σ_H (A⁻¹(G, H) T_H' Z'Z(H, G))[c, r]
 * over the groups H that share rows with G: the blocks of A⁻¹ on the pattern of A, hence of L, given by the selected
 * inverse. These nc × nc products are summed over the levels of each term, as the same element of θ sits at the same
 * place of T_k in every level. The other terms need Z'res (q), W S⁻¹ (q × p) and E'Z (p × q).
 */
function sparseGradient(structure, sys, t, l, theta, reml, { res, uv, prss, ws, xResiduals, sInverse }) {
    const { n, p, q } = sys;
    const sums = levelTraceSums(sys, selectedInverse(sys, l), t);
    const gradient = new Array(theta.length).fill(0);
    sys.termTheta.forEach((idx, k) => {
        const nc = sys.termNc[k];
        for (let cl = 0; cl < nc; cl++) {
            for (let rl = cl; rl < nc; rl++)
                gradient[idx[rl + cl * nc]] += 2 * sums[k][cl + rl * nc];
        }
    });
    // Z' res
    const zRes = new Float64Array(q);
    for (let i = 0; i < n; i++) {
        const ri = res[i];
        for (let c = sys.rowStart[i]; c < sys.rowStart[i + 1]; c++)
            zRes[sys.rowCols[c]] += sys.rowValues[c] * ri;
    }
    // REML: V = W S⁻¹ (q × p) and E'Z (p × q), both column-major
    let v;
    let ez;
    if (reml && p > 0) {
        v = new Float64Array(q * p);
        for (let m = 0; m < p; m++) {
            for (let k = 0; k < p; k++) {
                const skm = sInverse[k + m * p];
                const wk = ws[k];
                for (let c = 0; c < q; c++)
                    v[c + m * q] += wk[c] * skm;
            }
        }
        ez = new Float64Array(p * q);
        for (let i = 0; i < n; i++) {
            for (let c = sys.rowStart[i]; c < sys.rowStart[i + 1]; c++) {
                const zr = sys.rowCols[c];
                const val = sys.rowValues[c];
                for (let m = 0; m < p; m++)
                    ez[m + zr * p] += xResiduals[m][i] * val;
            }
        }
    }
    const df = reml ? n - p : n;
    const prssFactor = (2 * df) / prss;
    for (const { row: rr, col: c, theta: ti } of structure.lambda) {
        let tr = 0;
        if (v !== undefined && ez !== undefined)
            for (let m = 0; m < p; m++)
                tr += v[c + m * q] * ez[m + rr * p];
        gradient[ti] -= 2 * tr + prssFactor * zRes[rr] * uv[c];
    }
    return gradient;
}
/**
 * S_k = Σ over the levels G of term k of (Y Λ' Z'Z) on G's columns (nc_k × nc_k, column-major), for Y = A⁻¹ given by
 * its selected inverse `inv` (the layout of L's values) and Λ by its blocks `t` (see {@link sparseGradient}). Linear
 * in `inv` and in `t`, so that the derivatives of the sums (src/models/mixedDerivatives.ts) come from the derivative
 * of the selected inverse and of the blocks.
 */
export function levelTraceSums(sys, inv, t) {
    const { colStart, zz } = sys;
    const sums = sys.termNc.map((nc) => new Float64Array(nc * nc));
    let y = new Float64Array(16);
    let f = new Float64Array(16);
    for (let h = 0; h < sys.nGroups; h++) {
        const kh = sys.groupTerm[h];
        const nch = sys.termNc[kh];
        const th = t[kh];
        const c0 = sys.groupStart[h];
        for (let b = sys.blockStart[h]; b < sys.blockStart[h + 1]; b++) {
            const g = sys.blockRow[b];
            const kg = sys.groupTerm[g];
            const ncg = sys.termNc[kg];
            const tg = t[kg];
            const base = sys.blockValueStart[b];
            if (nch === 1 && ncg === 1) {
                // Y = A⁻¹(g, h), B = Z'Z(g, h): Y T_g B to S_h and, off the diagonal, Y T_h B to S_g
                const at = g === h ? colStart[c0] : colStart[c0] + 1 + sys.blockPatternOffset[b];
                const yb = inv[at] * zz[base];
                sums[kh][0] += yb * tg[0];
                if (g !== h)
                    sums[kg][0] += yb * th[0];
                continue;
            }
            const size = ncg * nch;
            if (y.length < size) {
                y = new Float64Array(size);
                f = new Float64Array(Math.max(size, ncg * ncg, nch * nch));
            }
            // Y = A⁻¹(g, h) (ncg × nch), from the selected inverse (the diagonal block from its lower triangle)
            for (let cc = 0; cc < nch; cc++) {
                const col = colStart[c0 + cc];
                if (g === h) {
                    for (let rr = cc; rr < ncg; rr++) {
                        const v = inv[col + rr - cc];
                        y[rr + cc * ncg] = v;
                        y[cc + rr * ncg] = v;
                    }
                }
                else {
                    const at = col + (nch - cc) + sys.blockPatternOffset[b];
                    for (let rr = 0; rr < ncg; rr++)
                        y[rr + cc * ncg] = inv[at + rr];
                }
            }
            // S_h += Y' T_g' B: F = T_g' B (ncg × nch), then Y' F
            for (let cc = 0; cc < nch; cc++) {
                for (let a = 0; a < ncg; a++) {
                    let sum = 0;
                    for (let m = a; m < ncg; m++)
                        sum += tg[m + a * ncg] * zz[base + m + cc * ncg];
                    f[a + cc * ncg] = sum;
                }
            }
            const sh = sums[kh];
            for (let x = 0; x < nch; x++) {
                for (let z = 0; z < nch; z++) {
                    let sum = 0;
                    for (let a = 0; a < ncg; a++)
                        sum += y[a + x * ncg] * f[a + z * ncg];
                    sh[x + z * nch] += sum;
                }
            }
            if (g === h)
                continue;
            // S_g += Y T_h' B': F = T_h' B' (nch × ncg), then Y F
            for (let rr = 0; rr < ncg; rr++) {
                for (let a = 0; a < nch; a++) {
                    let sum = 0;
                    for (let m = a; m < nch; m++)
                        sum += th[m + a * nch] * zz[base + rr + m * ncg];
                    f[a + rr * nch] = sum;
                }
            }
            const sg = sums[kg];
            for (let x = 0; x < ncg; x++) {
                for (let z = 0; z < ncg; z++) {
                    let sum = 0;
                    for (let a = 0; a < nch; a++)
                        sum += y[x + a * ncg] * f[a + z * nch];
                    sg[x + z * ncg] += sum;
                }
            }
        }
    }
    return sums;
}
