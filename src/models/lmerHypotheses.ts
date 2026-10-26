// The hypothesis matrices of the Type I, II and III ANOVA tables of an lmer fit (lmerTest's anova): one matrix per
// term of the fixed-effects formula, its rows contrasts of the fixed effects. They depend only on the design (the
// model matrix X, the terms and the model frame), never on the fit.
//
// Written for rStats.js (no ported code) from oracle/lmertest-behaviour.md (section 2). Type I: the transposed unit
// lower triangular factor of the Doolittle factorisation of X'X, its rows grouped by term (sequential sums of
// squares). Type II: for a term contained in no other (containment: the variables of the other include its own and
// more, the numeric variables being the same), the identity's rows for its columns; otherwise the Doolittle factor of
// X'X with the columns reordered so that the term and the terms containing it come last. Type III: the full-dummy
// matrix rdX (all levels of every factor), mapped to the coefficients of X with treatment contrasts by ginv, rounded
// (R's zapsmall), with the columns of each contained term made orthogonal to those of the terms containing it, then
// mapped back to the coding of X when it does not use treatment contrasts.
//
// The construction is a function of an explicit description of the fixed-effects design
// ({@link FixedEffectsDescription}); {@link fixedEffectsDescription} builds it from lmer's inputs (formula, data,
// contrasts and levels) as lmer does (src/models/mixedStructure.ts), aliased columns of X dropped.

import { zapsmall } from "../internal/fround.js";
import { ginv } from "../linalg/kappa.js";
import { qr, qrResid } from "../linalg/qr.js";
import { parseFormula, splitBarTerms, termsOf, type FormulaNode } from "./formula.js";
import type { DataFrame, FrameVariable } from "./modelFrame.js";
import { design, type DesignContrast } from "./modelMatrix.js";

/** A term of the fixed-effects formula. */
export interface FixedEffectsTerm {
  /** The term's label, such as `"A"`, `"x:f"`. */
  label: string;
  /** Its variables, in the order of the label. */
  variables: string[];
}

/**
 * The fixed-effects design of a mixed model, everything the hypothesis matrices depend on.
 */
export interface FixedEffectsDescription {
  /** The model matrix X (array of rows, the rows used), aliased columns dropped. */
  x: number[][];
  /** Names of the columns of X, such as `"(Intercept)"`, `"Aa2"`, `"x:flo"`. */
  colNames: string[];
  /** The term of each column of X: 0 for the intercept, k + 1 for `terms[k]`. */
  assign: number[];
  /** Whether the model has an intercept. */
  intercept: boolean;
  /** The terms of the fixed-effects formula, in the order of the formula's terms (sorted by order). */
  terms: FixedEffectsTerm[];
  /**
   * The variables of the terms, in the order of the formula (that of their first appearance), each with its
   * column of the model frame (rows used): numeric values, or a factor's levels and codes.
   */
  variables: { name: string; frame: FrameVariable }[];
  /** The contrast of each factor among `variables` (`"contr.treatment"` unless another was given). */
  contrasts: Record<string, DesignContrast>;
}

/** Options of {@link fixedEffectsDescription}: those of lmer that shape X. */
export interface FixedEffectsDescriptionOptions {
  /** A contrast per factor of the fixed-effects part (default `"contr.treatment"`). */
  contrasts?: Record<string, DesignContrast>;
  /** The order of the levels of a factor. */
  levels?: Record<string, readonly string[]>;
}

/** The hypothesis matrix of one term. */
export interface TermHypothesis {
  /** The term's label. */
  term: string;
  /** The names of the rows (columns of X for Types I and II, of X with treatment contrasts for Type III). */
  rows: string[];
  /** The names of the columns: the columns of X. */
  columns: string[];
  /** The matrix (array of rows). */
  values: number[][];
}

/** The type of an ANOVA table. */
export type HypothesisType = "I" | "II" | "III";

/** Result of {@link lmerHypotheses}. */
export interface LmerHypotheses {
  /** One hypothesis per term with columns in X, in the order of the terms (a term with no rows included). */
  hypotheses: TermHypothesis[];
  /** R's messages (Type III: "Missing cells for: ..."). */
  messages: string[];
}

const ONE: FormulaNode = { type: "num", value: 1, text: "1" };

/**
 * The fixed-effects design of an lmer fit, from lmer's inputs: the formula's fixed part coded on the model frame of
 * the whole formula (rows with a missing value in any of its variables dropped, unused levels dropped), the
 * contrasts given, and the aliased columns of X (pivoted QR, tolerance 1e-7) dropped, as lmer's `fixefNames`.
 */
export function fixedEffectsDescription(formula: string, data: DataFrame, options: FixedEffectsDescriptionOptions = {}): FixedEffectsDescription {
  const parsed = parseFormula(formula, false, true);
  if (parsed.response === undefined) throw new TypeError("the formula has no response");
  if (typeof data !== "object" || data === null) throw new TypeError("data must be an object of columns");
  const { fixed } = splitBarTerms(parsed.rhs);
  const fixedRhs = fixed ?? ONE;
  const contrastOptions =
    options.contrasts === undefined
      ? {}
      : { contrasts: options.contrasts, contrastVariables: termsOf({ response: parsed.response, rhs: fixedRhs }, Object.keys(data)).variables };
  const d = design(parsed, data, { ...(options.levels === undefined ? {} : { levels: options.levels }), dropUnusedLevels: true, ...contrastOptions }, fixedRhs);
  const { terms, frame } = d;

  let keep = d.colNames.map((_, j) => j);
  if (keep.length > 0) {
    const decomposition = qr(d.x);
    const aliased = new Set(decomposition.pivot.slice(decomposition.rank));
    keep = keep.filter((j) => !aliased.has(j));
  }
  const used = new Set(terms.terms.flat());
  const variables = terms.variables.map((name, v) => ({ name, v })).filter(({ v }) => used.has(v));
  const contrasts: Record<string, DesignContrast> = {};
  for (const { name, v } of variables) {
    if (frame.variables[v]!.kind === "factor") contrasts[name] = options.contrasts?.[name] ?? "contr.treatment";
  }
  return {
    x: d.x.map((row) => keep.map((j) => row[j]!)),
    colNames: keep.map((j) => d.colNames[j]!),
    assign: keep.map((j) => d.assign[j]!),
    intercept: terms.intercept,
    terms: terms.terms.map((t, k) => ({ label: terms.termLabels[k]!, variables: t.map((v) => terms.variables[v]!) })),
    variables: variables.map(({ name, v }) => ({ name, frame: frame.variables[v]! })),
    contrasts,
  };
}

// ---- small matrix helpers ----

const transpose = (m: readonly (readonly number[])[], ncol = m[0]?.length ?? 0): number[][] =>
  Array.from({ length: ncol }, (_, j) => m.map((row) => row[j]!));

function multiply(a: readonly (readonly number[])[], b: readonly (readonly number[])[], ncol = b[0]?.length ?? 0): number[][] {
  return a.map((row) => {
    const out = new Array<number>(ncol).fill(0);
    row.forEach((v, k) => {
      const bk = b[k]!;
      for (let j = 0; j < ncol; j++) out[j]! += v * bk[j]!;
    });
    return out;
  });
}

/** X'X */
function crossprod(x: readonly (readonly number[])[], p: number): number[][] {
  const s = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      let sum = 0;
      for (const row of x) sum += row[i]! * row[j]!;
      s[i]![j] = sum;
      s[j]![i] = sum;
    }
  }
  return s;
}

const columnsOf = (m: readonly (readonly number[])[], cols: readonly number[]): number[][] => m.map((row) => cols.map((j) => row[j]!));

const DOOLITTLE_ZERO = 1e-6;

/**
 * The Doolittle factorisation S = L U of a symmetric matrix without pivoting: L unit lower triangular, U upper
 * triangular; a column of L below a pivot |U_ii| < 1e-6 is 0, and entries below 1e-6 in absolute value are set to 0
 * at the end.
 */
export function doolittle(s: readonly (readonly number[])[]): { L: number[][]; U: number[][] } {
  const k = s.length;
  const L = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (__, j): number => (i === j ? 1 : 0)));
  const U = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      let v = s[i]![j]!;
      for (let t = 0; t < i; t++) v -= L[i]![t]! * U[t]![j]!;
      U[i]![j] = v;
    }
    const pivot = U[i]![i]!;
    for (let j = i + 1; j < k; j++) {
      if (Math.abs(pivot) < DOOLITTLE_ZERO) {
        L[j]![i] = 0;
        continue;
      }
      let v = s[j]![i]!;
      for (let t = 0; t < i; t++) v -= L[j]![t]! * U[t]![i]!;
      L[j]![i] = v / pivot;
    }
  }
  for (const m of [L, U]) {
    for (const row of m) {
      row.forEach((v, j) => {
        if (Math.abs(v) < DOOLITTLE_ZERO) row[j] = 0;
      });
    }
  }
  return { L, U };
}

/**
 * For each term, the indices of the terms that contain it: those whose variables include all of its own and at
 * least one more, with the same numeric variables (in the order of the terms).
 */
export function containingTerms(desc: FixedEffectsDescription): number[][] {
  const numeric = new Set(desc.variables.filter((v) => v.frame.kind === "numeric").map((v) => v.name));
  const numericOf = (t: FixedEffectsTerm): string => t.variables.filter((v) => numeric.has(v)).sort().join("\u0000");
  return desc.terms.map((a) =>
    desc.terms
      .map((b, k) => ({ b, k }))
      .filter(({ b }) => a.variables.every((v) => b.variables.includes(v)) && b.variables.length > a.variables.length && numericOf(a) === numericOf(b))
      .map(({ k }) => k),
  );
}

/** The columns (0-based) of a term (index into terms) given the assign of the columns */
const termColumns = (assign: readonly number[], term: number): number[] => assign.flatMap((a, j) => (a === term + 1 ? [j] : []));

/** Rows `rows` of a matrix with the names of those rows */
function hypothesis(term: string, m: readonly (readonly number[])[], rows: readonly number[], rowNames: readonly string[], columns: readonly string[]): TermHypothesis {
  return { term, rows: rows.map((i) => rowNames[i]!), columns: [...columns], values: rows.map((i) => [...m[i]!]) };
}

/** Type I: the rows of the transposed Doolittle factor of X'X, by term */
function typeI(desc: FixedEffectsDescription): TermHypothesis[] {
  const p = desc.colNames.length;
  if (p === 0 || (p === 1 && desc.intercept)) return [];
  const Lt = p === 1 ? [[1]] : transpose(doolittle(crossprod(desc.x, p)).L, p);
  return desc.terms.map((t, k) => hypothesis(t.label, Lt, termColumns(desc.assign, k), desc.colNames, desc.colNames));
}

/** Type II: marginal for the terms contained in no other, otherwise the Doolittle factor with the term last */
function typeII(desc: FixedEffectsDescription): TermHypothesis[] {
  const p = desc.colNames.length;
  const containing = containingTerms(desc);
  return desc.terms.map((t, k) => {
    const cols = termColumns(desc.assign, k);
    if (containing[k]!.length === 0) {
      const identity = cols.map((i) => Array.from({ length: p }, (_, j) => (i === j ? 1 : 0)));
      return { term: t.label, rows: cols.map((i) => desc.colNames[i]!), columns: [...desc.colNames], values: identity };
    }
    const related = [k, ...containing[k]!].flatMap((term) => termColumns(desc.assign, term));
    const relatedSet = new Set(related);
    const order = [...desc.colNames.map((_, j) => j).filter((j) => !relatedSet.has(j)), ...related];
    const Lt = transpose(doolittle(crossprod(columnsOf(desc.x, order), p)).L, p);
    const mine = new Set(cols);
    const positions = order.flatMap((j, pos) => (mine.has(j) ? [pos] : []));
    const values = positions.map((pos) => {
      const row = new Array<number>(p).fill(0);
      order.forEach((j, q) => (row[j] = Lt[pos]![q]!));
      return row;
    });
    return { term: t.label, rows: positions.map((pos) => desc.colNames[order[pos]!]!), columns: [...desc.colNames], values };
  });
}

/**
 * The full-dummy matrix rdX: an intercept column (with an intercept), then for each term the columns of its model
 * matrix with every level of each factor (the first variable varying fastest, numeric variables multiplying), and
 * the "Missing cells" message for its columns that are all 0.
 */
export function fullDummyMatrix(desc: FixedEffectsDescription): { x: number[][]; colNames: string[]; messages: string[] } {
  const n = desc.x.length;
  const frameOf = new Map(desc.variables.map((v) => [v.name, v.frame]));
  const columns: number[][] = [];
  const colNames: string[] = [];
  if (desc.intercept) {
    columns.push(new Array<number>(n).fill(1));
    colNames.push("(Intercept)");
  }
  const partsOf = (name: string): { name: string; values: number[] }[] => {
    const fv = frameOf.get(name)!;
    if (fv.kind === "numeric") return [{ name, values: fv.values }];
    return fv.levels.map((level, l) => ({ name: name + level, values: fv.codes.map((c) => (c === l ? 1 : 0)) }));
  };
  for (const t of desc.terms) {
    let cur = partsOf(t.variables[0]!);
    for (const v of t.variables.slice(1)) {
      const next: typeof cur = [];
      for (const part of partsOf(v)) for (const c of cur) next.push({ name: `${c.name}:${part.name}`, values: c.values.map((x, i) => x * part.values[i]!) });
      cur = next;
    }
    for (const c of cur) {
      columns.push(c.values);
      colNames.push(c.name);
    }
  }
  const empty = colNames.filter((_, j) => columns[j]!.every((v) => v === 0));
  const messages = empty.length > 0 ? [`Missing cells for: ${empty.join(", ")}.  \nInterpret type III hypotheses with care.`] : [];
  return { x: Array.from({ length: n }, (_, i) => columns.map((c) => c[i]!)), colNames, messages };
}

/**
 * X remade from the same terms and model frame with treatment contrasts for every factor, restricted (if it is not
 * of full column rank) to the first r pivot columns of its pivoted QR decomposition (tolerance 1e-7), r its rank.
 */
export function treatmentModelMatrix(desc: FixedEffectsDescription): { x: number[][]; colNames: string[]; assign: number[] } {
  const data: DataFrame = {};
  const levels: Record<string, readonly string[]> = {};
  for (const { name, frame } of desc.variables) {
    if (frame.kind === "numeric") data[name] = frame.values;
    else {
      data[name] = frame.codes.map((c) => frame.levels[c]!);
      levels[name] = frame.levels;
    }
  }
  const sum = (nodes: FormulaNode[]): FormulaNode | undefined => nodes.reduce<FormulaNode | undefined>((l, r) => (l === undefined ? r : { type: "binary", op: "+", left: l, right: r }), undefined);
  const variable = (name: string): FormulaNode => ({ type: "var", name });
  // the variables listed in the order of the formula (for the names of the columns), the terms expanded
  const parsed = { response: undefined, rhs: sum(desc.variables.map((v) => variable(v.name))) ?? ONE };
  const termNodes = desc.terms.map((t) => t.variables.map(variable).reduce((l, r) => ({ type: "binary", op: ":", left: l, right: r })));
  const d = design(parsed, data, { levels, intercept: desc.intercept }, sum(termNodes) ?? ONE);
  let keep = d.colNames.map((_, j) => j);
  if (keep.length > 0) {
    const decomposition = qr(d.x);
    if (decomposition.rank < keep.length) keep = decomposition.pivot.slice(0, decomposition.rank);
  }
  return { x: columnsOf(d.x, keep), colNames: keep.map((j) => d.colNames[j]!), assign: keep.map((j) => d.assign[j]!) };
}

const ROW_ZERO = 1e-8;

/** Type III (and its messages) */
function typeIII(desc: FixedEffectsDescription): LmerHypotheses {
  const treatment = Object.values(desc.contrasts).every((c) => c === "contr.treatment");
  const xt = treatment ? { x: desc.x, colNames: desc.colNames, assign: desc.assign } : treatmentModelMatrix(desc);
  const pt = xt.colNames.length;
  const rd = fullDummyMatrix(desc);
  const gInverse = ginv(xt.x);
  // rows: the columns of rdX; columns: the columns of X_t
  const L0 = zapsmall(transpose(multiply(gInverse, rd.x, rd.colNames.length), rd.colNames.length));
  const containing = containingTerms(desc);
  const byOrder = desc.terms.map((t, k) => ({ k, order: t.variables.length })).sort((a, b) => b.order - a.order || a.k - b.k);
  for (const { k } of byOrder) {
    if (containing[k]!.length === 0) continue;
    const cols = termColumns(xt.assign, k);
    if (cols.length === 0) continue;
    const others = containing[k]!.flatMap((term) => termColumns(xt.assign, term));
    let block = columnsOf(L0, cols);
    if (others.length > 0) block = qrResid(qr(columnsOf(L0, others)), block);
    const zapped = zapsmall(block);
    L0.forEach((row, i) => cols.forEach((j, c) => (row[j] = zapped[i]![c]!)));
  }
  const rowOf = new Map(rd.colNames.map((name, i) => [name, i]));
  const L1 = xt.colNames.map((name) => {
    const i = rowOf.get(name);
    if (i === undefined) throw new Error(`lmerHypotheses: the column '${name}' of the model matrix is not a column of the full-dummy matrix`);
    return L0[i]!;
  });
  const mapping = treatment ? undefined : zapsmall(multiply(gInverse, desc.x, desc.colNames.length));
  const hypotheses = desc.terms.map((t, k): TermHypothesis => {
    const cols = termColumns(xt.assign, k).filter((j) => L1.reduce((s, row) => s + Math.abs(row[j]!), 0) > ROW_ZERO);
    const values = cols.map((j) => L1.map((row) => row[j]!));
    return {
      term: t.label,
      rows: cols.map((j) => xt.colNames[j]!),
      columns: [...desc.colNames],
      values: mapping === undefined ? values : multiply(values, mapping, desc.colNames.length),
    };
  });
  return { hypotheses, messages: rd.messages };
}

/**
 * The hypothesis matrices of lmerTest's ANOVA table of the given type, one per term (oracle/lmertest-behaviour.md,
 * section 2). If X has at most one column or the formula at most one term, every type is built as Type I.
 */
export function lmerHypotheses(desc: FixedEffectsDescription, type: HypothesisType = "III"): LmerHypotheses {
  if (desc.colNames.length <= 1 || desc.terms.length <= 1 || type === "I") return { hypotheses: typeI(desc), messages: [] };
  if (type === "II") return { hypotheses: typeII(desc), messages: [] };
  return typeIII(desc);
}
