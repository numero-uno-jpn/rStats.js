import type { DataFrame } from "./modelFrame.js";
import type { ContrastName } from "./modelMatrix.js";
import { type MixedModelStructure } from "./mixedStructure.js";
/**
 * Options of {@link lmer}.
 *
 * @category Mixed models
 */
export interface LmerOptions {
    /** Whether to minimise the REML criterion (default `true`) or the ML deviance (`false`). */
    REML?: boolean;
    /**
     * A contrast per factor of the fixed-effects part (default `"contr.treatment"`); the random-effects terms always use
     * treatment contrasts. A name that is not a variable of the fixed-effects part (a grouping variable alone included)
     * gives the warning `variable 'B' is absent, its contrast will be ignored`.
     */
    contrasts?: Record<string, ContrastName>;
    /** The order of the levels of a factor (`{ A: ["c", "a", "b"] }`), as `factor(x, levels = ...)` in R. */
    levels?: Record<string, readonly string[]>;
}
/**
 * The variance and correlation parameters of a random-effects term in a {@link LmerResult}: one entry of R's
 * `VarCorr()`.
 *
 * @category Mixed models
 */
export interface LmerVarCorr {
    /** The grouping factor's name, such as `"Subject"` or `"cask:batch"`. */
    group: string;
    /** The names of the term's columns, such as `["(Intercept)", "Days"]`. */
    columns: string[];
    /** The standard deviations of the random effects, one per column. */
    sd: number[];
    /** Their correlation matrix (array of rows; 1 on the diagonal). */
    corr: number[][];
}
/**
 * The conditional modes of the random effects of a grouping factor in a {@link LmerResult}: one entry of R's
 * `ranef()`.
 *
 * @category Mixed models
 */
export interface LmerRanef {
    /** The grouping factor's name. */
    group: string;
    /** Its levels (the rows of `values`). */
    levels: string[];
    /** The columns of all the terms of this grouping factor, in term order. */
    columns: string[];
    /** One array per level, one value per column. */
    values: number[][];
}
/**
 * Result of {@link lmer}: the fit of a linear mixed model and the quantities of R's methods for it.
 *
 * @category Mixed models
 */
export interface LmerResult {
    /** The formula. */
    formula: string;
    /** Whether the REML criterion was minimised (otherwise the ML deviance). */
    REML: boolean;
    /** Number of rows used. */
    nObs: number;
    /** 0-based indices of the rows of `data` used (rows with a missing value in a variable of the formula dropped). */
    rows: number[];
    /** The estimate of the covariance parameters θ (R's `getME(fit, "theta")`): the lower triangles of the relative covariance factors, by term, column-major. */
    theta: number[];
    /** Names of the columns of the fixed-effects model matrix (aliased columns dropped). */
    fixefNames: string[];
    /** The fixed effects β̂ (R's `fixef()`). */
    fixef: number[];
    /** The coefficient table of the fixed effects (R's `coef(summary(fit))`). */
    coefTable: {
        /** Estimates (R's `Estimate`). */
        estimate: number[];
        /** Standard errors (R's `Std. Error`). */
        stdError: number[];
        /** t statistics (R's `t value`). */
        tValue: number[];
    };
    /** The covariance matrix of the fixed effects (R's `vcov()`), array of rows. */
    vcov: number[][];
    /** The residual standard deviation (R's `sigma()`). */
    sigma: number;
    /** The variance components, one entry per random-effects term (R's `VarCorr()`). */
    varCorr: LmerVarCorr[];
    /** The conditional modes of the random effects, one entry per grouping factor (R's `ranef()`). */
    ranef: LmerRanef[];
    /** Fitted values Xβ̂ + Zb̂, one per row used (R's `fitted()`). */
    fitted: number[];
    /** Residuals y − fitted (R's `residuals()`). */
    residuals: number[];
    /** The log-likelihood, or the REML log-likelihood for a REML fit (R's `logLik()`). */
    logLik: number;
    /** Degrees of freedom of the log-likelihood: the numbers of fixed effects and of θ, plus 1 (for σ). */
    df: number;
    /** Akaike's information criterion (R's `AIC()`). */
    AIC: number;
    /** Schwarz's Bayesian information criterion (R's `BIC()`). */
    BIC: number;
    /** The ML deviance at the estimates, for either kind of fit (R's `deviance(fit, REML = FALSE)`). */
    deviance: number;
    /** The REML criterion at the estimates, for either kind of fit (R's `REMLcrit()`). */
    REMLcrit: number;
    /** Whether the fit is singular: a diagonal element of a relative covariance factor below 1e-4 (R's `isSingular()`). */
    singular: boolean;
    /** R's messages (a rank-deficient fixed-effects matrix, a singular fit). */
    messages: string[];
    /** R's warnings (predictors on very different scales). */
    warnings: string[];
}
/**
 * The criterion (REML criterion or ML deviance) and its gradient with respect to θ at `theta`. Internal: the fit uses
 * the sparse {@link profiledDeviance}; the regression test injects the dense reference implementation.
 */
export type MixedCriterion = (s: MixedModelStructure, theta: readonly number[], reml: boolean) => {
    f: number;
    g: number[];
};
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
 * @param options `REML`, and `contrasts` and `levels` as in {@link lm}.
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
export declare function lmer(formula: string, data: DataFrame, options?: LmerOptions): LmerResult;
/**
 * {@link lmer} with the criterion and its gradient given (internal: not exported from the package). The regression
 * test of the sparse computation fits with the dense reference implementation through it.
 */
export declare function lmerWithCriterion(formula: string, data: DataFrame, options: LmerOptions, criterion: MixedCriterion): LmerResult;
