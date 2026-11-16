// ANOVA tables of linear mixed models fitted by lmer (src/models/lmer.ts): lmerTest's Type I, II and III tables of one
// fit (each term's hypothesis tested jointly with Satterthwaite's denominator degrees of freedom), and lme4's
// likelihood-ratio comparison of several fits.
//
// Written for rStats.js (no ported code) from oracle/lmertest-behaviour.md (sections 2 and 3). The hypothesis
// matrices come from src/models/lmerHypotheses.ts, the F-tests from src/models/lmerTest.ts; the comparison refits REML
// fits by maximum likelihood with lmer's own minimiser (the exact ML optimum).
import { pgamma1 } from "../distributions/gamma.js";
import { checkOptions } from "../internal/checkOptions.js";
import { nestedColumns } from "./estimable.js";
import { reported, Warnings } from "../internal/warnings.js";
import { checkLmerOptions, lmerInternals, lmerWithCriterion, logicalOption } from "./lmer.js";
import { fixedEffectsDescription, lmerHypotheses } from "./lmerHypotheses.js";
import { fTestOf, lmerSatterthwaite } from "./lmerTest.js";
const TYPES = { I: "I", II: "II", III: "III", 1: "I", 2: "II", 3: "III" };
/** The hypotheses of a fit's ANOVA table of the given type (internal; the test uses them at other points too) */
export function anovaHypotheses(fit, type) {
    // the hypotheses from the data as it was at the fit (the data object may have changed since)
    const { structure, snapshot: data, options } = lmerInternals(fit);
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
/** Whether two copies of a data frame hold the same columns and values (NaN equal to NaN) */
function sameFrame(a, b) {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length)
        return false;
    return keys.every((k) => {
        const u = a[k];
        const v = b[k];
        return v !== undefined && u.length === v.length && Array.prototype.every.call(u, (x, i) => Object.is(x, v[i]));
    });
}
/** The model of an lmer fit in a comparison (internal) */
export function comparedLmer(fit) {
    const internals = lmerInternals(fit);
    const { snapshot, data } = internals;
    const lhs = fit.formula.slice(0, fit.formula.indexOf("~"));
    const ones = () => new Array(fit.nObs).fill(1);
    return {
        nObs: fit.nObs,
        df: fit.df,
        logLik: fit.logLik,
        reml: fit.REML,
        refitLogLik: () => lmerWithCriterion(fit.formula, snapshot, { ...internals.options, REML: false }, internals.criterion).logLik,
        mixed: { data, snapshot, rows: fit.rows, response: lhs.replace(/\s+/g, "") },
        // (the left-hand side of lmer's formula is a column name)
        response: () => fit.rows.map((i) => Number(snapshot[lhs.trim()]?.[i] ?? NaN)),
        weights: ones,
        family: "gaussian",
        link: "identity",
        offset: () => new Array(fit.nObs).fill(0),
        x: () => internals.structure.x,
        randomTerms: fit.varCorr,
    };
}
/** Whether two vectors are equal element by element */
function sameValues(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i] || (Number.isNaN(v) && Number.isNaN(b[i])));
}
/**
 * lme4's likelihood-ratio comparison of fits (internal; lmerAnova's and glmerAnova's): the checks that the fits are of
 * the same observations, the names, the ML refits of REML fits, the rows sorted by the number of parameters and the
 * test where the fit of the row before is nested in the row's. `fn` names the function in its error for fewer than
 * two fits.
 */
export function compareModels(fn, models, options) {
    if (models.length < 2)
        throw new TypeError(`${fn} needs one fit, or an array of at least two fits to compare`);
    // (only the number of observations is compared, as lme4 does; the fits must also share the data object below)
    if (models.some((f) => f.nObs !== models[0].nObs))
        throw new Error("models were not all fitted to the same size of dataset");
    const mixed = models.flatMap((m) => (m.mixed === undefined ? [] : [m.mixed]));
    const first = mixed[0];
    if (first !== undefined) {
        if (mixed.some((i) => i.data !== first.data))
            throw new Error("all models must be fit to the same data object");
        // (the same object changed between the fits holds different data)
        if (mixed.some((i) => !sameFrame(i.snapshot, first.snapshot)))
            throw new Error("all models must be fit to the same data object");
        // A likelihood ratio compares likelihoods of the same observations: the same rows of the data and the same response
        // (lme4 compares only the number of rows, and returns a test for fits of different rows or responses)
        const sameRows = (r) => r.length === first.rows.length && r.every((v, i) => v === first.rows[i]);
        if (mixed.some((i) => !sameRows(i.rows)))
            throw new Error("models were not all fitted to the same rows of the data");
    }
    // the response: by the formulas' left-hand sides between fits with a formula, by value against a fit without (glm)
    const reference = models.find((m) => m.mixed !== undefined) ?? models[0];
    const sameResponse = (m) => m.mixed !== undefined && reference.mixed !== undefined ? m.mixed.response === reference.mixed.response : sameValues(m.response(), reference.response());
    if (models.some((m) => m !== reference && !sameResponse(m)))
        throw new Error("models were not all fitted to the same response");
    // (the prior weights are part of the data: a binomial proportion with weights m and a 0/1 response differ)
    if (models.some((m) => m !== reference && !sameValues(m.weights(), reference.weights()))) {
        throw new Error("models were not all fitted with the same prior weights");
    }
    const warnings = new Warnings();
    const messages = [];
    let names = models.map((_, i) => `MODEL${i + 1}`);
    if (options.names !== undefined) {
        if (options.names.length !== models.length || options.names.some((n) => typeof n !== "string")) {
            throw new TypeError(`names must be ${models.length} strings, one per fit`);
        }
        if (new Set(options.names).size === options.names.length)
            names = [...options.names];
        else
            warnings.add("failed to find model names, assigning generic names");
    }
    const refit = logicalOption(options.refit, true);
    let logLik;
    if (refit) {
        if (models.some((f) => f.reml))
            messages.push("refitting model(s) with ML (instead of REML)");
        logLik = models.map((f) => (f.reml && f.refitLogLik !== undefined ? f.refitLogLik() : f.logLik));
    }
    else {
        if (models.some((f) => f.reml) && models.some((f) => !f.reml))
            warnings.add("some models fit with REML = TRUE, some not");
        logLik = models.map((f) => f.logLik);
    }
    // sorted by the number of parameters (stable)
    const order = models.map((_, i) => i).sort((a, b) => models[a].df - models[b].df || a - b);
    const n = models[0].nObs;
    const npar = order.map((i) => models[i].df);
    const ll = order.map((i) => logLik[i]);
    // A likelihood ratio test needs the smaller fit to be a special case of the larger one (lme4 gives a p-value for any
    // pair): the same family and link (an lmer fit is gaussian with the identity link) and the same offset, its
    // fixed-effect columns among the larger fit's, and each of its random-effect terms within a term of the same grouping
    // factor there ((1 | g) + (0 + x | g) within (1 + x | g), not the converse). Otherwise no test (AIC and BIC still
    // compare the fits). The fixed effects are compared as column spaces (the fits use the same rows of the same data):
    // by their names, the same factor in other contrasts (contr.sum against contr.treatment) looked not nested and was
    // not tested (issue #8)
    // The offsets and the columns are compared on the rows of positive weight only (the fits share their weights): rows
    // of weight 0 are not in the likelihoods, and one of them made nested columns look otherwise, as in glmAnova and
    // anovaSequential (#509)
    const positive = reference.weights().map((w) => w !== 0);
    const counted = (rows) => rows.filter((_, i) => positive[i]);
    const nestedIn = (small, large) => small.family === large.family &&
        small.link === large.link &&
        sameValues(counted(small.offset()), counted(large.offset())) &&
        nestedColumns(counted(small.x()), counted(large.x())) &&
        small.randomTerms.every((t) => large.randomTerms.some((u) => u.group === t.group && t.columns.every((c) => u.columns.includes(c))));
    const nested = order.map((i, k) => k > 0 && nestedIn(models[order[k - 1]], models[i]));
    const Chisq = ll.map((v, k) => (k === 0 || !nested[k] ? NaN : 2 * Math.max(0, v - ll[k - 1])));
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
function compareFits(fits, options) {
    if (fits.length < 2)
        throw new TypeError("lmerAnova needs one fit, or an array of at least two fits to compare");
    return compareModels("lmerAnova", fits.map(comparedLmer), options);
}
export function lmerAnova(fit, options) {
    if (Array.isArray(fit)) {
        checkLmerOptions("lmerAnova", options, ["modelNames", "model.names"]);
        checkOptions(options, ["refit", "names"], "lmerAnova");
        const checked = (options ?? {});
        // (the logical value is checked with the options, before the fits)
        return reported("lmerAnova", compareFits(fit, { ...checked, refit: logicalOption(checked.refit, true) }), ...fit);
    }
    checkLmerOptions("lmerAnova", options, ["ddf"]);
    checkOptions(options, ["type"], "lmerAnova");
    return reported("lmerAnova", anovaOfFit(fit, (options ?? {})), fit);
}
