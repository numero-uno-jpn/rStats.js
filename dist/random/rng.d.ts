/**
 * Seeds the random number generator. Equivalent to R's `set.seed()`.
 *
 * Reproduces R's default generator, `RNGkind("Mersenne-Twister", "Inversion", "Rejection")`,
 * so every `r*` function and `sample`/`sampleInt` produce the same numbers as in R after
 * the same seed. As in R there is a single global stream shared by all functions; if no
 * seed is set, one is chosen from the clock or `crypto.getRandomValues`.
 *
 * @param seed A 32-bit integer. Fractions are truncated toward zero.
 * @throws RangeError if `seed` is not finite or does not fit in a 32-bit integer.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rnorm(3); // [-0.6264538107423324, 0.18364332422208224, -0.8356286124100472]
 * // R: set.seed(1); rnorm(3)
 * ```
 */
export declare function setSeed(seed: number): void;
/**
 * Returns a copy of the current generator state. Equivalent to reading R's `.Random.seed`.
 *
 * @returns 626 integers in the same layout as R's `.Random.seed` (the first element is the
 *   RNG kind code `10403`). Pass it to {@link setRandomSeed} to restore the state.
 */
export declare function getRandomSeed(): Int32Array;
/**
 * Restores a generator state. Equivalent to assigning R's `.Random.seed`.
 *
 * @param state 626 integers as returned by {@link getRandomSeed}, or copied from R's
 *   `.Random.seed`.
 * @throws RangeError if the state is not for the default RNG kind (`state[0]` must be `10403`).
 */
export declare function setRandomSeed(state: ArrayLike<number>): void;
/** One uniform on (0, 1) (R's unif_rand) */
export declare function unifRand(): number;
/** Uniform integer in [0, dn) (R's sample.kind = "Rejection") */
export declare function unifIndex(dn: number): number;
/** One standard normal variate (R's norm_rand; inversion, using two uniforms for resolution finer than 2^-27) */
export declare function normRand(): number;
/**
 * One standard exponential variate (R's exp_rand).
 * Ahrens & Dieter (1972) "Computer methods for sampling from the exponential and
 * normal distributions" (Comm. ACM 15): algorithm SA.
 */
export declare function expRand(): number;
