/**
 * A uniform random number generator, R's `RNGkind(kind)`.
 *
 * @category Random numbers
 */
export type RNGKindName = "Mersenne-Twister" | "L'Ecuyer-CMRG";
/**
 * How `sample` turns uniforms into indices, R's `RNGkind(sample.kind)`.
 *
 * @category Random numbers
 */
export type SampleKindName = "Rejection" | "Rounding";
/**
 * Options for {@link RNGkind}. Omitted entries keep the current setting, as in R.
 *
 * @category Random numbers
 */
export interface RNGKindOptions {
    /** Uniform generator: `"Mersenne-Twister"` (R's default), `"L'Ecuyer-CMRG"`, or `"default"`. */
    kind?: RNGKindName | "default" | undefined;
    /**
     * `"Rejection"` (R's default since 3.6.0), `"Rounding"` (the `sample` of R before 3.6.0, to
     * reproduce older results), or `"default"`.
     */
    sampleKind?: SampleKindName | "default" | undefined;
}
/**
 * The kinds in effect, as returned by {@link RNGkind}.
 *
 * @category Random numbers
 */
export interface RNGKinds {
    /** The uniform generator. */
    kind: RNGKindName;
    /** Always `"Inversion"` (the only normal kind supported). */
    normalKind: "Inversion";
    /** How `sample` draws indices. */
    sampleKind: SampleKindName;
}
/**
 * Seeds the random number generator. Equivalent to R's `set.seed()`.
 *
 * Seeds the current generator, R's default `RNGkind("Mersenne-Twister", "Inversion", "Rejection")`
 * unless {@link RNGkind} chose another, so every `r*` function and `sample`/`sampleInt` produce the
 * same numbers as in R after the same seed. R's `set.seed(seed, kind, sample.kind = ...)` is
 * `RNGkind({ kind, sampleKind })` followed by `setSeed(seed)` (R itself does the same). As in R
 * there is a single global stream shared by all functions; if no seed is set, one is chosen from
 * the clock or `crypto.getRandomValues`.
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
 *
 * @category Random numbers
 */
export declare function setSeed(seed: number): void;
/**
 * Reads or changes the kinds of random number generation. Equivalent to R's `RNGkind()`.
 *
 * - `kind: "Mersenne-Twister"` (or `"default"`): R's default generator.
 * - `kind: "L'Ecuyer-CMRG"`: L'Ecuyer's MRG32k3a, with independent streams for parallel work
 *   ({@link nextRNGStream}, {@link nextRNGSubStream}).
 * - `sampleKind: "Rounding"`: indices drawn as `floor(n * u)`, as `sample`, `sampleInt` and
 *   `rwilcox` did in R before 3.6.0 (slightly non-uniform for large n; R warns about it, rStats.js
 *   does not). `"Rejection"` (or `"default"`) is R's default since 3.6.0. Other functions are not
 *   affected.
 *
 * As in R, changing `kind` seeds the new generator from the next uniform of the current one (also
 * when the kind does not change), so a stream stays reproducible from the last {@link setSeed};
 * changing only `sampleKind` keeps the stream. Call {@link setSeed} afterwards to seed the new
 * generator directly: `RNGkind({ kind }); setSeed(seed)` is R's `set.seed(seed, kind)`.
 *
 * @param options The kinds to change; omitted entries are kept. Default: change nothing.
 * @returns The kinds in effect before the call (the current ones when called without options), as R.
 * @throws RangeError for an unsupported kind (nothing is changed then).
 *
 * @example
 * ```ts
 * RNGkind(); // { kind: "Mersenne-Twister", normalKind: "Inversion", sampleKind: "Rejection" }
 * RNGkind({ kind: "L'Ecuyer-CMRG" });
 * setSeed(1);
 * runif(2); // [0.6775328286287442, 0.4273457228876442]
 * // R: set.seed(1, kind = "L'Ecuyer-CMRG"); runif(2)
 * RNGkind({ kind: "default", sampleKind: "Rounding" });
 * setSeed(1);
 * sampleInt(10, { size: 3 }); // [2, 3, 4]
 * // R: set.seed(1, kind = "default", sample.kind = "Rounding"); sample.int(10, 3) - 1
 * ```
 *
 * @category Random numbers
 */
export declare function RNGkind(options?: RNGKindOptions): RNGKinds;
/**
 * Returns a copy of the current generator state, as reading R's `.Random.seed` does.
 * Equivalent to R's `.Random.seed`.
 *
 * @returns The same integers as R's `.Random.seed`: the kind code (`10403` for R's default,
 *   `403` with `sampleKind: "Rounding"`, `10407` for L'Ecuyer-CMRG), followed by 625 integers
 *   for Mersenne-Twister or 6 for L'Ecuyer-CMRG (unsigned seeds of 2^31 or more appear as
 *   negative numbers, as in R). Pass it to {@link setRandomSeed} to restore the state.
 *
 * @example
 * ```ts
 * setSeed(1);
 * const s = getRandomSeed();
 * s.length; // 626
 * s[0]; // 10403
 * ```
 *
 * @category Random numbers
 */
export declare function getRandomSeed(): Int32Array;
/**
 * Restores a generator state, including its kinds, as assigning R's `.Random.seed` does.
 * Equivalent to R's `.Random.seed`.
 *
 * @param state The integers returned by {@link getRandomSeed}, or copied from R's `.Random.seed`.
 * @throws RangeError for a kind code other than those of Mersenne-Twister or L'Ecuyer-CMRG with
 *   Inversion and Rejection or Rounding (`10403`, `403`, `10407`, `407`), a state of the wrong
 *   length, or an invalid L'Ecuyer-CMRG state (R reseeds from the clock in these cases).
 *
 * @example
 * ```ts
 * setSeed(1);
 * const s = getRandomSeed();
 * runif(2); // [0.2655087, 0.3721239]
 * setRandomSeed(s);
 * runif(2); // [0.2655087, 0.3721239] (the same again)
 * ```
 *
 * @category Random numbers
 */
export declare function setRandomSeed(state: ArrayLike<number>): void;
/** One uniform on (0, 1) (R's unif_rand) */
export declare function unifRand(): number;
/** Whether sample.kind is "Rounding" (for weighted sampling by Walker's alias method) */
export declare const isRounding: () => boolean;
/**
 * Uniform integer in [0, dn) (R's R_unif_index): rejection sampling from random bits (sample.kind = "Rejection"),
 * or floor(dn * u) (sample.kind = "Rounding"), with u made of two uniforms above 2^31 - 1
 */
export declare function unifIndex(dn: number): number;
/** One standard normal variate (R's norm_rand; inversion, using two uniforms for resolution finer than 2^-27) */
export declare function normRand(): number;
/**
 * One standard exponential variate (R's exp_rand).
 * Ahrens & Dieter (1972) "Computer methods for sampling from the exponential and
 * normal distributions" (Comm. ACM 15): algorithm SA.
 */
export declare function expRand(): number;
