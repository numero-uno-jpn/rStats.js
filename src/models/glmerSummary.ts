// The summary of a generalized linear mixed model fitted by glmer (src/models/glmer.ts): lme4's summary() of a glmer
// fit, as numbers (the coefficient table with the normal p-values, the correlation of the fixed effects, the scaled
// residuals' quantiles, the information criteria, the variance components and the numbers of groups).
//
// Written for rStats.js (no ported code) from oracle/glmer-behaviour.md ("glmerSummary (stage 3)" and "rStats.js's
// choices"). Everything comes from the fit's fields except the quantiles of the scaled residuals and the correlation.

import { pnorm } from "../distributions/normal.js";
import { checkOptions } from "../internal/checkOptions.js";
import { reported } from "../internal/warnings.js";
import type { GlmLinkName } from "./glmFamily.js";
import type { GlmerFamilyName } from "./glmerFamily.js";
import { glmerInternals, VCOV_FALLBACK, type GlmerResult } from "./glmer.js";
import { checkLmerOptions, type LmerVarCorr } from "./lmer.js";

/**
 * Options of {@link glmerSummary}: there is none yet. R's `correlation`, `use.hessian` and `useHessian` give the
 * Error `glmerSummary: argument '<key>' is not supported`, any other key a RangeError.
 *
 * @category Mixed models
 */
export interface GlmerSummaryOptions {}

/**
 * Result of {@link glmerSummary}: lme4's `summary()` of a glmer fit.
 *
 * @category Mixed models
 */
export interface GlmerSummary {
  /** The family (R's `Family:` line). */
  family: GlmerFamilyName;
  /** The link. */
  link: GlmLinkName;
  /** The fit's nAGQ (R's title: Laplace approximation for 1, adaptive Gauss-Hermite quadrature otherwise). */
  nAGQ: number;
  /** Names of the fixed effects (R's row names). */
  names: string[];
  /** Estimates (R's `Estimate`). */
  estimate: number[];
  /** Standard errors (R's `Std. Error`, from the fit's `vcov`). */
  stdError: number[];
  /** Estimates over standard errors (R's third column). */
  statistic: number[];
  /** The third column's name: `"z value"` for binomial and poisson, `"t value"` for the families with a dispersion. */
  statisticName: "z value" | "t value";
  /**
   * Two-sided p-values from the normal distribution, 2 pnorm(−|statistic|) (R's `Pr(>|z|)`), for every family: lme4
   * uses no t distribution for the families with a dispersion either.
   */
  pValue: number[];
  /** The correlation of the fixed effects (R's `cov2cor(vcov(fit))`; array of rows, 1 on the diagonal). */
  correlation: number[][];
  /** The variance components (R's `VarCorr()`, not scaled by sigma; no residual row). */
  varCorr: LmerVarCorr[];
  /** The number of levels of each grouping factor (R's `ngrps()`), in the order of the fit's `ranef`. */
  nGroups: { group: string; levels: number }[];
  /** Number of observations (R's `Number of obs`). */
  nObs: number;
  /** The log-likelihood (the fit's). */
  logLik: number;
  /** Akaike's information criterion. */
  AIC: number;
  /** Schwarz's Bayesian information criterion. */
  BIC: number;
  /** Degrees of freedom of the log-likelihood (the fit's `df`). */
  df: number;
  /** −2 logLik (R's `-2*log(L)`; the fit's `deviance` is R's `deviance()`, another quantity). */
  minus2LogLik: number;
  /** nObs − df (R's `df.resid`). */
  dfResidual: number;
  /** Minimum, quartiles, median and maximum of the Pearson residuals divided by sigma (R's `Scaled residuals`). */
  residualQuantiles: number[];
  /** R's `sigma()` (1 for binomial and poisson). */
  sigma: number;
  /** R's messages (a rank-deficient fixed-effects matrix, a singular fit). */
  messages: string[];
  /** R's warnings (the fallback of vcov to R_X, if the fit gave it). */
  warnings: string[];
}

/** R's type-7 quantile of sorted values at probability prob */
function quantile7(sorted: readonly number[], prob: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const h = (n - 1) * prob;
  const lo = Math.floor(h);
  const a = sorted[lo]!;
  return lo + 1 < n ? a + (h - lo) * (sorted[lo + 1]! - a) : a;
}

/**
 * The summary of a generalized linear mixed model fitted by {@link glmer}: the coefficient table with p-values, the
 * correlation of the fixed effects, the quantiles of the scaled residuals, the information criteria, the variance
 * components and the numbers of groups. Equivalent to `lme4::summary()` in R.
 *
 * The p-values are from the normal distribution for every family, as lme4's (whose third column is named `t value`
 * for the families with a dispersion, although its p-values are normal ones). The values are those of the fit at the
 * exact optimum (see {@link glmer}), so they typically differ from lme4's in the 4th to 6th significant digit. For
 * `nAGQ > 1`, `logLik`, `AIC`, `BIC` and `minus2LogLik` are those of the log-likelihood, as the fit's.
 *
 * @param fit A result of {@link glmer} (the object it returned, not a copy).
 * @param options None yet (see {@link GlmerSummaryOptions}).
 *
 * @example
 * ```ts
 * // R: summary(lme4::glmer(y ~ x + (1 | g), data, family = poisson))
 * const fit = glmer("y ~ x + (1 | g)", {
 *   y: [2, 3, 6, 7, 8, 1, 0, 3, 2, 5, 4, 6, 9, 8, 13, 0, 2, 1, 4, 3],
 *   x: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5],
 *   g: ["a", "a", "a", "a", "a", "b", "b", "b", "b", "b", "c", "c", "c", "c", "c", "d", "d", "d", "d", "d"],
 * }, { family: "poisson" });
 * const s = glmerSummary(fit);
 * s.statisticName; // "z value"
 * s.pValue;        // [0.5482, 6.226e-5]
 * s.minus2LogLik;  // 78.785
 * s.dfResidual;    // 17
 * ```
 *
 * @category Mixed models
 */
export function glmerSummary(fit: GlmerResult, options?: GlmerSummaryOptions): GlmerSummary {
  checkLmerOptions("glmerSummary", options, ["correlation", "use.hessian", "useHessian"]);
  // (written by hand: option-keys.mjs generates no check for an options type without keys)
  checkOptions(options, [], "glmerSummary");
  glmerInternals(fit);
  const { estimate, stdError, zValue } = fit.coefTable;
  const v = fit.vcov;
  const correlation = v.map((row, i) =>
    // (R's cov2cor sets the diagonal to 1; a variance of 0 gives NaN off the diagonal, as R's 0/0)
    row.map((c, j) => (i === j ? 1 : v[i]![i]! === 0 || v[j]![j]! === 0 ? NaN : c / Math.sqrt(v[i]![i]! * v[j]![j]!))),
  );
  const scaled = fit.pearsonResiduals.map((r) => r / fit.sigma).sort((a, b) => a - b);
  const dispersionFamily = fit.family !== "binomial" && fit.family !== "poisson";
  return reported(
    "glmerSummary",
    {
      family: fit.family,
      link: fit.link,
      nAGQ: fit.nAGQ,
      names: [...fit.fixefNames],
      estimate: [...estimate],
      stdError: [...stdError],
      statistic: [...zValue],
      // (lme4 names the column after whether the family has a dispersion)
      statisticName: dispersionFamily ? "t value" : "z value",
      // (normal p-values for every family, as lme4's, also where it names the statistic t)
      pValue: zValue.map((z) => (Number.isNaN(z) ? NaN : 2 * pnorm(-Math.abs(z)))),
      correlation,
      varCorr: fit.varCorr.map((t) => ({ group: t.group, columns: [...t.columns], sd: [...t.sd], corr: t.corr.map((row) => [...row]) })),
      nGroups: fit.ranef.map((g) => ({ group: g.group, levels: g.levels.length })),
      nObs: fit.nObs,
      logLik: fit.logLik,
      AIC: fit.AIC,
      BIC: fit.BIC,
      df: fit.df,
      minus2LogLik: -2 * fit.logLik,
      dfResidual: fit.nObs - fit.df,
      residualQuantiles: [0, 0.25, 0.5, 0.75, 1].map((q) => quantile7(scaled, q)),
      sigma: fit.sigma,
      messages: [...fit.messages],
      // (R's summary computes vcov again, so its fallback warning is given again; the fit's other warnings are not)
      warnings: fit.warnings.includes(VCOV_FALLBACK) ? [VCOV_FALLBACK] : [],
    },
    fit,
  );
}
