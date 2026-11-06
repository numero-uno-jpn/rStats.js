/** Probability function of a statistic on the grid offset, offset + 1 / f, ..., with both cumulative tails */
export interface ScoreDistribution {
    /** 1 or 2: the grid step of the statistic is 1 / f */
    f: number;
    /** Statistic at index 0 */
    offset: number;
    /** lower[i] = P(index <= i) */
    lower: Float64Array;
    /** upper[i] = P(index >= i) */
    upper: Float64Array;
}
/** Largest table (doubles in one array; CONTRIBUTING rule 4) */
export declare const MAX_SCORE_TABLE: number;
/** Key of the multiset of scores (for caching distributions) */
export declare function scoreKey(scores: readonly number[]): string;
/** Steps and table length of signedScoreDistribution for these scores */
export declare function signedScoreCost(scores: readonly number[]): {
    steps: number;
    size: number;
};
/** Distribution of the sum of the scores with random signs (the scores counted with probability 1/2 each) */
export declare function signedScoreDistribution(scores: readonly number[]): ScoreDistribution;
/** Steps and largest row of rankSumScoreDistribution for these scores and first-sample size m */
export declare function rankSumScoreCost(scores: readonly number[], m: number): {
    steps: number;
    size: number;
};
/**
 * Distribution of W = (sum of the scores of a random m-subset) - m (m + 1) / 2, the rank sum statistic given the
 * pooled scores
 */
export declare function rankSumScoreDistribution(scores: readonly number[], m: number): ScoreDistribution;
/** P(S < q + 1e-8), at most 1 (R's tail convention for the conditional distributions) */
export declare function lowerTail(d: ScoreDistribution, q: number): number;
/**
 * P(S >= q + 1e-8): as R 4.6.2, 1 - P(S < q + 1e-8), except within 1/64 of the upper end of the lower tail (R's
 * absolute threshold), where it is summed directly and keeps the digits of a small upper tail
 */
export declare function upperTail(d: ScoreDistribution, q: number): number;
