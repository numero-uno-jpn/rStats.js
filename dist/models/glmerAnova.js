// ANOVA of generalized linear mixed models fitted by glmer (src/models/glmer.ts): lme4's table of the fixed-effects
// terms of one fit (sequential Wald sums of squares from R_X), and lme4's likelihood-ratio comparison of several fits
// of glmer, lmer and glm.
//
// Written for rStats.js (no ported code) from oracle/glmer-behaviour.md ("glmerAnova (stage 3)" and "rStats.js's
// choices", G15). The comparison is lmerAnova's (src/models/lmerAnova.ts, compareModels), with the prior weights,
// the family, the link and the offset of each fit.
import { potf2 } from "../linalg/chol.js";
import { checkOptions } from "../internal/checkOptions.js";
import { reported } from "../internal/warnings.js";
import { glmerInternals, isGlmerFit } from "./glmer.js";
import { checkLmerOptions, logicalOption } from "./lmer.js";
import { comparedLmer, compareModels } from "./lmerAnova.js";
/** The table of the fixed-effects terms of one fit */
function anovaOfFit(fit) {
    const { structure: s, rxtrx, beta } = glmerInternals(fit);
    const p = beta.length;
    // R_X, the upper triangular Cholesky factor of R_X'R_X (column-major), and c = R_X β̂
    const data = new Float64Array(p * p);
    for (let j = 0; j < p; j++)
        for (let i = 0; i < p; i++)
            data[i + j * p] = rxtrx[i][j];
    const failed = p > 0 && (data.some((v) => !Number.isFinite(v)) || potf2({ nrow: p, ncol: p, data }) > 0);
    const c = Array.from({ length: p }, (_, i) => {
        if (failed)
            return NaN;
        let sum = 0;
        for (let j = i; j < p; j++)
            sum += data[i + j * p] * beta[j];
        return sum;
    });
    // one row per term with columns, in the order of the columns; the intercept (term 0) left out
    const terms = [];
    const npar = [];
    const sumSq = [];
    s.xAssign.forEach((term, j) => {
        if (term === 0)
            return;
        const label = s.xTermLabels[term - 1];
        if (terms[terms.length - 1] !== label) {
            terms.push(label);
            npar.push(0);
            sumSq.push(0);
        }
        npar[npar.length - 1]++;
        sumSq[sumSq.length - 1] += c[j] ** 2;
    });
    const meanSq = sumSq.map((v, k) => v / npar[k]);
    // (σ is 1 for binomial and poisson, so that F = Mean Sq there, as R's)
    const sigma2 = fit.sigma * fit.sigma;
    return { terms, npar, sumSq, meanSq, F: meanSq.map((v) => v / sigma2), messages: [], warnings: [] };
}
/** Whether an object looks like a result of glm (src/models/glm.ts; glm keeps no record of its results) */
function isGlmFit(fit) {
    if (typeof fit !== "object" || fit === null)
        return false;
    const f = fit;
    return (typeof f.aic === "number" &&
        typeof f.rank === "number" &&
        typeof f.family === "string" &&
        typeof f.link === "string" &&
        Array.isArray(f.y) &&
        Array.isArray(f.priorWeights) &&
        typeof f.model === "object" &&
        f.model !== null &&
        Array.isArray(f.model.x) &&
        Array.isArray(f.model.offset));
}
/** The model of a glmer fit in a comparison */
function comparedGlmer(fit) {
    const { structure: s, data, snapshot } = glmerInternals(fit);
    return {
        nObs: fit.nObs,
        df: fit.df,
        // (G12: for nAGQ > 1 the log-likelihood with the saturated model's constant, so comparisons across nAGQ and with
        // glm are commensurate)
        logLik: fit.logLik,
        reml: false,
        mixed: { data, snapshot, rows: fit.rows, response: fit.formula.slice(0, fit.formula.indexOf("~")).replace(/\s+/g, "") },
        response: () => s.y,
        weights: () => s.weights,
        family: fit.family,
        link: fit.link,
        offset: () => s.offset,
        x: () => s.x,
        randomTerms: fit.varCorr,
    };
}
/** The model of a glm fit in a comparison: R's logLik.glm (df the rank, plus 1 for a family with a dispersion) */
function comparedGlm(fit) {
    const dispersion = fit.family === "gaussian" || fit.family === "Gamma" || fit.family === "inverse.gaussian";
    const df = fit.rank + (dispersion ? 1 : 0);
    return {
        nObs: fit.y.length,
        df,
        logLik: df - fit.aic / 2,
        reml: false,
        response: () => fit.y,
        weights: () => fit.priorWeights,
        family: fit.family,
        link: fit.link,
        offset: () => fit.model.offset,
        x: () => fit.model.x,
        randomTerms: [],
    };
}
export function glmerAnova(fit, options) {
    if (Array.isArray(fit)) {
        checkLmerOptions("glmerAnova", options, ["modelNames", "model.names"]);
        checkOptions(options, ["refit", "names"], "glmerAnova");
        const checked = (options ?? {});
        // (the logical value is checked with the options, before the fits)
        const refit = logicalOption(checked.refit, true);
        const fits = fit;
        if (fits.length < 2)
            throw new TypeError("glmerAnova needs one fit, or an array of at least two fits to compare");
        const models = fits.map((f) => {
            if (isGlmerFit(f))
                return comparedGlmer(f);
            if (isGlmFit(f))
                return comparedGlm(f);
            try {
                return comparedLmer(f);
            }
            catch (e) {
                if (e instanceof TypeError)
                    throw new TypeError("each fit must be a result returned by glmer, lmer or glm (not a copy of one)");
                throw e;
            }
        });
        // (glm fits alone are glmAnova's)
        if (fits.every(isGlmFit))
            throw new TypeError("glmerAnova needs at least one fit of glmer or lmer (glmAnova compares glm fits)");
        return reported("glmerAnova", compareModels("glmerAnova", models, { ...checked, refit }), ...fits);
    }
    checkLmerOptions("glmerAnova", options, []);
    checkOptions(options, [], "glmerAnova");
    return reported("glmerAnova", anovaOfFit(fit), fit);
}
