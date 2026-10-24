/** One binomial variate (nin trials, success probability pp) */
export declare function rbinom1(nin: number, pp: number): number;
/**
 * Random numbers from the binomial distribution. Equivalent to R's `rbinom()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param size Number of trials.
 * @param prob Probability of success in each trial.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 */
export declare function rbinom(n: number, size: number, prob: number): number[];
/**
 * Random vectors from the multinomial distribution. Equivalent to R's `rmultinom()`.
 *
 * Unlike R, which returns a K x n matrix with one draw per column, this returns `n` rows
 * with one draw per row (the transpose of R's result). The random stream is the same as R's.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param size Number of objects distributed into the K categories in each draw.
 * @param prob Category weights of length K. They need not sum to 1 (they are divided by their sum).
 * @returns An array of `n` arrays, each of length K and summing to `size`.
 * @throws RangeError if `size` is not a non-negative integer, or `prob` has a negative or
 *   non-finite value, or no positive value.
 */
export declare function rmultinom(n: number, size: number, prob: readonly number[]): number[][];
