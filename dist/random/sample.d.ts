/**
 * Options for {@link sample} and {@link sampleInt}.
 *
 * @category Random numbers
 */
export interface SampleOptions {
    /**
     * Number of items to draw (truncated, as R; below 2^31 with `prob`). Default: the number of candidates (a random
     * permutation).
     */
    size?: number;
    /** Sample with replacement. Default `false`. */
    replace?: boolean;
    /** Weights for the candidates (need not sum to 1). Default: equal probabilities. */
    prob?: readonly number[];
}
/**
 * Random sample of integers from `0..n-1`. Equivalent to R's `sample.int()`. Unlike R, it is 0-based.
 *
 * The result is R's `sample.int(n, ...)` minus 1, so it can be used directly as array
 * indices. It consumes the same random numbers as R (default `sample.kind = "Rejection"`).
 *
 * @param n Number of candidates: a non-negative number up to 4.5e15 (2^52, as R); below 2^31 with `prob`, and for
 *   sampling without replacement more than n / 2 of them.
 * @param options See {@link SampleOptions}.
 * @returns The drawn integers, each in `0..n-1`.
 *
 * @example
 * ```ts
 * setSeed(42);
 * sampleInt(10, { size: 3 }); // [0, 4, 9]  (R: set.seed(42); sample.int(10, 3) - 1)
 * ```
 *
 * @category Random numbers
 */
export declare function sampleInt(n: number, options?: SampleOptions): number[];
/**
 * One draw at a time from 0..n-1 with replacement and weights `prob`: the same draws, from the same uniforms, as
 * consecutive elements of `sampleInt(n, { size, replace: true, prob })` (the method depends only on n and prob), with
 * the same checks of n and prob. For simulations that count draws without keeping them (internal; #287)
 */
export declare function sampleIntReplaceDrawer(n: number, prob: readonly number[]): () => number;
/**
 * Random sample of the elements of an array. Equivalent to R's `sample()`.
 *
 * Always samples from the elements of `x`. R's special case where a single number `x`
 * means `1:x` is not supported; use {@link sampleInt} for that. Uses the same random
 * numbers as R, so results match R for the same seed.
 *
 * @param x Candidates.
 * @param options See {@link SampleOptions}.
 * @returns The drawn elements of `x`.
 *
 * @example
 * ```ts
 * setSeed(42);
 * sample(["a", "b", "c", "d", "e"]); // ["a", "e", "d", "c", "b"]
 * sample([1, 2, 3], { size: 5, replace: true, prob: [0.5, 0.3, 0.2] });
 * ```
 *
 * @category Random numbers
 */
export declare function sample<T>(x: readonly T[], options?: SampleOptions): T[];
