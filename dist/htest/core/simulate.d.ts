/** R's method suffix for a simulated p-value; B is printed as R's paste() prints a number */
export declare function simulatedMethod(B: number): string;
/** A number as R's as.character prints it (15 significant digits, fixed or scientific, whichever is narrower) */
export declare function formatR(v: number): string;
/**
 * A number as R's format() prints it with `digits` significant digits (default 7, R's option): the fewest significant
 * digits, at most `digits`, that show the number rounded to `digits`, in fixed notation unless the scientific one is
 * narrower (R's scipen = 0)
 */
export declare function formatDigits(v: number, digits?: number): string;
