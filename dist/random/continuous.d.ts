/**
 * Random numbers from the uniform distribution. Equivalent to R's `runif()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param options.min Lower limit. Default `0`.
 * @param options.max Upper limit. Default `1`.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * runif(3); // [0.2655087, 0.3721239, 0.5728534]
 * runif(2, { min: -1, max: 1 });
 * ```
 *
 * @category Random numbers
 */
export declare function runif(n: number, options?: {
    min?: number;
    max?: number;
}): number[];
export declare function rnorm1(mean: number, sd: number): number;
/**
 * Random numbers from the normal distribution. Equivalent to R's `rnorm()`.
 *
 * Uses inversion (R's default `"Inversion"` normal kind), so the output matches R for the same seed.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param options.mean Mean. Default `0`.
 * @param options.sd Standard deviation. Default `1`.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rnorm(3); // [-0.6264538107423324, 0.18364332422208224, -0.8356286124100472]
 * rnorm(2, { mean: 10, sd: 2 });
 * ```
 *
 * @category Random numbers
 */
export declare function rnorm(n: number, options?: {
    mean?: number;
    sd?: number;
}): number[];
/**
 * Random numbers from the exponential distribution. Equivalent to R's `rexp()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param options.rate Rate. Default `1`.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rexp(2, { rate: 2 }); // [0.3775909, 0.5908214]
 * ```
 *
 * @category Random numbers
 */
export declare function rexp(n: number, options?: {
    rate?: number;
}): number[];
/**
 * Random numbers from the log-normal distribution. Equivalent to R's `rlnorm()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param options.meanlog Mean on the log scale. Default `0`.
 * @param options.sdlog Standard deviation on the log scale. Default `1`.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rlnorm(2, { meanlog: 0, sdlog: 1 }); // [0.5344838, 1.201587]
 * ```
 *
 * @category Random numbers
 */
export declare function rlnorm(n: number, options?: {
    meanlog?: number;
    sdlog?: number;
}): number[];
/**
 * Random numbers from the logistic distribution. Equivalent to R's `rlogis()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param options.location Location. Default `0`.
 * @param options.scale Scale. Default `1`.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rlogis(2, { location: 0, scale: 1 }); // [-1.017531, -0.523116]
 * ```
 *
 * @category Random numbers
 */
export declare function rlogis(n: number, options?: {
    location?: number;
    scale?: number;
}): number[];
/**
 * Random numbers from the Cauchy distribution. Equivalent to R's `rcauchy()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param options.location Location. Default `0`.
 * @param options.scale Scale. Default `1`.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rcauchy(2, { location: 0, scale: 1 }); // [1.10252, 2.353831]
 * ```
 *
 * @category Random numbers
 */
export declare function rcauchy(n: number, options?: {
    location?: number;
    scale?: number;
}): number[];
/**
 * Random numbers from the Weibull distribution. Equivalent to R's `rweibull()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param shape Shape parameter (required, as in R).
 * @param options.scale Scale. Default `1`.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rweibull(2, 2, { scale: 1 }); // [1.151568, 0.9942477]
 * ```
 *
 * @category Random numbers
 */
export declare function rweibull(n: number, shape: number, options?: {
    scale?: number;
}): number[];
