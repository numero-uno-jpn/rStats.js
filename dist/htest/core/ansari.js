// Exact null distribution of the Ansari-Bradley statistic, for ansari.test.
//
// Written for rStats.js from the definition (Ansari and Bradley, Annals of Mathematical Statistics 31, 1960; no
// ported code). The N = m + n pooled observations get the scores a_i = min(i, N + 1 - i) by rank, and the statistic
// is the sum of the scores of the first sample. Without ties every set of m ranks is equally likely, so the
// distribution follows from choosing a random m-subset position by position: at position t with r picks left among
// N - t + 1 positions, the position is picked with probability r / (N - t + 1). The probabilities are kept directly
// (counts overflow: C(100, 50) = 1e29), and tail probabilities are sums of positive terms.
const cache = new Map();
function ansariDist(m, n) {
    const key = `${m},${n}`;
    const hit = cache.get(key);
    if (hit !== undefined)
        return hit;
    const N = m + n;
    const scores = [];
    for (let i = 1; i <= N; i++)
        scores.push(Math.min(i, N + 1 - i));
    const maxSum = scores.reduce((a, b) => a + b, 0);
    // P[r][s]: probability of r picks so far with score sum s (rows r = 0..m)
    let P = Array.from({ length: m + 1 }, () => new Float64Array(maxSum + 1));
    P[0][0] = 1;
    for (let t = 0; t < N; t++) {
        const left = N - t; // positions not yet decided, including this one
        const a = scores[t];
        const Q = Array.from({ length: m + 1 }, () => new Float64Array(maxSum + 1));
        for (let r = 0; r <= m; r++) {
            const row = P[r];
            const need = m - r;
            if (need > left)
                continue;
            const pick = need / left;
            for (let s = 0; s <= maxSum; s++) {
                const v = row[s];
                if (v === 0)
                    continue;
                if (need > 0)
                    Q[r + 1][s + a] += v * pick;
                if (need < left)
                    Q[r][s] += v * (1 - pick);
            }
        }
        P = Q;
    }
    const full = P[m];
    let lo = 0;
    while (lo < full.length && full[lo] === 0)
        lo++;
    let hi = full.length - 1;
    while (hi > lo && full[hi] === 0)
        hi--;
    const dist = { min: lo, probs: full.slice(lo, hi + 1) };
    cache.set(key, dist);
    return dist;
}
/**
 * P(AB <= q) (lowerTail) or P(AB > q) for the Ansari-Bradley statistic with sample sizes m and n, without ties.
 *
 * @param q - Value of the statistic.
 * @param m - Size of the first sample.
 * @param n - Size of the second sample.
 * @param lowerTail - `true` for P(AB <= q), `false` for P(AB > q).
 */
export function pansariExact(q, m, n, lowerTail = true) {
    if (Number.isNaN(q) || !(m >= 1) || !(n >= 1) || m !== Math.floor(m) || n !== Math.floor(n))
        return NaN;
    const { min, probs } = ansariDist(m, n);
    const k = Math.floor(q + 1e-7) - min; // index of the largest value <= q
    let s = 0;
    if (lowerTail) {
        for (let i = 0; i <= Math.min(k, probs.length - 1); i++)
            s += probs[i];
    }
    else {
        for (let i = Math.max(k + 1, 0); i < probs.length; i++)
            s += probs[i];
    }
    return Math.min(s, 1);
}
/**
 * P(AB = x) for the Ansari-Bradley statistic with sample sizes m and n, without ties.
 */
export function dansariExact(x, m, n) {
    if (Number.isNaN(x) || !(m >= 1) || !(n >= 1) || m !== Math.floor(m) || n !== Math.floor(n))
        return NaN;
    if (x !== Math.floor(x))
        return 0;
    const { min, probs } = ansariDist(m, n);
    const i = x - min;
    return i >= 0 && i < probs.length ? probs[i] : 0;
}
/**
 * The smallest q with P(AB <= q) >= p (quantile of the Ansari-Bradley statistic), without ties. A relative slack of
 * 64 ε on p keeps p = P(AB <= q) itself from being missed by rounding.
 */
export function qansariExact(p, m, n) {
    if (Number.isNaN(p) || p < 0 || p > 1 || !(m >= 1) || !(n >= 1))
        return NaN;
    const { min, probs } = ansariDist(m, n);
    if (p > 0.5) {
        // Compare the small upper tail P(AB > q) <= 1 - p instead, so that the tiny probabilities at the top are not
        // lost to the rounding of a cumulative sum near 1 (p = 1 must give the maximum)
        const target = (1 - p) * (1 + 64 * Number.EPSILON);
        let up = 0;
        for (let i = probs.length - 1; i >= 0; i--) {
            // up = P(AB > min + i)
            if (up > target)
                return min + i + 1;
            up += probs[i];
        }
        return min;
    }
    const target = p * (1 - 64 * Number.EPSILON);
    let s = 0;
    for (let i = 0; i < probs.length; i++) {
        s += probs[i];
        if (s >= target)
            return min + i;
    }
    return min + probs.length - 1;
}
