// ANOVA tables of linear mixed models fitted by lmer (src/models/lmer.ts): lmerTest's Type I, II and III tables of one
// fit (each term's hypothesis tested jointly with Satterthwaite's denominator degrees of freedom), and lme4's
// likelihood-ratio comparison of several fits.
//
// Written for rStats.js (no ported code) from oracle/lmertest-behaviour.md (sections 2 and 3). The hypothesis
// matrices come from src/models/lmerHypotheses.ts, the F-tests from src/models/lmerTest.ts; the comparison refits REML
// fits by maximum likelihood with lmer's own minimiser (the exact ML optimum).
import { pgamma1 } from "../distributions/gamma.js";
import { Warnings } from "./glmFamily.js";
import { checkOptions, lmerInternals, lmerWithCriterion, logicalOption } from "./lmer.js";
import { fixedEffectsDescription, lmerHypotheses } from "./lmerHypotheses.js";
import { fTestOf, lmerSatterthwaite } from "./lmerTest.js";
const TYPES = { I: "I", II: "II", III: "III", 1: "I", 2: "II", 3: "III" };
/** The hypotheses of a fit's ANOVA table of the given type (internal; the test uses them at other points too) */
export function anovaHypotheses(fit, type) {
    const { structure, data, options } = lmerInternals(fit);
    const descOptions = {};
    if (options.contrasts !== undefined)
        descOptions.contrasts = options.contrasts;
    if (options.levels !== undefined)
        descOptions.levels = options.levels;
    const desc = fixedEffectsDescription(fit.formula, data, descOptions);
    if (desc.colNames.length !== structure.xColNames.length || desc.colNames.some((c, j) => c !== structure.xColNames[j])) {
        throw new Error("lmerAnova: the columns of the hypotheses differ from the fit's fixed effects");
    }
    // an intercept-only model (or one without fixed effects) has an empty table
    if (desc.terms.length === 0)
        return { hypotheses: { hypotheses: [], messages: [] }, termLabels: [] };
    return { hypotheses: lmerHypotheses(desc, type), termLabels: desc.terms.map((t) => t.label) };
}
/** The rows of an ANOVA table from the hypotheses and given Satterthwaite quantities (internal) */
export function anovaRowsOf(s, { hypotheses }, termLabels, warnings) {
    const terms = [];
    const rows = [];
    for (const h of hypotheses) {
        const row = h.values.length === 0 ? undefined : fTestOf(s, h.values, undefined, warnings);
        if (row === undefined)
            continue;
        terms.push(h.term);
        rows.push(row);
    }
    for (const label of termLabels) {
        if (terms.includes(label))
            continue;
        terms.push(label);
        rows.push({ sumSq: NaN, meanSq: NaN, numDF: NaN, denDF: NaN, F: NaN, pValue: NaN });
    }
    return { terms, rows };
}
function anovaOfFit(fit, options) {
    const type = TYPES[String(options.type ?? "III")];
    if (type === undefined)
        throw new RangeError(`type must be "I", "II" or "III", not ${JSON.stringify(options.type)}`);
    const { hypotheses, termLabels } = anovaHypotheses(fit, type);
    const s = lmerSatterthwaite(fit);
    const warnings = new Warnings();
    s.warnings.forEach((w) => warnings.add(w));
    const { terms, rows } = anovaRowsOf(s, hypotheses, termLabels, warnings);
    const column = (k) => rows.map((r) => r[k]);
    return {
        type,
        terms,
        sumSq: column("sumSq"),
        meanSq: column("meanSq"),
        numDF: column("numDF"),
        denDF: column("denDF"),
        F: column("F"),
        pValue: column("pValue"),
        messages: [...hypotheses.messages],
        warnings: warnings.list,
    };
}
function compareFits(fits, options) {
    if (fits.length < 2)
        throw new TypeError("lmerAnova needs one fit, or an array of at least two fits to compare");
    const internals = fits.map(lmerInternals);
    // (only the number of observations is compared, as lme4 does; the fits must also share the data object below)
    if (fits.some((f) => f.nObs !== fits[0].nObs))
        throw new Error("models were not all fitted to the same size of dataset");
    if (internals.some((i) => i.data !== internals[0].data))
        throw new Error("all models must be fit to the same data object");
    const warnings = new Warnings();
    const messages = [];
    let names = fits.map((_, i) => `MODEL${i + 1}`);
    if (options.names !== undefined) {
        if (options.names.length !== fits.length || options.names.some((n) => typeof n !== "string")) {
            throw new TypeError(`names must be ${fits.length} strings, one per fit`);
        }
        if (new Set(options.names).size === options.names.length)
            names = [...options.names];
        else
            warnings.add("failed to find model names, assigning generic names");
    }
    const refit = logicalOption(options.refit, true);
    let logLik;
    if (refit) {
        if (fits.some((f) => f.REML))
            messages.push("refitting model(s) with ML (instead of REML)");
        logLik = fits.map((f, i) => {
            if (!f.REML)
                return f.logLik;
            const { data, options: o, criterion } = internals[i];
            return lmerWithCriterion(f.formula, data, { ...o, REML: false }, criterion).logLik;
        });
    }
    else {
        if (fits.some((f) => f.REML) && fits.some((f) => !f.REML))
            warnings.add("some models fit with REML = TRUE, some not");
        logLik = fits.map((f) => f.logLik);
    }
    // sorted by the number of parameters (stable)
    const order = fits.map((_, i) => i).sort((a, b) => fits[a].df - fits[b].df || a - b);
    const n = fits[0].nObs;
    const npar = order.map((i) => fits[i].df);
    const ll = order.map((i) => logLik[i]);
    const Chisq = ll.map((v, k) => (k === 0 ? NaN : 2 * Math.max(0, v - ll[k - 1])));
    const Df = npar.map((v, k) => (k === 0 ? NaN : v - npar[k - 1]));
    const pValue = Chisq.map((x, k) => (k === 0 || Df[k] === 0 ? NaN : pgamma1(x, Df[k] / 2, 2, false, false)));
    return {
        names: order.map((i) => names[i]),
        npar,
        AIC: ll.map((v, k) => -2 * v + 2 * npar[k]),
        BIC: ll.map((v, k) => -2 * v + Math.log(n) * npar[k]),
        logLik: ll,
        deviance: ll.map((v) => -2 * v),
        Chisq,
        Df,
        pValue,
        messages,
        warnings: warnings.list,
    };
}
export function lmerAnova(fit, options) {
    if (Array.isArray(fit)) {
        const checked = checkOptions("lmerAnova", options, ["refit", "names"], ["modelNames", "model.names"]);
        // (the logical value is checked with the options, before the fits)
        return compareFits(fit, { ...checked, refit: logicalOption(checked.refit, true) });
    }
    return anovaOfFit(fit, checkOptions("lmerAnova", options, ["type"], ["ddf"]));
}
