// The structure of a generalised linear mixed model (lme4's glmer): the structure of the mixed model (with glmer's
// checks, src/models/mixedStructure.ts), the family and its link, the prior weights and the offset, and the response
// as the family reads it, with the starting means. Nothing is fitted here.
//
// Written for rStats.js (no ported code) from oracle/glmer-behaviour.md ("The model structure: what differs from
// lmer", "The response", "Prior weights and offset", "The structure and its checks") and its section "rStats.js's
// choices" (G1 to G5), with the two messages of nAGQ > 1 ("Adaptive Gauss-Hermite quadrature", "When it is allowed").
import { Warnings, withWarnings } from "../internal/warnings.js";
import { prepareResponse } from "./glmFamily.js";
import { glmerFamily } from "./glmerFamily.js";
import { parseFormula } from "./formula.js";
import { mixedModelStructure } from "./mixedStructure.js";
/** A weights or offset argument as numbers over all rows of the data (NaN for missing) */
function rowValues(given, data, nAll, what) {
    let col;
    if (typeof given === "string") {
        col = Object.hasOwn(data, given) ? data[given] : undefined;
        if (col === undefined)
            throw new RangeError(`object '${given}' not found`);
    }
    else
        col = given;
    if (!Array.isArray(col) && !(col instanceof Float64Array))
        throw new TypeError(`${what} must be an array of numbers or the name of a column`);
    const values = Array.from(col, (x) => {
        if (x === null)
            return NaN;
        if (typeof x !== "number")
            throw new TypeError(`the ${what} must be numeric`);
        return x;
    });
    if (values.length !== nAll)
        throw new RangeError(`variable lengths differ (found for '(${what})')`);
    return values;
}
/** Whether a column of the data holds booleans (a logical response is 0/1, not a factor) */
const isLogicalColumn = (data, name) => {
    const col = Object.hasOwn(data, name) ? data[name] : undefined;
    return Array.isArray(col) && col.some((v) => typeof v === "boolean");
};
/**
 * The structure of a generalised linear mixed model `response ~ fixed part + (lhs | group) + ...` with lme4's checks,
 * errors and warnings (oracle/glmer-behaviour.md, stage 2a). The response may be `cbind(successes, failures)` (two
 * column names, binomial only) and, for binomial, strings (a factor: the first level is failure). Internal: not
 * exported from the package.
 *
 * @param formula A formula such as `"y ~ x + (1 | g)"` or `"cbind(s, f) ~ period + (1 | herd)"`.
 * @param data The data frame: an object of columns.
 * @param options The family and link, prior weights, offset, nAGQ, contrasts and level order of factors.
 */
export function glmerStructure(formula, data, options = {}) {
    // the family first of all (quasi families; gaussian with the identity link, G3)
    const family = glmerFamily(options.family, options.link);
    // nAGQ: an integer from 0 to 100, truncated first as R's as.integer (rule 9: −0.5 is 0); negative after that an
    // error here (G5; R uses 0)
    const nAGQgiven = options.nAGQ ?? 1;
    if (typeof nAGQgiven !== "number" || Number.isNaN(nAGQgiven))
        throw new TypeError("nAGQ must be a number");
    // (+ 0: −0 becomes 0)
    const nAGQ = Math.trunc(nAGQgiven) + 0;
    if (nAGQ < 0)
        throw new RangeError("nAGQ must be non-negative");
    if (nAGQ > 100)
        throw new RangeError("nAGQ <= 100L is not TRUE");
    if (typeof data !== "object" || data === null)
        throw new TypeError("data must be an object of columns");
    // the rows with a missing weight or offset are dropped with the others: the data restricted to the other rows
    // first (the same model frame, as the levels of factors are formed from the rows kept)
    const parsed = parseFormula(formula, false, true, true);
    const firstColumn = parsed.response !== undefined && Object.hasOwn(data, parsed.response) ? data[parsed.response] : Object.values(data)[0];
    const nAll = firstColumn?.length ?? 0;
    const weightsAll = options.weights === undefined ? undefined : rowValues(options.weights, data, nAll, "weights");
    const offsetAll = options.offset === undefined ? undefined : rowValues(options.offset, data, nAll, "offset");
    let kept;
    let frameData = data;
    if (weightsAll !== undefined || offsetAll !== undefined) {
        kept = [];
        for (let i = 0; i < nAll; i++)
            if (!Number.isNaN(weightsAll?.[i] ?? 0) && !Number.isNaN(offsetAll?.[i] ?? 0))
                kept.push(i);
        if (kept.length < nAll) {
            const rows = kept;
            frameData = Object.fromEntries(Object.entries(data).map(([k, col]) => [k, col.length === nAll ? (col instanceof Float64Array ? Float64Array.from(rows, (i) => col[i]) : rows.map((i) => col[i])) : col]));
        }
        else
            kept = undefined;
    }
    const { levels, contrasts } = options;
    const s = mixedModelStructure(formula, frameData, { ...(levels === undefined ? {} : { levels }), ...(contrasts === undefined ? {} : { contrasts }) }, true);
    const rows = kept === undefined ? s.rows : s.rows.map((i) => kept[i]);
    const n = rows.length;
    // nAGQ > 1: exactly one term with one column, with R's two messages from its two checks (terms in lmer's order):
    // several grouping factors or a first term with several columns, then several terms of one factor
    if (nAGQ > 1) {
        if (s.groups.length > 1 || s.terms[0].columns.length > 1) {
            throw new RangeError("nAGQ > 1 is only available for models with a single, scalar random-effects term");
        }
        if (s.terms.length > 1)
            throw new RangeError("AGQ only defined for a single scalar random-effects term");
    }
    // the response, as lme4 reads it before the family's initialize
    const response = s.response;
    const twoColumns = parsed.responseColumns !== undefined;
    if (twoColumns && family.family !== "binomial")
        throw new TypeError("can't handle matrix-valued responses: consider using refit()");
    const numeric = (v, name, message) => {
        if (v.kind === "numeric")
            return v.values;
        // a logical column (levels FALSE and TRUE) is 0/1; a factor is accepted by binomial only (not in cbind)
        if (isLogicalColumn(frameData, name) && options.levels?.[name] === undefined)
            return v.codes.map((c) => (v.levels[c] === "TRUE" ? 1 : 0));
        throw new TypeError(message);
    };
    let yGiven;
    if (twoColumns) {
        const [a, b] = parsed.responseColumns;
        const sv = numeric(response[0], a, "response must be numeric or factor");
        const fv = numeric(response[1], b, "response must be numeric or factor");
        yGiven = sv.map((v, i) => [v, fv[i]]);
    }
    else {
        const v = response[0];
        const name = parsed.response;
        if (family.family === "binomial" && v.kind === "factor" && !(isLogicalColumn(frameData, name) && options.levels?.[name] === undefined)) {
            // a factor, or strings (G2): 0 for the first level, 1 for the others
            yGiven = v.codes.map((c) => (c === 0 ? 0 : 1));
        }
        else
            yGiven = numeric(v, name, family.family === "binomial" ? "response must be numeric or factor" : "response must be numeric");
    }
    const flat = twoColumns ? yGiven.flat() : yGiven;
    if (flat.some((v) => !Number.isFinite(v)))
        throw new RangeError("NA/NaN/Inf in 'y'");
    const offset = offsetAll === undefined ? new Array(n).fill(0) : rows.map((i) => offsetAll[i]);
    // (an infinite offset or weight: not described for lme4; errors here, as glm's)
    if (offset.some((v) => !Number.isFinite(v)))
        throw new RangeError("the offset must be finite");
    const prior = weightsAll === undefined ? new Array(n).fill(1) : rows.map((i) => weightsAll[i]);
    if (prior.some((v) => v < 0))
        throw new RangeError("all(weights >= 0) is not TRUE");
    if (prior.some((v) => !Number.isFinite(v)))
        throw new RangeError("non-finite weights not allowed");
    // the family's checks and starting means (glm's, with their messages and warnings)
    const warnings = new Warnings();
    for (const w of s.warnings)
        warnings.add(w);
    const prepared = withWarnings(warnings, () => prepareResponse(family.glm, yGiven, prior, false, warnings));
    let { mustart } = prepared;
    if (family.family === "Gamma") {
        // lme4 replaces Gamma's starting means by their (unweighted) mean
        const mean = mustart.reduce((sum, v) => sum + v, 0) / mustart.length;
        mustart = mustart.map(() => mean);
    }
    if (new Set(prepared.y).size < 2)
        throw new RangeError("Response is constant");
    return {
        ...s,
        rows,
        y: prepared.y,
        family,
        weights: prepared.weights,
        offset,
        size: family.family === "binomial" ? prepared.size : undefined,
        mustart,
        nAGQ,
        warnings: warnings.list,
    };
}
