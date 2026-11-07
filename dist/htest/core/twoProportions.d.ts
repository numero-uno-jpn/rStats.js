/** p1 - p2, rounded once (diffDeviation at 0) */
export declare function diffEstimate(x1: number, n1: number, x2: number, n2: number): number;
/** The maximum likelihood estimate (p1~, p2~) of two proportions under p1 - p2 = delta (see restrictedMleDiffFull) */
export declare function restrictedMleDiff(x1: number, n1: number, x2: number, n2: number, delta: number): [number, number];
/** How the variance of p1 - p2 is formed at a given difference */
export type DiffVariance = "mn" | "mee" | "wald";
/**
 * The variance of p1 - p2 used by the score statistic at the difference delta: at the restricted MLE times N/(N - 1)
 * (Miettinen-Nurminen, "mn"), at the restricted MLE ("mee", Farrington-Manning), or at the observed proportions
 * ("wald"); each 1 - p without cancellation
 */
export declare function diffVariance(x1: number, n1: number, x2: number, n2: number, delta: number, kind: DiffVariance): number;
/**
 * p1 - p2 - delta from the counts in double-double, rounded once: x1/n1 - x2/n2 in double cancels where the
 * proportions are close (each holds only its absolute precision: 1 - (1e15 - 1)/1e15 is 1e-15 off by 5%, and
 * 0.22 - 0.2 is 1e-17 off, an ulp of the limit 0.1155 of 80/100 against 78/100 at 90%)
 */
export declare function diffDeviation(x1: number, n1: number, x2: number, n2: number, delta: number): number;
/** The squared score statistic (p1 - p2 - delta)^2 / var(delta); 0 at delta = p1 - p2, Infinity where var is 0 */
export declare function diffStatistic(x1: number, n1: number, x2: number, n2: number, delta: number, kind: DiffVariance): number;
/**
 * The limits [lower, upper] of {delta in [-1, 1] : statistic(delta) <= bound} around est = p1 - p2: the roots of
 * statistic = bound below and above est (-1 or 1 where est is at the end)
 */
export declare function diffScoreLimits(x1: number, n1: number, x2: number, n2: number, bound: number, kind: DiffVariance): [number, number];
/**
 * The MLE p1~ under p1 = phi p2 (Koopman 1984): the smaller root of
 * (n1 + n2) p^2 - (phi (n1 + x2) + x1 + n2) p + phi (x1 + x2) = 0, capped at min(1, phi); p2~ = p1~ / phi. Accurate to
 * about eps absolute (the discriminant cancels where the roots are close): the start of restrictedMleRatioFull
 */
export declare function restrictedMleRatio(x1: number, n1: number, x2: number, n2: number, phi: number): [number, number];
/**
 * Koopman's statistic: Pearson's chi-squared of the two groups at the MLE under p1 = phi p2 (a 0/0 term counts 0);
 * x - n p~ is formed as n (1 - p~) - (n - x) where p~ > 1/2, with 1 - p~ from restrictedMleRatioFull
 */
export declare function ratioStatistic(x1: number, n1: number, x2: number, n2: number, phi: number): number;
/** Koopman's interval {phi : statistic(phi) <= bound} around est = p1 / p2 (not both counts 0) */
export declare function ratioScoreLimits(x1: number, n1: number, x2: number, n2: number, bound: number): [number, number];
/**
 * The MLE (p1~, p2~) under (p1/(1 - p1)) / (p2/(1 - p2)) = theta: p2~ is the root in [0, 1] of A p^2 + B p + C = 0 with
 * A = n2 (theta - 1), B = n1 theta + n2 - (x1 + x2)(theta - 1), C = -(x1 + x2), written 2(x1 + x2) / (B + sqrt(B^2 - 4AC))
 * (no cancellation, and (x1 + x2) / (n1 + n2) at theta = 1); p1~ = p2~ theta / (1 + p2~ (theta - 1))
 */
export declare function restrictedMleOddsRatio(x1: number, n1: number, x2: number, n2: number, theta: number): [number, number];
/** The score statistic of the odds ratio at theta: (x1 - n1 p1~)^2 (1/(n1 p1~ q1~) + 1/(n2 p2~ q2~)) */
export declare function oddsRatioStatistic(x1: number, n1: number, x2: number, n2: number, theta: number): number;
/** The score interval of the odds ratio around est = x1 (n2 - x2) / ((n1 - x1) x2) (est 0 or Infinity, not NaN) */
export declare function oddsRatioScoreLimits(x1: number, n1: number, x2: number, n2: number, bound: number): [number, number];
