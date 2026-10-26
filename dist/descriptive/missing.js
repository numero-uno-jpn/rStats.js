// Missing values: R's complete.cases and na.omit for arrays and data frames.
//
// Written for rStats.js (no ported code) from oracle/formulatests-behaviour.md. A value is missing when it is `null`,
// or `NaN` (in a numeric column); a row is complete when no column of any argument is missing there.
const isMissing = (v) => v === null || (typeof v === "number" && Number.isNaN(v));
const isVector = (x) => Array.isArray(x) || ArrayBuffer.isView(x);
/** The columns of an argument (a vector is one column) and its number of rows */
function columnsOf(x) {
    if (isVector(x))
        return { columns: [x], rows: x.length };
    if (typeof x !== "object" || x === null)
        throw new TypeError("the arguments must be arrays or data frames");
    const columns = Object.values(x);
    const rows = columns[0]?.length ?? 0;
    if (columns.some((c) => c.length !== rows))
        throw new RangeError("not all arguments have the same length");
    return { columns, rows };
}
/**
 * Which rows have no missing value. Equivalent to R's `complete.cases()`. One boolean per row, true when no column
 * of any argument is missing (`null`, or `NaN` in a numeric column) in that row.
 *
 * @param args Data frames (objects of equal-length columns) or arrays, all with the same number of rows.
 *
 * @example
 * ```ts
 * completeCases({ a: [1, NaN, 3], s: ["u", "v", null] }); // [true, false, false]
 * ```
 *
 * @category Data frames
 */
export function completeCases(...args) {
    if (args.length === 0)
        throw new RangeError("no input has determined the number of cases");
    const all = args.map(columnsOf);
    const rows = all[0].rows;
    if (all.some((a) => a.rows !== rows))
        throw new RangeError("not all arguments have the same length");
    const columns = all.flatMap((a) => a.columns);
    return Array.from({ length: rows }, (_, i) => columns.every((c) => !isMissing(c[i])));
}
export function naOmit(x) {
    if (isVector(x))
        return Array.from(x).filter((v) => !isMissing(v));
    const keep = completeCases(x);
    const out = {};
    for (const [name, column] of Object.entries(x)) {
        const kept = Array.from(column).filter((_, i) => keep[i]);
        out[name] = column instanceof Float64Array ? Float64Array.from(kept) : kept;
    }
    return out;
}
