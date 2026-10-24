/** Result of {@link distSummary}. */
export interface DistSummary {
    mean: number;
    variance: number;
    sd: number;
    median: number;
    mode: number;
    skewness: number;
    /** Excess kurtosis (0 for the normal distribution). */
    kurtosis: number;
}
/** Distributions known to {@link distSummary} (the names of their d/p/q/r functions). */
export type DistName = "norm" | "lnorm" | "unif" | "exp" | "gamma" | "chisq" | "beta" | "t" | "f" | "cauchy" | "weibull" | "logis" | "binom" | "pois" | "geom" | "nbinom" | "hyper" | "invgamma" | "kumar" | "pareto" | "triang" | "laplace" | "arcsine";
/**
 * Mean, variance, standard deviation, median, mode, skewness and excess kurtosis of a distribution, given by the
 * name of its d/p/q/r functions and their parameters (with the same names and defaults; `gamma` takes `rate` or
 * `scale`, `nbinom` takes `prob` or `mu`). Invalid parameters give NaN throughout.
 *
 * @example
 * ```ts
 * distSummary("gamma", { shape: 2.5, rate: 2 }); // { mean: 1.25, variance: 0.625, ..., mode: 0.75, kurtosis: 2.4 }
 * distSummary("binom", { size: 9, prob: 0.5 }).mode; // 5 (4 and 5 are equally likely: the larger)
 * ```
 */
export declare function distSummary(distribution: DistName, params?: Record<string, number | undefined>): DistSummary;
