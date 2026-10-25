/**
 * Random numbers from the inverse gamma distribution. Equivalent to `extraDistr::rinvgamma(n, alpha, beta = 1)`.
 *
 * @param n Number of values to generate.
 * @param alpha Shape.
 * @param options.beta Scale. Default `1`.
 */
export declare function rinvgamma(n: number, alpha: number, options?: {
    beta?: number;
}): number[];
/** Random numbers from the Kumaraswamy distribution. Equivalent to `extraDistr::rkumar(n, a, b)`. */
export declare function rkumar(n: number, a: number, b: number): number[];
/** Random numbers from the Pareto distribution. Equivalent to `extraDistr::rpareto(n, a = 1, b = 1)`. */
export declare function rpareto(n: number, options?: {
    a?: number;
    b?: number;
}): number[];
/** Random numbers from the triangular distribution. Equivalent to `extraDistr::rtriang(n, a = -1, b = 1, c = (a + b)/2)`. */
export declare function rtriang(n: number, options?: {
    a?: number;
    b?: number;
    c?: number;
}): number[];
/** Random numbers from the Laplace distribution. Equivalent to `extraDistr::rlaplace(n, mu = 0, sigma = 1)`. */
export declare function rlaplace(n: number, options?: {
    mu?: number;
    sigma?: number;
}): number[];
/** Random numbers from the arcsine distribution on (a, b), by inversion: `qarcsine(runif(n), a, b)`. */
export declare function rarcsine(n: number, options?: {
    a?: number;
    b?: number;
}): number[];
