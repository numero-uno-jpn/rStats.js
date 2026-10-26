// Analysis of deviance for generalized linear models: R's anova for one glm fit (terms added in order) and for a
// comparison of several fits, with the chi-squared (likelihood ratio), F, Rao score and Cp columns.
//
// Written for rStats.js (no ported code) from oracle/glm-behaviour.md and R's help pages (?anova.glm,
// ?stat.anova) and McCullagh and Nelder (1989). Each column of x is one term (x1, x2, ...). The score statistic of a
// smaller model against a larger one is computed from the working residuals and working weights of the smaller
// model's fit, regressed by weighted least squares on the larger model's matrix.

import { pf1 } from "../distributions/f.js";
import { pgamma1 } from "../distributions/gamma.js";
import { glmDispersion, refit, type GlmModel, type GlmResult, type IrlsFit } from "./glm.js";
import { makeFamily, Warnings } from "./glmFamily.js";
import { scoreStatistic } from "./glmConfint.js";

/** Tests of {@link glmAnova}. */
export type GlmAnovaTest = "Chisq" | "LRT" | "Rao" | "F" | "Cp";

/** Options for {@link glmAnova}. */
export interface GlmAnovaOptions {
  /**
   * The test: `"Chisq"` (or its synonym `"LRT"`), `"Rao"`, `"F"`, `"Cp"`, or `false` for none. Default, as R since
   * 4.4.0: `"Chisq"` when the dispersion is known (binomial, poisson or `dispersion` given), else `"F"`.
   */
  test?: GlmAnovaTest | false;
  /** Dispersion for the tests instead of the estimate of the largest model. */
  dispersion?: number;
}

/** Result of {@link glmAnova}: R's anova table. */
export interface GlmAnovaResult {
  /** Column names, such as `"Df"`, `"Deviance"`, `"Resid. Df"`, `"Resid. Dev"`, `"Pr(>Chi)"`. */
  colNames: string[];
  /** Row names: `"NULL"`, `"x1"`, ... for one fit; `"1"`, `"2"`, ... for a comparison. */
  rowNames: string[];
  /** One array per row; NaN where R leaves the cell empty (NA). */
  table: number[][];
  /** R's warnings (from the refits and the F test of binomial or poisson families). */
  warnings: string[];
}

/** Upper tail of chi-squared with df degrees of freedom */
const pchisqUpper = (q: number, df: number) => pgamma1(q, df / 2, 2, false, false);

interface Row {
  dfRes: number;
  dev: number;
  /** The fit and its model matrix (for the score statistics) */
  fit: IrlsFit;
  x: number[][];
  intercept: boolean;
}

/** The working residuals and weights of the fit of the model with the given columns */
function rowOf(model: GlmModel, cols: number[], warnings: Warnings): Row {
  const { fit, w } = refit(model, cols, warnings);
  const nOk = w.filter((v) => v > 0).length;
  return { dfRes: nOk - fit.rank, dev: fit.deviance, fit, x: model.x.map((r) => cols.map((j) => r[j]!)), intercept: model.intercept };
}

/** Score statistic of the smaller model's fit against the larger model's matrix */
const rao = (small: Row, large: Row) => scoreStatistic(large.x, small.fit.workingResiduals, small.fit.workingWeights, large.intercept);

/**
 * Analysis of deviance, for one `glm` fit (the sequential table, each column of `x` added in order) or for several
 * fits of the same data (`anova(fit1, fit2, ...)`). Equivalent to R's `anova()`.
 *
 * @param fits One fit, or an array of fits to compare.
 *
 * @example
 * ```ts
 * const y = [0, 0, 1, 0, 1, 1];
 * const fit0 = glm([[], [], [], [], [], []], y, { family: "binomial" });
 * const fit1 = glm([1, 2, 3, 4, 5, 6], y, { family: "binomial" });
 * const a = glmAnova(fit1);
 * a.colNames; // ["Df", "Deviance", "Resid. Df", "Resid. Dev", "Pr(>Chi)"]
 * a.table[1];  // [1, 3.3618, 4, 4.956, 0.066725]
 * glmAnova([fit0, fit1], { test: "LRT" }).table[1]; // [4, 4.956, 1, 3.3618, 0.066725]
 * ```
 */
export function glmAnova(fits: GlmResult | readonly GlmResult[], options: GlmAnovaOptions = {}): GlmAnovaResult {
  const list = Array.isArray(fits) ? (fits as readonly GlmResult[]) : [fits as GlmResult];
  if (list.length === 0) throw new RangeError("no fits to compare");
  const warnings = new Warnings();
  const compare = Array.isArray(fits) && list.length > 1;
  const first = list[0]!;
  const fam = makeFamily(first.model.familySpec);
  const fixed = fam.fixedDispersion;
  const test = options.test === undefined ? (options.dispersion !== undefined || fixed ? "Chisq" : "F") : options.test;

  const rows: { name: string; dfRes: number; dev: number }[] = [];
  let df: number[];
  let devDiff: number[];
  let score: number[] = [];
  let ref: GlmResult;
  if (!compare) {
    const fit = first;
    const model = fit.model;
    const nTerms = model.x.length > 0 ? model.x[0]!.length - (model.intercept ? 1 : 0) : 0;
    const base = model.intercept ? [0] : [];
    const colsOf = (k: number) => [...base, ...Array.from({ length: k }, (_, j) => j + base.length)];
    const fitRows: (Row | undefined)[] = [];
    // the refits with the first k terms; the last is the fit itself
    for (let k = 0; k <= nTerms; k++) {
      if (k === nTerms) {
        fitRows.push({ dfRes: fit.dfResidual, dev: fit.deviance, fit: asIrls(fit), x: model.x, intercept: model.intercept });
      } else if (k > 0 || test === "Rao") fitRows.push(rowOf(model, colsOf(k), warnings));
      else fitRows.push(undefined);
    }
    rows.push({ name: "NULL", dfRes: fit.dfNull, dev: fit.nullDeviance });
    for (let k = 1; k <= nTerms; k++) rows.push({ name: `x${k}`, dfRes: fitRows[k]!.dfRes, dev: fitRows[k]!.dev });
    df = rows.map((r, i) => (i === 0 ? NaN : rows[i - 1]!.dfRes - r.dfRes));
    devDiff = rows.map((r, i) => (i === 0 ? NaN : Math.max(rows[i - 1]!.dev - r.dev, 0)));
    if (test === "Rao") score = rows.map((_, i) => (i === 0 ? NaN : rao(fitRows[i - 1]!, fitRows[i]!)));
    ref = fit;
  } else {
    const n = list[0]!.model.x.length;
    if (list.some((f) => f.model.x.length !== n)) throw new RangeError("models were not all fitted to the same size of dataset");
    list.forEach((f, i) => rows.push({ name: String(i + 1), dfRes: f.dfResidual, dev: f.deviance }));
    df = rows.map((r, i) => (i === 0 ? NaN : rows[i - 1]!.dfRes - r.dfRes));
    devDiff = rows.map((r, i) => (i === 0 ? NaN : rows[i - 1]!.dev - r.dev));
    if (test === "Rao") {
      const fr = list.map((f) => ({ dfRes: f.dfResidual, dev: f.deviance, fit: asIrls(f), x: f.model.x, intercept: f.model.intercept }));
      score = rows.map((_, i) => {
        if (i === 0) return NaN;
        // the smaller model is the one with more residual degrees of freedom
        return df[i]! < 0 ? -rao(fr[i]!, fr[i - 1]!) : rao(fr[i - 1]!, fr[i]!);
      });
    }
    ref = list.reduce((a, b) => (b.dfResidual < a.dfResidual ? b : a));
  }

  const summaryWarnings = new Warnings();
  const dispersion = options.dispersion ?? glmDispersion(ref, summaryWarnings);
  summaryWarnings.list.forEach((m) => warnings.add(m));
  const dfDispersion = fixed ? Infinity : ref.dfResidual;

  const head = compare ? ["Resid. Df", "Resid. Dev", "Df", "Deviance"] : ["Df", "Deviance", "Resid. Df", "Resid. Dev"];
  const cells = rows.map((r, i) => (compare ? [r.dfRes, r.dev, df[i]!, devDiff[i]!] : [df[i]!, devDiff[i]!, r.dfRes, r.dev]));
  const colNames = [...head];
  const chisqP = (stat: number[]) =>
    rows.map((_, i) => {
      if (i === 0 || df[i] === 0) return NaN;
      const v = (stat[i]! / dispersion) * Math.sign(df[i]!);
      return v < 0 || Number.isNaN(v) ? NaN : pchisqUpper(v, Math.abs(df[i]!));
    });
  let extra: number[][] = [];
  if (test === "Chisq" || test === "LRT") {
    colNames.push("Pr(>Chi)");
    extra = [chisqP(devDiff)];
  } else if (test === "Rao") {
    colNames.push("Rao", "Pr(>Chi)");
    extra = [score, chisqP(score)];
  } else if (test === "F") {
    if (fixed) warnings.add(`using F test with a '${fam.family}' family is inappropriate`);
    if (dfDispersion !== 0) {
      const F = rows.map((_, i) => {
        const v = devDiff[i]! / df[i]! / dispersion;
        return i === 0 || df[i] === 0 || v < 0 ? NaN : v;
      });
      colNames.push("F", "Pr(>F)");
      extra = [F, F.map((v, i) => (Number.isNaN(v) ? NaN : pf1(v, Math.abs(df[i]!), dfDispersion, false, false)))];
    }
  } else if (test === "Cp") {
    const n = ref.model.x.length;
    colNames.push("Cp");
    extra = [rows.map((r) => r.dev + 2 * dispersion * (n - r.dfRes))];
  }
  const table = cells.map((r, i) => [...r, ...extra.map((col) => col[i]!)]);
  return { colNames, rowNames: rows.map((r) => r.name), table, warnings: warnings.list };
}

/** The parts of a fit that the score statistic uses */
function asIrls(fit: GlmResult): IrlsFit {
  return {
    coefficients: fit.coefficients,
    eta: fit.linearPredictors,
    mu: fit.fittedValues,
    deviance: fit.deviance,
    iter: fit.iter,
    converged: fit.converged,
    boundary: fit.boundary,
    rank: fit.rank,
    qr: fit.qr,
    used: fit.weights.map((v) => v > 0),
    workingWeights: fit.weights,
    workingResiduals: fit.residuals,
  };
}
