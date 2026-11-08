/**
 * The labels with every number replaced by the value of its level (see the top of this file): numbers with the same
 * 15-digit text become the same number, the smallest of them; -0 becomes 0. NaN and labels that are not numbers are
 * unchanged
 */
export declare function numberLevels<T>(labels: ArrayLike<T>): T[];
/**
 * The text of a level as R writes it: a number as as.character does (15 significant digits, so 1e15 is "1e+15" and
 * 1/3 is "0.333333333333333"; Inf is "Inf"), anything else with String
 */
export declare function levelText(v: unknown): string;
