/** R's method suffix for a simulated p-value; B is printed as R's paste() prints a number */
export declare function simulatedMethod(B: number): string;
/** A number as R's as.character prints it (15 significant digits, fixed or scientific, whichever is narrower) */
export declare function formatR(v: number): string;
