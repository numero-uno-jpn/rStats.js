/**
 * Upper probability of Dunnett's statistics: P(max T_i >= c) (`twoSided` false) or P(max |T_i| >= c) (`twoSided`
 * true; c is then taken as |c|), with lambda_i = n_i / (n_i + n_0) and df degrees of freedom (Infinity: normal).
 */
export declare function pDunnettUpper(c: number, lambda: readonly number[], df: number, twoSided: boolean): number;
