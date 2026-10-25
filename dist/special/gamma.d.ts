/** sin(pi x). Does not lose accuracy to the rounding of pi x even for large x */
export declare function sinpi(x: number): number;
/**
 * Gamma function. Equivalent to R's `gamma(x)` for a single number.
 *
 * @param x - Argument.
 * @returns Gamma(x). `NaN` at zero and negative integers; `Infinity` on overflow.
 */
export declare function gamma(x: number): number;
/** log|Gamma(x)| and the sign of the gamma function. */
export declare function lgammaSign(x: number): {
    value: number;
    sign: number;
};
/**
 * Natural logarithm of the absolute value of the gamma function, log|Gamma(x)|.
 * Equivalent to R's `lgamma(x)` for a single number.
 *
 * Near the zeros x = 1 and x = 2 the result keeps full relative accuracy
 * (computed as lgamma(1 + e) = lgamma1p(e) and lgamma(2 + e) = lgamma1p(e) + log1p(e)).
 *
 * @param x - Argument.
 * @returns log|Gamma(x)|.
 */
export declare function lgamma(x: number): number;
/**
 * lgamma(1 + x). Keeps relative accuracy even near x = 0 and 1.
 * xsf uses the Taylor expansion for |x| <= 0.5, but the expansion is truncated at 42 terms and leaves an error of
 * about 1e-14 near |x| = 0.5 (measured at x = 0.5). Here the expansion is limited to |x| <= 0.2 and lgamma is used
 * outside (for 0.2 < |x|, lgamma(1 + x) is far enough from 0 that relative accuracy is not an issue).
 */
export declare function lgamma1p(x: number): number;
