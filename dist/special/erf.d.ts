/** Error function erf(x). */
export declare function erf(x: number): number;
/** Complementary error function erfc(x) = 1 - erf(x). */
export declare function erfc(a: number): number;
/**
 * Scaled complementary error function erfcx(x) = exp(x^2) erfc(x) (x >= 0).
 * Negative x is handled by the caller (this library uses only x >= 0 internally).
 */
export declare function erfcxNonNegative(x: number): number;
