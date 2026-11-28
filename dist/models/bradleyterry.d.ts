import type { DataFrame } from "./modelFrame.js";
/**
 * Options for {@link btm}.
 * @category Regression
 */
export interface BtmOptions {
    /** The outcome: two columns of wins (`[win1, win2]`, as `cbind(win1, win2)`) or one column, 1 when player1 won. */
    outcome: string | readonly [string, string];
    /** The column of the first player of each contest. */
    player1: string;
    /** The column of the second player. */
    player2: string;
    /**
     * The model of the abilities, without a response: `"~ .."` (default, one ability per player), `"~ .. + home"` (with
     * a contest-level variable from `contestCovariates`), or player covariates indexed by the player with random player
     * effects, `"~ x[..] + z[..] + (1 | ..)"` (fitted by PQL; the covariates in `predictors`).
     */
    formula?: string;
    /** Player covariates: one row per player, in the order of `levels`. */
    predictors?: DataFrame;
    /** The players in order (default: the sorted distinct players of both columns). */
    levels?: readonly string[];
    /** Contest-level variables specific to each player: name -> [column for player1, column for player2]. */
    contestCovariates?: Readonly<Record<string, readonly [string, string]>>;
    /** The reference player, whose ability is 0 (default the first level). */
    refcat?: string;
    /** The link (default `"logit"`). */
    link?: "logit" | "probit" | "cauchit";
}
/**
 * Result of {@link btm}.
 * @category Regression
 */
export interface BtmResult {
    /** The fixed coefficients. */
    coefficients: number[];
    /** Their names (`..B` for a player's ability, `x[..]` for a covariate, `..p03` for a separate ability). */
    coefNames: string[];
    /** Their standard errors. */
    stdError: number[];
    /** z = coefficient / standard error. */
    statistic: number[];
    /** The two-sided p-values of the z statistics. */
    pValue: number[];
    /** The covariance matrix of the fixed coefficients (varFix for PQL). */
    vcov: number[][];
    /** Deviance, null deviance and AIC of a model without random effects (NaN with random effects, as BTm). */
    deviance: number;
    /** The deviance of the model with all abilities 0 (NaN with random effects). */
    nullDeviance: number;
    /** Akaike's information criterion (NaN with random effects). */
    aic: number;
    /** The residual degrees of freedom: contests minus fixed coefficients. */
    dfResidual: number;
    /** The degrees of freedom of the null model: the number of contests. */
    dfNull: number;
    /** Iterations: of the glm, or of the outer PQL search. */
    iter: number;
    /** Whether the fit converged. */
    converged: boolean;
    /** The fitted probability that player1 wins, and the linear predictor (with the random effects). */
    fittedValues: number[];
    /** The linear predictor of each contest. */
    linearPredictors: number[];
    /** The players. */
    levels: string[];
    /** The reference player. */
    refcat: string;
    /** The link. */
    link: "logit" | "probit" | "cauchit";
    /** The standard deviation of the random player effects (null without them; 0 at the boundary). */
    sigma: number | null;
    /** The variance of sigma (null without random effects or at sigma = 0). */
    varSigma: number | null;
    /** The predicted random effects, one per player (null without them). */
    random: number[] | null;
    /** Players with a missing covariate, given an ability of their own. */
    separate: string[];
    /** R's warnings. */
    warnings: string[];
    /** How each player's ability is formed from the coefficients (for {@link btAbilities}). */
    abilityDesign: number[][];
}
/**
 * A Bradley-Terry model for paired comparisons: the probability that player1 beats player2 is
 * `link^-1(lambda_1 - lambda_2)`. With `"~ .."` each player has an ability (the reference's is 0) and the model is the
 * binomial glm without intercept on the +1 / -1 design of the two players; contest-level variables add their
 * difference. With player covariates and random player effects (`"~ x[..] + (1 | ..)"`) the abilities are
 * `x_j' beta + e_j`, `e ~ N(0, sigma^2)`, fitted by PQL to the fixed point where sigma maximizes the REML likelihood of
 * the working linear mixed model (BTm stops at its tolerance, about 1e-7 from it); sigma at the boundary 0 gives the
 * glm. A player with a missing covariate gets an ability of its own (as BTm).
 *
 * Equivalent to `BradleyTerry2::BTm()` in R.
 *
 * @param contests one row per contest, or per pair with the numbers of wins
 * @category Regression
 */
export declare function btm(contests: DataFrame, options: BtmOptions): BtmResult;
/**
 * Result of {@link btAbilities}.
 * @category Regression
 */
export interface BtAbilitiesResult {
    /** The players. */
    levels: string[];
    /** The ability of each player. */
    ability: number[];
    /** Standard errors (0 for the reference player). */
    se: number[];
    /** The covariance matrix of the abilities (a zero row for the reference). */
    vcov: number[][];
    /** Players whose ability was estimated separately (a missing covariate). */
    separate: string[];
}
/**
 * The abilities of the players of a Bradley-Terry model. They are the estimated abilities with the reference at 0,
 * or, for abilities modelled by player covariates, `x_j' beta` (without the random effects) with
 * standard errors from the covariance of beta; contest-level variables are taken as 0.
 *
 * Equivalent to `BradleyTerry2::BTabilities()` in R.
 * @category Regression
 */
export declare function btAbilities(fit: BtmResult): BtAbilitiesResult;
/**
 * Result of {@link countsToBinomial}.
 * @category Regression
 */
export interface CountsToBinomialResult {
    /** The first player of each pair. */
    player1: string[];
    /** The second player of each pair. */
    player2: string[];
    /** The wins of player1 over player2. */
    win1: number[];
    /** The wins of player2 over player1. */
    win2: number[];
}
/**
 * The wins of each pair of players from a table of wins. The rows of the table are the winners, the columns the
 * losers. One row per pair i < j (in the order of the levels) that met at least once.
 *
 * Equivalent to `BradleyTerry2::countsToBinomial()` in R.
 * @category Regression
 */
export declare function countsToBinomial(table: readonly (readonly number[])[], levels: readonly string[]): CountsToBinomialResult;
/**
 * Result of {@link qvcalc}.
 * @category Regression
 */
export interface QvcalcResult {
    /** The levels. */
    names: string[];
    /** The estimates. */
    estimate: number[];
    /** Their standard errors. */
    se: number[];
    /** The quasi standard errors. */
    quasiSE: number[];
    /** The quasi variances. */
    quasiVar: number[];
    /** Relative errors of the quasi standard errors of the simple contrasts (pairs "A,B", ...). */
    relerrs: number[];
    /** The pairs of the relative errors, "A,B", ... */
    relerrsNames: string[];
    /** The covariance matrix used. */
    covmat: number[][];
}
/**
 * Quasi variances (Firth 2003). They are the q_j minimizing `sum_{i<j} (log(q_i + q_j) - log var(b_i - b_j))^2`,
 * so that `q_i + q_j` approximates the variance of every simple contrast. Accepts the abilities of a Bradley-Terry
 * model or estimates with their covariance matrix.
 *
 * Equivalent to `qvcalc::qvcalc()` in R.
 * @category Regression
 */
export declare function qvcalc(object: BtAbilitiesResult | {
    estimate: readonly number[];
    vcov: readonly (readonly number[])[];
    names?: readonly string[];
}): QvcalcResult;
/**
 * The worst relative errors of the quasi standard errors over all contrasts. They are the square roots
 * of the extreme eigenvalues of `(C'VC)^-1 C'QC` minus 1, over a basis C of the contrasts, Q = diag(quasiVar).
 *
 * Equivalent to `qvcalc::worstErrors()` in R.
 * @category Regression
 */
export declare function worstErrors(qv: QvcalcResult): [number, number];
