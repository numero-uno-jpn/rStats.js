// Grouped summaries: R's tapply, split and aggregate.
//
// Written for rStats.js (no ported code) from oracle/grouping-behaviour.md. Group labels are turned into factors with
// the library's level rules: the sorted distinct non-missing values (numbers by value, strings by code point, FALSE
// before TRUE). With several factors the groups are the cells of their cross classification in column-major order
// (the first factor varies fastest). A row whose label is missing (null, or NaN in a numeric column) belongs to no
// group. tapply keeps the empty cells (NaN or null), split keeps them unless `drop`, aggregate leaves them out.
import { formatR } from "../htest/core/simulate.js";
import { parseFormula } from "../models/formula.js";
import { compareCodePoints } from "../models/modelFrame.js";
const isMissing = (v) => v === null || (typeof v === "number" && Number.isNaN(v));
const levelOrder = (a, b) => typeof a === "number" ? a - b : typeof a === "string" ? compareCodePoints(a, b) : Number(a) - Number(b);
/** A level as R names it: numbers as as.character (15 significant digits), booleans as TRUE and FALSE */
const levelName = (v) => typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : typeof v === "string" ? v : Number.isFinite(v) ? formatR(v) : v > 0 ? "Inf" : "-Inf";
function factorOf(name, labels) {
    const vals = Array.from(labels, (v) => (v === 0 ? 0 : v)); // -0 is the label 0
    const kinds = new Set(vals.filter((v) => !isMissing(v)).map((v) => typeof v));
    if (kinds.size > 1)
        throw new TypeError(`${name} mixes ${[...kinds].join(" and ")} labels`);
    const kind = [...kinds][0];
    if (kind !== undefined && kind !== "number" && kind !== "string" && kind !== "boolean") {
        throw new TypeError(`${name} has labels of an unsupported type`);
    }
    const levels = [...new Set(vals.filter((v) => !isMissing(v)))].sort(levelOrder);
    const pos = new Map(levels.map((l, i) => [l, i]));
    return { levels, codes: vals.map((v) => (isMissing(v) ? -1 : pos.get(v))) };
}
const isLabelArray = (v) => Array.isArray(v) || v instanceof Float64Array;
/** One array of labels, or an array of such arrays (one per factor), as a list of factors' labels */
function labelLists(index) {
    if (index instanceof Float64Array)
        return [index];
    if (!Array.isArray(index))
        throw new TypeError("the group labels must be an array or an array of arrays");
    if (index.length > 0 && index.every(isLabelArray))
        return [...index];
    if (index.some(isLabelArray))
        throw new TypeError("the group labels must be an array or an array of arrays");
    return [index];
}
function groupingOf(lists, names, n) {
    lists.forEach((l, j) => {
        if (l.length !== n)
            throw new RangeError(`${names[j]} must have one label per row (${n}), not ${l.length}`);
    });
    const factors = lists.map((l, j) => factorOf(names[j], l));
    const size = factors.reduce((s, f) => s * f.levels.length, 1);
    const cells = new Array(n);
    for (let i = 0; i < n; i++) {
        let cell = 0;
        let stride = 1;
        for (const f of factors) {
            const c = f.codes[i];
            if (c < 0) {
                cell = -1;
                break;
            }
            cell += c * stride;
            stride *= f.levels.length;
        }
        cells[i] = cell;
    }
    return { factors, size, cells };
}
/** The rows (0-based) of each cell, in row order; an empty array for an empty cell */
function rowsByCell(g) {
    const rows = Array.from({ length: g.size }, () => []);
    g.cells.forEach((c, i) => {
        if (c >= 0)
            rows[c].push(i);
    });
    return rows;
}
/** The level of each factor in a cell */
function cellLevels(g, cell) {
    return g.factors.map((f) => {
        const k = f.levels.length;
        const level = f.levels[cell % k];
        cell = Math.floor(cell / k);
        return level;
    });
}
const factorNames = (count, what) => Array.from({ length: count }, (_, j) => (count === 1 ? what : `${what}[${j}]`));
/**
 * The function applied to the values of each group. Equivalent to R's `tapply(x, index, fun)`.
 *
 * `index` is one array of group labels (one per value of `x`) or an array of such arrays, one per factor. The
 * function is called only for the non-empty cells; a value of `x` whose label is missing is left out.
 *
 * @example
 * ```ts
 * tapply([1, 2, 3, 4], ["b", "a", "b", "a"], (v) => v.length); // { dim: [2], dimnames: [["a", "b"]], values: [2, 2] }
 * ```
 *
 * @category Data frames
 */
export function tapply(x, index, fun) {
    const xs = Array.from(x);
    const lists = labelLists(index);
    const g = groupingOf(lists, factorNames(lists.length, "index"), xs.length);
    const results = rowsByCell(g).map((rows) => (rows.length === 0 ? null : { value: fun(rows.map((i) => xs[i])) }));
    const scalar = results.every((r) => r === null || typeof r.value === "number");
    const values = scalar ? results.map((r) => (r === null ? NaN : r.value)) : results.map((r) => (r === null ? null : r.value));
    return {
        dim: g.factors.map((f) => f.levels.length),
        dimnames: g.factors.map((f) => [...f.levels]),
        values: values,
    };
}
/** The rows of a data frame, each column keeping its kind (array or Float64Array) */
function rowsOf(data, rows) {
    const out = {};
    for (const [name, col] of Object.entries(data)) {
        out[name] = col instanceof Float64Array ? Float64Array.from(rows, (i) => col[i]) : rows.map((i) => col[i]);
    }
    return out;
}
function rowCount(data) {
    const cols = Object.values(data);
    const n = cols[0]?.length ?? 0;
    for (const [name, col] of Object.entries(data)) {
        if (!isLabelArray(col))
            throw new TypeError(`column '${name}' must be an array`);
        if (col.length !== n)
            throw new RangeError(`the columns of the data frame have different lengths (found for '${name}')`);
    }
    return n;
}
export function split(x, f, options = {}) {
    const sep = options.sep ?? ".";
    const lists = labelLists(f);
    const frame = !isLabelArray(x);
    if (frame && (typeof x !== "object" || x === null))
        throw new TypeError("x must be an array or a data frame");
    const n = frame ? rowCount(x) : x.length;
    const g = groupingOf(lists, factorNames(lists.length, "f"), n);
    const xs = frame ? [] : Array.from(x);
    const out = new Map();
    rowsByCell(g).forEach((rows, cell) => {
        if (rows.length === 0 && (options.drop || g.factors.length === 1))
            return;
        const name = cellLevels(g, cell).map(levelName).join(sep);
        out.set(name, frame ? rowsOf(x, rows) : rows.map((i) => xs[i]));
    });
    return out;
}
/** A summarised column as numbers (null is NaN) */
function numericColumn(name, col) {
    if (col === undefined)
        throw new Error(`object '${name}' not found`);
    if (!isLabelArray(col))
        throw new TypeError(`column '${name}' must be an array`);
    return Array.from(col, (v) => {
        if (v === null)
            return NaN;
        if (typeof v !== "number")
            throw new TypeError(`column '${name}' to summarise must be numeric`);
        return v;
    });
}
function labelColumn(data, name) {
    const col = Object.prototype.hasOwnProperty.call(data, name) ? data[name] : undefined;
    if (col === undefined)
        throw new Error(`object '${name}' not found`);
    if (!isLabelArray(col))
        throw new TypeError(`column '${name}' must be an array`);
    return col;
}
/** The variables of a right-hand side that is a sum of variables (`g`, `g + h`, ...) */
function summands(node, out) {
    if (node.type === "var")
        out.push(node.name);
    else if (node.type === "binary" && node.op === "+") {
        summands(node.left, out);
        summands(node.right, out);
    }
    else if (node.type === "paren")
        summands(node.arg, out);
    else
        throw new SyntaxError("invalid formula: the right-hand side must be grouping variables joined by '+'");
    return out;
}
/** The summarised and the grouping columns of `y ~ g`, `y ~ g + h`, `cbind(y, z) ~ g` or `. ~ g` */
function aggregateFormula(formula, columns) {
    if (typeof formula !== "string")
        throw new TypeError("the formula must be a string");
    const tilde = formula.indexOf("~");
    if (tilde < 0)
        throw new SyntaxError("invalid formula: missing '~'");
    const lhs = formula.slice(0, tilde).trim();
    const groups = summands(parseFormula(`~ ${formula.slice(tilde + 1)}`).rhs, []);
    const name = /^[A-Za-z.][A-Za-z0-9._]*$/;
    let values;
    if (lhs === ".")
        values = columns.filter((c) => !groups.includes(c));
    else {
        const m = /^cbind\s*\((.*)\)$/s.exec(lhs);
        values = m === null ? [lhs] : m[1].split(",").map((s) => s.trim());
        if (values.some((v) => !name.test(v) || v === ".")) {
            throw new SyntaxError("invalid formula: the left-hand side must be a variable, cbind(...) of variables or '.'");
        }
    }
    return { values, groups };
}
function aggregateRows(valueNames, valueCols, groupNames, groupCols, keep, fun) {
    const n = groupCols[0]?.length ?? 0;
    valueNames.forEach((v, j) => {
        if (valueCols[j].length !== n)
            throw new RangeError(`variable lengths differ (found for '${v}')`);
    });
    const g = groupingOf(groupCols, groupNames, n);
    const cells = rowsByCell(g).map((rows, cell) => ({ cell, rows: rows.filter(keep) })).filter((c) => c.rows.length > 0);
    const out = {};
    const levels = cells.map((c) => cellLevels(g, c.cell));
    groupNames.forEach((name, j) => {
        out[name] = levels.map((l) => l[j]);
    });
    valueNames.forEach((name, j) => {
        const col = valueCols[j];
        const results = cells.map((c) => fun(c.rows.map((i) => col[i])));
        const flat = results.map((r) => {
            if (typeof r === "number")
                return { names: undefined, values: [r] };
            if (Array.isArray(r))
                return { names: undefined, values: [...r] };
            const rec = r;
            return { names: Object.keys(rec), values: Object.values(rec) };
        });
        const k = flat[0]?.values.length ?? 1;
        if (flat.some((r) => r.values.length !== k))
            throw new RangeError("fun must return values of the same length for every group");
        if (k === 1 && flat[0]?.names === undefined) {
            out[name] = flat.map((r) => r.values[0]);
            return;
        }
        for (let m = 0; m < k; m++) {
            const suffix = flat[0].names?.[m] ?? String(m + 1);
            out[`${name}.${suffix}`] = flat.map((r) => r.values[m]);
        }
    });
    return out;
}
export function aggregate(first, second, fun) {
    if (typeof second !== "object" || second === null)
        throw new TypeError("the data must be an object of columns");
    if (typeof first === "string") {
        const data = second;
        const { values, groups } = aggregateFormula(first, Object.keys(data));
        const has = (v) => Object.prototype.hasOwnProperty.call(data, v);
        const valueCols = values.map((v) => numericColumn(v, has(v) ? data[v] : undefined));
        const groupCols = groups.map((v) => labelColumn(data, v));
        const keep = (i) => valueCols.every((c) => !Number.isNaN(c[i])) && groupCols.every((c) => !isMissing(c[i]));
        return aggregateRows(values, valueCols, groups, groupCols, keep, fun);
    }
    if (typeof first !== "object" || first === null)
        throw new TypeError("x must be a data frame");
    const values = Object.keys(first);
    const valueCols = values.map((v) => numericColumn(v, first[v]));
    const groups = Object.keys(second);
    if (groups.length === 0)
        throw new RangeError("'by' must name at least one grouping column");
    const groupCols = groups.map((v) => labelColumn(second, v));
    return aggregateRows(values, valueCols, groups, groupCols, () => true, fun);
}
