export type NlsExpr = {
    type: "number";
    value: number;
} | {
    type: "variable";
    name: string;
} | {
    type: "unary";
    op: "+" | "-";
    value: NlsExpr;
} | {
    type: "binary";
    op: "+" | "-" | "*" | "/" | "^";
    left: NlsExpr;
    right: NlsExpr;
} | {
    type: "call";
    name: string;
    args: NlsExpr[];
};
export interface ParsedNlsFormula {
    response: string;
    responseExpression: NlsExpr;
    expression: NlsExpr;
}
/** Parse a response ~ expression formula without invoking JavaScript or the linear formula parser. */
export declare function parseNlsFormula(formula: string): ParsedNlsFormula;
export declare function differentiateNls(expr: NlsExpr, parameter: string): NlsExpr;
/** Evaluate an expression for one row and one parameter vector. */
export declare function evaluateNlsExpression(expr: NlsExpr, data: Readonly<Record<string, number>>, parameters: Readonly<Record<string, number>>): number;
/** Evaluate the mean and its symbolic parameter gradient for one observation. */
export declare function evaluateNlsWithGradient(expr: NlsExpr, data: Readonly<Record<string, number>>, parameters: Readonly<Record<string, number>>, parameterNames: readonly string[]): {
    value: number;
    gradient: number[];
};
/** The supported built-in self-starting model names. */
export declare const nlsSelfStartNames: readonly string[];
