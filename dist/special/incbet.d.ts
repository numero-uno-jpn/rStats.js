import { type DD } from "./dd.js";
/**
 * Regularized incomplete beta function: I_x(a, b) if lower, otherwise 1 - I_x(a, b).
 * The caller passes xc = 1 - x accurately. Assumes a, b > 0 and 0 <= x <= 1.
 *
 * The requested tail is computed by the first applicable subtraction-free method in this order:
 * 1. series in that tail's frame  2. complement of the series in the opposite frame (pseriesComplement)
 * 3. continued fraction in that tail's frame  4. 1 - (other side) from the continued fraction in the opposite frame
 * (the lower frame is (a, b, x); the upper is (b, a, 1-x) via 1 - I_x(a,b) = I_{1-x}(b, a))
 */
export declare function betaInc(a: number, b: number, x: number, xc: number, lower: boolean, log: boolean): number;
/**
 * Version of betaInc taking x and 1 - x in double-double.
 * When x is itself computed, as in n/(n + t^2) for the t distribution, its rounding (0.5 ulp) is amplified
 * a times (3e-14 at a = 500), so the caller builds it in double-double and passes it as is.
 */
export declare function betaIncDD(a: number, b: number, xd: DD, xcd: DD, lower: boolean, log: boolean): number;
/**
 * Return both the log and the linear value of betaIncDD from a single core computation ([log, linear]).
 * Used by the Newton iteration for quantiles, which needs both the log and linear distribution function at the same x.
 * The values are bit-identical to betaIncDD(..., true) and betaIncDD(..., false) respectively
 */
export declare function betaIncBothDD(a: number, b: number, xd: DD, xcd: DD, lower: boolean): [number, number];
/** Version of betaInc returning both (takes x and 1 - x in double precision, like betaInc) */
export declare function betaIncBoth(a: number, b: number, x: number, xc: number, lower: boolean): [number, number];
