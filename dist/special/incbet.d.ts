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
/**
 * I_x(a, b) (lower) or 1 - I_x(a, b) for x below DBL_MIN, from x and lx = log x in double-double (x itself may have
 * underflowed to 0, as in the F distribution far out: only lx then carries it), as [log, linear] (log NaN unless
 * wantLog). From the series I_x(a, b) = x^a / (a B(a, b)) (1 + a S), S = pseriesSum(a, b, x): the terms of S are about
 * (-b x)^n / n!, and b x is at most 4 here (b near the largest double), mostly negligible.
 * log(1/(a B(a, b))) is lgamma(a+b) - lgamma(b) - lgamma(a+1) without subtraction, or for a small shape
 * log(b/(a + b)) + log Γ(1+a+b)/(Γ(1+a) Γ(1+b)) with the ratio r = b/(a + b) kept on the linear scale (as a log, its
 * rounding of ε |log r| would become the relative error of the result)
 */
export declare function betaIncTinyX(a: number, b: number, x: number, lx: DD, lower: boolean, wantLog: boolean): [number, number];
