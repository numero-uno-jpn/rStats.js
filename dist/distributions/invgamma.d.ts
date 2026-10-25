import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
/** Scale parameter of the inverse gamma distribution. */
export interface InvgammaParams {
    /** Scale (the rate of the gamma distribution of 1/X). Default `1`. */
    beta?: number;
}
export declare function dinvgamma1(x: number, alpha: number, beta: number, log: boolean): number;
export declare function pinvgamma1(q: number, alpha: number, beta: number, lowerTail: boolean, logP: boolean): number;
export declare function qinvgamma1(p: number, alpha: number, beta: number, lowerTail: boolean, logP: boolean): number;
/**
 * Density of the inverse gamma distribution. Equivalent to `extraDistr::dinvgamma(x, alpha, beta = 1, log = FALSE)`:
 * f(x) = beta^alpha x^(-alpha-1) exp(-beta/x) / Gamma(alpha).
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param alpha - Shape parameter.
 * @param options - `beta` (see {@link InvgammaParams}) and `log` (see {@link DensityOptions}).
 */
export declare function dinvgamma<T extends Vectorizable>(x: T, alpha: number, options?: InvgammaParams & DensityOptions): VectorResult<T>;
/**
 * Distribution function of the inverse gamma distribution. Equivalent to
 * `extraDistr::pinvgamma(q, alpha, beta = 1, lower.tail = TRUE, log.p = FALSE)`.
 */
export declare function pinvgamma<T extends Vectorizable>(q: T, alpha: number, options?: InvgammaParams & TailOptions): VectorResult<T>;
/**
 * Quantile function of the inverse gamma distribution. Equivalent to
 * `extraDistr::qinvgamma(p, alpha, beta = 1, lower.tail = TRUE, log.p = FALSE)`.
 */
export declare function qinvgamma<T extends Vectorizable>(p: T, alpha: number, options?: InvgammaParams & TailOptions): VectorResult<T>;
