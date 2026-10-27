// Linear mixed models fitted by REML or maximum likelihood (lme4's lmer): the estimate of θ that minimises the
// profiled REML criterion or ML deviance, and the fit's results at it (fixed effects and their covariance, σ, the
// variance components, the conditional modes of the random effects, fitted values, log-likelihood and information
// criteria).
//
// Written for rStats.js (no ported code) from oracle/lmer-behaviour.md (stage 1c, "The fit and its results") and
// D. Bates, M. Mächler, B. Bolker, S. Walker (2015), "Fitting Linear Mixed-Effects Models Using lme4", Journal of
// Statistical Software 67(1). The structure comes from src/models/mixedStructure.ts and the criterion with its
// analytic gradient from src/models/mixedDeviance.ts.
//
// The criterion does not change when a column of a block T_k changes sign (Λ_θ → Λ_θ D with D = diag(±1) per level,
// matched by u → D u), so the bounds θ_jj ≥ 0 on the diagonal elements only choose one of equivalent parameter
// vectors. They are therefore not enforced during the minimisation: θ is minimised without bounds and, at the end,
// each column whose diagonal element is negative changes sign. This removes the difficulties of the bounds: the
// last diagonal element of a block is alone in its column, so the criterion is even in it, and 0 is a stationary
// point that may be a minimum (the optimum on the boundary) or a maximum along it (the optimum just inside, with a
// concave region between); a method that enforces the bound stops at 0 in both cases (its projected gradient is
// exactly 0, and L-BFGS-B's first step from θ = 1 lands exactly there in a one-element problem). And a leading
// diagonal element at 0 with a positive derivative satisfies the bound's optimality conditions without being a
// minimum of the model: with the elements below it changed in sign (the same model), the derivative is negative.
//
// The minimisation is a trust-region Newton method (θ has few elements): at each iteration the Hessian on the free
// elements from central differences of the analytic gradient (step 1e-4 |θ_j|, at least 1e-6 max(1, max |θ|)), its
// eigen-decomposition (Jacobi rotations), and the step that minimises the quadratic model within the region: the
// Newton step when the Hessian is positive definite and the step fits, otherwise a step on the boundary of the region
// that follows negative curvature where there is some, so that concave regions and stationary points that are not
// minima are left. The region starts at 0.25 max(1, max |θ|), so that the search stays local (as lme4's does) when
// the criterion has several minima. A step is accepted when the actual reduction is at least 0.1 of the predicted one;
// where the values of the criterion are equal to rounding (it can be that flat near 0), the actual reduction is taken
// from the gradients by the trapezoid rule. Eigenvalues below 1e-6 of the largest count as 0 (flat to the accuracy of
// the Hessian, as along a set of equivalent minimisers). Convergence: a Newton step below 1e-13 max(1, max |θ|), or
// steps at rounding level that stop decreasing (with a fresh Hessian), with the gradient below 1e-9 max(1, |criterion|).
// The Hessian is used again in the next iteration after a Newton step that was accepted with an actual reduction
// within 0.75 to 1/0.75 of the predicted one and at most half the previous Newton step: the model is still good there,
// and its 2m evaluations of the gradient are saved while the convergence stays fast.
//
// At convergence, diagonal elements below 1e-4 max(1, max |θ|) are set to exactly 0 and held there while the others
// converge again; an element held at 0 is released if the derivative there is not 0 (to rounding), or if the Hessian
// of all the elements has a direction of negative curvature that moves it (then θ is moved a little along it).
// lme4's own optimiser (and its convergence warnings) are not reproduced: the result is the exact minimiser, which
// lme4 approaches to its tolerances.
//
// The criterion can have several local minima (crossed terms without a fixed intercept, for example, where one term
// can take the place of the missing intercept). So the local minimum θ* reached from the initial θ is compared with
// the boundary points of whole terms (oracle/report-0.14.0-behaviour.md, section 1): for each term whose block is not
// entirely 0 in θ*, the local minimum started at θ* with that term removed (its whole block set to 0) and held at 0.
// If the lowest of these is lower than θ*'s criterion by more than 1e-8 max(1, |criterion|), the minimisation starts
// again from it with every element free, and the comparison is repeated; otherwise θ* is the estimate (at most 50
// restarts). Only whole terms are removed, one at a time.
//
// The penalised least-squares problem is linear in y: y − X β₀ for any β₀ gives the same criterion, residuals,
// random effects and derivatives, and β̂ − β₀. So the fit works with y − X β₀, β₀ the least-squares coefficients of y
// on X, and adds β₀ back to the fixed effects: with a response of large mean, the rounding error of the fixed effects
// from the normal equations would otherwise be large next to the residuals, and the criterion noisy. If y − X β₀ is
// 0 (to 1e-12 max |y|), the criterion is −∞ for every θ and there is no estimate: an error.
import { qr, qrCoef } from "../linalg/qr.js";
import { profiledDeviance } from "./mixedDeviance.js";
import { mixedModelStructure } from "./mixedStructure.js";
/** Initial trust-region radius, relative to max(1, max |θ|) */
const INITIAL_RADIUS = 0.25;
/** Step of the central differences of the gradient that give the Hessian, relative to |θ_j| ... */
const HESSIAN_STEP = 1e-4;
/** ... and at least this (relative to max(1, max |θ|)), for elements at or near 0 */
const HESSIAN_STEP_FLOOR = 1e-6;
/** Eigenvalues of the Hessian below this times the largest are treated as 0 (the Hessian's own accuracy) */
const EIGENVALUE_TOLERANCE = 1e-6;
/** Diagonal elements below this (relative to max(1, max |θ|)) at convergence are candidates for the boundary */
const BOUNDARY_CANDIDATE = 1e-4;
/** The move along a direction of negative curvature that leaves the boundary (relative to max(1, max |θ|)) */
const NEGATIVE_CURVATURE_MOVE = 1e-3;
/** Converged when the Newton step is below this, relative to max(1, max |θ|) ... */
const STEP_TOLERANCE = 1e-13;
/** ... or when the steps stop decreasing (rounding level) below this; steps this small are always accepted */
const STEP_FLOOR = 1e-10;
/** The gradient on the free elements at convergence must be below this times max(1, |criterion|) */
const GRADIENT_TOLERANCE = 1e-9;
const MAX_ITERATIONS = 500;
/** The Hessian is used again after a Newton step whose actual reduction is within this ratio of the predicted one */
const HESSIAN_REUSE_RATIO = 0.75;
/** A restart from a boundary point must lower the criterion by more than this times max(1, |criterion|) ... */
const RESTART_THRESHOLD = 1e-8;
/** ... and there are at most this many restarts */
const MAX_RESTARTS = 50;
/** The response is fitted exactly by the fixed effects when its least-squares residuals are below this × max |y| */
const EXACT_FIT = 1e-12;
const EXACT_FIT_ERROR = "lmer: the response is fitted exactly by the fixed effects (a constant response, for example), so the residual variance is 0";
const OPTIMISATION_FAILED = "lmer: the minimisation of the criterion over theta did not converge";
/** Eigenvalues and eigenvectors of a small symmetric matrix by cyclic Jacobi rotations; vectors[k] is the k-th vector */
function symmetricEigen(a0) {
    const m = a0.length;
    const a = a0.map((row) => row.slice());
    const v = a.map((_, i) => a.map((_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
        let off = 0;
        let total = 0;
        for (let i = 0; i < m; i++) {
            for (let j = 0; j < m; j++) {
                total += a[i][j] ** 2;
                if (i !== j)
                    off += a[i][j] ** 2;
            }
        }
        if (off <= 1e-32 * total)
            break;
        for (let p = 0; p < m - 1; p++) {
            for (let q = p + 1; q < m; q++) {
                const apq = a[p][q];
                if (apq === 0)
                    continue;
                const tau = (a[q][q] - a[p][p]) / (2 * apq);
                const t = Math.sign(tau || 1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
                const c = 1 / Math.sqrt(1 + t * t);
                const sn = t * c;
                for (let k = 0; k < m; k++) {
                    const akp = a[k][p];
                    const akq = a[k][q];
                    a[k][p] = c * akp - sn * akq;
                    a[k][q] = sn * akp + c * akq;
                }
                for (let k = 0; k < m; k++) {
                    const apk = a[p][k];
                    const aqk = a[q][k];
                    a[p][k] = c * apk - sn * aqk;
                    a[q][k] = sn * apk + c * aqk;
                }
                for (let k = 0; k < m; k++) {
                    const vkp = v[k][p];
                    const vkq = v[k][q];
                    v[k][p] = c * vkp - sn * vkq;
                    v[k][q] = sn * vkp + c * vkq;
                }
            }
        }
    }
    return { values: a.map((row, i) => row[i]), vectors: a.map((_, k) => v.map((row) => row[k])) };
}
const norm = (x) => Math.sqrt(x.reduce((sum, v) => sum + v * v, 0));
const dot = (x, y) => x.reduce((sum, v, i) => sum + v * y[i], 0);
/**
 * The step p that minimises g'p + p'Hp/2 subject to ‖p‖ ≤ radius (H = V diag(λ) V'), and whether it is the Newton
 * step. Eigenvalues within `zero` of 0 are treated as 0: along their eigenvectors the criterion is flat to the
 * accuracy of the Hessian (as along a set of equivalent minimisers), and the Newton step leaves them out when the
 * gradient's component there is below `gradientZero`.
 */
function trustRegionStep(g, eig, radius, zero, gradientZero) {
    const m = g.length;
    const { values, vectors } = eig;
    const gt = vectors.map((v) => dot(v, g));
    const combine = (coef) => {
        const p = new Array(m).fill(0);
        coef.forEach((c, k) => vectors[k].forEach((vi, i) => (p[i] += c * vi)));
        return p;
    };
    const minValue = Math.min(...values);
    // the Newton step, if the Hessian is positive semidefinite, the gradient has no component along its null
    // directions, and the step is inside the region
    if (minValue > -zero && values.every((l, k) => l > zero || Math.abs(gt[k]) <= gradientZero)) {
        const p = combine(values.map((l, k) => (l > zero ? -gt[k] / l : 0)));
        if (norm(p) <= radius)
            return { step: p, newton: true };
    }
    // on the boundary: p(μ) = −Σ gt_k / (λ_k + μ) v_k with ‖p(μ)‖ = radius, μ > max(0, −λ_min), by bisection
    const lowest = Math.max(0, -minValue);
    const lengthAt = (mu) => Math.sqrt(values.reduce((sum, l, k) => sum + (gt[k] / (l + mu)) ** 2, 0));
    const tiny = Math.max(zero, 1e-12 * Math.max(...values.map(Math.abs), 1));
    if (lengthAt(lowest + tiny) >= radius) {
        let lo = lowest + tiny;
        let hi = lowest + norm(g) / radius + Math.max(...values.map(Math.abs)) + tiny;
        for (let k = 0; k < 200 && hi - lo > 1e-15 * hi; k++) {
            const mid = (lo + hi) / 2;
            if (lengthAt(mid) > radius)
                lo = mid;
            else
                hi = mid;
        }
        return { step: combine(values.map((l, k) => -gt[k] / (l + hi))), newton: false };
    }
    // the "hard case": the gradient has (almost) no component along the eigenvectors of the lowest eigenvalue; the
    // step at μ = −λ_min is completed to the boundary along such an eigenvector
    const low = values.map((l) => l + lowest <= tiny);
    const p = combine(values.map((l, k) => (low[k] ? 0 : -gt[k] / (l + lowest))));
    const k0 = values.indexOf(minValue);
    const rest = Math.sqrt(Math.max(0, radius * radius - dot(p, p)));
    const direction = -Math.sign(gt[k0]) || 1;
    return { step: p.map((pi, i) => pi + direction * rest * vectors[k0][i]), newton: false };
}
/**
 * The columns of the blocks T_k as lists of θ indices, the diagonal element first: changing the sign of a column
 * leaves the criterion unchanged (Λ_θ → Λ_θ D with D = diag(±1) per level, matched by u → D u)
 */
function columnsOfTheta(s) {
    const out = [];
    for (const t of s.terms) {
        const nc = t.columns.length;
        let k = t.thetaOffset;
        for (let c = 0; c < nc; c++) {
            const column = [];
            for (let i = c; i < nc; i++)
                column.push(k++);
            out.push(column);
        }
    }
    return out;
}
/** The criterion and its gradient from the sparse {@link profiledDeviance} */
const sparseCriterion = (s, theta, reml) => {
    const r = profiledDeviance(s, theta, reml, { gradient: true });
    return { f: r.deviance, g: r.gradient };
};
/**
 * A local minimiser of the criterion over θ, subject to the lower bounds (see the header), started at `start`, with
 * the elements in `held` kept at exactly 0 throughout (never free, never released); with its criterion
 */
function localMinimum(s, reml, criterion, start, held = new Set()) {
    const diagonal = s.lower.map((b) => b === 0);
    const evaluate = (theta) => criterion(s, theta, reml);
    let theta = start.map((v, j) => (held.has(j) ? 0 : v));
    let { f, g } = evaluate(theta);
    /** Diagonal elements held at exactly 0 */
    const fixed = new Set();
    /** Diagonal elements released from 0 (not set to 0 again: their minimiser is near 0 but not at it) */
    const released = new Set();
    const scaleOf = () => Math.max(1, ...theta.map(Math.abs));
    const gradientTolerance = () => GRADIENT_TOLERANCE * Math.max(1, Math.abs(f));
    let radius = INITIAL_RADIUS * scaleOf();
    let previousNewton = Infinity;
    /** The Hessian of the last iteration, when it may be used again (see iterate) */
    let reusable;
    /** The Hessian on the elements `set`, from central differences of the gradient */
    const hessian = (set) => {
        const floor = HESSIAN_STEP_FLOOR * scaleOf();
        const cols = set.map((j) => {
            const h = Math.max(HESSIAN_STEP * Math.abs(theta[j]), floor);
            const plus = theta.slice();
            plus[j] = theta[j] + h;
            const minus = theta.slice();
            minus[j] = theta[j] - h;
            const gp = evaluate(plus).g;
            const gm = evaluate(minus).g;
            return set.map((i) => (gp[i] - gm[i]) / (2 * h));
        });
        return set.map((_, a) => set.map((_, b) => (cols[a][b] + cols[b][a]) / 2));
    };
    /** One trust-region iteration on the free elements; returns whether it converged */
    const iterate = (free) => {
        const fresh = reusable === undefined || reusable.free.length !== free.length || reusable.free.some((j, a) => j !== free[a]);
        const h = fresh ? hessian(free) : reusable.h;
        reusable = undefined;
        const eig = symmetricEigen(h);
        const zero = EIGENVALUE_TOLERANCE * Math.max(...eig.values.map(Math.abs));
        const gFree = free.map((j) => g[j]);
        const { step, newton } = trustRegionStep(gFree, eig, radius, zero, gradientTolerance());
        const trial = theta.slice();
        free.forEach((j, a) => (trial[j] = theta[j] + step[a]));
        const size = Math.max(...step.map(Math.abs)) / scaleOf();
        const next = evaluate(trial);
        if (!Number.isFinite(next.f))
            throw new Error(OPTIMISATION_FAILED);
        const predicted = -(dot(gFree, step) + dot(step, h.map((row) => dot(row, step))) / 2);
        // the actual reduction from the values, or, where they are equal to rounding, from the gradients (trapezoid)
        const actual = Math.abs(f - next.f) > 1e-10 * Math.abs(f) ? f - next.f : -(dot(gFree, step) + dot(free.map((j) => next.g[j]), step)) / 2;
        const ratio = predicted > 0 ? actual / predicted : actual >= 0 ? 1 : -1;
        if (ratio > 0.1 || size <= STEP_FLOOR) {
            theta = trial;
            f = next.f;
            g = next.g;
        }
        const length = norm(step);
        if (ratio < 0.25)
            radius = Math.max(length / 4, STEP_TOLERANCE * scaleOf());
        else if (ratio > 0.75 && length >= 0.99 * radius)
            radius *= 2;
        if (!newton) {
            previousNewton = Infinity;
            return false;
        }
        const gradientSmall = free.every((j) => Math.abs(g[j]) <= gradientTolerance());
        // (the steps stopping decreasing is taken as rounding level only with a fresh Hessian)
        const done = gradientSmall && (size <= STEP_TOLERANCE || (fresh && size <= STEP_FLOOR && size >= 0.5 * previousNewton));
        // the Hessian is kept for the next iteration after a Newton step that was accepted, predicted well and at most
        // half the previous one (the model is still good; convergence stays fast)
        if (ratio > HESSIAN_REUSE_RATIO && ratio < 1 / HESSIAN_REUSE_RATIO && size < 0.5 * previousNewton)
            reusable = { free, h };
        previousNewton = size;
        return done;
    };
    /**
     * At a converged point with elements held at 0: a direction of negative curvature of the elements held there
     * whose derivative vanishes, together with the free ones, is a way down (in a block whose leading diagonal element
     * is 0, the criterion depends on it and the element below through their product, so neither alone shows the
     * descent; for a single even element it is its own curvature at 0). If there is one, the elements held at 0 along
     * it are released and θ is moved a little along it; returns whether it did.
     */
    const leaveAlongNegativeCurvature = () => {
        if (fixed.size === 0)
            return false;
        const set = theta.map((_, j) => j).filter((j) => !held.has(j));
        const eig = symmetricEigen(hessian(set));
        const zero = EIGENVALUE_TOLERANCE * Math.max(...eig.values.map(Math.abs));
        const k = eig.values.indexOf(Math.min(...eig.values));
        if (!(eig.values[k] < -zero))
            return false;
        const v = eig.vectors[k];
        const leaving = set.filter((j, a) => fixed.has(j) && Math.abs(v[a]) > 1e-8);
        if (leaving.length === 0)
            return false;
        for (const j of leaving) {
            fixed.delete(j);
            released.add(j);
        }
        const move = NEGATIVE_CURVATURE_MOVE * scaleOf();
        set.forEach((j, a) => (theta[j] = theta[j] + move * v[a]));
        ({ f, g } = evaluate(theta));
        return true;
    };
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        const free = theta.map((_, j) => j).filter((j) => !fixed.has(j) && !held.has(j));
        if (free.length > 0 && !iterate(free))
            continue;
        // converged on the free elements. Diagonal elements that reached 0 (to rounding) are held at exactly 0
        const toZero = free.filter((j) => diagonal[j] && !released.has(j) && Math.abs(theta[j]) < BOUNDARY_CANDIDATE * scaleOf());
        if (toZero.length > 0) {
            for (const j of toZero) {
                theta[j] = 0;
                fixed.add(j);
            }
            ({ f, g } = evaluate(theta));
            previousNewton = Infinity;
            reusable = undefined;
            continue;
        }
        // elements held at 0 with a derivative, or with a direction of negative curvature, are released
        const tolerance = 1e-12 * Math.max(1, Math.abs(f));
        const release = [...fixed].filter((j) => Math.abs(g[j]) > tolerance);
        if (release.length > 0) {
            for (const j of release) {
                fixed.delete(j);
                released.add(j);
            }
        }
        else if (!leaveAlongNegativeCurvature()) {
            // the minimiser: each column of T_k with a negative diagonal element changes sign (an equivalent θ)
            for (const column of columnsOfTheta(s)) {
                if (theta[column[0]] < 0)
                    for (const j of column)
                        theta[j] = -theta[j];
            }
            return { theta: theta.map((v) => (v === 0 ? 0 : v)), f }; // no -0
        }
        radius = Math.max(radius, INITIAL_RADIUS * BOUNDARY_CANDIDATE * scaleOf());
        previousNewton = Infinity;
        reusable = undefined;
    }
    throw new Error(OPTIMISATION_FAILED);
}
/**
 * The estimate of θ: the local minimum reached from the initial θ, then compared with the local minima reached from
 * its boundary points with one whole term removed (see the header); a clearly better one is the start of a new local
 * minimisation, until none is.
 */
function minimiseCriterion(s, reml, criterion) {
    /** The θ indices of each term's block (its whole lower triangle) */
    const blocks = s.terms.map((t) => {
        const nc = t.columns.length;
        return Array.from({ length: (nc * (nc + 1)) / 2 }, (_, i) => t.thetaOffset + i);
    });
    let best = localMinimum(s, reml, criterion, s.theta);
    for (let round = 0; round < MAX_RESTARTS; round++) {
        let candidate;
        for (const block of blocks) {
            if (block.every((j) => best.theta[j] === 0))
                continue;
            const removed = localMinimum(s, reml, criterion, best.theta, new Set(block));
            if (candidate === undefined || removed.f < candidate.f)
                candidate = removed;
        }
        if (candidate === undefined || !(candidate.f < best.f - RESTART_THRESHOLD * Math.max(1, Math.abs(best.f))))
            return best.theta;
        best = localMinimum(s, reml, criterion, candidate.theta);
    }
    throw new Error(OPTIMISATION_FAILED);
}
/**
 * The option checks of lmer and of lmerTest's functions (internal; oracle/report-0.14.0-behaviour.md, section 3):
 * `options` must be an object when given (not null, not an array); its own keys, in order, may be neither among those
 * of R that are not supported (the first gives an Error) nor unknown (a TypeError listing all of them). A key whose
 * value is `undefined` counts as given. Returns the options as an object (`{}` when not given).
 */
export function checkOptions(fn, options, accepted, unsupported) {
    if (options === undefined)
        return {};
    if (typeof options !== "object" || options === null || Array.isArray(options))
        throw new TypeError("options must be an object");
    const keys = Object.keys(options);
    const notSupported = keys.find((k) => unsupported.includes(k));
    if (notSupported !== undefined)
        throw new Error(`${fn}: argument '${notSupported}' is not supported`);
    const unknown = keys.filter((k) => !accepted.includes(k));
    if (unknown.length > 0)
        throw new TypeError(`unused argument${unknown.length === 1 ? "" : "s"} (${unknown.join(", ")})`);
    return options;
}
/**
 * A logical option as R's conditions take it (internal): `undefined` gives the default, a boolean itself, a number
 * other than NaN `false` for 0 and `true` otherwise; `null` and anything else are TypeErrors.
 */
export function logicalOption(value, defaultValue) {
    if (value === undefined)
        return defaultValue;
    if (typeof value === "boolean")
        return value;
    if (typeof value === "number" && !Number.isNaN(value))
        return value !== 0;
    if (value === null)
        throw new TypeError("argument is of length zero");
    throw new TypeError("argument is not interpretable as logical");
}
const LMER_KEYS = ["REML", "contrasts", "levels"];
const LMER_UNSUPPORTED = ["weights", "offset", "subset", "naAction", "na.action", "control", "start", "verbose", "devFunOnly"];
/**
 * Fit a linear mixed model by REML (default) or maximum likelihood. Equivalent to `lme4::lmer()` in R. With the
 * quantities of its methods: `fixef()`, `coef(summary())` (without p-values), `vcov()`, `sigma()`, `VarCorr()`,
 * `ranef()`, `fitted()`, `residuals()`, `logLik()`, `AIC()`, `BIC()`, `deviance()`, `REMLcrit()` and `isSingular()`.
 *
 * The formula has random-effects terms `(lhs | group)` (correlated effects of the columns of `lhs` within each level
 * of `group`) or `(lhs || group)` (uncorrelated); `group` may be `a:b` (the combinations), `a/b` (nested: `b:a` and
 * `a`) and so on, as in lme4. The fixed-effects part is coded as in {@link lm}; aliased columns are dropped (with a
 * message). Rows with a missing value in a variable of the formula are dropped (`rows` lists those used).
 *
 * The covariance parameters θ are the lower triangles of the relative covariance factors of the terms; the estimate
 * is the exact minimiser of the profiled criterion (lme4's optimiser stops close to it, so lme4's values typically
 * differ in the 5th to 9th significant digit). Elements on the boundary are exactly 0, and the fit is then singular.
 * The computation is sparse (a sparse Cholesky factorisation, as in lme4), so many groups are handled quickly.
 *
 * @param formula A formula such as `"Reaction ~ Days + (Days | Subject)"`.
 * @param data The data frame: an object of columns.
 * @param options `REML`, and `contrasts` and `levels` as in {@link lm} (see {@link LmerOptions} for the keys accepted).
 *
 * @example
 * ```ts
 * // R: lme4::lmer(y ~ 1 + (1 | g), data)
 * const fit = lmer("y ~ 1 + (1 | g)", {
 *   y: [9.8, 10.4, 10.1, 12.3, 12.9, 12.0, 8.1, 7.6, 8.4],
 *   g: ["a", "a", "a", "b", "b", "b", "c", "c", "c"],
 * });
 * fit.fixef;           // [10.177778]
 * fit.sigma;           // 0.39299
 * fit.varCorr[0].sd;   // [2.1726]
 * fit.ranef[0].levels; // ["a", "b", "c"]
 * fit.ranef[0].values; // [[-0.076939], [2.1982], [-2.1213]]
 * fit.REMLcrit;        // 19.015
 * ```
 *
 * @category Mixed models
 */
export function lmer(formula, data, options) {
    return lmerWithCriterion(formula, data, options, sparseCriterion);
}
/**
 * The internals of every result returned by {@link lmer} (and {@link lmerWithCriterion}), keyed by the result object
 * itself: a copy of a result (`{ ...fit }`) has none.
 */
const internalsByFit = new WeakMap();
/**
 * The internals of a fit (see {@link LmerInternals}). Internal. Throws a TypeError for an object that is not a result
 * returned by {@link lmer}.
 */
export function lmerInternals(fit) {
    const internals = typeof fit === "object" && fit !== null ? internalsByFit.get(fit) : undefined;
    if (internals === undefined)
        throw new TypeError("fit must be a result returned by lmer (not a copy of one)");
    return internals;
}
/**
 * {@link lmer} with the criterion and its gradient given (internal: not exported from the package). The regression
 * test of the sparse computation fits with the dense reference implementation through it.
 */
export function lmerWithCriterion(formula, data, options, criterion) {
    const given = checkOptions("lmer", options, LMER_KEYS, LMER_UNSUPPORTED);
    const reml = logicalOption(given.REML, true);
    options = { ...given, REML: reml };
    const modelOptions = {};
    if (options.contrasts !== undefined)
        modelOptions.contrasts = options.contrasts;
    if (options.levels !== undefined)
        modelOptions.levels = options.levels;
    const original = mixedModelStructure(formula, data, modelOptions);
    const n = original.y.length;
    const p = original.xColNames.length;
    // β₀, the least-squares coefficients of y on X, and the residuals y − X β₀ (see the header)
    const beta0 = p === 0 ? [] : qrCoef(qr(original.x), original.y);
    const yc = original.y.map((y, i) => y - original.x[i].reduce((sum, v, k) => sum + v * beta0[k], 0));
    // a response in the column space of X: the criterion is −∞ for every θ (no estimate)
    const maxAbs = (v) => v.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    if (maxAbs(yc) <= EXACT_FIT * maxAbs(original.y))
        throw new Error(EXACT_FIT_ERROR);
    const s = { ...original, y: yc };
    const theta = minimiseCriterion(s, reml, criterion);
    const r = profiledDeviance(s, theta, reml, { rxInverse: true });
    const fixef = r.beta.map((b, k) => b + beta0[k]);
    const twoPi = 2 * Math.PI;
    const deviance = r.logDetL + n * (1 + Math.log((twoPi * r.prss) / n));
    const REMLcrit = r.logDetL + r.logDetRX + (n - p) * (1 + Math.log((twoPi * r.prss) / (n - p)));
    const sigma2 = r.prss / (reml ? n - p : n);
    const sigma = Math.sqrt(sigma2);
    const vcov = r.rxInverse.map((row) => row.map((v) => sigma2 * v));
    const stdError = vcov.map((row, i) => Math.sqrt(row[i]));
    // (a standard error of 0 gives ±Infinity or NaN, as R's division does: not guarded on purpose)
    const tValue = fixef.map((b, i) => b / stdError[i]);
    // the blocks T_k and the variance components
    const varCorr = s.terms.map((term) => {
        const nc = term.columns.length;
        const t = Array.from({ length: nc }, () => new Array(nc).fill(0));
        let k = term.thetaOffset;
        for (let j = 0; j < nc; j++)
            for (let i = j; i < nc; i++)
                t[i][j] = theta[k++];
        const cov = t.map((ti) => t.map((tj) => sigma2 * ti.reduce((sum, v, m) => sum + v * tj[m], 0)));
        const sd = cov.map((row, i) => Math.sqrt(row[i]));
        // (a column with variance 0 has the correlations 0/0 = NaN with the others, as lme4's VarCorr: not a bug)
        const corr = cov.map((row, i) => row.map((v, j) => (i === j ? 1 : v / (sd[i] * sd[j]))));
        return { group: s.groups[term.group].name, columns: [...term.columns], sd, corr };
    });
    const ranef = s.groups.map((g, gi) => {
        const terms = s.terms.filter((t) => t.group === gi);
        return {
            group: g.name,
            levels: [...g.levels],
            columns: terms.flatMap((t) => t.columns),
            values: g.levels.map((_, l) => terms.flatMap((t) => {
                const nc = t.columns.length;
                return t.columns.map((_, j) => r.b[t.zOffset + l * nc + j]);
            })),
        };
    });
    // the residuals from y − X β₀ (the more accurate), the fitted values with the whole fixed effects
    const fitted = s.x.map((xi) => xi.reduce((sum, v, k) => sum + v * fixef[k], 0));
    const residuals = s.x.map((xi, i) => yc[i] - xi.reduce((sum, v, k) => sum + v * r.beta[k], 0));
    s.z.forEach((col, j) => {
        const bj = r.b[j];
        if (bj !== 0) {
            col.rows.forEach((i, k) => {
                fitted[i] += col.values[k] * bj;
                residuals[i] -= col.values[k] * bj;
            });
        }
    });
    const logLik = -(reml ? REMLcrit : deviance) / 2;
    const df = p + theta.length + 1;
    // (an absolute threshold on θ's diagonal elements, as lme4's isSingular with its default tolerance 1e-4; it is not
    // meant to match the minimiser's relative boundary test)
    const singular = theta.some((v, j) => s.lower[j] === 0 && v < 1e-4);
    const messages = [...s.messages];
    if (singular)
        messages.push("boundary (singular) fit: see help('isSingular')");
    const result = {
        formula,
        REML: reml,
        nObs: n,
        rows: [...s.rows],
        theta,
        fixefNames: [...s.xColNames],
        fixef,
        coefTable: { estimate: [...fixef], stdError, tValue },
        vcov,
        sigma,
        varCorr,
        ranef,
        fitted,
        residuals,
        logLik,
        df,
        AIC: -2 * logLik + 2 * df,
        BIC: -2 * logLik + Math.log(n) * df,
        deviance,
        REMLcrit,
        singular,
        messages,
        warnings: [...s.warnings],
    };
    internalsByFit.set(result, { structure: s, beta0, data, options, reml, criterion, theta: [...theta] });
    return result;
}
