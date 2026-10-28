/** One gamma variate (shape a, scale) */
export declare function rgamma1(a: number, scale: number): number;
/**
 * Random numbers from the gamma distribution. Equivalent to R's `rgamma()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param shape Shape parameter.
 * @param options.rate Rate. Default `1`. Give either `rate` or `scale`.
 * @param options.scale Scale (`1 / rate`). Default `1`. Giving both is an error unless `scale = 1 / rate`.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rgamma(2, 2, { rate: 1 }); // [0.830865, 3.570756]
 * ```
 *
 * @category Random numbers
 */
export declare function rgamma(n: number, shape: number, options?: {
    rate?: number;
    scale?: number;
}): number[];
export declare function rchisq1(df: number): number;
/** One noncentral χ² variate: Poisson mixture (χ² with df + 2 × Poisson(ncp/2) degrees of freedom) */
export declare function rnchisq1(df: number, ncp: number): number;
/**
 * Random numbers from the chi-squared distribution. Equivalent to R's `rchisq()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param df Degrees of freedom.
 * @param options.ncp Non-centrality parameter. If omitted, the central distribution is used.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rchisq(2, 3); // [0.9433146, 5.543782]
 * rchisq(2, 3, { ncp: 1 });
 * ```
 *
 * @category Random numbers
 */
export declare function rchisq(n: number, df: number, options?: {
    ncp?: number;
}): number[];
/**
 * Random numbers from Student's t distribution. Equivalent to R's `rt()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param df Degrees of freedom (may be `Infinity`).
 * @param options.ncp Non-centrality parameter. If omitted, the central distribution is used.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rt(2, 5); // [-0.6576941, -0.5973472]
 * ```
 *
 * @category Random numbers
 */
export declare function rt(n: number, df: number, options?: {
    ncp?: number;
}): number[];
/**
 * Random numbers from the F distribution. Equivalent to R's `rf()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param df1 Numerator degrees of freedom.
 * @param df2 Denominator degrees of freedom.
 * @param options.ncp Non-centrality parameter. If omitted, the central distribution is used.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rf(2, 3, 10); // [0.2025231, 1.645713]
 * ```
 *
 * @category Random numbers
 */
export declare function rf(n: number, df1: number, df2: number, options?: {
    ncp?: number;
}): number[];
