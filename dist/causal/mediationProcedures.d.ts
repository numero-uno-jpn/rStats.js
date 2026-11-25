import type { DataFrame } from "../models/modelFrame.js";
import { type MediateResult, type MediationModel } from "./mediate.js";
/**
 * Options for {@link sobelTest} and {@link mediationMonteCarlo}.
 *
 * @category Causal inference
 */
export interface SobelTestOptions {
    /** The treatment (a coefficient of both models). */
    treat: string;
    /** The mediator (the mediator model's response, a coefficient of the outcome model). */
    mediator: string;
}
/**
 * Result of {@link sobelTest}.
 *
 * @category Causal inference
 */
export interface SobelTestResult {
    /** The treatment's coefficient in the mediator model. */
    a: number;
    /** Its standard error. */
    sa: number;
    /** The mediator's coefficient in the outcome model. */
    b: number;
    /** Its standard error. */
    sb: number;
    /** The indirect effect a b. */
    ab: number;
    /** Its standard error sqrt(b² sa² + a² sb²). */
    se: number;
    /** The z statistic a b / se. */
    z: number;
    /** The two-sided p-value. */
    p: number;
}
/**
 * The Sobel test of the indirect effect a b (the product of the treatment's coefficient in the mediator model and the
 * mediator's in the outcome model), as ReactiveStat computes it: SE = sqrt(b² sa² + a² sb²), z = a b / SE, p from the
 * normal distribution. Not an R function. ReactiveStat computes it from the two models' coefficients.
 *
 * @param modelM The mediator model (a formula fit of {@link lm} or {@link glm}).
 * @param modelY The outcome model.
 * @param options See {@link SobelTestOptions}.
 * @returns See {@link SobelTestResult}.
 * @throws RangeError if a model lacks the coefficient.
 *
 * @example
 * ```ts
 * const data = {
 *   X: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1], C: [1.2, -0.4, 0.3, 0.8, -1.1, 0.5, -0.2, 1.4, -0.7, 0.1],
 *   M: [1.1, 0.4, 0.9, 1.6, 0.2, 1.9, 1.3, 2.6, 1.0, 1.8], Y: [2.0, 1.1, 1.5, 2.4, 0.8, 3.1, 2.2, 3.9, 1.9, 2.8],
 *   W: [3.1, 2.2, 4.0, 2.8, 3.5, 2.9, 3.8, 2.4, 3.3, 4.2],
 * };
 * const s = sobelTest(lm("M ~ X", data), lm("Y ~ X + M", data), { treat: "X", mediator: "M" });
 * s.ab; // 1.0713
 * s.z; // 2.3529
 * s.p; // 0.018628
 * ```
 *
 * @category Causal inference
 */
export declare function sobelTest(modelM: MediationModel, modelY: MediationModel, options: SobelTestOptions): SobelTestResult;
/**
 * One Monte Carlo quantity: the estimate from the fitted coefficients, the interval and the draws.
 *
 * @category Causal inference
 */
export interface MonteCarloEffect {
    /** The estimate (from the fitted coefficients, or as mediate's). */
    estimate: number;
    /** The confidence interval (type-7 quantiles of the draws). */
    ci: [number, number];
    /** The draws. */
    sims: number[];
}
/**
 * Options for {@link mediationMonteCarlo}.
 *
 * @category Causal inference
 */
export interface MediationMonteCarloOptions extends SobelTestOptions {
    /** Number of draws (default 20000, as ReactiveStat). */
    nmc?: number;
    /** Confidence level (default 0.95). */
    confLevel?: number;
}
/**
 * Result of {@link mediationMonteCarlo}: effects per unit of the treatment.
 *
 * @category Causal inference
 */
export interface MediationMonteCarloResult {
    /** The indirect effect a b. */
    indirect: MonteCarloEffect;
    /** The direct effect c'. */
    direct: MonteCarloEffect;
    /** The total effect a b + c'. */
    total: MonteCarloEffect;
    /** The proportion mediated a b / (a b + c'). */
    proportion: MonteCarloEffect;
}
/**
 * The Monte Carlo method on the coefficients for a mediation with continuous mediator and outcome, as ReactiveStat
 * computes it: a is drawn by `rnorm(nmc, a, sa)`, then (b, c') of the outcome model by `mvrnorm` with their 2 x 2
 * covariance; the intervals are type-7 quantiles. With the same {@link setSeed} the draws equal R's
 * (`set.seed(...); rnorm(...); MASS::mvrnorm(...)`). Not an R function. ReactiveStat composes it from `rnorm` and
 * `mvrnorm`.
 *
 * @param modelM The mediator model.
 * @param modelY The outcome model.
 * @param options See {@link MediationMonteCarloOptions}.
 * @returns See {@link MediationMonteCarloResult}.
 * @throws RangeError if a model lacks the coefficients or `confLevel` is outside (0, 1).
 *
 * @example
 * ```ts
 * const data = {
 *   X: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1], C: [1.2, -0.4, 0.3, 0.8, -1.1, 0.5, -0.2, 1.4, -0.7, 0.1],
 *   M: [1.1, 0.4, 0.9, 1.6, 0.2, 1.9, 1.3, 2.6, 1.0, 1.8], Y: [2.0, 1.1, 1.5, 2.4, 0.8, 3.1, 2.2, 3.9, 1.9, 2.8],
 *   W: [3.1, 2.2, 4.0, 2.8, 3.5, 2.9, 3.8, 2.4, 3.3, 4.2],
 * };
 * setSeed(1234);
 * mediationMonteCarlo(lm("M ~ X", data), lm("Y ~ X + M", data), { treat: "X", mediator: "M" }).indirect.ci; // [0.19969, 1.9643]
 * ```
 *
 * @category Causal inference
 */
export declare function mediationMonteCarlo(modelM: MediationModel, modelY: MediationModel, options: MediationMonteCarloOptions): MediationMonteCarloResult;
/**
 * Options for {@link moderatedMediation}.
 *
 * @category Causal inference
 */
export interface ModeratedMediationOptions extends SobelTestOptions {
    /** The moderator W (a numeric variable of both models). */
    moderator: string;
    /** The treated value (default: the larger value of a binary treatment, else its mean + SD). */
    treatValue?: number;
    /** The control value (default: the smaller value of a binary treatment, else its mean − SD). */
    controlValue?: number;
    /** The moderator's low value (default: the smaller value of a binary moderator, else its mean − SD). */
    wLow?: number;
    /** The moderator's high value (default: the larger value of a binary moderator, else its mean + SD). */
    wHigh?: number;
    /**
     * `"monteCarlo"` (draws of all the coefficients of both models) or `"mediate"` ({@link mediate} at the two moderator
     * values on the same random stream). Default: `"monteCarlo"` when both models are linear, else `"mediate"`, as
     * ReactiveStat.
     */
    method?: "monteCarlo" | "mediate";
    /** Number of Monte Carlo draws (default 20000). */
    nmc?: number;
    /** Number of simulations of {@link mediate} (default 1000). */
    sims?: number;
    /** Confidence level (default 0.95). */
    confLevel?: number;
    /** HC3 covariances in {@link mediate} (default `false`). */
    robustSE?: boolean;
}
/**
 * Result of {@link moderatedMediation}.
 *
 * @category Causal inference
 */
export interface ModeratedMediationResult {
    /** The method used. */
    method: "monteCarlo" | "mediate";
    /** The moderator's low value. */
    wLow: number;
    /** The moderator's high value. */
    wHigh: number;
    /** The treated value. */
    treatValue: number;
    /** The control value. */
    controlValue: number;
    /** The indirect effect (ACME; with `mediate`, the average of d0 and d1) at the low moderator value. */
    indirectLow: MonteCarloEffect;
    /** The indirect effect at the high moderator value. */
    indirectHigh: MonteCarloEffect;
    /** The direct effect (ADE) at the low moderator value. */
    directLow: MonteCarloEffect;
    /** The direct effect at the high moderator value. */
    directHigh: MonteCarloEffect;
    /** The total effect at the low moderator value. */
    totalLow: MonteCarloEffect;
    /** The total effect at the high moderator value. */
    totalHigh: MonteCarloEffect;
    /** The index of moderated mediation: the indirect effect at the high value minus that at the low value. */
    index: MonteCarloEffect;
    /** With `method: "mediate"`, the {@link mediate} result at the low moderator value. */
    low?: MediateResult;
    /** With `method: "mediate"`, the {@link mediate} result at the high moderator value. */
    high?: MediateResult;
}
/**
 * Moderated mediation with the index of moderated mediation, as ReactiveStat computes it: the indirect (ACME), direct
 * (ADE) and total effects at a low and a high value of a moderator W that enters both models.
 *
 * With `method: "monteCarlo"` (linear models) all coefficients of both models are drawn by {@link mvrnorm}, the mediator
 * model's first, and ACME(w) = (t1 − t0)(a1 + a3 w)(b1 + b3 w), ADE(w) = (t1 − t0)(c1 + c3 w), where a3, b3 and c3 are
 * the interactions of the treatment and the mediator with W (0 when absent); the estimates come from the fitted
 * coefficients. These draws are in 4 or more dimensions, where rStats.js's eigenvector signs may differ from R's, so the
 * intervals agree with R's statistically, not digit for digit. With `method: "mediate"`, {@link mediate} is run at
 * W = wLow and W = wHigh (R's `covariates`) from the same generator state, and the index's draws are the differences
 * of the average ACME draws; these equal R's under the same {@link setSeed}. Not an R function. ReactiveStat composes
 * it from `mvrnorm` or `mediate`.
 *
 * @param modelM The mediator model (with W, and the treatment × W interaction if any).
 * @param modelY The outcome model (with W, and the mediator × W and treatment × W interactions if any).
 * @param data The data both models were fitted on.
 * @param options See {@link ModeratedMediationOptions}.
 * @returns See {@link ModeratedMediationResult}.
 * @throws RangeError if a model lacks the coefficients, or for the errors of {@link mediate}.
 *
 * @example
 * ```ts
 * const data = {
 *   X: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1], C: [1.2, -0.4, 0.3, 0.8, -1.1, 0.5, -0.2, 1.4, -0.7, 0.1],
 *   M: [1.1, 0.4, 0.9, 1.6, 0.2, 1.9, 1.3, 2.6, 1.0, 1.8], Y: [2.0, 1.1, 1.5, 2.4, 0.8, 3.1, 2.2, 3.9, 1.9, 2.8],
 *   W: [3.1, 2.2, 4.0, 2.8, 3.5, 2.9, 3.8, 2.4, 3.3, 4.2],
 * };
 * const m = lm("M ~ X * W", data), y = lm("Y ~ X * W + M * W", data);
 * setSeed(1234);
 * const r = moderatedMediation(m, y, data, { treat: "X", mediator: "M", moderator: "W" });
 * r.index.estimate; r.index.ci;
 * ```
 *
 * @category Causal inference
 */
export declare function moderatedMediation(modelM: MediationModel, modelY: MediationModel, data: DataFrame, options: ModeratedMediationOptions): ModeratedMediationResult;
