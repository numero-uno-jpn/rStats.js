// Numbers as the levels of a factor, the way R's factor() makes them: the sorted distinct values are written as
// as.character writes them (15 significant digits, src/htest/core/simulate.ts's formatR), and the values with the
// same text are one level. So 0.1 + 0.2 and 0.3 are one level ("0.3"), and so are 1e15 and 1e15 + 1 ("1e+15").
// Written for rStats.js (no ported code) from oracle/report-0.11.1-behaviour.md.
import { formatR } from "../htest/core/simulate.js";
/**
 * For each number, the value of its level: the smallest value with the same text (R takes the level's text from
 * the smallest, since the values are sorted first). -0 is 0; NaN is returned as is
 */
function levelValueMap(values) {
    const distinct = [...new Set(Array.from(values, (v) => (v === 0 ? 0 : v)))].filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
    const out = new Map();
    // Rounding to 15 digits keeps the order, so the values with the same text are next to each other
    let text;
    let level = NaN;
    for (const v of distinct) {
        const t = formatR(v);
        if (t !== text) {
            text = t;
            level = v;
        }
        out.set(v, level);
    }
    return out;
}
/**
 * The labels with every number replaced by the value of its level (see the top of this file): numbers with the same
 * 15-digit text become the same number, the smallest of them; -0 becomes 0. NaN and labels that are not numbers are
 * unchanged
 */
export function numberLevels(labels) {
    const xs = Array.from(labels);
    const map = levelValueMap(xs.filter((v) => typeof v === "number"));
    return xs.map((v) => (typeof v === "number" && !Number.isNaN(v) ? map.get(v) : v));
}
/**
 * The text of a level as R writes it: a number as as.character does (15 significant digits, so 1e15 is "1e+15" and
 * 1/3 is "0.333333333333333"; Inf is "Inf"), anything else with String
 */
export function levelText(v) {
    if (typeof v !== "number")
        return String(v);
    if (v === Infinity)
        return "Inf";
    if (v === -Infinity)
        return "-Inf";
    return formatR(v);
}
