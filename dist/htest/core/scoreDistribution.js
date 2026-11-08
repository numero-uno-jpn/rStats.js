// Exact permutation distributions of sums of scores, for the conditional (tied or Pratt) exact Wilcoxon tests of
// wilcoxTest.
//
// Written for rStats.js from the definitions (the conditional distributions that Streitberg and Röhmel's shift
// algorithm computes, JASA 81, 1986; no ported code). The scores are mid-ranks, multiples of 1/2; with f = 1 when all
// are integers and f = 2 otherwise, the integer scores a_j = f score_j index the table.
// - Signed rank: each score is counted with probability 1/2, independently. The probability function of the sum is
//   the coefficient list of prod_j (1 + t^{a_j}) / 2, built one factor at a time with the halving in each step, so
//   that the entries stay probabilities (2^-k for k scores, exact for dyadic cases) and nothing overflows.
// - Rank sum: the m positions of the first sample are a uniformly random m-subset of the N scores. After the first i
//   scores (ascending), P_i(j, s), the probability that a random j-subset of them sums to s, follows
//   P_i(j, s) = (j / i) P_{i-1}(j - 1, s - a_i) + ((i - j) / i) P_{i-1}(j, s): convex combinations of probabilities,
//   so no counts (C(100, 50) = 1e29) and no cancellation. Only k = min(m, N - m) rows are needed (the other sample's
//   sum is the total minus this one), and a row j only while it can still reach k.
// Tails are cumulative sums of positive terms from either end, so small upper tails keep their digits (R's 1 - lower
// tail elsewhere).
/** Largest table (doubles in one array; CONTRIBUTING rule 4) */
export const MAX_SCORE_TABLE = 2 ** 24;
/** f and the integer scores f score_j, ascending */
function integerScores(scores) {
    const f = scores.every((s) => Number.isInteger(s)) ? 1 : 2;
    return [f, scores.map((s) => s * f).sort((a, b) => a - b)];
}
/** Key of the multiset of scores (for caching distributions) */
export function scoreKey(scores) {
    return [...scores].sort((a, b) => a - b).join(",");
}
function withTails(f, offset, p) {
    const len = p.length;
    const lower = new Float64Array(len);
    const upper = new Float64Array(len);
    let s = 0;
    for (let i = 0; i < len; i++)
        lower[i] = s += p[i];
    s = 0;
    for (let i = len - 1; i >= 0; i--)
        upper[i] = s += p[i];
    return { f, offset, lower, upper };
}
/** Steps and table length of signedScoreDistribution for these scores */
export function signedScoreCost(scores) {
    const [, a] = integerScores(scores);
    let cur = 0;
    let steps = 0;
    for (const v of a)
        steps += cur += v;
    return { steps, size: cur + 1 };
}
/** Distribution of the sum of the scores with random signs (the scores counted with probability 1/2 each) */
export function signedScoreDistribution(scores) {
    const [f, a] = integerScores(scores);
    let total = 0;
    for (const v of a)
        total += v;
    const p = new Float64Array(total + 1);
    p[0] = 1;
    let cur = 0;
    for (const v of a) {
        cur += v;
        for (let s = cur; s >= v; s--)
            p[s] = 0.5 * (p[s] + p[s - v]);
        for (let s = v - 1; s >= 0; s--)
            p[s] = 0.5 * p[s];
    }
    return withTails(f, 0, p);
}
/** Steps and largest row of rankSumScoreDistribution for these scores and first-sample size m */
export function rankSumScoreCost(scores, m) {
    const [, a] = integerScores(scores);
    const N = a.length;
    const k = Math.min(m, N - m);
    const pre = prefix(a);
    let steps = 0;
    for (let i = 1; i <= N; i++) {
        for (let j = Math.max(1, k - (N - i)); j <= Math.min(i, k); j++)
            steps += pre[i] - pre[i - j] - pre[j] + 1;
    }
    return { steps, size: pre[N] - pre[N - k] - pre[k] + 1 };
}
function prefix(a) {
    const pre = [0];
    for (const v of a)
        pre.push(pre[pre.length - 1] + v);
    return pre;
}
/**
 * Distribution of W = (sum of the scores of a random m-subset) - m (m + 1) / 2, the rank sum statistic given the
 * pooled scores
 */
export function rankSumScoreDistribution(scores, m) {
    const [f, a] = integerScores(scores);
    const N = a.length;
    const k = Math.min(m, N - m);
    const pre = prefix(a);
    // row j: sums of j-subsets, from pre[j] (the j smallest) to the sum of the j largest
    const rows = [];
    for (let j = 0; j <= k; j++)
        rows.push(new Float64Array(pre[N] - pre[N - j] - pre[j] + 1));
    rows[0][0] = 1;
    for (let i = 1; i <= N; i++) {
        const ai = a[i - 1];
        for (let j = Math.min(i, k); j >= Math.max(1, k - (N - i)); j--) {
            const row = rows[j];
            const prev = rows[j - 1];
            const wNew = j / i;
            const wOld = (i - j) / i;
            const lo = pre[j];
            const hi = pre[i] - pre[i - j];
            // P_{i-1}(j - 1, .) lives on [pre[j - 1], pre[i - 1] - pre[i - j]], so s - a_i on [pre[j - 1] + a_i, hi]
            const shift = pre[j - 1] + ai;
            const from = Math.max(lo, shift);
            for (let s = hi; s >= from; s--)
                row[s - lo] = wOld * row[s - lo] + wNew * prev[s - shift];
            for (let s = from - 1; s >= lo; s--)
                row[s - lo] = wOld * row[s - lo];
        }
    }
    const row = rows[k];
    const base = (m * (m + 1)) / 2;
    if (k === m)
        return withTails(f, pre[k] / f - base, row);
    // the subsets were of the other sample: the first sample's sum is the total minus theirs (reversed)
    const len = row.length;
    const rev = new Float64Array(len);
    for (let i = 0; i < len; i++)
        rev[i] = row[len - 1 - i];
    const hiK = pre[N] - pre[N - k];
    return withTails(f, (pre[N] - hiK) / f - base, rev);
}
/** P(S < q + 1e-8), at most 1 (R's tail convention for the conditional distributions) */
export function lowerTail(d, q) {
    const last = Math.ceil(d.f * (q - d.offset) + d.f * 1e-8) - 1;
    if (last < 0)
        return 0;
    if (last >= d.lower.length)
        return 1;
    return Math.min(1, d.lower[last]);
}
/**
 * P(S >= q + 1e-8): as R 4.6.2, 1 - P(S < q + 1e-8), except within 1/64 of the upper end of the lower tail (R's
 * absolute threshold), where it is summed directly and keeps the digits of a small upper tail
 */
export function upperTail(d, q) {
    const L = lowerTail(d, q);
    if (Math.abs(L - 1) >= 1 / 64)
        return 1 - L;
    const first = Math.ceil(d.f * (q - d.offset) + d.f * 1e-8);
    if (first >= d.upper.length)
        return 0;
    return Math.min(1, d.upper[Math.max(0, first)]);
}
