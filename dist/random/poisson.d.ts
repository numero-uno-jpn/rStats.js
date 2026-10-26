/** One Poisson variate (mean mu) */
export declare function rpois1(mu: number): number;
/**
 * Random numbers from the Poisson distribution. Equivalent to R's `rpois()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param lambda Mean.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 */
export declare function rpois(n: number, lambda: number): number[];
/**
 * Random numbers from the geometric distribution (number of failures before the first
 * success). Equivalent to R's `rgeom()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param prob Probability of success in each trial, in (0, 1].
 * @returns An array of `n` values; `NaN` for invalid parameters.
 */
export declare function rgeom(n: number, prob: number): number[];
/**
 * Random numbers from the negative binomial distribution. Equivalent to R's `rnbinom()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param size Target number of successes (dispersion parameter; need not be an integer).
 * @param options.prob Probability of success in each trial. Give exactly one of `prob` and `mu`.
 * @param options.mu Mean (alternative parametrization). Give exactly one of `prob` and `mu`.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 * @throws TypeError unless exactly one of `prob` and `mu` is given.
 */
export declare function rnbinom(n: number, size: number, options: {
    prob?: number;
    mu?: number;
}): number[];
