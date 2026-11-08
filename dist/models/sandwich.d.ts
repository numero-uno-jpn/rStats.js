import { type GlmResult } from "./glm.js";
import { type LmResult } from "./lm.js";
/**
 * A fit that {@link vcovHC}, {@link vcovCL}, {@link coeftest} and {@link coefci} take: the result of {@link lm} (from a
 * matrix or a formula) or of {@link glm}.
 *
 * @category Linear models and ANOVA
 */
export type RobustFit = LmResult | GlmResult;
/**
 * A covariance matrix of the coefficients that are not aliased, with their names: the result of {@link vcovHC} and
 * {@link vcovCL}.
 *
 * @category Linear models and ANOVA
 */
export interface VcovResult {
    /** The covariance matrix (k × k, k the number of coefficients that are not aliased), or the meat with `sandwich: false`. */
    vcov: number[][];
    /**
     * The names of its rows and columns: the coefficient names of a formula fit, else `"(Intercept)"`, `"x1"`, `"x2"`,
     * ... (aliased coefficients left out).
     */
    names: string[];
    /** R's warnings. */
    warnings: string[];
}
/**
 * Types of {@link vcovHC}.
 *
 * @category Linear models and ANOVA
 */
export type VcovHCType = "const" | "HC" | "HC0" | "HC1" | "HC2" | "HC3" | "HC4" | "HC4m" | "HC5";
/**
 * Options for {@link vcovHC}.
 *
 * @category Linear models and ANOVA
 */
export interface VcovHCOptions {
    /**
     * The estimator: `"HC3"` (default), `"const"`, `"HC0"` (alias `"HC"`), `"HC1"`, `"HC2"`, `"HC4"`, `"HC4m"` or
     * `"HC5"`. Unambiguous abbreviations are accepted, as R's `match.arg`.
     */
    type?: VcovHCType;
    /**
     * The weights omega_i of the meat instead of the type's: an array of one value per row of non-zero weight (or one per
     * row used, those of weight 0 then left out), or a function `(res, hat, df) => omega` of the residual factors, the
     * hat values and n - k.
     */
    omega?: readonly number[] | ((res: number[], hat: number[], df: number) => readonly number[]);
    /** Return the sandwich (default `true`) or the meat only (`false`). */
    sandwich?: boolean;
}
/**
 * Types of {@link vcovCL}.
 *
 * @category Linear models and ANOVA
 */
export type VcovCLType = "HC" | "HC0" | "HC1" | "HC2" | "HC3";
/**
 * A cluster label: a number, a string or a boolean (`null`, `undefined` and NaN are missing, an error).
 *
 * @category Linear models and ANOVA
 */
export type ClusterLabel = number | string | boolean | null | undefined;
/**
 * Options for {@link vcovCL}.
 *
 * @category Linear models and ANOVA
 */
export interface VcovCLOptions {
    /**
     * The clusters: one label per input row of the fit (the rows the fit dropped for a missing value are dropped here
     * too), an array or a typed array, or for multi-way clustering an array of such arrays, one per clustering
     * dimension. Default: every observation its own cluster.
     */
    cluster?: readonly ClusterLabel[] | Float64Array | Int32Array | readonly (readonly ClusterLabel[] | Float64Array | Int32Array)[];
    /** `"HC0"` (alias `"HC"`), `"HC1"`, `"HC2"` or `"HC3"`. Default `"HC1"` for an lm fit and `"HC0"` for a glm fit, as sandwich. */
    type?: VcovCLType;
    /** Multiply each clustering term by G / (G - 1), G its number of clusters. Default `true`. */
    cadjust?: boolean;
    /** Multi-way clustering: use clusters of one observation for the intersection of all dimensions. Default `false`. */
    multi0?: boolean;
    /** Set negative eigenvalues of the result to 0. Default `false`. */
    fix?: boolean;
    /** Return the sandwich (default `true`) or the meat only (`false`). */
    sandwich?: boolean;
}
/**
 * A covariance in units of powers of 2: V_ab = mant_ab 2^(exp_a + exp_b). Kept by the matrix returned (whose entries
 * are those values rounded to double, Infinity or 0 where they are not representable), so that coeftest and coefci
 * take the standard errors sqrt(mant_aa) 2^exp_a, which are representable where V is not (responses near 1e±300)
 */
export interface ScaledVcov {
    mant: number[][];
    exp: number[];
}
export declare const scaledVcovs: WeakMap<object, ScaledVcov>;
/**
 * The standard error of row j of a covariance matrix kept in scaledVcovs: sqrt(mant_jj) 2^exp_j, or undefined if the
 * matrix has no record or was changed since
 */
export declare function scaledStandardError(V: object, j: number, entry: number): number | undefined;
export declare function isGlm(fit: RobustFit): fit is GlmResult;
export declare function checkFit(fit: unknown): asserts fit is RobustFit;
export declare function coefficientNames(fit: RobustFit): string[];
/**
 * The model-based covariance of the coefficients that are not aliased (R's vcov(fit) without the NA rows): sigma^2 A
 * for an lm, the dispersion of summary.glm times A for a glm, with A = (X'WX)^-1 from the fit's QR factor. Formed as
 * inv_ab d~ 2^(x - e_a - e_b - shift) with the dispersion d = d~ 2^x (x even), so that the standard errors are
 * representable where sigma^2 or the covariance is not (the same bits as A d wherever that is in range)
 */
export declare function modelCovariance(fit: RobustFit): {
    vcov: number[][];
    names: string[];
};
/**
 * Heteroskedasticity-consistent covariance matrix of the coefficients of an `lm` or `glm` fit. Equivalent to R's
 * `sandwich::vcovHC()`.
 *
 * The sandwich A (X' diag(omega) X) A (Zeileis 2006), A = (X'WX)^-1, with omega_i = res_i^2 (HC0, White 1980), times n
 * / (n - k) (HC1), divided by 1 - h_i (HC2) or (1 - h_i)^2 (HC3, MacKinnon and White 1985), by (1 - h_i)^delta_i
 * (HC4, Cribari-Neto 2004; HC4m, Cribari-Neto and da Silva 2011) or by its square root (HC5, Cribari-Neto et al.
 * 2007), with HC4m's gamma = (1, 1.5) and HC5's k = 0.7 fixed as in sandwich; res_i is w_i e_i for an lm and W_i z_i /
 * phi_s for a glm (working weights and residuals). `"const"` is the model-based covariance of the fit (R's `vcov(fit)`:
 * sigma^2 A, or the dispersion times A for a glm); sandwich's `"const"` equals it only for an unweighted lm.
 *
 * Rows of prior weight 0 are left out (R counts them in n and returns different values); a hat value of 1 gives R's
 * warning, and with HC2 to HC5, whose value is then undefined (R's NaN), an error, as is HC1 with as many
 * observations as coefficients. Aliased coefficients are left out of the matrix. Data far from 1 (weights, responses)
 * are handled in units of powers of 2: entries that are not representable are Infinity or 0, and {@link coeftest}
 * still gives their standard errors, from a record kept with the matrix object returned (a copy of the matrix loses it:
 * pass the result or its original matrix). See docs/differences-from-r.md.
 *
 * @param fit The result of {@link lm} or {@link glm}.
 *
 * @example
 * ```ts
 * const fit = lm([1, 2, 3, 4, 5, 6], [1.1, 2.3, 2.8, 4.5, 4.9, 6.4]);
 * vcovHC(fit).vcov; // [[0.043766, -0.01134], [-0.01134, 0.0045125]] (HC3)
 * vcovHC(fit, { type: "HC0" }).names; // ["(Intercept)", "x1"]
 * ```
 *
 * @category Linear models and ANOVA
 */
export declare function vcovHC(fit: RobustFit, options?: VcovHCOptions): VcovResult;
/**
 * Clustered covariance matrix of the coefficients of an `lm` or `glm` fit. Equivalent to R's
 * `sandwich::vcovCL()`.
 *
 * The meat sums the estimating functions within each cluster (Zeileis, Köll and Graham 2020), times G / (G - 1) with
 * `cadjust`; HC1 multiplies by (n - 1) / (n - k). Several clustering dimensions are combined by inclusion and exclusion
 * over all their intersections, each term with its own G (Cameron, Gelbach and Miller 2011); `multi0` uses clusters of
 * one observation for the full intersection. HC2 and HC3 adjust each cluster's residuals by (I - H_gg)^-1/2 or
 * (I - H_gg)^-1 in the symmetric form of Bell and McCaffrey (2002) (for HC3 the leave-one-cluster-out jackknife),
 * which is sandwich's for an unweighted lm; sandwich transposes the adjustment for a weighted lm or a glm. A singular
 * block (cluster fixed effects) is an error. `fix` sets negative eigenvalues to 0.
 *
 * The default type is HC1 for an lm and HC0 for a glm, as sandwich. Without `cluster` each observation is its own
 * cluster. G is the number of distinct labels among the rows used (labels are compared as text, numbers with 15
 * significant digits as R's `as.character`: 1 and 1 + 2^-52, or 0.1 + 0.2 and 0.3, are one label); intersections of
 * dimensions are tuples of labels; at least two clusters are needed. Rows of prior weight 0 are left out. HC1 needs
 * more observations than coefficients. Data far from 1 as {@link vcovHC} (the same record of the units, lost by a copy
 * of the matrix); with `fix`, a negative eigenvalue is set to 0 in the units of the largest coefficient's variance, so
 * that coefficients whose scale is about 2^537 or more below it then get variance 0. See docs/differences-from-r.md.
 *
 * @param fit The result of {@link lm} or {@link glm}.
 *
 * @example
 * ```ts
 * const fit = lm([1, 2, 3, 4, 5, 6, 7, 8], [1.2, 1.9, 3.2, 3.8, 5.3, 5.9, 7.1, 8.2]);
 * vcovCL(fit, { cluster: ["a", "a", "b", "b", "c", "c", "d", "d"] }).vcov;
 * // [[0.002257, -0.00053463], [-0.00053463, 0.00016363]] (HC1)
 * ```
 *
 * @category Linear models and ANOVA
 */
export declare function vcovCL(fit: RobustFit, options?: VcovCLOptions): VcovResult;
