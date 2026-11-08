// The Laplace deviance of a generalised linear mixed model (lme4's glmer) at given parameters: the conditional mode
// of the spherical random effects by penalised iteratively reweighted least squares (PIRLS), the log determinant of
// L_θ at the mode, and the family's aic term. Nothing is optimised here. At the end of the file: the Gauss-Hermite
// rule and the adaptive Gauss-Hermite quadrature deviance of nAGQ > 1 (stage 2e), built on the mode of nAGQ = 1.
//
// Written for rStats.js (no ported code) from oracle/glmer-behaviour.md ("The Laplace deviance", stage 2a) and the
// notation of D. Bates, M. Mächler, B. Bolker, S. Walker (2015), "Fitting Linear Mixed-Effects Models Using lme4",
// Journal of Statistical Software 67(1).
//
// With M = ZΛ_θ, η = o + Xβ + M u and μ = μ(η), the conditional mode ũ minimises the penalised deviance
// pdev(u) = Σ d_i + ‖u‖² (for nAGQ = 0, (ũ, β̃) minimise it jointly). Each PIRLS iteration is a Fisher scoring step,
// written here as an increment: with the working weights W_i = w_i μ'_i² / V(μ_i) and the score
// s_i = w_i (y_i − μ_i) μ'_i / V(μ_i),
//   (M'WM + I) δu = M's − u                                        (nAGQ = 1)
//   [M'WM + I, M'WX; X'WM, X'WX] (δu, δβ) = (M's − u, X's)          (nAGQ = 0)
// which is lme4's update u_new = (M'WM + I)⁻¹ M'W z (z the working response) in exact arithmetic, but whose fixed
// point (the score equations) does not depend on the accuracy of the solve. M'WM + I is factorised sparsely with the
// pattern of lmer's Λ'Z'ZΛ + I (src/models/mixedDeviance.ts), Z'WZ formed by blocks at each iteration.
//
// Unlike lme4, which stops when the relative change of pdev is below 1e-7 and takes the log determinant from the
// weights of the means before its last update (so that its deviance is off by up to about 1e-5), the iteration goes
// on to the exact mode: until the Fisher step is below 1e-13 (relative to the largest element of u and β, at least
// 1), or stops shrinking once below 1e-10 (rounding); the weights, the factor and the aic term are then those at the
// mode. Every evaluation starts from the same point, whatever was evaluated before: u = 0 for nAGQ = 1; for
// nAGQ = 0, the first step is lme4's first PIRLS step from the family's starting means (η0 = o + g(μ0)), or, where
// the iteration from there fails (an offset far from the data: lme4 fails too), glm.fit's (η0 = g(μ0)). A step that
// makes pdev NaN or larger is halved (up to 20 times, towards the previous iterate; the first step of nAGQ = 0, which
// has no previous pdev, only for NaN, towards u = 0, β = 0), with lme4's errors where that fails (an increase beyond
// 1e-7 relative to pdev, where lme4's tolerance is absolute). A step that stops shrinking while the decrease of pdev it
// predicts is at the level of rounding (nearly collinear predictors) ends the iteration too. The working weights and
// scores are formed from the powers of μ where μ'² or V overflow (src/models/glmerFamily.ts).
import { potf2 } from "../linalg/chol.js";
import { Warnings, withWarnings } from "../internal/warnings.js";
import { familyAic } from "./glmFamily.js";
import { workingScore, workingWeight } from "./glmerFamily.js";
import { laplaceGradient, rowWeights } from "./glmerGradient.js";
import { backSolve, blocksOf, blocksOfA, factorise, forwardSolve, lambdaTimes, lambdaTransposeTimes, solveL, solveLt, sparseSystemOf, weightedCrossProduct, zTimes, zTransposeTimes, } from "./mixedDeviance.js";
/** lme4's maximum number of step halvings */
const MAX_HALVINGS = 20;
/** The largest number of iterations (more than lme4's 100: Fisher scoring converges linearly for non-canonical links) */
const MAX_ITERATIONS = 500;
/** The step (relative to the largest element of u and β, at least 1) at which the mode is reached */
const STEP_TOLERANCE = 1e-13;
/** Below this step, a step that does not shrink means rounding: the mode is reached */
const ROUNDING_STEP = 1e-10;
/** A step that does not shrink and predicts a decrease of pdev below this (relative) means rounding too */
const FLAT_DECREASE = 1e-13;
/**
 * lme4's tolPwrss, here relative: an increase of pdev larger than this times pdev after the halvings is an error.
 * (lme4's is absolute, which made the rounding of a pdev of 1e10, prior weights 2^30, an error: the deviance scales
 * with the weights)
 */
const TOL_PWRSS = 1e-7;
/**
 * The Laplace deviance of a generalised linear mixed model at `theta` (and `beta` for nAGQ = 1), at the exact
 * conditional mode (oracle/glmer-behaviour.md, stage 2a). Internal: not exported from the package.
 *
 * @param structure The structure from {@link glmerStructure}.
 * @param theta The covariance parameters (finite, of the length of `structure.theta`; values below the lower bounds
 *   are accepted).
 * @param beta The fixed effects (one per column of X) for nAGQ = 1; ignored for nAGQ = 0.
 * @param nAGQ 1: the deviance is a function of (θ, β), the mode is found for u; 0: a function of θ, the mode is found
 *   for u and β jointly.
 * @param options `rx`: also return R_X'R_X at the mode (for the covariance of the fixed effects); `gradient`: also
 *   return the gradient of the deviance.
 */
export function glmerDeviance(structure, theta, beta, nAGQ = 1, options = {}) {
    if (nAGQ !== 0 && nAGQ !== 1)
        throw new RangeError("nAGQ must be 0 or 1 here");
    if (theta.length !== structure.theta.length)
        throw new RangeError(`theta must have length ${structure.theta.length}, not ${theta.length}`);
    if (theta.some((v) => !Number.isFinite(v)))
        throw new RangeError("theta must be finite");
    const sys = sparseSystemOf(structure);
    const { n, p, q } = sys;
    if (nAGQ === 1) {
        if (beta === undefined || beta.length !== p)
            throw new RangeError(`beta must have length ${p}`);
        if (beta.some((v) => !Number.isFinite(v)))
            throw new RangeError("beta must be finite");
    }
    const joint = nAGQ === 0;
    const fam = structure.family;
    const { x, y, weights: w, offset } = structure;
    const t = blocksOf(sys, theta);
    const warnings = new Warnings();
    return withWarnings(warnings, () => {
        const pointAt = (u, b) => {
            const mb = zTimes(sys, lambdaTimes(sys, t, u));
            const eta = new Float64Array(n);
            const mu = new Float64Array(n);
            let devResid = 0;
            for (let i = 0; i < n; i++) {
                const xi = x[i];
                let e = offset[i] + mb[i];
                for (let k = 0; k < p; k++)
                    e += xi[k] * b[k];
                eta[i] = e;
                const m = fam.linkinv(e);
                mu[i] = m;
                devResid += fam.devResid(y[i], m, w[i]);
            }
            let ussq = 0;
            for (const v of u)
                ussq += v * v;
            return { u, beta: b, eta, mu, devResid, pdev: devResid + ussq };
        };
        /** The working weights and W(η − o − Xβ_base) + s (the right-hand side's data part) at η, μ */
        const weightsAt = (eta, mu) => {
            const ww = new Float64Array(n);
            const score = new Float64Array(n);
            for (let i = 0; i < n; i++) {
                const wi = w[i];
                if (wi === 0)
                    continue;
                const me = fam.muEta(eta[i]);
                ww[i] = workingWeight(fam, wi, me, mu[i]);
                score[i] = workingScore(fam, wi, y[i], me, mu[i]);
            }
            return { ww, score };
        };
        /**
         * Factorises the system at the weights `ww` and returns its factor L and the solver of the step: overwrites gu
         * with δu (and gb with δβ for nAGQ = 0)
         */
        const systemAt = (ww) => {
            const l = factorise(sys, blocksOfA(sys, t, weightedCrossProduct(sys, structure, ww)));
            if (!joint) {
                return {
                    l,
                    solve: (gu) => {
                        solveL(sys, l, gu);
                        solveLt(sys, l, gu);
                    },
                };
            }
            // C = L⁻¹ Λ'Z'WX (q × p, column-major) and R_X'R_X = X'WX − C'C (the matrix of the step only: its accuracy
            // affects the speed of the iteration, not its fixed point)
            const c = new Float64Array(q * p);
            for (let k = 0; k < p; k++) {
                const col = lambdaTransposeTimes(sys, t, zTransposeTimes(sys, Float64Array.from(x, (row, i) => ww[i] * row[k])));
                solveL(sys, l, col);
                c.set(col, k * q);
            }
            const rx = new Float64Array(p * p);
            for (let k = 0; k < p; k++) {
                for (let m = k; m < p; m++) {
                    let sum = 0;
                    for (let i = 0; i < n; i++)
                        sum += ww[i] * x[i][k] * x[i][m];
                    for (let i = 0; i < q; i++)
                        sum -= c[i + k * q] * c[i + m * q];
                    rx[k + m * p] = sum;
                    rx[m + k * p] = sum;
                }
            }
            if (p > 0 && potf2({ nrow: p, ncol: p, data: rx }) > 0) {
                throw new Error("the fixed-effects matrix of the penalised least squares is not positive definite");
            }
            return {
                l,
                solve: (gu, gb) => {
                    solveL(sys, l, gu);
                    for (let k = 0; k < p; k++) {
                        let sum = gb[k];
                        for (let i = 0; i < q; i++)
                            sum -= c[i + k * q] * gu[i];
                        gb[k] = sum;
                    }
                    forwardSolve(rx, p, gb);
                    backSolve(rx, p, gb);
                    for (let k = 0; k < p; k++) {
                        const bk = gb[k];
                        for (let i = 0; i < q; i++)
                            gu[i] -= c[i + k * q] * bk;
                    }
                    solveLt(sys, l, gu);
                },
            };
        };
        const infNorm = (v) => {
            let m = 0;
            for (const e of v)
                m = Math.max(m, Math.abs(e));
            return m;
        };
        const fixedBeta = Float64Array.from(beta ?? new Array(p).fill(0));
        /**
         * The iteration to the mode from its starting point: u = 0 (nAGQ = 1); for nAGQ = 0, η0 = o + g(μ0) (lme4's), or
         * η0 = g(μ0) without the offset (glm.fit's) when `withOffset` is false; η0 is not of the form o + Xβ + Mu: the
         * first step solves for (u, β) from it (base u = 0, β = 0)
         */
        const iterate = (withOffset) => {
            let cur;
            let first = joint;
            if (joint) {
                const eta = Float64Array.from(structure.mustart, (m, i) => (withOffset ? offset[i] : 0) + fam.linkfun(m));
                const mu = eta.map((e) => fam.linkinv(e));
                cur = { u: new Float64Array(q), beta: new Float64Array(p), eta, mu, devResid: NaN, pdev: Infinity };
            }
            else
                cur = pointAt(new Float64Array(q), fixedBeta);
            let prevSize = Infinity;
            let l;
            let iterations = 0;
            for (;;) {
                if (iterations >= MAX_ITERATIONS)
                    throw new Error("pwrssUpdate did not converge in (maxit) iterations");
                const { ww, score } = weightsAt(cur.eta, cur.mu);
                const system = systemAt(ww);
                l = system.l;
                // the right-hand side: (M's − u, X's); for the first step of nAGQ = 0 (from η0, base 0) (M'r, X'r) with
                // r = W(η0 − o) + s, the working response times the weights
                let rhs = score;
                if (first)
                    rhs = score.map((s, i) => s + ww[i] * (cur.eta[i] - offset[i]));
                const du = lambdaTransposeTimes(sys, t, zTransposeTimes(sys, rhs));
                if (!first)
                    for (let i = 0; i < q; i++)
                        du[i] -= cur.u[i];
                const db = new Float64Array(p);
                if (joint) {
                    for (let i = 0; i < n; i++) {
                        const xi = x[i];
                        const r = rhs[i];
                        for (let k = 0; k < p; k++)
                            db[k] += xi[k] * r;
                    }
                }
                const gu = du.slice();
                const gb = db.slice();
                system.solve(du, db);
                iterations++;
                const base = first ? { u: new Float64Array(q), beta: new Float64Array(p) } : cur;
                if (!first) {
                    const size = Math.max(infNorm(du) / Math.max(1, infNorm(cur.u)), joint ? infNorm(db) / Math.max(1, infNorm(cur.beta)) : 0);
                    // the mode: the step is negligible, or has stopped shrinking at the level of rounding
                    if (size <= STEP_TOLERANCE || (size < ROUNDING_STEP && size >= prevSize))
                        break;
                    if (size >= prevSize) {
                        // a step that has stopped shrinking above that level, along a direction in which pdev is flat (nearly
                        // collinear columns of X: the steps wander along it, by the rounding of the solve, while pdev does not
                        // change): the mode is reached where the decrease of pdev that the step predicts, g'δ, is at the
                        // level of rounding of pdev (only here: the steps of an ordinary iteration shrink to the tolerance)
                        let decrease = 0;
                        for (let i = 0; i < q; i++)
                            decrease += gu[i] * du[i];
                        for (let k = 0; k < p; k++)
                            decrease += gb[k] * db[k];
                        if (decrease <= FLAT_DECREASE * Math.abs(cur.pdev))
                            break;
                    }
                    prevSize = size;
                }
                const candidate = () => {
                    const u = base.u.map((v, i) => v + du[i]);
                    const b = joint ? base.beta.map((v, k) => v + db[k]) : fixedBeta;
                    return pointAt(u, b);
                };
                let next = candidate();
                // step halving: for NaN, or (after the first step of nAGQ = 0) an increase beyond rounding
                const pdevOld = cur.pdev;
                const slack = Number.isFinite(pdevOld) ? 1e-13 * pdevOld : 0;
                for (let k = 0; k < MAX_HALVINGS && (Number.isNaN(next.pdev) || next.pdev > pdevOld + slack); k++) {
                    for (let i = 0; i < q; i++)
                        du[i] /= 2;
                    for (let i = 0; i < p; i++)
                        db[i] /= 2;
                    next = candidate();
                }
                if (Number.isNaN(next.pdev))
                    throw new Error("PIRLS loop resulted in NaN value");
                if (next.pdev - pdevOld > TOL_PWRSS * Math.abs(pdevOld))
                    throw new Error("(maxstephalfit) PIRLS step-halvings failed to reduce deviance in pwrssUpdate");
                cur = next;
                first = false;
            }
            return { cur, l, iterations };
        };
        let mode;
        try {
            mode = iterate(true);
        }
        catch (e) {
            // nAGQ = 0 with an offset far from the data (log(exposure), a constant −4: μ0 times e^o): lme4's start fails
            // (lme4 fails there too), glm.fit's start η0 = g(μ0) leads to the same mode. Where both fail, lme4's error
            if (!joint || !(e instanceof Error) || e.constructor !== Error || offset.every((o) => o === 0))
                throw e;
            try {
                mode = iterate(false);
            }
            catch {
                throw e;
            }
        }
        const { cur, l, iterations } = mode;
        // at the mode: the factor of the last iteration was formed with the weights at the mode
        let ldL2 = 0;
        for (let j = 0; j < q; j++)
            ldL2 += Math.log(l[sys.colStart[j]]);
        ldL2 *= 2;
        const mu = Array.from(cur.mu);
        const aic = familyAic(fam.glm, y, mu, w, structure.size, cur.devResid, warnings);
        let ussq = 0;
        for (const v of cur.u)
            ussq += v * v;
        let rxtrx;
        if (options.rx === true) {
            // X'WX − C'C with C = L⁻¹ Λ'Z'WX, L the factor at the weights of the mode (that of the last iteration)
            const { ww } = weightsAt(cur.eta, cur.mu);
            const c = Array.from({ length: p }, (_, k) => {
                const col = lambdaTransposeTimes(sys, t, zTransposeTimes(sys, Float64Array.from(x, (row, i) => ww[i] * row[k])));
                solveL(sys, l, col);
                return col;
            });
            rxtrx = Array.from({ length: p }, (_, k) => Array.from({ length: p }, (_, m) => {
                let sum = 0;
                for (let i = 0; i < n; i++)
                    sum += ww[i] * x[i][k] * x[i][m];
                for (let i = 0; i < q; i++)
                    sum -= c[k][i] * c[m][i];
                return sum;
            }));
        }
        const gradient = options.gradient === true
            ? laplaceGradient({ structure, sys, t, l, u: cur.u, eta: cur.eta, mu: cur.mu, devResid: cur.devResid, joint })
            : undefined;
        return {
            deviance: ldL2 + ussq + aic,
            beta: Array.from(cur.beta),
            u: Array.from(cur.u),
            b: Array.from(lambdaTimes(sys, t, cur.u)),
            mu,
            eta: Array.from(cur.eta),
            devResid: cur.devResid,
            ussq,
            pdev: cur.devResid + ussq,
            ldL2,
            aic,
            iterations,
            warnings: warnings.list,
            ...(rxtrx === undefined ? {} : { rxtrx }),
            ...(gradient === undefined ? {} : { gradient }),
        };
    });
}
const ruleCache = new Map();
/**
 * The orthonormal Hermite polynomials h_j = He_j / √(j!) at x for j = 0..K by their recurrence
 * h_(j+1) = (x h_j − √j h_(j−1)) / √(j+1): returns h_K, h_(K−1) and Σ_(j<K) h_j²
 */
function hermiteAt(x, k) {
    let prev = 0;
    let cur = 1;
    let sum = 0;
    for (let j = 0; j < k; j++) {
        sum += cur * cur;
        const next = (x * cur - Math.sqrt(j) * prev) / Math.sqrt(j + 1);
        prev = cur;
        cur = next;
    }
    return { hk: cur, hk1: prev, sum };
}
/**
 * The K-point Gauss-Hermite rule for the standard normal density (K = 1..100): the nodes are the zeros of the
 * probabilists' Hermite polynomial He_K, the weights 1 / Σ_(j<K) He_j(z)² / j!. The positive zeros are bracketed by a
 * scan of the sign of He_K (step 0.01, well below the smallest spacing of the zeros, about π / √(2K + 1) = 0.22 for
 * K = 100), narrowed by bisection and finished by Newton's method (He_K' = K He_(K−1)); the negative nodes are their
 * mirror images and the middle node of an odd rule is exactly 0, so the rule is symmetric as lme4's symmetrised table
 * is. Cached per K.
 */
export function gaussHermiteRule(k) {
    const cached = ruleCache.get(k);
    if (cached !== undefined)
        return cached;
    if (!Number.isInteger(k) || k < 1 || k > 100)
        throw new RangeError("the number of quadrature points must be an integer from 1 to 100");
    const positive = [];
    // (the largest zero of He_K is below √(4K + 2))
    const end = Math.sqrt(4 * k + 2) + 0.5;
    const step = 0.01;
    const valueAt = (x) => hermiteAt(x, k).hk;
    let a = k % 2 === 1 ? step / 2 : 0;
    let fa = valueAt(a);
    while (a < end && positive.length < Math.floor(k / 2)) {
        const b = a + step;
        const fb = valueAt(b);
        if (fb === 0 || Math.sign(fa) !== Math.sign(fb)) {
            // bisection to a bracket of 1e-6, then Newton's method to convergence
            let lo = a;
            let hi = b;
            let flo = fa;
            while (hi - lo > 1e-6) {
                const mid = (lo + hi) / 2;
                const fm = valueAt(mid);
                if (Math.sign(fm) === Math.sign(flo)) {
                    lo = mid;
                    flo = fm;
                }
                else
                    hi = mid;
            }
            let z = (lo + hi) / 2;
            for (let it = 0; it < 20; it++) {
                const { hk, hk1 } = hermiteAt(z, k);
                const dz = hk / (Math.sqrt(k) * hk1);
                z -= dz;
                if (Math.abs(dz) <= 1e-17 * Math.max(1, Math.abs(z)))
                    break;
            }
            positive.push(z);
        }
        a = b;
        fa = fb;
    }
    if (positive.length !== Math.floor(k / 2))
        throw new Error(`gaussHermiteRule: found ${positive.length} positive zeros for K = ${k}`);
    const weightOf = (z) => 1 / hermiteAt(z, k).sum;
    const nodes = [...positive.map((z) => -z).reverse(), ...(k % 2 === 1 ? [0] : []), ...positive];
    const weights = nodes.map((z) => weightOf(Math.abs(z)));
    const rule = { nodes, weights };
    ruleCache.set(k, rule);
    return rule;
}
/**
 * The adaptive Gauss-Hermite quadrature deviance D_K(θ, β) of a model with one scalar random-effects term, at the
 * exact conditional mode (that of nAGQ = 1, {@link glmerDeviance}) with the rule of {@link gaussHermiteRule}
 * (oracle/glmer-behaviour.md, "The deviance at given (θ, β)"). Internal: not exported from the package.
 *
 * @param structure The structure (one random-effects term with one column).
 * @param theta θ (one value).
 * @param beta The fixed effects.
 * @param nAGQ The number of points K (2 to 100).
 * @param options `rx`: also return R_X'R_X at the mode; `gradient`: also the gradient in (θ, β).
 */
export function glmerAgqDeviance(structure, theta, beta, nAGQ, options = {}) {
    if (structure.terms.length !== 1 || structure.terms[0].columns.length !== 1)
        throw new RangeError("AGQ only defined for a single scalar random-effects term");
    const rule = gaussHermiteRule(nAGQ);
    const mode = glmerDeviance(structure, theta, beta, 1, { ...(options.rx === true ? { rx: true } : {}) });
    const fam = structure.family;
    const { y, weights: w } = structure;
    const th = theta[0];
    // (the log weights plus z²/2, which stay below 0 for every K ≤ 100)
    const logWeights = rule.nodes.map((z, k) => Math.log(rule.weights[k]) + (z * z) / 2);
    let ldL2 = 0;
    let quad = 0;
    // the gradient (options.gradient): ∂D_K/∂e_i and ∂D_K/∂c_i for the fixed part e_i = o_i + x_i'β and c_i = z_i θ of
    // each row (see gradientOfLevel), then by the chain rule in β and θ; a row outside every level only through d_i
    const grad = options.gradient === true ? { ...rowWeights(structure, mode.eta, mode.mu), ge: new Float64Array(y.length), gc: new Float64Array(y.length) } : undefined;
    if (grad !== undefined)
        for (let i = 0; i < y.length; i++)
            grad.ge[i] = -2 * grad.score[i];
    const condSd = structure.z.map((col, j) => {
        const uj = mode.u[j];
        const c = col.values.map((v) => v * th);
        // L_j² = 1 + Σ W_i c_i² with the Fisher weights at the mode
        let l2 = 1;
        col.rows.forEach((i, m) => {
            if (w[i] === 0)
                return;
            l2 += workingWeight(fam, w[i], fam.muEta(mode.eta[i]), mode.mu[i]) * c[m] * c[m];
        });
        ldL2 += Math.log(l2);
        const sd = 1 / Math.sqrt(l2);
        const d0 = col.rows.map((i) => fam.devResid(y[i], mode.mu[i], w[i]));
        let sum = 0;
        rule.nodes.forEach((z, k) => {
            let delta = 0;
            if (z !== 0) {
                const t = z * sd;
                delta = t * (2 * uj + t);
                col.rows.forEach((i, m) => {
                    if (c[m] === 0)
                        return;
                    delta += fam.devResid(y[i], fam.linkinv(mode.eta[i] + c[m] * t), w[i]) - d0[m];
                });
            }
            sum += Math.exp(logWeights[k] - delta / 2);
        });
        quad -= 2 * Math.log(sum);
        if (grad !== undefined)
            gradientOfLevel(structure, rule, logWeights, col.rows, c, uj, l2, mode.eta, grad);
        return sd;
    });
    let gradient;
    if (grad !== undefined) {
        // β: Σ ∂D/∂e_i x_i; θ: Σ ∂D/∂c_i z_i
        const p = beta.length;
        gradient = new Array(1 + p).fill(0);
        for (let i = 0; i < y.length; i++)
            for (let k = 0; k < p; k++)
                gradient[1 + k] += grad.ge[i] * structure.x[i][k];
        for (const col of structure.z)
            col.rows.forEach((i, m) => (gradient[0] += grad.gc[i] * col.values[m]));
    }
    return { ...mode, deviance: mode.devResid + mode.ussq + ldL2 + quad, ldL2, quad, condSd, ...(gradient === undefined ? {} : { gradient }) };
}
/**
 * The derivatives of one level's part of the AGQ deviance with respect to e_i = o_i + x_i'β and c_i = z_i θ of its
 * rows (oracle/glmer-behaviour.md, "The gradient (rStats.js)"). The level's part is
 *   D_j = log L² − 2 log Σ_k ω_k exp(−P(v_k) / 2),  v_k = u + z_k / L,  ω_k = w_k exp(z_k² / 2),
 * with P(v) = Σ d_i(e_i + c_i v) + v², L² = 1 + Σ W_i c_i² at the mode u, which solves Σ s_i c_i = u. With π_k the
 * normalised terms, P'(v) = 2v − 2 Σ s_i c_i, κ = Σ π_k P'(v_k) z_k / (2L³) and H = 1 + Σ Ŵ_i c_i²:
 *   ∂D_j/∂e_i = (1/L² − κ) W'_i c_i² − 2 Σ_k π_k s_i(v_k) + A_u ∂u/∂e_i,     ∂u/∂e_i = −Ŵ_i c_i / H,
 *   ∂D_j/∂c_i = (1/L² − κ)(W'_i c_i² u + 2 W_i c_i) − 2 Σ_k π_k s_i(v_k) v_k + A_u ∂u/∂c_i,  ∂u/∂c_i = (s_i − Ŵ_i c_i u) / H,
 *   A_u = (1/L² − κ) Σ W'_i c_i³ + Σ_k π_k P'(v_k)  (the derivative in u at fixed e and c).
 * Writes ge and gc of the level's rows.
 */
function gradientOfLevel(structure, rule, logWeights, rows, c, u, l2, eta, grad) {
    const fam = structure.family;
    const { y, weights: w } = structure;
    const lv = Math.sqrt(l2);
    const nr = rows.length;
    const d0 = rows.map((i) => fam.devResid(y[i], fam.linkinv(eta[i]), w[i]));
    // the terms of each node: log of ω_k exp(−(P(v_k) − P(u)) / 2), P'(v_k), and the scores at the node
    const nodes = rule.nodes.length;
    const logTerm = new Float64Array(nodes);
    const slope = new Float64Array(nodes);
    const scores = [];
    rule.nodes.forEach((z, k) => {
        const t = z / lv;
        let delta = t * (2 * u + t);
        let sc = 0;
        const sk = new Float64Array(nr);
        rows.forEach((i, m) => {
            if (w[i] === 0)
                return;
            const e = eta[i] + c[m] * t;
            const mu = fam.linkinv(e);
            if (c[m] !== 0 && z !== 0)
                delta += fam.devResid(y[i], mu, w[i]) - d0[m];
            const s = workingScore(fam, w[i], y[i], fam.muEta(e), mu);
            sk[m] = s;
            sc += s * c[m];
        });
        logTerm[k] = logWeights[k] - delta / 2;
        slope[k] = 2 * (u + t) - 2 * sc;
        scores.push(sk);
    });
    let top = -Infinity;
    for (const v of logTerm)
        top = Math.max(top, v);
    let total = 0;
    const pi = logTerm.map((v) => Math.exp(v - top));
    for (const v of pi)
        total += v;
    let kappa = 0;
    let slopeMean = 0;
    rule.nodes.forEach((z, k) => {
        pi[k] /= total;
        kappa += (pi[k] * slope[k] * z) / (2 * l2 * lv);
        slopeMean += pi[k] * slope[k];
    });
    const factor = 1 / l2 - kappa;
    let h = 1;
    let cubic = 0;
    rows.forEach((i, m) => {
        h += grad.observed[i] * c[m] * c[m];
        cubic += grad.dww[i] * c[m] * c[m] * c[m];
    });
    const au = factor * cubic + slopeMean;
    rows.forEach((i, m) => {
        let sMean = 0;
        let svMean = 0;
        rule.nodes.forEach((z, k) => {
            const s = scores[k][m];
            sMean += pi[k] * s;
            svMean += pi[k] * s * (u + z / lv);
        });
        const ci = c[m];
        const wd = grad.dww[i];
        grad.ge[i] = factor * wd * ci * ci - 2 * sMean + (au * -grad.observed[i] * ci) / h;
        grad.gc[i] = factor * (wd * ci * ci * u + 2 * grad.ww[i] * ci) - 2 * svMean + (au * (grad.score[i] - grad.observed[i] * ci * u)) / h;
    });
}
