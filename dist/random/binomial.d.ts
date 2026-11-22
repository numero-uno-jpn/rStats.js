/**
 * log(f(ix) / f(m)) for the binomial probabilities f with n trials and success probability p = 1 - q, m the integer
 * mode, by Stirling's formula (the final test of BTPE). The corrections of log m! and log (n - m)! enter with a plus
 * sign and those of log ix! and log (n - ix)! with a minus sign; R's rbinom.c adds all four (an error of up to about
 * 0.02 in the log near n p = 30), which changes some acceptances and so the stream from R's
 */
export declare function btpeLogRatio(n: number, p: number, q: number, m: number, ix: number): number;
/** One binomial variate (nin trials, success probability pp) */
export declare function rbinom1(nin: number, pp: number): number;
/**
 * Random numbers from the binomial distribution. Equivalent to R's `rbinom()`.
 *
 * For `size * min(prob, 1 - prob) >= 30` (algorithm BTPE) the stream can depart from R's: R's final acceptance test has
 * two Stirling corrections with the wrong sign, and here the signs are right (`setSeed(439); rbinom(1, 10000, 0.5)` is
 * 4879, R 5023). Below 30 (inversion) the stream is R's.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param size Number of trials.
 * @param prob Probability of success in each trial.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rbinom(5, 10, 0.5); // [4, 4, 5, 7, 4]
 * ```
 *
 * @category Random numbers
 */
export declare function rbinom(n: number, size: number, prob: number): number[];
/**
 * Random vectors from the multinomial distribution. Equivalent to R's `rmultinom()`.
 *
 * Unlike R, which returns a K x n matrix with one draw per column, this returns `n` rows
 * with one draw per row (the transpose of R's result). The random stream is the same as R's.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param size Number of objects distributed into the K categories in each draw (fractions are truncated, as in R).
 * @param prob Category weights of length K. They need not sum to 1 (they are divided by their sum).
 * @returns An array of `n` arrays, each of length K and summing to the truncated `size`.
 * @throws RangeError if the truncated `size` is negative or 2^31 or more, or `prob` has a negative or
 *   non-finite value, or no positive value.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rmultinom(2, 5, [0.2, 0.3, 0.5]); // [[0, 1, 4], [1, 3, 1]]
 * ```
 *
 * @category Random numbers
 */
export declare function rmultinom(n: number, size: number, prob: readonly number[]): number[][];
