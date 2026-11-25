// Linear mixed models fitted by REML or maximum likelihood (lme4's lmer): the estimate of θ that minimises the
// profiled REML criterion or ML deviance, and the fit's results at it (fixed effects and their covariance, σ, the
// variance components, the conditional modes of the random effects, fitted values, log-likelihood and information
// criteria).
//
// Written for rStats.js (no ported code) from oracle/lmer-behaviour.md (stage 1c, "The fit and its results") and
// D. Bates, M. Mächler, B. Bolker, S. Walker (2015), "Fitting Linear Mixed-Effects Models Using lme4", Journal of
// Statistical Software 67(1). The structure comes from src/models/mixedStructure.ts and the criterion with its
// analytic gradient from src/models/mixedDeviance.ts. The minimiser described below is in src/models/mixedMinimiser.ts
// (shared with glmer).
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
import { ldexp } from "../internal/summary.js";
import { qr, qrCoef } from "../linalg/qr.js";
import { profiledDeviance } from "./mixedDeviance.js";
import { mixedModelStructure } from "./mixedStructure.js";
import { LMER_SETTINGS, minimiseWithRestarts } from "./mixedMinimiser.js";
import { reported } from "../internal/warnings.js";
// Generated by `node scripts/option-keys.mjs --write` from the option types; do not edit (begin)
import { checkOptions } from "../internal/checkOptions.js";
const LMER_KEYS = ["REML", "contrasts", "levels"];
/**
 * The response is fitted exactly by the fixed effects when its least-squares residuals are below this × max |y|: a
 * few times the rounding error of the residuals, so that a response with a large mean and a small spread (around
 * 1e12 with residuals of 0.1, say) is not taken for an exact fit. (64 eps rejected 1e16 plus values 0 to 180, whose
 * residuals of about 90 are 40 ulps; issue #12)
 */
const EXACT_FIT = 16 * Number.EPSILON;
const EXACT_FIT_ERROR = "lmer: the response is fitted exactly by the fixed effects (a constant response, for example), so the residual variance is 0";
const OPTIMISATION_FAILED = "lmer: the minimisation of the criterion over theta did not converge";
/**
 * The columns of the blocks T_k as lists of θ indices, the diagonal element first: changing the sign of a column
 * leaves the criterion unchanged (Λ_θ → Λ_θ D with D = diag(±1) per level, matched by u → D u)
 */
export function columnsOfTheta(s) {
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
/** The minimisation problem of lmer's criterion over θ (src/models/mixedMinimiser.ts) */
function lmerProblem(s, reml, criterion) {
    return {
        evaluate: (theta) => criterion(s, theta, reml),
        diagonal: s.lower.map((b) => b === 0),
        columns: columnsOfTheta(s),
        settings: LMER_SETTINGS,
        rejectNonFinite: false,
        failure: OPTIMISATION_FAILED,
    };
}
/**
 * The estimate of θ: the local minimum reached from the initial θ, then compared with the local minima reached from
 * its boundary points with one whole term removed (see the header); a clearly better one is the start of a new local
 * minimisation, until none is.
 */
/**
 * The exponent e_k of 2 of each element of θ (internal; issue #11): that of the largest |value| of the column of Z of
 * its row in the term (over the levels). With the columns of Z divided by c_i = 2^e_i, Λ' = C Λ: θ'_k = c_i θ_k, the
 * blocks stay lower triangular with the same signs, and the model (and its criterion) is the same
 */
export function thetaColumnExponents(s) {
    const theta = new Array(s.theta.length).fill(0);
    const z = new Array(s.z.length).fill(0);
    for (const t of s.terms) {
        const nc = t.columns.length;
        const levels = s.groups[t.group].levels.length;
        const e = Array.from({ length: nc }, (_, i) => {
            let top = 0;
            for (let l = 0; l < levels; l++)
                for (const v of s.z[t.zOffset + l * nc + i].values)
                    top = Math.max(top, Math.abs(v));
            return top > 0 && Number.isFinite(top) ? Math.floor(Math.log2(top)) : 0;
        });
        for (let l = 0; l < levels; l++)
            for (let i = 0; i < nc; i++)
                z[t.zOffset + l * nc + i] = e[i];
        let k = t.thetaOffset;
        for (let j = 0; j < nc; j++)
            for (let i = j; i < nc; i++)
                theta[k++] = e[i];
    }
    return { theta, z };
}
/**
 * The minimiser over θ, computed on Z with its columns divided by powers of 2 (thetaColumnExponents) and returned in
 * the units of the given Z: a column of x times 1e6 (or 1e-5) made θ of the slope 1e-6 (1e5) and the minimisation, whose
 * steps and tolerances do not tell the elements apart, failed (issue #11; lme4 stops elsewhere with a warning)
 */
function minimiseCriterionScaled(s, reml, criterion) {
    const e = thetaColumnExponents(s);
    if (e.z.every((v) => v === 0))
        return minimiseCriterion(s, reml, criterion);
    // (both Z and the terms' left-hand side matrices, from which the criterion forms its products)
    const scaled = {
        ...s,
        z: s.z.map((col, j) => ({ rows: col.rows, values: col.values.map((v) => ldexp(v, -e.z[j])) })),
        terms: s.terms.map((t) => ({ ...t, matrix: t.matrix.map((row) => row.map((v, i) => ldexp(v, -e.z[t.zOffset + i]))) })),
    };
    return minimiseCriterion(scaled, reml, criterion).map((v, k) => ldexp(v, -e.theta[k]));
}
function minimiseCriterion(s, reml, criterion) {
    /** The θ indices of each term's block (its whole lower triangle) */
    const blocks = s.terms.map((t) => {
        const nc = t.columns.length;
        return Array.from({ length: (nc * (nc + 1)) / 2 }, (_, i) => t.thetaOffset + i);
    });
    return minimiseWithRestarts(lmerProblem(s, reml, criterion), s.theta, blocks).theta;
}
/**
 * The first option check of lmer and of lmerTest's functions (internal; oracle/report-0.14.0-behaviour.md, section
 * 3): `options` must be an object when given (not null, not an array), and none of its own keys, in order, among those
 * of R that are not supported (the first gives an Error naming it). A key whose value is `undefined` counts as given.
 * The unknown keys are checked after it (a RangeError of checkOptions, generated by scripts/option-keys.mjs, which
 * keeps a first statement calling this function before its checks).
 */
export function checkLmerOptions(fn, options, unsupported) {
    if (options === undefined)
        return;
    if (typeof options !== "object" || options === null || Array.isArray(options))
        throw new TypeError("options must be an object");
    const notSupported = Object.keys(options).find((k) => unsupported.includes(k));
    if (notSupported !== undefined)
        throw new Error(`${fn}: argument '${notSupported}' is not supported`);
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
 * The functions that take the fit ({@link lmerSummary}, {@link lmerAnova}, {@link lmerContest} and the others) need
 * the object `lmer` returned itself: a copy of it (`structuredClone`, `{ ...fit }`, JSON or `postMessage`) lacks the
 * internal values they use and is a TypeError. The fields of a copy keep their values.
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
    checkLmerOptions("lmer", options, LMER_UNSUPPORTED);
    checkOptions(options, LMER_KEYS, "lmer"); // generated: option-keys.mjs
    return reported("lmer", lmerWithCriterion(formula, data, options, sparseCriterion));
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
 * The exponent of 2 of each column of X whose largest |value| is beyond 2^±500, where the cross-products of X overflow
 * or underflow; 0 for the other columns (internal: lmer's standard errors and lmerTest's quantities)
 */
export function extremeColumnExponents(x, p) {
    return Array.from({ length: p }, (_, k) => {
        let top = 0;
        for (const row of x)
            top = Math.max(top, Math.abs(row[k]));
        return top > 2 ** 500 || (top > 0 && top < 2 ** -500) ? Math.floor(Math.log2(top)) : 0;
    });
}
/**
 * {@link lmer} with the criterion and its gradient given (internal: not exported from the package). The regression
 * test of the sparse computation fits with the dense reference implementation through it.
 */
export function lmerWithCriterion(formula, data, options, criterion) {
    const given = options ?? {};
    const reml = logicalOption(given.REML, true);
    options = { ...given, REML: reml };
    const modelOptions = {};
    if (options.contrasts !== undefined)
        modelOptions.contrasts = options.contrasts;
    if (options.levels !== undefined)
        modelOptions.levels = options.levels;
    const original = mixedModelStructure(formula, data, modelOptions);
    // as R (#297: an infinite response passed the exact-fit check below as Infinity <= Infinity, or failed inside the QR)
    if (original.y.some((v) => !Number.isFinite(v)))
        throw new RangeError("NA/NaN/Inf in 'y'");
    const n = original.y.length;
    const p = original.xColNames.length;
    // β₀, the least-squares coefficients of y on X, and the residuals y − X β₀ (see the header)
    const beta0 = p === 0 ? [] : qrCoef(qr(original.x), original.y);
    const yc = original.y.map((y, i) => y - original.x[i].reduce((sum, v, k) => sum + v * beta0[k], 0));
    // a response in the column space of X: the criterion is −∞ for every θ (no estimate)
    const maxAbs = (v) => v.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    const ycMax = maxAbs(yc);
    if (ycMax <= EXACT_FIT * maxAbs(original.y))
        throw new Error(EXACT_FIT_ERROR);
    const s = { ...original, y: yc };
    // A response whose squares overflow or underflow (|y − X β₀| beyond 2^±500; 1e200 made the penalised sum of squares
    // Infinity and the minimisation fail, R's sigma Inf) is fitted divided by 2^ky (exact): θ does not depend on it, and
    // β, b, σ and the residuals scale back by 2^ky, the variances by 4^ky, the criteria shift by 2 n ky log 2. Otherwise
    // ky = 0 and nothing changes (issue #9)
    const ky = ycMax > 2 ** 500 || ycMax < 2 ** -500 ? Math.floor(Math.log2(ycMax)) : 0;
    const sResponse = ky === 0 ? s : { ...s, y: yc.map((v) => ldexp(v, -ky)) };
    // Columns of X beyond 2^±500 (predictors times 1e160 or 1e-160: X'X overflowed to NaN in the minimiser, or was
    // subnormal and lost its digits, and (R_X'R_X)⁻¹ overflowed) are divided by their powers of 2 (exact; as Z's columns
    // in issue #11): θ does not depend on it, β_k scales back by 2^-f_k, vcov by 2^(-f_a - f_b), and the REML criterion
    // shifts by 2 Σ f log 2 (log det R_X'R_X). Otherwise f = 0 and nothing changes
    const xScale = extremeColumnExponents(s.x, p);
    const xScaled = xScale.some((e) => e !== 0);
    const sScaled = xScaled ? { ...sResponse, x: sResponse.x.map((row) => row.map((v, k) => ldexp(v, -xScale[k]))) } : sResponse;
    const theta = minimiseCriterionScaled(sScaled, reml, criterion);
    const r = profiledDeviance(sScaled, theta, reml, { rxInverse: true });
    const up = (v) => ldexp(v, ky);
    const fixef = r.beta.map((b, k) => (xScaled ? ldexp(up(b), -xScale[k]) : up(b)) + beta0[k]);
    const twoPi = 2 * Math.PI;
    const logScale = 2 * ky * Math.LN2;
    const logDetRX = xScaled ? r.logDetRX + 2 * xScale.reduce((a, b) => a + b, 0) * Math.LN2 : r.logDetRX;
    const deviance = r.logDetL + n * (1 + Math.log((twoPi * r.prss) / n) + logScale);
    const REMLcrit = r.logDetL + logDetRX + (n - p) * (1 + Math.log((twoPi * r.prss) / (n - p)) + logScale);
    // (σ² of the scaled response; the variances below are 4^ky times what is formed from it)
    const sigma2 = r.prss / (reml ? n - p : n);
    const sigma = up(Math.sqrt(sigma2));
    // (an entry of vcov may overflow where the standard error does not)
    const vcov = r.rxInverse.map((row, a) => row.map((v, b) => ldexp(sigma2 * v, 2 * ky - (xScaled ? xScale[a] + xScale[b] : 0))));
    const stdError = r.rxInverse.map((row, i) => (xScaled ? ldexp(up(Math.sqrt(sigma2 * row[i])), -xScale[i]) : up(Math.sqrt(sigma2 * row[i]))));
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
        const covScaled = t.map((ti) => t.map((tj) => sigma2 * ti.reduce((sum, v, m) => sum + v * tj[m], 0)));
        const sdScaled = covScaled.map((row, i) => Math.sqrt(row[i]));
        const sd = sdScaled.map(up);
        // (a column with variance 0 has the correlations 0/0 = NaN with the others, as lme4's VarCorr: not a bug)
        const corr = covScaled.map((row, i) => row.map((v, j) => (i === j ? 1 : v / (sdScaled[i] * sdScaled[j]))));
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
                return t.columns.map((_, j) => up(r.b[t.zOffset + l * nc + j]));
            })),
        };
    });
    // the residuals from y − X β₀ (the more accurate), the fitted values with the whole fixed effects
    const fitted = s.x.map((xi) => xi.reduce((sum, v, k) => sum + v * fixef[k], 0));
    // (the residuals on the scaled response, scaled back)
    const residuals = sScaled.x.map((xi, i) => sScaled.y[i] - xi.reduce((sum, v, k) => sum + v * r.beta[k], 0));
    s.z.forEach((col, j) => {
        const bj = r.b[j];
        if (bj !== 0) {
            col.rows.forEach((i, k) => {
                fitted[i] += col.values[k] * up(bj);
                residuals[i] -= col.values[k] * bj;
            });
        }
    });
    if (ky !== 0)
        residuals.forEach((v, i) => (residuals[i] = up(v)));
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
    const snapshot = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.slice()]));
    internalsByFit.set(result, {
        structure: s,
        beta0,
        data,
        snapshot,
        options,
        reml,
        criterion,
        theta: [...theta],
        fixef: [...fixef],
        b: r.b.map(up),
        sigma,
    });
    return result;
}
