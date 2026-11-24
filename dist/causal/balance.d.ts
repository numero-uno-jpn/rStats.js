import type { MatchResult } from "./match.js";
import type { WeightitEstimand, WeightitResult } from "./weightit.js";
/**
 * The weight of each unit after matching: every pair adds its weight `1 / M` to both of its units; unmatched units
 * weigh 0. Equivalent to `cobalt::get.w()` in R. The call followed is `get.w(m)` for a `Match` object `m`.
 * @category Causal inference
 * @example
 * ```ts
 * matchWeights(match([1, 0, 1, 0, 0], [0.2, 0.1, 1.5, 1.4, 3])); // [1, 1, 1, 1, 0]
 * ```
 */
export declare function matchWeights(m: MatchResult): number[];
/** Options of {@link balTab}. Equivalent to the arguments of cobalt's `bal.tab()` for a `Match` or `weightit` object.
 * @category Causal inference
 */
export interface BalTabOptions {
    /**
     * The result of {@link match}: gives the weights ({@link matchWeights}), the estimand and, with a caliper, the
     * discarded units. Alternative to `weights` and `estimand`.
     */
    match?: MatchResult;
    /**
     * The result of {@link weightit}: gives the weights, the estimand and the propensity score (the first row,
     * `"prop.score"`, when the method has one). Alternative to `match`, `weights` and `estimand`.
     */
    weightit?: WeightitResult;
    /** The weights after matching or weighting; without them only the unadjusted columns are filled. */
    weights?: readonly number[];
    /** The estimand, which chooses the SD of the denominator (default `"ATT"`); `"ATO"` needs the weights. */
    estimand?: WeightitEstimand;
    /** The order of the levels of string covariates (R's factor levels); default code-point order. */
    levels?: Readonly<Record<string, readonly string[]>>;
    /** Binary covariates: `"raw"` difference in proportions (default, as cobalt) or `"std"` standardised. */
    binary?: "raw" | "std";
}
/** Result of {@link balTab}: one entry per covariate, in the order given (cobalt's `Balance` table), and the counts.
 * @category Causal inference
 */
export interface BalTabResult {
    /** Covariate names (`"prop.score"` first for a weightit result with a score; a string covariate gives a row
     * `name_level` per level, one row for the second level when it has two). */
    rows: string[];
    /** `"Distance"` (the propensity score), `"Contin."` or `"Binary"` (two distinct values, 0 and 1). */
    type: ("Distance" | "Contin." | "Binary")[];
    /** Difference treated − control before matching: standardised (continuous, or binary with `binary: "std"`) or raw. */
    diffUn: number[];
    /** The same after matching (weighted); NaN without weights. */
    diffAdj: number[];
    /** Variance ratio treated / control before matching (NaN for binary covariates). */
    vRatioUn: number[];
    /** The same after matching, with weighted variances; NaN for binary covariates or without weights. */
    vRatioAdj: number[];
    /**
     * Sample sizes of the control and treated groups (cobalt's `Observations`): all (effective sample size, the same as
     * the count), all (unweighted), matched (effective sample size `(sum w)^2 / sum w^2`), matched (unweighted:
     * `w > 0`), unmatched (`w = 0`) and, when `match` has a caliper, discarded (its `indexDropped`, not counted as unmatched). The
     * matched rows are NaN without weights. For a weightit result: unadjusted (the count)
     * and adjusted (the effective sample size).
     */
    observations: {
        /** Row names, in the order of the counts. */
        rows: string[];
        /** Counts of the control group. */
        control: number[];
        /** Counts of the treated group. */
        treated: number[];
    };
}
/**
 * Covariate balance of two groups before and after matching or weighting: standardised mean differences and variance
 * ratios. Equivalent to `cobalt::bal.tab()` in R. The calls followed are
 * `bal.tab(m, formula = tr ~ ..., data, un = TRUE, disp.v.ratio = TRUE, binary)` for a `Match` object `m` and
 * `bal.tab(w, stats = c("mean.diffs", "variance.ratios"), un = TRUE, binary)` for a `weightit` object `w`.
 *
 * The difference is `(mean treated − mean control) / s`, with means weighted after adjustment. The SD `s` is the same
 * before and after: of the unadjusted treated for ATT, of the unadjusted controls for ATC, `sqrt((s1² + s0²) / 2)` for
 * ATE; for ATO that of the whole sample weighted by the (overlap) weights (weighted variance with divisor
 * `sum w − sum w² / sum w`). For a binary covariate (with `binary: "std"`) `p(1 − p)` takes the place of the variance.
 * As cobalt, an SD below sqrt(eps) ≈ 1.5e-8 (in the covariate's units) is replaced by that of the whole sample.
 * Variance ratios are treated / control. A string covariate is a factor: one binary row per level.
 * @category Causal inference
 * @example
 * ```ts
 * const tr = [1, 0, 1, 0, 0, 1, 0, 0];
 * const age = [52, 40, 61, 58, 33, 47, 50, 45];
 * const m = match(tr, [0.4, -0.9, 1.2, 1.0, -1.5, 0.1, 0.3, -0.2]);
 * const b = balTab(tr, { age }, { match: m });
 * b.diffUn; // [1.1464120051932525]
 * b.diffAdj; // [0.32888869001445803]
 * ```
 */
export declare function balTab(tr: readonly (number | boolean)[], covariates: Readonly<Record<string, readonly number[] | readonly string[]>>, options?: BalTabOptions): BalTabResult;
/** Options of {@link tableOneSmd}.
 * @category Causal inference
 */
export interface TableOneSmdOptions {
    /** Treat `x` as categorical (tableone's `factorVars`): numbers or strings as levels. Default false. */
    factor?: boolean;
}
/**
 * Standardised mean difference of one variable between two groups. Equivalent to `tableone::ExtractSmd()` in R. The
 * call followed is `ExtractSmd(CreateTableOne(vars, strata, data, factorVars))` with two groups. Missing values (`NaN`,
 * `null`) are left out.
 *
 * Numeric: `|mean1 − mean0| / sqrt((s1² + s0²) / 2)` with the groups' SDs (divisor `n − 1`). Categorical
 * (`factor: true`): Yang and Dalton's `sqrt(d' S⁻¹ d)`, `d` the differences of the proportions of the levels after the
 * first, `S` the mean of the two groups' multinomial covariance matrices `p_k (δ_kl − p_l)`; with two levels
 * `|p1 − p0| / sqrt((p1(1 − p1) + p0(1 − p0)) / 2)`. 0 when both the difference and the spread are 0. When `S` is
 * singular (a level in one group only) the generalised inverse is used, as tableone; when `S` is 0 (one level in each
 * group) the result is NaN, as tableone.
 * @category Causal inference
 * @example
 * ```ts
 * tableOneSmd([1, 2, 3, 2, 5, 4], [0, 0, 0, 1, 1, 1]); // 1.2909944487358056
 * tableOneSmd(["a", "b", "a", "b", "b", "b"], [0, 0, 0, 1, 1, 1], { factor: true }); // 2
 * ```
 */
export declare function tableOneSmd(x: readonly (number | string | null)[], group: readonly (number | string | boolean)[], options?: TableOneSmdOptions): number;
