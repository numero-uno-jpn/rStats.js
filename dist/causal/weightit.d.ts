/** The estimand of {@link weightit}: the population whose average treatment effect the weights target.
 * @category Causal inference
 */
export type WeightitEstimand = "ATE" | "ATT" | "ATC" | "ATO";
/** The method of {@link weightit} (WeightIt's `method`; `"ps"` is an alias of `"glm"`).
 * @category Causal inference
 */
export type WeightitMethod = "glm" | "ps" | "cbps" | "ipt" | "ebal";
/** Options of {@link weightit}. Equivalent to the arguments of WeightIt's `weightit()`.
 * @category Causal inference
 */
export interface WeightitOptions {
    /** How the weights are estimated (default `"glm"`): see {@link weightit}. */
    method?: WeightitMethod;
    /** The link of the propensity score model: `"logit"` (default), `"probit"`, `"cauchit"` or `"cloglog"` for glm,
     * `"logit"` or `"probit"` for cbps, `"logit"` for ipt; ebal has none. */
    link?: "logit" | "probit" | "cauchit" | "cloglog";
    /** The estimand (default `"ATE"`). ipt and ebal do not allow `"ATO"`. */
    estimand?: WeightitEstimand;
    /** Multiply the weights by the share of the unit's group in the sample (glm with ATE only; ignored with a warning
     * by the other methods, an error with another estimand, as R). Default false. */
    stabilize?: boolean;
}
/** Result of {@link weightit}.
 * @category Causal inference
 */
export interface WeightitResult {
    /** The weights, one per unit, in the order of `tr`. */
    weights: number[];
    /** The propensity scores (null for ebal, which has none): for ipt the score of the tilting that weights the unit's
     * group (ATE), or of the weighted group for all units (ATT: the controls' tilting; ATC: the treated's). */
    ps: number[] | null;
    /** The treatment, 0 or 1 per unit. */
    treat: number[];
    /** The estimand. */
    estimand: WeightitEstimand;
    /** The method as R reports it (`"glm"` for `"ps"`). */
    method: "glm" | "cbps" | "ipt" | "ebal";
    /** The link (null for ebal). */
    link: string | null;
    /** Whether the weights were stabilised. */
    stabilized: boolean;
    /** The focal group of ATT (`1`) and ATC (`0`), null otherwise: its weights are 1. */
    focal: 0 | 1 | null;
    /** The columns of the model matrix after the intercept: the numeric covariates and, for a string covariate, one 0/1
     * column per level after the first (R's treatment contrasts, levels in code-point order). */
    columnNames: string[];
    /** Whether the estimation converged (the glm, or the solution of the balance conditions). */
    converged: boolean;
    /** R's warnings, each once. */
    warnings: string[];
}
/** A covariate: numbers, or strings (a factor with its levels in code-point order).
 * @category Causal inference
 */
export type CovariateColumn = readonly number[] | readonly string[];
/** The model matrix without its intercept: one column per numeric covariate, k - 1 indicator columns per factor */
export declare function covariateColumns(covariates: Readonly<Record<string, CovariateColumn>>, n: number): {
    names: string[];
    columns: number[][];
    factors: Record<string, string[]>;
};
/**
 * Balancing weights for a binary treatment. Equivalent to `WeightIt::weightit()` in R. The call followed is
 * `weightit(tr ~ covariates, data, method, link, estimand, stabilize)`.
 *
 * - `"glm"` (`"ps"`): the propensity score `p` of a binomial glm with the link, and the weights 1/p and 1/(1 − p)
 *   (ATE), 1 and p/(1 − p) (ATT), (1 − p)/p and 1 (ATC), 1 − p and p (ATO, the overlap weights).
 * - `"cbps"`: the just-identified covariate balancing propensity score: the score whose weights (the same formulas)
 *   make the weighted means of every covariate column equal in the two groups (ATT: the controls' to the treated's).
 * - `"ipt"`: inverse probability tilting, a logistic score per weighted group whose weights move the group's means to
 *   the target (ATE: the whole sample's). Not ATO.
 * - `"ebal"`: entropy balancing: the weights closest to uniform in entropy with the target means, summing to the
 *   target size. No propensity score; not ATO.
 *
 * cbps, ipt and ebal are solved exactly (Newton's method on the balance conditions); R stops its optimisers earlier, so
 * those weights agree with R's to about 1e-8 relative. A string covariate is a factor (levels in code-point order);
 * missing values are an error (R drops or imputes them depending on the method).
 * @category Causal inference
 * @example
 * ```ts
 * const tr = [1, 0, 1, 0, 0, 1, 0, 0, 1, 0];
 * const age = [52, 40, 61, 58, 33, 47, 50, 45, 39, 44];
 * const w = weightit(tr, { age }, { estimand: "ATE" });
 * w.ps[0]; // 0.48529828581084455
 * w.weights[0]; // 2.0605883623289194 (1 / ps for a treated unit)
 * ```
 */
export declare function weightit(tr: readonly (number | boolean)[], covariates: Readonly<Record<string, CovariateColumn>>, options?: WeightitOptions): WeightitResult;
/** Options of {@link trimWeights}. Equivalent to the arguments of WeightIt's `trim()`.
 * @category Causal inference
 */
export interface TrimWeightsOptions {
    /** Below 1: the quantile (type 3) of the weights at which they are capped (0.99 caps the top 1%; below 0.5 it is
     * read as 1 − `at`, as R); 1 or more: the number of largest weights set to the next largest (above half the units it
     * is read as the number of units less `at`; as many as the units or more: no trimming, with R's warning). */
    at: number;
    /** Also raise the weights below the quantile 1 − `at` (or the `at` smallest) to it. Default false. */
    lower?: boolean;
    /** For a plain vector of weights: the treatment (only informative with a focal group, which a vector has not). */
    treat?: readonly (number | boolean)[];
}
/**
 * Trims (winsorises) extreme weights: those above a quantile, and with `lower` those below the opposite one, are set to
 * it. Equivalent to `WeightIt::trim()` in R. The call followed is `trim(w, at, lower = TRUE)` for a weightit result or a
 * vector of weights.
 *
 * The quantile is R's type 3 of the weights that are not fixed by the estimand: all units for ATE and ATO, the controls
 * for ATT, the treated for ATC. The other weights do not change (no renormalisation). For a weightit result the
 * returned object is a copy with the trimmed weights.
 * @category Causal inference
 */
export declare function trimWeights(w: WeightitResult, options: TrimWeightsOptions): WeightitResult;
export declare function trimWeights(w: readonly number[], options: TrimWeightsOptions): number[];
/** One group's part of {@link weightSummary}.
 * @category Causal inference
 */
export interface WeightSummaryGroup {
    /** Smallest and largest weight. */
    range: [number, number];
    /** The (up to) 5 largest weights in increasing order; among equal weights the earliest units, as R lists them. */
    top: {
        /** The units (1-based). */
        index: number[];
        /** Their weights. */
        weights: number[];
    };
    /** Mean weight (R prints it for stabilised weights only). */
    mean: number;
    /** Coefficient of variation: SD (divisor n − 1) / mean. */
    coefOfVar: number;
    /** Mean absolute deviation of w / mean(w) from 1. */
    scaledMad: number;
    /** Mean of r log r, r = w / mean(w). */
    negativeEntropy: number;
    /** Number of zero weights (below 1e-10, as R counts them). */
    numZeros: number;
    /** Number of units. */
    n: number;
    /** Kish's effective sample size (sum w)² / sum w². */
    ess: number;
}
/** Result of {@link weightSummary}.
 * @category Causal inference
 */
export interface WeightSummaryResult {
    /** The treated group's summary. */
    treated: WeightSummaryGroup;
    /** The control group's summary. */
    control: WeightSummaryGroup;
    /** Whether the weights were stabilised (R shows the mean weights then). */
    stabilized: boolean;
}
/**
 * Summary of balancing weights by group: range, largest weights, coefficient of variation, scaled MAD, negative
 * entropy, zeros and Kish's effective sample size. Equivalent to `WeightIt::summary.weightit()` in R.
 * @category Causal inference
 */
export declare function weightSummary(w: WeightitResult): WeightSummaryResult;
