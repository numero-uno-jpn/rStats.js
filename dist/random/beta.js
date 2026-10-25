// Beta random variates.
//
// Cheng (1978) "Generating beta variates with nonintegral shape parameters"
// (Comm. ACM 21(4)): algorithm BB (min(a, b) > 1) and BC (min(a, b) <= 1).
// These are the algorithms cited in R's ?rbeta, with the constants from the paper. The order in which uniforms
// are consumed and the parameter handling follow observed R output.
import { unifRand } from "./rng.js";
import { generate } from "./common.js";
import { rchisq } from "./gamma.js";
/** The value of log(DBL_MAX) (1024 log 2) */
const EXPMAX = 1024 * Math.LN2;
let beta = 0, gamma = 0, delta = 0, k1 = 0, k2 = 0;
let olda = -1, oldb = -1;
/** v = beta log(u1 / (1 - u1)) and w = aa e^v (DBL_MAX on overflow) */
function vw(u1, aa) {
    const v = beta * Math.log(u1 / (1 - u1));
    if (v <= EXPMAX) {
        let w = aa * Math.exp(v);
        if (!Number.isFinite(w))
            w = Number.MAX_VALUE;
        return [v, w];
    }
    return [v, Number.MAX_VALUE];
}
/** One beta variate (shape1 aa, shape2 bb) */
export function rbeta1(aa, bb) {
    if (Number.isNaN(aa) || Number.isNaN(bb) || aa < 0 || bb < 0)
        return NaN;
    if (!Number.isFinite(aa) && !Number.isFinite(bb))
        return 0.5;
    if (aa === 0 && bb === 0)
        return unifRand() < 0.5 ? 0 : 1;
    if (!Number.isFinite(aa) || bb === 0)
        return 1;
    if (!Number.isFinite(bb) || aa === 0)
        return 0;
    const qsame = olda === aa && oldb === bb;
    if (!qsame) {
        olda = aa;
        oldb = bb;
    }
    const a = Math.min(aa, bb);
    const b = Math.max(aa, bb);
    const alpha = a + b;
    let v, w;
    if (a <= 1) {
        // Algorithm BC
        if (!qsame) {
            beta = 1 / a;
            delta = 1 + b - a;
            k1 = (delta * (0.0138889 + 0.0416667 * a)) / (b * beta - 0.777778);
            k2 = 0.25 + (0.5 + 0.25 / delta) * a;
        }
        for (;;) {
            const u1 = unifRand();
            const u2 = unifRand();
            let z;
            if (u1 < 0.5) {
                const y = u1 * u2;
                z = u1 * y;
                if (0.25 * u2 + z - y >= k1)
                    continue;
            }
            else {
                z = u1 * u1 * u2;
                if (z <= 0.25) {
                    [v, w] = vw(u1, b);
                    break;
                }
                if (z >= k2)
                    continue;
            }
            [v, w] = vw(u1, b);
            if (alpha * (Math.log(alpha / (a + w)) + v) - 1.3862944 >= Math.log(z))
                break;
        }
        return aa === a ? a / (a + w) : w / (a + w);
    }
    // Algorithm BB
    if (!qsame) {
        beta = Math.sqrt((alpha - 2) / (2 * a * b - alpha));
        gamma = a + 1 / beta;
    }
    let r, t;
    do {
        const u1 = unifRand();
        const u2 = unifRand();
        [v, w] = vw(u1, a);
        const z = u1 * u1 * u2;
        r = gamma * v - 1.3862944;
        const s = a + r - w;
        if (s + 2.609438 >= 5 * z)
            break;
        t = Math.log(z);
        if (s > t)
            break;
    } while (r + alpha * Math.log(alpha / (b + w)) < t);
    return aa !== a ? b / (b + w) : w / (b + w);
}
/**
 * Random numbers from the beta distribution. Equivalent to R's `rbeta()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param shape1 First shape parameter.
 * @param shape2 Second shape parameter.
 * @param options.ncp Non-centrality parameter. If omitted, the central distribution is used.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 */
export function rbeta(n, shape1, shape2, options = {}) {
    const { ncp } = options;
    if (ncp === undefined)
        return generate(n, () => rbeta1(shape1, shape2));
    // Noncentral beta: as in R, generate n draws X ~ noncentral χ²(2 shape1, ncp), then n draws Y ~ χ²(2 shape2), and return X / (X + Y)
    const x = rchisq(n, 2 * shape1, { ncp });
    const y = rchisq(n, 2 * shape2);
    return x.map((xi, i) => xi / (xi + y[i]));
}
