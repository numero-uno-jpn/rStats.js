import { type DD } from "./dd.js";
/** lgamma(b + a) - lgamma(b). a >= 0, b > 0 */
export declare function lgammaDiff(a: number, b: number): number;
/**
 * lgammaDiff in double-double: the term a log(B + a), which reaches hundreds for large b (exp of it would turn its
 * rounding into a relative error of 1e-14 at B(0.5, 1e300)), is formed in double-double; the others are of the size
 * of a or less and stay in double precision
 */
export declare function lgammaDiffDD(a: number, b: number): DD;
