import { type LmFormulaResult } from "../models/lm.js";
import { type GlmFormulaResult } from "../models/glm.js";
import type { DataFrame } from "../models/modelFrame.js";
/**
 * A model for {@link mediate}: a formula fit of {@link lm}, or of {@link glm} with the binomial family and the logit or
 * probit link.
 *
 * @category Causal inference
 */
export type MediationModel = LmFormulaResult | GlmFormulaResult;
/**
 * Options for {@link mediate}.
 *
 * @category Causal inference
 */
export interface MediateOptions {
    /** The treatment: a numeric variable of both models. */
    treat: string;
    /** The mediator: the mediator model's response and a numeric variable of the outcome model. */
    mediator: string;
    /** The treatment's value for the treated condition (default 1). */
    treatValue?: number;
    /** The treatment's value for the control condition (default 0). */
    controlValue?: number;
    /** Covariates held at the given values in every observation's prediction (R's `covariates`); numeric variables. */
    covariates?: Record<string, number>;
    /** Number of simulations or bootstrap replicates (default 1000). */
    sims?: number;
    /** Nonparametric bootstrap instead of the quasi-Bayesian approximation (default `false`). */
    boot?: boolean;
    /** The bootstrap intervals: `"perc"` (percentile, the default) or `"bca"` (bias-corrected and accelerated). */
    bootCiType?: "perc" | "bca";
    /** Confidence level of the intervals (default 0.95). */
    confLevel?: number;
    /** Heteroskedasticity-consistent (HC3) covariances for the quasi-Bayesian draws (default `false`). */
    robustSE?: boolean;
}
/**
 * One effect of {@link mediate}: its estimate, interval, p-value and draws.
 *
 * @category Causal inference
 */
export interface MediateEffect {
    /** The estimate (R's `d0`, `z0`, `tau.coef`, ...). */
    estimate: number;
    /** The confidence interval (R's `d0.ci`, ...). */
    ci: [number, number];
    /** The two-sided p-value, `2 min(mean(draws > 0), mean(draws < 0))` (R's `d0.p`, ...). */
    p: number;
    /** The simulation or bootstrap draws (R's `d0.sims`, ...). */
    sims: number[];
}
/**
 * Result of {@link mediate}. `d` are the average causal mediation effects (ACME), `z` the average direct effects (ADE),
 * `n` the proportions mediated, `0` under control and `1` under treatment.
 *
 * @category Causal inference
 */
export interface MediateResult {
    /** ACME under control: the mean of Y(t0, M(t1)) − Y(t0, M(t0)). */
    d0: MediateEffect;
    /** ACME under treatment: the mean of Y(t1, M(t1)) − Y(t1, M(t0)). */
    d1: MediateEffect;
    /** ADE under control: the mean of Y(t1, M(t0)) − Y(t0, M(t0)). */
    z0: MediateEffect;
    /** ADE under treatment: the mean of Y(t1, M(t1)) − Y(t0, M(t1)). */
    z1: MediateEffect;
    /** The total effect: the mean of Y(t1, M(t1)) − Y(t0, M(t0)). */
    tau: MediateEffect;
    /** Proportion mediated under control, d0 / tau. */
    n0: MediateEffect;
    /** Proportion mediated under treatment, d1 / tau. */
    n1: MediateEffect;
    /** The average ACME, (d0 + d1) / 2. */
    dAvg: MediateEffect;
    /** The average ADE, (z0 + z1) / 2. */
    zAvg: MediateEffect;
    /** The average proportion mediated, (n0 + n1) / 2. */
    nAvg: MediateEffect;
    /** The treated value used. */
    treatValue: number;
    /** The control value used. */
    controlValue: number;
    /** Number of observations. */
    nobs: number;
    /** Number of simulations or replicates. */
    sims: number;
    /** Whether the bootstrap was used. */
    boot: boolean;
    /** The bootstrap interval type. */
    bootCiType: "perc" | "bca";
    /** The confidence level. */
    confLevel: number;
    /** Whether HC3 covariances were used (false with the bootstrap, which ignores them). */
    robustSE: boolean;
    /** Whether the outcome model has an interaction of the treatment and the mediator (R's `INT`). */
    INT: boolean;
    /** R's warnings. */
    warnings: string[];
}
/**
 * Causal mediation analysis for linear and binomial (logit or probit) mediator and outcome models. Equivalent to
 * `mediation::mediate()` in R.
 *
 * The average causal mediation effects (ACME, `d0` and `d1`), the average direct effects (ADE, `z0` and `z1`), the total
 * effect (`tau`) and the proportions mediated (`n0`, `n1`) with their averages, by the quasi-Bayesian Monte Carlo
 * approximation (the default) or the nonparametric bootstrap (`boot: true`), as in Imai, Keele and Tingley (2010).
 * With the same {@link setSeed} the draws, estimates, intervals and p-values equal R's: the parameters are drawn with
 * the symmetric square root of their covariance, then the mediator for every simulation and observation (normal errors
 * with the residual standard error for a linear mediator, binomial draws for a binary one).
 *
 * Quasi-Bayesian estimates are the means of the draws (the proportions mediated: their medians; `nAvg` the average of
 * the two medians); bootstrap estimates come from a final draw on the original data, after the replicates, as in R.
 * Intervals are quantiles of type 7 of the draws (with `bootCiType: "bca"`: the bias-corrected and accelerated levels,
 * the bias measured against the draws' mean and the acceleration from their skewness, as R).
 *
 * The models must be formula fits of {@link lm} or {@link glm} (binomial with logit or probit, or gaussian) on `data`,
 * on the same rows, without weights or offsets; the treatment and the mediator are numeric variables.
 *
 * @param modelM The mediator model (its response is the mediator).
 * @param modelY The outcome model (it includes the treatment and the mediator).
 * @param data The data both models were fitted on.
 * @param options See {@link MediateOptions}; `treat` and `mediator` are required.
 * @returns See {@link MediateResult}.
 * @throws TypeError or RangeError for unsupported models, data that do not reproduce the fits, a treatment or mediator
 *   that is not a numeric variable of the models, models on different rows, `sims` below 2, or
 *   `confLevel` outside (0, 1).
 *
 * @example
 * ```ts
 * const data = {
 *   X: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1], C: [1.2, -0.4, 0.3, 0.8, -1.1, 0.5, -0.2, 1.4, -0.7, 0.1],
 *   M: [1.1, 0.4, 0.9, 1.6, 0.2, 1.9, 1.3, 2.6, 1.0, 1.8], Y: [2.0, 1.1, 1.5, 2.4, 0.8, 3.1, 2.2, 3.9, 1.9, 2.8],
 *   W: [3.1, 2.2, 4.0, 2.8, 3.5, 2.9, 3.8, 2.4, 3.3, 4.2],
 * };
 * const m = lm("M ~ X + C", data), y = lm("Y ~ X + M + C", data);
 * setSeed(1234);
 * const r = mediate(m, y, data, { treat: "X", mediator: "M", sims: 500 });
 * r.d0.estimate; // 0.8851 (R: set.seed(1234); mediate(m, y, treat = "X", mediator = "M", sims = 500)$d0)
 * r.d0.ci; // [0.5261, 1.3011]
 * r.n0.estimate; // 0.7432
 * ```
 *
 * @category Causal inference
 */
export declare function mediate(modelM: MediationModel, modelY: MediationModel, data: DataFrame, options: MediateOptions): MediateResult;
