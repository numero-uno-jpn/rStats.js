/** A node of a parsed formula. */
export type FormulaNode = {
    type: "var";
    name: string;
} | {
    type: "dot";
} | {
    type: "num";
    value: number;
    text: string;
} | {
    type: "binary";
    op: "+" | "-" | "*" | "/" | ":" | "%in%" | "^";
    left: FormulaNode;
    right: FormulaNode;
} | {
    type: "unary";
    op: "+" | "-";
    arg: FormulaNode;
} | {
    type: "paren";
    arg: FormulaNode;
} | {
    type: "Error";
    arg: FormulaNode;
}
/** A random-effects term `lhs | group` (`double`: `lhs || group`) */
 | {
    type: "bar";
    double: boolean;
    lhs: FormulaNode;
    group: FormulaNode;
};
/** A parsed formula before expansion. */
export interface ParsedFormula {
    /** The response's name (undefined for `~ rhs`). */
    response: string | undefined;
    /** The right-hand side. */
    rhs: FormulaNode;
}
/**
 * Parses a formula string. Throws a SyntaxError whose message starts with "invalid formula" if it cannot be parsed
 * or uses something that is not supported (function calls other than Error(), backquoted names, ...).
 *
 * @param allowError Accept `Error(...)` terms (aov only).
 * @param allowBars Accept the random-effects terms `(lhs | group)` and `(lhs || group)` (mixed models only).
 */
export declare function parseFormula(formula: string, allowError?: boolean, allowBars?: boolean): ParsedFormula;
/** The `Error()` terms of a right-hand side (top-level summands) and the right-hand side without them. */
export declare function splitErrorTerms(rhs: FormulaNode): {
    treatment: FormulaNode | undefined;
    errors: FormulaNode[];
};
/** The random-effects terms of a right-hand side (summands, possibly in parentheses) and the right-hand side without them. */
export declare function splitBarTerms(rhs: FormulaNode): {
    fixed: FormulaNode | undefined;
    bars: Extract<FormulaNode, {
        type: "bar";
    }>[];
};
/**
 * A formula node as R deparses it: `+`, `-`, `*` and `%in%` with a space on each side, `:`, `/` and `^` without,
 * unary minus and plus without a space, parentheses as written.
 */
export declare function deparseFormula(n: FormulaNode): string;
/** Terms of a model: the variables of each term as indices into `variables`, in increasing order. */
export interface Terms {
    /** The variable names: the response first (if any), then in order of first appearance in the formula. */
    variables: string[];
    /** Index of the response in `variables` (0), or -1 without response. */
    response: number;
    /** The terms, sorted by degree (stably); each lists its variables' indices in increasing order. */
    terms: number[][];
    /** Labels of the terms (variable names joined by ':'). */
    termLabels: string[];
    /** Degree of each term. */
    order: number[];
    /** Whether the model has an intercept. */
    intercept: boolean;
    /** R's "factors" attribute: for each variable, one code per term (0 not in the term, 1 contrasts, 2 indicators). */
    factors: number[][];
    /** Index of the term that consists of the response alone (it gets no columns), or -1. */
    responseTerm: number;
    /** Warnings of the expansion. */
    warnings: string[];
}
/**
 * The variable names of a right-hand side, in order of first appearance (`.` stands for `dot`), whatever its
 * operators: R's variables of the model frame (aggregate's grouping variables).
 */
export declare function formulaVariables(rhs: FormulaNode, dot: readonly string[]): string[];
/**
 * Expands a right-hand side into terms (variable indices, increasing) and the intercept flag.
 *
 * @param index Variable index of a name.
 * @param dot The variables `.` stands for.
 */
export declare function expandRhs(rhs: FormulaNode | undefined, index: (name: string) => number, dot: readonly string[]): {
    terms: number[][];
    intercept: boolean;
};
/**
 * The terms of a formula: expansion, sorting by degree, labels, and R's factor codes.
 *
 * @param columns The columns of the data (for `.`).
 * @param rhs The right-hand side to expand (default: the parsed formula's).
 */
export declare function termsOf(parsed: ParsedFormula, columns: readonly string[], rhs?: FormulaNode | undefined): Terms;
