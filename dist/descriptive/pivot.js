// Wide and long formats: tidyr's pivot_longer and pivot_wider.
//
// Written for rStats.js (no ported code) from oracle/pivot-behaviour.md. A data frame is the library's DataFrame (see
// dataFrames.ts): `null`, and `NaN` in a numeric column, is a missing value. Columns that are copied through (the
// columns not pivoted, the id columns) keep their kind (a Float64Array stays a Float64Array); a value column is a
// Float64Array when its sources are, else an array. Where tidyr would make a list column (a cell that several rows
// fill), pivotWider throws instead, since a data frame here cannot hold one. pivotLonger passes tidyr's warnings to
// its `onWarning` option.
import { formatR } from "../htest/core/simulate.js";
import { addColumn, compareValues, isMissing, pick, rowCount } from "./dataFrames.js";
const nameList = (v) => (typeof v === "string" ? [v] : [...v]);
/**
 * colsVary or namesVary, checked as tidyr's arg_match: exactly "fastest" or "slowest" (default "fastest"); anything
 * else was taken as "fastest" (#256)
 */
function varyArg(arg, v) {
    if (v === undefined || v === null)
        return "fastest";
    if (v === "fastest" || v === "slowest")
        return v;
    if (typeof v !== "string")
        throw new Error(`\`${arg}\` must be a string or character vector.`);
    throw new Error(`\`${arg}\` must be one of "fastest" or "slowest", not "${v}".`);
}
function requireColumns(data, names) {
    for (const n of names)
        if (!Object.hasOwn(data, n))
            throw new Error(`Column \`${n}\` doesn't exist.`);
}
/** The type of a column; `null` for an array of missing values only (which combines with any type) */
function columnType(name, col) {
    if (col instanceof Float64Array)
        return "double";
    let type = null;
    for (const v of col) {
        if (v === null)
            continue;
        const t = typeof v === "number" ? "double" : typeof v === "string" ? "character" : "logical";
        if (type !== null && t !== type)
            throw new TypeError(`column '${name}' mixes ${type} and ${t} values`);
        type = t;
    }
    return type;
}
/** The common type of the source columns of a value column: numbers absorb booleans, strings combine with neither */
function commonType(data, sources) {
    let common = null;
    for (const s of sources) {
        const t = columnType(s, data[s]);
        if (t === null)
            continue;
        if (common === null)
            common = { type: t, column: s };
        else if (common.type !== t) {
            if (common.type === "character" || t === "character") {
                throw new TypeError(`Can't combine \`${common.column}\` <${common.type}> and \`${s}\` <${t}>.`);
            }
            if (t === "double")
                common = { type: t, column: s };
        }
    }
    return common?.type ?? null;
}
/** The matches of a regular expression (as a string) in each name: its capture groups, `null` if it does not match */
function captures(names, pattern, count) {
    const groups = new RegExp(`${pattern}|`).exec("").length - 1;
    if (groups !== count)
        throw new Error(`\`regex\` should define ${count} groups; ${groups} found.`);
    const re = new RegExp(pattern);
    return names.map((name) => {
        const m = re.exec(name);
        return Array.from({ length: count }, (_, j) => (m === null ? null : (m[j + 1] ?? null)));
    });
}
/** The number of UTF-16 code units of the character at i: 2 for a surrogate pair, else 1 */
function codePointLength(s, i) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        const d = s.charCodeAt(i + 1);
        if (d >= 0xdc00 && d <= 0xdfff)
            return 2;
    }
    return 1;
}
/** The names split at the separator into `count` parts, and tidyr's warnings for names with more or fewer pieces */
function separated(names, sep, count, warnings) {
    const re = new RegExp(sep, "g");
    const extra = [];
    const short = [];
    const parts = names.map((name, i) => {
        // The pieces between the matches, as tidyr (R's gregexpr(perl = TRUE) and regmatches(invert = TRUE)): after a
        // zero-width match the search goes on one character later, and it stops once it reaches the end of the name. A
        // character is a code point: a surrogate pair is passed whole, as stringr's str_split (#500; R's gregexpr went on
        // inside the character's UTF-8 bytes and gave empty pieces)
        const pieces = [];
        let start = 0;
        let prev = 0;
        for (;;) {
            re.lastIndex = start;
            const m = re.exec(name);
            if (m === null)
                break;
            pieces.push(name.slice(prev, m.index));
            prev = m.index + m[0].length;
            start = m[0].length === 0 ? m.index + codePointLength(name, m.index) : prev;
            if (start >= name.length)
                break;
        }
        pieces.push(name.slice(prev));
        if (pieces.length > count)
            extra.push(i + 1);
        if (pieces.length < count)
            short.push(i + 1);
        return Array.from({ length: count }, (_, j) => pieces[j] ?? null);
    });
    const rows = (r) => `${r.length} rows [${r.join(", ")}]`;
    if (extra.length > 0)
        warnings.push(`Expected ${count} pieces. Additional pieces discarded in ${rows(extra)}.`);
    if (short.length > 0)
        warnings.push(`Expected ${count} pieces. Missing pieces filled with \`NA\` in ${rows(short)}.`);
    return parts;
}
/** The transform of a `namesTo` column (own properties only: toString has no transform unless one is given, #436) */
function ownTransform(transforms, to) {
    return transforms !== undefined && Object.hasOwn(transforms, to) ? transforms[to] : undefined;
}
/** The parts of each name, one per element of `namesTo` */
function nameParts(names, namesTo, options, warnings) {
    const { namesSep, namesPattern } = options;
    // no names: no parts, and namesSep and namesPattern are not used (as tidyr's build_longer_spec)
    if (namesTo.length === 0)
        return names.map(() => []);
    if (namesTo.length === 1) {
        if (namesSep !== undefined)
            throw new Error("`names_sep` can't be used with a length 1 `names_to`.");
        if (namesPattern === undefined)
            return names.map((n) => [n]);
        // exactly one capture group, as tidyr (no group gave null parts, a second group was ignored, #255)
        return captures(names, namesPattern, 1);
    }
    if ((namesSep === undefined) === (namesPattern === undefined)) {
        throw new Error("If you supply multiple names in `names_to` you must also supply one of `names_sep` or `names_pattern`.");
    }
    return namesSep !== undefined
        ? separated(names, namesSep, namesTo.length, warnings)
        : captures(names, namesPattern, namesTo.length);
}
/**
 * Reshapes a data frame from wide to long: the selected columns become rows. Equivalent to `tidyr::pivot_longer()` in
 * R. The result has the columns not selected, a column per part of the selected names (`namesTo`), and the value
 * column (`valuesTo`), or with `".value"` in `namesTo` one value column per value of that part. The values of the
 * selected columns are combined into one type: numbers with booleans give numbers; strings with either are an error.
 *
 * @example
 * ```ts
 * const wide = { id: ["s1", "s2"], t1: [5.1, 4.8], t2: [6.3, 7.2] };
 * pivotLonger(wide, { cols: ["t1", "t2"], namesTo: "time", valuesTo: "score" });
 * // { id: ["s1", "s1", "s2", "s2"], time: ["t1", "t2", "t1", "t2"], score: [5.1, 6.3, 4.8, 7.2] }
 * ```
 *
 * @category Data frames
 */
export function pivotLonger(data, options) {
    const colsVary = varyArg("cols_vary", options.colsVary);
    const n = rowCount(data);
    const allNames = Object.keys(data);
    const cols = typeof options.cols === "function" ? allNames.filter(options.cols) : [...new Set(options.cols)];
    requireColumns(data, cols);
    if (cols.length === 0)
        throw new Error("`cols` must select at least one column.");
    const namesTo = nameList(options.namesTo ?? "name");
    const valuePosition = namesTo.indexOf(".value");
    if (namesTo.lastIndexOf(".value") !== valuePosition)
        throw new Error('`names_to` may contain ".value" only once');
    const warnings = [];
    const prefix = options.namesPrefix === undefined ? null : new RegExp(`^(?:${options.namesPrefix})`);
    const stripped = cols.map((c) => (prefix === null ? c : c.replace(prefix, "")));
    const parts = nameParts(stripped, namesTo, options, warnings);
    // The keys (the parts other than ".value") and the value columns with their sources
    const keys = [];
    const values = [];
    if (valuePosition < 0) {
        keys.push(...parts);
        values.push({ name: options.valuesTo ?? "value", sources: [...cols] });
    }
    else {
        const keyIndex = new Map();
        const valueIndex = new Map();
        const valueTransform = ownTransform(options.namesTransform, ".value");
        parts.forEach((p, c) => {
            const key = p.filter((_, j) => j !== valuePosition);
            const id = JSON.stringify(key);
            let k = keyIndex.get(id);
            if (k === undefined) {
                k = keys.length;
                keyIndex.set(id, k);
                keys.push(key);
                for (const v of values)
                    v.sources.push(null);
            }
            // the transform of ".value" names the value columns, as tidyr (missing parts stay missing)
            const part = p[valuePosition] ?? null;
            const transformed = part === null || valueTransform === undefined ? part : valueTransform(part);
            if (transformed !== null && typeof transformed !== "string") {
                throw new Error(`the transform of \`.value\` must give strings, not ${typeof transformed}`);
            }
            const name = transformed ?? "NA";
            let value = valueIndex.get(name);
            if (value === undefined) {
                value = { name, sources: keys.map(() => null) };
                valueIndex.set(name, value);
                values.push(value);
            }
            if (value.sources[k] !== null)
                throw new Error(`the names give the value column '${name}' twice for one key`);
            value.sources[k] = cols[c];
        });
    }
    const types = values.map((v) => commonType(data, v.sources.filter((s) => s !== null)));
    // Rows of the result: [input row, key]
    let rows = [];
    if (colsVary === "slowest") {
        for (let k = 0; k < keys.length; k++)
            for (let i = 0; i < n; i++)
                rows.push([i, k]);
    }
    else {
        for (let i = 0; i < n; i++)
            for (let k = 0; k < keys.length; k++)
                rows.push([i, k]);
    }
    const cellOf = (v, i, k) => {
        const s = v.sources[k];
        return s === null || s === undefined ? null : data[s][i];
    };
    if (options.valuesDropNa === true) {
        rows = rows.filter(([i, k]) => values.some((v) => !isMissing(cellOf(v, i, k))));
    }
    const out = {};
    const inputRows = rows.map(([i]) => i);
    for (const name of allNames)
        if (!cols.includes(name))
            addColumn(out, name, pick(data[name], inputRows));
    namesTo.forEach((to, j) => {
        if (j === valuePosition)
            return;
        const transform = ownTransform(options.namesTransform, to);
        const part = (k) => {
            const p = keys[k][j < valuePosition || valuePosition < 0 ? j : j - 1];
            return p === null || transform === undefined ? p : transform(p);
        };
        addColumn(out, to, rows.map(([, k]) => part(k)));
    });
    values.forEach((v, m) => {
        const double = types[m] === "double";
        if (double && v.sources.every((s) => s !== null && data[s] instanceof Float64Array)) {
            addColumn(out, v.name, Float64Array.from(rows, ([i, k]) => cellOf(v, i, k)));
        }
        else {
            const cells = rows.map(([i, k]) => {
                const x = cellOf(v, i, k);
                return double && typeof x === "boolean" ? Number(x) : x;
            });
            addColumn(out, v.name, cells);
        }
    });
    if (options.onWarning !== undefined)
        for (const w of new Set(warnings))
            options.onWarning(w);
    return out;
}
// ---- pivotWider ----
const typeOfValue = (x) => typeof x === "number" ? "double" : typeof x === "string" ? "character" : "logical";
/** valuesFill cast to the type of the value column, as vctrs' vec_cast (a missing fill goes with any type) */
function castFill(fill, type) {
    if (fill === null || type === null)
        return fill;
    const from = typeOfValue(fill);
    if (from === type)
        return fill;
    if (type === "double" && from === "logical")
        return Number(fill);
    if (type === "logical" && from === "double") {
        const x = fill;
        if (Number.isNaN(x))
            return null;
        if (x === 0 || x === 1)
            return x === 1;
        throw new TypeError("Can't convert from `fill` <double> to <logical> due to loss of precision.");
    }
    throw new TypeError(`Can't convert \`fill\` <${from}> to <${type}>.`);
}
/** A value as an exact key (missing values are all one key) */
const keyOf = (v) => isMissing(v) ? "NA" : typeof v === "number" ? `n${v}` : typeof v === "string" ? `s${v}` : `b${String(v)}`;
/**
 * The distinct combinations of the values of the columns, in order of first appearance: the combination of each row,
 * and the first row of each combination
 */
function combinations(cols, n) {
    const index = new Map();
    const firsts = [];
    const codes = Array.from({ length: n }, (_, i) => {
        const id = JSON.stringify(cols.map((c) => keyOf(c[i])));
        let code = index.get(id);
        if (code === undefined) {
            code = firsts.length;
            index.set(id, code);
            firsts.push(i);
        }
        return code;
    });
    return { codes, firsts };
}
/** A value as part of a column name: numbers as R's as.character, booleans as TRUE and FALSE, missing as NA */
function labelText(v) {
    if (isMissing(v))
        return "NA";
    if (typeof v === "number")
        return Number.isFinite(v) ? formatR(v) : v > 0 ? "Inf" : "-Inf";
    if (typeof v === "boolean")
        return v ? "TRUE" : "FALSE";
    return v;
}
/** An option given once for all value columns or by value column (own properties only: a column named toString or
 * __proto__ has no setting unless one is given) */
function perColumn(option, isSingle, name) {
    if (option === undefined)
        return undefined;
    if (isSingle(option))
        return option;
    return Object.hasOwn(option, name) ? option[name] : undefined;
}
/**
 * Reshapes a data frame from long to wide: the values of `namesFrom` become columns, filled from `valuesFrom`.
 * Equivalent to `tidyr::pivot_wider()` in R. One row per combination of the id columns (in order of first appearance),
 * the new columns in order of first appearance of their names (unless `namesSort`). A cell that no row fills is
 * `valuesFill` (default missing). A cell that several rows fill is an error unless `valuesFn` summarises the values
 * (tidyr makes a list column there, which a data frame here cannot hold).
 *
 * @example
 * ```ts
 * const long = { id: ["s1", "s1", "s2"], time: ["t1", "t2", "t1"], score: [5.1, 6.3, 4.8] };
 * pivotWider(long, { namesFrom: "time", valuesFrom: "score" });
 * // { id: ["s1", "s2"], t1: [5.1, 4.8], t2: [6.3, null] }
 * ```
 *
 * @category Data frames
 */
export function pivotWider(data, options = {}) {
    const namesVary = varyArg("names_vary", options.namesVary);
    const n = rowCount(data);
    // As tidyr: names_from, then values_from, each existing and not empty; then id_cols. A name given twice is
    // selected once, at its first place (as tidyselect)
    const selection = (v, arg) => {
        const names = [...new Set(nameList(v))];
        requireColumns(data, names);
        if (names.length === 0)
            throw new Error(`\`${arg}\` must select at least one column.`);
        return names;
    };
    const namesFrom = selection(options.namesFrom ?? "name", "names_from");
    const valuesFrom = selection(options.valuesFrom ?? "value", "values_from");
    const idCols = options.idCols === undefined
        ? Object.keys(data).filter((c) => !namesFrom.includes(c) && !valuesFrom.includes(c))
        : [...new Set(nameList(options.idCols))];
    requireColumns(data, idCols);
    for (const c of idCols) {
        const by = namesFrom.includes(c) ? "names_from" : valuesFrom.includes(c) ? "values_from" : null;
        if (by !== null) {
            throw new Error(`\`id_cols\` can't select a column already selected by \`${by}\`. Column \`${c}\` has already been selected.`);
        }
    }
    const prefix = options.namesPrefix ?? "";
    const sep = options.namesSep ?? "_";
    const ids = combinations(idCols.map((c) => data[c]), n);
    const labels = combinations(namesFrom.map((c) => data[c]), n);
    // The name combinations in output order (positions in labels.firsts)
    const nameOrder = labels.firsts.map((_, m) => m);
    if (options.namesSort === true) {
        nameOrder.sort((a, b) => {
            for (const c of namesFrom) {
                const d = compareValues(data[c][labels.firsts[a]], data[c][labels.firsts[b]]);
                if (d !== 0)
                    return d;
            }
            return 0;
        });
    }
    const nameText = labels.firsts.map((r) => prefix + namesFrom.map((c) => labelText(data[c][r])).join(sep));
    // The rows of each cell (id combination, name combination), in data order
    const nNames = labels.firsts.length;
    const cellRows = Array.from({ length: ids.firsts.length * nNames }, () => []);
    for (let i = 0; i < n; i++)
        cellRows[ids.codes[i] * nNames + labels.codes[i]].push(i);
    const isSummary = (o) => typeof o === "function";
    const isFill = (o) => typeof o !== "object" || o === null;
    for (const value of valuesFrom) {
        if (perColumn(options.valuesFn, isSummary, value) === undefined && cellRows.some((rows) => rows.length > 1)) {
            throw new Error(`values from '${value}' are not uniquely identified; use valuesFn to summarise them`);
        }
    }
    // As tidyr: the filled cells of a value column (after valuesFn, called in order of first appearance of the cell)
    // have one common type over all its new columns (numbers absorb booleans, strings combine with neither), and
    // valuesFill is cast to that type (#437, #445)
    const typed = new Map();
    for (const value of valuesFrom) {
        const source = data[value];
        const summary = perColumn(options.valuesFn, isSummary, value);
        const cells = new Array(cellRows.length).fill(null);
        let type = null;
        if (summary === undefined) {
            type = columnType(value, source);
            cellRows.forEach((rows, c) => {
                if (rows.length > 0)
                    cells[c] = source[rows[0]];
            });
        }
        else {
            const done = new Uint8Array(cellRows.length);
            let first = 0;
            let k = 0;
            for (let i = 0; i < n; i++) {
                const c = ids.codes[i] * nNames + labels.codes[i];
                if (done[c] === 1)
                    continue;
                done[c] = 1;
                k++;
                const x = summary(cellRows[c].map((j) => source[j]));
                cells[c] = x;
                if (x === null || x === undefined)
                    continue;
                const t = typeOfValue(x);
                if (type === null || (type === "logical" && t === "double")) {
                    type = t;
                    first = k;
                }
                else if (t !== type && (type === "character" || t === "character")) {
                    throw new TypeError(`Can't combine \`x[[${first}]]\` <${type}> and \`x[[${k}]]\` <${t}>.`);
                }
            }
        }
        const fill = castFill(perColumn(options.valuesFill, isFill, value) ?? null, type);
        typed.set(value, { cells, type: type ?? (fill === null ? null : typeOfValue(fill)), fill });
    }
    const columnOf = (value, m) => {
        const source = data[value];
        const { cells, type, fill } = typed.get(value);
        const col = ids.firsts.map((_, r) => {
            const c = r * nNames + m;
            const x = cellRows[c].length === 0 ? fill : cells[c];
            return type === "double" && typeof x === "boolean" ? Number(x) : x;
        });
        if (source instanceof Float64Array && (type === "double" || type === null)) {
            return Float64Array.from(col, (x) => (x === null ? NaN : x));
        }
        return col;
    };
    const out = {};
    for (const c of idCols)
        addColumn(out, c, pick(data[c], ids.firsts));
    const columnName = (value, m) => valuesFrom.length === 1 ? nameText[m] : `${value}${sep}${nameText[m]}`;
    if (namesVary === "slowest") {
        for (const m of nameOrder)
            for (const v of valuesFrom)
                addColumn(out, columnName(v, m), columnOf(v, m));
    }
    else {
        for (const v of valuesFrom)
            for (const m of nameOrder)
                addColumn(out, columnName(v, m), columnOf(v, m));
    }
    return out;
}
