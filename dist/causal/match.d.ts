/** The population the matching estimates for: the treated (ATT), everyone (ATE) or the controls (ATC).
 * @category Causal inference
 */
export type MatchEstimand = "ATT" | "ATE" | "ATC";
/** Options of {@link match}. Equivalent to the arguments of the Matching package's `Match()` with `ties = FALSE` and
 * `replace = FALSE`.
 * @category Causal inference
 */
export interface MatchOptions {
    /** The estimand (default `"ATT"`): the treated units are matched (ATT), the controls (ATC), or both (ATE). */
    estimand?: MatchEstimand;
    /** The number of matches for each matched unit (default 1), a positive integer. */
    M?: number;
    /**
     * The caliper in standard deviations of `x` (the SD with divisor n over all units, as R's `ecaliper`): a match
     * farther than `caliper * sd` is not made, and a unit with fewer than `M` controls within it is dropped.
     */
    caliper?: number;
}
/** Result of {@link match}. The fields are those of R's `Match` object, with 1-based row numbers.
 * @category Causal inference
 */
export interface MatchResult {
    /** Rows (1-based) of the treated unit of each pair. */
    indexTreated: number[];
    /** Rows (1-based) of the control unit of each pair. */
    indexControl: number[];
    /** Weight of each pair: `1 / M`. */
    weights: number[];
    /**
     * Rows (1-based) of the dropped units that appear in no pair (R's `index.dropped`), only when a caliper is given;
     * `null` otherwise or when none. Under ATE a dropped unit can still be another unit's match and is then not listed.
     * Without a caliper R lists none even when units are dropped (`ndrops` counts them).
     */
    indexDropped: number[] | null;
    /** The caliper as given (in standard deviations), `null` without one. */
    caliper: number | null;
    /** The caliper on the scale of `x` (R's `ecaliper`), `null` without one. */
    ecaliper: number | null;
    /** Number of units (R's `nobs`). */
    nobs: number;
    /** Number of matched units (R's `wnobs`: units that found their matches). */
    wnobs: number;
    /** Number of matched-for units left without matches, for either reason (R's `ndrops`). */
    ndrops: number;
    /** The estimand. */
    estimand: MatchEstimand;
    /** The number of matches per matched unit. */
    M: number;
    /**
     * Size of each candidate set from which matches were drawn at random (more candidates than needed at equal
     * distance), in the order of the draws. Empty when there were no ties; the pairs are then R's. With sets of 2 only
     * the pairs and the random numbers used are also R's; larger sets are broken by rStats.js's own rule (see
     * {@link match}).
     */
    tieSizes: number[];
    /** Warnings (R's, e.g. when no unit could be matched). */
    warnings: string[];
}
/**
 * Nearest-neighbour matching on a scalar score, without replacement and with random tie-breaking. Equivalent to
 * `Matching::Match()` in R. The call followed is
 * `Match(Tr = tr, X = x, estimand, M, caliper, ties = FALSE, replace = FALSE)`, used with the linear predictor
 * `logit(PS)` of a propensity score model.
 *
 * The matched units (the treated for ATT, the controls for ATC, all for ATE) are processed in data order. Each takes
 * its matches from the units of the other group not yet used: every available unit within the M-th smallest distance
 * is a candidate (within the caliper when one is given), and when there are more candidates than M, M of them are
 * drawn at random. A unit with fewer than M available candidates is dropped. Pairs are listed in the order of the
 * matched units, the controls of one treated unit (ATT) in row order.
 *
 * Random draws use rStats.js's generator (`setSeed`): one uniform `u` for each pick, and the candidate at 0-based
 * index `floor(k (1 - u))` among the `k` remaining (in row order) is taken. Without ties no random number is used and
 * the pairs are R's; with sets of two candidates the rule is R's (the second when `u < 0.5`). Known differences from
 * R: larger tie sets are broken differently (R's rule is not documented), and distances count as tied only when
 * exactly equal (R also treats distances within `distance.tolerance = 1e-5` as ties). `M` below 1 is an error (R
 * warns and uses 1).
 * @category Causal inference
 * @example
 * ```ts
 * const m = match([1, 0, 1, 0, 0], [0.2, 0.1, 1.5, 1.4, 3]);
 * m.indexTreated; // [1, 3]
 * m.indexControl; // [2, 4]
 * ```
 */
export declare function match(tr: readonly (number | boolean)[], x: readonly number[], options?: MatchOptions): MatchResult;
