/**
 * Random numbers from the inverse gamma distribution. Equivalent to `extraDistr::rinvgamma(n, alpha, beta = 1)` in R.
 *
 * @param n Number of values to generate.
 * @param alpha Shape.
 * @param options.beta Scale. Default `1`.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rinvgamma(2, 3, { beta: 2 }); // [1.24409, 0.3964566]
 * ```
 *
 * @category Random numbers
 */
export declare function rinvgamma(n: number, alpha: number, options?: {
    beta?: number;
}): number[];
/**
 * Random numbers from the Kumaraswamy distribution. Equivalent to `extraDistr::rkumar(n, a, b)` in R.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rkumar(2, 2, 3); // [0.5977236, 0.5298335]
 * ```
 *
 * @category Random numbers
 */
export declare function rkumar(n: number, a: number, b: number): number[];
/**
 * Random numbers from the Pareto distribution. Equivalent to `extraDistr::rpareto(n, a = 1, b = 1)` in R.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rpareto(2, { a: 3, b: 1 }); // [1.555872, 1.390286]
 * ```
 *
 * @category Random numbers
 */
export declare function rpareto(n: number, options?: {
    a?: number;
    b?: number;
}): number[];
/**
 * Random numbers from the triangular distribution.
 * Equivalent to `extraDistr::rtriang(n, a = -1, b = 1, c = (a + b)/2)` in R.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rtriang(2, { a: 0, b: 2, c: 1 }); // [0.6376326, 1.481061]
 * ```
 *
 * @category Random numbers
 */
export declare function rtriang(n: number, options?: {
    a?: number;
    b?: number;
    c?: number;
}): number[];
/**
 * Random numbers from the Laplace distribution. Equivalent to `extraDistr::rlaplace(n, mu = 0, sigma = 1)` in R.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rlaplace(2, { mu: 0, sigma: 1 }); // [-0.7551818, 0.1457067]
 * ```
 *
 * @category Random numbers
 */
export declare function rlaplace(n: number, options?: {
    mu?: number;
    sigma?: number;
}): number[];
/**
 * Random numbers from the arcsine distribution on (a, b), by inversion: `qarcsine(runif(n), a, b)`.
 * Not an R function. The arcsine distribution is neither in base R nor in extraDistr.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rarcsine(2, { a: 0, b: 1 }); // [0.1640851, 0.3044923]
 * ```
 *
 * @category Random numbers
 */
export declare function rarcsine(n: number, options?: {
    a?: number;
    b?: number;
}): number[];
