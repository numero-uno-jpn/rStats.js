// Mersenne-Twister (MT19937) with initialisation compatible with R's set.seed().
//
// The generation procedure follows Matsumoto & Nishimura (1998) "Mersenne Twister: A 623-dimensionally
// equidistributed uniform pseudo-random number generator" (ACM TOMACS 8(1)).
// How set.seed() expands the seed and maps to [0, 1) was verified against R's ?RNG documentation and
// observations of R's .Random.seed and runif() output (test/fixtures/random*.json).
const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;
/** 2^-32 */
const TWO_M32 = 2.3283064365386963e-10;
/** 1 / (2^32 - 1). Basis of the value returned in place of 0 */
const I2_32M1 = 2.328306437080797e-10;
/** MT19937 state. mt holds 624 words, mti is the index of the next word to use */
export class MersenneTwister {
    mt = new Uint32Array(N);
    mti = N + 1;
    /** Set the same state as R's set.seed(seed) */
    setSeed(seed) {
        // Scramble the seed 50 times with an LCG (x <- 69069 x + 1 mod 2^32) and fill the state with the following 625 values.
        // The first one is discarded (it corresponds to the mti position in .Random.seed), and mti = 624
        let s = seed >>> 0;
        for (let j = 0; j < 50; j++)
            s = (Math.imul(69069, s) + 1) >>> 0;
        s = (Math.imul(69069, s) + 1) >>> 0;
        for (let j = 0; j < N; j++) {
            s = (Math.imul(69069, s) + 1) >>> 0;
            this.mt[j] = s;
        }
        this.mti = N;
    }
    /** Standard MT19937 initialisation by Knuth's LCG (used only when the state is unset) */
    sgenrand(seed) {
        for (let i = 0; i < N; i++) {
            this.mt[i] = seed & 0xffff0000;
            seed = (Math.imul(69069, seed) + 1) >>> 0;
            this.mt[i] = (this.mt[i] | ((seed & 0xffff0000) >>> 16)) >>> 0;
            seed = (Math.imul(69069, seed) + 1) >>> 0;
        }
        this.mti = N;
    }
    /** One 32-bit unsigned integer */
    nextUint32() {
        const mt = this.mt;
        if (this.mti >= N) {
            if (this.mti === N + 1)
                this.sgenrand(4357);
            let kk = 0;
            let y;
            for (; kk < N - M; kk++) {
                y = (mt[kk] & UPPER_MASK) | (mt[kk + 1] & LOWER_MASK);
                mt[kk] = mt[kk + M] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
            }
            for (; kk < N - 1; kk++) {
                y = (mt[kk] & UPPER_MASK) | (mt[kk + 1] & LOWER_MASK);
                mt[kk] = mt[kk + (M - N)] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
            }
            y = (mt[N - 1] & UPPER_MASK) | (mt[0] & LOWER_MASK);
            mt[N - 1] = mt[M - 1] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
            this.mti = 0;
        }
        let y = mt[this.mti++];
        y ^= y >>> 11;
        y ^= (y << 7) & 0x9d2c5680;
        y ^= (y << 15) & 0xefc60000;
        y ^= y >>> 18;
        return y >>> 0;
    }
    /** Uniform on (0, 1). Corresponds to R's unif_rand() (never returns 0 or 1) */
    nextDouble() {
        const v = this.nextUint32() * TWO_M32;
        if (v <= 0)
            return 0.5 * I2_32M1;
        if (1 - v <= 0)
            return 1 - 0.5 * I2_32M1;
        return v;
    }
    /** R's .Random.seed (626 integers: kind code, mti, state) */
    getRandomSeed(kind) {
        const out = new Int32Array(N + 2);
        out[0] = kind;
        out[1] = this.mti;
        for (let i = 0; i < N; i++)
            out[i + 2] = this.mt[i] | 0;
        return out;
    }
    setRandomSeed(state) {
        if (state.length !== N + 2)
            throw new RangeError(`the random seed state must have ${N + 2} integers`);
        this.mti = state[1];
        for (let i = 0; i < N; i++)
            this.mt[i] = state[i + 2] >>> 0;
    }
}
