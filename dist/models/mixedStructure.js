// The structure of a linear mixed model (lme4's lmer): the formula with its random-effects terms `(lhs | group)` and
// `(lhs || group)`, the model frame, the fixed-effects model matrix X, the random-effects model matrix Z, the layout
// of the relative covariance factor Λ_θ, the initial θ and its lower bounds. Nothing is fitted here.
//
// Written for rStats.js (no ported code) from oracle/lmer-behaviour.md (stage 1a) and the notation of D. Bates,
// M. Mächler, B. Bolker, S. Walker (2015), "Fitting Linear Mixed-Effects Models Using lme4", Journal of Statistical
// Software 67(1). The fixed-effects part is the formula without the random-effects terms, coded as lm codes it
// (src/models/modelMatrix.ts; the order of its own variables names the interaction columns: `y ~ (z | g) + x * z` has
// `x:z`), on the model frame of the whole formula; each random-effects term's left-hand side is a model matrix with
// treatment contrasts (a term without columns is an error); its grouping expression is expanded as a right-hand side
// into grouping factors (`a/b` gives `b:a` and `a`); `||` splits a term into one term per column group. The terms are
// then ordered by their number of levels (decreasing, when not already non-increasing; ties reversed). Z is
// level-major within each term, and Λ_θ is block diagonal with one lower-triangular block per level of each term,
// whose parameters are its lower triangle in column-major order. Aliased columns of X (pivoted QR of lm, tolerance
// 1e-7) are dropped with a message; predictors on very different scales give a warning.
//
// The structure of a generalised linear mixed model (lme4's glmer, oracle/glmer-behaviour.md, "The structure and its
// checks") is the same with three differences in the checks: no row left is "Invalid grouping factor specification"
// with the first grouping factor's name, a grouping factor may have as many levels as there are rows, and a term may
// have as many random effects as there are rows. Its response may be of any type (or `cbind(a, b)`); the family
// reads it (src/models/glmerStructure.ts).
import { formatR } from "../htest/core/simulate.js";
import { qr } from "../linalg/qr.js";
import { deparseFormula, expandRhs, parseFormula, splitBarTerms, termsOf } from "./formula.js";
import { presentLevels } from "./modelFrame.js";
import { design } from "./modelMatrix.js";
/** The grouping factors of a grouping expression: the variables of each, in the order of the name */
function groupingFactorsOf(group) {
    const vars = [];
    const collect = (n) => {
        if (n.type === "var") {
            if (!vars.includes(n.name))
                vars.push(n.name);
        }
        else if (n.type === "binary") {
            collect(n.left);
            if (n.op !== "^")
                collect(n.right);
        }
        else if (n.type === "unary" || n.type === "paren" || n.type === "Error")
            collect(n.arg);
    };
    collect(group);
    const { terms } = expandRhs(group, (name) => vars.indexOf(name), []);
    if (terms.length === 0)
        throw new SyntaxError(`invalid formula: no grouping factor in '${deparseFormula(group)}'`);
    // sorted by degree (stably); the variables of a term in order of first appearance in the expression
    let factors = terms
        .map((t, i) => [t, i])
        .sort((a, b) => a[0].length - b[0].length || a[1] - b[1])
        .map(([t]) => t.map((v) => vars[v]));
    let nested = false;
    const findSlash = (n) => {
        if (n.type === "binary") {
            if (n.op === "/")
                nested = true;
            findSlash(n.left);
            findSlash(n.right);
        }
        else if (n.type === "unary" || n.type === "paren" || n.type === "Error")
            findSlash(n.arg);
    };
    findSlash(group);
    if (nested)
        factors = factors.map((f) => [...f].reverse()).reverse();
    return factors;
}
/**
 * A variable of the model frame as a grouping factor of the values present: numbers become levels sorted numerically,
 * labelled as R's as.character; a boolean (whose frame variable keeps both levels) has only the values present
 */
function asFactor(v) {
    if (v.kind === "factor")
        return presentLevels(v);
    const distinct = [...new Set(v.values)].sort((a, b) => a - b);
    const levels = [];
    const index = new Map();
    for (const d of distinct) {
        const label = formatR(d);
        if (!index.has(label)) {
            index.set(label, levels.length);
            levels.push(label);
        }
    }
    return { levels, codes: v.values.map((x) => index.get(formatR(x))) };
}
/**
 * The fixed-effects part of a mixed model (internal, also for prediction): the formula without the random-effects
 * terms, `response ~ fixed part`, as lm codes it (the order of its variables names the interaction columns); its model
 * frame has the variables of the whole formula too, so that every model matrix of the structure uses the same rows.
 */
export function fixedPartDesign(formula, data, options = {}, generalised = false) {
    const parsed = parseFormula(formula, false, true, generalised);
    if (parsed.response === undefined)
        throw new TypeError("the formula has no response");
    const { fixed, bars } = splitBarTerms(parsed.rhs);
    if (typeof data !== "object" || data === null)
        throw new TypeError("data must be an object of columns");
    const frameOptions = {
        ...(options.levels === undefined ? {} : { levels: options.levels }),
        dropUnusedLevels: true,
    };
    // (if nothing is left of the right-hand side, the fixed part is `1`)
    const fixedRhs = fixed ?? { type: "num", value: 1, text: "1" };
    const fixedFormula = { ...parsed, rhs: fixedRhs };
    // the variables of the whole formula (in the model frame, those of the fixed part come first, in its order)
    const allVariables = termsOf(parsed, Object.keys(data), fixedRhs).variables;
    // (a contrast is for a variable of the fixed-effects part: a grouping variable alone counts as absent)
    const contrastOptions = options.contrasts === undefined ? {} : { contrasts: options.contrasts };
    // (a generalised model's response may be of any type: the family reads it)
    const responseOptions = generalised ? { anyResponse: true } : {};
    const fixedDesign = design(fixedFormula, data, { ...frameOptions, ...contrastOptions, ...responseOptions, extraVariables: allVariables }, fixedRhs);
    const variables = [...fixedDesign.terms.variables, ...allVariables.filter((v) => !fixedDesign.terms.variables.includes(v))];
    return { parsed, bars, fixedDesign, variables, frameOptions, responseOptions };
}
/**
 * The random-effects terms `bars` of a formula expanded (internal): `(lhs || group)` split into one term per term of
 * lhs, then each term by the grouping factors of its expression; `noColumns` is the first bar term (in the formula's
 * order) that `||` leaves without columns.
 */
export function expandRandomTerms(parsed, columns, bars) {
    const expanded = [];
    let noColumns;
    bars.forEach((bar, barIndex) => {
        let lhsList = [bar.lhs];
        if (bar.double) {
            const lhsTerms = termsOf(parsed, columns, bar.lhs);
            lhsList = lhsTerms.intercept ? [{ type: "num", value: 1, text: "1" }] : [];
            for (const t of lhsTerms.terms) {
                const term = t.map((v) => ({ type: "var", name: lhsTerms.variables[v] })).reduce((l, r) => ({ type: "binary", op: ":", left: l, right: r }));
                lhsList.push({ type: "binary", op: "+", left: { type: "num", value: 0, text: "0" }, right: term });
            }
            if (lhsList.length === 0)
                noColumns ??= barIndex;
        }
        const factors = groupingFactorsOf(bar.group);
        for (const lhs of lhsList)
            for (const groupVariables of factors)
                expanded.push({ lhs, groupVariables, bar: barIndex });
    });
    return { expanded, noColumns };
}
/**
 * The structure of a linear mixed model `response ~ fixed part + (lhs | group) + ...`: the model frame, X, Z, the
 * layout of Λ_θ, the initial θ and its lower bounds, with lme4's checks, errors, messages and warnings
 * (oracle/lmer-behaviour.md, stage 1a). Internal: not exported from the package.
 *
 * @param formula A formula such as `"y ~ x + (x | g)"`, `"y ~ (1 | a/b)"` or `"y ~ (x || g)"`.
 * @param data The data frame: an object of columns.
 * @param options The contrasts (fixed-effects part only) and the level order of factors.
 * @param generalised The structure of a generalised model (glmer): its checks, a response of any type or `cbind(a, b)`.
 */
export function mixedModelStructure(formula, data, options = {}, generalised = false) {
    const { parsed, bars, fixedDesign, variables, frameOptions, responseOptions } = fixedPartDesign(formula, data, options, generalised);
    const { frame } = fixedDesign;
    const n = frame.rows.length;
    // (glmer: no row left is an error about the first grouping factor, below)
    if (n === 0 && !generalised)
        throw new RangeError("0 (non-NA) cases");
    // (the model frame's errors, above, come before this check)
    if (bars.length === 0)
        throw new Error("No random effects terms specified in formula");
    const { expanded, noColumns: noColumnsOfBars } = expandRandomTerms(parsed, Object.keys(data), bars);
    /** The first bar term (in the formula's order) without columns */
    let noColumns = noColumnsOfBars;
    // glmer without a row left: lme4 fails on the first grouping factor in the order of the terms after expansion and
    // before their reordering
    if (n === 0)
        throw new RangeError(`Invalid grouping factor specification, ${expanded[0]?.groupVariables.join(":") ?? ""}`);
    // the grouping factors (levels present, ordered by the levels of the first variable, then the second, ...)
    const factorCache = new Map();
    const factorOf = (vs) => {
        const name = vs.join(":");
        const cached = factorCache.get(name);
        if (cached !== undefined)
            return cached;
        const parts = vs.map((v) => asFactor(frame.variables[variables.indexOf(v)]));
        let result;
        if (parts.length === 1)
            result = parts[0];
        else {
            const keys = new Map();
            for (let i = 0; i < n; i++) {
                const tuple = parts.map((p) => p.codes[i]);
                keys.set(tuple.join(","), tuple);
            }
            const combos = [...keys.values()].sort((a, b) => {
                for (let k = 0; k < a.length; k++)
                    if (a[k] !== b[k])
                        return a[k] - b[k];
                return 0;
            });
            const index = new Map(combos.map((t, i) => [t.join(","), i]));
            result = {
                levels: combos.map((t) => t.map((c, k) => parts[k].levels[c]).join(":")),
                codes: Array.from({ length: n }, (_, i) => index.get(parts.map((p) => p.codes[i]).join(","))),
            };
        }
        factorCache.set(name, result);
        return result;
    };
    const withFactors = expanded.map((t) => ({ ...t, name: t.groupVariables.join(":"), factor: factorOf(t.groupVariables) }));
    // order of the terms: kept if the numbers of levels never increase; otherwise sorted ascending (ties in order) and
    // reversed
    let ordered = withFactors;
    if (withFactors.some((t, k) => k > 0 && t.factor.levels.length > withFactors[k - 1].factor.levels.length)) {
        ordered = withFactors
            .map((t, i) => [t, i])
            .sort((a, b) => a[0].factor.levels.length - b[0].factor.levels.length || a[1] - b[1])
            .map(([t]) => t)
            .reverse();
    }
    // the distinct grouping factors in order of first use
    const groups = [];
    const terms = [];
    let zOffset = 0;
    let thetaOffset = 0;
    for (const t of ordered) {
        let g = groups.findIndex((x) => x.name === t.name);
        if (g < 0) {
            g = groups.length;
            groups.push({ name: t.name, levels: t.factor.levels, codes: t.factor.codes });
        }
        // the left-hand side: treatment contrasts whatever the options say
        const lhsDesign = design(parsed, data, { ...frameOptions, ...responseOptions }, t.lhs);
        const nc = lhsDesign.colNames.length;
        if (nc === 0 && (noColumns === undefined || t.bar < noColumns))
            noColumns = t.bar;
        const nLevels = t.factor.levels.length;
        terms.push({
            label: `${deparseFormula(t.lhs)} | ${t.name}`,
            group: g,
            columns: lhsDesign.colNames,
            matrix: lhsDesign.x,
            nLevels,
            zOffset,
            thetaOffset,
        });
        zOffset += nLevels * nc;
        thetaOffset += (nc * (nc + 1)) / 2;
    }
    // checks: a term without columns (its bar term as written), then the grouping factors and the numbers of effects
    if (noColumns !== undefined) {
        const bar = bars[noColumns];
        throw new Error(`lmer: the random-effects term '${deparseFormula(bar.lhs)} ${bar.double ? "||" : "|"} ${deparseFormula(bar.group)}' has no columns`);
    }
    if (groups.some((g) => g.levels.length < 2))
        throw new RangeError("grouping factors must have > 1 sampled level");
    // (glmer: a grouping factor may have as many levels as there are rows, and a term as many random effects: there is
    // no residual variance to identify)
    const tooMany = generalised ? [] : groups.filter((g) => g.levels.length >= n).map((g) => g.name);
    if (tooMany.length > 0) {
        throw new RangeError(`number of levels of each grouping factor must be < number of observations (problems: ${tooMany.join(", ")})`);
    }
    for (const t of terms) {
        const effects = t.nLevels * t.columns.length;
        if (generalised && n < effects) {
            throw new RangeError(`number of observations (=${n}) < number of random effects (=${effects}) for term (${t.label}); ` +
                "the random-effects parameters are probably unidentifiable");
        }
        if (!generalised && n <= effects) {
            throw new RangeError(`number of observations (=${n}) <= number of random effects (=${effects}) for term (${t.label}); ` +
                "the random-effects parameters and the residual variance (or scale parameter) are probably unidentifiable");
        }
    }
    // a column of a random-effects term not finite (#298: an infinite x in (x | g) reached the factorisation; R stops
    // with "objective in x0 returns NA")
    for (const t of terms) {
        if (t.matrix.some((row) => row.some((v) => !Number.isFinite(v))))
            throw new RangeError(`NA/NaN/Inf in the random-effects term (${t.label})`);
    }
    // Z (level-major within each term), and Λ_θ, θ and its bounds
    const z = [];
    const zColLevels = [];
    const theta = [];
    const lower = [];
    const lambda = [];
    for (const t of terms) {
        const { levels, codes } = groups[t.group];
        const nc = t.columns.length;
        // the rows are visited once, in order, each appended to the columns of its level
        const columns = Array.from({ length: levels.length * nc }, () => ({ rows: [], values: [] }));
        for (let i = 0; i < n; i++) {
            const row = t.matrix[i];
            const base = codes[i] * nc;
            for (let j = 0; j < nc; j++) {
                const v = row[j];
                if (v === 0)
                    continue;
                const col = columns[base + j];
                col.rows.push(i);
                col.values.push(v);
            }
        }
        for (let l = 0; l < levels.length; l++) {
            for (let j = 0; j < nc; j++) {
                z.push(columns[l * nc + j]);
                zColLevels.push(levels[l]);
            }
        }
        // the lower triangle of the term's block in column-major order: its index in θ
        const triangle = Array.from({ length: nc }, () => new Array(nc).fill(-1));
        let k = t.thetaOffset;
        for (let j = 0; j < nc; j++) {
            for (let i = j; i < nc; i++) {
                triangle[i][j] = k++;
                theta.push(i === j ? 1 : 0);
                lower.push(i === j ? 0 : -Infinity);
            }
        }
        for (let l = 0; l < t.nLevels; l++) {
            const base = t.zOffset + l * nc;
            for (let j = 0; j < nc; j++)
                for (let i = j; i < nc; i++)
                    lambda.push({ row: base + i, col: base + j, theta: triangle[i][j] });
        }
    }
    // aliased columns of X dropped
    const messages = [];
    let x = fixedDesign.x;
    let xColNames = fixedDesign.colNames;
    let xAssign = fixedDesign.assign;
    if (xColNames.length > 0) {
        const decomposition = qr(x);
        const aliased = new Set(decomposition.pivot.slice(decomposition.rank));
        if (aliased.size > 0) {
            const keep = xColNames.map((_, j) => j).filter((j) => !aliased.has(j));
            x = x.map((row) => keep.map((j) => row[j]));
            xColNames = keep.map((j) => xColNames[j]);
            xAssign = keep.map((j) => xAssign[j]);
            messages.push(`fixed-effect model matrix is rank deficient so dropping ${aliased.size} ${aliased.size === 1 ? "column / coefficient" : "columns / coefficients"}`);
        }
    }
    // predictors on very different scales: the standard deviations of the columns that are not all 0 or 1
    const warnings = [...fixedDesign.warnings];
    const sds = [];
    for (let j = 0; j < xColNames.length; j++) {
        const col = x.map((row) => row[j]);
        if (col.every((v) => v === 0 || v === 1))
            continue;
        const mean = col.reduce((s, v) => s + v, 0) / n;
        const sd = Math.sqrt(col.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
        sds.push(sd);
    }
    const limit = Math.log(1000);
    // (a constant column other than 0/1 has sd 0, so log(0) = -Infinity and the warning is given: lme4's check includes
    // such columns too, so this is intended)
    const badScale = sds.some((a, i) => Math.abs(Math.log(a)) > limit || sds.some((b, k) => k !== i && Math.abs(Math.log(a / b)) > limit));
    if (badScale) {
        warnings.push("Some predictor variables are on very different scales: consider rescaling. \nYou may also use (g)lmerControl(autoscale = TRUE) to improve numerical stability.");
    }
    const out = {
        rows: frame.rows,
        y: fixedDesign.y ?? new Array(n).fill(0),
        xColNames,
        x,
        xAssign: [...xAssign],
        xTermLabels: [...fixedDesign.terms.termLabels],
        terms,
        groups,
        q: z.length,
        z,
        zColLevels,
        theta,
        lower,
        lambda,
        messages,
        warnings,
    };
    if (generalised) {
        // the response variables: the response, and the second column of cbind(a, b) (the frame's second variable)
        const second = parsed.responseColumns !== undefined && parsed.responseColumns[1] !== parsed.responseColumns[0];
        out.response = second ? [frame.variables[0], frame.variables[1]] : parsed.responseColumns !== undefined ? [frame.variables[0], frame.variables[0]] : [frame.variables[0]];
    }
    return out;
}
