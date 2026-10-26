// L'Ecuyer's MRG32k3a combined multiple recursive generator (R's RNGkind("L'Ecuyer-CMRG")).
//
// The recurrences and their constants are those of P. L'Ecuyer (1999) "Good parameters and implementations for
// combined multiple recursive random number generators" (Operations Research 47(1)). How set.seed() fills the six
// seeds, how the state maps to a uniform and which states R accepts were verified against R's ?RNG documentation and
// observed .Random.seed and runif() output (test/fixtures/rngLecuyer.json).
/** Moduli of the two components */
export const M1 = 4294967087;
export const M2 = 4294944443;
/** 1 / (M1 + 1) */
const NORM = 2.328306549295727688e-10;
/** x ↦ 69069 x + 1 (mod 2^32), the congruential generator that set.seed() uses to scramble the seed */
const lcg = (x) => (Math.imul(69069, x) + 1) >>> 0;
/**
 * MRG32k3a state: s[0..2] for the first component (mod M1), s[3..5] for the second (mod M2), oldest first.
 * Reading and checking R's .Random.seed are separate functions (below), so that they are left out of bundles
 * that do not use them
 */
export class Mrg32k3a {
    s = new Float64Array(6);
    /** Set the same state as R's set.seed(seed, kind = "L'Ecuyer-CMRG") */
    setSeed(seed) {
        // Scramble the seed 50 times, then take the following values of the same sequence, skipping those of M2 or more
        let x = seed >>> 0;
        for (let j = 0; j < 50; j++)
            x = lcg(x);
        for (let j = 0; j < 6; j++) {
            do
                x = lcg(x);
            while (x >= M2);
            this.s[j] = x;
        }
    }
    /** Uniform on (0, 1) (R's unif_rand: never 0 or 1, no further correction needed) */
    nextDouble() {
        const s = this.s;
        // Products are below 2^53, so the arithmetic is exact in doubles
        let p1 = (1403580 * s[1] - 810728 * s[0]) % M1;
        if (p1 < 0)
            p1 += M1;
        s[0] = s[1];
        s[1] = s[2];
        s[2] = p1;
        let p2 = (527612 * s[5] - 1370589 * s[3]) % M2;
        if (p2 < 0)
            p2 += M2;
        s[3] = s[4];
        s[4] = s[5];
        s[5] = p2;
        return (p1 > p2 ? p1 - p2 : p1 - p2 + M1) * NORM;
    }
}
/**
 * The six seeds of a .Random.seed for L'Ecuyer-CMRG, as unsigned integers. R accepts a state whose first three seeds
 * are below M1 and not all zero and whose last three are below M2 (and reseeds from the clock otherwise)
 */
export function checkState(state) {
    if (state.length !== 7)
        throw new RangeError("the random seed state of L'Ecuyer-CMRG must have 7 integers");
    const s = [];
    for (let i = 1; i <= 6; i++) {
        const v = state[i];
        if (!Number.isInteger(v) || v < -2147483648 || v > 4294967295)
            throw new RangeError("the random seed state must hold 32-bit integers");
        s.push(v >>> 0);
    }
    if ((s[0] === 0 && s[1] === 0 && s[2] === 0) || s.slice(0, 3).some((v) => v >= M1) || s.slice(3).some((v) => v >= M2)) {
        throw new RangeError("invalid L'Ecuyer-CMRG state: the first three seeds must be below 4294967087 and not all zero, the last three below 4294944443");
    }
    return s;
}
