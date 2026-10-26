/** [hi, lo] represents hi + lo. |lo| <= ulp(hi)/2 */
export type DD = readonly [number, number];
/** 2^27 + 1 used for Veltkamp splitting (exported for use by the expanded code) */
export declare const SPLITTER = 134217729;
export declare function setDoubleDouble(on: boolean): void;
export declare function isDoubleDouble(): boolean;
/** [s, e] satisfying a + b = s + e exactly */
export declare function twoSum(a: number, b: number): DD;
/** [p, e] satisfying a * b = p + e exactly (Veltkamp splitting) */
export declare function twoProd(a: number, b: number): DD;
export declare function ddAdd(a: DD, b: DD): DD;
export declare function ddNeg(a: DD): DD;
export declare function ddSub(a: DD, b: DD): DD;
export declare function ddMul(a: DD, b: DD): DD;
export declare function ddMulNum(a: DD, b: number): DD;
export declare function ddDiv(a: DD, b: DD): DD;
export declare function ddDivNum(a: DD, b: number): DD;
/**
 * Natural log in double-double. x > 0 and finite.
 *
 * After reducing x = m 2^k (m ∈ [1/√2, √2)), divide m by the nearest c = i/128 and use
 *   log m = log c + 2 atanh(s),  s = (m - c)/(m + c)  (|s| <= 0.0028)
 * log c comes from a table (LOGTAB128); atanh is s (1 + s^2/3 + ... + s^10/11) evaluated by Horner's method
 * (the reciprocals are the constants RECIP). About 2.6 times faster than summing the series to 1e-34 with a
 * division per term, with the same accuracy (max relative 4.4e-32; see docs/performance.md). Operations such as
 * ddAdd are expanded into local variables (python3 scripts/ddgen.py ddlog). Subnormals are first multiplied by
 * 2^600 (a power of 2, so the scaling is exact)
 */
export declare function ddLog(x: DD): DD;
