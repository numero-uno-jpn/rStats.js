/**
 * Options of {@link stl}.
 *
 * @category Time series
 */
export interface StlOptions {
    /** The seasonal period (R's frequency). */
    frequency: number;
    /** The seasonal loess span (odd, >= 7 recommended) or "periodic". */
    sWindow: number | "periodic";
    sDegree?: 0 | 1;
    tWindow?: number;
    tDegree?: 0 | 1;
    lWindow?: number;
    lDegree?: 0 | 1;
    sJump?: number;
    tJump?: number;
    lJump?: number;
    robust?: boolean;
    inner?: number;
    outer?: number;
}
/**
 * Result of {@link stl}.
 *
 * @category Time series
 */
export interface StlResult {
    seasonal: number[];
    trend: number[];
    remainder: number[];
    /** The robustness weights of the last pass (all 1 without robustness iterations). */
    weights: number[];
    /** The windows (s, t, l), degrees, jumps and iteration counts used. */
    win: [number, number, number];
    deg: [number, number, number];
    jump: [number, number, number];
    inner: number;
    outer: number;
}
/**
 * Seasonal-trend decomposition by loess (Cleveland et al. 1990). Equivalent to R's `stl()`. It differs in that the
 * robustness weights use the true median of |remainder| (R takes a wrong order statistic for some even-length series:
 * R bug 19370, see the documentation's departures from R).
 *
 * @category Time series
 */
export declare function stl(x: readonly number[], options: StlOptions): StlResult;
/**
 * Friedman's super smoother (running lines with a cross-validated variable span). Equivalent to R's `supsmu()`.
 * Tied x are not handled as R does.
 *
 * @category Time series
 */
export declare function supsmu(x: readonly number[], y: readonly number[], options?: {
    span?: number | "cv";
    bass?: number;
}): {
    x: number[];
    y: number[];
};
/**
 * Result of {@link mstl}.
 *
 * @category Time series
 */
export interface MstlResult {
    data: number[];
    trend: number[];
    /** The seasonal component (absent for a non-seasonal series). */
    seasonal?: number[];
    remainder: number[];
    frequency: number;
}
/**
 * forecast's `mstl()` for one seasonal period: stl(x, s.window = 11); for a non-seasonal series (or fewer than two
 * periods) the trend is supsmu(1:n, x).
 * Equivalent to `forecast::mstl()` in R.
 *
 * @category Time series
 */
export declare function mstl(x: readonly number[], options?: {
    frequency?: number;
    sWindow?: number | "periodic";
    robust?: boolean;
}): MstlResult;
/**
 * The seasonally adjusted series of an mstl / stl decomposition (data - seasonal). Equivalent to `forecast::seasadj()` in R.
 *
 * @category Time series
 */
export declare function seasadj(dec: MstlResult): number[];
/**
 * The number of seasonal differences: 1 when the seasonal strength of mstl, max(0, 1 - var(remainder) /
 * var(seasonal + remainder)), exceeds 0.64 (test "seas"), or by the OCSB test. Equivalent to `forecast::nsdiffs()` in R.
 *
 * @category Time series
 */
export declare function nsdiffs(x: readonly number[], options: {
    frequency: number;
    test?: "seas" | "ocsb";
    maxD?: number;
}): number;
/**
 * The 5% critical value of the OCSB test for period m (the table read off R; log m interpolation beyond 400). Not an R function.
 *
 * @category Time series
 */
export declare function ocsbCritical(m: number): number;
/**
 * The Osborn-Chui-Smith-Birchenhall test for a seasonal unit root: with w = Delta_m Delta_1 y and L lags, the AR(L)
 * coefficients a of w by least squares (no mean), then the regression of w_t on w_{t-1..L} and the two auxiliary
 * series filtered by a, (1 - a(B)) Delta_m y_{t-1} and (1 - a(B)) Delta_1 y_{t-m}, without a constant; the statistic
 * is the t value of the second (log 41, 80). Equivalent to `forecast::ocsb.test()` in R. With `lagMethod` "fixed" (the
 * default) L = `maxlag` (R's default 0). With "AIC", "BIC" or "AICc" the lags 0..maxlag are compared on a common
 * sample (the rows of maxlag lags, the prefilter too) by the lm criterion with k = coefficients + 1 (AICc = AIC +
 * 2k(k + 1) / (n - k - 1), forecast's help), and the chosen L is used. **This departs from R:** forecast 9.0.2 compares
 * L = 1..maxlag that way but reports and uses one lag fewer than the chosen L (log 89-90, an off-by-one; the user's
 * decision 2026-11-27 is not to imitate it). Candidates with a perfect fit (and for AICc, n <= k + 1) are skipped.
 *
 * @category Time series
 */
export declare function ocsbTest(x: readonly number[], options: {
    frequency: number;
    maxlag?: number;
    lagMethod?: "fixed" | "AIC" | "BIC" | "AICc";
}): {
    statistic: number;
    critical: number;
    lagOrder: number;
};
