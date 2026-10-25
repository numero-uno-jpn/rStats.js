// Independent streams and substreams of L'Ecuyer-CMRG: R's parallel::nextRNGStream() and nextRNGSubStream().
//
// Jumping ahead by 2^127 (stream) or 2^76 (substream) steps multiplies each component's state vector by a power of
// its transition matrix, modulo the component's modulus. The matrices are those published in P. L'Ecuyer,
// R. Simard, E. J. Chen and W. D. Kelton (2002) "An object-oriented random-number package with many long streams
// and substreams" (Operations Research 50(6)); test/random-kinds.test.ts recomputes them from the recurrences of
// L'Ecuyer (1999). The layout of the state (R's .Random.seed) follows test/fixtures/rngStreams.json.
import { M1, M2, checkState } from "./lecuyer.js";
// Row by row; A1 acts on the first component (mod M1), A2 on the second (mod M2)
const A1P76 = [82758667, 1871391091, 4127413238, 3672831523, 69195019, 1871391091, 3672091415, 3528743235, 69195019];
const A2P76 = [1511326704, 3759209742, 1610795712, 4292754251, 1511326704, 3889917532, 3859662829, 4292754251, 3708466080];
const A1P127 = [2427906178, 3580155704, 949770784, 226153695, 1230515664, 3580155704, 1988835001, 986791581, 1230515664];
const A2P127 = [1464411153, 277697599, 1610723613, 32183930, 1464411153, 1022607788, 2824425944, 32183930, 2093834863];
/** a b mod m for a, b below 2^32, exactly (splitting b into 16-bit halves keeps every product below 2^53) */
function mulMod(a, b, m) {
    const hi = Math.floor(b / 65536);
    return (((a * hi) % m) * 65536 + a * (b - hi * 65536)) % m;
}
function jump(state, a1, a2) {
    const code = state[0];
    if (!Number.isInteger(code) || code % 100 !== 7)
        throw new RangeError("the state must be a .Random.seed of L'Ecuyer-CMRG (kind code ending in 07)");
    const s = checkState(state);
    const out = new Int32Array(7);
    out[0] = code;
    for (let c = 0; c < 2; c++) {
        const a = c === 0 ? a1 : a2;
        const m = c === 0 ? M1 : M2;
        for (let i = 0; i < 3; i++) {
            let t = 0;
            for (let j = 0; j < 3; j++)
                t = (t + mulMod(a[3 * i + j], s[3 * c + j], m)) % m;
            out[1 + 3 * c + i] = t | 0;
        }
    }
    return out;
}
/**
 * The start of the next stream of L'Ecuyer-CMRG: the state advanced by 2^127 steps.
 * Equivalent to R's `parallel::nextRNGStream()`.
 *
 * Streams started this way do not overlap for any practical length, so each parallel task
 * (a worker, or one replicate of a simulation) can be given its own stream, reproducibly.
 * Within a stream, {@link nextRNGSubStream} gives substreams of 2^76 steps.
 *
 * @param state A 7-integer state as returned by {@link getRandomSeed} after
 *   `RNGkind({ kind: "L'Ecuyer-CMRG" })`, or copied from R's `.Random.seed`.
 * @returns A new state of the same form (the first element, the kind code, is unchanged).
 *   Pass it to {@link setRandomSeed} to draw from that stream.
 * @throws RangeError if `state` is not a valid L'Ecuyer-CMRG state.
 *
 * @example
 * ```ts
 * RNGkind({ kind: "L'Ecuyer-CMRG" });
 * setSeed(1);
 * const s1 = getRandomSeed();
 * const s2 = nextRNGStream(s1); // R: s2 <- parallel::nextRNGStream(.Random.seed)
 * setRandomSeed(s2);
 * runif(2); // [0.31369782407981056, 0.9280126525616814]
 * ```
 */
export function nextRNGStream(state) {
    return jump(state, A1P127, A2P127);
}
/**
 * The start of the next substream of L'Ecuyer-CMRG: the state advanced by 2^76 steps.
 * Equivalent to R's `parallel::nextRNGSubStream()`.
 *
 * @param state A 7-integer state, as for {@link nextRNGStream}.
 * @returns A new state of the same form.
 * @throws RangeError if `state` is not a valid L'Ecuyer-CMRG state.
 */
export function nextRNGSubStream(state) {
    return jump(state, A1P76, A2P76);
}
