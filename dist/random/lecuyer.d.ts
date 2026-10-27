/** Moduli of the two components */
export declare const M1 = 4294967087;
export declare const M2 = 4294944443;
/**
 * MRG32k3a state: s[0..2] for the first component (mod M1), s[3..5] for the second (mod M2), oldest first.
 * Reading and checking R's .Random.seed are separate functions (below), so that they are left out of bundles
 * that do not use them
 */
export declare class Mrg32k3a {
    readonly s: Float64Array<ArrayBuffer>;
    /** Set the same state as R's set.seed(seed, kind = "L'Ecuyer-CMRG") */
    setSeed(seed: number): void;
    /** Uniform on (0, 1) (R's unif_rand: never 0 or 1, no further correction needed) */
    nextDouble(): number;
}
/**
 * The six seeds of a .Random.seed for L'Ecuyer-CMRG, as unsigned integers. R accepts a state whose first three seeds
 * are below M1 and not all zero and whose last three are below M2 (and reseeds from the clock otherwise)
 */
export declare function checkState(state: ArrayLike<number>): number[];
