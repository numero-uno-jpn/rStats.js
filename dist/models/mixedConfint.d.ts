import { type GlmerResult } from "./glmer.js";
import { type LmerResult } from "./lmer.js";
/** Options of {@link confintLmer} and {@link confintGlmer}.
 *
 * @category Mixed models
 */
export interface MixedConfintOptions {
    /** Two-sided confidence level. Default 0.95. */
    level?: number;
    /** "profile" (default) or "Wald" (fixed effects only). */
    method?: "profile" | "Wald";
    /** Parameter names, one-based positions, "theta_" (variance parameters), or "beta_" (fixed effects). */
    parm?: string | number | readonly (string | number)[];
    /** Use lme4's .sig01 names (default), or descriptive standard-deviation and correlation names. */
    signames?: boolean | number;
}
/** Confidence intervals from a mixed-model fit. Missing limits are NaN.
 *
 * @category Mixed models
 */
export interface MixedConfintResult {
    /** Parameter names in the same order as the limits. */
    names: string[];
    /** Lower confidence limits. */
    lower: number[];
    /** Upper confidence limits. */
    upper: number[];
    /** Warnings from profiling or parameter selection. */
    warnings: string[];
}
/**
 * Confidence intervals for a linear mixed-model fit. Equivalent to `lme4::confint.merMod()` in R.
 *
 * @category Mixed models
 */
export declare function confintLmer(fit: LmerResult, options?: MixedConfintOptions): MixedConfintResult;
/**
 * Confidence intervals for a generalized linear mixed-model fit. Equivalent to R's `lme4::confint.merMod()`.
 *
 * @category Mixed models
 */
export declare function confintGlmer(fit: GlmerResult, options?: MixedConfintOptions): MixedConfintResult;
