/** A finite double as an integer mantissa m and an exponent e with v = m * 2^e (subnormals included) */
export declare function splitDouble(v: number): [bigint, number];
/**
 * The inner product of u and v when the plain sum s is not finite: with finite factors, the products may have
 * overflowed while the sum is in range (1e308 * 1e308 + 1e308 * -1e308 gave NaN, R too). Each product is formed
 * exactly as an integer times a power of 2, the products are summed exactly in BigInt, and the sum is rounded once
 * to the nearest double (ties to even, subnormals and overflow to Infinity included). Cancellation of the large
 * products therefore leaves the exact remainder (matMul([[1e308, 1e308, 1e-308]], [[1e308], [-1e308], [1e308]]) is
 * 0.9999999999999999, the double product 1e-308 * 1e308). With a factor that is not finite, s is returned as it is
 */
export declare function rescaledDot(u: readonly number[], v: readonly number[], s: number): number;
/**
 * sum * 2^low rounded once to the nearest double (ties to even, subnormals and overflow to Infinity included).
 * Callers whose sum is not exact pass it with a sticky last bit (at least 2 bits below the last kept one)
 */
export declare function roundScaled(sum: bigint, low: number): number;
/**
 * Whether the plain sum s of an inner product is to be checked by checkedDot: s not finite, or |s| < 2^-969 and
 * the product of the smallest nonzero |factors| (a lower bound of every nonzero product; 0 to always check) below
 * 2^-1022. Otherwise s stands, with the bits of the plain sum
 */
export declare function checkDot(s: number, minProduct: number): boolean;
/**
 * The plain sum s of the inner product of u and v, or the exact inner product (rescaledDot) where s is not finite,
 * or where |s| < 2^-969 and a product of nonzero factors fell below 2^-1022 (#395: 100 products 1e-162 * 1e-162
 * round to 0 each, for 1e-322; R gives 0 too). A sum that cancels in the normal range (1e16 + 1 - 1e16 = 0) keeps
 * its plain value
 */
export declare function checkedDot(u: readonly number[], v: readonly number[], s: number): number;
