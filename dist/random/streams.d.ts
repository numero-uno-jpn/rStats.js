/**
 * The start of the next stream of L'Ecuyer-CMRG: the state advanced by 2^127 steps.
 * Equivalent to R's `parallel::nextRNGStream()`.
 *
 * Streams started this way do not overlap for any practical length, so each parallel task
 * (a worker, or one replicate of a simulation) can be given its own stream, reproducibly.
 * Within a stream, {@link nextRNGSubStream} gives substreams of 2^76 steps.
 *
 * @param state A 7-integer state as returned by {@link getRandomSeed} after
 *   `RNGkind({ kind: "L'Ecuyer-CMRG" })`, or copied from R's `.Random.seed`.
 * @returns A new state of the same form (the first element, the kind code, is unchanged).
 *   Pass it to {@link setRandomSeed} to draw from that stream.
 * @throws RangeError if `state` is not a valid L'Ecuyer-CMRG state.
 *
 * @example
 * ```ts
 * RNGkind({ kind: "L'Ecuyer-CMRG" });
 * setSeed(1);
 * const s1 = getRandomSeed();
 * const s2 = nextRNGStream(s1); // R: s2 <- parallel::nextRNGStream(.Random.seed)
 * setRandomSeed(s2);
 * runif(2); // [0.31369782407981056, 0.9280126525616814]
 * ```
 */
export declare function nextRNGStream(state: ArrayLike<number>): Int32Array;
/**
 * The start of the next substream of L'Ecuyer-CMRG: the state advanced by 2^76 steps.
 * Equivalent to R's `parallel::nextRNGSubStream()`.
 *
 * @param state A 7-integer state, as for {@link nextRNGStream}.
 * @returns A new state of the same form.
 * @throws RangeError if `state` is not a valid L'Ecuyer-CMRG state.
 */
export declare function nextRNGSubStream(state: ArrayLike<number>): Int32Array;
