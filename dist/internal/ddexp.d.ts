import { type DD } from "../special/dd.js";
/** exp(x) as double-double. If the result is subnormal or overflows, only the double value */
export declare function ddExp(x: DD): DD;
/**
 * (x - location) / scale as double-double,
 * without the rounding of the subtraction and division (it gets amplified in distributions that use the standardised value in an exponent).
 * If the result is not finite, only the double value.
 */
export declare function standardizeDD(x: number, location: number, scale: number): DD;
/**
 * log(a / b) as double-double for positive finite a and b: log a - log b, which keeps its digits where a / b is
 * subnormal, 0 or overflows (the log of a subnormal ratio has lost them in the division)
 */
export declare function logRatioDD(a: number, b: number): DD;
/** a b as double-double. Only the double product when Veltkamp splitting would overflow (above 1e300) or for non-finite values */
export declare function mulDD(a: number, b: number): DD;
/** exp(-t) (t is double-double). The low-order part of t enters to first order */
export declare function expNeg(t: DD): number;
/**
 * exp(-t) / s (t double-double, s > 0) where exp(-t) is below the normal range and s small enough to bring the quotient
 * back into it: exp(-t) itself would be rounded on the subnormal grid (a density formed so had lost digits:
 * dlaplace(9.4863e-158, { mu: 9.4863e-158 + 4.5e-167, sigma: 6.04e-171 }) was 6e-4 off). With k = round(t / log 2) and
 * s = f 2^j (f in [1, 2)), it is exp(-(t - k log 2)) / f times 2^(-k - j), the power of two applied last (in two
 * steps, the first within the normal range), so that the only rounding into the subnormal range is the final one
 */
export declare function expNegOver(t: DD, s: number): number;
/** log(1 - exp(x)) (x <= 0). Switches method by the size of x to avoid cancellation */
export declare function log1mExp(x: number): number;
/** Log of the lower probability 1 - exp(-t) (t double-double, t > 0). For large t, exp(-t) includes the low-order part of t */
export declare function logOneMinusExpNeg(t: DD): number;
/** location + scale t with a single rounding (the rounding of scale t would show up in the subtraction with location) */
export declare function locationScale(location: number, scale: number, t: number): number;
