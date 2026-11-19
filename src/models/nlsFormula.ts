// Nonlinear model formula parser, expression evaluator, and symbolic derivatives.
// Independently derived from elementary calculus and the model equations in oracle/nls-behaviour.md.

export type NlsExpr =
  | { type: "number"; value: number }
  | { type: "variable"; name: string }
  | { type: "unary"; op: "+" | "-"; value: NlsExpr }
  | { type: "binary"; op: "+" | "-" | "*" | "/" | "^"; left: NlsExpr; right: NlsExpr }
  | { type: "call"; name: string; args: NlsExpr[] };

export interface ParsedNlsFormula {
  response: string;
  expression: NlsExpr;
}

type Token = { kind: "number" | "name" | "operator" | "end"; text: string };

const FUNCTIONS: Record<string, number> = {
  exp: 1, log: 1, log10: 1, sqrt: 1, abs: 1, sin: 1, cos: 1, tan: 1,
  sinh: 1, cosh: 1, tanh: 1, log1p: 1, atan: 1, asin: 1, acos: 1,
};
const SELF_START: Record<string, { args: number; expression: string }> = {
  SSmicmen: { args: 3, expression: "p1*p0/(p2+p0)" },
  SSlogis: { args: 4, expression: "p1/(1+exp((p2-p0)/p3))" },
  SSasymp: { args: 4, expression: "p1+(p2-p1)*exp(-exp(p3)*p0)" },
  SSasympOff: { args: 4, expression: "p1*(1-exp(-exp(p2)*(p0-p3)))" },
  SSasympOrig: { args: 3, expression: "p1*(1-exp(-exp(p2)*p0))" },
  SSbiexp: { args: 5, expression: "p1*exp(-exp(p2)*p0)+p3*exp(-exp(p4)*p0)" },
  SSfol: { args: 5, expression: "p0*exp(p2)*exp(p3)/(exp(p4)*(exp(p3)-exp(p2)))*(exp(-exp(p2)*p1)-exp(-exp(p3)*p1))" },
  SSfpl: { args: 5, expression: "p1+(p2-p1)/(1+exp((p3-p0)/p4))" },
  SSgompertz: { args: 4, expression: "p1*exp(-p2*p3^p0)" },
  SSweibull: { args: 5, expression: "p1-p2*exp(-exp(p3)*p0^p4)" },
};

function tokenize(source: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i]!;
    if (/\s/.test(c)) { i++; continue; }
    const number = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(source.slice(i));
    if (number) { out.push({ kind: "number", text: number[0] }); i += number[0].length; continue; }
    const name = /^[A-Za-z.][A-Za-z0-9._]*/.exec(source.slice(i));
    if (name) { out.push({ kind: "name", text: name[0] }); i += name[0].length; continue; }
    if ("+-*/^(),".includes(c)) { out.push({ kind: "operator", text: c }); i++; continue; }
    throw new SyntaxError("invalid nonlinear expression: unexpected character " + c);
  }
  out.push({ kind: "end", text: "" });
  return out;
}

class ExpressionParser {
  private readonly tokens: Token[];
  private position = 0;
  constructor(source: string) { this.tokens = tokenize(source); }
  private peek(): Token { return this.tokens[this.position]!; }
  private take(): Token { return this.tokens[this.position++]!; }
  private accept(text: string): boolean {
    if (this.peek().text !== text) return false;
    this.take(); return true;
  }
  parse(): NlsExpr {
    const value = this.expression(0);
    if (this.peek().kind !== "end") throw new SyntaxError("invalid nonlinear expression: trailing input");
    return value;
  }
  private primary(): NlsExpr {
    const token = this.take();
    if (token.kind === "number") {
      const value = Number(token.text);
      if (!Number.isFinite(value)) throw new SyntaxError("non-finite numeric literal");
      return { type: "number", value };
    }
    if (token.kind === "name") {
      if (!this.accept("(")) return { type: "variable", name: token.text };
      const args: NlsExpr[] = [];
      if (!this.accept(")")) {
        do { args.push(this.expression(0)); } while (this.accept(","));
        if (!this.accept(")")) throw new SyntaxError("invalid nonlinear expression: missing ')'");
      }
      const expected = FUNCTIONS[token.text] ?? SELF_START[token.text]?.args;
      if (expected === undefined) throw new SyntaxError("unsupported nonlinear function: " + token.text);
      if (args.length !== expected) throw new SyntaxError(token.text + " expects " + expected + " arguments");
      return { type: "call", name: token.text, args };
    }
    if (token.text === "(") {
      const value = this.expression(0);
      if (!this.accept(")")) throw new SyntaxError("invalid nonlinear expression: missing ')'");
      return value;
    }
    if (token.text === "+" || token.text === "-") {
      return { type: "unary", op: token.text, value: this.expression(4) };
    }
    throw new SyntaxError("invalid nonlinear expression: expected a value");
  }
  private expression(minBinding: number): NlsExpr {
    let left = this.primary();
    for (;;) {
      const op = this.peek().text;
      const binding = op === "+" || op === "-" ? 1 : op === "*" || op === "/" ? 2 : op === "^" ? 5 : -1;
      if (binding <= minBinding) break;
      this.take();
      const right = this.expression(op === "^" ? binding - 1 : binding);
      left = { type: "binary", op: op as "+" | "-" | "*" | "/" | "^", left, right };
    }
    return left;
  }
}

/** Parse a response ~ expression formula without invoking JavaScript or the linear formula parser. */
export function parseNlsFormula(formula: string): ParsedNlsFormula {
  if (typeof formula !== "string") throw new TypeError("formula must be a string");
  let depth = 0, split = -1;
  for (let i = 0; i < formula.length; i++) {
    const c = formula[i]!;
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "~" && depth === 0) {
      if (split !== -1) throw new SyntaxError("formula must contain exactly one '~'");
      split = i;
    }
    if (depth < 0) throw new SyntaxError("unbalanced parentheses in formula");
  }
  if (depth !== 0) throw new SyntaxError("unbalanced parentheses in formula");
  if (split < 0) throw new SyntaxError("formula must be response ~ expression");
  const response = formula.slice(0, split).trim();
  if (!/^[A-Za-z.][A-Za-z0-9._]*$/.test(response)) throw new SyntaxError("response must be a column name");
  const rhs = formula.slice(split + 1).trim();
  if (!rhs) throw new SyntaxError("formula has an empty right-hand side");
  return { response, expression: expandSelfStart(new ExpressionParser(rhs).parse()) };
}

function expandSelfStart(expr: NlsExpr): NlsExpr {
  if (expr.type === "call" && SELF_START[expr.name]) {
    const spec = SELF_START[expr.name]!;
    const replacements = new Map<string, NlsExpr>();
    expr.args.forEach((arg, i) => replacements.set("p" + i, expandSelfStart(arg)));
    return substitute(new ExpressionParser(spec.expression).parse(), replacements);
  }
  if (expr.type === "call") return { ...expr, args: expr.args.map(expandSelfStart) };
  if (expr.type === "unary") return { ...expr, value: expandSelfStart(expr.value) };
  if (expr.type === "binary") return { ...expr, left: expandSelfStart(expr.left), right: expandSelfStart(expr.right) };
  return expr;
}

function substitute(expr: NlsExpr, replacements: Map<string, NlsExpr>): NlsExpr {
  if (expr.type === "variable") return replacements.get(expr.name) ?? expr;
  if (expr.type === "call") return { ...expr, args: expr.args.map(x => substitute(x, replacements)) };
  if (expr.type === "unary") return { ...expr, value: substitute(expr.value, replacements) };
  if (expr.type === "binary") return { ...expr, left: substitute(expr.left, replacements), right: substitute(expr.right, replacements) };
  return expr;
}

const num = (value: number): NlsExpr => ({ type: "number", value });
const variable = (name: string): NlsExpr => ({ type: "variable", name });
const binary = (op: "+" | "-" | "*" | "/" | "^", left: NlsExpr, right: NlsExpr): NlsExpr => ({ type: "binary", op, left, right });
const call = (name: string, ...args: NlsExpr[]): NlsExpr => ({ type: "call", name, args });

/** Construct the symbolic derivative of an expression with respect to one parameter. */
export function isZeroDerivative(expr: NlsExpr): boolean {\n  if (expr.type === "number") return expr.value === 0;\n  if (expr.type === "unary") return isZeroDerivative(expr.value);\n  if (expr.type === "binary" && (expr.op === "+" || expr.op === "-")) return isZeroDerivative(expr.left) && isZeroDerivative(expr.right);\n  if (expr.type === "binary" && expr.op === "*") return isZeroDerivative(expr.left) || isZeroDerivative(expr.right);\n  if (expr.type === "binary" && expr.op === "/") return isZeroDerivative(expr.left);\n  return false;\n}\n\nfunction differentiateNls(expr: NlsExpr, parameter: string): NlsExpr {
  switch (expr.type) {
    case "number": return num(0);
    case "variable": return num(expr.name === parameter ? 1 : 0);
    case "unary": return { type: "unary", op: expr.op, value: differentiateNls(expr.value, parameter) };
    case "binary": {
      const u = expr.left, v = expr.right, du = differentiateNls(u, parameter), dv = differentiateNls(v, parameter);
      switch (expr.op) {
        case "+": return binary("+", du, dv);
        case "-": return binary("-", du, dv);
        case "*": return binary("+", binary("*", du, v), binary("*", u, dv));
        case "/": return binary("/", binary("-", binary("*", du, v), binary("*", u, dv)), binary("^", v, num(2)));
        case "^": return isZeroDerivative(dv)\n          ? binary("*", binary("*", v, binary("^", u, binary("-", v, num(1)))), du)\n          : binary("*", binary("^", u, v), binary("+", binary("*", dv, call("log", u)), binary("/", binary("*", v, du), u)));
      }
    }
    case "call": {
      const x = expr.args[0]!;
      const dx = differentiateNls(x, parameter);
      switch (expr.name) {
        case "exp": return binary("*", call("exp", x), dx);
        case "log": return binary("/", dx, x);
        case "log10": return binary("/", dx, binary("*", x, num(Math.LN10)));
        case "log1p": return binary("/", dx, binary("+", num(1), x));
        case "sqrt": return binary("/", dx, binary("*", num(2), call("sqrt", x)));
        case "abs": return binary("*", call("sign", x), dx);
        case "sin": return binary("*", call("cos", x), dx);
        case "cos": return binary("*", { type: "unary", op: "-", value: call("sin", x) }, dx);
        case "tan": return binary("/", dx, binary("^", call("cos", x), num(2)));
        case "sinh": return binary("*", call("cosh", x), dx);
        case "cosh": return binary("*", call("sinh", x), dx);
        case "tanh": return binary("/", dx, binary("^", call("cosh", x), num(2)));\n        case "atan": return binary("/", dx, binary("+", num(1), binary("^", x, num(2))));\n        case "asin": return binary("/", dx, call("sqrt", binary("-", num(1), binary("^", x, num(2)))));\n        case "acos": return { type: "unary", op: "-", value: binary("/", dx, call("sqrt", binary("-", num(1), binary("^", x, num(2))))) };
      }
    }
  }
  return num(Number.NaN);
}

/** Evaluate an expression for one row and one parameter vector. */
export function evaluateNlsExpression(
  expr: NlsExpr,
  data: Readonly<Record<string, number>>,
  parameters: Readonly<Record<string, number>>,
): number {
  switch (expr.type) {
    case "number": return expr.value;
    case "variable": {
      const value = Object.prototype.hasOwnProperty.call(parameters, expr.name) ? parameters[expr.name] : data[expr.name];
      if (value === undefined) throw new Error("unknown variable in nonlinear formula: " + expr.name);
      return value;
    }
    case "unary": {
      const value = evaluateNlsExpression(expr.value, data, parameters);
      return expr.op === "-" ? -value : value;
    }
    case "binary": {
      const a = evaluateNlsExpression(expr.left, data, parameters), b = evaluateNlsExpression(expr.right, data, parameters);
      switch (expr.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return a / b;
        case "^": return a ** b;
      }
    }
    case "call": {
      const x = evaluateNlsExpression(expr.args[0]!, data, parameters);
      switch (expr.name) {
        case "exp": return Math.exp(x);
        case "log": return Math.log(x);
        case "log10": return Math.log10(x);
        case "log1p": return Math.log1p(x);
        case "sqrt": return Math.sqrt(x);
        case "abs": return Math.abs(x);
        case "sign": return Math.sign(x);
        case "sin": return Math.sin(x);
        case "cos": return Math.cos(x);
        case "tan": return Math.tan(x);
        case "sinh": return Math.sinh(x);
        case "cosh": return Math.cosh(x);
        case "tanh": return Math.tanh(x);\n        case "atan": return Math.atan(x);\n        case "asin": return Math.asin(x);\n        case "acos": return Math.acos(x);
      }
    }
  }
  return Number.NaN;
}

/** Evaluate the mean and its symbolic parameter gradient for one observation. */
export function evaluateNlsWithGradient(
  expr: NlsExpr,
  data: Readonly<Record<string, number>>,
  parameters: Readonly<Record<string, number>>,
  parameterNames: readonly string[],
): { value: number; gradient: number[] } {
  const value = evaluateNlsExpression(expr, data, parameters);
  const gradient = parameterNames.map(name => evaluateNlsExpression(differentiateNls(expr, name), data, parameters));
  return { value, gradient };
}

/** The supported built-in self-starting model names. */
export const nlsSelfStartNames = Object.freeze(Object.keys(SELF_START));
