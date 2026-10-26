export declare function dnchisq1(x: number, df: number, ncp: number, log: boolean): number;
export declare function pnchisq1(q: number, df: number, ncp: number, lowerTail: boolean, logP: boolean): number;
/**
 * A tail that a rigorous bound places below the smallest positive double: `far` is "lower" when P[X <= q] is
 * negligible, "upper" when P[X > q] is, undefined when neither bound decides it
 */
export type FarTail = "lower" | "upper" | undefined;
/**
 * The value of the requested tail when the far tail is negligible: the far tail is exactly 0, the near tail exactly 1
 * (log 0). The log of the far tail is left to the full computation (undefined).
 */
export declare function negligibleTail(far: FarTail, lowerTail: boolean, logP: boolean): number | undefined;
export declare function qnchisq1(p: number, df: number, ncp: number, lowerTail: boolean, logP: boolean): number;
