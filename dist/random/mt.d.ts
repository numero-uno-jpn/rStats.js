/** MT19937 state. mt holds 624 words, mti is the index of the next word to use */
export declare class MersenneTwister {
    readonly mt: Uint32Array<ArrayBuffer>;
    mti: number;
    /** Set the same state as R's set.seed(seed) */
    setSeed(seed: number): void;
    /** Standard MT19937 initialisation by Knuth's LCG (used only when the state is unset) */
    private sgenrand;
    /** One 32-bit unsigned integer */
    nextUint32(): number;
    /** Uniform on (0, 1). Corresponds to R's unif_rand() (never returns 0 or 1) */
    nextDouble(): number;
    /** R's .Random.seed (626 integers: kind code, mti, state) */
    getRandomSeed(kind: number): Int32Array;
    setRandomSeed(state: ArrayLike<number>): void;
}
