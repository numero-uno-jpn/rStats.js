import { type FormulaNode } from "./formula.js";
import { type DesignContrast } from "./modelMatrix.js";
import type { DataFrame } from "./modelFrame.js";
import type { Sample } from "../htest/types.js";
/**
 * Options for {@link multinom}.
 *
 * @category Regression
 */
export interface MultinomOptions {
    /** Case weights, one per row of `data` (non-negative; need not be integers), or the name of a column of `data`. */
    weights?: Sample | string;
    /** Weight decay: `decay` times the sum of squares of all coefficients (intercepts included) is added to −log L, as
     * nnet's `decay`. Default 0. */
    decay?: number;
    /** The order of the levels of factors (the response's first level is the reference category). */
    levels?: Record<string, readonly string[]>;
    /** A contrast per factor predictor (default `"contr.treatment"`). */
    contrasts?: Record<string, "contr.treatment" | "contr.sum" | "contr.helmert">;
    /** Maximum number of Newton iterations. Default 100. */
    maxit?: number;
}
/**
 * The data of a {@link multinom} fit kept for its methods.
 *
 * @category Regression
 */
export interface MultinomModel {
    /** The formula. */
    formula: string;
    /** Parsed right-hand side; internal. @internal */
    rhs: FormulaNode;
    /** Predictor variables in model-matrix order. */
    predictorVariables: string[];
    /** Levels of the factor predictors. */
    factorLevels: Record<string, readonly string[]>;
    /** Contrasts used; internal. @internal */
    contrasts: Record<string, DesignContrast>;
    /** The model matrix (with its intercept column). */
    x: number[][];
    /** The response as level indices (0 is the reference). */
    y: number[];
    /** Case weights of the rows used. */
    weights: number[];
    /** 0-based rows of `data` used (rows with missing values are dropped). */
    rows: number[];
    /** The fit in its internal units; internal. @internal */
    internal: {
        centre: number[];
        exps: number[];
        kept: number[];
        intercept: number;
        scaledCoef: number[][];
    };
}
/**
 * Result of {@link multinom}.
 *
 * @category Regression
 */
export interface MultinomResult {
    /** The response's levels; the first is the reference category (R's `lev`). */
    levels: string[];
    /** Columns of the model matrix: `"(Intercept)"`, then the predictors' columns. */
    columnNames: string[];
    /** Coefficients, one row per non-reference level (R's `coef()`: rows `levels[1]`, ...). */
    coefficients: number[][];
    /** Standard errors, the same shape (from the inverse of the Hessian of −log L). */
    se: number[][];
    /** Variance matrix of the coefficients in R's order (`B:(Intercept)`, `B:x1`, ..., `C:(Intercept)`, ...). */
    vcov: number[][];
    /** Hessian of −log L in the same order (R's `Hessian` with `Hess = TRUE`; without the decay term, as R). */
    hessian: number[][];
    /** Names of the rows and columns of `vcov` and `hessian` (`"B:x1"`, ...). */
    parameterNames: string[];
    /** The minimised objective: −log L plus the decay penalty (R's `value`). */
    value: number;
    /** Twice `value` (R's `deviance`, which includes the penalty). */
    deviance: number;
    /** The log-likelihood as R reports it: −`value`. */
    logLik: number;
    /** Number of coefficients estimated, (K − 1) p less the aliased columns (R's `edf`). */
    edf: number;
    /** `deviance` + 2 `edf` (R's `AIC`). */
    aic: number;
    /** Fitted probabilities, one row per observation used, one column per level. */
    fittedValues: number[][];
    /** Number of observations used. */
    n: number;
    /** The decay used. */
    decay: number;
    /** Whether Newton's method met its tolerance on the score. */
    converged: boolean;
    /** Newton iterations. */
    iter: number;
    /** The data kept for the methods. */
    model: MultinomModel;
    /** R's warnings, each once. */
    warnings: string[];
}
/**
 * Multinomial logistic regression: baseline-category logits for a response with two or more levels, the first level
 * the reference. Equivalent to `nnet::multinom()` in R. The call followed is
 * `multinom(y ~ ..., data, weights, decay, Hess = TRUE)`.
 *
 * The coefficients maximise the (weighted) log-likelihood less `decay` times the sum of squares of all coefficients,
 * by Newton's method to machine precision; R's BFGS stops earlier (by default about 1e-5 from the maximum). The
 * standard errors come from the Hessian of −log L (without the decay term, as R). A numeric response is made a factor;
 * an unused level is dropped with R's warning; rows with missing values are dropped.
 * @category Regression
 * @example
 * ```ts
 * const data = { y: ["a", "b", "c", "b", "a", "c", "c", "a", "b", "a"], x: [1, 2, 3, 1.5, 2.2, 2.8, 1.9, 1.2, 3.1, 2.5] };
 * const fit = multinom("y ~ x", data);
 * fit.coefficients; // [[-2.503002448686904, 1.1313364602572131], [-4.9150873979421785, 2.1386561772142767]] (rows b, c)
 * fit.deviance; // 18.97233634263671
 * ```
 */
export declare function multinom(formula: string, data: DataFrame, options?: MultinomOptions): MultinomResult;
/**
 * Result of {@link multinomSummary}.
 *
 * @category Regression
 */
export interface MultinomSummaryResult {
    /** Coefficients (rows the non-reference levels). */
    coefficients: number[][];
    /** Standard errors. */
    se: number[][];
    /** Wald z statistics, coefficient / standard error (R's `Wald.ratios`). */
    zValue: number[][];
    /** Two-sided p-values 2 (1 − Φ(|z|)). */
    pValue: number[][];
    /** exp(coefficients): the odds ratios against the reference level. */
    oddsRatios: number[][];
    /** Deviance of the fit (R's). */
    deviance: number;
    /** AIC of the fit (R's). */
    aic: number;
    /** Log-likelihood of the fit (R's). */
    logLik: number;
    /** The log-likelihood of the intercept-only model on the same rows and weights. */
    nullLogLik: number;
    /** McFadden's pseudo R²: 1 − logLik / nullLogLik. */
    mcFadden: number;
    /** Cox and Snell's: 1 − exp(2 (nullLogLik − logLik) / n). */
    coxSnell: number;
    /** Nagelkerke's: Cox and Snell's / (1 − exp(2 nullLogLik / n)). */
    nagelkerke: number;
}
/**
 * Summary of a multinomial logistic regression: Wald tests of the coefficients, odds ratios and pseudo R². Equivalent
 * to `nnet::summary.multinom()` in R. The call followed is `summary(fit, Wald.ratios = TRUE)`, with the p-values, odds
 * ratios and pseudo R² as ReactiveStat computes them (the null model `multinom(y ~ 1)` on the same rows, n the number
 * of rows).
 * @category Regression
 */
export declare function multinomSummary(fit: MultinomResult): MultinomSummaryResult;
/**
 * Result of {@link multinomVcov}.
 *
 * @category Regression
 */
export interface MultinomVcovResult {
    /** The variance matrix (array of rows). */
    vcov: number[][];
    /** Row and column names, `"B:(Intercept)"`, `"B:x1"`, ... */
    names: string[];
}
/**
 * Variance matrix of the coefficients of a multinomial logistic regression. Equivalent to `nnet::vcov.multinom()` in R.
 * @category Regression
 */
export declare function multinomVcov(fit: MultinomResult): MultinomVcovResult;
/**
 * Options for {@link multinomConfint}.
 *
 * @category Regression
 */
export interface MultinomConfintOptions {
    /** Confidence level. Default 0.95. */
    level?: number;
}
/**
 * Result of {@link multinomConfint}: limits with the shape of the coefficients.
 *
 * @category Regression
 */
export interface MultinomConfintResult {
    /** Lower limits (rows the non-reference levels). */
    lower: number[][];
    /** Upper limits. */
    upper: number[][];
    /** The confidence level. */
    level: number;
}
/**
 * Wald confidence intervals of the coefficients of a multinomial logistic regression. Equivalent to
 * `nnet::confint.multinom()` in R. The limits are coefficient ± qnorm((1 + level) / 2) se.
 * @category Regression
 */
export declare function multinomConfint(fit: MultinomResult, options?: MultinomConfintOptions): MultinomConfintResult;
/**
 * Options for {@link multinomPredict}.
 *
 * @category Regression
 */
export interface MultinomPredictOptions {
    /** New values of the predictors (default: the rows of the fit). */
    newdata?: DataFrame;
    /** `"class"` (default): the most probable level; `"probs"`: the probabilities. */
    type?: "class" | "probs";
}
/**
 * Predictions of a multinomial logistic regression: probabilities of the levels, or the most probable level. Equivalent
 * to `nnet::predict.multinom()` in R.
 *
 * Ties are broken as R's `max.col`: probabilities within 1e-5 (relative) of the row's largest are tied, and the k-th
 * tied level replaces the choice when k u < 1, u a uniform of {@link runif} (one per tie after the first), so the
 * classes are R's after the same `setSeed`.
 * @category Regression
 */
export declare function multinomPredict(fit: MultinomResult, options?: MultinomPredictOptions): string[] | number[][];
/**
 * Result of {@link multinomAnova}: one row per model, in increasing order of the number of coefficients.
 *
 * @category Regression
 */
export interface MultinomAnovaResult {
    /** The right-hand sides of the formulas (`"1"` for the intercept-only model). */
    model: string[];
    /** Residual degrees of freedom, n (K − 1) − edf. */
    residDf: number[];
    /** Deviances. */
    residDev: number[];
    /** `"1 vs 2"`, ... (`""` for the first). */
    test: string[];
    /** Degrees of freedom of each test (NaN for the first). */
    df: number[];
    /** Likelihood-ratio statistics, the differences of deviances (NaN for the first). */
    lrStat: number[];
    /** Upper chi-squared p-values (NaN for the first). */
    pValue: number[];
}
/**
 * Likelihood-ratio tests of nested multinomial logistic regressions. Equivalent to `nnet::anova.multinom()` in R. The
 * models are ordered by their residual degrees of freedom (largest first), whatever the order given.
 * @category Regression
 */
export declare function multinomAnova(...fits: MultinomResult[]): MultinomAnovaResult;
