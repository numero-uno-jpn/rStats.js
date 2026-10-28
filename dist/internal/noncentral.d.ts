/**
 * Noncentrality option accepted by the chi-squared, t, F and beta distribution functions.
 *
 * @category Distributions
 */
export interface NoncentralOption {
    /**
     * Noncentrality parameter. If omitted, the central distribution is used.
     * As in R, an explicit `ncp: 0` describes the same distribution as the central one. R then uses
     * the noncentral algorithm, so its values can differ slightly from the central values;
     * rStats.js returns values of the same accuracy in both cases.
     */
    ncp?: number;
}
/**
 * The smallest double in (lo, hi] at which `passes` holds, given that it fails at lo and holds at hi and changes once
 * in between: searched from x outwards over the doubles themselves by steps of 1, 2, 4, ... and then bisected, so that
 * it takes about 2 log2(d) steps for an x d doubles away (at most about 130). The last resort of the noncentral
 * quantiles, for distribution functions too steep for the Newton iteration (a spread below the spacing of the
 * doubles, where the function steps from 0 to 1/2 at one double, or a slope at which one double changes log p by
 * more than its tolerance); x is then the Newton iteration's result, usually within a few doubles.
 */
export declare function searchDoubles(x: number, lo: number, hi: number, passes: (x: number) => boolean): number;
/**
 * The quantile of a distribution whose relative spread is below about 1e-10, so that its distribution function steps
 * within a few doubles of the start x0 (where the Newton iteration only wanders): searched for directly when the step
 * lies within x0 (1 ± 1e-12), otherwise undefined. hi caps the upper end of that interval
 */
export declare function narrowQuantile(x0: number, hi: number, passes: (x: number) => boolean): number | undefined;
/** Accuracy goal and limit of one adaptive integral (kronrodAdaptive) */
export interface QuadratureControl {
    /** Relative tolerance on the difference between the Kronrod and Gauss values (of the total) */
    tol: number;
    /** Bisections allowed in all; past them the parts are taken as they are */
    maxBisections: number;
    /** Bisections made so far */
    bisections: number;
}
/** Control for an integrand accurate to about the rounding (tolerance 1e-15, 4000 bisections) */
export declare function quadratureControl(tol?: number, maxBisections?: number): QuadratureControl;
/**
 * Integral of f over [a, b] by the 15-point Kronrod rule, bisecting while it differs from the 7-point Gauss rule by
 * more than tol of the total (`total`, the integral accumulated so far, or this part's own value). The difference
 * overestimates the error of the Kronrod value by far, so with tol = 1e-15 the result is good to about the rounding of
 * the sum. The bisections are counted over the whole integral: an integrand with rounding noise above the tolerance
 * would otherwise be bisected to the full depth (2^40 intervals)
 */
export declare function kronrodAdaptive(f: (u: number) => number, a: number, b: number, total: number, depth: number, control: QuadratureControl): number;
