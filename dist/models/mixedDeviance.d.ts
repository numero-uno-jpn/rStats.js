import type { MixedModelStructure } from "./mixedStructure.js";
/** The penalised least-squares solution and the profiled deviance at a given θ. */
export interface ProfiledDeviance {
    /** The REML criterion (`reml` true) or the ML deviance −2 log L (`reml` false), profiled over β and σ. */
    deviance: number;
    /** The fixed effects β̂ that minimise the penalised residual sum of squares (one per column of X). */
    beta: number[];
    /** The spherical random effects û (one per column of Z). */
    u: number[];
    /** The random effects b = Λ_θ û. */
    b: number[];
    /** The residual sum of squares ‖y − Xβ̂ − ZΛ_θ û‖². */
    rss: number;
    /** The penalty ‖û‖². */
    ussq: number;
    /** The penalised residual sum of squares rss + ussq. */
    prss: number;
    /** log det(Λ_θ' Z'Z Λ_θ + I): twice the log determinant of its Cholesky factor L_θ. */
    logDetL: number;
    /** log det(X'X − X'ZΛ_θ (Λ_θ'Z'ZΛ_θ + I)⁻¹ Λ_θ'Z'X): twice the log determinant of R_X. */
    logDetRX: number;
    /** The derivative of `deviance` with respect to each element of θ (with `options.gradient`). */
    gradient?: number[];
    /** (R_X' R_X)⁻¹, p × p, array of rows (with `options.rxInverse`): the covariance of β̂ divided by σ². */
    rxInverse?: number[][];
}
/** What {@link profiledDeviance} computes beyond the deviance and the penalised least-squares solution. */
export interface ProfiledDevianceOptions {
    /** Also the gradient of the criterion with respect to θ (from the selected inverse of A). */
    gradient?: boolean;
    /** Also (R_X' R_X)⁻¹. */
    rxInverse?: boolean;
}
/**
 * The profiled deviance of a linear mixed model at `theta`, with the penalised least-squares solution
 * (oracle/lmer-behaviour.md, stage 1b; computed sparsely). Internal: not exported from the package.
 *
 * @param structure The structure from {@link mixedModelStructure}.
 * @param theta The covariance parameters (finite, of the length of `structure.theta`; values below the lower bounds
 *   are accepted).
 * @param reml Whether to return the REML criterion (true) or the ML deviance (false).
 * @param options What to compute besides: the gradient with respect to θ, (R_X' R_X)⁻¹.
 */
export declare function profiledDeviance(structure: MixedModelStructure, theta: readonly number[], reml: boolean, options?: ProfiledDevianceOptions): ProfiledDeviance;
