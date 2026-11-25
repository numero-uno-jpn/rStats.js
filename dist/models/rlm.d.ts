import type { DataFrame } from "./modelFrame.js";
import type { Sample } from "../htest/types.js";
/** The score function used by robust regression.
*
* @category Regression
*/
export type RlmPsi = "huber" | "hampel" | "bisquare";
/** Options shared by the psi functions.
*
* @category Regression
*/
export interface RlmPsiHuberOptions {
    /** Return the derivative of psi instead of psi(u)/u. Default 0. */
    deriv?: 0 | 1;
    /** Huber tuning constant. Default 1.345. */
    k?: number;
}
/** Options for the Hampel psi function.
*
* @category Regression
*/
export interface RlmPsiHampelOptions {
    /** Return the derivative of psi instead of psi(u)/u. Default 0. */
    deriv?: 0 | 1;
    /** First corner. Default 2. */
    a?: number;
    /** Second corner. Default 4. */
    b?: number;
    /** Rejection point. Default 8. */
    c?: number;
}
/** Options for the bisquare psi function.
*
* @category Regression
*/
export interface RlmPsiBisquareOptions {
    /** Return the derivative of psi instead of psi(u)/u. Default 0. */
    deriv?: 0 | 1;
    /** Tuning constant. Default 4.685. */
    c?: number;
}
/** Scalar output returned by a robust score function.
 *
 * @category Regression
 */
export type PsiOutput = number | boolean;
/** Scalar or vector input accepted by the robust score functions.
 *
 * @category Regression
 */
export type PsiInput = number | Sample;
/** Scalar or vector output returned by the robust score functions.
 *
 * @category Regression
 */
export type PsiResult = PsiOutput | PsiOutput[];
/** Huber's psi function. Equivalent to R's `MASS::psi.huber()`.
*
* @param u Standardised residuals.
* @param options Tuning constant and output selection.
* @returns The IRLS weight psi(u)/u, or psi'(u) when deriv is 1.
*
* @example
* ```ts
* psiHuber([-2, 0, 1, 2]); // [0.6725, 1, 1, 0.6725]
* ```
*
* @category Regression
*/
export declare function psiHuber(u: PsiInput, options?: RlmPsiHuberOptions): PsiResult;
/** Hampel's three-part psi function. Equivalent to R's `MASS::psi.hampel()`.
*
* @param u Standardised residuals.
* @param options Three tuning points and output selection.
* @returns The IRLS weight psi(u)/u, or psi'(u) when deriv is 1.
*
* @example
* ```ts
* psiHampel([-5, -2, 0, 5, 9]); // [0.3, 1, 1, 0.3, 0]
* ```
*
* @category Regression
*/
export declare function psiHampel(u: PsiInput, options?: RlmPsiHampelOptions): number | number[];
/** Tukey's bisquare psi function. Equivalent to R's `MASS::psi.bisquare()`.
*
* @param u Standardised residuals.
* @param options Tuning constant and output selection.
* @returns The IRLS weight psi(u)/u, or psi'(u) when deriv is 1.
*
* @example
* ```ts
* psiBisquare([-5, 0, 2]); // [0, 1, 0.668733411888633]
* ```
*
* @category Regression
*/
export declare function psiBisquare(u: PsiInput, options?: RlmPsiBisquareOptions): number | number[];
/** Options for `rlm`.
*
* @category Regression
*/
export interface RlmOptions {
    /** Estimation method. "MM" uses a deterministic S start and a fixed-scale redescending M step. Default "M". */
    method?: "M" | "MM";
    /** Score function. Default "huber". */
    psi?: RlmPsi;
    /** Scale estimator. "Huber" and "proposal 2" are equivalent. Default "MAD". */
    scaleEst?: "MAD" | "Huber" | "proposal 2";
    /** Least-squares start, deterministic LTS start, or initial coefficients. Default "ls". */
    init?: "ls" | "lts" | Sample;
    /** Non-negative observation weights, or a column name. */
    weights?: Sample | string;
    /** Meaning of weights. "inv" uses inverse-variance weights; "case" uses frequency weights. */
    wtMethod?: "inv" | "case";
    /** Huber tuning constant. Default 1.345. */
    k?: number;
    /** Hampel first corner. Default 2. */
    a?: number;
    /** Hampel second corner. Default 4. */
    b?: number;
    /** Hampel rejection point or bisquare tuning constant. Default 8 or 4.685. */
    c?: number;
    /** Proposal 2 scale tuning constant. Default 1.345. */
    k2?: number;
    /** Maximum number of IRLS iterations. Default 1000, allowing the estimating equations to reach their solution. */
    maxit?: number;
    /** Dimensionless estimating-equation and scale fixed-point tolerance. Default 1e-10. */
    acc?: number;
}
/** Data and settings retained by an M fit.
*
* @category Regression
*/
export interface RlmModel {
    /** Original model formula. */
    formula: string;
    /** Retained design matrix. */
    x: number[][];
    /** Retained response values. */
    y: number[];
    /** Names of design-matrix columns. */
    columnNames: string[];
    /** Prior observation weights. */
    observationWeights: number[];
    /** Interpretation of the observation weights. */
    wtMethod: "inv" | "case";
    /** Robust score function. */
    psi: RlmPsi;
    /** Residual scale estimator. */
    scaleEst: "MAD" | "Huber" | "proposal 2";
    /** Huber tuning constant. */
    k: number;
    /** Hampel first tuning point. */
    a: number;
    /** Hampel second tuning point. */
    b: number;
    /** Hampel rejection point or bisquare tuning constant. */
    c: number;
    /** Proposal 2 scale tuning constant. */
    k2: number;
    /** Original row indices retained after missing-value handling. */
    rows: number[];
}
/** Result of `rlm`: robust coefficients, fitted values, scale and convergence diagnostics.
*
* @category Regression
*/
export interface RlmResult {
    /** Named robust regression coefficients. */
    coefficients: Record<string, number>;
    /** Fitted response values. */
    fittedValues: number[];
    /** Observed minus fitted response values. */
    residuals: number[];
    /** Robust weights from the selected score function. */
    robustWeights: number[];
    /** Combined weights used in weighted least-squares steps. */
    workingWeights: number[];
    /** Estimated robust residual scale. */
    scale: number;
    /** Residual standard deviation estimate. */
    stddev: number;
    /** Estimated coefficient covariance matrix. */
    covariance: number[][];
    /** Unscaled coefficient covariance matrix. */
    covarianceUnscaled: number[][];
    /** Whether the estimating equations and scale iteration converged. */
    converged: boolean;
    /** Number of iterations performed. */
    iterations: number;
    /** Convergence diagnostics for the estimating equations and scale. */
    convergence: number[];
    /** Warnings produced during fitting. */
    warnings: string[];
    /** Model data and settings retained for companion methods. */
    model: RlmModel;
    /** Details of the deterministic high-breakdown initial estimate. */
    initialization?: {
        /** Initial estimator used before the M step. */
        method: "LTS" | "S";
        /** Named coefficients from the initial estimate. */
        coefficients: Record<string, number>;
        /** Objective value of the selected initial estimate. */
        objective: number;
        /** Number of candidate subsets evaluated. */
        candidatesEvaluated: number;
        /** Total number of candidate subsets, as a decimal string. */
        candidateCount: string;
        /** Whether every candidate subset was evaluated. */
        exhaustive: boolean;
    };
}
/** Coefficient table returned by {@link rlmSummary}.
*
* @category Regression
*/
export interface RlmSummaryResult {
    /** Coefficient names. */
    rows: string[];
    /** Summary statistic column names. */
    columns: ["Value", "Std. Error", "t value"];
    /** Rows of estimates, standard errors and test statistics. */
    values: number[][];
    /** Warnings produced while computing the summary. */
    warnings: string[];
}
/** Covariance matrix returned by {@link rlmVcov}.
*
* @category Regression
*/
export interface RlmVcovResult {
    /** Coefficient names in matrix row order. */
    rows: string[];
    /** Coefficient names in matrix column order. */
    columns: string[];
    /** Covariance matrix values. */
    values: number[][];
    /** Warnings produced while computing the covariance. */
    warnings: string[];
}
/** Robust M regression. Equivalent to R's `MASS::rlm()`.
*
* @param formula A formula such as `"y ~ x1 + x2"`.
* @param data Columns of equal-length observations.
* @param options Psi, scale, initial values, observation weights and iteration controls.
* @returns Coefficients, fitted values, residuals, robust weights, scale and covariance diagnostics.
*
* @example
* ```ts
* rlm("y ~ x", { y: [1, 2, 2.9, 4.2, 5], x: [1, 2, 3, 4, 5] }).coefficients;
* ```
*
* @category Regression
*/
export declare function rlm(formula: string, data: DataFrame, options?: RlmOptions): RlmResult;
/** Coefficient table of a robust fit. Equivalent to R's `summary.rlm()`.
*
* @param fit A fit returned by {@link rlm}.
* @returns Coefficients, standard errors and t statistics.
*
* @example
* ```ts
* rlmSummary(rlm("y ~ x", { y: [1, 2, 2.9, 4.2, 5], x: [1, 2, 3, 4, 5] }));
* ```
*
* @category Regression
*/
export declare function rlmSummary(fit: RlmResult, options?: Record<string, never>): RlmSummaryResult;
/** Covariance matrix of robust-regression coefficients. Equivalent to R's `vcov.rlm()`.
*
* @param fit A fit returned by {@link rlm}.
* @returns The covariance matrix in coefficient order.
*
* @example
* ```ts
* rlmVcov(rlm("y ~ x", { y: [1, 2, 2.9, 4.2, 5], x: [1, 2, 3, 4, 5] }));
* ```
*
* @category Regression
*/
export declare function rlmVcov(fit: RlmResult, options?: Record<string, never>): RlmVcovResult;
