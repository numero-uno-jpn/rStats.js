import type { MatrixInput } from "../linalg/matrix.js";
import type { DataFrame } from "./modelFrame.js";
/** Estimator for the between-study variance.
 * @category Meta-analysis
 */
export type MetaMethod = "EE" | "FE" | "DL" | "HE" | "HS" | "HSk" | "SJ" | "ML" | "REML" | "EB" | "PM";
/** Inference method for model coefficients.
 * @category Meta-analysis
 */
export type MetaTest = "z" | "t" | "knha";
/** Effect-size measure supported by {@link escalc}.
 * @category Meta-analysis
 */
export type EscalcMeasure = "RR" | "OR" | "RD" | "MD" | "SMD" | "ZCOR";
/** Options for {@link escalc}.
 * @category Meta-analysis
 */
export interface EscalcOptions {
    ai?: readonly number[];
    bi?: readonly number[];
    ci?: readonly number[];
    di?: readonly number[];
    m1i?: readonly number[];
    sd1i?: readonly number[];
    n1i?: readonly number[];
    m2i?: readonly number[];
    sd2i?: readonly number[];
    n2i?: readonly number[];
    ri?: readonly number[];
    ni?: readonly number[];
    add?: number;
    to?: "only0" | "all" | "if0all" | "none";
    drop00?: boolean;
}
/** Study-level estimates returned by {@link escalc}.
 * @category Meta-analysis
 */
export interface EscalcResult {
    yi: number[];
    vi: number[];
    measure: EscalcMeasure;
    warnings: string[];
}
/** Iteration controls for {@link rma}.
 * @category Meta-analysis
 */
export interface RmaControl {
    tau2Init?: number;
    threshold?: number;
    maxiter?: number;
    stepadj?: number;
    tol?: number;
    tau2Max?: number;
}
/** A moderator matrix with optional column and row names.
 * @category Meta-analysis
 */
export interface ModeratorMatrix extends Record<string, unknown> {
    rows?: readonly (readonly number[])[];
    columns?: readonly (readonly number[])[];
    dim?: readonly number[];
    rowNames?: readonly string[] | string | null;
    colNames?: readonly string[] | string | null;
}
/** Options for {@link rma}.
 * @category Meta-analysis
 */
export interface RmaOptions {
    method?: MetaMethod;
    mods?: MatrixInput | readonly number[] | string | ModeratorMatrix;
    data?: DataFrame;
    intercept?: boolean;
    test?: MetaTest;
    level?: number;
    control?: RmaControl;
}
/** A numeric matrix with its dimensions and dimnames.
 * @category Meta-analysis
 */
export interface NumericMatrix extends Record<string, unknown> {
    dim: number[];
    rowNames: string | string[] | null;
    colNames: string | string[] | null;
    rows: number[][];
}
/** Fitted meta-analysis model returned by {@link rma}.
 * @category Meta-analysis
 */
export interface RmaResult {
    beta: NumericMatrix;
    se: number | number[];
    zval: number | number[];
    pval: number | number[];
    "ci.lb": number | number[];
    "ci.ub": number | number[];
    tau2: number;
    "se.tau2": number;
    QE: number;
    QEp: number;
    QM: number;
    QMp: number;
    R2: number | null;
    p: number;
    m: number;
    I2: number;
    H2: number;
    k: number;
    yi: number[];
    vi: number[];
    mods: number[][];
    intercept: boolean;
    method: MetaMethod;
    test: MetaTest;
    level: number;
    warnings: string[];
    covariance: number[][];
    tau2Null: number;
}
/** Options for {@link confintRma}.
 * @category Meta-analysis
 */
export interface ConfintRmaOptions {
    type?: "QP" | "PL";
    level?: number;
}
/** Options for {@link predictRma}.
 * @category Meta-analysis
 */
export interface PredictRmaOptions {
    newmods?: MatrixInput | readonly number[];
    predtype?: "default" | "riley";
    level?: number;
}
/** Options for {@link regtest}.
 * @category Meta-analysis
 */
export interface RegtestOptions {
    model?: "rma" | "lm";
    predictor?: "sei" | "vi" | "ninv";
    retFit?: boolean;
    level?: number;
}
/**
 * Computes study-level effect sizes and sampling variances. Equivalent to `metafor::escalc()` in R.
 *
 * @param measure One of RR, OR, RD, MD, SMD or ZCOR.
 * @param options Study-level counts, means, standard deviations, sample sizes or correlations.
 * @returns The estimates yi and sampling variances vi.
 * @category Meta-analysis
 */
export declare function escalc(measure: EscalcMeasure, options: EscalcOptions): EscalcResult;
/**
 * Fits an equal-effects or random-effects meta-analysis, including meta-regression. Equivalent to `metafor::rma.uni()` in R.
 *
 * @param yi Study effect estimates, or the result of {@link escalc}.
 * @param vi Sampling variances (omitted when yi is an escalc result).
 * @param options Estimator, moderators, inference and iteration controls.
 * @returns Coefficients, heterogeneity statistics, tests and model metadata.
 * @category Meta-analysis
 */
export declare function rma(yi: readonly number[] | EscalcResult, viOrOptions?: readonly number[] | RmaOptions, maybeOptions?: RmaOptions): RmaResult;
/** Computes heterogeneity confidence intervals. Equivalent to `metafor::confint.rma()` in R.
 * @category Meta-analysis
 */
export declare function confintRma(object: RmaResult, options?: ConfintRmaOptions): {
    random: {
        dim: number[];
        rowNames: string[];
        colNames: string[];
        rows: {
            estimate: number;
            "ci.lb": number;
            "ci.ub": number;
        }[];
    };
    digits: Record<string, string>;
    "ci.null": boolean;
    "lb.sign": string;
    "ub.sign": string;
    "tau2.min": string;
};
/** Predicts the mean effect and its prediction interval at moderator values. Equivalent to `metafor::predict.rma()` in R.
 * @category Meta-analysis
 */
export declare function predictRma(object: RmaResult, options?: PredictRmaOptions): {
    pred: number | number[];
    se: number | number[];
    "ci.lb": number | number[];
    "ci.ub": number | number[];
    "pi.lb": number | number[];
    "pi.ub": number | number[];
};
/** Tests for funnel-plot asymmetry using a regression model. Equivalent to `metafor::regtest()` in R.
 * @category Meta-analysis
 */
export declare function regtest(x: readonly number[] | RmaResult, viOrOptions?: readonly number[] | RegtestOptions, maybeOptions?: RegtestOptions): {
    model: string;
    predictor: string;
    zval: number;
    pval: number;
    dfs: number;
    est: number;
    "ci.lb": number;
    "ci.ub": number;
    warnings: string[];
    fit?: RmaResult;
};
