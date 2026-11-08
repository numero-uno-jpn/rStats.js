import { type GlmLinkName } from "./glmFamily.js";
import { type GlmerFamilyName } from "./glmerFamily.js";
import { type GlmerStructure } from "./glmerStructure.js";
import { type LmerContrastName, type LmerRanef, type LmerVarCorr } from "./lmer.js";
import type { DataFrame } from "./modelFrame.js";
/**
 * Options of {@link glmer}. Only the keys below are accepted: R's `subset`, `naAction`, `na.action`, `control`,
 * `verbose`, `devFunOnly`, `mustart` and `etastart` give the Error `glmer: argument '<key>' is not supported`, any
 * other key a RangeError (a key whose value is `undefined` included).
 *
 * @category Mixed models
 */
export interface GlmerOptions {
    /**
     * The family: `"binomial"`, `"poisson"`, `"Gamma"`, `"inverse.gaussian"` or `"gaussian"` (default, as R's; with the
     * identity link it is a linear mixed model, a RangeError telling to use {@link lmer}). The quasi families are the
     * error `"quasi" families cannot be used in glmer`.
     */
    family?: GlmerFamilyName;
    /**
     * The link: any of `"logit"`, `"probit"`, `"cauchit"`, `"cloglog"`, `"identity"`, `"log"`, `"sqrt"`, `"1/mu^2"`,
     * `"inverse"` (default: the family's, as in R: binomial logit, poisson log, Gamma inverse, inverse.gaussian
     * 1/mu^2, gaussian identity).
     */
    link?: GlmLinkName;
    /**
     * Prior weights (non-negative): one per row of `data` (`null` or NaN is missing and drops the row), or the name of
     * a numeric column. For the binomial family with proportions as the response, the numbers of trials.
     */
    weights?: readonly (number | null)[] | Float64Array | string;
    /** Offset added to the linear predictor: one per row of `data` (`null` or NaN drops the row), or a column name. */
    offset?: readonly (number | null)[] | Float64Array | string;
    /**
     * 1 (default): the Laplace approximation, the deviance minimised over θ and β; 0: over θ only, with β from the
     * penalised IRLS (faster, less exact); 2 to 100: adaptive Gauss-Hermite quadrature with that many points, more
     * exact than the Laplace approximation. A non-integer is truncated as in R (−0.5 is 0); negative values after that
     * are a RangeError (R uses 0), above 100 R's error. Above 1 the model must have a single random-effects term with one column, such as
     * `(1 | g)` (otherwise R's errors `nAGQ > 1 is only available for models with a single, scalar random-effects
     * term` or `AGQ only defined for a single scalar random-effects term`), and the family must be binomial or
     * poisson: for Gamma, inverse.gaussian and gaussian it is a RangeError, since lme4 holds the dispersion at 1 there
     * and its estimates are not maximum likelihood (R fits them).
     */
    nAGQ?: number;
    /**
     * Where the search begins (it does not change the estimate unless the deviance has several minima): `theta`, the
     * covariance parameters (the length of θ, diagonal elements not negative), and `fixef`, the fixed effects (nAGQ = 1
     * only), each with R's error messages.
     */
    start?: {
        /** Starting values of θ (R's `start = list(theta = ...)`). */
        theta?: readonly number[];
        /** Starting values of the fixed effects (R's `start = list(fixef = ...)`; not with nAGQ = 0, as in R). */
        fixef?: readonly number[];
    };
    /**
     * A contrast per factor of the fixed-effects part, as in {@link lmer} (see {@link LmerContrastName}); the
     * random-effects terms always use treatment contrasts.
     */
    contrasts?: Record<string, LmerContrastName>;
    /**
     * The order of the levels of a factor (`{ A: ["c", "a", "b"] }`), as `factor(x, levels = ...)` in R. For a binomial
     * response given as strings, the first level is failure and the others success.
     */
    levels?: Record<string, readonly string[]>;
}
/**
 * Result of {@link glmer}: the fit of a generalized linear mixed model and the quantities of R's methods for it.
 *
 * @category Mixed models
 */
export interface GlmerResult {
    /** The formula. */
    formula: string;
    /** The family. */
    family: GlmerFamilyName;
    /** The link. */
    link: GlmLinkName;
    /** 1 (the Laplace approximation), 0 (β from the penalised IRLS) or the number of quadrature points (2 to 100). */
    nAGQ: number;
    /** Number of rows used (rows with prior weight 0 included; R's `nobs()`). */
    nObs: number;
    /** 0-based indices of the rows of `data` used (rows with a missing value in a variable, a weight or the offset dropped). */
    rows: number[];
    /** The estimate of the covariance parameters θ (R's `getME(fit, "theta")`): the lower triangles of the relative covariance factors, by term, column-major. */
    theta: number[];
    /** Names of the columns of the fixed-effects model matrix (aliased columns dropped). */
    fixefNames: string[];
    /** The fixed effects β̂ (R's `fixef()`). */
    fixef: number[];
    /** The coefficient table of the fixed effects (R's `coef(summary(fit))`, without the p-values). */
    coefTable: {
        /** Estimates (R's `Estimate`). */
        estimate: number[];
        /** Standard errors (R's `Std. Error`). */
        stdError: number[];
        /** Estimates over standard errors (R's `z value`; R labels it `t value` for Gamma, inverse.gaussian and gaussian). */
        zValue: number[];
    };
    /** The covariance matrix of the fixed effects (R's `vcov()`), array of rows. */
    vcov: number[][];
    /**
     * How `vcov` was computed: `"hessian"`, 2 times the block of the fixed effects of the inverse Hessian of the
     * deviance in (θ, β) (R's default for nAGQ = 1 when the fit is not singular, nObs < 10000 and there are fewer than
     * 20 parameters), or `"RX"`, σ² (R_X'R_X)⁻¹ of the penalised IRLS at the conditional mode.
     */
    vcovFrom: "hessian" | "RX";
    /**
     * R's `sigma()`: 1 for binomial and poisson; otherwise the square root of the sum of the squared Pearson residuals
     * plus the squared length of the spherical random effects, over nObs.
     */
    sigma: number;
    /** The variance components, one entry per random-effects term (R's `VarCorr()`; not scaled by sigma). */
    varCorr: LmerVarCorr[];
    /** The conditional modes of the random effects, one entry per grouping factor (R's `ranef()`). */
    ranef: LmerRanef[];
    /** The fitted means μ̂, one per row used (R's `fitted()`; for a binomial response the probabilities). */
    fitted: number[];
    /** The linear predictor η̂ = offset + Xβ̂ + Zb̂, one per row used (R's `predict()`). */
    linearPredictor: number[];
    /** The deviance residuals (R's `residuals()`, whose default type for glmer is `"deviance"`). */
    residuals: number[];
    /** The Pearson residuals √w (y − μ̂) / √V(μ̂) (R's `residuals(fit, "pearson")`). */
    pearsonResiduals: number[];
    /** The working residuals (y − μ̂) / μ'(η̂) (R's `residuals(fit, "working")`). */
    workingResiduals: number[];
    /** The response residuals y − μ̂ (R's `residuals(fit, "response")`; y the proportion for `cbind(s, f)`). */
    responseResiduals: number[];
    /** The sum of the squared deviance residuals (R's `deviance()`; not −2 logLik). */
    deviance: number;
    /**
     * The log-likelihood: of the Laplace approximation, −1/2 times the deviance minimised (R's `logLik()`), or with
     * nAGQ > 1 of the quadrature, including the constant of the saturated model that R's `logLik()` leaves out there
     * (so that it is comparable with nAGQ = 1 and with glm).
     */
    logLik: number;
    /** Degrees of freedom of the log-likelihood: the numbers of fixed effects and of θ, plus 1 for the families with a dispersion. */
    df: number;
    /** Akaike's information criterion (R's `AIC()`). */
    AIC: number;
    /** Schwarz's Bayesian information criterion (R's `BIC()`). */
    BIC: number;
    /** Whether the fit is singular: a diagonal element of a relative covariance factor below 1e-4 (R's `isSingular()`). */
    singular: boolean;
    /** R's messages (a rank-deficient fixed-effects matrix, a singular fit). */
    messages: string[];
    /** R's warnings (predictors on very different scales, the response, the fallback of vcov). */
    warnings: string[];
}
export declare const VCOV_FALLBACK = "variance-covariance matrix computed from finite-difference Hessian is\nnot positive definite or contains NA values: falling back to var-cov estimated from RX";
/**
 * What a fit by {@link glmer} was made from and with (internal: not exported from the package), for the functions that
 * work on a fit beyond its result fields (glmerSummary, glmerAnova, prediction): the model's structure, the data object
 * (model comparison requires the same object) and its snapshot (prediction rebuilds the model from it), the options as
 * given (the weights and the offset as an array or a column name), and the estimate with R_X'R_X, the random effects,
 * the linear predictor and the means at it.
 */
export interface GlmerInternals {
    /** The structure of the model (X, Z, the terms, the family, the response, prior weights and offset of the rows used) */
    structure: GlmerStructure;
    /** The data frame given to glmer (the same object, not a copy: fits are compared on the same data object) */
    data: DataFrame;
    /** A copy of the columns of `data` at the time of the fit */
    snapshot: DataFrame;
    /** The options given to glmer (a copy; `weights` and `offset` as given, arrays copied) */
    options: GlmerOptions;
    /** The estimate θ̂ (a copy) */
    theta: number[];
    /** The fixed effects β̂ (a copy) */
    beta: number[];
    /**
     * R_X'R_X = X'WX − X'WZΛ (Λ'Z'WZΛ + I)⁻¹ Λ'Z'WX at θ̂ with the Fisher weights at the conditional mode (not scaled by
     * σ²; array of rows)
     */
    rxtrx: number[][];
    /** The random effects b̂ = Λ_θ̂ û at the conditional mode, in the order of the columns of Z (a copy) */
    b: number[];
    /** The linear predictor η̂ at the mode, one per row used (a copy) */
    eta: number[];
    /** The fitted means μ̂ (lme4's inverse link), one per row used (a copy) */
    mu: number[];
    /** R's sigma (1 for binomial and poisson) */
    sigma: number;
}
/** Whether an object is a result returned by {@link glmer} (internal) */
export declare function isGlmerFit(fit: unknown): fit is GlmerResult;
/**
 * The internals of a fit (see {@link GlmerInternals}). Internal. Throws a TypeError for an object that is not a result
 * returned by {@link glmer}.
 */
export declare function glmerInternals(fit: GlmerResult): GlmerInternals;
/**
 * Fit a generalized linear mixed model by the Laplace approximation (`nAGQ = 1`, default), by adaptive Gauss-Hermite
 * quadrature (`nAGQ` from 2 to 100) or with the fixed effects from the penalised IRLS (`nAGQ = 0`). Equivalent to `lme4::glmer()` in R. With the quantities of its methods:
 * `fixef()`, `coef(summary())` (without p-values), `vcov()`, `sigma()`, `VarCorr()`, `ranef()`, `fitted()`,
 * `predict()`, `residuals()` of the four types, `deviance()`, `logLik()`, `AIC()`, `BIC()` and `isSingular()`.
 *
 * The families are binomial, poisson, Gamma, inverse.gaussian and gaussian (not with the identity link: that is
 * {@link lmer}), with the links of {@link glm} and lme4's own inverse links and variance functions. The formula is
 * as in {@link lmer}; a binomial response may be 0/1 values, booleans, strings or a factor (the first level failure),
 * proportions with the numbers of trials as `weights`, or `cbind(successes, failures)` with two column names on the
 * left-hand side.
 *
 * The estimate is the exact minimiser of the Laplace deviance computed at the exact conditional mode of the random
 * effects (lme4's optimiser and its penalised IRLS stop early, so lme4's values typically differ in the 4th to 6th
 * significant digit, its standard errors by up to about 1%). Elements of θ on the boundary are exactly 0, and the fit
 * is then singular. lme4's warnings about its optimiser and its convergence checks are not given.
 *
 * The scale of the response: lme4's Laplace criterion leaves out the dispersion, so for the poisson,
 * inverse.gaussian and gaussian families it is not invariant to the scale of the response (or of the prior weights).
 * Where the information about the random effects at the start, Σ W z² of a column of Z (W the working weights at
 * the starting means), is above 2^40 (the penalised system then loses about 40 of its 53 bits), or below 2^-40 and
 * the fit fails or a term ends at θ = 0 on a criterion flat to rounding, the result is a RangeError saying so. For
 * data like the example below: poisson counts up to about 1e11 (prior weights up to about 2^34), inverse.gaussian
 * with the log link up to about 1e13, gaussian with the log link from about 1e-6 to 5e4 fit; beyond, the RangeError.
 * Gamma fits are not limited by the scale of the response (its criterion is invariant; with the log link a tiny
 * response is rescaled).
 *
 * Adaptive Gauss-Hermite quadrature (`nAGQ > 1`) needs a single scalar random-effects term such as `(1 | g)`, with
 * R's errors otherwise. It is offered for binomial and poisson only: for Gamma, inverse.gaussian and gaussian it is a
 * RangeError, since lme4 holds the dispersion at 1 there, so that its estimates would not be maximum likelihood. Its
 * `logLik`, `AIC` and `BIC` are those of the log-likelihood, unlike R's, which leave out the constant of the
 * saturated model (`aic − Σ` deviance residuals) for nAGQ > 1: they differ from R's by that constant and are
 * comparable with the Laplace fit's.
 *
 * @param formula A formula such as `"cbind(inc, notinc) ~ period + (1 | herd)"` or `"y ~ x + (1 | g)"`.
 * @param data The data frame: an object of columns.
 * @param options `family`, `link`, `weights`, `offset`, `nAGQ`, `start`, and `contrasts` and `levels` as in
 *   {@link lmer} (see {@link GlmerOptions} for the keys accepted).
 *
 * @example
 * ```ts
 * // R: lme4::glmer(y ~ x + (1 | g), data, family = poisson)
 * const fit = glmer("y ~ x + (1 | g)", {
 *   y: [2, 3, 6, 7, 8, 1, 0, 3, 2, 5, 4, 6, 9, 8, 13, 0, 2, 1, 4, 3],
 *   x: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5],
 *   g: ["a", "a", "a", "a", "a", "b", "b", "b", "b", "b", "c", "c", "c", "c", "c", "d", "d", "d", "d", "d"],
 * }, { family: "poisson" });
 * fit.fixef;              // [0.2512, 0.3242]
 * fit.coefTable.stdError; // [0.4183, 0.08098]
 * fit.varCorr[0].sd;      // [0.5423]
 * fit.ranef[0].values;    // [[0.2840], [-0.4170], [0.6920], [-0.4819]]
 * fit.logLik;             // -39.392
 * ```
 *
 * @category Mixed models
 */
export declare function glmer(formula: string, data: DataFrame, options?: GlmerOptions): GlmerResult;
/**
 * The largest information of a column of Z about its random effect at the start, Σ_i W_i z_ij² over the rows of the
 * column (Z scaled as in the fit, so that θ' = 1 is the start of the minimisation; W the working weights at the
 * family's starting means). The Laplace criterion resolves θ' where θ'² times this is neither negligible against the
 * 1 of Λ'Z'WZΛ + I nor so large that the system loses its digits against the fixed effects (internal; exported for
 * the tests)
 */
export declare function startInformation(s: GlmerStructure): number;
