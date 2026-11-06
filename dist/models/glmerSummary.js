// The summary of a generalized linear mixed model fitted by glmer (src/models/glmer.ts): lme4's summary() of a glmer
// fit, as numbers (the coefficient table with the normal p-values, the correlation of the fixed effects, the scaled
// residuals' quantiles, the information criteria, the variance components and the numbers of groups).
//
// Written for rStats.js (no ported code) from oracle/glmer-behaviour.md ("glmerSummary (stage 3)" and "rStats.js's
// choices"). Everything comes from the fit's fields except the quantiles of the scaled residuals and the correlation.
import { pnorm } from "../distributions/normal.js";
import { checkOptions } from "../internal/checkOptions.js";
import { reported } from "../internal/warnings.js";
import { glmerInternals, VCOV_FALLBACK } from "./glmer.js";
import { checkLmerOptions } from "./lmer.js";
/** R's type-7 quantile of sorted values at probability prob */
function quantile7(sorted, prob) {
    const n = sorted.length;
    if (n === 0)
        return NaN;
    const h = (n - 1) * prob;
    const lo = Math.floor(h);
    const a = sorted[lo];
    return lo + 1 < n ? a + (h - lo) * (sorted[lo + 1] - a) : a;
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
export function glmerSummary(fit, options) {
    checkLmerOptions("glmerSummary", options, ["correlation", "use.hessian", "useHessian"]);
    // (written by hand: option-keys.mjs generates no check for an options type without keys)
    checkOptions(options, [], "glmerSummary");
    glmerInternals(fit);
    const { estimate, stdError, zValue } = fit.coefTable;
    const v = fit.vcov;
    const correlation = v.map((row, i) => 
    // (R's cov2cor sets the diagonal to 1; a variance of 0 gives NaN off the diagonal, as R's 0/0; divided by each
    // standard deviation in turn, as cov2cor multiplies by each 1/sd, since the product of two variances overflows
    // or underflows for predictors of scale 1e120 or 1e-120)
    row.map((c, j) => (i === j ? 1 : v[i][i] === 0 || v[j][j] === 0 ? NaN : c / Math.sqrt(v[i][i]) / Math.sqrt(v[j][j]))));
    const scaled = fit.pearsonResiduals.map((r) => r / fit.sigma).sort((a, b) => a - b);
    const dispersionFamily = fit.family !== "binomial" && fit.family !== "poisson";
    return reported("glmerSummary", {
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
    }, fit);
}
