import { type GlmOptions, type GlmResult } from "./glm.js";
import type { MatrixInput } from "../linalg/matrix.js";
import type { Sample } from "../htest/types.js";
/**
 * Options for {@link svyglm}.
 *
 * @category Generalized linear models
 */
export interface SvyglmOptions {
    /** The sampling (inverse probability) weights, one per row, positive. */
    weights: Sample;
    /** The family, as {@link glm} (default `"gaussian"`). */
    family?: GlmOptions["family"];
    /** The link, as {@link glm}. */
    link?: GlmOptions["link"];
    /** Convergence tolerance, as {@link glm} (default `1e-8`). */
    epsilon?: number;
    /** Maximum number of iterations, as {@link glm} (default `25`). */
    maxit?: number;
}
/**
 * Result of {@link svyglm}: the rows of R's `summary(svyglm(...))$coefficients` and the fit.
 *
 * @category Generalized linear models
 */
export interface SvyglmResult {
    /** Column names: `"(Intercept)"`, `"x1"`, `"x2"`, ... */
    names: string[];
    /** Coefficients (the weighted glm's). */
    coefficients: number[];
    /** Standard errors, from `vcov`. */
    se: number[];
    /** t statistics. */
    tValue: number[];
    /** Two-sided p-values from the t distribution with `dfResidual` degrees of freedom. */
    pValue: number[];
    /** The design-based variance matrix (array of rows): sandwich HC0 times n / (n - 1). */
    vcov: number[][];
    /** Residual degrees of freedom of the design, n - p. */
    dfResidual: number;
    /** The dispersion R prints: the weighted variance of the Pearson residuals (about their weighted mean) times
     * n / (n - 1); it does not enter the standard errors. */
    dispersion: number;
    /** Deviance with the weights rescaled to mean 1 (R's). */
    deviance: number;
    /** Null deviance with the weights rescaled to mean 1 (R's). */
    nullDeviance: number;
    /** Fitted means. */
    fittedValues: number[];
    /** Linear predictors. */
    linearPredictors: number[];
    /** Iterations of the glm. */
    iter: number;
    /** Whether the glm converged. */
    converged: boolean;
    /** The weighted glm (weights rescaled to mean 1). */
    glm: GlmResult;
    /** R's warnings, each once. */
    warnings: string[];
}
/**
 * A generalised linear model for weighted data with design-based (sandwich) standard errors. Equivalent to
 * `survey::svyglm()` in R. The call followed is `summary(svyglm(y ~ ..., design, family))` for the design
 * `svydesign(ids = ~1, weights = ~w, data)`, the design of inverse probability of treatment weighting.
 *
 * The coefficients are those of `glm(y ~ ..., weights = w)`; the variance is the HC0 sandwich of that fit times
 * n / (n − 1), and the tests are t tests on n − p degrees of freedom. binomial and quasibinomial give the same table
 * (binomial warns about the non-integer successes, as R). AIC is not given (R gives NA).
 * @category Generalized linear models
 * @example
 * ```ts
 * const fit = svyglm([[1, 0.2], [0, 1.1], [1, -0.4], [0, 0.3], [1, 0.9], [0, -1.2]], [1, 0, 1, 1, 0, 0],
 *   { weights: [1.5, 2, 1.2, 3, 1.1, 2.5], family: "quasibinomial" });
 * fit.pValue; // [0.7799833144017342, 0.5461647344319471, 0.9579412581407588]
 * ```
 */
export declare function svyglm(x: MatrixInput | Sample, y: Sample, options: SvyglmOptions): SvyglmResult;
