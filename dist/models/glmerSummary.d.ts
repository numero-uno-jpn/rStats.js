import type { GlmLinkName } from "./glmFamily.js";
import type { GlmerFamilyName } from "./glmerFamily.js";
import { type GlmerResult } from "./glmer.js";
import { type LmerVarCorr } from "./lmer.js";
/**
 * Options of {@link glmerSummary}: there is none yet. R's `correlation`, `use.hessian` and `useHessian` give the
 * Error `glmerSummary: argument '<key>' is not supported`, any other key a RangeError.
 *
 * @category Mixed models
 */
export interface GlmerSummaryOptions {
}
/**
 * Result of {@link glmerSummary}: lme4's `summary()` of a glmer fit.
 *
 * @category Mixed models
 */
export interface GlmerSummary {
    /** The family (R's `Family:` line). */
    family: GlmerFamilyName;
    /** The link. */
    link: GlmLinkName;
    /** The fit's nAGQ (R's title: Laplace approximation for 1, adaptive Gauss-Hermite quadrature otherwise). */
    nAGQ: number;
    /** Names of the fixed effects (R's row names). */
    names: string[];
    /** Estimates (R's `Estimate`). */
    estimate: number[];
    /** Standard errors (R's `Std. Error`, from the fit's `vcov`). */
    stdError: number[];
    /** Estimates over standard errors (R's third column). */
    statistic: number[];
    /** The third column's name: `"z value"` for binomial and poisson, `"t value"` for the families with a dispersion. */
    statisticName: "z value" | "t value";
    /**
     * Two-sided p-values from the normal distribution, 2 pnorm(−|statistic|) (R's `Pr(>|z|)`), for every family: lme4
     * uses no t distribution for the families with a dispersion either.
     */
    pValue: number[];
    /** The correlation of the fixed effects (R's `cov2cor(vcov(fit))`; array of rows, 1 on the diagonal). */
    correlation: number[][];
    /** The variance components (R's `VarCorr()`, not scaled by sigma; no residual row). */
    varCorr: LmerVarCorr[];
    /** The number of levels of each grouping factor (R's `ngrps()`), in the order of the fit's `ranef`. */
    nGroups: {
        group: string;
        levels: number;
    }[];
    /** Number of observations (R's `Number of obs`). */
    nObs: number;
    /** The log-likelihood (the fit's). */
    logLik: number;
    /** Akaike's information criterion. */
    AIC: number;
    /** Schwarz's Bayesian information criterion. */
    BIC: number;
    /** Degrees of freedom of the log-likelihood (the fit's `df`). */
    df: number;
    /** −2 logLik (R's `-2*log(L)`; the fit's `deviance` is R's `deviance()`, another quantity). */
    minus2LogLik: number;
    /** nObs − df (R's `df.resid`). */
    dfResidual: number;
    /** Minimum, quartiles, median and maximum of the Pearson residuals divided by sigma (R's `Scaled residuals`). */
    residualQuantiles: number[];
    /** R's `sigma()` (1 for binomial and poisson). */
    sigma: number;
    /** R's messages (a rank-deficient fixed-effects matrix, a singular fit). */
    messages: string[];
    /** R's warnings (the fallback of vcov to R_X, if the fit gave it). */
    warnings: string[];
}
/**
 * The summary of a generalized linear mixed model fitted by {@link glmer}: the coefficient table with p-values, the
 * correlation of the fixed effects, the quantiles of the scaled residuals, the information criteria, the variance
 * components and the numbers of groups. Equivalent to `lme4::summary()` in R.
 *
 * The p-values are from the normal distribution for every family, as lme4's (whose third column is named `t value`
 * for the families with a dispersion, although its p-values are normal ones). The values are those of the fit at the
 * exact optimum (see {@link glmer}), so they typically differ from lme4's in the 4th to 6th significant digit. For
 * `nAGQ > 1`, `logLik`, `AIC`, `BIC` and `minus2LogLik` are those of the log-likelihood, as the fit's.
 *
 * @param fit A result of {@link glmer} (the object it returned, not a copy).
 * @param options None yet (see {@link GlmerSummaryOptions}).
 *
 * @example
 * ```ts
 * // R: summary(lme4::glmer(y ~ x + (1 | g), data, family = poisson))
 * const fit = glmer("y ~ x + (1 | g)", {
 *   y: [2, 3, 6, 7, 8, 1, 0, 3, 2, 5, 4, 6, 9, 8, 13, 0, 2, 1, 4, 3],
 *   x: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5],
 *   g: ["a", "a", "a", "a", "a", "b", "b", "b", "b", "b", "c", "c", "c", "c", "c", "d", "d", "d", "d", "d"],
 * }, { family: "poisson" });
 * const s = glmerSummary(fit);
 * s.statisticName; // "z value"
 * s.pValue;        // [0.5482, 6.226e-5]
 * s.minus2LogLik;  // 78.785
 * s.dfResidual;    // 17
 * ```
 *
 * @category Mixed models
 */
export declare function glmerSummary(fit: GlmerResult, options?: GlmerSummaryOptions): GlmerSummary;
