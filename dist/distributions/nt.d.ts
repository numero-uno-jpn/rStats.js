/**
 * Above this df the central and noncentral t are taken from their limits (hugeDf*; shared with t.ts). The t
 * differs from the normal by terms of relative order t²/ν and 1/ν: where y = t²/ν < 1e-17 it is the normal to the
 * double (the absolute error in the log, about t⁴/ν, is below 1e-180 wherever the linear value is above the
 * underflow), and beyond, |t| > 3e91, the log of the far tail and of the density is -(ν/2) log1p(y) up to terms
 * below 1e-179 of it. The general code fails from about 1.3e300 on (NaN where its intermediate terms overflow)
 */
export declare const HUGE_DF = 1e+200;
/** y = t²/ν (t² may overflow on its own) */
export declare function hugeDfRatio(t: number, n: number): number;
/**
 * Log of the far tail beyond |t| and of the density at t (relative error about eps) for n > HUGE_DF and
 * hugeDfRatio(t, n) >= 1e-17: -(n/2) log1p(t²/n), formed without overflow
 */
export declare function hugeDfTailLog(t: number, n: number): number;
/**
 * |t| with hugeDfTailLog(t, n) = logTarget (logTarget < 0), Infinity beyond the largest double: t² = n expm1(-2 logTarget / n).
 * (sqrt(n) is taken apart: through exp(log t) its log, up to 354, would multiply the rounding error)
 */
export declare function hugeDfTailQuantile(logTarget: number, n: number): number;
/**
 * P[T <= t] (lower) / P[T > t] for n > HUGE_DF and hugeDfRatio(t, n) >= 1e-17 from hugeDfTailLog: the tail beyond |t|
 * is its exp (0), the other is 1
 */
export declare function hugeDfTail(t: number, n: number, lowerTail: boolean, logP: boolean): number;
export declare function dnt1(x: number, df0: number, ncp: number, log: boolean): number;
export declare function pnt1(q: number, df0: number, ncp: number, lowerTail: boolean, logP: boolean): number;
export declare function qnt1(p: number, df0: number, ncp: number, lowerTail: boolean, logP: boolean): number;
