import type { Sample } from "./types.js";
/**
 * Regression methods of {@link mcreg}.
 *
 * @category Agreement, reliability and factor analysis
 */
export type McregMethod = "PaBa" | "Deming" | "WDeming";
/**
 * Interval methods of {@link mcreg}.
 *
 * @category Agreement, reliability and factor analysis
 */
export type McregCiMethod = "analytical" | "jackknife" | "bootstrap" | "nestedbootstrap";
/**
 * Bootstrap intervals of {@link mcreg}.
 *
 * @category Agreement, reliability and factor analysis
 */
export type McregBootstrapCiMethod = "quantile" | "Student" | "BCa" | "tBoot";
/**
 * Options for {@link mcreg}.
 *
 * @category Agreement, reliability and factor analysis
 */
export interface McregOptions {
    /**
     * `"PaBa"` (Passing-Bablok, the default, as mcr), `"Deming"` or `"WDeming"` (weighted Deming, constant coefficient
     * of variation). Unambiguous abbreviations are accepted.
     */
    methodReg?: McregMethod | (string & {});
    /**
     * `"analytical"` (the default for Deming and Passing-Bablok; not available for weighted Deming), `"jackknife"` (the
     * default for weighted Deming), `"bootstrap"` or `"nestedbootstrap"`. mcr's default is `"bootstrap"`.
     */
    methodCi?: McregCiMethod | (string & {});
    /**
     * The bootstrap interval: `"quantile"` (the default), `"Student"`, `"BCa"` or `"tBoot"` (bootstrap-t: with Deming
     * or with nested resamples).
     */
    methodBootstrapCi?: McregBootstrapCiMethod | (string & {});
    /**
     * The ratio of the error variances σ²(x)/σ²(y), x the reference method (mcr's `error.ratio`; Deming and weighted
     * Deming), positive and finite. Default `1`.
     */
    errorRatio?: number;
    /** Level of the intervals, in (0, 1) (mcr's `1 - alpha`). Default `0.95`. */
    confLevel?: number;
    /** Passing-Bablok: the mean of two middle slopes as `"radian"` (tan of the mean angle, the default) or `"tangent"`. */
    slopeMeasure?: "radian" | "tangent" | (string & {});
    /** Number of bootstrap resamples, a positive integer. Default `999`. */
    nsamples?: number;
    /** Number of inner resamples of each resample for `"nestedbootstrap"`, a positive integer. Default `25`. */
    nnested?: number;
    /**
     * Seed of the resamples: the stream of R's `set.seed(rngSeed, kind = "Mersenne-Twister")`, as mcr's `rng.seed`; the
     * state of the generator is restored afterwards if it had one (in a session that never drew a random number, the
     * stream of the seed continues, as in R). Without it the resamples are drawn from the current stream.
     */
    rngSeed?: number;
    /** Weighted Deming: the largest number of iterations, a positive integer. Default `30`. */
    iterMax?: number;
    /** Weighted Deming: the iteration stops when both coefficients change by less than this (absolute). Default `1e-6`. */
    threshold?: number;
    /** Drop the pairs with `NaN` (otherwise they are an error). Default `false`. */
    naRm?: boolean;
}
/**
 * A coefficient of {@link McregResult}.
 *
 * @category Agreement, reliability and factor analysis
 */
export interface McregCoefficient {
    /** The estimate from all the data. */
    estimate: number;
    /** Its standard error (`NaN` where the method has none: Passing-Bablok analytical, bootstrap quantile and BCa). */
    se: number;
    /** The interval at `confLevel`. */
    confInt: [number, number];
}
/**
 * Result of {@link mcreg}.
 *
 * @category Agreement, reliability and factor analysis
 */
export interface McregResult {
    /** The regression method, in full. */
    methodReg: McregMethod;
    /** The interval method, in full. */
    methodCi: McregCiMethod;
    /** The bootstrap interval, in full (bootstrap methods only). */
    methodBootstrapCi?: McregBootstrapCiMethod;
    /** The level of the intervals. */
    confLevel: number;
    /** The ratio of the error variances used (1 for Passing-Bablok). */
    errorRatio: number;
    /** Number of pairs used. */
    n: number;
    /** The intercept (mcr's row `Intercept` of `@para`). */
    intercept: McregCoefficient;
    /** The slope (mcr's row `Slope` of `@para`). */
    slope: McregCoefficient;
    /** The mean of x (Deming), the weighted mean of the last iteration (weighted Deming), `NaN` (Passing-Bablok). */
    xmean: number;
    /** Weighted Deming: the weights of the last iteration (mcr's `@weight`); Infinity where beyond the double range. */
    weights?: number[];
    /** Jackknife: the leave-one-out coefficients (mcr's `@B0jack`, `@B1jack`; also for the BCa interval). */
    jackknife?: {
        /** The intercepts with each point left out (mcr's `@B0jack`). */
        intercept: number[];
        /** The slopes with each point left out (mcr's `@B1jack`). */
        slope: number[];
    };
    /**
     * Bootstrap: the coefficients of the resamples kept, in the order drawn (mcr's `@B0`, `@B1`), their standard errors
     * (`@sigmaB0`, `@sigmaB1`: the standard deviation of the nested estimates, the analytical standard error for Deming,
     * the jackknife one for weighted Deming with BCa, else `NaN`), the global standard errors (`@glob.sigma`) and the
     * number of resamples kept.
     */
    bootstrap?: {
        /** The intercepts of the resamples kept, in the order drawn (mcr's `@B0`). */
        intercept: number[];
        /** The slopes of the resamples kept (mcr's `@B1`). */
        slope: number[];
        /** The standard errors of the intercepts (mcr's `@sigmaB0`). */
        sigmaIntercept: number[];
        /** The standard errors of the slopes (mcr's `@sigmaB1`). */
        sigmaSlope: number[];
        /** The global standard errors of the intercept and the slope (mcr's `@glob.sigma`). */
        globalSigma: [number, number];
        /** The number of resamples kept. */
        nsamples: number;
    };
    /**
     * Passing-Bablok: the linearity statistic (mcr's `calcCUSUM`): the numbers of points above and below the line and
     * the largest absolute cumulative sum of their scores ordered along the line.
     */
    cusum?: {
        /** The number of points above the line. */
        nPos: number;
        /** The number of points below the line. */
        nNeg: number;
        /** The largest absolute cumulative sum of the scores ordered along the line. */
        maxCusum: number;
    };
    /** Warnings (the weighted Deming iteration not converging, degenerate resamples, an undefined interval). */
    warnings: string[];
}
/**
 * Method comparison regression of y (test method) on x (reference method): Deming, weighted Deming or Passing-Bablok
 * regression with analytical, jackknife or bootstrap intervals. Equivalent to `mcr::mcreg()` in R.
 *
 * - **Deming** (`"Deming"`): the slope minimises the squared distances in the metric of the error variances, λ =
 *   `errorRatio` = σ²(x)/σ²(y) (mcr's convention; λ → 0 gives the least-squares slope of y on x). The analytical
 *   standard errors are Strike's (1991), with t intervals on n - 2 degrees of freedom.
 * - **Weighted Deming** (`"WDeming"`): Linnet's (1990) iteration for errors proportional to the level (constant
 *   coefficient of variation), stopped as mcr when both coefficients change by less than `threshold` (absolute), with
 *   a warning when `iterMax` iterations are reached. No analytical interval (jackknife by default). Values must be
 *   positive. Since the threshold is absolute, data of very large magnitude (around 1e150) may not converge and
 *   data of very small magnitude (around 1e-150) stop after the first iteration; choose `threshold` in the units of
 *   the data.
 * - **Passing-Bablok** (`"PaBa"`): the shifted median of the n(n - 1)/2 pairwise slopes and the rank interval of
 *   Passing and Bablok (1983); the intercept is the median of y - b x and its limits those of the slope's limits.
 *   Differences below a relative 1e-12 count as ties (mcr's rule; a pair tied in x only is vertical), so data with a
 *   large offset (1e12 + O(1)) have most differences set to 0; the mean of two middle slopes is tan of the mean angle
 *   (`slopeMeasure: "radian"`, mcr's default; it changes when y is rescaled, as angles do not scale) or the mean slope
 *   (`"tangent"`). Where the interval is not defined (too few points, always for n <= 4) its limits and the
 *   intercept's are -Infinity and Infinity, with a warning. Values must not be negative. The result has the CUSUM
 *   statistic of linearity (`cusum`; no test decision).
 * - **jackknife**: the leave-one-out estimates, the standard error sd(pseudo-values)/sqrt(n) and the interval estimate
 *   ± t se on n - 2 degrees of freedom (Linnet 1993); the estimates are those of all the data.
 * - **bootstrap**: `nsamples` resamples of the pairs with replacement; `"quantile"` the percentile interval,
 *   `"Student"` estimate ± t sd(B), `"BCa"` the bias-corrected and accelerated interval (jackknife acceleration),
 *   `"tBoot"` the bootstrap-t interval with the analytical standard errors (Deming) or, with `"nestedbootstrap"`, the
 *   standard deviation of `nnested` inner resamples of each resample. Resamples with constant x or y are dropped
 *   with mcr's warning (an error when more than 5% are). The resamples are drawn as R's `sample(1:n, n, replace =
 *   TRUE)` from the current random stream, or from `set.seed(rngSeed)` as mcr's `rng.seed` (the generator's state is
 *   then restored if it had one), so the values are mcr's for the same seed. With very few points (n = 5) the
 *   bootstrap-t limits can be infinite or huge, because resamples of 2 or 3 distinct points have standard errors 0.
 *
 * Unlike mcr, the default interval is `"analytical"` (`"jackknife"` for weighted Deming) rather than a random
 * bootstrap; `confLevel` replaces mcr's `alpha` (= 1 - confLevel); 2 or fewer points, constant x or y, infinite
 * values and data whose Deming covariance is 0 are errors. Passing-Bablok's odd-position slopes are dy/dx (mcr: tan of
 * its angle, a few ulps off). PaBaLarge, LinReg, WLinReg, PBequi and TS are not offered.
 *
 * @param x Measurements by the reference method.
 * @param y Measurements by the test method, paired with `x`.
 * @param options See {@link McregOptions}.
 * @returns See {@link McregResult}.
 * @throws TypeError if `x` and `y` differ in length; RangeError for missing values without `naRm`, infinite values,
 *   fewer than 3 pairs, constant x or y, negative values (Passing-Bablok), values that are not positive (weighted
 *   Deming), more than 5793 points (Passing-Bablok), an analytical interval for weighted Deming, a bootstrap-t
 *   interval without nested resamples for Passing-Bablok or weighted Deming, too many degenerate resamples, a zero
 *   covariance (Deming), or an invalid option.
 *
 * @example
 * ```ts
 * const x = [1, 2, 3, 4, 5, 6, 7];
 * const y = [1.2, 1.9, 3.2, 3.8, 5.1, 6.4, 6.6];
 * const d = mcreg(x, y, { methodReg: "Deming" });
 * d.slope.estimate; // 0.97547950725034482
 * d.slope.confInt;  // [0.83267195599246846, 1.1182870585082212]
 * const pb = mcreg(x, y);  // Passing-Bablok
 * pb.slope.estimate;      // 0.95
 * pb.intercept.confInt;   // [-0.8524794459077718, 0.80365513709218339]
 * ```
 *
 * @category Agreement, reliability and factor analysis
 */
export declare function mcreg(x: Sample, y: Sample, options?: McregOptions): McregResult;
