import type { DataFrame } from "./modelFrame.js";
import type { Sample } from "../htest/types.js";
import { type NlsExpr } from "./nlsFormula.js";
/** Algorithm used to fit a nonlinear least-squares model.
 *
 * @category Regression
 */
export type NlsAlgorithm = "default" | "plinear" | "port";
/** Convergence controls for nonlinear least squares.
 *
 * @category Regression
 */
export interface NlsControl {
    /** Maximum number of iterations. */
    maxiter?: number;
    /** Relative convergence tolerance. */
    tol?: number;
    /** Minimum step-length factor used by the line search. */
    minFactor?: number;
    /** Whether non-convergence is reported as a warning instead of an error. */
    warnOnly?: boolean;
    /** Positive offset used in the convergence scaling criterion. */
    scaleOffset?: number;
}
/** Options for {@link nls}.
 *
 * @category Regression
 */
export interface NlsOptions {
    /** Named initial parameter values. */
    start?: Record<string, number>;
    /** Nonlinear least-squares algorithm. */
    algorithm?: NlsAlgorithm;
    /** Non-negative observation weights, or the name of a data column. */
    weights?: Sample | string;
    /** Lower parameter bounds for the bounded algorithm. */
    lower?: number | readonly number[] | Record<string, number>;
    /** Upper parameter bounds for the bounded algorithm. */
    upper?: number | readonly number[] | Record<string, number>;
    /** Convergence controls. */
    control?: NlsControl;
}
/** Internal and public fitted-model quantities.
 *
 * @category Regression
 */
export interface NlsModel {
    /** Original model formula. */
    formula: string;
    /** Response expression label. */
    response: string;
    /** Parameter names in coefficient order. */
    parameterNames: string[];
    /** Named parameter estimates. */
    coefficients: Record<string, number>;
    /** Fitted response values. */
    fitted: number[];
    /** Observed minus fitted response values. */
    residuals: number[];
    /** Response values used in fitting. */
    y: number[];
    /** Observation weights used in fitting. */
    weights: number[];
    /** Original row indices retained after missing-value handling. */
    rows: number[];
    /** Numeric data columns retained for prediction and profiling. */
    data: Record<string, number[]>;
    /** Parsed expression tree used internally. @internal */
    expression: NlsExpr;
    /** Weighted residual sum of squares. */
    deviance: number;
    /** Residual standard error estimate. */
    sigma: number;
    /** Residual degrees of freedom. */
    dfResidual: number;
    /** Number of observations used in fitting. */
    nobs: number;
    /** Estimated parameter covariance matrix. */
    covariance: number[][];
    /** Estimated parameter correlation matrix. */
    correlation: number[][];
    /** Whether the convergence criterion was met. */
    converged: boolean;
    /** Number of iterations performed. */
    iterations: number;
    /** Algorithm used for fitting. */
    algorithm: NlsAlgorithm;
    /** Warnings produced during fitting. */
    warnings: string[];
    /** Whether the residual sum of squares is exactly zero. */
    exactFit: boolean;
}
/** Result returned by {@link nls}.
 *
 * @category Regression
 */
export interface NlsResult extends NlsModel {
}
/** Result returned by {@link nlsSummary}.
 *
 * @category Regression
 */
export interface NlsSummaryResult {
    /** Coefficient table with estimates, standard errors and test statistics. */
    coefficients: {
        /** Coefficient names in row order. */
        rows: string[];
        /** Summary statistic column names. */
        cols: string[];
        /** Rows of coefficient estimates, standard errors and test statistics. */
        values: number[][];
    };
    /** Residual standard error estimate. */
    sigma: number;
    /** Residual and model degrees of freedom. */
    df: [number, number];
    /** Weighted residual sum of squares. */
    deviance: number;
    /** Number of observations used in fitting. */
    nobs: number;
    /** Warnings produced while computing the summary. */
    warnings: string[];
}
/** Options for {@link nlsPredict}.
 *
 * @category Regression
 */
export interface NlsPredictOptions {
    /** New data columns at which to evaluate the fitted expression. */
    newdata: DataFrame;
}
/** Options for {@link nlsConfint}.
 *
 * @category Regression
 */
export interface NlsConfintOptions {
    /** Confidence-interval method; profile by default. */
    method?: "profile" | "wald";
    /** Confidence level between zero and one. */
    level?: number;
    /** Parameter names for which to compute intervals; omitted means all estimable parameters. */
    parm?: readonly string[];
}
/** Result returned by {@link nlsConfint}.
 *
 * @category Regression
 */
export interface NlsConfintResult {
    /** Parameter names for the intervals. */
    rows: string[];
    /** Lower and upper confidence-limit labels. */
    cols: [string, string];
    /** Lower and upper confidence limits, one pair per parameter. */
    values: [number, number][];
    /** Warnings produced while computing the intervals. */
    warnings: string[];
}
/** Result returned by {@link nlsAnova}.
 *
 * @category Regression
 */
export interface NlsAnovaResult {
    /** Sequential analysis-of-variance table. */
    table: {
        /** Formula for each fitted model. */
        Model: string[];
        /** Residual degrees of freedom for each model. */
        "Res.Df": number[];
        /** Residual sum of squares for each model. */
        "Res.Sum Sq": number[];
        /** Difference in residual degrees of freedom for each comparison. */
        "Df": (number | "NA")[];
        /** Difference in residual sum of squares for each comparison. */
        "Sum Sq": (number | "NA")[];
        /** F statistic for each comparison. */
        "F value": (number | "NA")[];
        /** Upper-tail F-test probability for each comparison. */
        "Pr(>F)": (number | "NA")[];
    };
    /** Warnings produced while comparing models. */
    warnings: string[];
}
/**
 * Nonlinear least-squares regression. Equivalent to R's `nls()`.
 *
 * Fits a user-specified nonlinear mean function by Gauss-Newton, variable projection, or bound-constrained
 * least squares. Formula expressions are parsed safely and differentiated symbolically.
 *
 * @param formula Response and nonlinear mean expression.
 * @param data Numeric data columns.
 * @param options Starting values, algorithm, weights, and convergence controls.
 * @returns The fitted coefficients, residuals, covariance, and convergence diagnostics.
 *
 * @example
 * ```ts
 * const data = { conc: [0.02, 0.06, 0.11, 0.22, 0.56, 1.1], rate: [76, 97, 123, 159, 191, 207] };
 * const fit = nls("rate ~ Vm * conc / (K + conc)", data, { start: { Vm: 200, K: 0.05 } });
 * fit.coefficients;
 * ```
 *
 * @category Regression
 */
export declare function nls(formula: string, data: DataFrame, options?: NlsOptions): NlsResult;
/**
 * Summary of a nonlinear least-squares fit. Equivalent to R's `summary.nls()`.
 *
 * @param fit A fitted nonlinear model.
 * @returns The coefficient table, residual scale, and residual degrees of freedom.
 *
 * @example
 * ```ts
 * const data = { conc: [0.02, 0.06, 0.11, 0.22, 0.56, 1.1], rate: [76, 97, 123, 159, 191, 207] };
 * const fit = nls("rate ~ Vm * conc / (K + conc)", data, { start: { Vm: 200, K: 0.05 } });
 * nlsSummary(fit);
 * ```
 *
 * @category Regression
 */
export declare function nlsSummary(fit: NlsResult): NlsSummaryResult;
/**
 * Covariance matrix of a nonlinear least-squares fit. Equivalent to R's `vcov.nls()`.
 *
 * @param fit A fitted nonlinear model.
 * @returns The covariance matrix in coefficient order.
 *
 * @example
 * ```ts
 * const data = { conc: [0.02, 0.06, 0.11, 0.22, 0.56, 1.1], rate: [76, 97, 123, 159, 191, 207] };
 * const fit = nls("rate ~ Vm * conc / (K + conc)", data, { start: { Vm: 200, K: 0.05 } });
 * nlsVcov(fit);
 * ```
 *
 * @category Regression
 */
export declare function nlsVcov(fit: NlsResult): number[][];
/**
 * Predictions from a nonlinear least-squares fit. Equivalent to R's `predict.nls()`.
 *
 * @param fit A fitted nonlinear model.
 * @param options New predictor data.
 * @returns One fitted mean per row of new data.
 *
 * @example
 * ```ts
 * const data = { conc: [0.02, 0.06, 0.11, 0.22, 0.56, 1.1], rate: [76, 97, 123, 159, 191, 207] };
 * const fit = nls("rate ~ Vm * conc / (K + conc)", data, { start: { Vm: 200, K: 0.05 } });
 * nlsPredict(fit, { newdata: { conc: [0.1, 0.5] } });
 * ```
 *
 * @category Regression
 */
export declare function nlsPredict(fit: NlsResult, options: NlsPredictOptions): number[];
/**
 * Wald or profile confidence intervals for nonlinear parameters. Equivalent to R's `confint.nls()`.
 *
 * @param fit A fitted nonlinear model.
 * @param options Interval method, confidence level, and parameter names.
 * @returns A two-column confidence interval matrix.
 *
 * @example
 * ```ts
 * const data = { conc: [0.02, 0.06, 0.11, 0.22, 0.56, 1.1], rate: [76, 97, 123, 159, 191, 207] };
 * const fit = nls("rate ~ Vm * conc / (K + conc)", data, { start: { Vm: 200, K: 0.05 } });
 * nlsConfint(fit, { method: "wald", level: 0.95 });
 * ```
 *
 * @category Regression
 */
export declare function nlsConfint(fit: NlsResult, options?: NlsConfintOptions): NlsConfintResult;
/**
 * Analysis of variance for nested nonlinear least-squares fits. Equivalent to R's `anova.nls()`.
 *
 * @param fits Two or more nested fits to the same observations.
 * @returns The sequential F-test table.
 *
 * @example
 * ```ts
 * const data = { x: [1, 2, 3, 4, 5], y: [2, 3, 5, 7, 8] };
 * const small = nls("y ~ a * x", data, { start: { a: 1 } });
 * const large = nls("y ~ a * x + b", data, { start: { a: 1, b: 0 } });
 * nlsAnova(small, large);
 * ```
 *
 * @category Regression
 */
export declare function nlsAnova(...fits: NlsResult[]): NlsAnovaResult;
