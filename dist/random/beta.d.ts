/** One beta variate (shape1 aa, shape2 bb) */
export declare function rbeta1(aa: number, bb: number): number;
/**
 * Random numbers from the beta distribution. Equivalent to R's `rbeta()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param shape1 First shape parameter.
 * @param shape2 Second shape parameter.
 * @param options.ncp Non-centrality parameter. If omitted, the central distribution is used.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 */
export declare function rbeta(n: number, shape1: number, shape2: number, options?: {
    ncp?: number;
}): number[];
