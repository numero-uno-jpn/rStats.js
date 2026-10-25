/** Evaluate the polynomial coef[0] x^N + ... + coef[N] by Horner's method. */
export declare function polevl(x: number, coef: readonly number[]): number;
/** Evaluate the monic polynomial x^N + coef[0] x^(N-1) + ... + coef[N-1]. */
export declare function p1evl(x: number, coef: readonly number[]): number;
