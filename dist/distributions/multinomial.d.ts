/**
 * Options for {@link dmultinom}.
 *
 * @category Distributions
 */
export interface MultinomialOptions {
    /** Total number of objects; defaults to the sum of `x` (it must equal it, as in R). */
    size?: number;
    /** If `true`, return the log probability. Default `false`. */
    log?: boolean;
}
/**
 * Probability function of the multinomial distribution. Equivalent to R's
 * `dmultinom(x, size = NULL, prob, log = FALSE)`.
 *
 * @param x - Counts, a vector of K non-negative integers.
 * @param prob - Category weights, K finite non-negative numbers, not all 0 (divided by their sum).
 * @param options - `size` and `log` (see {@link MultinomialOptions}).
 * @returns The probability `N! / (x_1! ... x_K!) prod p_j^x_j` with `N = sum(x)`, or its log.
 * @throws RangeError if `x` and `prob` differ in length, `x` has a negative or non-integer value, `prob` has a
 *   negative or non-finite value or no positive value, or `size` differs from the sum of `x`.
 *
 * @example
 * ```ts
 * dmultinom([1, 2, 1], [0.2, 0.5, 0.3]);  // 0.18000000000000002
 * ```
 *
 * @category Distributions
 */
export declare function dmultinom(x: readonly number[], prob: readonly number[], options?: MultinomialOptions): number;
