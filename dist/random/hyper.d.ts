/** One hypergeometric variate (kkin draws from nn1in white and nn2in black balls) */
export declare function rhyper1(nn1in: number, nn2in: number, kkin: number): number;
/**
 * Random numbers from the hypergeometric distribution. Equivalent to R's `rhyper()`.
 *
 * @param nn Number of values to generate.
 * @param m Number of white balls in the urn.
 * @param n Number of black balls in the urn.
 * @param k Number of balls drawn from the urn.
 * @returns An array of `nn` values (the number of white balls drawn); `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rhyper(5, 10, 7, 8); // [5, 5, 5, 3, 6]
 * ```
 *
 * @category Random numbers
 */
export declare function rhyper(nn: number, m: number, n: number, k: number): number[];
