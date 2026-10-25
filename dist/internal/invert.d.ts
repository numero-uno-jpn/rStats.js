export interface InvertProblem {
    /** Target log probability (log P[X <= x] if lower, otherwise log P[X > x]) */
    logTarget: number;
    /** Target linear probability (if available). The residual is then measured as log(F(x) / target) */
    linearTarget?: number;
    /** Linear P[X <= x] / P[X > x] (used with linearTarget) */
    cdf?: (x: number, lower: boolean) => number;
    lower: boolean;
    /** log P[X <= x] (lower) / log P[X > x] (!lower) */
    cdfLog: (x: number, lower: boolean) => number;
    /**
     * (Optional) Function returning [log P, linear P] in one computation. If given, it is used instead of cdfLog and cdf
     * (computing the log and linear distribution function at the same x separately would do the main work twice).
     * Its values must equal those of cdfLog and cdf respectively
     */
    cdfBoth?: (x: number, lower: boolean) => [number, number];
    /** log f(x) */
    pdfLog: (x: number) => number;
    /**
     * (Optional) Derivative of the log density, d/dx log f(x). If given, steps use Halley's method (cubic convergence) when positive
     */
    dlogPdf?: (x: number) => number;
    /** Starting value */
    x0: number;
    /** Lower and upper ends of the support (±Infinity allowed) */
    lo: number;
    hi: number;
    /**
     * True when the support is positive only. Solves in u = log x.
     * For distributions with power-law tails like x^a (gamma and beta near 0),
     * log F is nearly linear in log x and Newton's method converges in a few steps
     */
    positive?: boolean;
    maxIter?: number;
}
export declare function invertContinuous(problem: InvertProblem): number;
