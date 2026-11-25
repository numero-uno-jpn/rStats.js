import { type CoxphTest } from "./coxph.js";
import type { GroupLabel } from "../htest/groups.js";
/** Options of {@link clogit}. Equivalent to the arguments of survival's `clogit()`.
 * @category Survival analysis
 */
export interface ClogitOptions {
    /** The likelihood: `"exact"` (default, R's), or `"approximate"` / `"breslow"` (the Cox likelihood with Breslow's ties). */
    method?: "exact" | "approximate" | "breslow";
    /** Confidence level of the intervals of exp(coef). Default 0.95. */
    confLevel?: number;
    /** Convergence: relative change of the log likelihood (default 1e-9) and the most iterations (default 20). */
    control?: {
        /** Tolerance of the relative change of the log likelihood. Default 1e-9. */
        eps?: number;
        /** Most iterations. Default 20. */
        iterMax?: number;
    };
}
/** Result of {@link clogit}: the fields of R's `clogit` fit and of its `summary()`.
 * @category Survival analysis
 */
export interface ClogitResult {
    /** Coefficients. */
    coefficients: number[];
    /** Variance matrix of the coefficients (array of rows). */
    var: number[][];
    /** Log conditional likelihood at 0 and at the end. */
    loglik: [number, number];
    /** Score test statistic at 0. */
    score: number;
    /** Wald statistic. */
    wald: number;
    /** Number of iterations. */
    iter: number;
    /** Number of observations. */
    n: number;
    /** Number of cases. */
    nevent: number;
    /** `"exact"` or `"breslow"` (R's `method`). */
    method: "exact" | "breslow";
    /** Standard errors. */
    se: number[];
    /** Wald z statistics. */
    z: number[];
    /** Two-sided p-values. */
    p: number[];
    /** Lower confidence limits of exp(coef). */
    lower: number[];
    /** Upper confidence limits of exp(coef). */
    upper: number[];
    /** Likelihood ratio test. */
    logtest: CoxphTest;
    /** Score test. */
    sctest: CoxphTest;
    /** Wald test (the statistic unrounded; R's `summary()` prints it rounded to 2 decimals). */
    waldtest: CoxphTest;
    /** Warnings (R's, e.g. when the iterations ran out). */
    warnings: string[];
}
type Label = GroupLabel;
/**
 * Conditional logistic regression for matched sets (1:1, 1:M or several cases per set). Equivalent to
 * `survival::clogit()` in R. The call followed is `clogit(y ~ x1 + ... + strata(set), method)`.
 *
 * `y` is 1 for a case and 0 for a control, `x` one row of covariates per observation, `strata` the matched set of
 * each observation (for matched pairs from {@link match}, the pair number). Sets with only cases or only controls
 * carry no information. `"exact"` (R's default) uses the exact conditional likelihood, summing over the subsets of each
 * set with as many members as it has cases; `"approximate"` is Breslow's approximation, the same as {@link coxph}
 * with equal times, `ties: "breslow"` and these strata.
 * @category Survival analysis
 * @example
 * ```ts
 * const y = [1, 0, 1, 0, 1, 0, 0, 1];
 * const x = [[1], [0], [1], [0], [0], [0], [1], [0]];
 * const fit = clogit(y, x, [1, 1, 2, 2, 3, 3, 4, 4]);
 * fit.coefficients; // [0.6931471805599454] (log 2: two discordant pairs for x, one against)
 * ```
 */
export declare function clogit(y: readonly number[], x: readonly (readonly number[])[], strata: readonly Label[], options?: ClogitOptions): ClogitResult;
export {};
