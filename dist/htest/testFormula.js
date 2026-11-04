// Formula forms of the hypothesis tests (R's formula methods of t.test, wilcox.test, kruskal.test, friedman.test,
// cor.test, ...): the data a formula selects from a data frame, which the tests then pass to their default forms.
//
// Written for rStats.js (no ported code) from oracle/formulatests-behaviour.md. Only the variables of the formula
// count: the rows where one of them is missing are dropped (src/models/modelFrame.ts), and a grouping variable becomes
// a factor of the remaining values, with sorted levels (numbers as numbers, strings by code point) and no unused
// level. The formula is parsed with src/models/formula.ts; `Pair(a, b)` on the left and `|` on the right, which that
// parser does not know, are split off the text first.
import { parseFormula, termsOf } from "../models/formula.js";
import { modelFrame, presentLevels } from "../models/modelFrame.js";
import { formatR } from "./core/simulate.js";
/**
 * A variable of a model frame as a factor of the values present: numbers sorted as numbers and labelled as R prints
 * them, a boolean's levels FALSE and TRUE only if they occur
 */
function groupFactor(v) {
    if (v.kind === "factor")
        return presentLevels(v);
    const sorted = [...new Set(v.values)].sort((a, b) => a - b);
    const levels = [...new Set(sorted.map(formatR))];
    const position = new Map(levels.map((l, i) => [l, i]));
    return { levels, codes: v.values.map((x) => position.get(formatR(x))) };
}
/** The values of a numeric variable of a model frame (a response or a variable of a correlation) */
function numericValues(v, name) {
    if (v.kind !== "numeric")
        throw new TypeError(`'${name}' must be a numeric column`);
    return v.values;
}
/** The terms of a formula without `Pair()` or `|`, and the names of the variables of its right-hand side */
function plainTerms(formula, data) {
    const parsed = parseFormula(formula);
    const terms = termsOf(parsed, Object.keys(data));
    return { terms, rhsVariables: terms.variables.slice(terms.response === 0 ? 1 : 0) };
}
/** The text on each side of the formula's `~` (the left side empty for a one-sided formula) */
function splitTilde(formula) {
    if (typeof formula !== "string")
        throw new TypeError("the formula must be a string");
    const at = formula.indexOf("~");
    return at < 0 ? undefined : { lhs: formula.slice(0, at).trim(), rhs: formula.slice(at + 1) };
}
const PAIR = /^Pair\s*\(\s*([A-Za-z.][A-Za-z0-9._]*)\s*,\s*([A-Za-z.][A-Za-z0-9._]*)\s*\)$/;
const MISSING_OR_INCORRECT = "'formula' missing or incorrect";
/** Whether a right-hand side is the intercept alone (`~ 1`) */
const interceptOnly = (terms, rhsVariables) => rhsVariables.length === 0 && terms.terms.length === 0 && terms.intercept;
/**
 * The samples of a two-sample test's formula. `oneSample` allows `y ~ 1` and `Pair(a, b) ~ 1` (t.test and
 * wilcox.test).
 */
export function twoSampleData(formula, data, oneSample) {
    const sides = splitTilde(formula);
    const pair = sides === undefined ? null : PAIR.exec(sides.lhs);
    if (pair !== null) {
        const { terms, rhsVariables } = plainTerms(`~${sides.rhs}`, data);
        if (!oneSample || !interceptOnly(terms, rhsVariables))
            throw new Error(MISSING_OR_INCORRECT);
        const frame = modelFrame(data, [pair[1], pair[2]]);
        return { kind: "paired", x: numericValues(frame.variables[0], pair[1]), y: numericValues(frame.variables[1], pair[2]) };
    }
    const { terms, rhsVariables } = plainTerms(formula, data);
    if (terms.response < 0)
        throw new Error(MISSING_OR_INCORRECT);
    const response = terms.variables[0];
    if (oneSample && interceptOnly(terms, rhsVariables)) {
        return { kind: "one", x: numericValues(modelFrame(data, [response]).variables[0], response) };
    }
    if (rhsVariables.length !== 1 || terms.terms.length !== 1)
        throw new Error(MISSING_OR_INCORRECT);
    const frame = modelFrame(data, [response, rhsVariables[0]], { dropUnusedLevels: true });
    const values = numericValues(frame.variables[0], response);
    const group = groupFactor(frame.variables[1]);
    if (group.levels.length !== 2)
        throw new Error("grouping factor must have exactly 2 levels");
    return {
        kind: "two",
        x: values.filter((_, i) => group.codes[i] === 0),
        y: values.filter((_, i) => group.codes[i] === 1),
        levels: [group.levels[0], group.levels[1]],
    };
}
/** The two samples of a formula `y ~ g` whose group has two levels (var.test, ansari.test, mood.test, ks.test) */
export function twoGroupData(formula, data) {
    const d = twoSampleData(formula, data, false);
    if (d.kind !== "two")
        throw new Error(MISSING_OR_INCORRECT);
    return d;
}
/** The response and group of a formula `y ~ g` with one variable on the right (kruskal.test, fligner.test, bartlett.test) */
export function kSampleData(formula, data) {
    const { terms, rhsVariables } = plainTerms(formula, data);
    if (terms.response < 0)
        throw new Error(MISSING_OR_INCORRECT);
    if (rhsVariables.length !== 1)
        throw new Error("'formula' should be of the form response ~ group");
    const response = terms.variables[0];
    const frame = modelFrame(data, [response, rhsVariables[0]], { dropUnusedLevels: true });
    return { values: numericValues(frame.variables[0], response), group: groupFactor(frame.variables[1]) };
}
/** The samples of each level, in the order of the levels */
export function samplesByLevel(values, group) {
    const out = group.levels.map(() => []);
    values.forEach((v, i) => out[group.codes[i]].push(v));
    return out;
}
/**
 * The response and groups of oneway.test's formula `y ~ A` or `y ~ A + B + ...`: with several factors the groups are
 * the combinations present in the data, numbered with the first factor varying fastest (R's interaction()).
 */
export function onewayData(formula, data) {
    const { terms, rhsVariables } = plainTerms(formula, data);
    if (terms.response < 0 || rhsVariables.length === 0)
        throw new Error(MISSING_OR_INCORRECT);
    const response = terms.variables[0];
    const frame = modelFrame(data, [response, ...rhsVariables], { dropUnusedLevels: true });
    const factors = frame.variables.slice(1).map(groupFactor);
    const groups = frame.rows.map((_, i) => {
        let code = 0;
        let stride = 1;
        for (const f of factors) {
            code += f.codes[i] * stride;
            stride *= f.levels.length;
        }
        return code;
    });
    return { values: numericValues(frame.variables[0], response), groups };
}
const INCORRECT_BLOCKS = "incorrect specification for 'formula'";
/**
 * The matrix (one row per block, one column per group, levels in order) of a blocked design's formula `y ~ w | b`
 * (friedman.test, quade.test). Rows with a missing value are dropped first; every combination of group and block must
 * then occur exactly once.
 */
export function blockData(formula, data) {
    const sides = splitTilde(formula);
    const parts = sides?.rhs.split("|");
    if (sides === undefined || sides.lhs === "" || parts.length !== 2)
        throw new Error(INCORRECT_BLOCKS);
    const one = (text) => {
        const { terms, rhsVariables } = plainTerms(text, data);
        if (rhsVariables.length !== 1 || terms.terms.length !== 1)
            throw new Error(INCORRECT_BLOCKS);
        return rhsVariables[0];
    };
    const { terms } = plainTerms(`${sides.lhs} ~ 1`, data);
    const response = terms.variables[0];
    const groupName = one(`~${parts[0]}`);
    const blockName = one(`~${parts[1]}`);
    const frame = modelFrame(data, [response, groupName, blockName], { dropUnusedLevels: true });
    const values = numericValues(frame.variables[0], response);
    const group = groupFactor(frame.variables[1]);
    const block = groupFactor(frame.variables[2]);
    const matrix = block.levels.map(() => group.levels.map(() => NaN));
    const counts = block.levels.map(() => group.levels.map(() => 0));
    values.forEach((v, i) => {
        const b = block.codes[i];
        const w = group.codes[i];
        counts[b][w]++;
        matrix[b][w] = v;
    });
    if (counts.some((row) => row.some((c) => c !== 1)))
        throw new Error("not an unreplicated complete block design");
    return matrix;
}
/** The two variables of cor.test's one-sided formula `~ x + z` */
export function correlationData(formula, data) {
    const { terms, rhsVariables } = plainTerms(formula, data);
    if (terms.response >= 0)
        throw new Error("'formula' missing or invalid");
    if (rhsVariables.length !== 2)
        throw new Error("invalid formula");
    const frame = modelFrame(data, rhsVariables);
    return { x: numericValues(frame.variables[0], rhsVariables[0]), y: numericValues(frame.variables[1], rhsVariables[1]) };
}
