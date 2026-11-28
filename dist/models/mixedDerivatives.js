// The derivatives that lmerTest's Satterthwaite approximation needs (oracle/lmertest-behaviour.md, section 1): the
// Hessian H of the deviance d(θ, σ) in the variance parameters varpar = (θ, σ), and the Jacobians J_k of the covariance
// of the fixed effects C(varpar) = σ² (R_X'R_X)⁻¹, at a given θ (σ from the penalised residual sum of squares).
// Computed analytically and sparsely; nothing is differentiated numerically.
//
// Written for rStats.js (no ported code) from the specification and the penalised least squares of D. Bates,
// M. Mächler, B. Bolker, S. Walker (2015), "Fitting Linear Mixed-Effects Models Using lme4", Journal of Statistical
// Software 67(1). The notation is that of src/models/mixedDeviance.ts: A = Λ'Z'ZΛ + I = L L', S = R_X'R_X,
// W = A⁻¹ Λ'Z'X (q × p), E = X − ZΛW (n × p), res = y − Xβ̂ − ZΛû, r² = ‖res‖² + ‖û‖² (the penalised residual sum of
// squares). Λ is linear in θ, Λ = Σ_k θ_k D_k with D_k the 0/1 pattern of θ_k's entries.
//
// The deviance. With ν = n − p (REML) or n (ML) and Φ(θ) = log det A [+ log det S for REML],
//   d(θ, σ) = Φ(θ) + r²(θ) / σ² + ν log(2π σ²),
// so ∂²d/∂θ_k∂θ_l = Φ_kl + r²_kl / σ², ∂²d/∂θ_k∂σ = −2 r²_k / σ³, ∂²d/∂σ² = 6 r² / σ⁴ − 2ν / σ².
//
// r²: r² is a minimum over (u, β), so r²_k = −2 res'Z D_k û (only the explicit dependence counts), and
//   r²_kl = −2 (∂_l res' Z D_k û + res' Z D_k ∂_l û),  ∂_l res = −Z D_l û − ZΛ ∂_l û − X ∂_l β,
// with (∂_l û, ∂_l β) from the normal equations M (∂u, ∂β) = (D_l'Z'res − Λ'Z'Z D_l û, −X'Z D_l û) (the derivative of
// M γ = G'y, G = [ZΛ, X]), solved with the factors of the fit and refined once with residuals from the data.
//
// log det A: ∂_k log det A = 2 tr(A⁻¹ Λ'Z'Z D_k) = 2 Σ_(r,c) (A⁻¹ Λ'Z'Z)[c, r] over the entries (r, c) of D_k (the
// gradient of mixedDeviance.ts), and its derivative along θ_l is
//   2 Σ_(r,c) (∂_l(A⁻¹) Λ'Z'Z + A⁻¹ D_l'Z'Z)[c, r].
// Both terms need their first factor only on the blocks of Z'Z, which lie on the pattern of L: A⁻¹ there is the selected
// inverse, and ∂_l(A⁻¹) there is the derivative of the selected inverse, obtained by differentiating, step by step, the
// left-looking factorisation (∂L from ∂A = D_l'Z'ZΛ + Λ'Z'Z D_l, a sparse matrix on the same pattern) and Takahashi's
// recurrences (forward-mode differentiation of the algorithms, exact up to rounding). Each direction costs about one
// factorisation and one selected inverse more.
//
// log det S (REML): ∂_k S = −E'Z D_k W − (E'Z D_k W)', so ∂_k log det S = tr(S⁻¹ ∂_k S), and
//   ∂_kl log det S = tr(S⁻¹ ∂_l ∂_k S) − tr(S⁻¹ ∂_k S S⁻¹ ∂_l S),
//   ∂_l ∂_k S = −(∂_l E' Z D_k W + E'Z D_k ∂_l W) − (...)',
//   ∂_l W = A⁻¹ (D_l'Z'E − Λ'Z'Z D_l W),  ∂_l E = −Z D_l W − ZΛ ∂_l W.
//
// The Jacobians: J_k = −σ² S⁻¹ ∂_k S S⁻¹ for θ_k and J_σ = 2σ S⁻¹.
import { factoriseSystemTangent, inverseFromFactor, lambdaTimes, lambdaTransposeTimes, levelTraceSums, plsState, selectedInverse, selectedInverseTangent, solveL, solveLt, } from "./mixedDeviance.js";
/** T1_g' Z'Z(g, h) T2_h for every block (g, h) of Z'Z (the layout of the blocks of A), from the blocks T1 and T2 */
function sandwich(sys, t1, t2) {
    const out = new Float64Array(sys.zz.length);
    let work = new Float64Array(64);
    for (let h = 0; h < sys.nGroups; h++) {
        const kc = sys.groupTerm[h];
        const ncc = sys.termNc[kc];
        const tc = t2[kc];
        for (let b = sys.blockStart[h]; b < sys.blockStart[h + 1]; b++) {
            const kr = sys.groupTerm[sys.blockRow[b]];
            const ncr = sys.termNc[kr];
            const tr = t1[kr];
            const base = sys.blockValueStart[b];
            if (work.length < ncr * ncc)
                work = new Float64Array(ncr * ncc);
            for (let c = 0; c < ncc; c++) {
                for (let r = 0; r < ncr; r++) {
                    let sum = 0;
                    for (let m = 0; m < ncc; m++)
                        sum += sys.zz[base + r + m * ncr] * tc[m + c * ncc];
                    work[r + c * ncr] = sum;
                }
            }
            for (let c = 0; c < ncc; c++) {
                for (let r = 0; r < ncr; r++) {
                    let sum = 0;
                    for (let m = 0; m < ncr; m++)
                        sum += tr[m + r * ncr] * work[m + c * ncr];
                    out[base + r + c * ncr] = sum;
                }
            }
        }
    }
    return out;
}
/** p × p column-major products */
function matMul(a, b, p) {
    const out = new Float64Array(p * p);
    for (let j = 0; j < p; j++) {
        for (let k = 0; k < p; k++) {
            const bkj = b[k + j * p];
            if (bkj === 0)
                continue;
            for (let i = 0; i < p; i++)
                out[i + j * p] += a[i + k * p] * bkj;
        }
    }
    return out;
}
const trace = (a, p) => {
    let s = 0;
    for (let i = 0; i < p; i++)
        s += a[i + i * p];
    return s;
};
const rowsOf = (a, p) => Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => a[i + j * p]));
/**
 * The deviance d(θ, σ) in the variance parameters, its gradient and Hessian, and the covariance of β̂ with its
 * Jacobians, at θ with σ = sqrt(r²(θ) / ν) (see the header). Internal.
 */
export function varparDerivatives(structure, theta, reml) {
    const st = plsState(structure, theta);
    const { sys, t, l, rx, ws, xResiduals, res, uv } = st;
    const { n, p, q } = sys;
    const nt = theta.length;
    const m = nt + 1;
    // Z v, Z' v
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
        const out = new Float64Array(q);
        for (let i = 0; i < n; i++) {
            const vi = v[i];
            if (vi === 0)
                continue;
            for (let c = sys.rowStart[i]; c < sys.rowStart[i + 1]; c++)
                out[sys.rowCols[c]] += sys.rowValues[c] * vi;
        }
        return out;
    };
    const xTransposeTimes = (v) => {
        const out = new Float64Array(p);
        for (let i = 0; i < n; i++) {
            const xi = structure.x[i];
            const vi = v[i];
            for (let k = 0; k < p; k++)
                out[k] += xi[k] * vi;
        }
        return out;
    };
    const xTimes = (v) => {
        const out = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const xi = structure.x[i];
            let sum = 0;
            for (let k = 0; k < p; k++)
                sum += xi[k] * v[k];
            out[i] = sum;
        }
        return out;
    };
    const solveA = (v) => {
        solveL(sys, l, v);
        solveLt(sys, l, v);
    };
    // the entries (r, c) of each D_k
    const entryRows = Array.from({ length: nt }, () => []);
    const entryCols = Array.from({ length: nt }, () => []);
    for (const { row, col, theta: k } of structure.lambda) {
        entryRows[k].push(row);
        entryCols[k].push(col);
    }
    /** D_k w */
    const dTimes = (k, w) => {
        const out = new Float64Array(q);
        const rs = entryRows[k];
        const cs = entryCols[k];
        for (let e = 0; e < rs.length; e++)
            out[rs[e]] += w[cs[e]];
        return out;
    };
    /** D_k' v */
    const dTransposeTimes = (k, v) => {
        const out = new Float64Array(q);
        const rs = entryRows[k];
        const cs = entryCols[k];
        for (let e = 0; e < rs.length; e++)
            out[cs[e]] += v[rs[e]];
        return out;
    };
    /** Σ over the entries (r, c) of D_k of a[r] b[c] */
    const entrySum = (k, a, b) => {
        const rs = entryRows[k];
        const cs = entryCols[k];
        let s = 0;
        for (let e = 0; e < rs.length; e++)
            s += a[rs[e]] * b[cs[e]];
        return s;
    };
    /** −(F'Z D_k G) − (...)' for q-vectors per column: F = the columns zf (Z'·), G = the columns g (p × p, column-major) */
    const symmetricEntryProduct = (k, zf, g, out, scale) => {
        for (let a = 0; a < p; a++) {
            for (let b = 0; b < p; b++) {
                const v = scale * entrySum(k, zf[a], g[b]);
                out[a + b * p] += v;
                out[b + a * p] += v;
            }
        }
    };
    let rss = 0;
    for (const e of res)
        rss += e * e;
    let ussq = 0;
    for (const v of uv)
        ussq += v * v;
    const prss = rss + ussq;
    const nu = reml ? n - p : n;
    const sigma2 = prss / nu;
    const sigma = Math.sqrt(sigma2);
    let logDetL = 0;
    for (let j = 0; j < q; j++)
        logDetL += Math.log(l[sys.colStart[j]]);
    logDetL *= 2;
    let logDetRX = 0;
    for (let k = 0; k < p; k++)
        logDetRX += Math.log(rx[k + k * p]);
    logDetRX *= 2;
    const phi = reml ? logDetL + logDetRX : logDetL;
    const deviance = phi + prss / sigma2 + nu * Math.log(2 * Math.PI * sigma2);
    const sInverse = inverseFromFactor(rx, p);
    const inv = selectedInverse(sys, l);
    const zRes = zTransposeTimes(res);
    const zE = xResiduals.map(zTransposeTimes);
    // first derivatives: Φ_k and r²_k; ∂_k S
    const sums = levelTraceSums(sys, inv, t);
    const phiGrad = new Array(nt).fill(0);
    const addTrace = (s, into, factor) => {
        sys.termTheta.forEach((idx, k) => {
            const nc = sys.termNc[k];
            for (let cl = 0; cl < nc; cl++)
                for (let rl = cl; rl < nc; rl++)
                    into[idx[rl + cl * nc]] += factor * s[k][cl + rl * nc];
        });
    };
    addTrace(sums, phiGrad, 2);
    const r2Grad = Array.from({ length: nt }, (_, k) => -2 * entrySum(k, zRes, uv));
    const dS = Array.from({ length: nt }, (_, k) => {
        const out = new Float64Array(p * p);
        symmetricEntryProduct(k, zE, ws, out, -1);
        return out;
    });
    if (reml)
        for (let k = 0; k < nt; k++)
            phiGrad[k] += trace(matMul(sInverse, dS[k], p), p);
    const sInvDS = dS.map((d) => matMul(sInverse, d, p));
    const hessian = Array.from({ length: m }, () => new Array(m).fill(0));
    for (let dir = 0; dir < nt; dir++) {
        // ∂T along θ_dir
        const dt = sys.termTheta.map((idx) => Float64Array.from(idx, (k) => (k === dir ? 1 : 0)));
        // log det A
        const da = sandwich(sys, dt, t);
        const daT = sandwich(sys, t, dt);
        for (let i = 0; i < da.length; i++)
            da[i] += daT[i];
        const dl = factoriseSystemTangent(sys, l, da);
        const dInv = selectedInverseTangent(sys, l, dl, inv);
        const column = new Array(nt).fill(0);
        const s1 = levelTraceSums(sys, dInv, t);
        const s2 = levelTraceSums(sys, inv, dt);
        addTrace(s1, column, 2);
        addTrace(s2, column, 2);
        // log det S (REML)
        if (reml && p > 0) {
            const dW = [];
            const zdE = [];
            for (let a = 0; a < p; a++) {
                const dw = dTransposeTimes(dir, zE[a]);
                const zdw = lambdaTransposeTimes(sys, t, zTransposeTimes(zTimes(dTimes(dir, ws[a]))));
                for (let i = 0; i < q; i++)
                    dw[i] -= zdw[i];
                solveA(dw);
                dW.push(dw);
                const inner = dTimes(dir, ws[a]);
                const lw = lambdaTimes(sys, t, dw);
                for (let i = 0; i < q; i++)
                    inner[i] += lw[i];
                const de = zTimes(inner);
                for (let i = 0; i < n; i++)
                    de[i] = -de[i];
                zdE.push(zTransposeTimes(de));
            }
            for (let k = 0; k < nt; k++) {
                const d2 = new Float64Array(p * p);
                symmetricEntryProduct(k, zdE, ws, d2, -1);
                symmetricEntryProduct(k, zE, dW, d2, -1);
                column[k] += trace(matMul(sInverse, d2, p), p) - trace(matMul(sInvDS[k], sInvDS[dir], p), p);
            }
        }
        // r²: the derivative of the penalised least-squares solution along θ_dir
        const zdu = zTimes(dTimes(dir, uv));
        const gu = dTransposeTimes(dir, zRes);
        const lzz = lambdaTransposeTimes(sys, t, zTransposeTimes(zdu));
        for (let i = 0; i < q; i++)
            gu[i] -= lzz[i];
        const gb = xTransposeTimes(zdu);
        for (let k = 0; k < p; k++)
            gb[k] = -gb[k];
        const du = gu.slice();
        const db = gb.slice();
        st.solveNormal(du, db);
        {
            // one step of refinement: the residual of the normal equations, M (du, db) from the data
            const fit = zTimes(lambdaTimes(sys, t, du));
            const xdb = xTimes(db);
            for (let i = 0; i < n; i++)
                fit[i] += xdb[i];
            const ru = lambdaTransposeTimes(sys, t, zTransposeTimes(fit));
            const rb = xTransposeTimes(fit);
            for (let i = 0; i < q; i++)
                ru[i] = gu[i] - ru[i] - du[i];
            for (let k = 0; k < p; k++)
                rb[k] = gb[k] - rb[k];
            st.solveNormal(ru, rb);
            for (let i = 0; i < q; i++)
                du[i] += ru[i];
            for (let k = 0; k < p; k++)
                db[k] += rb[k];
        }
        const dres = zTimes(lambdaTimes(sys, t, du));
        const xdb = xTimes(db);
        for (let i = 0; i < n; i++)
            dres[i] = -(zdu[i] + dres[i] + xdb[i]);
        const zdres = zTransposeTimes(dres);
        for (let k = 0; k < nt; k++) {
            const r2kl = -2 * (entrySum(k, zdres, uv) + entrySum(k, zRes, du));
            hessian[k][dir] = column[k] + r2kl / sigma2;
        }
    }
    // symmetric
    for (let k = 0; k < nt; k++) {
        for (let j = k + 1; j < nt; j++) {
            const v = (hessian[k][j] + hessian[j][k]) / 2;
            hessian[k][j] = v;
            hessian[j][k] = v;
        }
        const v = (-2 * r2Grad[k]) / (sigma2 * sigma);
        hessian[k][nt] = v;
        hessian[nt][k] = v;
    }
    hessian[nt][nt] = (6 * prss) / (sigma2 * sigma2) - (2 * nu) / sigma2;
    const gradient = [...phiGrad.map((g, k) => g + r2Grad[k] / sigma2), (-2 * prss) / (sigma2 * sigma) + (2 * nu) / sigma];
    const vcov = rowsOf(sInverse.map((v) => sigma2 * v), p);
    const jacobian = [
        ...dS.map((_, k) => rowsOf(matMul(sInvDS[k], sInverse, p).map((v) => -sigma2 * v), p)),
        rowsOf(sInverse.map((v) => 2 * sigma * v), p),
    ];
    return { varpar: [...theta, sigma], deviance, gradient, phiGradient: phiGrad, prssGradient: r2Grad, prss, hessian, beta: Array.from(st.beta), vcov, jacobian };
}
