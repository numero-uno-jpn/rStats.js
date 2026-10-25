// Analysis of deviance for generalized linear models: R's anova for one glm fit (terms added sequentially) and for a
// list of fits (nested models compared in turn).
//
// Written for rStats.js (no ported code). The table follows P. McCullagh and J. A. Nelder, Generalized Linear Models
// (2nd ed., 1989), §2.3 and §4.4 (analysis of deviance; the F statistic for an estimated dispersion), with R's layout,
// column names and conventions established from R's documentation (?anova.glm, ?stat.anova), its source (read, not
// copied) and its output (test/fixtures/glmAnova.json): the dispersion of the largest model (or the one given), the
// chi-squared tests "Chisq" and "LRT" of deviance / dispersion, R's default test ("Chisq" when the dispersion is known,
// else "F"), the score test "Rao" (the reduction in the weighted sum of squares of the working residuals of the smaller
// model when they are regressed on the columns of the larger one), the F test on the residual degrees of freedom of the
// largest model, Mallows' Cp, and the warnings for an F test with a known dispersion.

import { pf1 } from "../distributions/f.js";
import { pgamma1 } from "../distributions/gamma.js";
import { dispersionOf, familyOf, glmFitCore, Warnings, type GlmResult } from "./glm.js";
import { initialize } from "./glmFamily.js";
import { weightedScore } from "./glmConfint.js";

/** Tests of {@link glmAnova}: R's `test` argument (`false` for none). */
export type GlmAnovaTest = "Chisq" | "LRT" | "Rao" | "F" | "Cp" | false;

/** Options for {@link glmAnova}. */
export interface GlmAnovaOptions {
  /** The test. Default: `"Chisq"` when the dispersion is known (binomial, poisson, or `dispersion` given), else `"F"`, as in R. */
  test?: GlmAnovaTest;
  /** The dispersion for the tests, instead of the estimate from the largest model. */
  dispersion?: number;
  /**
   * For one fit: the term of each column of `x` (1-based, non-decreasing), to add several columns as one term (such
   * as the indicator columns of a factor). Default: each column is a term.
   */
  terms?: number[];
  /** For one fit: the names of the terms (row names). Default `"x1"`, `"x2"`, ... */
  termNames?: string[];
}

/** Result of {@link glmAnova}: R's analysis of deviance table. */
export interface GlmAnovaResult {
  /** R's column names (`"Df"`, `"Deviance"`, `"Resid. Df"`, `"Resid. Dev"`, and the test's columns). */
  colNames: string[];
  /** R's row names (`"NULL"` and the terms for one fit; `"1"`, `"2"`, ... for a list of fits). */
  rowNames: string[];
  /** The table, one array per row; NaN where R leaves the cell empty. */
  table: number[][];
  /** R's warnings (an F test with a known dispersion, refits that did not converge). */
  warnings: string[];
}

interface Columns {
  df: number[];
  deviance: number[];
  resDf: number[];
  resDev: number[];
  rao?: number[];
}

/** R's stat.anova: the test columns from the deviances (or score statistics), the dispersion and its degrees of freedom */
function testColumns(
  test: Exclude<GlmAnovaTest, false>,
  c: Columns,
  scale: number,
  dfScale: number,
  n: number,
): { names: string[]; cols: number[][] } {
  const pos = (v: number): number => (Number.isNaN(v) || v < 0 ? NaN : v);
  switch (test) {
    case "Rao":
    case "LRT":
    case "Chisq": {
      const stat = test === "Rao" ? c.rao! : c.deviance;
      const p = c.df.map((d, i) => {
        const v = d === 0 ? NaN : pos((stat[i]! / scale) * Math.sign(d));
        return Number.isNaN(v) ? NaN : pgamma1(v, Math.abs(d) / 2, 2, false, false);
      });
      return { names: ["Pr(>Chi)"], cols: [p] };
    }
    case "F": {
      const f = c.df.map((d, i) => (d === 0 ? NaN : pos(c.deviance[i]! / d / scale)));
      const p = f.map((v, i) => (Number.isNaN(v) ? NaN : pf1(v, Math.abs(c.df[i]!), dfScale, false, false)));
      return { names: ["F", "Pr(>F)"], cols: [f, p] };
    }
    case "Cp":
      return { names: ["Cp"], cols: [c.resDev.map((d, i) => d + 2 * scale * (n - c.resDf[i]!))] };
  }
}

/** Refit of a model with the columns `cols` of the model matrix of `fit` (R's anova refits with glm.fit) */
function refit(fit: GlmResult, cols: number[], warn: (m: string) => void): ReturnType<typeof glmFitCore> {
  const fam = familyOf(fit, warn);
  const ini = initialize(fam, fit.y, fit.priorWeights, false, warn);
  return glmFitCore({
    X: fit.modelMatrix.map((r) => cols.map((j) => r[j]!)),
    y: ini.y,
    weights: ini.weights,
    offset: fit.offset ?? fit.y.map(() => 0),
    fam,
    n: ini.n,
    mustart: ini.mustart,
    epsilon: fit.control.epsilon,
    maxit: fit.control.maxit,
    intercept: fit.intercept,
    warn,
  });
}

function finish(
  head: string[],
  rowNames: string[],
  base: number[][],
  c: Columns,
  testOpt: GlmAnovaTest | undefined,
  big: GlmResult,
  dispersionOpt: number | undefined,
  dfResidualBig: number,
  n: number,
  warnings: Warnings,
): GlmAnovaResult {
  const { dispersion, estimated } = dispersionOf(big, dispersionOpt);
  const dfDispersion = !estimated || dispersion === 1 ? Infinity : dfResidualBig;
  const test = testOpt === undefined ? (dfDispersion === Infinity ? "Chisq" : "F") : testOpt;
  const colNames = head.slice();
  const cols = base.map((col) => col.slice());
  if (test === "Rao") {
    colNames.push("Rao");
    cols.push(c.rao!);
  }
  // an estimated dispersion with no residual degrees of freedom: no test, as in R
  if (test !== false && !Number.isNaN(dispersion)) {
    if (test === "F" && dfDispersion === Infinity) {
      const f = big.family.family;
      warnings.add(
        f === "binomial" || f === "poisson" ? `using F test with a '${f}' family is inappropriate` : "using F test with a fixed dispersion is inappropriate",
      );
    }
    const t = testColumns(test, c, dispersion, dfDispersion, n);
    colNames.push(...t.names);
    cols.push(...t.cols);
  }
  return { colNames, rowNames, table: rowNames.map((_, i) => cols.map((col) => col[i]!)), warnings: warnings.list };
}

/**
 * Analysis of deviance. Equivalent to R's `anova()` for glm fits. For one {@link glm} fit, the terms (each column of
 * `x`, or the groups of `terms`) are added in order and each row gives the reduction in deviance (refitting the
 * smaller models); for an array of fits, the models are compared in turn. With the tests of R's `test` argument:
 * `"Chisq"`/`"LRT"`, `"Rao"`, `"F"` and `"Cp"`.
 */
export function glmAnova(fit: GlmResult | GlmResult[], options: GlmAnovaOptions = {}): GlmAnovaResult {
  const warnings = new Warnings();
  if (Array.isArray(fit)) {
    if (fit.length === 0) throw new RangeError("no models given");
    if (fit.length === 1) return glmAnova(fit[0]!, options);
    return anovaList(fit, options, warnings);
  }
  const p = fit.coefficients.length;
  const icpt = fit.intercept ? 1 : 0;
  const nx = p - icpt;
  const terms = options.terms ?? Array.from({ length: nx }, (_, j) => j + 1);
  if (terms.length !== nx || terms.some((t, j) => !Number.isInteger(t) || t < 1 || (j > 0 && t < terms[j - 1]!))) {
    throw new RangeError("'terms' must give a non-decreasing term number (from 1) for each column of x");
  }
  const varseq = [...(fit.intercept ? [0] : []), ...terms];
  const nvars = nx === 0 ? 0 : terms[nx - 1]!;
  const names = options.termNames ?? Array.from({ length: nvars }, (_, i) => `x${i + 1}`);
  if (names.length !== nvars) throw new RangeError(`'termNames' must have ${nvars} names`);
  const colsUpTo = (i: number): number[] => varseq.flatMap((v, j) => (v <= i ? [j] : []));
  const resdf = [fit.dfNull];
  const resdev = [fit.nullDeviance];
  const doScore = options.test === "Rao";
  const score: number[] = [];
  let r: number[] = [];
  let w: number[] = [];
  if (doScore && nvars > 0) {
    const f0 = refit(fit, colsUpTo(0), warnings.add);
    r = f0.residuals;
    w = f0.w;
  }
  const X = fit.modelMatrix;
  const sub = (cols: number[]): number[][] => X.map((row) => cols.map((j) => row[j]!));
  for (let i = 1; i < nvars; i++) {
    const f = refit(fit, colsUpTo(i), warnings.add);
    if (doScore) {
      score.push(weightedScore(sub(colsUpTo(i)), r, w, fit.intercept));
      r = f.residuals;
      w = f.w;
    }
    resdf.push(f.dfResidual);
    resdev.push(f.dev);
  }
  if (doScore && nvars > 0) score.push(weightedScore(X, r, w, fit.intercept));
  if (nvars > 0) {
    resdf.push(fit.dfResidual);
    resdev.push(fit.deviance);
  }
  const df = resdf.map((v, i) => (i === 0 ? NaN : resdf[i - 1]! - v));
  const deviance = resdev.map((v, i) => (i === 0 ? NaN : Math.max(0, resdev[i - 1]! - v)));
  const c: Columns = { df, deviance, resDf: resdf, resDev: resdev, rao: [NaN, ...score] };
  return finish(
    ["Df", "Deviance", "Resid. Df", "Resid. Dev"],
    ["NULL", ...names],
    [df, deviance, resdf, resdev],
    c,
    options.test,
    fit,
    options.dispersion,
    fit.dfResidual,
    fit.y.length,
    warnings,
  );
}

function anovaList(fits: GlmResult[], options: GlmAnovaOptions, warnings: Warnings): GlmAnovaResult {
  const n = fits[0]!.y.length;
  if (fits.some((f) => f.y.length !== n)) throw new RangeError("models were not all fitted to the same size of dataset");
  const resdf = fits.map((f) => f.dfResidual);
  const resdev = fits.map((f) => f.deviance);
  const df = resdf.map((v, i) => (i === 0 ? NaN : resdf[i - 1]! - v));
  const deviance = resdev.map((v, i) => (i === 0 ? NaN : resdev[i - 1]! - v));
  const rao = [NaN];
  if (options.test === "Rao") {
    for (let i = 0; i < fits.length - 1; i++) {
      const bigger = resdf[i]! > resdf[i + 1]!;
      const m1 = bigger ? fits[i]! : fits[i + 1]!;
      const m2 = bigger ? fits[i + 1]! : fits[i]!;
      const s = weightedScore(m2.modelMatrix, m1.workingResiduals, m1.workingWeights, true);
      rao.push(resdf[i]! < resdf[i + 1]! ? -s : s);
    }
  }
  let bigIndex = 0;
  resdf.forEach((v, i) => {
    if (v < resdf[bigIndex]!) bigIndex = i;
  });
  const c: Columns = { df, deviance, resDf: resdf, resDev: resdev, rao };
  return finish(
    ["Resid. Df", "Resid. Dev", "Df", "Deviance"],
    fits.map((_, i) => String(i + 1)),
    [resdf, resdev, df, deviance],
    c,
    options.test,
    fits[bigIndex]!,
    options.dispersion,
    Math.min(...resdf),
    n,
    warnings,
  );
}
