/**
 * Random numbers from the distribution of the Wilcoxon signed rank statistic.
 * Equivalent to R's `rsignrank()`.
 *
 * @param nn Number of values to generate.
 * @param n Number of observations in the sample.
 * @returns An array of `nn` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rsignrank(5, 10); // [37, 33, 13, 29, 40]
 * ```
 *
 * @category Random numbers
 */
export declare function rsignrank(nn: number, n: number): number[];
/**
 * Random numbers from the distribution of the Wilcoxon rank sum statistic.
 * Equivalent to R's `rwilcox()`.
 *
 * @param nn Number of values to generate.
 * @param m Number of observations in the first sample.
 * @param n Number of observations in the second sample.
 * @returns An array of `nn` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rwilcox(5, 4, 6); // [7, 5, 12, 17, 10]
 * ```
 *
 * @category Random numbers
 */
export declare function rwilcox(nn: number, m: number, n: number): number[];
