/** One 2 x 2 stratum as [[a, b], [c, d]] counts */
export type Stratum = readonly [readonly [number, number], readonly [number, number]];
/**
 * The distribution of S = sum of the (1, 1) cells of K 2 x 2 tables with fixed margins, as a function of the common
 * odds ratio (noncentrality).
 */
export declare class ConvolvedNoncentralHyper {
    /** Smallest and largest attainable S */
    readonly lo: number;
    readonly hi: number;
    /** log d0(s) for s = lo..hi (d0: the null, psi = 1, density) */
    private readonly logNull;
    constructor(strata: readonly Stratum[]);
    /** P(S = s; psi) for s = lo..hi, for 0 < psi < Infinity (psi = 0 and Infinity give the point masses at lo and hi) */
    density(psi: number): Float64Array;
    /** E[S; psi] */
    mean(psi: number): number;
    /** P(S <= q; psi), or P(S >= q; psi) when upper */
    cdf(q: number, psi: number, upper: boolean): number;
}
/** The conditional maximum likelihood estimate of the common odds ratio given the observed sum s */
export declare function conditionalMLE(h: ConvolvedNoncentralHyper, s: number): number;
/** Upper confidence limit: the psi with P(S <= s; psi) = alpha */
export declare function upperLimit(h: ConvolvedNoncentralHyper, s: number, alpha: number): number;
/** Lower confidence limit: the psi with P(S >= s; psi) = alpha */
export declare function lowerLimit(h: ConvolvedNoncentralHyper, s: number, alpha: number): number;
