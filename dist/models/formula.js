// Model formulas: parsing `response ~ right-hand side` and expanding the right-hand side into terms, as R's terms().
//
// Written for rStats.js (no ported code) from oracle/anova-behaviour.md ("Formulas" and "Coding"). The parser is an
// operator-precedence parser with R's precedences (^, then unary - and +, then :, then %in%, then * and /, then binary
// + and -). The expansion follows the rules listed there: + concatenates, : forms the unions of pairs, * is a + b + a:b,
// ^n the unions of n terms, / and %in% nest, - removes terms (and in its right operand 0 and 1 swap meanings). The
// terms are then sorted stably by degree, and the variables of each term listed in order of first appearance in the
// formula. `codes` gives R's "factors" attribute (1: contrasts, 2: indicators) from the rule on earlier terms.
const invalid = (why) => new SyntaxError(`invalid formula: ${why}`);
function tokenize(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
        const c = s[i];
        if (/\s/.test(c)) {
            i++;
            continue;
        }
        if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(s[i + 1] ?? ""))) {
            const m = /^(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?/.exec(s.slice(i));
            out.push({ kind: "num", text: m[0] });
            i += m[0].length;
            continue;
        }
        if (/[A-Za-z.]/.test(c)) {
            const m = /^[A-Za-z.][A-Za-z0-9._]*/.exec(s.slice(i));
            out.push({ kind: "name", text: m[0] });
            i += m[0].length;
            continue;
        }
        if (s.startsWith("%in%", i)) {
            out.push({ kind: "op", text: "%in%" });
            i += 4;
            continue;
        }
        if ("~+-*/:^()".includes(c)) {
            out.push({ kind: "op", text: c });
            i++;
            continue;
        }
        throw invalid(`unexpected '${c}'`);
    }
    out.push({ kind: "end" });
    return out;
}
/** Binding powers of the binary operators (higher binds tighter); ^ is right associative */
const BINARY = { "+": 1, "-": 1, "*": 2, "/": 2, "%in%": 3, ":": 4, "^": 6 };
const UNARY = 5;
/**
 * Parses a formula string. Throws a SyntaxError whose message starts with "invalid formula" if it cannot be parsed
 * or uses something that is not supported (function calls other than Error(), backquoted names, ...).
 *
 * @param allowError Accept `Error(...)` terms (aov only).
 */
export function parseFormula(formula, allowError = false) {
    if (typeof formula !== "string")
        throw new TypeError("the formula must be a string");
    const toks = tokenize(formula);
    let pos = 0;
    const peek = () => toks[pos];
    const next = () => toks[pos++];
    const isOp = (t, text) => t.kind === "op" && t.text === text;
    function primary() {
        const t = next();
        if (t.kind === "name") {
            if (isOp(peek(), "(")) {
                if (t.text !== "Error" || !allowError)
                    throw invalid(`function calls are not supported (${t.text})`);
                next();
                const arg = expr(0);
                if (!isOp(next(), ")"))
                    throw invalid("missing ')'");
                return { type: "Error", arg };
            }
            if (t.text === ".")
                return { type: "dot" };
            if (/^\.[0-9]/.test(t.text))
                throw invalid(`unexpected '${t.text}'`);
            return { type: "var", name: t.text };
        }
        if (t.kind === "num")
            return { type: "num", value: Number(t.text), text: t.text };
        if (t.kind === "op" && t.text === "(") {
            const arg = expr(0);
            if (!isOp(next(), ")"))
                throw invalid("missing ')'");
            return { type: "paren", arg };
        }
        if (t.kind === "op" && (t.text === "-" || t.text === "+")) {
            return { type: "unary", op: t.text, arg: expr(UNARY) };
        }
        throw invalid(t.kind === "end" ? "unexpected end of input" : `unexpected '${t.kind === "op" ? t.text : ""}'`);
    }
    function expr(minBp) {
        let left = primary();
        for (;;) {
            const t = peek();
            if (t.kind !== "op")
                break;
            const bp = BINARY[t.text];
            if (bp === undefined || bp <= minBp)
                break;
            next();
            // ^ is right associative: its right operand may contain another ^
            const right = expr(t.text === "^" ? bp - 1 : bp);
            left = { type: "binary", op: t.text, left, right };
        }
        return left;
    }
    let response;
    if (!isOp(peek(), "~")) {
        const t = next();
        if (t.kind !== "name" || t.text === "." || !isOp(peek(), "~"))
            throw invalid("the response must be a variable name followed by '~'");
        response = t.text;
    }
    next(); // ~
    const rhs = expr(0);
    if (peek().kind !== "end")
        throw invalid("unexpected input after the formula");
    return { response, rhs };
}
/** The `Error()` terms of a right-hand side (top-level summands) and the right-hand side without them. */
export function splitErrorTerms(rhs) {
    const errors = [];
    const strip = (n) => {
        if (n.type === "Error") {
            errors.push(n.arg);
            return undefined;
        }
        if (n.type === "binary" && n.op === "+") {
            const l = strip(n.left);
            const r = strip(n.right);
            if (l === undefined)
                return r;
            if (r === undefined)
                return l;
            return { ...n, left: l, right: r };
        }
        if (n.type === "binary" && n.op === "-") {
            // y ~ W + Error(id) - 1: the Error() term is a summand of the left operand
            const l = strip(n.left);
            if (l === undefined)
                return { type: "unary", op: "-", arg: n.right };
            return { ...n, left: l };
        }
        return n;
    };
    const treatment = strip(rhs);
    const check = (n) => {
        if (n.type === "Error")
            throw invalid("Error() must be a term of the right-hand side");
        if (n.type === "binary") {
            check(n.left);
            check(n.right);
        }
        else if (n.type === "unary" || n.type === "paren")
            check(n.arg);
    };
    if (treatment !== undefined)
        check(treatment);
    errors.forEach(check);
    return { treatment, errors };
}
/** The variable names of a node, in order of first appearance (`.` expands to `dot`) */
function collectVariables(n, dot, out) {
    if (n === undefined)
        return;
    switch (n.type) {
        case "var":
            if (!out.includes(n.name))
                out.push(n.name);
            return;
        case "dot":
            for (const v of dot)
                if (!out.includes(v))
                    out.push(v);
            return;
        case "num":
            return;
        case "binary":
            collectVariables(n.left, dot, out);
            // the exponent of ^ is a number, not a variable
            if (n.op !== "^")
                collectVariables(n.right, dot, out);
            return;
        case "unary":
        case "paren":
        case "Error":
            collectVariables(n.arg, dot, out);
    }
}
const keyOf = (t) => t.join(",");
function dedupe(terms) {
    const seen = new Set();
    return terms.filter((t) => {
        const k = keyOf(t);
        if (seen.has(k))
            return false;
        seen.add(k);
        return true;
    });
}
const union = (a, b) => [...new Set([...a, ...b])].sort((x, y) => x - y);
/**
 * Expands a right-hand side into terms (variable indices, increasing) and the intercept flag.
 *
 * @param index Variable index of a name.
 * @param dot The variables `.` stands for.
 */
export function expandRhs(rhs, index, dot) {
    let intercept = true;
    const L = (n, negated) => {
        switch (n.type) {
            case "var":
                return [[index(n.name)]];
            case "dot":
                return dot.map((v) => [index(v)]);
            case "num":
                if (n.value === 1)
                    intercept = !negated;
                else if (n.value === 0)
                    intercept = negated;
                else
                    throw invalid(`a number (${n.text}) is not a term`);
                return [];
            case "paren":
                return L(n.arg, negated);
            case "Error":
                throw invalid("Error() must be a term of the right-hand side");
            case "unary":
                if (n.op === "+")
                    return L(n.arg, negated);
                L(n.arg, !negated);
                return [];
            case "binary": {
                if (n.op === "^") {
                    const a = L(n.left, negated);
                    let e = n.right;
                    while (e.type === "paren")
                        e = e.arg;
                    const p = e.type === "num" ? e.value : NaN;
                    if (!Number.isInteger(p) || p < 2)
                        throw new Error("invalid power in formula");
                    let cur = a;
                    for (let k = 1; k < p; k++) {
                        const nxt = [];
                        for (const s of a)
                            for (const t of cur)
                                nxt.push(union(s, t));
                        cur = dedupe(nxt);
                    }
                    return cur;
                }
                if (n.op === "-") {
                    const a = L(n.left, negated);
                    const drop = new Set(L(n.right, !negated).map(keyOf));
                    return a.filter((t) => !drop.has(keyOf(t)));
                }
                const a = L(n.left, negated);
                const b = L(n.right, negated);
                const cross = () => {
                    const out = [];
                    for (const s of a)
                        for (const t of b)
                            out.push(union(s, t));
                    return out;
                };
                const allOf = (ts) => ts.reduce((acc, t) => union(acc, t), []);
                switch (n.op) {
                    case "+":
                        return dedupe([...a, ...b]);
                    case ":":
                        return dedupe(cross());
                    case "*":
                        return dedupe([...a, ...b, ...cross()]);
                    case "/": {
                        const va = allOf(a);
                        return dedupe([...a, ...b.map((t) => union(t, va))]);
                    }
                    case "%in%": {
                        const vb = allOf(b);
                        return dedupe(a.map((t) => union(t, vb)));
                    }
                }
            }
        }
        throw invalid("unsupported expression");
    };
    const terms = rhs === undefined ? [] : L(rhs, false);
    return { terms, intercept };
}
/**
 * The terms of a formula: expansion, sorting by degree, labels, and R's factor codes.
 *
 * @param columns The columns of the data (for `.`).
 * @param rhs The right-hand side to expand (default: the parsed formula's).
 */
export function termsOf(parsed, columns, rhs = parsed.rhs) {
    const { response } = parsed;
    const dot = columns.filter((c) => c !== response);
    const variables = response === undefined ? [] : [response];
    collectVariables(parsed.rhs, dot, variables);
    const index = (name) => variables.indexOf(name);
    const expanded = expandRhs(rhs, index, dot);
    // stable sort by degree
    const terms = expanded.terms.map((t, i) => [t, i]).sort((a, b) => a[0].length - b[0].length || a[1] - b[1]).map(([t]) => t);
    const warnings = [];
    const responseTerm = response === undefined ? -1 : terms.findIndex((t) => t.length === 1 && t[0] === 0);
    if (responseTerm >= 0) {
        warnings.push("the response appeared on the right-hand side and was dropped");
        warnings.push(`problem with term ${responseTerm + 1} in model.matrix: no columns are assigned`);
    }
    const factors = variables.map(() => terms.map(() => 0));
    terms.forEach((t, j) => {
        for (const v of t) {
            const rest = t.filter((u) => u !== v);
            const byContrasts = rest.length === 0 || terms.slice(0, j).some((s) => rest.every((u) => s.includes(u)));
            factors[v][j] = byContrasts ? 1 : 2;
        }
    });
    return {
        variables,
        response: response === undefined ? -1 : 0,
        terms,
        termLabels: terms.map((t) => t.map((v) => variables[v]).join(":")),
        order: terms.map((t) => t.length),
        intercept: expanded.intercept,
        factors,
        responseTerm,
        warnings,
    };
}
