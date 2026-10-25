// Model matrices from formulas: R's model.matrix(formula, data) with the attributes of terms().
//
// Written for rStats.js (no ported code) from oracle/anova-behaviour.md ("Coding"). Each term contributes the
// products of one column of each of its variables, the first variable varying fastest: a numeric variable's values,
// or a factor's contrast columns (contr.treatment, contr.sum or contr.helmert) or indicator columns, as chosen by the
// codes of src/models/formula.ts. Without an intercept the first factor found is coded by indicators.

import { parseFormula, termsOf, type FormulaNode, type ParsedFormula, type Terms } from "./formula.js";
import { modelFrame, type DataFrame, type FrameVariable, type ModelFrame } from "./modelFrame.js";
import type { Sample } from "../htest/types.js";

/** A contrast of a factor: R's `contr.treatment`, `contr.sum` or `contr.helmert`. */
export type ContrastName = "contr.treatment" | "contr.sum" | "contr.helmert";

/** Options for {@link modelMatrix}. */
export interface ModelMatrixOptions {
  /** A contrast per factor (default `"contr.treatment"`). */
  contrasts?: Record<string, ContrastName>;
  /** The order of the levels of a factor (`{ A: ["c", "a", "b"] }`), as `factor(x, levels = ...)` in R. */
  levels?: Record<string, readonly string[]>;
}

/** Result of {@link modelMatrix}. */
export interface ModelMatrixResult {
  /** Column names, such as `"(Intercept)"`, `"Ab"`, `"Ab:Bq"`, `"x"`. */
  colNames: string[];
  /** The term of each column (0 for the intercept, 1 for the first term). */
  assign: number[];
  /** The model matrix (array of rows). */
  x: number[][];
  /** 0-based indices of the rows of the data used (rows with a missing value are dropped). */
  rows: number[];
  /** Labels of the terms (variables joined by `:`). */
  termLabels: string[];
  /** Degree of each term. */
  order: number[];
  /** Whether the model has an intercept. */
  intercept: boolean;
  /** The variables of the formula, the response first. */
  variables: string[];
  /** R's factors attribute: one array per variable, one code per term (0 not in it, 1 contrasts, 2 indicators). */
  factors: number[][];
  /** R's warnings. */
  warnings: string[];
}

/** A contrast matrix (one row per level) and its column names */
export function contrastMatrix(levels: readonly string[], contrast: ContrastName | "indicators"): { m: number[][]; names: string[] } {
  const k = levels.length;
  const m = levels.map(() => [] as number[]);
  let names: string[];
  switch (contrast) {
    case "indicators":
      levels.forEach((_, i) => levels.forEach((__, j) => m[i]!.push(i === j ? 1 : 0)));
      names = [...levels];
      break;
    case "contr.treatment":
      levels.forEach((_, i) => {
        for (let j = 1; j < k; j++) m[i]!.push(i === j ? 1 : 0);
      });
      names = levels.slice(1);
      break;
    case "contr.sum":
      levels.forEach((_, i) => {
        for (let j = 0; j < k - 1; j++) m[i]!.push(i === j ? 1 : i === k - 1 ? -1 : 0);
      });
      names = Array.from({ length: k - 1 }, (_, j) => String(j + 1));
      break;
    case "contr.helmert":
      levels.forEach((_, i) => {
        for (let j = 1; j < k; j++) m[i]!.push(i < j ? -1 : i === j ? j : 0);
      });
      names = Array.from({ length: k - 1 }, (_, j) => String(j + 1));
      break;
    default:
      throw new RangeError(`unknown contrast '${String(contrast)}'`);
  }
  return { m, names };
}

/** A model matrix with what the fits need. */
export interface Design {
  terms: Terms;
  frame: ModelFrame;
  /** The model matrix (array of rows) */
  x: number[][];
  colNames: string[];
  assign: number[];
  /** The response's values (rows kept), if the formula has one */
  y?: number[];
  warnings: string[];
}

/** Options of {@link design} */
export interface DesignOptions extends ModelMatrixOptions {
  weights?: Sample | string;
  dropUnusedLevels?: boolean;
  /** Contrast used for every factor instead of `contrasts` (the error model of aov) */
  allContrasts?: ContrastName;
}

/**
 * The model matrix of a parsed formula on the data.
 *
 * @param rhs The right-hand side to use (default: the formula's; aov passes it without the Error() term).
 */
export function design(parsed: ParsedFormula, data: DataFrame, options: DesignOptions = {}, rhs: FormulaNode | undefined = parsed.rhs): Design {
  if (typeof data !== "object" || data === null) throw new TypeError("data must be an object of columns");
  const terms = termsOf(parsed, Object.keys(data), rhs);
  const frameOptions: Parameters<typeof modelFrame>[2] = {};
  if (options.levels !== undefined) frameOptions.levels = options.levels;
  if (options.weights !== undefined) frameOptions.weights = options.weights;
  if (options.dropUnusedLevels !== undefined) frameOptions.dropUnusedLevels = options.dropUnusedLevels;
  const frame = modelFrame(data, terms.variables, frameOptions);
  const vars = frame.variables;
  const nr = frame.rows.length;
  // the terms that get columns, and the code of each variable in them
  const used = terms.terms.map((_, j) => j !== terms.responseTerm);
  const codes = terms.terms.map((t, j) => t.map((v) => terms.factors[v]![j]!));
  for (let j = 0; j < terms.terms.length; j++) {
    if (!used[j]) continue;
    for (const v of terms.terms[j]!) {
      const fv = vars[v]!;
      if (fv.kind === "factor" && fv.levels.length < 2) throw new RangeError("contrasts can be applied only to factors with 2 or more levels");
    }
  }
  if (!terms.intercept) {
    search: for (let j = 0; j < terms.terms.length; j++) {
      if (!used[j]) continue;
      const t = terms.terms[j]!;
      for (let k = 0; k < t.length; k++) {
        if (vars[t[k]!]!.kind === "factor") {
          codes[j]![k] = 2;
          break search;
        }
      }
    }
  }
  const columns: number[][] = [];
  const colNames: string[] = [];
  const assign: number[] = [];
  if (terms.intercept) {
    columns.push(new Array<number>(nr).fill(1));
    colNames.push("(Intercept)");
    assign.push(0);
  }
  const partsOf = (v: number, code: number): { name: string; values: number[] }[] => {
    const fv: FrameVariable = vars[v]!;
    const name = terms.variables[v]!;
    if (fv.kind === "numeric") return [{ name, values: fv.values }];
    const contrast = code === 2 ? "indicators" : (options.allContrasts ?? options.contrasts?.[name] ?? "contr.treatment");
    const { m, names } = contrastMatrix(fv.levels, contrast);
    return names.map((cn, j) => ({ name: name + cn, values: fv.codes.map((c) => m[c]![j]!) }));
  };
  terms.terms.forEach((t, j) => {
    if (!used[j]) return;
    let cur = partsOf(t[0]!, codes[j]![0]!);
    for (let k = 1; k < t.length; k++) {
      const next: typeof cur = [];
      for (const p of partsOf(t[k]!, codes[j]![k]!)) {
        for (const c of cur) next.push({ name: `${c.name}:${p.name}`, values: c.values.map((v, i) => v * p.values[i]!) });
      }
      cur = next;
    }
    for (const c of cur) {
      columns.push(c.values);
      colNames.push(c.name);
      assign.push(j + 1);
    }
  });
  const x = Array.from({ length: nr }, (_, i) => columns.map((c) => c[i]!));
  const out: Design = { terms, frame, x, colNames, assign, warnings: [...terms.warnings] };
  if (terms.response >= 0) {
    const r = vars[terms.response]!;
    if (r.kind !== "numeric") throw new TypeError("the response must be numeric");
    out.y = r.values;
  }
  return out;
}

/**
 * The model matrix of a formula on a data frame, with the attributes of R's `terms()`. Equivalent to R's
 * `model.matrix(formula, data)` (with `contrasts.arg`), together with `attr(terms(formula), ...)`.
 *
 * Strings are factors (levels sorted by code point unless `levels` gives them), booleans factors with levels FALSE
 * and TRUE, numbers numeric. Rows with a missing value (`null`, or `NaN` in a numeric column) in any variable of the
 * formula are dropped; levels without rows are kept (their columns are 0).
 *
 * @param formula A formula such as `"y ~ A * B"`, `"y ~ x + A - 1"` or `"~ A"`.
 * @param data The data frame: an object of columns.
 *
 * @example
 * ```ts
 * const m = modelMatrix("y ~ A", { y: [1, 2, 3, 4], A: ["a", "b", "a", "b"] });
 * m.colNames; // ["(Intercept)", "Ab"]
 * m.x;        // [[1, 0], [1, 1], [1, 0], [1, 1]]
 * ```
 */
export function modelMatrix(formula: string, data: DataFrame, options: ModelMatrixOptions = {}): ModelMatrixResult {
  const d = design(parseFormula(formula), data, options);
  return {
    colNames: d.colNames,
    assign: d.assign,
    x: d.x,
    rows: d.frame.rows,
    termLabels: d.terms.termLabels,
    order: d.terms.order,
    intercept: d.terms.intercept,
    variables: d.terms.variables,
    // R's factors attribute is empty for a model without terms
    factors: d.terms.terms.length > 0 ? d.terms.factors : [],
    warnings: d.warnings,
  };
}
